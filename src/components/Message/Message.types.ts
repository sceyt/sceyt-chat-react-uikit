import { IAttachment, IChannel, IMessage, IUser } from '../../types'
import { FC } from 'react'

export interface IMessageActions {
  message: IMessage
  channel: IChannel
  handleSetMessageForEdit?: () => void
  handleResendMessage?: () => void
  handleOpenDeleteMessage?: () => void
  handleOpenForwardMessage?: () => void
  handleCopyMessage?: () => void
  handleReportMessage?: () => void
  handleOpenEmojis?: () => void
  handleSelectMessage?: (event?: any) => void
  handleReplyMessage?: () => void
  isThreadMessage?: boolean
  rtlDirection?: boolean
}

export interface IMessageStyles {
  textColor?: string
  background?: string
  classname?: string
}

interface ICustomMessageItem {
  channel: IChannel
  message: IMessage
  prevMessage?: IMessage
  nextMessage?: IMessage
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
  handleReplyMessage?: (threadReply?: boolean) => void
  handleMouseEnter: () => void
  handleMouseLeave: () => void
  closeMessageActions?: () => void
  setEmojisPopupOpen: (state: boolean) => void
  handleCreateChat: (user: IUser) => void
  handleReactionAddDelete: (selectedEmoji: any) => void
  handleScrollToRepliedMessage: (messageId: string) => void
  handleMediaItemClick?: (attachment: IAttachment) => void
  isThreadMessage?: boolean
}

export interface IMessageProps {
  message: IMessage
  channel: IChannel
  MessageActionsMenu?: FC<IMessageActions>
  CustomMessageItem?: FC<ICustomMessageItem>
  isPendingMessage?: boolean
  prevMessage?: IMessage
  nextMessage: IMessage
  stopScrolling: (stop: boolean) => void
  setLastVisibleMessageId?: (msgId: string) => void
  handleScrollToRepliedMessage: (msgId: string) => void
  handleMediaItemClick?: (attachment: IAttachment) => void
  unreadMessageId: string
  isUnreadMessage: boolean
  isThreadMessage: boolean
  fontFamily?: string
  ownMessageOnRightSide?: boolean
  messageWidthPercent?: string | number
  showSenderNameOnDirectChannel?: boolean
  showSenderNameOnGroupChannel?: boolean
  showSenderNameOnOwnMessages?: boolean
  messageStatusAndTimePosition?: 'bottomOfMessage' | 'onMessage'
  messageStatusDisplayingType?: 'ticks' | 'text'
  outgoingMessageStyles?: IMessageStyles
  incomingMessageStyles?: IMessageStyles
  ownRepliedMessageBackground?: string
  incomingRepliedMessageBackground?: string
  showOwnAvatar?: boolean
  showMessageStatus?: boolean
  showMessageTimeAndStatusOnlyOnHover?: boolean
  showMessageTime?: boolean
  showMessageStatusForEachMessage?: boolean
  showMessageTimeForEachMessage?: boolean
  hoverBackground?: boolean
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
  reactionsContainerBackground?: string
  reactionsContainerTopPosition?: string
  reactionsDetailsPopupBorderRadius?: string
  reactionsDetailsPopupHeaderItemsStyle?: 'bubbles' | 'inline'
  reactionsContainerPadding?: string
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
  sameUserMessageSpacing?: string
  differentUserMessageSpacing?: string
  selectedMessagesMap?: Map<string, IMessage>
  contactsMap: { [key: string]: any }
  openedMessageMenuId?: string
  tabIsActive?: boolean
  connectionStatus: string
  theme: string
  messageTextFontSize?: string
  messageTextLineHeight?: string
}
