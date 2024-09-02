import styled from 'styled-components'
import React, { FC, useEffect, useRef, useState } from 'react'
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
} from '../../store/message/actions'
import { createChannelAC, markMessagesAsReadAC } from '../../store/channel/actions'
import { CONNECTION_STATUS } from '../../store/user/constants'
// Hooks
import { useDidUpdate, useOnScreen, useColor } from '../../hooks'
// Assets
import { ReactComponent as VoiceIcon } from '../../assets/svg/voiceIcon.svg'
import { ReactComponent as ForwardIcon } from '../../assets/svg/forward.svg'
import { ReactComponent as ErrorIcon } from '../../assets/svg/errorIcon.svg'
import { ReactComponent as SelectionIcon } from '../../assets/svg/selectionIcon.svg'
// Helpers
import {
  deletePendingMessage,
  getPendingAttachment,
  removeMessageFromVisibleMessagesMap,
  setMessageToVisibleMessagesMap
} from '../../helpers/messagesHalper'
import { calculateRenderedImageWidth } from '../../helpers'
import { isJSON, makeUsername } from '../../helpers/message'
import { getOpenChatOnUserInteraction } from '../../helpers/channelHalper'
import { getClient } from '../../common/client'
import { getShowOnlyContactUsers } from '../../helpers/contacts'
import { getSendAttachmentsAsSeparateMessages } from '../../helpers/customUploader'
import { attachmentTypes, DEFAULT_CHANNEL_TYPE, MESSAGE_DELIVERY_STATUS, MESSAGE_STATUS } from '../../helpers/constants'
import { MessageOwner, MessageText, ReplyMessageText } from '../../UIHelper'
import { colors, THEME_COLOR_NAMES } from '../../UIHelper/constants'
import { IAttachment, IChannel, IMessage, IReaction, IUser } from '../../types'
// Components
import MessageActions from './MessageActions'
import Avatar from '../Avatar'
import Attachment from '../Attachment'
import ConfirmPopup from '../../common/popups/delete'
import ForwardMessagePopup from '../../common/popups/forwardMessage'
import ReactionsPopup from '../../common/popups/reactions'
import EmojisPopup from '../Emojis'
import FrequentlyEmojis from '../Emojis/frequentlyEmojis'
import { MessageStatusIcon, MessageTextFormat } from '../../messageUtils'

interface IMessageProps {
  message: IMessage
  channel: IChannel
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
    // eslint-disable-next-line no-unused-vars
    handleSelectMessage?: (event?: any) => void
    handleReplyMessage?: () => void

