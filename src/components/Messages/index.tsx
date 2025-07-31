import React, { FC } from 'react'
import MessageList from './MessageList'
import { IAttachment, IChannel, IMessage, IUser } from '../../types'
import { IAttachmentProperties, IMessageStyles } from '../Message/Message.types'
import { HiddenMessageProperty } from 'types/enum'

interface MessagesProps {
  fontFamily?: string
  ownMessageOnRightSide?: boolean
  messageWidthPercent?: string | number
  messageStatusAndTimePosition?: 'onMessage' | 'bottomOfMessage'
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
  hoverBackground?: boolean
  showSenderNameOnDirectChannel?: boolean
  showSenderNameOnOwnMessages?: boolean
  showSenderNameOnGroupChannel?: boolean
  MessageActionsMenu?: FC<{
    message: IMessage
    channel: IChannel
    handleSetMessageForEdit?: () => void
    handleResendMessage?: () => void
    handleOpenDeleteMessage?: () => void
    handleOpenForwardMessage?: () => void
    handleCopyMessage?: () => void
    handleReportMessage?: () => void
    handleOpenEmojis?: () => void
    handleSelectMessage?: () => void
    handleReplyMessage?: () => void

    isThreadMessage?: boolean
    rtlDirection?: boolean
  }>
  CustomMessageItem?: FC<{
    channel: IChannel
    message: IMessage
    prevMessage: IMessage
    nextMessage: IMessage
    unreadMessageId: string
    isUnreadMessage: boolean
    messageActionsShow: boolean
    selectionIsActive?: boolean
    emojisPopupOpen: boolean
    frequentlyEmojisOpen: boolean
    messageTextRef: any
    emojisPopupPosition: string
    handleSetMessageForEdit?: () => void
    handleResendMessage?: () => void
    handleOpenDeleteMessage?: () => void
    handleOpenForwardMessage?: () => void
    handleCopyMessage?: () => void
    handleReportMessage?: () => void
    handleSelectMessage?: () => void
    handleOpenEmojis?: () => void
    handleReplyMessage?: () => void
    handleMouseEnter: () => void
    handleMouseLeave: () => void
    closeMessageActions?: () => void
    setEmojisPopupOpen: () => void
    handleCreateChat: (user: IUser) => void
    handleReactionAddDelete: (selectedEmoji: any) => void
    handleScrollToRepliedMessage: (messageId: string) => void
    handleMediaItemClick?: (attachment: IAttachment) => void
    isThreadMessage?: boolean
  }>
  showOwnAvatar?: boolean
  messageReaction?: boolean
  editMessage?: boolean
  copyMessage?: boolean
  replyMessage?: boolean
  replyMessageInThread?: boolean
  forwardMessage?: boolean
  deleteMessage?: boolean
  selectMessage?: boolean
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
  openFrequentlyUsedReactions?: boolean
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
  allowEditDeleteIncomingMessage?: boolean
  starIconOrder?: number
  reportIconOrder?: number
  reactionIconTooltipText?: string
  editIconTooltipText?: string
  replyIconTooltipText?: string
  copyIconTooltipText?: string
  replyInThreadIconTooltipText?: string
  forwardIconTooltipText?: string
  deleteIconTooltipText?: string
  selectIconTooltipText?: string
  starIconTooltipText?: string
  reportIconTooltipText?: string
  messageActionIconsColor?: string
  dateDividerFontSize?: string
  dateDividerTextColor?: string
  dateDividerBorder?: string
  dateDividerBorderRadius?: string
  dateDividerBackgroundColor?: string
  showTopFixedDate?: boolean
  inlineReactionIcon?: JSX.Element
  reactionsDisplayCount?: number
  showEachReactionCount?: boolean
  showTotalReactionCount?: boolean
  reactionItemBorder?: string
  reactionItemBorderRadius?: string
  reactionItemBackground?: string
  reactionItemPadding?: string
  reactionItemMargin?: string
  reactionsFontSize?: string
  reactionsContainerBoxShadow?: string
  reactionsContainerBorder?: string
  reactionsContainerBorderRadius?: string
  reactionsContainerPadding?: string
  reactionsContainerBackground?: string
  reactionsContainerTopPosition?: string
  reactionsDetailsPopupBorderRadius?: string
  reactionsDetailsPopupHeaderItemsStyle?: 'bubbles' | 'inline'
  newMessagesSeparatorText?: string
  newMessagesSeparatorFontSize?: string
  newMessagesSeparatorTextColor?: string
  newMessagesSeparatorWidth?: string
  newMessagesSeparatorBorder?: string
  newMessagesSeparatorBorderRadius?: string
  newMessagesSeparatorBackground?: string
  newMessagesSeparatorTextLeftRightSpacesWidth?: string
  newMessagesSeparatorSpaceColor?: string
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
  attachmentsPreview?: IAttachmentProperties
  sameUserMessageSpacing?: string
  differentUserMessageSpacing?: string
  backgroundColor?: string
  messageTextFontSize?: string
  messageTextLineHeight?: string
  messageStatusSize?: string
  messageStatusColor?: string
  messageReadStatusColor?: string
  messageStateFontSize?: string
  messageStateColor?: string
  messageTimeFontSize?: string
  messageTimeColor?: string
  messageStatusAndTimeLineHeight?: string
  hiddenMessagesProperties?: HiddenMessageProperty[]
  shouldOpenUserProfileForMention?: boolean
}

