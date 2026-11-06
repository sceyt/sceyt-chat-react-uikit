import { setClient } from '../../common/client'
import { ChatSdkEncryptionSession, ChatSdkFileEncryption } from '../encryption/chatSdkFileEncryption'
import { FileDecryptionSession, FileEncryption, FileEncryptionInfo } from '../encryption/types'
import { fileTransfer } from '../sceytChatUIKitFileTransfer'
import { FileUploadType } from '../types'
import { DefaultFileTransferProvider } from './defaultFileTransferProvider'

const ALG = 'tink-aes256-gcm-hkdf-64k+commit-v1'
const info: FileEncryptionInfo = { encodedKeys: 'keys-of-file-id' }

const readText = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })

// An SDK upload session (sceyt-chat PreparedUpload) as the default transport uploads it.
const sdkUpload = () => ({
  ciphertextSize: 20,
  plaintextSize: 5,
  sourceId: 'source-1',
  encryptionInfo: { format: ALG, data: { uniqueId: 'file-id', key: 'file-key', plainSize: 5 } },
  encodedKeys: 'keys-of-file-id',
  checkpoint: jest.fn(),
  readCiphertextRange: jest.fn(),
  close: jest.fn()
})

// Encryption whose decryption gives `plaintext` for any file, and records its calls.
const decryptingTo = (plaintext: string): FileEncryption & { decrypted: any[]; sessions: any[] } => {
  const decrypted: any[] = []
  const sessions: any[] = []
  return {
    decrypted,
    sessions,
    prepareEncryption: jest.fn(),
    restoreEncryption: jest.fn(),
    prepareDecryption: jest.fn(
      async (encryptedFile: Blob, encryptionInfo: FileEncryptionInfo, plaintextSize?: number) => {
        decrypted.push({ encryptedFile, encryptionInfo, plaintextSize })
        const bytes = Uint8Array.from(plaintext, (char) => char.charCodeAt(0))
        const session: FileDecryptionSession = {
          sourceId: 's',
          plaintextSize: bytes.length,
          read: async (offset: number, length: number) => bytes.slice(offset, offset + length),
          close: jest.fn()
        }
        sessions.push(session)
        return session
      }
    )
  }
}

const request = (overrides: any = {}) => ({
  operationId: 'upload:tid-1',
  sourceFile: new File(['hello'], 'a.txt', { type: 'text/plain' }),
  fileName: 'a.txt',
  mimeType: 'text/plain',
  type: FileUploadType.PLAIN,
  signal: new AbortController().signal,
  ...overrides
})