    isThreadMessage?: boolean
    rtlDirection?: boolean
  }>

  CustomMessageItem?: FC<{
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
  }>
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
  // isPendingMessage,
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
  incomingMessageBackground = colors.backgroundColor,
  ownRepliedMessageBackground = colors.ownRepliedMessageBackground,
  incomingRepliedMessageBackground = colors.incomingRepliedMessageBackground,
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
  const textPrimary = useColor(THEME_COLOR_NAMES.TEXT_PRIMARY)
  const textSecondary = useColor(THEME_COLOR_NAMES.TEXT_SECONDARY)
  const dispatch = useDispatch()
  const ChatClient = getClient()
  const { user } = ChatClient
  const getFromContacts = getShowOnlyContactUsers()
  // const [editMode, setEditMode] = useState(false)
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
  // const [reactionIsOpen, setReactionIsOpen] = useState(false)
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
  /* const firstMessageInInterval = prevMessage
    ? (message.createdAt as number) - (prevMessage.createdAt as number) > 300000
    : false
  const lastMessageInInterval = nextMessage
    ? (nextMessage.createdAt as number) - (message.createdAt as number) > 300000
    : false */
  const withAttachments = message.attachments && message.attachments.length > 0
  const notLinkAttachment =
    withAttachments && message.attachments.some((a: IAttachment) => a.type !== attachmentTypes.link)
  const parentNotLinkAttachment =
    message.parentMessage &&
    message.parentMessage.attachments &&
    message.parentMessage.attachments.some((a: IAttachment) => a.type !== attachmentTypes.link)
  /* const parentMessageOwnerIsNotCurrentUser = !!(
    message.parentMessage && (message.parentMessage.user.id === user.id ? '' : message.parentMessage.user.id)
  ) */
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
  // (message.attachments[0].type === attachmentTypes.video || message.attachments[0].type === attachmentTypes.image)
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
    // setEditMode(!editMode)
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

  // TODO implement message action
  /* const handleReportMessage = (reportData) => {
    dispatch(reportMessageAC({
      channelId,
      messageId: message.id,
      reportReason: reportData.reportReason,
      reportDescription: reportData.reportDescription,
    }));
  };
*/
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
        (message.incoming ? incomingMessageBackground !== 'inherit' : ownMessageBackground !== 'inherit') /* ||
            (message.parent &&
              message.parent.attachments &&
              !!message.parent.attachments.length &&
              parentNotLinkAttachment) */
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
      // const emojisContainer = document.getElementById(`${message.id}_emoji_popup_container`)
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
  /*
  useDidUpdate(() => {
    console.log('message  ............................................................... ', message)
  }, [message])
*/

  useEffect(() => {
    document.addEventListener('mousedown', handleClick)
    return () => {
      document.removeEventListener('mousedown', handleClick)
    }
  }, [])

  return (
    <MessageItem
      key={message.id || message.tid}
      className='message_item'
      rtl={ownMessageOnRightSide && !message.incoming}
      withAvatar={renderAvatar}
      hoverBackground={
        hoverBackground
          ? message.incoming
            ? incomingMessageBackground || 'rgb(238, 245, 255)'
            : ownMessageBackground || 'rgb(238, 245, 255)'
          : ''
      }
      topMargin={
        prevMessage?.type === 'system'
          ? '0'
          : prevMessage && unreadMessageId === prevMessage.id
            ? '16px'
            : prevMessageUserID !== messageUserID || firstMessageInInterval
              ? differentUserMessageSpacing || '16px'
              : sameUserMessageSpacing || '8px'
      }
      bottomMargin={message.reactionTotals && message.reactionTotals.length ? reactionsContainerTopPosition : ''}
      ref={messageItemRef}
      selectMessagesIsActive={selectionIsActive}
      onClick={(e) => selectionIsActive && handleSelectMessage(e)}
      // id={message.id}
    >
      {selectionIsActive && message.state !== MESSAGE_STATUS.DELETE && (
        <SelectMessageWrapper
          activeColor={accentColor}
          disabled={tooManySelected && !isSelectedMessage}
          onClick={handleSelectMessage}
        >
          {isSelectedMessage ? <SelectionIcon /> : <EmptySelection disabled={tooManySelected} />}
        </SelectMessageWrapper>
      )}
      {renderAvatar && (
        <Avatar
          name={message.user && (message.user.firstName || messageUserID)}
          image={message.user && message.user.avatarUrl}
          size={32}
          textSize={14}
          setDefaultAvatar
          handleAvatarClick={() => handleCreateChat(message.user)}
        />
      )}
      {/* <MessageBoby /> */}
      <MessageContent
        selectionIsActive={selectionIsActive}
        messageWidthPercent={messageWidthPercent}
        rtl={ownMessageOnRightSide && !message.incoming}
        withAvatar={
          !(channel.type === DEFAULT_CHANNEL_TYPE.DIRECT && !showSenderNameOnDirectChannel) &&
          !(!message.incoming && !showOwnAvatar)
        }
        className='messageContent'
      >
        {message.state === MESSAGE_STATUS.FAILED && (
          <FailedMessageIcon rtl={ownMessageOnRightSide && !message.incoming}>
            <ErrorIconWrapper />
            {/* <DropDown
              // forceClose={showChooseAttachmentType}
              position={nextMessage ? 'right' : 'topRight'}
              trigger={<ErrorIconWrapper />}
            >
              <DropdownOptionsUl>
                <DropdownOptionLi
                  key={1}
                  textColor={colors.gray6}
                  hoverBackground={colors.gray5}
                  onClick={() => handleResendMessage()}
                  iconWidth='20px'
                >
                  <ResendIcon />
                  Resend
                </DropdownOptionLi>
                <DropdownOptionLi
                  key={2}
                  textColor={colors.gray6}
                  hoverBackground={colors.gray5}
                  onClick={() => handleDeleteFailedMessage()}
                  iconWidth='20px'
                >
                  <DeleteIconWrapper />
                  Delete
                </DropdownOptionLi>
              </DropdownOptionsUl>
            </DropDown> */}
          </FailedMessageIcon>
        )}
        {/* {withAttachments && !message.body && <MessageHeader />} */}

        {CustomMessageItem ? (
          <CustomMessageItem
            channel={channel}
            message={message}
            prevMessage={prevMessage}
            nextMessage={nextMessage}
            unreadMessageId={unreadMessageId}
            isUnreadMessage={isUnreadMessage}
            messageActionsShow={messageActionsShow}
            selectionIsActive={selectionIsActive}
            emojisPopupOpen={emojisPopupOpen}
            frequentlyEmojisOpen={frequentlyEmojisOpen}
            messageTextRef={messageTextRef}
            emojisPopupPosition={emojisPopupPosition}
            handleSetMessageForEdit={toggleEditMode}
            handleResendMessage={handleResendMessage}
            handleOpenDeleteMessage={handleToggleDeleteMessagePopup}
            handleOpenForwardMessage={handleToggleForwardMessagePopup}
            handleCopyMessage={handleCopyMessage}
            handleReportMessage={handleToggleReportPopupOpen}
            handleSelectMessage={handleSelectMessage}
            handleOpenEmojis={handleOpenEmojis}
            handleReplyMessage={handleReplyMessage}
            handleMouseEnter={handleMouseEnter}
            handleMouseLeave={handleMouseLeave}
            closeMessageActions={closeMessageActions}
            setEmojisPopupOpen={setEmojisPopupOpen}
            handleCreateChat={handleCreateChat}
            handleReactionAddDelete={handleReactionAddDelete}
            handleScrollToRepliedMessage={handleScrollToRepliedMessage}
            handleMediaItemClick={handleMediaItemClick}
            isThreadMessage={isThreadMessage}
          />
        ) : (
          <MessageBody
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
            ownMessageBackground={ownMessageBackground}
            incomingMessageBackground={incomingMessageBackground}
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

                        mediaAttachment.type === attachmentTypes.image
                          ? imageAttachmentMaxWidth
                          : videoAttachmentMaxWidth,
                        mediaAttachment.type === attachmentTypes.image
                          ? imageAttachmentMaxHeight
                          : videoAttachmentMaxHeight
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
            {/* {withAttachments && !!message.body && <MessageHeader />} */}
            {showMessageSenderName && <MessageHeader />}
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
              <ReplyMessageContainer
                withSenderName={showMessageSenderName}
                withBody={!!message.body}
                withAttachments={withAttachments && notLinkAttachment}
                leftBorderColor={accentColor}
                backgroundColor={message.incoming ? incomingRepliedMessageBackground : ownRepliedMessageBackground}
                onClick={() =>
                  handleScrollToRepliedMessage &&
                  !selectionIsActive &&
                  handleScrollToRepliedMessage(message!.parentMessage!.id)
                }
              >
                {
                  message.parentMessage.attachments &&
                    !!message.parentMessage.attachments.length &&
                    message.parentMessage.attachments[0].type !== attachmentTypes.voice &&
                    parentNotLinkAttachment &&
                    // <MessageAttachments>
                    (message.parentMessage.attachments as any[]).map((attachment, index) => (
                      <Attachment
                        key={attachment.tid || attachment.url}
                        backgroundColor={message.incoming ? incomingMessageBackground : ownMessageBackground}
                        attachment={{
                          ...attachment,
                          metadata: isJSON(attachment.metadata) ? JSON.parse(attachment.metadata) : attachment.metadata
                        }}
                        removeSelected={handleRemoveFailedAttachment}
                        selectedFileAttachmentsIcon={fileAttachmentsIcon}
                        isRepliedMessage
                        borderRadius={index === message.parentMessage!.attachments.length - 1 ? borderRadius : '16px'}
                        selectedFileAttachmentsBoxBorder={fileAttachmentsBoxBorder}
                        selectedFileAttachmentsTitleColor={fileAttachmentsTitleColor}
                        selectedFileAttachmentsSizeColor={fileAttachmentsSizeColor}
                        fileAttachmentWidth={fileAttachmentsBoxWidth}
                        imageAttachmentMaxWidth={imageAttachmentMaxWidth}
                        imageAttachmentMaxHeight={imageAttachmentMaxHeight}
                        videoAttachmentMaxWidth={videoAttachmentMaxWidth}
                        videoAttachmentMaxHeight={videoAttachmentMaxHeight}
                        // fileNameMaxLength={}
                      />
                    ))
                  // </MessageAttachments>
                }
                <ReplyMessageBody rtlDirection={ownMessageOnRightSide && !message.incoming}>
                  <MessageOwner
                    className='reply-message-owner'
                    color={accentColor}
                    fontSize='12px'
                    rtlDirection={ownMessageOnRightSide && !message.incoming}
                    // clickable={parentMessageOwnerIsNotCurrentUser}
                    /* onClick={() =>
                    handleCreateChat(
                      parentMessageOwnerIsNotCurrentUser && message.parentMessage && message.parentMessage.user.id
                    )
                  } */
                  >
                    {message.parentMessage.user.id === user.id
                      ? 'You'
                      : makeUsername(
                          contactsMap[message.parentMessage.user.id],
                          message.parentMessage.user,
                          getFromContacts
                        )}
                  </MessageOwner>

                  <ReplyMessageText color={textPrimary} fontSize='14px' lineHeight='16px'>
                    {!!message.parentMessage.attachments.length &&
                      message.parentMessage.attachments[0].type === attachmentTypes.voice && (
                        <VoiceIconWrapper color={accentColor} />
                      )}
                    {message.parentMessage.state === MESSAGE_STATUS.DELETE ? (
                      <MessageStatusDeleted color={textSecondary}> Message was deleted. </MessageStatusDeleted>
                    ) : message.parentMessage.body ? (
                      MessageTextFormat({
                        text: message.parentMessage.body,
                        message: message.parentMessage,
                        contactsMap,
                        getFromContacts,
                        asSampleText: true,
                        accentColor
                      })
                    ) : (
                      parentNotLinkAttachment &&
                      (message.parentMessage.attachments[0].type === attachmentTypes.image
                        ? 'Photo'
                        : message.parentMessage.attachments[0].type === attachmentTypes.video
                          ? 'Video'
                          : message.parentMessage.attachments[0].type === attachmentTypes.voice
                            ? ' Voice'
                            : 'File')
                    )}
                  </ReplyMessageText>
                </ReplyMessageBody>
              </ReplyMessageContainer>
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
                  {/* {message.forwardingDetails.user.id === user.id
                ? ' You'
                : ` ${makeUsername(forwardSenderFromContact, message.forwardingDetails.user, getFromContacts)}`} */}
                </ForwardedTitle>
              )}
            {/* {message.type === 'voice' && message.attachments[0] ? (
            <React.Fragment>
              <AudioPlayer url={message.attachments[0].url} />
              <AudioMessageTime>
                <HiddenMessageTime>{`${moment(message.createdAt).format('HH:mm')}`}</HiddenMessageTime>
                {!message.incoming && showMessageStatus && (
                  <MessageStatus iconColor={statusIconColor} lastMessage>
                    {messageStatusIcon(message.deliveryStatus)}
                  </MessageStatus>
                )}
              </AudioMessageTime>
            </React.Fragment>
          ) : ( */}
            <MessageText
              theme={theme}
              draggable={false}
              color={textPrimary}
              fontSize={messageTextFontSize}
              lineHeight={messageTextLineHeight}
              showMessageSenderName={showMessageSenderName}
              withPaddings={
                message.incoming ? incomingMessageBackground !== 'inherit' : ownMessageBackground !== 'inherit'
              }
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
              {/* <Linkify>{wrapTags(message.text, mentionRegex, 'mention')}</Linkify> */}
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
                    <HiddenMessageTime
                      color={messageTimeColor || textSecondary}
                      fontSize={messageTimeFontSize}
                    >{`${moment(message.createdAt).format('HH:mm')}`}</HiddenMessageTime>
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
            {/* )} */}
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
                    <HiddenMessageTime
                      color={messageTimeColor || textSecondary}
                      fontSize={messageTimeFontSize}
                    >{`${moment(message.createdAt).format('HH:mm')}`}</HiddenMessageTime>
                  )}
                  {messageStatusVisible &&
                    MessageStatusIcon({
                      messageStatus: message.deliveryStatus,
                      messageStatusDisplayingType,
                      size: messageStatusSize,
                      iconColor:
                        message.attachments[0].type !== 'voice' && message.attachments[0].type !== 'file'
                          ? colors.white
                          : '',
                      readIconColor: messageReadStatusColor,
                      accentColor
                    })}
                </MessageStatusAndTime>
              )}
            {
              withAttachments &&
                /* <MessageAttachments
            prefixBackground={
              showMessageSenderName || message.body
                ? message.incoming
                  ? incomingMessageBackground
                  : ownMessageBackground
                : ''
            }
            directionLeft={ownMessageOnRightSide && !message.incoming}
            className='message_attachments'
          > */
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
                    backgroundColor={message.incoming ? incomingMessageBackground : ownMessageBackground}
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
          </MessageBody>
        )}
        {messageStatusAndTimePosition === 'bottomOfMessage' && (messageStatusVisible || messageTimeVisible) && (
          // (!withAttachments || (withAttachments && message.attachments[0].type === attachmentTypes.link)) ? (
          <MessageStatusAndTime
            lineHeight={messageStatusAndTimeLineHeight}
            showOnlyOnHover={showMessageTimeAndStatusOnlyOnHover}
            isSelfMessage={!message.incoming}
            marginBottom={sameUserMessageSpacing}
            rtlDirection={ownMessageOnRightSide && !message.incoming}
            bottomOfMessage
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
        )}
        {/* ) : null} */}
        {message.replyCount && message.replyCount > 0 && !isThreadMessage && (
          <ThreadMessageCountContainer color={accentColor} onClick={() => handleReplyMessage(true)}>
            {`${message.replyCount} replies`}
          </ThreadMessageCountContainer>
        )}
        {reactionsPopupOpen && (
          <ReactionsPopup
            bottomPosition={reactionsPopupPosition}
            horizontalPositions={reactionsPopupHorizontalPosition}
            reactionTotals={message.reactionTotals || []}
            messageId={message.id}
            handleReactionsPopupClose={handleToggleReactionsPopup}
            rtlDirection={ownMessageOnRightSide && !message.incoming}
            handleAddDeleteEmoji={handleReactionAddDelete}
            reactionsDetailsPopupBorderRadius={reactionsDetailsPopupBorderRadius}
            reactionsDetailsPopupHeaderItemsStyle={reactionsDetailsPopupHeaderItemsStyle}
          />
        )}
        {message.reactionTotals && message.reactionTotals.length && (
          <ReactionsContainer
            id={`${message.id}_reactions_container`}
            border={reactionsContainerBorder}
            boxShadow={reactionsContainerBoxShadow}
            borderRadius={reactionsContainerBorderRadius}
            topPosition={reactionsContainerTopPosition}
            padding={reactionsContainerPadding}
            backgroundColor={reactionsContainerBackground || colors.backgroundColor}
            rtlDirection={ownMessageOnRightSide && !message.incoming}
          >
            {/* <ReactionEmojis>
              <span onClick={() => setReactionIsOpen(true)}>{inlineReactionIcon || <ReactionIcon />}</span>
              <EmojiContainer ref={emojisRef} rtl={!!(ownMessageOnRightSide && !message.incoming)}>
                {reactionIsOpen && (
                  <EmojisPopup handleEmojiPopupToggle={setReactionIsOpen} handleAddReaction={handleReactionAddDelete} />
                )}
              </EmojiContainer>
            </ReactionEmojis> */}
            <MessageReactionsCont
              rtlDirection={ownMessageOnRightSide && !message.incoming}
              onClick={handleToggleReactionsPopup}
            >
              {message.reactionTotals.slice(0, reactionsDisplayCount || 5).map((summery) => (
                <MessageReaction
                  key={summery.key}
                  color={textPrimary}
                  // onClick={() => handleReactionAddDelete(key)}
                  self={!!message.userReactions.find((userReaction: IReaction) => userReaction.key === summery.key)}
                  border={reactionItemBorder}
                  borderRadius={reactionItemBorderRadius}
                  backgroundColor={reactionItemBackground || colors.backgroundColor}
                  padding={reactionItemPadding}
                  margin={reactionItemMargin}
                  isLastReaction={reactionsCount === 1}
                  fontSize={reactionsFontSize}
                >
                  <MessageReactionKey>
                    {summery.key}
                    {showEachReactionCount && (
                      <ReactionItemCount color={textPrimary}>{summery.count}</ReactionItemCount>
                    )}
                  </MessageReactionKey>
                </MessageReaction>
              ))}
              {showTotalReactionCount && reactionsCount && reactionsCount > 1 && (
                <MessageReaction
                  border={reactionItemBorder}
                  color={textPrimary}
                  borderRadius={reactionItemBorderRadius}
                  backgroundColor={reactionItemBackground}
                  padding={reactionItemPadding}
                  margin={'0'}
                  fontSize={'12px'}
                >
                  {reactionsCount}
                </MessageReaction>
              )}
            </MessageReactionsCont>
          </ReactionsContainer>
        )}
      </MessageContent>
      {deletePopupOpen && (
        <ConfirmPopup
          handleFunction={handleDeleteMessage}
          togglePopup={handleToggleDeleteMessagePopup}
          buttonText='Delete'
          description='Who do you want to remove this message for?'
          isDeleteMessage
          isIncomingMessage={message.incoming}
          myRole={channel.userRole}
          allowDeleteIncoming={allowEditDeleteIncomingMessage}
          isDirectChannel={channel.type === DEFAULT_CHANNEL_TYPE.DIRECT}
          title='Delete message'
        />
      )}
      {forwardPopupOpen && (
        <ForwardMessagePopup
          handleForward={handleForwardMessage}
          togglePopup={handleToggleForwardMessagePopup}
          buttonText='Forward'
          title='Forward message'
        />
      )}

      {/*  {reportPopupOpen && (
        <ReportPopup
          reportFunction={handleReportMessage}
          togglePopup={handleToggleReportPopupOpen}
          buttonText="Report"
          description="Choose the right reason to help us better process the report."
          title="Report Message"
        />
      )} */}
    </MessageItem>
  )
}

