import { getClient } from '../common/client'

// Attachment encryption (format: sceyt-chat-js-sdk spec/attachment-encryption).
// The file bytes are encrypted before upload and decrypted after download; the
// file's attachment id and key travel in the attachment's metadata as `enc`. The
// SDK does the work (client.upload, client.prepareUpload, client.prepareDownload);
// a custom uploader gets it as `fileEncryption`, with no SDK types. This file
// holds the UIKit's side: the option, the metadata, and opening downloaded files.

/** Another file of an attachment (a video's preview image), encrypted with its own id and key. */
export interface IAttachmentRendition {
  /** "thumbnail" for a video's preview image. */
  role: string
  attachmentId: string
  key: string
}

/**
 * The `enc` object in an encrypted attachment's metadata: what opens the file.
 * The SDK makes `v`, `alg`, `attachmentId` and `key`; the UIKit adds
 * `renditions`. The file's URL, size, type and name are the attachment's own fields.
 */
export interface IAttachmentEncryption {
  v: 1
  /** The format: "tink-aes256-gcm-hkdf-64k+commit-v1". */
  alg: string
  /** The file's attachment id (16 bytes, base64url): the stored file opens only with it. */
  attachmentId: string
  /** The file key (32 bytes, base64url). */
  key: string
  /** The video preview image (`video_thumb`) is `role: "thumbnail"`. */
  renditions?: IAttachmentRendition[]
}

const THUMBNAIL = 'thumbnail'

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

/** The download file of an attachment with this `enc` (none: not encrypted). Throws if `enc` is not valid. */
export const prepareDownloadFile = (
  encryption: IAttachmentEncryption | undefined,
  type: string = ''
): IAttachmentDownloadFile => sdkClient().prepareDownload({ metadata: encryption ? { enc: encryption } : {}, type })

/** What opens one encrypted file: its `enc` without renditions, as the SDK makes it. */
export type IFileEncryptionInfo = Omit<IAttachmentEncryption, 'renditions'>

/**
 * One file encrypted for upload. Its stored bytes are encrypted as they are
 * read: a multipart upload reads each part, and no encrypted copy of the whole
 * file is made (readAll() makes one, for an upload in one request).
 */
export interface IFileEncryptionSession {
  /** Bytes of the file as the user picked it. */
  readonly plaintextSize: number
  /** Bytes to store: the file with its encryption overhead. Plan the parts from it. */
  readonly ciphertextSize: number
  /** The type to store the file with (application/octet-stream). */
  readonly contentType: string
  /** Pass it to the upload task's `success()` as `encryption`. */
  readonly encryptionInfo: IFileEncryptionInfo
  /**
   * Exactly `length` stored bytes from `offset` (0 ≤ offset, 0 ≤ length ≤
   * ciphertextSize − offset). The same range always gives the same bytes, so a
   * part whose upload failed can be sent again as it was.
   */
  // eslint-disable-next-line no-unused-vars
  read: (offset: number, length: number) => Promise<Uint8Array>
  /** All the stored bytes, for an upload in one request. */
  readAll: () => Promise<Blob>
}

/** One downloaded encrypted file. */
export interface IFileDecryptionSession {
  /** The file decrypted and verified, with its real type. Rejects when it does not open with its key and attachment id. */
  readAll: () => Promise<Blob>
}

/**
 * Attachment encryption for a custom uploader (`options.fileEncryption`), so it
 * needs no chat SDK types or calls. The UIKit does it with the chat client.
 */
export interface IFileEncryption {
  /** Encrypts `file` with a new key and attachment id. */
  // eslint-disable-next-line no-unused-vars
  prepareEncryption: (file: Blob) => Promise<IFileEncryptionSession>
  /** Opens `encryptedFile`, the stored bytes of a file with this `encryptionInfo`; `type` is its real type. */
  prepareDecryption: (
    // eslint-disable-next-line no-unused-vars
    encryptedFile: Blob,
    // eslint-disable-next-line no-unused-vars
    encryptionInfo: IFileEncryptionInfo,
    // eslint-disable-next-line no-unused-vars
    type?: string
  ) => Promise<IFileDecryptionSession>
}

