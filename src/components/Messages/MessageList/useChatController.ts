import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  clearSelectedMessagesAC,
  loadAroundMessageAC,
  loadDefaultMessagesAC,
  loadLatestMessagesAC,
  loadMoreMessagesAC,
  loadNearUnreadAC,
  scrollToNewMessageAC,
  setScrollToMessagesAC,
  setUnreadMessageIdAC,
  setUnreadScrollToAC,
  showScrollToNewMessageButtonAC
} from '../../../store/message/actions'
import {
  clearVisibleMessagesMap,
  getVisibleMessagesMap,
  hasNextContiguousInMap,
  hasPrevContiguousInMap,
  LOAD_MAX_MESSAGE_COUNT,
  MESSAGE_LOAD_DIRECTION
} from '../../../helpers/messagesHalper'
import { setAllowEditDeleteIncomingMessage } from '../../../helpers/message'
import { CONNECTION_STATUS } from '../../../store/user/constants'
import { LOADING_STATE, MESSAGE_DELIVERY_STATUS } from '../../../helpers/constants'
import { markMessagesAsReadAC } from '../../../store/channel/actions'
import { IChannel, IMessage } from '../../../types'

const PRELOAD_TRIGGER_PX = 50
const PRELOAD_RESET_PX = 100
const LATEST_EDGE_GAP_PX = 40
const HISTORY_EDGE_GAP_PX = 40
const PINNED_TO_LATEST_PX = 96
const HIGHLIGHT_DURATION_MS = 1600
const DEFAULT_UNREAD_VISIBILITY_THRESHOLD = 0.5
const JUMP_SCROLL_LOCK_MS = 1800

type RestoreState =
  | { mode: 'to-bottom' }
  | { mode: 'to-bottom-smooth' }
  | { mode: 'reveal-unread-separator' }
  | { mode: 'reveal-message'; messageId: string; smooth?: boolean }
  | { mode: 'preserve-anchor'; itemId: string; offsetFromTop: number }

type PendingLoadRequest = {
  previousIds: Set<string>
  resolve: (page: { items: IMessage[] }) => void
}

type TimelineItem =
  | {
      type: 'date-divider'
      key: string
      label: string
    }
  | {
      type: 'unread-divider'
      key: string
    }
  | {
      type: 'item'
      key: string
      item: IMessage
      index: number
      prevItem: IMessage | null
      nextItem: IMessage | null
      isHighlighted: boolean
      isUnread: boolean
      startsNewDay: boolean
      registerItemElement: (el: HTMLElement | null) => void
    }

export interface UseChatControllerParams {
  messages: IMessage[]
  channel: IChannel
  hasPrevMessages: boolean
  hasNextMessages: boolean
  messagesLoading: number
  connectionStatus: string
  scrollToNewMessage: { scrollToBottom: boolean; isIncomingMessage: boolean; updateMessageList: boolean }
  scrollToMentionedMessage: boolean | string | null
  scrollToRepliedMessageId: string | null
  scrollToMessageHighlight: boolean
  scrollToMessageBehavior: ScrollBehavior
  showScrollToNewMessageButton: boolean
  unreadScrollTo: boolean | string
  unreadMessageId: string
  selectedMessagesMap: Map<string, any>
  allowEditDeleteIncomingMessage: boolean
  dispatch: (...args: any[]) => void
}

const formatMessageDateLabel = (message: IMessage) => {
  const current = new Date(message.createdAt)
  const now = new Date()
  const isToday =
    current.getFullYear() === now.getFullYear() &&
    current.getMonth() === now.getMonth() &&
    current.getDate() === now.getDate()

  if (isToday) {
    return 'Today'
  }

  return new Intl.DateTimeFormat('en', {
    month: 'long',
    day: 'numeric',
    ...(current.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {})
  }).format(current)
}

const setScrollTop = (container: HTMLElement, top: number, behavior: ScrollBehavior = 'auto') => {
  if (typeof container.scrollTo === 'function') {
    container.scrollTo({ top, behavior })
    return
  }

  container.scrollTop = top
}

