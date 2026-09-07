import React, { useEffect, useRef, useState } from 'react'
import styled, { keyframes } from 'styled-components'
import { useDispatch, useSelector } from '../../store/hooks'
import { pinnedMessagesCursorSelector, pinnedMessagesSelector } from '../../store/pinned/selector'
import { loadPinnedMessagesAC } from '../../store/pinned/actions'
import { navigateToMessage } from '../../helpers/messageListNavigator'
import { THEME_COLORS } from '../../UIHelper/constants'
import { useColor } from '../../hooks'
import { ReactComponent as PinIcon } from '../../assets/svg/pin.svg'
import { attachmentTypes } from '../../helpers/constants'

const preview = (message: any) => {
  if (message?.body) return message.body
  const attachment = message?.attachments?.[0]
  if (!attachment) return message?.forwardingDetails ? 'Shared content' : 'Message'
  if (attachment.type === attachmentTypes.image) return 'Photo'
  if (attachment.type === attachmentTypes.video) {
    const duration = attachment.metadata?.duration || attachment.metadata?.dur || attachment.duration
    return `Video${duration ? `: ${formatDuration(duration)}` : ''}`
  }
  if (attachment.type === attachmentTypes.voice) return 'Voice message'
  return attachment.name || 'File'
}

const formatDuration = (duration: number | string) => {
  const seconds = Math.max(0, Math.round(Number(duration) || 0))
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

type MarkerFade = 'none' | 'top' | 'bottom' | 'both'

const markerMask = (fade: MarkerFade) => {
  if (fade === 'top') return 'linear-gradient(to bottom, transparent, #000 9px)'
  if (fade === 'bottom') return 'linear-gradient(to bottom, #000 calc(100% - 9px), transparent)'
  if (fade === 'both') return 'linear-gradient(to bottom, transparent, #000 9px, #000 calc(100% - 9px), transparent)'
  return 'none'
}

const PinnedMessagesBanner = ({ channelId }: { channelId: string }) => {
  const dispatch = useDispatch()
  const pins = useSelector(pinnedMessagesSelector(channelId))
  const nextToken = useSelector(pinnedMessagesCursorSelector(channelId))
  const {
    [THEME_COLORS.SURFACE_1]: surface1,
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.ICON_PRIMARY]: iconPrimary
  } = useColor()
  const [index, setIndex] = useState(0)
  const [advanceAfterPage, setAdvanceAfterPage] = useState(false)
  const markerRefs = useRef<Record<number, HTMLButtonElement | null>>({})
  const requestedNextTokenRef = useRef<string | undefined>()
  const active = pins[index]

  useEffect(() => {
    setIndex((value) => Math.max(0, Math.min(value, pins.length - 1)))
  }, [pins.length])
  useEffect(() => {
    if (advanceAfterPage && index < pins.length - 1) {
      setIndex((value) => value + 1)
      setAdvanceAfterPage(false)
    }
  }, [advanceAfterPage, index, pins.length])
  useEffect(() => {
    const block = index > 0 && index < pins.length - 1 ? 'center' : 'nearest'
    markerRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block })
  }, [index, pins.length])
  useEffect(() => {
    dispatch(loadPinnedMessagesAC(channelId))
  }, [channelId, dispatch])

  const count = pins.length
  if (!active) return null
  const messageId = active.message?.id || active.message?.tid
  const markerFade: MarkerFade = count <= 3 ? 'none' : index <= 1 ? 'top' : index >= count - 2 ? 'bottom' : 'both'
  const loadNextPage = () => {
    if (!nextToken || requestedNextTokenRef.current === nextToken) return false

    requestedNextTokenRef.current = nextToken
    dispatch(loadPinnedMessagesAC(channelId, nextToken, false))
    return true
  }
  const showNext = () => {
    if (index < count - 1) {
      const nextIndex = index + 1
      setIndex(nextIndex)
      if (count - nextIndex - 1 <= 3) loadNextPage()
    } else if (nextToken) {
      setAdvanceAfterPage(true)
      loadNextPage()
    } else if (count > 1) {
      setIndex(0)
    }
  }

  const navigate = () => {
    if (!messageId) return
    navigateToMessage(messageId)
    showNext()
  }

  return (
    <Banner
      background={surface1}
      onClick={navigate}
      onKeyDown={(event: React.KeyboardEvent<HTMLDivElement>) => event.key === 'Enter' && navigate()}
    >
      <Markers
        compact={pins.length > 3}
        fade={markerFade}
        aria-label='Pinned message selector'
        onClick={(event: React.MouseEvent<HTMLDivElement>) => event.stopPropagation()}
      >
        {pins.map((pin, pinIndex) => (
          <Marker
            key={pin.id}
            ref={(element: HTMLButtonElement | null) => {
              markerRefs.current[pinIndex] = element
            }}
            active={pinIndex === index}
            compact={pins.length > 3}
            onClick={() => setIndex(pinIndex)}
            aria-label={`Show pinned message ${pinIndex + 1}`}
          />
        ))}
      </Markers>
      <Copy key={active.id} textPrimary={textPrimary} textSecondary={textSecondary}>
        <strong>Pinned messages</strong>
        <span>{preview(active.message)}</span>
      </Copy>
      <Controls onClick={(event: React.MouseEvent<HTMLDivElement>) => event.stopPropagation()} svgColor={iconPrimary}>
        <button aria-label='Go to pinned message' onClick={navigate}>
          <PinIcon />
        </button>
      </Controls>
    </Banner>
  )
}

