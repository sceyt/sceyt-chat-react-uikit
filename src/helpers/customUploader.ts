import { ICustomUploader, ICustomUploaderDownloadOptions, IProgress, IUploadTask } from '../components/ChatContainer'
import { IAttachment } from '../types'
import log from 'loglevel'
import { getClient } from '../common/client'
import { CONNECTION_STATUS } from '../store/user/constants'
import { getEncryptAttachments, IAttachmentEncryption, prepareDownloadFile } from './attachmentEncryption'

let CustomUploader: ICustomUploader
let sendAttachmentsAsSeparateMessages: boolean = false

// The stop, resume and cancel controls of each running upload, by attachment tid.
const pendingUploaders: { [key: string]: Pick<IUploadTask, 'stop' | 'resume' | 'cancel'> } = {}
// Uploads that show a stop control before they start (a video while its preview
// is uploaded): a pause pressed meanwhile is kept here and applied when it starts.
const notStartedUploads = new Map<string, { paused: boolean }>()

export const markUploadNotStarted = (attachmentId: string) => {
  notStartedUploads.set(attachmentId, { paused: false })
}

export const isUploadNotStarted = (attachmentId: string) => notStartedUploads.has(attachmentId)

export const isUploadPausedBeforeStart = (attachmentId: string) => !!notStartedUploads.get(attachmentId)?.paused

export const setCustomUploader = (uploader: any) => {
  CustomUploader = uploader
}

export const setSendAttachmentsAsSeparateMessages = (asSeparate: boolean) => {
  sendAttachmentsAsSeparateMessages = asSeparate
}

export const getSendAttachmentsAsSeparateMessages = () => sendAttachmentsAsSeparateMessages

export const getCustomUploader = () => CustomUploader

export const getCustomDownloader = (): ICustomUploader['download'] | undefined =>
  CustomUploader && CustomUploader.download

// Whether the uploader prepares the files it stores and opens the ones it
// downloads, with the chat client.
const uploaderPreparesFiles = () => !!CustomUploader && !!CustomUploader.preparesFiles

/**
 * Whether the connection is lost: the browser is offline, or the chat client is
 * not connected (the network may be up but lose every packet). Upload progress
 * reported then is not shown: the browser still puts the rest of a request into
 * the lost connection and counts those bytes as sent (the bar would run to the end).
 */
export const isConnectionLost = () => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const connectionState = getClient()?.connectionState
  return !!connectionState && connectionState !== CONNECTION_STATUS.CONNECTED
}

export interface ICustomUploadResult {
  uri: string
  /** The uploaded file as the user sees it (always the plaintext), or null when the uploader gave only its local path. */
  blob: Blob | null
  /** The file's `enc` object for the attachment metadata, when the file was encrypted. */
  encryption?: IAttachmentEncryption
}

export const customUpload = (
  attachment: IAttachment,
  // eslint-disable-next-line no-unused-vars
  progress: ({ loaded, total }: IProgress) => void,
  // eslint-disable-next-line no-unused-vars
  messageType: string | null | undefined,
  // eslint-disable-next-line no-unused-vars
  getUpdatedFilePath?: (newPath: string) => void
): Promise<ICustomUploadResult> => {
  return new Promise((resolve, reject) => {
    const encrypt = getEncryptAttachments()
    if (!CustomUploader) {
      reject(new Error('No Custom uploader'))
      return
    }
    if (encrypt && !uploaderPreparesFiles()) {
      // Fails here, before anything is sent: an uploader without preparesFiles
      // would store the file it was given, unencrypted.
      notStartedUploads.delete(attachment.tid!)
      reject(
        new Error('Attachment encryption needs a custom uploader with preparesFiles, which stores the file encrypted')
      )
      return
    }
    const uploadTask: IUploadTask = {
      updateLocalFileLocation: getUpdatedFilePath,
      progress,
      failure: (e: Error) => {
        delete pendingUploaders[attachment.tid!]
        reject(e)
      },
      success: ({ uri, blob, encryption }) => {
        delete pendingUploaders[attachment.tid!]
        if (encrypt && !encryption) {
          // The uploader reported no encryption: the stored file may be
          // plaintext, so the message is not sent.
          reject(
            new Error(
              'The custom uploader stored a file without reporting its encryption; ' +
                'prepare it with client.prepareUpload(file, { encrypt: true })'
            )
          )
          return
        }
        resolve({ uri, blob, ...(encryption ? { encryption } : {}) })
      },
      cancel: () => {},
      stop: () => {},
      resume: () => {}
    }
    pendingUploaders[attachment.tid!] = uploadTask
    const pausedBeforeStart = isUploadPausedBeforeStart(attachment.tid!)
    notStartedUploads.delete(attachment.tid!)
    CustomUploader.upload(attachment, uploadTask, messageType, { encrypt })
    if (pausedBeforeStart) {
      // The uploader installs stop() when upload() is called, so nothing is sent.
      uploadTask.stop()
    }
  })
}

