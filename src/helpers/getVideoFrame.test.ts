import { compressAndCacheImage } from './getVideoFrame'
import { resizeImageWithPica } from './resizeImage'
import { setAttachmentToCache } from './attachmentsCache'

jest.mock('./resizeImage', () => ({
  resizeImageWithPica: jest.fn()
}))

jest.mock('./attachmentsCache', () => ({
  setAttachmentToCache: jest.fn()
}))

jest.mock('loglevel', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() }
}))

const mockResizeImageWithPica = resizeImageWithPica as jest.Mock
const mockSetAttachmentToCache = setAttachmentToCache as jest.Mock

const setDevicePixelRatio = (value: number | undefined) => {
  Object.defineProperty(window, 'devicePixelRatio', {
    configurable: true,
    writable: true,
    value
  })
}

describe('compressAndCacheImage', () => {
  let createdUrls: number

  beforeEach(() => {
    createdUrls = 0
    global.URL.createObjectURL = jest.fn(() => `blob:mock/${++createdUrls}`)
    global.URL.revokeObjectURL = jest.fn()
    setDevicePixelRatio(1)
    mockResizeImageWithPica.mockReset()
    mockSetAttachmentToCache.mockReset()
  })

  it('scales the requested dimensions by devicePixelRatio', async () => {
    setDevicePixelRatio(2)
    const imageBlob = new Blob(['data'], { type: 'image/jpeg' })
    global.fetch = jest.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(imageBlob) })
    const compressedBlob = new Blob(['compressed'], { type: 'image/webp' })
    mockResizeImageWithPica.mockResolvedValue({ blob: compressedBlob })

    await compressAndCacheImage('https://example.com/image.jpg', 'cache-key', 400, 300)

    expect(mockResizeImageWithPica).toHaveBeenCalledWith(expect.any(File), 800, 600, 1)
  })

  it('caps the devicePixelRatio scaling at 2x on higher-density screens', async () => {
    setDevicePixelRatio(3)
    const imageBlob = new Blob(['data'], { type: 'image/jpeg' })
    global.fetch = jest.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(imageBlob) })
    mockResizeImageWithPica.mockResolvedValue({ blob: new Blob(['compressed'], { type: 'image/webp' }) })

    await compressAndCacheImage('https://example.com/image.jpg', 'cache-key', 400, 300)

    expect(mockResizeImageWithPica).toHaveBeenCalledWith(expect.any(File), 800, 600, 1)
  })

  it('falls back to a 1x scale when devicePixelRatio is unavailable', async () => {
    setDevicePixelRatio(undefined)
    const imageBlob = new Blob(['data'], { type: 'image/jpeg' })
    global.fetch = jest.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(imageBlob) })
    mockResizeImageWithPica.mockResolvedValue({ blob: new Blob(['compressed'], { type: 'image/webp' }) })

    await compressAndCacheImage('https://example.com/image.jpg', 'cache-key', 400, 300)

    expect(mockResizeImageWithPica).toHaveBeenCalledWith(expect.any(File), 400, 300, 1)
  })

  it('applies devicePixelRatio scaling to the default dimensions too', async () => {
    setDevicePixelRatio(2)
    const imageBlob = new Blob(['data'], { type: 'image/jpeg' })
    global.fetch = jest.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(imageBlob) })
    mockResizeImageWithPica.mockResolvedValue({ blob: new Blob(['compressed'], { type: 'image/webp' }) })

    await compressAndCacheImage('https://example.com/image.jpg', 'cache-key')

    expect(mockResizeImageWithPica).toHaveBeenCalledWith(expect.any(File), 2560, 2160, 1)
  })

  it('passes through an explicit quality instead of the max-quality default', async () => {
    setDevicePixelRatio(1)
    const imageBlob = new Blob(['data'], { type: 'image/jpeg' })
    global.fetch = jest.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(imageBlob) })
    mockResizeImageWithPica.mockResolvedValue({ blob: new Blob(['compressed'], { type: 'image/webp' }) })

    await compressAndCacheImage('https://example.com/image.jpg', 'cache-key', 400, 300, 0.5)

    expect(mockResizeImageWithPica).toHaveBeenCalledWith(expect.any(File), 400, 300, 0.5)
  })

  it('caches the compressed blob and returns an object URL for it', async () => {
    const imageBlob = new Blob(['data'], { type: 'image/jpeg' })
    global.fetch = jest.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(imageBlob) })
    const compressedBlob = new Blob(['compressed'], { type: 'image/webp' })
    mockResizeImageWithPica.mockResolvedValue({ blob: compressedBlob })

    const result = await compressAndCacheImage('https://example.com/image.jpg', 'cache-key', 400, 300)

    expect(result).toBe('blob:mock/1')
    expect(mockSetAttachmentToCache).toHaveBeenCalledTimes(1)
    expect(mockSetAttachmentToCache.mock.calls[0][0]).toBe('cache-key')
  })

  it('skips resizing and caches the original response for non-image blobs', async () => {
    const fileBlob = new Blob(['data'], { type: 'application/pdf' })
    const originalResponse = { ok: true, blob: () => Promise.resolve(fileBlob) }
    global.fetch = jest.fn().mockResolvedValue(originalResponse)

    const result = await compressAndCacheImage('https://example.com/file.pdf', 'cache-key')

    expect(mockResizeImageWithPica).not.toHaveBeenCalled()
    expect(mockSetAttachmentToCache).toHaveBeenCalledWith('cache-key', originalResponse)
    expect(result).toBe('')
  })

  it('falls back to caching the original response when compression yields no blob', async () => {
    const imageBlob = new Blob(['data'], { type: 'image/jpeg' })
    const originalResponse = { ok: true, blob: () => Promise.resolve(imageBlob) }
    global.fetch = jest.fn().mockResolvedValue(originalResponse)
    mockResizeImageWithPica.mockResolvedValue({ blob: null })

    const result = await compressAndCacheImage('https://example.com/image.jpg', 'cache-key')

    expect(mockSetAttachmentToCache).toHaveBeenCalledWith('cache-key', originalResponse)
    expect(result).toBe('')
  })

  it('returns an empty string without caching when the fetch response is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false })

    const result = await compressAndCacheImage('https://example.com/image.jpg', 'cache-key')

    expect(result).toBe('')
    expect(mockSetAttachmentToCache).not.toHaveBeenCalled()
  })

  it('returns an empty string when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network error'))

    const result = await compressAndCacheImage('https://example.com/image.jpg', 'cache-key')

    expect(result).toBe('')
    expect(mockSetAttachmentToCache).not.toHaveBeenCalled()
  })
})
