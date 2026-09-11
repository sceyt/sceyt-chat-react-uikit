// Central registry for attachment blob object URLs.
// Keys are the versioned keys stored in MessageReducer.attachmentUpdatedMap
// (rawUrl + ATTACHMENT_VERSION). Registering every shared object URL here keeps
// session resources bounded through LRU eviction and revokes URLs on eviction.
// Consumers re-mint from Cache Storage on a missing key.

export const BLOB_URL_CACHE_MAX = 300
// Originals must stay available for the active browser session just like other
// attachment URLs. A tiny original-only limit made a channel with more than
// six videos evict/recreate the same URLs in a loop. The shared, bounded LRU
// still caps the session at 300 entries and revokes URLs on eventual eviction.
export const ORIGINALS_CACHE_MAX = BLOB_URL_CACHE_MAX
// Revocation is deferred so components mid-render can finish painting the old
// URL and swap to their missing-key fallback on the next render.
const REVOKE_DELAY_MS = 2000

const isOriginalKey = (key: string) => key.includes('_original_image_url') || key.includes('_original_video_url')

// Insertion order doubles as LRU order: reads re-insert the key.
const blobUrls = new Map<string, string>()
const originalBlobUrls = new Map<string, string>()
const pinnedOriginalKeys = new Set<string>()
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

const isBlobUrlStillRegistered = (url: string) => {
  for (const registeredUrl of blobUrls.values()) {
    if (registeredUrl === url) return true
  }
  for (const registeredUrl of originalBlobUrls.values()) {
    if (registeredUrl === url) return true
  }
  return false
}

const deferRevoke = (url: string) => {
  if (!url || !url.startsWith('blob:')) {
    return
  }
  setTimeout(() => {
    // One blob can be published under a compact/display key and an
    // original-media key. Replacing the compact version must not invalidate
    // the still-live original URL used by the slider.
    if (isBlobUrlStillRegistered(url)) return
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
    const oldestKey = Array.from(map.keys()).find((key) => map !== originalBlobUrls || !pinnedOriginalKeys.has(key))
    // A visible slider may pin an original while background media keeps
    // filling the cache. Keep it alive until that view releases it.
    if (!oldestKey) break
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
  // Redux can publish the same attachment URL repeatedly while message/media
  // views reconcile. Re-registering it is harmless, but must remain a true
  // no-op and must not revoke the live URL.
  if (existing === objectUrl) {
    return
  }
  if (existing && existing !== objectUrl) {
    deferRevoke(existing)
  }
  map.delete(versionedKey)
  map.set(versionedKey, objectUrl)
  evictOverflow(map, capFor(versionedKey))
}

export const pinOriginalBlobUrl = (versionedKey: string) => {
  if (!isOriginalKey(versionedKey)) return

  pinnedOriginalKeys.add(versionedKey)
  const url = originalBlobUrls.get(versionedKey)
  if (url !== undefined) {
    originalBlobUrls.delete(versionedKey)
    originalBlobUrls.set(versionedKey, url)
  }
}

export const unpinOriginalBlobUrl = (versionedKey: string) => {
  pinnedOriginalKeys.delete(versionedKey)
  evictOverflow(originalBlobUrls, ORIGINALS_CACHE_MAX)
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
      pinnedOriginalKeys.delete(key)
      deferRevoke(url)
      released.push(key)
    }
  }
  notifyEvicted(released)
}

// Explicit cleanup for full-size originals, for example during app teardown.
export const releaseAllOriginalBlobUrls = () => {
  const keys = Array.from(originalBlobUrls.keys())
  originalBlobUrls.forEach(deferRevoke)
  originalBlobUrls.clear()
  pinnedOriginalKeys.clear()
  notifyEvicted(keys)
}

export const releaseAllBlobUrls = () => {
  const allKeys = Array.from(blobUrls.keys()).concat(Array.from(originalBlobUrls.keys()))
  blobUrls.forEach(deferRevoke)
  originalBlobUrls.forEach(deferRevoke)
  blobUrls.clear()
  originalBlobUrls.clear()
  pinnedOriginalKeys.clear()
  notifyEvicted(allKeys)
}
