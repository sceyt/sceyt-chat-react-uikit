import React from 'react'
import styled from 'styled-components'
import {
  Attachment,
  EmojisPopup,
  FrequentlyEmojis,
  MessageTextFormat,
  MessageStatusIcon
} from 'sceyt-chat-react-uikit'
import { IChannel, IAttachment, IMessage } from 'sceyt-chat-react-uikit/types'
import { ReactComponent as ForwardIcon } from '../assets/svg/forward.svg'
import moment from 'moment'
import MessageHeader from './MessageHeader'
import {
  attachmentTypes,
  CHANNEL_TYPE,
  MESSAGE_DELIVERY_STATUS,
  MESSAGE_STATUS,
  messagesCustomColor
} from '../helpers/constants'
import { IUser } from '../types'
import { calculateRenderedImageWidth, isJSON } from '../helpers'
import CustomMessageActionsMenu from './CustomMessageActionsMenu'
import ReplyMessage from './ReplyMessage'

function CustomMessageItem(
  {
    channel,
    message,
    prevMessage,
    nextMessage,
    unreadMessageId,
    isUnreadMessage,
    handleSetMessageForEdit,
    handleResendMessage,
    handleOpenDeleteMessage,
    handleOpenForwardMessage,
    handleCopyMessage,
    handleOpenEmojis,
    handleReplyMessage,
    handleSelectMessage,
    isThreadMessage,
    handleMouseEnter,
    handleMouseLeave,
    handleCreateChat,
    messageActionsShow,
    selectionIsActive,
    emojisPopupOpen,
    setEmojisPopupOpen,
    handleReactionAddDelete,
    frequentlyEmojisOpen,
    handleScrollToRepliedMessage,
    messageTextRef,
    handleMediaItemClick,
    closeMessageActions,
    emojisPopupPosition,
    client,
    rolesMap
  }: {
    channel: IChannel;
    message: IMessage;
    prevMessage: IMessage;
    nextMessage: IMessage;
    unreadMessageId: string;
    isUnreadMessage: boolean;
    messageActionsShow: boolean;
    selectionIsActive?: boolean;
    emojisPopupOpen: boolean;
    frequentlyEmojisOpen: boolean;
    messageTextRef: any;
    emojisPopupPosition: string;
    handleSetMessageForEdit?: () => void;
    handleResendMessage?: () => void;
    handleOpenDeleteMessage?: () => void;
    handleOpenForwardMessage?: () => void;
    handleCopyMessage?: () => void;
    handleReportMessage?: () => void;
    handleSelectMessage?: () => void;
    handleOpenEmojis?: () => void;
    handleReplyMessage?: () => void;
    handleMouseEnter: () => void;
    handleMouseLeave: () => void;
    closeMessageActions?: () => void;
    setEmojisPopupOpen: () => void;
    handleCreateChat: (user: IUser) => void;
    handleReactionAddDelete: (selectedEmoji: any) => void;
    handleScrollToRepliedMessage: (messageId: string) => void;
    handleMediaItemClick?: (attachment: IAttachment) => void;
    isThreadMessage?: boolean;
    rolesMap: { [key: string]: any }

    client: any;
  }) {

  const messageUserID = message.user ? message.user.id : 'deleted'
  const prevMessageUserID = prevMessage
    ? prevMessage.user
      ? prevMessage.user.id
      : 'deleted'
    : null
  const nextMessageUserID = nextMessage
    ? nextMessage.user
      ? nextMessage.user.id
      : 'deleted'
    : null

  const current = moment(message.createdAt).startOf('day')
  const firstMessageInInterval =
    !(
      prevMessage &&
      current.diff(moment(prevMessage.createdAt).startOf('day'), 'days') === 0
    ) ||
    prevMessage?.type === 'system' ||
    unreadMessageId === prevMessage.id
  const lastMessageInInterval =
    !(
      nextMessage &&
      current.diff(moment(nextMessage.createdAt).startOf('day'), 'days') === 0
    ) || nextMessage.type === 'system'

  const borderRadius = !message.incoming
    ? prevMessageUserID !== messageUserID || firstMessageInInterval
      ? '16px 16px 4px 16px'
      : nextMessageUserID !== messageUserID || lastMessageInInterval
        ? '16px 4px 16px 16px'
        : '16px 4px 4px 16px'
    : prevMessageUserID !== messageUserID || firstMessageInInterval
      ? '16px 16px 16px 4px'
      : nextMessageUserID !== messageUserID || lastMessageInInterval
        ? '4px 16px 16px 16px'
        : '4px 16px 16px 4px'

  const withAttachments = message.attachments && message.attachments.length > 0
  const notLinkAttachment =
    withAttachments &&
    message.attachments.some(
      (a: IAttachment) => a.type !== attachmentTypes.link
    )
  const mediaAttachment =
    withAttachments &&
    message.attachments.find(
      (attachment: IAttachment) =>
        attachment.type === attachmentTypes.video ||
        attachment.type === attachmentTypes.image
    )
  const withMediaAttachment = !!mediaAttachment
  const attachmentMetas =
    mediaAttachment &&
    (isJSON(mediaAttachment.metadata)
      ? JSON.parse(mediaAttachment.metadata)
      : mediaAttachment.metadata)

  const parentNotLinkAttachment =
    message.parentMessage &&
    message.parentMessage.attachments &&
    message.parentMessage.attachments.some(
      (a: IAttachment) => a.type !== attachmentTypes.link
    )

  const showMessageSenderName =
    (isUnreadMessage ||
      prevMessageUserID !== messageUserID ||
      firstMessageInInterval) &&
    channel.type !== CHANNEL_TYPE.DIRECT

  const messageStatusVisible =
    !message.incoming && message.state !== MESSAGE_STATUS.DELETE

  return (
    <Container
      className="message_custom_body"
      isSelfMessage={!message.incoming}
      isReplyMessage={
        !!(
          message.parentMessage &&
          message.parentMessage.id &&
          !isThreadMessage
        )
      }
      rtlDirection={!message.incoming}
      parentMessageIsVoice={
        message.parentMessage &&
        message.parentMessage.attachments &&
        message.parentMessage.attachments[0] &&
        message.parentMessage.attachments[0].type === attachmentTypes.voice
      }
      ownMessageBackground={messagesCustomColor.ownMessageBackground}
      incomingMessageBackground={messagesCustomColor.incomingMessageBackground}
      borderRadius={borderRadius}
      withAttachments={notLinkAttachment}
      attachmentWidth={
        withAttachments
          ? mediaAttachment
            ? (attachmentMetas &&
              attachmentMetas.szw &&
              calculateRenderedImageWidth(
                attachmentMetas.szw,
                attachmentMetas.szh
              )[0]) ||
            420
            : message.attachments[0].type === attachmentTypes.voice
              ? 254
              : undefined
          : undefined
      }
      noBody={!message.body && !withAttachments}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* {withAttachments && !!message.body && <MessageHeader />} */}
      {showMessageSenderName && (
        <MessageHeader
          message={message}
          handleCreateChat={handleCreateChat}
          currentUser={client.user}
          withAttachments={withAttachments}
          withMediaAttachment={!!mediaAttachment}
          notLinkAttachment={notLinkAttachment}
          showMessageSenderName={showMessageSenderName}
          showOwnSenderName={false}
        />
      )}
      {!isThreadMessage &&
        messageActionsShow &&
        !selectionIsActive &&
        !emojisPopupOpen &&
        !frequentlyEmojisOpen && (
          <CustomMessageActionsMenu
            message={message}
            channel={channel}
            handleSetMessageForEdit={handleSetMessageForEdit}
            handleResendMessage={handleResendMessage}
            handleOpenDeleteMessage={handleOpenDeleteMessage}
            handleOpenForwardMessage={handleOpenForwardMessage}
            handleCopyMessage={handleCopyMessage}
            handleOpenEmojis={handleOpenEmojis}
            handleReplyMessage={handleReplyMessage}
            isThreadMessage={isThreadMessage}
            handleSelectMessage={handleSelectMessage}
            rtlDirection={!message.incoming}
            rolesMap={rolesMap}
            client={client}
          />
        )}
      {message.parentMessage &&
        message.parentMessage.id &&
        !isThreadMessage && (
          <ReplyMessage
            client={client}
            message={message}
            withAttachments={withAttachments}
            notLinkAttachment={notLinkAttachment}
            showMessageSenderName={showMessageSenderName}
            selectionIsActive={selectionIsActive}
            parentNotLinkAttachment={parentNotLinkAttachment}
            borderRadius={borderRadius}
            handleScrollToRepliedMessage={handleScrollToRepliedMessage}
          />
        )}
      {message.state !== MESSAGE_STATUS.DELETE &&
        message.forwardingDetails &&
        message.forwardingDetails.user &&
        message.user &&
        message.forwardingDetails.user.id !== message.user.id && (
          <ForwardedTitle
            withPadding={withAttachments && notLinkAttachment}
            withAttachments={withAttachments}
            withMediaAttachment={withMediaAttachment}
            withBody={!!message.body}
            showSenderName={showMessageSenderName}
            leftPadding={true}
            color={'#5159F6'}
          >
            <ForwardIcon />
            Forwarded message
          </ForwardedTitle>
        )}
      <MessageText
        draggable={false}
        color={'#17191C'}
        showMessageSenderName={showMessageSenderName}
        withPaddings={true}
        withAttachment={notLinkAttachment && !!message.body}
        withMediaAttachment={withMediaAttachment}
        isForwarded={!!message.forwardingDetails}
      >
        <span ref={messageTextRef}>
          {message.type === 'your_custom_type' ? (
            // Implement your custom content
            <span />
          ) : (
            MessageTextFormat({
              text: message.body,
              message,
              getFromContacts: true
            })
          )}
        </span>
        {!withAttachments && message.state === MESSAGE_STATUS.DELETE ? (
          <MessageStatusDeleted> Message was deleted. </MessageStatusDeleted>
        ) : (
          ''
        )}
        {!notLinkAttachment && (
          <MessageStatusAndTime leftMargin isSelfMessage={!message.incoming}>
            {message.state === MESSAGE_STATUS.EDIT ? (
              <MessageStatusUpdated>edited</MessageStatusUpdated>
            ) : (
              ''
            )}
            <HiddenMessageTime>{`${moment(message.createdAt).format(
              'HH:mm'
            )}`}</HiddenMessageTime>
            {messageStatusVisible && (
              <MessageStatus>
                {MessageStatusIcon({
                  messageStatus: message.deliveryStatus,
                  messageStatusDisplayingType: 'ticks'
                })}
              </MessageStatus>
            )}
          </MessageStatusAndTime>
        )}
      </MessageText>
      {notLinkAttachment && messageStatusVisible && (
        <MessageStatusAndTime
          withAttachment
          leftMargin
          isSelfMessage={!message.incoming}
          fileAttachment={
            message.attachments[0].type === 'file' ||
            message.attachments[0].type === 'voice'
          }
        >
          {message.state === MESSAGE_STATUS.EDIT ? (
            <MessageStatusUpdated
              color={
                message.attachments[0].type !== 'voice' &&
                message.attachments[0].type !== 'file'
                  ? '#fff'
                  : '#707388'
              }
            >
              edited
            </MessageStatusUpdated>
          ) : (
            ''
          )}
          <HiddenMessageTime>{`${moment(message.createdAt).format(
            'HH:mm'
          )}`}</HiddenMessageTime>
          {messageStatusVisible &&
            MessageStatusIcon({
              messageStatus: message.deliveryStatus,
              messageStatusDisplayingType: 'ticks',
              iconColor:
                message.attachments[0].type !== 'voice' &&
                message.attachments[0].type !== 'file'
                  ? '#fff'
                  : ''
            })}
        </MessageStatusAndTime>
      )}
      {
        withAttachments &&
        (message.attachments as any[]).map((attachment: any) => (
          <div key={attachment.tid || attachment.url}>
            <Attachment
              key={attachment.tid || attachment.url}
              handleMediaItemClick={
                selectionIsActive ? undefined : handleMediaItemClick
              }
              attachment={{
                ...attachment,
                metadata: isJSON(attachment.metadata)
                  ? JSON.parse(attachment.metadata)
                  : attachment.metadata
              }}
              imageMinWidth={
                message.parentMessage &&
                message.parentMessage.attachments &&
                message.parentMessage.attachments[0] &&
                message.parentMessage.attachments[0].type ===
                attachmentTypes.voice
                  ? '210px'
                  : undefined
              }
              borderRadius={borderRadius}
              backgroundColor={
                message.incoming
                  ? messagesCustomColor.incomingMessageBackground
                  : messagesCustomColor.ownMessageBackground
              }
              closeMessageActions={closeMessageActions}
            />
            {withAttachments && notLinkAttachment && message.incoming &&
              <MessageStatusAndTime
                withAttachment
                leftMargin
                isSelfMessage={!message.incoming}
                fileAttachment={
                  message.attachments[0].type === 'file' ||
                  message.attachments[0].type === 'voice'
                }
              >

                <HiddenMessageTime>{`${moment(message.createdAt).format(
                  'HH:mm'
                )}`}</HiddenMessageTime>

              </MessageStatusAndTime>

            }
          </div>
        ))
      }
      {emojisPopupOpen && emojisPopupPosition && (
        <EmojiContainer
          id={`${message.id}_emoji_popup_container`}
          position={emojisPopupPosition}
          rtlDirection={!message.incoming}
        >
          {message.deliveryStatus &&
            message.deliveryStatus !== MESSAGE_DELIVERY_STATUS.PENDING && (
              <EmojisPopup
                relativePosition
                emojisPopupPosition={emojisPopupPosition}
                emojisCategoryIconsPosition={'top'}
                emojisContainerBorderRadius={'16px'}
                rtlDirection={!message.incoming}
                handleEmojiPopupToggle={setEmojisPopupOpen}
                handleAddEmoji={handleReactionAddDelete}
              />
            )}
        </EmojiContainer>
      )}
      {frequentlyEmojisOpen && !emojisPopupOpen && (
        <FrequentlyEmojisContainer
          id="frequently_emojis_container"
          rtlDirection={!message.incoming}
        >
          <FrequentlyEmojis
            rtlDirection={!message.incoming}
            handleAddEmoji={handleReactionAddDelete}
            handleEmojiPopupToggle={setEmojisPopupOpen}
            frequentlyEmojis={message.userReactions}
          />
        </FrequentlyEmojisContainer>
      )}
    </Container>
  )
}

