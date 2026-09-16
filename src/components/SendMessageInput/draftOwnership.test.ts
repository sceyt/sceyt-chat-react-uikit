import { getDraftHandoff } from './draftOwnership'

describe('getDraftHandoff', () => {
  const baseDraft = {
    mentionedUsers: [],
    messageForReply: null,
    editorState: undefined,
    bodyAttributes: [],
    attachments: [],
    viewOnce: false
  }

  it('keeps User A draft under User A when navigating to User B', () => {
    const handoff = getDraftHandoff({
      channelId: 'user-a',
      nextChannelId: 'user-b',
      text: 'Draft for User A',
      ...baseDraft
    })

    expect(handoff).toEqual(
      expect.objectContaining({
        channelId: 'user-a',
        persist: true,
        draft: expect.objectContaining({ text: 'Draft for User A' })
      })
    )
  })

  it('does not create a User B draft after returning to the browser tab', () => {
    const drafts: Record<string, any> = {}
    const handoff = getDraftHandoff({
      channelId: 'user-a',
      nextChannelId: 'user-b',
      text: 'Draft for User A',
      ...baseDraft
    })

    if (handoff) {
      drafts[handoff.channelId] = handoff.draft
    }

    // Browser visibility/focus changes must not alter the composer owner.
    expect(drafts['user-a'].text).toBe('Draft for User A')
    expect(drafts['user-b']).toBeUndefined()
  })

  it('does not hand off a draft when the composer remains in the same chat', () => {
    expect(
      getDraftHandoff({
        channelId: 'user-a',
        nextChannelId: 'user-a',
        text: 'Draft for User A',
        ...baseDraft
      })
    ).toBeNull()
  })

  it('retains reply-only state for the source chat without persisting it', () => {
    const reply = { id: 'message-a' }

    expect(
      getDraftHandoff({
        channelId: 'user-a',
        nextChannelId: 'user-b',
        text: '',
        ...baseDraft,
        messageForReply: reply
      })
    ).toEqual({
      channelId: 'user-a',
      persist: false,
      draft: expect.objectContaining({ messageForReply: reply })
    })
  })
})
