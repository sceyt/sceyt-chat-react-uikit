import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import styled from 'styled-components'
import moment from 'moment'
import {
  IMessage,
  IMarker,
  ILabels,
  MessageInfoTab,
  ITabsStyles,
  IListItemStyles,
  IUser,
  IContact
} from '../../../types'
import { THEME_COLORS } from '../../../UIHelper/constants'
import { Avatar } from '../../../components'
import { useColor } from '../../../hooks'
import { getMessageMarkersAC } from 'store/message/actions'
import { useDispatch, useSelector } from 'store/hooks'
import { messageMarkersSelector, messagesMarkersLoadingStateSelector } from 'store/message/selector'
import { LOADING_STATE } from 'helpers/constants'
import { makeUsername } from 'helpers/message'
import { getShowOnlyContactUsers } from 'helpers/contacts'

interface IProps {
  message: IMessage
  togglePopup: () => void
  labels?: ILabels
  tabsOrder?: { key: MessageInfoTab; label: string; data: IMarker[] }[]
  showCounts?: boolean
  avatarSize?: number
  // size controls forwarded to Popup
  maxWidth?: string
  minWidth?: string
  height?: string
  // custom rendering and formatting
  renderItem?: (marker: IMarker, defaultNode: JSX.Element) => JSX.Element
  formatDate?: (date: Date) => string
  tabsStyles?: ITabsStyles
  listItemStyles?: IListItemStyles
  handleOpenUserProfile?: (user: IUser) => void
  contacts: { [key: string]: IContact }
}

const defaultFormatDate = (date: Date) => {
  const m = moment(date)
  if (m.isSame(moment(), 'day')) {
    return `Today, ${m.format('HH:mm')}`
  }
  if (m.isSame(moment().subtract(1, 'day'), 'day')) {
    return `Yesterday, ${m.format('HH:mm')}`
  }
  return m.format('DD.MM.YYYY')
}

