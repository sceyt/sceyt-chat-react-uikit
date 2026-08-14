import { getAttachmentUrlFromCache, setAttachmentToCache } from './attachmentsCache'
import { registerBlobUrl } from './attachmentBlobUrls'
import { downloadVideoThumb } from './videoPreview'

jest.mock('./attachmentsCache', () => ({
  getAttachmentUrlFromCache: jest.fn(),
  getAttachmentURLWithVersion: (url: string) => `${url}_1_0_2`,
  setAttachmentToCache: jest.fn()
}))
jest.mock('./attachmentBlobUrls', () => ({ registerBlobUrl: jest.fn() }))

const mockGetAttachmentUrlFromCache = getAttachmentUrlFromCache as jest.Mock
const mockSetAttachmentToCache = setAttachmentToCache as jest.Mock
const mockRegisterBlobUrl = registerBlobUrl as jest.Mock

describe('downloadVideoThumb', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    mockGetAttachmentUrlFromCache.mockResolvedValueOnce(false).mockResolvedValueOnce('blob:preview')
  })

  it('uses the custom attachment downloader and caches its preview blob', async () => {
    const preview = new Blob(['preview'], { type: 'image/jpeg' })
    const downloader = jest.fn().mockResolvedValue({ Body: preview })

    await expect(downloadVideoThumb('https://cdn/preview.jpg', downloader, 'text')).resolves.toBe('blob:preview')

    expect(downloader).toHaveBeenCalledWith('https://cdn/preview.jpg', true, expect.any(Function), 'text')
    expect(mockSetAttachmentToCache).toHaveBeenCalledWith('https://cdn/preview.jpg', expect.any(Response))
  })

  it('accepts a raw Blob returned by a custom downloader', async () => {
    const preview = new Blob(['preview'], { type: 'image/jpeg' })
    const downloader = jest.fn().mockResolvedValue(preview)

    await expect(downloadVideoThumb('https://cdn/preview.jpg', downloader)).resolves.toBe('blob:preview')

    expect(mockSetAttachmentToCache).toHaveBeenCalledWith('https://cdn/preview.jpg', expect.any(Response))
  })

  it('uses a normal attachment fetch when no custom downloader is configured', async () => {
    const preview = new Blob(['preview'], { type: 'image/jpeg' })
    const fetchMock = jest
      .spyOn(global, 'fetch' as any)
      .mockResolvedValue({ ok: true, blob: async () => preview } as any)

    await expect(downloadVideoThumb('https://cdn/preview.jpg')).resolves.toBe('blob:preview')

    expect(fetchMock).toHaveBeenCalledWith('https://cdn/preview.jpg')
    fetchMock.mockRestore()
  })

  it('does not cache an inaccessible default thumbnail URL', async () => {
    const fetchMock = jest.spyOn(global, 'fetch' as any).mockResolvedValue({ ok: false, status: 403 } as any)

    await expect(downloadVideoThumb('https://cdn/denied.jpg')).rejects.toThrow('Unable to download video preview (403)')

    expect(mockSetAttachmentToCache).not.toHaveBeenCalled()
    fetchMock.mockRestore()
  })

  it('does not fall back to a direct request when the configured attachment downloader fails', async () => {
    const fetchMock = jest.spyOn(global, 'fetch' as any)
    const downloader = jest.fn().mockRejectedValue(new Error('preview download failed'))

    await expect(downloadVideoThumb('https://cdn/preview.jpg', downloader)).rejects.toThrow('preview download failed')

    expect(fetchMock).not.toHaveBeenCalled()
    fetchMock.mockRestore()
  })

  it('returns a cached preview without downloading it again', async () => {
    mockGetAttachmentUrlFromCache.mockReset().mockResolvedValue('blob:cached-preview')
    const downloader = jest.fn()

    await expect(downloadVideoThumb('https://cdn/preview.jpg', downloader)).resolves.toBe('blob:cached-preview')

    expect(downloader).not.toHaveBeenCalled()
    expect(mockSetAttachmentToCache).not.toHaveBeenCalled()
  })

  it('keeps a locally created object URL registered when Cache Storage is unavailable', async () => {
    mockGetAttachmentUrlFromCache.mockReset().mockResolvedValue(false)
    const originalCreateObjectURL = URL.createObjectURL
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: jest.fn().mockReturnValue('blob:local-preview')
    })
    const downloader = jest.fn().mockResolvedValue({ Body: new Blob(['preview']) })

    await expect(downloadVideoThumb('https://cdn/preview.jpg', downloader)).resolves.toBe('blob:local-preview')

    expect(mockRegisterBlobUrl).toHaveBeenCalledWith('https://cdn/preview.jpg_1_0_2', 'blob:local-preview')
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectURL })
  })

  it('still returns a local thumbnail when Cache Storage rejects the downloaded preview', async () => {
    mockGetAttachmentUrlFromCache.mockReset().mockResolvedValue(false)
    mockSetAttachmentToCache.mockRejectedValue(new Error('cache unavailable'))
    const originalCreateObjectURL = URL.createObjectURL
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: jest.fn().mockReturnValue('blob:uncached-preview')
    })

    await expect(
      downloadVideoThumb('https://cdn/preview.jpg', jest.fn().mockResolvedValue({ Body: new Blob(['preview']) }))
    ).resolves.toBe('blob:uncached-preview')

    expect(mockRegisterBlobUrl).toHaveBeenCalledWith('https://cdn/preview.jpg_1_0_2', 'blob:uncached-preview')
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectURL })
  })
})
