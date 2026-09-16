export type ComposerDraft = {
  text: string
  mentionedUsers: any[]
  messageForReply: any
  editorState: any
  bodyAttributes: any
  attachments: any[]
  viewOnce: boolean
}

export type DraftHandoff = {
  channelId: string
  draft: ComposerDraft
  persist: boolean
}

type ComposerState = ComposerDraft & {
  channelId: string
  nextChannelId: string
}

/**
 * Returns the only draft write allowed while the active chat changes. The
 * composer values belong to `channelId`, never to `nextChannelId`.
 */
export const getDraftHandoff = ({
  channelId,
  nextChannelId,
  text,
  mentionedUsers,
  messageForReply,
  editorState,
  bodyAttributes,
  attachments,
  viewOnce
}: ComposerState): DraftHandoff | null => {
  if (!channelId || channelId === nextChannelId) {
    return null
  }

  if (text.trim() || attachments.length) {
    return {
      channelId,
      draft: {
        text,
        mentionedUsers,
        messageForReply,
        editorState,
        bodyAttributes,
        attachments,
        viewOnce
      },
      persist: true
    }
  }

  if (messageForReply) {
    return {
      channelId,
      draft: {
        text: '',
        mentionedUsers,
        messageForReply,
        editorState,
        bodyAttributes,
        attachments: [],
        viewOnce: false
      },
      persist: false
    }
  }

  return null
}
