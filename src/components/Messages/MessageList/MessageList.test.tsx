import React from 'react'
import { act, fireEvent, screen } from '@testing-library/react'
import MessageList from './index'
import { CONNECTION_STATUS } from '../../../store/user/constants'
import {
  addMessageAC,
  addMessagesAC,
  loadAroundMessageAC,
  loadDefaultMessagesAC,
  loadLatestMessagesAC,
  loadMoreMessagesAC,
  loadNearUnreadAC,
  reloadActiveChannelAfterReconnectAC,
  refreshCacheAroundMessageAC,
  setLoadingNextMessagesStateAC,
  setLoadingPrevMessagesStateAC,
  setMessagesAC,
  setMessagesHasNextAC,
  setMessagesHasPrevAC,
  setStableUnreadAnchorAC,
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
  setElementRect,
  setScrollMetrics
} from '../../../testUtils/messageListHarness'
import {
  registerJumpToLatest,
  registerMessageListNavigator,
  unregisterJumpToLatest,
  unregisterMessageListNavigator
} from '../../../helpers/messageListNavigator'
import { markMessagesAsReadAC, setActiveChannelAC, updateChannelDataAC } from '../../../store/channel/actions'
import { setConnectionStatusAC } from '../../../store/user/actions'
import { resetMockServerDelay, resolveWithMockServerDelay } from '../../../testUtils/mockServerDelay'
import { DEFAULT_MARKER_BATCH_DEBOUNCE_MS } from '../../../helpers/messageMarkerBatcher'
import { IMessage } from '../../../types'
import { LATEST_EDGE_GAP_PX } from './useChatController'

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
  hasPrev?: boolean
  unreadMessageId?: string
  stableUnreadAnchorId?: string
}

type DelayedReconnectResponse = {
  channel?: any
}

const flushMockServerDelay = async () => {
  await act(async () => {
    await resolveWithMockServerDelay(null)
  })
}

const layoutRenderedMessageList = (
  container: HTMLElement,
  options: {
    scrollTop: number
    scrollHeight: number
    clientHeight?: number
    itemTops: Record<string, number>
  }
) => {
  const clientHeight = options.clientHeight ?? 240

  setElementRect(container, { top: 0, left: 0, width: 320, height: clientHeight })
  setScrollMetrics(container as HTMLDivElement, {
    scrollTop: options.scrollTop,
    scrollHeight: options.scrollHeight,
    clientHeight,
    offsetTop: 0,
    offsetHeight: clientHeight
  })

  Object.entries(options.itemTops).forEach(([itemId, top]) => {
    const item = container.querySelector<HTMLElement>(`[data-message-list-item-id="${itemId}"]`)
    expect(item).not.toBeNull()
    setElementRect(item!, {
      top,
      left: 0,
      width: 320,
      height: 32
    })
  })
}

const getRenderedMessageBodies = () => screen.getAllByTestId('message-row').map((node) => node.textContent)

const expectUnreadDividerAt = (messageBody: string) => {
  expect(screen.getByText('Unread Messages')).toBeInTheDocument()
  expect(screen.getByText(messageBody)).toHaveAttribute('data-message-is-unread', 'true')
}

