// const downloadedAttachments: { [key: string]: string } = {}
// Create a new cache

const ATTACHMENTS_CACHE = 'attachments-cache'

const cacheAvailable = 'caches' in self
export const setAttachmentToCache = (attachmentId: string, attachmentResponse: any) => {
  if (cacheAvailable) {
    caches.open(ATTACHMENTS_CACHE).then(async (cache) => {
      // Fetch the image or video
      // Add the response to the cache
      cache
        .put(attachmentId, attachmentResponse)
        .then(() => {
          console.log('Cache success')
        })
        .catch((e) => {
          console.log('Error on cache attachment ... ', e)
          caches.delete(attachmentId)
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

export const getAttachmentUrlFromCache = (attachmentId: string) => {
  if (cacheAvailable) {
    return caches.match(attachmentId).then(async (response) => {
      if (response) {
        // Use the cached response
        return URL.createObjectURL(await response.blob())
      } else {
        // The image or video is not cached
        console.log('The image or video is not cached', attachmentId)
        return false
      }
    })
  } else {
    return new Promise((_resolve, reject) => reject(new Error('Cache not available')))
  }
}
