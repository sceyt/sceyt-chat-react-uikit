import styled from 'styled-components'
import React, { FC, useRef } from 'react'
import moment from 'moment'
// Hooks
import { useColor } from 'hooks'
// Assets
import { ReactComponent as ForwardIcon } from '../../../assets/svg/forward.svg'
// Helpers
import { calculateRenderedImageWidth } from 'helpers'
import { isJSON } from 'helpers/message'
import { getClient } from 'common/client'
import { getShowOnlyContactUsers } from 'helpers/contacts'
import { getSendAttachmentsAsSeparateMessages } from 'helpers/customUploader'
import {
  attachmentTypes,
  DEFAULT_CHANNEL_TYPE,
  MESSAGE_DELIVERY_STATUS,
  MESSAGE_STATUS,
  THEME
} from 'helpers/constants'
import { MessageText } from 'UIHelper'
import { colors, THEME_COLOR_NAMES } from 'UIHelper/constants'
import { IAttachment, IChannel, IMessage, IUser } from 'types'
// Components
import MessageActions from '../MessageActions'
import RepliedMessage from '../RepliedMessage'
import MessageHeader from '../MessageHeader'
import Attachment from 'components/Attachment'
import EmojisPopup from 'components/Emojis'
import FrequentlyEmojis from 'components/Emojis/frequentlyEmojis'
import { MessageStatusIcon, MessageTextFormat } from 'messageUtils'
import { IMessageActions } from '../Message.types'

interface IMessageBodyProps {
  message: IMessage
  channel: IChannel
  MessageActionsMenu?: FC<IMessageActions>

  isPendingMessage?: boolean
  prevMessage?: IMessage
  nextMessage: IMessage
  handleScrollToRepliedMessage: (msgId: string) => void
  handleMediaItemClick?: (attachment: IAttachment) => void
  unreadMessageId: string
  isUnreadMessage: boolean
  isThreadMessage: boolean
  fontFamily?: string
  ownMessageOnRightSide?: boolean
  showSenderNameOnDirectChannel?: boolean
  showSenderNameOnGroupChannel?: boolean
  showSenderNameOnOwnMessages?: boolean
  messageStatusAndTimePosition?: 'bottomOfMessage' | 'onMessage'
  messageStatusDisplayingType?: 'ticks' | 'text'
  ownMessageBackground?: string
  incomingMessageBackground?: string
  ownRepliedMessageBackground?: string
  incomingRepliedMessageBackground?: string
  showMessageStatus?: boolean
  showMessageTimeAndStatusOnlyOnHover?: boolean
  showMessageTime?: boolean
  showMessageStatusForEachMessage?: boolean
  showMessageTimeForEachMessage?: boolean
  messageReaction?: boolean
  editMessage?: boolean
  copyMessage?: boolean
  replyMessage?: boolean
  replyMessageInThread?: boolean
  forwardMessage?: boolean
  deleteMessage?: boolean
  selectMessage?: boolean
  allowEditDeleteIncomingMessage?: boolean
  reportMessage?: boolean
  reactionIcon?: JSX.Element
  editIcon?: JSX.Element
  copyIcon?: JSX.Element
  replyIcon?: JSX.Element
  replyInThreadIcon?: JSX.Element
  forwardIcon?: JSX.Element
  deleteIcon?: JSX.Element
  selectIcon?: JSX.Element
  starIcon?: JSX.Element
  staredIcon?: JSX.Element
  reportIcon?: JSX.Element
  fixEmojiCategoriesTitleOnTop?: boolean
  emojisCategoryIconsPosition?: 'top' | 'bottom'
  emojisContainerBorderRadius?: string
  reactionIconOrder?: number
  editIconOrder?: number
  copyIconOrder?: number
  replyIconOrder?: number
  replyInThreadIconOrder?: number
  forwardIconOrder?: number
  deleteIconOrder?: number
  selectIconOrder?: number
  starIconOrder?: number
  reportIconOrder?: number
  reactionIconTooltipText?: string
  editIconTooltipText?: string
  copyIconTooltipText?: string
  replyIconTooltipText?: string
  replyInThreadIconTooltipText?: string
  forwardIconTooltipText?: string
  deleteIconTooltipText?: string
  selectIconTooltipText?: string
  starIconTooltipText?: string
  reportIconTooltipText?: string
  messageActionIconsColor?: string
  inlineReactionIcon?: JSX.Element
  messageStatusSize?: string
  messageStatusColor?: string
  messageReadStatusColor?: string
  messageStateFontSize?: string
  messageStateColor?: string
  messageTimeFontSize?: string
  messageTimeColor?: string
  messageStatusAndTimeLineHeight?: string
  fileAttachmentsBoxWidth?: number
  fileAttachmentsBoxBackground?: string
  fileAttachmentsBoxBorder?: string
  fileAttachmentsTitleColor?: string
  fileAttachmentsSizeColor?: string
  fileAttachmentsIcon?: JSX.Element
  imageAttachmentMaxWidth?: number
  imageAttachmentMaxHeight?: number
  videoAttachmentMaxWidth?: number
  videoAttachmentMaxHeight?: number
  selectedMessagesMap?: Map<string, IMessage>
  contactsMap: { [key: string]: any }
  openedMessageMenuId?: string
  connectionStatus: string
  theme: string
  messageTextFontSize?: string
  messageTextLineHeight?: string
  messageActionsShow?: boolean
  setMessageActionsShow: (state: boolean) => void
  closeMessageActions: () => void
  handleToggleForwardMessagePopup: () => void
  handleReplyMessage: (rely: boolean) => void
  handleToggleDeleteMessagePopup: () => void
  handleToggleReportPopupOpen: () => void
  handleResendMessage: () => void
  handleOpenEmojis: () => void
  setEmojisPopupOpen: (state: boolean) => void
  emojisPopupOpen: boolean
  emojisPopupPosition: string
  frequentlyEmojisOpen: boolean
  handleCopyMessage: () => void
  toggleEditMode: () => void
  handleSelectMessage: () => void
  handleMouseEnter: () => void
  handleMouseLeave: () => void
  handleDeletePendingMessage: () => void
  handleReactionAddDelete: (emoji: any) => void
  handleCreateChat: (user?: IUser) => void
}

