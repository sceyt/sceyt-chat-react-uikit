import {
  compressAndCacheImage,
  getVideoFirstFrame,
  getVideoPreviewFrame,
  readResponseBlobWithProgress,
  scaleForDevicePixelRatio,
  VIDEO_PREVIEW_JPEG_QUALITY,
  VIDEO_PREVIEW_MAX_BYTES
} from './getVideoFrame'
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

describe('readResponseBlobWithProgress', () => {
  it('reports incremental byte progress for streamed default downloads', async () => {
    const read = jest
      .fn()
      .mockResolvedValueOnce({ done: false, value: new Uint8Array([1, 2]) })
      .mockResolvedValueOnce({ done: false, value: new Uint8Array([3, 4]) })
      .mockResolvedValueOnce({ done: true })
    const onProgress = jest.fn()
    const response = {
      headers: { get: jest.fn((name: string) => (name === 'content-length' ? '4' : 'image/jpeg')) },
      body: { getReader: () => ({ read }) }
    } as any

    const blob = await readResponseBlobWithProgress(response, onProgress, 100)

    expect(blob.size).toBe(4)
    expect(onProgress).toHaveBeenNthCalledWith(1, { loaded: 2, total: 4 })
    expect(onProgress).toHaveBeenNthCalledWith(2, { loaded: 4, total: 4 })
  })
})

describe('scaleForDevicePixelRatio', () => {
  afterEach(() => {
    setDevicePixelRatio(1)
  })

  it('scales the value up by devicePixelRatio', () => {
    setDevicePixelRatio(2)
    expect(scaleForDevicePixelRatio(400)).toBe(800)
  })

  it('caps the scaling at the given cap on higher-density screens', () => {
    setDevicePixelRatio(3)
    expect(scaleForDevicePixelRatio(400)).toBe(800)
    expect(scaleForDevicePixelRatio(400, 3)).toBe(1200)
  })

  it('defaults to a 1x scale when devicePixelRatio is unavailable', () => {
    setDevicePixelRatio(undefined)
    expect(scaleForDevicePixelRatio(400)).toBe(400)
  })

  it('passes falsy values through unchanged instead of scaling them', () => {
    setDevicePixelRatio(2)
    expect(scaleForDevicePixelRatio(undefined)).toBeUndefined()
    expect(scaleForDevicePixelRatio(0)).toBe(0)
  })
})