export default CustomMessageItem

const Container = styled.div<{
  isSelfMessage?: boolean;
  incomingMessageBackground?: string;
  ownMessageBackground?: string;
  borderRadius?: string;
  withAttachments?: boolean;
  noBody?: boolean;
  isReplyMessage?: boolean;
  rtlDirection?: boolean;
  parentMessageIsVoice?: any;
  attachmentWidth?: number;
}>`
  position: relative;
  background-color: ${(props) =>
    props.isSelfMessage
      ? props.ownMessageBackground
      : props.incomingMessageBackground};
  //display: inline-block;
  border-radius: ${(props) => props.borderRadius || '4px 16px 16px 4px'};
  direction: ${(props) => (props.rtlDirection ? 'initial' : '')};
  max-width: ${(props) =>
    props.withAttachments
      ? props.attachmentWidth && props.attachmentWidth < 420
        ? props.attachmentWidth < 165
          ? props.isReplyMessage
            ? '210px'
            : '165px'
          : `${props.attachmentWidth}px`
        : '420px'
      : '100%'};
  padding: ${(props) =>
    props.withAttachments
      ? props.isReplyMessage
        ? '1px 0 0 '
        : '0'
      : props.isSelfMessage
        ? props.ownMessageBackground === 'inherit'
          ? '0'
          : '8px 12px'
        : props.incomingMessageBackground === 'inherit'
          ? ' 0'
          : '8px 12px'};
    //direction: ${(props) => (props.isSelfMessage ? 'initial' : '')};
    //overflow: ${(props) => props.noBody && 'hidden'};
  transition: all 0.3s;
  transform-origin: right;
`

