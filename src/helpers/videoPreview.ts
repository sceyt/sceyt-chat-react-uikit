import { getAttachmentUrlFromCache } from './attachmentsCache'
import { requestMediaDownload } from './mediaDownloadCoordinator'
import { getAttachmentEncryption } from './attachmentEncryption'
import { IAttachment } from '../types'
import { attachmentTypes } from './constants'

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
  return JSON.stringify({ ...parsedMetadata, pvw: videoThumb })
}

export const getVideoThumb = (metadata: any): string | undefined => {
  const parsedMetadata = parseAttachmentMetadata(metadata)
  const videoThumb = parsedMetadata.pvw
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
 * A message's attachments as they are shown: its preview attachments (a video's preview
 * image sent as an attachment of its own) are not shown. A video whose pvw is a
 * preview attachment's URL gets that attachment as `videoPreviewAttachment`, whose own key
 * opens it; the order of the attachments does not matter.
 */
export const withVideoPreviews = (attachments: IAttachment[] = []): IAttachment[] => {
  const previews = attachments.filter((attachment) => attachment?.type === attachmentTypes.preview)
  if (!previews.length) return attachments
  return attachments
    .filter((attachment) => attachment?.type !== attachmentTypes.preview)
    .map((attachment) => {
      if (attachment?.type !== attachmentTypes.video) return attachment
      const videoThumb = getVideoThumb(attachment.metadata)
      const preview = videoThumb ? previews.find((candidate) => candidate.url === videoThumb) : undefined
      return preview ? { ...attachment, videoPreviewAttachment: preview } : attachment
    })
}

/**
 * Preview and playable-video blobs intentionally use different cache entries.
 * A cached preview must never be mistaken for a downloaded video.
 */
export const getVideoAttachmentCacheKeys = (videoUrl: string, metadata: any) => ({
  videoThumb: getVideoThumb(metadata),
  originalVideo: `${videoUrl}_original_video_url`
})

/**
 * Downloads a video preview through the same transport and Cache Storage path
 * as attachments. The returned object URL is safe to use as an img source.
 * `video` is the video attachment: its metadata holds the preview's key when it is encrypted.
 */
export const downloadVideoThumb = async (
  videoThumb: string,
  video: IAttachment,
  messageType?: string | null
): Promise<string> => {
  const cachedUrl = await getAttachmentUrlFromCache(videoThumb).catch(() => false)
  if (typeof cachedUrl === 'string') return cachedUrl

  // A preview sent as an attachment of its own is opened with its own key.
  const previewAttachment = video.videoPreviewAttachment?.url === videoThumb ? video.videoPreviewAttachment : undefined
  const { objectUrl } = await requestMediaDownload({
    key: `video-thumbnail:${videoThumb}`,
    attachment: previewAttachment || video,
    url: videoThumb,
    cacheKey: videoThumb,
    kind: 'video-thumbnail',
    messageType,
    // This helper already checked the preview cache above. Avoid consuming a
    // second cache lookup before the downloader has produced the thumbnail.
    skipCacheLookup: true,
    // An encrypted video's preview is a preview attachment of its own, opened with its own key;
    // a plain pvw is not encrypted.
    encryption: previewAttachment ? getAttachmentEncryption(previewAttachment.metadata) : undefined,
    contentType: 'image/jpeg'
  })
  return objectUrl
}