/**
 * Uploads one attachment's file with the SDK (client.upload), encrypted when
 * `encryptAttachments` is on; the uikit uploads each attachment of a message
 * this way. Stop, resume and cancel work as for a custom uploader: stop()
 * aborts the request and resume() sends the file again from the start (the
 * SDK sends it whole), so the progress then waits until it passes what it
 * showed. A cancelled upload never settles, as with a custom uploader: its
 * message is gone.
 */
export const sdkUpload = (
  attachment: IAttachment,
  // eslint-disable-next-line no-unused-vars
  progress: (progress: IProgress) => void
): Promise<ICustomUploadResult> =>
  new Promise((resolve, reject) => {
    const tid = attachment.tid!
    const pausedBeforeStart = isUploadPausedBeforeStart(tid)
    notStartedUploads.delete(tid)
    const file: Blob | null =
      attachment.url instanceof Blob ? attachment.url : attachment.data instanceof Blob ? attachment.data : null
    if (typeof getClient()?.upload !== 'function') {
      reject(new Error('Uploading an attachment needs a sceyt-chat version with client.upload'))
      return
    }
    if (!file) {
      reject(new Error(`File for tid ${tid} is unavailable for upload`))
      return
    }

    let request: AbortController | undefined
    let cancelled = false
    let shownLoaded = 0
    const finish = () => {
      delete pendingUploaders[tid]
      request = undefined
    }
    const send = () => {
      const current = new AbortController()
      request = current
      // The browser may still report progress for a request that failed (the bytes it had sent): not shown.
      let settled = false
      getClient()
        .upload(file, {
          encrypt: getEncryptAttachments(),
          signal: current.signal,
          progress: (loaded: number, total: number) => {
            if (settled || current.signal.aborted || loaded < shownLoaded || isConnectionLost()) return
            shownLoaded = loaded
            progress({ loaded, total })
          }
        })
        .finally(() => {
          settled = true
        })
        .then(
          ({ url, encryption }: { url: string; encryption?: IAttachmentEncryption }) => {
            // Stored, even when stop() came as it finished.
            if (cancelled) return
            finish()
            resolve({ uri: url, blob: file, ...(encryption ? { encryption } : {}) })
          },
          (error: Error) => {
            // Aborted by stop() or cancel(), not a failure.
            if (current.signal.aborted) return
            finish()
            reject(error)
          }
        )
    }

    pendingUploaders[tid] = {
      stop: () => {
        request?.abort()
        request = undefined
        return true
      },
      resume: () => {
        if (!request) send()
        return true
      },
      cancel: () => {
        cancelled = true
        request?.abort()
        request = undefined
      }
    }
    if (!pausedBeforeStart) send()
  })

/** Uploads one attachment: with the custom uploader when there is one, else with the SDK. */
export const uploadAttachmentFile = (
  attachment: IAttachment,
  // eslint-disable-next-line no-unused-vars
  progress: (progress: IProgress) => void,
  messageType: string | null | undefined,
  // eslint-disable-next-line no-unused-vars
  getUpdatedFilePath?: (newPath: string) => void
): Promise<ICustomUploadResult> =>
  CustomUploader ? customUpload(attachment, progress, messageType, getUpdatedFilePath) : sdkUpload(attachment, progress)

const asBlob = async (body: any): Promise<Blob> => {
  if (body instanceof Blob) return body
  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return new Blob([body as BlobPart])
  if (typeof body === 'string') {
    const response = await fetch(body)
    if (!response.ok) {
      throw new Error(`Unable to read downloaded media (${response.status})`)
    }
    return response.blob()
  }
  throw new Error('Media downloader returned an unsupported result')
}

/**
 * The custom downloader of one file of an attachment, called with the URL to
 * download. It calls the uploader's `download` with the attachment and
 * `{ kind, url, type }`. For an encrypted file (`encryption`: its `enc`, or a
 * thumbnail's own key) it returns the decrypted file, in the same shape the
 * custom downloader returned ({ Body }, a Blob, or a URL string). An uploader
 * with `preparesFiles` also gets `encryption` and opens the file itself.
 * `type` is the file's real type, e.g. 'video/mp4'. `download` defaults to the
 * CustomUploader's; without one, the SDK downloads the file (client.download).
 */
