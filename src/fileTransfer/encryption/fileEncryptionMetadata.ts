import { FileEncryptionInfo } from './types'

const FIELD = 'enc'

/** Another file of an attachment (a video's preview image), encrypted with its own id and key. */
export interface FileEncryptionRendition {
  role: string
  attachmentId: string
  key: string
}

const parse = (metadata: unknown): Record<string, any> | undefined => {
  try {
    const parsed = typeof metadata === 'string' ? JSON.parse(metadata) : metadata
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? { ...parsed } : undefined
  } catch {
    return undefined
  }
}

/**
 * Attachment encryption metadata: the `enc` object `{ v, alg, attachmentId, key, renditions }`
 * kept next to the other metadata keys. The plaintext size remains the attachment's file size.
 */
export class FileEncryptionMetadata {
  readonly version: number
  readonly algorithm: string
  readonly attachmentId: string
  readonly key: string
  readonly renditions: FileEncryptionRendition[]

  constructor(
    algorithm: string,
    attachmentId: string,
    key: string,
    renditions: FileEncryptionRendition[] = [],
    version = 1
  ) {
    this.version = version
    this.algorithm = algorithm
    this.attachmentId = attachmentId
    this.key = key
    this.renditions = renditions
  }

  toEncryptionInfo(): FileEncryptionInfo {
    return { algorithm: this.algorithm, attachmentId: this.attachmentId, key: this.key }
  }

  /** The `enc` object as it is stored. */
  toJSON() {
    return {
      v: this.version,
      alg: this.algorithm,
      attachmentId: this.attachmentId,
      key: this.key,
      ...(this.renditions.length ? { renditions: this.renditions } : {})
    }
  }

  toString() {
    return `FileEncryptionMetadata(version=${this.version}, algorithm=${this.algorithm}, attachmentId=${this.attachmentId})`
  }

  static fromEncryptionInfo(info: FileEncryptionInfo, renditions: FileEncryptionRendition[] = []) {
    return new FileEncryptionMetadata(info.algorithm, info.attachmentId, info.key, renditions)
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
      typeof enc.attachmentId !== 'string' ||
      typeof enc.key !== 'string'
    ) {
      return undefined
    }
    const renditions = Array.isArray(enc.renditions)
      ? enc.renditions.filter(
          (rendition: any) =>
            rendition &&
            typeof rendition.role === 'string' &&
            typeof rendition.attachmentId === 'string' &&
            typeof rendition.key === 'string'
        )
      : []
    return new FileEncryptionMetadata(
      enc.alg,
      enc.attachmentId,
      enc.key,
      renditions,
      typeof enc.v === 'number' ? enc.v : 1
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
