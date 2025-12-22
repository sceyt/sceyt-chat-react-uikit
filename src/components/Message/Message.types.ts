import {
  IAttachment,
  IChannel,
  IMarker,
  IMessage,
  IUser,
  ITabsStyles,
  IListItemStyles,
  ILabels,
  MessageInfoTab,
  OGMetadataProps
} from '../../types'
import { FC } from 'react'

export interface IMessageActions {
  message: IMessage
  channel: IChannel
  handleSetMessageForEdit?: () => void
  handleRetractVote?: () => void
  handleEndVote?: () => void
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
export interface IAttachmentProperties {
  show?: boolean
  canDelete?: boolean
  canDownload?: boolean
  canForward?: boolean
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
  handleRetractVote?: () => void
  handleEndVote?: () => void
  handleResendMessage?: () => void
  handleOpenDeleteMessage?: () => void
  handleOpenForwardMessage?: () => void
  handleCopyMessage?: () => void
  handleReportMessage?: () => void
  handleSelectMessage?: () => void
  handleOpenInfoMessage?: () => void
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
  handleOpenUserProfile: (user: IUser) => void
  unsupportedMessage: boolean
  onInviteLinkClick?: (key: string) => void
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
  showInfoMessage?: boolean
  infoIcon?: JSX.Element
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
  retractVoteIcon?: JSX.Element
  endVoteIcon?: JSX.Element
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
  infoIconOrder?: number
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
  messageTimeColorOnAttachment?: string
  shouldOpenUserProfileForMention?: boolean
  ogMetadataProps?: OGMetadataProps
  showInfoMessageProps?: {
    togglePopup?: () => void
    labels?: ILabels
    tabsOrder?: { key: MessageInfoTab; label: string; data: IMarker[] }[]
    showCounts?: boolean
    avatarSize?: number
    maxWidth?: string
    minWidth?: string
    height?: string
    renderItem?: (marker: IMarker, defaultNode: JSX.Element) => JSX.Element
    formatDate?: (date: Date) => string
    tabsStyles?: ITabsStyles
    listItemStyles?: IListItemStyles
  }
  collapsedCharacterLimit?: number
}
