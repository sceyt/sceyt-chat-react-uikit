import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  addMessagesAC,
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
  setMessagesHasNextAC,
  setMessagesHasPrevAC,
  setUnreadScrollToAC,
  showScrollToNewMessageButtonAC,
  setUnreadMessageIdAC
} from '../../../store/message/actions'
import {
  compareMessageIds,
  compareMessagesForList,
  clearVisibleMessagesMap,
  getContiguousNextMessages,
  getContiguousPrevMessages,
  getClosestConfirmedMessageId,
  getFirstConfirmedMessageId,
  getLastConfirmedMessageId,
  getMessageLocalRef,
  getVisibleMessagesMap,
  hasNextContiguousInMap,
  hasPrevContiguousInMap,
  LOAD_MAX_MESSAGE_COUNT,
  MESSAGES_MAX_PAGE_COUNT,
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
const MESSAGE_LIST_DEBUG_FLAG = '__SCEYT_DEBUG_MESSAGE_LIST__'

type RestoreState =
  | { mode: 'to-bottom' }
  | { mode: 'to-bottom-smooth' }
  | { mode: 'reveal-unread-separator' }
  | { mode: 'reveal-message'; messageId: string; smooth?: boolean }
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
}

type EdgeDirection = 'previous' | 'next'

type EdgePaginationRequest = {
  requestId: string
  direction: EdgeDirection
  anchorId: string
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

const isMessageListDebugEnabled = () =>
  typeof globalThis !== 'undefined' && Boolean((globalThis as Record<string, unknown>)[MESSAGE_LIST_DEBUG_FLAG])

const getMessageWindowDebugSummary = (messages: IMessage[]) => ({
  count: messages.length,
  confirmedCount: messages.filter((message) => !!message.id).length,
  firstConfirmedId: getFirstConfirmedMessageId(messages) || '',
  lastConfirmedId: getLastConfirmedMessageId(messages) || '',
  firstLocalRef: messages[0] ? getMessageLocalRef(messages[0]) : '',
  lastLocalRef: messages[messages.length - 1] ? getMessageLocalRef(messages[messages.length - 1]) : ''
})

const debugMessageListController = (scope: string, payload: Record<string, unknown>) => {
  if (!isMessageListDebugEnabled()) {
    return
  }

  console.log(`[MessageListDebug][controller] ${scope}`, JSON.stringify(payload))
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
  const debugPreviousMessagesRef = useRef<IMessage[]>([])
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
  const windowLoadScopeRef = useRef<WindowLoadScope>(null)
  const activeEdgeIntentRef = useRef<EdgeDirection | null>(null)
  const activeEdgeRequestRef = useRef<EdgePaginationRequest | null>(null)
  const cachedEdgeRequestRef = useRef<EdgePaginationRequest | null>(null)
  const edgeRequestSequenceRef = useRef(0)
  const activeChannelIdRef = useRef<string | null>(null)
  const lastScrollActivityAtRef = useRef(0)

  const [isLoadingPrevious, setIsLoadingPrevious] = useState(false)
  const [isLoadingNext, setIsLoadingNext] = useState(false)
  const [isViewingLatest, setIsViewingLatest] = useState(true)
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

  const oldestConfirmedMessageId = getFirstConfirmedMessageId(messages)
  const newestConfirmedMessageId = getLastConfirmedMessageId(messages)
  const hasPrevious =
    hasPrevMessages || (oldestConfirmedMessageId ? hasPrevContiguousInMap(channel.id, oldestConfirmedMessageId) : false)
  const hasNext =
    hasNextMessages || (newestConfirmedMessageId ? hasNextContiguousInMap(channel.id, newestConfirmedMessageId) : false)

  const isScrollInteractionActive = useCallback(() => Date.now() - lastScrollActivityAtRef.current < SCROLL_IDLE_MS, [])

  const captureWindowPreserveAnchor = useCallback(() => {
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
  }, [])

  const getCachedEdgeFlags = useCallback(
    (direction: EdgeDirection, cachedMessages: IMessage[]) => {
      const confirmedByRef = new Map<string, IMessage>()

      ;[...messagesRef.current, ...cachedMessages].forEach((message) => {
        if (!message.id) {
          return
        }
        confirmedByRef.set(getMessageLocalRef(message), message)
      })

      const nextConfirmedWindow = Array.from(confirmedByRef.values()).sort(compareMessagesForList)
      const trimmedConfirmedWindow =
        direction === 'previous'
          ? nextConfirmedWindow.slice(0, MESSAGES_MAX_PAGE_COUNT)
          : nextConfirmedWindow.slice(-MESSAGES_MAX_PAGE_COUNT)

      const nextFirstConfirmedId = getFirstConfirmedMessageId(trimmedConfirmedWindow)
      const nextLastConfirmedId = getLastConfirmedMessageId(trimmedConfirmedWindow)

      return {
        hasPrev:
          hasPrevMessages || (nextFirstConfirmedId ? hasPrevContiguousInMap(channel.id, nextFirstConfirmedId) : false),
        hasNext:
          hasNextMessages || (nextLastConfirmedId ? hasNextContiguousInMap(channel.id, nextLastConfirmedId) : false)
      }
    },
    [channel.id, hasNextMessages, hasPrevMessages]
  )

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
    const unreadStartIndex = getUnreadDividerIndex(messages, unreadMessageId)
    return messages.flatMap((message, index) => {
      const localRef = getMessageLocalRef(message)
      const prevMessage = index > 0 ? messages[index - 1] : null
      const nextMessage = index < messages.length - 1 ? messages[index + 1] : null
      const startsNewDay = !prevMessage || formatMessageDateLabel(prevMessage) !== formatMessageDateLabel(message)
      const isUnread = unreadStartIndex >= 0 && index >= unreadStartIndex && isUnreadIncomingMessage(message)
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
  }, [highlightedItemId, messages, unreadMessageId])

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
    if (!pendingWindowLoadRef.current || !isViewportLoadSettled(windowLoadScopeRef.current)) {
      return
    }

    const request = pendingWindowLoadRef.current
    pendingWindowLoadRef.current = null
    const nextItems = messages.filter((message) => !request.previousIds.has(getMessageLocalRef(message)))
    request.resolve({ items: nextItems })
  }, [isViewportLoadSettled, messages, loadingPrevMessages, loadingNextMessages])

  const resolvePendingEdgeLoad = useCallback(
    (direction: EdgeDirection) => {
      const pendingRequest = pendingEdgeLoadRefs.current[direction]
      if (!pendingRequest || !isViewportLoadSettled(direction)) {
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
    (dispatchAction: () => void) =>
      new Promise<{ items: IMessage[] }>((resolve) => {
        pendingWindowLoadRef.current = {
          previousIds: new Set(messagesRef.current.map((message) => getMessageLocalRef(message))),
          resolve
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
          resolve
        }
        suppressNextMessageChange()
        dispatchAction()
      }),
    [suppressNextMessageChange]
  )

  const jumpToLatest = useCallback(
    async (smooth = true) => {
      isJumping.current = true
      lockJumpScrolling(smooth, 'latest')
      invalidateEdgeDirection('previous')
      invalidateEdgeDirection('next')
      restoreRef.current = null
      pendingNewestCountRef.current = 0
      setPendingNewestCount(0)
      const container = scrollRef.current

      if (container) {
        viewIsAtLatestRef.current = true
        setIsViewingLatest(true)
        scrollToLatestEdge(container, smooth ? 'smooth' : 'auto')
      }

      if (channelRef.current?.id) {
        suppressNextMessageChange()
        windowLoadScopeRef.current = 'window'
        try {
          await beginWindowPagedRequest(() => {
            if (connectionStatus === CONNECTION_STATUS.CONNECTED) {
              dispatch(loadLatestMessagesAC(channelRef.current))
            } else {
              dispatch(loadDefaultMessagesAC(channelRef.current))
            }
          })
        } finally {
          windowLoadScopeRef.current = null
        }
        dispatch(showScrollToNewMessageButtonAC(false))

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
      beginWindowPagedRequest,
      connectionStatus,
      dispatch,
      hasNext,
      invalidateEdgeDirection,
      lockJumpScrolling,
      suppressNextMessageChange,
      syncLatestState
    ]
  )

  const jumpToItem = useCallback(
    async (itemId: string, smooth = true) => {
      lockJumpScrolling(smooth, 'item')
      invalidateEdgeDirection('previous')
      invalidateEdgeDirection('next')
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

      windowLoadScopeRef.current = 'around'
      setIsLoadingPrevious(true)
      setIsLoadingNext(true)

      try {
        await beginWindowPagedRequest(() => {
          dispatch(loadAroundMessageAC(channelRef.current, itemId, scrollToMessageHighlight, 'instant', false))
        })
        windowLoadScopeRef.current = null
        isJumping.current = true
        setHighlight(itemId)
      } finally {
        windowLoadScopeRef.current = null
        setIsLoadingPrevious(false)
        setIsLoadingNext(false)
      }
    },
    [
      beginWindowPagedRequest,
      dispatch,
      invalidateEdgeDirection,
      lockJumpScrolling,
      scrollToMessageHighlight,
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

  const applyCachedEdgePage = useCallback(
    (direction: EdgeDirection) => {
      if (!channel.id || scrollToMentionedMessage) {
        return false
      }

      const boundaryMessageId =
        direction === 'previous'
          ? getFirstConfirmedMessageId(messagesRef.current)
          : getLastConfirmedMessageId(messagesRef.current)

      if (!boundaryMessageId) {
        return false
      }

      const cachedMessages =
        direction === 'previous'
          ? getContiguousPrevMessages(channel.id, boundaryMessageId, LOAD_MAX_MESSAGE_COUNT)
          : getContiguousNextMessages(channel.id, boundaryMessageId, LOAD_MAX_MESSAGE_COUNT)

      if (!cachedMessages.length) {
        return false
      }

      const activeRequest = activeEdgeRequestRef.current?.direction === direction ? activeEdgeRequestRef.current : null
      const requestId = activeRequest?.requestId || createEdgeRequestId(direction)
      const container = scrollRef.current

      activeEdgeIntentRef.current = direction
      if (!activeRequest) {
        cachedEdgeRequestRef.current = {
          requestId,
          direction,
          anchorId: boundaryMessageId
        }
      }

      if (container) {
        const anchor = getTopViewportAnchor(container, itemElementsRef.current)
        if (anchor) {
          restoreRef.current = {
            mode: 'preserve-anchor',
            itemId: anchor.itemId,
            offsetFromTop: anchor.offsetFromTop,
            sourceScrollTop: container.scrollTop,
            loadDirection: direction,
            requestId
          }
        }
      }

      const nextFlags = getCachedEdgeFlags(direction, cachedMessages)

      suppressNextMessageChange()
      dispatch(
        addMessagesAC(
          JSON.parse(JSON.stringify(cachedMessages)),
          direction === 'previous' ? MESSAGE_LOAD_DIRECTION.PREV : MESSAGE_LOAD_DIRECTION.NEXT
        )
      )
      dispatch(setMessagesHasPrevAC(nextFlags.hasPrev))
      dispatch(setMessagesHasNextAC(nextFlags.hasNext))

      window.requestAnimationFrame(() => {
        if (direction === 'previous') {
          historyLoadArmedRef.current = true
        } else {
          latestLoadArmedRef.current = true
        }
        handleScrollRef.current()
      })

      return true
    },
    [channel.id, createEdgeRequestId, dispatch, getCachedEdgeFlags, scrollToMentionedMessage, suppressNextMessageChange]
  )

  const loadPrevious = useCallback(
    async (beforeId: string, requestId: string) => {
      if (!channel.id || scrollToMentionedMessage || scrollToNewMessage.scrollToBottom || isPreviousLoading) {
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
      dispatch,
      hasPrevMessages,
      isPreviousLoading,
      scrollToMentionedMessage,
      scrollToNewMessage.scrollToBottom
    ]
  )

  const loadNext = useCallback(
    async (afterId: string, requestId: string) => {
      if (!channel.id || scrollToMentionedMessage || scrollToNewMessage.scrollToBottom || isNextLoading) {
        return { items: [] }
      }

      dispatch(setActivePaginationIntentAC(channel.id, 'next', requestId, afterId))
      return beginEdgePagedRequest('next', () => {
        dispatch(
          loadMoreMessagesAC(
            channel.id,
            LOAD_MAX_MESSAGE_COUNT,
            MESSAGE_LOAD_DIRECTION.NEXT,
            afterId,
            hasNextMessages,
            requestId
          )
        )
      })
    },
    [
      beginEdgePagedRequest,
      channel.id,
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
    const oldestVisibleId = getFirstConfirmedMessageId(messages)
    if (!oldestVisibleId || !hasPrevious || windowLoadScopeRef.current) {
      return
    }

    if (applyCachedEdgePage('previous')) {
      return
    }

    if (isLoadingPrevious) {
      return
    }

    const requestId = createEdgeRequestId('previous')
    activeEdgeIntentRef.current = 'previous'
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
      debugMessageListController('paginate-prev:start', {
        channelId: channel.id,
        scrollTop: container.scrollTop,
        oldestVisibleId,
        hasPrevious,
        hasNext,
        anchor,
        window: getMessageWindowDebugSummary(messages)
      })
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
      window.requestAnimationFrame(() => {
        handleScrollRef.current()
      })
      setIsLoadingPrevious(false)
    }
  }, [
    applyCachedEdgePage,
    channel.id,
    clearPreserveAnchorForRequest,
    consumeSuppressedMessageChange,
    createEdgeRequestId,
    dispatch,
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
    const newestVisibleId = getLastConfirmedMessageId(messages)
    if (!newestVisibleId || !hasNext || windowLoadScopeRef.current) {
      return
    }

    if (applyCachedEdgePage('next')) {
      return
    }

    if (isLoadingNext) {
      return
    }

    const requestId = createEdgeRequestId('next')
    activeEdgeIntentRef.current = 'next'
    activeEdgeRequestRef.current = {
      requestId,
      direction: 'next',
      anchorId: newestVisibleId
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
      debugMessageListController('paginate-next:start', {
        channelId: channel.id,
        scrollTop: container.scrollTop,
        newestVisibleId,
        hasPrevious,
        hasNext,
        anchor,
        window: getMessageWindowDebugSummary(messages)
      })
    }

    setIsLoadingNext(true)
    try {
      const result = await loadNext(newestVisibleId, requestId)
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
      window.requestAnimationFrame(() => {
        handleScrollRef.current()
      })
      setIsLoadingNext(false)
    }
  }, [
    applyCachedEdgePage,
    channel.id,
    clearPreserveAnchorForRequest,
    consumeSuppressedMessageChange,
    createEdgeRequestId,
    dispatch,
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
    if (scrollIdleTimerRef.current !== null) {
      clearTimeout(scrollIdleTimerRef.current)
      scrollIdleTimerRef.current = null
    }
    if (!viewIsAtLatestRef.current) {
      scrollIdleTimerRef.current = setTimeout(() => {
        scrollIdleTimerRef.current = null
        if (windowLoadScopeRef.current) return
        if (connectionStatusRef.current !== CONNECTION_STATUS.CONNECTED) return
        const confirmedMessages = messagesRef.current.filter((message) => !!message.id)
        const centerAnchorId =
          getClosestConfirmedMessageId(confirmedMessages, Math.floor(confirmedMessages.length / 2), 'nearest') ||
          lastVisibleAnchorIdRef.current
        const anchorId = centerAnchorId
        if (!anchorId) return
        debugMessageListController('refresh-idle', {
          channelId: channelRef.current.id,
          anchorId,
          window: getMessageWindowDebugSummary(messagesRef.current)
        })
        captureWindowPreserveAnchor()
        dispatch(refreshCacheAroundMessageAC(channelRef.current.id, anchorId, true))
      }, SCROLL_IDLE_MS)
    }
  }, [
    captureWindowPreserveAnchor,
    clearJumpScrollingLock,
    dispatch,
    hasNext,
    hasPrevious,
    invalidateEdgeDirection,
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
    windowLoadScopeRef.current = null
    activeEdgeIntentRef.current = null
    activeEdgeRequestRef.current = null
    cachedEdgeRequestRef.current = null
    lastVisibleAnchorIdRef.current = ''
    if (scrollIdleTimerRef.current !== null) {
      clearTimeout(scrollIdleTimerRef.current)
      scrollIdleTimerRef.current = null
    }
    jumpLockUntilRef.current = 0
    historyLoadArmedRef.current = true
    latestLoadArmedRef.current = true
    unreadRestoreCompletedRef.current = false
    visibleUnreadReportedRef.current.clear()
    itemElementsRef.current.clear()
    previousMessagesRef.current = []
    suppressedMessageChangesRef.current = 0
    pendingWindowLoadRef.current?.resolve({ items: [] })
    pendingWindowLoadRef.current = null
    pendingEdgeLoadRefs.current.previous?.resolve({ items: [] })
    pendingEdgeLoadRefs.current.next?.resolve({ items: [] })
    pendingEdgeLoadRefs.current.previous = null
    pendingEdgeLoadRefs.current.next = null
    pendingNewestCountRef.current = 0
    viewIsAtLatestRef.current = true
    jumpLockModeRef.current = null
    setLastVisibleMessageIdState('')
    setPendingNewestCount(0)
    setIsViewingLatest(true)
    setHighlightedItemId(null)
    highlightedItemIdRef.current = null
    dispatch(clearActivePaginationIntentAC())
  }, [channel.id, dispatch])

  useLayoutEffect(() => {
    const container = scrollRef.current
    if (!container || !messages.length) {
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
        setScrollTop(container, Math.max(LATEST_EDGE_GAP_PX, container.scrollTop + offsetDelta), 'auto')
      }
      return
    }

    if (restoreState.mode === 'preserve-anchor') {
      if (!isActiveEdgeRequestCurrent(restoreState.requestId, restoreState.loadDirection)) {
        debugMessageListController('restore:skip-preserve-anchor', {
          channelId: channel.id,
          itemId: restoreState.itemId,
          requestId: restoreState.requestId,
          loadDirection: restoreState.loadDirection,
          activeEdgeRequest: activeEdgeRequestRef.current,
          window: getMessageWindowDebugSummary(messages)
        })
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
        const nextScrollTop = Math.max(LATEST_EDGE_GAP_PX, container.scrollTop + offsetDelta)
        debugMessageListController('restore:preserve-anchor', {
          channelId: channel.id,
          itemId: restoreState.itemId,
          sourceScrollTop: restoreState.sourceScrollTop,
          currentScrollTop: container.scrollTop,
          offsetFromTop: restoreState.offsetFromTop,
          offsetDelta,
          nextScrollTop,
          window: getMessageWindowDebugSummary(messages)
        })
        setScrollTop(container, nextScrollTop, 'auto')
      }
    }
  }, [channel.id, unreadMessageId, isActiveEdgeRequestCurrent, messages, unreadScrollTo])

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
    const previousMessages = debugPreviousMessagesRef.current
    if (!isMessageListDebugEnabled()) {
      debugPreviousMessagesRef.current = messages
      return
    }

    const previousSummary = getMessageWindowDebugSummary(previousMessages)
    const nextSummary = getMessageWindowDebugSummary(messages)
    if (
      previousSummary.count !== nextSummary.count ||
      previousSummary.firstConfirmedId !== nextSummary.firstConfirmedId ||
      previousSummary.lastConfirmedId !== nextSummary.lastConfirmedId ||
      previousSummary.firstLocalRef !== nextSummary.firstLocalRef ||
      previousSummary.lastLocalRef !== nextSummary.lastLocalRef
    ) {
      debugMessageListController('window:changed', {
        channelId: channel.id,
        previousWindow: previousSummary,
        nextWindow: nextSummary,
        loadState: windowLoadScopeRef.current || activeEdgeRequestRef.current?.direction || null,
        scrollTop: scrollRef.current?.scrollTop ?? null,
        hasPrevious,
        hasNext
      })
    }
    debugPreviousMessagesRef.current = messages
  }, [channel.id, hasNext, hasPrevious, messages])

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

    if (channel.backToLinkedChannel && channel?.id) {
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

    const applyVisibleWindow = !isScrollInteractionActive()
    if (applyVisibleWindow && !isViewingLatest && lastVisibleAnchorIdRef.current) {
      captureWindowPreserveAnchor()
    }

    suppressNextMessageChange()
    dispatch(
      reloadActiveChannelAfterReconnectAC(
        channel,
        lastVisibleAnchorIdRef.current || '',
        isViewingLatest,
        applyVisibleWindow
      )
    )
  }, [
    captureWindowPreserveAnchor,
    channel?.id,
    connectionStatus,
    dispatch,
    isScrollInteractionActive,
    isViewingLatest,
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
      if (scrollIdleTimerRef.current !== null) {
        window.clearTimeout(scrollIdleTimerRef.current)
      }
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
