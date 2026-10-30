import { setClient } from '../common/client'
import { IAttachmentDownloadFile, IAttachmentEncryption, IAttachmentUploadFile } from '../helpers/attachmentEncryption'

// Stand-ins for the SDK's AttachmentUploadFile and AttachmentDownloadFile. The
// real ones are tested in sceyt-chat against the format's test vectors; UIKit
// tests only check that files go through the SDK with the right key and URL.
// "Encrypting" prefixes the bytes with `enc(<key>@<url>):`, and opening a file
// with another key or for another URL fails. Like the SDK, encrypting or
// opening an encrypted file without a URL throws.

export const readBlobText = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })

const prefixOf = (key: string, url: string) => `enc(${key}@${url}):`
const notUsed = () => {
  throw new Error('not used by the UIKit')
}
const needsUrl = (url?: string) => {
  if (!url) {
    throw Object.assign(new Error("Attachment encryption needs the attachment's URL"), {
      type: 'InvalidAttachmentEncryption'
    })
  }
  return url
}

export const fakeEncryption = (key: string): IAttachmentEncryption => ({ v: 1, k: key })

/** The file prepared for upload; encrypted with `key` for `url` when there is a key. */
export const makeFakeUploadFile = (source: Blob, key?: string, url?: string): IAttachmentUploadFile => ({
  source,
  size: key ? source.size + prefixOf(key, url!).length : source.size,
  contentType: key ? 'application/octet-stream' : source.type,
  partSize: 5 * 1024 * 1024,
  partCount: Math.max(1, Math.ceil(source.size / (5 * 1024 * 1024))),
  encryption: key ? fakeEncryption(key) : undefined,
  getPart: notUsed,
  getAll: async () => (key ? new Blob([prefixOf(key, url!), source], { type: 'application/octet-stream' }) : source)
})

/** The stored file of the attachment at `url`; encrypted with `key` when there is one. */
export const makeFakeDownloadFile = (
  key: string | undefined,
  type: string = '',
  url?: string
): IAttachmentDownloadFile => ({
  type,
  isEncrypted: !!key,
  open: async (stored: Blob) => {
    if (!key) return type && stored.type !== type ? new Blob([stored], { type }) : stored
    const prefix = prefixOf(key, url!)
    const text = await readBlobText(stored)
    if (!text.startsWith(prefix)) {
      throw Object.assign(new Error(`Not encrypted with key ${key} for ${url}`), { type: 'AttachmentDecryptionFailed' })
    }
    return new Blob([text.slice(prefix.length)], { type })
  },
  resumeFrom: notUsed,
  openStream: notUsed,
  rangeFor: notUsed,
  openRange: notUsed
})

/** Installs a chat client whose files are fake ones; keys are numbered key-1, key-2, … */
export const installFakeFilesClient = () => {
  let created = 0
  const client = {
    prepareUpload: async (file: Blob, options: { encrypt?: boolean; url?: string } = {}) =>
      options.encrypt ? makeFakeUploadFile(file, `key-${++created}`, needsUrl(options.url)) : makeFakeUploadFile(file),
    prepareDownload: ({ metadata, type, url }: { metadata?: any; type?: string; url?: string }) => {
      const enc = (typeof metadata === 'string' ? JSON.parse(metadata) : metadata || {}).enc
      return enc ? makeFakeDownloadFile(enc.k, type, needsUrl(url)) : makeFakeDownloadFile(undefined, type)
    }
  }
  setClient(client)
  return client
}

/** A Blob encrypted the way the fake file of `key` encrypts, for the attachment at `url`. */
export const fakeEncrypted = (key: string, text: string, url: string) =>
  new Blob([`${prefixOf(key, url)}${text}`], { type: 'application/octet-stream' })
