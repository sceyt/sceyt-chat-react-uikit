import { ICustomUploader, ICustomUploaderUploadFiles, IProgress, IUploadTask } from '../components/ChatContainer'
import { IAttachment } from '../types'
import log from 'loglevel'
import {
  canPrepareAttachmentFiles,
  getEncryptAttachments,
  IAttachmentEncryption,
  IAttachmentUploadFile,
  prepareDownloadFile,
  prepareUploadFile
} from './attachmentEncryption'

let CustomUploader: ICustomUploader
let sendAttachmentsAsSeparateMessages: boolean = false

const pendingUploaders: { [key: string]: IUploadTask } = {}
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

export interface ICustomUploadResult {
  uri: string
  /** The uploaded file as the user sees it: always the plaintext. */
  blob: Blob
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
  getUpdatedFilePath?: (newPath: String) => void
): Promise<ICustomUploadResult> => {
  return new Promise((resolve, reject) => {
    const encrypt = getEncryptAttachments()

    // `files` is passed when the uploader prepares its file itself; `prepared`
    // then gives the file it prepared last and the URL it prepared it for.
    const start = (
      uploaded: IAttachment,
      {
        files,
        prepared
      }: {
        files?: ICustomUploaderUploadFiles
        prepared?: () => { file: IAttachmentUploadFile; url?: string } | undefined
      } = {}
    ) => {
      const uploadTask: IUploadTask = {
        updateLocalFileLocation: getUpdatedFilePath,
        progress,
        failure: (e: Error) => {
          delete pendingUploaders[attachment.tid!]
          reject(e)
        },
        success: ({ uri, blob }: { uri: string; blob: Blob }) => {
          delete pendingUploaders[attachment.tid!]
          const last = prepared?.()
          const encryption = last?.file.encryption
          if (encrypt && !encryption) {
            // The uploader stored a file it did not prepare: it may be plaintext,
            // so the message is not sent.
            reject(
              new Error(
                'The custom uploader stored a file that was not prepared with prepareFile; it may not be encrypted'
              )
            )
            return
          }
          if (encryption && uri !== last?.url) {
            // The file opens only for the URL it was prepared for.
            reject(
              new Error(
                `The custom uploader stored the file at ${uri}, not at ${last?.url}, the URL it was prepared for`
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
      if (files) {
        CustomUploader.upload(uploaded, uploadTask, messageType, files)
      } else {
        CustomUploader.upload(uploaded, uploadTask, messageType)
      }
      if (pausedBeforeStart) {
        // The uploader installs stop() when upload() is called, so nothing is sent.
        uploadTask.stop()
      }
    }

    if (!CustomUploader) {
      reject(new Error('No Custom uploader'))
    } else if (CustomUploader.supportsEncryption && (encrypt || canPrepareAttachmentFiles())) {
      if (!canPrepareAttachmentFiles()) {
        // Fails here, before anything is sent.
        reject(
          new Error(
            'Attachment encryption needs a sceyt-chat version with client.prepareUpload and client.prepareDownload'
          )
        )
        return
      }
      // The uploader picks the URL it stores the file at, then prepares the
      // file (e.g. after resizing an image) for that URL; the last file
      // prepared is the one the message describes.
      let last: { file: IAttachmentUploadFile; url?: string } | undefined
      const files: ICustomUploaderUploadFiles = {
        prepareFile: (file: Blob, options?: { url: string }) =>
          prepareUploadFile(file, encrypt, options?.url).then((uploadFile) => {
            last = { file: uploadFile, url: options?.url }
            return uploadFile
          })
      }
      start(attachment, { files, prepared: () => last })
    } else if (!encrypt) {
      start(attachment)
    } else {
      // An encrypted file is bound to the URL it is stored at, so the uploader
      // must give that URL before the file is encrypted.
      notStartedUploads.delete(attachment.tid!)
      reject(
        new Error(
          "Attachment encryption needs a custom uploader with supportsEncryption, which gives the file's URL to prepareFile"
        )
      )
    }
  })
}

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
 * The custom downloader for one attachment. For an encrypted file
 * (`encryption` from its metadata) it returns the decrypted file, in the same
 * shape the custom downloader returned ({ Body }, a Blob, or a URL string).
 * An uploader with `supportsEncryption` gets the stored file ({ file }) and
 * opens it itself. `type` is the file's real type, e.g. 'video/mp4'.
 * `download` defaults to the CustomUploader's.
 */
// A request the attachment downloader returned, to the uploader's own request
// inside it: the uploader's cancelRequest only knows its own.
const uploaderRequests = new WeakMap<Promise<any>, Promise<any>>()

export const getAttachmentDownloader = (
  encryption?: IAttachmentEncryption,
  type: string = '',
  download: ICustomUploader['download'] | undefined = getCustomDownloader()
): ICustomUploader['download'] | undefined => {
  if (!download) return download
  const opensFiles = !!CustomUploader?.supportsEncryption && canPrepareAttachmentFiles()
  if (!encryption && !opensFiles) return download
  return (url, asFile, progress, messageType, messageId) => {
    let file: ReturnType<typeof prepareDownloadFile>
    try {
      file = prepareDownloadFile(encryption, type, url)
    } catch (error) {
      return Promise.reject(error)
    }
    if (opensFiles) {
      // The uploader's own request, so its cancelRequest finds it.
      return download(url, asFile, progress, messageType, messageId, { file })
    }
    const request = download(url, asFile, progress, messageType, messageId)
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