export default React.memo(Message, (prevProps, nextProps) => {
  // Custom comparison function to check if only 'messages' prop has changed
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
    prevProps.tabIsActive === nextProps.tabIsActive &&
    prevProps.theme === nextProps.theme
  )
})

const MessageReactionKey = styled.span`
  display: inline-flex;
  align-items: center;
  font-family:
    apple color emoji,
    segoe ui emoji,
    noto color emoji,
    android emoji,
    emojisymbols,
    emojione mozilla,
    twemoji mozilla,
    segoe ui symbol;
`

const ReactionItemCount = styled.span<{ color: string }>`
  margin-left: 2px;
  font-family: Inter, sans-serif;
  font-weight: 400;
  font-size: 14px;
  line-height: 16px;
  color: ${(props) => props.color};
`

const MessageReaction = styled.span<{
  self?: boolean
  isLastReaction?: boolean
  border?: string
  color?: string
  borderRadius?: string
  backgroundColor?: string
  fontSize?: string
  padding?: string
  margin?: string
}>`
  display: inline-flex;
  //min-width: 23px;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin: ${(props) => props.margin || '0 8px 0 0'};
  margin-right: ${(props) => props.isLastReaction && '0'};
  border: ${(props) => props.border};
  color: ${(props) => props.color};
  box-sizing: border-box;
  border-radius: ${(props) => props.borderRadius || '16px'};
  font-size: ${(props) => props.fontSize || '18px'};
  line-height: ${(props) => props.fontSize || '18px'};
  padding: ${(props) => props.padding || '0'};
  background-color: ${(props) => props.backgroundColor};
  white-space: nowrap;

  &:last-child {
    margin-right: 0;
  }
`

