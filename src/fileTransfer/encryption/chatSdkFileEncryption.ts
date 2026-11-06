import { getClient } from '../../common/client'
import {
  FileDecryptionSession,
  FileEncryption,
  FileEncryptionCheckpoint,
  FileEncryptionInfo,
  FileEncryptionSession
} from './types'

// The SDK's types (sceyt-chat FileEncryption), as far as this adapter uses them.
interface SdkFileEncryptionInfo {
  format: string
  data: { uniqueId: string; key: string; plainSize: number }
}
interface SdkPreparedUpload {
  readonly ciphertextSize: number
  readonly plaintextSize: number
  readonly sourceId: string
  readonly encryptionInfo: SdkFileEncryptionInfo
  readonly encodedKeys: string
  checkpoint(): { encryptionInfo: SdkFileEncryptionInfo; data: string }
  // eslint-disable-next-line no-unused-vars
  readCiphertextRange(offset: number, length: number): Promise<Uint8Array>
  close(): void
}
interface SdkPlaintextReader {
  readonly plaintextSize: number
  // eslint-disable-next-line no-unused-vars
  read(offset: number, length: number): Promise<Uint8Array>
  close(): void
}

// The SDK's FileEncryption, from the chat client.
const sdkFileEncryption = () => {
  const provider = getClient()?.FileEncryption
  if (!provider) {
    throw new Error('Attachment encryption needs a sceyt-chat version with client.FileEncryption')
  }
  return provider
}

const closedError = (what: string) => new Error(`${what} session is closed`)

const readBytes = (blob: Blob): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })

/** An encryption session of the SDK; the default transport uploads its `upload` natively. */
export class ChatSdkEncryptionSession implements FileEncryptionSession {
  readonly sourceId: string
  readonly plaintextSize: number
  readonly ciphertextSize: number
  readonly encryptionInfo: FileEncryptionInfo
  private closed = false

  constructor(readonly upload: SdkPreparedUpload) {
    this.sourceId = upload.sourceId
    this.plaintextSize = upload.plaintextSize
    this.ciphertextSize = upload.ciphertextSize
    // The keys string the SDK made goes to the attachment's metadata as `enc`.
    this.encryptionInfo = { encodedKeys: upload.encodedKeys }
  }

  read(offset: number, length: number): Promise<Uint8Array> {
    if (this.closed) return Promise.reject(closedError('Encryption'))
    return this.upload.readCiphertextRange(offset, length)
  }

  checkpoint(): FileEncryptionCheckpoint {
    if (this.closed) throw closedError('Encryption')
    const checkpoint = this.upload.checkpoint()
    return {
      encryptionInfo: this.encryptionInfo,
      plaintextSize: checkpoint.encryptionInfo.data.plainSize,
      data: checkpoint.data
    }
  }

  close() {
    if (this.closed) return
    this.closed = true
    this.upload.close()
  }
}

class ChatSdkDecryptionSession implements FileDecryptionSession {
  readonly plaintextSize: number
  private closed = false

  constructor(
    readonly sourceId: string,
    private readonly reader: SdkPlaintextReader
  ) {
    this.plaintextSize = reader.plaintextSize
  }

  read(offset: number, length: number): Promise<Uint8Array> {
    if (this.closed) return Promise.reject(closedError('Decryption'))
    return this.reader.read(offset, length)
  }

  close() {
    if (this.closed) return
    this.closed = true
    this.reader.close()
  }
}

/** The SDK's file encryption behind the UIKit's encryption interface. */
export class ChatSdkFileEncryption implements FileEncryption {
  async prepareEncryption(file: Blob, attachmentId?: string): Promise<FileEncryptionSession> {
    const provider = sdkFileEncryption()
    return new ChatSdkEncryptionSession(await provider.prepareUpload(file, attachmentId || provider.newUniqueId()))
  }

  ciphertextSize(plaintextSize: number): number {
    return sdkFileEncryption().ciphertextSize(plaintextSize)
  }

  async restoreEncryption(file: Blob, checkpoint: FileEncryptionCheckpoint): Promise<FileEncryptionSession> {
    const provider = sdkFileEncryption()
    const upload = await provider.restoreUpload(file, {
      encryptionInfo: provider.decodeKeys(checkpoint.encryptionInfo.encodedKeys, checkpoint.plaintextSize),
      data: checkpoint.data
    })
    return new ChatSdkEncryptionSession(upload)
  }

  async prepareDecryption(
    encryptedFile: Blob,
    encryptionInfo: FileEncryptionInfo,
    plaintextSize: number | undefined
  ): Promise<FileDecryptionSession> {
    const provider = sdkFileEncryption()
    // The SDK reads the keys; a file whose message carries no size (a video's preview) is sized from its encrypted bytes.
    const info: SdkFileEncryptionInfo = provider.decodeKeys(
      encryptionInfo.encodedKeys,
      plaintextSize === undefined ? provider.unknownPlainSize : plaintextSize
    )
    const reader: SdkPlaintextReader = await provider.openDownload(
      {
        ciphertextSize: encryptedFile.size,
        read: (offset: number, length: number) => readBytes(encryptedFile.slice(offset, offset + length))
      },
      info
    )
    return new ChatSdkDecryptionSession(`${info.data.uniqueId}:${encryptedFile.size}`, reader)
  }
}
