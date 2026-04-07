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
  getClosestConfirmedMessageId,
  getFirstConfirmedMessageId,
  getLastConfirmedMessageId,
  getMessageLocalRef,
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

const PRELOAD_TRIGGER_PX = 2
const PRELOAD_RESET_PX = 50
const LATEST_EDGE_GAP_PX = 40
const PINNED_TO_LATEST_PX = 96
const HIGHLIGHT_DURATION_MS = 1600
const DEFAULT_UNREAD_VISIBILITY_THRESHOLD = 0.5
const JUMP_SCROLL_LOCK_MS = 1800
const PRESERVE_ANCHOR_SCROLL_EPSILON_PX = 1

type RestoreState =
  | { mode: 'to-bottom' }
  | { mode: 'to-bottom-smooth' }
  | { mode: 'reveal-unread-separator' }
  | { mode: 'reveal-message'; messageId: string; smooth?: boolean }
  | { mode: 'preserve-anchor'; itemId: string; offsetFromTop: number; sourceScrollTop: number }

type ViewportLoadState = null | 'previous' | 'next' | 'around' | 'window'

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
      localRef: string
      item: IMessage
      index: number
      prevItem: IMessage | null
      nextItem: IMessage | null
      isHighlighted: boolean
      isUnread: boolean
      startsUnreadSection: boolean
      nextItemStartsUnreadSection: boolean
      startsNewDay: boolean
      registerItemElement: (el: HTMLElement | null) => void
    }

export interface UseChatControllerParams {
  messages: IMessage[]
  channel: IChannel
  hasPrevMessages: boolean
  hasNextMessages: boolean
  loadingPrevMessages: number | null
  loadingNextMessages: number | null
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

const getMaxScrollTop = (container: HTMLElement) => Math.max(0, container.scrollHeight - container.clientHeight)

const scrollItemIntoView = (container: HTMLElement, target: HTMLElement, smooth: boolean, isInView = false) => {
  if (smooth) {
    if (!isInView) {
      scrollToLatestEdge(container, 'auto')
    }
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        })
      })
    })
    return
  }

  target.scrollIntoView({
    behavior: 'auto',
    block: 'center',
    inline: 'nearest'
  })
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

const getUnreadDividerIndex = (messages: IMessage[], unreadAnchorId: string) => {
  if (!unreadAnchorId) {
    return -1
  }

  const unreadAnchorIndex = messages.findIndex((message) => message.id === unreadAnchorId)

  return unreadAnchorIndex >= 0 ? unreadAnchorIndex : -1
}

const getUnreadTrackingStartIndex = (messages: IMessage[]) => {
  return messages.findIndex(isUnreadIncomingMessage)
}

