import styled from 'styled-components'
import { useDispatch, useSelector } from 'react-redux'
import React from 'react'
// Store
import { activeChannelSelector } from '../../store/channel/selector'
import { getMessagesAC } from '../../store/message/actions'
import {
  activeChannelMessagesSelector,
  sendMessageInputHeightSelector,
  showScrollToNewMessageButtonSelector
} from '../../store/message/selector'
import { themeSelector } from '../../store/theme/selector'
// Assets
import { ReactComponent as BottomIcon } from '../../assets/svg/chevron_down.svg'
// Helpers
import { THEME_COLORS } from '../../UIHelper/constants'
import { IChannel } from '../../types'
import { UnreadCountProps } from '../Channel'
import { useColor } from '../../hooks'
import { markMessagesAsReadAC } from 'store/channel/actions'

interface MessagesScrollToBottomButtonProps {
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

const MessagesScrollToBottomButton: React.FC<MessagesScrollToBottomButtonProps> = ({
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
  const theme = useSelector(themeSelector)
  const sendMessageInputHeight: number = useSelector(sendMessageInputHeightSelector)
  const showScrollToNewMessageButton: IChannel = useSelector(showScrollToNewMessageButtonSelector)
  const messages = useSelector(activeChannelMessagesSelector) || []
  const handleScrollToBottom = () => {
    dispatch(markMessagesAsReadAC(channel.id, [channel.lastMessage.id]))
    handleScrollToRepliedMessage(channel.lastMessage.id)
  }
  const handleScrollToRepliedMessage = async (messageId: string) => {
    if (messages.findIndex((msg) => msg.id === messageId) >= 10) {
      const repliedMessage = document.getElementById(messageId)
      if (repliedMessage) {
        const scrollRef = document.getElementById('scrollableDiv')
        if (scrollRef) {
          scrollRef.scrollTop = repliedMessage.offsetTop
        }
      }
    } else {
      // await handleGetMessages(undefined, messageId)
      dispatch(getMessagesAC(channel, undefined, messageId))
    }
  }

  return (
    <React.Fragment>
      <BottomButton
        show={!!showScrollToNewMessageButton}
        animateFrom={animateFrom}
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
        rightPosition={rightPosition}
      >
        {!!(channel.newMessageCount && channel.newMessageCount > 0) && (
          <UnreadCount
            width={unreadCountWidth}
            height={unreadCountHeight}
            textColor={unreadCountTextColor}
            fontSize={unreadCountFontSize}
            backgroundColor={accentColor}
            isMuted={channel.muted}
          >
            {channel.newMessageCount ? (channel.newMessageCount > 99 ? '99+' : channel.newMessageCount) : ''}
          </UnreadCount>
        )}
        {buttonIcon || <BottomIcon />}
      </BottomButton>
    </React.Fragment>
  )
}

export default MessagesScrollToBottomButton

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
  animateFrom?: string
  show?: boolean
}>`
  transition: all 0.3s ease-in-out;
  position: absolute;
  ${(props) =>
    props.animateFrom === 'bottom' &&
    `bottom: ${props.bottomOffset + (props.bottomPosition === undefined ? 45 : props.bottomPosition) - 130}px`};

  ${(props) =>
    props.animateFrom === 'right' && `right: ${props.rightPosition === undefined ? 16 : props.rightPosition - 100}px`};

  ${(props) =>
    props.show && `bottom: ${props.bottomOffset + (props.bottomPosition === undefined ? 45 : props.bottomPosition)}px`};
  right: ${(props) => (props.rightPosition === undefined ? 16 : props.rightPosition)}px;

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
