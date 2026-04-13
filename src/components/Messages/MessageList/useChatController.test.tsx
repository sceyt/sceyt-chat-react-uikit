import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { LOADING_STATE } from '../../../helpers/constants'
import {
  addMessageToMap,
  clearMessagesMap,
  getMessageLocalRef,
  clearVisibleMessagesMap,
  LOAD_MAX_MESSAGE_COUNT,
  setActiveSegment,
  MESSAGE_LOAD_DIRECTION
} from '../../../helpers/messagesHalper'
import { CONNECTION_STATUS } from '../../../store/user/constants'
import { markMessagesAsReadAC } from '../../../store/channel/actions'
import {
  addMessagesAC,
  clearActivePaginationIntentAC,
  loadAroundMessageAC,
  loadDefaultMessagesAC,
  loadLatestMessagesAC,
  loadMoreMessagesAC,
  reloadActiveChannelAfterReconnectAC,
  refreshCacheAroundMessageAC,
  setActivePaginationIntentAC,
  setStableUnreadAnchorAC,
  setUnreadMessageIdAC,
  setUnreadScrollToAC,
  showScrollToNewMessageButtonAC
} from '../../../store/message/actions'
import { IChannel, IMessage } from '../../../types'
import {
  flushAnimationFrames,
  makeChannel,
  makeMessage,
  makePendingMessage,
  resetMessageListFixtureIds,
  setElementIntersecting,
  setElementRect,
  setScrollMetrics
} from '../../../testUtils/messageListHarness'
import {
  MOCK_SERVER_DELAY_MAX_MS,
  resetMockServerDelay,
  resolveWithMockServerDelay
} from '../../../testUtils/mockServerDelay'
import { LATEST_EDGE_GAP_PX, useChatController } from './useChatController'

type HarnessProps = {
  messages: IMessage[]
  channel: IChannel
  hasPrevMessages?: boolean
  hasNextMessages?: boolean
  loadingPrevMessages?: number | null
  loadingNextMessages?: number | null
  connectionStatus?: string
  unreadScrollTo?: boolean | string
  unreadMessageId?: string
  stableUnreadAnchor?: { channelId: string; messageId: string }
  showScrollToNewMessageButton?: boolean
  scrollToMentionedMessage?: boolean | string | null
  scrollToRepliedMessageId?: string | null
  jumpToItemId?: string | null
  jumpToItemSmooth?: boolean
  scrollToMessageHighlight?: boolean
  scrollToMessageBehavior?: ScrollBehavior
  dispatch?: jest.Mock
  layoutSpec?: {
    containerRect?: { top?: number; left?: number; width?: number; height?: number }
    scrollMetrics?: {
      scrollTop?: number
      scrollHeight?: number
      clientHeight?: number
      offsetTop?: number
      offsetHeight?: number
    }
    itemRects?: Record<string, { top?: number; left?: number; width?: number; height?: number }>
    unreadDividerRect?: { top?: number; left?: number; width?: number; height?: number }
  }
}

type ResolvedLayoutSpec = HarnessProps['layoutSpec']

type AsyncControllerState = {
  channel: IChannel
  messages: IMessage[]
  hasPrevMessages: boolean
  hasNextMessages: boolean
  loadingPrevMessages: number | null
  loadingNextMessages: number | null
  unreadScrollTo: boolean | string
  unreadMessageId: string
  stableUnreadAnchor: { channelId: string; messageId: string }
  showScrollToNewMessageButton: boolean
}

type AsyncControllerServerResponse = Partial<AsyncControllerState>

type AsyncControllerServer = {
  onLoadDefault?: (
    state: AsyncControllerState,
    action: any
  ) => AsyncControllerServerResponse | Promise<AsyncControllerServerResponse>
  onLoadLatest?: (
    state: AsyncControllerState,
    action: any
  ) => AsyncControllerServerResponse | Promise<AsyncControllerServerResponse>
  onLoadMore?: (
    state: AsyncControllerState,
    action: any
  ) => AsyncControllerServerResponse | Promise<AsyncControllerServerResponse>
  onLoadAround?: (
    state: AsyncControllerState,
    action: any
  ) => AsyncControllerServerResponse | Promise<AsyncControllerServerResponse>
}

type AsyncHarnessProps = Omit<HarnessProps, 'layoutSpec'> & {
  layoutSpec?: ResolvedLayoutSpec | ((state: AsyncControllerState) => ResolvedLayoutSpec)
  server: AsyncControllerServer
}

const flushEffects = async () => {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 0))
  })
}

const flushMockServerDelay = async () => {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, MOCK_SERVER_DELAY_MAX_MS + 25))
  })
}

const layoutTimeline = (
  container: HTMLElement | null,
  options: {
    scrollHeight?: number
    clientHeight?: number
  } = {}
) => {
  if (!container) {
    return
  }

  const itemCount = container.querySelectorAll('[data-message-list-item-id]').length
  const clientHeight = options.clientHeight ?? 240
  const scrollHeight = options.scrollHeight ?? Math.max(800, itemCount * 40 + 80)

  setElementRect(container, { top: 0, left: 0, width: 320, height: clientHeight })
  setScrollMetrics(container as HTMLDivElement, {
    scrollTop: (container as HTMLDivElement).scrollTop || 0,
    scrollHeight,
    clientHeight,
    offsetTop: 0,
    offsetHeight: clientHeight
  })

  Array.from(container.querySelectorAll<HTMLElement>('[data-message-list-item-id]')).forEach((element, index) => {
    setElementRect(element, {
      top: index * 40,
      left: 0,
      width: 320,
      height: 32
    })
  })

  const unreadDivider = container.querySelector<HTMLElement>('[data-message-list-unread-divider="true"]')
  if (unreadDivider) {
    setElementRect(unreadDivider, {
      top: 80,
      left: 0,
      width: 320,
      height: 24
    })
  }
}

