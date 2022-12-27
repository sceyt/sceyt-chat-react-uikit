import styled from 'styled-components'
import { useDispatch, useSelector } from 'react-redux'
import React from 'react'

import { colors, customColors } from '../../UIHelper/constants'
import { activeChannelSelector } from '../../store/channel/selector'
import { scrollToNewMessageAC } from '../../store/message/actions'
import { IChannel } from '../../types'
import { ReactComponent as BottomIcon } from '../../assets/svg/chevron_down.svg'
import { UnreadCount } from '../Channel'
import { sendMessageInputHeightSelector, showScrollToNewMessageButtonSelector } from '../../store/message/selector'

interface MessagesScrollToBottomButtonProps {
  buttonIcon?: JSX.Element
  buttonWidth?: string
  buttonHeight?: string
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

const MessagesScrollToBottomButton: React.FC<MessagesScrollToBottomButtonProps> = ({
  buttonIcon,
  buttonWidth,
  buttonHeight,
  buttonBorder,
  buttonBackgroundColor,
  buttonHoverBackgroundColor,
  buttonBorderRadius,
  buttonShadow,
  unreadCountWidth,
  unreadCountHeight,
  unreadCountFontSize,
  unreadCountTextColor,
  unreadCountBackgroundColor
}) => {
  const dispatch = useDispatch()
  const channel: IChannel = useSelector(activeChannelSelector)
  const sendMessageInputHeight: number = useSelector(sendMessageInputHeightSelector)
  const showScrollToNewMessageButton: IChannel = useSelector(showScrollToNewMessageButtonSelector)

  const handleScrollToBottom = () => {
    console.log('scroll buttun cliced ... ')
    dispatch(scrollToNewMessageAC(true, true))
  }
  return (
    <React.Fragment>
      {showScrollToNewMessageButton && (
        <BottomButton
          width={buttonWidth}
          height={buttonHeight}
          border={buttonBorder}
          borderRadius={buttonBorderRadius}
          backgroundColor={buttonBackgroundColor}
          hoverBackgroundColor={buttonHoverBackgroundColor}
          shadow={buttonShadow}
          onClick={handleScrollToBottom}
          bottomPos={sendMessageInputHeight}
        >
          {!!(channel.unreadMessageCount && channel.unreadMessageCount > 0) && (
            <UnreadCount
              width={unreadCountWidth}
              height={unreadCountHeight}
              textColor={unreadCountTextColor}
              fontSize={unreadCountFontSize}
              backgroundColor={unreadCountBackgroundColor || customColors.messageReadStatusTickColor}
              isMuted={channel.muted}
            >
              {channel.unreadMessageCount ? (channel.unreadMessageCount > 99 ? '99+' : channel.unreadMessageCount) : ''}
            </UnreadCount>
          )}
          {buttonIcon || <BottomIcon />}
        </BottomButton>
      )}
    </React.Fragment>
  )
}

export default MessagesScrollToBottomButton

const BottomButton = styled.div<{
  width?: string
  height?: string
  border?: string
  borderRadius?: string
  backgroundColor?: string
  hoverBackgroundColor?: string
  shadow?: string
  bottomPos: number
}>`
  position: absolute;
  bottom: ${(props) => `${props.bottomPos + 45}px`};
  right: 16px;
  margin-right: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: ${colors.white};
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