export type AttachmentDownloader = (
  // eslint-disable-next-line no-unused-vars
  url: string,
  // eslint-disable-next-line no-unused-vars
  asFile: boolean,
  // eslint-disable-next-line no-unused-vars
  progress: (progress: any) => void,
  // eslint-disable-next-line no-unused-vars
  messageType?: string | null
) => Promise<any>

// A request the attachment downloader returned, to the uploader's own request
// inside it: the uploader's cancelRequest only knows its own.
const uploaderRequests = new WeakMap<Promise<any>, Promise<any>>()
// A request of the SDK's downloader, to what cancels it.
const sdkRequests = new WeakMap<Promise<any>, AbortController>()

// Downloads with the SDK (client.download), which opens the file (decrypted
// with `encryption`) and resumes a lost connection; gives { Body } like a
// custom downloader.
const sdkDownloader =
  (encryption: IAttachmentEncryption | undefined, type: string): AttachmentDownloader =>
  (url, _asFile, progress) => {
    if (typeof getClient()?.download !== 'function') {
      return Promise.reject(new Error('Downloading an attachment needs a sceyt-chat version with client.download'))
    }
    const controller = new AbortController()
    const request = getClient()
      .download(url, {
        metadata: encryption ? { enc: encryption } : {},
        type,
        signal: controller.signal,
        progress: (loaded: number, total?: number) => progress({ loaded, total: total || 0 })
      })
      .then((Body: Blob) => ({ Body, ContentType: Body.type }))
    sdkRequests.set(request, controller)
    return request
  }

export const getAttachmentDownloader = (
  attachment: IAttachment,
  kind: ICustomUploaderDownloadOptions['kind'],
  encryption?: IAttachmentEncryption,
  type: string = '',
  download: ICustomUploader['download'] | undefined = getCustomDownloader()
): AttachmentDownloader => {
  if (!download) return sdkDownloader(encryption, type)
  if (uploaderPreparesFiles()) {
    // The uploader opens the file itself; its own request, so its cancelRequest finds it.
    return (url, asFile, progress, messageType) => {
      try {
        // Metadata that cannot be opened fails before anything is downloaded.
        prepareDownloadFile(encryption, type)
      } catch (error) {
        return Promise.reject(error)
      }
      return download(attachment, asFile, progress, messageType, { kind, url, encryption, type })
    }
  }
  const requestOf: AttachmentDownloader = (url, asFile, progress, messageType) =>
    download(attachment, asFile, progress, messageType, { kind, url, type })
  if (!encryption) return requestOf
  return (url, asFile, progress, messageType) => {
    let file: ReturnType<typeof prepareDownloadFile>
    try {
      file = prepareDownloadFile(encryption, type)
    } catch (error) {
      return Promise.reject(error)
    }
    const request = requestOf(url, asFile, progress, messageType)
    const opened = request.then(async (result: any) => {
      const hasBody = result && typeof result === 'object' && 'Body' in result
      const plaintext = await file.open(await asBlob(hasBody ? result.Body : result))
      if (hasBody) return { ...result, Body: plaintext }
      return typeof result === 'string' ? URL.createObjectURL(plaintext) : plaintext
    })
    uploaderRequests.set(opened, request)
    return opened
  }
}

/** Cancels a request returned by a downloader from getAttachmentDownloader. */
export const cancelDownloadRequest = (request: Promise<any>) => {
  const sdkRequest = sdkRequests.get(request)
  if (sdkRequest) {
    sdkRequest.abort()
    return
  }
  CustomUploader?.cancelRequest(uploaderRequests.get(request) || request)
}

export const pauseUpload = (attachmentId: string) => {
  if (pendingUploaders[attachmentId]) {
    return pendingUploaders[attachmentId].stop()
  } else if (notStartedUploads.has(attachmentId)) {
    notStartedUploads.set(attachmentId, { paused: true })
    return true
  } else {
    log.info('Unknown uploading task')
    return false
  }
}

export const resumeUpload = (attachmentId: string) => {
  if (pendingUploaders[attachmentId]) {
    return pendingUploaders[attachmentId].resume()
  } else if (notStartedUploads.has(attachmentId)) {
    notStartedUploads.set(attachmentId, { paused: false })
    return true
  } else {
    log.info('Unknown uploading task')
    return false
  }
}

export const cancelUpload = (attachmentId: string) => {
  notStartedUploads.delete(attachmentId)
  const task = pendingUploaders[attachmentId]
  if (task) {
    delete pendingUploaders[attachmentId]
    return task.cancel()
  }
}
