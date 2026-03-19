import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styled from 'styled-components'
import { shallowEqual } from 'react-redux'
import { useSelector, useDispatch } from 'store/hooks'
import { activeChannelSelector } from '../../store/channel/selector'
import { switchMessageSearchAC } from '../../store/channel/actions'
import { getMessagesAC } from '../../store/message/actions'
import { getClient } from '../../common/client'
import { makeUsername } from '../../helpers/message'
import { contactsMapSelector } from '../../store/user/selector'
import { IContactsMap, IMessage } from '../../types'
import Avatar from '../Avatar'
import { ReactComponent as CloseIcon } from '../../assets/svg/close.svg'
import { ReactComponent as SearchIcon } from '../../assets/svg/search.svg'
import { ReactComponent as SearchViewIcon } from '../../assets/svg/search-view.svg'
import { ReactComponent as ChevronDownIcon } from '../../assets/svg/chevron_down.svg'
import { THEME_COLORS } from '../../UIHelper/constants'
import { useColor } from '../../hooks'

const SEARCH_DEBOUNCE_MS = 400

function formatMessageDate(date: Date): string {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatGroupDate(date: Date): string {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleString('default', { month: 'long', year: 'numeric' })
}

const SNIPPET_CONTEXT = 15

function getSnippet(text: string, keyword: string): string {
  if (!keyword.trim()) return text
  const idx = text.toLowerCase().indexOf(keyword.toLowerCase())
  if (idx === -1) return text
  const start = Math.max(0, idx - SNIPPET_CONTEXT)
  const end = Math.min(text.length, idx + keyword.length + SNIPPET_CONTEXT)
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
}

function highlightText(text: string, keyword: string, highlightedBackground: string): React.ReactNode {
  if (!keyword.trim()) return text
  const snippet = getSnippet(text, keyword)
  const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = snippet.split(regex)
  return parts.map((part, i) =>
    regex.test(part) ? (
      <Highlight key={i} bgColor={highlightedBackground}>
        {part}
      </Highlight>
    ) : (
      part
    )
  )
}

interface IProps {
  size?: 'small' | 'medium' | 'large'
}

export default function MessagesSearch({ size = 'large' }: IProps) {
  const {
    [THEME_COLORS.BACKGROUND]: background,
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.ICON_PRIMARY]: iconPrimary,
    [THEME_COLORS.BORDER]: border,
    [THEME_COLORS.BACKGROUND_HOVERED]: backgroundHovered,
    [THEME_COLORS.SURFACE_1]: surface1,
    [THEME_COLORS.HIGHLIGHTED_BACKGROUND]: highlightedBackground
  } = useColor()

  const dispatch = useDispatch()
  const activeChannel = useSelector(activeChannelSelector, shallowEqual) as any
  const contactsMap: IContactsMap = useSelector(contactsMapSelector)

  const [searchText, setSearchText] = useState('')
  const [results, setResults] = useState<IMessage[]>([])
  const [hasNext, setHasNext] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(-1)

  const queryRef = useRef<any>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const buildAndSearch = useCallback(
    async (text: string) => {
      if (!text.trim() || !activeChannel?.id) {
        setResults([])
        setHasNext(false)
        queryRef.current = null
        return
      }
      setLoading(true)
      setCurrentIndex(-1)
      try {
        const SceytChatClient = getClient()
        const builder = new (SceytChatClient.MessageListSearchQueryBuilder as any)()
        builder.setChannelId(activeChannel?.id)
        builder.addField({ key: 0 /* KeyType.BODY */, value: { word: text, op: 1 /* SearchQueryType.CONTAINS */ } })
        builder.setCount(20)
        const query = await builder.build()
        queryRef.current = query
        const result = await query.loadNext()
        if (result) {
          setResults(result.messages || [])
          setHasNext(result.hasNext || false)
        }
      } catch (e) {
        console.error('[MessagesSearch] search error', e)
      } finally {
        setLoading(false)
      }
    },
    [activeChannel?.id]
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearchText(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => buildAndSearch(val), SEARCH_DEBOUNCE_MS)
  }

  const handleLoadMore = useCallback(async () => {
    if (!queryRef.current || !hasNext || loadingMore) return
    setLoadingMore(true)
    try {
      const result = await queryRef.current.loadNext()
      if (result) {
        setResults((prev) => [...prev, ...(result.messages || [])])
        setHasNext(result.hasNext || false)
      }
    } catch (e) {
      console.error('[MessagesSearch] load more error', e)
    } finally {
      setLoadingMore(false)
    }
  }, [hasNext, loadingMore])

  const handleScroll = useCallback(() => {
    const el = listRef.current
    if (!el) return
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 60) {
      handleLoadMore()
    }
  }, [handleLoadMore])

  const handleClose = () => {
    dispatch(switchMessageSearchAC(false))
  }

  const handleResultClick = (message: IMessage) => {
    if (activeChannel?.id) {
      const idx = results.findIndex((m) => m.id === message.id)
      if (idx !== -1) setCurrentIndex(idx)
      const el = document.getElementById(message.id)
      if (el) {
        const scrollContainer = document.getElementById('scrollableDiv')
        if (scrollContainer) {
          const elRect = el.getBoundingClientRect()
          const containerRect = scrollContainer.getBoundingClientRect()
          const isVisible = elRect.top >= containerRect.top && elRect.bottom <= containerRect.bottom
          if (!isVisible) {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          }
        } else {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
        el.classList.remove('highlight')
        el.getBoundingClientRect() // force reflow to restart animation
        el.classList.add('highlight')
        setTimeout(() => el.classList.remove('highlight'), 1000)
      } else {
        dispatch(getMessagesAC(activeChannel, undefined, message.id, undefined, true, 'smooth', true))
      }
    }
  }

  const handleNavNext = useCallback(async () => {
    if (!results.length || !activeChannel?.id) return
    const nextIndex = currentIndex + 1
    if (nextIndex < results.length) {
      setCurrentIndex(nextIndex)
      dispatch(getMessagesAC(activeChannel, undefined, results[nextIndex].id, undefined, true, 'smooth', true))
    } else if (hasNext) {
      await handleLoadMore()
      setCurrentIndex((prev) => {
        const idx = prev + 1
        return idx
      })
    }
  }, [currentIndex, results, hasNext, handleLoadMore, activeChannel, dispatch])

  const handleNavPrev = useCallback(() => {
    if (!results.length || !activeChannel?.id) return
    const prevIndex = currentIndex - 1
    if (prevIndex >= 0) {
      setCurrentIndex(prevIndex)
      dispatch(getMessagesAC(activeChannel, undefined, results[prevIndex].id, undefined, true, 'smooth', true))
    }
  }, [currentIndex, results, activeChannel, dispatch])

  // Reset when channel changes
  useEffect(() => {
    setSearchText('')
    setResults([])
    setHasNext(false)
    queryRef.current = null
  }, [activeChannel?.id])

  // Group results by month
  const grouped = useMemo(() => {
    const groups: { label: string; messages: IMessage[] }[] = []
    results.forEach((msg) => {
      const label = formatGroupDate(msg.createdAt)
      const last = groups[groups.length - 1]
      if (last && last.label === label) {
        last.messages.push(msg)
      } else {
        groups.push({ label, messages: [msg] })
      }
    })
    return groups
  }, [results])

  return (
    <Container size={size} backgroundColor={background} borderColor={border}>
      <Header borderColor={border}>
        <Title color={textPrimary}>Search messages</Title>
        <CloseButton onClick={handleClose} hoverBackground={backgroundHovered}>
          <CloseIcon color={iconPrimary} />
        </CloseButton>
      </Header>

      <SearchInputWrapper backgroundColor={surface1}>
        <SearchIconWrapper>
          <SearchIcon color={textSecondary} />
        </SearchIconWrapper>
        <SearchInput
          type='text'
          placeholder='Search...'
          value={searchText}
          onChange={handleInputChange}
          color={textPrimary}
          placeholderColor={textSecondary}
        />
        {searchText && results.length > 0 && (
          <NavButtons>
            <NavButton
              onClick={handleNavNext}
              disabled={currentIndex >= results.length - 1 && !hasNext}
              hoverBackground={backgroundHovered}
              iconColor={textSecondary}
            >
              <ChevronDownIcon />
            </NavButton>
            <NavButton
              onClick={handleNavPrev}
              disabled={currentIndex <= 0}
              hoverBackground={backgroundHovered}
              iconColor={textSecondary}
            >
              <ChevronDownIcon style={{ transform: 'rotate(180deg)' }} />
            </NavButton>
          </NavButtons>
        )}
        {searchText && (
          <ClearButton
            onClick={() => {
              setSearchText('')
              setResults([])
              setHasNext(false)
              setCurrentIndex(-1)
              queryRef.current = null
            }}
            hoverBackground={backgroundHovered}
          >
            <CloseIcon color={textSecondary} width={14} height={14} />
          </ClearButton>
        )}
      </SearchInputWrapper>

      <ResultsList ref={listRef} onScroll={handleScroll}>
        {!searchText && (
          <EmptyState>
            <SearchViewIcon />
            <EmptyStateText color={textSecondary}>Type your message in the search bar to get started.</EmptyStateText>
          </EmptyState>
        )}
        {loading && (
          <StatusText color={textSecondary} full>
            Searching...
          </StatusText>
        )}
        {!loading && searchText && results.length === 0 && (
          <StatusText color={textSecondary} full>
            No matching messages found.
          </StatusText>
        )}
        {(() => {
          let flatIndex = -1
          return grouped.map((group) => (
            <GroupSection key={group.label}>
              <GroupLabel color={textSecondary} backgroundColor={background}>
                {group.label}
              </GroupLabel>
              {group.messages.map((msg) => {
                flatIndex++
                const msgFlatIndex = flatIndex
                const sender = msg.user
                const senderName = sender ? makeUsername(contactsMap[sender.id], sender, false) : ''
                return (
                  <ResultItem
                    key={msg.id}
                    onClick={() => handleResultClick(msg)}
                    hoverBackground={backgroundHovered}
                    isActive={msgFlatIndex === currentIndex}
                  >
                    <ResultAvatar>
                      <Avatar name={senderName || sender?.id || ''} image={sender?.avatarUrl} size={50} textSize={13} />
                    </ResultAvatar>
                    <ResultContent>
                      <ResultMeta>
                        <ResultSender color={textPrimary}>{senderName}</ResultSender>
                        <ResultTime color={textSecondary}>{formatMessageDate(msg.createdAt)}</ResultTime>
                      </ResultMeta>
                      <ResultBody color={textSecondary}>
                        {msg.body
                          ? highlightText(msg.body, searchText, highlightedBackground)
                          : msg.attachments?.length
                            ? 'Attachment'
                            : ''}
                      </ResultBody>
                    </ResultContent>
                  </ResultItem>
                )
              })}
            </GroupSection>
          ))
        })()}
        {loadingMore && <StatusText color={textSecondary}>Loading more...</StatusText>}
      </ResultsList>
    </Container>
  )
}