describe('DefaultFileTransferProvider', () => {
  const transport = new DefaultFileTransferProvider()
  let client: any

  beforeEach(() => {
    client = {
      upload: jest.fn(async (_file: Blob, options: any) => {
        options.progress(1, 4)
        options.progress(4, 4)
        return { url: 'https://cdn.example/plain', size: 5 }
      }),
      uploadEncrypted: jest.fn(async () => ({ url: 'https://cdn.example/encrypted', size: 5 })),
      download: jest.fn(async (_url: string, options: any) => {
        options.progress(50, 100)
        options.progress(100, 100)
        return new Blob(['stored'], { type: options.type })
      })
    }
    setClient(client)
  })

  afterEach(() => {
    fileTransfer.encryption = new ChatSdkFileEncryption()
    setClient({})
  })

  describe('upload', () => {
    it('a plain file goes with client.upload as it is, with its progress in percent', async () => {
      const progress: number[] = []
      const plain = request()

      const result = await transport.upload(plain, { onProgress: (percent) => progress.push(percent) })

      expect(result).toEqual({ type: 'success', result: { url: 'https://cdn.example/plain' } })
      expect(client.upload.mock.calls[0][0] === plain.sourceFile).toBe(true)
      expect(client.upload.mock.calls[0][1].signal).toBe(plain.signal)
      expect(progress).toEqual([25, 100])
    })

    it("a failed upload is a failure with the client's error", async () => {
      const refused = Object.assign(new Error('too large'), { type: 'TooLargeRequest' })
      client.upload.mockRejectedValueOnce(refused)

      expect(await transport.upload(request(), { onProgress: jest.fn() })).toEqual({ type: 'failure', error: refused })
    })

    it('an encrypted file goes as an SDK session with client.uploadEncrypted; its encryption info comes back', async () => {
      const upload = sdkUpload()
      const session = new ChatSdkEncryptionSession(upload)
      fileTransfer.encryption = { ...decryptingTo(''), prepareEncryption: jest.fn(async () => session) }
      const encrypted = request({ type: FileUploadType.ENCRYPTED })

      const result = await transport.upload(encrypted, { onProgress: jest.fn() })

      expect(fileTransfer.encryption.prepareEncryption).toHaveBeenCalledWith(encrypted.sourceFile)
      expect(client.uploadEncrypted.mock.calls[0][0]).toBe(upload)
      expect(client.upload).not.toHaveBeenCalled()
      expect(result).toEqual({
        type: 'success',
        result: { url: 'https://cdn.example/encrypted', encryptionInfo: info }
      })
      // The session is closed once the upload ends.
      expect(upload.close).toHaveBeenCalledTimes(1)
    })

    it('a failed encrypted upload is a failure, and its session is closed', async () => {
      const upload = sdkUpload()
      fileTransfer.encryption = {
        ...decryptingTo(''),
        prepareEncryption: jest.fn(async () => new ChatSdkEncryptionSession(upload))
      }
      client.uploadEncrypted.mockRejectedValueOnce(new Error('network'))

      const result = await transport.upload(request({ type: FileUploadType.ENCRYPTED }), { onProgress: jest.fn() })

      expect(result).toMatchObject({ type: 'failure', error: { message: 'network' } })
      expect(upload.close).toHaveBeenCalledTimes(1)
    })

    describe("an app's encryption", () => {
      // The app's encryption makes its own keys string, kept in enc as it is.
      const appInfo: FileEncryptionInfo = { encodedKeys: 'my-aes-gcm:aXY:3' }
      // A session of an app's encryption: its "ciphertext" is `sealed:` and the file.
      const appSession = (plaintext: string) => {
        const bytes = Uint8Array.from(`sealed:${plaintext}`, (char) => char.charCodeAt(0))
        return {
          sourceId: 'app-source',
          plaintextSize: plaintext.length,
          ciphertextSize: bytes.length,
          encryptionInfo: appInfo,
          read: jest.fn(async (offset: number, length: number) => bytes.slice(offset, offset + length)),
          checkpoint: jest.fn(),
          close: jest.fn()
        }
      }

      it('is uploaded as its encrypted bytes with client.upload, under the file name; its keys come back', async () => {
        const session = appSession('hello')
        fileTransfer.encryption = { ...decryptingTo(''), prepareEncryption: jest.fn(async () => session) }
        const progress: number[] = []

        const result = await transport.upload(request({ type: FileUploadType.ENCRYPTED }), {
          onProgress: (percent) => progress.push(percent)
        })

        expect(result).toEqual({
          type: 'success',
          result: { url: 'https://cdn.example/plain', encryptionInfo: appInfo }
        })
        expect(client.uploadEncrypted).not.toHaveBeenCalled()
        const stored = client.upload.mock.calls[0][0] as File
        expect(stored.name).toBe('a.txt')
        expect(stored.type).toBe('application/octet-stream')
        expect(await readText(stored)).toBe('sealed:hello')
        expect(progress).toEqual([25, 100])
        expect(session.close).toHaveBeenCalledTimes(1)
      })

      it('a failed upload is a failure, and its session is closed', async () => {
        const session = appSession('hello')
        fileTransfer.encryption = { ...decryptingTo(''), prepareEncryption: jest.fn(async () => session) }
        client.upload.mockRejectedValueOnce(new Error('network'))

        const result = await transport.upload(request({ type: FileUploadType.ENCRYPTED }), { onProgress: jest.fn() })

        expect(result).toMatchObject({ type: 'failure', error: { message: 'network' } })
        expect(session.close).toHaveBeenCalledTimes(1)
      })

      it('an upload stopped while it is encrypted sends nothing', async () => {
        const controller = new AbortController()
        const session = appSession('hello')
        session.read.mockImplementation(async (offset: number, length: number) => {
          controller.abort()
          return new Uint8Array(length).fill(offset)
        })
        fileTransfer.encryption = { ...decryptingTo(''), prepareEncryption: jest.fn(async () => session) }

        const result = await transport.upload(request({ type: FileUploadType.ENCRYPTED, signal: controller.signal }), {
          onProgress: jest.fn()
        })

        expect(result.type).toBe('interrupted')
        expect(client.upload).not.toHaveBeenCalled()
        expect(session.close).toHaveBeenCalledTimes(1)
      })

      it('a download is decrypted with it, given the keys the upload stored', async () => {
        const encryption = decryptingTo('picture')
        fileTransfer.encryption = encryption

        await transport.download(
          {
            operationId: 'download:1',
            url: 'https://cdn.example/file',
            mimeType: 'image/png',
            encryptionInfo: appInfo,
            plaintextSize: 7,
            signal: new AbortController().signal
          },
          { onProgress: jest.fn() }
        )

        expect(encryption.decrypted[0].encryptionInfo).toEqual(appInfo)
      })
    })
  })

  describe('download', () => {
    const download = (overrides: any = {}) => ({
      operationId: 'download:tid-1',
      url: 'https://cdn.example/file',
      mimeType: 'image/png',
      signal: new AbortController().signal,
      ...overrides
    })

    it('a plain file comes from client.download with its type and progress in percent', async () => {
      const progress: number[] = []
      const plain = download()

      const result = await transport.download(plain, { onProgress: (percent) => progress.push(percent) })

      expect(client.download).toHaveBeenCalledWith(
        'https://cdn.example/file',
        expect.objectContaining({ type: 'image/png', signal: plain.signal })
      )
      expect(result.type).toBe('success')
      const file = (result as any).result as Blob
      expect(file.type).toBe('image/png')
      expect(await readText(file)).toBe('stored')
      expect(progress).toEqual([50, 100])
    })

    it("an encrypted file is decrypted with the encryption module and the attachment's size; download is 0-90%", async () => {
      const encryption = decryptingTo('picture')
      fileTransfer.encryption = encryption
      const progress: number[] = []

      const result = await transport.download(download({ encryptionInfo: info, plaintextSize: 7 }), {
        onProgress: (percent) => progress.push(percent)
      })

      // The stored bytes are fetched untyped, then opened.
      expect(client.download.mock.calls[0][1].type).toBe('')
      expect(encryption.decrypted).toHaveLength(1)
      expect(await readText(encryption.decrypted[0].encryptedFile)).toBe('stored')
      expect(encryption.decrypted[0].encryptionInfo).toEqual(info)
      expect(encryption.decrypted[0].plaintextSize).toBe(7)
      const file = (result as any).result as Blob
      expect(file.type).toBe('image/png')
      expect(await readText(file)).toBe('picture')
      expect(progress).toEqual([45, 90, 100])
      expect(encryption.sessions[0].close).toHaveBeenCalledTimes(1)
    })

    it('a file that does not open is a failure', async () => {
      const notOpened = Object.assign(new Error('commitment'), { type: 'Authentication' })
      fileTransfer.encryption = {
        ...decryptingTo(''),
        prepareDecryption: jest.fn(async () => Promise.reject(notOpened))
      }

      expect(
        await transport.download(download({ encryptionInfo: info, plaintextSize: 7 }), { onProgress: jest.fn() })
      ).toEqual({
        type: 'failure',
        error: notOpened
      })
    })

    it('a failed download is a failure with the client error', async () => {
      const gone = Object.assign(new Error('404'), { type: 'DownloadFailed', code: 404 })
      client.download.mockRejectedValueOnce(gone)

      expect(await transport.download(download(), { onProgress: jest.fn() })).toEqual({ type: 'failure', error: gone })
    })
  })

  it('has no native pause: the UIKit stops and restarts an attempt', () => {
    expect(transport.pause()).toBe(false)
    expect(transport.resume()).toBe(false)
    expect(() => transport.cancel()).not.toThrow()
  })
})
