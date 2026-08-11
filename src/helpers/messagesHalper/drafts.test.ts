import { persistDraft, removePersistedDraft, restoreDrafts } from '../messagesIdb'
import { getDraftMessageFromMap, hydrateDraftMessages, removeDraftMessageFromMap, setDraftMessageToMap } from './index'

jest.mock('../messagesIdb', () => ({
  persistChannelMessages: jest.fn(),
  restoreChannelMessages: jest.fn(),
  persistDraft: jest.fn(async () => undefined),
  removePersistedDraft: jest.fn(async () => undefined),
  restoreDrafts: jest.fn(async () => [])
}))

describe('persistent drafts', () => {
  afterEach(() => {
    removeDraftMessageFromMap('draft-channel')
    jest.clearAllMocks()
  })

  it('persists attachment-only drafts instead of requiring text', () => {
    const file = new File(['image'], 'photo.png', { type: 'image/png' })

    setDraftMessageToMap('draft-channel', {
      text: '',
      mentionedUsers: [],
      attachments: [{ data: file, type: 'image' }]
    })

    expect(getDraftMessageFromMap('draft-channel')?.attachments).toHaveLength(1)
    expect(persistDraft).toHaveBeenCalledWith('draft-channel', expect.objectContaining({ text: '' }))
  })

  it('persists an empty reply-only composer for restoration', () => {
    const parentMessage: any = { id: 'parent-message', body: 'Reply target' }

    setDraftMessageToMap('draft-channel', { text: '', mentionedUsers: [], messageForReply: parentMessage })

    expect(getDraftMessageFromMap('draft-channel')?.messageForReply).toEqual(parentMessage)
    expect(persistDraft).toHaveBeenCalledWith(
      'draft-channel',
      expect.objectContaining({ messageForReply: parentMessage })
    )
  })

  it('keeps an empty reply-only composer in memory without persisting it', () => {
    const parentMessage: any = { id: 'session-reply-target', body: 'Reply target' }

    setDraftMessageToMap(
      'draft-channel',
      { text: '', mentionedUsers: [], messageForReply: parentMessage },
      { persist: false }
    )

    expect(getDraftMessageFromMap('draft-channel')?.messageForReply).toEqual(parentMessage)
    expect(persistDraft).not.toHaveBeenCalled()
    expect(removePersistedDraft).toHaveBeenCalledWith('draft-channel')
  })

  it('keeps an unchanged edit mode in memory without persisting it', () => {
    const messageToEdit: any = { id: 'session-edit-target', body: 'Original text', bodyAttributes: [] }

    setDraftMessageToMap(
      'draft-channel',
      {
        text: 'Original text',
        mentionedUsers: [],
        messageToEdit,
        editMessageText: 'Original text',
        editBodyAttributes: []
      },
      { persist: false }
    )

    expect(getDraftMessageFromMap('draft-channel')).toEqual(
      expect.objectContaining({ messageToEdit, editMessageText: 'Original text' })
    )
    expect(persistDraft).not.toHaveBeenCalled()
    expect(removePersistedDraft).toHaveBeenCalledWith('draft-channel')
  })

  it('persists edit drafts with the original target and replacement text', () => {
    const messageToEdit: any = { id: 'message-to-edit', body: 'Original text', bodyAttributes: [] }

    setDraftMessageToMap('draft-channel', {
      text: 'Updated text',
      mentionedUsers: [],
      messageToEdit,
      editMessageText: 'Updated text',
      editBodyAttributes: []
    })

    expect(persistDraft).toHaveBeenCalledWith(
      'draft-channel',
      expect.objectContaining({ messageToEdit, editMessageText: 'Updated text' })
    )
  })

  it('persists an unchanged edit mode for restoration', () => {
    const messageToEdit: any = { id: 'unchanged-message', body: 'Original text', bodyAttributes: [] }

    setDraftMessageToMap('draft-channel', {
      text: 'Original text',
      mentionedUsers: [],
      messageToEdit,
      editMessageText: 'Original text',
      editBodyAttributes: []
    })

    expect(getDraftMessageFromMap('draft-channel')).toEqual(
      expect.objectContaining({ messageToEdit, editMessageText: 'Original text' })
    )
  })

  it('persists an edit whose replacement text is empty for restoration', () => {
    const messageToEdit: any = { id: 'cleared-message', body: 'Original text', bodyAttributes: [] }

    setDraftMessageToMap('draft-channel', {
      text: '',
      mentionedUsers: [],
      messageToEdit,
      editMessageText: '',
      editBodyAttributes: []
    })

    expect(getDraftMessageFromMap('draft-channel')).toEqual(
      expect.objectContaining({ messageToEdit, editMessageText: '' })
    )
  })

  it('persists text, mentions, formatting, and reply context together', () => {
    const reply: any = { id: 'parent-message', body: 'Parent message' }
    const mentionedUser = { id: 'mentioned-user', firstName: 'Mentioned' }
    const bodyAttributes = [{ type: 'mention', offset: 6, length: 8, metadata: mentionedUser.id }]

    setDraftMessageToMap('draft-channel', {
      text: 'Hello @Mentioned',
      mentionedUsers: [mentionedUser],
      messageForReply: reply,
      bodyAttributes
    })

    expect(persistDraft).toHaveBeenCalledWith(
      'draft-channel',
      expect.objectContaining({
        text: 'Hello @Mentioned',
        mentionedUsers: [mentionedUser],
        messageForReply: reply,
        bodyAttributes
      })
    )
  })

  it('removes the persisted record when a draft is explicitly discarded', () => {
    setDraftMessageToMap('draft-channel', { text: 'discard me', mentionedUsers: [] })
    jest.clearAllMocks()

    removeDraftMessageFromMap('draft-channel')

    expect(getDraftMessageFromMap('draft-channel')).toBeUndefined()
    expect(removePersistedDraft).toHaveBeenCalledWith('draft-channel')
  })

  it('hydrates persisted media drafts as the original named File without resizing', async () => {
    const createObjectURL = jest.fn(() => 'blob:restored-photo')
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
    const persistedBlob = new Blob(['original-image-bytes'], { type: 'image/jpeg' })
    ;(restoreDrafts as jest.Mock).mockResolvedValue([
      {
        channelId: 'draft-channel',
        draft: {
          text: '',
          mentionedUsers: [],
          attachments: [{ data: persistedBlob, name: 'photo.jpg', type: 'image' }]
        }
      }
    ])

    await hydrateDraftMessages()

    const restoredAttachment = getDraftMessageFromMap('draft-channel')?.attachments?.[0]
    expect(restoredAttachment.attachmentUrl).toBe('blob:restored-photo')
    expect(restoredAttachment.data).toBeInstanceOf(File)
    expect(restoredAttachment.data.name).toBe('photo.jpg')
    expect(restoredAttachment.data.type).toBe('image/jpeg')
    expect(restoredAttachment.data.size).toBe(persistedBlob.size)
    expect(createObjectURL).toHaveBeenCalled()
  })

  it('hydrates every attachment while preserving its metadata and file bytes', async () => {
    const createObjectURL = jest.fn((blob: Blob) => `blob:${blob.type}:${blob.size}`)
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
    const imageBlob = new Blob(['image-bytes'], { type: 'image/png' })
    const videoBlob = new Blob(['video-bytes'], { type: 'video/mp4' })
    ;(restoreDrafts as jest.Mock).mockResolvedValue([
      {
        channelId: 'draft-channel',
        draft: {
          text: '',
          mentionedUsers: [],
          attachments: [
            { data: imageBlob, name: 'photo.png', type: 'image', metadata: { tmb: 'image-thumb' } },
            { data: videoBlob, name: 'clip.mp4', type: 'video', metadata: { dur: 12, tmb: 'video-thumb' } }
          ]
        }
      }
    ])

    await hydrateDraftMessages()

    const attachments = getDraftMessageFromMap('draft-channel')?.attachments
    expect(attachments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'photo.png', metadata: { tmb: 'image-thumb' } }),
        expect.objectContaining({ name: 'clip.mp4', metadata: { dur: 12, tmb: 'video-thumb' } })
      ])
    )
    expect(attachments?.every((attachment: any) => attachment.data instanceof File)).toBe(true)
    expect(attachments?.map((attachment: any) => attachment.data.size)).toEqual([imageBlob.size, videoBlob.size])
    expect(createObjectURL).toHaveBeenCalledTimes(2)
  })
})
