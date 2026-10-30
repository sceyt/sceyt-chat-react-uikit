import { getClient } from '../common/client'

// Attachment encryption (format: sceyt-chat-js-sdk spec/attachment-encryption).
// The file bytes are encrypted before upload and decrypted after download; the
// file's unique id and key travel in the attachment's metadata as `enc`. The
// SDK does the work (client.prepareUpload / client.prepareDownload); this file
// holds the UIKit's side: the option, the metadata, and the types custom
// uploaders see.

/** The `enc` object in an encrypted attachment's metadata. */
export interface IAttachmentEncryption {
  /** The file's unique id: the stored file opens only with it. */
  id: string
  v: 1
  k: string
  /** Unique id and key of the video preview image (`video_thumb`), which is encrypted as its own file. */
  thumb?: { id: string; k: string }
}

/**
 * The SDK's AttachmentUploadFile (sceyt-chat): a file prepared for upload. Send
 * `getAll()` in one request, or the parts of a multipart upload (in any order,
 * several at once), stored as `contentType`. Part n is the stored bytes
 * `(n − 1) × partSize` up to `n × partSize`; `getRange` gives any other cut.
 * The bytes come encrypted when the file is, so the uploader's code is the same
 * either way.
 */
export interface IAttachmentUploadFile {
  /** The file it was prepared from. */
  readonly source: Blob
  /** Bytes that will be stored (the encrypted size when encrypted). */
  readonly size: number
  /** Type to store the file with (application/octet-stream when encrypted). */
  readonly contentType: string
  /** Stored bytes per part (5 MiB); the last part is smaller. */
  readonly partSize: number
  readonly partCount: number
  /** The file's `enc` metadata, when it is encrypted. */
  readonly encryption?: IAttachmentEncryption
  // eslint-disable-next-line no-unused-vars
  getPart: (partNumber: number) => Promise<Uint8Array>
  /** The stored bytes from `start` up to (not including) `end`, e.g. a part as the upload server cuts it. */
  // eslint-disable-next-line no-unused-vars
  getRange: (start: number, end: number) => Promise<Uint8Array>
  getAll: () => Promise<Blob>
}

/**
 * The SDK's AttachmentDownloadFile (sceyt-chat): an attachment's stored file.
 * `open(storedBytes)` gives the file to show or save, decrypted when it is
 * encrypted and with its real type.
 */
export interface IAttachmentDownloadFile {
  /** The file's real type, or '' when unknown. */
  readonly type: string
  readonly isEncrypted: boolean
  // eslint-disable-next-line no-unused-vars
  open: (stored: Blob) => Promise<Blob>
  /** After `received` bytes of an interrupted download: bytes to keep and where to continue. */
  // eslint-disable-next-line no-unused-vars
  resumeFrom: (received: number) => { keep: number; rangeStart: number }
  /** Stored bytes from `rangeStart` (see resumeFrom) to the end, to file bytes. */
  // eslint-disable-next-line no-unused-vars
  openStream: (rangeStart?: number) => TransformStream<Uint8Array, Uint8Array>
  /** Stored bytes to request for file bytes `start` to `end` (inclusive) of a `size`-byte file. */
  // eslint-disable-next-line no-unused-vars
  rangeFor: (start: number, end: number, size: number) => { start: number; end: number }
  /** File bytes `start` to `end` from the stored bytes requested with rangeFor. */
  // eslint-disable-next-line no-unused-vars
  openRange: (stored: Uint8Array, start: number, end: number, size: number) => Promise<Uint8Array>
}

let encryptAttachments = false

export const setEncryptAttachments = (encrypt: boolean) => {
  encryptAttachments = encrypt
}

export const getEncryptAttachments = () => encryptAttachments

const sdkClient = () => {
  const client = getClient()
  if (typeof client?.prepareUpload !== 'function' || typeof client?.prepareDownload !== 'function') {
    throw new Error(
      'Attachment encryption needs a sceyt-chat version with client.prepareUpload and client.prepareDownload'
    )
  }
  return client
}

