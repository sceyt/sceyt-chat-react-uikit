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

export const setAttachmentToCache = (attachmentUrl: string, attachmentResponse: any) => {
  if (cacheAvailable) {
    caches.open(ATTACHMENTS_CACHE).then(async (cache) => {
      // Fetch the image or video
      // Add the response to the cache
      cache
        .put(attachmentUrl, attachmentResponse)
        .then(() => {
          log.info('Cache success')
        })
        .catch((e) => {
          log.info('Error on cache attachment ... ', e)
          caches.delete(attachmentUrl)
        })
    })
  }
  // downloadedAttachments[attachmentId] = attachmentUrl
}
export const removeAttachmentFromCache = (attachmentId: string) => {
  if (cacheAvailable) {
    caches.delete(attachmentId)
  }
  // downloadedAttachments[attachmentId] = attachmentUrl
}

export const getAttachmentUrlFromCache = async (attachmentUrl: string): Promise<string | false> => {
  if (!cacheAvailable) {
    console.error('Cache is not available');
    return Promise.reject(new Error('Cache not available'));
  }

  const response = await caches.match(attachmentUrl);
  if (response) {
    // Use the cached response
    return URL.createObjectURL(await response.blob());
  } else {
    // The image or video is not cached
    log.info('The image or video is not cached', attachmentUrl);
    return false;
  }
};