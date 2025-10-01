import styled from 'styled-components'
import React, { FC, useMemo } from 'react'
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
import { attachmentTypes, DEFAULT_CHANNEL_TYPE, MESSAGE_DELIVERY_STATUS, MESSAGE_STATUS } from 'helpers/constants'
import { MessageText } from 'UIHelper'
import { THEME_COLORS } from 'UIHelper/constants'
import { IAttachment, IChannel, IMessage, IUser } from 'types'
// Components
import MessageActions from '../MessageActions'
import RepliedMessage from '../RepliedMessage'
import MessageHeader from '../MessageHeader'
import Attachment from 'components/Attachment'
import EmojisPopup from 'components/Emojis'
import FrequentlyEmojis from 'components/Emojis/frequentlyEmojis'
import { MessageTextFormat } from 'messageUtils'
import { IMessageActions, IMessageStyles } from '../Message.types'
import MessageStatusAndTime from '../MessageStatusAndTime'
import log from 'loglevel'
import { OGMetadata } from '../OGMetadata'

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
  outgoingMessageStyles?: IMessageStyles
  incomingMessageStyles?: IMessageStyles
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
  showInfoMessage?: boolean
  allowEditDeleteIncomingMessage?: boolean
  reportMessage?: boolean
  reactionIcon?: JSX.Element
  editIcon?: JSX.Element
  copyIcon?: JSX.Element
  replyIcon?: JSX.Element
  replyInThreadIcon?: JSX.Element
  forwardIcon?: JSX.Element
  deleteIcon?: JSX.Element
  infoIcon?: JSX.Element
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
  infoIconOrder?: number
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
  infoIconTooltipText?: string
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
  messageTimeColorOnAttachment?: string
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
  handleToggleInfoMessagePopupOpen: () => void
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
  messageTextRef: React.RefObject<HTMLSpanElement>
  handleOpenUserProfile: (user: IUser) => void
  shouldOpenUserProfileForMention?: boolean
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
  outgoingMessageStyles,
  incomingMessageStyles,
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
  showInfoMessage,
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
  infoIcon,
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
  infoIconOrder,
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
  infoIconTooltipText,
  messageActionIconsColor,
  messageStatusSize,
  messageStatusColor,
  messageReadStatusColor,
  messageStateFontSize,
  messageStateColor,
  messageTimeFontSize,
  messageTimeColor,
  messageStatusAndTimeLineHeight,
  messageTimeColorOnAttachment,
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
  handleToggleInfoMessagePopupOpen,
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
  handleCreateChat,
  messageTextRef,
  handleOpenUserProfile,
  shouldOpenUserProfileForMention
}: IMessageBodyProps) => {
  const {
    [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.OUTGOING_MESSAGE_BACKGROUND]: outgoingMessageBackground,
    [THEME_COLORS.INCOMING_MESSAGE_BACKGROUND]: incomingMessageBackground,
    [THEME_COLORS.TEXT_ON_PRIMARY]: textOnPrimary,
    [THEME_COLORS.LINK_COLOR]: linkColor
  } = useColor()

  const bubbleOutgoing = outgoingMessageBackground
  const bubbleIncoming = incomingMessageBackground

  const ChatClient = getClient()
  const { user } = ChatClient
  const getFromContacts = getShowOnlyContactUsers()
  const messageUserID = message.user ? message.user.id : 'deleted'
  const prevMessageUserID = useMemo(
    () => (prevMessage ? (prevMessage.user ? prevMessage.user.id : 'deleted') : null),
    [prevMessage]
  )
  const nextMessageUserID = useMemo(
    () => (nextMessage ? (nextMessage.user ? nextMessage.user.id : 'deleted') : null),
    [nextMessage]
  )
  const current = useMemo(() => moment(message.createdAt).startOf('day'), [message.createdAt])
  const firstMessageInInterval = useMemo(
    () =>
      !(prevMessage && current.diff(moment(prevMessage.createdAt).startOf('day'), 'days') === 0) ||
      prevMessage?.type === 'system' ||
      unreadMessageId === prevMessage.id,
    [prevMessage, current, unreadMessageId]
  )
  const lastMessageInInterval = useMemo(
    () =>
      !(nextMessage && current.diff(moment(nextMessage.createdAt).startOf('day'), 'days') === 0) ||
      nextMessage.type === 'system',
    [nextMessage, current]
  )
  const messageTimeVisible = useMemo(
    () => showMessageTime && (showMessageTimeForEachMessage || !nextMessage),
    [showMessageTime, showMessageTimeForEachMessage, nextMessage]
  )
  const messageStatusVisible = useMemo(
    () =>
      !message.incoming &&
      showMessageStatus &&
      message.state !== MESSAGE_STATUS.DELETE &&
      (showMessageStatusForEachMessage || !nextMessage),
    [message.incoming, showMessageStatus, message.state, showMessageStatusForEachMessage, nextMessage]
  )
  const withAttachments = useMemo(() => message.attachments && message.attachments.length > 0, [message.attachments])
  const notLinkAttachment = useMemo(
    () => withAttachments && message.attachments.some((a: IAttachment) => a.type !== attachmentTypes.link),
    [withAttachments, message.attachments]
  )

  const linkAttachment = message.attachments.find((a: IAttachment) => a.type === attachmentTypes.link)
  const messageOwnerIsNotCurrentUser = !!(message.user && message.user.id !== user.id && message.user.id)
  const mediaAttachment = useMemo(
    () =>
      withAttachments &&
      message.attachments.find(
        (attachment: IAttachment) =>
          attachment.type === attachmentTypes.video || attachment.type === attachmentTypes.image,
        [withAttachments, message.attachments]
      ),
    [withAttachments, message.attachments]
  )
  const withMediaAttachment = useMemo(() => !!mediaAttachment, [mediaAttachment])
  const attachmentMetas = useMemo(
    () =>
      mediaAttachment &&
      (isJSON(mediaAttachment.metadata) ? JSON.parse(mediaAttachment.metadata) : mediaAttachment.metadata),
    [mediaAttachment]
  )

  const borderRadius = useMemo(
    () =>
      message.incoming && incomingMessageStyles?.background === 'inherit'
        ? '0px'
        : !message.incoming && outgoingMessageStyles?.background === 'inherit'
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
                : '4px 16px 16px 4px',
    [
      message.incoming,
      incomingMessageStyles?.background,
      outgoingMessageStyles?.background,
      prevMessageUserID,
      messageUserID,
      firstMessageInInterval,
      nextMessageUserID,
      lastMessageInInterval,
      ownMessageOnRightSide
    ]
  )
  const showMessageSenderName = useMemo(
    () =>
      (isUnreadMessage || prevMessageUserID !== messageUserID || firstMessageInInterval) &&
      (channel.type === DEFAULT_CHANNEL_TYPE.DIRECT ? showSenderNameOnDirectChannel : showSenderNameOnGroupChannel) &&
      (message.incoming || showSenderNameOnOwnMessages),
    [
      isUnreadMessage,
      prevMessageUserID,
      messageUserID,
      firstMessageInInterval,
      channel.type,
      showSenderNameOnDirectChannel,
      showSenderNameOnGroupChannel,
      message.incoming,
      showSenderNameOnOwnMessages
    ]
  )
  const selectionIsActive = useMemo(() => selectedMessagesMap && selectedMessagesMap.size > 0, [selectedMessagesMap])

  const handleRemoveFailedAttachment = (attachmentId: string) => {
    log.info('remove attachment .. ', attachmentId)
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
      outgoingMessageStyles={outgoingMessageStyles || { background: bubbleOutgoing }}
      incomingMessageStyles={incomingMessageStyles || { background: bubbleIncoming }}
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
          outgoingMessageStyles={outgoingMessageStyles}
          incomingMessageStyles={incomingMessageStyles}
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
            handleOpenInfoMessage={handleToggleInfoMessagePopupOpen}
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
            infoIconTooltipText={infoIconTooltipText}
            infoIcon={infoIcon}
            showInfoMessage={showInfoMessage}
            infoIconOrder={infoIconOrder}
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
              message.incoming
                ? incomingMessageStyles?.background !== 'inherit'
                : outgoingMessageStyles?.background !== 'inherit'
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
        withPaddings={
          message.incoming
            ? incomingMessageStyles?.background !== 'inherit'
            : outgoingMessageStyles?.background !== 'inherit'
        }
        withAttachment={notLinkAttachment && !!message.body}
        withMediaAttachment={withMediaAttachment}
        fontFamily={fontFamily}
        isForwarded={!!message.forwardingDetails}
        outgoingMessageStyles={outgoingMessageStyles}
        incomingMessageStyles={incomingMessageStyles}
        incoming={message.incoming}
        linkColor={linkColor}
      >
        {linkAttachment && (
          <OGMetadata attachments={[linkAttachment]} state={message.state} incoming={message.incoming} />
        )}
        <span ref={messageTextRef}>
          {MessageTextFormat({
            text: message.body,
            message,
            contactsMap,
            getFromContacts,
            accentColor,
            textSecondary,
            onMentionNameClick: handleOpenUserProfile,
            shouldOpenUserProfileForMention: !!shouldOpenUserProfileForMention
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
            message={message}
            showMessageTimeAndStatusOnlyOnHover={showMessageTimeAndStatusOnlyOnHover}
            messageStatusDisplayingType={messageStatusDisplayingType}
            messageStatusSize={messageStatusSize}
            messageStatusColor={messageStatusColor}
            messageReadStatusColor={messageReadStatusColor}
            messageStateFontSize={messageStateFontSize}
            messageStateColor={messageStateColor}
            messageTimeFontSize={messageTimeFontSize}
            messageTimeColor={messageTimeColor}
            messageStatusAndTimeLineHeight={messageStatusAndTimeLineHeight}
            messageTimeVisible={!!messageTimeVisible}
            messageStatusVisible={!!messageStatusVisible}
            leftMargin
            messageTimeColorOnAttachment={messageTimeColorOnAttachment || textOnPrimary}
          />
        ) : null}
      </MessageText>
      {notLinkAttachment &&
        messageStatusAndTimePosition === 'onMessage' &&
        (messageStatusVisible || messageTimeVisible) && (
          <MessageStatusAndTime
            message={message}
            showMessageTimeAndStatusOnlyOnHover={showMessageTimeAndStatusOnlyOnHover}
            messageStatusDisplayingType={messageStatusDisplayingType}
            messageStatusSize={messageStatusSize}
            messageStatusColor={
              message.attachments[0].type !== 'voice' && message.attachments[0].type !== 'file'
                ? textOnPrimary
                : messageStateColor || textSecondary
            }
            messageReadStatusColor={messageReadStatusColor}
            messageStateFontSize={messageStateFontSize}
            messageStateColor={messageStateColor}
            messageTimeFontSize={messageTimeFontSize}
            messageTimeColor={messageTimeColor}
            messageStatusAndTimeLineHeight={messageStatusAndTimeLineHeight}
            messageTimeVisible={!!messageTimeVisible}
            messageStatusVisible={!!messageStatusVisible}
            withAttachment={withAttachments}
            leftMargin
            fileAttachment={
              withAttachments && (message.attachments[0].type === 'file' || message.attachments[0].type === 'voice')
            }
            messageTimeColorOnAttachment={messageTimeColorOnAttachment || textOnPrimary}
          />
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
                message.incoming
                  ? incomingMessageStyles?.background || bubbleIncoming
                  : outgoingMessageStyles?.background || bubbleOutgoing
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
              messageType={message.type}
              messagePlayed={message.deliveryStatus === MESSAGE_DELIVERY_STATUS.PLAYED}
              channelId={message.channelId}
              incoming={message.incoming}
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
  return !!(
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
    prevProps.ownMessageOnRightSide === nextProps.ownMessageOnRightSide &&
    prevProps.showSenderNameOnDirectChannel === nextProps.showSenderNameOnDirectChannel &&
    prevProps.showSenderNameOnGroupChannel === nextProps.showSenderNameOnGroupChannel &&
    prevProps.showSenderNameOnOwnMessages === nextProps.showSenderNameOnOwnMessages &&
    prevProps.messageStatusAndTimePosition === nextProps.messageStatusAndTimePosition &&
    prevProps.messageStatusDisplayingType === nextProps.messageStatusDisplayingType &&
    prevProps.outgoingMessageStyles === nextProps.outgoingMessageStyles &&
    prevProps.incomingMessageStyles === nextProps.incomingMessageStyles &&
    prevProps.ownRepliedMessageBackground === nextProps.ownRepliedMessageBackground &&
    prevProps.incomingRepliedMessageBackground === nextProps.incomingRepliedMessageBackground &&
    prevProps.showMessageStatus === nextProps.showMessageStatus &&
    prevProps.showMessageTimeAndStatusOnlyOnHover === nextProps.showMessageTimeAndStatusOnlyOnHover &&
    prevProps.showMessageTime === nextProps.showMessageTime &&
    prevProps.showMessageStatusForEachMessage === nextProps.showMessageStatusForEachMessage &&
    prevProps.showMessageTimeForEachMessage === nextProps.showMessageTimeForEachMessage &&
    prevProps.messageReaction === nextProps.messageReaction &&
    prevProps.editMessage === nextProps.editMessage &&
    prevProps.copyMessage === nextProps.copyMessage &&
    prevProps.replyMessage === nextProps.replyMessage &&
    prevProps.replyMessageInThread === nextProps.replyMessageInThread &&
    prevProps.forwardMessage === nextProps.forwardMessage &&
    prevProps.deleteMessage === nextProps.deleteMessage &&
    prevProps.selectMessage === nextProps.selectMessage &&
    prevProps.allowEditDeleteIncomingMessage === nextProps.allowEditDeleteIncomingMessage &&
    prevProps.reportMessage === nextProps.reportMessage &&
    prevProps.reactionIcon === nextProps.reactionIcon &&
    prevProps.editIcon === nextProps.editIcon &&
    prevProps.copyIcon === nextProps.copyIcon &&
    prevProps.replyIcon === nextProps.replyIcon &&
    prevProps.replyInThreadIcon === nextProps.replyInThreadIcon &&
    prevProps.forwardIcon === nextProps.forwardIcon &&
    prevProps.deleteIcon === nextProps.deleteIcon &&
    prevProps.selectIcon === nextProps.selectIcon &&
    prevProps.starIcon === nextProps.starIcon &&
    prevProps.staredIcon === nextProps.staredIcon &&
    prevProps.reportIcon === nextProps.reportIcon &&
    prevProps.fixEmojiCategoriesTitleOnTop === nextProps.fixEmojiCategoriesTitleOnTop &&
    prevProps.emojisCategoryIconsPosition === nextProps.emojisCategoryIconsPosition &&
    prevProps.emojisContainerBorderRadius === nextProps.emojisContainerBorderRadius &&
    prevProps.reactionIconOrder === nextProps.reactionIconOrder &&
    prevProps.editIconOrder === nextProps.editIconOrder &&
    prevProps.copyIconOrder === nextProps.copyIconOrder &&
    prevProps.replyIconOrder === nextProps.replyIconOrder &&
    prevProps.replyInThreadIconOrder === nextProps.replyInThreadIconOrder &&
    prevProps.forwardIconOrder === nextProps.forwardIconOrder &&
    prevProps.deleteIconOrder === nextProps.deleteIconOrder &&
    prevProps.selectIconOrder === nextProps.selectIconOrder &&
    prevProps.starIconOrder === nextProps.starIconOrder &&
    prevProps.reportIconOrder === nextProps.reportIconOrder &&
    prevProps.reactionIconTooltipText === nextProps.reactionIconTooltipText &&
    prevProps.editIconTooltipText === nextProps.editIconTooltipText &&
    prevProps.copyIconTooltipText === nextProps.copyIconTooltipText &&
    prevProps.replyIconTooltipText === nextProps.replyIconTooltipText &&
    prevProps.replyInThreadIconTooltipText === nextProps.replyInThreadIconTooltipText &&
    prevProps.forwardIconTooltipText === nextProps.forwardIconTooltipText &&
    prevProps.deleteIconTooltipText === nextProps.deleteIconTooltipText &&
    prevProps.selectIconTooltipText === nextProps.selectIconTooltipText &&
    prevProps.starIconTooltipText === nextProps.starIconTooltipText &&
    prevProps.reportIconTooltipText === nextProps.reportIconTooltipText &&
    prevProps.messageActionIconsColor === nextProps.messageActionIconsColor &&
    prevProps.inlineReactionIcon === nextProps.inlineReactionIcon &&
    prevProps.messageStatusSize === nextProps.messageStatusSize &&
    prevProps.messageStatusColor === nextProps.messageStatusColor &&
    prevProps.messageReadStatusColor === nextProps.messageReadStatusColor &&
    prevProps.messageStateFontSize === nextProps.messageStateFontSize &&
    prevProps.messageStateColor === nextProps.messageStateColor &&
    prevProps.messageTimeFontSize === nextProps.messageTimeFontSize &&
    prevProps.messageTimeColor === nextProps.messageTimeColor &&
    prevProps.messageStatusAndTimeLineHeight === nextProps.messageStatusAndTimeLineHeight &&
    prevProps.fileAttachmentsBoxWidth === nextProps.fileAttachmentsBoxWidth &&
    prevProps.fileAttachmentsBoxBackground === nextProps.fileAttachmentsBoxBackground &&
    prevProps.fileAttachmentsBoxBorder === nextProps.fileAttachmentsBoxBorder &&
    prevProps.fileAttachmentsTitleColor === nextProps.fileAttachmentsTitleColor &&
    prevProps.fileAttachmentsSizeColor === nextProps.fileAttachmentsSizeColor &&
    prevProps.fileAttachmentsIcon === nextProps.fileAttachmentsIcon &&
    prevProps.imageAttachmentMaxWidth === nextProps.imageAttachmentMaxWidth &&
    prevProps.imageAttachmentMaxHeight === nextProps.imageAttachmentMaxHeight &&
    prevProps.videoAttachmentMaxWidth === nextProps.videoAttachmentMaxWidth &&
    prevProps.videoAttachmentMaxHeight === nextProps.videoAttachmentMaxHeight &&
    prevProps.theme === nextProps.theme &&
    prevProps.messageTextFontSize === nextProps.messageTextFontSize &&
    prevProps.messageTextLineHeight === nextProps.messageTextLineHeight &&
    prevProps.messageActionsShow === nextProps.messageActionsShow &&
    prevProps.emojisPopupOpen === nextProps.emojisPopupOpen &&
    prevProps.emojisPopupPosition === nextProps.emojisPopupPosition &&
    prevProps.frequentlyEmojisOpen === nextProps.frequentlyEmojisOpen
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

const MessageStatusDeleted = styled.span<{ color: string; fontSize?: string; withAttachment?: boolean }>`
  color: ${(props) => props.color};
  font-size: ${(props) => props.fontSize};
  font-style: italic;
`

const MessageBodyContainer = styled.div<{
  isSelfMessage?: boolean
  outgoingMessageStyles?: {
    background?: string
  }
  incomingMessageStyles?: {
    background?: string
  }
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
    props.isSelfMessage ? props.outgoingMessageStyles?.background : props.incomingMessageStyles?.background};
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
  width: max-content;
  padding: ${(props) =>
    props.withAttachments
      ? props.isReplyMessage
        ? '1px 0 0 '
        : '0'
      : props.isSelfMessage
        ? props.outgoingMessageStyles?.background === 'inherit'
          ? '0'
          : '8px 12px'
        : props.incomingMessageStyles?.background === 'inherit'
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