const ForwardedTitle = styled.h3<{
  withAttachments?: boolean;
  withBody?: boolean;
  showSenderName?: boolean;
  withPadding?: boolean;
  leftPadding?: boolean;
  withMediaAttachment?: boolean;
  color?: string;
}>`
  display: flex;
  align-items: center;
  font-weight: 500;
  font-size: 13px;
  line-height: 16px;
  color: ${(props) => props.color || '#5159F6'};
    //margin: ${(props) =>
    props.withAttachments && props.withBody ? '0' : '0 0 4px'};
  margin: 0;
  padding: ${(props) =>
    props.withPadding && (props.leftPadding ? '8px 0 0 12px' : '8px 0 0 ')};
  padding-top: ${(props) =>
    props.showSenderName && (props.withBody ? '4px' : '0')};
  padding-bottom: ${(props) =>
    props.withBody
      ? !props.withAttachments || props.showSenderName
        ? '4px'
        : props.withAttachments && !props.withPadding
          ? '4px'
          : '0'
      : props.withAttachments
        ? props.withMediaAttachment
          ? '8px'
          : '2px'
        : '4px'};

  & > svg {
    margin-right: 4px;
    width: 16px;
    height: 16px;
    color: ${(props) => props.color || '#5159F6'};
  }
`
const MessageStatus = styled.span<{ height?: string }>`
  display: inline-flex;
  align-items: center;
  margin-left: 4px;
  text-align: right;
  height: ${(props) => props.height || '14px'};

  & > svg {
    height: 16px;
    width: 16px;
  }
`

