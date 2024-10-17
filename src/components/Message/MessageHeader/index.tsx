import React from 'react'
import styled from 'styled-components'
// Helpers
import { makeUsername } from 'helpers/message'
import { MessageOwner } from 'UIHelper'
import { THEME_COLORS } from 'UIHelper/constants'
import { IMessage, IUser } from 'types'
import { useColor } from 'hooks'
import { getClient } from 'common/client'

interface IMessageHeaderProps {
  message: IMessage
  ownMessageOnRightSide?: boolean
  ownMessageBackground?: string
  incomingMessageBackground?: string
  showMessageSenderName?: boolean
  withAttachments?: boolean
  withMediaAttachment?: boolean
  notLinkAttachment?: boolean
  messageOwnerIsNotCurrentUser?: boolean
  getFromContacts?: boolean
  contactsMap: { [key: string]: any }
  handleCreateChat: (user?: IUser) => void
}

const MessageHeader = ({
  message,
  ownMessageOnRightSide,
  ownMessageBackground,
  incomingMessageBackground,
  contactsMap,
  withMediaAttachment,
  withAttachments,
  notLinkAttachment,
  messageOwnerIsNotCurrentUser,
  showMessageSenderName,
  getFromContacts,
  handleCreateChat
}: IMessageHeaderProps) => {
  const ChatClient = getClient()
  const { user } = ChatClient
  const { [THEME_COLORS.ACCENT]: accentColor } = useColor()

  return (
    <MessageHeaderCont
      isReplied={!!message.parentMessage}
      isForwarded={!!message.forwardingDetails}
      messageBody={!!message.body}
      withMediaAttachment={withMediaAttachment}
      withPadding={
        withAttachments &&
        notLinkAttachment &&
        (message.incoming ? incomingMessageBackground !== 'inherit' : ownMessageBackground !== 'inherit')
      }
    >
      {showMessageSenderName && (
        <MessageOwner
          className='message-owner'
          color={accentColor}
          rtlDirection={ownMessageOnRightSide && !message.incoming}
          clickable={messageOwnerIsNotCurrentUser}
          onClick={() => handleCreateChat((messageOwnerIsNotCurrentUser as any) && message.user)}
        >
          {message.user.id === user.id && message.user.firstName
            ? `${message.user.firstName} ${message.user.lastName}`
            : makeUsername(contactsMap[message.user.id], message.user, getFromContacts)}
        </MessageOwner>
      )}
    </MessageHeaderCont>
  )
}

export default React.memo(MessageHeader, (prevProps, nextProps) => {
  return (
    prevProps.message.body === nextProps.message.body &&
    prevProps.message.attachments === nextProps.message.attachments &&
    prevProps.contactsMap === nextProps.contactsMap &&
    prevProps.ownMessageOnRightSide === nextProps.ownMessageOnRightSide &&
    prevProps.ownMessageBackground === nextProps.ownMessageBackground &&
    prevProps.incomingMessageBackground === nextProps.incomingMessageBackground &&
    prevProps.showMessageSenderName === nextProps.showMessageSenderName &&
    prevProps.getFromContacts === nextProps.getFromContacts
  )
})

const MessageHeaderCont = styled.div<{
  withPadding?: boolean
  isForwarded?: boolean
  messageBody?: boolean
  isReplied?: boolean
  withMediaAttachment?: boolean
}>`
  display: flex;
  align-items: center;
  padding: ${(props: any) =>
    props.withPadding &&
    (props.isForwarded
      ? '8px 0 2px 12px'
      : !props.isReplied && !props.messageBody
        ? props.withMediaAttachment
          ? '8px 0 8px 12px'
          : '8px 0 0 12px'
        : '8px 0 0 12px')};
`
