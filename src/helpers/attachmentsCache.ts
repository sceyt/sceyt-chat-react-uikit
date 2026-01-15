import log from 'loglevel'
// const downloadedAttachments: { [key: string]: string } = {}
// Create a new cache

const ATTACHMENTS_CACHE = 'attachments-cache'
const isBrowser = typeof window !== 'undefined'
let cacheAvailable: any
if (isBrowser) {
  // Use the `window` object.
  cacheAvailable = 'caches' in window
} else {
  // Do not use the `window` object.
  cacheAvailable = 'caches' in global
}

export const setAttachmentToCache = async (attachmentUrl: string, attachmentResponse: Response) => {
  if (cacheAvailable) {
    await caches.open(ATTACHMENTS_CACHE).then(async (cache) => {
      try {
        // Create a Request object with a valid URL scheme
        // The Cache API requires http/https URLs, so we use a fake domain
        const cacheKey =
          attachmentUrl.startsWith('http://') || attachmentUrl.startsWith('https://')
            ? attachmentUrl
            : `https://cache.local/${encodeURIComponent(attachmentUrl)}`

        const request = new Request(cacheKey)
        await cache.put(request, attachmentResponse)
        log.info('Cache success')
      } catch (e) {
        log.info('Error on cache attachment ... ', e)
        // Try to delete using the same key format
        const deleteCacheKey =
          attachmentUrl.startsWith('http://') || attachmentUrl.startsWith('https://')
            ? attachmentUrl
            : `https://cache.local/${encodeURIComponent(attachmentUrl)}`
        try {
          const deleteRequest = new Request(deleteCacheKey)
          await cache.delete(deleteRequest)
        } catch (deleteError) {
          // Ignore delete errors
        }
      }
    })
  } else {
    log.error('Cache is not available')
  }
}
export const removeAttachmentFromCache = async (attachmentId: string) => {
  if (cacheAvailable) {
    const cacheKey =
      attachmentId.startsWith('http://') || attachmentId.startsWith('https://')
        ? attachmentId
        : `https://cache.local/${encodeURIComponent(attachmentId)}`
    const request = new Request(cacheKey)
    await caches.open(ATTACHMENTS_CACHE).then((cache) => cache.delete(request))
  }
  // downloadedAttachments[attachmentId] = attachmentUrl
}

export const getAttachmentUrlFromCache = async (attachmentUrl: string): Promise<string | false> => {
  if (!cacheAvailable) {
    log.error('Cache is not available')
    return Promise.reject(new Error('Cache not available'))
  }

  // Create the same cache key format as in setAttachmentToCache
  const cacheKey =
    attachmentUrl.startsWith('http://') || attachmentUrl.startsWith('https://')
      ? attachmentUrl
      : `https://cache.local/${encodeURIComponent(attachmentUrl)}`

  const request = new Request(cacheKey)
  const response = await caches.match(request)
  if (response) {
    // Use the cached response
    return URL.createObjectURL(await response.blob())
  } else {
    return false
  }
}