export const HiddenMessageTime = styled.span<{
  hide?: boolean;
  color?: string;
  fontSize?: string;
}>`
  display: ${(props) => props.hide && 'none'};
  font-weight: 400;
  font-size: ${(props) => props.fontSize || '12px'};
  color: ${(props) => props.color || '#707388'};
`

export const MessageStatusAndTime = styled.span<{
  withAttachment?: boolean;
  fileAttachment?: boolean;
  hide?: boolean;
  isSelfMessage?: boolean;
  marginBottom?: string;
  leftMargin?: boolean;
  rtlDirection?: boolean;
  bottomOfMessage?: boolean;
  showOnlyOnHover?: boolean;
  lineHeight?: string;
}>`
  visibility: ${(props) => props.showOnlyOnHover && 'hidden'};
  display: ${(props) => (props.hide ? 'none' : 'flex')};
  align-items: flex-end;
  border-radius: 16px;
  padding: ${(props) => props.withAttachment && '4px 6px'};
  background-color: ${(props) =>
    props.withAttachment && !props.fileAttachment && 'rgba(1, 1, 1, 0.3)'};
  float: right;
  line-height: ${(props) => props.lineHeight || '14px'};
  margin-right: ${(props) => props.rtlDirection && 'auto'};
  margin-left: ${(props) => props.leftMargin && '12px'};
  margin-bottom: ${(props) => props.marginBottom && '8px'};
  direction: ${(props) => (props.isSelfMessage ? 'initial' : '')};
  transform: translate(0px, 4px);
  white-space: nowrap;
  width: ${(props) => props.bottomOfMessage && '30px'};
  justify-content: ${(props) =>
    props.bottomOfMessage && props.rtlDirection && 'flex-end'};

  & > svg {
    margin-left: 4px;
    height: 14px;
    width: 16px;
  }

  & > ${HiddenMessageTime} {
    color: ${(props) =>
      props.fileAttachment
        ? '#707388'
        : props.withAttachment
          ? '#fff'
          : ''};
  }

  ${(props) =>
    props.withAttachment &&
    `
    position: absolute;
    z-index: 3;
    right: ${props.fileAttachment ? '6px' : '10px'};
    bottom: ${props.fileAttachment ? '9px' : '14px'};
  `}
`

