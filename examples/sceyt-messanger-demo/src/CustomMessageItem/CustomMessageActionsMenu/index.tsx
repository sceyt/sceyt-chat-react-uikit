import React from 'react';
import styled from 'styled-components';
import moment from 'moment';
import { ReactComponent as ReactionIcon } from '../../assets/svg/emojiSmileIcon.svg';
import { ReactComponent as EditMessageIcon } from '../../assets/svg/edit.svg';
import { ReactComponent as CheckIcon } from '../../assets/svg/checkCircle.svg';
import { ReactComponent as ResendMessageIcon } from '../../assets/svg/resend.svg';
import { ReactComponent as ReplyMessageIcon } from '../../assets/svg/reply.svg';
import { ReactComponent as CopyMessageIcon } from '../../assets/svg/copy.svg';
import { ReactComponent as ForwardMessageIcon } from '../../assets/svg/forward.svg';
import { ReactComponent as DeleteMessageIcon } from '../../assets/svg/trash.svg';
import { CHANNEL_TYPE, MESSAGE_DELIVERY_STATUS, USER_STATE } from '../../helpers/constants'

function CustomMessageActionsMenu({
  message,
  channel,
  handleSetMessageForEdit,
  handleResendMessage,
  handleOpenDeleteMessage,
  handleOpenForwardMessage,
  handleCopyMessage,
  handleOpenEmojis,
  handleReplyMessage,
  handleSelectMessage,
  isThreadMessage,
  rtlDirection,
  rolesMap,
  client,
}: {
  message: any;
  channel: any;
  rolesMap: any;
  handleSetMessageForEdit?: () => void;
  handleResendMessage?: () => void;
  handleOpenDeleteMessage?: () => void;
  handleOpenForwardMessage?: () => void;
  handleCopyMessage?: () => void;
  handleReportMessage?: () => void;
  handleSelectMessage?: () => void;
  handleOpenEmojis?: () => void;
  handleReplyMessage?: (threadReply?: boolean) => void;

  isThreadMessage?: boolean;
  rtlDirection?: boolean;
  client: any;
}) {
  const isDirectChannel = channel.type === CHANNEL_TYPE.DIRECT;
  const directChannelUser =
    isDirectChannel &&
    channel.members.find((member: any) => member.id !== client.user.id);
  const isIncoming = message.incoming;
  const checkPermission = (permission: string) => {
    if (rolesMap && channel.userRole) {
      return rolesMap[channel.userRole].includes(permission);
    } else {
      return false;
    }
  };
  let messageCreatesHours = moment().diff(moment(message.createdAt), 'hours');

  const editMessagePermitted = isIncoming
    ? checkPermission('editAnyMessage')
    : checkPermission('editOwnMessage');

  return (
    <Container rtlDirection={rtlDirection} isThreadMessage={isThreadMessage}>
      <ActionsMenu rtlDirection={rtlDirection}>
        <Action onClick={handleOpenEmojis}>
          <ItemNote direction='top'>React</ItemNote>
          <ReactionIcon />
        </Action>

        {message.deliveryStatus !== MESSAGE_DELIVERY_STATUS.PENDING &&
          messageCreatesHours < 24 &&
          !isIncoming &&
          !(
            message.forwardingDetails &&
            message.forwardingDetails.user &&
            message.forwardingDetails.user.id !== client.user.id
          ) &&
          editMessagePermitted &&
          (isDirectChannel && directChannelUser
            ? !isIncoming && directChannelUser.state !== USER_STATE.DELETED
            : true) && (
            <Action onClick={handleSetMessageForEdit}>
              <ItemNote direction='top'>Edit Message</ItemNote>
              <EditMessageIcon />
            </Action>
          )}

        {message.state === 'failed' && (
          <Action onClick={handleResendMessage}>
            <ItemNote direction='top'>Resend Message</ItemNote>
            <ResendMessageIcon />
          </Action>
        )}

        <Action onClick={() => handleReplyMessage && handleReplyMessage()}>
          <ItemNote direction='top'>Reply</ItemNote>
          <ReplyMessageIcon />
        </Action>

        <Action onClick={handleCopyMessage}>
          <ItemNote direction='top'>Copy</ItemNote>
          <CopyMessageIcon />
        </Action>

        <Action onClick={handleOpenForwardMessage}>
          <ItemNote direction='top'>Forward Message</ItemNote>
          <ForwardMessageIcon />
        </Action>
        <Action onClick={handleSelectMessage}>
          <ItemNote direction='top'>Select</ItemNote>
          <CheckIcon />
        </Action>

        <Action onClick={handleOpenDeleteMessage}>
          <ItemNote direction='top'>Delete Message</ItemNote>
          <DeleteMessageIcon />
        </Action>
      </ActionsMenu>
    </Container>
  );
}

