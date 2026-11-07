import { IAttachment } from '../types'
import { attachmentTransferRouter } from './attachmentTransferRouter'
import { FileEncryptionInfo } from './encryption/types'
import { TransferExecutor } from './transferExecutor'

/**
 * The download of one file of an attachment, called with the URL to download: it resolves
 * with `{ Body, ContentType }`, the file decrypted when it is encrypted. `progress` gets
 * `{ loaded, total }`.
 */
export type AttachmentDownloader = (
  // eslint-disable-next-line no-unused-vars
  url: string,
  // eslint-disable-next-line no-unused-vars
  asFile: boolean,
  // eslint-disable-next-line no-unused-vars
  progress: (progress: { loaded: number; total: number }) => void,
  // eslint-disable-next-line no-unused-vars
  messageType?: string | null
) => Promise<{ Body: Blob; ContentType: string }>

// A request a downloader returned, to the attempt that cancels it.
const requests = new WeakMap<Promise<any>, TransferExecutor<Blob>>()

/**
 * Downloads files of `attachment` through `fileTransfer.provider`. An encrypted file
 * (`encryptionInfo`) is decrypted with its trusted size, `plaintextSize` (the attachment's).
 * `type` is the file's real type.
 */
export const getAttachmentDownloader =
  (
    attachment: IAttachment,
    encryptionInfo?: FileEncryptionInfo,
    type: string = '',
    plaintextSize: number | string | undefined = attachment.size
  ): AttachmentDownloader =>
  (url, _asFile, progress) => {
    const executor = attachmentTransferRouter.download(attachment, {
      url,
      mimeType: type,
      encryptionInfo,
      plaintextSize
    })
    // Percent to bytes of the file; a file of unknown size is counted out of 100.
    const total = Number(plaintextSize) || 100
    const request = executor
      .execute({ onProgress: (percent) => progress({ loaded: (total * percent) / 100, total }) })
      .then((result) => {
        if (result.type !== 'success') throw result.error
        return { Body: result.result, ContentType: result.result.type }
      })
    requests.set(request, executor)
    return request
  }

/** Cancels a request returned by a downloader from getAttachmentDownloader. */
export const cancelDownloadRequest = (request: Promise<any>) => {
  requests.get(request)?.discard()
}