export function useChatController({
  messages,
  channel,
  hasPrevMessages,
  hasNextMessages,
  loadingPrevMessages,
  loadingNextMessages,
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
  const messagesRef = useRef<IMessage[]>(messages)
  const channelRef = useRef(channel)
  const lastVisibleMessageIdRef = useRef<string>('')
  const lastVisibleAnchorIdRef = useRef<string>('')
  const handleScrollRef = useRef<() => void>(() => undefined)
  const loadingPrevMessagesRef = useRef(loadingPrevMessages)
  const loadingNextMessagesRef = useRef(loadingNextMessages)
  const pendingLoadRef = useRef<PendingLoadRequest | null>(null)
  const hasPrevCachedRef = useRef<boolean>(false)
  const hasNextCachedRef = useRef<boolean>(false)
  const previousMessagesRef = useRef<IMessage[]>([])
  const suppressedMessageChangesRef = useRef<number>(0)
  const pendingVisibleUnreadFrameRef = useRef<number | null>(null)
  const clearedSelectionChannelIdRef = useRef<string>('')
  const visibleUnreadReportedRef = useRef<Set<string>>(new Set())
  const restoreRef = useRef<RestoreState | null>(null)
  const lastBootKeyRef = useRef<string | null>(null)
  const highlightedItemIdRef = useRef<string | null>(null)
  const highlightTimeoutRef = useRef<number | null>(null)
  const unreadRestoreCompletedRef = useRef(false)
  const historyLoadArmedRef = useRef(true)
  const latestLoadArmedRef = useRef(true)
  const pendingNewestCountRef = useRef(0)
  const serverUnreadCountRef = useRef(channel.newMessageCount || 0)
  const optimisticReadUnreadCountRef = useRef(0)
  const viewIsAtLatestRef = useRef(true)
  const jumpLockUntilRef = useRef<number>(0)
  const jumpLockModeRef = useRef<null | 'latest' | 'item'>(null)
  const jumpUnlockTimeoutRef = useRef<number | null>(null)
  const isJumping = useRef(false)
  const loadStateRef = useRef<ViewportLoadState>(null)
  const deferredEdgeCheckRef = useRef(false)
  const activeChannelIdRef = useRef<string | null>(null)

  const [isLoadingPrevious, setIsLoadingPrevious] = useState(false)
  const [isLoadingNext, setIsLoadingNext] = useState(false)
  const [isViewingLatest, setIsViewingLatest] = useState(true)
  const [lastVisibleMessageId, setLastVisibleMessageIdState] = useState('')
  const [pendingNewestCount, setPendingNewestCount] = useState(0)
  const [remainingUnreadCount, setRemainingUnreadCount] = useState(channel.newMessageCount || 0)
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null)
  const [stableUnreadAnchorId, setStableUnreadAnchorId] = useState(unreadMessageId)

  loadingPrevMessagesRef.current = loadingPrevMessages
  loadingNextMessagesRef.current = loadingNextMessages

  const effectiveUnreadAnchorId = stableUnreadAnchorId || unreadMessageId
  const isPreviousLoading = loadingPrevMessages === LOADING_STATE.LOADING
  const isNextLoading = loadingNextMessages === LOADING_STATE.LOADING
  const isAnyWindowLoading = isPreviousLoading || isNextLoading

  const isViewportLoadSettled = useCallback((scope: null | 'previous' | 'next' | 'around' | 'window') => {
    switch (scope) {
      case 'previous':
        return loadingPrevMessagesRef.current === LOADING_STATE.LOADED
      case 'next':
        return loadingNextMessagesRef.current === LOADING_STATE.LOADED
      case 'around':
      case 'window':
        return (
          loadingPrevMessagesRef.current === LOADING_STATE.LOADED &&
          loadingNextMessagesRef.current === LOADING_STATE.LOADED
        )
      default:
        return (
          loadingPrevMessagesRef.current !== LOADING_STATE.LOADING &&
          loadingNextMessagesRef.current !== LOADING_STATE.LOADING
        )
    }
  }, [])

  const syncRemainingUnreadCount = useCallback((serverUnreadCount = serverUnreadCountRef.current) => {
    setRemainingUnreadCount(Math.max(0, serverUnreadCount - optimisticReadUnreadCountRef.current))
  }, [])

  const registerLocallyReadUnreadMessages = useCallback(
    (count: number) => {
      if (count <= 0) {
        return
      }

      optimisticReadUnreadCountRef.current = Math.min(
        serverUnreadCountRef.current,
        optimisticReadUnreadCountRef.current + count
      )
      syncRemainingUnreadCount()
    },
    [syncRemainingUnreadCount]
  )

  const setLastVisibleMessageId = useCallback((message: IMessage) => {
    const localRef = getMessageLocalRef(message)
    const messageIndex = messagesRef.current.findIndex((item) => getMessageLocalRef(item) === localRef)
    const anchorId =
      message.id ||
      (messageIndex >= 0 ? getClosestConfirmedMessageId(messagesRef.current, messageIndex, 'nearest') : '')

    lastVisibleMessageIdRef.current = localRef
    lastVisibleAnchorIdRef.current = anchorId
    setLastVisibleMessageIdState(localRef)
  }, [])

  const suppressNextMessageChange = useCallback((count = 1) => {
    suppressedMessageChangesRef.current += count
  }, [])

  useEffect(() => {
    messagesRef.current = messages
    channelRef.current = channel
  })

  useEffect(() => {
    const oldestConfirmedMessageId = getFirstConfirmedMessageId(messages)
    const newestConfirmedMessageId = getLastConfirmedMessageId(messages)
    hasPrevCachedRef.current = oldestConfirmedMessageId
      ? hasPrevContiguousInMap(channel.id, oldestConfirmedMessageId)
      : false
    hasNextCachedRef.current = newestConfirmedMessageId
      ? hasNextContiguousInMap(channel.id, newestConfirmedMessageId)
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

  const clearJumpScrollingLock = useCallback(() => {
    jumpLockUntilRef.current = 0
    jumpLockModeRef.current = null
    historyLoadArmedRef.current = true
    latestLoadArmedRef.current = true

    if (jumpUnlockTimeoutRef.current !== null) {
      window.clearTimeout(jumpUnlockTimeoutRef.current)
      jumpUnlockTimeoutRef.current = null
    }
    isJumping.current = false
  }, [])

  const lockJumpScrolling = useCallback(
    (smooth: boolean, mode: 'latest' | 'item') => {
      const lockDuration = smooth ? JUMP_SCROLL_LOCK_MS : 250
      jumpLockUntilRef.current = Date.now() + lockDuration
      jumpLockModeRef.current = mode

      if (jumpUnlockTimeoutRef.current !== null) {
        window.clearTimeout(jumpUnlockTimeoutRef.current)
      }

      historyLoadArmedRef.current = false
      latestLoadArmedRef.current = false
      jumpUnlockTimeoutRef.current = window.setTimeout(() => {
        clearJumpScrollingLock()
      }, lockDuration)
    },
    [clearJumpScrollingLock]
  )

  const queueVisibleUnreadCheck = useCallback(() => {
    if (pendingVisibleUnreadFrameRef.current !== null || unreadScrollTo) {
      return
    }

    pendingVisibleUnreadFrameRef.current = window.requestAnimationFrame(() => {
      pendingVisibleUnreadFrameRef.current = null
      const container = scrollRef.current
      if (!container) {
        return
      }

      const unreadStartIndex = getUnreadTrackingStartIndex(messages)
      if (unreadStartIndex < 0) {
        return
      }

      const candidateUnreadMessages = messages.slice(unreadStartIndex)
      const pinnedToLatestWithoutMorePages = !hasNext && isPinnedToLatest(container)
      const containerRect = pinnedToLatestWithoutMorePages ? null : container.getBoundingClientRect()
      const visibleUnreadMessages = candidateUnreadMessages
        .map((message) => {
          if (visibleUnreadReportedRef.current.has(message.id)) {
            return null
          }

          if (!pinnedToLatestWithoutMorePages) {
            const element = itemElementsRef.current.get(getMessageLocalRef(message))
            if (!element) {
              return null
            }

            const visibilityRatio = getVisibilityRatio(containerRect as DOMRect, element.getBoundingClientRect())
            if (visibilityRatio < DEFAULT_UNREAD_VISIBILITY_THRESHOLD) {
              return null
            }
          }

          return message
        })
        .filter(Boolean) as IMessage[]

      const ids = visibleUnreadMessages.filter(isUnreadIncomingMessage).map((message) => message.id)
      if (!ids.length || !channel.id || !channel.newMessageCount) {
        return
      }

      ids.forEach((id) => {
        visibleUnreadReportedRef.current.add(id)
      })
      registerLocallyReadUnreadMessages(ids.length)
      dispatch(markMessagesAsReadAC(channel.id, ids))
    })
  }, [
    channel.id,
    channel.lastDisplayedMessageId,
    channel.newMessageCount,
    dispatch,
    hasNext,
    messages,
    registerLocallyReadUnreadMessages,
    unreadScrollTo
  ])

  const timelineItems = useMemo<TimelineItem[]>(() => {
    const unreadStartIndex = getUnreadDividerIndex(messages, effectiveUnreadAnchorId)

    return messages.flatMap((message, index) => {
      const localRef = getMessageLocalRef(message)
      const prevMessage = index > 0 ? messages[index - 1] : null
      const nextMessage = index < messages.length - 1 ? messages[index + 1] : null
      const startsNewDay = !prevMessage || formatMessageDateLabel(prevMessage) !== formatMessageDateLabel(message)
      const isUnread = unreadStartIndex >= 0 && index >= unreadStartIndex && isUnreadIncomingMessage(message)
      const startsUnreadSection = unreadStartIndex >= 0 && index === unreadStartIndex
      const nextItemStartsUnreadSection = unreadStartIndex >= 0 && index + 1 === unreadStartIndex
      const result: TimelineItem[] = []

      if (startsNewDay) {
        result.push({
          type: 'date-divider',
          key: `date-divider-${localRef || index}`,
          label: formatMessageDateLabel(message)
        })
      }

      if (unreadStartIndex === index) {
        result.push({
          type: 'unread-divider',
          key: `unread-divider-${localRef || index}`
        })
      }

      result.push({
        type: 'item',
        key: localRef || String(index),
        localRef,
        item: message,
        index,
        prevItem: prevMessage,
        nextItem: nextMessage,
        isHighlighted: highlightedItemId === localRef,
        isUnread,
        startsUnreadSection,
        nextItemStartsUnreadSection,
        startsNewDay,
        registerItemElement: (el: HTMLElement | null) => {
          if (!localRef) {
            return
          }
          if (el) {
            itemElementsRef.current.set(localRef, el)
          } else {
            itemElementsRef.current.delete(localRef)
          }
        }
      })

      return result
    })
  }, [highlightedItemId, messages, effectiveUnreadAnchorId])

  const resolvePendingLoad = useCallback(() => {
    if (!pendingLoadRef.current || !isViewportLoadSettled(loadStateRef.current)) {
      return
    }

    const request = pendingLoadRef.current
    pendingLoadRef.current = null
    const nextItems = messages.filter((message) => !request.previousIds.has(getMessageLocalRef(message)))
    request.resolve({ items: nextItems.length > 0 ? nextItems : messages })
  }, [isViewportLoadSettled, loadingNextMessages, loadingPrevMessages, messages])

  useEffect(() => {
    resolvePendingLoad()
  }, [resolvePendingLoad])

  const beginPagedRequest = useCallback(
    (dispatchAction: () => void) =>
      new Promise<{ items: IMessage[] }>((resolve) => {
        pendingLoadRef.current = {
          previousIds: new Set(messagesRef.current.map((message) => getMessageLocalRef(message))),
          resolve
        }
        suppressNextMessageChange()
        dispatchAction()
      }),
    [suppressNextMessageChange]
  )

  const flushDeferredEdgeCheck = useCallback(() => {
    if (!deferredEdgeCheckRef.current || loadStateRef.current || !isViewportLoadSettled(null)) {
      return
    }

    deferredEdgeCheckRef.current = false
    window.requestAnimationFrame(() => {
      if (!loadStateRef.current && isViewportLoadSettled(null)) {
        handleScrollRef.current()
      }
    })
  }, [isViewportLoadSettled])

  const jumpToLatest = useCallback(
    async (smooth = true) => {
      isJumping.current = true
      lockJumpScrolling(smooth, 'latest')
      restoreRef.current = null
      pendingNewestCountRef.current = 0
      setPendingNewestCount(0)
      const container = scrollRef.current

      if (container) {
        viewIsAtLatestRef.current = true
        setIsViewingLatest(true)
        scrollToLatestEdge(container, smooth ? 'smooth' : 'auto')
      }

      const latestLocalRef = getMessageLocalRef(channelRef.current.lastMessage)
      const windowHasLatest =
        !hasNext &&
        !!latestLocalRef &&
        messagesRef.current.length > 0 &&
        messagesRef.current.some((message) => getMessageLocalRef(message) === latestLocalRef)

      if (!windowHasLatest && channelRef.current?.id) {
        suppressNextMessageChange()
        loadStateRef.current = 'window'
        try {
          await beginPagedRequest(() => {
            if (connectionStatus === CONNECTION_STATUS.CONNECTED) {
              dispatch(loadLatestMessagesAC(channelRef.current))
            } else {
              dispatch(loadDefaultMessagesAC(channelRef.current))
            }
          })
        } finally {
          loadStateRef.current = null
          flushDeferredEdgeCheck()
        }

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
    [
      beginPagedRequest,
      connectionStatus,
      dispatch,
      flushDeferredEdgeCheck,
      hasNext,
      lockJumpScrolling,
      suppressNextMessageChange,
      syncLatestState
    ]
  )

  const jumpToItem = useCallback(
    async (itemId: string, smooth = true) => {
      lockJumpScrolling(smooth, 'item')
      const length = messagesRef.current?.length
      const isLoaded = messagesRef.current.some(
        (message, index) => index < length - 10 && index > 10 && getMessageLocalRef(message) === itemId
      )
      restoreRef.current = {
        mode: 'reveal-message',
        messageId: itemId,
        smooth
      }

      if (isLoaded) {
        const container = scrollRef.current
        const target = container ? getItemElement(container, itemId) : null
        if (container && target) {
          restoreRef.current = null
          viewIsAtLatestRef.current = false
          setIsViewingLatest(false)
          scrollItemIntoView(container, target, smooth, true)
        }
        setHighlight(itemId)
        return
      }

      if (!channelRef.current.id) {
        return
      }

      loadStateRef.current = 'around'
      setIsLoadingPrevious(true)
      setIsLoadingNext(true)

      try {
        await beginPagedRequest(() => {
          dispatch(loadAroundMessageAC(channelRef.current, itemId, scrollToMessageHighlight, 'instant', false))
        })
        isJumping.current = true
        setHighlight(itemId)
      } finally {
        loadStateRef.current = null
        setIsLoadingPrevious(false)
        setIsLoadingNext(false)
      }
    },
    [beginPagedRequest, dispatch, lockJumpScrolling, scrollToMessageHighlight, setHighlight]
  )

  const notifyIncomingItems = useCallback(
    (incomingItems: IMessage[]) => {
      const nextIsViewingLatest = !hasNext && isPinnedToLatest(scrollRef.current)
      viewIsAtLatestRef.current = nextIsViewingLatest
      setIsViewingLatest(nextIsViewingLatest)

      if (nextIsViewingLatest) {
        pendingNewestCountRef.current = 0
        setPendingNewestCount(0)
        return
      }

      pendingNewestCountRef.current += incomingItems.length
      setPendingNewestCount(pendingNewestCountRef.current)
    },
    [hasNext]
  )

  const notifyOutgoingItem = useCallback(
    (outgoingItem: IMessage) => {
      const nextIsViewingLatest = !hasNext && isPinnedToLatest(scrollRef.current)
      viewIsAtLatestRef.current = nextIsViewingLatest
      setIsViewingLatest(nextIsViewingLatest)

      if (nextIsViewingLatest) {
        pendingNewestCountRef.current = 0
        setPendingNewestCount(0)
        return
      }

      pendingNewestCountRef.current += outgoingItem ? 1 : 0
      setPendingNewestCount(pendingNewestCountRef.current)
    },
    [hasNext]
  )

  const loadPrevious = useCallback(
    async (beforeId: string) => {
      if (!channel.id || scrollToMentionedMessage || scrollToNewMessage.scrollToBottom || isPreviousLoading) {
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
      isAnyWindowLoading,
      scrollToMentionedMessage,
      scrollToNewMessage.scrollToBottom
    ]
  )

  const loadNext = useCallback(
    async (afterId: string) => {
      if (!channel.id || scrollToMentionedMessage || scrollToNewMessage.scrollToBottom || isNextLoading) {
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
      isAnyWindowLoading,
      scrollToMentionedMessage,
      scrollToNewMessage.scrollToBottom
    ]
  )

  const loadPreviousItems = useCallback(async () => {
    if (isJumping.current) {
      return
    }
    const oldestVisibleId = getFirstConfirmedMessageId(messages)
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
          offsetFromTop: anchor.offsetFromTop,
          sourceScrollTop: container.scrollTop
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
      flushDeferredEdgeCheck()
    }
  }, [flushDeferredEdgeCheck, hasPrevious, isLoadingPrevious, loadPrevious, messages])

  const loadNextItems = useCallback(async () => {
    if (isJumping.current) {
      return
    }
    const newestVisibleId = getLastConfirmedMessageId(messages)
    if (!newestVisibleId || !hasNext || isLoadingNext || loadStateRef.current) {
      return
    }

    const container = scrollRef.current
    if (container) {
      const anchor = getTopViewportAnchor(container, itemElementsRef.current)
      if (anchor) {
        restoreRef.current = {
          mode: 'preserve-anchor',
          itemId: anchor.itemId,
          offsetFromTop: anchor.offsetFromTop,
          sourceScrollTop: container.scrollTop
        }
      }
    }

    loadStateRef.current = 'next'
    setIsLoadingNext(true)
    try {
      await loadNext(newestVisibleId)
    } finally {
      loadStateRef.current = null
      setIsLoadingNext(false)
      flushDeferredEdgeCheck()
    }
  }, [flushDeferredEdgeCheck, hasNext, isLoadingNext, loadNext, messages])

  const handleTimelineScroll = useCallback(() => {
    const container = scrollRef.current
    if (!container) {
      return
    }

    if (isJumping.current) {
      return
    }

    if (Date.now() < jumpLockUntilRef.current) {
      if (jumpLockModeRef.current === 'latest' && container.scrollTop > PRELOAD_RESET_PX) {
        clearJumpScrollingLock()
      } else {
        return
      }
    }

    if (container.scrollTop < LATEST_EDGE_GAP_PX) {
      setScrollTop(container, LATEST_EDGE_GAP_PX)
    }

    const pendingRestore = restoreRef.current
    if (
      pendingRestore?.mode === 'preserve-anchor' &&
      loadStateRef.current &&
      Math.abs(container.scrollTop - pendingRestore.sourceScrollTop) > PRESERVE_ANCHOR_SCROLL_EPSILON_PX
    ) {
      const currentAnchor = getTopViewportAnchor(container, itemElementsRef.current)
      restoreRef.current = currentAnchor
        ? {
            mode: 'preserve-anchor',
            itemId: currentAnchor.itemId,
            offsetFromTop: currentAnchor.offsetFromTop,
            sourceScrollTop: container.scrollTop
          }
        : null
    }

    syncLatestState()
    queueVisibleUnreadCheck()

    const maxScrollTop = getMaxScrollTop(container)
    if (container.scrollTop > maxScrollTop) {
      setScrollTop(container, maxScrollTop)
    }
    const distanceFromHistory = maxScrollTop - container.scrollTop
    const historyTriggered = distanceFromHistory <= PRELOAD_TRIGGER_PX && hasPrevious
    const latestTriggered = container.scrollTop <= PRELOAD_TRIGGER_PX + LATEST_EDGE_GAP_PX && hasNext

    if (loadStateRef.current && (historyTriggered || latestTriggered)) {
      deferredEdgeCheckRef.current = true
    }

    if (distanceFromHistory > PRELOAD_RESET_PX) {
      historyLoadArmedRef.current = true
    }
    if (container.scrollTop > PRELOAD_RESET_PX) {
      latestLoadArmedRef.current = true
    }

    if (loadStateRef.current) {
      return
    }

    if (historyTriggered && historyLoadArmedRef.current) {
      historyLoadArmedRef.current = false
      loadPreviousItems()
    }

    if (latestTriggered && latestLoadArmedRef.current) {
      latestLoadArmedRef.current = false
      loadNextItems()
    }
  }, [hasNext, hasPrevious, loadNextItems, loadPreviousItems, queueVisibleUnreadCheck, syncLatestState])

  // Keep a stable latest-closure ref so the scroll/wheel listeners never need re-registering.
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
      if (isJumping.current) return
      el.scrollTop -= getWheelDelta(event, el)
      handleScrollRef.current()
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    if (activeChannelIdRef.current === null) {
      activeChannelIdRef.current = channel.id
      return
    }

    if (activeChannelIdRef.current === channel.id) {
      return
    }

    activeChannelIdRef.current = channel.id
    lastBootKeyRef.current = null
    restoreRef.current = null
    loadStateRef.current = null
    lastVisibleAnchorIdRef.current = ''
    jumpLockUntilRef.current = 0
    historyLoadArmedRef.current = true
    latestLoadArmedRef.current = true
    unreadRestoreCompletedRef.current = false
    visibleUnreadReportedRef.current.clear()
    itemElementsRef.current.clear()
    previousMessagesRef.current = []
    suppressedMessageChangesRef.current = 0
    deferredEdgeCheckRef.current = false
    pendingNewestCountRef.current = 0
    viewIsAtLatestRef.current = true
    jumpLockModeRef.current = null
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
      lastBootKeyRef.current = `${channel.id}:${getMessageLocalRef(messages[0])}`
      restoreRef.current =
        unreadScrollTo && effectiveUnreadAnchorId ? { mode: 'reveal-unread-separator' } : { mode: 'to-bottom' }
    }

    const restoreState = restoreRef.current
    if (!restoreState) {
      return
    }

    if (restoreState.mode === 'reveal-message') {
      const target = getItemElement(container, restoreState.messageId)
      if (!target) {
        return
      }

      restoreRef.current = null
      viewIsAtLatestRef.current = false
      setIsViewingLatest(false)
      scrollItemIntoView(container, target, !!restoreState.smooth)
      return
    }

    if (restoreState.mode === 'reveal-unread-separator') {
      const unreadDivider = getUnreadDividerElement(container)
      if (unreadDivider) {
        restoreRef.current = null
        unreadRestoreCompletedRef.current = true
        viewIsAtLatestRef.current = false
        setIsViewingLatest(false)
        unreadDivider.scrollIntoView({
          behavior: 'auto',
          block: 'center',
          inline: 'nearest'
        })
      } else {
        return
      }
      return
    }

    if (restoreState.mode === 'to-bottom') {
      restoreRef.current = null
      viewIsAtLatestRef.current = true
      setIsViewingLatest(true)
      scrollToLatestEdge(container, 'auto')
      return
    }

    if (restoreState.mode === 'to-bottom-smooth') {
      restoreRef.current = null
      viewIsAtLatestRef.current = true
      setIsViewingLatest(true)
      scrollToLatestEdge(container, 'smooth')
      return
    }

    if (restoreState.mode === 'preserve-anchor') {
      if (
        pendingLoadRef.current &&
        !messages.some((message) => !pendingLoadRef.current?.previousIds.has(getMessageLocalRef(message)))
      ) {
        return
      }

      const anchorElement = getItemElement(container, restoreState.itemId)
      if (!anchorElement) {
        return
      }

      const containerRect = container.getBoundingClientRect()
      const anchorRect = anchorElement.getBoundingClientRect()
      const offsetDelta = anchorRect.top - containerRect.top - restoreState.offsetFromTop

      restoreRef.current = null
      if (offsetDelta !== 0) {
        setScrollTop(container, container.scrollTop + offsetDelta, 'auto')
      }
    }
  }, [channel.id, messages, effectiveUnreadAnchorId, unreadScrollTo])

  useEffect(() => {
    if (!unreadScrollTo || !effectiveUnreadAnchorId || !messages.length || unreadRestoreCompletedRef.current) {
      return
    }

    const container = scrollRef.current
    if (!container) {
      return
    }

    const unreadDivider = getUnreadDividerElement(container)
    if (!unreadDivider) {
      return
    }

    unreadRestoreCompletedRef.current = true
    restoreRef.current = null
    viewIsAtLatestRef.current = false
    setIsViewingLatest(false)
    unreadDivider.scrollIntoView({
      behavior: 'auto',
      block: 'center',
      inline: 'nearest'
    })
  }, [messages, effectiveUnreadAnchorId, unreadScrollTo])

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
      if (!previousMessages.length && messages.length > 0 && !pendingLoadRef.current) {
        suppressedMessageChangesRef.current = 0
      }
      previousMessagesRef.current = messages
      syncLatestState()
      queueVisibleUnreadCheck()
      return
    }

    const previousIds = new Set(previousMessages.map((message) => getMessageLocalRef(message)))
    const addedMessages = messages.filter((message) => !previousIds.has(getMessageLocalRef(message)))

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
    if (isViewportLoadSettled(null)) {
      flushDeferredEdgeCheck()
    }
  }, [flushDeferredEdgeCheck, isViewportLoadSettled, loadingNextMessages, loadingPrevMessages])

  useEffect(() => {
    serverUnreadCountRef.current = channel.newMessageCount || 0
    optimisticReadUnreadCountRef.current = 0
    setRemainingUnreadCount(channel.newMessageCount || 0)
  }, [channel.id])

  useEffect(() => {
    const nextServerUnreadCount = channel.newMessageCount || 0
    const acknowledgedReadCount = Math.max(0, serverUnreadCountRef.current - nextServerUnreadCount)
    if (acknowledgedReadCount > 0) {
      optimisticReadUnreadCountRef.current = Math.max(0, optimisticReadUnreadCountRef.current - acknowledgedReadCount)
    }

    serverUnreadCountRef.current = nextServerUnreadCount
    syncRemainingUnreadCount(nextServerUnreadCount)
  }, [channel.newMessageCount, syncRemainingUnreadCount])

  useEffect(() => {
    const validKeys = new Set(messages.map((message) => message.id).filter(Boolean))
    visibleUnreadReportedRef.current.forEach((key) => {
      if (!validKeys.has(key)) {
        visibleUnreadReportedRef.current.delete(key)
      }
    })
  }, [messages])

  useEffect(() => {
    setStableUnreadAnchorId(unreadMessageId)
  }, [channel.id, unreadMessageId])

  useEffect(() => {
    if (
      !channel.lastDisplayedMessageId ||
      stableUnreadAnchorId !== channel.lastDisplayedMessageId ||
      !messages.length
    ) {
      return
    }

    const displayedAnchorIndex = messages.findIndex((message) => message.id === channel.lastDisplayedMessageId)
    const normalizedUnreadAnchor = messages.find(
      (message, index) => index > displayedAnchorIndex && isUnreadIncomingMessage(message)
    )

    if (normalizedUnreadAnchor?.id && normalizedUnreadAnchor.id !== stableUnreadAnchorId) {
      setStableUnreadAnchorId(normalizedUnreadAnchor.id)
    }
  }, [channel.lastDisplayedMessageId, messages, stableUnreadAnchorId])

  useEffect(() => {
    messagesIndexMapRef.current = {}
    pendingLoadRef.current?.resolve({ items: [] })
    pendingLoadRef.current = null
    previousMessagesRef.current = []

    if (channel.backToLinkedChannel && channel?.id) {
      const visibleMessages = getVisibleMessagesMap()
      const visibleMessagesIds = Object.values(visibleMessages)
        .filter((message) => !!message.id)
        .sort((left, right) => (BigInt(left.sortKey) < BigInt(right.sortKey) ? -1 : 1))
        .map((message) => message.id as string)
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
  }, [dispatch, channel?.id, channel.backToLinkedChannel, channel.isLinkedChannel, suppressNextMessageChange])

  useEffect(() => {
    if (!channel?.id || clearedSelectionChannelIdRef.current === channel.id) {
      return
    }

    clearedSelectionChannelIdRef.current = channel.id
    if (selectedMessagesMap?.size) {
      dispatch(clearSelectedMessagesAC())
    }
  }, [channel?.id, dispatch, selectedMessagesMap])

  useEffect(() => {
    setAllowEditDeleteIncomingMessage(allowEditDeleteIncomingMessage)
  }, [allowEditDeleteIncomingMessage])

  useEffect(() => {
    if (connectionStatus !== CONNECTION_STATUS.CONNECTED || !channel?.id) {
      return
    }

    const latestLocalRef = getMessageLocalRef(channel.lastMessage)
    const visibleAnchorId =
      lastVisibleAnchorIdRef.current && lastVisibleMessageIdRef.current !== latestLocalRef
        ? lastVisibleAnchorIdRef.current
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
  }, [channel?.id, connectionStatus, suppressNextMessageChange])

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
    const latestLocalRef = getMessageLocalRef(channel.lastMessage)
    const shouldShow =
      (!!latestLocalRef && lastVisibleMessageId !== latestLocalRef) ||
      (!isViewingLatest && (pendingNewestCount > 0 || !!scrollToMentionedMessage))
    if (showScrollToNewMessageButton !== shouldShow) {
      dispatch(showScrollToNewMessageButtonAC(shouldShow))
    }
  }, [
    channel.lastMessage,
    dispatch,
    isViewingLatest,
    lastVisibleMessageId,
    pendingNewestCount,
    scrollToMentionedMessage,
    showScrollToNewMessageButton
  ])

  useEffect(() => {
    if (
      !unreadScrollTo ||
      !messages.length ||
      loadingPrevMessages !== LOADING_STATE.LOADED ||
      loadingNextMessages !== LOADING_STATE.LOADED
    ) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      dispatch(setUnreadScrollToAC(false))
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [dispatch, loadingNextMessages, loadingPrevMessages, messages.length, unreadScrollTo])

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
      deferredEdgeCheckRef.current = false
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
    remainingUnreadCount,
    jumpToLatest,
    jumpToItem
  }
}
