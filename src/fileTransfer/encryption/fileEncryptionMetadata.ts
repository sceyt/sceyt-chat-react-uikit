import { getClient } from '../../common/client'
import { FileEncryptionInfo } from './types'

const FIELD = 'enc'

const parse = (metadata: unknown): Record<string, any> | undefined => {
  try {
    const parsed = typeof metadata === 'string' ? JSON.parse(metadata) : metadata
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? { ...parsed } : undefined
  } catch {
    return undefined
  }
}

// Whether the chat SDK reads `encodedKeys` as a keys string (FileEncryption.decodeKeys).
const isKeys = (encodedKeys: string): boolean => {
  const provider = getClient()?.FileEncryption
  if (!provider?.decodeKeys) return false
  try {
    provider.decodeKeys(encodedKeys)
    return true
  } catch {
    return false
  }
}

/**
 * Attachment encryption metadata: `enc`, one base64url string the chat SDK makes and reads
 * (FileEncryption.encodeKeys and decodeKeys) of the version, attachment id and key, kept next
 * to the other metadata keys; the salt and nonce prefix are in the stored file's header. The
 * plaintext size remains the attachment's file size. Every encrypted file is an attachment
 * with its own `enc` (a video's preview image is a preview attachment of its own).
 */
export class FileEncryptionMetadata {
  readonly encodedKeys: string

  private constructor(encodedKeys: string) {
    this.encodedKeys = encodedKeys
  }

  toEncryptionInfo(): FileEncryptionInfo {
    return { encodedKeys: this.encodedKeys }
  }

  /** `enc` as it is stored. */
  toJSON() {
    return this.encodedKeys
  }

  toString() {
    return 'FileEncryptionMetadata'
  }

  /** The `enc` of an upload's encryption; throws when it has no keys string. */
  static fromEncryptionInfo(info: FileEncryptionInfo) {
    if (!info.encodedKeys) throw new Error('The encryption has no keys string (encodedKeys) to keep in metadata')
    return new FileEncryptionMetadata(info.encodedKeys)
  }

  /** Whether the attachment's metadata has encryption info (even malformed). */
  static isEncrypted(metadata: unknown): boolean {
    const json = parse(metadata)
    return !!json && FIELD in json
  }

  /** The encryption metadata, or undefined when there is none or the SDK cannot read it. */
  static read(metadata: unknown): FileEncryptionMetadata | undefined {
    const enc = parse(metadata)?.[FIELD]
    return typeof enc === 'string' && enc && isKeys(enc) ? new FileEncryptionMetadata(enc) : undefined
  }

  /** `metadata` with `envelope` as its `enc`, keeping the other keys. */
  static write(metadata: unknown, envelope: FileEncryptionMetadata): string {
    const json = parse(metadata) || {}
    json[FIELD] = envelope.encodedKeys
    return JSON.stringify(json)
  }

  /** `metadata` without `enc` (unchanged when it has none). */
  static remove(metadata: unknown): string | undefined {
    const json = parse(metadata)
    if (!json || !(FIELD in json)) return typeof metadata === 'string' ? metadata : undefined
    delete json[FIELD]
    return Object.keys(json).length ? JSON.stringify(json) : undefined
  }
}
