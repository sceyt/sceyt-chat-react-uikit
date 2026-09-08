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
import Attachment from '../Attachment'

const attachmentMetadata = (attachment: any) => {
  if (!attachment?.metadata) return {}
  if (typeof attachment.metadata !== 'string') return attachment.metadata

  try {
    return JSON.parse(attachment.metadata)
  } catch (_) {
    return {}
  }
}

const preview = (message: any) => {
  if (message?.pollDetails) return `Poll: ${message.pollDetails.name || message.body || 'Poll'}`
  const attachment = message?.attachments?.[0]
  if (!attachment) return message?.forwardingDetails ? 'Shared content' : 'Message'
  const metadata = attachmentMetadata(attachment)
  if (attachment.type === attachmentTypes.voice) {
    const duration = metadata.duration || metadata.dur || attachment.duration
    return `Voice${duration ? `: ${formatDuration(duration)}` : ''}`
  }
  if (message?.body) return message.body
  if (attachment.type === attachmentTypes.image) return 'Photo'
  if (attachment.type === attachmentTypes.video) {
    return 'Video'
  }
  return attachment.name || 'File'
}

const formatDuration = (duration: number | string) => {
  const seconds = Math.max(0, Math.round(Number(duration) || 0))
  const minutes = Math.floor(seconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

const hasAttachmentTile = (attachment: any) =>
  [attachmentTypes.image, attachmentTypes.video, attachmentTypes.file].includes(attachment?.type)

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
  const [activePinId, setActivePinId] = useState<string>()
  const [advanceAfterPage, setAdvanceAfterPage] = useState(false)
  const markerRefs = useRef<Record<number, HTMLButtonElement | null>>({})
  const requestedNextTokenRef = useRef<string | undefined>()
  const selectedIndex = activePinId ? pins.findIndex((pin) => pin.id === activePinId) : -1
  const index = selectedIndex >= 0 ? selectedIndex : 0
  const active = pins[index]

  useEffect(() => {
    if (advanceAfterPage && index < pins.length - 1) {
      setActivePinId(pins[index + 1].id)
      setAdvanceAfterPage(false)
    }
  }, [advanceAfterPage, index, pins])
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
  const attachment = active.message?.attachments?.[0]
  const attachmentForPreview = attachment && {
    ...attachment,
    messageId: attachment.messageId || messageId,
    metadata: attachmentMetadata(attachment)
  }
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
      setActivePinId(pins[nextIndex].id)
      if (count - nextIndex - 1 <= 3) loadNextPage()
    } else if (nextToken) {
      setAdvanceAfterPage(true)
      loadNextPage()
    } else if (count > 1) {
      setActivePinId(pins[0].id)
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
            onClick={() => setActivePinId(pin.id)}
            aria-label={`Show pinned message ${pinIndex + 1}`}
          />
        ))}
      </Markers>
      {hasAttachmentTile(attachmentForPreview) && (
        <PinnedAttachmentPreview aria-hidden='true'>
          <Attachment
            attachment={attachmentForPreview}
            isRepliedMessage
            backgroundColor={surface1}
            borderRadius='8px'
            messageType={active.message?.type}
          />
        </PinnedAttachmentPreview>
      )}
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
const PinnedAttachmentPreview = styled.div`
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  overflow: hidden;

  > div {
    margin-right: 0;
  }
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
