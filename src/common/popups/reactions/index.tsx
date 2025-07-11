import styled from 'styled-components'
import React, { useEffect, useRef, useState } from 'react'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import { LOADING_STATE, USER_PRESENCE_STATUS } from '../../../helpers/constants'
import { colors, THEME_COLORS } from '../../../UIHelper/constants'
import { IReaction } from '../../../types'
import { AvatarWrapper, UserStatus } from '../../../components/Channel'
import { Avatar } from '../../../components'
import { userLastActiveDateFormat } from '../../../helpers'
import { makeUsername } from '../../../helpers/message'
import { contactsMapSelector } from '../../../store/user/selector'
import { getShowOnlyContactUsers } from '../../../helpers/contacts'
import { getClient } from '../../client'
import { useColor, useEventListener } from '../../../hooks'
import { SubTitle } from '../../../UIHelper'
import { getReactionsAC, loadMoreReactionsAC, setReactionsListAC } from '../../../store/message/actions'
import {
  reactionsHasNextSelector,
  reactionsListSelector,
  reactionsLoadingStateSelector,
  sendMessageInputHeightSelector
} from '../../../store/message/selector'

interface IReactionsPopupProps {
  messageId: string
  // eslint-disable-next-line no-unused-vars
  handleAddDeleteEmoji: (selectedEmoji: string) => void
  handleReactionsPopupClose: () => void
  bottomPosition: number
  horizontalPositions: { left: number; right: number }
  reactionTotals: {
    key: string
    count: number
    score: number
  }[]
  rtlDirection?: boolean
  reactionsDetailsPopupBorderRadius?: string
  reactionsDetailsPopupHeaderItemsStyle?: 'bubbles' | 'inline'
}
let reactionsPrevLength: any = 0
export default function ReactionsPopup({
  messageId,
  handleReactionsPopupClose,
  handleAddDeleteEmoji,
  bottomPosition,
  // horizontalPositions,
  reactionTotals,
  reactionsDetailsPopupBorderRadius,
  reactionsDetailsPopupHeaderItemsStyle,
  rtlDirection
}: IReactionsPopupProps) {
  const {
    [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.SECTION_BACKGROUND]: sectionBackgroundColor
  } = useColor()

  const popupRef = useRef<HTMLDivElement>(null)
  const scoresRef = useRef<HTMLDivElement>(null)
  const reactions = useSelector(reactionsListSelector, shallowEqual)
  const messageInputHeight = useSelector(sendMessageInputHeightSelector, shallowEqual)
  // const channelListWidth = useSelector(channelListWidthSelector, shallowEqual)
  // const channelDetailsIsOpen = useSelector(channelInfoIsOpenSelector, shallowEqual)
  const reactionsHasNext = useSelector(reactionsHasNextSelector, shallowEqual)
  const reactionsLoadingState = useSelector(reactionsLoadingStateSelector, shallowEqual)
  const contactsMap = useSelector(contactsMapSelector)
  const getFromContacts = getShowOnlyContactUsers()
  const [activeTabKey, setActiveTabKey] = useState('all')
  const [popupVerticalPosition, setPopupVerticalPosition] = useState('')
  // const [popupHorizontalPosition, setPopupHorizontalPosition] = useState('')
  const [popupHeight, setPopupHeight] = useState(0)
  const [scoresHeight, setScoresHeight] = useState(0)
  const [calculateSizes, setCalculateSizes] = useState(false)
  const [closeIsApproved, setCloseIsApproved] = useState(false)
  let totalReactions = 0
  if (reactionTotals) {
    reactionTotals.forEach((summery) => {
      totalReactions += summery.count
    })
  }

  const user = getClient().user
  const dispatch = useDispatch()
  const [isScrolling, setIsScrolling] = useState<boolean>(false)

  const handleReactionsListScroll = (event: any) => {
    if (event.target.scrollTop >= event.target.scrollHeight - event.target.offsetHeight - 100 && reactionsHasNext) {
      if (reactionsLoadingState === LOADING_STATE.LOADED) {
        dispatch(loadMoreReactionsAC(15))
      }
    }
  }
  const handleClicks = (e: any) => {
    if (e.target.closest('.reactions_popup')) {
      return
    }
    if (closeIsApproved) {
      handleReactionsPopupClose()
    }
  }

  const handleGetReactions = (key?: string) => {
    dispatch(getReactionsAC(messageId, key))
    setActiveTabKey(key || 'all')
  }

  useEventListener('click', handleClicks)

  useEffect(() => {
    handleGetReactions()
    setCloseIsApproved(true)
    setCalculateSizes(true)
    return () => {
      dispatch(setReactionsListAC([], true))
    }
  }, [messageId])
  useEffect(() => {
    const scoresElem = scoresRef.current
    if (scoresElem) {
      setScoresHeight(scoresElem.offsetHeight)
    }
  })

  useEffect(() => {
    if (!reactionTotals || !reactionTotals.length) {
      handleReactionsPopupClose()
    }
  }, [reactionTotals])

  useEffect(() => {
    if (reactions && reactionsPrevLength < reactions.length) {
      const reactionsHeight = reactions.length * 44 + 45
      if (reactionsHeight > popupHeight) {
        setPopupHeight(reactionsHeight)
      }
      reactionsPrevLength = reactions.length
    } else {
      reactionsPrevLength = !reactions ? 0 : reactions.length
    }

    if (reactions && reactions.length) {
      if (calculateSizes) {
        // const popupPos = popupRef.current?.getBoundingClientRect()
        /*  if (rtlDirection) {
          setPopupHorizontalPosition(
            horizontalPositions.right - (channelDetailsIsOpen ? 362 : 0) > popupPos?.width! ? 'right' : 'left'
          )
        } else {
          setPopupHorizontalPosition(horizontalPositions.left - channelListWidth > popupPos?.width! ? 'left' : 'right')
        } */
        const botPost = bottomPosition - messageInputHeight - 40
        const reactionsHeight = reactions.length * 50 + 45
        setPopupHeight(reactionsHeight)
        setPopupVerticalPosition(botPost >= (reactionsHeight > 320 ? 320 : reactionsHeight) ? 'bottom' : 'top')
        setCalculateSizes(false)
      }
    }
  }, [reactions])
  return (
    <Container
      ref={popupRef}
      popupVerticalPosition={popupVerticalPosition}
      // popupHorizontalPosition={popupHorizontalPosition}
      className='reactions_popup'
      height={popupHeight}
      visible={!calculateSizes}
      rtlDirection={rtlDirection}
      borderRadius={reactionsDetailsPopupBorderRadius}
      backgroundColor={sectionBackgroundColor}
    >
      <ReactionScoresCont
        ref={scoresRef}
        className={isScrolling ? 'show-scrollbar' : ''}
        onMouseEnter={() => setIsScrolling(true)}
        onMouseLeave={() => setIsScrolling(false)}
      >
        <ReactionScoresList borderBottom={reactionsDetailsPopupHeaderItemsStyle !== 'bubbles'}>
          <ReactionScoreItem
            bubbleStyle={reactionsDetailsPopupHeaderItemsStyle === 'bubbles'}
            active={activeTabKey === 'all'}
            color={textSecondary}
            activeBackgroundColor={accentColor}
            activeColor={textPrimary}
            onClick={() => handleGetReactions()}
          >
            <span>{`All ${totalReactions}`}</span>
          </ReactionScoreItem>
          {reactionTotals.map((reaction) => (
            <ReactionScoreItem
              bubbleStyle={reactionsDetailsPopupHeaderItemsStyle === 'bubbles'}
              key={reaction.key}
              onClick={() => handleGetReactions(reaction.key)}
              active={activeTabKey === reaction.key}
              color={textSecondary}
              activeBackgroundColor={accentColor}
              activeColor={textPrimary}
            >
              <span>
                <TabKey>{reaction.key}</TabKey>
                {reaction.count}
              </span>
            </ReactionScoreItem>
          ))}
        </ReactionScoresList>
      </ReactionScoresCont>
      <ReactionsList
        className={isScrolling ? 'show-scrollbar' : ''}
        scoresHeight={scoresHeight}
        onScroll={handleReactionsListScroll}
        popupHeight={popupHeight}
        onMouseEnter={() => setIsScrolling(true)}
        onMouseLeave={() => setIsScrolling(false)}
      >
        {reactions.map((reaction: IReaction) => (
          <ReactionItem key={reaction.id}>
            <AvatarWrapper>
              <Avatar
                name={reaction.user.firstName || reaction.user.id}
                image={reaction.user.avatarUrl}
                size={40}
                textSize={14}
                setDefaultAvatar
              />
            </AvatarWrapper>
            <UserNamePresence>
              <MemberName color={textPrimary}>
                {makeUsername(
                  reaction.user.id === user.id ? reaction.user : contactsMap[reaction.user.id],
                  reaction.user,
                  getFromContacts
                )}
              </MemberName>
              <SubTitle color={textSecondary}>
                {reaction.user.presence && reaction.user.presence.state === USER_PRESENCE_STATUS.ONLINE
                  ? 'Online'
                  : reaction.user.presence &&
                    reaction.user.presence.lastActiveAt &&
                    userLastActiveDateFormat(reaction.user.presence.lastActiveAt)}
              </SubTitle>
            </UserNamePresence>
            <ReactionKey onClick={() => handleAddDeleteEmoji(reaction.key)}>{reaction.key}</ReactionKey>
          </ReactionItem>
        ))}
      </ReactionsList>
    </Container>
  )
}