describe('getVideoFirstFrame', () => {
  let fakeVideo: any
  let capturedCanvases: HTMLCanvasElement[]
  let realCreateElement: typeof document.createElement
  let toBlobSpy: jest.SpyInstance

  const waitUntil = async (predicate: () => boolean, maxTicks = 50) => {
    for (let i = 0; i < maxTicks; i++) {
      if (predicate()) {
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
    throw new Error('condition not met in time')
  }

  // Drives the fake video's play()-rejection fallback (simplest capture path)
  // to a queued requestAnimationFrame, then flushes it. Loops because the
  // play() rejection resolves on a microtask whose timing isn't guaranteed
  // relative to this call.
  const waitForCapturedFrame = async () => {
    for (let i = 0; i < 40; i++) {
      if (capturedCanvases.length > 0) {
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 0))
      ;(window as any).__flushAnimationFrames()
    }
    throw new Error('frame was not captured in time')
  }

  beforeEach(() => {
    setDevicePixelRatio(1)
    global.URL.createObjectURL = jest.fn(() => 'blob:mock/video')
    global.URL.revokeObjectURL = jest.fn()

    capturedCanvases = []
    fakeVideo = {
      style: {},
      videoWidth: 1920,
      videoHeight: 1080,
      duration: 12,
      setAttribute: jest.fn(),
      // Rejecting play() drives the code down its simplest capture path
      // (autoplay-blocked fallback) instead of needing to simulate 'timeupdate'.
      play: jest.fn(() => Promise.reject(new Error('autoplay blocked'))),
      pause: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    }

    realCreateElement = document.createElement.bind(document)
    jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'video') {
        return fakeVideo
      }
      const el = realCreateElement(tagName)
      if (tagName === 'canvas') {
        capturedCanvases.push(el as HTMLCanvasElement)
      }
      return el
    })
    jest.spyOn(document.body, 'appendChild').mockImplementation((node: any) => {
      node.parentNode = { removeChild: jest.fn() }
      return node
    })

    // jsdom's canvas has no real 2D context; fake a successful draw + encode
    // so the code takes its success path instead of falling through to the
    // (harder to simulate) data-URL retry.
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({ drawImage: jest.fn() }) as any)
    toBlobSpy = jest.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      callback: BlobCallback
    ) {
      callback(new Blob(['frame'], { type: 'image/jpeg' }))
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('scales the captured frame size by devicePixelRatio for a Blob source', async () => {
    setDevicePixelRatio(2)
    const videoBlob = new Blob(['fake-video-bytes'], { type: 'video/mp4' })

    const framePromise = getVideoFirstFrame(videoBlob, 400, 300)

    await waitUntil(() => typeof fakeVideo.onloadedmetadata === 'function')
    fakeVideo.onloadedmetadata()

    await waitUntil(() => typeof fakeVideo.onseeked === 'function')
    fakeVideo.onseeked()

    await waitForCapturedFrame()

    const result = await framePromise

    expect(result).not.toBeNull()
    expect(capturedCanvases).toHaveLength(1)
    expect(capturedCanvases[0].width).toBe(800)
    expect(capturedCanvases[0].height).toBe(600)
  })

  it('does not scale the frame size when no maxWidth/maxHeight is requested', async () => {
    setDevicePixelRatio(2)
    const videoBlob = new Blob(['fake-video-bytes'], { type: 'video/mp4' })

    const framePromise = getVideoFirstFrame(videoBlob)

    await waitUntil(() => typeof fakeVideo.onloadedmetadata === 'function')
    fakeVideo.onloadedmetadata()

    await waitUntil(() => typeof fakeVideo.onseeked === 'function')
    fakeVideo.onseeked()

    await waitForCapturedFrame()

    await framePromise

    // Falls back to half the native video resolution, unrelated to DPR.
    expect(capturedCanvases[0].width).toBe(960)
    expect(capturedCanvases[0].height).toBe(540)
  })

  it('creates a compact, aspect-ratio-preserving JPEG for video_thumb independent of devicePixelRatio', async () => {
    setDevicePixelRatio(2)
    const videoBlob = new Blob(['fake-video-bytes'], { type: 'video/mp4' })

    const framePromise = getVideoPreviewFrame(videoBlob)

    await waitUntil(() => typeof fakeVideo.onloadedmetadata === 'function')
    fakeVideo.onloadedmetadata()
    await waitUntil(() => typeof fakeVideo.onseeked === 'function')
    fakeVideo.onseeked()
    await waitForCapturedFrame()

    await framePromise

    expect(capturedCanvases[0].width).toBe(1280)
    expect(capturedCanvases[0].height).toBe(720)
    expect(toBlobSpy).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', VIDEO_PREVIEW_JPEG_QUALITY)
  })

  it('re-encodes an oversized video preview at lower quality and smaller dimensions', async () => {
    let encodeAttempt = 0
    toBlobSpy.mockImplementation(function (this: HTMLCanvasElement, callback: BlobCallback) {
      encodeAttempt += 1
      callback(
        new Blob([new Uint8Array(encodeAttempt < 5 ? VIDEO_PREVIEW_MAX_BYTES + 1 : VIDEO_PREVIEW_MAX_BYTES - 1)], {
          type: 'image/jpeg'
        })
      )
    })
    const videoBlob = new Blob(['fake-video-bytes'], { type: 'video/mp4' })

    const framePromise = getVideoPreviewFrame(videoBlob)

    await waitUntil(() => typeof fakeVideo.onloadedmetadata === 'function')
    fakeVideo.onloadedmetadata()
    await waitUntil(() => typeof fakeVideo.onseeked === 'function')
    fakeVideo.onseeked()
    await waitForCapturedFrame()

    const result = await framePromise

    expect(result?.blob.size).toBeLessThanOrEqual(VIDEO_PREVIEW_MAX_BYTES)
    expect(capturedCanvases).toHaveLength(2)
    expect(capturedCanvases[1].width).toBe(960)
    expect(capturedCanvases[1].height).toBe(540)
    expect(toBlobSpy).toHaveBeenCalledTimes(5)
  })
})
