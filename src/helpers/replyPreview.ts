import { attachmentTypes } from './constants'
import { isJSON } from './message'

/** Returns the Open Graph image stored on a link attachment, when available. */
export const getReplyLinkPreviewImage = (attachments?: Array<{ type?: string; metadata?: unknown }>): string | null => {
  const attachment = attachments?.length && attachments[0]?.type === attachmentTypes.link ? attachments[0] : null
  if (!attachment?.metadata || !isJSON(attachment.metadata)) return null
  const compactMeta = JSON.parse(attachment.metadata as string)
  const imageUrl: string | null = compactMeta.iur || null
  return !compactMeta?.hld ? imageUrl : null
}

/** A loaded preview image is replaced with the link icon after its image request fails. */
export const shouldShowLinkPreviewErrorFallback = (
  imageUrl: string | null | undefined,
  imageFailed: boolean
): boolean => Boolean(imageUrl && imageFailed)
