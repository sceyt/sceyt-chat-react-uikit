import FileSaver from 'file-saver'
import { cancelDownloadFile, downloadFile } from './index'
import { fileTransfer } from '../fileTransfer/sceytChatUIKitFileTransfer'
import { readDecryptedFile } from '../fileTransfer/defaults/defaultFileTransferProvider'
import { FileDownloadRequest, FileTransferResult } from '../fileTransfer/types'
import {
  fakeEncrypted,
  fakeEncryption,
  fakeEncryptionInfo,
  installFakeFilesClient,
  readBlobText
} from '../testUtils/fakeAttachmentFiles'

jest.mock('file-saver', () => ({
  __esModule: true,
  default: { saveAs: jest.fn() }
}))

const mockSaveAs = FileSaver.saveAs as jest.Mock

/** Sets a custom transport (fileTransfer.provider) whose download is `download`. */
const useTransport = (
  // eslint-disable-next-line no-unused-vars
  download: (request: FileDownloadRequest) => Promise<FileTransferResult<Blob>>
) => {
  const transport = { upload: jest.fn(), download: jest.fn(download), cancel: jest.fn() }
  fileTransfer.provider = transport
  return transport
}

/**
 * A custom transport whose server stores `stored`: it opens it with the UIKit's encryption,
 * as a transport is expected to.
 */
const useDecryptingTransport = (stored: Blob) =>
  useTransport(async (request) => {
    try {
      const session = await fileTransfer.encryption.prepareDecryption(
        stored,
        request.encryptionInfo!,
        request.plaintextSize
      )
      return FileTransferResult.success(await readDecryptedFile(session, request.mimeType || ''))
    } catch (error) {
      return FileTransferResult.failure(error as Error)
    }
  })

afterEach(() => {
  fileTransfer.configure()
})

describe('downloadFile without a custom transport: the SDK downloads (client.download)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    installFakeFilesClient()
  })

  it('reports incremental progress for a full video download before saving it', async () => {
    const read = jest
      .fn()
      .mockResolvedValueOnce({ done: false, value: new Uint8Array([1, 2]) })
      .mockResolvedValueOnce({ done: false, value: new Uint8Array([3, 4]) })
      .mockResolvedValueOnce({ done: true })
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: jest.fn((name: string) => (name === 'content-length' ? '4' : 'video/mp4')) },
      body: { getReader: () => ({ read }) }
    })
    const done = jest.fn()
    const progress = jest.fn()

    await downloadFile(
      { id: 'video-id', url: 'https://cdn/video.mp4', name: 'video.mp4', size: 4 } as any,
      true,
      done,
      progress
    )

    expect(progress).toHaveBeenNthCalledWith(1, { loaded: 2, total: 4 })
    expect(progress).toHaveBeenNthCalledWith(2, { loaded: 4, total: 4 })
    expect(done).toHaveBeenCalledWith('video-id')
    expect(mockSaveAs).toHaveBeenCalledWith(expect.any(Blob), 'video.mp4')
  })

  it('marks a full video download as failed when the browser request fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network error'))
    const done = jest.fn()

    await downloadFile({ id: 'video-id', url: 'https://cdn/video.mp4', name: 'video.mp4' } as any, true, done)

    expect(done).toHaveBeenCalledWith('video-id', true)
    expect(mockSaveAs).not.toHaveBeenCalled()
  })
})

describe('downloadFile with a custom transport', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('gives the transport the attachment, which carries its message id', async () => {
    const transport = useTransport(async () => FileTransferResult.success(new Blob(['file'])))
    const attachment = {
      id: 'file-id',
      messageId: '9223372036854775807',
      url: 'https://cdn/file.pdf',
      name: 'file.pdf'
    } as any

    await downloadFile(attachment, true, undefined, undefined, 'text')

    const [request] = transport.download.mock.calls[0]
    expect(request).toMatchObject({
      operationId: 'download:file-id',
      url: 'https://cdn/file.pdf',
      mimeType: 'application/pdf'
    })
    expect((request.context as any).attachment === attachment).toBe(true)
    expect((request.context as any).attachment.messageId).toBe('9223372036854775807')
    expect(mockSaveAs).toHaveBeenCalledWith(expect.any(Blob), 'file.pdf')
  })
})

describe('downloadFile for an encrypted attachment', () => {
  const attachment = {
    id: 'doc-id',
    url: 'https://cdn/doc',
    name: 'report.pdf',
    // The plaintext's size: 'pdf-bytes'.
    size: 9,
    metadata: JSON.stringify({ 'sceyt.enc': fakeEncryption('key-5') })
  } as any

  beforeEach(() => {
    jest.clearAllMocks()
    installFakeFilesClient()
  })

  it('saves the file the custom transport decrypted with what the attachment metadata gives it', async () => {
    const transport = useDecryptingTransport(fakeEncrypted('key-5', 'pdf-bytes'))
    const done = jest.fn()

    await downloadFile(attachment, true, done)

    expect(transport.download.mock.calls[0][0]).toMatchObject({
      encryptionInfo: fakeEncryptionInfo('key-5'),
      plaintextSize: 9,
      mimeType: 'application/pdf'
    })
    const [saved, name] = mockSaveAs.mock.calls[0]
    expect(name).toBe('report.pdf')
    expect(saved.type).toBe('application/pdf')
    expect(await readBlobText(saved)).toBe('pdf-bytes')
    expect(done).toHaveBeenCalledWith('doc-id')
  })

  it('saves the decrypted file the SDK downloaded', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, blob: async () => fakeEncrypted('key-5', 'pdf-bytes') })

    await downloadFile(attachment, true, jest.fn())

    const [saved] = mockSaveAs.mock.calls[0]
    expect(saved.type).toBe('application/pdf')
    expect(await readBlobText(saved)).toBe('pdf-bytes')
  })

  it('saves nothing when the file does not decrypt', async () => {
    useDecryptingTransport(fakeEncrypted('another-key', 'pdf-bytes'))
    const done = jest.fn()

    await downloadFile(attachment, true, done)

    expect(mockSaveAs).not.toHaveBeenCalled()
    expect(done).toHaveBeenCalledWith('doc-id', true)
  })

  it('cancelling the download discards the transport operation', () => {
    let signal: AbortSignal | undefined
    const transport = useTransport((request) => {
      signal = request.signal
      return new Promise(() => undefined)
    })

    downloadFile(attachment, true, jest.fn())
    cancelDownloadFile('doc-id')

    expect(signal?.aborted).toBe(true)
    expect(transport.cancel).toHaveBeenCalledTimes(1)
    expect(transport.cancel).toHaveBeenCalledWith('download:doc-id')
  })
})
