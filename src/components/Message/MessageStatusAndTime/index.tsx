import styled from 'styled-components'
import React from 'react'
import moment from 'moment'
// Hooks
import { useColor } from '../../../hooks'
// Helpers
import { MESSAGE_STATUS } from '../../../helpers/constants'
import { THEME_COLORS } from '../../../UIHelper/constants'
import { IMessage } from '../../../types'
// Components
import { MessageStatusIcon } from '../../../messageUtils'

interface IMessageStatusAndTime {
  message: IMessage
  showMessageTimeAndStatusOnlyOnHover?: boolean
  messageStatusDisplayingType?: 'ticks' | 'text'
  messageStatusSize?: string
  messageStatusColor?: string
  messageReadStatusColor?: string
  messageStateFontSize?: string
  messageStateColor?: string
  messageTimeFontSize?: string
  messageTimeColor?: string
  messageStatusAndTimeLineHeight?: string
  messageTimeVisible?: boolean
  messageStatusVisible?: boolean
  leftMargin?: boolean
  withAttachment?: boolean
  fileAttachment?: boolean
  ownMessageOnRightSide?: boolean
  bottomOfMessage?: boolean
  marginBottom?: string
  messageTimeColorOnAttachment: string
}

const MessageStatusAndTime = ({
  message,
  messageStatusDisplayingType = 'ticks',
  showMessageTimeAndStatusOnlyOnHover,
  messageStatusSize,
  messageStatusColor,
  messageReadStatusColor,
  messageStateFontSize,
  messageStateColor,
  messageTimeFontSize,
  messageTimeColor,
  messageStatusAndTimeLineHeight,
  messageTimeVisible,
  messageStatusVisible,
  withAttachment,
  fileAttachment,
  ownMessageOnRightSide,
  leftMargin,
  bottomOfMessage,
  marginBottom,
  messageTimeColorOnAttachment
}: IMessageStatusAndTime) => {
  const {
    [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.ICON_PRIMARY]: iconPrimary,
    [THEME_COLORS.TEXT_ON_PRIMARY]: textOnPrimary,
    [THEME_COLORS.OVERLAY_BACKGROUND_2]: overlayBackground2
  } = useColor()

  return (
    <MessageStatusAndTimeContainer
      lineHeight={messageStatusAndTimeLineHeight}
      showOnlyOnHover={showMessageTimeAndStatusOnlyOnHover}
      leftMargin={leftMargin}
      isSelfMessage={!message?.incoming}
      withAttachment={withAttachment}
      rtlDirection={ownMessageOnRightSide && !message.incoming}
      fileAttachment={fileAttachment}
      bottomOfMessage={bottomOfMessage}
      marginBottom={marginBottom}
      className='message_status_time'
      messageTimeColorOnAttachment={messageTimeColorOnAttachment || textOnPrimary}
      messageTimeBackgroundColor={overlayBackground2}
    >
      {message?.state === MESSAGE_STATUS.EDIT ? (
        <MessageStatusUpdated color={messageStateColor || textSecondary} fontSize={messageStateFontSize}>
          edited
        </MessageStatusUpdated>
      ) : (
        ''
      )}
      {messageTimeVisible && (
        <HiddenMessageTime color={messageTimeColor || textSecondary} fontSize={messageTimeFontSize}>{`${moment(
          message?.createdAt
        ).format('HH:mm')}`}</HiddenMessageTime>
      )}
      {messageStatusVisible && (
        <MessageStatus height={messageStatusAndTimeLineHeight}>
          {MessageStatusIcon({
            messageStatus: message?.deliveryStatus,
            messageStatusDisplayingType,
            size: messageStatusSize,
            color: messageStatusColor || iconPrimary,
            readIconColor: messageReadStatusColor,
            accentColor
          })}
        </MessageStatus>
      )}
    </MessageStatusAndTimeContainer>
  )
}

