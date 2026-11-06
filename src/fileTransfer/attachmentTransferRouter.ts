import { IAttachment } from '../types'
import { FileEncryptionMetadata } from './encryption/fileEncryptionMetadata'
import { FileEncryptionInfo } from './encryption/types'
import { fileTransfer } from './sceytChatUIKitFileTransfer'
import { TransferExecutor } from './transferExecutor'
import {
  AttachmentTransferContext,
  FileDownloadRequest,
  FileTransferResult,
  FileUploadRequest,
  FileUploadResult,
  FileUploadType
} from './types'

/** Operation ids the UIKit gives transports: stable per upload, and per download of a file. */
export const uploadOperationId = (attachmentTid: string) => `upload:${attachmentTid}`
export const downloadOperationId = (attachmentKey: string) => `download:${attachmentKey}`

export interface IUploadSource {
  /** The prepared file (after any resizing or transcoding). */
  file: Blob
  fileName: string
  mimeType?: string | null
  isSharedUpload?: boolean
}

// An attachment's size as the SDK gives it (a string: the server's 64-bit field, '0'
// when unknown) as a byte count, or undefined when it is not a positive whole number.
const trustedSizeOf = (size: unknown): number | undefined => {
  const bytes = typeof size === 'string' && size.trim() ? Number(size) : size
  return typeof bytes === 'number' && Number.isSafeInteger(bytes) && bytes > 0 ? bytes : undefined
}

export interface IDownloadSource {
  /** The URL to download: the attachment's, or a video's preview. */
  url: string
  /** The file's type, given to the downloaded file. */
  mimeType?: string
  /**
   * For an encrypted file: what opens it, and its trusted size: the attachment's `size`
   * (a number or the SDK's string; undefined for a preview, sized from its encrypted bytes).
   */
  encryptionInfo?: FileEncryptionInfo
  plaintextSize?: number | string
}

/**
 * Selects the transport once per attempt and builds its request; the executor's controls
 * keep targeting that transport. Transports encrypt and decrypt with `fileTransfer.encryption`.
 */
export const attachmentTransferRouter = {
  upload(attachment: IAttachment, source: IUploadSource): TransferExecutor<FileUploadResult> {
    const operationId = uploadOperationId(attachment.tid!)
    const transport = fileTransfer.transport
    const encrypted = fileTransfer.encryptUploads
    return new TransferExecutor<FileUploadResult>(operationId, transport, async (execution, callback) => {
      const context: AttachmentTransferContext = { attachment, isSharedUpload: !!source.isSharedUpload }
      const request: FileUploadRequest = {
        operationId,
        sourceFile: source.file,
        fileName: source.fileName,
        mimeType: source.mimeType || null,
        context,
        type: encrypted ? FileUploadType.ENCRYPTED : FileUploadType.PLAIN,
        signal: execution.signal
      }
      const result = await execution.executeTransport(() => transport.upload(request, callback))
      if (result.type === 'success') {
        if (!result.result.url) return FileTransferResult.failure(new Error('The upload returned no URL'))
        // A transport with a preparer encrypts with the parameters it saved in ext.
        if (encrypted && !result.result.encryptionInfo && !transport.uploadPreparer) {
          // The receiver would have no way to decrypt the file.
          return FileTransferResult.failure(new Error('Encrypted upload returned no encryption information'))
        }
      }
      return result
    })
  },

  /**
   * `transferKey` names the download: one operation per key, so two files of an attachment
   * (a video and its preview) are separate operations. Default: the attachment.
   */
  download(
    attachment: IAttachment,
    source: IDownloadSource,
    transferKey: string = attachment.tid || attachment.id || source.url
  ): TransferExecutor<Blob> {
    const operationId = downloadOperationId(transferKey)
    const transport = fileTransfer.transport
    return new TransferExecutor<Blob>(operationId, transport, (execution, callback) => {
      const request: FileDownloadRequest = {
        operationId,
        url: source.url,
        context: { attachment, isSharedUpload: false } as AttachmentTransferContext,
        mimeType: source.mimeType,
        ...(source.encryptionInfo
          ? { encryptionInfo: source.encryptionInfo, plaintextSize: trustedSizeOf(source.plaintextSize) }
          : {}),
        signal: execution.signal
      }
      return execution.executeTransport(() => transport.download(request, callback))
    })
  },

  /** `metadata` with the upload's encryption as its `enc`, or without `enc`. */
  applyUploadResult(metadata: unknown, result: FileUploadResult): string | undefined {
    if (!result.encryptionInfo) return FileEncryptionMetadata.remove(metadata)
    return FileEncryptionMetadata.write(metadata, FileEncryptionMetadata.fromEncryptionInfo(result.encryptionInfo))
  }
}
