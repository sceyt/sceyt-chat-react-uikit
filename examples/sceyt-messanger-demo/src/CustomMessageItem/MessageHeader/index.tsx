import React from 'react';
import { IMessage } from 'sceyt-chat-react-uikit/types';
import styled from 'styled-components';
import { IUser } from '../../types'
import { makeUsername } from '../../helpers'

function MessageHeader({
  message,
  withAttachments,
  withMediaAttachment,
  notLinkAttachment,
  showMessageSenderName,
  currentUser,
  handleCreateChat,
  showOwnSenderName,
}: {
  message: IMessage;
  currentUser: IUser;
  handleCreateChat: (user: IUser) => void;
  withAttachments?: boolean;
  withMediaAttachment?: boolean;
  notLinkAttachment?: boolean;
  showMessageSenderName?: boolean;
  showOwnSenderName?: boolean;
}) {
  const messageOwnerIsNotCurrentUser = !!(
    message.user &&
    message.user.id !== currentUser.id &&
    message.user.id
  );
  const handleOpenCreateChat = (user: IUser) => {
    if (user.id !== currentUser.id) {
      handleCreateChat(user);
    }
  };
  return (
    <MessageHeaderCont
      isReplied={!!message.parentMessage}
      isForwarded={!!message.forwardingDetails}
      messageBody={!!message.body}
      withMediaAttachment={withMediaAttachment}
      withPadding={withAttachments && notLinkAttachment}
    >
      {showMessageSenderName && (
        <MessageOwner
          className='message-owner'
          rtlDirection={!message.incoming}
          clickable={messageOwnerIsNotCurrentUser}
          onClick={() => handleOpenCreateChat(message.user)}

        >
          {message.user.id === currentUser.id  && message.user.firstName
            ? !showOwnSenderName ? null : `${message.user.firstName} ${message.user.lastName}`
            : makeUsername( message.user, false)}
        </MessageOwner>
      )}
    </MessageHeaderCont>
  );
}

export default MessageHeader;

const MessageHeaderCont = styled.div<{
  withPadding?: boolean;
  isForwarded?: boolean;
  messageBody?: boolean;
  isReplied?: boolean;
  withMediaAttachment?: boolean;
}>`
  display: flex;
  align-items: center;
  padding: ${(props) =>
    props.withPadding &&
    (props.isForwarded
      ? '8px 0 2px 12px'
      : !props.isReplied && !props.messageBody
      ? props.withMediaAttachment
        ? '8px 0 8px 12px'
        : '8px 0 0 12px'
      : '8px 0 0 12px')};
`;

const MessageOwner = styled.h3<{
  color?: string
  rtlDirection?: boolean
  fontSize?: string
  clickable?: boolean
}>`
    margin: 0 12px 4px 0;
    white-space: nowrap;
    color: #5159F6;
    margin-left: ${(props) => props.rtlDirection && 'auto'};
    font-weight: 500;
    font-size: ${(props) => props.fontSize || '15px'};
    line-height: ${(props) => props.fontSize || '18px'};
    cursor: ${(props) => props.clickable && 'pointer'};
    overflow: hidden;
    text-overflow: ellipsis;
`
