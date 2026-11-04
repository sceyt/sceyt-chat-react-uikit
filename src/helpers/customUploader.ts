import { ICustomUploader, ICustomUploaderDownloadOptions, IProgress, IUploadTask } from '../components/ChatContainer'
import { IAttachment } from '../types'
import log from 'loglevel'
import { getClient } from '../common/client'
import { CONNECTION_STATUS } from '../store/user/constants'
import {
  fileEncryption,
  getEncryptAttachments,
  getFileEncryption,
  IAttachmentEncryption,
  prepareDownloadFile
} from './attachmentEncryption'

// The app's transport (`fileTransfer.transport`, or the CustomUploader prop), if it has one.
let CustomUploader: ICustomUploader | undefined
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

/** The app's transport; undefined goes back to the default one (the chat client's). */
export const setCustomUploader = (uploader: ICustomUploader | undefined) => {
  CustomUploader = uploader
}

export const setSendAttachmentsAsSeparateMessages = (asSeparate: boolean) => {
  sendAttachmentsAsSeparateMessages = asSeparate
}

export const getSendAttachmentsAsSeparateMessages = () => sendAttachmentsAsSeparateMessages

/** The app's own transport, or undefined when it uses the default one. */
export const getCustomUploader = () => CustomUploader

/** The app's own transport's download, or undefined when it uses the default one. */
export const getCustomDownloader = (): ICustomUploader['download'] | undefined =>
  CustomUploader && CustomUploader.download

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

// Uploads one attachment's file with `transport`.
const uploadWith = (
  transport: ICustomUploader,
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
    if (encrypt && !transport.preparesFiles) {
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
                'encrypt it with options.fileEncryption.prepareEncryption(file)'
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
    // The default transport sees a pause pressed before the start, and sends nothing until resume.
    transport.upload(attachment, uploadTask, messageType, { encrypt, fileEncryption: getFileEncryption() })
    notStartedUploads.delete(attachment.tid!)
    if (pausedBeforeStart) {
      // The uploader installs stop() when upload() is called, so nothing is sent.
      uploadTask.stop()
    }
  })
}

/** Uploads one attachment's file with the app's own transport. */
export const customUpload = (
  attachment: IAttachment,
  // eslint-disable-next-line no-unused-vars
  progress: ({ loaded, total }: IProgress) => void,
  // eslint-disable-next-line no-unused-vars
  messageType: string | null | undefined,
  // eslint-disable-next-line no-unused-vars
  getUpdatedFilePath?: (newPath: string) => void
): Promise<ICustomUploadResult> =>
  CustomUploader
    ? uploadWith(CustomUploader, attachment, progress, messageType, getUpdatedFilePath)
    : Promise.reject(new Error('No Custom uploader'))

// The default transport's downloads, to what cancels each.
const defaultRequests = new WeakMap<Promise<any>, AbortController>()

const abortError = () => Object.assign(new Error('The upload was stopped'), { name: 'AbortError' })

/**
 * The default transport: files go to the chat server with the chat client, one
 * request per file (client.upload / client.download). Encryption is the
 * configured one (`options.fileEncryption`); with the default one, the chat
 * client decrypts a file as it downloads it. stop() aborts the request and
 * resume() sends the file again from the start (the server has no multipart
 * upload; an encrypted file is encrypted once, so it is sent again with the
 * same key), so the progress then waits until it passes what it showed. A
 * cancelled upload never settles: its message is gone.
 */