const MessageBody = ({
  message,
  channel,
  MessageActionsMenu,
  handleScrollToRepliedMessage,
  handleMediaItemClick,
  isPendingMessage,
  prevMessage,
  nextMessage,
  isUnreadMessage,
  unreadMessageId,
  isThreadMessage,
  fontFamily,
  ownMessageOnRightSide,
  showSenderNameOnDirectChannel = false,
  showSenderNameOnGroupChannel = true,
  showSenderNameOnOwnMessages = true,
  messageStatusAndTimePosition = 'onMessage',
  messageStatusDisplayingType = 'ticks',
  ownMessageBackground,
  incomingMessageBackground,
  ownRepliedMessageBackground,
  incomingRepliedMessageBackground,
  showMessageStatus = true,
  showMessageTimeAndStatusOnlyOnHover,
  showMessageTime = true,
  showMessageStatusForEachMessage = true,
  showMessageTimeForEachMessage = true,
  messageReaction = true,
  editMessage = true,
  copyMessage = true,
  replyMessage = true,
  replyMessageInThread = false,
  deleteMessage = true,
  selectMessage = true,
  allowEditDeleteIncomingMessage,
  forwardMessage = true,
  reportMessage = false,
  reactionIcon,
  editIcon,
  copyIcon,
  replyIcon,
  replyInThreadIcon,
  forwardIcon,
  deleteIcon,
  selectIcon,
  starIcon,
  staredIcon,
  reportIcon,
  reactionIconOrder,
  editIconOrder,
  copyIconOrder,
  replyIconOrder,
  replyInThreadIconOrder,
  forwardIconOrder,
  deleteIconOrder,
  selectIconOrder,
  starIconOrder,
  reportIconOrder,
  reactionIconTooltipText,
  editIconTooltipText,
  copyIconTooltipText,
  replyIconTooltipText,
  replyInThreadIconTooltipText,
  forwardIconTooltipText,
  deleteIconTooltipText,
  selectIconTooltipText,
  starIconTooltipText,
  reportIconTooltipText,
  messageActionIconsColor,
  messageStatusSize,
  messageStatusColor,
  messageReadStatusColor,
  messageStateFontSize,
  messageStateColor,
  messageTimeFontSize,
  messageTimeColor,
  messageStatusAndTimeLineHeight,
  fileAttachmentsIcon,
  fileAttachmentsBoxWidth,
  fileAttachmentsBoxBorder,
  fileAttachmentsTitleColor,
  fileAttachmentsSizeColor,
  imageAttachmentMaxWidth,
  imageAttachmentMaxHeight,
  videoAttachmentMaxWidth,
  videoAttachmentMaxHeight,
  emojisCategoryIconsPosition,
  emojisContainerBorderRadius,
  fixEmojiCategoriesTitleOnTop,
  selectedMessagesMap,
  contactsMap,
  theme,
  messageTextFontSize,
  messageTextLineHeight,
  handleToggleForwardMessagePopup,
  messageActionsShow,
  closeMessageActions,
  handleDeletePendingMessage,
  handleReplyMessage,
  handleToggleDeleteMessagePopup,
  handleToggleReportPopupOpen,
  handleResendMessage,
  handleOpenEmojis,
  emojisPopupOpen,
  setEmojisPopupOpen,
  emojisPopupPosition,
  frequentlyEmojisOpen,
  handleCopyMessage,
  toggleEditMode,
  handleSelectMessage,
  handleMouseEnter,
  handleMouseLeave,
  handleReactionAddDelete,
  handleCreateChat
}: IMessageBodyProps) => {
  const {
    [THEME_COLOR_NAMES.ACCENT]: accentColor,
    [THEME_COLOR_NAMES.TEXT_PRIMARY]: textPrimary,
    [THEME_COLOR_NAMES.TEXT_SECONDARY]: textSecondary
  } = useColor()

  const bubbleOutgoing =
    theme === THEME.DARK ? colors.outgoingMessageBackgroundDark : colors.outgoingMessageBackgroundLight
  const bubbleIncoming =
    theme === THEME.DARK ? colors.incomingMessageBackgroundDark : colors.incomingMessageBackgroundLight

  const ChatClient = getClient()
  const { user } = ChatClient
  const getFromContacts = getShowOnlyContactUsers()
  const messageTextRef = useRef<any>(null)
  const messageUserID = message.user ? message.user.id : 'deleted'
  const prevMessageUserID = prevMessage ? (prevMessage.user ? prevMessage.user.id : 'deleted') : null
  const nextMessageUserID = nextMessage ? (nextMessage.user ? nextMessage.user.id : 'deleted') : null
  const current = moment(message.createdAt).startOf('day')
  const firstMessageInInterval =
    !(prevMessage && current.diff(moment(prevMessage.createdAt).startOf('day'), 'days') === 0) ||
    prevMessage?.type === 'system' ||
    unreadMessageId === prevMessage.id
  const lastMessageInInterval =
    !(nextMessage && current.diff(moment(nextMessage.createdAt).startOf('day'), 'days') === 0) ||
    nextMessage.type === 'system'
  const messageTimeVisible = showMessageTime && (showMessageTimeForEachMessage || !nextMessage)
  const messageStatusVisible =
    !message.incoming &&
    showMessageStatus &&
    message.state !== MESSAGE_STATUS.DELETE &&
    (showMessageStatusForEachMessage || !nextMessage)

  const withAttachments = message.attachments && message.attachments.length > 0
  const notLinkAttachment =
    withAttachments && message.attachments.some((a: IAttachment) => a.type !== attachmentTypes.link)

  const messageOwnerIsNotCurrentUser = !!(message.user && message.user.id !== user.id && message.user.id)
  const mediaAttachment =
    withAttachments &&
    message.attachments.find(
      (attachment: IAttachment) =>
        attachment.type === attachmentTypes.video || attachment.type === attachmentTypes.image
    )
  const withMediaAttachment = !!mediaAttachment
  const attachmentMetas =
    mediaAttachment &&
    (isJSON(mediaAttachment.metadata) ? JSON.parse(mediaAttachment.metadata) : mediaAttachment.metadata)

  const borderRadius =
    message.incoming && incomingMessageBackground === 'inherit'
      ? '0px'
      : !message.incoming && ownMessageBackground === 'inherit'
        ? '0px'
        : !message.incoming && ownMessageOnRightSide
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

  const showMessageSenderName =
    (isUnreadMessage || prevMessageUserID !== messageUserID || firstMessageInInterval) &&
    (channel.type === DEFAULT_CHANNEL_TYPE.DIRECT ? showSenderNameOnDirectChannel : showSenderNameOnGroupChannel) &&
    (message.incoming || showSenderNameOnOwnMessages)

  const selectionIsActive = selectedMessagesMap && selectedMessagesMap.size > 0

  const handleRemoveFailedAttachment = (attachmentId: string) => {
    console.log('remove attachment .. ', attachmentId)
    // TODO implement remove failed attachment
    // dispatch(removeFailedAttachment(message.tid, attachmentId));
  }

  return (
    <MessageBodyContainer
      className='messageBody'
      isSelfMessage={!message.incoming}
      isReplyMessage={!!(message.parentMessage && message.parentMessage.id && !isThreadMessage)}
      rtlDirection={ownMessageOnRightSide && !message.incoming}
      parentMessageIsVoice={
        message.parentMessage &&
        message.parentMessage.attachments &&
        message.parentMessage.attachments[0] &&
        message.parentMessage.attachments[0].type === attachmentTypes.voice
      }
      ownMessageBackground={ownMessageBackground || bubbleOutgoing}
      incomingMessageBackground={incomingMessageBackground || bubbleIncoming}
      borderRadius={borderRadius}
      withAttachments={notLinkAttachment}
      attachmentWidth={
        withAttachments
          ? mediaAttachment
            ? (attachmentMetas &&
                getSendAttachmentsAsSeparateMessages() &&
                attachmentMetas.szw &&
                calculateRenderedImageWidth(
                  attachmentMetas.szw,
                  attachmentMetas.szh,

                  mediaAttachment.type === attachmentTypes.image ? imageAttachmentMaxWidth : videoAttachmentMaxWidth,
                  mediaAttachment.type === attachmentTypes.image ? imageAttachmentMaxHeight : videoAttachmentMaxHeight
                  // imageAttachmentMaxWidth,
                  // imageAttachmentMaxHeight
                )[0]) ||
              420
            : /*: message.attachments[0].type === attachmentTypes.link
                ? 324 */
              message.attachments[0].type === attachmentTypes.voice
              ? 254
              : message.attachments[0].type === attachmentTypes.file
                ? fileAttachmentsBoxWidth
                : undefined
          : undefined
      }
      noBody={!message.body && !withAttachments}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {showMessageSenderName && (
        <MessageHeader
          message={message}
          ownMessageOnRightSide={ownMessageOnRightSide}
          ownMessageBackground={ownMessageBackground}
          incomingMessageBackground={incomingMessageBackground}
          contactsMap={contactsMap}
          withMediaAttachment={withMediaAttachment}
          withAttachments={withAttachments}
          notLinkAttachment={notLinkAttachment}
          messageOwnerIsNotCurrentUser={messageOwnerIsNotCurrentUser}
          showMessageSenderName={showMessageSenderName}
          getFromContacts={getFromContacts}
          handleCreateChat={handleCreateChat}
        />
      )}
      {!isThreadMessage &&
        messageActionsShow &&
        !selectionIsActive &&
        !emojisPopupOpen &&
        !frequentlyEmojisOpen &&
        (MessageActionsMenu ? (
          <MessageActionsMenu
            message={message}
            channel={channel}
            isThreadMessage={isThreadMessage}
            rtlDirection={ownMessageOnRightSide && !message.incoming}
            handleSetMessageForEdit={toggleEditMode}
            handleOpenDeleteMessage={handleToggleDeleteMessagePopup}
            handleCopyMessage={handleCopyMessage}
            handleOpenForwardMessage={handleToggleForwardMessagePopup}
            handleResendMessage={handleResendMessage}
            handleReplyMessage={() => handleReplyMessage(false)}
            handleReportMessage={handleToggleReportPopupOpen}
            handleSelectMessage={handleSelectMessage}
            handleOpenEmojis={handleOpenEmojis}
          />
        ) : (
          <MessageActions
            messageFrom={message.user}
            channel={channel}
            editModeToggle={toggleEditMode}
            messageStatus={message.deliveryStatus || MESSAGE_DELIVERY_STATUS.PENDING}
            handleOpenDeleteMessage={handleToggleDeleteMessagePopup}
            handleCopyMessage={handleCopyMessage}
            handleDeletePendingMessage={handleDeletePendingMessage}
            handleOpenForwardMessage={handleToggleForwardMessagePopup}
            handleResendMessage={handleResendMessage}
            handleReplyMessage={handleReplyMessage}
            handleReportMessage={handleToggleReportPopupOpen}
            handleSelectMessage={handleSelectMessage}
            handleOpenEmojis={handleOpenEmojis}
            selfMessage={message.user && messageUserID === user.id}
            isThreadMessage={isThreadMessage}
            rtlDirection={ownMessageOnRightSide && !message.incoming}
            showMessageReaction={messageReaction}
            showEditMessage={
              editMessage &&
              !message.forwardingDetails &&
              !(
                message.attachments &&
                message.attachments.length &&
                message.attachments[0].type === attachmentTypes.voice
              )
            }
            showCopyMessage={copyMessage && message.body}
            showReplyMessage={replyMessage}
            showReplyMessageInThread={replyMessageInThread}
            showForwardMessage={forwardMessage}
            showDeleteMessage={deleteMessage}
            showSelectMessage={selectMessage}
            showReportMessage={reportMessage}
            reactionIcon={reactionIcon}
            editIcon={editIcon}
            copyIcon={copyIcon}
            replyIcon={replyIcon}
            replyInThreadIcon={replyInThreadIcon}
            forwardIcon={forwardIcon}
            deleteIcon={deleteIcon}
            selectIcon={selectIcon}
            allowEditDeleteIncomingMessage={allowEditDeleteIncomingMessage}
            starIcon={starIcon}
            staredIcon={staredIcon}
            reportIcon={reportIcon}
            reactionIconOrder={reactionIconOrder}
            editIconOrder={editIconOrder}
            copyIconOrder={copyIconOrder}
            replyIconOrder={replyIconOrder}
            replyInThreadIconOrder={replyInThreadIconOrder}
            forwardIconOrder={forwardIconOrder}
            deleteIconOrder={deleteIconOrder}
            selectIconOrder={selectIconOrder}
            starIconOrder={starIconOrder}
            reportIconOrder={reportIconOrder}
            reactionIconTooltipText={reactionIconTooltipText}
            editIconTooltipText={editIconTooltipText}
            copyIconTooltipText={copyIconTooltipText}
            replyIconTooltipText={replyIconTooltipText}
            replyInThreadIconTooltipText={replyInThreadIconTooltipText}
            forwardIconTooltipText={forwardIconTooltipText}
            deleteIconTooltipText={deleteIconTooltipText}
            selectIconTooltipText={selectIconTooltipText}
            starIconTooltipText={starIconTooltipText}
            reportIconTooltipText={reportIconTooltipText}
            messageActionIconsColor={messageActionIconsColor}
            myRole={channel.userRole}
            isIncoming={message.incoming}
          />
        ))}
      {message.parentMessage && message.parentMessage.id && !isThreadMessage && (
        <RepliedMessage
          message={message}
          theme={theme}
          isPendingMessage={isPendingMessage}
          handleScrollToRepliedMessage={handleScrollToRepliedMessage}
          ownMessageOnRightSide={ownMessageOnRightSide}
          ownRepliedMessageBackground={ownRepliedMessageBackground}
          incomingRepliedMessageBackground={incomingRepliedMessageBackground}
          fileAttachmentsBoxWidth={fileAttachmentsBoxWidth}
          fileAttachmentsBoxBorder={fileAttachmentsBoxBorder}
          fileAttachmentsTitleColor={fileAttachmentsTitleColor}
          fileAttachmentsSizeColor={fileAttachmentsSizeColor}
          fileAttachmentsIcon={fileAttachmentsIcon}
          imageAttachmentMaxWidth={imageAttachmentMaxWidth}
          imageAttachmentMaxHeight={imageAttachmentMaxHeight}
          videoAttachmentMaxWidth={videoAttachmentMaxWidth}
          videoAttachmentMaxHeight={videoAttachmentMaxHeight}
          selectedMessagesMap={selectedMessagesMap}
          contactsMap={contactsMap}
          selectionIsActive={selectionIsActive}
          borderRadius={borderRadius}
          showMessageSenderName={showMessageSenderName}
          notLinkAttachment={notLinkAttachment}
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
            leftPadding={
              message.incoming ? incomingMessageBackground !== 'inherit' : ownMessageBackground !== 'inherit'
            }
            color={accentColor}
          >
            <ForwardIcon />
            Forwarded message
          </ForwardedTitle>
        )}
      <MessageText
        theme={theme}
        draggable={false}
        color={textPrimary}
        fontSize={messageTextFontSize}
        lineHeight={messageTextLineHeight}
        showMessageSenderName={showMessageSenderName}
        withPaddings={message.incoming ? incomingMessageBackground !== 'inherit' : ownMessageBackground !== 'inherit'}
        withAttachment={notLinkAttachment && !!message.body}
        withMediaAttachment={withMediaAttachment}
        fontFamily={fontFamily}
        isForwarded={!!message.forwardingDetails}
      >
        <span ref={messageTextRef}>
          {MessageTextFormat({
            text: message.body,
            message,
            contactsMap,
            getFromContacts,
            accentColor
          })}
        </span>
        {!withAttachments && message.state === MESSAGE_STATUS.DELETE ? (
          <MessageStatusDeleted color={textSecondary}> Message was deleted. </MessageStatusDeleted>
        ) : (
          ''
        )}
        {messageStatusAndTimePosition === 'onMessage' &&
        !notLinkAttachment &&
        (messageStatusVisible || messageTimeVisible) ? (
          <MessageStatusAndTime
            lineHeight={messageStatusAndTimeLineHeight}
            showOnlyOnHover={showMessageTimeAndStatusOnlyOnHover}
            leftMargin
            isSelfMessage={!message.incoming}
          >
            {message.state === MESSAGE_STATUS.EDIT ? (
              <MessageStatusUpdated color={messageStateColor || textSecondary} fontSize={messageStateFontSize}>
                edited
              </MessageStatusUpdated>
            ) : (
              ''
            )}
            {messageTimeVisible && (
              <HiddenMessageTime color={messageTimeColor || textSecondary} fontSize={messageTimeFontSize}>{`${moment(
                message.createdAt
              ).format('HH:mm')}`}</HiddenMessageTime>
            )}
            {messageStatusVisible && (
              <MessageStatus height={messageStatusAndTimeLineHeight}>
                {MessageStatusIcon({
                  messageStatus: message.deliveryStatus,
                  messageStatusDisplayingType,
                  size: messageStatusSize,
                  iconColor: messageStatusColor,
                  readIconColor: messageReadStatusColor,
                  accentColor
                })}
              </MessageStatus>
            )}
          </MessageStatusAndTime>
        ) : null}
      </MessageText>
      {notLinkAttachment &&
        messageStatusAndTimePosition === 'onMessage' &&
        (messageStatusVisible || messageTimeVisible) && (
          <MessageStatusAndTime
            lineHeight={messageStatusAndTimeLineHeight}
            showOnlyOnHover={showMessageTimeAndStatusOnlyOnHover}
            withAttachment
            leftMargin
            isSelfMessage={!message.incoming}
            fileAttachment={message.attachments[0].type === 'file' || message.attachments[0].type === 'voice'}
            statusColor={textSecondary}
          >
            {message.state === MESSAGE_STATUS.EDIT ? (
              <MessageStatusUpdated
                fontSize={messageStateFontSize}
                color={
                  message.attachments[0].type !== 'voice' && message.attachments[0].type !== 'file'
                    ? colors.white
                    : messageStateColor || textSecondary
                }
              >
                edited
              </MessageStatusUpdated>
            ) : (
              ''
            )}
            {messageTimeVisible && (
              <HiddenMessageTime color={messageTimeColor || textSecondary} fontSize={messageTimeFontSize}>{`${moment(
                message.createdAt
              ).format('HH:mm')}`}</HiddenMessageTime>
            )}
            {messageStatusVisible &&
              MessageStatusIcon({
                messageStatus: message.deliveryStatus,
                messageStatusDisplayingType,
                size: messageStatusSize,
                iconColor:
                  message.attachments[0].type !== 'voice' && message.attachments[0].type !== 'file' ? colors.white : '',
                readIconColor: messageReadStatusColor,
                accentColor
              })}
          </MessageStatusAndTime>
        )}
      {
        withAttachments &&
          (message.attachments as any[]).map((attachment: any) => (
            <Attachment
              key={attachment.tid || attachment.url}
              handleMediaItemClick={selectionIsActive ? undefined : handleMediaItemClick}
              attachment={{
                ...attachment,
                metadata: isJSON(attachment.metadata) ? JSON.parse(attachment.metadata) : attachment.metadata
              }}
              removeSelected={handleRemoveFailedAttachment}
              imageMinWidth={
                message.parentMessage &&
                message.parentMessage.attachments &&
                message.parentMessage.attachments[0] &&
                message.parentMessage.attachments[0].type === attachmentTypes.voice
                  ? '210px'
                  : undefined
              }
              borderRadius={ownMessageOnRightSide ? borderRadius : '16px'}
              selectedFileAttachmentsIcon={fileAttachmentsIcon}
              backgroundColor={
                message.incoming ? incomingMessageBackground || bubbleIncoming : ownMessageBackground || bubbleOutgoing
              }
              selectedFileAttachmentsBoxBorder={fileAttachmentsBoxBorder}
              selectedFileAttachmentsTitleColor={fileAttachmentsTitleColor}
              selectedFileAttachmentsSizeColor={fileAttachmentsSizeColor}
              closeMessageActions={closeMessageActions}
              fileAttachmentWidth={fileAttachmentsBoxWidth}
              imageAttachmentMaxWidth={imageAttachmentMaxWidth}
              imageAttachmentMaxHeight={imageAttachmentMaxHeight}
              videoAttachmentMaxWidth={videoAttachmentMaxWidth}
              videoAttachmentMaxHeight={videoAttachmentMaxHeight}
            />
          ))
        // </MessageAttachments>
      }
      {emojisPopupOpen && emojisPopupPosition && (
        <EmojiContainer
          id={`${message.id}_emoji_popup_container`}
          position={emojisPopupPosition}
          rtlDirection={ownMessageOnRightSide && !message.incoming}
        >
          {message.deliveryStatus && message.deliveryStatus !== MESSAGE_DELIVERY_STATUS.PENDING && (
            <EmojisPopup
              relativePosition
              emojisPopupPosition={emojisPopupPosition}
              emojisCategoryIconsPosition={emojisCategoryIconsPosition}
              emojisContainerBorderRadius={emojisContainerBorderRadius}
              fixEmojiCategoriesTitleOnTop={fixEmojiCategoriesTitleOnTop}
              rtlDirection={ownMessageOnRightSide && !message.incoming}
              handleEmojiPopupToggle={setEmojisPopupOpen}
              handleAddEmoji={handleReactionAddDelete}
            />
          )}
        </EmojiContainer>
      )}
      {frequentlyEmojisOpen && !emojisPopupOpen && (
        <FrequentlyEmojisContainer
          id='frequently_emojis_container'
          rtlDirection={ownMessageOnRightSide && !message.incoming}
        >
          <FrequentlyEmojis
            rtlDirection={ownMessageOnRightSide && !message.incoming}
            handleAddEmoji={handleReactionAddDelete}
            handleEmojiPopupToggle={setEmojisPopupOpen}
            frequentlyEmojis={message.userReactions}
          />
        </FrequentlyEmojisContainer>
      )}
    </MessageBodyContainer>
  )
}

