import { setClient } from '../common/client'
import { FileEncryptionInfo } from '../fileTransfer/encryption/types'
import { readResponseBlobWithProgress } from '../helpers/getVideoFrame'

// A stand-in for the SDK's file encryption (sceyt-chat client.FileEncryption). The real
// one is tested in sceyt-chat against the format's test vectors; UIKit tests only check
// that files go through it with the right attachment id and key. "Encrypting" prefixes
// the bytes with a fixed-length `enc(<key>@<id>):` header, and opening a file with
// another key or attachment id fails. Key `key-n` has attachment id `id-n`. Its keys string
// (the SDK's AttachmentCipher.getToken, kept in metadata as `enc`) is `fake-keys.id-n.key-n`.

const ALG = 'tink-aes256-gcm-hkdf-64k+commit-v1'
// Every fake header has this length, so a plaintext size follows from a stored size.
const HEADER_SIZE = 32

export const readBlobText = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })

const readBytes = (blob: Blob): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })

const uniqueIdOf = (key: string) => key.replace(/^key-/, 'id-')
const keyOf = (uniqueId: string) => uniqueId.replace(/^id-/, 'key-')
const headerOf = (key: string, id: string = uniqueIdOf(key)) => `enc(${key}@${id})`.padEnd(HEADER_SIZE - 1) + ':'

const sdkError = (type: string, message: string) => Object.assign(new Error(message), { type })

/** The `enc` of the fake file of `key`, as it is in attachment metadata: its keys string. */
export const fakeEncryption = (key: string) => `fake-keys.${uniqueIdOf(key)}.${key}`

/** What opens the fake file of `key`, as the UIKit's encryption gives it. */
export const fakeEncryptionInfo = (key: string): FileEncryptionInfo => ({ encodedKeys: fakeEncryption(key) })

/** The SDK's FileEncryption.restore, for fake keys strings. */
const decodeFakeKeys = (encoded: unknown, plainSize = -1) => {
  const match = typeof encoded === 'string' ? /^fake-keys\.([^.]+)\.([^.]+)$/.exec(encoded) : null
  if (!match) throw sdkError('InvalidEncryption', 'Not a keys string')
  return { format: ALG, data: { uniqueId: match[1], key: match[2], plainSize } }
}

/** A Blob encrypted the way the fake file of `key` (attachment id `id-n` for `key-n`) encrypts. */
export const fakeEncrypted = (key: string, text: string) =>
  new Blob([`${headerOf(key)}${text}`], { type: 'application/octet-stream' })

/** The SDK's PreparedUpload of `source`, encrypted with `key`. */
export const makeFakePreparedUpload = (source: Blob, key: string) => {
  const uniqueId = uniqueIdOf(key)
  const stored = new Blob([headerOf(key), source], { type: 'application/octet-stream' })
  const encryptionInfo = { format: ALG, data: { uniqueId, key, plainSize: source.size } }
  return {
    source,
    stored,
    ciphertextSize: stored.size,
    plaintextSize: source.size,
    sourceId: `source-${uniqueId}`,
    cipher: { ...encryptionInfo, getToken: () => fakeEncryption(key) },
    checkpoint: () => ({ cipher: encryptionInfo, data: '{}' }),
    readCiphertextRange: (offset: number, length: number) => readBytes(stored.slice(offset, offset + length)),
    close: () => undefined
  }
}

/** The SDK's PlaintextReader of a stored file; it fails unless the file is the one `info` opens. */
const openFakeDownload = async (
  source: { ciphertextSize: number; read: (offset: number, length: number) => Promise<Uint8Array> },
  info: { format: string; data: { uniqueId: string; key: string; plainSize: number } }
) => {
  if (!info?.data?.uniqueId || !info.data.key) {
    throw sdkError('InvalidEncryption', 'Attachment encryption: the attachment id or key is missing')
  }
  const bytes = await source.read(0, source.ciphertextSize)
  const text = await readBlobText(new Blob([bytes as BlobPart]))
  const header = headerOf(info.data.key, info.data.uniqueId)
  const plaintext = text.slice(HEADER_SIZE)
  // A size of -1 (FileEncryption.unknownPlainSize) is taken from the stored file.
  if (!text.startsWith(header) || (info.data.plainSize !== -1 && plaintext.length !== info.data.plainSize)) {
    throw sdkError('Authentication', `Not encrypted with key ${info.data.key} and attachment id ${info.data.uniqueId}`)
  }
  const plain = Uint8Array.from(plaintext, (char) => char.charCodeAt(0))
  return {
    plaintextSize: plain.length,
    read: async (offset: number, length: number) => plain.slice(offset, offset + length),
    close: () => undefined
  }
}

/** client.download as the SDK does it, over the test's fetch: the stored bytes, typed `type`. */
export const fakeSdkDownload = async (
  url: string,
  {
    type,
    progress,
    signal
  }: {
    type?: string
    // eslint-disable-next-line no-unused-vars
    progress?: (loaded: number, total?: number) => void
    signal?: AbortSignal
  } = {}
): Promise<Blob> => {
  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw Object.assign(new Error(`The file could not be downloaded (${response.status})`), {
      code: response.status,
      type: 'DownloadFailed'
    })
  }
  const stored = await readResponseBlobWithProgress(response, ({ loaded, total }) => progress?.(loaded, total))
  return type && stored.type !== type ? new Blob([stored], { type }) : stored
}

/**
 * Installs a chat client whose file encryption is the fake one (keys are numbered key-1,
 * key-2, …) and whose download goes over the test's fetch. A test adds `upload` and
 * `uploadEncrypted` when it uploads.
 */
export const installFakeFilesClient = () => {
  let created = 0
  const client: any = {
    FileEncryption: {
      newUniqueId: () => `id-${++created}`,
      prepareUpload: async (file: Blob, uniqueId: string) => makeFakePreparedUpload(file, keyOf(uniqueId)),
      openDownload: openFakeDownload,
      restore: decodeFakeKeys,
      unknownPlainSize: -1,
      plaintextSize: (ciphertextSize: number) => Math.max(0, ciphertextSize - HEADER_SIZE)
    },
    download: fakeSdkDownload
  }
  setClient(client)
  return client
}
