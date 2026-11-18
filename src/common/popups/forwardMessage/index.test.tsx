import React from 'react'
import { act, fireEvent, screen } from '@testing-library/react'
import ForwardMessagePopup, { IForwardPreviewMessage } from './index'
import {
  createMessageListStore,
  makeChannel,
  makeUser,
  renderWithSceytProvider,
  resetMessageListFixtureIds
} from '../../../testUtils/messageListHarness'
import { attachmentTypes, DEFAULT_CHANNEL_TYPE, LOADING_STATE, USER_PRESENCE_STATUS } from '../../../helpers/constants'
import { IAttachment, IChannel, IContactsMap } from '../../../types'
import { setShowOnlyContactUsers } from '../../../helpers/contacts'
import { setActiveChannelAC, switchChannelActionAC } from '../../../store/channel/actions'

// Attachment is a large, heavy component with its own extensive test surface —
// it isn't the target of these tests, so it's stubbed to a simple marker (matching
// the convention used by RepliedMessage/index.test.tsx).
jest.mock('../../../components/Attachment', () => ({
  __esModule: true,
  default: ({ attachment }: { attachment: { type: string } }) => (
    <div data-testid='forward-attachment-thumb'>{attachment.type}</div>
  )
}))

const NOTE_INPUT_MIN_HEIGHT_PX = '20px'
const NOTE_INPUT_MAX_HEIGHT_PX = '60px'

const makeAttachment = (overrides: Partial<IAttachment> = {}): IAttachment =>
  ({
    id: 'att-1',
    messageId: 'msg-1',
    name: 'attachment',
    type: attachmentTypes.file,
    metadata: undefined,
    url: 'https://example.com/file',
    size: 100,
    createdAt: new Date('2026-04-01T12:00:00.000Z'),
    progress: null,
    completion: null,
    upload: false,
    attachmentUrl: '',
    data: null,
    ...overrides
  }) as IAttachment

const renderPopup = ({
  channels = [makeChannel({ id: 'chan-1', subject: 'Jordyn Aminoff' })],
  forwardMessages,
  contactsMap = {},
  ...props
}: Partial<React.ComponentProps<typeof ForwardMessagePopup>> & {
  channels?: IChannel[]
  contactsMap?: IContactsMap
} = {}) => {
  const handleForward = jest.fn()
  const togglePopup = jest.fn()

  const store = createMessageListStore({
    ChannelReducer: {
      channelsForForward: channels,
      channelsForForwardLoadingState: LOADING_STATE.LOADED,
      channelsForForwardHasNext: false,
      searchedChannelsForForward: { chats_groups: [], channels: [], contacts: [] }
    },
    UserReducer: {
      contactsMap
    }
  })
  const dispatch = jest.spyOn(store, 'dispatch')

  const utils = renderWithSceytProvider(
    <ForwardMessagePopup
      title='Forward message'
      togglePopup={togglePopup}
      handleForward={handleForward}
      forwardMessages={forwardMessages}
      {...props}
    />,
    { store }
  )

  return { ...utils, handleForward, togglePopup, store, dispatch }
}

const selectChannel = (subject: string) => fireEvent.click(screen.getByText(subject))
const expectNoChannelSwitch = (dispatch: jest.SpyInstance) =>
  expect(dispatch.mock.calls.some(([action]) => action.type === switchChannelActionAC(null).type)).toBe(false)

const setScrollHeight = (element: HTMLElement, value: number) =>
  Object.defineProperty(element, 'scrollHeight', { configurable: true, value })

const makeMentionMembers = () => [
  { ...makeUser({ id: 'current-user' }), role: 'owner' },
  { ...makeUser({ id: 'alice', firstName: 'Alice', lastName: 'Anderson' }), role: 'member' },
  { ...makeUser({ id: 'bob', firstName: 'Bob', lastName: 'Baker' }), role: 'member' }
]

