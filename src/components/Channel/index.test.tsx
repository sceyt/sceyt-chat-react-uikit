import React from 'react'
import { act, screen } from '@testing-library/react'
import Channel from './index'
import { DEFAULT_CHANNEL_TYPE } from '../../helpers/constants'
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
  MessageStatusIcon: () => null,
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
