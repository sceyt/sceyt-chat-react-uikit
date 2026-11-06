import { FileEncryptionInfo } from './types'

const FIELD = 'enc'

// `value` as encryption params: an object of strings, else undefined (malformed params are dropped).
const paramsOf = (value: unknown): Record<string, string> | undefined =>
  value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.values(value).every((param) => typeof param === 'string')
    ? { ...(value as Record<string, string>) }
    : undefined

const withParams = (params: Record<string, string> | undefined) => (params ? { params } : {})

const stringOf = (value: unknown) => (typeof value === 'string' && value ? value : undefined)

const parse = (metadata: unknown): Record<string, any> | undefined => {
  try {
    const parsed = typeof metadata === 'string' ? JSON.parse(metadata) : metadata
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? { ...parsed } : undefined
  } catch {
    return undefined
  }
}

/**
 * Attachment encryption metadata: the `enc` object `{ v, alg, aid, k, salt, np, params }` kept next
 * to the other metadata keys (`aid`: the attachment id, `k`: the key, `np`: the nonce prefix). The
 * plaintext size remains the attachment's file size. Every encrypted file is an attachment with its
 * own `enc` (a video's preview image is a preview attachment of its own).
 */
export class FileEncryptionMetadata {
  readonly version: number
  readonly algorithm: string
  readonly attachmentId: string
  readonly key: string
  readonly params?: Record<string, string>
  readonly salt?: string
  readonly noncePrefix?: string

  constructor(
    algorithm: string,
    attachmentId: string,
    key: string,
    version = 1,
    params?: Record<string, string>,
    salt?: string,
    noncePrefix?: string
  ) {
    this.version = version
    this.algorithm = algorithm
    this.attachmentId = attachmentId
    this.key = key
    this.params = params
    this.salt = salt
    this.noncePrefix = noncePrefix
  }

  toEncryptionInfo(): FileEncryptionInfo {
    return {
      algorithm: this.algorithm,
      attachmentId: this.attachmentId,
      key: this.key,
      ...withParams(this.params),
      ...(this.salt ? { salt: this.salt } : {}),
      ...(this.noncePrefix ? { noncePrefix: this.noncePrefix } : {})
    }
  }

  /** The `enc` object as it is stored. */
  toJSON() {
    return {
      v: this.version,
      alg: this.algorithm,
      aid: this.attachmentId,
      k: this.key,
      ...(this.salt ? { salt: this.salt } : {}),
      ...(this.noncePrefix ? { np: this.noncePrefix } : {}),
      ...withParams(this.params)
    }
  }

  toString() {
    return `FileEncryptionMetadata(version=${this.version}, algorithm=${this.algorithm}, attachmentId=${this.attachmentId})`
  }

  static fromEncryptionInfo(info: FileEncryptionInfo) {
    return new FileEncryptionMetadata(
      info.algorithm,
      info.attachmentId,
      info.key,
      1,
      paramsOf(info.params),
      stringOf(info.salt),
      stringOf(info.noncePrefix)
    )
  }

  /** Whether the attachment's metadata has encryption info (even malformed). */
  static isEncrypted(metadata: unknown): boolean {
    const json = parse(metadata)
    return !!json && FIELD in json
  }

  /** The encryption metadata, or undefined when there is none or it is malformed. */
  static read(metadata: unknown): FileEncryptionMetadata | undefined {
    const enc = parse(metadata)?.[FIELD]
    if (
      !enc ||
      typeof enc !== 'object' ||
      typeof enc.alg !== 'string' ||
      typeof enc.aid !== 'string' ||
      typeof enc.k !== 'string'
    ) {
      return undefined
    }
    return new FileEncryptionMetadata(
      enc.alg,
      enc.aid,
      enc.k,
      typeof enc.v === 'number' ? enc.v : 1,
      paramsOf(enc.params),
      stringOf(enc.salt),
      stringOf(enc.np)
    )
  }

  /** `metadata` with `envelope` as its `enc`, keeping the other keys. */
  static write(metadata: unknown, envelope: FileEncryptionMetadata): string {
    const json = parse(metadata) || {}
    json[FIELD] = envelope.toJSON()
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
