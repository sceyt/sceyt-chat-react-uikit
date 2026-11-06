import { getClient } from '../../common/client'
import { ChatSdkEncryptionSession } from '../encryption/chatSdkFileEncryption'
import { FileDecryptionSession } from '../encryption/types'
import { fileTransfer } from '../sceytChatUIKitFileTransfer'
import {
  FileDownloadRequest,
  FileTransferCallback,
  FileTransferResult,
  FileTransferProvider,
  FileUploadRequest,
  FileUploadResult,
  FileUploadType
} from '../types'

// Plaintext is read from a decryption session this many bytes at a time.
const READ_SIZE = 5 * 1024 * 1024
// Downloading is 0–90% of a download's progress, verifying the decrypted file the rest.
const DOWNLOAD_SHARE = 90

const asError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error || 'Transfer failed'))

const percentOf = (loaded: number, total?: number) => (total ? Math.min(100, (loaded / total) * 100) : 0)

// `size` bytes of `read` as a Blob of `type`, grown range by range: browsers keep the Blob so far
// by reference, so the whole file is not held in JavaScript memory.
const readWhole = async (
  size: number,
  // eslint-disable-next-line no-unused-vars
  read: (offset: number, length: number) => Promise<Uint8Array>,
  type: string,
  // eslint-disable-next-line no-unused-vars
  onProgress?: (fraction: number) => void
): Promise<Blob> => {
  let done = new Blob([], { type })
  for (let offset = 0; offset < size; offset += READ_SIZE) {
    const length = Math.min(READ_SIZE, size - offset)
    done = new Blob([done, (await read(offset, length)) as BlobPart], { type })
    if (onProgress) onProgress((offset + length) / size)
  }
  return done
}

/** The verified plaintext of `session` as a Blob of `type`, read range by range. */
export const readDecryptedFile = (
  session: FileDecryptionSession,
  type: string,
  // eslint-disable-next-line no-unused-vars
  onProgress?: (fraction: number) => void
): Promise<Blob> => readWhole(session.plaintextSize, (offset, length) => session.read(offset, length), type, onProgress)

/**
 * The built-in provider: files go to the chat server with the chat client, one request per
 * file. An upload is encrypted with `fileTransfer.encryption`: a chat SDK session is sent
 * natively (client.uploadEncrypted), an app's as its encrypted bytes (client.upload). A
 * download is decrypted with `fileTransfer.encryption`. It has no native pause: the UIKit
 * stops an upload and sends it again from the start.
 */
export class DefaultFileTransferProvider implements FileTransferProvider {
  async upload(
    request: FileUploadRequest,
    callback: FileTransferCallback
  ): Promise<FileTransferResult<FileUploadResult>> {
    const client = getClient()
    const options = {
      signal: request.signal,
      progress: (loaded: number, total: number) => callback.onProgress(percentOf(loaded, total))
    }
    if (request.type === FileUploadType.PLAIN) {
      try {
        const { url } = await client.upload(request.sourceFile, options)
        return FileTransferResult.success({ url })
      } catch (error) {
        return FileTransferResult.failure(asError(error))
      }
    }
    let session
    try {
      session = await fileTransfer.encryption.prepareEncryption(request.sourceFile)
    } catch (error) {
      return FileTransferResult.failure(asError(error))
    }
    try {
      if (session instanceof ChatSdkEncryptionSession) {
        const { url } = await client.uploadEncrypted(session.upload, options)
        return FileTransferResult.success({ url, encryptionInfo: session.encryptionInfo })
      }
      // An app's encryption: its encrypted bytes are stored as they are, under the file's name.
      const encrypted = session
      const stored = await readWhole(
        encrypted.ciphertextSize,
        (offset, length) => encrypted.read(offset, length),
        'application/octet-stream'
      )
      if (request.signal.aborted) return FileTransferResult.interrupted(new Error('The upload was stopped'))
      const file = new File([stored], request.fileName || 'file', { type: 'application/octet-stream' })
      const { url } = await client.upload(file, options)
      return FileTransferResult.success({ url, encryptionInfo: session.encryptionInfo })
    } catch (error) {
      return FileTransferResult.failure(asError(error))
    } finally {
      session.close()
    }
  }

  async download(request: FileDownloadRequest, callback: FileTransferCallback): Promise<FileTransferResult<Blob>> {
    const encrypted = !!request.encryptionInfo
    const share = encrypted ? DOWNLOAD_SHARE : 100
    let stored: Blob
    try {
      stored = await getClient().download(request.url, {
        type: encrypted ? '' : request.mimeType || '',
        signal: request.signal,
        progress: (loaded: number, total?: number) => callback.onProgress(percentOf(loaded, total) * (share / 100))
      })
    } catch (error) {
      return FileTransferResult.failure(asError(error))
    }
    if (!request.encryptionInfo) return FileTransferResult.success(stored)
    let session: FileDecryptionSession | undefined
    try {
      session = await fileTransfer.encryption.prepareDecryption(stored, request.encryptionInfo, request.plaintextSize)
      const plaintext = await readDecryptedFile(session, request.mimeType || '', (fraction) =>
        callback.onProgress(DOWNLOAD_SHARE + fraction * (100 - DOWNLOAD_SHARE))
      )
      return FileTransferResult.success(plaintext)
    } catch (error) {
      return FileTransferResult.failure(asError(error))
    } finally {
      session?.close()
    }
  }

  // No native pause: the UIKit stops the attempt and starts it again.
  pause() {
    return false
  }

  resume() {
    return false
  }

  // The request's signal stops the active request; there is no upload journal to clean.
  cancel() {}
}