const ThreadMessageCountContainer = styled.div<{ color: string }>`
  position: relative;
  color: ${(props) => props.color};
  font-weight: 500;
  font-size: 13px;
  line-height: 15px;
  margin: 12px;
  cursor: pointer;

  &::before {
    content: '';
    position: absolute;
    left: -25px;
    top: -21px;
    width: 16px;
    height: 26px;
    border-left: 2px solid #cdcdcf;
    border-bottom: 2px solid #cdcdcf;
    border-radius: 0 0 0 14px;
  }
`

/* const ReactionEmojis = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-right: 6px;
  cursor: pointer;
  position: relative;
` */
const FailedMessageIcon = styled.div<{ rtl?: boolean }>`
  position: absolute;
  top: -6px;
  left: ${(props) => !props.rtl && '-24px'};
  right: ${(props) => props.rtl && '-24px'};
  width: 20px;
  height: 20px;
`
const ErrorIconWrapper = styled(ErrorIcon)`
  width: 20px;
  height: 20px;
`
const SelectMessageWrapper = styled.div<{ activeColor?: string; disabled?: any }>`
  display: flex;
  padding: 10px;
  position: absolute;
  left: 4%;
  bottom: calc(50% - 22px);
  cursor: ${(props) => !props.disabled && 'pointer'};
  & > svg {
    color: ${(props) => props.activeColor};
    width: 24px;
    height: 24px;
  }
`
const EmptySelection = styled.span<{ disabled?: boolean }>`
  display: inline-block;
  width: 24px;
  height: 24px;
  border: 1.5px solid ${colors.borderColor2};
  box-sizing: border-box;
  border-radius: 50%;
  transform: scale(0.92);
  opacity: ${(props) => props.disabled && '0.5'};
`

