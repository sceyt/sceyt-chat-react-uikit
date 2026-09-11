import {
  cancelMediaDownload,
  getMediaDownloadSnapshot,
  requestMediaDownload,
  resetMediaDownloadCoordinatorForTests,
  subscribeToMediaDownload
} from './mediaDownloadCoordinator'
import { setCustomUploader } from './customUploader'
import { getAttachmentUrlFromCache, setAttachmentToCache } from './attachmentsCache'

jest.mock('./attachmentsCache', () => ({
  getAttachmentUrlFromCache: jest.fn().mockResolvedValue(false),
  getAttachmentURLWithVersion: (key: string) => `${key}_v1`,
  setAttachmentToCache: jest.fn().mockResolvedValue(undefined)
}))

jest.mock('./attachmentBlobUrls', () => ({
  registerBlobUrl: jest.fn()
}))

jest.mock('./videoConversion', () => ({
  ensurePlayableVideoBlob: async (blob: Blob) => blob
}))

describe('mediaDownloadCoordinator', () => {
  const originalCreateObjectURL = URL.createObjectURL
  const originalFetch = global.fetch
  const mockGetAttachmentUrlFromCache = getAttachmentUrlFromCache as jest.Mock

  const flushCoordinator = async () => {
    // Starting a transfer includes the asynchronous Cache Storage lookup.
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockGetAttachmentUrlFromCache.mockResolvedValue(false)
    resetMediaDownloadCoordinatorForTests()
    setCustomUploader(undefined)
    URL.createObjectURL = jest.fn(() => 'blob:shared-media')
  })

  afterEach(() => {
    global.fetch = originalFetch
    URL.createObjectURL = originalCreateObjectURL
  })

  it('joins identical requests, shares progress, and writes every requested cache alias', async () => {
    let resolveDownload: ((value: any) => void) | undefined
    const reportProgress = jest.fn()
    const download = jest.fn((_url, _download, progress) => {
      reportProgress.mockImplementation(progress)
      return new Promise((resolve) => {
        resolveDownload = resolve
      })
    })
    setCustomUploader({ download, cancelRequest: jest.fn(), upload: jest.fn() } as any)

    const first = requestMediaDownload({
      key: 'original-video:https://cdn/video.mp4',
      url: 'https://cdn/video.mp4',
      cacheKey: 'https://cdn/video.mp4_original_video_url',
      kind: 'original-video'
    })
    const second = requestMediaDownload({
      key: 'original-video:https://cdn/video.mp4',
      url: 'https://cdn/video.mp4',
      cacheKey: 'https://cdn/video.mp4',
      kind: 'original-video'
    })

    await flushCoordinator()
    expect(download).toHaveBeenCalledTimes(1)
    reportProgress({ loaded: 25, total: 100 })
    expect(getMediaDownloadSnapshot('original-video:https://cdn/video.mp4')).toMatchObject({
      state: 'loading',
      progress: 25
    })

    resolveDownload!({ Body: new Blob(['video'], { type: 'video/mp4' }) })
    await expect(first).resolves.toMatchObject({ objectUrl: 'blob:shared-media' })
    await expect(second).resolves.toMatchObject({ objectUrl: 'blob:shared-media' })

    expect(setAttachmentToCache).toHaveBeenCalledTimes(2)
    expect(getMediaDownloadSnapshot('original-video:https://cdn/video.mp4')).toMatchObject({
      state: 'completed',
      progress: 100
    })
  })

  it('asks a custom downloader for a Blob by default', async () => {
    const download = jest.fn().mockResolvedValue({ Body: new Blob(['image'], { type: 'image/jpeg' }) })
    setCustomUploader({ download, cancelRequest: jest.fn(), upload: jest.fn() } as any)

    await requestMediaDownload({
      key: 'original-image:https://cdn/image.jpg',
      url: 'https://cdn/image.jpg',
      cacheKey: 'https://cdn/image.jpg',
      kind: 'original-image'
    })

    expect(download).toHaveBeenCalledWith('https://cdn/image.jpg', true, expect.any(Function), undefined)
  })

  it('reuses a completed browser-cache blob without invoking the downloader', async () => {
    const download = jest.fn()
    setCustomUploader({ download, cancelRequest: jest.fn(), upload: jest.fn() } as any)
    mockGetAttachmentUrlFromCache.mockResolvedValue('blob:cached-video')
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['cached-video'], { type: 'video/mp4' })
    }) as any

    await expect(
      requestMediaDownload({
        key: 'original-video:https://cdn/cached.mp4',
        url: 'https://cdn/cached.mp4',
        cacheKey: 'https://cdn/cached.mp4_original_video_url',
        kind: 'original-video',
        size: 100
      })
    ).resolves.toMatchObject({ objectUrl: 'blob:cached-video' })

    expect(mockGetAttachmentUrlFromCache).toHaveBeenCalledWith('https://cdn/cached.mp4_original_video_url')
    expect(global.fetch).toHaveBeenCalledWith('blob:cached-video')
    expect(download).not.toHaveBeenCalled()
  })

  it.each([
    ['original-image', 'original-image:https://cdn/image.jpg'],
    ['original-video', 'original-video:https://cdn/video.mp4'],
    ['video-thumbnail', 'video-thumbnail:https://cdn/video-thumb.jpg'],
    ['voice', 'voice:https://cdn/voice.ogg'],
    ['file', 'file:https://cdn/file.pdf']
  ] as const)('reuses a cached %s without invoking a downloader', async (kind, key) => {
    const url = key.slice(key.indexOf(':') + 1)
    const cacheKey = `${url}_${kind}`
    const download = jest.fn()
    setCustomUploader({ download, cancelRequest: jest.fn(), upload: jest.fn() } as any)
    mockGetAttachmentUrlFromCache.mockResolvedValue('blob:cached-media')
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['cached-media'])
    }) as any

    await expect(requestMediaDownload({ key, url, cacheKey, kind })).resolves.toMatchObject({
      objectUrl: 'blob:cached-media'
    })

    expect(mockGetAttachmentUrlFromCache).toHaveBeenCalledWith(cacheKey)
    expect(download).not.toHaveBeenCalled()
  })

  it('keeps an explicit cancellation when it happens during the cache lookup', async () => {
    let resolveCacheLookup: ((value: string | false) => void) | undefined
    mockGetAttachmentUrlFromCache.mockImplementation(
      () =>
        new Promise<string | false>((resolve) => {
          resolveCacheLookup = resolve
        })
    )
    const download = jest.fn()
    setCustomUploader({ download, cancelRequest: jest.fn(), upload: jest.fn() } as any)
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['cached-video'], { type: 'video/mp4' })
    }) as any

    const request = requestMediaDownload({
      key: 'original-video:https://cdn/cached.mp4',
      url: 'https://cdn/cached.mp4',
      cacheKey: 'https://cdn/cached.mp4_original_video_url',
      kind: 'original-video'
    })
    await flushCoordinator()
    cancelMediaDownload('original-video:https://cdn/cached.mp4')
    resolveCacheLookup!('blob:cached-video')

    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
    expect(download).not.toHaveBeenCalled()
    expect(getMediaDownloadSnapshot('original-video:https://cdn/cached.mp4')).toMatchObject({ state: 'cancelled' })
  })

  it('keeps preview and original video downloads as separate jobs', async () => {
    const download = jest.fn(() => Promise.resolve({ Body: new Blob(['media']) }))
    setCustomUploader({ download, cancelRequest: jest.fn(), upload: jest.fn() } as any)

    const downloads = Promise.all([
      requestMediaDownload({
        key: 'video-thumbnail:https://cdn/thumb.jpg',
        url: 'https://cdn/thumb.jpg',
        cacheKey: 'https://cdn/thumb.jpg',
        kind: 'video-thumbnail'
      }),
      requestMediaDownload({
        key: 'original-video:https://cdn/video.mp4',
        url: 'https://cdn/video.mp4',
        cacheKey: 'https://cdn/video.mp4_original_video_url',
        kind: 'original-video'
      })
    ])

    await downloads

    expect(download).toHaveBeenCalledTimes(2)
  })

  it('normalizes a URL returned by the custom downloader into the shared blob result', async () => {
    setCustomUploader({
      download: jest.fn(() => Promise.resolve('https://local/downloaded-video.mp4')),
      cancelRequest: jest.fn(),
      upload: jest.fn()
    } as any)
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: undefined,
      headers: { get: () => 'video/mp4' },
      blob: async () => new Blob(['video'], { type: 'video/mp4' })
    }) as any

    await expect(
      requestMediaDownload({
        key: 'original-video:https://cdn/video.mp4',
        url: 'https://cdn/video.mp4',
        cacheKey: 'https://cdn/video.mp4_original_video_url',
        kind: 'original-video'
      })
    ).resolves.toMatchObject({ objectUrl: 'blob:shared-media' })

    expect(global.fetch).toHaveBeenCalledWith(
      'https://local/downloaded-video.mp4',
      expect.objectContaining({ signal: expect.anything() })
    )
  })

  it("does not expose a custom downloader's synthetic 1 B / 1 B URL-resolution progress", async () => {
    let resolveDownload: ((value: string) => void) | undefined
    const download = jest.fn((_url, _download, progress) => {
      progress({ loaded: 1, total: 1 })
      return new Promise<string>((resolve) => {
        resolveDownload = resolve
      })
    })
    setCustomUploader({ download, cancelRequest: jest.fn(), upload: jest.fn() } as any)
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      body: undefined,
      headers: { get: () => 'video/mp4' },
      blob: async () => new Blob(['video'], { type: 'video/mp4' })
    }) as any

    const request = requestMediaDownload({
      key: 'original-video:https://cdn/video.mp4',
      url: 'https://cdn/video.mp4',
      cacheKey: 'https://cdn/video.mp4_original_video_url',
      kind: 'original-video',
      size: 100
    })
    await flushCoordinator()

    expect(getMediaDownloadSnapshot('original-video:https://cdn/video.mp4')).toMatchObject({
      loaded: 0,
      total: 100,
      progress: 0
    })

    resolveDownload!('https://local/downloaded-video.mp4')
    await request
  })

  it('uses the attachment size when a custom downloader reports a smaller intermediate total', async () => {
    let resolveDownload: ((value: any) => void) | undefined
    const download = jest.fn((_url, _download, progress) => {
      progress({ loaded: 5_000_000, total: 10_400_000 })
      return new Promise((resolve) => {
        resolveDownload = resolve
      })
    })
    setCustomUploader({ download, cancelRequest: jest.fn(), upload: jest.fn() } as any)

    const request = requestMediaDownload({
      key: 'original-video:906070149054857222',
      url: '906070149054857222',
      cacheKey: '906070149054857222_original_video_url',
      kind: 'original-video',
      size: 99_306_732
    })
    await flushCoordinator()

    const snapshot = getMediaDownloadSnapshot('original-video:906070149054857222')
    expect(snapshot.loaded).toBe(5_000_000)
    expect(snapshot.total).toBe(99_306_732)
    expect(snapshot.progress).toBeCloseTo((5_000_000 / 99_306_732) * 100)

    resolveDownload!({ Body: new Blob(['video'], { type: 'video/mp4' }) })
    await request
  })

  it('cancels a shared native request once for every subscriber', async () => {
    global.fetch = jest.fn(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            const error = new Error('cancelled')
            error.name = 'AbortError'
            reject(error)
          })
        })
    ) as any

    const first = requestMediaDownload({
      key: 'voice:https://cdn/voice.ogg',
      url: 'https://cdn/voice.ogg',
      cacheKey: 'https://cdn/voice.ogg',
      kind: 'voice'
    })
    const second = requestMediaDownload({
      key: 'voice:https://cdn/voice.ogg',
      url: 'https://cdn/voice.ogg',
      cacheKey: 'https://cdn/voice.ogg',
      kind: 'voice'
    })

    await flushCoordinator()
    cancelMediaDownload('voice:https://cdn/voice.ogg')
    await expect(first).rejects.toMatchObject({ name: 'AbortError' })
    await expect(second).rejects.toMatchObject({ name: 'AbortError' })
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(getMediaDownloadSnapshot('voice:https://cdn/voice.ogg')).toMatchObject({ state: 'cancelled' })
  })

  it('delegates an explicit shared cancellation to the custom downloader once', async () => {
    let rejectDownload: ((error: Error) => void) | undefined
    const pendingRequest = new Promise((_resolve, reject) => {
      rejectDownload = reject
    })
    const cancelRequest = jest.fn(() => {
      const error = new Error('cancelled')
      error.name = 'AbortError'
      rejectDownload!(error)
    })
    setCustomUploader({ download: jest.fn(() => pendingRequest), cancelRequest, upload: jest.fn() } as any)

    const download = requestMediaDownload({
      key: 'file:https://cdn/file.pdf',
      url: 'https://cdn/file.pdf',
      cacheKey: 'https://cdn/file.pdf',
      kind: 'file'
    })
    await flushCoordinator()

    cancelMediaDownload('file:https://cdn/file.pdf')
    await expect(download).rejects.toMatchObject({ name: 'AbortError' })
    expect(cancelRequest).toHaveBeenCalledWith(pendingRequest)
  })

  it('cancels before a downloader starts', async () => {
    const download = jest.fn()
    setCustomUploader({ download, cancelRequest: jest.fn(), upload: jest.fn() } as any)

    const request = requestMediaDownload({
      key: 'file:https://cdn/file.pdf',
      url: 'https://cdn/file.pdf',
      cacheKey: 'https://cdn/file.pdf',
      kind: 'file'
    })
    cancelMediaDownload('file:https://cdn/file.pdf')

    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
    expect(download).not.toHaveBeenCalled()
  })

  it('falls back to downloading after a cache read failure and retries after a failed transfer', async () => {
    mockGetAttachmentUrlFromCache.mockRejectedValue(new Error('Cache unavailable'))
    const download = jest
      .fn()
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce({ Body: new Blob(['file']) })
    setCustomUploader({ download, cancelRequest: jest.fn(), upload: jest.fn() } as any)

    const request = {
      key: 'file:https://cdn/file.pdf',
      url: 'https://cdn/file.pdf',
      cacheKey: 'https://cdn/file.pdf',
      kind: 'file' as const
    }
    await expect(requestMediaDownload(request)).rejects.toThrow('Network unavailable')
    expect(getMediaDownloadSnapshot(request.key)).toMatchObject({ state: 'failed' })

    await expect(requestMediaDownload(request)).resolves.toMatchObject({ objectUrl: 'blob:shared-media' })
    expect(download).toHaveBeenCalledTimes(2)
    expect(getMediaDownloadSnapshot(request.key)).toMatchObject({ state: 'completed' })
  })

  it('continues an active transfer after its last subscriber unsubscribes', async () => {
    let resolveDownload: ((value: any) => void) | undefined
    const download = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveDownload = resolve
        })
    )
    setCustomUploader({ download, cancelRequest: jest.fn(), upload: jest.fn() } as any)
    const key = 'original-video:https://cdn/video.mp4'
    const unsubscribe = subscribeToMediaDownload(key, jest.fn())
    const request = requestMediaDownload({
      key,
      url: 'https://cdn/video.mp4',
      cacheKey: 'https://cdn/video.mp4_original_video_url',
      kind: 'original-video'
    })
    await flushCoordinator()
    unsubscribe()
    resolveDownload!({ Body: new Blob(['video']) })

    await expect(request).resolves.toMatchObject({ objectUrl: 'blob:shared-media' })
    expect(getMediaDownloadSnapshot(key)).toMatchObject({ state: 'completed' })
  })
})
