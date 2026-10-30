import FileSaver from 'file-saver'
import { cancelDownloadFile, downloadFile } from './index'
import { setCustomUploader } from './customUploader'
import { fakeEncrypted, installFakeFilesClient, readBlobText } from '../testUtils/fakeAttachmentFiles'

jest.mock('file-saver', () => ({
  __esModule: true,
  default: { saveAs: jest.fn() }
}))

const mockSaveAs = FileSaver.saveAs as jest.Mock

describe('downloadFile default downloader', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setCustomUploader(undefined)
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

describe('downloadFile custom downloader', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    setCustomUploader(undefined)
  })

  it('passes the message id of the attachment to a custom downloader', async () => {
    const download = jest.fn().mockResolvedValue({ Body: new Blob(['file']) })
    setCustomUploader({ download, cancelRequest: jest.fn(), upload: jest.fn() } as any)

    await downloadFile(
      { id: 'file-id', messageId: '9223372036854775807', url: 'https://cdn/file.pdf', name: 'file.pdf' } as any,
      true,
      undefined,
      undefined,
      'text'
    )

    expect(download).toHaveBeenCalledWith(
      'https://cdn/file.pdf',
      true,
      expect.any(Function),
      'text',
      '9223372036854775807'
    )
    expect(mockSaveAs).toHaveBeenCalledWith(expect.any(Blob), 'file.pdf')
  })
})

describe('downloadFile for an encrypted attachment', () => {
  const attachment = {
    id: 'doc-id',
    url: 'https://cdn/doc',
    name: 'report.pdf',
    metadata: JSON.stringify({ enc: { v: 1, k: 'key-5' } })
  } as any

  beforeEach(() => {
    jest.clearAllMocks()
    installFakeFilesClient()
  })

  afterEach(() => setCustomUploader(undefined))

  it('saves the decrypted file from the custom downloader', async () => {
    setCustomUploader({
      upload: jest.fn(),
      download: async () => ({ Body: fakeEncrypted('key-5', 'pdf-bytes', 'https://cdn/doc') }),
      cancelRequest: jest.fn()
    })
    const done = jest.fn()

    await downloadFile(attachment, true, done)

    const [saved, name] = mockSaveAs.mock.calls[0]
    expect(name).toBe('report.pdf')
    expect(saved.type).toBe('application/pdf')
    expect(await readBlobText(saved)).toBe('pdf-bytes')
    expect(done).toHaveBeenCalledWith('doc-id')
  })

  it('saves the decrypted file from the default downloader', async () => {
    setCustomUploader(undefined)
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, blob: async () => fakeEncrypted('key-5', 'pdf-bytes', 'https://cdn/doc') })

    await downloadFile(attachment, true, jest.fn())

    expect(await readBlobText(mockSaveAs.mock.calls[0][0])).toBe('pdf-bytes')
  })

  it('saves nothing when the file does not decrypt', async () => {
    setCustomUploader({
      upload: jest.fn(),
      download: async () => ({ Body: fakeEncrypted('another-key', 'pdf-bytes', 'https://cdn/doc') }),
      cancelRequest: jest.fn()
    })
    const done = jest.fn()

    await downloadFile(attachment, true, done)

    expect(mockSaveAs).not.toHaveBeenCalled()
    expect(done).toHaveBeenCalledWith('doc-id', true)
  })

  it('cancelling the download cancels the uploader own request', () => {
    const request = new Promise(() => undefined)
    const cancelRequest = jest.fn()
    setCustomUploader({ upload: jest.fn(), download: () => request, cancelRequest })

    downloadFile(attachment, true, jest.fn())
    cancelDownloadFile('doc-id')

    // The same promise object: toHaveBeenCalledWith finds any two promises equal.
    expect(cancelRequest.mock.calls[0][0] === request).toBe(true)
  })
})