const Container = styled.div<{ size: 'small' | 'medium' | 'large'; backgroundColor: string; borderColor: string }>`
  display: flex;
  flex-direction: column;
  width: ${(p) => (p.size === 'small' ? '300px' : p.size === 'medium' ? '350px' : '400px')};
  min-width: ${(p) => (p.size === 'small' ? '300px' : p.size === 'medium' ? '350px' : '400px')};
  height: 100%;
  background-color: ${(p) => p.backgroundColor};
  border-left: 1px solid ${(p) => p.borderColor};
  box-sizing: border-box;
  user-select: text;
`

const Header = styled.div<{ borderColor: string }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid ${(p) => p.borderColor};
  flex-shrink: 0;
  height: 64px;
  box-sizing: border-box;
`

const Title = styled.h3<{ color: string }>`
  margin: 0;
  color: ${(p) => p.color};
  font-weight: 500;
  font-size: 15px;
  line-height: 20px;
  letter-spacing: -0.2px;
`

const CloseButton = styled.button<{ hoverBackground: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  transition: background-color 0.15s;
  &:hover {
    background-color: ${(p) => p.hoverBackground};
  }
`

const SearchInputWrapper = styled.div<{ backgroundColor: string }>`
  display: flex;
  align-items: center;
  margin: 12px;
  padding: 8px 12px;
  background-color: ${(p) => p.backgroundColor};
  border-radius: 10px;
  flex-shrink: 0;
`