const attachDelayedServerToMessageListStore = (
  store: ReturnType<typeof createMessageListStore>,
  handlers: {
    onLoadDefault?: (action: any) => DelayedMessageListResponse | Promise<DelayedMessageListResponse>
    onLoadLatest?: (action: any) => DelayedMessageListResponse | Promise<DelayedMessageListResponse>
    onLoadNearUnread?: (action: any) => DelayedMessageListResponse | Promise<DelayedMessageListResponse>
    onLoadAround?: (action: any) => DelayedMessageListResponse | Promise<DelayedMessageListResponse>
    onLoadMore?: (action: any) => DelayedMessageListResponse | Promise<DelayedMessageListResponse>
    onReconnect?: (action: any) => DelayedReconnectResponse | Promise<DelayedReconnectResponse>
  }
) => {
  const originalDispatch = store.dispatch.bind(store)
  const delayedDispatch = jest.fn((action: any) => {
    const result = originalDispatch(action)

    const setLoadingState = (scope: 'previous' | 'next' | 'both', state: number | null) => {
      if (scope === 'previous' || scope === 'both') {
        originalDispatch(setLoadingPrevMessagesStateAC(state))
      }
      if (scope === 'next' || scope === 'both') {
        originalDispatch(setLoadingNextMessagesStateAC(state))
      }
    }

    const scheduleResponse = async (
      scope: 'previous' | 'next' | 'both',
      resolver?: (action: any) => DelayedMessageListResponse | Promise<DelayedMessageListResponse>,
      applyMessages?: (response: DelayedMessageListResponse) => boolean | void
    ) => {
      setLoadingState(scope, LOADING_STATE.LOADING)
      const response = resolver ? await resolveWithMockServerDelay(null).then(() => resolver(action)) : {}
      const shouldApplyResponse = applyMessages ? applyMessages(response || {}) !== false : true

      if (typeof response?.stableUnreadAnchorId === 'string') {
        originalDispatch(setStableUnreadAnchorAC(action.payload.channel.id, response.stableUnreadAnchorId))
      }
      if (typeof response?.unreadMessageId === 'string') {
        originalDispatch(setUnreadMessageIdAC(response.unreadMessageId))
      }
      if (!applyMessages && response?.messages) {
        originalDispatch(setMessagesAC(response.messages, action.payload.channel.id))
      }
      if (shouldApplyResponse && typeof response?.hasPrev === 'boolean') {
        originalDispatch(setMessagesHasPrevAC(response.hasPrev))
      }
      if (shouldApplyResponse && typeof response?.hasNext === 'boolean') {
        originalDispatch(setMessagesHasNextAC(response.hasNext))
      }
      setLoadingState(scope, LOADING_STATE.LOADED)
    }

    const scheduleReconnect = async (
      resolver?: (action: any) => DelayedReconnectResponse | Promise<DelayedReconnectResponse>
    ) => {
      const reconnectResponse = resolver ? await resolveWithMockServerDelay(null).then(() => resolver(action)) : {}
      const reloadedChannel = {
        ...action.payload.channel,
        ...(reconnectResponse?.channel || {})
      }

      if (reconnectResponse?.channel) {
        originalDispatch(updateChannelDataAC(action.payload.channel.id, reloadedChannel, true))
      }

      if (action.payload.visibleAnchorId && !action.payload.wasViewingLatest) {
        delayedDispatch(
          refreshCacheAroundMessageAC(
            reloadedChannel.id,
            action.payload.visibleAnchorId,
            action.payload.applyVisibleWindow
          )
        )
        return
      }

      if (action.payload.wasViewingLatest) {
        delayedDispatch(
          loadLatestMessagesAC(
            reloadedChannel,
            undefined,
            false,
            'instant',
            false,
            true,
            action.payload.applyVisibleWindow
          )
        )
        return
      }

      if (reloadedChannel.newMessageCount && reloadedChannel.lastDisplayedMessageId) {
        if (!store.getState().MessageReducer.unreadMessageId) {
          originalDispatch(setUnreadMessageIdAC(reloadedChannel.lastDisplayedMessageId))
        }
        delayedDispatch(loadNearUnreadAC(reloadedChannel))
        return
      }

      delayedDispatch(loadLatestMessagesAC(reloadedChannel))
    }

    if (action.type === loadDefaultMessagesAC(action.payload.channel).type) {
      scheduleResponse('both', handlers.onLoadDefault).catch(() => undefined)
    }

    if (action.type === loadLatestMessagesAC(action.payload.channel).type) {
      scheduleResponse('both', handlers.onLoadLatest).catch(() => undefined)
    }

    if (action.type === loadNearUnreadAC(action.payload.channel).type) {
      scheduleResponse('both', handlers.onLoadNearUnread).catch(() => undefined)
    }

    if (action.type === loadAroundMessageAC(action.payload.channel, action.payload.messageId).type) {
      scheduleResponse('both', handlers.onLoadAround).catch(() => undefined)
    }

    if (action.type === refreshCacheAroundMessageAC('', '').type) {
      scheduleResponse('both', handlers.onLoadAround, (response) => {
        const responseMessages = response?.messages || []
        const currentConfirmedMessages = store
          .getState()
          .MessageReducer.activeChannelMessages.filter((message: IMessage) => !!message.id)
        const responseConfirmedMessages = responseMessages.filter((message: IMessage) => !!message.id)
        const sameVisibleWindow =
          currentConfirmedMessages.length === responseConfirmedMessages.length &&
          currentConfirmedMessages.every((message: IMessage, index: number) => {
            return message.id === responseConfirmedMessages[index]?.id
          })

        if (action.payload.applyVisibleWindow || sameVisibleWindow) {
          if (responseMessages.length) {
            originalDispatch(setMessagesAC(responseMessages, action.payload.channelId))
          }
        }

        return action.payload.applyVisibleWindow || sameVisibleWindow
      }).catch(() => undefined)
    }

    if (action.type === loadMoreMessagesAC('', 0, MESSAGE_LOAD_DIRECTION.NEXT, '', false).type) {
      scheduleResponse(
        action.payload.direction === MESSAGE_LOAD_DIRECTION.PREV ? 'previous' : 'next',
        handlers.onLoadMore,
        (response) => {
          const activePaginationIntent = store.getState().MessageReducer.activePaginationIntent
          const expectedDirection = action.payload.direction === MESSAGE_LOAD_DIRECTION.PREV ? 'prev' : 'next'
          const shouldApplyVisibleResponse =
            !action.payload.requestId ||
            (activePaginationIntent?.channelId === action.payload.channelId &&
              activePaginationIntent.direction === expectedDirection &&
              activePaginationIntent.requestId === action.payload.requestId)

          if (shouldApplyVisibleResponse && response?.messages) {
            originalDispatch(addMessagesAC(response.messages, action.payload.direction))
          }
          return shouldApplyVisibleResponse
        }
      ).catch(() => undefined)
    }

    if (action.type === reloadActiveChannelAfterReconnectAC(action.payload.channel).type) {
      scheduleReconnect(handlers.onReconnect).catch(() => undefined)
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

    expect(dispatchSpy).toHaveBeenCalledWith(setUnreadMessageIdAC(''))
    expect(dispatchSpy).toHaveBeenCalledWith(loadDefaultMessagesAC(channel))
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

    expect(dispatchSpy).toHaveBeenCalledWith(setUnreadMessageIdAC(''))
    expect(dispatchSpy).toHaveBeenCalledWith(loadNearUnreadAC(channel))
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
        connectionStatus: CONNECTION_STATUS.CONNECTED
      }
    })

    renderMessageList(store)
    act(() => {
      store.dispatch(setUnreadMessageIdAC(olderMessage.id))
    })

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
      lastDisplayedMessageId: olderMessage.id
    })
    const store = createMessageListStore({
      ChannelReducer: {
        activeChannel: channel
      },
      MessageReducer: {
        activeChannelMessages: [olderMessage, unreadAnchor, latestUnread],
        unreadMessageId: olderMessage.id
      },
      UserReducer: {
        connectionStatus: CONNECTION_STATUS.CONNECTED
      }
    })
    const dispatchSpy = jest.spyOn(store, 'dispatch')

    renderMessageList(store)
    act(() => {
      store.dispatch(setUnreadMessageIdAC(olderMessage.id))
    })

    expect(store.getState().MessageReducer.unreadMessageId).toBe(olderMessage.id)
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

    expect(store.getState().MessageReducer.unreadMessageId).toBe(olderMessage.id)
    expect(screen.getByText('Unread Messages')).toBeInTheDocument()
    expect(dispatchSpy.mock.calls.some(([action]) => action.type === loadNearUnreadAC(channel).type)).toBe(false)
  })

  it('shows the unread divider after new messages arrive while the same channel stays open in deep history', async () => {
    const channelId = 'channel-open-history-then-receive-unread'
    const historyOne = makeMessage({
      id: '401',
      channelId,
      body: 'history-one',
      incoming: true
    })
    const historyTwo = makeMessage({
      id: '402',
      channelId,
      body: 'history-two',
      incoming: true
    })
    const lastDisplayed = makeMessage({
      id: '500',
      channelId,
      body: 'last-displayed',
      incoming: true
    })
    const unreadOne = makeMessage({
      id: '501',
      channelId,
      body: 'arrived-unread-one',
      incoming: true
    })
    const unreadTwo = makeMessage({
      id: '502',
      channelId,
      body: 'arrived-unread-two',
      incoming: true
    })
    const channel = makeChannel({
      id: channelId,
      lastMessage: historyTwo,
      newMessageCount: 0,
      lastDisplayedMessageId: lastDisplayed.id
    })
    const store = createMessageListStore({
      ChannelReducer: {
        activeChannel: channel
      },
      MessageReducer: {
        activeChannelMessages: [historyOne, historyTwo],
        messagesHasPrev: true,
        messagesHasNext: true,
        unreadMessageId: ''
      },
      UserReducer: {
        connectionStatus: CONNECTION_STATUS.CONNECTED
      }
    })

    renderMessageList(store)
    expect(screen.queryByText('Unread Messages')).not.toBeInTheDocument()

    await act(async () => {
      store.dispatch(
        updateChannelDataAC(
          channelId,
          {
            unread: true,
            newMessageCount: 2,
            lastDisplayedMessageId: lastDisplayed.id,
            lastMessage: unreadTwo
          },
          true
        )
      )
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })

    expect(store.getState().MessageReducer.unreadMessageId).toBe(lastDisplayed.id)

    await act(async () => {
      store.dispatch(setMessagesHasNextAC(false))
      store.dispatch(setMessagesAC([lastDisplayed, unreadOne, unreadTwo], channelId))
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })

    expectUnreadDividerAt('arrived-unread-one')
    expect(screen.getByText('arrived-unread-two')).toHaveAttribute('data-message-is-unread', 'true')
    expect(getRenderedMessageBodies()).toEqual(['last-displayed', 'arrived-unread-one', 'arrived-unread-two'])
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
    act(() => {
      store.dispatch(setUnreadMessageIdAC(olderMessage.id))
    })

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })

    expect(screen.getByText('Unread Messages')).toBeInTheDocument()
    expect(screen.getByText('first-unread')).toHaveAttribute('data-message-is-unread', 'true')
    expect(screen.getByText('second-unread')).toHaveAttribute('data-message-is-unread', 'true')

    await act(async () => {
      store.dispatch(
        updateMessageAC(firstUnread.id, {
          userMarkers: [{ name: MESSAGE_DELIVERY_STATUS.READ }] as any
        })
      )
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })

    expect(screen.getByText('Unread Messages')).toBeInTheDocument()
    expect(screen.getByText('first-unread')).toHaveAttribute('data-message-is-unread', 'false')
    expect(screen.getByText('second-unread')).toHaveAttribute('data-message-is-unread', 'true')
  })

  it('marks unread incoming messages after the displayed boundary as unread', () => {
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
    act(() => {
      store.dispatch(setUnreadMessageIdAC(olderMessage.id))
    })

    const firstUnreadRow = screen.getByText('first-unread')
    const secondUnreadRow = screen.getByText('second-unread')

    expect(firstUnreadRow).toHaveAttribute('data-message-is-unread', 'true')
    expect(secondUnreadRow).toHaveAttribute('data-message-is-unread', 'true')
    expect(screen.getByText('Unread Messages')).toBeInTheDocument()
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
    act(() => {
      store.dispatch(setUnreadMessageIdAC(lastRead.id))
    })

    const ownOutgoingRow = screen.getByText('own-outgoing')
    const firstUnreadRow = screen.getByText('first-unread')
    const secondUnreadRow = screen.getByText('second-unread')

    expect(ownOutgoingRow).toHaveAttribute('data-message-is-unread', 'false')
    expect(firstUnreadRow).toHaveAttribute('data-message-is-unread', 'true')
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
      lastDisplayedMessageId: olderMessage.id
    })
    const store = createMessageListStore({
      ChannelReducer: {
        activeChannel: channel
      },
      MessageReducer: {
        activeChannelMessages: [olderMessage, unreadAnchor, latestMessage],
        unreadMessageId: olderMessage.id
      },
      UserReducer: {
        connectionStatus: CONNECTION_STATUS.DISCONNECTED
      }
    })

    renderMessageList(store)
    act(() => {
      store.dispatch(setUnreadMessageIdAC(olderMessage.id))
    })

    expect(screen.getByText('Unread Messages')).toBeInTheDocument()

    await act(async () => {
      store.dispatch(
        updateChannelDataAC(channelId, { unread: false, newMessageCount: 0, lastDisplayedMessageId: '' }, true)
      )
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })

    expect(store.getState().MessageReducer.unreadMessageId).toBe(olderMessage.id)
    expect(screen.getByText('Unread Messages')).toBeInTheDocument()
  })

  it('removes the unread divider after the user sends a latest message into the same open channel', async () => {
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
      lastDisplayedMessageId: olderMessage.id
    })
    const store = createMessageListStore({
      ChannelReducer: {
        activeChannel: channel
      },
      MessageReducer: {
        activeChannelMessages: [olderMessage, unreadAnchor, latestUnread],
        unreadMessageId: olderMessage.id
      },
      UserReducer: {
        connectionStatus: CONNECTION_STATUS.DISCONNECTED
      }
    })

    renderMessageList(store)
    act(() => {
      store.dispatch(setUnreadMessageIdAC(olderMessage.id))
    })

    expect(screen.getByText('Unread Messages')).toBeInTheDocument()

    await act(async () => {
      store.dispatch(updateChannelDataAC(channelId, { lastMessage: ownLatest }, true))
      store.dispatch(setUnreadMessageIdAC(''))
      store.dispatch(addMessageAC(ownLatest))
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })

    expect(store.getState().MessageReducer.unreadMessageId).toBe('')
    expect(screen.queryByText('Unread Messages')).not.toBeInTheDocument()
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
      lastDisplayedMessageId: olderMessage.id
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
        unreadMessageId: olderMessage.id
      },
      UserReducer: {
        connectionStatus: CONNECTION_STATUS.DISCONNECTED
      }
    })

    const firstRender = renderMessageList(unreadStore)
    act(() => {
      unreadStore.dispatch(setUnreadMessageIdAC(olderMessage.id))
    })
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
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })
    dispatchSpy.mockClear()

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
      store.dispatch(setLoadingPrevMessagesStateAC(LOADING_STATE.LOADING))
      store.dispatch(setLoadingNextMessagesStateAC(LOADING_STATE.LOADING))
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
      store.dispatch(setLoadingPrevMessagesStateAC(LOADING_STATE.LOADED))
      store.dispatch(setLoadingNextMessagesStateAC(LOADING_STATE.LOADED))
      await jumpPromise
    })

    act(() => {
      flushAnimationFrames()
    })

    const latestEdgeTop = scrollable.scrollTop
    expect(latestEdgeTop).toBe(LATEST_EDGE_GAP_PX)
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

    await act(async () => {
      jumpToLatestHandler(true)
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
      await Promise.resolve()
    })

    expect(store.getState().MessageReducer.loadingPrevMessagesState).toBe(LOADING_STATE.LOADED)
    expect(store.getState().MessageReducer.loadingNextMessagesState).toBe(LOADING_STATE.LOADED)
    expect(store.getState().MessageReducer.messagesHasNext).toBe(false)
    expect(scrollable.scrollTop).toBe(LATEST_EDGE_GAP_PX)
    expect(screen.queryByText('history-delayed-0')).not.toBeInTheDocument()
    expect(screen.getByText('confirmed-before-latest-delayed')).toBeInTheDocument()
    expect(screen.getByText('confirmed-latest-delayed')).toBeInTheDocument()
    expect(screen.getByText('pending-latest-delayed')).toBeInTheDocument()
  })

  it('starts next pagination in the real MessageList before a slow previous-page load settles', async () => {
    const channelId = 'channel-message-list-slow-prev-then-next'
    const initialMessages = [
      makeMessage({ id: '500', channelId, body: 'msg-500' }),
      makeMessage({ id: '501', channelId, body: 'msg-501' })
    ]
    const previousPageMessages = [
      makeMessage({ id: '498', channelId, body: 'msg-498' }),
      makeMessage({ id: '499', channelId, body: 'msg-499' })
    ]
    const nextPageMessages = [
      makeMessage({ id: '502', channelId, body: 'msg-502' }),
      makeMessage({ id: '503', channelId, body: 'msg-503' })
    ]
    const channel = makeChannel({
      id: channelId,
      lastMessage: initialMessages[initialMessages.length - 1]
    })
    const store = createMessageListStore({
      ChannelReducer: {
        activeChannel: channel
      },
      MessageReducer: {
        activeChannelMessages: initialMessages,
        messagesHasPrev: true,
        messagesHasNext: true,
        loadingPrevMessagesState: LOADING_STATE.LOADED,
        loadingNextMessagesState: LOADING_STATE.LOADED
      },
      UserReducer: {
        connectionStatus: CONNECTION_STATUS.CONNECTED
      }
    })
    const delayedDispatch = attachDelayedServerToMessageListStore(store, {
      onLoadMore: (action) => {
        if (action.payload.direction === MESSAGE_LOAD_DIRECTION.PREV) {
          return {
            messages: previousPageMessages,
            hasPrev: true,
            hasNext: true
          }
        }

        return {
          messages: nextPageMessages,
          hasPrev: true,
          hasNext: false
        }
      }
    })
    const rendered = renderMessageList(store)
    const scrollable = rendered.container.querySelector('#scrollableDiv') as HTMLDivElement

    await flushMockServerDelay()
    act(() => {
      flushAnimationFrames()
    })

    delayedDispatch.mockClear()

    act(() => {
      layoutRenderedMessageList(scrollable, {
        scrollTop: 558,
        scrollHeight: 800,
        itemTops: {
          '500': 0,
          '501': 40
        }
      })
      fireEvent.scroll(scrollable)
    })

    expect(delayedDispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, 20, MESSAGE_LOAD_DIRECTION.PREV, '500', true)
    )
    expect(store.getState().MessageReducer.loadingPrevMessagesState).toBe(LOADING_STATE.LOADING)

    delayedDispatch.mockClear()

    act(() => {
      layoutRenderedMessageList(scrollable, {
        scrollTop: 2,
        scrollHeight: 800,
        itemTops: {
          '500': -40,
          '501': 0
        }
      })
      fireEvent.scroll(scrollable)
    })

    expect(delayedDispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, 20, MESSAGE_LOAD_DIRECTION.NEXT, '501', true)
    )

    act(() => {
      layoutRenderedMessageList(scrollable, {
        scrollTop: LATEST_EDGE_GAP_PX,
        scrollHeight: 800,
        itemTops: {
          '500': 80,
          '501': 120
        }
      })
    })

    await flushMockServerDelay()
    await screen.findByText('msg-502')
    await screen.findByText('msg-503')

    act(() => {
      layoutRenderedMessageList(scrollable, {
        scrollTop: LATEST_EDGE_GAP_PX,
        scrollHeight: 960,
        itemTops: {
          '500': 0,
          '501': 40,
          '502': 80,
          '503': 120
        }
      })
      flushAnimationFrames()
    })

    expect(scrollable.scrollTop).toBe(LATEST_EDGE_GAP_PX)
    expect(screen.queryByText('msg-498')).not.toBeInTheDocument()
    expect(screen.queryByText('msg-499')).not.toBeInTheDocument()
    expect(screen.getByText('msg-502')).toBeInTheDocument()
    expect(screen.getByText('msg-503')).toBeInTheDocument()
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
    expect(loadLatestAction?.payload.channel.lastMessage?.body).toBe('confirmed-latest')

    await act(async () => {
      store.dispatch(setMessagesAC([confirmedBase, confirmedLatest, pendingLatest]))
      store.dispatch(setMessagesHasNextAC(false))
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })

    act(() => {
      flushAnimationFrames()
    })

    expect(scrollable.scrollTop).toBe(LATEST_EDGE_GAP_PX)
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

  it('shows newly received messages after reconnecting with a pending local tail', async () => {
    const channelId = 'channel-reconnect-pending-and-received'
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
      createdAt: new Date('2026-04-08T12:10:00.000Z')
    })
    const receivedOne = makeMessage({
      id: '1000',
      channelId,
      body: 'received-1000',
      incoming: true
    })
    const receivedTwo = makeMessage({
      id: '1001',
      channelId,
      body: 'received-1001',
      incoming: true
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

    const delayedDispatch = attachDelayedServerToMessageListStore(store, {
      onReconnect: () => ({
        channel: {
          ...channel,
          lastMessage: receivedTwo
        }
      }),
      onLoadDefault: () => ({
        messages: [confirmedBase, confirmedLatest, receivedOne, receivedTwo, pendingLatest],
        hasNext: false
      }),
      onLoadLatest: () => ({
        messages: [confirmedBase, confirmedLatest, receivedOne, receivedTwo, pendingLatest],
        hasNext: false
      }),
      onLoadAround: () => ({
        messages: [confirmedBase, confirmedLatest, receivedOne, receivedTwo, pendingLatest],
        hasNext: false
      })
    })

    delayedDispatch.mockClear()

    act(() => {
      store.dispatch(setConnectionStatusAC(CONNECTION_STATUS.CONNECTED))
    })

    await flushMockServerDelay()

    act(() => {
      flushAnimationFrames()
    })

    const reconnectActionTypes = delayedDispatch.mock.calls.map(([action]: [any]) => action.type)

    expect(reconnectActionTypes).toContain(reloadActiveChannelAfterReconnectAC(channel).type)
    expect(reconnectActionTypes).toContain(loadLatestMessagesAC(channel).type)
    expect(store.getState().ChannelReducer.activeChannel.lastMessage?.id).toBe(receivedTwo.id)
    expect(screen.getAllByTestId('message-row').map((node) => node.textContent)).toEqual([
      'confirmed-base',
      'confirmed-latest',
      'received-1000',
      'received-1001',
      'pending-latest'
    ])
  })

  it('shows the unread divider on the first unread message after reconnect fallback when no visible anchor is available', async () => {
    const channelId = 'channel-reconnect-unread-divider'
    const lastDisplayed = makeMessage({
      id: '1498',
      channelId,
      body: 'last-displayed'
    })
    const unreadOne = makeMessage({
      id: '1499',
      channelId,
      body: 'unread-one',
      incoming: true
    })
    const unreadTwo = makeMessage({
      id: '1500',
      channelId,
      body: 'unread-two',
      incoming: true
    })
    const latest = makeMessage({
      id: '1501',
      channelId,
      body: 'latest',
      incoming: true
    })
    const channel = makeChannel({
      id: channelId,
      newMessageCount: 0,
      lastDisplayedMessageId: '',
      lastMessage: lastDisplayed
    })
    const store = createMessageListStore({
      ChannelReducer: {
        activeChannel: channel
      },
      MessageReducer: {
        activeChannelMessages: [],
        messagesHasPrev: true,
        messagesHasNext: true,
        unreadMessageId: '',
        loadingPrevMessagesState: LOADING_STATE.LOADED,
        loadingNextMessagesState: LOADING_STATE.LOADED
      },
      UserReducer: {
        connectionStatus: CONNECTION_STATUS.DISCONNECTED
      }
    })

    renderMessageList(store)

    const delayedDispatch = attachDelayedServerToMessageListStore(store, {
      onReconnect: () => ({
        channel: {
          ...channel,
          newMessageCount: 3,
          lastDisplayedMessageId: lastDisplayed.id,
          lastMessage: latest
        }
      }),
      onLoadNearUnread: () => ({
        messages: [lastDisplayed, unreadOne, unreadTwo, latest],
        hasNext: false,
        unreadMessageId: lastDisplayed.id
      })
    })

    delayedDispatch.mockClear()

    act(() => {
      store.dispatch(setConnectionStatusAC(CONNECTION_STATUS.CONNECTED))
    })

    await flushMockServerDelay()
    await flushMockServerDelay()
    await flushMockServerDelay()

    act(() => {
      flushAnimationFrames()
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(delayedDispatch.mock.calls.map(([action]: [any]) => action.type)).toEqual(
      expect.arrayContaining([reloadActiveChannelAfterReconnectAC(channel).type, loadNearUnreadAC(channel).type])
    )
    expect(store.getState().MessageReducer.unreadMessageId).toBe(lastDisplayed.id)
    expectUnreadDividerAt('unread-one')
    expect(screen.getByText('unread-two')).toHaveAttribute('data-message-is-unread', 'true')
    expect(getRenderedMessageBodies()).toEqual(['last-displayed', 'unread-one', 'unread-two', 'latest'])
  })

  it('shows the unread divider when opening a background chat that received messages while another chat stayed active', async () => {
    const otherChannel = makeChannel({
      id: 'channel-other-active',
      lastMessage: makeMessage({
        id: '1600',
        channelId: 'channel-other-active',
        body: 'other-latest'
      })
    })
    const targetChannelId = 'channel-background-unread-open'
    const lastDisplayed = makeMessage({
      id: '1698',
      channelId: targetChannelId,
      body: 'target-last-displayed'
    })
    const unreadOne = makeMessage({
      id: '1699',
      channelId: targetChannelId,
      body: 'target-unread-one',
      incoming: true
    })
    const unreadTwo = makeMessage({
      id: '1700',
      channelId: targetChannelId,
      body: 'target-unread-two',
      incoming: true
    })
    const targetUnreadChannel = makeChannel({
      id: targetChannelId,
      newMessageCount: 2,
      lastDisplayedMessageId: lastDisplayed.id,
      lastMessage: unreadTwo
    })
    const store = createMessageListStore({
      ChannelReducer: {
        activeChannel: otherChannel
      },
      MessageReducer: {
        activeChannelMessages: [
          makeMessage({
            id: '1599',
            channelId: otherChannel.id,
            body: 'other-visible'
          }),
          otherChannel.lastMessage as IMessage
        ]
      },
      UserReducer: {
        connectionStatus: CONNECTION_STATUS.CONNECTED
      }
    })

    renderMessageList(store)

    const delayedDispatch = attachDelayedServerToMessageListStore(store, {
      onLoadNearUnread: (action) => {
        if (action.payload.channel.id !== targetChannelId) {
          return { messages: [] }
        }

        return {
          messages: [lastDisplayed, unreadOne, unreadTwo],
          hasNext: false,
          unreadMessageId: lastDisplayed.id
        }
      }
    })

    delayedDispatch.mockClear()

    await act(async () => {
      store.dispatch(setActiveChannelAC(targetUnreadChannel))
      await Promise.resolve()
    })

    await flushMockServerDelay()

    act(() => {
      flushAnimationFrames()
    })

    expect(delayedDispatch.mock.calls.map(([action]: [any]) => action.type)).toEqual(
      expect.arrayContaining([loadNearUnreadAC(targetUnreadChannel).type])
    )
    expect(store.getState().MessageReducer.unreadMessageId).toBe(lastDisplayed.id)
    expectUnreadDividerAt('target-unread-one')
    expect(screen.getByText('target-unread-two')).toHaveAttribute('data-message-is-unread', 'true')
    expect(getRenderedMessageBodies()).toEqual(['target-last-displayed', 'target-unread-one', 'target-unread-two'])
  })

  it('keeps the unread divider before remote unread messages when returning to a chat with an offline pending local tail', async () => {
    const channelId = 'channel-offline-pending-then-return'
    const lastDisplayed = makeMessage({
      id: '1798',
      channelId,
      body: 'history-last-displayed'
    })
    const pendingLocal = makePendingMessage({
      channelId,
      body: 'pending-local-tail',
      createdAt: new Date('2026-04-09T09:10:00.000Z')
    })
    const otherChannel = makeChannel({
      id: 'channel-away-for-return',
      lastMessage: makeMessage({
        id: '1805',
        channelId: 'channel-away-for-return',
        body: 'other-chat-latest'
      })
    })
    const unreadOne = makeMessage({
      id: '1799',
      channelId,
      body: 'remote-unread-one',
      incoming: true
    })
    const unreadTwo = makeMessage({
      id: '1800',
      channelId,
      body: 'remote-unread-two',
      incoming: true
    })
    const reopenedChannel = makeChannel({
      id: channelId,
      newMessageCount: 2,
      lastDisplayedMessageId: lastDisplayed.id,
      lastMessage: unreadTwo
    })
    const store = createMessageListStore({
      ChannelReducer: {
        activeChannel: makeChannel({
          id: channelId,
          lastMessage: lastDisplayed
        })
      },
      MessageReducer: {
        activeChannelMessages: [lastDisplayed],
        messagesHasPrev: true,
        messagesHasNext: false
      },
      UserReducer: {
        connectionStatus: CONNECTION_STATUS.DISCONNECTED
      }
    })

    renderMessageList(store)

    await act(async () => {
      store.dispatch(updateChannelDataAC(channelId, { lastMessage: pendingLocal }, true))
      store.dispatch(addMessageAC(pendingLocal))
      await Promise.resolve()
    })

    const delayedDispatch = attachDelayedServerToMessageListStore(store, {
      onLoadNearUnread: (action) => {
        if (action.payload.channel.id !== channelId) {
          return { messages: [] }
        }

        return {
          messages: [lastDisplayed, unreadOne, unreadTwo, pendingLocal],
          hasNext: false,
          unreadMessageId: lastDisplayed.id
        }
      }
    })

    delayedDispatch.mockClear()

    await act(async () => {
      store.dispatch(setActiveChannelAC(otherChannel))
      await Promise.resolve()
    })

    await act(async () => {
      store.dispatch(setActiveChannelAC(reopenedChannel))
      await Promise.resolve()
    })

    await flushMockServerDelay()

    act(() => {
      flushAnimationFrames()
    })

    expect(delayedDispatch.mock.calls.map(([action]: [any]) => action.type)).toEqual(
      expect.arrayContaining([loadNearUnreadAC(reopenedChannel).type])
    )
    expectUnreadDividerAt('remote-unread-one')
    expect(screen.getByText('pending-local-tail')).toHaveAttribute('data-message-is-unread', 'false')
    expect(getRenderedMessageBodies()).toEqual([
      'history-last-displayed',
      'remote-unread-one',
      'remote-unread-two',
      'pending-local-tail'
    ])
  })

  it('shows the unread divider before remote unread messages after reconnecting with a pending local tail', async () => {
    const channelId = 'channel-reconnect-unread-with-pending-tail'
    const lastDisplayed = makeMessage({
      id: '1898',
      channelId,
      body: 'reconnect-last-displayed'
    })
    const unreadOne = makeMessage({
      id: '1899',
      channelId,
      body: 'reconnect-unread-one',
      incoming: true
    })
    const unreadTwo = makeMessage({
      id: '1900',
      channelId,
      body: 'reconnect-unread-two',
      incoming: true
    })
    const pendingLocal = makePendingMessage({
      channelId,
      body: 'reconnect-pending-local',
      createdAt: new Date('2026-04-09T09:20:00.000Z')
    })
    const channel = makeChannel({
      id: channelId,
      newMessageCount: 0,
      lastDisplayedMessageId: '',
      lastMessage: lastDisplayed
    })
    const store = createMessageListStore({
      ChannelReducer: {
        activeChannel: channel
      },
      MessageReducer: {
        activeChannelMessages: [],
        messagesHasPrev: true,
        messagesHasNext: true,
        unreadMessageId: '',
        loadingPrevMessagesState: LOADING_STATE.LOADED,
        loadingNextMessagesState: LOADING_STATE.LOADED
      },
      UserReducer: {
        connectionStatus: CONNECTION_STATUS.DISCONNECTED
      }
    })

    renderMessageList(store)

    const delayedDispatch = attachDelayedServerToMessageListStore(store, {
      onReconnect: () => ({
        channel: {
          ...channel,
          newMessageCount: 2,
          lastDisplayedMessageId: lastDisplayed.id,
          lastMessage: unreadTwo
        }
      }),
      onLoadNearUnread: () => ({
        messages: [lastDisplayed, unreadOne, unreadTwo, pendingLocal],
        hasNext: false,
        unreadMessageId: lastDisplayed.id
      }),
      onLoadLatest: () => ({
        messages: [lastDisplayed, unreadOne, unreadTwo, pendingLocal],
        hasNext: false,
        unreadMessageId: lastDisplayed.id
      })
    })

    delayedDispatch.mockClear()

    act(() => {
      store.dispatch(setConnectionStatusAC(CONNECTION_STATUS.CONNECTED))
    })

    await flushMockServerDelay()
    await flushMockServerDelay()
    await flushMockServerDelay()

    act(() => {
      flushAnimationFrames()
    })
    await act(async () => {
      await Promise.resolve()
    })

    const reconnectActionTypes = delayedDispatch.mock.calls.map(([action]: [any]) => action.type)

    expect(reconnectActionTypes).toContain(reloadActiveChannelAfterReconnectAC(channel).type)
    expect(
      reconnectActionTypes.some(
        (type) => type === loadNearUnreadAC(channel).type || type === loadLatestMessagesAC(channel).type
      )
    ).toBe(true)
    expectUnreadDividerAt('reconnect-unread-one')
    expect(screen.getByText('reconnect-pending-local')).toHaveAttribute('data-message-is-unread', 'false')
    expect(getRenderedMessageBodies()).toEqual([
      'reconnect-last-displayed',
      'reconnect-unread-one',
      'reconnect-unread-two',
      'reconnect-pending-local'
    ])
  })
})