const MessageInfo = ({
  message,
  togglePopup,
  labels,
  tabsOrder = [
    ...(message.attachments && message.attachments.length > 0 && message.attachments[0].type === 'voice'
      ? [{ key: 'played' as const, label: 'Played by', data: [] as IMarker[] }]
      : []),
    { key: 'received' as const, label: 'Delivered to', data: [] as IMarker[] },
    { key: 'displayed' as const, label: 'Seen by', data: [] as IMarker[] }
  ] as { key: MessageInfoTab; label: string; data: IMarker[] }[],
  showCounts = false,
  avatarSize = 32,
  maxWidth = '340px',
  minWidth = '340px',
  height = '300px',
  renderItem,
  formatDate = defaultFormatDate,
  tabsStyles = {},
  listItemStyles = {},
  handleOpenUserProfile,
  contacts
}: IProps) => {
  const {
    [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.BACKGROUND_HOVERED]: backgroundHovered,
    [THEME_COLORS.BACKGROUND_SECTIONS]: backgroundSections,
    [THEME_COLORS.TEXT_ON_PRIMARY]: textOnPrimary,
    [THEME_COLORS.BORDER]: border
  } = useColor()
  const dispatch = useDispatch()
  const messageMarkers = useSelector(messageMarkersSelector)
  const messagesMarkersLoadingState = useSelector(messagesMarkersLoadingStateSelector)
  const markers = useMemo(
    () => messageMarkers[message.channelId] && messageMarkers[message.channelId][message.id],
    [messageMarkers, message.channelId, message.id]
  )
  const [activeTab, setActiveTab] = useState<MessageInfoTab>(tabsOrder[0]?.key || 'played')
  const [open, setOpen] = useState<boolean>(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const [flipAbove, setFlipAbove] = useState<boolean>(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const tabsRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [panelHeightPx, setPanelHeightPx] = useState<number>(0)
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false)
  const [ready, setReady] = useState<boolean>(false)
  const [flipLocked, setFlipLocked] = useState<boolean>(false)
  const getFromContacts = useMemo(() => getShowOnlyContactUsers(), [])

  const activeMarkers = useMemo(() => {
    const list = (markers && (markers as any)[activeTab]) || []
    return Array.isArray(list) ? [...list].sort(sortByDateDesc) : []
  }, [markers, activeTab])
  // Calculate a row height and max list height for 5 rows (approx: item height + vertical gaps)
  const rowHeightPx = useMemo(() => (avatarSize || 32) + 24, [avatarSize])
  const listMaxHeightPx = useMemo(() => rowHeightPx * 5 - 16, [rowHeightPx])

  const tabItems: Array<{ key: MessageInfoTab; label: string; data: IMarker[] }> = tabsOrder.map((tab) => {
    switch (tab.key) {
      case 'played':
        return { key: tab.key, label: labels?.playedBy || 'Played by', data: activeMarkers }
      case 'received':
        return { key: tab.key, label: labels?.receivedBy || 'Delivered to', data: activeMarkers }
      case 'displayed':
      default:
        return { key: 'displayed', label: labels?.displayedBy || 'Seen by', data: activeMarkers }
    }
  })

  const renderRow = (marker: IMarker) => {
    const contact = contacts[marker.user?.id || '']
    const displayName = makeUsername(contact, marker.user as IUser, getFromContacts)
    const avatarUrl = marker.user ? marker.user.avatarUrl : ''
    const dateVal: any = (marker as any).createdAt || (marker as any).createdAt
    const dateFormat = dateVal ? formatDate(new Date(dateVal)) : ''

    const node = (
      <Row
        backgroundHover={listItemStyles.hoverBackground || backgroundHovered}
        onClick={() => handleOpenUserProfile?.(marker.user as IUser)}
      >
        <Avatar name={displayName} image={avatarUrl} size={avatarSize} textSize={12} setDefaultAvatar />
        <RowInfo>
          <RowTitle color={listItemStyles.nameColor || textPrimary}>{displayName}</RowTitle>
          <RowDate color={listItemStyles.dateColor || textSecondary}>{dateFormat}</RowDate>
        </RowInfo>
      </Row>
    )

    return renderItem ? renderItem(marker, node) : node
  }

  useLayoutEffect(() => {
    // Pre-measure content and decide flip before opening to avoid position jump
    const container = document.getElementById('scrollableDiv')
    const anchorEl = rootRef.current?.parentElement as HTMLElement | null
    if (container && anchorEl) {
      const containerRect = container.getBoundingClientRect()
      const anchorRect = anchorEl.getBoundingClientRect()
      const contentEl = contentRef.current
      const tabsEl = tabsRef.current
      const listEl = listRef.current
      const cs = contentEl ? getComputedStyle(contentEl) : ({} as any)
      const padTop = parseFloat(cs?.paddingTop || '0') || 0
      const padBottom = parseFloat(cs?.paddingBottom || '0') || 0
      const contentPaddingY = padTop + padBottom
      const tabsHeight = tabsEl ? tabsEl.getBoundingClientRect().height : 0
      const tabsMarginBottom = 8
      const listMarginTop = 8
      const desiredListHeight = Math.min(listEl ? listEl.scrollHeight : 0, listMaxHeightPx)
      const desiredHeight = contentPaddingY + tabsHeight + tabsMarginBottom + listMarginTop + desiredListHeight
      const maxPx = parseInt(String(height || '300'), 10) || 300
      const measuredTarget = Math.min(desiredHeight || 0, maxPx)
      // For flip decision while loading, consider worst-case; but keep visual height to measured
      const flipTarget = messagesMarkersLoadingState === LOADING_STATE.LOADING ? maxPx : measuredTarget
      setPanelHeightPx(measuredTarget)
      const availableBelow = containerRect.bottom - anchorRect.bottom - 8
      const availableAbove = anchorRect.top - containerRect.top - 8
      const nextFlip = Boolean(flipTarget > availableBelow && flipTarget <= availableAbove)
      setFlipAbove(nextFlip)
    }
    setIsTransitioning(true)
    setOpen(true)
    setReady(true)
    setFlipLocked(true)
  }, [])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        togglePopup()
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
    }
  }, [])

  // Recalculate dropdown position to keep it within #scrollableDiv
  useEffect(() => {
    const container = document.getElementById('scrollableDiv')
    if (!container) return

    const recalc = () => {
      if (!rootRef.current || !ready) return
      if (messagesMarkersLoadingState === LOADING_STATE.LOADING) return
      const containerRect = container.getBoundingClientRect()
      const anchorEl = rootRef.current.parentElement as HTMLElement | null
      if (!anchorEl) return
      const anchorRect = anchorEl.getBoundingClientRect()

      // Use planned height for stable flip decision during transitions
      let dropdownHeight = panelHeightPx || 0
      if (!dropdownHeight || dropdownHeight < 8) {
        const parsed = parseInt(String(height || '300'), 10)
        dropdownHeight = isNaN(parsed) ? 300 : parsed
      }

      const availableBelow = containerRect.bottom - anchorRect.bottom - 8
      const availableAbove = anchorRect.top - containerRect.top - 8
      const overflowBelow = dropdownHeight > availableBelow
      const overflowAbove = dropdownHeight > availableAbove
      if (!isTransitioning && !flipLocked) {
        setFlipAbove((prev) => {
          // If currently above, only switch to below when above overflows and below fits
          if (prev) {
            if (overflowAbove && !overflowBelow) return false
            return true
          }
          // If currently below, only switch to above when below overflows and above fits
          if (overflowBelow && !overflowAbove) return true
          return false
        })
      }
    }

    if (open) {
      recalc()
      const raf1 = requestAnimationFrame(recalc)
      const raf2 = requestAnimationFrame(() => requestAnimationFrame(recalc))
      const t1 = setTimeout(recalc, 50)
      const t2 = setTimeout(recalc, 200)
      panelRef.current && panelRef.current.addEventListener('transitionend', recalc)

      container.addEventListener('scroll', recalc)
      window.addEventListener('resize', recalc)

      return () => {
        cancelAnimationFrame(raf1)
        cancelAnimationFrame(raf2)
        clearTimeout(t1)
        clearTimeout(t2)
        panelRef.current && panelRef.current.removeEventListener('transitionend', recalc)
        container.removeEventListener('scroll', recalc)
        window.removeEventListener('resize', recalc)
      }
    } else {
      container.addEventListener('scroll', recalc)
      window.addEventListener('resize', recalc)
      return () => {
        container.removeEventListener('scroll', recalc)
        window.removeEventListener('resize', recalc)
      }
    }
  }, [open, ready, message.id, panelHeightPx, isTransitioning, flipLocked, height])

  // Measure content on relevant changes and animate height; decide flip before animating (layout phase)
  useLayoutEffect(() => {
    const container = document.getElementById('scrollableDiv')
    const anchorEl = rootRef.current?.parentElement as HTMLElement | null
    if (!container || !anchorEl || !ready) return
    const containerRect = container.getBoundingClientRect()
    const anchorRect = anchorEl.getBoundingClientRect()
    const contentEl = contentRef.current
    const tabsEl = tabsRef.current
    const listEl = listRef.current
    const cs = contentEl ? getComputedStyle(contentEl) : ({} as any)
    const padTop = parseFloat(cs?.paddingTop || '0') || 0
    const padBottom = parseFloat(cs?.paddingBottom || '0') || 0
    const contentPaddingY = padTop + padBottom
    const tabsHeight = tabsEl ? tabsEl.getBoundingClientRect().height : 0
    const tabsMarginBottom = 8
    const listMarginTop = 8
    const desiredListHeight = Math.min(listEl ? listEl.scrollHeight : 0, listMaxHeightPx)
    const desiredHeight = contentPaddingY + tabsHeight + tabsMarginBottom + listMarginTop + desiredListHeight
    const maxPx = parseInt(String(height || '300'), 10)
    const measuredTarget = Math.min(desiredHeight || 0, isNaN(maxPx) ? 300 : Math.min(maxPx, desiredHeight))
    const nextHeight = Math.max(panelHeightPx || 0, measuredTarget)

    const availableBelow = containerRect.bottom - anchorRect.bottom - 8
    const availableAbove = anchorRect.top - containerRect.top - 8
    // Lock flip during this update; set correct flip before painting
    setFlipLocked(true)
    if (messagesMarkersLoadingState !== LOADING_STATE.LOADING) {
      const overflowBelow = nextHeight > availableBelow
      const overflowAbove = nextHeight > availableAbove
      setFlipAbove((prev) => {
        if (prev) {
          if (overflowAbove && !overflowBelow) return false
          return true
        }
        if (overflowBelow && !overflowAbove) return true
        return false
      })
    }

    if (panelHeightPx !== nextHeight) {
      setIsTransitioning(true)
      setPanelHeightPx(nextHeight)
    }
  }, [ready, panelHeightPx, activeMarkers.length, messagesMarkersLoadingState, height])

  // Lock flip while loading; unlock after load completes (transition end handler will also unlock if needed)
  useEffect(() => {
    if (messagesMarkersLoadingState === LOADING_STATE.LOADING) {
      setFlipLocked(true)
    }
  }, [messagesMarkersLoadingState])

  // After height transition completes, unlock flipping again
  useEffect(() => {
    const el = panelRef.current
    if (!el) return
    const onEnd = (e: TransitionEvent) => {
      if (e.propertyName === 'height') {
        setIsTransitioning(false)
        // Allow flip updates after the current transition (initial open or tab change)
        setTimeout(() => {
          setFlipLocked(false)
        }, 50)
      }
    }
    el.addEventListener('transitionend', onEnd as any)
    return () => {
      el.removeEventListener('transitionend', onEnd as any)
    }
  }, [])

  useEffect(() => {
    if (activeTab && message.id && message.channelId) {
      dispatch(getMessageMarkersAC(message.id, message.channelId, activeTab))
    }
  }, [activeTab, message.id, message.channelId])

  return (
    <DropdownRoot
      ref={rootRef}
      rtl={message.incoming}
      backgroundColor={backgroundSections}
      flip={flipAbove}
      ready={ready}
    >
      <Panel
        ref={panelRef}
        bg={backgroundSections}
        open={open}
        heightPx={panelHeightPx}
        maxHeight={height}
        maxWidth={maxWidth}
        minWidth={minWidth}
      >
        <Content ref={contentRef}>
          <Tabs ref={tabsRef}>
            {tabItems.map((tab) => (
              <Tab
                key={tab.key}
                active={activeTab === tab.key}
                activeColor={tabsStyles.activeColor || textOnPrimary}
                inactiveColor={tabsStyles.inactiveColor || textSecondary}
                onClick={() => setActiveTab(tab.key)}
                textOnPrimary={textOnPrimary}
                textSecondary={textSecondary}
                background={activeTab === tab.key ? accentColor : 'transparent'}
                borderColor={border}
              >
                {tab.label}
                {showCounts ? ` (${tab.data.length})` : ''}
              </Tab>
            ))}
          </Tabs>
          <List ref={listRef} maxHeight={listMaxHeightPx}>
            {activeMarkers.map((marker: IMarker) => (
              <React.Fragment key={`${marker.user?.id || 'deleted'}-${(marker.createdAt as any) || ''}`}>
                {renderRow(marker)}
              </React.Fragment>
            ))}
            {!activeMarkers.length && messagesMarkersLoadingState !== LOADING_STATE.LOADING && (
              <Empty color={textSecondary}>No results</Empty>
            )}
          </List>
        </Content>
      </Panel>
    </DropdownRoot>
  )
}

