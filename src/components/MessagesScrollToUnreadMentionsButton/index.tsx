import styled from 'styled-components'
import { useDispatch, useSelector } from 'react-redux'
import React, { useEffect } from 'react'
// Store
import { activeChannelSelector } from '../../store/channel/selector'
import { getMessagesAC } from '../../store/message/actions'
import { getChannelMentionsAC, markMessagesAsReadAC, updateChannelDataAC } from '../../store/channel/actions'
import {
  sendMessageInputHeightSelector,
  showScrollToNewMessageButtonSelector,
  activeChannelMessagesSelector
} from '../../store/message/selector'
import { themeSelector } from '../../store/theme/selector'
// Assets
import { ReactComponent as MentionIcon } from '../../assets/svg/mention.svg'
// Helpers
import { THEME_COLORS } from '../../UIHelper/constants'
import { IChannel } from '../../types'
import { UnreadCountProps } from '../Channel'
import { useColor } from '../../hooks'

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
  unreadCountTextColor
}) => {
  const { [THEME_COLORS.ACCENT]: accentColor, [THEME_COLORS.BACKGROUND_SECTIONS]: backgroundSections } = useColor()

  const dispatch = useDispatch()
  const channel: IChannel = useSelector(activeChannelSelector)
  const theme = useSelector(themeSelector)
  const sendMessageInputHeight: number = useSelector(sendMessageInputHeightSelector)
  const showScrollToNewMessageButton: IChannel = useSelector(showScrollToNewMessageButtonSelector)
  const messages = useSelector(activeChannelMessagesSelector) || []

  const handleScrollToBottom = () => {
    if (channel.newMentionCount >= 3 && (!channel.mentionsIds || channel.mentionsIds.length < 3)) {
      dispatch(getChannelMentionsAC(channel.id))
    }

    if (channel.mentionsIds && channel.mentionsIds.length) {
      handleScrollToRepliedMessage(channel.mentionsIds[0])
      dispatch(markMessagesAsReadAC(channel.id, [channel.mentionsIds[0]]))
      dispatch(updateChannelDataAC(channel.id, { mentionsIds: channel.mentionsIds.slice(1) }))
    }
  }
  const handleScrollToRepliedMessage = async (messageId: string) => {
    if (messages.findIndex((msg) => msg.id === messageId) >= 10) {
      const repliedMessage = document.getElementById(messageId)
      if (repliedMessage) {
        const scrollRef = document.getElementById('scrollableDiv')
        if (scrollRef) {
          scrollRef.scrollTop = repliedMessage.offsetTop - scrollRef.offsetHeight / 2
        }
        repliedMessage.classList.add('highlight')
        setTimeout(() => {
          repliedMessage.classList.remove('highlight')
        }, 1000)
      }
    } else {
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
      {channel.newMentionCount ? (
        <BottomButton
          theme={theme}
          width={buttonWidth}
          height={buttonHeight}
          border={buttonBorder}
          borderRadius={buttonBorderRadius}
          backgroundColor={buttonBackgroundColor || backgroundSections}
          hoverBackgroundColor={buttonHoverBackgroundColor}
          shadow={buttonShadow}
          onClick={handleScrollToBottom}
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
      ) : null}
    </React.Fragment>
  )
}

export default MessagesScrollToUnreadMentionsButton

const BottomButton = styled.div<{
  theme?: string
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
}>`
  position: absolute;
  bottom: ${(props) =>
    `${
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