const SearchIconWrapper = styled.span`
  display: flex;
  flex-shrink: 0;
  margin-right: 6px;
  > svg {
    width: 16px;
    height: 16px;
  }
`

const SearchInput = styled.input<{ color: string; placeholderColor: string }>`
  flex: 1;
  border: none;
  outline: none;
  background: none;
  font-size: 15px;
  line-height: 20px;
  color: ${(p) => p.color};
  &::placeholder {
    color: ${(p) => p.placeholderColor};
  }
`

const NavButtons = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  margin-right: 4px;
`

const NavButton = styled.button<{ hoverBackground: string; iconColor: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  border-radius: 50%;
  transition: background-color 0.15s;
  &:hover:not(:disabled) {
    background-color: ${(p) => p.hoverBackground};
  }
  &:disabled {
    cursor: default;
    opacity: 0.35;
  }
  & > svg {
    margin: -6px;
    color: ${(p) => p.iconColor};
  }
`

const ClearButton = styled.button<{ hoverBackground: string }>`
  display: flex;
  align-items: center;
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  border-radius: 50%;
  &:hover {
    background-color: ${(p) => p.hoverBackground};
  }

  & > svg {
    width: 11px;
    height: 11px;
  }
`

const ResultsList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0 8px 8px 8px;
`

const StatusText = styled.p<{ color: string; full?: boolean }>`
  text-align: center;
  color: ${(p) => p.color};
  ${(props) => (props.full ? 'height: 100%;' : '')}
  align-items: center;
  display: flex;
  justify-content: center;
  font-weight: 400;
  font-size: 15px;
  line-height: 20px;
  margin: 0;