export const defaultFileTransferTransport: ICustomUploader = {
  preparesFiles: true,
  upload: (attachment, uploadTask, _messageType, { encrypt, fileEncryption: encryption }) => {
    const file: Blob | null =
      attachment.url instanceof Blob ? attachment.url : attachment.data instanceof Blob ? attachment.data : null
    if (typeof getClient()?.upload !== 'function') {
      uploadTask.failure(new Error('Uploading an attachment needs a sceyt-chat version with client.upload'))
      return
    }
    if (!file) {
      uploadTask.failure(new Error(`File for tid ${attachment.tid} is unavailable for upload`))
      return
    }
    const name = (file as File).name || attachment.name || 'file'
    // What is stored: the file itself, or the file encrypted (once, for every attempt).
    // The file encrypted, once for every attempt: sent again with the same key.
    let encrypted: Promise<{ body: Blob; encryption: IAttachmentEncryption }> | undefined
    const encryptedFile = () =>
      (encrypted =
        encrypted ||
        encryption.prepareEncryption(file).then(async (session) => ({
          body: new File([await session.readAll()], name, { type: session.contentType }),
          encryption: session.encryptionInfo
        })))

    let request: AbortController | undefined
    let cancelled = false
    let shownLoaded = 0
    const send = () => {
      const current = new AbortController()
      request = current
      // The browser may still report progress for a request that failed (the bytes it had sent): not shown.
      let settled = false
      // The stored bytes go as they are: the client does not encrypt them again.
      const store = (body: Blob, storedEncryption?: IAttachmentEncryption) =>
        getClient()
          .upload(body, {
            encrypt: false,
            signal: current.signal,
            progress: (loaded: number, total: number) => {
              if (settled || current.signal.aborted || loaded < shownLoaded || isConnectionLost()) return
              shownLoaded = loaded
              uploadTask.progress({ loaded, total })
            }
          })
          .then(({ url }: { url: string }) => ({ url, encryption: storedEncryption }))
      const sent: Promise<{ url: string; encryption?: IAttachmentEncryption }> = encrypt
        ? encryptedFile().then(({ body, encryption: bodyEncryption }) => {
            if (current.signal.aborted) throw abortError()
            return store(body, bodyEncryption)
          })
        : store(file)
      sent
        .finally(() => {
          settled = true
        })
        .then(
          ({ url, encryption: storedEncryption }) => {
            // Stored, even when stop() came as it finished.
            if (cancelled) return
            request = undefined
            uploadTask.success({ uri: url, blob: file, ...(storedEncryption ? { encryption: storedEncryption } : {}) })
          },
          (error: Error) => {
            // Aborted by stop() or cancel(), not a failure.
            if (current.signal.aborted) return
            request = undefined
            uploadTask.failure(error)
          }
        )
    }

    uploadTask.stop = () => {
      request?.abort()
      request = undefined
      return true
    }
    uploadTask.resume = () => {
      if (!request && !cancelled) send()
      return true
    }
    uploadTask.cancel = () => {
      cancelled = true
      request?.abort()
      request = undefined
    }
    if (!isUploadPausedBeforeStart(attachment.tid!)) send()
  },
  download: (_attachment, _asFile, progress, _messageType, { url, encryption, type, fileEncryption: decryption }) => {
    if (typeof getClient()?.download !== 'function') {
      return Promise.reject(new Error('Downloading an attachment needs a sceyt-chat version with client.download'))
    }
    const controller = new AbortController()
    // With its own encryption the chat client opens the file as it downloads it
    // (after a lost connection it goes on from the last whole segment, and keeps
    // only the plaintext). With the app's, it gives the stored bytes, which that opens.
    const clientOpens = !encryption || decryption === fileEncryption
    const request = getClient()
      .download(url, {
        metadata: encryption && clientOpens ? { enc: encryption } : {},
        type: clientOpens ? type : '',
        signal: controller.signal,
        progress: (loaded: number, total?: number) => progress({ loaded, total: total || 0 })
      })
      .then(async (downloaded: Blob) => {
        const Body =
          encryption && !clientOpens
            ? await (await decryption.prepareDecryption(downloaded, encryption, type)).readAll()
            : downloaded
        return { Body, ContentType: Body.type }
      })
    defaultRequests.set(request, controller)
    return request
  },
  cancelRequest: (request) => defaultRequests.get(request)?.abort()
}

/** The transport files go through: the app's own, or the default one (the chat client's). */
export const getTransport = (): ICustomUploader => CustomUploader || defaultFileTransferTransport