const MessageStatusUpdated = styled.span<{ color?: string; fontSize?: string }>`
  margin-right: 4px;
  font-style: italic;
  font-weight: 400;
  font-size: ${(props) => props.fontSize || '12px'};
  color: ${(props) => props.color || '#707388'};
`

const MessageStatusDeleted = styled.span<{
  color?: string;
  fontSize?: string;
  withAttachment?: boolean;
}>`
  color: ${(props) => props.color || '#707388'};
  font-size: ${(props) => props.fontSize};
  font-style: italic;
`

const EmojiContainer = styled.div<any>`
  position: absolute;
  left: ${(props) => (props.rtlDirection ? '' : '0')};
  right: ${(props) => props.rtlDirection && '0'};
    //top: ${(props) =>
    props.position === 'top' ? '-250px' : 'calc(100% + 6px)'};
  top: ${(props) => props.position === 'bottom' && 'calc(100% + 4px)'};
  bottom: ${(props) => props.position === 'top' && 'calc(100% + 4px)'};
  z-index: 99;
`

const FrequentlyEmojisContainer = styled.div<{ rtlDirection?: boolean }>`
  position: absolute;
  left: ${(props) => (props.rtlDirection ? '' : '0')};
  right: ${(props) => props.rtlDirection && '0'};
  top: -50px;
  z-index: 99;
`

const MessageText = styled.pre<{
  fontFamily?: string
  color?: string
  withAttachment?: boolean
  fontSize?: string
  lineHeight?: string
  showMessageSenderName?: boolean
  isRepliedMessage?: boolean
  withMediaAttachment?: boolean
  isForwarded?: boolean
  withPaddings?: boolean
}>`
  display: flow-root;
  position: relative;
  font-family: ${(props) => props.fontFamily || 'sans-serif'};
  margin: 0;
  padding: ${(props) =>
    props.withAttachment &&
    (props.showMessageSenderName
      ? props.withPaddings
        ? '0 12px 10px'
        : '0 0 10px'
      : props.isForwarded
        ? props.withPaddings
          ? '4px 12px 10px'
          : '4px 0px 10px'
        : '8px 12px 10px')};
  padding-bottom: ${(props) => props.withAttachment && !props.withMediaAttachment && '2px'};
    //font-size: ${(props) => props.fontSize || '15px'};
  font-size: ${(props) => props.fontSize || '16px'};
  line-height: ${(props) => props.lineHeight || '20px'};
  font-weight: 400;
  word-wrap: break-word;
  white-space: pre-wrap;
  //white-space: normal;
  //letter-spacing: -0.2px;
  letter-spacing: 0.3px;
  color: ${(props) => props.color || '#17191C'};
  user-select: text;
  //overflow: hidden;

  ${(props) =>
    props.isRepliedMessage &&
    `
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-overflow: ellipsis;
  `}
  &::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0;
    height: 1px;
  }

  & a {
    color: ${'#438CED'};
  }
`