`

const GroupSection = styled.div`
  position: relative;
`

const GroupLabel = styled.div<{ color: string; backgroundColor: string }>`
  position: sticky;
  top: 0;
  z-index: 1;
  background-color: ${(p) => p.backgroundColor};
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: ${(p) => p.color};
  padding: 12px 16px 4px;
`

const ResultItem = styled.div<{ hoverBackground: string; isActive: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 16px;
  cursor: pointer;
  transition: background-color 0.1s;
  border-radius: 12px;
  background-color: ${(p) => (p.isActive ? p.hoverBackground : 'transparent')};
  &:hover {
    background-color: ${(p) => p.hoverBackground};
  }
`

const ResultAvatar = styled.div`
  flex-shrink: 0;
`

const ResultContent = styled.div`
  flex: 1;
  min-width: 0;
`

const ResultMeta = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 2px;
`

const ResultSender = styled.span<{ color: string }>`
  font-size: 14px;
  font-weight: 600;
  color: ${(p) => p.color};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const ResultTime = styled.span<{ color: string }>`
  font-size: 11px;
  color: ${(p) => p.color};
  flex-shrink: 0;
`

const ResultBody = styled.div<{ color: string }>`
  font-size: 13px;
  color: ${(p) => p.color};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const Highlight = styled.mark<{ bgColor: string }>`
  background-color: ${(p) => p.bgColor};
  border-radius: 3px;
  padding: 0 2px;
`

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 0 24px;
  gap: 12px;
  & > svg {
    width: 56px;
    height: 56px;
  }
`

const EmptyStateText = styled.p<{ color: string }>`
  margin: 0;
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  color: ${(p) => p.color};
  text-align: center;
`