/** Uploads one attachment's file with the default transport (the chat client's). */
export const sdkUpload = (
  attachment: IAttachment,
  // eslint-disable-next-line no-unused-vars
  progress: (progress: IProgress) => void
): Promise<ICustomUploadResult> => uploadWith(defaultFileTransferTransport, attachment, progress, undefined)

/** Uploads one attachment's file with the transport: the app's own, or the default one. */
export const uploadAttachmentFile = (
  attachment: IAttachment,
  // eslint-disable-next-line no-unused-vars
  progress: (progress: IProgress) => void,
  messageType: string | null | undefined,
  // eslint-disable-next-line no-unused-vars
  getUpdatedFilePath?: (newPath: string) => void
): Promise<ICustomUploadResult> => uploadWith(getTransport(), attachment, progress, messageType, getUpdatedFilePath)

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
 * The downloader of one file of an attachment, called with the URL to
 * download. It calls the transport's `download` with the attachment and
 * `{ kind, url, type, fileEncryption }`. For an encrypted file (`encryption`:
 * its `enc`, or a thumbnail's own key) it returns the decrypted file, in the
 * same shape the download returned ({ Body }, a Blob, or a URL string). A
 * transport with `preparesFiles` also gets `encryption` and opens the file
 * itself. `type` is the file's real type, e.g. 'video/mp4'. `download` defaults
 * to the transport's: the app's own, or the default one (client.download).
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

// A request the attachment downloader returned, to the transport's own request
// inside it: the transport's cancelRequest only knows its own.
const uploaderRequests = new WeakMap<Promise<any>, Promise<any>>()

// Fails before anything is downloaded when the chat client cannot open this
// encrypted file's metadata (the default encryption); the app's encryption
// checks it as it opens the file. An unencrypted file needs no check.
const checkOpenable = (encryption: IAttachmentEncryption | undefined, type: string) => {
  if (encryption && getFileEncryption() === fileEncryption) prepareDownloadFile(encryption, type)
}

export const getAttachmentDownloader = (
  attachment: IAttachment,
  kind: ICustomUploaderDownloadOptions['kind'],
  encryption?: IAttachmentEncryption,
  type: string = '',
  download?: ICustomUploader['download']
): AttachmentDownloader => {
  const transport = getTransport()
  const fileDownload = download || transport.download
  if (fileDownload === transport.download && transport.preparesFiles) {
    // The transport opens the file itself; its own request, so its cancelRequest finds it.
    return (url, asFile, progress, messageType) => {
      try {
        // Metadata that cannot be opened fails before anything is downloaded.
        checkOpenable(encryption, type)
      } catch (error) {
        return Promise.reject(error)
      }
      return fileDownload(attachment, asFile, progress, messageType, {
        kind,
        url,
        encryption,
        type,
        fileEncryption: getFileEncryption()
      })
    }
  }
  const requestOf: AttachmentDownloader = (url, asFile, progress, messageType) =>
    fileDownload(attachment, asFile, progress, messageType, { kind, url, type, fileEncryption: getFileEncryption() })
  if (!encryption) return requestOf
  return (url, asFile, progress, messageType) => {
    try {
      checkOpenable(encryption, type)
    } catch (error) {
      return Promise.reject(error)
    }
    const request = requestOf(url, asFile, progress, messageType)
    const opened = request.then(async (result: any) => {
      const hasBody = result && typeof result === 'object' && 'Body' in result
      const stored = await asBlob(hasBody ? result.Body : result)
      const plaintext = await (await getFileEncryption().prepareDecryption(stored, encryption, type)).readAll()
      if (hasBody) return { ...result, Body: plaintext }
      return typeof result === 'string' ? URL.createObjectURL(plaintext) : plaintext
    })
    uploaderRequests.set(opened, request)
    return opened
  }
}

/** Cancels a request returned by a downloader from getAttachmentDownloader. */
export const cancelDownloadRequest = (request: Promise<any>) => {
  getTransport().cancelRequest(uploaderRequests.get(request) || request)
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