export default PinnedMessagesBanner

const Banner = styled.div<{ background: string }>`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  box-sizing: border-box;
  border: 0;
  padding: 0 8px;
  text-align: left;
  background: ${({ background }) => background};
  cursor: pointer;
  outline: none;
  &:focus-visible {
    box-shadow: inset 0 0 0 2px ${({ background }) => background};
  }
`
const Markers = styled.div<{ compact: boolean; fade: MarkerFade }>`
  align-self: center;
  width: 2px;
  height: 51px;
  box-sizing: border-box;
  display: flex;
  /* The SDK returns newest first; reverse the rail so the newest pin starts at the bottom. */
  flex-direction: column-reverse;
  gap: 4px;
  padding: ${({ compact }) => (compact ? '0' : '4px 0')};
  overflow-y: ${({ compact }) => (compact ? 'auto' : 'hidden')};
  mask-image: ${({ fade }) => markerMask(fade)};
  -webkit-mask-image: ${({ fade }) => markerMask(fade)};
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`
const Marker = styled.button<{ active: boolean; compact: boolean }>`
  width: 2px;
  height: ${({ compact }) => (compact ? '10px' : 'auto')};
  flex: ${({ compact }) => (compact ? '0 0 10px' : '1 1 0')};
  border: 0;
  padding: 0;
  border-radius: 2px;
  background: ${({ active }) => (active ? '#16B891' : '#C7CED8')};
  cursor: pointer;
`
const slidePinnedPreview = keyframes`
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`
const Copy = styled.div<{ textPrimary: string; textSecondary: string }>`
  min-width: 0;
  flex: 1;
  display: grid;
  animation: ${slidePinnedPreview} 180ms ease-out;
  strong {
    color: ${({ textPrimary }) => textPrimary};
    font-family: Inter;
    font-weight: 500;
    font-size: 13px;
    line-height: 16px;
    letter-spacing: -0.2px;
  }
  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: ${({ textSecondary }) => textSecondary};
    font-family: Inter;
    font-weight: 400;
    font-size: 13px;
    line-height: 16px;
    letter-spacing: -0.1px;
  }
`
const Controls = styled.div<{ svgColor: string }>`
  display: flex;
  align-items: center;
  gap: 12px;
  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    min-height: 24px;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font-size: 13px;
    line-height: 20px;
    svg {
      color: ${(props) => props.svgColor};
    }
  }
`