const MessagesContainer: React.FC<MessagesProps> = ({
  fontFamily,
  ownMessageOnRightSide = true,
  messageWidthPercent,
  messageStatusAndTimePosition,
  messageStatusDisplayingType,
  showMessageStatus,
  showMessageTimeAndStatusOnlyOnHover,
  showMessageTime,
  showMessageStatusForEachMessage,
  showMessageTimeForEachMessage,
  outgoingMessageStyles,
  incomingMessageStyles,
  ownRepliedMessageBackground,
  incomingRepliedMessageBackground,
  hoverBackground = false,
  showSenderNameOnDirectChannel = false,
  showSenderNameOnOwnMessages = false,
  showSenderNameOnGroupChannel = true,
  showOwnAvatar = false,
  MessageActionsMenu,
  CustomMessageItem,
  messageReaction,
  editMessage,
  copyMessage,
  replyMessage,
  replyMessageInThread,
  forwardMessage,
  deleteMessage,
  selectMessage,
  reportMessage,
  reactionIcon,
  editIcon,
  copyIcon,
  replyIcon,
  replyInThreadIcon,
  forwardIcon,
  deleteIcon,
  selectIcon,
  allowEditDeleteIncomingMessage = true,
  starIcon,
  staredIcon,
  reportIcon,
  reactionIconOrder,
  openFrequentlyUsedReactions,
  fixEmojiCategoriesTitleOnTop,
  emojisCategoryIconsPosition,
  emojisContainerBorderRadius,
  reactionsDisplayCount,
  showEachReactionCount,
  showTotalReactionCount,
  reactionItemBorder,
  reactionItemBorderRadius,
  reactionItemBackground,
  reactionItemPadding,
  reactionItemMargin,
  reactionsFontSize,
  reactionsContainerBoxShadow,
  reactionsContainerBorder,
  reactionsContainerBorderRadius,
  reactionsContainerBackground,
  reactionsContainerPadding,
  reactionsContainerTopPosition,
  reactionsDetailsPopupBorderRadius,
  reactionsDetailsPopupHeaderItemsStyle = 'bubbles',
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
  dateDividerFontSize,
  dateDividerTextColor,
  dateDividerBorder,
  dateDividerBackgroundColor,
  dateDividerBorderRadius,
  showTopFixedDate = true,
  inlineReactionIcon,
  newMessagesSeparatorText,
  newMessagesSeparatorFontSize,
  newMessagesSeparatorTextColor,
  newMessagesSeparatorWidth,
  newMessagesSeparatorBorder,
  newMessagesSeparatorBorderRadius,
  newMessagesSeparatorBackground,
  newMessagesSeparatorTextLeftRightSpacesWidth,
  newMessagesSeparatorSpaceColor,
  fileAttachmentsIcon,
  fileAttachmentsBoxWidth,
  fileAttachmentsBoxBackground,
  fileAttachmentsBoxBorder,
  fileAttachmentsTitleColor,
  fileAttachmentsSizeColor,
  imageAttachmentMaxWidth,
  imageAttachmentMaxHeight,
  videoAttachmentMaxWidth,
  videoAttachmentMaxHeight,
  attachmentsPreview = {
    show: true,
    canDelete: true,
    canDownload: true,
    canForward: true
  },
  sameUserMessageSpacing,
  differentUserMessageSpacing,
  backgroundColor,
  messageTextFontSize,
  messageTextLineHeight,
  messageStatusSize,
  messageStatusColor,
  messageReadStatusColor,
  messageStateFontSize,
  messageStateColor,
  messageTimeFontSize,
  messageTimeColor,
  messageStatusAndTimeLineHeight,
  hiddenMessagesProperties = [],
  shouldOpenUserProfileForMention
}) => {
  return (
    <React.Fragment>
      <MessageList
        fontFamily={fontFamily}
        ownMessageOnRightSide={ownMessageOnRightSide}
        messageWidthPercent={messageWidthPercent}
        messageStatusAndTimePosition={messageStatusAndTimePosition}
        messageStatusDisplayingType={messageStatusDisplayingType}
        showMessageStatus={showMessageStatus}
        showMessageTimeAndStatusOnlyOnHover={showMessageTimeAndStatusOnlyOnHover}
        showMessageTime={showMessageTime}
        showMessageStatusForEachMessage={showMessageStatusForEachMessage}
        showMessageTimeForEachMessage={showMessageTimeForEachMessage}
        outgoingMessageStyles={outgoingMessageStyles}
        incomingMessageStyles={incomingMessageStyles}
        ownRepliedMessageBackground={ownRepliedMessageBackground}
        incomingRepliedMessageBackground={incomingRepliedMessageBackground}
        hoverBackground={hoverBackground}
        showSenderNameOnDirectChannel={showSenderNameOnDirectChannel}
        showSenderNameOnOwnMessages={showSenderNameOnOwnMessages}
        showSenderNameOnGroupChannel={showSenderNameOnGroupChannel}
        showOwnAvatar={showOwnAvatar}
        MessageActionsMenu={MessageActionsMenu}
        CustomMessageItem={CustomMessageItem}
        messageReaction={messageReaction}
        editMessage={editMessage}
        copyMessage={copyMessage}
        replyMessage={replyMessage}
        replyMessageInThread={replyMessageInThread}
        forwardMessage={forwardMessage}
        deleteMessage={deleteMessage}
        selectMessage={selectMessage}
        reportMessage={reportMessage}
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
        openFrequentlyUsedReactions={openFrequentlyUsedReactions}
        fixEmojiCategoriesTitleOnTop={fixEmojiCategoriesTitleOnTop}
        emojisCategoryIconsPosition={emojisCategoryIconsPosition}
        emojisContainerBorderRadius={emojisContainerBorderRadius}
        reactionsDisplayCount={reactionsDisplayCount}
        showEachReactionCount={showEachReactionCount}
        showTotalReactionCount={showTotalReactionCount}
        reactionItemBorder={reactionItemBorder}
        reactionItemBorderRadius={reactionItemBorderRadius}
        reactionItemBackground={reactionItemBackground}
        reactionItemPadding={reactionItemPadding}
        reactionItemMargin={reactionItemMargin}
        reactionsFontSize={reactionsFontSize}
        reactionsContainerBoxShadow={reactionsContainerBoxShadow}
        reactionsContainerBorder={reactionsContainerBorder}
        reactionsContainerBorderRadius={reactionsContainerBorderRadius}
        reactionsContainerBackground={reactionsContainerBackground}
        reactionsContainerPadding={reactionsContainerPadding}
        reactionsContainerTopPosition={reactionsContainerTopPosition}
        reactionsDetailsPopupBorderRadius={reactionsDetailsPopupBorderRadius}
        reactionsDetailsPopupHeaderItemsStyle={reactionsDetailsPopupHeaderItemsStyle}
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
        dateDividerFontSize={dateDividerFontSize}
        dateDividerTextColor={dateDividerTextColor}
        dateDividerBorder={dateDividerBorder}
        dateDividerBackgroundColor={dateDividerBackgroundColor}
        dateDividerBorderRadius={dateDividerBorderRadius}
        showTopFixedDate={showTopFixedDate}
        inlineReactionIcon={inlineReactionIcon}
        newMessagesSeparatorText={newMessagesSeparatorText}
        newMessagesSeparatorFontSize={newMessagesSeparatorFontSize}
        newMessagesSeparatorTextColor={newMessagesSeparatorTextColor}
        newMessagesSeparatorWidth={newMessagesSeparatorWidth}
        newMessagesSeparatorBorder={newMessagesSeparatorBorder}
        newMessagesSeparatorBorderRadius={newMessagesSeparatorBorderRadius}
        newMessagesSeparatorBackground={newMessagesSeparatorBackground}
        newMessagesSeparatorTextLeftRightSpacesWidth={newMessagesSeparatorTextLeftRightSpacesWidth}
        newMessagesSeparatorSpaceColor={newMessagesSeparatorSpaceColor}
        fileAttachmentsIcon={fileAttachmentsIcon}
        fileAttachmentsBoxWidth={fileAttachmentsBoxWidth}
        fileAttachmentsBoxBackground={fileAttachmentsBoxBackground}
        fileAttachmentsBoxBorder={fileAttachmentsBoxBorder}
        fileAttachmentsTitleColor={fileAttachmentsTitleColor}
        fileAttachmentsSizeColor={fileAttachmentsSizeColor}
        imageAttachmentMaxWidth={imageAttachmentMaxWidth}
        imageAttachmentMaxHeight={imageAttachmentMaxHeight}
        videoAttachmentMaxWidth={videoAttachmentMaxWidth}
        videoAttachmentMaxHeight={videoAttachmentMaxHeight}
        attachmentsPreview={attachmentsPreview}
        sameUserMessageSpacing={sameUserMessageSpacing}
        differentUserMessageSpacing={differentUserMessageSpacing}
        backgroundColor={backgroundColor}
        messageTextFontSize={messageTextFontSize}
        messageTextLineHeight={messageTextLineHeight}
        messageStatusSize={messageStatusSize}
        messageStatusColor={messageStatusColor}
        messageReadStatusColor={messageReadStatusColor}
        messageStateFontSize={messageStateFontSize}
        messageStateColor={messageStateColor}
        messageTimeFontSize={messageTimeFontSize}
        messageTimeColor={messageTimeColor}
        messageStatusAndTimeLineHeight={messageStatusAndTimeLineHeight}
        hiddenMessagesProperties={hiddenMessagesProperties}
        shouldOpenUserProfileForMention={shouldOpenUserProfileForMention}
      />
    </React.Fragment>
  )
}

export default MessagesContainer
