import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import styled, { keyframes } from 'styled-components'
import { useDispatch, useSelector } from '../../store/hooks'
import { loadPinnedMessagesAC } from '../../store/pinned/actions'
import { pinnedMessagesCursorSelector, pinnedMessagesSelector } from '../../store/pinned/selector'
import { THEME_COLORS } from '../../UIHelper/constants'
import { useColor } from '../../hooks'
import { ReactComponent as ChevronRightCircleIcon } from '../../assets/svg/chevron_right_circle.svg'
import { IMessage } from '../../types'
import { PRELOAD_TRIGGER_PX } from './MessageList/useChatController'
import { navigateToMessage } from '../../helpers/messageListNavigator'

type RenderPinnedMessage = (args: {
  message: IMessage
  prevMessage: IMessage | null
  nextMessage: IMessage | null
  index: number
}) => React.ReactNode

type ScrollContainerComponent = React.ComponentType<any>
type MessagesContainerComponent = React.ComponentType<{ children?: React.ReactNode }>

const PinnedMessagesList = ({
  channelId,
  onClose,
  closeRequested,
  renderMessage,
  ScrollContainer,
  MessagesContainer
}: {
  channelId: string
  onClose: () => void
  closeRequested?: boolean
  renderMessage: RenderPinnedMessage
  ScrollContainer: ScrollContainerComponent
  MessagesContainer: MessagesContainerComponent
}) => {
  const dispatch = useDispatch()
  const pins = useSelector(pinnedMessagesSelector(channelId))
  const nextToken = useSelector(pinnedMessagesCursorSelector(channelId))
  const requestedNextTokenRef = useRef<string | undefined>()
  const itemsRef = useRef<HTMLDivElement>(null)
  const [isScrolling, setIsScrolling] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [navigationOffsets, setNavigationOffsets] = useState<Record<string, { left: number; bottom: number }>>({})
  const scrollAnchorRef = useRef<{ pinId: string; offset: number } | null>(null)
  const hasScrolledToLatestRef = useRef(false)
  const {
    [THEME_COLORS.BACKGROUND]: background,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.SURFACE_2]: surface2,
    [THEME_COLORS.BACKGROUND_SECTIONS]: backgroundSections
  } = useColor()

  const captureScrollAnchor = () => {
    const container = itemsRef.current
    if (!container) return

    const containerBounds = container.getBoundingClientRect()
    const rows = Array.from(container.querySelectorAll<HTMLElement>('[data-pinned-message-id]'))
    const anchor = rows.find((row) => row.getBoundingClientRect().bottom > containerBounds.top) || rows[rows.length - 1]
    if (!anchor?.dataset.pinnedMessageId) return

    scrollAnchorRef.current = {
      pinId: anchor.dataset.pinnedMessageId,
      offset: anchor.getBoundingClientRect().top - containerBounds.top
    }
  }

  const restoreScrollAnchor = () => {
    const container = itemsRef.current
    const anchor = scrollAnchorRef.current
    if (!container || !anchor) return

    const row = Array.from(container.querySelectorAll<HTMLElement>('[data-pinned-message-id]')).find(
      (element) => element.dataset.pinnedMessageId === anchor.pinId
    )
    if (!row) return

    const offset = row.getBoundingClientRect().top - container.getBoundingClientRect().top
    if (offset) container.scrollTop += offset - anchor.offset
  }

  useEffect(() => {
    captureScrollAnchor()
    // The list must become an exact durable view, not only a newer cached slice.
    // It reconciles remaining server pages in the background while the cache renders
    // immediately, so removals made from another device are reflected without a
    // second manual scroll to the top.
    dispatch(loadPinnedMessagesAC(channelId, undefined, true, 30, true))
  }, [channelId, dispatch])

  useEffect(() => {
    if (closeRequested) setIsClosing(true)
  }, [closeRequested])

  // Pins arrive newest-first (paged from most recent backwards); reverse them so the
  // list reads like the chat itself - oldest on top, newest at the bottom - and older
  // pages load as the user scrolls up toward the top, same as chat history.
  const displayedPins = useMemo(() => [...pins].reverse(), [pins])

  const loadNextPage = () => {
    if (!nextToken || requestedNextTokenRef.current === nextToken) return
    requestedNextTokenRef.current = nextToken
    captureScrollAnchor()
    dispatch(loadPinnedMessagesAC(channelId, nextToken, false, 30))
  }

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    captureScrollAnchor()
    const element = event.currentTarget
    if (element.scrollTop <= PRELOAD_TRIGGER_PX) loadNextPage()
  }

  const openInConversation = (message: IMessage) => {
    const messageId = message.id || message.tid
    if (!messageId) return

    // The normal list stays mounted under this overlay, so its registered
    // navigator can begin loading/highlighting the source message immediately.
    navigateToMessage(messageId)
    setIsClosing(true)
  }

  const positionNavigationControl = (message: IMessage, event: React.MouseEvent<HTMLDivElement>) => {
    const messageId = message.id || message.tid
    const messageContent = event.currentTarget.querySelector('.messageContent') as HTMLElement | null
    if (!messageId || !messageContent) return

    const rowBounds = event.currentTarget.getBoundingClientRect()
    const contentBounds = messageContent.getBoundingClientRect()
    const messageItem = event.currentTarget.querySelector('.message_item') as HTMLElement | null
    const bottom = messageItem ? Number.parseFloat(window.getComputedStyle(messageItem).marginBottom) || 0 : 0
    const left = message.incoming
      ? contentBounds.right - rowBounds.left + 8
      : contentBounds.left - rowBounds.left - 36 - 8

    setNavigationOffsets((current) => {
      const existing = current[messageId]
      if (existing?.left === left && existing.bottom === bottom) return current
      return { ...current, [messageId]: { left, bottom } }
    })
  }

  useLayoutEffect(() => {
    const element = itemsRef.current
    if (!element) return

    if (!hasScrolledToLatestRef.current && displayedPins.length) {
      hasScrolledToLatestRef.current = true
      element.scrollTop = element.scrollHeight
    }
    restoreScrollAnchor()
    captureScrollAnchor()
  }, [displayedPins])

  return (
    <Screen
      background={background}
      closing={isClosing}
      onAnimationEnd={(event: React.AnimationEvent<HTMLElement>) => {
        if (isClosing && event.target === event.currentTarget) onClose()
      }}
    >
      <ScrollContainer
        id='pinnedScrollableDiv'
        ref={itemsRef}
        className={isScrolling ? 'show-scrollbar' : ''}
        backgroundColor={background}
        thumbColor={surface2}
        onScroll={handleScroll}
        onMouseEnter={() => setIsScrolling(true)}
        onMouseLeave={() => setIsScrolling(false)}
      >
        <MessagesContainer>
          {displayedPins.map((pin, index) => {
            const previousMessage = displayedPins[index - 1]?.message

            return (
              <PinnedMessageRow
                key={pin.id}
                data-pinned-message-id={pin.id}
                onMouseEnter={(event: React.MouseEvent<HTMLDivElement>) =>
                  positionNavigationControl(pin.message, event)
                }
              >
                {renderMessage({
                  message: pin.message,
                  prevMessage: previousMessage || null,
                  nextMessage: displayedPins[index + 1]?.message || null,
                  index
                })}
                {(pin.message.id || pin.message.tid) && (
                  <GoToMessageButton
                    background={backgroundSections}
                    className='pinned-message-navigation'
                    type='button'
                    incoming={Boolean(pin.message.incoming)}
                    $offset={navigationOffsets[pin.message.id || pin.message.tid || '']?.left}
                    $bottom={navigationOffsets[pin.message.id || pin.message.tid || '']?.bottom}
                    onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                      event.stopPropagation()
                      openInConversation(pin.message)
                    }}
                    aria-label='Go to message in conversation'
                  >
                    <ChevronRightCircleIcon />
                  </GoToMessageButton>
                )}
              </PinnedMessageRow>
            )
          })}
          {!displayedPins.length && <Empty textColor={textSecondary}>No pinned messages</Empty>}
        </MessagesContainer>
      </ScrollContainer>
    </Screen>
  )
}