describe('ForwardMessagePopup', () => {
  beforeEach(() => {
    resetMessageListFixtureIds()
    setShowOnlyContactUsers(false)
  })

  afterEach(() => {
    setShowOnlyContactUsers(false)
  })

  it('renders the channel list and title, with no note card and no footer buttons before anything is selected', () => {
    renderPopup()

    expect(screen.getByText('Forward message')).toBeInTheDocument()
    expect(screen.getByText('Jordyn Aminoff')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Write a message')).not.toBeInTheDocument()
    expect(screen.queryByText('Forwarded message')).not.toBeInTheDocument()
    // The old footer ("Cancel" / "Forward" buttons) was removed — sending now
    // happens through the send button embedded in the note card.
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Forward' })).not.toBeInTheDocument()
  })

  it('shows the note card with a send button once a channel is selected, and hides it again on deselect', () => {
    renderPopup()

    selectChannel('Jordyn Aminoff')

    expect(screen.getByPlaceholderText('Write a message')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Forward' })).toBeInTheDocument()
    // The channel now appears both in the list and as a selected chip.
    expect(screen.getAllByText('Jordyn Aminoff')).toHaveLength(2)

    fireEvent.click(screen.getByText('cross.svg'))

    expect(screen.queryByPlaceholderText('Write a message')).not.toBeInTheDocument()
    expect(screen.getAllByText('Jordyn Aminoff')).toHaveLength(1)
  })

  it('renders no forward preview when forwardMessages is empty, even after selecting a channel', () => {
    renderPopup({ forwardMessages: [] })

    selectChannel('Jordyn Aminoff')

    expect(screen.getByPlaceholderText('Write a message')).toBeInTheDocument()
    expect(screen.queryByText('Forwarded message')).not.toBeInTheDocument()
  })

  it('shows an image attachment preview using the real attachment thumbnail, labeled Photo', () => {
    const forwardMessages: IForwardPreviewMessage[] = [
      { attachments: [makeAttachment({ type: attachmentTypes.image })] }
    ]
    renderPopup({ forwardMessages })

    selectChannel('Jordyn Aminoff')

    expect(screen.getByText('Forwarded message')).toBeInTheDocument()
    expect(screen.getByTestId('forward-attachment-thumb')).toHaveTextContent(attachmentTypes.image)
    expect(screen.getByText('Photo')).toBeInTheDocument()
    expect(screen.queryByText('choseFile.svg')).not.toBeInTheDocument()
  })

  it('shows a video attachment preview using the real attachment thumbnail, labeled Video', () => {
    const forwardMessages: IForwardPreviewMessage[] = [
      { attachments: [makeAttachment({ type: attachmentTypes.video })] }
    ]
    renderPopup({ forwardMessages })

    selectChannel('Jordyn Aminoff')

    expect(screen.getByTestId('forward-attachment-thumb')).toHaveTextContent(attachmentTypes.video)
    expect(screen.getByText('Video')).toBeInTheDocument()
  })

  it('does not show a generic file icon for a voice attachment, labeled Voice', () => {
    const forwardMessages: IForwardPreviewMessage[] = [
      { attachments: [makeAttachment({ type: attachmentTypes.voice })] }
    ]
    renderPopup({ forwardMessages })

    selectChannel('Jordyn Aminoff')

    expect(screen.queryByText('choseFile.svg')).not.toBeInTheDocument()
    expect(screen.getByText('Voice')).toBeInTheDocument()
    expect(screen.queryByTestId('forward-attachment-thumb')).not.toBeInTheDocument()
  })

  it('shows the generic file icon for a plain file attachment, labeled File', () => {
    const forwardMessages: IForwardPreviewMessage[] = [
      { attachments: [makeAttachment({ type: attachmentTypes.file })] }
    ]
    renderPopup({ forwardMessages })

    selectChannel('Jordyn Aminoff')

    expect(screen.getByText('choseFile.svg')).toBeInTheDocument()
    expect(screen.getByText('File')).toBeInTheDocument()
  })

  it('shows the link OG image and the raw URL as the label for a link attachment', () => {
    const forwardMessages: IForwardPreviewMessage[] = [
      {
        attachments: [
          makeAttachment({
            type: attachmentTypes.link,
            url: 'https://sceyt.com/call/6f564464402045a580d92d047f2ec71d',
            metadata: JSON.stringify({ iur: 'https://img.example.com/thumb.png' })
          })
        ]
      }
    ]
    renderPopup({ forwardMessages })

    selectChannel('Jordyn Aminoff')

    const image = screen.getByAltText('Link preview') as HTMLImageElement
    expect(image.src).toBe('https://img.example.com/thumb.png')
    expect(screen.getByText('https://sceyt.com/call/6f564464402045a580d92d047f2ec71d')).toBeInTheDocument()
    expect(screen.queryByText('linkIcon.svg')).not.toBeInTheDocument()
  })

  it('falls back to the link icon when a link attachment has no OG image', () => {
    const forwardMessages: IForwardPreviewMessage[] = [
      {
        attachments: [
          makeAttachment({
            type: attachmentTypes.link,
            url: 'https://example.com/no-preview',
            metadata: undefined
          })
        ]
      }
    ]
    renderPopup({ forwardMessages })

    selectChannel('Jordyn Aminoff')

    expect(screen.getByText('linkIcon.svg')).toBeInTheDocument()
    expect(screen.queryByAltText('Link preview')).not.toBeInTheDocument()
    expect(screen.getByText('https://example.com/no-preview')).toBeInTheDocument()
  })

  it('falls back to the link icon once the OG preview image fails to load', () => {
    const forwardMessages: IForwardPreviewMessage[] = [
      {
        attachments: [
          makeAttachment({
            type: attachmentTypes.link,
            url: 'https://example.com/broken-image',
            metadata: JSON.stringify({ iur: 'https://img.example.com/broken.png' })
          })
        ]
      }
    ]
    renderPopup({ forwardMessages })

    selectChannel('Jordyn Aminoff')

    const image = screen.getByAltText('Link preview')
    fireEvent.error(image)

    expect(screen.queryByAltText('Link preview')).not.toBeInTheDocument()
    expect(screen.getByText('linkIcon.svg')).toBeInTheDocument()
  })

  it('shows the first message body as the label when it has no attachment', () => {
    const forwardMessages: IForwardPreviewMessage[] = [{ body: 'hello world' }]
    renderPopup({ forwardMessages })

    selectChannel('Jordyn Aminoff')

    expect(screen.getByText('hello world')).toBeInTheDocument()
    expect(screen.queryByText('choseFile.svg')).not.toBeInTheDocument()
    expect(screen.queryByText('linkIcon.svg')).not.toBeInTheDocument()
    expect(screen.queryByTestId('forward-attachment-thumb')).not.toBeInTheDocument()
  })

  it('uses the contact name, rather than the raw phone number, for a mention in the forwarded preview', () => {
    setShowOnlyContactUsers(true)
    const mentionedUser = makeUser({ id: 'mentioned-user', firstName: '+37499111222', lastName: '' })
    const body = '@+37499111222 please review this'
    const forwardMessages: IForwardPreviewMessage[] = [
      {
        body,
        bodyAttributes: [{ type: 'mention', metadata: mentionedUser.id, offset: 0, length: '@+37499111222'.length }],
        mentionedUsers: [mentionedUser]
      }
    ]
    const contactsMap: IContactsMap = {
      [mentionedUser.id]: {
        id: mentionedUser.id,
        firstName: 'Alice',
        lastName: 'Anderson',
        keys: [],
        user: mentionedUser
      }
    }
    renderPopup({ forwardMessages, contactsMap })

    selectChannel('Jordyn Aminoff')

    expect(screen.getByText('@Alice Anderson')).toBeInTheDocument()
    expect(screen.queryByText(body)).not.toBeInTheDocument()
  })

  it('shows a "+N more" suffix based on the first message when forwarding several messages', () => {
    const forwardMessages: IForwardPreviewMessage[] = [
      { body: 'first message' },
      { attachments: [makeAttachment({ type: attachmentTypes.image })] },
      { attachments: [makeAttachment({ type: attachmentTypes.video })] }
    ]
    renderPopup({ forwardMessages })

    selectChannel('Jordyn Aminoff')

    expect(screen.getByText('first message')).toBeInTheDocument()
    expect(screen.getByText(/\+2 more/)).toBeInTheDocument()
  })

  it('sends the typed note and opens the only selected channel', async () => {
    const channel = makeChannel({ id: 'chan-1', subject: 'Jordyn Aminoff' })
    const { handleForward, togglePopup, dispatch } = renderPopup({ channels: [channel] })

    selectChannel('Jordyn Aminoff')
    fireEvent.change(screen.getByPlaceholderText('Write a message'), { target: { value: 'hello team' } })
    fireEvent.click(screen.getByRole('button', { name: 'Forward' }))

    expect(handleForward).toHaveBeenCalledTimes(1)
    const [channelIds, note] = handleForward.mock.calls[0]
    expect(channelIds).toEqual(['chan-1'])
    expect(note).toEqual(
      expect.objectContaining({
        body: 'hello team',
        type: 'text'
      })
    )
    await act(async () => {
      await Promise.resolve()
    })
    expect(togglePopup).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: switchChannelActionAC(channel).type,
        payload: expect.objectContaining({ channel, openAtLatest: true })
      })
    )
  })

  it('keeps the current channel when forwarding to several channels', async () => {
    const channels = [
      makeChannel({ id: 'chan-1', subject: 'Design Team' }),
      makeChannel({ id: 'chan-2', subject: 'Marketing' })
    ]
    const { handleForward, togglePopup, dispatch } = renderPopup({ channels })

    selectChannel('Design Team')
    selectChannel('Marketing')
    fireEvent.click(screen.getByRole('button', { name: 'Forward' }))

    expect(handleForward).toHaveBeenCalledWith(['chan-1', 'chan-2'], undefined)
    await act(async () => {
      await Promise.resolve()
    })
    expect(togglePopup).toHaveBeenCalledTimes(1)
    expectNoChannelSwitch(dispatch)
  })

  it('waits for an async forward before opening its destination', async () => {
    let finishForward!: (result: boolean) => void
    const channel = makeChannel({ id: 'chan-1', subject: 'Jordyn Aminoff' })
    const { handleForward, togglePopup, dispatch } = renderPopup({ channels: [channel] })
    handleForward.mockReturnValue(
      new Promise<boolean>((resolve) => {
        finishForward = resolve
      })
    )

    selectChannel('Jordyn Aminoff')
    fireEvent.click(screen.getByRole('button', { name: 'Forward' }))

    expectNoChannelSwitch(dispatch)
    await act(async () => {
      finishForward(true)
      await Promise.resolve()
    })
    expect(togglePopup).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith(switchChannelActionAC(channel, true, true))
  })

  it('does not open a destination when forwarding fails', async () => {
    const channel = makeChannel({ id: 'chan-1', subject: 'Jordyn Aminoff' })
    const { handleForward, togglePopup, dispatch } = renderPopup({ channels: [channel] })
    handleForward.mockResolvedValue(false)

    selectChannel('Jordyn Aminoff')
    fireEvent.click(screen.getByRole('button', { name: 'Forward' }))

    await act(async () => {
      await Promise.resolve()
    })
    expect(togglePopup).toHaveBeenCalledTimes(1)
    expectNoChannelSwitch(dispatch)
  })

  it('allows link sharing to keep the current channel', async () => {
    const channel = makeChannel({ id: 'chan-1', subject: 'Jordyn Aminoff' })
    const { togglePopup, dispatch } = renderPopup({ channels: [channel], navigateOnSingleForward: false })

    selectChannel('Jordyn Aminoff')
    fireEvent.click(screen.getByRole('button', { name: 'Forward' }))

    await act(async () => {
      await Promise.resolve()
    })
    expect(togglePopup).toHaveBeenCalledTimes(1)
    expectNoChannelSwitch(dispatch)
  })

  it('does not reopen a chat that is already active', async () => {
    const channel = makeChannel({ id: 'chan-1', subject: 'Jordyn Aminoff' })
    const { store, togglePopup, dispatch } = renderPopup({ channels: [channel] })
    act(() => {
      store.dispatch(setActiveChannelAC(channel))
    })

    selectChannel('Jordyn Aminoff')
    fireEvent.click(screen.getByRole('button', { name: 'Forward' }))

    await act(async () => {
      await Promise.resolve()
    })
    expect(togglePopup).toHaveBeenCalledTimes(1)
    expectNoChannelSwitch(dispatch)
  })

  it('sends with no note when the textarea is left empty', () => {
    const { handleForward } = renderPopup()

    selectChannel('Jordyn Aminoff')
    fireEvent.click(screen.getByRole('button', { name: 'Forward' }))

    expect(handleForward).toHaveBeenCalledWith(['chan-1'], undefined)
  })

  it('forwards without a note on Enter from the popup outside the note field', async () => {
    const { handleForward, togglePopup } = renderPopup()

    selectChannel('Jordyn Aminoff')
    expect(screen.getByPlaceholderText('Write a message')).not.toHaveFocus()
    expect(document.activeElement).toContainElement(screen.getByText('Forward message'))
    fireEvent.keyDown(document.activeElement as Element, { key: 'Enter' })

    expect(handleForward).toHaveBeenCalledTimes(1)
    expect(handleForward).toHaveBeenCalledWith(['chan-1'], undefined)
    await act(async () => {
      await Promise.resolve()
    })
    expect(togglePopup).toHaveBeenCalledTimes(1)
  })

  it('does not forward on Enter in the channel search field', () => {
    const { handleForward } = renderPopup()

    selectChannel('Jordyn Aminoff')
    const search = screen.getByPlaceholderText('Search for channels')
    search.focus()
    fireEvent.change(search, { target: { value: 'another chat' } })
    fireEvent.keyDown(search, { key: 'Enter' })

    expect(handleForward).not.toHaveBeenCalled()
  })

  it('forwards after clicking a non-input part of the popup', () => {
    const { handleForward } = renderPopup()

    selectChannel('Jordyn Aminoff')
    screen.getByPlaceholderText('Search for channels').focus()
    fireEvent.click(screen.getByText('Forward message'))
    expect(screen.getByPlaceholderText('Search for channels')).not.toHaveFocus()
    fireEvent.keyDown(document.activeElement as Element, { key: 'Enter' })

    expect(handleForward).toHaveBeenCalledWith(['chan-1'], undefined)
  })

  it('does not forward on Enter outside the popup', () => {
    const { handleForward } = renderPopup()

    selectChannel('Jordyn Aminoff')
    fireEvent.keyDown(document.body, { key: 'Enter' })

    expect(handleForward).not.toHaveBeenCalled()
  })

  it('does not forward on Enter before a channel is selected', () => {
    const { handleForward } = renderPopup()

    fireEvent.keyDown(screen.getByText('Forward message'), { key: 'Enter' })

    expect(handleForward).not.toHaveBeenCalled()
  })

  it('forwards the typed note on Enter and keeps Shift+Enter for a new line', async () => {
    const { handleForward, togglePopup } = renderPopup()

    selectChannel('Jordyn Aminoff')
    const textarea = screen.getByPlaceholderText('Write a message')
    fireEvent.change(textarea, { target: { value: 'hello team' } })

    expect(fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })).toBe(true)
    expect(handleForward).not.toHaveBeenCalled()

    expect(fireEvent.keyDown(textarea, { key: 'Enter' })).toBe(false)
    expect(handleForward).toHaveBeenCalledWith(
      ['chan-1'],
      expect.objectContaining({ body: 'hello team', type: 'text' })
    )
    await act(async () => {
      await Promise.resolve()
    })
    expect(togglePopup).toHaveBeenCalledTimes(1)
  })

  it('grows the note textarea with its content, capped at 3 lines', () => {
    renderPopup()
    selectChannel('Jordyn Aminoff')

    const textarea = screen.getByPlaceholderText('Write a message') as HTMLTextAreaElement

    setScrollHeight(textarea, 40)
    fireEvent.change(textarea, { target: { value: 'line one\nline two' } })
    expect(textarea.style.height).toBe('40px')

    setScrollHeight(textarea, 200)
    fireEvent.change(textarea, { target: { value: 'line one\nline two\nline three\nline four' } })
    expect(textarea.style.height).toBe(NOTE_INPUT_MAX_HEIGHT_PX)

    // A single empty line reports a scrollHeight of one line, same as a real browser would.
    setScrollHeight(textarea, 20)
    fireEvent.change(textarea, { target: { value: '' } })
    expect(textarea.style.height).toBe(NOTE_INPUT_MIN_HEIGHT_PX)
  })

  it('opens the mention dropdown and inserts a mention when exactly one channel is selected', () => {
    const channels = [
      makeChannel({
        id: 'chan-1',
        subject: 'Design Team',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        members: makeMentionMembers()
      })
    ]
    renderPopup({ channels })

    selectChannel('Design Team')
    const textarea = screen.getByPlaceholderText('Write a message') as HTMLTextAreaElement

    fireEvent.change(textarea, { target: { value: '@ali', selectionStart: 4 } })

    expect(screen.getByText('Alice Anderson')).toBeInTheDocument()
    expect(screen.queryByText('Bob Baker')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Alice Anderson'))

    expect(textarea).toHaveValue('@Alice Anderson')
    expect(screen.queryByText('Alice Anderson')).not.toBeInTheDocument()

    // The inserted mention is rendered as a highlighted span in the overlay behind the textarea
    // (its wrapper matches the same text since the mention is the note's only content, hence AllBy).
    const mentionSpan = screen.getAllByText('@Alice Anderson').find((element) => element.tagName === 'SPAN')
    expect(mentionSpan).toBeInTheDocument()
  })

  it('shows each mention candidate with its online status, laid out as in the chat input mention list', () => {
    const lastActiveAt = new Date(Date.now() - 5 * 60 * 1000)
    const channels = [
      makeChannel({
        id: 'chan-1',
        subject: 'Design Team',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        members: [
          { ...makeUser({ id: 'current-user' }), role: 'owner' },
          {
            ...makeUser({ id: 'alice', firstName: 'Alice', lastName: 'Anderson' }),
            presence: { state: USER_PRESENCE_STATUS.ONLINE, status: '', lastActiveAt: new Date() },
            role: 'member'
          },
          {
            ...makeUser({ id: 'bob', firstName: 'Bob', lastName: 'Baker' }),
            presence: { state: USER_PRESENCE_STATUS.OFFLINE, status: '', lastActiveAt },
            role: 'member'
          }
        ] as any
      })
    ]
    renderPopup({ channels })

    selectChannel('Design Team')
    fireEvent.change(screen.getByPlaceholderText('Write a message'), { target: { value: '@', selectionStart: 1 } })

    const alice = screen.getByRole('option', { name: /Alice Anderson/ })
    const bob = screen.getByRole('option', { name: /Bob Baker/ })
    expect(alice).toHaveTextContent('Online')
    expect(bob).toHaveTextContent('Last seen 5 minutes ago')

    // Design: a 300px list with 8px vertical padding, 52px rows, 36px avatars, 16px names.
    const list = screen.getByRole('listbox')
    expect(getComputedStyle(list)).toMatchObject({ width: '300px', paddingTop: '8px', paddingBottom: '8px' })
    expect(getComputedStyle(alice).height).toBe('52px')
    expect(getComputedStyle(screen.getByText('Alice Anderson')).fontSize).toBe('16px')
    // Rows are tagged so presence is subscribed only for the users on screen.
    expect(alice).toHaveAttribute('data-presence-user-id', 'alice')
  })

  describe('pasting into the note', () => {
    const openGroupNote = () => {
      const channels = [
        makeChannel({
          id: 'chan-1',
          subject: 'Design Team',
          type: DEFAULT_CHANNEL_TYPE.GROUP,
          members: makeMentionMembers()
        })
      ]
      const { handleForward } = renderPopup({ channels })
      selectChannel('Design Team')
      return { handleForward, textarea: screen.getByPlaceholderText('Write a message') as HTMLTextAreaElement }
    }

    const forwardedNote = (handleForward: jest.Mock) => {
      fireEvent.click(screen.getByRole('button', { name: 'Forward' }))
      return handleForward.mock.calls[0][1]
    }

    it('keeps a mention followed by a symbol when the note is cut and pasted back', () => {
      const { handleForward, textarea } = openGroupNote()
      fireEvent.change(textarea, { target: { value: '@ali', selectionStart: 4 } })
      fireEvent.click(screen.getByText('Alice Anderson'))
      fireEvent.change(textarea, { target: { value: '@Alice Anderson!' } })

      // Cut, then paste back: a text box puts only the text on the clipboard.
      fireEvent.change(textarea, { target: { value: '' } })
      fireEvent.paste(textarea)
      fireEvent.change(textarea, { target: { value: '@Alice Anderson!' } })

      const note = forwardedNote(handleForward)
      expect(note.bodyAttributes).toEqual([
        { type: 'mention', metadata: 'alice', offset: 0, length: '@Alice Anderson'.length }
      ])
      expect(note.mentionedUsers.map((user: { id: string }) => user.id)).toEqual(['alice'])
    })

    it('makes mentions of members named in pasted text, after the text already there', () => {
      const { handleForward, textarea } = openGroupNote()
      fireEvent.change(textarea, { target: { value: 'hi ' } })

      fireEvent.paste(textarea)
      fireEvent.change(textarea, { target: { value: 'hi @Bob Baker, @Alice Anderson.' } })

      const note = forwardedNote(handleForward)
      expect(note.bodyAttributes).toEqual([
        { type: 'mention', metadata: 'bob', offset: 3, length: '@Bob Baker'.length },
        { type: 'mention', metadata: 'alice', offset: 15, length: '@Alice Anderson'.length }
      ])
    })

    it('leaves a name typed by hand as plain text', () => {
      const { handleForward, textarea } = openGroupNote()

      fireEvent.change(textarea, { target: { value: '@Alice Anderson!' } })

      expect(forwardedNote(handleForward).bodyAttributes || []).toEqual([])
    })
  })

  it('does not open the mention dropdown when more than one channel is selected', () => {
    const channels = [
      makeChannel({
        id: 'chan-1',
        subject: 'Design Team',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        members: makeMentionMembers()
      }),
      makeChannel({ id: 'chan-2', subject: 'Marketing' })
    ]
    renderPopup({ channels })

    selectChannel('Design Team')
    selectChannel('Marketing')
    const textarea = screen.getByPlaceholderText('Write a message') as HTMLTextAreaElement

    fireEvent.change(textarea, { target: { value: '@ali', selectionStart: 4 } })

    expect(screen.queryByText('Alice Anderson')).not.toBeInTheDocument()
  })

  it('navigates mention candidates with arrow keys and inserts the highlighted one on Enter', () => {
    const channels = [
      makeChannel({
        id: 'chan-1',
        subject: 'Design Team',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        members: makeMentionMembers()
      })
    ]
    const { handleForward } = renderPopup({ channels })

    selectChannel('Design Team')
    const textarea = screen.getByPlaceholderText('Write a message') as HTMLTextAreaElement

    fireEvent.change(textarea, { target: { value: '@', selectionStart: 1 } })
    expect(screen.getByText('Alice Anderson')).toBeInTheDocument()
    expect(screen.getByText('Bob Baker')).toBeInTheDocument()

    fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    fireEvent.keyDown(textarea, { key: 'Enter' })

    expect(textarea).toHaveValue('@Bob Baker')
    expect(handleForward).not.toHaveBeenCalled()
  })

  describe('mention list and the note field focus', () => {
    // Puts the cursor at `position` in the focused note, as a click or an arrow key does.
    const moveCursor = (textarea: HTMLTextAreaElement, position: number) => {
      textarea.setSelectionRange(position, position)
      fireEvent.mouseUp(textarea)
    }

    const typeMentionQuery = () => {
      renderPopup({
        channels: [
          makeChannel({
            id: 'chan-1',
            subject: 'Design Team',
            type: DEFAULT_CHANNEL_TYPE.GROUP,
            members: makeMentionMembers()
          })
        ]
      })
      selectChannel('Design Team')
      const textarea = screen.getByPlaceholderText('Write a message') as HTMLTextAreaElement
      act(() => textarea.focus())
      fireEvent.change(textarea, { target: { value: 'hi @ali', selectionStart: 7 } })
      textarea.setSelectionRange(7, 7)
      expect(screen.getByText('Alice Anderson')).toBeInTheDocument()
      return textarea
    }

    it('hides the mention list when the note field loses focus', () => {
      const textarea = typeMentionQuery()

      act(() => textarea.blur())

      expect(screen.queryByText('Alice Anderson')).not.toBeInTheDocument()
    })

    it('shows the mention list again when the cursor is back in the note right after the @ query', () => {
      const textarea = typeMentionQuery()
      act(() => textarea.blur())
      expect(screen.queryByText('Alice Anderson')).not.toBeInTheDocument()

      act(() => textarea.focus())
      moveCursor(textarea, 7)

      expect(screen.getByText('Alice Anderson')).toBeInTheDocument()
    })

    it('hides the mention list when the cursor moves away from the @ query', () => {
      const textarea = typeMentionQuery()

      moveCursor(textarea, 2)
      expect(screen.queryByText('Alice Anderson')).not.toBeInTheDocument()

      moveCursor(textarea, 7)
      expect(screen.getByText('Alice Anderson')).toBeInTheDocument()
    })

    it('does not reopen the mention list for a mention already inserted', () => {
      renderPopup({
        channels: [
          makeChannel({
            id: 'chan-1',
            subject: 'Design Team',
            type: DEFAULT_CHANNEL_TYPE.GROUP,
            // A one-word name: the cursor right after the inserted "@Cher" looks like an @ query.
            members: [
              ...makeMentionMembers(),
              { ...makeUser({ id: 'cher', firstName: 'Cher' }), lastName: '', role: 'member' }
            ] as any
          })
        ]
      })
      selectChannel('Design Team')
      const textarea = screen.getByPlaceholderText('Write a message') as HTMLTextAreaElement
      act(() => textarea.focus())
      fireEvent.change(textarea, { target: { value: '@che', selectionStart: 4 } })
      fireEvent.click(screen.getByText('Cher'))
      expect(textarea).toHaveValue('@Cher')

      moveCursor(textarea, 5)

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })
  })

  it('does not open the mention dropdown for a direct channel', () => {
    const channels = [
      makeChannel({
        id: 'chan-1',
        subject: 'Jordyn Aminoff',
        type: DEFAULT_CHANNEL_TYPE.DIRECT,
        members: makeMentionMembers()
      })
    ]
    renderPopup({ channels })

    selectChannel('Jordyn Aminoff')
    const textarea = screen.getByPlaceholderText('Write a message') as HTMLTextAreaElement

    fireEvent.change(textarea, { target: { value: '@ali', selectionStart: 4 } })

    expect(screen.queryByText('Alice Anderson')).not.toBeInTheDocument()
  })

  // P2: F2 - Double forward prevention
  // P2: a second click/Enter while a forward is still pending must not forward again.
  it('prevents a double forward while handleForward is still pending', async () => {
    const channel = makeChannel({ id: 'chan-1', subject: 'Jordyn Aminoff' })
    const { handleForward, togglePopup } = renderPopup({ channels: [channel] })
    // handleForward returns a never-resolving promise to simulate a slow network
    handleForward.mockReturnValue(new Promise(() => {}))

    selectChannel('Jordyn Aminoff')
    // First forward via button
    fireEvent.click(screen.getByRole('button', { name: 'Forward' }))
    // Second forward via Enter key while first is pending
    fireEvent.keyDown(document.activeElement as Element, { key: 'Enter' })
    // Third forward via button again
    fireEvent.click(screen.getByRole('button', { name: 'Forward' }))

    // handleForward should only have been called once
    expect(handleForward).toHaveBeenCalledTimes(1)
    // togglePopup should not have been called since forward is still pending
    expect(togglePopup).not.toHaveBeenCalled()
    // and the Forward button is disabled meanwhile
    expect(screen.getByRole('button', { name: 'Forward' })).toBeDisabled()
  })

  // P3: a rejected forward must not leave the popup stuck or navigate.
  it('closes the popup without navigating when handleForward rejects', async () => {
    const channel = makeChannel({ id: 'chan-1', subject: 'Jordyn Aminoff' })
    const { handleForward, togglePopup, dispatch } = renderPopup({ channels: [channel] })
    handleForward.mockRejectedValue(new Error('Network error'))

    selectChannel('Jordyn Aminoff')
    fireEvent.click(screen.getByRole('button', { name: 'Forward' }))

    await act(async () => {
      await Promise.resolve()
      // Allow rejection to propagate
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    // Popup should still close even on error
    expect(togglePopup).toHaveBeenCalledTimes(1)
    // No navigation should occur on error
    expectNoChannelSwitch(dispatch)
  })
})