const Container = styled.div<{
  popupVerticalPosition: string
  popupHorizontalPosition?: string
  borderRadius?: string
  height: number
  visible?: any
  rtlDirection?: boolean
  backgroundColor?: string
}>`
  position: absolute;
  /*right: ${(props) => props.popupHorizontalPosition === 'left' && (props.rtlDirection ? 'calc(100% - 80px)' : 0)};*/
  right: ${(props) => props.rtlDirection && 0};
  /*left: ${(props) => props.popupHorizontalPosition === 'right' && (!props.rtlDirection ? 'calc(100% - 80px)' : 0)};*/
  left: ${(props) => !props.rtlDirection && 0};
  top: ${(props) => props.popupVerticalPosition === 'bottom' && '100%'};
  bottom: ${(props) => props.popupVerticalPosition === 'top' && '42px'};
  width: 340px;
  height: ${(props) => props.height && props.height + 22}px;
  //overflow: ${(props) => !props.height && 'hidden'};
  overflow: hidden;
  max-height: 320px;
  background: ${(props) => props.backgroundColor || colors.white};
  //border: 1px solid #dfe0eb;
  box-shadow:
    0 6px 24px -6px rgba(15, 34, 67, 0.12),
    0px 1px 3px rgba(24, 23, 37, 0.14);
  box-sizing: border-box;
  //box-shadow: 0 0 12px rgba(0, 0, 0, 0.08);
  border-radius: ${(props) => props.borderRadius || '12px'};
  visibility: ${(props) => (props.visible ? 'visible' : 'hidden')};
  transition: all 0.2s;

  direction: initial;
  z-index: 12;
  &::after {
    content: '';
    position: absolute;
    width: 12px;
    height: 12px;

    right: ${(props) => props.popupHorizontalPosition === 'left' && '18px'};
    left: ${(props) => props.popupHorizontalPosition === 'right' && '18px'};
    top: ${(props) => props.popupVerticalPosition === 'bottom' && '-3px;'};
    bottom: ${(props) => props.popupVerticalPosition === 'top' && '-3px'};
    transform: rotate(45deg);
    box-shadow: ${(props) =>
      props.popupVerticalPosition === 'top'
        ? '4px 4px 5px -4px rgba(15, 34, 67, 0.12)'
        : '-4px -4px 5px -4px rgba(15, 34, 67, 0.12)'};
    border-radius: 2px;
    visibility: ${(props) => (props.visible ? 'visible' : 'hidden')};
    transition-delay: 150ms;
    transition-property: visibility;

    background: ${(props) => props.backgroundColor || colors.white};
  }
`

