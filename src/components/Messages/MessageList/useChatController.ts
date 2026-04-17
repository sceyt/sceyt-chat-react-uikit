import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  addMessagesAC,
  cancelWindowLoadAC,
  clearActivePaginationIntentAC,
  clearSelectedMessagesAC,
  loadAroundMessageAC,
  loadDefaultMessagesAC,
  loadLatestMessagesAC,
  loadMoreMessagesAC,
  loadNearUnreadAC,
  reloadActiveChannelAfterReconnectAC,
  refreshCacheAroundMessageAC,
  scrollToNewMessageAC,
  setActivePaginationIntentAC,
  setUnreadScrollToAC,
  showScrollToNewMessageButtonAC,
  setUnreadMessageIdAC,
  RestoreWindowPayload,
  setMessagesAC
} from '../../../store/message/actions'
import {
  compareMessagesForList,
  compareMessageIds,
  clearVisibleMessagesMap,
  getContiguousNextMessages,
  getContiguousPrevMessages,
  getClosestConfirmedMessageId,
  getFirstConfirmedMessage,
  getFirstConfirmedMessageId,
  getLastConfirmedMessage,
  getLatestCachedConfirmedMessageId,
  getLastConfirmedMessageId,
  getMessageLocalRef,
  getMessagesFromMap,
  getPendingMessagesFromMap,
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

export const PRELOAD_TRIGGER_PX = 5
const PRELOAD_RESET_PX = 50
export const LATEST_EDGE_GAP_PX = 5
const PINNED_TO_LATEST_PX = 96
const HIGHLIGHT_DURATION_MS = 1600
const DEFAULT_UNREAD_VISIBILITY_THRESHOLD = 0.5
const JUMP_SCROLL_LOCK_MS = 1800
const PRESERVE_ANCHOR_SCROLL_EPSILON_PX = 1
const SCROLL_IDLE_MS = 800
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
type ChannelRestoreWindow = {
  startId: string
  endId: string
  scrollTop: number
  anchorId: string
  prevCount: number
  nextCount: number
}

// Session-only per-channel restore state. Consumed on next successful re-entry.
const channelRestoreWindowMap = new Map<string, ChannelRestoreWindow>()

type RestoreState =
  | { mode: 'to-bottom' }
  | { mode: 'to-bottom-smooth' }
  | { mode: 'reveal-unread-separator' }
  | { mode: 'reveal-message'; messageId: string; smooth?: boolean }
  | { mode: 'restore-scroll-top'; scrollTop: number }
  | {
      mode: 'preserve-anchor-window'
      itemId: string
      offsetFromTop: number
      sourceScrollTop: number
    }
  | {
      mode: 'preserve-anchor'
      itemId: string
      offsetFromTop: number
      sourceScrollTop: number
      loadDirection: 'previous' | 'next'
      requestId: string
    }

type WindowLoadScope = null | 'around' | 'window'

type PendingLoadRequest = {
  previousIds: Set<string>
  resolve: (page: { items: IMessage[] }) => void
  hasSeenLoading: boolean
  allowNoLoading: boolean
}

type EdgeDirection = 'previous' | 'next'

type EdgePaginationRequest = {
  requestId: string
  direction: EdgeDirection
  anchorId: string
}

type PendingLatestJump = {
  channelId: string
  smooth: boolean
  needsServerSync: boolean
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
      nextItemStartsUnreadSection: boolean
      startsNewDay: boolean
      registerItemElement: (el: HTMLElement | null) => void
      ifLatestAndHasNotPreview: boolean
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
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
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
  if (!unreadAnchorId || !messages.length) {
    return -1
  }

  const unreadAnchorIndex = messages.findIndex((message) => message.id === unreadAnchorId)

  if (unreadAnchorIndex >= 0) {
    return unreadAnchorIndex + 1
  }

  const firstConfirmedMessageId = getFirstConfirmedMessageId(messages)
  const lastConfirmedMessageId = getLastConfirmedMessageId(messages)

  if (!firstConfirmedMessageId || !lastConfirmedMessageId) {
    return -1
  }

  if (compareMessageIds(unreadAnchorId, firstConfirmedMessageId) < 0) {
    return 0
  }

  if (compareMessageIds(unreadAnchorId, lastConfirmedMessageId) >= 0) {
    return -1
  }

  return messages.findIndex((message) => !!message.id && compareMessageIds(message.id, unreadAnchorId) > 0)
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
  const connectionStatusRef = useRef(connectionStatus)
  const previousConnectionStatusRef = useRef(connectionStatus)
  const scrollIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleScrollRef = useRef<() => void>(() => undefined)
  const loadingPrevMessagesRef = useRef(loadingPrevMessages)
  const loadingNextMessagesRef = useRef(loadingNextMessages)
  const pendingWindowLoadRef = useRef<PendingLoadRequest | null>(null)
  const pendingEdgeLoadRefs = useRef<Record<EdgeDirection, PendingLoadRequest | null>>({
    previous: null,
    next: null
  })
  const previousMessagesRef = useRef<IMessage[]>([])
  const suppressedMessageChangesRef = useRef<number>(0)
  const pendingVisibleUnreadFrameRef = useRef<number | null>(null)
  const clearedSelectionChannelIdRef = useRef<string>('')
  const visibleUnreadReportedRef = useRef<Set<string>>(new Set())
  const restoreRef = useRef<RestoreState | null>(null)
  const lastBootKeyRef = useRef<string | null>(null)
  const highlightedItemIdRef = useRef<string | null>(null)
  const highlightTimeoutRef = useRef<NodeJS.Timeout | number | null>(null)
  const unreadRestoreCompletedRef = useRef(false)
  const historyLoadArmedRef = useRef(true)
  const latestLoadArmedRef = useRef(true)
  const pendingNewestCountRef = useRef(0)
  const serverUnreadCountRef = useRef(channel.newMessageCount || 0)
  const optimisticReadUnreadCountRef = useRef(0)
  const viewIsAtLatestRef = useRef(true)
  const jumpLockUntilRef = useRef<number>(0)
  const jumpLockModeRef = useRef<null | 'latest' | 'item'>(null)
  const jumpUnlockTimeoutRef = useRef<NodeJS.Timeout | number | null>(null)
  const isJumping = useRef(false)
  const currentJumpIdRef = useRef(0)
  const jumpTargetIdRef = useRef<string | null>(null)
  const jumpObserverRef = useRef<IntersectionObserver | null>(null)
  const windowLoadScopeRef = useRef<WindowLoadScope>(null)
  const activeEdgeIntentRef = useRef<EdgeDirection | null>(null)
  const activeEdgeRequestRef = useRef<EdgePaginationRequest | null>(null)
  const cachedEdgeRequestRef = useRef<EdgePaginationRequest | null>(null)
  const edgeRequestSequenceRef = useRef(0)
  const activeChannelIdRef = useRef<string | null>(null)
  const lastScrollActivityAtRef = useRef(0)
  const jumpToLatestFrameRef = useRef<number | null>(null)
  const loadPrevFrameRef = useRef<number | null>(null)
  const loadNextFrameRef = useRef<number | null>(null)
  const pendingLatestJumpRef = useRef<PendingLatestJump | null>(null)

  const [isLoadingPrevious, setIsLoadingPrevious] = useState(false)
  const [isLoadingNext, setIsLoadingNext] = useState(false)
  const [isViewingLatest, setIsViewingLatest] = useState(true)
  const [isJumpingToItem, setIsJumpingToItem] = useState(false)
  const [lastVisibleMessageId, setLastVisibleMessageIdState] = useState('')
  const [pendingNewestCount, setPendingNewestCount] = useState(0)
  const [remainingUnreadCount, setRemainingUnreadCount] = useState(channel.newMessageCount || 0)
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null)

  loadingPrevMessagesRef.current = loadingPrevMessages
  loadingNextMessagesRef.current = loadingNextMessages
  const isPreviousLoading = loadingPrevMessages === LOADING_STATE.LOADING
  const isNextLoading = loadingNextMessages === LOADING_STATE.LOADING

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

  const consumeSuppressedMessageChange = useCallback((count = 1) => {
    suppressedMessageChangesRef.current = Math.max(0, suppressedMessageChangesRef.current - count)
  }, [])

  useEffect(() => {
    messagesRef.current = messages
    channelRef.current = channel
    connectionStatusRef.current = connectionStatus
  })

  const oldestConfirmedMessage = getFirstConfirmedMessage(messages)
  const newestConfirmedMessage = getLastConfirmedMessage(messages)
  const newestConfirmedMessageId = getLastConfirmedMessageId(messages)
  const hiddenOlderPendingHeadExists = useMemo(() => {
    const oldestVisibleMessage = messages[0]
    if (!oldestVisibleMessage || oldestVisibleMessage.id) {
      return false
    }

    const oldestVisibleRef = getMessageLocalRef(oldestVisibleMessage)
    if (!oldestVisibleRef) {
      return false
    }

    const sortedLocalMessages = Object.values(getMessagesFromMap(channel.id) || {}).sort(compareMessagesForList)
    const oldestVisibleIndex = sortedLocalMessages.findIndex(
      (message) => getMessageLocalRef(message) === oldestVisibleRef
    )

    return oldestVisibleIndex > 0
  }, [channel.id, messages])
  const hasPrevious =
    hasPrevMessages ||
    (oldestConfirmedMessage ? hasPrevContiguousInMap(channel.id, oldestConfirmedMessage) : false) ||
    hiddenOlderPendingHeadExists
  const hiddenPendingTailExists = useMemo(() => {
    const pendingMessages = getPendingMessagesFromMap(channel.id)
    if (!pendingMessages.length) {
      return false
    }

    const visibleMessageRefs = new Set(messages.map((message) => getMessageLocalRef(message)).filter(Boolean))
    return pendingMessages.some((message) => !visibleMessageRefs.has(getMessageLocalRef(message)))
  }, [channel.id, messages])
  const hasNext =
    hasNextMessages ||
    (newestConfirmedMessage ? hasNextContiguousInMap(channel.id, newestConfirmedMessage) : false) ||
    (newestConfirmedMessageId && channel.lastMessage?.id
      ? compareMessageIds(channel.lastMessage.id, newestConfirmedMessageId) > 0
      : false) ||
    hiddenPendingTailExists
  const isScrollInteractionActive = useCallback(() => Date.now() - lastScrollActivityAtRef.current < SCROLL_IDLE_MS, [])
  const clearScrollIdleTimer = useCallback(() => {
    if (scrollIdleTimerRef.current !== null) {
      clearTimeout(scrollIdleTimerRef.current)
      scrollIdleTimerRef.current = null
    }
  }, [])

  const isLatestJumpLocked = useCallback(
    () => jumpLockModeRef.current === 'latest' && (isJumping.current || Date.now() < jumpLockUntilRef.current),
    []
  )

  const captureWindowPreserveAnchor = useCallback(() => {
    if (isLatestJumpLocked()) {
      return
    }

    if (restoreRef.current?.mode === 'to-bottom' || restoreRef.current?.mode === 'to-bottom-smooth') {
      return
    }

    const container = scrollRef.current
    if (!container) {
      return
    }

    const anchor = getTopViewportAnchor(container, itemElementsRef.current)
    if (!anchor) {
      return
    }

    restoreRef.current = {
      mode: 'preserve-anchor-window',
      itemId: anchor.itemId,
      offsetFromTop: anchor.offsetFromTop,
      sourceScrollTop: container.scrollTop
    }
  }, [isLatestJumpLocked])

  const syncLatestState = useCallback(() => {
    const nextIsViewingLatest = !hasNext && isPinnedToLatest(scrollRef.current)
    viewIsAtLatestRef.current = nextIsViewingLatest
    setIsViewingLatest(nextIsViewingLatest)
  }, [hasNext])

  const setHighlight = useCallback((itemId: string | null) => {
    highlightedItemIdRef.current = itemId
    setHighlightedItemId(itemId)

    if (highlightTimeoutRef.current !== null) {
      clearTimeout(highlightTimeoutRef.current)
      highlightTimeoutRef.current = null
    }

    if (!itemId) {
      return
    }

    highlightTimeoutRef.current = setTimeout(() => {
      highlightedItemIdRef.current = null
      setHighlightedItemId(null)
      highlightTimeoutRef.current = null
    }, HIGHLIGHT_DURATION_MS)
  }, [])

  const clearJumpBlur = useCallback(() => {
    if (jumpObserverRef.current) {
      jumpObserverRef.current.disconnect()
      jumpObserverRef.current = null
    }
    jumpTargetIdRef.current = null
    isJumping.current = false
    setIsJumpingToItem(false)
  }, [])

  const clearPendingLatestJump = useCallback(() => {
    pendingLatestJumpRef.current = null
  }, [])

  const clearJumpScrollingLock = useCallback(() => {
    jumpLockUntilRef.current = 0
    jumpLockModeRef.current = null
    historyLoadArmedRef.current = true
    latestLoadArmedRef.current = true

    if (jumpUnlockTimeoutRef.current !== null) {
      clearTimeout(jumpUnlockTimeoutRef.current)
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
        clearTimeout(jumpUnlockTimeoutRef.current)
      }

      historyLoadArmedRef.current = false
      latestLoadArmedRef.current = false
      jumpUnlockTimeoutRef.current = setTimeout(() => {
        clearJumpScrollingLock()
      }, lockDuration)
    },
    [clearJumpScrollingLock]
  )

  const queueVisibleUnreadCheck = useCallback(() => {
    if (pendingVisibleUnreadFrameRef.current !== null || unreadScrollTo) {
      return
    }

    pendingVisibleUnreadFrameRef.current = requestAnimationFrame(() => {
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
    const unreadStartIndex = getUnreadDividerIndex(messages, unreadMessageId)
    return messages.flatMap((message, index) => {
      const localRef = getMessageLocalRef(message)
      const prevMessage = index > 0 ? messages[index - 1] : null
      const nextMessage = index < messages.length - 1 ? messages[index + 1] : null
      const startsNewDay = !prevMessage || formatMessageDateLabel(prevMessage) !== formatMessageDateLabel(message)
      const isUnread = unreadStartIndex >= 0 && index >= unreadStartIndex && isUnreadIncomingMessage(message)
      const nextItemStartsUnreadSection = unreadStartIndex >= 0 && index + 1 === unreadStartIndex
      const result: TimelineItem[] = []
      const ifLatestAndHasNotPreview = (!hasPrevious || messages.length < 40) && index === 0

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
        nextItemStartsUnreadSection,
        startsNewDay,
        ifLatestAndHasNotPreview,
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
  }, [highlightedItemId, messages, unreadMessageId, hasPrevious])

  const createEdgeRequestId = useCallback(
    (direction: EdgeDirection) =>
      `${channelRef.current.id}:${direction}:${Date.now()}:${++edgeRequestSequenceRef.current}`,
    []
  )

  const isActiveEdgeRequestCurrent = useCallback((requestId: string, direction?: EdgeDirection) => {
    const activeRequest =
      activeEdgeRequestRef.current?.requestId === requestId
        ? activeEdgeRequestRef.current
        : cachedEdgeRequestRef.current?.requestId === requestId
          ? cachedEdgeRequestRef.current
          : null
    if (!activeRequest || activeRequest.requestId !== requestId) {
      return false
    }

    return !direction || activeRequest.direction === direction
  }, [])

  const clearPreserveAnchorForRequest = useCallback((requestId?: string) => {
    if (restoreRef.current?.mode !== 'preserve-anchor') {
      return
    }

    if (requestId && restoreRef.current.requestId !== requestId) {
      return
    }

    restoreRef.current = null
  }, [])

  const invalidateEdgeDirection = useCallback(
    (direction: EdgeDirection) => {
      if (activeEdgeIntentRef.current === direction) {
        activeEdgeIntentRef.current = null
      }

      const activeRequest = activeEdgeRequestRef.current
      if (activeRequest?.direction === direction) {
        clearPreserveAnchorForRequest(activeRequest.requestId)
        dispatch(clearActivePaginationIntentAC(activeRequest.requestId))
        activeEdgeRequestRef.current = null
      }

      const cachedRequest = cachedEdgeRequestRef.current
      if (cachedRequest?.direction === direction) {
        clearPreserveAnchorForRequest(cachedRequest.requestId)
        cachedEdgeRequestRef.current = null
      }
    },
    [clearPreserveAnchorForRequest, dispatch]
  )

  const resolvePendingWindowLoad = useCallback(() => {
    const request = pendingWindowLoadRef.current
    if (!request) {
      return
    }

    const isLoading =
      loadingPrevMessagesRef.current === LOADING_STATE.LOADING ||
      loadingNextMessagesRef.current === LOADING_STATE.LOADING

    if (isLoading) {
      request.hasSeenLoading = true
      return
    }

    const hasMessageSetChanged =
      request.previousIds.size !== messages.length ||
      messages.some((message) => !request.previousIds.has(getMessageLocalRef(message)))

    if (
      (!request.hasSeenLoading && !(request.allowNoLoading && hasMessageSetChanged)) ||
      !isViewportLoadSettled(windowLoadScopeRef.current)
    ) {
      return
    }

    pendingWindowLoadRef.current = null
    const nextItems = messages.filter((message) => !request.previousIds.has(getMessageLocalRef(message)))
    request.resolve({ items: nextItems })
  }, [isViewportLoadSettled, messages, loadingPrevMessages, loadingNextMessages])

  const resolvePendingEdgeLoad = useCallback(
    (direction: EdgeDirection) => {
      const pendingRequest = pendingEdgeLoadRefs.current[direction]
      if (!pendingRequest) {
        return
      }

      const isLoading =
        loadingPrevMessagesRef.current === LOADING_STATE.LOADING ||
        loadingNextMessagesRef.current === LOADING_STATE.LOADING

      if (isLoading) {
        pendingRequest.hasSeenLoading = true
        return
      }

      if (!pendingRequest.hasSeenLoading || !isViewportLoadSettled(direction)) {
        return
      }

      pendingEdgeLoadRefs.current[direction] = null
      const nextItems = messages.filter((message) => !pendingRequest.previousIds.has(getMessageLocalRef(message)))
      pendingRequest.resolve({ items: nextItems })
    },
    [isViewportLoadSettled, messages, loadingPrevMessages, loadingNextMessages]
  )

  useEffect(() => {
    resolvePendingWindowLoad()
    resolvePendingEdgeLoad('previous')
    resolvePendingEdgeLoad('next')
  }, [resolvePendingEdgeLoad, resolvePendingWindowLoad])

  const beginWindowPagedRequest = useCallback(
    (dispatchAction: () => void, options?: { allowNoLoading?: boolean }) =>
      new Promise<{ items: IMessage[] }>((resolve) => {
        pendingWindowLoadRef.current = {
          previousIds: new Set(messagesRef.current.map((message) => getMessageLocalRef(message))),
          resolve,
          hasSeenLoading: false,
          allowNoLoading: !!options?.allowNoLoading
        }
        suppressNextMessageChange()
        dispatchAction()
      }),
    [suppressNextMessageChange]
  )

  const beginEdgePagedRequest = useCallback(
    (direction: EdgeDirection, dispatchAction: () => void) =>
      new Promise<{ items: IMessage[] }>((resolve) => {
        pendingEdgeLoadRefs.current[direction] = {
          previousIds: new Set(messagesRef.current.map((message) => getMessageLocalRef(message))),
          resolve,
          hasSeenLoading: false,
          allowNoLoading: false
        }
        suppressNextMessageChange()
        dispatchAction()
      }),
    [suppressNextMessageChange]
  )

  const getCachedPreviousMessages = useCallback(
    (fromMessage: IMessage) => {
      if (fromMessage.id) {
        return getContiguousPrevMessages(channel.id, fromMessage, LOAD_MAX_MESSAGE_COUNT)
      }

      const fromLocalRef = getMessageLocalRef(fromMessage)
      if (!fromLocalRef) {
        return []
      }

      const sortedLocalMessages = Object.values(getMessagesFromMap(channel.id) || {}).sort(compareMessagesForList)
      const fromIndex = sortedLocalMessages.findIndex((message) => getMessageLocalRef(message) === fromLocalRef)
      if (fromIndex <= 0) {
        return []
      }

      return sortedLocalMessages.slice(Math.max(0, fromIndex - LOAD_MAX_MESSAGE_COUNT), fromIndex)
    },
    [channel.id]
  )

  const jumpToLatest = useCallback(
    async (smooth = true) => {
      clearScrollIdleTimer()
      isJumping.current = true
      lockJumpScrolling(smooth, 'latest')
      invalidateEdgeDirection('previous')
      invalidateEdgeDirection('next')
      restoreRef.current = null
      pendingNewestCountRef.current = 0
      setPendingNewestCount(0)
      const container = scrollRef.current
      const currentChannelId = channelRef.current?.id
      const pendingLatestServerSync =
        pendingLatestJumpRef.current?.channelId === currentChannelId && pendingLatestJumpRef.current?.needsServerSync

      if (!currentChannelId) {
        clearPendingLatestJump()
        if (!container) {
          return
        }
        viewIsAtLatestRef.current = true
        setIsViewingLatest(true)
        scrollToLatestEdge(container, smooth ? 'smooth' : 'auto')
        dispatch(showScrollToNewMessageButtonAC(false))
        return
      }

      const cachedLatestConfirmedMessageId = getLatestCachedConfirmedMessageId(currentChannelId)
      const currentLatestMessageId = channelRef.current?.lastMessage?.id || ''
      const needsServerSync =
        !!currentLatestMessageId &&
        (!cachedLatestConfirmedMessageId ||
          compareMessageIds(cachedLatestConfirmedMessageId, currentLatestMessageId) < 0)

      if (!hasNext && container && !pendingLatestServerSync) {
        clearPendingLatestJump()
        viewIsAtLatestRef.current = true
        setIsViewingLatest(true)
        scrollToLatestEdge(container, smooth ? 'smooth' : 'auto')
        dispatch(showScrollToNewMessageButtonAC(false))
        return
      }

      if (connectionStatus === CONNECTION_STATUS.CONNECTED) {
        clearPendingLatestJump()
      } else {
        pendingLatestJumpRef.current = {
          channelId: currentChannelId,
          smooth,
          needsServerSync
        }
      }

      restoreRef.current = smooth ? { mode: 'to-bottom-smooth' } : { mode: 'to-bottom' }

      await beginWindowPagedRequest(
        () => {
          if (connectionStatus === CONNECTION_STATUS.CONNECTED) {
            dispatch(loadLatestMessagesAC(channelRef.current))
            return
          }

          dispatch(loadDefaultMessagesAC(channelRef.current))
        },
        { allowNoLoading: connectionStatus !== CONNECTION_STATUS.CONNECTED }
      )

      dispatch(showScrollToNewMessageButtonAC(false))

      const latestContainer = scrollRef.current
      if (!latestContainer) {
        return
      }

      viewIsAtLatestRef.current = true
      setIsViewingLatest(true)
      if (jumpToLatestFrameRef.current !== null) {
        cancelAnimationFrame(jumpToLatestFrameRef.current)
      }
      jumpToLatestFrameRef.current = requestAnimationFrame(() => {
        jumpToLatestFrameRef.current = null
        const renderedContainer = scrollRef.current
        if (!renderedContainer) {
          return
        }
        scrollToLatestEdge(renderedContainer, smooth ? 'smooth' : 'auto')
      })
    },
    [
      beginWindowPagedRequest,
      clearPendingLatestJump,
      clearScrollIdleTimer,
      connectionStatus,
      dispatch,
      hasNext,
      invalidateEdgeDirection,
      lockJumpScrolling,
      suppressNextMessageChange
    ]
  )

  const jumpToItem = useCallback(
    async (itemId: string, smooth = true) => {
      // Cancel any in-progress jump before starting a new one
      if (pendingWindowLoadRef.current) {
        dispatch(cancelWindowLoadAC())
        pendingWindowLoadRef.current.resolve({ items: [] })
        pendingWindowLoadRef.current = null
        clearJumpBlur()
      }
      const length = messagesRef.current?.length
      const isLoaded = messagesRef.current.some(
        (message, index) => index < length - 10 && index > 10 && getMessageLocalRef(message) === itemId
      )
      setTimeout(
        async () => {
          clearPendingLatestJump()
          const jumpId = ++currentJumpIdRef.current
          isJumping.current = true
          invalidateEdgeDirection('previous')
          invalidateEdgeDirection('next')
          restoreRef.current = {
            mode: 'reveal-message',
            messageId: itemId,
            smooth
          }

          if (isLoaded) {
            const container = scrollRef.current
            const target = container ? getItemElement(container, itemId) : null
            if (container && target) {
              lockJumpScrolling(smooth, 'item')
              restoreRef.current = null
              viewIsAtLatestRef.current = false
              setIsViewingLatest(false)
              scrollItemIntoView(container, target, smooth, true)
              clearJumpBlur()
            }
            setHighlight(itemId)
            return
          }

          if (!channelRef.current.id) {
            return
          }

          windowLoadScopeRef.current = 'around'
          setIsLoadingPrevious(true)
          setIsLoadingNext(true)
          jumpTargetIdRef.current = itemId
          setIsJumpingToItem(true)

          try {
            await delay(20)
            const timeout = setTimeout(() => {
              if (pendingWindowLoadRef.current) {
                dispatch(cancelWindowLoadAC())
                pendingWindowLoadRef.current.resolve({ items: [] })
                pendingWindowLoadRef.current = null
                windowLoadScopeRef.current = null
                setIsJumpingToItem(false)
              }
              // Cancel the saga so its finally block runs and sets LOADED,
              // clearing the Redux loading state that drives the visible spinner.
            }, 4000)
            await beginWindowPagedRequest(
              () => {
                dispatch(loadAroundMessageAC(channelRef.current, itemId))
              },
              { allowNoLoading: true }
            )
            clearTimeout(timeout)
            // A newer jump has already taken over — don't continue
            if (jumpId !== currentJumpIdRef.current) {
              setIsJumpingToItem(false)
              windowLoadScopeRef.current = null
              clearJumpBlur()
              return
            }

            windowLoadScopeRef.current = null
            setHighlight(itemId)
          } finally {
            // Only reset loading indicators if no newer jump has claimed them.
            // isJumpingToItem and isJumping.current are cleared by the
            // IntersectionObserver once the target element becomes visible.
            if (jumpId === currentJumpIdRef.current) {
              lockJumpScrolling(smooth, 'item')
              windowLoadScopeRef.current = null
              setIsLoadingPrevious(false)
              setIsLoadingNext(false)
            }
          }
        },
        isLoaded ? 0 : 50
      )
    },
    [
      beginWindowPagedRequest,
      clearJumpBlur,
      clearPendingLatestJump,
      dispatch,
      invalidateEdgeDirection,
      lockJumpScrolling,
      setHighlight
    ]
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
    async (beforeId: string, requestId: string) => {
      if (
        !channel.id ||
        scrollToMentionedMessage ||
        scrollToNewMessage.scrollToBottom ||
        isPreviousLoading ||
        connectionStatus !== CONNECTION_STATUS.CONNECTED
      ) {
        return { items: [] }
      }

      dispatch(setActivePaginationIntentAC(channel.id, 'prev', requestId, beforeId))
      return beginEdgePagedRequest('previous', () => {
        dispatch(
          loadMoreMessagesAC(
            channel.id,
            LOAD_MAX_MESSAGE_COUNT,
            MESSAGE_LOAD_DIRECTION.PREV,
            beforeId,
            hasPrevMessages,
            requestId
          )
        )
      })
    },
    [
      beginEdgePagedRequest,
      channel.id,
      connectionStatus,
      dispatch,
      hasPrevMessages,
      isPreviousLoading,
      scrollToMentionedMessage,
      scrollToNewMessage.scrollToBottom
    ]
  )

  const loadNext = useCallback(
    async (afterId: string, requestId: string) => {
      if (
        !channel.id ||
        scrollToMentionedMessage ||
        scrollToNewMessage.scrollToBottom ||
        isNextLoading ||
        connectionStatus !== CONNECTION_STATUS.CONNECTED
      ) {
        return { items: [] }
      }

      dispatch(setActivePaginationIntentAC(channel.id, 'next', requestId, afterId))
      return beginEdgePagedRequest('next', () => {
        const channelLastMsgId = channelRef.current?.lastMessage?.id
        const effectiveHasNext =
          hasNextMessages || (!!channelLastMsgId && compareMessageIds(channelLastMsgId, afterId) > 0)
        dispatch(
          loadMoreMessagesAC(
            channel.id,
            LOAD_MAX_MESSAGE_COUNT,
            MESSAGE_LOAD_DIRECTION.NEXT,
            afterId,
            effectiveHasNext,
            requestId
          )
        )
      })
    },
    [
      beginEdgePagedRequest,
      channel.id,
      connectionStatus,
      dispatch,
      hasNextMessages,
      isNextLoading,
      scrollToMentionedMessage,
      scrollToNewMessage.scrollToBottom
    ]
  )

  const loadPreviousItems = useCallback(async () => {
    if (isJumping.current) {
      return
    }
    clearPendingLatestJump()
    const oldestVisibleMessage = messages[0]
    const oldestVisibleLocalRef = getMessageLocalRef(oldestVisibleMessage)
    const oldestVisibleId = getFirstConfirmedMessageId(messages)
    if (!oldestVisibleMessage || !hasPrevious || windowLoadScopeRef.current) {
      return
    }

    const requestId = createEdgeRequestId('previous')
    activeEdgeIntentRef.current = 'previous'
    const cachedPreviousMessages = getCachedPreviousMessages(oldestVisibleMessage)
    if (cachedPreviousMessages.length > 0) {
      const container = scrollRef.current
      const anchor = container ? getTopViewportAnchor(container, itemElementsRef.current) : null
      if (anchor && container) {
        cachedEdgeRequestRef.current = {
          requestId,
          direction: 'previous',
          anchorId: oldestVisibleLocalRef || oldestVisibleId || ''
        }
        restoreRef.current = {
          mode: 'preserve-anchor',
          itemId: anchor.itemId,
          offsetFromTop: anchor.offsetFromTop,
          sourceScrollTop: container.scrollTop,
          loadDirection: 'previous',
          requestId
        }
      } else {
        cachedEdgeRequestRef.current = null
      }

      suppressNextMessageChange()
      dispatch(addMessagesAC(cachedPreviousMessages, MESSAGE_LOAD_DIRECTION.PREV))
      historyLoadArmedRef.current = true
      if (loadPrevFrameRef.current !== null) {
        cancelAnimationFrame(loadPrevFrameRef.current)
      }
      loadPrevFrameRef.current = requestAnimationFrame(() => {
        loadPrevFrameRef.current = null
        handleScrollRef.current()
      })
      return
    }

    if (!oldestVisibleId) {
      activeEdgeIntentRef.current = null
      historyLoadArmedRef.current = true
      return
    }

    activeEdgeRequestRef.current = {
      requestId,
      direction: 'previous',
      anchorId: oldestVisibleId
    }

    const container = scrollRef.current
    if (container) {
      const anchor = getTopViewportAnchor(container, itemElementsRef.current)
      if (anchor) {
        restoreRef.current = {
          mode: 'preserve-anchor',
          itemId: anchor.itemId,
          offsetFromTop: anchor.offsetFromTop,
          sourceScrollTop: container.scrollTop,
          loadDirection: 'previous',
          requestId
        }
      }
    }

    setIsLoadingPrevious(true)
    try {
      const result = await loadPrevious(oldestVisibleId, requestId)
      if (!result.items.length && isActiveEdgeRequestCurrent(requestId, 'previous')) {
        clearPreserveAnchorForRequest(requestId)
      }
    } finally {
      const isCurrentRequest = isActiveEdgeRequestCurrent(requestId, 'previous')
      if (isCurrentRequest) {
        dispatch(clearActivePaginationIntentAC(requestId))
        activeEdgeRequestRef.current = null
      } else {
        consumeSuppressedMessageChange()
      }
      historyLoadArmedRef.current = true
      if (loadPrevFrameRef.current !== null) {
        cancelAnimationFrame(loadPrevFrameRef.current)
      }
      loadPrevFrameRef.current = requestAnimationFrame(() => {
        loadPrevFrameRef.current = null
        handleScrollRef.current()
      })
      setIsLoadingPrevious(false)
    }
  }, [
    channel.id,
    clearPreserveAnchorForRequest,
    consumeSuppressedMessageChange,
    createEdgeRequestId,
    clearPendingLatestJump,
    dispatch,
    getCachedPreviousMessages,
    suppressNextMessageChange,
    hasNext,
    hasPrevious,
    isActiveEdgeRequestCurrent,
    isLoadingPrevious,
    loadPrevious,
    messages
  ])

  const loadNextItems = useCallback(async () => {
    if (isJumping.current) {
      return
    }
    clearPendingLatestJump()
    const newestVisibleMessage = messages[messages.length - 1]
    const newestVisibleMessageRef = getMessageLocalRef(newestVisibleMessage)
    const newestVisibleConfirmedId = getLastConfirmedMessageId(messages)
    if (!newestVisibleMessage || !hasNext || windowLoadScopeRef.current) {
      return
    }

    const requestId = createEdgeRequestId('next')
    activeEdgeIntentRef.current = 'next'
    const cachedNextMessages = getContiguousNextMessages(channel.id, newestVisibleMessage, LOAD_MAX_MESSAGE_COUNT, true)
    if (cachedNextMessages.length > 0) {
      const container = scrollRef.current
      const anchor = container ? getTopViewportAnchor(container, itemElementsRef.current) : null
      if (anchor && container) {
        cachedEdgeRequestRef.current = {
          requestId,
          direction: 'next',
          anchorId: newestVisibleMessageRef
        }
        restoreRef.current = {
          mode: 'preserve-anchor',
          itemId: anchor.itemId,
          offsetFromTop: anchor.offsetFromTop,
          sourceScrollTop: container.scrollTop,
          loadDirection: 'next',
          requestId
        }
      } else {
        cachedEdgeRequestRef.current = null
      }

      suppressNextMessageChange()
      dispatch(addMessagesAC(cachedNextMessages, MESSAGE_LOAD_DIRECTION.NEXT))
      latestLoadArmedRef.current = true
      if (loadNextFrameRef.current !== null) {
        cancelAnimationFrame(loadNextFrameRef.current)
      }
      loadNextFrameRef.current = requestAnimationFrame(() => {
        loadNextFrameRef.current = null
        handleScrollRef.current()
      })
      return
    }

    if (!newestVisibleConfirmedId) {
      activeEdgeIntentRef.current = null
      latestLoadArmedRef.current = true
      return
    }

    activeEdgeRequestRef.current = {
      requestId,
      direction: 'next',
      anchorId: newestVisibleMessageRef || newestVisibleConfirmedId
    }

    const container = scrollRef.current
    if (container) {
      const anchor = getTopViewportAnchor(container, itemElementsRef.current)
      if (anchor) {
        restoreRef.current = {
          mode: 'preserve-anchor',
          itemId: anchor.itemId,
          offsetFromTop: anchor.offsetFromTop,
          sourceScrollTop: container.scrollTop,
          loadDirection: 'next',
          requestId
        }
      }
    }

    setIsLoadingNext(true)
    try {
      const result = await loadNext(newestVisibleConfirmedId, requestId)
      if (!result.items.length && isActiveEdgeRequestCurrent(requestId, 'next')) {
        clearPreserveAnchorForRequest(requestId)
      }
    } finally {
      const isCurrentRequest = isActiveEdgeRequestCurrent(requestId, 'next')
      if (isCurrentRequest) {
        dispatch(clearActivePaginationIntentAC(requestId))
        activeEdgeRequestRef.current = null
      } else {
        consumeSuppressedMessageChange()
      }
      latestLoadArmedRef.current = true
      if (loadNextFrameRef.current !== null) {
        cancelAnimationFrame(loadNextFrameRef.current)
      }
      loadNextFrameRef.current = requestAnimationFrame(() => {
        loadNextFrameRef.current = null
        handleScrollRef.current()
      })
      setIsLoadingNext(false)
    }
  }, [
    channel.id,
    clearPreserveAnchorForRequest,
    consumeSuppressedMessageChange,
    createEdgeRequestId,
    clearPendingLatestJump,
    dispatch,
    suppressNextMessageChange,
    hasNext,
    hasPrevious,
    isActiveEdgeRequestCurrent,
    isLoadingNext,
    loadNext,
    messages
  ])

  const handleTimelineScroll = useCallback(() => {
    const container = scrollRef.current
    if (!container) {
      return
    }

    lastScrollActivityAtRef.current = Date.now()

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

    const pendingRestore =
      restoreRef.current?.mode === 'preserve-anchor' || restoreRef.current?.mode === 'preserve-anchor-window'
        ? restoreRef.current
        : null
    if (
      pendingRestore &&
      Math.abs(container.scrollTop - pendingRestore.sourceScrollTop) > PRESERVE_ANCHOR_SCROLL_EPSILON_PX &&
      (pendingRestore.mode === 'preserve-anchor-window' ||
        (pendingRestore.mode === 'preserve-anchor' && isActiveEdgeRequestCurrent(pendingRestore.requestId)))
    ) {
      const currentAnchor = getTopViewportAnchor(container, itemElementsRef.current)
      restoreRef.current = currentAnchor
        ? pendingRestore.mode === 'preserve-anchor-window'
          ? {
              mode: 'preserve-anchor-window',
              itemId: currentAnchor.itemId,
              offsetFromTop: currentAnchor.offsetFromTop,
              sourceScrollTop: container.scrollTop
            }
          : {
              mode: 'preserve-anchor',
              itemId: currentAnchor.itemId,
              offsetFromTop: currentAnchor.offsetFromTop,
              sourceScrollTop: container.scrollTop,
              loadDirection: pendingRestore.loadDirection,
              requestId: pendingRestore.requestId
            }
        : null
    }

    syncLatestState()
    queueVisibleUnreadCheck()

    const maxScrollTop = getMaxScrollTop(container)
    if (container.scrollTop > maxScrollTop - LATEST_EDGE_GAP_PX) {
      setScrollTop(container, maxScrollTop - LATEST_EDGE_GAP_PX)
    }
    const distanceFromHistory = maxScrollTop - container.scrollTop
    const historyTriggered = distanceFromHistory <= PRELOAD_TRIGGER_PX && hasPrevious
    const latestTriggered = container.scrollTop <= PRELOAD_TRIGGER_PX + LATEST_EDGE_GAP_PX && hasNext

    if (distanceFromHistory > PRELOAD_RESET_PX) {
      historyLoadArmedRef.current = true
      invalidateEdgeDirection('previous')
    }
    if (container.scrollTop > PRELOAD_RESET_PX) {
      latestLoadArmedRef.current = true
      invalidateEdgeDirection('next')
    }

    if (windowLoadScopeRef.current) {
      return
    }

    if (historyTriggered) {
      if (activeEdgeRequestRef.current?.direction === 'next' || cachedEdgeRequestRef.current?.direction === 'next') {
        invalidateEdgeDirection('next')
      }
      activeEdgeIntentRef.current = 'previous'
      if (historyLoadArmedRef.current) {
        historyLoadArmedRef.current = false
        loadPreviousItems()
        return
      }
    } else if (latestTriggered) {
      if (
        activeEdgeRequestRef.current?.direction === 'previous' ||
        cachedEdgeRequestRef.current?.direction === 'previous'
      ) {
        invalidateEdgeDirection('previous')
      }
      activeEdgeIntentRef.current = 'next'
      if (latestLoadArmedRef.current) {
        latestLoadArmedRef.current = false
        loadNextItems()
        return
      }
    }

    // Scroll-idle: refresh cached messages around the visible anchor when not at the latest window
    clearScrollIdleTimer()
    if (!viewIsAtLatestRef.current && !isLatestJumpLocked()) {
      const scheduledChannelId = channelRef.current.id
      const scheduledContainer = container
      scrollIdleTimerRef.current = setTimeout(() => {
        scrollIdleTimerRef.current = null
        if (windowLoadScopeRef.current) return
        if (connectionStatusRef.current !== CONNECTION_STATUS.CONNECTED) return
        if (scheduledChannelId !== channelRef.current.id) return
        if (scheduledContainer !== scrollRef.current) return
        if (viewIsAtLatestRef.current) return
        if (isLatestJumpLocked()) return
        const confirmedMessages = messagesRef.current.filter((message) => !!message.id)
        const centerAnchorId =
          getClosestConfirmedMessageId(confirmedMessages, Math.floor(confirmedMessages.length / 2), 'nearest') ||
          lastVisibleAnchorIdRef.current
        const anchorId = centerAnchorId
        if (!anchorId) return
        captureWindowPreserveAnchor()
        if (isLatestJumpLocked()) return
        dispatch(refreshCacheAroundMessageAC(channelRef.current.id, anchorId, true))
      }, SCROLL_IDLE_MS)
    }
  }, [
    captureWindowPreserveAnchor,
    clearScrollIdleTimer,
    clearJumpScrollingLock,
    dispatch,
    hasNext,
    hasPrevious,
    invalidateEdgeDirection,
    isLatestJumpLocked,
    isActiveEdgeRequestCurrent,
    loadNextItems,
    loadPreviousItems,
    queueVisibleUnreadCheck,
    syncLatestState
  ])

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
  }, [channel?.id])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) {
      return
    }

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      if (isJumping.current || (jumpLockModeRef.current === 'item' && Date.now() < jumpLockUntilRef.current)) {
        return
      }
      el.scrollTop -= getWheelDelta(event, el)
      handleScrollRef.current()
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [channel?.id])

  useEffect(() => {
    if (activeChannelIdRef.current === null) {
      activeChannelIdRef.current = channel.id
      return
    }

    if (activeChannelIdRef.current === channel.id) {
      return
    }

    // Stop all active processes before switching to the new channel
    if (pendingVisibleUnreadFrameRef.current !== null) {
      cancelAnimationFrame(pendingVisibleUnreadFrameRef.current)
      pendingVisibleUnreadFrameRef.current = null
    }
    if (jumpToLatestFrameRef.current !== null) {
      cancelAnimationFrame(jumpToLatestFrameRef.current)
      jumpToLatestFrameRef.current = null
    }
    if (loadPrevFrameRef.current !== null) {
      cancelAnimationFrame(loadPrevFrameRef.current)
      loadPrevFrameRef.current = null
    }
    if (loadNextFrameRef.current !== null) {
      cancelAnimationFrame(loadNextFrameRef.current)
      loadNextFrameRef.current = null
    }
    if (highlightTimeoutRef.current !== null) {
      clearTimeout(highlightTimeoutRef.current)
      highlightTimeoutRef.current = null
    }
    if (jumpUnlockTimeoutRef.current !== null) {
      clearTimeout(jumpUnlockTimeoutRef.current)
      jumpUnlockTimeoutRef.current = null
    }
    isJumping.current = false
    currentJumpIdRef.current += 1

    activeChannelIdRef.current = channel.id
    lastBootKeyRef.current = null
    restoreRef.current = null
    windowLoadScopeRef.current = null
    activeEdgeIntentRef.current = null
    activeEdgeRequestRef.current = null
    cachedEdgeRequestRef.current = null
    lastVisibleAnchorIdRef.current = ''
    clearScrollIdleTimer()
    jumpLockUntilRef.current = 0
    historyLoadArmedRef.current = true
    latestLoadArmedRef.current = true
    unreadRestoreCompletedRef.current = false
    visibleUnreadReportedRef.current.clear()
    itemElementsRef.current.clear()
    previousMessagesRef.current = []
    suppressedMessageChangesRef.current = 0
    pendingLatestJumpRef.current = null
    pendingWindowLoadRef.current?.resolve({ items: [] })
    pendingWindowLoadRef.current = null
    pendingEdgeLoadRefs.current.previous?.resolve({ items: [] })
    pendingEdgeLoadRefs.current.next?.resolve({ items: [] })
    pendingEdgeLoadRefs.current.previous = null
    pendingEdgeLoadRefs.current.next = null
    pendingNewestCountRef.current = 0
    viewIsAtLatestRef.current = true
    jumpLockModeRef.current = null
    if (jumpObserverRef.current) {
      jumpObserverRef.current.disconnect()
      jumpObserverRef.current = null
    }
    jumpTargetIdRef.current = null
    setIsJumpingToItem(false)
    setLastVisibleMessageIdState('')
    setPendingNewestCount(0)
    setIsViewingLatest(true)
    setHighlightedItemId(null)
    highlightedItemIdRef.current = null
    dispatch(clearActivePaginationIntentAC())
    if (channel?.hidden) {
      dispatch(setMessagesAC([]))
    }
  }, [channel.id, clearScrollIdleTimer, dispatch])

  const departingChannelId = activeChannelIdRef.current
  if (departingChannelId) {
    const currentMessages = messagesRef.current
    const startId = getFirstConfirmedMessageId(currentMessages)
    const endId = getLastConfirmedMessageId(currentMessages)
    const anchorId = lastVisibleAnchorIdRef.current
    const scrollTop = scrollRef.current?.scrollTop ?? 0

    if (startId && endId && anchorId) {
      const confirmedMessages = currentMessages.filter((m) => !!m.id)
      const anchorIndex = confirmedMessages.findIndex((m) => m.id === anchorId)
      const prevCount = anchorIndex >= 0 ? anchorIndex : 0
      const nextCount = anchorIndex >= 0 ? confirmedMessages.length - anchorIndex - 1 : 0
      channelRestoreWindowMap.set(departingChannelId, {
        startId,
        endId,
        scrollTop,
        anchorId,
        prevCount,
        nextCount
      })
    }
  }
  useLayoutEffect(() => {
    const container = scrollRef.current
    if (!container || !messages.length) {
      return
    }

    // Saved-interval restore: apply raw scrollTop before the default boot logic can override it.
    if (restoreRef.current?.mode === 'restore-scroll-top') {
      const savedScrollTop = restoreRef.current.scrollTop
      if (!lastBootKeyRef.current) {
        lastBootKeyRef.current = `${channel.id}:${getMessageLocalRef(messages[0])}`
      }
      restoreRef.current = null
      viewIsAtLatestRef.current = false
      setIsViewingLatest(false)
      const maxScrollTop = getMaxScrollTop(container)
      setScrollTop(container, Math.min(savedScrollTop, maxScrollTop), 'auto')
      return
    }

    if (!lastBootKeyRef.current) {
      lastBootKeyRef.current = `${channel.id}:${getMessageLocalRef(messages[0])}`
      restoreRef.current =
        unreadScrollTo && unreadMessageId ? { mode: 'reveal-unread-separator' } : { mode: 'to-bottom' }
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

      if (jumpTargetIdRef.current === restoreState.messageId) {
        if (jumpObserverRef.current) {
          jumpObserverRef.current.disconnect()
        }
        const observer = new IntersectionObserver(
          (entries) => {
            if (entries.some((e) => e.isIntersecting)) {
              clearJumpBlur()
            }
          },
          { root: container, threshold: 0.1 }
        )
        jumpObserverRef.current = observer
        observer.observe(target)
      }
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

    if (restoreState.mode === 'preserve-anchor-window') {
      const anchorElement = getItemElement(container, restoreState.itemId)
      if (!anchorElement) {
        return
      }

      const containerRect = container.getBoundingClientRect()
      const anchorRect = anchorElement.getBoundingClientRect()
      const offsetDelta = anchorRect.top - containerRect.top - restoreState.offsetFromTop

      restoreRef.current = null
      if (offsetDelta !== 0) {
        setScrollTop(container, Math.max(LATEST_EDGE_GAP_PX, container.scrollTop - offsetDelta), 'auto')
      }
      return
    }

    if (restoreState.mode === 'preserve-anchor') {
      if (!isActiveEdgeRequestCurrent(restoreState.requestId, restoreState.loadDirection)) {
        restoreRef.current = null
        if (cachedEdgeRequestRef.current?.requestId === restoreState.requestId) {
          cachedEdgeRequestRef.current = null
        }
        return
      }

      const pendingEdgeLoad = pendingEdgeLoadRefs.current[restoreState.loadDirection]
      if (
        pendingEdgeLoad &&
        !messages.some((message) => !pendingEdgeLoad.previousIds.has(getMessageLocalRef(message)))
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
      if (cachedEdgeRequestRef.current?.requestId === restoreState.requestId) {
        cachedEdgeRequestRef.current = null
      }
      if (offsetDelta !== 0) {
        const nextScrollTop = Math.max(LATEST_EDGE_GAP_PX, container.scrollTop - offsetDelta)
        setScrollTop(container, nextScrollTop, 'auto')
      }
    }
  }, [
    channel.id,
    unreadMessageId,
    isActiveEdgeRequestCurrent,
    messages,
    unreadScrollTo,
    clearJumpBlur,
    hasNextMessages
  ])

  useEffect(() => {
    if (!unreadScrollTo || !unreadMessageId || !messages.length || unreadRestoreCompletedRef.current) {
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
  }, [messages, unreadMessageId, unreadScrollTo])

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
      if (
        !previousMessages.length &&
        messages.length > 0 &&
        !pendingWindowLoadRef.current &&
        !pendingEdgeLoadRefs.current.previous &&
        !pendingEdgeLoadRefs.current.next
      ) {
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
    serverUnreadCountRef.current = channel.newMessageCount || 0
    optimisticReadUnreadCountRef.current = 0
    setRemainingUnreadCount(channel.newMessageCount || 0)
    dispatch(setUnreadMessageIdAC(''))
  }, [channel.id])

  useEffect(() => {
    const nextServerUnreadCount = channel.newMessageCount || 0
    const previousServerUnreadCount = serverUnreadCountRef.current
    const acknowledgedReadCount = Math.max(0, previousServerUnreadCount - nextServerUnreadCount)
    if (acknowledgedReadCount > 0) {
      optimisticReadUnreadCountRef.current = Math.max(0, optimisticReadUnreadCountRef.current - acknowledgedReadCount)
    }

    if (
      nextServerUnreadCount > previousServerUnreadCount &&
      !unreadMessageId &&
      channel.lastDisplayedMessageId &&
      !viewIsAtLatestRef.current
    ) {
      dispatch(setUnreadMessageIdAC(channel.lastDisplayedMessageId))
    }

    serverUnreadCountRef.current = nextServerUnreadCount
    syncRemainingUnreadCount(nextServerUnreadCount)
  }, [channel.lastDisplayedMessageId, channel.newMessageCount, dispatch, syncRemainingUnreadCount, unreadMessageId])

  useEffect(() => {
    const validKeys = new Set(messages.map((message) => message.id).filter(Boolean))
    visibleUnreadReportedRef.current.forEach((key) => {
      if (!validKeys.has(key)) {
        visibleUnreadReportedRef.current.delete(key)
      }
    })
  }, [messages])

  useEffect(() => {
    messagesIndexMapRef.current = {}
    pendingWindowLoadRef.current?.resolve({ items: [] })
    pendingWindowLoadRef.current = null
    pendingEdgeLoadRefs.current.previous?.resolve({ items: [] })
    pendingEdgeLoadRefs.current.next?.resolve({ items: [] })
    pendingEdgeLoadRefs.current.previous = null
    pendingEdgeLoadRefs.current.next = null
    activeEdgeIntentRef.current = null
    activeEdgeRequestRef.current = null
    cachedEdgeRequestRef.current = null
    dispatch(clearActivePaginationIntentAC())
    previousMessagesRef.current = []

    if (!channel?.id) {
      return
    }

    // Priority 1: saved per-channel restore window (wins over all other boot paths)
    const savedRestoreWindow = channelRestoreWindowMap.get(channel.id)
    if (savedRestoreWindow) {
      if (!channel.isLinkedChannel) {
        clearVisibleMessagesMap()
      }
      if (channel.backToLinkedChannel) {
        restoreRef.current = { mode: 'restore-scroll-top', scrollTop: savedRestoreWindow.scrollTop }
        const restoreWindowPayload: RestoreWindowPayload = {
          startId: savedRestoreWindow.startId,
          endId: savedRestoreWindow.endId,
          anchorId: savedRestoreWindow.anchorId,
          prevCount: savedRestoreWindow.prevCount,
          nextCount: savedRestoreWindow.nextCount,
          preferCache: true
        }
        suppressNextMessageChange()
        dispatch(loadAroundMessageAC(channel, savedRestoreWindow.anchorId, undefined, restoreWindowPayload))
        return
      }
    }

    // Priority 2: linked-channel special return
    if (channel.backToLinkedChannel) {
      const visibleMessages = getVisibleMessagesMap()
      const visibleMessagesIds = Object.values(visibleMessages)
        .filter((message) => !!message.id)
        .sort((left, right) => (BigInt(left.sortKey) < BigInt(right.sortKey) ? -1 : 1))
        .map((message) => message.id as string)
      const messageId = visibleMessagesIds[visibleMessagesIds.length - 1]
      if (messageId) {
        suppressNextMessageChange()
        dispatch(loadAroundMessageAC(channel, messageId))
      }
      return
    }

    // Priority 3: unread boot; Priority 4: default/latest boot
    if (!channel.isLinkedChannel) {
      clearVisibleMessagesMap()
    }
    if (channel.newMessageCount && channel.lastDisplayedMessageId) {
      suppressNextMessageChange()
      dispatch(loadNearUnreadAC(channel))
    } else {
      suppressNextMessageChange()
      dispatch(loadDefaultMessagesAC(channel))
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
    const previousConnectionStatus = previousConnectionStatusRef.current
    previousConnectionStatusRef.current = connectionStatus

    if (
      connectionStatus !== CONNECTION_STATUS.CONNECTED ||
      previousConnectionStatus === CONNECTION_STATUS.CONNECTED ||
      !channel?.id
    ) {
      return
    }

    const pendingLatestJump = pendingLatestJumpRef.current
    if (pendingLatestJump?.channelId === channel.id && pendingLatestJump.needsServerSync) {
      jumpToLatest(pendingLatestJump.smooth).catch(() => undefined)
      return
    }

    const applyVisibleWindow = !isScrollInteractionActive()
    if (applyVisibleWindow && !isViewingLatest && lastVisibleAnchorIdRef.current) {
      captureWindowPreserveAnchor()
    }

    historyLoadArmedRef.current = true
    latestLoadArmedRef.current = true
    invalidateEdgeDirection('previous')
    suppressNextMessageChange()

    const isHistoryTopVisible = messagesRef.current[0]
      ? Object.values(getVisibleMessagesMap()).some(
          (visibleMessage) => visibleMessage.id === messagesRef.current[0]?.id
        )
      : false

    dispatch(
      reloadActiveChannelAfterReconnectAC(
        channel,
        lastVisibleAnchorIdRef.current || '',
        isViewingLatest,
        applyVisibleWindow,
        isHistoryTopVisible
      )
    )
  }, [
    captureWindowPreserveAnchor,
    channel?.id,
    connectionStatus,
    dispatch,
    hasPrevious,
    isScrollInteractionActive,
    isViewingLatest,
    jumpToLatest,
    suppressNextMessageChange
  ])

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

    const frameId = requestAnimationFrame(() => {
      dispatch(setUnreadScrollToAC(false))
    })

    return () => {
      cancelAnimationFrame(frameId)
    }
  }, [dispatch, loadingNextMessages, loadingPrevMessages, messages.length, unreadScrollTo])

  useEffect(
    () => () => {
      if (pendingVisibleUnreadFrameRef.current !== null) {
        cancelAnimationFrame(pendingVisibleUnreadFrameRef.current)
      }
      if (jumpToLatestFrameRef.current !== null) {
        cancelAnimationFrame(jumpToLatestFrameRef.current)
      }
      if (loadPrevFrameRef.current !== null) {
        cancelAnimationFrame(loadPrevFrameRef.current)
      }
      if (loadNextFrameRef.current !== null) {
        cancelAnimationFrame(loadNextFrameRef.current)
      }
      if (highlightTimeoutRef.current !== null) {
        clearTimeout(highlightTimeoutRef.current)
      }
      if (jumpUnlockTimeoutRef.current !== null) {
        clearTimeout(jumpUnlockTimeoutRef.current)
      }
      clearScrollIdleTimer()
      activeEdgeIntentRef.current = null
      activeEdgeRequestRef.current = null
      cachedEdgeRequestRef.current = null
      pendingWindowLoadRef.current?.resolve({ items: [] })
      pendingWindowLoadRef.current = null
      pendingEdgeLoadRefs.current.previous?.resolve({ items: [] })
      pendingEdgeLoadRefs.current.next?.resolve({ items: [] })
      pendingEdgeLoadRefs.current.previous = null
      pendingEdgeLoadRefs.current.next = null
    },
    [clearScrollIdleTimer]
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
    isJumpingToItem,
    pendingNewestCount,
    remainingUnreadCount,
    jumpToLatest,
    jumpToItem
  }
}