export default PinnedMessagesList

const slideInFromRight = keyframes`
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
`

const slideOutToRight = keyframes`
  from { transform: translateX(0); }
  to { transform: translateX(100%); }
`

const Screen = styled.section<{ background: string; closing: boolean }>`
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  background: ${({ background }) => background};
  animation: ${({ closing }) => (closing ? slideOutToRight : slideInFromRight)} 220ms ease both;
  pointer-events: ${({ closing }) => (closing ? 'none' : 'auto')};
  will-change: transform;
`

const Empty = styled.div<{ textColor: string }>`
  padding: 28px 12px;
  color: ${({ textColor }) => textColor};
  text-align: center;
`

const PinnedMessageRow = styled.div`
  position: relative;
  width: 100%;

  &:hover .pinned-message-navigation,
  &:focus-within .pinned-message-navigation {
    opacity: 1;
    pointer-events: auto;
  }
`

const GoToMessageButton = styled.button<{ incoming: boolean; $offset?: number; $bottom?: number; background: string }>`
  position: absolute;
  z-index: 2;
  bottom: ${(props) => (typeof props.$bottom === 'number' ? `${props.$bottom + 1}px` : '1px')};
  left: ${(props) => (typeof props.$offset === 'number' ? `${props.$offset}px` : '-9999px')};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: ${({ background }) => background || '#fff'};
  box-shadow: 0px 1px 3px 0px #18172524;
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    transform: scale(1.02);
  }

  svg {
    cursor: pointer;
  }
`
