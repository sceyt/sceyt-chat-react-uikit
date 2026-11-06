import { FileEncryptionMetadata } from '../fileTransfer/encryption/fileEncryptionMetadata'
import { FileEncryptionInfo } from '../fileTransfer/encryption/types'

// Attachment encryption metadata (format: sceyt-chat-js-sdk spec/attachment-encryption).
// An encrypted file's attachment id and key travel in the attachment's metadata as `enc`;
// transports encrypt and decrypt with `fileTransfer.encryption`. This file holds the
// UIKit's side: reading and writing `enc`, and the real type of a decrypted file.

/** What opens the attachment's file, or undefined when it is not encrypted. */
export const getAttachmentEncryption = (metadata: any): FileEncryptionInfo | undefined =>
  FileEncryptionMetadata.read(metadata)?.toEncryptionInfo()

/** Metadata with the file's `enc`. */
export const withAttachmentEncryption = (metadata: any, encryption: FileEncryptionInfo): string =>
  FileEncryptionMetadata.write(metadata, FileEncryptionMetadata.fromEncryptionInfo(encryption))

/**
 * Whether an error says the file cannot be opened: it failed decryption, or its `enc`
 * metadata is not valid (sceyt-chat FileEncryptionErrorCode). Downloading it again gives
 * the same result.
 */
export const isUnopenableAttachmentError = (error: any) =>
  error?.type === 'Authentication' || error?.type === 'InvalidEncryption'

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
