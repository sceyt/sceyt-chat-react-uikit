import React from 'react'
import { screen } from '@testing-library/react'
import Message from './index'
import { DEFAULT_CHANNEL_TYPE, MESSAGE_DELIVERY_STATUS } from '../../helpers/constants'
import { CONNECTION_STATUS } from '../../store/user/constants'
import {
  createMessageListStore,
  makeChannel,
  makeMessage,
  makeUser,
  renderWithSceytProvider,
  resetMessageListFixtureIds
} from '../../testUtils/messageListHarness'

jest.mock('hooks', () => {
  const { THEME_COLORS } = require('../../UIHelper/constants')

  return {
    useDidUpdate: () => undefined,
    useOnScreen: () => true,
    useColor: () => ({
      [THEME_COLORS.ACCENT]: '#00aa88',
      [THEME_COLORS.BACKGROUND_SECTIONS]: '#ffffff',
      [THEME_COLORS.TEXT_PRIMARY]: '#111111',
      [THEME_COLORS.OUTGOING_MESSAGE_BACKGROUND]: '#dcf8c6',
      [THEME_COLORS.INCOMING_MESSAGE_BACKGROUND]: '#f1f1f1',
      [THEME_COLORS.TEXT_ON_PRIMARY]: '#ffffff',
      [THEME_COLORS.BORDER]: '#dddddd'
    })
  }
})

jest.mock('../Avatar', () => ({
  __esModule: true,
  default: ({ name }: { name?: string }) => <div data-testid='avatar'>{name || 'avatar'}</div>
}))

jest.mock('./MessageBody', () => ({
  __esModule: true,
  default: ({ message }: { message: { body?: string } }) => <div data-testid='message-body'>{message.body}</div>
}))

jest.mock('./MessageSelection', () => ({
  __esModule: true,
  default: () => null
}))

jest.mock('./MessageReactions', () => ({
  __esModule: true,
  default: ({ popupZIndex }: { popupZIndex?: number }) => (
    <div data-testid='message-reactions' data-popup-z-index={popupZIndex} />
  )
}))

jest.mock('./MessageStatusAndTime', () => ({
  __esModule: true,
  default: () => null
}))

jest.mock('./MessagePopups', () => ({
  __esModule: true,
  default: () => null
}))

