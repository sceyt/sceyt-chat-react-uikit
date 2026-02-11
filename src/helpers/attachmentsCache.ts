import log from 'loglevel'
// const downloadedAttachments: { [key: string]: string } = {}
// Create a new cache

const ATTACHMENTS_CACHE = 'attachments-cache'
const ATTACHMENT_VERSION_KEY = 'sceyt_attachment_cache_version'
const isBrowser = typeof window !== 'undefined'
let cacheAvailable: any
if (isBrowser) {
  // Use the `window` object.
  cacheAvailable = 'caches' in window
} else {
  // Do not use the `window` object.
  cacheAvailable = 'caches' in global
}

export const ATTACHMENT_VERSION = `_1_0_1`

export const setAttachmentToCache = async (attachmentUrl: string, attachmentResponse: Response) => {
  const attachmentURLVersion = attachmentUrl + ATTACHMENT_VERSION
  if (cacheAvailable) {
    await caches.open(ATTACHMENTS_CACHE).then(async (cache) => {
      try {
        // Create a Request object with a valid URL scheme
        // The Cache API requires http/https URLs, so we use a fake domain
        const cacheKey =
          attachmentURLVersion?.startsWith('http://') || attachmentURLVersion?.startsWith('https://')
            ? attachmentURLVersion
            : `https://cache.local/${encodeURIComponent(attachmentURLVersion)}`

        const request = new Request(cacheKey)
        await cache.put(request, attachmentResponse)
        log.info('Cache success')
      } catch (e) {
        log.info('Error on cache attachment ... ', e)
        // Try to delete using the same key format
        const deleteCacheKey =
          attachmentURLVersion?.startsWith('http://') || attachmentURLVersion?.startsWith('https://')
            ? attachmentURLVersion
            : `https://cache.local/${encodeURIComponent(attachmentURLVersion)}`
        try {
          const deleteRequest = new Request(deleteCacheKey)
          await cache.delete(deleteRequest)
        } catch (deleteError) {
          // Ignore delete errors
        }
      }
      removeAttachmentFromCache(attachmentUrl)
    })
  } else {
    log.error('Cache is not available')
  }
}
export const removeAttachmentFromCache = async (attachmentId: string) => {
  if (cacheAvailable) {
    const cacheKey =
      attachmentId?.startsWith('http://') || attachmentId?.startsWith('https://')
        ? attachmentId
        : `https://cache.local/${encodeURIComponent(attachmentId)}`
    const request = new Request(cacheKey)
    await caches.open(ATTACHMENTS_CACHE).then((cache) => cache.delete(request))
  }
  // downloadedAttachments[attachmentId] = attachmentUrl
}

export const getAttachmentUrlFromCache = async (attachmentUrl: string): Promise<string | false> => {
  const attachmentURLVersion = attachmentUrl + ATTACHMENT_VERSION
  if (!cacheAvailable) {
    log.error('Cache is not available')
    return Promise.reject(new Error('Cache not available'))
  }

  // Create the same cache key format as in setAttachmentToCache
  const cacheKey =
    attachmentURLVersion?.startsWith('http://') || attachmentURLVersion?.startsWith('https://')
      ? attachmentURLVersion
      : `https://cache.local/${encodeURIComponent(attachmentURLVersion)}`

  const request = new Request(cacheKey)
  const response = await caches.match(request)
  if (response) {
    // Use the cached response
    return URL.createObjectURL(await response.blob())
  } else {
    return false
  }
}

export const getAttachmentURLWithVersion = (attachmentUrl: string) => {
  return attachmentUrl + ATTACHMENT_VERSION
}

/**
 * Cleans up old cached attachments when version changes
 * Call this once at app initialization
 */
export const cleanupOldAttachmentCache = async (): Promise<void> => {
  if (!cacheAvailable || !isBrowser) {
    return
  }

  try {
    const storedVersion = localStorage.getItem(ATTACHMENT_VERSION_KEY) || '_1_0_0'

    // If version changed, clear all old cached items
    if (storedVersion && storedVersion !== ATTACHMENT_VERSION) {
      log.info(
        `Attachment cache version changed from ${storedVersion} to ${ATTACHMENT_VERSION}, cleaning up old cache...`
      )

      const cache = await caches.open(ATTACHMENTS_CACHE)
      const requests = await cache.keys()

      // Delete all cached items with the old version suffix
      let deletedCount = 0
      for (const request of requests) {
        const url = request.url
        if (url.includes(storedVersion)) {
          await cache.delete(request)
          deletedCount++
        }
      }

      log.info(`Cleaned up ${deletedCount} old cached attachments`)
    }

    // Update stored version
    localStorage.setItem(ATTACHMENT_VERSION_KEY, ATTACHMENT_VERSION)
  } catch (error) {
    log.error('Error cleaning up old attachment cache:', error)
  }
}
