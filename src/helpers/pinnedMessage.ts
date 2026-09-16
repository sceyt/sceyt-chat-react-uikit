import { attachmentTypes, MESSAGE_STATUS } from './constants'
import { MessageTextFormat } from '../messageUtils'

export const isPinnedMessageDeleted = (message?: any): boolean => message?.state === MESSAGE_STATUS.DELETE

/** Uses the same mention formatting as message bubbles for plain-text pin previews. */
export const getPinnedMessageBody = (
  message?: any,
  contactsMap: Record<string, any> = {},
  getFromContacts = false
): string => {
  const body = message?.body || ''
  if (!body || !message?.bodyAttributes?.length) return body

  const formattedBody = MessageTextFormat({
    text: body,
    message,
    contactsMap,
    getFromContacts,
    asSampleText: true,
    accentColor: '',
    textSecondary: ''
  })

  return Array.isArray(formattedBody) ? formattedBody.join('') : String(formattedBody)
}

/** A compact, plain-text description used anywhere a pin is announced. */
export const getPinnedMessagePreview = (
  message?: any,
  contactsMap: Record<string, any> = {},
  getFromContacts = false
): string => {
  if (!message) return ''
  if (isPinnedMessageDeleted(message)) return 'Deleted message'

  const body = getPinnedMessageBody(message, contactsMap, getFromContacts).trim()
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