/** Whether the chat client can prepare upload and download files (a sceyt-chat with prepareUpload). */
export const canPrepareAttachmentFiles = () => {
  const client = getClient()
  return typeof client?.prepareUpload === 'function' && typeof client?.prepareDownload === 'function'
}

/** Prepares a file for upload; encrypted, with a new unique id and key, when `encrypt` is set. */
export const prepareUploadFile = async (file: Blob, encrypt: boolean): Promise<IAttachmentUploadFile> =>
  sdkClient().prepareUpload(file, { encrypt })

/** The download file of an attachment with this `enc` (none: not encrypted). Throws if `enc` is not valid. */
export const prepareDownloadFile = (
  encryption: IAttachmentEncryption | undefined,
  type: string = ''
): IAttachmentDownloadFile => sdkClient().prepareDownload({ metadata: encryption ? { enc: encryption } : {}, type })

/**
 * Whether an error says the file cannot be opened: it failed decryption, or its
 * `enc` metadata is not valid. Downloading it again gives the same result.
 */
export const isUnopenableAttachmentError = (error: any) =>
  error?.type === 'AttachmentDecryptionFailed' || error?.type === 'InvalidAttachmentEncryption'

const parseMetadata = (metadata: any): Record<string, any> => {
  try {
    const parsed = typeof metadata === 'string' ? JSON.parse(metadata) : metadata
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

/** The file's `enc` object, or undefined when the file is not encrypted. */
export const getAttachmentEncryption = (metadata: any): IAttachmentEncryption | undefined => {
  const enc = parseMetadata(metadata).enc
  return enc && typeof enc === 'object' && typeof enc.k === 'string' ? enc : undefined
}

/** The `enc` object of the video preview image, or undefined when it is not encrypted. */
export const getVideoThumbEncryption = (metadata: any): IAttachmentEncryption | undefined => {
  const enc = parseMetadata(metadata).enc
  const thumb = enc && typeof enc === 'object' ? enc.thumb : undefined
  return thumb && typeof thumb.k === 'string' ? { id: thumb.id, v: enc.v, k: thumb.k } : undefined
}

/** Metadata with the file's `enc`, keeping the preview image's key already in it. */
export const withAttachmentEncryption = (metadata: any, encryption: IAttachmentEncryption) => {
  const parsed = parseMetadata(metadata)
  const thumb = parsed.enc?.thumb
  return JSON.stringify({ ...parsed, enc: { ...encryption, ...(thumb ? { thumb } : {}) } })
}

/** Metadata with the video preview image's unique id and key. The video's own are added once it is uploaded. */
export const withVideoThumbEncryption = (metadata: any, encryption: IAttachmentEncryption) => {
  const parsed = parseMetadata(metadata)
  const { id, v, k } = encryption
  return JSON.stringify({ ...parsed, enc: { v, ...parsed.enc, thumb: { id, k } } })
}

// Encrypted objects are stored as application/octet-stream, so the type of the
// decrypted file comes from its name.
const typesByExtension: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  '3gp': 'video/3gpp',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  wav: 'audio/wav',
  pdf: 'application/pdf'
}

export const getTypeFromFileName = (name?: string) => {
  const extension = name?.split('.').pop()?.toLowerCase()
  return (extension && name!.includes('.') && typesByExtension[extension]) || ''
}

/**
 * What the media download coordinator needs to decrypt an attachment:
 * spread it into a download request.
 */
export const attachmentDecryption = (attachment?: { metadata?: any; name?: string } | null) => ({
  encryption: getAttachmentEncryption(attachment?.metadata),
  contentType: getTypeFromFileName(attachment?.name)
})

/** The same for a video's preview image. */
export const videoThumbDecryption = (metadata: any) => ({
  encryption: getVideoThumbEncryption(metadata),
  contentType: 'image/jpeg'
})
