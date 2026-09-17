import React from 'react'
import { act, fireEvent, screen } from '@testing-library/react'
import { setClient } from '../../common/client'
import { setActiveChannelAC } from '../../store/channel/actions'
import { addSelectedMessageAC, setPinnedMessagesListOpenAC } from '../../store/message/actions'
import { SEND_MESSAGE } from '../../store/message/constants'
import { attachmentTypes } from '../../helpers/constants'
import {
  createMessageListStore,
  makeChannel,
  makeMessage,
  makeUser,
  renderWithSceytProvider
} from '../../testUtils/messageListHarness'

jest.mock('../../helpers/messagesHalper', () => {
  const drafts: Record<string, any> = {}
  return {
    __drafts: drafts,
    areDraftMessagesHydrated: () => true,
    checkDraftMessagesIsEmpty: () => Object.keys(drafts).length === 0,
    deleteVideoThumb: jest.fn(),
    draftMessagesMap: drafts,
    getAudioRecordingFromMap: jest.fn(),
    getDraftMessageFromMap: (channelId: string) => drafts[channelId],
    removeDraftMessageFromMap: (channelId: string) => delete drafts[channelId],
    setDraftMessageToMap: (channelId: string, draft: any) => {
      drafts[channelId] = draft
    },
    setPendingAttachment: jest.fn(),
    setSendMessageHandler: jest.fn(),
    subscribeToDraftMessages: () => () => undefined
  }
})

jest.mock('../../hooks', () => ({
  useColor: () => ({
    accent: '#00aa88',
    backgroundSections: '#ffffff',
    surface1: '#ffffff',
    surface2: '#eeeeee',
    textPrimary: '#111111',
    textSecondary: '#666666',
    iconInactive: '#999999',
    warning: '#c96f00',
    backgroundHovered: '#f4f4f4',
    background: '#ffffff',
    textFootnote: '#666666',
    highlightedBackground: '#e8f5ef',
    textOnPrimary: '#ffffff',
    tooltipBackground: '#111111',
    border: '#dddddd'
  }),
  useDidUpdate: () => undefined
}))

jest.mock('../../hooks/usePermissions', () => ({
  __esModule: true,
  default: () => [() => true]
}))

jest.mock('./FormatMessagePlugin', () => ({
  __esModule: true,
  default: ({ setMessageText }: { setMessageText: (text: string) => void }) => (
    <button data-testid='type-user-a-draft' onClick={() => setMessageText('Draft for User A')}>
      Type draft
    </button>
  )
}))

jest.mock('./MentionsPlugin', () => ({ __esModule: true, default: () => null }))
jest.mock('./FloatingTextFormatToolbarPlugin', () => ({ __esModule: true, default: () => null }))
jest.mock('./EditMessagePlugin', () => ({ __esModule: true, default: () => null }))
jest.mock('./EmojisPlugin', () => ({ __esModule: true, default: () => null }))
jest.mock('./RecordingAnimation', () => ({ __esModule: true, default: () => null }))
jest.mock('./Poll/CreatePollPopup', () => ({ __esModule: true, default: () => null }))
jest.mock('../Attachment', () => ({
  __esModule: true,
  default: () => null,
  AttachmentFile: () => null,
  AttachmentImg: () => null
}))
jest.mock('../AudioRecord', () => ({ __esModule: true, default: () => null }))
jest.mock('../../common/dropdown', () => ({ __esModule: true, default: () => null }))
jest.mock('../../common/popups/delete', () => ({ __esModule: true, default: () => null }))
jest.mock('../../common/popups/forwardMessage', () => ({ __esModule: true, default: () => null }))

jest.mock('../../helpers/videoConversion', () => ({
  remuxVideoFileForUpload: jest.fn((file: File) => Promise.resolve(file))
}))

jest.mock('../../helpers/getVideoFrame', () => ({
  getFrame: jest.fn(() =>
    Promise.resolve({
      thumb: 'data:image/jpeg;base64,thumb',
      width: 1280,
      height: 720,
      duration: 3,
      frameBlobUrl: 'blob:video-thumb',
      blob: new Blob(['thumb'], { type: 'image/jpeg' })
    })
  )
}))

