import { setClient } from '../common/client'
import { IAttachmentDownloadFile, IAttachmentEncryption, IAttachmentUploadFile } from '../helpers/attachmentEncryption'

// Stand-ins for the SDK's AttachmentUploadFile and AttachmentDownloadFile. The
// real ones are tested in sceyt-chat against the format's test vectors; UIKit
// tests only check that files go through the SDK with the right unique id and
// key. "Encrypting" prefixes the bytes with `enc(<key>@<id>):`, and opening a
// file with another key or unique id fails. Key `key-n` has unique id `id-n`.

export const readBlobText = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })

const uniqueIdOf = (key: string) => key.replace(/^key-/, 'id-')
const prefixOf = (key: string, id: string = uniqueIdOf(key)) => `enc(${key}@${id}):`
const notUsed = () => {
  throw new Error('not used by the UIKit')
}

export const fakeEncryption = (key: string): IAttachmentEncryption => ({ id: uniqueIdOf(key), v: 1, k: key })

/** The file prepared for upload; encrypted with `key` when there is a key. */
export const makeFakeUploadFile = (source: Blob, key?: string): IAttachmentUploadFile => ({
  source,
  size: key ? source.size + prefixOf(key).length : source.size,
  contentType: key ? 'application/octet-stream' : source.type,
  partSize: 5 * 1024 * 1024,
  partCount: Math.max(1, Math.ceil(source.size / (5 * 1024 * 1024))),
  encryption: key ? fakeEncryption(key) : undefined,
  getPart: notUsed,
  getRange: notUsed,
  getAll: async () => (key ? new Blob([prefixOf(key), source], { type: 'application/octet-stream' }) : source)
})

/** The stored file of an attachment; encrypted with `key` and unique id `id` when there is a key. */
export const makeFakeDownloadFile = (
  key: string | undefined,
  type: string = '',
  id?: string
): IAttachmentDownloadFile => ({
  type,
  isEncrypted: !!key,
  open: async (stored: Blob) => {
    if (!key) return type && stored.type !== type ? new Blob([stored], { type }) : stored
    if (!id) {
      throw Object.assign(new Error('Attachment encryption: the unique id is missing'), {
        type: 'InvalidAttachmentEncryption'
      })
    }
    const prefix = prefixOf(key, id)
    const text = await readBlobText(stored)
    if (!text.startsWith(prefix)) {
      throw Object.assign(new Error(`Not encrypted with key ${key} and unique id ${id}`), {
        type: 'AttachmentDecryptionFailed'
      })
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
    prepareUpload: async (file: Blob, options: { encrypt?: boolean } = {}) =>
      options.encrypt ? makeFakeUploadFile(file, `key-${++created}`) : makeFakeUploadFile(file),
    prepareDownload: ({ metadata, type }: { metadata?: any; type?: string }) => {
      const enc = (typeof metadata === 'string' ? JSON.parse(metadata) : metadata || {}).enc
      return enc ? makeFakeDownloadFile(enc.k, type, enc.id) : makeFakeDownloadFile(undefined, type)
    }
  }
  setClient(client)
  return client
}

/** A Blob encrypted the way the fake file of `key` (unique id `id-n` for `key-n`) encrypts. */
export const fakeEncrypted = (key: string, text: string) =>
  new Blob([`${prefixOf(key)}${text}`], { type: 'application/octet-stream' })
