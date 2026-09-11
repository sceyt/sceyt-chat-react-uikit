import { getAttachmentUrlFromCache } from './attachmentsCache'
import { requestMediaDownload } from './mediaDownloadCoordinator'

export const parseAttachmentMetadata = (metadata: any): Record<string, any> => {
  if (!metadata) return {}

  try {
    const parsed = typeof metadata === 'string' ? JSON.parse(metadata) : metadata
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export const withVideoThumb = (metadata: any, videoThumb: string) => {
  const parsedMetadata = { ...parseAttachmentMetadata(metadata) }
  delete parsedMetadata.previewImage
  return JSON.stringify({ ...parsedMetadata, video_thumb: videoThumb })
}

export const getVideoThumb = (metadata: any): string | undefined => {
  const parsedMetadata = parseAttachmentMetadata(metadata)
  const videoThumb = parsedMetadata.video_thumb
  if (typeof videoThumb === 'string' && videoThumb.trim().length > 0) {
    return videoThumb.trim()
  }

  const legacyPreviewImage = parsedMetadata.previewImage
  return typeof legacyPreviewImage === 'string' && legacyPreviewImage.trim().length > 0
    ? legacyPreviewImage.trim()
    : undefined
}

export const shouldExtractVideoFirstFrame = (metadata: any) => !getVideoThumb(metadata)

/**
 * Preview and playable-video blobs intentionally use different cache entries.
 * A cached preview must never be mistaken for a downloaded video.
 */
export const getVideoAttachmentCacheKeys = (videoUrl: string, metadata: any) => ({
  videoThumb: getVideoThumb(metadata),
  originalVideo: `${videoUrl}_original_video_url`
})

/**
 * Downloads a video preview through the same downloader and Cache Storage path
 * as attachments. The returned object URL is safe to use as an img source.
 */
export const downloadVideoThumb = async (
  videoThumb: string,
  downloader?: any,
  messageType?: string | null
): Promise<string> => {
  const cachedUrl = await getAttachmentUrlFromCache(videoThumb).catch(() => false)
  if (typeof cachedUrl === 'string') return cachedUrl

  const { objectUrl } = await requestMediaDownload({
    key: `video-thumbnail:${videoThumb}`,
    url: videoThumb,
    cacheKey: videoThumb,
    kind: 'video-thumbnail',
    messageType,
    downloader,
    customDownload: true,
    // This helper already checked the preview cache above. Avoid consuming a
    // second cache lookup before the downloader has produced the thumbnail.
    skipCacheLookup: true
  })
  return objectUrl
}