const scrollToLatestEdge = (container: HTMLElement, behavior: ScrollBehavior = 'auto') => {
  setScrollTop(container, LATEST_EDGE_GAP_PX, behavior)
}

const scrollToHistoryEdge = (container: HTMLElement, behavior: ScrollBehavior = 'auto') => {
  const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight)
  const top = Math.max(LATEST_EDGE_GAP_PX, maxScrollTop - HISTORY_EDGE_GAP_PX)
  setScrollTop(container, top, behavior)
}

const getItemElement = (container: HTMLElement, itemId: string) =>
  container.querySelector<HTMLElement>(`[data-message-list-item-id="${itemId}"]`)

const getUnreadDividerElement = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-message-list-unread-divider="true"]')

const getTopViewportAnchor = (container: HTMLElement, itemElements: Map<string, HTMLElement>) => {
  const containerRect = container.getBoundingClientRect()
  const candidates = Array.from(itemElements.entries())
    .map(([itemId, element]) => ({
      itemId,
      element,
      rect: element.getBoundingClientRect()
    }))
    .filter(({ rect }) => rect.bottom > containerRect.top && rect.top < containerRect.bottom)
    .sort((left, right) => left.rect.top - right.rect.top)

  const anchor = candidates[0]
  if (!anchor) {
    return null
  }

  return {
    itemId: anchor.itemId,
    offsetFromTop: anchor.rect.top - containerRect.top
  }
}

const isPinnedToLatest = (container: HTMLElement | null) => {
  if (!container) {
    return true
  }

  return container.scrollTop <= PINNED_TO_LATEST_PX
}

const getVisibilityRatio = (containerRect: DOMRect, targetRect: DOMRect) => {
  const visibleTop = Math.max(containerRect.top, targetRect.top)
  const visibleBottom = Math.min(containerRect.bottom, targetRect.bottom)
  const visibleHeight = Math.max(0, visibleBottom - visibleTop)
  return targetRect.height > 0 ? visibleHeight / targetRect.height : 0
}

const getWheelDelta = (event: WheelEvent, container: HTMLDivElement) => {
  if (event.deltaMode === 1) {
    return event.deltaY * 16
  }

  if (event.deltaMode === 2) {
    return event.deltaY * container.clientHeight
  }

  return event.deltaY
}

const isUnreadIncomingMessage = (message: IMessage) =>
  message.incoming && !message.userMarkers?.some((marker) => marker.name === MESSAGE_DELIVERY_STATUS.READ)

