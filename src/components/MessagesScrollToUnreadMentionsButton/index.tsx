import styled from 'styled-components'
import { useSelector, useDispatch } from 'store/hooks'
import React, { useCallback, useEffect } from 'react'
// Store
import { activeChannelSelector } from '../../store/channel/selector'
import { getMessagesAC } from '../../store/message/actions'
import { getChannelMentionsAC, markMessagesAsReadAC, updateChannelDataAC } from '../../store/channel/actions'
import {
  sendMessageInputHeightSelector,
  showScrollToNewMessageButtonSelector,
  activeChannelMessagesSelector
} from '../../store/message/selector'
// Assets
import { ReactComponent as MentionIcon } from '../../assets/svg/mention.svg'
// Helpers
import { THEME_COLORS } from '../../UIHelper/constants'
import { IChannel } from '../../types'
import { UnreadCountProps } from '../Channel'
import { useColor } from '../../hooks'
import { MESSAGE_DELIVERY_STATUS } from 'helpers/constants'
import { setScrollToMentionedMessageAC } from 'store/message/actions'

interface MessagesScrollToUnreadMentionsButtonProps {
  buttonIcon?: JSX.Element
  buttonWidth?: string
  buttonHeight?: string
  bottomPosition?: number
  rightPosition?: number
  buttonBorder?: string
  buttonBackgroundColor?: string
  buttonHoverBackgroundColor?: string
  buttonBorderRadius?: string
  buttonShadow?: string
  unreadCountWidth?: string
  unreadCountHeight?: string
  unreadCountFontSize?: string
  unreadCountTextColor?: string
  unreadCountBackgroundColor?: string
  animateFrom?: string
}

const MessagesScrollToUnreadMentionsButton: React.FC<MessagesScrollToUnreadMentionsButtonProps> = ({
  buttonIcon,
  buttonWidth,
  buttonHeight,
  bottomPosition,
  rightPosition,
  buttonBorder,
  buttonBackgroundColor,
  buttonHoverBackgroundColor,
  buttonBorderRadius,
  buttonShadow,
  unreadCountWidth,
  unreadCountHeight,
  unreadCountFontSize,
  unreadCountTextColor,
  animateFrom = 'bottom'
}) => {
  const { [THEME_COLORS.ACCENT]: accentColor, [THEME_COLORS.BACKGROUND_SECTIONS]: backgroundSections } = useColor()

  const dispatch = useDispatch()
  const channel: IChannel = useSelector(activeChannelSelector)
  const sendMessageInputHeight: number = useSelector(sendMessageInputHeightSelector)
  const showScrollToNewMessageButton: IChannel = useSelector(showScrollToNewMessageButtonSelector)
  const messages = useSelector(activeChannelMessagesSelector) || []
  const isMessageRead = useCallback(
    (messageId: string) => {
      const message = messages.find((msg) => msg.id === messageId)
      return message?.userMarkers?.find((marker: any) => marker.name === MESSAGE_DELIVERY_STATUS.READ)
    },
    [messages]
  )

  const handleScrollToMentions = (mentionsIds: string[]) => {
    let newMentionsIds: string[] = [...mentionsIds]
    const isRead = isMessageRead(mentionsIds[0])
    if (!isRead) {
      handleScrollToMentionedMessage(mentionsIds[0])
      dispatch(markMessagesAsReadAC(channel.id, [mentionsIds[0]]))
      newMentionsIds = mentionsIds.slice(1)
      dispatch(updateChannelDataAC(channel.id, { mentionsIds: newMentionsIds }))
    } else {
      newMentionsIds = mentionsIds.slice(1)
      if (newMentionsIds.length > 0) {
        handleScrollToMentions(newMentionsIds)
      } else {
        dispatch(updateChannelDataAC(channel.id, { mentionsIds: [] }))
        return
      }
    }

    if (channel.newMentionCount >= 3 && (!newMentionsIds || newMentionsIds.length < 3)) {
      dispatch(getChannelMentionsAC(channel.id))
    }
  }

  const handleScrollToMentionedMessage = async (messageId: string) => {
    if (messages.findIndex((msg) => msg.id === messageId) >= 10) {
      const repliedMessage = document.getElementById(messageId)
      if (repliedMessage) {
        const scrollRef = document.getElementById('scrollableDiv') as HTMLElement
        if (scrollRef) {
          // Function to handle scroll completion
          const handleScrollEnd = () => {
            dispatch(setScrollToMentionedMessageAC(false))
          }

          // Modern browsers: use scrollend event
          const handleScrollEndEvent = () => {
            scrollRef.removeEventListener('scrollend', handleScrollEndEvent)
            handleScrollEnd()
          }

          // Fallback for older browsers: detect scroll end manually
          let scrollTimeout: NodeJS.Timeout
          const handleScrollEvent = () => {
            clearTimeout(scrollTimeout)
            scrollTimeout = setTimeout(() => {
              scrollRef.removeEventListener('scroll', handleScrollEvent)
              handleScrollEnd()
            }, 150) // Wait 150ms after last scroll event
          }

          // Add event listeners
          if ('onscrollend' in scrollRef) {
            ;(scrollRef as Element).addEventListener('scrollend', handleScrollEndEvent)
          } else {
            ;(scrollRef as Element).addEventListener('scroll', handleScrollEvent)
          }
          dispatch(setScrollToMentionedMessageAC(true))
          scrollRef.scrollTo({
            top: repliedMessage.offsetTop - scrollRef.offsetHeight / 2,
            behavior: 'smooth'
          })
        }
        repliedMessage.classList.add('highlight')
        setTimeout(() => {
          repliedMessage.classList.remove('highlight')
        }, 1500)
      }
    } else if (channel?.id) {
      // await handleGetMessages(undefined, messageId)
      dispatch(getMessagesAC(channel, undefined, messageId))
    }
  }

  useEffect(() => {
    if (channel.newMentionCount && (!channel.mentionsIds || channel.mentionsIds.length < 3)) {
      dispatch(getChannelMentionsAC(channel.id))
    }
  }, [channel.newMentionCount])

  return (
    <React.Fragment>
      <BottomButton
        animateFrom={animateFrom}
        show={!!channel.newMentionCount}
        width={buttonWidth}
        height={buttonHeight}
        border={buttonBorder}
        borderRadius={buttonBorderRadius}
        backgroundColor={buttonBackgroundColor || backgroundSections}
        hoverBackgroundColor={buttonHoverBackgroundColor}
        shadow={buttonShadow}
        onClick={() => handleScrollToMentions(channel.mentionsIds || [])}
        bottomOffset={sendMessageInputHeight}
        bottomPosition={bottomPosition}
        showsUnreadMentionsButton={!!showScrollToNewMessageButton}
        rightPosition={rightPosition}
      >
        {!!(channel.newMentionCount && channel.newMentionCount > 0) && (
          <UnreadCount
            width={unreadCountWidth}
            height={unreadCountHeight}
            textColor={unreadCountTextColor}
            fontSize={unreadCountFontSize}
            backgroundColor={accentColor}
            isMuted={channel.muted}
          >
            {channel.newMentionCount ? (channel.newMentionCount > 99 ? '99+' : channel.newMentionCount) : ''}
          </UnreadCount>
        )}
        {buttonIcon || <MentionIcon />}
      </BottomButton>
    </React.Fragment>
  )
}

