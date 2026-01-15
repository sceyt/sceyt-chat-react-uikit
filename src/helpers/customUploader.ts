import { ICustomUploader, IProgress, IUploadTask } from '../components/ChatContainer'
import { IAttachment } from '../types'
import log from 'loglevel'

let CustomUploader: ICustomUploader
let sendAttachmentsAsSeparateMessages: boolean = false

const pendingUploaders: { [key: string]: IUploadTask } = {}

export const setCustomUploader = (uploader: any) => {
  CustomUploader = uploader
}

export const setSendAttachmentsAsSeparateMessages = (asSeparate: boolean) => {
  sendAttachmentsAsSeparateMessages = asSeparate
}

export const getSendAttachmentsAsSeparateMessages = () => sendAttachmentsAsSeparateMessages

export const getCustomUploader = () => CustomUploader

export const getCustomDownloader = () => CustomUploader && CustomUploader.download

export const customUpload = (
  attachment: IAttachment,
  // eslint-disable-next-line no-unused-vars
  progress: ({ loaded, total }: IProgress) => void,
  // eslint-disable-next-line no-unused-vars
  messageType: string | null | undefined,
  // eslint-disable-next-line no-unused-vars
  getUpdatedFilePath?: (newPath: String) => void
): Promise<{ uri: string; blob: Blob }> => {
  return new Promise((resolve, reject) => {
    if (CustomUploader) {
      const uploadTask: IUploadTask = {
        updateLocalFileLocation: getUpdatedFilePath,
        progress,
        failure: (e: Error) => reject(e),
        success: ({ uri, blob }: { uri: string; blob: Blob }) => resolve({ uri, blob }),
        cancel: () => {},
        stop: () => {},
        resume: () => {}
      }
      /* const customCompletion = (
        attachment: IAttachment,
        success: boolean,
        uri: string,
        filePath: string,
        error?: Error
      ) => {
        log.info('upload  success ... ', success)
        if (success) {
          log.info('resolve for attachment ... ', { attachment, uri, filePath })
          uploadTask.success(uri)
        } else if (error) {
        }
      } */
      pendingUploaders[attachment.tid!] = uploadTask
      CustomUploader.upload(attachment, uploadTask, messageType)
    } else {
      reject(new Error('No Custom uploader'))
    }
  })
}

export const pauseUpload = (attachmentId: string) => {
  if (pendingUploaders[attachmentId]) {
    return pendingUploaders[attachmentId].stop()
  } else {
    log.info('Unknown uploading task')
    return false
  }
}

export const resumeUpload = (attachmentId: string) => {
  if (pendingUploaders[attachmentId]) {
    return pendingUploaders[attachmentId].resume()
  } else {
    log.info('Unknown uploading task')
    return false
  }
}

export const cancelUpload = (attachmentId: string) => {
  if (pendingUploaders[attachmentId]) {
    return pendingUploaders[attachmentId].cancel()
  }
}
