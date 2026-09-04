import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import ForwardMessagePopup, { IForwardPreviewMessage } from './index'
import {
  createMessageListStore,
  makeChannel,
  renderWithSceytProvider,
  resetMessageListFixtureIds
} from '../../../testUtils/messageListHarness'
import { attachmentTypes, LOADING_STATE } from '../../../helpers/constants'
import { IAttachment, IChannel } from '../../../types'

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
  ...props
}: Partial<React.ComponentProps<typeof ForwardMessagePopup>> & { channels?: IChannel[] } = {}) => {
  const handleForward = jest.fn()
  const togglePopup = jest.fn()

  const store = createMessageListStore({
    ChannelReducer: {
      channelsForForward: channels,
      channelsForForwardLoadingState: LOADING_STATE.LOADED,
      channelsForForwardHasNext: false,
      searchedChannelsForForward: { chats_groups: [], channels: [], contacts: [] }
    }
  })

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

  return { ...utils, handleForward, togglePopup, store }
}

const selectChannel = (subject: string) => fireEvent.click(screen.getByText(subject))

const setScrollHeight = (element: HTMLElement, value: number) =>
  Object.defineProperty(element, 'scrollHeight', { configurable: true, value })

describe('ForwardMessagePopup', () => {
  beforeEach(() => {
    resetMessageListFixtureIds()
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

  it('shows the generic file icon for a voice attachment, labeled Voice', () => {
    const forwardMessages: IForwardPreviewMessage[] = [
      { attachments: [makeAttachment({ type: attachmentTypes.voice })] }
    ]
    renderPopup({ forwardMessages })

    selectChannel('Jordyn Aminoff')

    expect(screen.getByText('choseFile.svg')).toBeInTheDocument()
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
            url: 'https://waafi.com/call/6f564464402045a580d92d047f2ec71d',
            metadata: JSON.stringify({ iur: 'https://img.example.com/thumb.png' })
          })
        ]
      }
    ]
    renderPopup({ forwardMessages })

    selectChannel('Jordyn Aminoff')

    const image = screen.getByAltText('Link preview') as HTMLImageElement
    expect(image.src).toBe('https://img.example.com/thumb.png')
    expect(screen.getByText('https://waafi.com/call/6f564464402045a580d92d047f2ec71d')).toBeInTheDocument()
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

  it('sends the typed note along with the selected channel and closes the popup', () => {
    const { handleForward, togglePopup } = renderPopup()

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
    expect(togglePopup).toHaveBeenCalledTimes(1)
  })

  it('sends with no note when the textarea is left empty', () => {
    const { handleForward } = renderPopup()

    selectChannel('Jordyn Aminoff')
    fireEvent.click(screen.getByRole('button', { name: 'Forward' }))

    expect(handleForward).toHaveBeenCalledWith(['chan-1'], undefined)
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
})
