// Central registry for attachment blob object URLs.
// Keys are the versioned keys stored in MessageReducer.attachmentUpdatedMap
// (rawUrl + ATTACHMENT_VERSION). Registering every shared object URL here keeps
// the number of pinned blobs bounded: the registry is an LRU with separate caps
// for regular entries (thumbnails, compressed images, video frames) and
// full-size originals, and it revokes URLs on eviction. Consumers re-mint from
// the Cache Storage on a missing key, so eviction is always safe.

export const BLOB_URL_CACHE_MAX = 300
export const ORIGINALS_CACHE_MAX = 6
// Revocation is deferred so components mid-render can finish painting the old
// URL and swap to their missing-key fallback on the next render.
const REVOKE_DELAY_MS = 2000

const isOriginalKey = (key: string) => key.includes('_original_image_url') || key.includes('_original_video_url')

// Insertion order doubles as LRU order: reads re-insert the key.
const blobUrls = new Map<string, string>()
const originalBlobUrls = new Map<string, string>()
const pendingCreates = new Map<string, Promise<string>>()

let evictListener: ((keys: string[]) => void) | null = null

export const setBlobUrlEvictListener = (cb: ((keys: string[]) => void) | null) => {
  evictListener = cb
}

const notifyEvicted = (keys: string[]) => {
  if (keys.length && evictListener) {
    evictListener(keys)
  }
}

const deferRevoke = (url: string) => {
  if (!url || !url.startsWith('blob:')) {
    return
  }
  setTimeout(() => {
    try {
      URL.revokeObjectURL(url)
    } catch (e) {
      // ignore
    }
  }, REVOKE_DELAY_MS)
}

const mapFor = (key: string) => (isOriginalKey(key) ? originalBlobUrls : blobUrls)
const capFor = (key: string) => (isOriginalKey(key) ? ORIGINALS_CACHE_MAX : BLOB_URL_CACHE_MAX)

const evictOverflow = (map: Map<string, string>, cap: number) => {
  const evicted: string[] = []
  while (map.size > cap) {
    const oldestKey = map.keys().next().value as string
    deferRevoke(map.get(oldestKey)!)
    map.delete(oldestKey)
    evicted.push(oldestKey)
  }
  notifyEvicted(evicted)
}

export const getRegisteredBlobUrl = (versionedKey: string): string | undefined => {
  const map = mapFor(versionedKey)
  const url = map.get(versionedKey)
  if (url !== undefined) {
    map.delete(versionedKey)
    map.set(versionedKey, url)
  }
  return url
}

export const registerBlobUrl = (versionedKey: string, objectUrl: string) => {
  if (!versionedKey || !objectUrl) {
    return
  }
  const map = mapFor(versionedKey)
  const existing = map.get(versionedKey)
  if (existing && existing !== objectUrl) {
    deferRevoke(existing)
  }
  map.delete(versionedKey)
  map.set(versionedKey, objectUrl)
  evictOverflow(map, capFor(versionedKey))
}

export const getOrCreateBlobUrl = async (versionedKey: string, makeBlob: () => Promise<Blob>): Promise<string> => {
  const existing = getRegisteredBlobUrl(versionedKey)
  if (existing) {
    return existing
  }
  const pending = pendingCreates.get(versionedKey)
  if (pending) {
    return pending
  }
  const create = (async () => {
    const blob = await makeBlob()
    const url = URL.createObjectURL(blob)
    registerBlobUrl(versionedKey, url)
    return url
  })().finally(() => {
    pendingCreates.delete(versionedKey)
  })
  pendingCreates.set(versionedKey, create)
  return create
}

export const releaseBlobUrls = (versionedKeys: string[]) => {
  const released: string[] = []
  for (const key of versionedKeys) {
    const map = mapFor(key)
    const url = map.get(key)
    if (url !== undefined) {
      map.delete(key)
      deferRevoke(url)
      released.push(key)
    }
  }
  notifyEvicted(released)
}

// Full-size originals are only rendered by the media slider — release them all
// when it closes; they re-mint from the attachments cache on next open.
export const releaseAllOriginalBlobUrls = () => {
  const keys = Array.from(originalBlobUrls.keys())
  originalBlobUrls.forEach(deferRevoke)
  originalBlobUrls.clear()
  notifyEvicted(keys)
}

export const releaseAllBlobUrls = () => {
  const allKeys = Array.from(blobUrls.keys()).concat(Array.from(originalBlobUrls.keys()))
  blobUrls.forEach(deferRevoke)
  originalBlobUrls.forEach(deferRevoke)
  blobUrls.clear()
  originalBlobUrls.clear()
  notifyEvicted(allKeys)
}