export default React.memo(MessageBody, (prevProps, nextProps) => {
  return (
    prevProps.message.deliveryStatus === nextProps.message.deliveryStatus &&
    prevProps.message.state === nextProps.message.state &&
    prevProps.message.userReactions === nextProps.message.userReactions &&
    prevProps.message.body === nextProps.message.body &&
    prevProps.message.reactionTotals === nextProps.message.reactionTotals &&
    prevProps.message.attachments === nextProps.message.attachments &&
    prevProps.message.userMarkers === nextProps.message.userMarkers &&
    prevProps.prevMessage === nextProps.prevMessage &&
    prevProps.nextMessage === nextProps.nextMessage &&
    prevProps.selectedMessagesMap === nextProps.selectedMessagesMap &&
    prevProps.contactsMap === nextProps.contactsMap &&
    prevProps.connectionStatus === nextProps.connectionStatus &&
    prevProps.openedMessageMenuId === nextProps.openedMessageMenuId &&
    prevProps.theme === nextProps.theme
  )
})

const ForwardedTitle = styled.h3<{
  withAttachments?: boolean
  withBody?: boolean
  showSenderName?: boolean
  withPadding?: boolean
  leftPadding?: boolean
  withMediaAttachment?: boolean
  color?: string
}>`
  display: flex;
  align-items: center;
  font-weight: 500;
  font-size: 13px;
  line-height: 16px;
  color: ${(props) => props.color};
  //margin: ${(props) => (props.withAttachments && props.withBody ? '0' : '0 0 4px')};
  margin: 0;
  padding: ${(props) => props.withPadding && (props.leftPadding ? '8px 0 0 12px' : '8px 0 0 ')};
  padding-top: ${(props) => props.showSenderName && (props.withBody ? '4px' : '0')};
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
    color: ${(props) => props.color};
  }
`
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

