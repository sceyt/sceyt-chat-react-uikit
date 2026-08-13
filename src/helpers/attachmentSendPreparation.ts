import { attachmentTypes } from './constants'

type Attachment = { tid?: string; type?: string; [key: string]: any }

export const waitForImageAttachmentPreparation = async (
  attachments: Attachment[],
  preparations: Map<string, Promise<void>>
) => {
  await Promise.all(
    attachments
      .filter((attachment) => attachment.type === attachmentTypes.image)
      .map((attachment) => (attachment.tid ? preparations.get(attachment.tid) : undefined))
  )
}

export const mergePreparedAttachmentPatches = (attachments: Attachment[], patches: Map<string, Partial<Attachment>>) =>
  attachments.map((attachment) => ({ ...attachment, ...(attachment.tid ? patches.get(attachment.tid) : undefined) }))