export default CustomMessageActionsMenu;

export const Container = styled.div<{
  rtlDirection?: boolean;
  isThreadMessage?: boolean;
}>`
  position: absolute;
  left: ${({ isThreadMessage, rtlDirection }) =>
    !rtlDirection && (isThreadMessage ? '8px' : '0')};
  right: ${({ rtlDirection }) => rtlDirection && '0'};
  direction: ${(props) => (props.rtlDirection ? 'initial' : '')};
  top: -46px;
  padding: 0 0 8px;
  z-index: 200;
`;

export const ActionsMenu = styled.div<{ rtlDirection?: boolean }>`
  position: relative;
  display: flex;
  align-items: center;
  direction: ${(props) => props.rtlDirection && 'initial'};
  background-color: #fff;
  padding: 8px 2px;
  box-sizing: border-box;
  border-radius: 12px;
  box-shadow: 0 0 2px rgba(17, 21, 57, 0.08), 0 0 24px rgba(17, 21, 57, 0.16);
  transition: all 0.2s;
  z-index: 100;
`;

export const ItemNote = styled.div<{ direction: string }>`
    display: none;
    position: absolute;
    z-index: 301;
    padding: 10px 12px;
    background-color: #17191C;
    border-radius: 12px;
    font-size: 0.75rem;
    white-space: nowrap;
    font-weight: 600;
    color: white;
    pointer-events: none;
    user-select: none;

    &::before {
        content: '';
        position: absolute;
        z-index: -1;
        background-color: #17191C;
        border-radius: 3px;
        width: 14px;
        height: 14px;

        ${(props: any) =>
  props.direction === 'right' &&
  `
            left: -5px;
            top: 50%;
            transform: translateY(-50%) rotate(45deg);
        `} ${(props: any) =>
  props.direction === 'top' &&
  `
            bottom: -5px;
            left: 50%;
            transform: translateX(-50%) rotate(45deg);
        `}
    }

    ${(props: any) =>
  props.visible &&
  `
       display: block;
    `} ${(props: any) =>
  props.direction === 'right' &&
  `
        top: 50%;
        left: calc(100% + 15px);
        transform: translateY(-50%);
    `} ${(props: any) =>
  props.direction === 'top' &&
  `
        bottom: calc(100% + 15px);
        left: 50%;
        transform: translateX(-50%);
    `} ${(props: any) =>
  props.disabled &&
  `
        color: #707388;
    `}
`

const Action = styled.div<{
    color?: string
    iconColor?: string
    order?: number
    hoverIconColor?: string
    hoverBackgroundColor?: string
}>`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  margin: 0 6px;
  cursor: pointer;
  transition: all 0.2s;
  color: #707388;
  border-radius: 50%;

  &:hover {
    color: ${(props) => props.hoverIconColor || '#5159F6'};
    background-color: ${(props) => props.hoverBackgroundColor || '#f1f2f6'};

    ${ItemNote} {
      display: block;
    }
  }
`