const UserNamePresence = styled.div`
  width: 100%;
  margin-left: 12px;
`

const MemberName = styled.h3<{ color?: string }>`
  margin: 0;
  max-width: calc(100% - 47px);
  font-weight: 500;
  font-size: 15px;
  line-height: 18px;
  letter-spacing: -0.2px;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  color: ${(props) => props.color || colors.gray0};
  & > span {
    color: ${(props) => props.color || colors.gray0};
  }
`

const ReactionsList = styled.ul<{ popupHeight?: any; scoresHeight?: number }>`
  margin: 0;
  padding: 0;
  overflow: ${(props) => !props.popupHeight && 'hidden'};
  overflow-x: hidden;
  list-style: none;
  transition: all 0.2s;
  height: ${(props) => `calc(100% - ${props.scoresHeight || 57}px)`};
    calc(100% - 57px);

  &.show-scrollbar {
    overflow-x: hidden;
  }
  &::-webkit-scrollbar {
    width: 8px;
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: transparent;
  }

  &.show-scrollbar::-webkit-scrollbar-thumb {
    background: #818c99;
    border-radius: 4px;
  }
  &.show-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
`

const ReactionScoresCont = styled.div`
  max-width: 100%;
  overflow-y: auto;
  &.show-scrollbar {
    overflow-x: hidden;
  }
  &::-webkit-scrollbar {
    width: 8px;
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: transparent;
  }

  &.show-scrollbar::-webkit-scrollbar-thumb {
    background: #818c99;
    border-radius: 4px;
  }
  &.show-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
`

