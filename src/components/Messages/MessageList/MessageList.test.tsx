import React from 'react'
import { act, fireEvent, screen } from '@testing-library/react'
import MessageList from './index'
import { CONNECTION_STATUS } from '../../../store/user/constants'
import {
  addMessageAC,
  addMessagesAC,
  loadDefaultMessagesAC,
  loadLatestMessagesAC,
  loadNearUnreadAC,
  setLoadingNextMessagesStateAC,
  setLoadingPrevMessagesStateAC,
  setMessagesAC,
  setMessagesHasNextAC,
  setUnreadMessageIdAC,
  updateMessageAC
} from '../../../store/message/actions'
import { MESSAGE_LOAD_DIRECTION } from '../../../helpers/messagesHalper'
import { LOADING_STATE, MESSAGE_DELIVERY_STATUS } from '../../../helpers/constants'
import {
  createMessageListStore,
  flushAnimationFrames,
  makeChannel,
  makeMessage,
  makePendingMessage,
  renderWithSceytProvider,
  resetMessageListFixtureIds,
  setScrollMetrics
} from '../../../testUtils/messageListHarness'
import {
  registerJumpToLatest,
  registerMessageListNavigator,
  unregisterJumpToLatest,
  unregisterMessageListNavigator
} from '../../../helpers/messageListNavigator'
import { markMessagesAsReadAC, updateChannelDataAC } from '../../../store/channel/actions'
import { setConnectionStatusAC } from '../../../store/user/actions'
import { resetMockServerDelay, resolveWithMockServerDelay } from '../../../testUtils/mockServerDelay'
import { DEFAULT_MARKER_BATCH_DEBOUNCE_MS } from '../../../helpers/messageMarkerBatcher'

jest.mock('../../Message', () => {
  const React = require('react')

  return function MockMessage({
    message,
    channel,
    queueReadMarker,
    setLastVisibleMessageId,
    isUnreadMessage,
    startsUnreadSection
  }: any) {
    React.useEffect(() => {
      if (message.__queueReadOnMount && queueReadMarker && message.id) {
        queueReadMarker(channel.id, message.id)
      }

      if (message.__setVisibleOnMount && setLastVisibleMessageId) {
        setLastVisibleMessageId(message)
      }
    }, [channel?.id, message, queueReadMarker, setLastVisibleMessageId])

    return React.createElement(
      'div',
      {
        'data-testid': 'message-row',
        'data-message-id': message.id || '',
        'data-message-tid': message.tid || '',
        'data-message-markers': (message.userMarkers || []).map((marker: any) => marker.name).join(','),
        'data-message-edited': String(Boolean(message.updatedAt)),
        'data-message-incoming': String(Boolean(message.incoming)),
        'data-message-is-unread': String(Boolean(isUnreadMessage)),
        'data-message-starts-unread': String(Boolean(startsUnreadSection))
      },
      message.body
    )
  }
})

jest.mock('../SystemMessage', () => {
  const React = require('react')

  return function MockSystemMessage({ message }: any) {
    return React.createElement(
      'div',
      {
        'data-testid': 'message-row',
        'data-message-id': message.id || '',
        'data-message-tid': message.tid || '',
        'data-message-markers': (message.userMarkers || []).map((marker: any) => marker.name).join(','),
        'data-message-edited': String(Boolean(message.updatedAt)),
        'data-message-incoming': String(Boolean(message.incoming))
      },
      message.body
    )
  }
})

jest.mock('../../../common/popups/sliderPopup', () => () => null)

jest.mock('../../MessageDivider', () => {
  const React = require('react')

  return function MockMessageDivider({ dividerText, unread }: any) {
    return React.createElement('div', { 'data-testid': unread ? 'unread-divider' : 'date-divider' }, dividerText)
  }
})

jest.mock('./ScrollToBottomButton', () => {
  const React = require('react')

  return function MockScrollToBottomButton({ show, count, onClick }: any) {
    return React.createElement(
      'button',
      { 'data-testid': 'scroll-to-bottom', 'data-show': String(show), onClick },
      count
    )
  }
})

jest.mock('./ScrollToUnreadMentionsButton', () => {
  const React = require('react')

  return function MockScrollToUnreadMentionsButton({ show, count }: any) {
    return React.createElement('div', { 'data-testid': 'scroll-to-mentions', 'data-show': String(show) }, count)
  }
})

jest.mock('../../../helpers/messageListNavigator', () => ({
  registerMessageListNavigator: jest.fn(),
  unregisterMessageListNavigator: jest.fn(),
  registerJumpToLatest: jest.fn(),
  unregisterJumpToLatest: jest.fn()
}))

const buildStore = (channel = makeChannel()) =>
  createMessageListStore({
    ChannelReducer: {
      activeChannel: channel
    },
    UserReducer: {
      connectionStatus: CONNECTION_STATUS.DISCONNECTED
    }
  })

const renderMessageList = (store: ReturnType<typeof createMessageListStore>) =>
  renderWithSceytProvider(React.createElement(MessageList), { store })

type DelayedMessageListResponse = {
  messages?: any[]
  hasNext?: boolean
}

const flushMockServerDelay = async () => {
  await act(async () => {
    await resolveWithMockServerDelay(null)
  })
}