const ReactionsContainer = styled.div<{
  border?: string
  boxShadow?: string
  borderRadius?: string
  topPosition?: string
  backgroundColor?: string
  padding?: string
  rtlDirection?: boolean
}>`
  display: inline-flex;
  margin-left: ${(props) => props.rtlDirection && 'auto'};
  margin-right: ${(props) => !props.rtlDirection && 'auto'};

  margin-top: 4px;
  justify-content: flex-end;
  border: ${(props) => props.border};
  box-shadow: ${(props) => props.boxShadow || '0px 4px 12px -2px rgba(17, 21, 57, 0.08)'};
  filter: drop-shadow(0px 0px 2px rgba(17, 21, 57, 0.08));
  border-radius: ${(props) => props.borderRadius || '16px'};
  background-color: ${(props) => props.backgroundColor || colors.white};
  padding: ${(props) => props.padding || '4px 8px'};
  z-index: 9;
  ${(props) =>
    props.topPosition &&
    `
      position: relative;
      top: ${props.topPosition};
  `};
`
const MessageReactionsCont = styled.div<{ rtlDirection?: boolean }>`
  position: relative;
  display: inline-flex;
  max-width: 300px;
  //overflow-x: auto;
  direction: ${(props) => props.rtlDirection && 'ltr'};
  cursor: pointer;
`
/*
const EmojiContainer = styled.div<{ rtl: boolean }>`
  position: absolute;
  left: ${(props) => (props.rtl ? '' : '-9px')};
  right: ${(props) => (props.rtl ? '-9px' : '')};
  bottom: 30px;
  z-index: 9998;
`
*/