export default MessagesScrollToUnreadMentionsButton

const BottomButton = styled.div<{
  width?: string
  height?: string
  border?: string
  borderRadius?: string
  backgroundColor: string
  hoverBackgroundColor?: string
  shadow?: string
  bottomOffset: number
  bottomPosition?: number
  rightPosition?: number
  showsUnreadMentionsButton?: boolean
  animateFrom?: string
  show?: boolean
}>`
  transition: all 0.3s ease-in-out;
  position: absolute;
  ${(props) =>
    props.animateFrom === 'bottom' &&
    `bottom: ${
      props.bottomOffset +
      (props.bottomPosition === undefined ? 45 : props.bottomPosition) +
      (props.showsUnreadMentionsButton ? 60 : 0) -
      180
    }px`};

  ${(props) =>
    props.animateFrom === 'right' && `right: ${props.rightPosition === undefined ? 16 : props.rightPosition - 100}px`};

  ${(props) =>
    props.show &&
    `bottom: ${
      props.bottomOffset +
      (props.bottomPosition === undefined ? 45 : props.bottomPosition) +
      (props.showsUnreadMentionsButton ? 60 : 0)
    }px`};
  right: ${(props) => `${props.rightPosition === undefined ? 16 : props.rightPosition}px`};
  margin-right: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: ${(props) => props.backgroundColor};
  border: 0.5px solid rgba(0, 0, 0, 0.1);
  border-radius: 50px;
  width: 48px;
  height: 48px;
  cursor: pointer;
  z-index: 14;

  & > svg {
    color: rgba(129, 140, 153, 1);
  }

  & > span {
    bottom: 32px;
    right: 0;
  }
`

const UnreadCount = styled.span<UnreadCountProps>`
  position: absolute;
  bottom: 11px;
  right: 16px;
  flex: 0 0 auto;
  margin-left: auto;
  background-color: ${(props) => props.backgroundColor};
  padding: 0 4px;
  font-size: ${(props) => props.fontSize || '13px'};
  line-height: 20px;
  min-width: ${(props) => props.width || '20px'};
  height: ${(props) => props.height || '20px'};
  text-align: center;
  font-weight: 500;
  color: ${(props) => props.textColor || '#fff'};
  border-radius: 10px;
  box-sizing: border-box;
`