const attachDelayedServerToMessageListStore = (
  store: ReturnType<typeof createMessageListStore>,
  handlers: {
    onLoadDefault?: (action: any) => DelayedMessageListResponse | Promise<DelayedMessageListResponse>
    onLoadLatest?: (action: any) => DelayedMessageListResponse | Promise<DelayedMessageListResponse>
  }
) => {
  const originalDispatch = store.dispatch.bind(store)
  const delayedDispatch = jest.fn((action: any) => {
    const result = originalDispatch(action)

    const scheduleResponse = async (
      resolver?: (action: any) => DelayedMessageListResponse | Promise<DelayedMessageListResponse>
    ) => {
      originalDispatch(setLoadingPrevMessagesStateAC(LOADING_STATE.LOADING))
      originalDispatch(setLoadingNextMessagesStateAC(LOADING_STATE.LOADING))
      const response = resolver ? await resolveWithMockServerDelay(null).then(() => resolver(action)) : {}

      if (response?.messages) {
        originalDispatch(setMessagesAC(response.messages, action.payload.channel.id))
      }
      if (typeof response?.hasNext === 'boolean') {
        originalDispatch(setMessagesHasNextAC(response.hasNext))
      }
      originalDispatch(setLoadingPrevMessagesStateAC(LOADING_STATE.LOADED))
      originalDispatch(setLoadingNextMessagesStateAC(LOADING_STATE.LOADED))
    }

    if (action.type === loadDefaultMessagesAC(action.payload.channel).type) {
      scheduleResponse(handlers.onLoadDefault).catch(() => undefined)
    }

    if (action.type === loadLatestMessagesAC(action.payload.channel).type) {
      scheduleResponse(handlers.onLoadLatest).catch(() => undefined)
    }

    return result
  })

  ;(store as any).dispatch = delayedDispatch
  return delayedDispatch
}