const MessageStatusAndTime = styled.span<{
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
  statusColor?: string
}>`
  visibility: ${(props: any) => props.showOnlyOnHover && 'hidden'};
  display: ${(props) => (props.hide ? 'none' : 'flex')};
  align-items: flex-end;
  border-radius: 16px;
  padding: ${(props) => props.withAttachment && '4px 6px'};
  background-color: ${(props) => props.withAttachment && !props.fileAttachment && 'rgba(1, 1, 1, 0.3)'};
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

  & > svg {
    margin-left: 4px;
    height: 14px;
    width: 16px;
  }

  & > ${HiddenMessageTime} {
    color: ${(props) => (props.fileAttachment ? props.statusColor : props.withAttachment ? colors.white : '')};
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

const MessageStatusUpdated = styled.span<{ color: string; fontSize?: string }>`
  margin-right: 4px;
  font-style: italic;
  font-weight: 400;
  font-size: ${(props: any) => props.fontSize || '12px'};
  color: ${(props) => props.color};
`

const MessageStatusDeleted = styled.span<{ color: string; fontSize?: string; withAttachment?: boolean }>`
  color: ${(props) => props.color};
  font-size: ${(props) => props.fontSize};
  font-style: italic;
`

const MessageBodyContainer = styled.div<{
  isSelfMessage?: boolean
  incomingMessageBackground?: string
  ownMessageBackground?: string
  borderRadius?: string
  withAttachments?: boolean
  noBody?: boolean
  isReplyMessage?: boolean
  rtlDirection?: boolean
  parentMessageIsVoice?: any
  attachmentWidth?: number
}>`
  position: relative;
  background-color: ${(props: any) =>
    props.isSelfMessage ? props.ownMessageBackground : props.incomingMessageBackground};
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

const EmojiContainer = styled.div<any>`
  position: absolute;
  left: ${(props: any) => (props.rtlDirection ? '' : '0')};
  right: ${(props) => props.rtlDirection && '0'};
  //top: ${(props) => (props.position === 'top' ? '-250px' : 'calc(100% + 6px)')};
  top: ${(props) => props.position === 'bottom' && 'calc(100% + 4px)'};
  bottom: ${(props) => props.position === 'top' && 'calc(100% + 4px)'};
  z-index: 99;
`

const FrequentlyEmojisContainer = styled.div<{ rtlDirection?: boolean }>`
  position: absolute;
  left: ${(props: any) => (props.rtlDirection ? '' : '0')};
  right: ${(props) => props.rtlDirection && '0'};
  top: -50px;
  z-index: 99;
`
