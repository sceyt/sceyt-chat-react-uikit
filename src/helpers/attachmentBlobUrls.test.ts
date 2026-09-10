import {
  BLOB_URL_CACHE_MAX,
  ORIGINALS_CACHE_MAX,
  getOrCreateBlobUrl,
  getRegisteredBlobUrl,
  pinOriginalBlobUrl,
  registerBlobUrl,
  releaseAllBlobUrls,
  releaseAllOriginalBlobUrls,
  releaseBlobUrls,
  setBlobUrlEvictListener,
  unpinOriginalBlobUrl
} from './attachmentBlobUrls'

describe('attachmentBlobUrls registry', () => {
  let createdUrls: number
  let revokedUrls: string[]

  beforeEach(() => {
    jest.useFakeTimers()
    createdUrls = 0
    revokedUrls = []
    // jsdom does not implement object URLs
    global.URL.createObjectURL = jest.fn(() => `blob:mock/${++createdUrls}`)
    global.URL.revokeObjectURL = jest.fn((url: string) => {
      revokedUrls.push(url)
    })
    setBlobUrlEvictListener(null)
    releaseAllBlobUrls()
    jest.runAllTimers()
    revokedUrls = []
  })

  afterEach(() => {
    setBlobUrlEvictListener(null)
    releaseAllBlobUrls()
    jest.runAllTimers()
    jest.useRealTimers()
  })

  it('returns the same object URL for repeated getOrCreateBlobUrl calls on one key', async () => {
    const makeBlob = jest.fn(async () => new Blob(['data']))
    const first = await getOrCreateBlobUrl('key-1', makeBlob)
    const second = await getOrCreateBlobUrl('key-1', makeBlob)
    expect(first).toBe(second)
    expect(makeBlob).toHaveBeenCalledTimes(1)
    expect(getRegisteredBlobUrl('key-1')).toBe(first)
  })

  it('deduplicates concurrent getOrCreateBlobUrl calls', async () => {
    const makeBlob = jest.fn(async () => new Blob(['data']))
    const [first, second] = await Promise.all([
      getOrCreateBlobUrl('key-concurrent', makeBlob),
      getOrCreateBlobUrl('key-concurrent', makeBlob)
    ])
    expect(first).toBe(second)
    expect(makeBlob).toHaveBeenCalledTimes(1)
  })

  it('releases the previous URL when a key is overwritten with a new one', () => {
    registerBlobUrl('key-2', 'blob:mock/old')
    registerBlobUrl('key-2', 'blob:mock/new')
    expect(getRegisteredBlobUrl('key-2')).toBe('blob:mock/new')
    jest.runAllTimers()
    expect(revokedUrls).toContain('blob:mock/old')
    expect(revokedUrls).not.toContain('blob:mock/new')
  })

  it('does not revoke a URL that remains registered under an original-media key', () => {
    registerBlobUrl('image-key', 'blob:mock/shared-original')
    registerBlobUrl('image-key_original_image_url', 'blob:mock/shared-original')

    // Image compression replaces the display key with a compact blob while
    // the full-size original continues to be used by the media slider.
    registerBlobUrl('image-key', 'blob:mock/compressed')
    jest.runAllTimers()

    expect(revokedUrls).not.toContain('blob:mock/shared-original')
    expect(getRegisteredBlobUrl('image-key_original_image_url')).toBe('blob:mock/shared-original')
  })

  it('treats a repeated registration of the same URL as a no-op', () => {
    registerBlobUrl('file_original_video_url', 'blob:mock/original')
    registerBlobUrl('file_original_video_url', 'blob:mock/original')

    expect(getRegisteredBlobUrl('file_original_video_url')).toBe('blob:mock/original')
    jest.runAllTimers()
    expect(revokedUrls).toEqual([])
  })

  it('evicts the least recently used entry beyond the cap, revokes it and notifies', () => {
    const evicted: string[] = []
    setBlobUrlEvictListener((keys) => evicted.push(...keys))
    for (let i = 0; i <= BLOB_URL_CACHE_MAX; i++) {
      registerBlobUrl(`key-${i}`, `blob:mock/url-${i}`)
    }
    expect(evicted).toEqual(['key-0'])
    expect(getRegisteredBlobUrl('key-0')).toBeUndefined()
    expect(getRegisteredBlobUrl(`key-${BLOB_URL_CACHE_MAX}`)).toBe(`blob:mock/url-${BLOB_URL_CACHE_MAX}`)
    jest.runAllTimers()
    expect(revokedUrls).toContain('blob:mock/url-0')
  })

  it('reading a key refreshes its LRU position', () => {
    const evicted: string[] = []
    setBlobUrlEvictListener((keys) => evicted.push(...keys))
    for (let i = 0; i < BLOB_URL_CACHE_MAX; i++) {
      registerBlobUrl(`key-${i}`, `blob:mock/url-${i}`)
    }
    // touch the oldest entry, then overflow — the second-oldest should go
    getRegisteredBlobUrl('key-0')
    registerBlobUrl('key-overflow', 'blob:mock/url-overflow')
    expect(evicted).toEqual(['key-1'])
    expect(getRegisteredBlobUrl('key-0')).toBe('blob:mock/url-0')
  })

  it('evicts the least-recently-used full-size original only beyond its session cap', () => {
    const evicted: string[] = []
    setBlobUrlEvictListener((keys) => evicted.push(...keys))
    for (let i = 0; i <= ORIGINALS_CACHE_MAX; i++) {
      registerBlobUrl(`file-${i}_original_video_url`, `blob:mock/original-${i}`)
    }
    expect(evicted).toEqual(['file-0_original_video_url'])
    jest.runAllTimers()
    expect(revokedUrls).toContain('blob:mock/original-0')
  })

  it('retains original URLs for every video in a typical rendered media grid', () => {
    const videoCount = 35
    for (let i = 0; i < videoCount; i++) {
      registerBlobUrl(`grid-${i}_original_video_url`, `blob:mock/grid-${i}`)
    }

    for (let i = 0; i < videoCount; i++) {
      expect(getRegisteredBlobUrl(`grid-${i}_original_video_url`)).toBe(`blob:mock/grid-${i}`)
    }
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
  })

  it('does not evict a slider-pinned original while other originals are cached', () => {
    const evicted: string[] = []
    setBlobUrlEvictListener((keys) => evicted.push(...keys))
    registerBlobUrl('file-0_original_video_url', 'blob:mock/original-0')
    pinOriginalBlobUrl('file-0_original_video_url')
    for (let i = 1; i <= ORIGINALS_CACHE_MAX; i++) {
      registerBlobUrl(`file-${i}_original_video_url`, `blob:mock/original-${i}`)
    }

    expect(getRegisteredBlobUrl('file-0_original_video_url')).toBe('blob:mock/original-0')
    expect(evicted).toEqual(['file-1_original_video_url'])

    unpinOriginalBlobUrl('file-0_original_video_url')
  })

  it('releaseBlobUrls revokes and notifies only existing keys', () => {
    const evicted: string[] = []
    setBlobUrlEvictListener((keys) => evicted.push(...keys))
    registerBlobUrl('key-a', 'blob:mock/a')
    releaseBlobUrls(['key-a', 'key-missing'])
    expect(evicted).toEqual(['key-a'])
    expect(getRegisteredBlobUrl('key-a')).toBeUndefined()
    jest.runAllTimers()
    expect(revokedUrls).toEqual(['blob:mock/a'])
  })

  it('releaseAllOriginalBlobUrls leaves regular entries intact', () => {
    registerBlobUrl('regular-key', 'blob:mock/regular')
    registerBlobUrl('file_original_image_url', 'blob:mock/original')
    releaseAllOriginalBlobUrls()
    jest.runAllTimers()
    expect(getRegisteredBlobUrl('regular-key')).toBe('blob:mock/regular')
    expect(getRegisteredBlobUrl('file_original_image_url')).toBeUndefined()
    expect(revokedUrls).toEqual(['blob:mock/original'])
  })

  it('releaseAllBlobUrls empties both maps and revokes everything', () => {
    registerBlobUrl('regular-key', 'blob:mock/regular')
    registerBlobUrl('file_original_image_url', 'blob:mock/original')
    releaseAllBlobUrls()
    jest.runAllTimers()
    expect(getRegisteredBlobUrl('regular-key')).toBeUndefined()
    expect(getRegisteredBlobUrl('file_original_image_url')).toBeUndefined()
    expect(revokedUrls).toEqual(expect.arrayContaining(['blob:mock/regular', 'blob:mock/original']))
  })

  it('does not revoke non-blob values', () => {
    registerBlobUrl('http-key', 'https://example.com/image.png')
    releaseBlobUrls(['http-key'])
    jest.runAllTimers()
    expect(revokedUrls).toEqual([])
  })
})