describe('MessageList', () => {
  beforeEach(() => {
    resetMessageListFixtureIds()
    resetMockServerDelay()
  })

  it('dispatches the default load flow for a normal channel', () => {
    const channel = makeChannel({
      id: 'channel-normal',
      lastMessage: makeMessage({
        id: '101',
        channelId: 'channel-normal',
        body: 'latest-normal'
      })
    })
    const store = buildStore(channel)
    const dispatchSpy = jest.spyOn(store, 'dispatch')

    const { unmount } = renderMessageList(store)

    expect(dispatchSpy).toHaveBeenCalledWith(loadDefaultMessagesAC(channel))
    expect(dispatchSpy).toHaveBeenCalledWith(setUnreadMessageIdAC(''))
    expect(registerMessageListNavigator).toHaveBeenCalledTimes(1)
    expect(registerJumpToLatest).toHaveBeenCalledTimes(1)

    act(() => {
      unmount()
    })

    expect(unregisterMessageListNavigator).toHaveBeenCalledTimes(1)
    expect(unregisterJumpToLatest).toHaveBeenCalledTimes(1)
  })

  it('dispatches the unread boot flow when the channel has unread messages', () => {
    const unreadAnchor = makeMessage({
      id: '240',
      channelId: 'channel-unread',
      body: 'unread-anchor'
    })
    const channel = makeChannel({
      id: 'channel-unread',
      lastMessage: unreadAnchor,
      newMessageCount: 4,
      lastDisplayedMessageId: unreadAnchor.id
    })
    const store = buildStore(channel)
    const dispatchSpy = jest.spyOn(store, 'dispatch')

    renderMessageList(store)

    expect(dispatchSpy).toHaveBeenCalledWith(loadNearUnreadAC(channel))
    expect(dispatchSpy).toHaveBeenCalledWith(setUnreadMessageIdAC(unreadAnchor.id))
  })

  it('renders date dividers and the unread divider from activeChannelMessages', () => {
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const yesterdayLabel = new Intl.DateTimeFormat('en', {
      month: 'long',
      day: 'numeric'
    }).format(yesterday)

    const olderMessage = makeMessage({
      id: '301',
      channelId: 'channel-dividers',
      body: 'older-message',
      createdAt: yesterday
    })
    const newerMessage = makeMessage({
      id: '302',
      channelId: 'channel-dividers',
      body: 'newer-message',
      createdAt: now,
      incoming: true
    })
    const channel = makeChannel({
      id: 'channel-dividers',
      lastMessage: newerMessage,
      newMessageCount: 1,
      lastDisplayedMessageId: olderMessage.id
    })
    const store = createMessageListStore({
      ChannelReducer: {
        activeChannel: channel
      },
      MessageReducer: {
        activeChannelMessages: [olderMessage, newerMessage],
        unreadMessageId: olderMessage.id
      },
      UserReducer: {
        connectionStatus: CONNECTION_STATUS.DISCONNECTED
      }
    })

    renderMessageList(store)

    expect(screen.getByText(yesterdayLabel)).toBeInTheDocument()
    expect(screen.getAllByText('Today')).toHaveLength(2)
    expect(screen.getByText('Unread Messages')).toBeInTheDocument()
  })

  it('keeps the unread divider anchored while unread count changes on the same open channel', async () => {
    const channelId = 'channel-unread-anchor-stable'
    const olderMessage = makeMessage({
      id: '351',
      channelId,
      body: 'older-message'
    })
    const unreadAnchor = makeMessage({
      id: '352',
      channelId,
      body: 'first-unread',
      incoming: true
    })
    const latestUnread = makeMessage({
      id: '353',
      channelId,
      body: 'latest-unread',
      incoming: true
    })
    const channel = makeChannel({
      id: channelId,
      lastMessage: latestUnread,
      newMessageCount: 100,
      lastDisplayedMessageId: unreadAnchor.id
    })
    const store = createMessageListStore({
      ChannelReducer: {
        activeChannel: channel
      },
      MessageReducer: {
        activeChannelMessages: [olderMessage, unreadAnchor, latestUnread],
        unreadMessageId: unreadAnchor.id
      },
      UserReducer: {
        connectionStatus: CONNECTION_STATUS.DISCONNECTED
      }
    })
    const dispatchSpy = jest.spyOn(store, 'dispatch')

    renderMessageList(store)

    expect(store.getState().MessageReducer.unreadMessageId).toBe(unreadAnchor.id)
    dispatchSpy.mockClear()

    await act(async () => {
      store.dispatch(
        updateChannelDataAC(
          channelId,
          {
            unread: true,
            newMessageCount: 99,
            lastDisplayedMessageId: latestUnread.id
          },
          true
        )
      )
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })

    expect(store.getState().MessageReducer.unreadMessageId).toBe(unreadAnchor.id)
    expect(screen.getByText('Unread Messages')).toBeInTheDocument()
    expect(dispatchSpy.mock.calls.some(([action]) => action.type === loadNearUnreadAC(channel).type)).toBe(false)
  })

  it('keeps the unread divider position when unread incoming messages are marked read while scrolling', async () => {
    const channelId = 'channel-unread-anchor-stable-while-reading'
    const olderMessage = makeMessage({
      id: '354',
      channelId,
      body: 'older-message',
      incoming: true
    })
    const firstUnread = makeMessage({
      id: '355',
      channelId,
      body: 'first-unread',
      incoming: true
    })
    const secondUnread = makeMessage({
      id: '356',
      channelId,
      body: 'second-unread',
      incoming: true
    })
    const channel = makeChannel({
      id: channelId,
      lastMessage: secondUnread,
      newMessageCount: 2,
      lastDisplayedMessageId: olderMessage.id
    })
    const store = createMessageListStore({
      ChannelReducer: {
        activeChannel: channel
      },
      MessageReducer: {
        activeChannelMessages: [olderMessage, firstUnread, secondUnread],
        unreadMessageId: olderMessage.id
      },
      UserReducer: {
        connectionStatus: CONNECTION_STATUS.CONNECTED
      }
    })

    renderMessageList(store)

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })

    expect(screen.getByText('Unread Messages')).toBeInTheDocument()
    expect(screen.getByText('first-unread')).toHaveAttribute('data-message-starts-unread', 'true')
    expect(screen.getByText('second-unread')).toHaveAttribute('data-message-starts-unread', 'false')

    await act(async () => {
      store.dispatch(
        updateMessageAC(firstUnread.id, {
          userMarkers: [{ name: MESSAGE_DELIVERY_STATUS.READ }] as any
        })
      )
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })

    expect(screen.getByText('Unread Messages')).toBeInTheDocument()
    expect(screen.getByText('first-unread')).toHaveAttribute('data-message-starts-unread', 'true')
    expect(screen.getByText('first-unread')).toHaveAttribute('data-message-is-unread', 'false')
    expect(screen.getByText('second-unread')).toHaveAttribute('data-message-starts-unread', 'false')
    expect(screen.getByText('second-unread')).toHaveAttribute('data-message-is-unread', 'true')
  })

  it('marks only the first unread message as starting the unread section', () => {
    const channelId = 'channel-unread-grouping'
    const sharedUser = {
      id: 'shared-remote-user',
      firstName: 'Waffi',
      lastName: 'Test',
      state: 'active'
    }
    const olderMessage = makeMessage({
      id: '360',
      channelId,
      body: 'older-message',
      incoming: true,
      user: sharedUser
    })
    const firstUnread = makeMessage({
      id: '361',
      channelId,
      body: 'first-unread',
      incoming: true,
      user: sharedUser
    })
    const secondUnread = makeMessage({
      id: '362',
      channelId,
      body: 'second-unread',
      incoming: true,
      user: sharedUser
    })
    const channel = makeChannel({
      id: channelId,
      lastMessage: secondUnread,
      newMessageCount: 2,
      lastDisplayedMessageId: olderMessage.id
    })
    const store = createMessageListStore({
      ChannelReducer: {
        activeChannel: channel
      },
      MessageReducer: {
        activeChannelMessages: [olderMessage, firstUnread, secondUnread],
        unreadMessageId: olderMessage.id
      },
      UserReducer: {
        connectionStatus: CONNECTION_STATUS.DISCONNECTED
      }
    })

    renderMessageList(store)

    const firstUnreadRow = screen.getByText('first-unread')
    const secondUnreadRow = screen.getByText('second-unread')

    expect(firstUnreadRow).toHaveAttribute('data-message-starts-unread', 'true')
    expect(secondUnreadRow).toHaveAttribute('data-message-starts-unread', 'false')
    expect(firstUnreadRow).toHaveAttribute('data-message-is-unread', 'true')
    expect(secondUnreadRow).toHaveAttribute('data-message-is-unread', 'true')
  })

  it('does not mark own outgoing messages as unread when they appear before unread incoming messages', () => {
    const channelId = 'channel-unread-skips-own-outgoing'
    const lastRead = makeMessage({
      id: '365',
      channelId,
      body: 'last-read',
      incoming: true
    })
    const ownOutgoing = makeMessage({
      id: '366',
      channelId,
      body: 'own-outgoing',
      incoming: false
    })
    const firstUnread = makeMessage({
      id: '367',
      channelId,
      body: 'first-unread',
      incoming: true
    })
    const secondUnread = makeMessage({
      id: '368',
      channelId,
      body: 'second-unread',
      incoming: true
    })
    const channel = makeChannel({
      id: channelId,
      lastMessage: secondUnread,
      newMessageCount: 2,
      lastDisplayedMessageId: lastRead.id
    })
    const store = createMessageListStore({
      ChannelReducer: {
        activeChannel: channel
      },
      MessageReducer: {
        activeChannelMessages: [lastRead, ownOutgoing, firstUnread, secondUnread],
        unreadMessageId: lastRead.id
      },
      UserReducer: {
        connectionStatus: CONNECTION_STATUS.DISCONNECTED
      }
    })

    renderMessageList(store)

    const ownOutgoingRow = screen.getByText('own-outgoing')
    const firstUnreadRow = screen.getByText('first-unread')
    const secondUnreadRow = screen.getByText('second-unread')

    expect(ownOutgoingRow).toHaveAttribute('data-message-is-unread', 'false')
    expect(ownOutgoingRow).toHaveAttribute('data-message-starts-unread', 'false')
    expect(firstUnreadRow).toHaveAttribute('data-message-is-unread', 'true')
    expect(firstUnreadRow).toHaveAttribute('data-message-starts-unread', 'true')
    expect(secondUnreadRow).toHaveAttribute('data-message-is-unread', 'true')
    expect(screen.getByText('Unread Messages')).toBeInTheDocument()
  })

  it('keeps the unread divider while the same open channel unread count is cleared', async () => {
    const channelId = 'channel-unread-cleared-stays-open'
    const olderMessage = makeMessage({
      id: '331',
      channelId,
      body: 'older-message'
    })
    const unreadAnchor = makeMessage({
      id: '332',
      channelId,
      body: 'first-unread',
      incoming: true
    })
    const latestMessage = makeMessage({
      id: '333',
      channelId,
      body: 'latest-unread',
      incoming: true
    })
    const channel = makeChannel({
      id: channelId,
      lastMessage: latestMessage,
      newMessageCount: 2,
      lastDisplayedMessageId: unreadAnchor.id
    })
    const store = createMessageListStore({
      ChannelReducer: {
        activeChannel: channel
      },
      MessageReducer: {
        activeChannelMessages: [olderMessage, unreadAnchor, latestMessage],
        unreadMessageId: unreadAnchor.id
      },
      UserReducer: {
        connectionStatus: CONNECTION_STATUS.DISCONNECTED
      }
    })

    renderMessageList(store)

    expect(screen.getByText('Unread Messages')).toBeInTheDocument()

    await act(async () => {
      store.dispatch(
        updateChannelDataAC(channelId, { unread: false, newMessageCount: 0, lastDisplayedMessageId: '' }, true)
      )
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })

    expect(store.getState().MessageReducer.unreadMessageId).toBe(unreadAnchor.id)
    expect(screen.getByText('Unread Messages')).toBeInTheDocument()
  })

  it('keeps the unread divider after the user sends a latest message into the same open channel', async () => {
    const channelId = 'channel-unread-own-send'
    const olderMessage = makeMessage({
      id: '341',
      channelId,
      body: 'older-message'
    })
    const unreadAnchor = makeMessage({
      id: '342',
      channelId,
      body: 'first-unread',
      incoming: true
    })
    const latestUnread = makeMessage({
      id: '343',
      channelId,
      body: 'latest-unread',
      incoming: true
    })
    const ownLatest = makePendingMessage({
      channelId,
      body: 'own-latest',
      createdAt: new Date('2026-04-03T15:20:00.000Z')
    })
    const channel = makeChannel({
      id: channelId,
      lastMessage: latestUnread,
      newMessageCount: 2,
      lastDisplayedMessageId: unreadAnchor.id
    })
    const store = createMessageListStore({
      ChannelReducer: {
        activeChannel: channel
      },
      MessageReducer: {
        activeChannelMessages: [olderMessage, unreadAnchor, latestUnread],
        unreadMessageId: unreadAnchor.id
      },
      UserReducer: {
        connectionStatus: CONNECTION_STATUS.DISCONNECTED
      }
    })

    renderMessageList(store)

    expect(screen.getByText('Unread Messages')).toBeInTheDocument()

    await act(async () => {
      store.dispatch(updateChannelDataAC(channelId, { lastMessage: ownLatest }, true))
      store.dispatch(addMessageAC(ownLatest))
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })

    expect(store.getState().MessageReducer.unreadMessageId).toBe(unreadAnchor.id)
    expect(screen.getByText('Unread Messages')).toBeInTheDocument()
  })

  it('removes the unread divider only after re-entering the channel with no unread count', async () => {
    const channelId = 'channel-unread-reentry-clears'
    const olderMessage = makeMessage({
      id: '344',
      channelId,
      body: 'older-message'
    })
    const unreadAnchor = makeMessage({
      id: '345',
      channelId,
      body: 'first-unread',
      incoming: true
    })
    const latestUnread = makeMessage({
      id: '346',
      channelId,
      body: 'latest-unread',
      incoming: true
    })
    const unreadChannel = makeChannel({
      id: channelId,
      lastMessage: latestUnread,
      newMessageCount: 2,
      lastDisplayedMessageId: unreadAnchor.id
    })
    const cleanChannel = makeChannel({
      id: channelId,
      lastMessage: latestUnread,
      newMessageCount: 0,
      lastDisplayedMessageId: ''
    })
    const unreadStore = createMessageListStore({
      ChannelReducer: {
        activeChannel: unreadChannel
      },
      MessageReducer: {
        activeChannelMessages: [olderMessage, unreadAnchor, latestUnread],
        unreadMessageId: unreadAnchor.id
      },
      UserReducer: {
        connectionStatus: CONNECTION_STATUS.DISCONNECTED
      }
    })

    const firstRender = renderMessageList(unreadStore)
    expect(screen.getByText('Unread Messages')).toBeInTheDocument()

    await act(async () => {
      firstRender.unmount()
    })

    const reenteredStore = createMessageListStore({
      ChannelReducer: {
        activeChannel: cleanChannel
      },
      MessageReducer: {
        activeChannelMessages: [olderMessage, unreadAnchor, latestUnread]
      },
      UserReducer: {
        connectionStatus: CONNECTION_STATUS.DISCONNECTED
      }
    })

    renderMessageList(reenteredStore)

    expect(screen.queryByText('Unread Messages')).not.toBeInTheDocument()
  })

  it('keeps pending messages at the end after older pages are merged in', () => {
    const channelId = 'channel-pending-tail'
    const confirmedMiddle = makeMessage({
      id: '410',
      channelId,
      body: 'confirmed-middle'
    })
    const confirmedNewest = makeMessage({
      id: '411',
      channelId,
      body: 'confirmed-newest'
    })
    const pendingLater = makePendingMessage({
      channelId,
      body: 'pending-later',
      createdAt: new Date('2026-04-01T12:08:00.000Z')
    })
    const pendingEarlier = makePendingMessage({
      channelId,
      body: 'pending-earlier',
      createdAt: new Date('2026-04-01T12:05:00.000Z')
    })
    const channel = makeChannel({
      id: channelId,
      lastMessage: pendingLater
    })
    const store = createMessageListStore({
      ChannelReducer: {
        activeChannel: channel
      },
      MessageReducer: {
        activeChannelMessages: [confirmedNewest, pendingLater, confirmedMiddle, pendingEarlier]
      },
      UserReducer: {
        connectionStatus: CONNECTION_STATUS.DISCONNECTED
      }
    })

    renderMessageList(store)

    act(() => {
      store.dispatch(
        addMessagesAC(
          [
            makeMessage({ id: '408', channelId, body: 'confirmed-oldest' }),
            makeMessage({ id: '409', channelId, body: 'confirmed-older' })
          ],
          MESSAGE_LOAD_DIRECTION.PREV
        )
      )
    })

    expect(screen.getAllByTestId('message-row').map((node) => node.textContent)).toEqual([
      'confirmed-oldest',
      'confirmed-older',
      'confirmed-middle',
      'confirmed-newest',
      'pending-earlier',
      'pending-later'
    ])
  })

  it('keeps pending messages at the end after paginating upward and then back toward latest', () => {
    const channelId = 'channel-pending-pagination'
    const confirmedMiddle = makeMessage({
      id: '610',
      channelId,
      body: 'confirmed-middle'
    })
    const confirmedNewestVisible = makeMessage({
      id: '611',
      channelId,
      body: 'confirmed-newest-visible'
    })
    const pendingEarlier = makePendingMessage({
      channelId,
      body: 'pending-earlier',
      createdAt: new Date('2026-04-01T12:16:00.000Z')
    })
    const pendingLater = makePendingMessage({
      channelId,
      body: 'pending-later',
      createdAt: new Date('2026-04-01T12:18:00.000Z')
    })
    const channel = makeChannel({
      id: channelId,
      lastMessage: pendingLater
    })
    const store = createMessageListStore({
      ChannelReducer: {
        activeChannel: channel
      },
      MessageReducer: {
        activeChannelMessages: [confirmedNewestVisible, pendingLater, confirmedMiddle, pendingEarlier]
      },
      UserReducer: {
        connectionStatus: CONNECTION_STATUS.DISCONNECTED
      }
    })

    renderMessageList(store)

    act(() => {
      store.dispatch(
        addMessagesAC(
          [
            makeMessage({ id: '608', channelId, body: 'confirmed-oldest' }),
            makeMessage({ id: '609', channelId, body: 'confirmed-older' })
          ],
          MESSAGE_LOAD_DIRECTION.PREV
        )
      )
      store.dispatch(
        addMessagesAC(
          [
            makeMessage({ id: '612', channelId, body: 'confirmed-next-1' }),
            makeMessage({ id: '613', channelId, body: 'confirmed-next-2' })
          ],
          MESSAGE_LOAD_DIRECTION.NEXT
        )
      )
    })

    expect(screen.getAllByTestId('message-row').map((node) => node.textContent)).toEqual([
      'confirmed-oldest',
      'confirmed-older',
      'confirmed-middle',
      'confirmed-newest-visible',
      'confirmed-next-1',
      'confirmed-next-2',
      'pending-earlier',
      'pending-later'
    ])
  })

  it('does not render the pending tail after paginating deep into history offline', () => {
    const channelId = 'channel-deep-history'
    const confirmedLatest = makeMessage({
      id: '1000',
      channelId,
      body: 'confirmed-latest'
    })
    const pendingTail = makePendingMessage({
      channelId,
      body: 'pending-tail',
      createdAt: new Date('2026-04-01T12:20:00.000Z')
    })
    const channel = makeChannel({
      id: channelId,
      lastMessage: pendingTail
    })
    const store = createMessageListStore({
      ChannelReducer: {
        activeChannel: channel
      },
      MessageReducer: {
        activeChannelMessages: [confirmedLatest, pendingTail]
      },
      UserReducer: {
        connectionStatus: CONNECTION_STATUS.DISCONNECTED
      }
    })

    renderMessageList(store)

    act(() => {
      store.dispatch(
        addMessagesAC(
          Array.from({ length: 40 }, (_, index) =>
            makeMessage({
              id: String(960 + index),
              channelId,
              body: `history-page-1-${index}`
            })
          ),
          MESSAGE_LOAD_DIRECTION.PREV
        )
      )
      store.dispatch(
        addMessagesAC(
          Array.from({ length: 40 }, (_, index) =>
            makeMessage({
              id: String(920 + index),
              channelId,
              body: `history-page-2-${index}`
            })
          ),
          MESSAGE_LOAD_DIRECTION.PREV
        )
      )
    })

    expect(screen.queryByText('pending-tail')).not.toBeInTheDocument()
  })

  it('restores the offline pending tail after returning from deep history to the latest window', () => {
    const channelId = 'channel-roundtrip-history'
    const confirmedBeforeLatest = makeMessage({
      id: '999',
      channelId,
      body: 'confirmed-before-latest'
    })
    const confirmedLatest = makeMessage({
      id: '1000',
      channelId,
      body: 'confirmed-latest'
    })
    const pendingTail = makePendingMessage({
      channelId,
      body: 'pending-tail',
      createdAt: new Date('2026-04-01T12:26:00.000Z')
    })
    const channel = makeChannel({
      id: channelId,
      lastMessage: confirmedLatest
    })
    const store = createMessageListStore({
      ChannelReducer: {
        activeChannel: channel
      },
      UserReducer: {
        connectionStatus: CONNECTION_STATUS.DISCONNECTED
      }
    })

    renderMessageList(store)

    act(() => {
      store.dispatch(setMessagesAC([confirmedBeforeLatest, confirmedLatest]))
      store.dispatch(updateChannelDataAC(channelId, { lastMessage: pendingTail }, true))
      store.dispatch(addMessageAC(pendingTail))
    })

    expect(screen.getAllByTestId('message-row').map((node) => node.textContent)).toEqual([
      'confirmed-before-latest',
      'confirmed-latest',
      'pending-tail'
    ])

    act(() => {
      store.dispatch(
        addMessagesAC(
          Array.from({ length: 39 }, (_, index) =>
            makeMessage({
              id: String(960 + index),
              channelId,
              body: `history-page-1-${index}`
            })
          ),
          MESSAGE_LOAD_DIRECTION.PREV
        )
      )
      store.dispatch(
        addMessagesAC(
          Array.from({ length: 40 }, (_, index) =>
            makeMessage({
              id: String(920 + index),
              channelId,
              body: `history-page-2-${index}`
            })
          ),
          MESSAGE_LOAD_DIRECTION.PREV
        )
      )
    })

    expect(screen.queryByText('pending-tail')).not.toBeInTheDocument()

    act(() => {
      store.dispatch(
        addMessagesAC(
          Array.from({ length: 21 }, (_, index) =>
            makeMessage({
              id: String(980 + index),
              channelId,
              body: `return-page-${index}`
            })
          ),
          MESSAGE_LOAD_DIRECTION.NEXT
        )
      )
      store.dispatch(addMessagesAC([pendingTail], MESSAGE_LOAD_DIRECTION.NEXT))
    })

    expect(screen.getByText('pending-tail')).toBeInTheDocument()
    expect(screen.getAllByTestId('message-row').at(-1)?.textContent).toBe('pending-tail')
  })

  it('removes the duplicate pending message when the confirmed echo arrives', () => {
    const channelId = 'channel-confirm'
    const confirmedBase = makeMessage({
      id: '500',
      channelId,
      body: 'confirmed-base'
    })
    const pendingMessage = makePendingMessage({
      channelId,
      tid: 'pending-500',
      body: 'pending-copy',
      createdAt: new Date('2026-04-01T12:04:00.000Z')
    })
    const channel = makeChannel({
      id: channelId,
      lastMessage: pendingMessage
    })
    const store = createMessageListStore({
      ChannelReducer: {
        activeChannel: channel
      },
      MessageReducer: {
        activeChannelMessages: [confirmedBase, pendingMessage]
      },
      UserReducer: {
        connectionStatus: CONNECTION_STATUS.DISCONNECTED
      }
    })

    renderMessageList(store)

    act(() => {
      store.dispatch(
        addMessageAC(
          makeMessage({
            id: '501',
            tid: pendingMessage.tid,
            channelId,
            body: 'confirmed-echo'
          })
        )
      )
    })

    expect(screen.queryByText('pending-copy')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('message-row').map((node) => node.textContent)).toEqual([
      'confirmed-base',
      'confirmed-echo'
    ])
  })

  it('keeps the latest pending local item as the latest visible candidate', () => {
    const channelId = 'channel-latest-pending'
    const confirmedMessage = makeMessage({
      id: '601',
      channelId,
      body: 'confirmed-visible'
    })
    const pendingLatest = makePendingMessage({
      channelId,
      body: 'pending-latest',
      createdAt: new Date('2026-04-01T12:15:00.000Z')
    })
    const channel = makeChannel({
      id: channelId,
      lastMessage: pendingLatest
    })
    const store = buildStore(channel)

    act(() => {
      store.dispatch(setMessagesAC([confirmedMessage, pendingLatest]))
    })

    renderMessageList(store)

    expect(screen.getByTestId('scroll-to-bottom')).toHaveAttribute('data-show', '2')
  })

  it('uses jumpToLatest when the scroll-to-bottom button is clicked and the latest message is pending', () => {
    const channelId = 'channel-scroll-button-pending'
    const pendingLatest = makePendingMessage({
      channelId,
      body: 'pending-latest',
      createdAt: new Date('2026-04-01T12:55:00.000Z')
    })
    const deepHistoryMessages = Array.from({ length: 40 }, (_, index) =>
      makeMessage({
        id: String(900 + index),
        channelId,
        body: `history-${index}`
      })
    )
    const channel = makeChannel({
      id: channelId,
      lastMessage: pendingLatest
    })
    const store = createMessageListStore({
      ChannelReducer: {
        activeChannel: channel
      },
      MessageReducer: {
        activeChannelMessages: deepHistoryMessages,
        showScrollToNewMessageButton: true,
        messagesHasNext: true
      },
      UserReducer: {
        connectionStatus: CONNECTION_STATUS.DISCONNECTED
      }
    })
    const dispatchSpy = jest.spyOn(store, 'dispatch')

    renderMessageList(store)

    dispatchSpy.mockClear()
    fireEvent.click(screen.getByTestId('scroll-to-bottom'))

    expect(dispatchSpy).toHaveBeenCalledWith(loadDefaultMessagesAC(channel))
  })

  it('shows the total unread count even when only part of the unread range is loaded', () => {
    const channelId = 'channel-partial-unread-window'
    const unreadAnchor = makeMessage({
      id: '1000',
      channelId,
      body: 'last-read'
    })
    const loadedUnreadMessages = Array.from({ length: 20 }, (_, index) =>
      makeMessage({
        id: String(1001 + index),
        channelId,
        body: `unread-${index}`,
        incoming: true
      })
    )
    const channel = makeChannel({
      id: channelId,
      lastMessage: loadedUnreadMessages[loadedUnreadMessages.length - 1],
      newMessageCount: 100,
      lastDisplayedMessageId: unreadAnchor.id
    })
    const store = createMessageListStore({
      ChannelReducer: {
        activeChannel: channel
      },
      MessageReducer: {
        activeChannelMessages: [unreadAnchor, ...loadedUnreadMessages],
        unreadMessageId: unreadAnchor.id,
        showScrollToNewMessageButton: true
      },
      UserReducer: {
        connectionStatus: CONNECTION_STATUS.CONNECTED
      }
    })

    renderMessageList(store)

    expect(screen.getByTestId('scroll-to-bottom')).toHaveTextContent('100')
  })

  it('debounces visible message read markers into one grouped dispatch', () => {
    jest.useFakeTimers()

    try {
      const channelId = 'channel-visible-read-batch'
      const visibleMessages = Array.from({ length: 20 }, (_, index) =>
        Object.assign(
          makeMessage({
            id: String(3001 + index),
            channelId,
            body: `visible-${index + 1}`,
            incoming: true
          }),
          { __queueReadOnMount: true }
        )
      )
      const channel = makeChannel({
        id: channelId,
        lastMessage: visibleMessages[visibleMessages.length - 1],
        newMessageCount: 60
      })
      const store = createMessageListStore({
        ChannelReducer: {
          activeChannel: channel
        },
        MessageReducer: {
          activeChannelMessages: visibleMessages
        },
        UserReducer: {
          connectionStatus: CONNECTION_STATUS.CONNECTED
        }
      })
      const dispatchSpy = jest.spyOn(store, 'dispatch')

      renderMessageList(store)

      const readType = markMessagesAsReadAC(channelId, ['message-id']).type
      expect(dispatchSpy.mock.calls.filter(([action]) => action.type === readType)).toHaveLength(0)

      act(() => {
        jest.advanceTimersByTime(DEFAULT_MARKER_BATCH_DEBOUNCE_MS - 1)
      })

      expect(dispatchSpy.mock.calls.filter(([action]) => action.type === readType)).toHaveLength(0)

      act(() => {
        jest.advanceTimersByTime(1)
      })

      const readActions = dispatchSpy.mock.calls.map(([action]) => action).filter((action) => action.type === readType)

      expect(readActions).toHaveLength(1)
      expect(readActions[0].payload.channelId).toBe(channelId)
      expect(readActions[0].payload.messageIds).toEqual(visibleMessages.map((message) => message.id))
    } finally {
      jest.runOnlyPendingTimers()
      jest.useRealTimers()
    }
  })

  it('reloads the latest window after an offline send from deep history instead of staying on the history page', async () => {
    const channelId = 'channel-offline-send-scroll'
    const pendingLatest = makePendingMessage({
      channelId,
      body: 'pending-latest',
      createdAt: new Date('2026-04-01T13:05:00.000Z')
    })
    const confirmedLatest = makeMessage({
      id: '1000',
      channelId,
      body: 'confirmed-latest'
    })
    const deepHistoryMessages = Array.from({ length: 60 }, (_, index) =>
      makeMessage({
        id: String(920 + index),
        channelId,
        body: `history-${index}`
      })
    )
    const channel = makeChannel({
      id: channelId,
      lastMessage: confirmedLatest
    })
    const store = createMessageListStore({
      ChannelReducer: {
        activeChannel: channel
      },
      MessageReducer: {
        activeChannelMessages: deepHistoryMessages,
        messagesHasNext: true,
        loadingPrevMessagesState: LOADING_STATE.LOADED,
        loadingNextMessagesState: LOADING_STATE.LOADED
      },
      UserReducer: {
        connectionStatus: CONNECTION_STATUS.DISCONNECTED
      }
    })
    const rendered = renderMessageList(store)
    const scrollable = rendered.container.querySelector('#scrollableDiv') as HTMLDivElement
    const dispatchSpy = jest.spyOn(store, 'dispatch')

    act(() => {
      setScrollMetrics(scrollable, {
        scrollTop: 180,
        scrollHeight: 2600,
        clientHeight: 240
      })
    })

    act(() => {
      store.dispatch(updateChannelDataAC(channelId, { lastMessage: pendingLatest }, true))
      store.dispatch(addMessageAC(pendingLatest))
    })

    dispatchSpy.mockClear()
    const jumpToLatestHandler = (registerJumpToLatest as jest.Mock).mock.calls.at(-1)?.[0]
    expect(typeof jumpToLatestHandler).toBe('function')

    let jumpPromise: Promise<void> | undefined
    await act(async () => {
      jumpPromise = jumpToLatestHandler(true)
      await Promise.resolve()
    })

    expect(dispatchSpy.mock.calls.some(([action]) => action.type === loadDefaultMessagesAC(channel).type)).toBe(true)

    await act(async () => {
      store.dispatch(
        setMessagesAC([
          makeMessage({
            id: '999',
            channelId,
            body: 'confirmed-before-latest'
          }),
          confirmedLatest,
          pendingLatest
        ])
      )
      store.dispatch(setMessagesHasNextAC(false))
      await jumpPromise
    })

    act(() => {
      flushAnimationFrames()
    })

    const latestEdgeTop = scrollable.scrollTop
    expect(latestEdgeTop).toBe(40)
    expect(screen.queryByText('history-0')).not.toBeInTheDocument()
    expect(screen.getByText('confirmed-latest')).toBeInTheDocument()
    expect(screen.getByText('pending-latest')).toBeInTheDocument()

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })

    act(() => {
      flushAnimationFrames()
    })

    expect(scrollable.scrollTop).toBe(latestEdgeTop)
  })

  it('reloads the latest window after an offline send from deep history with delayed mounted responses', async () => {
    const channelId = 'channel-offline-send-delayed-scroll'
    const pendingLatest = makePendingMessage({
      channelId,
      body: 'pending-latest-delayed',
      createdAt: new Date('2026-04-01T13:15:00.000Z')
    })
    const confirmedLatest = makeMessage({
      id: '1100',
      channelId,
      body: 'confirmed-latest-delayed'
    })
    const confirmedBeforeLatest = makeMessage({
      id: '1099',
      channelId,
      body: 'confirmed-before-latest-delayed'
    })
    const deepHistoryMessages = Array.from({ length: 60 }, (_, index) =>
      makeMessage({
        id: String(1020 + index),
        channelId,
        body: `history-delayed-${index}`
      })
    )
    const channel = makeChannel({
      id: channelId,
      lastMessage: confirmedLatest
    })
    const store = createMessageListStore({
      ChannelReducer: {
        activeChannel: channel
      },
      MessageReducer: {
        activeChannelMessages: deepHistoryMessages,
        messagesHasNext: true,
        loadingPrevMessagesState: LOADING_STATE.LOADED,
        loadingNextMessagesState: LOADING_STATE.LOADED
      },
      UserReducer: {
        connectionStatus: CONNECTION_STATUS.DISCONNECTED
      }
    })
    const delayedDispatch = attachDelayedServerToMessageListStore(store, {
      onLoadDefault: () => ({
        messages: [confirmedBeforeLatest, confirmedLatest, pendingLatest],
        hasNext: false
      })
    })
    const rendered = renderMessageList(store)
    const scrollable = rendered.container.querySelector('#scrollableDiv') as HTMLDivElement

    act(() => {
      setScrollMetrics(scrollable, {
        scrollTop: 180,
        scrollHeight: 2600,
        clientHeight: 240
      })
    })

    act(() => {
      store.dispatch(updateChannelDataAC(channelId, { lastMessage: pendingLatest }, true))
      store.dispatch(addMessageAC(pendingLatest))
    })

    delayedDispatch.mockClear()
    const jumpToLatestHandler = (registerJumpToLatest as jest.Mock).mock.calls.at(-1)?.[0]
    expect(typeof jumpToLatestHandler).toBe('function')
    let jumpPromise: Promise<void> | undefined

    await act(async () => {
      jumpPromise = Promise.resolve(jumpToLatestHandler(true))
      await Promise.resolve()
    })

    expect(
      delayedDispatch.mock.calls.some(([action]: [any]) => action.type === loadDefaultMessagesAC(channel).type)
    ).toBe(true)

    await flushMockServerDelay()

    act(() => {
      flushAnimationFrames()
    })

    await act(async () => {
      await jumpPromise
    })

    expect(store.getState().MessageReducer.loadingPrevMessagesState).toBe(LOADING_STATE.LOADED)
    expect(store.getState().MessageReducer.loadingNextMessagesState).toBe(LOADING_STATE.LOADED)
    expect(store.getState().MessageReducer.messagesHasNext).toBe(false)
    expect(scrollable.scrollTop).toBe(40)
    expect(screen.queryByText('history-delayed-0')).not.toBeInTheDocument()
    expect(screen.getByText('confirmed-before-latest-delayed')).toBeInTheDocument()
    expect(screen.getByText('confirmed-latest-delayed')).toBeInTheDocument()
    expect(screen.getByText('pending-latest-delayed')).toBeInTheDocument()
  })

  it('handles a full flow across pending send, deep history, reconnect, and read/edit updates', async () => {
    const channelId = 'channel-full-flow'
    const confirmedBase = makeMessage({
      id: '998',
      channelId,
      body: 'confirmed-base'
    })
    const confirmedLatest = makeMessage({
      id: '999',
      channelId,
      body: 'confirmed-latest'
    })
    const pendingLatest = makePendingMessage({
      channelId,
      body: 'pending-latest',
      createdAt: new Date('2026-04-03T13:20:00.000Z')
    })
    const channel = makeChannel({
      id: channelId,
      lastMessage: confirmedLatest
    })
    const store = createMessageListStore({
      ChannelReducer: {
        activeChannel: channel
      },
      MessageReducer: {
        activeChannelMessages: [confirmedBase, confirmedLatest],
        messagesHasPrev: true,
        messagesHasNext: false,
        loadingPrevMessagesState: LOADING_STATE.LOADED,
        loadingNextMessagesState: LOADING_STATE.LOADED
      },
      UserReducer: {
        connectionStatus: CONNECTION_STATUS.DISCONNECTED
      }
    })
    const rendered = renderMessageList(store)
    const scrollable = rendered.container.querySelector('#scrollableDiv') as HTMLDivElement
    const dispatchSpy = jest.spyOn(store, 'dispatch')

    act(() => {
      setScrollMetrics(scrollable, {
        scrollTop: 40,
        scrollHeight: 1200,
        clientHeight: 240
      })
      store.dispatch(updateChannelDataAC(channelId, { lastMessage: pendingLatest }, true))
      store.dispatch(addMessageAC(pendingLatest))
    })

    expect(screen.getAllByTestId('message-row').map((node) => node.textContent)).toEqual([
      'confirmed-base',
      'confirmed-latest',
      'pending-latest'
    ])

    act(() => {
      store.dispatch(
        addMessagesAC(
          Array.from({ length: 40 }, (_, index) =>
            makeMessage({
              id: String(920 + index),
              channelId,
              body: `history-page-1-${index}`
            })
          ),
          MESSAGE_LOAD_DIRECTION.PREV
        )
      )
      store.dispatch(
        addMessagesAC(
          Array.from({ length: 40 }, (_, index) =>
            makeMessage({
              id: String(880 + index),
              channelId,
              body: `history-page-2-${index}`
            })
          ),
          MESSAGE_LOAD_DIRECTION.PREV
        )
      )
      store.dispatch(setMessagesHasNextAC(true))
      setScrollMetrics(scrollable, {
        scrollTop: 180,
        scrollHeight: 2600,
        clientHeight: 240
      })
    })

    expect(screen.queryByText('pending-latest')).not.toBeInTheDocument()

    act(() => {
      store.dispatch(setConnectionStatusAC(CONNECTION_STATUS.CONNECTED))
    })

    dispatchSpy.mockClear()
    fireEvent.click(screen.getByTestId('scroll-to-bottom'))

    const loadLatestAction = dispatchSpy.mock.calls.find(
      ([action]) => action.type === loadLatestMessagesAC(store.getState().ChannelReducer.activeChannel as any).type
    )?.[0]

    expect(loadLatestAction?.payload.channel.id).toBe(channelId)
    expect(loadLatestAction?.payload.channel.lastMessage?.body).toBe('pending-latest')

    await act(async () => {
      store.dispatch(setMessagesAC([confirmedBase, confirmedLatest, pendingLatest]))
      store.dispatch(setMessagesHasNextAC(false))
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })

    act(() => {
      flushAnimationFrames()
    })

    expect(scrollable.scrollTop).toBe(40)
    expect(screen.getAllByTestId('message-row').map((node) => node.textContent)).toEqual([
      'confirmed-base',
      'confirmed-latest',
      'pending-latest'
    ])

    act(() => {
      store.dispatch(
        updateMessageAC(confirmedLatest.id, {
          body: 'confirmed-latest-edited',
          updatedAt: new Date('2026-04-03T13:25:00.000Z')
        })
      )
      store.dispatch(
        updateMessageAC(confirmedLatest.id, {
          userMarkers: [{ name: MESSAGE_DELIVERY_STATUS.READ }]
        })
      )
    })

    const editedRow = screen.getByText('confirmed-latest-edited').closest('[data-testid="message-row"]')
    expect(editedRow).toHaveAttribute('data-message-edited', 'true')
    expect(editedRow).toHaveAttribute('data-message-markers', MESSAGE_DELIVERY_STATUS.READ)
    expect(screen.getAllByTestId('message-row').at(-1)?.textContent).toBe('pending-latest')
  })
})
