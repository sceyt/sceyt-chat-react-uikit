import { IAttachment } from '../types'
import { FileEncryptionInfo } from './encryption/types'
import type { UploadPreparer } from './uploadPreparer'

// File transfer: the same structure as the Android UIKit (com.sceyt.chatuikit.filetransfer).
// The UIKit owns attachment scheduling, preparation and persistence; a transport moves the
// bytes, and encrypts and decrypts them with the encryption module it is given
// (`fileTransfer.encryption`).

/**
 * Optional caller information passed unchanged to the transport. File-transfer
 * coordination does not inspect it or use it to identify an operation.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface FileTransferContext {}

/**
 * Attachment information supplied by the UIKit for customer transport integrations.
 * The attachment is a snapshot; the transfer uses the request's file and operation id.
 */
export interface AttachmentTransferContext extends FileTransferContext {
  attachment: IAttachment
  isSharedUpload: boolean
}

export enum FileUploadType {
  PLAIN = 'PLAIN',
  ENCRYPTED = 'ENCRYPTED'
}

/** The source is plaintext in both modes; the transport owns encryption when requested. */
export interface FileUploadRequest {
  operationId: string
  sourceFile: Blob
  fileName: string
  mimeType: string | null
  context?: FileTransferContext
  type: FileUploadType
  /** Aborted when the UIKit stops the attempt: the transport stops its work and settles. */
  signal: AbortSignal
}

/** The uploaded reference, and the encryption information of the same uploaded bytes. */
export interface FileUploadResult {
  url: string
  encryptionInfo?: FileEncryptionInfo
}

/**
 * Downloads `url`. For an encrypted file, `encryptionInfo` and `plaintextSize` (the
 * attachment's trusted size; undefined for a video's preview, whose message has none) are
 * given: the transport decrypts the downloaded bytes with the encryption module and returns
 * the verified plaintext.
 */
export interface FileDownloadRequest {
  operationId: string
  url: string
  context?: FileTransferContext
  headers?: Record<string, string>
  encryptionInfo?: FileEncryptionInfo
  plaintextSize?: number
  /** The file's type, given to the returned file. */
  mimeType?: string
  /** Aborted when the UIKit stops the attempt: the transport stops its work and settles. */
  signal: AbortSignal
}

/** The outcome of one transport attempt. */
export type FileTransferResult<T> =
  | { type: 'success'; result: T }
  /** A terminal failure. */
  | { type: 'failure'; error: Error }
  /**
   * The attempt ended before completion, e.g. because connectivity was lost. The transport
   * stopped reading and writing, but keeps any resumable backend state.
   */
  | { type: 'interrupted'; error: Error }

export const FileTransferResult = {
  success: <T>(result: T): FileTransferResult<T> => ({ type: 'success', result }),
  failure: <T = never>(error: Error): FileTransferResult<T> => ({ type: 'failure', error }),
  interrupted: <T = never>(error: Error): FileTransferResult<T> => ({ type: 'interrupted', error })
}

/** Reports transfer progress as a percentage from 0 to 100. */
export interface FileTransferCallback {
  // eslint-disable-next-line no-unused-vars
  onProgress: (progressPercent: number) => void
}

/**
 * Transfers prepared files. Expected failures are returned as `failure`, recoverable
 * interruptions as `interrupted`. An aborted request's signal is not a failure: the
 * transport stops and the UIKit ignores its result.
 */
export interface FileTransferTransport {
  /**
   * The transport's step before each upload attempt: prepare(attachment, file, existing) returns
   * its entry for the attachment, saved to metadata.ext[namespace] before the upload; the next
   * attempt gets it back as `existing`. With it the transport owns the encryption: the UIKit
   * writes no `enc`. A failure fails the message.
   */
  uploadPreparer?: UploadPreparer
  /** Uploads the prepared source and returns its remote reference. */
  // eslint-disable-next-line no-unused-vars
  upload: (request: FileUploadRequest, callback: FileTransferCallback) => Promise<FileTransferResult<FileUploadResult>>
  /** Downloads the file (decrypted when the request has encryption info). */
  // eslint-disable-next-line no-unused-vars
  download: (request: FileDownloadRequest, callback: FileTransferCallback) => Promise<FileTransferResult<Blob>>
  /**
   * Pauses the existing operation: `true` when it remains available for `resume`, `false`
   * when the UIKit must stop it and restart it later.
   */
  // eslint-disable-next-line no-unused-vars
  pause?: (operationId: string) => boolean
  /** Resumes the paused operation: `true` when the same operation continues, `false` to restart it. */
  // eslint-disable-next-line no-unused-vars
  resume?: (operationId: string) => boolean
  /**
   * The caller explicitly abandoned the operation (its signal is also aborted). Clean up
   * retained backend state without blocking. Must be idempotent. Pause and recoverable
   * interruptions do not call it.
   */
  // eslint-disable-next-line no-unused-vars
  cancel: (operationId: string) => void
}
