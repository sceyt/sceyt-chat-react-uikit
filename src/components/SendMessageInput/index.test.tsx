import React from 'react'
import { act, fireEvent, screen } from '@testing-library/react'
import { setClient } from '../../common/client'
import { setActiveChannelAC } from '../../store/channel/actions'
import {
  createMessageListStore,
  makeChannel,
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
})