export default MessageInfo

function sortByDateDesc(a: IMarker, b: IMarker) {
  const aDate: any = (a as any).createdAt || (a as any).createdAt
  const bDate: any = (b as any).createdAt || (b as any).createdAt
  const aTime = aDate ? new Date(aDate).getTime() : 0
  const bTime = bDate ? new Date(bDate).getTime() : 0
  return bTime - aTime
}

const Tabs = styled.div`
  display: flex;
  gap: 8px;
  justify-content: start;
  margin-bottom: 8px;
`

const Tab = styled.button<{
  active: boolean
  activeColor: string
  inactiveColor: string
  textOnPrimary: string
  textSecondary: string
  background: string
  borderColor: string
}>`
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 6px 11px;
  border-radius: 16px;
  color: ${(p) => (p.active ? p.textOnPrimary : p.textSecondary)};
  background: ${(p) => p.background};
  border: 1px solid ${(p) => (p.active ? p.background : p.borderColor)};
  &:hover {
    opacity: 0.9;
  }
  font-weight: 500;
  font-size: 15px;
  line-height: 20px;
  letter-spacing: 0px;
  text-align: center;
`

const List = styled.div<{ maxHeight?: number }>`
  margin-top: 8px;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  max-height: ${(p) => (p.maxHeight ? `${p.maxHeight}px` : 'unset')};
  min-height: 120px;
`

