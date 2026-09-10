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

// Generic picker videos deliberately use a file-card in the composer while
// their thumbnail is prepared. Once sent, they must be message videos so the
// thread renders playback controls immediately instead of retaining that card.
export const getOutgoingAttachmentType = (attachment: Attachment) =>
  attachment.type === attachmentTypes.file && attachment.data?.type?.startsWith('video/')
    ? attachmentTypes.video
    : attachment.type