/* const MessageInput = styled.textarea`
  resize: none;
  padding: 8px 12px;
  width: calc(100% - 26px);
  font: inherit;
  border: 1px solid #dfe0eb;
  border-radius: 4px;

  &::placeholder {
    font-size: 15px;
    color: ${colors.gray7};
  }
 ` */

/* const DeleteIconWrapper = styled(DeleteIcon)`
  color: ${colors.red3};
  width: 20px;
  height: 20px;
` */

const MessageHeaderCont = styled.div<{
  withPadding?: boolean
  isForwarded?: boolean
  messageBody?: boolean
  isReplied?: boolean
  withMediaAttachment?: boolean
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
`

/* const MessageTime = styled.span`
  font-weight: 400;
  font-size: 12px;
  margin-right: 4px;
  margin-bottom: 2px;
  color: ${colors.gray6};
` */

const ReplyMessageContainer = styled.div<{
  leftBorderColor?: string
  withAttachments?: boolean
  withSenderName?: boolean
  withBody?: boolean
  backgroundColor?: string
}>`
  display: flex;
  border-left: 2px solid ${(props) => props.leftBorderColor || '#b8b9c2'};
  padding: 4px 6px;
  position: relative;
  //margin: ${(props) => (props.withAttachments ? '8px 8px' : '0 0 8px')};
  margin: ${(props) =>
    props.withAttachments
      ? props.withBody
        ? '6px 12px 0'
        : '6px 12px 8px'
      : props.withSenderName
        ? '6px 0 8px'
        : '0 0 8px'};
  background-color: ${(props) => props.backgroundColor || colors.primaryLight};
  border-radius: 0 4px 4px 0;
  margin-top: ${(props) => !props.withSenderName && props.withAttachments && '8px'};
  cursor: pointer;
`
const ReplyMessageBody = styled.div<{ rtlDirection?: boolean }>`
  margin-top: auto;
  margin-bottom: auto;
  direction: ${(props) => (props.rtlDirection ? 'initial' : '')};
  max-width: 100%;
`
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
/*
const MessageAttachments = styled.div<{ directionLeft?: boolean; prefixBackground?: string }>`
  display: flex;
  flex-direction: column;
  background-color: ${colors.white};
  align-items: ${(props) => (props.directionLeft ? 'flex-end' : 'flex-start')};

  & > div:first-child {
    margin-top: 0;

    ${(props) =>
      props.prefixBackground &&
      `
        &:before {
      content: '';
      position: absolute;
      right: 0px;
      top: -3px;
      height: 22px;
      width: 22px;
      background-color: ${props.prefixBackground || '#fff'};
      z-index: 0;
    }

    &:after {
      content: '';
      position: absolute;
      left: 0;
      top: -3px;
      height: 22px;
      width: 22px;
      background-color: ${props.prefixBackground || '#fff'};
      z-index: 0;
    }
    `}
  }
` */

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

const HiddenMessageTime = styled.span<{ hide?: boolean; color: string; fontSize?: string }>`
  display: ${(props) => props.hide && 'none'};
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
  visibility: ${(props) => props.showOnlyOnHover && 'hidden'};
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
  font-size: ${(props) => props.fontSize || '12px'};
  color: ${(props) => props.color};
`

const MessageStatusDeleted = styled.span<{ color: string; fontSize?: string; withAttachment?: boolean }>`
  color: ${(props) => props.color};
  font-size: ${(props) => props.fontSize};
  font-style: italic;
`

const MessageBody = styled.div<{
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
  background-color: ${(props) => (props.isSelfMessage ? props.ownMessageBackground : props.incomingMessageBackground)};
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

const MessageContent = styled.div<{
  messageWidthPercent?: string | number
  withAvatar?: boolean
  rtl?: boolean
  selectionIsActive?: boolean
}>`
  position: relative;
  margin-left: ${(props) => props.withAvatar && '13px'};
  margin-right: ${(props) => props.withAvatar && '13px'};
  //transform: ${(props) => !props.withAvatar && (props.rtl ? 'translate(-32px,0)  ' : 'translate(32px,0)')};
  max-width: ${(props) => (props.messageWidthPercent ? `${props.messageWidthPercent}%` : '100%')};

  display: flex;
  flex-direction: column;
  pointer-events: ${(props) => props.selectionIsActive && 'none'};
`

/* const AudioMessageTime = styled.div`
  position: absolute;
  right: 12px;
  bottom: 8px;
` */

const VoiceIconWrapper = styled(VoiceIcon)`
  transform: translate(0px, 3.5px);
  color: ${(props) => props.color};
`

const MessageItem = styled.div<{
  rtl?: boolean
  hoverBackground?: string
  topMargin?: string
  bottomMargin?: string
  ref?: any
  withAvatar?: boolean
  selectMessagesIsActive?: boolean
}>`
  display: flex;
  position: relative;
  margin-top: ${(props) => props.topMargin || '12px'};
  margin-bottom: ${(props) => props.bottomMargin};
  padding: ${(props) => (props.selectMessagesIsActive ? '0 calc(4% + 52px)' : '0 4%')};
  padding-left: ${(props) =>
    !props.withAvatar && !props.rtl && `calc(4% + ${props.selectMessagesIsActive ? '84px' : '32px'})`};
  padding-right: ${(props) => !props.withAvatar && props.rtl && 'calc(4% + 32px)'};
  //transition: all 0.2s;
  width: 100%;
  box-sizing: border-box;
  transition: padding-left 0.2s;
  cursor: ${(props) => props.selectMessagesIsActive && 'pointer'};
  ${(props) => props.rtl && 'direction: rtl;'};

  &:hover {
    background-color: ${(props) => props.hoverBackground || ''};
  }

  &:hover ${HiddenMessageTime} {
    display: inline-block;
  }
  &:hover ${MessageStatusAndTime} {
    display: flex;
    visibility: visible;
  }

  &:hover ${MessageStatus} {
    visibility: visible;
  }
`

const EmojiContainer = styled.div<any>`
  position: absolute;
  left: ${(props) => (props.rtlDirection ? '' : '0')};
  right: ${(props) => props.rtlDirection && '0'};
  //top: ${(props) => (props.position === 'top' ? '-250px' : 'calc(100% + 6px)')};
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