jest.mock('@lexical/react/LexicalComposer', () => ({
  LexicalComposer: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))
jest.mock('@lexical/react/LexicalComposerContext', () => ({
  useLexicalComposerContext: () => [
    {
      focus: jest.fn(),
      update: jest.fn(),
      dispatchCommand: jest.fn(),
      setEditorState: jest.fn()
    }
  ]
}))
jest.mock('@lexical/react/LexicalContentEditable', () => ({ ContentEditable: () => <div /> }))
jest.mock('@lexical/react/LexicalRichTextPlugin', () => ({ RichTextPlugin: () => null }))
jest.mock('@lexical/react/LexicalErrorBoundary', () => () => null)
jest.mock('@lexical/react/LexicalOnChangePlugin', () => ({ OnChangePlugin: () => null }))
jest.mock('@lexical/react/LexicalHistoryPlugin', () => ({ HistoryPlugin: () => null }))
jest.mock('lexical', () => ({
  $createParagraphNode: jest.fn(),
  $createTextNode: jest.fn(),
  $getRoot: jest.fn(),
  $getSelection: jest.fn(),
  FORMAT_TEXT_COMMAND: 'format'
}))
jest.mock('./MentionNode', () => ({ MentionNode: class MentionNode {} }))

const SendMessageInput = require('./index').default
const mockDrafts: Record<string, any> = require('../../helpers/messagesHalper').__drafts

describe('SendMessageInput draft ownership', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: () => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() })
    })
  })

  beforeEach(() => {
    Object.keys(mockDrafts).forEach((channelId) => delete mockDrafts[channelId])
    setClient({ user: makeUser({ id: 'current-user' }) })
  })

  it('does not show or save User A draft in User B after a tab-focus rerender', async () => {
    const userA = makeChannel({ id: 'user-a' })
    const userB = makeChannel({ id: 'user-b' })
    const store = createMessageListStore({ ChannelReducer: { activeChannel: userA } })
    const view = renderWithSceytProvider(<SendMessageInput />, { store })

    fireEvent.click(screen.getByTestId('type-user-a-draft'))
    await act(async () => undefined)
    expect(mockDrafts['user-a']?.text).toBe('Draft for User A')

    act(() => {
      store.dispatch(setActiveChannelAC(userB))
    })

    // Match the app update caused when the browser tab becomes active again.
    view.rerender(<SendMessageInput />)

    expect(mockDrafts['user-a']?.text).toBe('Draft for User A')
    expect(mockDrafts['user-b']).toBeUndefined()
  })

  it('keeps Forward and Delete visible when a pinned-list message is selected', () => {
    const channel = makeChannel({ id: 'pinned-selection-channel' })
    const message = makeMessage({ id: 'pinned-selection-message', channelId: channel.id, body: 'Selected pin' })
    const store = createMessageListStore({ ChannelReducer: { activeChannel: channel } })

    renderWithSceytProvider(<SendMessageInput />, { store })

    act(() => {
      store.dispatch(setPinnedMessagesListOpenAC(true))
      store.dispatch(addSelectedMessageAC(message))
    })

    expect(screen.getByText('Forward')).toBeVisible()
    expect(screen.getByText('Delete')).toBeVisible()
  })
})

describe('SendMessageInput attachment sending', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: () => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() })
    })
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: jest.fn(() => 'blob:compose-video')
    })
  })

  beforeEach(() => {
    setClient({ user: makeUser({ id: 'current-user' }) })
    require('../../helpers/videoConversion').remuxVideoFileForUpload.mockImplementation((file: File) =>
      Promise.resolve(file)
    )
    require('../../helpers/getVideoFrame').getFrame.mockResolvedValue({
      thumb: 'data:image/jpeg;base64,thumb',
      width: 1280,
      height: 720,
      duration: 3,
      frameBlobUrl: 'blob:video-thumb',
      blob: new Blob(['thumb'], { type: 'image/jpeg' })
    })
  })

  it('keeps a video selected through the File picker as a file attachment', async () => {
    const channel = makeChannel({ id: 'video-file-channel' })
    const store = createMessageListStore({ ChannelReducer: { activeChannel: channel } })
    const dispatchedActions: any[] = []
    const dispatch = store.dispatch.bind(store)
    jest.spyOn(store, 'dispatch').mockImplementation((action: any) => {
      dispatchedActions.push(action)
      return dispatch(action)
    })
    const { container } = renderWithSceytProvider(
      <SendMessageInput CustomSendMessageButton={<button data-testid='send-message'>Send</button>} />,
      { store }
    )
    const video = new File(['video'], 'clip.mp4', { type: 'video/mp4' })
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    fireEvent.change(fileInput, { target: { files: [video], accept: '' } })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('send-message'))
      await Promise.resolve()
    })

    const sendAction = dispatchedActions.find((action) => action.type === SEND_MESSAGE)
    expect(sendAction).toBeDefined()
    expect(sendAction.payload.channelId).toBe(channel.id)
    expect(sendAction.payload.message.attachments).toHaveLength(1)
    expect(sendAction.payload.message.attachments[0].name).toBe('clip.mp4')
    expect(sendAction.payload.message.attachments[0].type).toBe(attachmentTypes.file)
    expect(sendAction.payload.message.attachments[0].data).toBe(video)
  })
})
