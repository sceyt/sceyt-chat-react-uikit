import { attachmentTypes } from './constants'

type Attachment = { tid?: string; type?: string; [key: string]: any }

const isVideoAttachment = (attachment: Attachment) =>
  attachment.type === attachmentTypes.video || attachment.data?.type?.startsWith('video/')

export const waitForMediaAttachmentPreparation = async (
  attachments: Attachment[],
  preparations: Map<string, Promise<void>>
) => {
  await Promise.all(
    attachments
      .filter((attachment) => attachment.type === attachmentTypes.image || isVideoAttachment(attachment))
      .map((attachment) => (attachment.tid ? preparations.get(attachment.tid) : undefined))
  )
}

export const mergePreparedAttachmentPatches = (attachments: Attachment[], patches: Map<string, Partial<Attachment>>) =>
  attachments.map((attachment) => ({ ...attachment, ...(attachment.tid ? patches.get(attachment.tid) : undefined) }))

// Preserve the picker choice. A video picked through the generic File option
// must remain a file attachment in the outgoing message.
export const getOutgoingAttachmentType = (attachment: Attachment) => attachment.type
