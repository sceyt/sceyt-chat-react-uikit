import { attachmentTypes, MESSAGE_STATUS } from './constants'

export const isPinnedMessageDeleted = (message?: any): boolean => message?.state === MESSAGE_STATUS.DELETE

/** A compact, plain-text description used anywhere a pin is announced. */
export const getPinnedMessagePreview = (message?: any): string => {
  if (!message) return ''
  if (isPinnedMessageDeleted(message)) return 'Deleted message'

  const body = message.body?.trim()
  if (body) return body
  if (message.pollDetails) return message.pollDetails.name || 'Poll'

  const attachment = message.attachments?.[0]
  if (!attachment) return message.forwardingDetails ? 'Shared content' : 'Message'
  if (attachment.type === attachmentTypes.image) return 'Photo'
  if (attachment.type === attachmentTypes.video) return 'Video'
  if (attachment.type === attachmentTypes.voice) return 'Voice message'
  if (attachment.type === attachmentTypes.link) return 'Link'
  return attachment.name || 'File'
}
