import React from 'react'
import { act, screen } from '@testing-library/react'
import Channel from './index'
import { attachmentTypes, DEFAULT_CHANNEL_TYPE } from '../../helpers/constants'
import { setClient } from '../../common/client'
import { updateChannelDataAC } from '../../store/channel/actions'
import { useSelector } from '../../store/hooks'
import { IChannel } from '../../types'
import {
  createMessageListStore,
  makeChannel,
  makeMessage,
  makeUser,
  renderWithSceytProvider,
  resetMessageListFixtureIds
} from '../../testUtils/messageListHarness'
import { removeDraftMessageFromMap, setDraftMessageToMap } from '../../helpers/messagesHalper'

jest.mock('../../hooks', () => ({
  useColor: () => {
    const { THEME_COLORS } = require('../../UIHelper/constants')

    return {
      [THEME_COLORS.ACCENT]: '#00aa88',
      [THEME_COLORS.TEXT_PRIMARY]: '#111111',
      [THEME_COLORS.BACKGROUND_HOVERED]: '#f4f4f4',
      [THEME_COLORS.TEXT_SECONDARY]: '#666666',
      [THEME_COLORS.SURFACE_2]: '#dddddd',
      [THEME_COLORS.WARNING]: '#c96f00',
      [THEME_COLORS.ICON_PRIMARY]: '#222222',
      [THEME_COLORS.ONLINE_STATUS]: '#00cc66',
      [THEME_COLORS.BACKGROUND_FOCUSED]: '#e8f5ef',
      [THEME_COLORS.ICON_INACTIVE]: '#999999',
      [THEME_COLORS.TEXT_ON_PRIMARY]: '#ffffff',
      [THEME_COLORS.BACKGROUND]: '#ffffff'
    }
  }
}))

jest.mock('../../hooks/useUpdatePresence', () => ({
  __esModule: true,
  default: () => undefined
}))

jest.mock('../Avatar', () => ({
  __esModule: true,
  default: ({ name }: { name?: string }) => <div data-testid='channel-avatar'>{name || 'avatar'}</div>
}))

jest.mock('../../messageUtils', () => ({
  MessageStatusIcon: () => <span data-testid='message-status-icon' />,
  MessageTextFormat: ({ text }: { text?: string }) => text || null
}))

const ConnectedChannel = ({ channelId }: { channelId: string }) => {
  const channel = useSelector((state: any) =>
    state.ChannelReducer.channels.find((item: IChannel) => item.id === channelId)
  ) as IChannel | undefined

  if (!channel) {
    return null
  }

  return <Channel channel={channel} setSelectedChannel={() => undefined} doNotShowMessageDeliveryTypes={[]} />
}

describe('Channel unread badge', () => {
  beforeEach(() => {
    resetMessageListFixtureIds()
    setClient({
      user: makeUser({ id: 'current-user', firstName: 'Current' })
    })
  })

  it('removes the badge when channel unread state is cleared after reading', () => {
    const remoteUser = makeUser({ id: 'remote-user', firstName: 'Remote' })
    const channelId = 'channel-row-unread-badge'
    const lastMessage = makeMessage({
      id: '1701',
      channelId,
      body: 'latest incoming message',
      incoming: true,
      user: remoteUser
    })
    const channel = makeChannel({
      id: channelId,
      type: DEFAULT_CHANNEL_TYPE.DIRECT,
      lastMessage,
      unread: true,
      newMessageCount: 101,
      newMentionCount: 1,
      lastReceivedMsgId: lastMessage.id,
      lastDisplayedMessageId: '1700'
    })
    const store = createMessageListStore({
      ChannelReducer: {
        channels: [channel]
      }
    })

    renderWithSceytProvider(<ConnectedChannel channelId={channelId} />, { store })

    expect(screen.getByText('99+')).toBeInTheDocument()

    act(() => {
      store.dispatch(
        updateChannelDataAC(channelId, {
          unread: false,
          newMessageCount: 0,
          newMentionCount: 0,
          lastDisplayedMessageId: lastMessage.id
        })
      )
    })

    expect(screen.queryByText('99+')).not.toBeInTheDocument()
  })
})

