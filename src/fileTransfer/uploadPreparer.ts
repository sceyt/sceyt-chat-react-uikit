import { IAttachment } from '../types'
import { getPendingAttachment, setPendingAttachment } from '../helpers/messagesHalper'
import { parseAttachmentMetadata } from '../helpers/videoPreview'
import { uploadOperationId } from './attachmentTransferRouter'
import { fileTransfer } from './sceytChatUIKitFileTransfer'
import { FileTransferEntries, FileUploadRequest, FileUploadType } from './types'

// The provider's step before each upload attempt (the same contract as the native UIKits):
// the UIKit calls provider.prepareUpload(request), where request.metadata is the attachment's
// metadata with what an earlier attempt returned; the entries it returns are merged into the
// metadata (returned keys added or overwritten, the rest kept) and saved before the upload.
// Only the UIKit writes metadata.

const isEntries = (value: unknown): value is FileTransferEntries =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.values(value as object).every((entry) => typeof entry === 'string')

/**
 * The attachment's metadata to upload with, after the provider's prepareUpload: on every attempt
 * (a retry or a resend too, not a pause or resume) it gets the metadata with what an earlier attempt
 * returned, and what it returns is merged in. Without prepareUpload the metadata is as it was.
 * Rejects when the provider's step fails, so the message is never sent unprepared.
 */
export const prepareAttachmentUpload = async (attachment: IAttachment, file: Blob): Promise<unknown> => {
  const provider = fileTransfer.provider
  if (!provider.prepareUpload) return attachment.metadata
  const tid = attachment.tid
  // What an earlier attempt returned, kept in case the attachment's metadata lost it (a resend).
  const saved = tid ? getPendingAttachment(tid)?.preparedEntries : undefined
  const metadata = { ...parseAttachmentMetadata(attachment.metadata), ...saved }
  const request: FileUploadRequest = {
    operationId: uploadOperationId(tid || ''),
    sourceFile: file,
    fileName: (file as File).name || attachment.name || 'file',
    mimeType: file.type || null,
    context: { attachment, isSharedUpload: false },
    type: fileTransfer.encryptUploads ? FileUploadType.ENCRYPTED : FileUploadType.PLAIN,
    metadata,
    signal: new AbortController().signal
  }
  const entries = await provider.prepareUpload(request)
  if (entries === null || entries === undefined) {
    return saved ? JSON.stringify(metadata) : attachment.metadata
  }
  if (!isEntries(entries)) {
    throw new Error('prepareUpload returned entries that are not string keys with string values')
  }
  if (tid) setPendingAttachment(tid, { preparedEntries: { ...saved, ...entries } })
  return JSON.stringify({ ...metadata, ...entries })
}
