import { getClient } from '../../common/client'
import {
  FileDecryptionSession,
  FileEncryption,
  FileEncryptionCheckpoint,
  FileEncryptionInfo,
  FileEncryptionSession
} from './types'

// The SDK's types (sceyt-chat FileEncryption), as far as this adapter uses them.
interface SdkPlaintextReader {
  readonly size: number
  // eslint-disable-next-line no-unused-vars
  read(offset: number, length: number): Promise<Uint8Array>
  close(): void
}

interface SdkAttachmentCipher {
  readonly attachmentKey: string
  readonly header: Uint8Array
  newDecryptingRandomAccessStream(source: {
    size: number
    // eslint-disable-next-line no-unused-vars
    read: (offset: number, length: number) => Promise<Uint8Array>
  }): Promise<SdkPlaintextReader>
}
interface SdkPreparedUpload {
  readonly ciphertextSize: number
  readonly plaintextSize: number
  readonly sourceId: string
  readonly cipher: SdkAttachmentCipher
  checkpoint(): { cipher: SdkAttachmentCipher; data: string }
  // eslint-disable-next-line no-unused-vars
  readCiphertextRange(offset: number, length: number): Promise<Uint8Array>
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
    this.encryptionInfo = { encodedKeys: upload.cipher.attachmentKey }
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
      plaintextSize: this.plaintextSize,
      header: Array.from(checkpoint.cipher.header),
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
    this.plaintextSize = reader.size
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
  async prepareEncryption(file: Blob, attachmentId?: Uint8Array): Promise<FileEncryptionSession> {
    const provider = sdkFileEncryption()
    return new ChatSdkEncryptionSession(await provider.prepareUpload(file, attachmentId || provider.newAttachmentId()))
  }

  ciphertextSize(plaintextSize: number): number {
    if (!Number.isSafeInteger(plaintextSize) || plaintextSize < 0) {
      throw Object.assign(new Error('The plaintext size must be a non-negative whole number'), {
        type: 'InvalidArgument'
      })
    }
    // The SDK's (sceyt-chat after 1.7.2-beta.11 has AttachmentCipher.storedSizeOf); with an older SDK,
    // the same arithmetic of format v1.
    const storedSizeOf = getClient()?.AttachmentCipher?.storedSizeOf
    if (typeof storedSizeOf === 'function') return storedSizeOf(plaintextSize)
    const segments = plaintextSize <= 65480 ? 1 : 1 + Math.ceil((plaintextSize - 65480) / 65520)
    return 72 + plaintextSize + 16 * segments
  }

  async restoreEncryption(file: Blob, checkpoint: FileEncryptionCheckpoint): Promise<FileEncryptionSession> {
    const provider = sdkFileEncryption()
    const upload = await provider.restoreUpload(file, {
      cipher: await getClient().AttachmentCipher.restore(
        checkpoint.encryptionInfo.encodedKeys,
        Uint8Array.from(checkpoint.header)
      ),
      data: checkpoint.data
    })
    return new ChatSdkEncryptionSession(upload)
  }

  async prepareDecryption(
    encryptedFile: Blob,
    encryptionInfo: FileEncryptionInfo,
    plaintextSize: number | undefined
  ): Promise<FileDecryptionSession> {
    sdkFileEncryption()
    // The SDK reads the keys; a file whose message carries no size (a video's preview) is sized from its encrypted bytes.
    const header = await readBytes(encryptedFile.slice(0, 72))
    const cipher: SdkAttachmentCipher = await getClient().AttachmentCipher.restore(encryptionInfo.encodedKeys, header)
    const reader = await cipher.newDecryptingRandomAccessStream({
      size: encryptedFile.size,
      read: (offset, length) => readBytes(encryptedFile.slice(offset, offset + length))
    })
    if (plaintextSize !== undefined && reader.size !== plaintextSize) {
      reader.close()
      throw Object.assign(new Error('The plaintext size does not match the attachment'), { type: 'Authentication' })
    }
    return new ChatSdkDecryptionSession(`${Array.from(header).join('.')}:${encryptedFile.size}`, reader)
  }
}