export default React.memo(MessageStatusAndTime, (prevProps, nextProps) => {
  // Custom comparison function to check if only 'messages' prop has changed
  return (
    prevProps.message?.state === nextProps.message?.state &&
    prevProps.message?.deliveryStatus === nextProps.message?.deliveryStatus &&
    prevProps.message?.createdAt === nextProps.message?.createdAt &&
    prevProps.showMessageTimeAndStatusOnlyOnHover === nextProps.showMessageTimeAndStatusOnlyOnHover &&
    prevProps.messageStatusSize === nextProps.messageStatusSize &&
    prevProps.messageStatusColor === nextProps.messageStatusColor &&
    prevProps.messageReadStatusColor === nextProps.messageReadStatusColor &&
    prevProps.messageStateFontSize === nextProps.messageStateFontSize &&
    prevProps.messageStateColor === nextProps.messageStateColor &&
    prevProps.messageTimeFontSize === nextProps.messageTimeFontSize &&
    prevProps.messageStatusAndTimeLineHeight === nextProps.messageStatusAndTimeLineHeight &&
    prevProps.messageTimeColor === nextProps.messageTimeColor &&
    prevProps.messageTimeVisible === nextProps.messageTimeVisible &&
    prevProps.messageStatusVisible === nextProps.messageStatusVisible &&
    prevProps.ownMessageOnRightSide === nextProps.ownMessageOnRightSide &&
    prevProps.bottomOfMessage === nextProps.bottomOfMessage &&
    prevProps.marginBottom === nextProps.marginBottom &&
    prevProps.messageTimeColorOnAttachment === nextProps.messageTimeColorOnAttachment &&
    prevProps.withAttachment === nextProps.withAttachment
  )
})

const MessageStatus = styled.span<{ height?: string }>`
  display: inline-flex;
  align-items: center;
  margin-left: 4px;
  text-align: right;
  height: ${(props: any) => props.height || '14px'};

  & > svg {
    height: 16px;
    width: 16px;
  }
`

const HiddenMessageTime = styled.span<{ hide?: boolean; color: string; fontSize?: string }>`
  display: ${(props: any) => props.hide && 'none'};
  font-weight: 400;
  font-size: ${(props) => props.fontSize || '12px'};
  color: ${(props) => props.color};
`

const MessageStatusAndTimeContainer = styled.span<{
  withAttachment?: boolean
  fileAttachment?: boolean
  hide?: boolean
  isSelfMessage?: boolean
  marginBottom?: string
  leftMargin?: boolean
  rtlDirection?: boolean
  bottomOfMessage?: boolean
  showOnlyOnHover?: boolean
  lineHeight?: string
  messageTimeColorOnAttachment: string
  messageTimeBackgroundColor?: string
}>`
  visibility: ${(props: any) => props.showOnlyOnHover && 'hidden'};
  display: ${(props) => (props.hide ? 'none' : 'flex')};
  align-items: flex-end;
  border-radius: 16px;
  padding: ${(props) => props.withAttachment && '4px 6px'};
  background-color: ${(props) =>
    props.withAttachment && !props.fileAttachment && `${props.messageTimeBackgroundColor}66`};
  float: right;
  line-height: ${(props) => props.lineHeight || '14px'};
  margin-right: ${(props) => props.rtlDirection && 'auto'};
  margin-left: ${(props) => props.leftMargin && '12px'};
  margin-bottom: ${(props) => props.marginBottom && '8px'};
  direction: ${(props) => (props.isSelfMessage ? 'initial' : '')};
  transform: translate(0px, 4px);
  white-space: nowrap;
  width: ${(props) => props.bottomOfMessage && '100%'};
  justify-content: ${(props) => props.bottomOfMessage && props.rtlDirection && 'flex-end'};
  z-index: 10;

  & > svg {
    margin-left: 4px;
    height: 14px;
    width: 16px;
  }

  & > ${HiddenMessageTime} {
    color: ${(props) => (props.withAttachment && !props.fileAttachment ? props.messageTimeColorOnAttachment : '')};
  }

  ${(props) =>
    props.withAttachment &&
    `
    position: absolute;
    z-index: 10;
    right: ${props.fileAttachment ? '6px' : '10px'};
    bottom: ${props.fileAttachment ? '9px' : '14px'};
  `}
`

const MessageStatusUpdated = styled.span<{ color: string; fontSize?: string }>`
  margin-right: 4px;
  font-style: italic;
  font-weight: 400;
  font-size: ${(props: any) => props.fontSize || '12px'};
  color: ${(props) => props.color};
`