const ControllerHarness = ({
  messages,
  channel,
  hasPrevMessages = false,
  hasNextMessages = false,
  loadingPrevMessages = LOADING_STATE.LOADED,
  loadingNextMessages = LOADING_STATE.LOADED,
  connectionStatus = CONNECTION_STATUS.CONNECTED,
  unreadScrollTo = false,
  unreadMessageId = '',
  stableUnreadAnchor,
  showScrollToNewMessageButton = false,
  scrollToMentionedMessage = null,
  scrollToRepliedMessageId = null,
  jumpToItemId = null,
  jumpToItemSmooth = false,
  scrollToMessageHighlight = true,
  scrollToMessageBehavior = 'smooth',
  dispatch = jest.fn(),
  layoutSpec
}: HarnessProps) => {
  const stableUnreadAnchorChannelId = stableUnreadAnchor?.channelId ?? channel.id
  const stableUnreadAnchorMessageId = stableUnreadAnchor?.messageId ?? unreadMessageId

  const [controllerState, setControllerState] = React.useState(() => ({
    unreadScrollTo,
    unreadMessageId,
    stableUnreadAnchor: {
      channelId: stableUnreadAnchorChannelId,
      messageId: stableUnreadAnchorMessageId
    },
    showScrollToNewMessageButton
  }))

  React.useEffect(() => {
    setControllerState({
      unreadScrollTo,
      unreadMessageId,
      stableUnreadAnchor: {
        channelId: stableUnreadAnchorChannelId,
        messageId: stableUnreadAnchorMessageId
      },
      showScrollToNewMessageButton
    })
  }, [
    showScrollToNewMessageButton,
    stableUnreadAnchorChannelId,
    stableUnreadAnchorMessageId,
    unreadMessageId,
    unreadScrollTo
  ])

  const controlledDispatch = React.useCallback(
    (action: any) => {
      dispatch(action)

      if (action.type === setUnreadScrollToAC(false).type) {
        setControllerState((prev) => ({ ...prev, unreadScrollTo: action.payload.state }))
        return
      }

      if (action.type === setUnreadMessageIdAC('').type) {
        setControllerState((prev) => ({ ...prev, unreadMessageId: action.payload.messageId }))
        return
      }

      if (action.type === setStableUnreadAnchorAC('', '').type) {
        setControllerState((prev) => ({ ...prev, stableUnreadAnchor: action.payload }))
        return
      }

      if (action.type === showScrollToNewMessageButtonAC(false).type) {
        setControllerState((prev) => ({ ...prev, showScrollToNewMessageButton: action.payload.state }))
      }
    },
    [dispatch]
  )

  const controller = useChatController({
    messages,
    channel,
    hasPrevMessages,
    hasNextMessages,
    loadingPrevMessages,
    loadingNextMessages,
    connectionStatus,
    scrollToNewMessage: {
      scrollToBottom: false,
      isIncomingMessage: false,
      updateMessageList: false
    },
    scrollToMentionedMessage,
    scrollToRepliedMessageId,
    scrollToMessageHighlight,
    scrollToMessageBehavior,
    showScrollToNewMessageButton: controllerState.showScrollToNewMessageButton,
    unreadScrollTo: controllerState.unreadScrollTo,
    unreadMessageId: controllerState.unreadMessageId,
    selectedMessagesMap: new Map(),
    allowEditDeleteIncomingMessage: true,
    dispatch: controlledDispatch
  })

  const attachScrollRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      controller.scrollRef.current = node
      if (!node || !layoutSpec) {
        return
      }

      setElementRect(node, layoutSpec.containerRect || { top: 0, left: 0, width: 320, height: 240 })
      setScrollMetrics(node, {
        scrollTop: layoutSpec.scrollMetrics?.scrollTop ?? node.scrollTop ?? 0,
        scrollHeight: layoutSpec.scrollMetrics?.scrollHeight ?? node.scrollHeight ?? 0,
        clientHeight: layoutSpec.scrollMetrics?.clientHeight ?? node.clientHeight ?? 0,
        offsetTop: layoutSpec.scrollMetrics?.offsetTop ?? node.offsetTop ?? 0,
        offsetHeight: layoutSpec.scrollMetrics?.offsetHeight ?? node.offsetHeight ?? 0
      })
    },
    [controller.scrollRef, layoutSpec]
  )

  const attachTimelineItem = React.useCallback(
    (localRef: string, registerItemElement: (el: HTMLElement | null) => void) => (el: HTMLElement | null) => {
      registerItemElement(el)
      if (!el || !layoutSpec?.itemRects?.[localRef]) {
        return
      }

      setElementRect(el, layoutSpec.itemRects[localRef])
    },
    [layoutSpec]
  )

  const attachUnreadDivider = React.useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || !layoutSpec?.unreadDividerRect) {
        return
      }

      setElementRect(node, layoutSpec.unreadDividerRect)
    },
    [layoutSpec]
  )

  return (
    <div>
      <button
        data-testid='jump-to-latest'
        onClick={() => {
          controller.jumpToLatest(true).catch(() => undefined)
        }}
      >
        jump latest
      </button>
      {jumpToItemId ? (
        <button
          data-testid='jump-to-item'
          onClick={() => {
            controller.jumpToItem(jumpToItemId, jumpToItemSmooth).catch(() => undefined)
          }}
        >
          jump item
        </button>
      ) : null}
      {messages.map((message, index) => (
        <button
          data-testid={`set-visible-${index}`}
          key={`set-visible-${getMessageLocalRef(message)}`}
          onClick={() => controller.setLastVisibleMessageId(message)}
        >
          set visible {index}
        </button>
      ))}
      <div data-testid='pending-newest-count'>{controller.pendingNewestCount}</div>
      <div data-testid='remaining-unread-count'>{controller.remainingUnreadCount}</div>
      <div data-testid='is-viewing-latest'>{String(controller.isViewingLatest)}</div>
      <div id='scrollableDiv' ref={attachScrollRef}>
        {controller.timelineItems.map((timelineItem) => {
          if (timelineItem.type === 'date-divider') {
            return <div key={timelineItem.key}>{timelineItem.label}</div>
          }

          if (timelineItem.type === 'unread-divider') {
            return (
              <div data-message-list-unread-divider='true' key={timelineItem.key} ref={attachUnreadDivider}>
                unread divider
              </div>
            )
          }

          return (
            <div
              data-message-list-item-id={timelineItem.localRef}
              key={timelineItem.key}
              ref={attachTimelineItem(timelineItem.localRef, timelineItem.registerItemElement)}
            >
              {timelineItem.item.body}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const renderController = (props: HarnessProps) => {
  const dispatch = props.dispatch || jest.fn()
  const rendered = render(<ControllerHarness {...props} dispatch={dispatch} />)
  const scrollable = rendered.container.querySelector('#scrollableDiv') as HTMLDivElement
  if (!props.layoutSpec) {
    layoutTimeline(scrollable)
  }

  return {
    ...rendered,
    dispatch,
    scrollable
  }
}

const buildAsyncControllerState = (props: AsyncHarnessProps): AsyncControllerState => ({
  channel: props.channel,
  messages: props.messages,
  hasPrevMessages: props.hasPrevMessages ?? false,
  hasNextMessages: props.hasNextMessages ?? false,
  loadingPrevMessages: props.loadingPrevMessages ?? LOADING_STATE.LOADED,
  loadingNextMessages: props.loadingNextMessages ?? LOADING_STATE.LOADED,
  unreadScrollTo: props.unreadScrollTo ?? false,
  unreadMessageId: props.unreadMessageId ?? '',
  stableUnreadAnchor: props.stableUnreadAnchor ?? {
    channelId: props.channel.id,
    messageId: props.unreadMessageId ?? ''
  },
  showScrollToNewMessageButton: props.showScrollToNewMessageButton ?? false
})

const AsyncControllerHarness = ({ server, dispatch = jest.fn(), layoutSpec, ...props }: AsyncHarnessProps) => {
  const [state, setState] = React.useState<AsyncControllerState>(() =>
    buildAsyncControllerState({ ...props, server, dispatch })
  )
  const stateRef = React.useRef(state)
  const activePaginationIntentRef = React.useRef<{
    channelId: string
    direction: 'prev' | 'next'
    requestId: string
    anchorId: string
  } | null>(null)

  React.useEffect(() => {
    stateRef.current = state
  }, [state])

  React.useEffect(() => {
    setState((prev) => ({
      ...prev,
      channel: props.channel,
      messages: props.messages,
      hasPrevMessages: props.hasPrevMessages ?? false,
      hasNextMessages: props.hasNextMessages ?? false,
      loadingPrevMessages: props.loadingPrevMessages ?? LOADING_STATE.LOADED,
      loadingNextMessages: props.loadingNextMessages ?? LOADING_STATE.LOADED,
      unreadScrollTo: props.unreadScrollTo ?? false,
      unreadMessageId: props.unreadMessageId ?? '',
      stableUnreadAnchor: props.stableUnreadAnchor ?? {
        channelId: props.channel.id,
        messageId: props.unreadMessageId ?? ''
      },
      showScrollToNewMessageButton: props.showScrollToNewMessageButton ?? false
    }))
  }, [
    props.channel,
    props.messages,
    props.hasPrevMessages,
    props.hasNextMessages,
    props.loadingPrevMessages,
    props.loadingNextMessages,
    props.unreadScrollTo,
    props.unreadMessageId,
    props.stableUnreadAnchor,
    props.showScrollToNewMessageButton
  ])

  const applyServerResponse = React.useCallback((response: AsyncControllerServerResponse) => {
    setState((prev) => ({
      ...prev,
      ...response,
      channel: response.channel || prev.channel,
      messages: response.messages || prev.messages,
      loadingPrevMessages: LOADING_STATE.LOADED,
      loadingNextMessages: LOADING_STATE.LOADED
    }))
  }, [])

  const scheduleResponse = React.useCallback(
    (
      scope: 'previous' | 'next' | 'both',
      resolver?: (
        state: AsyncControllerState,
        action: any
      ) => AsyncControllerServerResponse | Promise<AsyncControllerServerResponse>
    ) =>
      (action: any) => {
        setState((prev) => ({
          ...prev,
          loadingPrevMessages:
            scope === 'previous' || scope === 'both' ? LOADING_STATE.LOADING : prev.loadingPrevMessages,
          loadingNextMessages: scope === 'next' || scope === 'both' ? LOADING_STATE.LOADING : prev.loadingNextMessages
        }))
        resolveWithMockServerDelay(null).then(async () => {
          const response = resolver ? await resolver(stateRef.current, action) : {}
          applyServerResponse(response || {})
        })
      },
    [applyServerResponse]
  )

  const delayedDispatch = React.useCallback(
    (action: any) => {
      dispatch(action)

      if (action.type === setUnreadScrollToAC(false).type) {
        setState((prev) => ({ ...prev, unreadScrollTo: action.payload.state }))
        return
      }

      if (action.type === setUnreadMessageIdAC('').type) {
        setState((prev) => ({ ...prev, unreadMessageId: action.payload.messageId }))
        return
      }

      if (action.type === setStableUnreadAnchorAC('', '').type) {
        setState((prev) => ({ ...prev, stableUnreadAnchor: action.payload }))
        return
      }

      if (action.type === showScrollToNewMessageButtonAC(false).type) {
        setState((prev) => ({ ...prev, showScrollToNewMessageButton: action.payload.state }))
        return
      }

      if (action.type === setActivePaginationIntentAC('', 'next', '', '').type) {
        activePaginationIntentRef.current = action.payload
        return
      }

      if (action.type === clearActivePaginationIntentAC().type) {
        if (!action.payload?.requestId || activePaginationIntentRef.current?.requestId === action.payload.requestId) {
          activePaginationIntentRef.current = null
        }
        return
      }

      if (action.type === loadDefaultMessagesAC(stateRef.current.channel).type) {
        scheduleResponse('both', server.onLoadDefault)(action)
        return
      }

      if (action.type === loadLatestMessagesAC(stateRef.current.channel).type) {
        scheduleResponse('both', server.onLoadLatest)(action)
        return
      }

      if (action.type === loadMoreMessagesAC('', 0, MESSAGE_LOAD_DIRECTION.NEXT, '', false).type) {
        scheduleResponse(
          action.payload.direction === MESSAGE_LOAD_DIRECTION.PREV ? 'previous' : 'next',
          async (nextState, loadMoreAction) => {
            const response = server.onLoadMore ? await server.onLoadMore(nextState, loadMoreAction) : {}
            if (!loadMoreAction.payload.requestId) {
              return response
            }

            const activeIntent = activePaginationIntentRef.current
            const expectedDirection = loadMoreAction.payload.direction === MESSAGE_LOAD_DIRECTION.PREV ? 'prev' : 'next'
            const isCurrentIntent =
              activeIntent?.channelId === loadMoreAction.payload.channelId &&
              activeIntent.direction === expectedDirection &&
              activeIntent.requestId === loadMoreAction.payload.requestId

            return isCurrentIntent ? response : {}
          }
        )(action)
        return
      }

      if (action.type === loadAroundMessageAC(stateRef.current.channel, '').type) {
        scheduleResponse('both', server.onLoadAround)(action)
      }
    },
    [dispatch, scheduleResponse, server.onLoadAround, server.onLoadDefault, server.onLoadLatest, server.onLoadMore]
  )

  const resolvedLayoutSpec = typeof layoutSpec === 'function' ? layoutSpec(state) : layoutSpec

  return (
    <ControllerHarness {...props} {...state} layoutSpec={resolvedLayoutSpec} dispatch={delayedDispatch as jest.Mock} />
  )
}

const renderAsyncController = (props: AsyncHarnessProps) => {
  const dispatch = props.dispatch || jest.fn()
  const rendered = render(<AsyncControllerHarness {...props} dispatch={dispatch} />)
  const scrollable = rendered.container.querySelector('#scrollableDiv') as HTMLDivElement
  const relayout = (options?: { scrollHeight?: number; clientHeight?: number }) =>
    layoutTimeline(rendered.container.querySelector('#scrollableDiv'), options)

  if (!props.layoutSpec) {
    relayout()
  }

  return {
    ...rendered,
    dispatch,
    scrollable,
    relayout
  }
}

describe('useChatController', () => {
  beforeEach(() => {
    resetMessageListFixtureIds()
    resetMockServerDelay()
    clearMessagesMap()
    clearVisibleMessagesMap()
  })

  it('restores to the latest edge on the first boot without unread state', () => {
    const channel = makeChannel({
      id: 'channel-boot',
      lastMessage: makeMessage({ id: '801', channelId: 'channel-boot', body: 'latest' })
    })
    const messages = [makeMessage({ id: '800', channelId: channel.id, body: 'older' }), channel.lastMessage]

    const { scrollable } = renderController({
      channel,
      messages
    })

    expect(scrollable.scrollTop).toBe(LATEST_EDGE_GAP_PX)
  })

  it('renders the unread divider when unreadScrollTo is enabled', async () => {
    const channel = makeChannel({
      id: 'channel-unread-restore',
      lastMessage: makeMessage({ id: '901', channelId: 'channel-unread-restore', body: 'latest' }),
      lastDisplayedMessageId: '899'
    })
    const unreadMessage = makeMessage({
      id: '900',
      channelId: channel.id,
      body: 'unread-anchor',
      incoming: true
    })

    const rendered = renderController({
      channel,
      messages: [unreadMessage, channel.lastMessage],
      unreadScrollTo: true,
      unreadMessageId: ''
    })

    await flushEffects()
    rendered.rerender(
      <ControllerHarness
        channel={channel}
        messages={[unreadMessage, channel.lastMessage]}
        unreadScrollTo={true}
        unreadMessageId='899'
      />
    )
    await flushEffects()

    expect(screen.getByText('unread divider')).toBeInTheDocument()
  })

  it('renders the unread divider from the unread boundary after the channel boot settles', async () => {
    const channel = makeChannel({
      id: 'channel-unread-boot-fallback',
      lastMessage: makeMessage({
        id: '913',
        channelId: 'channel-unread-boot-fallback',
        body: 'latest',
        incoming: true
      }),
      newMessageCount: 0,
      lastDisplayedMessageId: '911'
    })
    const rendered = renderController({
      channel,
      messages: [
        makeMessage({ id: '911', channelId: channel.id, body: 'last-read', incoming: true }),
        makeMessage({ id: '912', channelId: channel.id, body: 'first-unread', incoming: true }),
        channel.lastMessage
      ],
      unreadScrollTo: true,
      unreadMessageId: ''
    })

    await flushEffects()
    rendered.rerender(
      <ControllerHarness
        channel={channel}
        messages={[
          makeMessage({ id: '911', channelId: channel.id, body: 'last-read', incoming: true }),
          makeMessage({ id: '912', channelId: channel.id, body: 'first-unread', incoming: true }),
          channel.lastMessage
        ]}
        unreadScrollTo={true}
        unreadMessageId='911'
      />
    )
    await flushEffects()
    act(() => {
      flushAnimationFrames()
    })

    expect(Array.from(rendered.scrollable.children).map((node) => node.textContent)).toEqual([
      'April 1',
      'last-read',
      'unread divider',
      'first-unread',
      'latest'
    ])
  })

  it('keeps the stable unread anchor fixed while staying in the same channel', async () => {
    const channel = makeChannel({
      id: 'channel-unread-stable-in-session',
      lastMessage: makeMessage({
        id: '922',
        channelId: 'channel-unread-stable-in-session',
        body: 'latest',
        incoming: true
      }),
      newMessageCount: 1,
      lastDisplayedMessageId: '920'
    })
    const dispatch = jest.fn()
    const stableUnreadAnchor = { channelId: channel.id, messageId: '920' }
    const rendered = renderController({
      channel,
      messages: [
        makeMessage({ id: '920', channelId: channel.id, body: 'last-read', incoming: true }),
        channel.lastMessage
      ],
      unreadScrollTo: true,
      unreadMessageId: '',
      stableUnreadAnchor,
      dispatch
    })

    await flushEffects()
    dispatch.mockClear()

    rendered.rerender(
      <ControllerHarness
        channel={channel}
        messages={[
          makeMessage({ id: '920', channelId: channel.id, body: 'last-read', incoming: true }),
          makeMessage({ id: '921', channelId: channel.id, body: 'new-unread', incoming: true }),
          channel.lastMessage
        ]}
        unreadScrollTo={true}
        unreadMessageId=''
        stableUnreadAnchor={stableUnreadAnchor}
        dispatch={dispatch}
      />
    )

    await flushEffects()

    expect(dispatch).not.toHaveBeenCalledWith(setStableUnreadAnchorAC(channel.id, '921'))
  })

  it('restores to the unread divider and still paginates toward latest from the unread window', async () => {
    const channel = makeChannel({
      id: 'channel-unread-pagination',
      lastMessage: makeMessage({ id: '904', channelId: 'channel-unread-pagination', body: 'latest' }),
      newMessageCount: 100,
      lastDisplayedMessageId: '902'
    })
    const messages = [
      makeMessage({ id: '901', channelId: channel.id, body: 'older-read' }),
      makeMessage({ id: '902', channelId: channel.id, body: 'newer-read' }),
      makeMessage({ id: '903', channelId: channel.id, body: 'first-unread', incoming: true }),
      makeMessage({ id: '904', channelId: channel.id, body: 'latest', incoming: true })
    ]
    const dispatch = jest.fn()
    const rendered = renderController({
      channel,
      messages,
      unreadScrollTo: true,
      unreadMessageId: '',
      hasNextMessages: true,
      dispatch
    })

    await flushEffects()
    rendered.rerender(
      <ControllerHarness
        channel={channel}
        messages={messages}
        unreadScrollTo={true}
        unreadMessageId='902'
        hasNextMessages={true}
        dispatch={dispatch}
      />
    )
    await flushEffects()
    act(() => {
      flushAnimationFrames()
    })

    expect(screen.getByText('unread divider')).toBeInTheDocument()
    expect(screen.getByTestId('is-viewing-latest')).toHaveTextContent('false')
    expect(dispatch).toHaveBeenCalledWith(setUnreadScrollToAC(false))

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(rendered.scrollable, {
        scrollTop: 2,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(rendered.scrollable)
    })

    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.NEXT, '904', true)
    )
  })

  it('places the unread divider after lastDisplayedMessageId instead of before the last read day', async () => {
    const aprilFirst = new Date('2026-04-01T16:58:00.000Z')
    const today = new Date()
    const channel = makeChannel({
      id: 'channel-unread-anchor-after-last-displayed',
      lastMessage: makeMessage({
        id: '1003',
        channelId: 'channel-unread-anchor-after-last-displayed',
        body: 'today-second',
        createdAt: today,
        incoming: true
      }),
      newMessageCount: 0,
      lastDisplayedMessageId: '1001'
    })
    const messages = [
      makeMessage({
        id: '1001',
        channelId: channel.id,
        body: 'april-last-read',
        createdAt: aprilFirst,
        incoming: false
      }),
      makeMessage({
        id: '1002',
        channelId: channel.id,
        body: 'today-first',
        createdAt: today,
        incoming: true
      }),
      channel.lastMessage
    ]

    const rendered = renderController({
      channel,
      messages,
      unreadScrollTo: true,
      unreadMessageId: ''
    })

    await flushEffects()
    rendered.rerender(
      <ControllerHarness channel={channel} messages={messages} unreadScrollTo={true} unreadMessageId='1001' />
    )
    await flushEffects()
    act(() => {
      flushAnimationFrames()
    })

    expect(Array.from(rendered.scrollable.children).map((node) => node.textContent)).toEqual([
      'April 1',
      'april-last-read',
      'Today',
      'unread divider',
      'today-first',
      'today-second'
    ])
  })

  it('places the unread divider immediately after lastDisplayedMessageId even when own outgoing messages follow', async () => {
    const today = new Date()
    const channel = makeChannel({
      id: 'channel-unread-divider-skips-own-outgoing',
      lastMessage: makeMessage({
        id: '1014',
        channelId: 'channel-unread-divider-skips-own-outgoing',
        body: 'incoming-unread-2',
        createdAt: today,
        incoming: true
      }),
      newMessageCount: 0,
      lastDisplayedMessageId: '1011'
    })
    const messages = [
      makeMessage({
        id: '1011',
        channelId: channel.id,
        body: 'last-read',
        createdAt: today,
        incoming: true
      }),
      makeMessage({
        id: '1012',
        channelId: channel.id,
        body: 'own-outgoing',
        createdAt: today,
        incoming: false
      }),
      makeMessage({
        id: '1013',
        channelId: channel.id,
        body: 'incoming-unread-1',
        createdAt: today,
        incoming: true
      }),
      channel.lastMessage
    ]

    const rendered = renderController({
      channel,
      messages,
      unreadScrollTo: true,
      unreadMessageId: ''
    })

    await flushEffects()
    rendered.rerender(
      <ControllerHarness channel={channel} messages={messages} unreadScrollTo={true} unreadMessageId='1011' />
    )
    await flushEffects()
    act(() => {
      flushAnimationFrames()
    })

    expect(Array.from(rendered.scrollable.children).map((node) => node.textContent)).toEqual([
      'Today',
      'last-read',
      'unread divider',
      'own-outgoing',
      'incoming-unread-1',
      'incoming-unread-2'
    ])
  })

  it('keeps the total unread count from the channel even when only part of the unread range is loaded', () => {
    const channel = makeChannel({
      id: 'channel-unread-total-count',
      lastMessage: makeMessage({ id: '1205', channelId: 'channel-unread-total-count', body: 'latest', incoming: true }),
      newMessageCount: 100,
      lastDisplayedMessageId: '1200'
    })
    const messages = [
      makeMessage({ id: '1200', channelId: channel.id, body: 'last-read' }),
      ...Array.from({ length: 5 }, (_, index) =>
        makeMessage({
          id: String(1201 + index),
          channelId: channel.id,
          body: `unread-${index}`,
          incoming: true
        })
      )
    ]

    renderController({
      channel,
      messages,
      unreadMessageId: '1200',
      connectionStatus: CONNECTION_STATUS.CONNECTED
    })

    expect(screen.getByTestId('remaining-unread-count')).toHaveTextContent('100')
  })

  it('seeds the unread boundary when new unread messages arrive while staying in deep history', async () => {
    const channelId = 'channel-seed-unread-boundary-in-history'
    const channel = makeChannel({
      id: channelId,
      lastMessage: makeMessage({
        id: '2002',
        channelId,
        body: 'latest-unread',
        incoming: true
      }),
      newMessageCount: 0,
      lastDisplayedMessageId: '2000'
    })
    const messages = [
      makeMessage({ id: '1801', channelId, body: 'history-1', incoming: true }),
      makeMessage({ id: '1802', channelId, body: 'history-2', incoming: true })
    ]
    const dispatch = jest.fn()
    const rendered = renderController({
      channel,
      messages,
      hasPrevMessages: true,
      hasNextMessages: true,
      unreadMessageId: '',
      dispatch
    })

    await flushEffects()
    dispatch.mockClear()

    const nextChannel = {
      ...channel,
      newMessageCount: 2,
      unread: true as const
    }

    rendered.rerender(
      <ControllerHarness
        channel={nextChannel}
        messages={messages}
        hasPrevMessages={true}
        hasNextMessages={true}
        unreadMessageId=''
        dispatch={dispatch}
      />
    )

    await flushEffects()

    expect(dispatch).toHaveBeenCalledWith(setUnreadMessageIdAC('2000'))
  })

  it('handles delayed next-page loading through the controller harness and reads the loaded unread latest window', async () => {
    const channel = makeChannel({
      id: 'channel-delayed-controller-next',
      lastMessage: makeMessage({
        id: '1404',
        channelId: 'channel-delayed-controller-next',
        body: 'latest-unread',
        incoming: true
      }),
      newMessageCount: 60,
      lastDisplayedMessageId: '1400'
    })
    const initialMessages = [
      makeMessage({ id: '1401', channelId: channel.id, body: 'unread-1', incoming: true }),
      makeMessage({ id: '1402', channelId: channel.id, body: 'unread-2', incoming: true })
    ]
    const loadedMessages = [
      ...initialMessages,
      makeMessage({ id: '1403', channelId: channel.id, body: 'unread-3', incoming: true }),
      channel.lastMessage
    ]
    const dispatch = jest.fn()
    const rendered = renderAsyncController({
      channel,
      messages: initialMessages,
      unreadMessageId: '1400',
      hasNextMessages: true,
      connectionStatus: CONNECTION_STATUS.CONNECTED,
      dispatch,
      server: {
        onLoadMore: (_state, action) => {
          if (action.payload.direction !== MESSAGE_LOAD_DIRECTION.NEXT) {
            return {}
          }

          return {
            messages: loadedMessages,
            hasNextMessages: false,
            unreadMessageId: '1400'
          }
        }
      }
    })

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(rendered.scrollable, {
        scrollTop: 2,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(rendered.scrollable)
      flushAnimationFrames()
    })

    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.NEXT, '1402', true)
    )
    expect(dispatch).toHaveBeenCalledWith(markMessagesAsReadAC(channel.id, ['1401', '1402']))

    await flushMockServerDelay()
    rendered.relayout()

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(rendered.scrollable, {
        scrollTop: 2,
        scrollHeight: 960,
        clientHeight: 240
      })
      fireEvent.scroll(rendered.scrollable)
      flushAnimationFrames()
    })

    expect(screen.getByText('unread-3')).toBeInTheDocument()
    expect(screen.getByText('latest-unread')).toBeInTheDocument()
    expect(dispatch).toHaveBeenCalledWith(markMessagesAsReadAC(channel.id, ['1403', '1404']))
  })

  it('loads a 60-message unread range across delayed next-page loads while preserving latest-edge scroll position', async () => {
    const channelId = 'channel-delayed-60-unread'
    const makeUnreadRange = (from: number, to: number) =>
      Array.from({ length: to - from + 1 }, (_, index) =>
        makeMessage({
          id: String(from + index),
          channelId,
          body: `unread-${from + index}`,
          incoming: true
        })
      )

    const firstPage = makeUnreadRange(2001, 2020)
    const secondPage = makeUnreadRange(2001, 2040)
    const thirdPage = makeUnreadRange(2001, 2060)
    const channel = makeChannel({
      id: channelId,
      lastMessage: thirdPage[thirdPage.length - 1],
      newMessageCount: 60,
      lastDisplayedMessageId: '2000'
    })
    const dispatch = jest.fn()
    const rendered = renderAsyncController({
      channel,
      messages: firstPage,
      unreadScrollTo: true,
      unreadMessageId: '',
      stableUnreadAnchor: { channelId, messageId: '2000' },
      hasNextMessages: true,
      connectionStatus: CONNECTION_STATUS.CONNECTED,
      dispatch,
      server: {
        onLoadMore: (state, action) => {
          if (action.payload.direction !== MESSAGE_LOAD_DIRECTION.NEXT) {
            return {}
          }

          if (state.messages.length === firstPage.length) {
            return {
              messages: secondPage,
              hasNextMessages: true,
              unreadMessageId: '2000'
            }
          }

          if (state.messages.length === secondPage.length) {
            return {
              messages: thirdPage,
              hasNextMessages: false,
              unreadMessageId: '2000'
            }
          }

          return {}
        }
      }
    })

    await flushEffects()
    rendered.rerender(
      <AsyncControllerHarness
        channel={channel}
        messages={firstPage}
        unreadScrollTo={true}
        unreadMessageId='2000'
        stableUnreadAnchor={{ channelId, messageId: '2000' }}
        hasNextMessages={true}
        connectionStatus={CONNECTION_STATUS.CONNECTED}
        dispatch={dispatch}
        server={{
          onLoadMore: (state, action) => {
            if (action.payload.direction !== MESSAGE_LOAD_DIRECTION.NEXT) {
              return {}
            }

            if (state.messages.length === firstPage.length) {
              return {
                messages: secondPage,
                hasNextMessages: true,
                unreadMessageId: '2000'
              }
            }

            if (state.messages.length === secondPage.length) {
              return {
                messages: thirdPage,
                hasNextMessages: false,
                unreadMessageId: '2000'
              }
            }

            return {}
          }
        }}
      />
    )
    await flushEffects()

    expect(screen.getByText('unread divider')).toBeInTheDocument()
    expect(screen.getByTestId('remaining-unread-count')).toHaveTextContent('60')

    await act(async () => {
      flushAnimationFrames()
      await Promise.resolve()
    })
    rendered.relayout({ scrollHeight: 1200, clientHeight: 920 })

    expect(dispatch).toHaveBeenCalledWith(setUnreadScrollToAC(false))
    dispatch.mockClear()

    act(() => {
      setScrollMetrics(rendered.scrollable, {
        scrollTop: 2,
        scrollHeight: 1200,
        clientHeight: 920
      })
      fireEvent.scroll(rendered.scrollable)
      flushAnimationFrames()
    })

    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.NEXT, '2020', true)
    )

    await flushMockServerDelay()
    rendered.relayout({ scrollHeight: 2000, clientHeight: 920 })

    act(() => {
      flushAnimationFrames()
    })
    await flushEffects()

    expect(rendered.scrollable.scrollTop).toBe(LATEST_EDGE_GAP_PX)
    const firstRemainingUnreadCount = Number(screen.getByTestId('remaining-unread-count').textContent)
    expect(firstRemainingUnreadCount).toBeLessThan(60)
    expect(firstRemainingUnreadCount).toBeGreaterThan(0)

    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.NEXT, '2040', true)
    )

    await flushMockServerDelay()
    rendered.relayout({ scrollHeight: 2800, clientHeight: 920 })

    act(() => {
      flushAnimationFrames()
    })

    expect(rendered.scrollable.scrollTop).toBe(LATEST_EDGE_GAP_PX)
    const secondRemainingUnreadCount = Number(screen.getByTestId('remaining-unread-count').textContent)
    expect(secondRemainingUnreadCount).toBeLessThanOrEqual(firstRemainingUnreadCount)
    expect(secondRemainingUnreadCount).toBeGreaterThanOrEqual(0)

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(rendered.scrollable, {
        scrollTop: 2,
        scrollHeight: 2800,
        clientHeight: 920
      })
      fireEvent.scroll(rendered.scrollable)
      flushAnimationFrames()
    })

    expect(screen.getByText('unread-2060')).toBeInTheDocument()
    expect(screen.getByTestId('is-viewing-latest')).toHaveTextContent('true')
  })

  it('dispatches loadLatestMessages when jumpToLatest is used while connected and latest is outside the window', () => {
    const channel = makeChannel({
      id: 'channel-connected',
      lastMessage: makeMessage({ id: '999', channelId: 'channel-connected', body: 'server-latest' })
    })
    const dispatch = jest.fn()

    renderController({
      channel,
      messages: [makeMessage({ id: '990', channelId: channel.id, body: 'window-old' })],
      hasNextMessages: true,
      connectionStatus: CONNECTION_STATUS.CONNECTED,
      dispatch
    })

    dispatch.mockClear()

    fireEvent.click(screen.getByTestId('jump-to-latest'))

    expect(dispatch).toHaveBeenCalledWith(loadLatestMessagesAC(channel))
  })

  it('dispatches loadDefaultMessages when jumpToLatest is used while disconnected and latest is outside the window', () => {
    const channel = makeChannel({
      id: 'channel-offline',
      lastMessage: makeMessage({ id: '1099', channelId: 'channel-offline', body: 'server-latest' })
    })
    const dispatch = jest.fn()

    renderController({
      channel,
      messages: [makeMessage({ id: '1090', channelId: channel.id, body: 'window-old' })],
      hasNextMessages: true,
      connectionStatus: CONNECTION_STATUS.DISCONNECTED,
      dispatch
    })

    dispatch.mockClear()

    fireEvent.click(screen.getByTestId('jump-to-latest'))

    expect(dispatch).toHaveBeenCalledWith(loadDefaultMessagesAC(channel))
  })

  it('does not pre-scroll stale history before an offline cache-backed jumpToLatest window is applied', async () => {
    const channelId = 'channel-offline-cached-latest-jump'
    const channel = makeChannel({
      id: channelId,
      lastMessage: makeMessage({ id: '999', channelId, body: 'server-latest' })
    })
    const deepHistoryMessages = Array.from({ length: 40 }, (_, index) =>
      makeMessage({
        id: String(900 + index),
        channelId,
        body: `history-${index}`
      })
    )
    const cachedLatestMessages = [
      makeMessage({ id: '950', channelId, body: 'cached-latest-0' }),
      makeMessage({ id: '951', channelId, body: 'cached-latest-1' }),
      makeMessage({ id: '952', channelId, body: 'cached-latest-2' })
    ]
    cachedLatestMessages.forEach((message) => addMessageToMap(channelId, message))

    const dispatch = jest.fn()
    const rendered = renderController({
      channel,
      messages: deepHistoryMessages,
      hasNextMessages: true,
      connectionStatus: CONNECTION_STATUS.DISCONNECTED,
      dispatch
    })

    act(() => {
      setScrollMetrics(rendered.scrollable, {
        scrollTop: 180,
        scrollHeight: 1800,
        clientHeight: 240
      })
    })

    dispatch.mockClear()
    fireEvent.click(screen.getByTestId('jump-to-latest'))

    expect(dispatch).toHaveBeenCalledWith(loadDefaultMessagesAC(channel))
    expect(rendered.scrollable.scrollTop).toBe(180)

    rendered.rerender(
      <ControllerHarness
        channel={channel}
        messages={cachedLatestMessages}
        hasNextMessages={false}
        connectionStatus={CONNECTION_STATUS.DISCONNECTED}
        dispatch={dispatch}
      />
    )
    layoutTimeline(rendered.scrollable, { scrollHeight: 800 })

    await flushEffects()
    act(() => {
      flushAnimationFrames()
    })

    expect(rendered.scrollable.scrollTop).toBe(LATEST_EDGE_GAP_PX)
    expect(screen.getByText('cached-latest-2')).toBeInTheDocument()
  })

  it('loads true latest after reconnect when an offline jumpToLatest only reached cached latest', async () => {
    const channelId = 'channel-offline-cached-then-reconnect'
    const channel = makeChannel({
      id: channelId,
      lastMessage: makeMessage({ id: '999', channelId, body: 'server-latest' })
    })
    const deepHistoryMessages = Array.from({ length: 40 }, (_, index) =>
      makeMessage({
        id: String(900 + index),
        channelId,
        body: `history-${index}`
      })
    )
    const cachedLatestMessages = [
      makeMessage({ id: '950', channelId, body: 'cached-latest-0' }),
      makeMessage({ id: '951', channelId, body: 'cached-latest-1' }),
      makeMessage({ id: '952', channelId, body: 'cached-latest-2' })
    ]
    const serverLatestMessages = [
      makeMessage({ id: '998', channelId, body: 'server-latest-0' }),
      makeMessage({ id: '999', channelId, body: 'server-latest-1' })
    ]
    cachedLatestMessages.forEach((message) => addMessageToMap(channelId, message))

    const dispatch = jest.fn()
    const rendered = renderController({
      channel,
      messages: deepHistoryMessages,
      hasNextMessages: true,
      connectionStatus: CONNECTION_STATUS.DISCONNECTED,
      dispatch
    })

    act(() => {
      setScrollMetrics(rendered.scrollable, {
        scrollTop: 180,
        scrollHeight: 1800,
        clientHeight: 240
      })
    })

    fireEvent.click(screen.getByTestId('jump-to-latest'))

    rendered.rerender(
      <ControllerHarness
        channel={channel}
        messages={cachedLatestMessages}
        hasNextMessages={false}
        connectionStatus={CONNECTION_STATUS.DISCONNECTED}
        dispatch={dispatch}
      />
    )
    layoutTimeline(rendered.scrollable, { scrollHeight: 800 })

    await flushEffects()
    act(() => {
      flushAnimationFrames()
    })

    dispatch.mockClear()
    rendered.rerender(
      <ControllerHarness
        channel={channel}
        messages={cachedLatestMessages}
        hasNextMessages={false}
        connectionStatus={CONNECTION_STATUS.CONNECTED}
        dispatch={dispatch}
      />
    )

    await flushEffects()
    expect(dispatch).toHaveBeenCalledWith(loadLatestMessagesAC(channel))

    rendered.rerender(
      <ControllerHarness
        channel={channel}
        messages={serverLatestMessages}
        hasNextMessages={false}
        connectionStatus={CONNECTION_STATUS.CONNECTED}
        dispatch={dispatch}
      />
    )
    layoutTimeline(rendered.scrollable, { scrollHeight: 800 })

    await flushEffects()
    act(() => {
      flushAnimationFrames()
    })

    expect(rendered.scrollable.scrollTop).toBe(LATEST_EDGE_GAP_PX)
    expect(screen.getByText('server-latest-1')).toBeInTheDocument()
  })

  it('jumps to the latest edge after reloading an offline window whose latest message is pending', async () => {
    const pendingLatest = makePendingMessage({
      channelId: 'channel-offline-pending-jump',
      body: 'pending-latest',
      createdAt: new Date('2026-04-01T12:48:00.000Z')
    })
    const channel = makeChannel({
      id: 'channel-offline-pending-jump',
      lastMessage: pendingLatest
    })
    const deepHistoryMessages = Array.from({ length: 40 }, (_, index) =>
      makeMessage({
        id: String(900 + index),
        channelId: channel.id,
        body: `history-${index}`
      })
    )
    const latestMessages = [
      makeMessage({ id: '998', channelId: channel.id, body: 'confirmed-before-latest' }),
      makeMessage({ id: '999', channelId: channel.id, body: 'confirmed-latest' }),
      pendingLatest
    ]
    const dispatch = jest.fn()
    const rendered = renderController({
      channel,
      messages: deepHistoryMessages,
      hasNextMessages: true,
      connectionStatus: CONNECTION_STATUS.DISCONNECTED,
      dispatch
    })

    act(() => {
      setScrollMetrics(rendered.scrollable, {
        scrollTop: 180,
        scrollHeight: 1800,
        clientHeight: 240
      })
    })

    dispatch.mockClear()

    fireEvent.click(screen.getByTestId('jump-to-latest'))

    expect(dispatch).toHaveBeenCalledWith(loadDefaultMessagesAC(channel))

    rendered.rerender(
      <ControllerHarness
        channel={channel}
        messages={latestMessages}
        hasNextMessages={false}
        connectionStatus={CONNECTION_STATUS.DISCONNECTED}
        dispatch={dispatch}
      />
    )
    layoutTimeline(rendered.scrollable, { scrollHeight: 800 })

    await flushEffects()
    act(() => {
      flushAnimationFrames()
    })

    expect(rendered.scrollable.scrollTop).toBe(LATEST_EDGE_GAP_PX)
    expect(screen.getByText('pending-latest')).toBeInTheDocument()
    expect(screen.getByTestId('is-viewing-latest')).toHaveTextContent('true')
  })

  it('restores the exact 40px latest-edge scrollTop after jumpToLatest reload with arbitrary dimensions', async () => {
    const pendingLatest = makePendingMessage({
      channelId: 'channel-offline-pending-jump-exact',
      body: 'pending-latest',
      createdAt: new Date('2026-04-03T13:00:00.000Z')
    })
    const channel = makeChannel({
      id: 'channel-offline-pending-jump-exact',
      lastMessage: pendingLatest
    })
    const deepHistoryMessages = Array.from({ length: 40 }, (_, index) =>
      makeMessage({
        id: String(900 + index),
        channelId: channel.id,
        body: `history-${index}`
      })
    )
    const latestMessages = [
      makeMessage({ id: '998', channelId: channel.id, body: 'confirmed-before-latest' }),
      makeMessage({ id: '999', channelId: channel.id, body: 'confirmed-latest' }),
      pendingLatest
    ]
    const dispatch = jest.fn()
    const rendered = renderController({
      channel,
      messages: deepHistoryMessages,
      hasNextMessages: true,
      connectionStatus: CONNECTION_STATUS.DISCONNECTED,
      dispatch
    })

    act(() => {
      setScrollMetrics(rendered.scrollable, {
        scrollTop: 333,
        scrollHeight: 1729,
        clientHeight: 287
      })
    })

    dispatch.mockClear()

    fireEvent.click(screen.getByTestId('jump-to-latest'))

    expect(dispatch).toHaveBeenCalledWith(loadDefaultMessagesAC(channel))

    rendered.rerender(
      <ControllerHarness
        channel={channel}
        messages={latestMessages}
        hasNextMessages={false}
        connectionStatus={CONNECTION_STATUS.DISCONNECTED}
        dispatch={dispatch}
      />
    )
    layoutTimeline(rendered.scrollable, { scrollHeight: 977, clientHeight: 287 })

    await flushEffects()
    act(() => {
      flushAnimationFrames()
    })

    expect(rendered.scrollable.scrollTop).toBe(LATEST_EDGE_GAP_PX)
  })

  it('does not trigger next-page pagination while jumpToLatest is restoring the latest window from deep history', () => {
    const pendingLatest = makePendingMessage({
      channelId: 'channel-offline-jump-lock',
      body: 'pending-latest',
      createdAt: new Date('2026-04-01T13:02:00.000Z')
    })
    const channel = makeChannel({
      id: 'channel-offline-jump-lock',
      lastMessage: pendingLatest
    })
    const deepHistoryMessages = Array.from({ length: 40 }, (_, index) =>
      makeMessage({
        id: String(900 + index),
        channelId: channel.id,
        body: `history-${index}`
      })
    )
    const newestConfirmedId = deepHistoryMessages[deepHistoryMessages.length - 1].id
    const dispatch = jest.fn()
    const rendered = renderController({
      channel,
      messages: deepHistoryMessages,
      hasNextMessages: true,
      connectionStatus: CONNECTION_STATUS.DISCONNECTED,
      dispatch
    })

    act(() => {
      setScrollMetrics(rendered.scrollable, {
        scrollTop: 520,
        scrollHeight: 1800,
        clientHeight: 240
      })
    })

    dispatch.mockClear()

    fireEvent.click(screen.getByTestId('jump-to-latest'))

    expect(dispatch).toHaveBeenCalledWith(loadDefaultMessagesAC(channel))

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(rendered.scrollable, {
        scrollTop: 45,
        scrollHeight: 1800,
        clientHeight: 240
      })
      fireEvent.scroll(rendered.scrollable)
    })

    expect(dispatch).not.toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.NEXT, newestConfirmedId, true)
    )
  })

  it('blocks previous-page pagination during the jumpToLatest window load lock', async () => {
    const channel = makeChannel({
      id: 'channel-jump-latest-unlock-history'
    })
    const deepHistoryMessages = Array.from({ length: 40 }, (_, index) =>
      makeMessage({
        id: String(900 + index),
        channelId: channel.id,
        body: `history-${index}`
      })
    )
    const latestWindowMessages = [
      makeMessage({ id: '998', channelId: channel.id, body: 'latest-0' }),
      makeMessage({ id: '999', channelId: channel.id, body: 'latest-1' })
    ]
    const dispatch = jest.fn()
    const rendered = renderController({
      channel,
      messages: deepHistoryMessages,
      hasPrevMessages: true,
      hasNextMessages: true,
      connectionStatus: CONNECTION_STATUS.DISCONNECTED,
      dispatch
    })

    act(() => {
      setScrollMetrics(rendered.scrollable, {
        scrollTop: 520,
        scrollHeight: 1800,
        clientHeight: 240
      })
    })

    dispatch.mockClear()

    fireEvent.click(screen.getByTestId('jump-to-latest'))

    expect(dispatch).toHaveBeenCalledWith(loadDefaultMessagesAC(channel))

    rendered.rerender(
      <ControllerHarness
        channel={channel}
        messages={latestWindowMessages}
        hasPrevMessages={true}
        hasNextMessages={false}
        connectionStatus={CONNECTION_STATUS.DISCONNECTED}
        dispatch={dispatch}
      />
    )
    layoutTimeline(rendered.scrollable, { scrollHeight: 1040 })

    await flushEffects()
    act(() => {
      flushAnimationFrames()
    })

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(rendered.scrollable, {
        scrollTop: 800,
        scrollHeight: 1040,
        clientHeight: 240
      })
      fireEvent.scroll(rendered.scrollable)
    })

    expect(dispatch).not.toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.PREV, '998', true)
    )
  })

  it('keeps jumpToItem position fixed after the target becomes visible while the item jump lock is still active', async () => {
    const channel = makeChannel({ id: 'channel-jump-item-visible-lock' })
    const currentMessages = Array.from({ length: 40 }, (_, index) =>
      makeMessage({ id: String(100 + index), channelId: channel.id, body: `msg-${index}` })
    )
    const targetMessage = makeMessage({ id: '3999', channelId: channel.id, body: 'target-visible-lock' })
    const dispatch = jest.fn()
    const rendered = renderAsyncController({
      channel,
      messages: currentMessages,
      hasPrevMessages: true,
      hasNextMessages: true,
      jumpToItemId: targetMessage.id!,
      jumpToItemSmooth: true,
      connectionStatus: CONNECTION_STATUS.CONNECTED,
      dispatch,
      server: {
        onLoadAround: () => ({
          messages: [targetMessage],
          hasPrevMessages: true,
          hasNextMessages: false
        })
      }
    })

    act(() => {
      setScrollMetrics(rendered.scrollable, { scrollTop: 300, scrollHeight: 1800, clientHeight: 240 })
    })

    fireEvent.click(screen.getByTestId('jump-to-item'))
    await flushMockServerDelay()
    await flushEffects()
    act(() => {
      flushAnimationFrames()
      layoutTimeline(rendered.scrollable, { scrollHeight: 400 })
      flushAnimationFrames()
    })

    const targetElement = rendered.container.querySelector<HTMLElement>(
      `[data-message-list-item-id="${targetMessage.id}"]`
    )
    expect(targetElement).not.toBeNull()
    act(() => {
      setElementIntersecting(targetElement!, true)
    })

    const scrollTopBefore = rendered.scrollable.scrollTop
    act(() => {
      rendered.scrollable.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }))
    })

    expect(rendered.scrollable.scrollTop).toBe(scrollTopBefore)
  })

  it('retries previous-page pagination when connection returns while the user is still pinned at the history edge', async () => {
    const channel = makeChannel({ id: 'channel-reconnect-history-edge-retry' })
    const messages = [
      makeMessage({ id: '120', channelId: channel.id, body: 'oldest-visible' }),
      makeMessage({ id: '121', channelId: channel.id, body: 'newest-visible' })
    ]
    const dispatch = jest.fn()
    const server = {
      onLoadMore: () => ({})
    }
    const layoutSpec = {
      containerRect: { top: 0, left: 0, width: 320, height: 240 },
      scrollMetrics: {
        scrollTop: 560,
        scrollHeight: 800,
        clientHeight: 240,
        offsetTop: 0,
        offsetHeight: 240
      },
      itemRects: {
        '120': { top: 0, left: 0, width: 320, height: 32 },
        '121': { top: 40, left: 0, width: 320, height: 32 }
      }
    }

    const rendered = render(
      <AsyncControllerHarness
        channel={channel}
        messages={messages}
        hasPrevMessages={true}
        connectionStatus={CONNECTION_STATUS.DISCONNECTED}
        dispatch={dispatch}
        server={server}
        layoutSpec={layoutSpec}
      />
    )
    const scrollable = rendered.container.querySelector('#scrollableDiv') as HTMLDivElement

    act(() => {
      setScrollMetrics(scrollable, {
        scrollTop: 560,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(scrollable)
    })
    await flushMockServerDelay()
    await flushEffects()

    expect(
      dispatch.mock.calls.some(
        ([action]) =>
          action.type ===
          loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.PREV, '120', true).type
      )
    ).toBe(false)

    dispatch.mockClear()

    rendered.rerender(
      <AsyncControllerHarness
        channel={channel}
        messages={messages}
        hasPrevMessages={true}
        connectionStatus={CONNECTION_STATUS.CONNECTED}
        dispatch={dispatch}
        server={server}
        layoutSpec={layoutSpec}
      />
    )

    await flushEffects()
    act(() => {
      flushAnimationFrames()
    })

    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.PREV, '120', true)
    )
  })

  it('re-arms previous-page pagination after reconnect even if the user is no longer inside the immediate retry threshold', async () => {
    const channel = makeChannel({ id: 'channel-reconnect-history-edge-rearm' })
    const messages = [
      makeMessage({ id: '120', channelId: channel.id, body: 'oldest-visible' }),
      makeMessage({ id: '121', channelId: channel.id, body: 'newest-visible' })
    ]
    const dispatch = jest.fn()
    const server = {
      onLoadMore: () => ({})
    }
    const baseLayoutSpec = {
      containerRect: { top: 0, left: 0, width: 320, height: 240 },
      scrollMetrics: {
        scrollTop: 560,
        scrollHeight: 800,
        clientHeight: 240,
        offsetTop: 0,
        offsetHeight: 240
      },
      itemRects: {
        '120': { top: 0, left: 0, width: 320, height: 32 },
        '121': { top: 40, left: 0, width: 320, height: 32 }
      }
    }

    const rendered = render(
      <AsyncControllerHarness
        channel={channel}
        messages={messages}
        hasPrevMessages={true}
        connectionStatus={CONNECTION_STATUS.DISCONNECTED}
        dispatch={dispatch}
        server={server}
        layoutSpec={baseLayoutSpec}
      />
    )
    const scrollable = rendered.container.querySelector('#scrollableDiv') as HTMLDivElement

    act(() => {
      setScrollMetrics(scrollable, {
        scrollTop: 560,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(scrollable)
    })
    await flushMockServerDelay()
    await flushEffects()

    expect(
      dispatch.mock.calls.some(
        ([action]) =>
          action.type ===
          loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.PREV, '120', true).type
      )
    ).toBe(false)

    dispatch.mockClear()

    rendered.rerender(
      <AsyncControllerHarness
        channel={channel}
        messages={messages}
        hasPrevMessages={true}
        connectionStatus={CONNECTION_STATUS.CONNECTED}
        dispatch={dispatch}
        server={server}
        layoutSpec={{
          ...baseLayoutSpec,
          scrollMetrics: {
            ...baseLayoutSpec.scrollMetrics,
            scrollTop: 552
          }
        }}
      />
    )

    await flushEffects()
    act(() => {
      flushAnimationFrames()
    })

    expect(
      dispatch.mock.calls.some(
        ([action]) =>
          action.type ===
          loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.PREV, '120', true).type
      )
    ).toBe(false)

    act(() => {
      setScrollMetrics(scrollable, {
        scrollTop: 558,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(scrollable)
    })

    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.PREV, '120', true)
    )
  })

  it('loads the previous page from the oldest confirmed id at the history edge', () => {
    const channel = makeChannel({
      id: 'channel-prev'
    })
    const messages = [
      makeMessage({ id: '120', channelId: channel.id, body: 'oldest-visible' }),
      makeMessage({ id: '121', channelId: channel.id, body: 'newest-visible' })
    ]
    const { dispatch, scrollable } = renderController({
      channel,
      messages,
      hasPrevMessages: true
    })

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(scrollable, {
        scrollTop: 558,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(scrollable)
    })

    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.PREV, '120', true)
    )
  })

  it('keeps the exact in-range scrollTop while loading the previous page near the history edge', () => {
    const channel = makeChannel({
      id: 'channel-prev-exact-position'
    })
    const messages = [
      makeMessage({ id: '120', channelId: channel.id, body: 'oldest-visible' }),
      makeMessage({ id: '121', channelId: channel.id, body: 'newest-visible' })
    ]
    const { dispatch, scrollable } = renderController({
      channel,
      messages,
      hasPrevMessages: true
    })

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(scrollable, {
        scrollTop: 558,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(scrollable)
    })

    expect(scrollable.scrollTop).toBe(555)
    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.PREV, '120', true)
    )
  })

  it('keeps the bounded history-edge fractional scrollTop exact while requesting the previous page', () => {
    const channel = makeChannel({
      id: 'channel-prev-fractional-anchor'
    })
    const initialMessages = [
      makeMessage({ id: '120', channelId: channel.id, body: 'visible-120' }),
      makeMessage({ id: '121', channelId: channel.id, body: 'visible-121' }),
      makeMessage({ id: '122', channelId: channel.id, body: 'visible-122' })
    ]
    const initialLayoutSpec = {
      containerRect: { top: 7.25, left: 0, width: 320, height: 240 },
      scrollMetrics: {
        scrollHeight: 800.9,
        clientHeight: 240,
        offsetTop: 0,
        offsetHeight: 240
      },
      itemRects: {
        '120': { top: -28.5, left: 0, width: 320, height: 35.2 },
        '121': { top: 23.6, left: 0, width: 320, height: 33.4 },
        '122': { top: 74.95, left: 0, width: 320, height: 34.1 }
      }
    }
    const expectedScrollTop = 555.9
    const { dispatch, scrollable } = renderController({
      channel,
      messages: initialMessages,
      hasPrevMessages: true,
      layoutSpec: initialLayoutSpec
    })

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(scrollable, {
        scrollTop: 558.9,
        scrollHeight: 800.9,
        clientHeight: 240,
        offsetTop: 0,
        offsetHeight: 240
      })
      fireEvent.scroll(scrollable)
    })

    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.PREV, '120', true)
    )

    expect(scrollable.scrollTop).toBeCloseTo(expectedScrollTop, 2)
  })

  it('drops a previous-page restore when the user scrolls away from the history edge before it settles', async () => {
    const channel = makeChannel({
      id: 'channel-prev-scroll-away'
    })
    const initialMessages = [
      makeMessage({ id: '120', channelId: channel.id, body: 'visible-120' }),
      makeMessage({ id: '121', channelId: channel.id, body: 'visible-121' })
    ]
    const dispatch = jest.fn()
    const rendered = renderController({
      channel,
      messages: initialMessages,
      hasPrevMessages: true,
      dispatch,
      layoutSpec: {
        containerRect: { top: 0, left: 0, width: 320, height: 240 },
        scrollMetrics: {
          scrollTop: 560,
          scrollHeight: 800,
          clientHeight: 240,
          offsetTop: 0,
          offsetHeight: 240
        },
        itemRects: {
          '120': { top: 0, left: 0, width: 320, height: 32 },
          '121': { top: 40, left: 0, width: 320, height: 32 }
        }
      }
    })

    act(() => {
      setScrollMetrics(rendered.scrollable, {
        scrollTop: 560,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(rendered.scrollable)

      const item120 = rendered.container.querySelector<HTMLElement>('[data-message-list-item-id="120"]')
      const item121 = rendered.container.querySelector<HTMLElement>('[data-message-list-item-id="121"]')
      expect(item120).not.toBeNull()
      expect(item121).not.toBeNull()
      setElementRect(item120!, { top: -60, left: 0, width: 320, height: 32 })
      setElementRect(item121!, { top: 20, left: 0, width: 320, height: 32 })
      setScrollMetrics(rendered.scrollable, {
        scrollTop: 440,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(rendered.scrollable)
    })

    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.PREV, '120', true)
    )
    expect(rendered.scrollable.scrollTop).toBe(440)
    rendered.rerender(
      <ControllerHarness
        channel={channel}
        messages={initialMessages}
        hasPrevMessages={true}
        dispatch={dispatch}
        layoutSpec={{
          containerRect: { top: 0, left: 0, width: 320, height: 240 },
          scrollMetrics: {
            scrollTop: 440,
            scrollHeight: 800,
            clientHeight: 240,
            offsetTop: 0,
            offsetHeight: 240
          },
          itemRects: {
            '120': { top: -60, left: 0, width: 320, height: 32 },
            '121': { top: 20, left: 0, width: 320, height: 32 }
          }
        }}
      />
    )

    act(() => {
      flushAnimationFrames()
    })

    expect(screen.queryByText('older-118')).not.toBeInTheDocument()
    const currentScrollable = rendered.container.querySelector('#scrollableDiv') as HTMLDivElement
    expect(currentScrollable.scrollTop).toBe(440)
  })

  it('keeps a delayed previous-page response cache-only after the user scrolls away from the history edge', async () => {
    const channel = makeChannel({
      id: 'channel-prev-scroll-away-delayed'
    })
    const initialMessages = [
      makeMessage({ id: '120', channelId: channel.id, body: 'visible-120' }),
      makeMessage({ id: '121', channelId: channel.id, body: 'visible-121' })
    ]
    const dispatch = jest.fn()
    const rendered = renderController({
      channel,
      messages: initialMessages,
      hasPrevMessages: true,
      dispatch,
      layoutSpec: {
        containerRect: { top: 0, left: 0, width: 320, height: 240 },
        scrollMetrics: {
          scrollTop: 560,
          scrollHeight: 800,
          clientHeight: 240,
          offsetTop: 0,
          offsetHeight: 240
        },
        itemRects: {
          '120': { top: 0, left: 0, width: 320, height: 32 },
          '121': { top: 40, left: 0, width: 320, height: 32 }
        }
      }
    })

    act(() => {
      setScrollMetrics(rendered.scrollable, {
        scrollTop: 560,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(rendered.scrollable)
    })

    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.PREV, '120', true)
    )

    rendered.rerender(
      <ControllerHarness
        channel={channel}
        messages={initialMessages}
        hasPrevMessages={true}
        loadingPrevMessages={LOADING_STATE.LOADING}
        loadingNextMessages={LOADING_STATE.LOADED}
        dispatch={dispatch}
        layoutSpec={{
          containerRect: { top: 0, left: 0, width: 320, height: 240 },
          scrollMetrics: {
            scrollTop: 560,
            scrollHeight: 800,
            clientHeight: 240,
            offsetTop: 0,
            offsetHeight: 240
          },
          itemRects: {
            '120': { top: 0, left: 0, width: 320, height: 32 },
            '121': { top: 40, left: 0, width: 320, height: 32 }
          }
        }}
      />
    )

    act(() => {
      const loadingScrollable = rendered.container.querySelector('#scrollableDiv') as HTMLDivElement
      const item120 = rendered.container.querySelector<HTMLElement>('[data-message-list-item-id="120"]')
      const item121 = rendered.container.querySelector<HTMLElement>('[data-message-list-item-id="121"]')
      expect(item120).not.toBeNull()
      expect(item121).not.toBeNull()
      setElementRect(item120!, { top: -60, left: 0, width: 320, height: 32 })
      setElementRect(item121!, { top: 20, left: 0, width: 320, height: 32 })
      setScrollMetrics(loadingScrollable, {
        scrollTop: 440,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(loadingScrollable)
    })

    rendered.rerender(
      <ControllerHarness
        channel={channel}
        messages={initialMessages}
        hasPrevMessages={true}
        loadingPrevMessages={LOADING_STATE.LOADED}
        loadingNextMessages={LOADING_STATE.LOADED}
        dispatch={dispatch}
        layoutSpec={{
          containerRect: { top: 0, left: 0, width: 320, height: 240 },
          scrollMetrics: {
            scrollTop: 440,
            scrollHeight: 800,
            clientHeight: 240,
            offsetTop: 0,
            offsetHeight: 240
          },
          itemRects: {
            '120': { top: -60, left: 0, width: 320, height: 32 },
            '121': { top: 20, left: 0, width: 320, height: 32 }
          }
        }}
      />
    )

    await flushEffects()
    act(() => {
      flushAnimationFrames()
    })

    expect(screen.queryByText('older-118')).not.toBeInTheDocument()
    const currentScrollable = rendered.container.querySelector('#scrollableDiv') as HTMLDivElement
    expect(currentScrollable.scrollTop).toBe(440)
  })

  it('lets the user manually scroll back toward latest immediately while a previous-page load is still in flight', async () => {
    const channel = makeChannel({
      id: 'channel-prev-scrolls-immediately-while-loading'
    })
    const initialMessages = [
      makeMessage({ id: '120', channelId: channel.id, body: 'visible-120' }),
      makeMessage({ id: '121', channelId: channel.id, body: 'visible-121' })
    ]
    const dispatch = jest.fn()
    const rendered = renderController({
      channel,
      messages: initialMessages,
      hasPrevMessages: true,
      dispatch,
      layoutSpec: {
        containerRect: { top: 0, left: 0, width: 320, height: 240 },
        scrollMetrics: {
          scrollTop: 560,
          scrollHeight: 800,
          clientHeight: 240,
          offsetTop: 0,
          offsetHeight: 240
        },
        itemRects: {
          '120': { top: 0, left: 0, width: 320, height: 32 },
          '121': { top: 40, left: 0, width: 320, height: 32 }
        }
      }
    })

    act(() => {
      setScrollMetrics(rendered.scrollable, {
        scrollTop: 560,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(rendered.scrollable)
    })

    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.PREV, '120', true)
    )

    rendered.rerender(
      <ControllerHarness
        channel={channel}
        messages={initialMessages}
        hasPrevMessages={true}
        loadingPrevMessages={LOADING_STATE.LOADING}
        loadingNextMessages={LOADING_STATE.LOADED}
        dispatch={dispatch}
        layoutSpec={{
          containerRect: { top: 0, left: 0, width: 320, height: 240 },
          scrollMetrics: {
            scrollTop: 560,
            scrollHeight: 800,
            clientHeight: 240,
            offsetTop: 0,
            offsetHeight: 240
          },
          itemRects: {
            '120': { top: 0, left: 0, width: 320, height: 32 },
            '121': { top: 40, left: 0, width: 320, height: 32 }
          }
        }}
      />
    )

    act(() => {
      const loadingScrollable = rendered.container.querySelector('#scrollableDiv') as HTMLDivElement
      const item120 = rendered.container.querySelector<HTMLElement>('[data-message-list-item-id="120"]')
      const item121 = rendered.container.querySelector<HTMLElement>('[data-message-list-item-id="121"]')
      expect(item120).not.toBeNull()
      expect(item121).not.toBeNull()
      setElementRect(item120!, { top: -60, left: 0, width: 320, height: 32 })
      setElementRect(item121!, { top: 20, left: 0, width: 320, height: 32 })
      setScrollMetrics(loadingScrollable, {
        scrollTop: 440,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(loadingScrollable)
    })

    const currentScrollable = rendered.container.querySelector('#scrollableDiv') as HTMLDivElement
    expect(currentScrollable.scrollTop).toBe(440)
  })

  it('keeps a delayed previous-page wheel reversal cache-only after the user leaves the history edge', async () => {
    const channel = makeChannel({
      id: 'channel-prev-wheel-away-delayed'
    })
    const initialMessages = [
      makeMessage({ id: '120', channelId: channel.id, body: 'visible-120' }),
      makeMessage({ id: '121', channelId: channel.id, body: 'visible-121' })
    ]
    const dispatch = jest.fn()
    const rendered = renderController({
      channel,
      messages: initialMessages,
      hasPrevMessages: true,
      dispatch,
      layoutSpec: {
        containerRect: { top: 0, left: 0, width: 320, height: 240 },
        scrollMetrics: {
          scrollTop: 560,
          scrollHeight: 800,
          clientHeight: 240,
          offsetTop: 0,
          offsetHeight: 240
        },
        itemRects: {
          '120': { top: 0, left: 0, width: 320, height: 32 },
          '121': { top: 40, left: 0, width: 320, height: 32 }
        }
      }
    })

    act(() => {
      setScrollMetrics(rendered.scrollable, {
        scrollTop: 560,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(rendered.scrollable)
    })

    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.PREV, '120', true)
    )

    rendered.rerender(
      <ControllerHarness
        channel={channel}
        messages={initialMessages}
        hasPrevMessages={true}
        loadingPrevMessages={LOADING_STATE.LOADING}
        loadingNextMessages={LOADING_STATE.LOADED}
        dispatch={dispatch}
        layoutSpec={{
          containerRect: { top: 0, left: 0, width: 320, height: 240 },
          scrollMetrics: {
            scrollTop: 560,
            scrollHeight: 800,
            clientHeight: 240,
            offsetTop: 0,
            offsetHeight: 240
          },
          itemRects: {
            '120': { top: 0, left: 0, width: 320, height: 32 },
            '121': { top: 40, left: 0, width: 320, height: 32 }
          }
        }}
      />
    )

    act(() => {
      const item120 = rendered.container.querySelector<HTMLElement>('[data-message-list-item-id="120"]')
      const item121 = rendered.container.querySelector<HTMLElement>('[data-message-list-item-id="121"]')
      expect(item120).not.toBeNull()
      expect(item121).not.toBeNull()
      setElementRect(item120!, { top: -60, left: 0, width: 320, height: 32 })
      setElementRect(item121!, { top: 20, left: 0, width: 320, height: 32 })
      fireEvent.wheel(rendered.container.querySelector('#scrollableDiv') as HTMLDivElement, { deltaY: 120 })
    })

    rendered.rerender(
      <ControllerHarness
        channel={channel}
        messages={initialMessages}
        hasPrevMessages={true}
        loadingPrevMessages={LOADING_STATE.LOADED}
        loadingNextMessages={LOADING_STATE.LOADED}
        dispatch={dispatch}
        layoutSpec={{
          containerRect: { top: 0, left: 0, width: 320, height: 240 },
          scrollMetrics: {
            scrollTop: 440,
            scrollHeight: 800,
            clientHeight: 240,
            offsetTop: 0,
            offsetHeight: 240
          },
          itemRects: {
            '120': { top: -60, left: 0, width: 320, height: 32 },
            '121': { top: 20, left: 0, width: 320, height: 32 }
          }
        }}
      />
    )

    await flushEffects()
    act(() => {
      flushAnimationFrames()
    })

    expect(screen.queryByText('older-118')).not.toBeInTheDocument()
    const currentScrollable = rendered.container.querySelector('#scrollableDiv') as HTMLDivElement
    expect(currentScrollable.scrollTop).toBe(440)
  })

  it('starts next-page pagination immediately when the user reaches latest during a previous-page load', async () => {
    const channel = makeChannel({
      id: 'channel-prev-then-next-after-delay'
    })
    const initialMessages = [
      makeMessage({ id: '120', channelId: channel.id, body: 'visible-120' }),
      makeMessage({ id: '121', channelId: channel.id, body: 'visible-121' })
    ]
    const dispatch = jest.fn()
    const rendered = renderController({
      channel,
      messages: initialMessages,
      hasPrevMessages: true,
      hasNextMessages: true,
      dispatch
    })

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(rendered.scrollable, {
        scrollTop: 560,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(rendered.scrollable)
    })

    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.PREV, '120', true)
    )

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(rendered.scrollable, {
        scrollTop: 2,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(rendered.scrollable)
    })

    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.NEXT, '121', true)
    )
  })

  it(
    [
      'still paginates next after a previous-page load finishes',
      'when the user hit the latest edge and drifted away before it settled'
    ].join(' '),
    async () => {
      const channel = makeChannel({
        id: 'channel-prev-then-next-after-edge-drift'
      })
      const initialMessages = [
        makeMessage({ id: '120', channelId: channel.id, body: 'visible-120' }),
        makeMessage({ id: '121', channelId: channel.id, body: 'visible-121' })
      ]
      const previousPageMessages = [
        makeMessage({ id: '118', channelId: channel.id, body: 'older-118' }),
        makeMessage({ id: '119', channelId: channel.id, body: 'older-119' }),
        ...initialMessages
      ]
      const dispatch = jest.fn()
      const rendered = renderController({
        channel,
        messages: initialMessages,
        hasPrevMessages: true,
        hasNextMessages: true,
        dispatch
      })

      dispatch.mockClear()

      act(() => {
        setScrollMetrics(rendered.scrollable, {
          scrollTop: 560,
          scrollHeight: 800,
          clientHeight: 240
        })
        fireEvent.scroll(rendered.scrollable)
      })

      expect(dispatch).toHaveBeenCalledWith(
        loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.PREV, '120', true)
      )

      rendered.rerender(
        <ControllerHarness
          channel={channel}
          messages={initialMessages}
          hasPrevMessages={true}
          hasNextMessages={true}
          loadingPrevMessages={LOADING_STATE.LOADING}
          loadingNextMessages={LOADING_STATE.LOADED}
          dispatch={dispatch}
        />
      )

      dispatch.mockClear()

      act(() => {
        setScrollMetrics(rendered.scrollable, {
          scrollTop: 2,
          scrollHeight: 800,
          clientHeight: 240
        })
        fireEvent.scroll(rendered.scrollable)
        setScrollMetrics(rendered.scrollable, {
          scrollTop: 95,
          scrollHeight: 800,
          clientHeight: 240
        })
        fireEvent.scroll(rendered.scrollable)
      })

      rendered.rerender(
        <ControllerHarness
          channel={channel}
          messages={previousPageMessages}
          hasPrevMessages={true}
          hasNextMessages={true}
          loadingPrevMessages={LOADING_STATE.LOADED}
          loadingNextMessages={LOADING_STATE.LOADED}
          dispatch={dispatch}
        />
      )
      layoutTimeline(rendered.container.querySelector('#scrollableDiv'), { scrollHeight: 960, clientHeight: 240 })

      await flushEffects()
      act(() => {
        flushAnimationFrames()
      })

      expect(dispatch).toHaveBeenCalledWith(
        loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.NEXT, '121', true)
      )
    }
  )

  it('keeps paginating next while the latest edge intent is still active after a previous-page load finishes', async () => {
    const channel = makeChannel({
      id: 'channel-prev-then-chain-next-after-delay'
    })
    const initialMessages = [
      makeMessage({ id: '120', channelId: channel.id, body: 'visible-120' }),
      makeMessage({ id: '121', channelId: channel.id, body: 'visible-121' })
    ]
    const previousPageMessages = [
      makeMessage({ id: '118', channelId: channel.id, body: 'older-118' }),
      makeMessage({ id: '119', channelId: channel.id, body: 'older-119' }),
      ...initialMessages
    ]
    const nextPageMessages = [
      ...initialMessages,
      makeMessage({ id: '122', channelId: channel.id, body: 'newer-122' }),
      makeMessage({ id: '123', channelId: channel.id, body: 'newer-123' })
    ]
    const dispatch = jest.fn()
    const rendered = renderController({
      channel,
      messages: initialMessages,
      hasPrevMessages: true,
      hasNextMessages: true,
      dispatch
    })

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(rendered.scrollable, {
        scrollTop: 560,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(rendered.scrollable)
    })

    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.PREV, '120', true)
    )

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(rendered.scrollable, {
        scrollTop: 2,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(rendered.scrollable)
    })

    rendered.rerender(
      <ControllerHarness
        channel={channel}
        messages={initialMessages}
        hasPrevMessages={true}
        hasNextMessages={true}
        loadingPrevMessages={LOADING_STATE.LOADING}
        dispatch={dispatch}
      />
    )
    layoutTimeline(rendered.container.querySelector('#scrollableDiv'), { scrollHeight: 800, clientHeight: 240 })

    rendered.rerender(
      <ControllerHarness
        channel={channel}
        messages={previousPageMessages}
        hasPrevMessages={true}
        hasNextMessages={true}
        loadingPrevMessages={LOADING_STATE.LOADED}
        dispatch={dispatch}
      />
    )
    layoutTimeline(rendered.container.querySelector('#scrollableDiv'), { scrollHeight: 960, clientHeight: 240 })

    await flushEffects()
    act(() => {
      flushAnimationFrames()
    })

    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.NEXT, '121', true)
    )

    dispatch.mockClear()

    rendered.rerender(
      <ControllerHarness
        channel={channel}
        messages={previousPageMessages}
        hasPrevMessages={true}
        hasNextMessages={true}
        loadingNextMessages={LOADING_STATE.LOADING}
        dispatch={dispatch}
      />
    )
    layoutTimeline(rendered.container.querySelector('#scrollableDiv'), { scrollHeight: 960, clientHeight: 240 })

    rendered.rerender(
      <ControllerHarness
        channel={channel}
        messages={nextPageMessages}
        hasPrevMessages={true}
        hasNextMessages={true}
        loadingNextMessages={LOADING_STATE.LOADED}
        dispatch={dispatch}
      />
    )
    layoutTimeline(rendered.container.querySelector('#scrollableDiv'), { scrollHeight: 960, clientHeight: 240 })

    await flushEffects()
    act(() => {
      flushAnimationFrames()
    })

    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.NEXT, '123', true)
    )
  })

  it('allows next-page pagination inside handleTimelineScroll while a previous-page load is in flight', () => {
    const channel = makeChannel({ id: 'channel-handle-scroll-block-next' })
    const messages = [
      makeMessage({ id: '500', channelId: channel.id, body: 'msg-500' }),
      makeMessage({ id: '501', channelId: channel.id, body: 'msg-501' })
    ]
    const { dispatch, scrollable } = renderController({
      channel,
      messages,
      hasPrevMessages: true,
      hasNextMessages: true
    })

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(scrollable, {
        scrollTop: 558,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(scrollable)
    })

    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.PREV, '500', true)
    )

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(scrollable, {
        scrollTop: 2,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(scrollable)
    })

    expect(scrollable.scrollTop).toBe(LATEST_EDGE_GAP_PX)
    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.NEXT, '501', true)
    )
  })

  it('allows previous-page pagination inside handleTimelineScroll while a next-page load is in flight', () => {
    const channel = makeChannel({ id: 'channel-handle-scroll-block-prev' })
    const messages = [
      makeMessage({ id: '500', channelId: channel.id, body: 'msg-500' }),
      makeMessage({ id: '501', channelId: channel.id, body: 'msg-501' })
    ]
    const { dispatch, scrollable } = renderController({
      channel,
      messages,
      hasPrevMessages: true,
      hasNextMessages: true
    })

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(scrollable, {
        scrollTop: 2,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(scrollable)
    })

    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.NEXT, '501', true)
    )

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(scrollable, {
        scrollTop: 558,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(scrollable)
    })

    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.PREV, '500', true)
    )
  })

  it('switches to next-page pagination immediately during a slow previous-page load', () => {
    const channel = makeChannel({ id: 'channel-slow-prev-then-next' })
    const initialMessages = [
      makeMessage({ id: '500', channelId: channel.id, body: 'msg-500' }),
      makeMessage({ id: '501', channelId: channel.id, body: 'msg-501' })
    ]
    const dispatch = jest.fn()

    const rendered = renderController({
      channel,
      messages: initialMessages,
      hasPrevMessages: true,
      hasNextMessages: true,
      dispatch
    })

    dispatch.mockClear()

    // Step 1: scroll to history edge → PREV load fires
    act(() => {
      setScrollMetrics(rendered.scrollable, { scrollTop: 558, scrollHeight: 800, clientHeight: 240 })
      fireEvent.scroll(rendered.scrollable)
    })

    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.PREV, '500', true)
    )
    dispatch.mockClear()

    act(() => {
      setScrollMetrics(rendered.scrollable, { scrollTop: 8, scrollHeight: 800, clientHeight: 240 })
      fireEvent.scroll(rendered.scrollable)
    })

    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.NEXT, '501', true)
    )
  })

  it('applies cached previous messages immediately while a slow previous-page request is still loading', () => {
    const channel = makeChannel({ id: 'channel-cached-prev-during-slow-prev' })
    const cachedPrevMessages = [
      makeMessage({ id: '498', channelId: channel.id, body: 'msg-498' }),
      makeMessage({ id: '499', channelId: channel.id, body: 'msg-499' })
    ]
    const initialMessages = [
      makeMessage({ id: '500', channelId: channel.id, body: 'msg-500' }),
      makeMessage({ id: '501', channelId: channel.id, body: 'msg-501' })
    ]

    cachedPrevMessages.forEach((message) => addMessageToMap(channel.id, message))
    initialMessages.forEach((message) => addMessageToMap(channel.id, message))
    setActiveSegment(channel.id, '498', '501')

    const dispatch = jest.fn()
    const rendered = renderController({
      channel,
      messages: initialMessages,
      hasPrevMessages: false,
      hasNextMessages: false,
      loadingPrevMessages: LOADING_STATE.LOADING,
      dispatch
    })

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(rendered.scrollable, { scrollTop: 558, scrollHeight: 800, clientHeight: 240 })
      fireEvent.scroll(rendered.scrollable)
    })

    const addMessagesActions = dispatch.mock.calls
      .map(([action]) => action)
      .filter((action) => action.type === addMessagesAC([], MESSAGE_LOAD_DIRECTION.PREV).type)

    expect(addMessagesActions).toHaveLength(1)
    expect(addMessagesActions[0].payload.direction).toBe(MESSAGE_LOAD_DIRECTION.PREV)
    expect(addMessagesActions[0].payload.messages.map((message: IMessage) => message.id)).toEqual(['498', '499'])
    expect(
      dispatch.mock.calls.some(
        ([action]) =>
          action.type ===
            loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.PREV, '500', false).type &&
          action.payload.direction === MESSAGE_LOAD_DIRECTION.PREV &&
          action.payload.anchorMessageId === '500'
      )
    ).toBe(false)
  })

  it('switches to previous-page pagination immediately during a slow next-page load', async () => {
    const channel = makeChannel({ id: 'channel-slow-next-then-prev' })
    const initialMessages = [
      makeMessage({ id: '500', channelId: channel.id, body: 'msg-500' }),
      makeMessage({ id: '501', channelId: channel.id, body: 'msg-501' })
    ]
    const nextPageMessages = [
      ...initialMessages,
      makeMessage({ id: '502', channelId: channel.id, body: 'msg-502' }),
      makeMessage({ id: '503', channelId: channel.id, body: 'msg-503' })
    ]
    const dispatch = jest.fn()

    const rendered = renderAsyncController({
      channel,
      messages: initialMessages,
      hasPrevMessages: true,
      hasNextMessages: true,
      connectionStatus: CONNECTION_STATUS.CONNECTED,
      dispatch,
      server: {
        onLoadMore: (_state, action) => {
          if (action.payload.direction === MESSAGE_LOAD_DIRECTION.NEXT) {
            return { messages: nextPageMessages, hasNextMessages: false, hasPrevMessages: true }
          }
          return {}
        }
      }
    })

    await flushMockServerDelay()
    rendered.relayout()
    dispatch.mockClear()

    act(() => {
      setScrollMetrics(rendered.scrollable, { scrollTop: 8, scrollHeight: 800, clientHeight: 240 })
      fireEvent.scroll(rendered.scrollable)
    })

    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.NEXT, '501', true)
    )
    dispatch.mockClear()

    act(() => {
      setScrollMetrics(rendered.scrollable, { scrollTop: 558, scrollHeight: 800, clientHeight: 240 })
      fireEvent.scroll(rendered.scrollable)
    })

    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.PREV, '500', true)
    )
  })

  it('keeps the latest edge pinned when only the current next page applies after reversal', async () => {
    const channel = makeChannel({
      id: 'channel-prev-settle-while-at-latest'
    })
    const initialMessages = [
      makeMessage({ id: '120', channelId: channel.id, body: 'visible-120' }),
      makeMessage({ id: '121', channelId: channel.id, body: 'visible-121' })
    ]
    const nextPageMessages = [
      ...initialMessages,
      makeMessage({ id: '122', channelId: channel.id, body: 'newer-122' }),
      makeMessage({ id: '123', channelId: channel.id, body: 'newer-123' })
    ]
    const dispatch = jest.fn()
    const rendered = renderController({
      channel,
      messages: initialMessages,
      hasPrevMessages: true,
      hasNextMessages: true,
      loadingPrevMessages: LOADING_STATE.LOADED,
      loadingNextMessages: LOADING_STATE.LOADED,
      dispatch,
      layoutSpec: {
        containerRect: { top: 0, left: 0, width: 320, height: 240 },
        scrollMetrics: { scrollTop: 558, scrollHeight: 800, clientHeight: 240, offsetTop: 0, offsetHeight: 240 },
        itemRects: {
          '120': { top: 0, left: 0, width: 320, height: 32 },
          '121': { top: 40, left: 0, width: 320, height: 32 }
        }
      }
    })

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(rendered.scrollable, {
        scrollTop: 558,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(rendered.scrollable)
    })

    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.PREV, '120', true)
    )

    rendered.rerender(
      <ControllerHarness
        channel={channel}
        messages={initialMessages}
        hasPrevMessages={true}
        hasNextMessages={true}
        loadingPrevMessages={LOADING_STATE.LOADING}
        loadingNextMessages={LOADING_STATE.LOADED}
        dispatch={dispatch}
        layoutSpec={{
          containerRect: { top: 0, left: 0, width: 320, height: 240 },
          scrollMetrics: { scrollTop: 558, scrollHeight: 800, clientHeight: 240, offsetTop: 0, offsetHeight: 240 },
          itemRects: {
            '120': { top: 0, left: 0, width: 320, height: 32 },
            '121': { top: 40, left: 0, width: 320, height: 32 }
          }
        }}
      />
    )

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(rendered.scrollable, {
        scrollTop: 2,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(rendered.scrollable)
    })

    expect(rendered.scrollable.scrollTop).toBe(LATEST_EDGE_GAP_PX)
    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.NEXT, '121', true)
    )

    rendered.rerender(
      <ControllerHarness
        channel={channel}
        messages={nextPageMessages}
        hasPrevMessages={true}
        hasNextMessages={false}
        loadingPrevMessages={LOADING_STATE.LOADED}
        loadingNextMessages={LOADING_STATE.LOADED}
        dispatch={dispatch}
        layoutSpec={{
          containerRect: { top: 0, left: 0, width: 320, height: 240 },
          scrollMetrics: {
            scrollTop: LATEST_EDGE_GAP_PX,
            scrollHeight: 960,
            clientHeight: 240,
            offsetTop: 0,
            offsetHeight: 240
          },
          itemRects: {
            '120': { top: 0, left: 0, width: 320, height: 32 },
            '121': { top: 40, left: 0, width: 320, height: 32 },
            '122': { top: 80, left: 0, width: 320, height: 32 },
            '123': { top: 120, left: 0, width: 320, height: 32 }
          }
        }}
      />
    )

    await flushEffects()
    act(() => {
      flushAnimationFrames()
    })

    expect(rendered.scrollable.scrollTop).toBe(LATEST_EDGE_GAP_PX)
    expect(screen.queryByText('older-118')).not.toBeInTheDocument()
    expect(screen.getByText('newer-123')).toBeInTheDocument()
  })

  it('keeps a delayed stale previous-page response cache-only while the current next page applies', async () => {
    const channel = makeChannel({
      id: 'channel-prev-server-delay-while-at-latest'
    })
    const initialMessages = [
      makeMessage({ id: '120', channelId: channel.id, body: 'visible-120' }),
      makeMessage({ id: '121', channelId: channel.id, body: 'visible-121' })
    ]
    const previousPageMessages = [
      makeMessage({ id: '118', channelId: channel.id, body: 'older-118' }),
      makeMessage({ id: '119', channelId: channel.id, body: 'older-119' }),
      ...initialMessages
    ]
    const nextPageMessages = [
      ...initialMessages,
      makeMessage({ id: '122', channelId: channel.id, body: 'newer-122' }),
      makeMessage({ id: '123', channelId: channel.id, body: 'newer-123' })
    ]
    const dispatch = jest.fn()
    const rendered = renderAsyncController({
      channel,
      messages: initialMessages,
      hasPrevMessages: true,
      hasNextMessages: true,
      dispatch,
      layoutSpec: (state) =>
        state.loadingNextMessages === LOADING_STATE.LOADING || state.messages.length === nextPageMessages.length
          ? {
              containerRect: { top: 0, left: 0, width: 320, height: 240 },
              scrollMetrics: {
                scrollTop: LATEST_EDGE_GAP_PX,
                scrollHeight: 960,
                clientHeight: 240,
                offsetTop: 0,
                offsetHeight: 240
              },
              itemRects: {
                '120': { top: 0, left: 0, width: 320, height: 32 },
                '121': { top: 40, left: 0, width: 320, height: 32 },
                '122': { top: 80, left: 0, width: 320, height: 32 },
                '123': { top: 120, left: 0, width: 320, height: 32 }
              }
            }
          : {
              containerRect: { top: 0, left: 0, width: 320, height: 240 },
              scrollMetrics: {
                scrollTop: 560,
                scrollHeight: 800,
                clientHeight: 240,
                offsetTop: 0,
                offsetHeight: 240
              },
              itemRects: {
                '120': { top: 0, left: 0, width: 320, height: 32 },
                '121': { top: 40, left: 0, width: 320, height: 32 }
              }
            },
      server: {
        onLoadDefault: (state) => ({
          messages: state.messages,
          hasPrevMessages: true,
          hasNextMessages: true
        }),
        onLoadMore: (state, action) => {
          if (action.payload.direction === MESSAGE_LOAD_DIRECTION.PREV) {
            return {
              messages: previousPageMessages,
              hasPrevMessages: true,
              hasNextMessages: true
            }
          }

          return {
            messages: nextPageMessages,
            hasPrevMessages: true,
            hasNextMessages: false
          }
        }
      }
    })

    await flushMockServerDelay()
    await flushEffects()
    act(() => {
      flushAnimationFrames()
    })

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(rendered.scrollable, {
        scrollTop: 560,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(rendered.scrollable)
    })

    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.PREV, '120', true)
    )

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(rendered.scrollable, {
        scrollTop: 2,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(rendered.scrollable)
    })

    expect(rendered.scrollable.scrollTop).toBe(LATEST_EDGE_GAP_PX)
    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.NEXT, '121', true)
    )

    await flushMockServerDelay()
    await flushEffects()
    act(() => {
      flushAnimationFrames()
    })

    expect(rendered.scrollable.scrollTop).toBe(LATEST_EDGE_GAP_PX)
    expect(screen.queryByText('older-118')).not.toBeInTheDocument()
    expect(screen.getByText('newer-123')).toBeInTheDocument()

    dispatch.mockClear()

    await flushMockServerDelay()
    await flushEffects()
    act(() => {
      flushAnimationFrames()
    })

    expect(rendered.scrollable.scrollTop).toBe(LATEST_EDGE_GAP_PX)
  })

  it('starts next-page pagination immediately before a slow previous-page load finishes', async () => {
    const channel = makeChannel({
      id: 'channel-prev-then-next-after-redux-loading'
    })
    const initialMessages = [
      makeMessage({ id: '120', channelId: channel.id, body: 'visible-120' }),
      makeMessage({ id: '121', channelId: channel.id, body: 'visible-121' })
    ]
    const previousPageMessages = [
      makeMessage({ id: '118', channelId: channel.id, body: 'older-118' }),
      makeMessage({ id: '119', channelId: channel.id, body: 'older-119' }),
      ...initialMessages
    ]
    const dispatch = jest.fn()
    const rendered = renderAsyncController({
      channel,
      messages: initialMessages,
      hasPrevMessages: true,
      hasNextMessages: true,
      dispatch,
      server: {
        onLoadDefault: (state) => ({
          messages: state.messages,
          hasPrevMessages: true,
          hasNextMessages: true
        }),
        onLoadMore: (_state, action) => {
          if (action.payload.direction === MESSAGE_LOAD_DIRECTION.PREV) {
            return {
              messages: previousPageMessages,
              hasPrevMessages: false,
              hasNextMessages: true
            }
          }

          return {}
        }
      }
    })

    await flushMockServerDelay()
    rendered.relayout({ scrollHeight: 800, clientHeight: 240 })
    dispatch.mockClear()

    act(() => {
      setScrollMetrics(rendered.scrollable, {
        scrollTop: 560,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(rendered.scrollable)
    })

    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.PREV, '120', true)
    )

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(rendered.scrollable, {
        scrollTop: 2,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(rendered.scrollable)
    })

    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.NEXT, '121', true)
    )

    await flushMockServerDelay()
    rendered.relayout({ scrollHeight: 800, clientHeight: 240 })
    await flushEffects()

    act(() => {
      flushAnimationFrames()
    })

    expect(rendered.scrollable.scrollTop).toBe(LATEST_EDGE_GAP_PX)
    expect(screen.queryByText('older-118')).not.toBeInTheDocument()
    expect(screen.queryByText('older-119')).not.toBeInTheDocument()
  })

  it('does not dispatch duplicate previous-page loads while a previous request is still in flight', () => {
    const channel = makeChannel({
      id: 'channel-prev-in-flight'
    })
    const messages = [
      makeMessage({ id: '120', channelId: channel.id, body: 'oldest-visible' }),
      makeMessage({ id: '121', channelId: channel.id, body: 'newest-visible' })
    ]
    const { dispatch, scrollable } = renderController({
      channel,
      messages,
      hasPrevMessages: true
    })

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(scrollable, {
        scrollTop: 558,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(scrollable)
    })

    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.PREV, '120', true)
    )

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(scrollable, {
        scrollTop: 558,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(scrollable)
    })

    expect(dispatch).not.toHaveBeenCalled()
  })

  it('loads the next page from the newest confirmed id even when the local tail is pending', () => {
    const channel = makeChannel({
      id: 'channel-next'
    })
    const messages = [
      makeMessage({ id: '210', channelId: channel.id, body: 'confirmed-older' }),
      makeMessage({ id: '211', channelId: channel.id, body: 'confirmed-newer' }),
      makePendingMessage({
        channelId: channel.id,
        body: 'pending-tail',
        createdAt: new Date('2026-04-01T12:09:00.000Z')
      })
    ]
    const { dispatch, scrollable } = renderController({
      channel,
      messages,
      hasNextMessages: true
    })

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(scrollable, {
        scrollTop: 2,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(scrollable)
    })

    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.NEXT, '211', true)
    )
  })

  it('does not dispatch duplicate next-page loads while a next request is still in flight', () => {
    const channel = makeChannel({
      id: 'channel-next-in-flight'
    })
    const messages = [
      makeMessage({ id: '210', channelId: channel.id, body: 'confirmed-older' }),
      makeMessage({ id: '211', channelId: channel.id, body: 'confirmed-newer' }),
      makePendingMessage({
        channelId: channel.id,
        body: 'pending-tail',
        createdAt: new Date('2026-04-01T12:19:00.000Z')
      })
    ]
    const { dispatch, scrollable } = renderController({
      channel,
      messages,
      hasNextMessages: true
    })

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(scrollable, {
        scrollTop: 2,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(scrollable)
    })

    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.NEXT, '211', true)
    )

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(scrollable, {
        scrollTop: 40,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(scrollable)
    })

    expect(dispatch).not.toHaveBeenCalled()
  })

  it('uses the nearest confirmed anchor on reconnect instead of a pending synthetic key', () => {
    const pendingEarlier = makePendingMessage({
      channelId: 'channel-reconnect',
      body: 'pending-earlier',
      createdAt: new Date('2026-04-01T12:04:00.000Z')
    })
    const pendingLatest = makePendingMessage({
      channelId: 'channel-reconnect',
      body: 'pending-latest',
      createdAt: new Date('2026-04-01T12:06:00.000Z')
    })
    const channel = makeChannel({
      id: 'channel-reconnect',
      lastMessage: pendingLatest
    })
    const messages = [
      makeMessage({ id: '310', channelId: channel.id, body: 'confirmed-older' }),
      makeMessage({ id: '311', channelId: channel.id, body: 'confirmed-newer' }),
      pendingEarlier,
      pendingLatest
    ]
    const dispatch = jest.fn()
    const rendered = renderController({
      channel,
      messages,
      hasNextMessages: true,
      connectionStatus: CONNECTION_STATUS.DISCONNECTED,
      dispatch
    })

    act(() => {
      setScrollMetrics(rendered.scrollable, {
        scrollTop: 160,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(rendered.scrollable)
    })

    dispatch.mockClear()

    fireEvent.click(screen.getByTestId('set-visible-2'))

    rendered.rerender(
      <ControllerHarness
        channel={channel}
        messages={messages}
        hasNextMessages={true}
        connectionStatus={CONNECTION_STATUS.CONNECTED}
        dispatch={dispatch}
      />
    )
    layoutTimeline(rendered.container.querySelector('#scrollableDiv'))

    expect(dispatch).toHaveBeenCalledWith(reloadActiveChannelAfterReconnectAC(channel, '311', false, false))
  })

  it('preserves latest reconnect context even when pending local messages exist after the latest confirmed message', () => {
    const confirmedBase = makeMessage({
      id: '998',
      channelId: 'channel-reconnect-pending-latest',
      body: 'confirmed-base'
    })
    const confirmedLatest = makeMessage({
      id: '999',
      channelId: 'channel-reconnect-pending-latest',
      body: 'confirmed-latest'
    })
    const pendingLatest = makePendingMessage({
      channelId: 'channel-reconnect-pending-latest',
      body: 'pending-latest',
      createdAt: new Date('2026-04-08T12:10:00.000Z')
    })
    const channel = makeChannel({
      id: 'channel-reconnect-pending-latest',
      lastMessage: confirmedLatest
    })
    const dispatch = jest.fn()
    const rendered = renderController({
      channel,
      messages: [confirmedBase, confirmedLatest],
      hasNextMessages: false,
      connectionStatus: CONNECTION_STATUS.DISCONNECTED,
      dispatch
    })

    fireEvent.click(screen.getByTestId('set-visible-1'))

    dispatch.mockClear()

    rendered.rerender(
      <ControllerHarness
        channel={channel}
        messages={[confirmedBase, confirmedLatest, pendingLatest]}
        hasNextMessages={false}
        connectionStatus={CONNECTION_STATUS.CONNECTED}
        dispatch={dispatch}
      />
    )
    layoutTimeline(rendered.container.querySelector('#scrollableDiv'))

    expect(dispatch).toHaveBeenCalledWith(reloadActiveChannelAfterReconnectAC(channel, confirmedLatest.id, true))
  })

  it('preserves the latest reconnect context when unread exists and the user is still in the latest window', () => {
    const channel = makeChannel({
      id: 'channel-reconnect-unread-latest-window',
      newMessageCount: 8,
      lastDisplayedMessageId: '995',
      lastMessage: makeMessage({
        id: '999',
        channelId: 'channel-reconnect-unread-latest-window',
        body: 'latest'
      })
    })
    const messages = [
      makeMessage({ id: '995', channelId: channel.id, body: 'displayed' }),
      makeMessage({ id: '996', channelId: channel.id, body: 'unread-1', incoming: true }),
      makeMessage({ id: '997', channelId: channel.id, body: 'unread-2', incoming: true }),
      makeMessage({ id: '998', channelId: channel.id, body: 'unread-3', incoming: true }),
      channel.lastMessage
    ]
    const dispatch = jest.fn()
    const rendered = renderController({
      channel,
      messages,
      hasNextMessages: false,
      connectionStatus: CONNECTION_STATUS.DISCONNECTED,
      dispatch
    })

    fireEvent.click(screen.getByTestId('set-visible-4'))
    dispatch.mockClear()

    rendered.rerender(
      <ControllerHarness
        channel={channel}
        messages={messages}
        hasNextMessages={false}
        connectionStatus={CONNECTION_STATUS.CONNECTED}
        dispatch={dispatch}
      />
    )

    expect(dispatch).toHaveBeenCalledWith(reloadActiveChannelAfterReconnectAC(channel, '999', true))
  })

  it('does not dispatch reconnect reload while already connected when scroll state changes', () => {
    const channel = makeChannel({
      id: 'channel-no-spurious-reconnect'
    })
    const messages = [
      makeMessage({ id: '100', channelId: channel.id, body: '100' }),
      makeMessage({ id: '101', channelId: channel.id, body: '101' }),
      makeMessage({ id: '102', channelId: channel.id, body: '102' })
    ]
    const dispatch = jest.fn()
    const rendered = renderController({
      channel,
      messages,
      hasNextMessages: true,
      connectionStatus: CONNECTION_STATUS.CONNECTED,
      dispatch
    })

    expect(
      dispatch.mock.calls.some(([action]) => action.type === reloadActiveChannelAfterReconnectAC(channel).type)
    ).toBe(false)

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(rendered.scrollable, {
        scrollTop: 160,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(rendered.scrollable)
    })

    rendered.rerender(
      <ControllerHarness
        channel={channel}
        messages={messages}
        hasNextMessages={false}
        connectionStatus={CONNECTION_STATUS.CONNECTED}
        dispatch={dispatch}
      />
    )

    expect(
      dispatch.mock.calls.some(([action]) => action.type === reloadActiveChannelAfterReconnectAC(channel).type)
    ).toBe(false)
  })

  it('re-anchors scrollTop after the reconnect window prepends messages above the visible anchor', async () => {
    // Scenario:
    //   1. Offline: user is in history and scrolls to the history edge → PREV pagination fires.
    //   2. Offline cache delivers the PREV page; preserve-anchor keeps the scroll position.
    //   3. Network comes back → loadAroundMessageAC is dispatched for the visible anchor;
    //      restoreRef is set so the anchor position is captured before dispatch.
    //   4. Server returns a wider window with extra messages prepended before the anchor.
    //   5. preserve-anchor correction runs → scrollTop adjusts so the anchor message stays
    //      at the same viewport position it was before reconnect.
    const channel = makeChannel({ id: 'channel-reconnect-scroll-drift' })
    const msg120 = makeMessage({ id: '120', channelId: channel.id, body: 'msg-120' })
    const msg121 = makeMessage({ id: '121', channelId: channel.id, body: 'msg-121' })

    // Offline cache delivers 2 older messages above msg120
    const prevPageMessages = [
      makeMessage({ id: '118', channelId: channel.id, body: 'msg-118' }),
      makeMessage({ id: '119', channelId: channel.id, body: 'msg-119' }),
      msg120,
      msg121
    ]

    // Server (after reconnect) returns a wider window: 3 more messages prepended
    const reconnectedMessages = [
      makeMessage({ id: '115', channelId: channel.id, body: 'msg-115' }),
      makeMessage({ id: '116', channelId: channel.id, body: 'msg-116' }),
      makeMessage({ id: '117', channelId: channel.id, body: 'msg-117' }),
      makeMessage({ id: '118', channelId: channel.id, body: 'msg-118' }),
      makeMessage({ id: '119', channelId: channel.id, body: 'msg-119' }),
      msg120,
      msg121
    ]

    const dispatch = jest.fn()

    // Phase 1: offline, 2 messages, at history edge (scrollTop=558, maxScrollTop=560)
    // msg120 is at top of viewport (offsetFromTop=0)
    const rendered = renderController({
      channel,
      messages: [msg120, msg121],
      hasPrevMessages: true,
      connectionStatus: CONNECTION_STATUS.DISCONNECTED,
      dispatch,
      layoutSpec: {
        containerRect: { top: 0, left: 0, width: 320, height: 240 },
        scrollMetrics: { scrollTop: 558, scrollHeight: 800, clientHeight: 240, offsetTop: 0, offsetHeight: 240 },
        itemRects: {
          '120': { top: 0, left: 0, width: 320, height: 32 },
          '121': { top: 40, left: 0, width: 320, height: 32 }
        }
      }
    })

    // Record msg120 as the visible anchor so reconnect can use it
    fireEvent.click(screen.getByTestId('set-visible-0'))

    dispatch.mockClear()

    // Phase 2: scroll event at the history edge while offline captures preserve-anchor
    // but does not dispatch network pagination.
    act(() => {
      setScrollMetrics(rendered.scrollable, { scrollTop: 558, scrollHeight: 800, clientHeight: 240 })
      fireEvent.scroll(rendered.scrollable)
    })

    expect(dispatch).not.toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.PREV, '120', true)
    )

    // Phase 3: offline PREV cache delivers [118, 119, 120, 121]
    // msg120 stays at top=0 → preserve-anchor delta=0 → scrollTop unchanged at 558
    rendered.rerender(
      <ControllerHarness
        channel={channel}
        messages={prevPageMessages}
        hasPrevMessages={false}
        connectionStatus={CONNECTION_STATUS.DISCONNECTED}
        dispatch={dispatch}
        layoutSpec={{
          containerRect: { top: 0, left: 0, width: 320, height: 240 },
          scrollMetrics: { scrollTop: 558, scrollHeight: 880, clientHeight: 240, offsetTop: 0, offsetHeight: 240 },
          itemRects: {
            '118': { top: -80, left: 0, width: 320, height: 32 },
            '119': { top: -40, left: 0, width: 320, height: 32 },
            '120': { top: 0, left: 0, width: 320, height: 32 },
            '121': { top: 40, left: 0, width: 320, height: 32 }
          }
        }}
      />
    )

    act(() => {
      flushAnimationFrames()
    })

    // preserve-anchor: msg120 is still at offsetFromTop=0 → delta=0 → no scrollTop change
    expect(rendered.scrollable.scrollTop).toBe(558)

    // Update the visible anchor to msg120 at its new index (2) in prevPageMessages
    fireEvent.click(screen.getByTestId('set-visible-2'))

    dispatch.mockClear()

    // Phase 4: network comes back online
    rendered.rerender(
      <ControllerHarness
        channel={channel}
        messages={prevPageMessages}
        hasPrevMessages={false}
        connectionStatus={CONNECTION_STATUS.CONNECTED}
        dispatch={dispatch}
        layoutSpec={{
          containerRect: { top: 0, left: 0, width: 320, height: 240 },
          scrollMetrics: { scrollTop: 558, scrollHeight: 880, clientHeight: 240, offsetTop: 0, offsetHeight: 240 },
          itemRects: {
            '118': { top: -80, left: 0, width: 320, height: 32 },
            '119': { top: -40, left: 0, width: 320, height: 32 },
            '120': { top: 0, left: 0, width: 320, height: 32 },
            '121': { top: 40, left: 0, width: 320, height: 32 }
          }
        }}
      />
    )

    // Reconnect effect fires: visible anchor '120' triggers the reconnect coordinator action.
    expect(dispatch).toHaveBeenCalledWith(reloadActiveChannelAfterReconnectAC(channel, '120', false, false))

    dispatch.mockClear()

    // Phase 5: server delivers a wider window — 3 extra messages prepended before msg120.
    // msg120 shifts up in the layout (top=-40 instead of 0), but no re-anchor runs.
    rendered.rerender(
      <ControllerHarness
        channel={channel}
        messages={reconnectedMessages}
        hasPrevMessages={true}
        hasNextMessages={true}
        connectionStatus={CONNECTION_STATUS.CONNECTED}
        dispatch={dispatch}
        layoutSpec={{
          containerRect: { top: 0, left: 0, width: 320, height: 240 },
          scrollMetrics: { scrollTop: 558, scrollHeight: 1040, clientHeight: 240, offsetTop: 0, offsetHeight: 240 },
          itemRects: {
            '115': { top: -200, left: 0, width: 320, height: 32 },
            '116': { top: -160, left: 0, width: 320, height: 32 },
            '117': { top: -120, left: 0, width: 320, height: 32 },
            '118': { top: -80, left: 0, width: 320, height: 32 },
            '119': { top: -40, left: 0, width: 320, height: 32 },
            '120': { top: -40, left: 0, width: 320, height: 32 },
            '121': { top: 0, left: 0, width: 320, height: 32 }
          }
        }}
      />
    )

    await flushEffects()
    act(() => {
      flushAnimationFrames()
    })

    // msg120 shifted from top=0 to top=-40 (delta=-40).
    // preserve-anchor adjusts: scrollTop = 558 + (-40) = 518.
    // msg120 stays at the same viewport position it occupied before reconnect.
    expect(rendered.scrollable.scrollTop).toBe(558)
    expect(dispatch).not.toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.PREV, '115', true)
    )
  })

  it('loads around a replied message when it is outside the current window', async () => {
    const channel = makeChannel({
      id: 'channel-replied-scroll'
    })
    const messages = [
      makeMessage({ id: '810', channelId: channel.id, body: 'confirmed-810' }),
      makeMessage({ id: '811', channelId: channel.id, body: 'confirmed-811' })
    ]
    const dispatch = jest.fn()

    renderController({
      channel,
      messages,
      jumpToItemId: '999',
      dispatch
    })

    dispatch.mockClear()
    jest.useFakeTimers()
    try {
      fireEvent.click(screen.getByTestId('jump-to-item'))

      await act(async () => {
        jest.advanceTimersByTime(60)
        await Promise.resolve()
      })
    } finally {
      jest.useRealTimers()
    }

    expect(dispatch).toHaveBeenCalledWith(loadAroundMessageAC(channel, '999'))
  })

  it('fires loadAroundMessageAC after scroll idle when user is scrolled into history', async () => {
    // User scrolls to a position mid-history (not at the latest window) and stops.
    // After SCROLL_IDLE_MS the controller should dispatch loadAroundMessageAC to refresh
    // the cache around the visible anchor, without networkChanged (last arg = false).
    const channel = makeChannel({ id: 'channel-scroll-idle' })
    const messages = [
      makeMessage({ id: '200', channelId: channel.id, body: 'msg-200' }),
      makeMessage({ id: '201', channelId: channel.id, body: 'msg-201' }),
      makeMessage({ id: '202', channelId: channel.id, body: 'msg-202' })
    ]
    const dispatch = jest.fn()

    const rendered = renderController({
      channel,
      messages,
      connectionStatus: CONNECTION_STATUS.CONNECTED,
      hasPrevMessages: true,
      dispatch,
      layoutSpec: {
        containerRect: { top: 0, left: 0, width: 320, height: 240 },
        scrollMetrics: { scrollTop: 140, scrollHeight: 800, clientHeight: 240, offsetTop: 0, offsetHeight: 240 },
        itemRects: {
          '200': { top: 0, left: 0, width: 320, height: 32 },
          '201': { top: 40, left: 0, width: 320, height: 32 },
          '202': { top: 80, left: 0, width: 320, height: 32 }
        }
      }
    })

    // Mark a visible message, but refresh should use the current window center, not the last visible anchor.
    fireEvent.click(screen.getByTestId('set-visible-0'))
    dispatch.mockClear()

    // Fire a scroll event at a position that is NOT at the latest window (scrollTop=140 > PINNED_TO_LATEST_PX=96)
    act(() => {
      setScrollMetrics(rendered.scrollable, { scrollTop: 140, scrollHeight: 800, clientHeight: 240 })
      fireEvent.scroll(rendered.scrollable)
    })

    // No dispatch before the idle timer fires
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: refreshCacheAroundMessageAC('', '').type })
    )

    // Wait past SCROLL_IDLE_MS (800ms)
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 825))
    })

    expect(dispatch).toHaveBeenCalledWith(refreshCacheAroundMessageAC(channel.id, '201'))
  })

  it('does not fire scroll-idle load when user is at the latest window', async () => {
    const channel = makeChannel({ id: 'channel-scroll-idle-latest' })
    const messages = [
      makeMessage({ id: '210', channelId: channel.id, body: 'msg-210' }),
      makeMessage({ id: '211', channelId: channel.id, body: 'msg-211' })
    ]
    const dispatch = jest.fn()

    const rendered = renderController({
      channel,
      messages,
      connectionStatus: CONNECTION_STATUS.CONNECTED,
      // hasNextMessages defaults to false → at the latest window when scrollTop <= PINNED_TO_LATEST_PX
      dispatch,
      layoutSpec: {
        containerRect: { top: 0, left: 0, width: 320, height: 240 },
        // scrollTop=50 is below PINNED_TO_LATEST_PX=96 → pinned to latest
        scrollMetrics: { scrollTop: 50, scrollHeight: 200, clientHeight: 240, offsetTop: 0, offsetHeight: 240 },
        itemRects: {
          '210': { top: 0, left: 0, width: 320, height: 32 },
          '211': { top: 40, left: 0, width: 320, height: 32 }
        }
      }
    })

    fireEvent.click(screen.getByTestId('set-visible-0'))
    dispatch.mockClear()

    act(() => {
      setScrollMetrics(rendered.scrollable, { scrollTop: 50, scrollHeight: 200, clientHeight: 240 })
      fireEvent.scroll(rendered.scrollable)
    })

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 825))
    })

    // Should NOT have dispatched a refreshCacheAroundMessageAC (user is viewing latest)
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: refreshCacheAroundMessageAC('', '').type })
    )
  })

  it('does not fire scroll-idle load when offline', async () => {
    const channel = makeChannel({ id: 'channel-scroll-idle-offline' })
    const messages = [
      makeMessage({ id: '220', channelId: channel.id, body: 'msg-220' }),
      makeMessage({ id: '221', channelId: channel.id, body: 'msg-221' })
    ]
    const dispatch = jest.fn()

    const rendered = renderController({
      channel,
      messages,
      connectionStatus: CONNECTION_STATUS.DISCONNECTED,
      hasPrevMessages: true,
      dispatch,
      layoutSpec: {
        containerRect: { top: 0, left: 0, width: 320, height: 240 },
        scrollMetrics: { scrollTop: 140, scrollHeight: 800, clientHeight: 240, offsetTop: 0, offsetHeight: 240 },
        itemRects: {
          '220': { top: 0, left: 0, width: 320, height: 32 },
          '221': { top: 40, left: 0, width: 320, height: 32 }
        }
      }
    })

    fireEvent.click(screen.getByTestId('set-visible-0'))
    dispatch.mockClear()

    act(() => {
      setScrollMetrics(rendered.scrollable, { scrollTop: 140, scrollHeight: 800, clientHeight: 240 })
      fireEvent.scroll(rendered.scrollable)
    })

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 825))
    })

    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: refreshCacheAroundMessageAC('', '').type })
    )
  })

  it('debounces scroll-idle: rapid scrolling fires only one refreshCacheAroundMessageAC', async () => {
    const channel = makeChannel({ id: 'channel-scroll-idle-debounce' })
    const messages = [
      makeMessage({ id: '230', channelId: channel.id, body: 'msg-230' }),
      makeMessage({ id: '231', channelId: channel.id, body: 'msg-231' })
    ]
    const dispatch = jest.fn()

    const rendered = renderController({
      channel,
      messages,
      connectionStatus: CONNECTION_STATUS.CONNECTED,
      hasPrevMessages: true,
      dispatch,
      layoutSpec: {
        containerRect: { top: 0, left: 0, width: 320, height: 240 },
        scrollMetrics: { scrollTop: 140, scrollHeight: 800, clientHeight: 240, offsetTop: 0, offsetHeight: 240 },
        itemRects: {
          '230': { top: 0, left: 0, width: 320, height: 32 },
          '231': { top: 40, left: 0, width: 320, height: 32 }
        }
      }
    })

    fireEvent.click(screen.getByTestId('set-visible-0'))
    dispatch.mockClear()

    // Three scroll events in quick succession — each should reset the debounce timer
    act(() => {
      setScrollMetrics(rendered.scrollable, { scrollTop: 140, scrollHeight: 800, clientHeight: 240 })
      fireEvent.scroll(rendered.scrollable)
    })
    act(() => {
      setScrollMetrics(rendered.scrollable, { scrollTop: 160, scrollHeight: 800, clientHeight: 240 })
      fireEvent.scroll(rendered.scrollable)
    })
    act(() => {
      setScrollMetrics(rendered.scrollable, { scrollTop: 180, scrollHeight: 800, clientHeight: 240 })
      fireEvent.scroll(rendered.scrollable)
    })

    // Wait past SCROLL_IDLE_MS — exactly one dispatch expected
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 825))
    })

    const refreshCalls = dispatch.mock.calls.filter(
      ([action]) => action?.type === refreshCacheAroundMessageAC('', '').type
    )
    expect(refreshCalls).toHaveLength(1)
  })

  it('restores latest-view state after jumpToLatest', async () => {
    const channel = makeChannel({
      id: 'channel-pending-count',
      lastMessage: makeMessage({ id: '401', channelId: 'channel-pending-count', body: 'latest-visible' })
    })
    const baseMessages = [makeMessage({ id: '400', channelId: channel.id, body: 'older' }), channel.lastMessage]
    const dispatch = jest.fn()
    const rendered = renderController({
      channel,
      messages: baseMessages,
      dispatch
    })

    await flushEffects()

    act(() => {
      setScrollMetrics(rendered.scrollable, {
        scrollTop: 140,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(rendered.scrollable)
    })

    expect(screen.getByTestId('is-viewing-latest')).toHaveTextContent('false')

    dispatch.mockClear()
    expect(screen.getByTestId('is-viewing-latest')).toHaveTextContent('false')

    fireEvent.click(screen.getByTestId('jump-to-latest'))
    act(() => {
      flushAnimationFrames()
    })

    expect(screen.getByTestId('pending-newest-count')).toHaveTextContent('0')
    expect(screen.getByTestId('is-viewing-latest')).toHaveTextContent('true')
  })

  it('shows the scroll-to-new-message signal based on the latest pending local ref', async () => {
    const confirmed = makeMessage({
      id: '510',
      channelId: 'channel-button',
      body: 'confirmed-visible'
    })
    const pendingLatest = makePendingMessage({
      channelId: 'channel-button',
      body: 'pending-latest',
      createdAt: new Date('2026-04-01T12:10:00.000Z')
    })
    const channel = makeChannel({
      id: 'channel-button',
      lastMessage: pendingLatest
    })
    const dispatch = jest.fn()

    renderController({
      channel,
      messages: [confirmed, pendingLatest],
      dispatch
    })

    expect(dispatch).toHaveBeenCalledWith(showScrollToNewMessageButtonAC(true))

    dispatch.mockClear()

    fireEvent.click(screen.getByTestId('set-visible-0'))
    await flushEffects()

    expect(dispatch).not.toHaveBeenCalledWith(showScrollToNewMessageButtonAC(false))
  })

  it('keeps next-edge scrolling active through a deep-history roundtrip and recognizes the latest window again', async () => {
    const pendingLatest = makePendingMessage({
      channelId: 'channel-roundtrip-scroll',
      body: 'pending-latest',
      createdAt: new Date('2026-04-01T12:40:00.000Z')
    })
    const channel = makeChannel({
      id: 'channel-roundtrip-scroll',
      lastMessage: pendingLatest
    })
    const deepHistoryMessages = Array.from({ length: 60 }, (_, index) =>
      makeMessage({
        id: String(920 + index),
        channelId: channel.id,
        body: `history-${index}`
      })
    )
    const latestMessages = [
      ...Array.from({ length: 22 }, (_, index) =>
        makeMessage({
          id: String(979 + index),
          channelId: channel.id,
          body: `latest-${index}`
        })
      ),
      pendingLatest
    ]
    const dispatch = jest.fn()
    const rendered = renderController({
      channel,
      messages: deepHistoryMessages,
      hasPrevMessages: true,
      hasNextMessages: true,
      connectionStatus: CONNECTION_STATUS.CONNECTED,
      dispatch
    })

    layoutTimeline(rendered.scrollable, { scrollHeight: 2480 })
    dispatch.mockClear()

    act(() => {
      setScrollMetrics(rendered.scrollable, {
        scrollTop: 140,
        scrollHeight: 2480,
        clientHeight: 240
      })
      fireEvent.scroll(rendered.scrollable)
    })

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(rendered.scrollable, {
        scrollTop: 2,
        scrollHeight: 2480,
        clientHeight: 240
      })
      fireEvent.scroll(rendered.scrollable)
    })

    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.NEXT, '979', true)
    )

    dispatch.mockClear()

    rendered.rerender(
      <ControllerHarness
        channel={channel}
        messages={latestMessages}
        hasPrevMessages={true}
        hasNextMessages={false}
        connectionStatus={CONNECTION_STATUS.CONNECTED}
        dispatch={dispatch}
      />
    )
    layoutTimeline(rendered.scrollable, { scrollHeight: 1040 })

    await flushEffects()

    expect(screen.getByText('pending-latest')).toBeInTheDocument()
    expect(screen.getByTestId('is-viewing-latest')).toHaveTextContent('true')
    expect(screen.getByTestId('pending-newest-count')).toHaveTextContent('0')
  })

  it('keeps the exact manual history scrollTop after a prev-to-latest roundtrip', async () => {
    const channel = makeChannel({
      id: 'channel-prev-next-scroll-preserve'
    })
    const initialMessages = [
      makeMessage({ id: '120', channelId: channel.id, body: 'visible-120' }),
      makeMessage({ id: '121', channelId: channel.id, body: 'visible-121' })
    ]
    const previousPageMessages = [
      makeMessage({ id: '118', channelId: channel.id, body: 'older-118' }),
      makeMessage({ id: '119', channelId: channel.id, body: 'older-119' }),
      ...initialMessages
    ]
    const latestWindowMessages = [
      ...initialMessages,
      makeMessage({ id: '122', channelId: channel.id, body: 'newer-122' }),
      makeMessage({ id: '123', channelId: channel.id, body: 'newer-123' })
    ]
    const dispatch = jest.fn()
    const rendered = renderController({
      channel,
      messages: initialMessages,
      hasPrevMessages: true,
      hasNextMessages: true,
      dispatch,
      layoutSpec: {
        containerRect: { top: 0, left: 0, width: 320, height: 240 },
        scrollMetrics: {
          scrollTop: 560,
          scrollHeight: 800,
          clientHeight: 240,
          offsetTop: 0,
          offsetHeight: 240
        },
        itemRects: {
          '120': { top: 0, left: 0, width: 320, height: 32 },
          '121': { top: 40, left: 0, width: 320, height: 32 }
        }
      }
    })

    act(() => {
      setScrollMetrics(rendered.scrollable, {
        scrollTop: 560,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(rendered.scrollable)
    })

    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.PREV, '120', true)
    )

    rendered.rerender(
      <ControllerHarness
        channel={channel}
        messages={previousPageMessages}
        hasPrevMessages={false}
        hasNextMessages={true}
        dispatch={dispatch}
        layoutSpec={{
          containerRect: { top: 0, left: 0, width: 320, height: 240 },
          scrollMetrics: {
            scrollTop: 560,
            scrollHeight: 880,
            clientHeight: 240,
            offsetTop: 0,
            offsetHeight: 240
          },
          itemRects: {
            '118': { top: -80, left: 0, width: 320, height: 32 },
            '119': { top: -40, left: 0, width: 320, height: 32 },
            '120': { top: 0, left: 0, width: 320, height: 32 },
            '121': { top: 40, left: 0, width: 320, height: 32 }
          }
        }}
      />
    )

    await flushEffects()

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(rendered.scrollable, {
        scrollTop: 2,
        scrollHeight: 880,
        clientHeight: 240
      })
      fireEvent.scroll(rendered.scrollable)
    })

    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.NEXT, '121', true)
    )

    rendered.rerender(
      <ControllerHarness
        channel={channel}
        messages={latestWindowMessages}
        hasPrevMessages={true}
        hasNextMessages={false}
        dispatch={dispatch}
        layoutSpec={{
          containerRect: { top: 0, left: 0, width: 320, height: 240 },
          scrollMetrics: {
            scrollTop: 2,
            scrollHeight: 880,
            clientHeight: 240,
            offsetTop: 0,
            offsetHeight: 240
          },
          itemRects: {
            '120': { top: -20, left: 0, width: 320, height: 32 },
            '121': { top: 20, left: 0, width: 320, height: 32 },
            '122': { top: 60, left: 0, width: 320, height: 32 },
            '123': { top: 100, left: 0, width: 320, height: 32 }
          }
        }}
      />
    )

    await flushEffects()

    expect(rendered.scrollable.scrollTop).toBe(LATEST_EDGE_GAP_PX)

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(rendered.scrollable, {
        scrollTop: 45,
        scrollHeight: 880,
        clientHeight: 240
      })
      fireEvent.scroll(rendered.scrollable)
    })

    expect(rendered.scrollable.scrollTop).toBe(45)
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('clears a stale next-page preserve-anchor when the latest-edge request returns no new items', async () => {
    const channel = makeChannel({
      id: 'channel-empty-next-preserve-anchor'
    })
    const messages = [
      makeMessage({ id: '200', channelId: channel.id, body: 'msg-200' }),
      makeMessage({ id: '201', channelId: channel.id, body: 'msg-201' }),
      makeMessage({ id: '202', channelId: channel.id, body: 'msg-202' }),
      makeMessage({ id: '203', channelId: channel.id, body: 'msg-203' })
    ]
    const dispatch = jest.fn()
    const rendered = renderController({
      channel,
      messages,
      hasPrevMessages: true,
      hasNextMessages: true,
      dispatch,
      layoutSpec: {
        containerRect: { top: 0, left: 0, width: 320, height: 240 },
        scrollMetrics: {
          scrollTop: 5,
          scrollHeight: 800,
          clientHeight: 240,
          offsetTop: 0,
          offsetHeight: 240
        },
        itemRects: {
          '200': { top: -120, left: 0, width: 320, height: 32 },
          '201': { top: -60, left: 0, width: 320, height: 32 },
          '202': { top: -7, left: 0, width: 320, height: 32 },
          '203': { top: 40, left: 0, width: 320, height: 32 }
        }
      }
    })

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(rendered.scrollable, {
        scrollTop: 5,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(rendered.scrollable)
    })

    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.NEXT, '203', true)
    )

    const sameWindowMessages = messages.map((message) => ({ ...message }))

    rendered.rerender(
      <ControllerHarness
        channel={channel}
        messages={sameWindowMessages}
        hasPrevMessages={true}
        hasNextMessages={false}
        dispatch={dispatch}
        layoutSpec={{
          containerRect: { top: 0, left: 0, width: 320, height: 240 },
          scrollMetrics: {
            scrollTop: 652,
            scrollHeight: 800,
            clientHeight: 240,
            offsetTop: 0,
            offsetHeight: 240
          },
          itemRects: {
            '200': { top: 520, left: 0, width: 320, height: 32 },
            '201': { top: 580, left: 0, width: 320, height: 32 },
            '202': { top: 640, left: 0, width: 320, height: 32 },
            '203': { top: 700, left: 0, width: 320, height: 32 }
          }
        }}
      />
    )

    await flushEffects()

    expect(rendered.scrollable.scrollTop).toBe(652)
  })

  it('re-arms next-edge scrolling only after the user moves away from the latest threshold', async () => {
    const channel = makeChannel({
      id: 'channel-next-rearm'
    })
    const messages = [
      makeMessage({ id: '210', channelId: channel.id, body: 'confirmed-older' }),
      makeMessage({ id: '211', channelId: channel.id, body: 'confirmed-newer' }),
      makePendingMessage({
        channelId: channel.id,
        body: 'pending-tail',
        createdAt: new Date('2026-04-01T12:42:00.000Z')
      })
    ]
    const loadedMessages = [
      ...messages.slice(0, 2),
      makeMessage({ id: '212', channelId: channel.id, body: 'confirmed-newest' }),
      messages[2]
    ]
    const rendered = renderController({
      channel,
      messages,
      hasNextMessages: true
    })
    const { dispatch, scrollable } = rendered

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(scrollable, {
        scrollTop: 2,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(scrollable)
    })

    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.NEXT, '211', true)
    )

    rendered.rerender(
      <ControllerHarness
        channel={channel}
        messages={messages}
        hasNextMessages={true}
        loadingNextMessages={LOADING_STATE.LOADING}
        dispatch={dispatch}
      />
    )
    layoutTimeline(scrollable)
    await flushEffects()

    rendered.rerender(
      <ControllerHarness
        channel={channel}
        messages={loadedMessages}
        hasNextMessages={true}
        loadingNextMessages={LOADING_STATE.LOADED}
        dispatch={dispatch}
      />
    )
    layoutTimeline(scrollable)
    await flushEffects()

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(scrollable, {
        scrollTop: 45,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(scrollable)
    })

    expect(dispatch).not.toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.NEXT, '212', true)
    )

    act(() => {
      setScrollMetrics(scrollable, {
        scrollTop: 140,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(scrollable)
    })

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(scrollable, {
        scrollTop: 2,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(scrollable)
    })

    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.NEXT, '212', true)
    )
  })

  it('clamps the latest edge gap when the scroll position drifts too close to the latest boundary', () => {
    const confirmedOlder = makeMessage({ id: '610', channelId: 'channel-latest-gap-clamp', body: 'confirmed-610' })
    const confirmedLatest = makeMessage({ id: '611', channelId: 'channel-latest-gap-clamp', body: 'confirmed-611' })
    const channel = makeChannel({
      id: 'channel-latest-gap-clamp',
      lastMessage: confirmedLatest
    })
    const messages = [confirmedOlder, confirmedLatest]
    const { scrollable, dispatch } = renderController({
      channel,
      messages,
      hasNextMessages: false
    })

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(scrollable, {
        scrollTop: 2,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(scrollable)
    })

    expect(scrollable.scrollTop).toBe(LATEST_EDGE_GAP_PX)
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('treats a hidden offline pending tail as next content when returning to the latest confirmed edge', () => {
    const channel = makeChannel({
      id: 'channel-hidden-pending-tail'
    })
    const confirmedOlder = makeMessage({ id: '615', channelId: channel.id, body: 'confirmed-615' })
    const confirmedLatest = makeMessage({ id: '616', channelId: channel.id, body: 'confirmed-616' })
    const pendingTail = makePendingMessage({
      channelId: channel.id,
      body: 'pending-tail',
      createdAt: new Date('2026-04-03T12:05:00.000Z')
    })

    addMessageToMap(channel.id, confirmedOlder)
    addMessageToMap(channel.id, confirmedLatest)
    addMessageToMap(channel.id, pendingTail)
    setActiveSegment(channel.id, confirmedOlder.id, confirmedLatest.id)

    const { scrollable, dispatch } = renderController({
      channel,
      messages: [confirmedOlder, confirmedLatest],
      hasNextMessages: false,
      connectionStatus: CONNECTION_STATUS.DISCONNECTED
    })

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(scrollable, {
        scrollTop: 2,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(scrollable)
    })

    expect(scrollable.scrollTop).toBe(LATEST_EDGE_GAP_PX)
    expect(dispatch).toHaveBeenCalledWith(addMessagesAC([pendingTail], MESSAGE_LOAD_DIRECTION.NEXT))
    expect(dispatch).not.toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.NEXT, confirmedLatest.id, false)
    )
  })

  it('paginates through a pending tail that spans more than one page', () => {
    const channel = makeChannel({
      id: 'channel-multi-page-pending-tail'
    })
    const confirmedOlder = makeMessage({ id: '700', channelId: channel.id, body: 'confirmed-700' })
    const confirmedLatest = makeMessage({ id: '701', channelId: channel.id, body: 'confirmed-701' })
    const pendingMessages = Array.from({ length: LOAD_MAX_MESSAGE_COUNT + 5 }, (_, index) =>
      makePendingMessage({
        channelId: channel.id,
        body: `pending-${index}`,
        createdAt: new Date(`2026-04-03T12:${String(index).padStart(2, '0')}:00.000Z`)
      })
    )
    const firstPendingPage = pendingMessages.slice(0, LOAD_MAX_MESSAGE_COUNT)
    const secondPendingPage = pendingMessages.slice(LOAD_MAX_MESSAGE_COUNT)

    addMessageToMap(channel.id, confirmedOlder)
    addMessageToMap(channel.id, confirmedLatest)
    pendingMessages.forEach((message) => addMessageToMap(channel.id, message))
    setActiveSegment(channel.id, confirmedOlder.id, confirmedLatest.id)

    const { scrollable, dispatch } = renderController({
      channel,
      messages: [confirmedOlder, confirmedLatest, ...firstPendingPage],
      hasNextMessages: false,
      connectionStatus: CONNECTION_STATUS.DISCONNECTED
    })

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(scrollable, {
        scrollTop: 2,
        scrollHeight: 1400,
        clientHeight: 240
      })
      fireEvent.scroll(scrollable)
    })

    expect(scrollable.scrollTop).toBe(LATEST_EDGE_GAP_PX)
    expect(dispatch).toHaveBeenCalledWith(addMessagesAC(secondPendingPage, MESSAGE_LOAD_DIRECTION.NEXT))
    expect(dispatch).not.toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.NEXT, confirmedLatest.id, false)
    )
  })

  it('still loads the next page when a fast scroll crosses below the latest edge gap', () => {
    const channel = makeChannel({
      id: 'channel-fast-next-clamp'
    })
    const messages = [
      makeMessage({ id: '620', channelId: channel.id, body: 'confirmed-620' }),
      makeMessage({ id: '621', channelId: channel.id, body: 'confirmed-621' }),
      makePendingMessage({
        channelId: channel.id,
        body: 'pending-tail',
        createdAt: new Date('2026-04-03T12:00:00.000Z')
      })
    ]
    const { scrollable, dispatch } = renderController({
      channel,
      messages,
      hasNextMessages: true
    })

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(scrollable, {
        scrollTop: 2,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(scrollable)
    })

    expect(scrollable.scrollTop).toBe(LATEST_EDGE_GAP_PX)
    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.NEXT, '621', true)
    )
  })

  it('updates scrollTop from wheel input without triggering pagination when away from the edges', () => {
    const channel = makeChannel({
      id: 'channel-wheel-scroll'
    })
    const messages = [
      makeMessage({ id: '910', channelId: channel.id, body: 'confirmed-910' }),
      makeMessage({ id: '911', channelId: channel.id, body: 'confirmed-911' }),
      makeMessage({ id: '912', channelId: channel.id, body: 'confirmed-912' })
    ]
    const { scrollable, dispatch } = renderController({
      channel,
      messages,
      hasPrevMessages: true,
      hasNextMessages: true
    })

    act(() => {
      setScrollMetrics(scrollable, {
        scrollTop: 180,
        scrollHeight: 800,
        clientHeight: 240
      })
    })

    dispatch.mockClear()

    fireEvent.wheel(scrollable, { deltaY: 40, deltaMode: 0 })
    expect(scrollable.scrollTop).toBe(140)

    fireEvent.wheel(scrollable, { deltaY: -20, deltaMode: 0 })
    expect(scrollable.scrollTop).toBe(160)
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('loads the next page when a fast wheel scroll crosses below the latest edge gap', () => {
    const channel = makeChannel({
      id: 'channel-wheel-next-fast'
    })
    const messages = [
      makeMessage({ id: '930', channelId: channel.id, body: 'confirmed-930' }),
      makeMessage({ id: '931', channelId: channel.id, body: 'confirmed-931' }),
      makePendingMessage({
        channelId: channel.id,
        body: 'pending-tail',
        createdAt: new Date('2026-04-03T12:10:00.000Z')
      })
    ]
    const { scrollable, dispatch } = renderController({
      channel,
      messages,
      hasNextMessages: true
    })

    act(() => {
      setScrollMetrics(scrollable, {
        scrollTop: 160,
        scrollHeight: 800,
        clientHeight: 240
      })
    })

    dispatch.mockClear()

    fireEvent.wheel(scrollable, { deltaY: 200, deltaMode: 0 })

    expect(scrollable.scrollTop).toBe(LATEST_EDGE_GAP_PX)
    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.NEXT, '931', true)
    )
  })

  it('still loads the previous page when a fast scroll reaches the history edge without shifting the in-range scrollTop', () => {
    const channel = makeChannel({
      id: 'channel-history-gap-clamp'
    })
    const messages = [
      makeMessage({ id: '710', channelId: channel.id, body: 'confirmed-710' }),
      makeMessage({ id: '711', channelId: channel.id, body: 'confirmed-711' }),
      makeMessage({ id: '712', channelId: channel.id, body: 'confirmed-712' })
    ]
    const { scrollable, dispatch } = renderController({
      channel,
      messages,
      hasPrevMessages: true
    })

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(scrollable, {
        scrollTop: 558,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(scrollable)
    })

    expect(scrollable.scrollTop).toBe(555)
    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.PREV, '710', true)
    )
  })

  it('loads the previous page when a fast wheel scroll overshoots the history edge and clamps to the real max scrollTop', () => {
    const channel = makeChannel({
      id: 'channel-wheel-prev-fast'
    })
    const messages = [
      makeMessage({ id: '940', channelId: channel.id, body: 'confirmed-940' }),
      makeMessage({ id: '941', channelId: channel.id, body: 'confirmed-941' }),
      makeMessage({ id: '942', channelId: channel.id, body: 'confirmed-942' })
    ]
    const { scrollable, dispatch } = renderController({
      channel,
      messages,
      hasPrevMessages: true
    })

    act(() => {
      setScrollMetrics(scrollable, {
        scrollTop: 440,
        scrollHeight: 800,
        clientHeight: 240
      })
    })

    dispatch.mockClear()

    fireEvent.wheel(scrollable, { deltaY: -200, deltaMode: 0 })

    expect(scrollable.scrollTop).toBe(555)
    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.PREV, '940', true)
    )
  })

  it('keeps exact scrollTop pixel targets for latest-edge correction and preserves in-range history positions', () => {
    const channel = makeChannel({
      id: 'channel-exact-scroll-px'
    })
    const messages = [
      makeMessage({ id: '950', channelId: channel.id, body: 'confirmed-950' }),
      makeMessage({ id: '951', channelId: channel.id, body: 'confirmed-951' }),
      makePendingMessage({
        channelId: channel.id,
        body: 'pending-tail',
        createdAt: new Date('2026-04-03T12:20:00.000Z')
      })
    ]
    const scrollHeight = 1234
    const clientHeight = 321
    const expectedLatestEdgeTop = 5
    const expectedHistoryTop = 908

    const { scrollable } = renderController({
      channel,
      messages,
      hasPrevMessages: true,
      hasNextMessages: true
    })

    act(() => {
      setScrollMetrics(scrollable, {
        scrollTop: 2,
        scrollHeight,
        clientHeight
      })
      fireEvent.scroll(scrollable)
    })

    expect(scrollable.scrollTop).toBe(expectedLatestEdgeTop)

    act(() => {
      setScrollMetrics(scrollable, {
        scrollTop: 910,
        scrollHeight,
        clientHeight
      })
      fireEvent.scroll(scrollable)
    })

    expect(scrollable.scrollTop).toBe(expectedHistoryTop)
  })

  it('re-arms history-edge scrolling only after the user moves away from the history threshold', async () => {
    const channel = makeChannel({
      id: 'channel-prev-rearm'
    })
    const messages = [
      makeMessage({ id: '120', channelId: channel.id, body: 'confirmed-120' }),
      makeMessage({ id: '121', channelId: channel.id, body: 'confirmed-121' })
    ]
    const loadedMessages = [
      makeMessage({ id: '118', channelId: channel.id, body: 'confirmed-118' }),
      makeMessage({ id: '119', channelId: channel.id, body: 'confirmed-119' }),
      ...messages
    ]
    const rendered = renderController({
      channel,
      messages,
      hasPrevMessages: true
    })
    const { dispatch, scrollable } = rendered

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(scrollable, {
        scrollTop: 558,
        scrollHeight: 800,
        clientHeight: 240
      })
      fireEvent.scroll(scrollable)
    })

    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.PREV, '120', true)
    )

    rendered.rerender(
      <ControllerHarness
        channel={channel}
        messages={messages}
        hasPrevMessages={true}
        loadingPrevMessages={LOADING_STATE.LOADING}
        dispatch={dispatch}
      />
    )
    layoutTimeline(scrollable, { scrollHeight: 800 })
    await flushEffects()

    rendered.rerender(
      <ControllerHarness
        channel={channel}
        messages={loadedMessages}
        hasPrevMessages={true}
        loadingPrevMessages={LOADING_STATE.LOADED}
        dispatch={dispatch}
      />
    )
    layoutTimeline(scrollable, { scrollHeight: 880 })
    await flushEffects()

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(scrollable, {
        scrollTop: 595,
        scrollHeight: 880,
        clientHeight: 240
      })
      fireEvent.scroll(scrollable)
    })

    expect(dispatch).not.toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.PREV, '118', true)
    )

    act(() => {
      setScrollMetrics(scrollable, {
        scrollTop: 480,
        scrollHeight: 880,
        clientHeight: 240
      })
      fireEvent.scroll(scrollable)
    })

    dispatch.mockClear()

    act(() => {
      setScrollMetrics(scrollable, {
        scrollTop: 638,
        scrollHeight: 880,
        clientHeight: 240
      })
      fireEvent.scroll(scrollable)
    })

    expect(dispatch).toHaveBeenCalledWith(
      loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.PREV, '118', true)
    )
  })

  describe('jumpToLatest while user is scrolling', () => {
    it('scrolls to the latest edge even when a pointerdown is active', async () => {
      const channel = makeChannel({
        id: 'channel-jump-during-pointer',
        lastMessage: makeMessage({ id: '501', channelId: 'channel-jump-during-pointer', body: 'latest' })
      })
      const messages = [makeMessage({ id: '500', channelId: channel.id, body: 'older' }), channel.lastMessage]
      const { scrollable } = renderController({ channel, messages })

      // Simulate user holding a pointer (touch / mouse drag)
      act(() => {
        setScrollMetrics(scrollable, { scrollTop: 300, scrollHeight: 800, clientHeight: 240 })
        fireEvent.pointerDown(scrollable)
      })

      await act(async () => {
        fireEvent.click(screen.getByTestId('jump-to-latest'))
        await new Promise((resolve) => window.setTimeout(resolve, 0))
      })

      act(() => {
        flushAnimationFrames()
      })

      // Should have jumped to the latest edge (40px) regardless of the active pointer
      expect(scrollable.scrollTop).toBe(LATEST_EDGE_GAP_PX)
    })

    it('scrolls to the latest edge even when the user scrolled via wheel moments before', async () => {
      const channel = makeChannel({
        id: 'channel-jump-after-wheel',
        lastMessage: makeMessage({ id: '601', channelId: 'channel-jump-after-wheel', body: 'latest' })
      })
      const messages = [makeMessage({ id: '600', channelId: channel.id, body: 'older' }), channel.lastMessage]
      const { scrollable } = renderController({ channel, messages })

      // Simulate a recent wheel event
      act(() => {
        setScrollMetrics(scrollable, { scrollTop: 300, scrollHeight: 800, clientHeight: 240 })
        fireEvent.wheel(scrollable, { deltaY: 50 })
      })

      await act(async () => {
        fireEvent.click(screen.getByTestId('jump-to-latest'))
        await new Promise((resolve) => window.setTimeout(resolve, 0))
      })

      act(() => {
        flushAnimationFrames()
      })

      expect(scrollable.scrollTop).toBe(LATEST_EDGE_GAP_PX)
    })

    it('blocks previous-page pagination while the jumpToLatest lock is still active', async () => {
      const channel = makeChannel({
        id: 'channel-jump-then-scroll',
        lastMessage: makeMessage({ id: '701', channelId: 'channel-jump-then-scroll', body: 'latest' })
      })
      const messages = [makeMessage({ id: '700', channelId: channel.id, body: 'older' }), channel.lastMessage]
      const { scrollable, dispatch } = renderController({ channel, messages, hasPrevMessages: true })

      // User is scrolling when jumpToLatest fires
      act(() => {
        setScrollMetrics(scrollable, { scrollTop: 350, scrollHeight: 800, clientHeight: 240 })
        fireEvent.pointerDown(scrollable)
      })

      await act(async () => {
        fireEvent.click(screen.getByTestId('jump-to-latest'))
        await new Promise((resolve) => window.setTimeout(resolve, 0))
      })

      act(() => {
        flushAnimationFrames()
      })

      // Confirm we landed at latest
      expect(scrollable.scrollTop).toBe(LATEST_EDGE_GAP_PX)

      dispatch.mockClear()

      // While the jump lock is still active, scrolling into history must NOT trigger pagination
      act(() => {
        fireEvent.pointerUp(scrollable)
        setScrollMetrics(scrollable, { scrollTop: 600, scrollHeight: 800, clientHeight: 240 })
        fireEvent.scroll(scrollable)
      })

      expect(dispatch).not.toHaveBeenCalledWith(
        loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.PREV, '700', true)
      )
    })
  })
})
