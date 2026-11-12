import { FileEncryptionInfo } from './types'

const FIELD = 'sceyt.enc'

const parse = (metadata: unknown): Record<string, any> | undefined => {
  try {
    const parsed = typeof metadata === 'string' ? JSON.parse(metadata) : metadata
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? { ...parsed } : undefined
  } catch {
    return undefined
  }
}

/**
 * Attachment encryption metadata: "sceyt.enc", one base64url string the chat SDK makes and reads
 * (AttachmentCipher.attachmentKey and restore) of JSON {v, k, aid}, kept next
 * to the other metadata keys. Salt and nonce prefix are in the stored file's header.
 * The attachment's file size remains outside the key token.
 * Every encrypted file is an attachment
 * with its own "sceyt.enc" (a video's preview image is a preview attachment of its own).
 */
export class FileEncryptionMetadata {
  readonly encodedKeys: string

  private constructor(encodedKeys: string) {
    this.encodedKeys = encodedKeys
  }

  toEncryptionInfo(): FileEncryptionInfo {
    return { encodedKeys: this.encodedKeys }
  }

  /** "sceyt.enc" as it is stored. */
  toJSON() {
    return this.encodedKeys
  }

  toString() {
    return 'FileEncryptionMetadata'
  }

  /** The "sceyt.enc" of an upload's encryption; throws when it has no keys string. */
  static fromEncryptionInfo(info: FileEncryptionInfo) {
    if (!info.encodedKeys) throw new Error('The encryption has no keys string (encodedKeys) to keep in metadata')
    return new FileEncryptionMetadata(info.encodedKeys)
  }

  /** Whether the attachment's metadata has encryption info (even malformed). */
  static isEncrypted(metadata: unknown): boolean {
    const json = parse(metadata)
    return !!json && FIELD in json
  }

  /** The encryption metadata, or undefined when there is none or its value is not a nonempty string. */
  static read(metadata: unknown): FileEncryptionMetadata | undefined {
    const enc = parse(metadata)?.[FIELD]
    return typeof enc === 'string' && enc ? new FileEncryptionMetadata(enc) : undefined
  }

  /** `metadata` with `envelope` as its "sceyt.enc", keeping the other keys. */
  static write(metadata: unknown, envelope: FileEncryptionMetadata): string {
    const json = parse(metadata) || {}
    json[FIELD] = envelope.encodedKeys
    return JSON.stringify(json)
  }

  /** `metadata` without "sceyt.enc" (unchanged when it has none), as a string. */
  static remove(metadata: unknown): string | undefined {
    const json = parse(metadata)
    // Without "sceyt.enc", a string stays as it is and an object keeps every key.
    if (!json || !(FIELD in json))
      return typeof metadata === 'string' ? metadata : json ? JSON.stringify(json) : undefined
    delete json[FIELD]
    return Object.keys(json).length ? JSON.stringify(json) : undefined
  }
}
