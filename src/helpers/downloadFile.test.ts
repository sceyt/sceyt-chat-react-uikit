import FileSaver from 'file-saver'
import { downloadFile } from './index'
import { setCustomUploader } from './customUploader'

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