const Row = styled.div<{ backgroundHover?: string }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px;
  border-radius: 10px;
  cursor: pointer;
  &:hover {
    background-color: ${(p) => p.backgroundHover};
  }
`

const RowInfo = styled.div`
  display: flex;
  margin-right: auto;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  width: 100%;
`

const RowTitle = styled.div<{ color: string }>`
  color: ${(p) => p.color};
  font-size: 16px;
  font-weight: 500;
  line-height: 22px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const RowDate = styled.div<{ color: string }>`
  color: ${(p) => p.color};
  min-width: max-content;
  font-weight: 400;
  font-size: 13px;
  line-height: 16px;
`

const Empty = styled.div<{ color: string }>`
  color: ${(p) => p.color};
  text-align: center;
  padding: 16px 0;
  font-size: 14px;
  height: calc(100% - 32px);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
`

const DropdownRoot = styled.div<{ rtl: boolean; backgroundColor: string; flip: boolean; ready: boolean }>`
  position: absolute;
  top: ${(p) => (p.flip ? 'auto' : 'calc(100% + 8px)')};
  bottom: ${(p) => (p.flip ? 'calc(100% + 8px)' : 'auto')};
  ${(p) => (p.rtl ? 'left: 4%;' : 'right: 4%;')}
  z-index: 15;
  background: ${({ backgroundColor }) => backgroundColor};
  box-shadow: 0px 0px 24px 0px #11153929;
  border-radius: 16px;
  direction: initial;
  visibility: ${(p) => (p.ready ? 'visible' : 'hidden')};
`

const Panel = styled.div<{
  bg: string
  open: boolean
  heightPx?: number
  maxHeight?: string
  maxWidth?: string
  minWidth?: string
}>`
  background: ${(p) => p.bg};
  border-radius: 16px;
  overflow: hidden;
  transition: height 0.25s ease;
  height: ${(p) =>
    p.open ? `${Math.min(p.heightPx || 0, parseInt(String(p.maxHeight || '300'), 10) || 300)}px` : '0'};
  width: ${(p) => p.maxWidth || '340px'};
  min-width: ${(p) => p.minWidth || '340px'};
  display: flex;
  flex-direction: column;
`

const Content = styled.div`
  padding: 16px 12px;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
`