describe('Channel draft preview', () => {
  const channelId = 'channel-row-draft'

  beforeEach(() => {
    resetMessageListFixtureIds()
    setClient({
      user: makeUser({ id: 'current-user', firstName: 'Current' })
    })
  })

  afterEach(() => {
    removeDraftMessageFromMap(channelId)
  })

  const renderOwnLastMessageChannel = (channelOverrides: Partial<IChannel> = {}) => {
    const currentUser = makeUser({ id: 'current-user', firstName: 'Current' })
    const lastMessage = makeMessage({
      id: '1801',
      channelId,
      body: 'my sent message',
      incoming: false,
      user: currentUser
    })
    const channel = makeChannel({
      id: channelId,
      type: DEFAULT_CHANNEL_TYPE.DIRECT,
      lastMessage,
      lastReceivedMsgId: lastMessage.id,
      lastDisplayedMessageId: lastMessage.id,
      ...channelOverrides
    })
    const store = createMessageListStore({
      ChannelReducer: {
        channels: [channel]
      }
    })
    return renderWithSceytProvider(<ConnectedChannel channelId={channelId} />, { store })
  }

  it('shows the delivery status of an own last message when there is no draft', () => {
    renderOwnLastMessageChannel()

    expect(screen.getByTestId('message-status-icon')).toBeInTheDocument()
    expect(screen.queryByText('Draft')).not.toBeInTheDocument()
  })

  it('hides the last message delivery status while a draft is previewed', () => {
    setDraftMessageToMap(channelId, { text: 'unsent draft text', mentionedUsers: [] })

    renderOwnLastMessageChannel()

    expect(screen.getByText('Draft')).toBeInTheDocument()
    expect(screen.getByText('unsent draft text')).toBeInTheDocument()
    expect(screen.queryByTestId('message-status-icon')).not.toBeInTheDocument()
  })

  it('shows the latest message instead of a draft while the channel has unread messages', () => {
    setDraftMessageToMap(channelId, { text: 'unsent draft text', mentionedUsers: [] })

    renderOwnLastMessageChannel({ unread: true, newMessageCount: 1 })

    expect(screen.queryByText('Draft')).not.toBeInTheDocument()
    expect(screen.queryByText('unsent draft text')).not.toBeInTheDocument()
    expect(screen.getByText('my sent message')).toBeInTheDocument()
  })

  it('renders attachment-only drafts with the same attachment label as a last message', () => {
    setDraftMessageToMap(channelId, {
      text: '',
      mentionedUsers: [],
      attachments: [{ type: attachmentTypes.image, data: new File(['image'], 'photo.png', { type: 'image/png' }) }]
    })

    renderOwnLastMessageChannel()

    expect(screen.getByText('Draft')).toBeInTheDocument()
    expect(screen.getByText('Photo')).toBeInTheDocument()
    expect(screen.queryByTestId('message-status-icon')).not.toBeInTheDocument()
  })

  it.each([
    [attachmentTypes.video, 'Video'],
    [attachmentTypes.file, 'File'],
    [attachmentTypes.voice, 'Voice']
  ])('renders an attachment-only %s draft as %s', (type, expectedLabel) => {
    setDraftMessageToMap(channelId, {
      text: '',
      mentionedUsers: [],
      attachments: [{ type, data: new File(['attachment'], 'attachment', { type: 'application/octet-stream' }) }]
    })

    renderOwnLastMessageChannel()

    expect(screen.getByText('Draft')).toBeInTheDocument()
    expect(screen.getByText(expectedLabel)).toBeInTheDocument()
  })

  it('shows draft text instead of an attachment label when the draft has both', () => {
    setDraftMessageToMap(channelId, {
      text: 'Photo caption draft',
      mentionedUsers: [],
      attachments: [{ type: attachmentTypes.image, data: new File(['image'], 'photo.png', { type: 'image/png' }) }]
    })

    renderOwnLastMessageChannel()

    expect(screen.getByText('Photo caption draft')).toBeInTheDocument()
    expect(screen.queryByText('Photo')).not.toBeInTheDocument()
  })

  it('shows an edit draft in the channel list', () => {
    setDraftMessageToMap(channelId, {
      text: 'Edited but unsent text',
      mentionedUsers: [],
      messageToEdit: { id: 'message-to-edit', body: 'Original text' },
      editMessageText: 'Edited but unsent text'
    })

    renderOwnLastMessageChannel()

    expect(screen.getByText('Draft')).toBeInTheDocument()
    expect(screen.getByText('Edited but unsent text')).toBeInTheDocument()
  })
})
