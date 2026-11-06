import { IAttachment } from '../types'
import { getPendingAttachment, setPendingAttachment } from '../helpers/messagesHalper'
import { parseAttachmentMetadata } from '../helpers/videoPreview'
import { fileTransfer } from './sceytChatUIKitFileTransfer'

// The app's step before each upload attempt (the same contract as the native UIKits):
// the UIKit calls prepare(attachment, existing); the app returns its entry for the
// attachment, which the UIKit saves to metadata.ext[namespace] before the upload. Only
// the UIKit writes metadata, and it keeps `ext` whenever it rewrites it.

/** The metadata key the apps' entries are kept under, each in its own namespace. */
export const EXT = 'ext'

/** What an app's entry is: a string (e.g. the chat SDK's keys string) or a JSON object. */
export type UploadExtEntry = string | Record<string, unknown>

/** What `prepare` gets. */
export interface UploadPreparation {
  attachment: IAttachment
  /** The file to upload (an image already resized, a video already converted). */
  file: Blob
  /**
   * The entry an earlier attempt saved for this attachment, else undefined: return it to go
   * on with it (e.g. without asking a server or creating an encryptor again).
   */
  existing?: UploadExtEntry
}

/** The app's step before each upload attempt of an attachment's file. */
export interface UploadPreparer {
  /** Where the entry is saved: metadata.ext[namespace], e.g. "app.enc". */
  namespace: string
  /** The attachment's entry; undefined keeps the existing one (or none). A failure fails the message. */
  // eslint-disable-next-line no-unused-vars
  prepare(preparation: UploadPreparation): UploadExtEntry | undefined | Promise<UploadExtEntry | undefined>
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const isEntry = (value: unknown): value is UploadExtEntry => (typeof value === 'string' && !!value) || isObject(value)

/** The app's entry under `namespace` in `metadata`, if there is one. */
export const getUploadExt = (metadata: unknown, namespace: string): UploadExtEntry | undefined => {
  const ext = parseAttachmentMetadata(metadata)[EXT]
  const entry = isObject(ext) ? ext[namespace] : undefined
  return isEntry(entry) ? entry : undefined
}

/** `metadata` (as JSON) with `entry` under ext[namespace], keeping everything else. */
export const withUploadExt = (metadata: unknown, namespace: string, entry: UploadExtEntry): string => {
  const parsed = parseAttachmentMetadata(metadata)
  const ext = isObject(parsed[EXT]) ? parsed[EXT] : {}
  return JSON.stringify({ ...parsed, [EXT]: { ...ext, [namespace]: entry } })
}

/**
 * The attachment's metadata to upload with, after the transport's `uploadPreparer`:
 * on every attempt (a retry or a resend too) it is given the entry saved before, if any, and
 * its entry is saved to metadata.ext[namespace]. Without a preparer the metadata is as it
 * was. Rejects when the app's step fails, so the message is never sent unprepared.
 */
export const prepareAttachmentUpload = async (attachment: IAttachment, file: Blob): Promise<unknown> => {
  const preparer = fileTransfer.transport.uploadPreparer
  if (!preparer) return attachment.metadata
  const { namespace } = preparer
  const tid = attachment.tid
  // The attachment's file does not change once it is added, so a saved entry is its own.
  const existing =
    getUploadExt(attachment.metadata, namespace) || (tid ? getPendingAttachment(tid)?.uploadExt : undefined)
  const prepared = await preparer.prepare({ attachment, file, ...(existing ? { existing } : {}) })
  if (prepared !== undefined && !isEntry(prepared)) {
    throw new Error('uploadPreparer.prepare returned an entry that is not a string or an object')
  }
  const entry = prepared || existing
  if (!entry) return attachment.metadata
  // Saved as JSON: an entry that cannot be stored fails here, before anything is uploaded.
  const saved = JSON.parse(JSON.stringify(entry)) as UploadExtEntry
  if (tid) setPendingAttachment(tid, { uploadExt: saved })
  return withUploadExt(attachment.metadata, namespace, saved)
}