export function useChatController({
  messages,
  channel,
  hasPrevMessages,
  hasNextMessages,
  messagesLoading,
  connectionStatus,
  scrollToNewMessage,
  scrollToMentionedMessage,
  scrollToRepliedMessageId,
  scrollToMessageHighlight,
  scrollToMessageBehavior,
  showScrollToNewMessageButton,
  unreadScrollTo,
  unreadMessageId,
  selectedMessagesMap,
  allowEditDeleteIncomingMessage,
  dispatch
}: UseChatControllerParams) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const itemElementsRef = useRef<Map<string, HTMLElement>>(new Map())
  const messagesIndexMapRef = useRef<Record<string, number>>({})
  const lastVisibleMessageIdRef = useRef<string>('')
  const pendingLoadRef = useRef<PendingLoadRequest | null>(null)
  const hasPrevCachedRef = useRef<boolean>(false)
  const hasNextCachedRef = useRef<boolean>(false)
  const previousMessagesRef = useRef<IMessage[]>([])
  const suppressedMessageChangesRef = useRef<number>(0)
  const pendingVisibleUnreadFrameRef = useRef<number | null>(null)
  const visibleUnreadReportedRef = useRef<Set<string>>(new Set())
  const restoreRef = useRef<RestoreState | null>(null)
  const lastBootKeyRef = useRef<string | null>(null)
  const highlightedItemIdRef = useRef<string | null>(null)
  const highlightTimeoutRef = useRef<number | null>(null)
  const historyLoadArmedRef = useRef(true)
  const latestLoadArmedRef = useRef(true)
  const pendingNewestCountRef = useRef(0)
  const viewIsAtLatestRef = useRef(true)
  const jumpLockUntilRef = useRef<number>(0)
  const jumpUnlockTimeoutRef = useRef<number | null>(null)
  const loadStateRef = useRef<null | 'previous' | 'next' | 'around'>(null)

  const [isLoadingPrevious, setIsLoadingPrevious] = useState(false)
  const [isLoadingNext, setIsLoadingNext] = useState(false)
  const [isViewingLatest, setIsViewingLatest] = useState(true)
  const [lastVisibleMessageId, setLastVisibleMessageIdState] = useState('')
  const [pendingNewestCount, setPendingNewestCount] = useState(0)
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null)

  const setLastVisibleMessageId = useCallback((msgId: string) => {
    lastVisibleMessageIdRef.current = msgId
    setLastVisibleMessageIdState(msgId)
  }, [])

  const suppressNextMessageChange = useCallback((count = 1) => {
    suppressedMessageChangesRef.current += count
  }, [])

  useEffect(() => {
    hasPrevCachedRef.current = messages.length ? hasPrevContiguousInMap(channel.id, messages[0].id) : false
    hasNextCachedRef.current = messages.length
      ? hasNextContiguousInMap(channel.id, messages[messages.length - 1].id)
      : false
  }, [channel.id, messages])

  const hasPrevious = hasPrevMessages || hasPrevCachedRef.current
  const hasNext = hasNextMessages || hasNextCachedRef.current

  const syncLatestState = useCallback(() => {
    const nextIsViewingLatest = !hasNext && isPinnedToLatest(scrollRef.current)
    viewIsAtLatestRef.current = nextIsViewingLatest
    setIsViewingLatest(nextIsViewingLatest)
  }, [hasNext])

  const setHighlight = useCallback((itemId: string | null) => {
    highlightedItemIdRef.current = itemId
    setHighlightedItemId(itemId)

    if (highlightTimeoutRef.current !== null) {
      window.clearTimeout(highlightTimeoutRef.current)
      highlightTimeoutRef.current = null
    }

    if (!itemId) {
      return
    }

    highlightTimeoutRef.current = window.setTimeout(() => {
      highlightedItemIdRef.current = null
      setHighlightedItemId(null)
      highlightTimeoutRef.current = null
    }, HIGHLIGHT_DURATION_MS)
  }, [])

  const queueVisibleUnreadCheck = useCallback(() => {
    if (pendingVisibleUnreadFrameRef.current !== null || !unreadMessageId) {
      return
    }

    pendingVisibleUnreadFrameRef.current = window.requestAnimationFrame(() => {
      pendingVisibleUnreadFrameRef.current = null
      const container = scrollRef.current
      if (!container || !unreadMessageId) {
        return
      }

      const unreadStartIndex = messages.findIndex((message) => message.id === unreadMessageId)
      if (unreadStartIndex < 0) {
        return
      }

      const containerRect = container.getBoundingClientRect()
      const visibleUnreadMessages = messages
        .slice(unreadStartIndex)
        .map((message) => {
          const element = itemElementsRef.current.get(message.id)
          if (!element) {
            return null
          }

          const visibilityRatio = getVisibilityRatio(containerRect, element.getBoundingClientRect())
          if (
            visibilityRatio < DEFAULT_UNREAD_VISIBILITY_THRESHOLD ||
            visibleUnreadReportedRef.current.has(message.id)
          ) {
            return null
          }

          visibleUnreadReportedRef.current.add(message.id)
          return message
        })
        .filter(Boolean) as IMessage[]

      const ids = visibleUnreadMessages.filter(isUnreadIncomingMessage).map((message) => message.id)
      if (!ids.length || !channel.id || !channel.newMessageCount || unreadScrollTo) {
        return
      }

      const idSet = new Set(ids)
      dispatch(markMessagesAsReadAC(channel.id, ids))
      const nextUnreadMessage = messages.find((message) => isUnreadIncomingMessage(message) && !idSet.has(message.id))
      dispatch(setUnreadMessageIdAC(nextUnreadMessage?.id || ''))
    })
  }, [channel.id, channel.newMessageCount, dispatch, messages, unreadMessageId, unreadScrollTo])

  const timelineItems = useMemo<TimelineItem[]>(() => {
    const unreadStartIndex = unreadMessageId ? messages.findIndex((message) => message.id === unreadMessageId) : -1

    return messages.flatMap((message, index) => {
      const prevMessage = index > 0 ? messages[index - 1] : null
      const nextMessage = index < messages.length - 1 ? messages[index + 1] : null
      const startsNewDay = !prevMessage || formatMessageDateLabel(prevMessage) !== formatMessageDateLabel(message)
      const isUnread = unreadStartIndex >= 0 && index >= unreadStartIndex
      const result: TimelineItem[] = []

      if (startsNewDay) {
        result.push({
          type: 'date-divider',
          key: `date-divider-${message.id}`,
          label: formatMessageDateLabel(message)
        })
      }

      if (unreadStartIndex === index) {
        result.push({
          type: 'unread-divider',
          key: `unread-divider-${message.id}`
        })
      }

      result.push({
        type: 'item',
        key: message.id,
        item: message,
        index,
        prevItem: prevMessage,
        nextItem: nextMessage,
        isHighlighted: highlightedItemId === message.id,
        isUnread,
        startsNewDay,
        registerItemElement: (el: HTMLElement | null) => {
          if (el) {
            itemElementsRef.current.set(message.id, el)
          } else {
            itemElementsRef.current.delete(message.id)
          }
        }
      })

      return result
    })
  }, [highlightedItemId, messages, unreadMessageId])

  const resolvePendingLoad = useCallback(() => {
    if (!pendingLoadRef.current || messagesLoading !== LOADING_STATE.LOADED) {
      return
    }

    const request = pendingLoadRef.current
    pendingLoadRef.current = null
    const nextItems = messages.filter((message) => !request.previousIds.has(message.id))
    request.resolve({ items: nextItems.length > 0 ? nextItems : messages })
  }, [messages, messagesLoading])

  useEffect(() => {
    resolvePendingLoad()
  }, [resolvePendingLoad])

  const beginPagedRequest = useCallback(
    (dispatchAction: () => void) =>
      new Promise<{ items: IMessage[] }>((resolve) => {
        pendingLoadRef.current = {
          previousIds: new Set(messages.map((message) => message.id)),
          resolve
        }
        suppressNextMessageChange()
        dispatchAction()
      }),
    [messages, suppressNextMessageChange]
  )

  const jumpToLatest = useCallback(
    async (smooth = true) => {
      pendingNewestCountRef.current = 0
      setPendingNewestCount(0)
      const container = scrollRef.current

      if (container) {
        viewIsAtLatestRef.current = true
        setIsViewingLatest(true)
        scrollToLatestEdge(container, smooth ? 'smooth' : 'auto')
      }

      const windowHasLatest = messages.length > 0 && messages[messages.length - 1]?.id === channel.lastMessage?.id

      if (!windowHasLatest && channel?.id && connectionStatus === CONNECTION_STATUS.CONNECTED) {
        suppressNextMessageChange()
        await beginPagedRequest(() => {
          dispatch(loadLatestMessagesAC(channel))
        })
        const latestContainer = scrollRef.current
        if (!latestContainer) {
          return
        }

        viewIsAtLatestRef.current = true
        setIsViewingLatest(true)
        window.requestAnimationFrame(() => {
          const renderedContainer = scrollRef.current
          if (!renderedContainer) {
            return
          }
          scrollToLatestEdge(renderedContainer, smooth ? 'smooth' : 'auto')
        })
        dispatch(showScrollToNewMessageButtonAC(false))
        return
      }

      if (!container) {
        return
      }

      syncLatestState()
      scrollToLatestEdge(container, smooth ? 'smooth' : 'auto')
      dispatch(showScrollToNewMessageButtonAC(false))
    },
    [beginPagedRequest, channel, connectionStatus, dispatch, messages, suppressNextMessageChange, syncLatestState]
  )

  const jumpToItem = useCallback(
    async (itemId: string, smooth = true) => {
      jumpLockUntilRef.current = Date.now() + (smooth ? JUMP_SCROLL_LOCK_MS : 250)
      const isLoaded = messages.some((message) => message.id === itemId)
      restoreRef.current = {
        mode: 'reveal-message',
        messageId: itemId,
        smooth
      }

      if (jumpUnlockTimeoutRef.current !== null) {
        window.clearTimeout(jumpUnlockTimeoutRef.current)
      }

      historyLoadArmedRef.current = false
      latestLoadArmedRef.current = false

      if (isLoaded) {
        setHighlight(itemId)
        jumpUnlockTimeoutRef.current = window.setTimeout(() => {
          jumpLockUntilRef.current = 0
          historyLoadArmedRef.current = true
          latestLoadArmedRef.current = true
          jumpUnlockTimeoutRef.current = null
        }, JUMP_SCROLL_LOCK_MS)
        return
      }

      if (!channel.id) {
        return
      }

      loadStateRef.current = 'around'
      setIsLoadingPrevious(true)
      setIsLoadingNext(true)

      try {
        await beginPagedRequest(() => {
          dispatch(loadAroundMessageAC(channel, itemId, scrollToMessageHighlight, 'instant', false))
        })
        setHighlight(itemId)
        jumpUnlockTimeoutRef.current = window.setTimeout(() => {
          jumpLockUntilRef.current = 0
          historyLoadArmedRef.current = true
          latestLoadArmedRef.current = true
          jumpUnlockTimeoutRef.current = null
        }, JUMP_SCROLL_LOCK_MS)
      } finally {
        loadStateRef.current = null
        setIsLoadingPrevious(false)
        setIsLoadingNext(false)
      }
    },
    [beginPagedRequest, channel, dispatch, messages, scrollToMessageHighlight, setHighlight]
  )

  const notifyIncomingItems = useCallback((incomingItems: IMessage[]) => {
    if (viewIsAtLatestRef.current) {
      pendingNewestCountRef.current = 0
      setPendingNewestCount(0)
      return
    }

    pendingNewestCountRef.current += incomingItems.length
    setPendingNewestCount(pendingNewestCountRef.current)
  }, [])

  const notifyOutgoingItem = useCallback((outgoingItem: IMessage) => {
    if (viewIsAtLatestRef.current) {
      pendingNewestCountRef.current = 0
      setPendingNewestCount(0)
      return
    }

    pendingNewestCountRef.current += outgoingItem ? 1 : 0
    setPendingNewestCount(pendingNewestCountRef.current)
  }, [])

  const loadPrevious = useCallback(
    async (beforeId: string) => {
      if (
        !channel.id ||
        scrollToMentionedMessage ||
        scrollToNewMessage.scrollToBottom ||
        messagesLoading === LOADING_STATE.LOADING
      ) {
        return { items: [] }
      }

      return beginPagedRequest(() => {
        dispatch(
          loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.PREV, beforeId, hasPrevMessages)
        )
      })
    },
    [
      beginPagedRequest,
      channel.id,
      dispatch,
      hasPrevMessages,
      messagesLoading,
      scrollToMentionedMessage,
      scrollToNewMessage.scrollToBottom
    ]
  )

  const loadNext = useCallback(
    async (afterId: string) => {
      if (
        !channel.id ||
        scrollToMentionedMessage ||
        scrollToNewMessage.scrollToBottom ||
        messagesLoading === LOADING_STATE.LOADING
      ) {
        return { items: [] }
      }

      return beginPagedRequest(() => {
        dispatch(
          loadMoreMessagesAC(channel.id, LOAD_MAX_MESSAGE_COUNT, MESSAGE_LOAD_DIRECTION.NEXT, afterId, hasNextMessages)
        )
      })
    },
    [
      beginPagedRequest,
      channel.id,
      dispatch,
      hasNextMessages,
      messagesLoading,
      scrollToMentionedMessage,
      scrollToNewMessage.scrollToBottom
    ]
  )

  const loadPreviousItems = useCallback(async () => {
    const oldestVisibleId = messages[0]?.id
    if (!oldestVisibleId || !hasPrevious || isLoadingPrevious || loadStateRef.current) {
      return
    }

    const container = scrollRef.current
    if (container) {
      const anchor = getTopViewportAnchor(container, itemElementsRef.current)
      if (anchor) {
        restoreRef.current = {
          mode: 'preserve-anchor',
          itemId: anchor.itemId,
          offsetFromTop: anchor.offsetFromTop
        }
      }
    }

    loadStateRef.current = 'previous'
    setIsLoadingPrevious(true)
    try {
      await loadPrevious(oldestVisibleId)
    } finally {
      loadStateRef.current = null
      setIsLoadingPrevious(false)
    }
  }, [hasPrevious, isLoadingPrevious, loadPrevious, messages])

  const loadNextItems = useCallback(async () => {
    const newestVisibleId = messages[messages.length - 1]?.id
    if (!newestVisibleId || !hasNext || isLoadingNext || loadStateRef.current) {
      return
    }

    loadStateRef.current = 'next'
    setIsLoadingNext(true)
    try {
      await loadNext(newestVisibleId)
    } finally {
      loadStateRef.current = null
      setIsLoadingNext(false)
    }
  }, [hasNext, isLoadingNext, loadNext, messages])

  const handleTimelineScroll = useCallback(() => {
    const container = scrollRef.current
    if (!container) {
      return
    }

    if (Date.now() < jumpLockUntilRef.current) {
      return
    }

    if (container.scrollTop < LATEST_EDGE_GAP_PX) {
      setScrollTop(container, LATEST_EDGE_GAP_PX)
      return
    }

    syncLatestState()
    queueVisibleUnreadCheck()

    const distanceFromHistory = container.scrollHeight - container.clientHeight - container.scrollTop
    if (distanceFromHistory < HISTORY_EDGE_GAP_PX) {
      scrollToHistoryEdge(container, 'auto')
      return
    }
    if (distanceFromHistory > PRELOAD_RESET_PX) {
      historyLoadArmedRef.current = true
    }
    if (container.scrollTop > PRELOAD_RESET_PX) {
      latestLoadArmedRef.current = true
    }

    if (distanceFromHistory <= PRELOAD_TRIGGER_PX && historyLoadArmedRef.current && hasPrevious) {
      historyLoadArmedRef.current = false
      loadPreviousItems()
    }

    if (container.scrollTop <= PRELOAD_TRIGGER_PX && latestLoadArmedRef.current && hasNext) {
      latestLoadArmedRef.current = false
      loadNextItems()
    }
  }, [hasNext, hasPrevious, loadNextItems, loadPreviousItems, queueVisibleUnreadCheck, syncLatestState])

  // Keep a stable latest-closure ref so the scroll/wheel listeners never need re-registering.
  const handleScrollRef = useRef(handleTimelineScroll)
  handleScrollRef.current = handleTimelineScroll

  useEffect(() => {
    const el = scrollRef.current
    if (!el) {
      return
    }

    const onScroll = () => handleScrollRef.current()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) {
      return
    }

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      el.scrollTop -= getWheelDelta(event, el)
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    lastBootKeyRef.current = null
    restoreRef.current = null
    loadStateRef.current = null
    jumpLockUntilRef.current = 0
    historyLoadArmedRef.current = true
    latestLoadArmedRef.current = true
    visibleUnreadReportedRef.current.clear()
    itemElementsRef.current.clear()
    previousMessagesRef.current = []
    suppressedMessageChangesRef.current = 0
    pendingNewestCountRef.current = 0
    viewIsAtLatestRef.current = true
    setLastVisibleMessageIdState('')
    setPendingNewestCount(0)
    setIsViewingLatest(true)
    setHighlightedItemId(null)
    highlightedItemIdRef.current = null
  }, [channel.id])

  useLayoutEffect(() => {
    const container = scrollRef.current
    if (!container || !messages.length) {
      return
    }

    if (!lastBootKeyRef.current) {
      lastBootKeyRef.current = `${channel.id}:${messages[0].id}`
      restoreRef.current =
        unreadScrollTo && unreadMessageId ? { mode: 'reveal-unread-separator' } : { mode: 'to-bottom' }
    }

    const restoreState = restoreRef.current
    if (!restoreState) {
      return
    }

    restoreRef.current = null

    if (restoreState.mode === 'reveal-message') {
      const target = getItemElement(container, restoreState.messageId)
      if (target) {
        viewIsAtLatestRef.current = false
        setIsViewingLatest(false)
        if (restoreState.smooth) {
          scrollToLatestEdge(container, 'auto')
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
              target.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest'
              })
            })
          })
        } else {
          target.scrollIntoView({
            behavior: 'auto',
            block: 'center',
            inline: 'nearest'
          })
        }
      }
      return
    }

    if (restoreState.mode === 'reveal-unread-separator') {
      const unreadDivider = getUnreadDividerElement(container)
      if (unreadDivider) {
        viewIsAtLatestRef.current = false
        setIsViewingLatest(false)
        unreadDivider.scrollIntoView({
          behavior: 'auto',
          block: 'center',
          inline: 'nearest'
        })
      } else {
        viewIsAtLatestRef.current = true
        setIsViewingLatest(true)
        scrollToLatestEdge(container)
      }
      return
    }

    if (restoreState.mode === 'to-bottom') {
      viewIsAtLatestRef.current = true
      setIsViewingLatest(true)
      scrollToLatestEdge(container, 'auto')
      return
    }

    if (restoreState.mode === 'to-bottom-smooth') {
      viewIsAtLatestRef.current = true
      setIsViewingLatest(true)
      scrollToLatestEdge(container, 'smooth')
    }
  }, [channel.id, messages, unreadMessageId, unreadScrollTo])

  useEffect(() => {
    const previousMessages = previousMessagesRef.current

    if (suppressedMessageChangesRef.current > 0) {
      suppressedMessageChangesRef.current -= 1
      previousMessagesRef.current = messages
      syncLatestState()
      queueVisibleUnreadCheck()
      return
    }

    if (!previousMessages.length || !messages.length) {
      previousMessagesRef.current = messages
      syncLatestState()
      queueVisibleUnreadCheck()
      return
    }

    const previousIds = new Set(previousMessages.map((message) => message.id))
    const addedMessages = messages.filter((message) => !previousIds.has(message.id))

    if (addedMessages.length > 0) {
      const incomingMessages = addedMessages.filter((message) => message.incoming)
      const outgoingMessages = addedMessages.filter((message) => !message.incoming)

      if (incomingMessages.length) {
        notifyIncomingItems(incomingMessages)
      }

      outgoingMessages.forEach((message) => {
        notifyOutgoingItem(message)
      })
    }

    previousMessagesRef.current = messages
    syncLatestState()
    queueVisibleUnreadCheck()
  }, [messages, notifyIncomingItems, notifyOutgoingItem, queueVisibleUnreadCheck, syncLatestState])

  useEffect(() => {
    const validKeys = new Set(messages.map((message) => message.id))
    visibleUnreadReportedRef.current.forEach((key) => {
      if (!validKeys.has(key)) {
        visibleUnreadReportedRef.current.delete(key)
      }
    })
  }, [messages])

  useEffect(() => {
    messagesIndexMapRef.current = {}
    pendingLoadRef.current?.resolve({ items: [] })
    pendingLoadRef.current = null
    previousMessagesRef.current = []

    if (channel.backToLinkedChannel && channel?.id) {
      const visibleMessages = getVisibleMessagesMap()
      const visibleMessagesIds = Object.keys(visibleMessages)
      const messageId = visibleMessagesIds[visibleMessagesIds.length - 1]
      if (messageId) {
        suppressNextMessageChange()
        dispatch(loadAroundMessageAC(channel, messageId, undefined, 'instant'))
        dispatch(setUnreadMessageIdAC(messageId))
      }
    } else {
      if (!channel.isLinkedChannel) {
        clearVisibleMessagesMap()
      }

      if (channel?.id) {
        if (channel.newMessageCount && channel.lastDisplayedMessageId) {
          suppressNextMessageChange()
          dispatch(loadNearUnreadAC(channel))
        } else {
          suppressNextMessageChange()
          dispatch(loadDefaultMessagesAC(channel))
        }
      }

      dispatch(
        setUnreadMessageIdAC(
          channel.newMessageCount && channel.lastDisplayedMessageId ? channel.lastDisplayedMessageId : ''
        )
      )
    }

    if (selectedMessagesMap?.size) {
      dispatch(clearSelectedMessagesAC())
    }

    setAllowEditDeleteIncomingMessage(allowEditDeleteIncomingMessage)
  }, [allowEditDeleteIncomingMessage, channel, dispatch, selectedMessagesMap, suppressNextMessageChange])

  useEffect(() => {
    if (connectionStatus !== CONNECTION_STATUS.CONNECTED || !channel?.id) {
      return
    }

    const visibleAnchorId =
      lastVisibleMessageIdRef.current && lastVisibleMessageIdRef.current !== channel.lastMessage?.id
        ? lastVisibleMessageIdRef.current
        : ''

    if (visibleAnchorId) {
      suppressNextMessageChange()
      dispatch(loadAroundMessageAC(channel, visibleAnchorId, false, 'instant', false, true))
      return
    }

    if (channel.newMessageCount && channel.lastDisplayedMessageId) {
      suppressNextMessageChange()
      dispatch(loadNearUnreadAC(channel))
    } else {
      suppressNextMessageChange()
      dispatch(loadDefaultMessagesAC(channel))
    }
  }, [channel, connectionStatus, suppressNextMessageChange])

  useEffect(() => {
    if (!scrollToRepliedMessageId) {
      return
    }

    jumpToItem(scrollToRepliedMessageId, scrollToMessageBehavior === 'smooth')
    dispatch(setScrollToMessagesAC(null, scrollToMessageHighlight, scrollToMessageBehavior))
  }, [dispatch, jumpToItem, scrollToMessageBehavior, scrollToMessageHighlight, scrollToRepliedMessageId])

  useEffect(() => {
    if (!scrollToNewMessage.scrollToBottom) {
      return
    }

    const forceLatest = scrollToNewMessage.updateMessageList

    if (!forceLatest && scrollToNewMessage.isIncomingMessage && !isViewingLatest) {
      dispatch(scrollToNewMessageAC(false, false, false))
      return
    }

    jumpToLatest(true).catch(() => undefined)
    dispatch(scrollToNewMessageAC(false, false, false))
  }, [dispatch, isViewingLatest, jumpToLatest, scrollToNewMessage])

  useEffect(() => {
    const shouldShow =
      (!!channel.lastMessage?.id && lastVisibleMessageId !== channel.lastMessage.id) ||
      (!isViewingLatest && (pendingNewestCount > 0 || !!scrollToMentionedMessage))
    if (showScrollToNewMessageButton !== shouldShow) {
      dispatch(showScrollToNewMessageButtonAC(shouldShow))
    }
  }, [
    channel.lastMessage?.id,
    dispatch,
    isViewingLatest,
    lastVisibleMessageId,
    pendingNewestCount,
    scrollToMentionedMessage,
    showScrollToNewMessageButton
  ])

  useEffect(() => {
    if (!unreadScrollTo || !messages.length || messagesLoading !== LOADING_STATE.LOADED) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      dispatch(setUnreadScrollToAC(false))
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [dispatch, messages.length, messagesLoading, unreadScrollTo])

  useEffect(
    () => () => {
      if (pendingVisibleUnreadFrameRef.current !== null) {
        window.cancelAnimationFrame(pendingVisibleUnreadFrameRef.current)
      }
      if (highlightTimeoutRef.current !== null) {
        window.clearTimeout(highlightTimeoutRef.current)
      }
      if (jumpUnlockTimeoutRef.current !== null) {
        window.clearTimeout(jumpUnlockTimeoutRef.current)
      }
      pendingLoadRef.current?.resolve({ items: [] })
      pendingLoadRef.current = null
    },
    []
  )

  return {
    scrollRef,
    setLastVisibleMessageId,
    handleScrollToRepliedMessage: jumpToItem,
    messagesIndexMapRef,
    timelineItems,
    isLoadingPrevious,
    isLoadingNext,
    isViewingLatest,
    pendingNewestCount,
    jumpToLatest,
    jumpToItem
  }
}
