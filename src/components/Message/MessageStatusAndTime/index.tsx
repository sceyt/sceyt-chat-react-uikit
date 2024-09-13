import styled from 'styled-components'
import React, { useEffect, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import moment from 'moment'
// Store
import {
  addReactionAC,
  addSelectedMessageAC,
  clearSelectedMessagesAC,
  deleteMessageAC,
  deleteMessageFromListAC,
  deleteReactionAC,
  forwardMessageAC,
  removeSelectedMessageAC,
  resendMessageAC,
  // resendMessageAC,
  setMessageForReplyAC,
  setMessageMenuOpenedAC,
  setMessageToEditAC
} from '../../../store/message/actions'
import { createChannelAC, markMessagesAsReadAC } from '../../../store/channel/actions'
import { CONNECTION_STATUS } from '../../../store/user/constants'
// Hooks
import { useDidUpdate, useOnScreen, useColor } from '../../../hooks'
// Helpers
import {
  deletePendingMessage,
  getPendingAttachment,
  removeMessageFromVisibleMessagesMap,
  setMessageToVisibleMessagesMap
} from '../../../helpers/messagesHalper'
import { isJSON, makeUsername } from '../../../helpers/message'
import { getOpenChatOnUserInteraction } from '../../../helpers/channelHalper'
import { getClient } from '../../../common/client'
import { getShowOnlyContactUsers } from '../../../helpers/contacts'
import {
  attachmentTypes,
  DEFAULT_CHANNEL_TYPE,
  MESSAGE_DELIVERY_STATUS,
  MESSAGE_STATUS
} from '../../../helpers/constants'
import { MessageOwner } from '../../../UIHelper'
import { colors, THEME_COLOR_NAMES } from '../../../UIHelper/constants'
import { IAttachment, IChannel, IMessage, IReaction } from '../../../types'
// Components
import { MessageStatusIcon } from '../../../messageUtils'

interface IMessageProps {
  message: IMessage
  channel: IChannel
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
  ownMessageBackground?: string
  incomingMessageBackground?: string
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

const Message = ({
  message,
  channel,
  MessageActionsMenu,
  CustomMessageItem,
  // forwardSenderFromContact,
  handleScrollToRepliedMessage,
  handleMediaItemClick,
  stopScrolling,
  isPendingMessage,
  prevMessage,
  nextMessage,
  setLastVisibleMessageId,
  isUnreadMessage,
  unreadMessageId,
  isThreadMessage,
  fontFamily,
  ownMessageOnRightSide,
  messageWidthPercent,
  showSenderNameOnDirectChannel = false,
  showSenderNameOnGroupChannel = true,
  showSenderNameOnOwnMessages = true,
  messageStatusAndTimePosition = 'onMessage',
  messageStatusDisplayingType = 'ticks',
  ownMessageBackground = colors.primaryLight,
  incomingMessageBackground,
  ownRepliedMessageBackground,
  incomingRepliedMessageBackground,
  showOwnAvatar = true,
  showMessageStatus = true,
  showMessageTimeAndStatusOnlyOnHover,
  showMessageTime = true,
  showMessageStatusForEachMessage = true,
  showMessageTimeForEachMessage = true,
  hoverBackground = true,
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
  openFrequentlyUsedReactions = true,
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
  // inlineReactionIcon,
  fileAttachmentsIcon,
  reactionsDisplayCount = 5,
  showEachReactionCount = true,
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
  reactionsDetailsPopupHeaderItemsStyle,
  fileAttachmentsBoxWidth,
  // fileAttachmentsNameMaxLength,
  // fileAttachmentsBoxBackground,
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
  sameUserMessageSpacing,
  differentUserMessageSpacing,
  selectedMessagesMap,
  contactsMap,
  openedMessageMenuId,
  tabIsActive,
  connectionStatus,
  theme,
  messageTextFontSize,
  messageTextLineHeight
}: IMessageProps) => {
  const accentColor = useColor(THEME_COLOR_NAMES.ACCENT)
  const sectionBackground = useColor(THEME_COLOR_NAMES.SECTION_BACKGROUND)
  const bubbleOutgoing = useColor(THEME_COLOR_NAMES.BUBBLE_OUTGOING)
  const bubbleIncoming = useColor(THEME_COLOR_NAMES.BUBBLE_INCOMING)
  const textPrimary = useColor(THEME_COLOR_NAMES.TEXT_PRIMARY)
  const textSecondary = useColor(THEME_COLOR_NAMES.TEXT_SECONDARY)
  const dispatch = useDispatch()
  const ChatClient = getClient()
  const { user } = ChatClient
  const getFromContacts = getShowOnlyContactUsers()
  const [deletePopupOpen, setDeletePopupOpen] = useState(false)
  const [forwardPopupOpen, setForwardPopupOpen] = useState(false)
  const [reportPopupOpen, setReportPopupOpen] = useState(false)
  const [messageActionsShow, setMessageActionsShow] = useState(false)
  const [emojisPopupOpen, setEmojisPopupOpen] = useState(false)
  const [frequentlyEmojisOpen, setFrequentlyEmojisOpen] = useState(false)
  const [reactionsPopupOpen, setReactionsPopupOpen] = useState(false)
  const [reactionsPopupPosition, setReactionsPopupPosition] = useState(0)
  const [emojisPopupPosition, setEmojisPopupPosition] = useState('')
  const [reactionsPopupHorizontalPosition, setReactionsPopupHorizontalPosition] = useState({ left: 0, right: 0 })
  const messageItemRef = useRef<any>()
  const isVisible = useOnScreen(messageItemRef)
  const reactionsCount =
    message.reactionTotals &&
    message.reactionTotals.reduce((prevValue, currentValue) => prevValue + currentValue.count, 0)
  const messageTextRef = useRef<any>(null)
  const messageActionsTimeout = useRef<any>(null)
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

  const renderAvatar =
    (isUnreadMessage || prevMessageUserID !== messageUserID || firstMessageInInterval) &&
    !(channel.type === DEFAULT_CHANNEL_TYPE.DIRECT && !showSenderNameOnDirectChannel) &&
    !(!message.incoming && !showOwnAvatar)

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

  const isSelectedMessage = selectedMessagesMap && selectedMessagesMap.get(message.id || message.tid!)
  const tooManySelected = selectedMessagesMap && selectedMessagesMap.size >= 30

  const toggleEditMode = () => {
    dispatch(setMessageToEditAC(message))
    setMessageActionsShow(false)
  }

  const handleToggleDeleteMessagePopup = () => {
    if (!message.deliveryStatus || message.deliveryStatus === MESSAGE_DELIVERY_STATUS.PENDING) {
      handleDeletePendingMessage()
    } else {
      setDeletePopupOpen(!deletePopupOpen)
    }

    setMessageActionsShow(false)
  }

  const handleToggleForwardMessagePopup = () => {
    setForwardPopupOpen(!forwardPopupOpen)

    setMessageActionsShow(false)
    stopScrolling(!forwardPopupOpen)
  }

  const handleReplyMessage = (threadReply?: boolean) => {
    if (threadReply) {
      // dispatch(setMessageForThreadReply(message));
    } else {
      dispatch(setMessageForReplyAC(message))
    }

    setMessageActionsShow(false)
  }

  const handleToggleReportPopupOpen = () => {
    setReportPopupOpen(!reportPopupOpen)

    setMessageActionsShow(false)
  }
  const handleSelectMessage = (e?: any) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    if (isSelectedMessage) {
      if (selectedMessagesMap && selectedMessagesMap.size === 1) {
        dispatch(clearSelectedMessagesAC())
      } else {
        dispatch(removeSelectedMessageAC(message.id))
      }
    } else if (!tooManySelected) {
      dispatch(addSelectedMessageAC(message))
      setMessageActionsShow(false)
    }
  }

  const handleDeleteMessage = (deleteOption: 'forMe' | 'forEveryone') => {
    dispatch(deleteMessageAC(channel.id, message.id, deleteOption))

    setMessageActionsShow(false)
  }

  /*  const handleDeleteFailedMessage = () => {
    console.log('delete failed message .. ', message)
    // dispatch(deleteMessageAC(channel.id, message.id, deleteOption))
  } */

  const handleResendMessage = () => {
    const messageToResend = { ...message }
    if (message.attachments && message.attachments.length) {
      messageToResend.attachments = (message.attachments as IAttachment[]).map((att) => {
        const pendingAttachment = getPendingAttachment(att.tid!)
        return { ...att, data: new File([pendingAttachment.file], att.data.name) }
      })
    }

    dispatch(resendMessageAC(messageToResend, channel.id, connectionStatus))

    setMessageActionsShow(false)
  }
  const handleCopyMessage = () => {
    navigator.clipboard.writeText(messageTextRef.current.innerText)
    setMessageActionsShow(false)
  }

  const handleToggleReactionsPopup = () => {
    const reactionsContainer = document.getElementById(`${message.id}_reactions_container}`)
    const reactionsContPos = reactionsContainer && reactionsContainer.getBoundingClientRect()
    const bottomPos = messageItemRef.current?.getBoundingClientRect().bottom
    const offsetBottom = window.innerHeight - bottomPos
    setReactionsPopupPosition(offsetBottom)
    setReactionsPopupHorizontalPosition({
      left: reactionsContainer ? reactionsContainer.getBoundingClientRect().left : 0,
      right: reactionsContPos ? window.innerWidth - reactionsContPos.left - reactionsContPos.width : 0
    })
    setReactionsPopupOpen(!reactionsPopupOpen)
  }

  const handleRemoveFailedAttachment = (attachmentId: string) => {
    console.log('remove attachment .. ', attachmentId)
    // TODO implement remove failed attachment
    // dispatch(removeFailedAttachment(message.tid, attachmentId));
  }

  const handleMouseEnter = () => {
    if (message.state !== MESSAGE_STATUS.DELETE && !selectionIsActive) {
      messageActionsTimeout.current = setTimeout(() => {
        setMessageActionsShow(true)
        dispatch(setMessageMenuOpenedAC(message.id || message.tid!))
      }, 450)
    }
  }

  const closeMessageActions = (close?: boolean) => {
    setMessageActionsShow(!close)
    if (close && !messageActionsShow && messageActionsTimeout.current) {
      clearTimeout(messageActionsTimeout.current)
    }
  }

  const handleMouseLeave = () => {
    clearTimeout(messageActionsTimeout.current)
    setMessageActionsShow(false)
  }

  const handleDeletePendingMessage = () => {
    deletePendingMessage(channel.id, message)
    dispatch(deleteMessageFromListAC(message.id || message.tid!))
  }

  const handleReactionAddDelete = (selectedEmoji: any) => {
    if (message.userReactions && message.userReactions.some((item: IReaction) => item.key === selectedEmoji)) {
      dispatch(
        deleteReactionAC(
          channel.id,
          message.id,
          selectedEmoji,
          channel.lastReactedMessage && channel.lastReactedMessage.id === message.id
        )
      )
    } else {
      const score = 1
      const reason = 'mmm'
      const enforceUnique = false
      dispatch(addReactionAC(channel.id, message.id, selectedEmoji, score, reason, enforceUnique))
    }

    setMessageActionsShow(false)
    setFrequentlyEmojisOpen(false)
    // setReactionIsOpen(false)
  }

  const handleSendReadMarker = () => {
    if (
      isVisible &&
      message.incoming &&
      !(
        message.userMarkers &&
        message.userMarkers.length &&
        message.userMarkers.find((marker) => marker.name === MESSAGE_DELIVERY_STATUS.READ)
      ) &&
      channel.newMessageCount &&
      channel.newMessageCount > 0 &&
      connectionStatus === CONNECTION_STATUS.CONNECTED
    ) {
      console.log('send displayed marker for message ... ', message)
      dispatch(markMessagesAsReadAC(channel.id, [message.id]))
    }
  }

  const handleForwardMessage = (channelIds: string[]) => {
    if (channelIds && channelIds.length) {
      channelIds.forEach((channelId) => {
        dispatch(forwardMessageAC(message, channelId, connectionStatus))
      })
    }
  }
  const MessageHeader = () => (
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
          onClick={() => handleCreateChat(messageOwnerIsNotCurrentUser && message.user)}
        >
          {message.user.id === user.id && message.user.firstName
            ? `${message.user.firstName} ${message.user.lastName}`
            : makeUsername(contactsMap[message.user.id], message.user, getFromContacts)}
        </MessageOwner>
      )}
    </MessageHeaderCont>
  )

  const handleClick = (e: any) => {
    const emojisContainer = document.getElementById('emojisContainer')
    const frequentlyEmojisContainer = document.getElementById('frequently_emojis_container')
    if (emojisContainer && !emojisContainer.contains(e.target)) {
      setEmojisPopupOpen(false)
    }
    if (frequentlyEmojisContainer && !frequentlyEmojisContainer.contains(e.target)) {
      setFrequentlyEmojisOpen(false)
    }
  }

  const handleOpenEmojis = () => {
    if (openFrequentlyUsedReactions) {
      setFrequentlyEmojisOpen(true)
    } else {
      setEmojisPopupOpen(true)
    }
  }

  const handleCreateChat = (user?: any) => {
    if (getOpenChatOnUserInteraction() && user && !selectionIsActive) {
      dispatch(
        createChannelAC(
          {
            metadata: '',
            type: DEFAULT_CHANNEL_TYPE.DIRECT,
            members: [
              {
                ...user,
                role: 'owner'
              }
            ]
          },
          true
        )
      )
    }
  }

  useEffect(() => {
    if (isVisible) {
      if (setLastVisibleMessageId) {
        setLastVisibleMessageId(message.id)
      }
      handleSendReadMarker()
      if (!channel.isLinkedChannel) {
        setMessageToVisibleMessagesMap(message)
      }
    } else {
      if (!channel.isLinkedChannel) {
        removeMessageFromVisibleMessagesMap(message)
      }
    }
  }, [isVisible])

  useDidUpdate(() => {
    if (tabIsActive) {
      handleSendReadMarker()
    }
  }, [tabIsActive])

  useDidUpdate(() => {
    if (connectionStatus === CONNECTION_STATUS.CONNECTED) {
      handleSendReadMarker()
    }
  }, [connectionStatus])

  useEffect(() => {
    if (emojisPopupOpen) {
      const bottomPos = messageItemRef.current ? messageItemRef.current.getBoundingClientRect().bottom : 0
      const offsetBottom = window.innerHeight - bottomPos
      setEmojisPopupPosition(offsetBottom < 300 ? 'top' : 'bottom')
      setFrequentlyEmojisOpen(false)
    } else {
      setEmojisPopupPosition('')
    }
  }, [emojisPopupOpen])

  useDidUpdate(() => {
    if (openedMessageMenuId && openedMessageMenuId !== message.id) {
      setMessageActionsShow(false)
    }
  }, [openedMessageMenuId])

  useEffect(() => {
    document.addEventListener('mousedown', handleClick)
    return () => {
      document.removeEventListener('mousedown', handleClick)
    }
  }, [])

  return (
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
  )
}

export default React.memo(Message, (prevProps, nextProps) => {
  // Custom comparison function to check if only 'messages' prop has changed
  return (
    prevProps.prevMessage === nextProps.prevMessage &&
    prevProps.nextMessage === nextProps.nextMessage &&
    prevProps.selectedMessagesMap === nextProps.selectedMessagesMap &&
    prevProps.contactsMap === nextProps.contactsMap &&
    prevProps.connectionStatus === nextProps.connectionStatus &&
    prevProps.openedMessageMenuId === nextProps.openedMessageMenuId &&
    prevProps.tabIsActive === nextProps.tabIsActive &&
    prevProps.theme === nextProps.theme
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

export const MessageStatusAndTime = styled.span<{
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
