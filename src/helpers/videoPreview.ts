import { getAttachmentUrlFromCache, getAttachmentURLWithVersion, setAttachmentToCache } from './attachmentsCache'
import { registerBlobUrl } from './attachmentBlobUrls'

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

type PreviewDownloader = (
  uri: string,
  download: boolean,
  progressCallback: (progress: any) => void,
  messageType: string | null | undefined
) => Promise<any>

const getVideoThumbBlob = async (
  videoThumb: string,
  downloader?: PreviewDownloader,
  messageType?: string | null
): Promise<Blob> => {
  if (downloader) {
    const result = await downloader(videoThumb, true, () => undefined, messageType)
    const body = result?.Body || result
    if (body instanceof Blob) return body
    throw new Error('Video preview downloader did not return a Blob')
  }

  const response = await fetch(videoThumb)
  if (!response.ok) {
    throw new Error(`Unable to download video preview (${response.status})`)
  }
  return response.blob()
}

/**
 * Downloads a video preview through the same downloader and Cache Storage path
 * as attachments. The returned object URL is safe to use as an img source.
 */
export const downloadVideoThumb = async (
  videoThumb: string,
  downloader?: PreviewDownloader,
  messageType?: string | null
): Promise<string> => {
  const cachedUrl = await getAttachmentUrlFromCache(videoThumb).catch(() => false)
  if (typeof cachedUrl === 'string') return cachedUrl

  const blob = await getVideoThumbBlob(videoThumb, downloader, messageType)
  try {
    await setAttachmentToCache(
      videoThumb,
      new Response(blob, { headers: { 'Content-Type': blob.type || 'image/jpeg' } })
    )
  } catch {
    // Cache Storage is an optimization; the downloaded thumbnail remains
    // renderable when Cache Storage is unavailable or evicted mid-download.
  }

  const cachedPreviewUrl = await getAttachmentUrlFromCache(videoThumb).catch(() => false)
  if (typeof cachedPreviewUrl === 'string') return cachedPreviewUrl

  const objectUrl = URL.createObjectURL(blob)
  registerBlobUrl(getAttachmentURLWithVersion(videoThumb), objectUrl)
  return objectUrl
}
