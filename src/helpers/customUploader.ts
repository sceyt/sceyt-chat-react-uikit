import { ICustomUploader, IProgress, IUploadTask } from '../components/ChatContainer'

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
  file: File,
  uploadId: any,
  progress: ({ loaded, total }: IProgress) => void,
  getUpdatedFilePath?: (newPath: String) => void
): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (CustomUploader) {
      const uploadTask: IUploadTask = {
        updateLocalFileLocation: getUpdatedFilePath,
        progress: progress,
        failure: (e: Error) => reject(e),
        success: (uri: string) => resolve(uri),
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
        console.log('upload  success ... ', success)
        if (success) {
          console.log('resolve for attachment ... ', { attachment, uri, filePath })
          uploadTask.success(uri)
        } else if (error) {
        }
      } */
      pendingUploaders[uploadId] = uploadTask
      CustomUploader.upload(file, uploadTask)
    } else {
      reject(new Error('No Custom uploader'))
    }
  })
}

export const pauseUpload = (attachmentId: string) => {
  if (pendingUploaders[attachmentId]) {
    return pendingUploaders[attachmentId].stop()
  } else {
    console.log('Unknown uploading task')
    return false
  }
}

export const resumeUpload = (attachmentId: string) => {
  if (pendingUploaders[attachmentId]) {
    return pendingUploaders[attachmentId].resume()
  } else {
    console.log('Unknown uploading task')
    return false
  }
}

export const cancelUpload = (attachmentId: string) => {
  return pendingUploaders[attachmentId].cancel()
}