describe('Message', () => {
  beforeEach(() => {
    resetMessageListFixtureIds()
  })

  it('does not repeat the avatar for later unread messages from the same user', () => {
    const channelId = 'channel-message-unread-grouping'
    const remoteUser = makeUser({
      id: 'remote-user-1',
      firstName: 'Waffi'
    })
    const readMessage = makeMessage({
      id: '1500',
      channelId,
      body: 'read-message',
      incoming: true,
      user: remoteUser
    })
    const firstUnread = makeMessage({
      id: '1501',
      channelId,
      body: 'first-unread',
      incoming: true,
      user: remoteUser
    })
    const secondUnread = makeMessage({
      id: '1502',
      channelId,
      body: 'second-unread',
      incoming: true,
      user: remoteUser
    })
    const channel = makeChannel({
      id: channelId,
      type: DEFAULT_CHANNEL_TYPE.GROUP,
      lastMessage: secondUnread
    })
    const store = createMessageListStore({
      ChannelReducer: {
        activeChannel: channel
      },
      MessageReducer: {
        unreadScrollTo: false
      }
    })

    renderWithSceytProvider(
      <>
        <Message
          message={firstUnread}
          channel={channel}
          stopScrolling={() => undefined}
          handleScrollToRepliedMessage={() => undefined}
          prevMessage={readMessage}
          nextMessage={secondUnread}
          isUnreadMessage
          startsUnreadSection
          unreadMessageId={firstUnread.id}
          isThreadMessage={false}
        />
        <Message
          message={secondUnread}
          channel={channel}
          stopScrolling={() => undefined}
          handleScrollToRepliedMessage={() => undefined}
          prevMessage={firstUnread}
          nextMessage={undefined as any}
          isUnreadMessage
          startsUnreadSection={false}
          unreadMessageId={firstUnread.id}
          isThreadMessage={false}
        />
      </>,
      { store }
    )

    expect(screen.getAllByTestId('avatar')).toHaveLength(1)
    expect(screen.getByText('first-unread')).toBeInTheDocument()
    expect(screen.getByText('second-unread')).toBeInTheDocument()
  })

  it('keeps same-sender pinned messages grouped across different days', () => {
    const channelId = 'channel-pinned-avatar-grouping'
    const remoteUser = makeUser({ id: 'remote-user-pinned', firstName: 'Waffi' })
    const firstPinnedMessage = makeMessage({
      id: '1503',
      channelId,
      body: 'first pinned',
      incoming: true,
      user: remoteUser,
      createdAt: new Date('2026-04-01T12:00:00.000Z')
    })
    const secondPinnedMessage = makeMessage({
      id: '1504',
      channelId,
      body: 'second pinned',
      incoming: true,
      user: remoteUser,
      createdAt: new Date('2026-04-02T12:00:00.000Z')
    })
    const channel = makeChannel({
      id: channelId,
      type: DEFAULT_CHANNEL_TYPE.GROUP,
      lastMessage: secondPinnedMessage
    })
    const store = createMessageListStore({ ChannelReducer: { activeChannel: channel } })

    renderWithSceytProvider(
      <>
        <Message
          message={firstPinnedMessage}
          channel={channel}
          stopScrolling={() => undefined}
          handleScrollToRepliedMessage={() => undefined}
          prevMessage={undefined as any}
          nextMessage={secondPinnedMessage}
          isThreadMessage={false}
          isPinnedMessagesList
          ifLatestAndHasNotPreview
        />
        <Message
          message={secondPinnedMessage}
          channel={channel}
          stopScrolling={() => undefined}
          handleScrollToRepliedMessage={() => undefined}
          prevMessage={firstPinnedMessage}
          nextMessage={undefined as any}
          isThreadMessage={false}
          isPinnedMessagesList
        />
      </>,
      { store }
    )

    expect(screen.getAllByTestId('avatar')).toHaveLength(1)
  })

  it('keeps same-user grouping when neighboring messages use different id shapes for the same user', () => {
    const channelId = 'channel-message-mixed-user-id-shapes'
    const readMessage = makeMessage({
      id: '1510',
      channelId,
      body: 'read-message',
      incoming: true,
      user: makeUser({ id: 77 as any, firstName: 'Waffi' })
    })
    const firstUnread = makeMessage({
      id: '1511',
      channelId,
      body: 'first-unread',
      incoming: true,
      user: makeUser({ id: '77' as any, firstName: 'Waffi' })
    })
    const secondUnread = makeMessage({
      id: '1512',
      channelId,
      body: 'second-unread',
      incoming: true,
      user: makeUser({ id: 77 as any, firstName: 'Waffi' })
    })
    const channel = makeChannel({
      id: channelId,
      type: DEFAULT_CHANNEL_TYPE.GROUP,
      lastMessage: secondUnread
    })
    const store = createMessageListStore({
      ChannelReducer: {
        activeChannel: channel
      },
      MessageReducer: {
        unreadScrollTo: false
      }
    })

    renderWithSceytProvider(
      <>
        <Message
          message={firstUnread}
          channel={channel}
          stopScrolling={() => undefined}
          handleScrollToRepliedMessage={() => undefined}
          prevMessage={readMessage}
          nextMessage={secondUnread}
          isUnreadMessage
          startsUnreadSection
          unreadMessageId={firstUnread.id}
          isThreadMessage={false}
        />
        <Message
          message={secondUnread}
          channel={channel}
          stopScrolling={() => undefined}
          handleScrollToRepliedMessage={() => undefined}
          prevMessage={firstUnread}
          nextMessage={undefined as any}
          isUnreadMessage
          startsUnreadSection={false}
          unreadMessageId={firstUnread.id}
          isThreadMessage={false}
        />
      </>,
      { store }
    )

    expect(screen.getAllByTestId('avatar')).toHaveLength(1)
  })

  it('queues read markers instead of dispatching one immediately per visible message', () => {
    const channelId = 'channel-message-read-queue'
    const queueReadMarker = jest.fn()
    const incomingMessage = makeMessage({
      id: '1601',
      channelId,
      body: 'incoming-visible',
      incoming: true
    })
    const channel = makeChannel({
      id: channelId,
      lastMessage: incomingMessage,
      newMessageCount: 3
    })
    const store = createMessageListStore({
      ChannelReducer: {
        activeChannel: channel
      },
      MessageReducer: {
        unreadScrollTo: false
      }
    })

    renderWithSceytProvider(
      <Message
        message={incomingMessage}
        channel={channel}
        stopScrolling={() => undefined}
        handleScrollToRepliedMessage={() => undefined}
        prevMessage={undefined as any}
        nextMessage={undefined as any}
        isUnreadMessage
        unreadMessageId={incomingMessage.id}
        queueReadMarker={queueReadMarker}
        connectionStatus={CONNECTION_STATUS.CONNECTED}
        isThreadMessage={false}
      />,
      { store }
    )

    expect(queueReadMarker).toHaveBeenCalledWith(channelId, incomingMessage.id)
  })

  it('does not queue read markers when row auto-read tracking is disabled', () => {
    const channelId = 'channel-message-read-disabled'
    const queueReadMarker = jest.fn()
    const incomingMessage = makeMessage({
      id: '1602',
      channelId,
      body: 'incoming-visible-disabled',
      incoming: true
    })
    const channel = makeChannel({
      id: channelId,
      lastMessage: incomingMessage,
      newMessageCount: 3
    })
    const store = createMessageListStore({
      ChannelReducer: {
        activeChannel: channel
      },
      MessageReducer: {
        unreadScrollTo: false
      }
    })

    renderWithSceytProvider(
      <Message
        message={incomingMessage}
        channel={channel}
        stopScrolling={() => undefined}
        handleScrollToRepliedMessage={() => undefined}
        prevMessage={undefined as any}
        nextMessage={undefined as any}
        isUnreadMessage
        unreadMessageId={incomingMessage.id}
        queueReadMarker={queueReadMarker}
        connectionStatus={CONNECTION_STATUS.CONNECTED}
        isThreadMessage={false}
        disableAutoReadTracking
      />,
      { store }
    )

    expect(queueReadMarker).not.toHaveBeenCalled()
  })

  it('does not add pinned-list rows to the active chat visibility map', () => {
    const channelId = 'channel-pinned-list-visibility'
    const pinnedMessage = makeMessage({
      id: '1604',
      channelId,
      body: 'pinned overlay message',
      incoming: true
    })
    const channel = makeChannel({ id: channelId, lastMessage: pinnedMessage })
    const store = createMessageListStore({
      ChannelReducer: { activeChannel: channel },
      MessageReducer: { unreadScrollTo: false }
    })

    const { unmount } = renderWithSceytProvider(
      <Message
        message={pinnedMessage}
        channel={channel}
        stopScrolling={() => undefined}
        handleScrollToRepliedMessage={() => undefined}
        prevMessage={undefined as any}
        nextMessage={undefined as any}
        isThreadMessage={false}
        isPinnedMessagesList
      />,
      { store }
    )

    expect(store.getState().MessageReducer.visibleMessagesMap[pinnedMessage.id!]).toBeUndefined()

    unmount()

    expect(store.getState().MessageReducer.visibleMessagesMap[pinnedMessage.id!]).toBeUndefined()
  })

  it('renders pinned-list reaction details above the pinned-list overlay', () => {
    const channelId = 'channel-pinned-list-reactions'
    const pinnedMessage = makeMessage({
      id: '1605',
      channelId,
      body: 'pinned reaction message',
      reactionTotals: [{ key: '👍', count: 1, score: 1 }]
    })
    const channel = makeChannel({ id: channelId, lastMessage: pinnedMessage })
    const store = createMessageListStore({
      ChannelReducer: { activeChannel: channel },
      MessageReducer: { unreadScrollTo: false }
    })

    renderWithSceytProvider(
      <Message
        message={pinnedMessage}
        channel={channel}
        stopScrolling={() => undefined}
        handleScrollToRepliedMessage={() => undefined}
        prevMessage={undefined as any}
        nextMessage={undefined as any}
        isThreadMessage={false}
        isPinnedMessagesList
      />,
      { store }
    )

    expect(screen.getByTestId('message-reactions')).toHaveAttribute('data-popup-z-index', '30')
  })

  it('does not queue read markers when browser tab is inactive', () => {
    const channelId = 'channel-message-read-tab-inactive'
    const queueReadMarker = jest.fn()
    const incomingMessage = makeMessage({
      id: '1603',
      channelId,
      body: 'incoming-visible-tab-inactive',
      incoming: true
    })
    const channel = makeChannel({
      id: channelId,
      lastMessage: incomingMessage,
      newMessageCount: 3
    })
    const store = createMessageListStore({
      ChannelReducer: {
        activeChannel: channel
      },
      MessageReducer: {
        unreadScrollTo: false
      }
    })

    renderWithSceytProvider(
      <Message
        message={incomingMessage}
        channel={channel}
        stopScrolling={() => undefined}
        handleScrollToRepliedMessage={() => undefined}
        prevMessage={undefined as any}
        nextMessage={undefined as any}
        isUnreadMessage
        unreadMessageId={incomingMessage.id}
        queueReadMarker={queueReadMarker}
        connectionStatus={CONNECTION_STATUS.CONNECTED}
        isThreadMessage={false}
        tabIsActive={false}
      />,
      { store }
    )

    expect(queueReadMarker).not.toHaveBeenCalled()
  })

  it('queues delivered markers for visible incoming messages that already have a read marker', () => {
    const channelId = 'channel-message-delivered-queue'
    const queueDeliveredMarker = jest.fn()
    const incomingMessage = makeMessage({
      id: '1701',
      channelId,
      body: 'incoming-read-marker',
      incoming: true,
      userMarkers: [{ name: MESSAGE_DELIVERY_STATUS.READ } as any]
    })
    const channel = makeChannel({
      id: channelId,
      lastMessage: incomingMessage
    })
    const store = createMessageListStore({
      ChannelReducer: {
        activeChannel: channel
      },
      MessageReducer: {
        unreadScrollTo: false
      }
    })

    renderWithSceytProvider(
      <Message
        message={incomingMessage}
        channel={channel}
        stopScrolling={() => undefined}
        handleScrollToRepliedMessage={() => undefined}
        prevMessage={undefined as any}
        nextMessage={undefined as any}
        isUnreadMessage
        unreadMessageId={incomingMessage.id}
        queueDeliveredMarker={queueDeliveredMarker}
        connectionStatus={CONNECTION_STATUS.CONNECTED}
        isThreadMessage={false}
      />,
      { store }
    )

    expect(queueDeliveredMarker).toHaveBeenCalledWith(channelId, incomingMessage.id)
  })
})