const ReactionScoresList = styled.div<{ borderBottom: boolean }>`
  display: flex;
  border-bottom: ${(props) => props.borderBottom && `1px solid ${colors.gray1}`};
  padding: 2px 8px 0;
`

const TabKey = styled.span``

const ReactionScoreItem = styled.div<{
  bubbleStyle: boolean
  color: string
  activeColor: string
  activeBackgroundColor: string
  active?: boolean
}>`
  position: relative;
  display: flex;
  white-space: nowrap;
  padding: ${(props) => (props.bubbleStyle ? '12px 4px' : '12px')};
  font-weight: 500;
  font-size: 13px;
  border-bottom: ${(props) => !props.bubbleStyle && `1px solid ${colors.gray1}`};
  color: ${(props) => (props.active ? props.activeColor : props.color)};
  margin-bottom: -1px;
  cursor: pointer;
  & > span {
    position: relative;
    border: ${(props) => props.bubbleStyle && !props.active && `1px solid ${colors.gray1}`};
    padding: ${(props) => props.bubbleStyle && '6px 12px'};
    border-radius: 16px;
    height: 30px;
    box-sizing: border-box;
    font-family: Inter, sans-serif;
    font-style: normal;
    font-weight: 600;
    font-size: 14px;
    line-height: ${(props) => (props.bubbleStyle ? '18px' : '30px')};
    background-color: ${(props) => props.active && props.bubbleStyle && props.activeBackgroundColor};
    color: ${(props) => props.active && props.bubbleStyle && colors.white};
    ${(props) =>
      props.active &&
      !props.bubbleStyle &&
      `
    &::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: -13px;
    width: 100%;
    height: 2px;
    background-color: ${props.activeColor || colors.primary};
    border-radius: 2px;
    }
  `}

    & ${TabKey} {
      font-family:
        apple color emoji,
        segoe ui emoji,
        noto color emoji,
        android emoji,
        emojisymbols,
        emojione mozilla,
        twemoji mozilla,
        segoe ui symbol;
      margin-right: 4px;
      font-size: 15px;
    }
  }
`

const ReactionKey = styled.span`
  font-family:
    apple color emoji,
    segoe ui emoji,
    noto color emoji,
    android emoji,
    emojisymbols,
    emojione mozilla,
    twemoji mozilla,
    segoe ui symbol;
  font-size: 20px;
  cursor: pointer;
`

const ReactionItem = styled.li<{ isActiveItem?: boolean }>`
  display: flex;
  align-items: center;
  font-size: 15px;
  padding: 6px 16px;
  transition: all 0.2s;

  & ${UserStatus} {
    width: 10px;
    height: 10px;
  }
`