const isWholeNumber = (value: number) => Number.isInteger(value)

/** The default attachment encryption: the chat client's (sceyt-chat). */
export const fileEncryption: IFileEncryption = {
  prepareEncryption: async (file) => {
    const prepared = await sdkClient().prepareUpload(file, { encrypt: true })
    if (!prepared?.encryption) {
      throw new Error('The chat client prepared the file without encrypting it')
    }
    const ciphertextSize: number = prepared.size
    return {
      plaintextSize: file.size,
      ciphertextSize,
      contentType: prepared.contentType,
      encryptionInfo: prepared.encryption,
      read: (offset, length) => {
        if (
          !isWholeNumber(offset) ||
          !isWholeNumber(length) ||
          offset < 0 ||
          length < 0 ||
          length > ciphertextSize - offset
        ) {
          return Promise.reject(
            new RangeError(`${length} bytes from ${offset} are outside this ${ciphertextSize}-byte encrypted file`)
          )
        }
        return prepared.getRange(offset, offset + length)
      },
      readAll: () => prepared.getAll()
    }
  },
  prepareDecryption: async (encryptedFile, encryptionInfo, type = '') => {
    if (!encryptionInfo || typeof encryptionInfo.key !== 'string') {
      throw new Error('Decrypting a file needs its encryption info')
    }
    const file = prepareDownloadFile(encryptionInfo, type)
    return { readAll: () => file.open(encryptedFile) }
  }
}

let configuredFileEncryption: IFileEncryption = fileEncryption

/** The encryption to use (`fileTransfer.encryption`); undefined restores the default. */
export const setFileEncryption = (encryption: IFileEncryption | undefined) => {
  configuredFileEncryption = encryption || fileEncryption
}

/** The attachment encryption in use: the app's (`fileTransfer.encryption`), or the chat client's. */
export const getFileEncryption = () => configuredFileEncryption

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
  return enc && typeof enc === 'object' && typeof enc.key === 'string' ? enc : undefined
}

/** What opens the video preview image (its rendition), or undefined when it is not encrypted. */
export const getVideoThumbEncryption = (metadata: any): IAttachmentEncryption | undefined => {
  const enc = parseMetadata(metadata).enc
  const renditions = enc && typeof enc === 'object' && Array.isArray(enc.renditions) ? enc.renditions : []
  const thumb = renditions.find((rendition: any) => rendition && rendition.role === THUMBNAIL)
  return thumb && typeof thumb.key === 'string'
    ? { v: enc.v, alg: enc.alg, attachmentId: thumb.attachmentId, key: thumb.key }
    : undefined
}

/** Metadata with the file's `enc`, keeping the renditions already in it. */
export const withAttachmentEncryption = (metadata: any, encryption: IAttachmentEncryption) => {
  const parsed = parseMetadata(metadata)
  const renditions = parsed.enc?.renditions
  return JSON.stringify({ ...parsed, enc: { ...encryption, ...(renditions ? { renditions } : {}) } })
}

/**
 * Metadata with the video preview image as a thumbnail rendition: its
 * attachment id and key. The video's own `enc` fields are added once it is uploaded.
 */
export const withVideoThumbEncryption = (metadata: any, encryption: IAttachmentEncryption) => {
  const parsed = parseMetadata(metadata)
  const { v, alg, attachmentId, key } = encryption
  const others = (Array.isArray(parsed.enc?.renditions) ? parsed.enc.renditions : []).filter(
    (rendition: any) => rendition?.role !== THUMBNAIL
  )
  const thumbnail = { role: THUMBNAIL, attachmentId, key }
  return JSON.stringify({ ...parsed, enc: { v, alg, ...parsed.enc, renditions: [...others, thumbnail] } })
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
