import styled from 'styled-components'
import React, { useEffect, useRef, useState } from 'react'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import { LOADING_STATE, PRESENCE_STATUS } from '../../../Helpers/constants'
import { colors } from '../../../UIHelper/constants'
import { IReaction } from '../../../types'
import { AvatarWrapper, UserStatus } from '../../../components/Channel'
import { Avatar } from '../../../components'
import { makeUserName, userLastActiveDateFormat } from '../../../helpers'
import { contactsMapSelector } from '../../../store/user/selector'
import { getShowOnlyContactUsers } from '../../../helpers/contacts'
import { getClient } from '../../client'
import { useEventListener } from '../../../hooks'
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
  handleAddDeleteEmoji: (selectedEmoji: string) => void
  handleReactionsPopupClose: () => void
  bottomPosition: number
  horizontalPositions: { left: number; right: number }
  reactionScores: { [key: string]: number }
  rtlDirection?: boolean
}
let reactionsPrevLength: any = 0
export default function ReactionsPopup({
  messageId,
  handleReactionsPopupClose,
  handleAddDeleteEmoji,
  bottomPosition,
  // horizontalPositions,
  reactionScores,
  rtlDirection
}: IReactionsPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null)
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
  const [calculateSizes, setCalculateSizes] = useState(false)
  const [closeIsApproved, setCloseIsApproved] = useState(false)
  let totalReactions = 0
  const reactionsList = Object.keys(reactionScores).map((key) => {
    totalReactions += reactionScores[key]
    return {
      key,
      count: reactionScores[key]
    }
  })
  const user = getClient().user
  const dispatch = useDispatch()
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
    if (reactions && reactionsPrevLength < reactions.length) {
      const reactionsHeight = reactions.length * 44 + 45
      if (reactionsHeight > popupHeight) {
        setPopupHeight(reactionsHeight)
      }
      reactionsPrevLength = reactions.length
    } else {
      reactionsPrevLength = !reactions ? 0 : reactions.length
    }
  }, [reactions])

  useEffect(() => {
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
        const reactionsHeight = reactions.length * 44 + 45
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
      visible={!!(reactions && reactions.length && reactionsLoadingState === LOADING_STATE.LOADED)}
      rtlDirection={rtlDirection}
    >
      <ReactionScoresCont>
        <ReactionScoresList>
          <ReactionScoreItem active={activeTabKey === 'all'} onClick={() => handleGetReactions()}>
            <span>{`All ${totalReactions}`}</span>
          </ReactionScoreItem>
          {reactionsList.map((reaction) => (
            <ReactionScoreItem
              key={reaction.key}
              onClick={() => handleGetReactions(reaction.key)}
              active={activeTabKey === reaction.key}
              activeColor={colors.primary}
            >
              <span>
                <TabKey>{reaction.key}</TabKey>
                {reaction.count}
              </span>
            </ReactionScoreItem>
          ))}
        </ReactionScoresList>
      </ReactionScoresCont>
      <ReactionsList onScroll={handleReactionsListScroll} popupHeight={popupHeight}>
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
              <MemberName>
                {makeUserName(
                  reaction.user.id === user.id ? reaction.user : contactsMap[reaction.user.id],
                  reaction.user,
                  getFromContacts
                )}
              </MemberName>
              <SubTitle>
                {reaction.user.presence && reaction.user.presence.state === PRESENCE_STATUS.ONLINE
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
  height: number
  visible?: any
  rtlDirection?: boolean
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
  background: #ffffff;
  //border: 1px solid #dfe0eb;
  box-shadow: 0 6px 24px -6px rgba(15, 34, 67, 0.12), 0px 1px 3px rgba(24, 23, 37, 0.14);
  box-sizing: border-box;
  //box-shadow: 0 0 12px rgba(0, 0, 0, 0.08);
  border-radius: 6px;
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

    background: ${colors.white};
  }
`

const UserNamePresence = styled.div`
  width: 100%;
  margin-left: 12px;
`

const MemberName = styled.h3`
  margin: 0;
  max-width: calc(100% - 1px);
  font-weight: 500;
  font-size: 15px;
  line-height: 18px;
  letter-spacing: -0.2px;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;

  & > span {
    color: #abadb7;
  }
`

const ReactionsList = styled.ul<{ popupHeight?: any }>`
  margin: 0;
  padding: 0;
  overflow: ${(props) => !props.popupHeight && 'hidden'};
  overflow-x: hidden;
  list-style: none;
  transition: all 0.2s;
  height: calc(100% - 45px); ;
`

const ReactionScoresCont = styled.div`
  max-width: 100%;
  overflow-y: auto;
`

const ReactionScoresList = styled.div`
  display: flex;
  border-bottom: 1px solid ${colors.gray1};
`

const ReactionScoreItem = styled.div<any>`
  position: relative;
  display: flex;
  white-space: nowrap;
  padding: 12px;
  font-weight: 500;
  font-size: 13px;
  line-height: 20px;
  border-bottom: 1px solid ${colors.gray1};
  color: ${(props) => (props.active ? colors.gray6 : colors.gray9)};
  margin-bottom: -1px;
  cursor: pointer;
  & > span {
    position: relative;
    ${(props) =>
      props.active &&
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
  }`}
  }
`

const TabKey = styled.span`
  font-family: apple color emoji, segoe ui emoji, noto color emoji, android emoji, emojisymbols, emojione mozilla,
    twemoji mozilla, segoe ui symbol;
  margin-right: 4px;
  font-size: 15px;
`

const ReactionKey = styled.span`
  font-family: apple color emoji, segoe ui emoji, noto color emoji, android emoji, emojisymbols, emojione mozilla,
    twemoji mozilla, segoe ui symbol;
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
