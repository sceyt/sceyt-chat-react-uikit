import styled from 'styled-components'
import React, { useEffect, useRef, useState } from 'react'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import moment from 'moment'
// import { ReactComponent as ReactionIcon } from '../../assets/lib/svg/react2.svg'
import { ReactComponent as VoiceIcon } from '../../assets/svg/voiceIcon.svg'
import { ReactComponent as ForwardIcon } from '../../assets/svg/forward.svg'
// import { ReactComponent as ErrorIcon } from '../../assets/svg/errorIcon.svg'
import { ReactComponent as ErrorIcon } from '../../assets/svg/errorIcon.svg'
// import { ReactComponent as ResendIcon } from '../../assets/svg/refresh.svg'
// import { ReactComponent as DeleteIcon } from '../../assets/svg/deleteChannel.svg'
import { calculateRenderedImageWidth, messageStatusIcon } from '../../helpers'
import { isJSON, makeUsername, MessageTextFormat } from '../../helpers/message'
import { getClient } from '../../common/client'
import MessageActions from './MessageActions'
import { attachmentTypes, CHANNEL_TYPE, MESSAGE_DELIVERY_STATUS, MESSAGE_STATUS } from '../../helpers/constants'
import Avatar from '../Avatar'
import { MessageOwner, MessageText, ReplyMessageText } from '../../UIHelper'
import { colors } from '../../UIHelper/constants'
import Attachment from '../Attachment'
import { IAttachment, IChannel, IMessage, IReaction } from '../../types'
// import EmojisPopup from '../Emojis'
// import AudioPlayer from '../AudioPlayer'
import {
  addReactionAC,
  deleteMessageAC,
  deleteMessageFromListAC,
  deleteReactionAC,
  forwardMessageAC,
  resendMessageAC,
  // resendMessageAC,
  setMessageForReplyAC,
  setMessageMenuOpenedAC,
  setMessageToEditAC
} from '../../store/message/actions'
import ConfirmPopup from '../../common/popups/delete'
import { markMessagesAsReadAC } from '../../store/channel/actions'
import useOnScreen from '../../hooks/useOnScrean'
import ForwardMessagePopup from '../../common/popups/forwardMessage'
import { getShowOnlyContactUsers } from '../../helpers/contacts'
import { cancelUpload, getCustomUploader, getSendAttachmentsAsSeparateMessages } from '../../helpers/customUploader'
import {
  deletePendingAttachment,
  getPendingAttachment,
  removeMessageFromAllMessages,
  removeMessageFromMap
} from '../../helpers/messagesHalper'
// import DropDown from '../../common/dropdown'
import { connectionStatusSelector, contactsMapSelector } from '../../store/user/selector'
import { tabIsActiveSelector } from '../../store/channel/selector'
import ReactionsPopup from '../../common/popups/reactions'
import EmojisPopup from '../Emojis'
import FrequentlyEmojis from '../Emojis/frequentlyEmojis'
import { openedMessageMenuSelector } from '../../store/message/selector'
import { useDidUpdate } from '../../hooks'
// import { getPendingAttachment } from '../../helpers/messagesHalper'

interface IMessageProps {
  message: IMessage
  channel: IChannel
  isPendingMessage?: boolean
  prevMessage?: IMessage
  nextMessage: IMessage
  stopScrolling: (stop: boolean) => void
  setLastVisibleMessageId: (msgId: string) => void
  handleScrollToRepliedMessage?: (msgId: string) => void
  handleMediaItemClick?: (attachment: IAttachment) => void
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
  showOwnAvatar?: boolean
  showMessageStatus?: boolean
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
  allowEditDeleteIncomingMessage?: boolean
  reportMessage?: boolean
  reactionIcon?: JSX.Element
  editIcon?: JSX.Element
  copyIcon?: JSX.Element
  replyIcon?: JSX.Element
  replyInThreadIcon?: JSX.Element
  forwardIcon?: JSX.Element
  deleteIcon?: JSX.Element
  starIcon?: JSX.Element
  staredIcon?: JSX.Element
  reportIcon?: JSX.Element
  openFrequentlyUsedReactions?: boolean
  separateEmojiCategoriesWithTitle?: boolean
  emojisCategoryIconsPosition?: 'top' | 'bottom'
  emojisContainerBorderRadius?: string
  reactionIconOrder?: number
  editIconOrder?: number
  copyIconOrder?: number
  replyIconOrder?: number
  replyInThreadIconOrder?: number
  forwardIconOrder?: number
  deleteIconOrder?: number
  starIconOrder?: number
  reportIconOrder?: number
  reactionIconTooltipText?: string
  editIconTooltipText?: string
  copyIconTooltipText?: string
  replyIconTooltipText?: string
  replyInThreadIconTooltipText?: string
  forwardIconTooltipText?: string
  deleteIconTooltipText?: string
  starIconTooltipText?: string
  reportIconTooltipText?: string
  messageActionIconsColor?: string
  inlineReactionIcon?: JSX.Element
  reactionsDisplayCount?: number
  showEachReactionCount?: boolean
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
  reactionsContainerPadding?: string
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
}

const Message = ({
  message,
  channel,
  // forwardSenderFromContact,
  handleScrollToRepliedMessage,
  handleMediaItemClick,
  stopScrolling,
  // isPendingMessage,
  prevMessage,
  nextMessage,
  setLastVisibleMessageId,
  isUnreadMessage,
  isThreadMessage,
  fontFamily,
  ownMessageOnRightSide,
  messageWidthPercent,
  showSenderNameOnDirectChannel = false,
  showSenderNameOnGroupChannel = true,
  showSenderNameOnOwnMessages = true,
  messageStatusAndTimePosition = 'onMessage',
  messageStatusDisplayingType = 'ticks',
  ownMessageBackground = '',
  incomingMessageBackground = '',
  showOwnAvatar = true,
  showMessageStatus = true,
  showMessageTime = true,
  showMessageStatusForEachMessage = true,
  showMessageTimeForEachMessage = true,
  hoverBackground = true,
  messageReaction = true,
  editMessage = true,
  copyMessage = true,
  replyMessage = true,
  replyMessageInThread = true,
  deleteMessage = true,
  allowEditDeleteIncomingMessage,
  forwardMessage = true,
  reportMessage = true,
  reactionIcon,
  editIcon,
  copyIcon,
  replyIcon,
  replyInThreadIcon,
  forwardIcon,
  deleteIcon,
  starIcon,
  staredIcon,
  reportIcon,
  reactionIconOrder,
  openFrequentlyUsedReactions,
  editIconOrder,
  copyIconOrder,
  replyIconOrder,
  replyInThreadIconOrder,
  forwardIconOrder,
  deleteIconOrder,
  starIconOrder,
  reportIconOrder,
  reactionIconTooltipText,
  editIconTooltipText,
  copyIconTooltipText,
  replyIconTooltipText,
  replyInThreadIconTooltipText,
  forwardIconTooltipText,
  deleteIconTooltipText,
  starIconTooltipText,
  reportIconTooltipText,
  messageActionIconsColor,
  // inlineReactionIcon,
  fileAttachmentsIcon,
  reactionsDisplayCount = 5,
  showEachReactionCount = true,
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
  separateEmojiCategoriesWithTitle,
  sameUserMessageSpacing,
  differentUserMessageSpacing
}: IMessageProps) => {
  const dispatch = useDispatch()
  const ChatClient = getClient()
  const { user } = ChatClient
  const getFromContacts = getShowOnlyContactUsers()
  // const [editMode, setEditMode] = useState(false)
  const connectionStatus = useSelector(connectionStatusSelector, shallowEqual)
  const openedMessageMenuId = useSelector(openedMessageMenuSelector, shallowEqual)
  const tabIsActive = useSelector(tabIsActiveSelector, shallowEqual)
  const contactsMap = useSelector(contactsMapSelector, shallowEqual)
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
  const reactionsList = message.reactionScores && Object.keys(message.reactionScores)
  const reactionsCount =
    message.reactionScores &&
    Object.values(message.reactionScores).reduce((prevValue, currentValue) => prevValue + currentValue, 0)
  // const [reactionIsOpen, setReactionIsOpen] = useState(false)
  const messageTextRef = useRef<any>(null)
  const messageActionsTimeout = useRef<any>(null)
  const messageUserID = message.user ? message.user.id : 'deleted'
  const prevMessageUserID = prevMessage ? (prevMessage.user ? prevMessage.user.id : 'deleted') : null
  const nextMessageUserID = nextMessage ? (nextMessage.user ? nextMessage.user.id : 'deleted') : null

  const current = moment(message.createdAt).startOf('day')
  const firstMessageInInterval =
    !(prevMessage && current.diff(moment(prevMessage.createdAt).startOf('day'), 'days') === 0) ||
    prevMessage?.type === 'system'

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
    message.parent &&
    message.parent.attachments &&
    message.parent.attachments.some((a: IAttachment) => a.type !== attachmentTypes.link)
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
    !(channel.type === CHANNEL_TYPE.DIRECT && !showSenderNameOnDirectChannel) &&
    !(!message.incoming && !showOwnAvatar)
  // const selfReactionKeys = message.lastReactions.filter((reaction) => reaction.user.id === user.id);
  const borderRadius =
    !message.incoming && ownMessageOnRightSide
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
    (channel.type === CHANNEL_TYPE.DIRECT ? showSenderNameOnDirectChannel : showSenderNameOnGroupChannel) &&
    (message.incoming || showSenderNameOnOwnMessages)
  /* const handleClick = (e: any) => {
    if (emojisRef.current && !emojisRef?.current?.contains(e.target)) {
      setReactionIsOpen(false)
    }
  } */

  /* useEffect(() => {
    if (message.reactionScores) {
      document.addEventListener('mousedown', handleClick)
    }
    return () => {
      document.removeEventListener('mousedown', handleClick)
    }
  }, []) */

  const toggleEditMode = () => {
    // setEditMode(!editMode)
    dispatch(setMessageToEditAC(message))
    setMessageActionsShow(false)
  }

  const handleToggleDeleteMessagePopup = () => {
    setDeletePopupOpen(!deletePopupOpen)

    setMessageActionsShow(false)
  }

  const handleToggleForwardMessagePopup = () => {
    setForwardPopupOpen(!forwardPopupOpen)

    setMessageActionsShow(false)
    stopScrolling(!forwardPopupOpen)
  }

  const handleReplyMessage = (threadReply: boolean) => {
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
        const pendingAttachment = getPendingAttachment(att.attachmentId!)
        return { ...att, data: new File([pendingAttachment], att.data.name) }
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
    messageActionsTimeout.current = setTimeout(() => {
      setMessageActionsShow(true)
      dispatch(setMessageMenuOpenedAC(message.id || message.tid!))
    }, 450)
  }

  const closeMessageActions = (close: boolean) => {
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
    if (message.attachments && message.attachments.length) {
      const customUploader = getCustomUploader()
      message.attachments.forEach((att: IAttachment) => {
        if (customUploader) {
          cancelUpload(att.attachmentId!)
          deletePendingAttachment(att.attachmentId!)
        }
      })
    }
    removeMessageFromMap(channel.id, message.id || message.tid!)
    removeMessageFromAllMessages(message.id || message.tid!)
    dispatch(deleteMessageFromListAC(message.id || message.tid!))
  }

  const handleReactionAddDelete = (selectedEmoji: any) => {
    if (message.selfReactions && message.selfReactions.some((item: IReaction) => item.key === selectedEmoji)) {
      dispatch(
        deleteReactionAC(
          channel.id,
          message.id,
          selectedEmoji,
          channel.userMessageReactions &&
            channel.userMessageReactions[0] &&
            channel.userMessageReactions[0].messageId === message.id &&
            channel.userMessageReactions[0].key === selectedEmoji
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
      !(message.selfMarkers.length && message.selfMarkers.includes(MESSAGE_DELIVERY_STATUS.READ))
    ) {
      // console.log('send marker for message ... ', message)
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
  /*  const MessageActionsCont =
    // () =>
    // useMemo(
    () => (
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
        handleAddEmoji={handleReactionAddDelete}
        selfMessage={message.user && messageUserID === user.id}
        isThreadMessage={!!isThreadMessage}
        rtlDirection={ownMessageOnRightSide && !message.incoming}
        showMessageReaction={messageReaction}
        showEditMessage={
          editMessage &&
          !(
            (message.attachments &&
              message.attachments.length &&
              message.attachments[0].type === attachmentTypes.voice) ||
            !message.body
          )
        }
        showCopyMessage={copyMessage && message.body}
        showReplyMessage={replyMessage}
        showReplyMessageInThread={replyMessageInThread}
        showForwardMessage={forwardMessage}
        showDeleteMessage={deleteMessage}
        showReportMessage={reportMessage}
        reactionIcon={reactionIcon}
        editIcon={editIcon}
        copyIcon={copyIcon}
        replyIcon={replyIcon}
        replyInThreadIcon={replyInThreadIcon}
        forwardIcon={forwardIcon}
        deleteIcon={deleteIcon}
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
        starIconOrder={starIconOrder}
        reportIconOrder={reportIconOrder}
        reactionIconTooltipText={reactionIconTooltipText}
        editIconTooltipText={editIconTooltipText}
        copyIconTooltipText={copyIconTooltipText}
        replyIconTooltipText={replyIconTooltipText}
        replyInThreadIconTooltipText={replyInThreadIconTooltipText}
        forwardIconTooltipText={forwardIconTooltipText}
        deleteIconTooltipText={deleteIconTooltipText}
        starIconTooltipText={starIconTooltipText}
        reportIconTooltipText={reportIconTooltipText}
        messageActionIconsColor={messageActionIconsColor}
        myRole={channel.role}
        isIncoming={message.incoming}
      />
      // ),
      // [message.id]
    ) */
  const MessageHeader = () => (
    <MessageHeaderCont
      isReplied={!!message.parent}
      isForwarded={!!message.forwardingDetails}
      messageBody={!!message.body}
      withPadding={
        withAttachments && notLinkAttachment /* ||
            (message.parent &&
              message.parent.attachments &&
              !!message.parent.attachments.length &&
              parentNotLinkAttachment) */
      }
    >
      {showMessageSenderName && (
        <MessageOwner
          className='message-owner'
          color={colors.primary}
          rtlDirection={ownMessageOnRightSide && !message.incoming}
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

  useEffect(() => {
    // console.log('message body .. .', message.body)
    // console.log('isVisible - -- - ', isVisible)
    if (isVisible && tabIsActive) {
      setLastVisibleMessageId(message.id)
      handleSendReadMarker()
    }
  }, [isVisible])

  useEffect(() => {
    if (tabIsActive) {
      handleSendReadMarker()
    }
  }, [tabIsActive])

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

  useEffect(() => {
    document.addEventListener('mousedown', handleClick)
    return () => {
      document.removeEventListener('mousedown', handleClick)
    }
  }, [])
  return (
    <MessageItem
      key={message.id || message.tid}
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
          : prevMessageUserID !== messageUserID || firstMessageInInterval
          ? differentUserMessageSpacing || '16px'
          : sameUserMessageSpacing || '8px'
      }
      bottomMargin={reactionsList && reactionsList.length ? reactionsContainerTopPosition : ''}
      ref={messageItemRef}
      // id={message.id}
      className='MessageItem'
    >
      {renderAvatar && (
        <Avatar
          name={message.user && (message.user.firstName || messageUserID)}
          image={message.user && message.user.avatarUrl}
          size={32}
          textSize={14}
          setDefaultAvatar
        />
      )}
      {/* <MessageBoby /> */}
      <MessageContent
        messageWidthPercent={messageWidthPercent}
        rtl={ownMessageOnRightSide && !message.incoming}
        withAvatar={
          !(channel.type === CHANNEL_TYPE.DIRECT && !showSenderNameOnDirectChannel) &&
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

        <MessageBody
          className='messageBody'
          isSelfMessage={!message.incoming}
          isReplyMessage={!!(message.parent && message.parent.id && !isThreadMessage)}
          rtlDirection={ownMessageOnRightSide && !message.incoming}
          parentMessageIsVoice={
            message.parent &&
            message.parent.attachments &&
            message.parent.attachments[0] &&
            message.parent.attachments[0].type === attachmentTypes.voice
          }
          ownMessageBackground={ownMessageBackground}
          incomingMessageBackground={incomingMessageBackground}
          borderRadius={borderRadius}
          withAttachments={notLinkAttachment}
          attachmentWidth={
            withAttachments
              ? mediaAttachment
                ? mediaAttachment.type === attachmentTypes.image
                  ? attachmentMetas &&
                    getSendAttachmentsAsSeparateMessages() &&
                    attachmentMetas.szw &&
                    calculateRenderedImageWidth(
                      attachmentMetas.szw,
                      attachmentMetas.szh,
                      imageAttachmentMaxWidth,
                      imageAttachmentMaxHeight
                    )[0]
                  : mediaAttachment.type === attachmentTypes.video
                  ? videoAttachmentMaxWidth || 320
                  : undefined
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
          {!isThreadMessage && messageActionsShow && !emojisPopupOpen && !frequentlyEmojisOpen && (
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
              handleAddEmoji={handleReactionAddDelete}
              selfMessage={message.user && messageUserID === user.id}
              isThreadMessage={!!isThreadMessage}
              rtlDirection={ownMessageOnRightSide && !message.incoming}
              showMessageReaction={messageReaction}
              showEditMessage={
                editMessage &&
                !message.forwardingDetails &&
                !(
                  (message.attachments &&
                    message.attachments.length &&
                    message.attachments[0].type === attachmentTypes.voice) ||
                  !message.body
                )
              }
              showCopyMessage={copyMessage && message.body}
              showReplyMessage={replyMessage}
              showReplyMessageInThread={replyMessageInThread}
              showForwardMessage={forwardMessage}
              showDeleteMessage={deleteMessage}
              showReportMessage={reportMessage}
              reactionIcon={reactionIcon}
              editIcon={editIcon}
              copyIcon={copyIcon}
              replyIcon={replyIcon}
              replyInThreadIcon={replyInThreadIcon}
              forwardIcon={forwardIcon}
              deleteIcon={deleteIcon}
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
              starIconOrder={starIconOrder}
              reportIconOrder={reportIconOrder}
              reactionIconTooltipText={reactionIconTooltipText}
              editIconTooltipText={editIconTooltipText}
              copyIconTooltipText={copyIconTooltipText}
              replyIconTooltipText={replyIconTooltipText}
              replyInThreadIconTooltipText={replyInThreadIconTooltipText}
              forwardIconTooltipText={forwardIconTooltipText}
              deleteIconTooltipText={deleteIconTooltipText}
              starIconTooltipText={starIconTooltipText}
              reportIconTooltipText={reportIconTooltipText}
              messageActionIconsColor={messageActionIconsColor}
              myRole={channel.role}
              isIncoming={message.incoming}
              handleOpenEmojis={handleOpenEmojis}
            />
          )}
          {message.parent && message.parent.id && !isThreadMessage && (
            <ReplyMessageContainer
              withSenderName={showMessageSenderName}
              withBody={!!message.body}
              withAttachments={withAttachments && notLinkAttachment}
              leftBorderColor={colors.primary}
              onClick={() => handleScrollToRepliedMessage && handleScrollToRepliedMessage(message!.parent!.id)}
            >
              {
                message.parent.attachments &&
                  !!message.parent.attachments.length &&
                  message.parent.attachments[0].type !== attachmentTypes.voice &&
                  parentNotLinkAttachment &&
                  // <MessageAttachments>
                  (message.parent.attachments as any[]).map((attachment, index) => (
                    <Attachment
                      key={attachment.attachmentId || attachment.url}
                      backgroundColor={message.incoming ? incomingMessageBackground : ownMessageBackground}
                      attachment={{
                        ...attachment,
                        metadata: isJSON(attachment.metadata) ? JSON.parse(attachment.metadata) : attachment.metadata
                      }}
                      removeSelected={handleRemoveFailedAttachment}
                      selectedFileAttachmentsIcon={fileAttachmentsIcon}
                      isRepliedMessage
                      borderRadius={index === message.parent!.attachments.length - 1 ? borderRadius : '16px'}
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
                  color={colors.primary}
                  fontSize='12px'
                  rtlDirection={ownMessageOnRightSide && !message.incoming}
                >
                  {message.parent.user.id === user.id
                    ? 'You'
                    : makeUsername(contactsMap[message.parent.user.id], message.parent.user, getFromContacts)}
                </MessageOwner>

                <ReplyMessageText fontSize='14px' lineHeight='16px'>
                  {!!message.parent.attachments.length &&
                    message.parent.attachments[0].type === attachmentTypes.voice && (
                      <VoiceIconWrapper color={colors.primary} />
                    )}
                  {message.parent.body
                    ? MessageTextFormat({
                        text: message.parent.body,
                        message: message.parent,
                        contactsMap,
                        getFromContacts
                      })
                    : parentNotLinkAttachment &&
                      (message.parent.attachments[0].type === attachmentTypes.image
                        ? 'Photo'
                        : message.parent.attachments[0].type === attachmentTypes.video
                        ? 'Video'
                        : message.parent.attachments[0].type === attachmentTypes.voice
                        ? ' Voice'
                        : 'File')}
                </ReplyMessageText>
              </ReplyMessageBody>
            </ReplyMessageContainer>
          )}
          {message.forwardingDetails &&
            message.forwardingDetails.user &&
            message.user &&
            message.forwardingDetails.user.id !== message.user.id && (
              <ForwardedTitle
                withPadding={withAttachments && notLinkAttachment}
                withAttachments={withAttachments}
                withMediaAttachment={withMediaAttachment}
                withBody={!!message.body}
                showSenderName={showMessageSenderName}
                color={colors.primary}
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
            draggable={false}
            showMessageSenderName={showMessageSenderName}
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
                getFromContacts
              })}
            </span>
            {/* <Linkify>{wrapTags(message.text, mentionRegex, 'mention')}</Linkify> */}
            {!withAttachments && message.state === MESSAGE_STATUS.DELETE ? (
              <MessageStatusDeleted> Message was deleted. </MessageStatusDeleted>
            ) : (
              ''
            )}
            {messageStatusAndTimePosition === 'onMessage' &&
            (!withAttachments || (withAttachments && message.attachments[0].type === attachmentTypes.link)) &&
            (messageStatusVisible || messageTimeVisible) ? (
              <MessageStatusAndTime leftMargin isSelfMessage={!message.incoming}>
                {message.state === MESSAGE_STATUS.EDIT ? <MessageStatusUpdated>edited</MessageStatusUpdated> : ''}
                {messageTimeVisible && (
                  <HiddenMessageTime>{`${moment(message.createdAt).format('HH:mm')}`}</HiddenMessageTime>
                )}
                {messageStatusVisible && (
                  <MessageStatus iconColor={colors.primary}>
                    {messageStatusIcon(message.deliveryStatus, messageStatusDisplayingType)}
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
                withAttachment
                leftMargin
                isSelfMessage={!message.incoming}
                fileAttachment={message.attachments[0].type === 'file' || message.attachments[0].type === 'voice'}
              >
                {message.state === MESSAGE_STATUS.EDIT ? (
                  <MessageStatusUpdated
                    color={
                      message.attachments[0].type !== 'voice' && message.attachments[0].type !== 'file'
                        ? colors.white
                        : ''
                    }
                  >
                    edited
                  </MessageStatusUpdated>
                ) : (
                  ''
                )}
                {messageTimeVisible && (
                  <HiddenMessageTime>{`${moment(message.createdAt).format('HH:mm')}`}</HiddenMessageTime>
                )}
                {messageStatusVisible &&
                  messageStatusIcon(
                    message.deliveryStatus,
                    messageStatusDisplayingType,
                    message.attachments[0].type !== 'voice' && message.attachments[0].type !== 'file'
                      ? colors.white
                      : ''
                  )}
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
                  key={attachment.attachmentId || attachment.url}
                  handleMediaItemClick={handleMediaItemClick}
                  attachment={{
                    ...attachment,
                    metadata: isJSON(attachment.metadata) ? JSON.parse(attachment.metadata) : attachment.metadata
                  }}
                  removeSelected={handleRemoveFailedAttachment}
                  imageMinWidth={
                    message.parent &&
                    message.parent.attachments &&
                    message.parent.attachments[0] &&
                    message.parent.attachments[0].type === attachmentTypes.voice
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
                  separateEmojiCategoriesWithTitle={separateEmojiCategoriesWithTitle}
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
                frequentlyEmojis={message.selfReactions}
              />
            </FrequentlyEmojisContainer>
          )}
        </MessageBody>
        {messageStatusAndTimePosition === 'bottomOfMessage' && (messageStatusVisible || messageTimeVisible) && (
          // (!withAttachments || (withAttachments && message.attachments[0].type === attachmentTypes.link)) ? (
          <MessageStatusAndTime
            isSelfMessage={!message.incoming}
            marginBottom={sameUserMessageSpacing}
            rtlDirection={ownMessageOnRightSide && !message.incoming}
            bottomOfMessage
          >
            {message.state === MESSAGE_STATUS.EDIT ? <MessageStatusUpdated>edited</MessageStatusUpdated> : ''}
            {messageTimeVisible && (
              <HiddenMessageTime>{`${moment(message.createdAt).format('HH:mm')}`}</HiddenMessageTime>
            )}
            {messageStatusVisible && (
              <MessageStatus iconColor={colors.primary}>
                {messageStatusIcon(message.deliveryStatus, messageStatusDisplayingType)}
              </MessageStatus>
            )}
          </MessageStatusAndTime>
        )}
        {/* ) : null} */}
        {message.replyCount && message.replyCount > 0 && !isThreadMessage && (
          <ThreadMessageCountContainer onClick={() => handleReplyMessage(true)}>
            {`${message.replyCount} replies`}
          </ThreadMessageCountContainer>
        )}
        {reactionsPopupOpen && (
          <ReactionsPopup
            bottomPosition={reactionsPopupPosition}
            horizontalPositions={reactionsPopupHorizontalPosition}
            reactionScores={message.reactionScores || {}}
            messageId={message.id}
            handleReactionsPopupClose={handleToggleReactionsPopup}
            rtlDirection={ownMessageOnRightSide && !message.incoming}
            handleAddDeleteEmoji={handleReactionAddDelete}
          />
        )}
        {reactionsList && reactionsList.length && (
          <ReactionsContainer
            id={`${message.id}_reactions_container`}
            border={reactionsContainerBorder}
            boxShadow={reactionsContainerBoxShadow}
            borderRadius={reactionsContainerBorderRadius}
            topPosition={reactionsContainerTopPosition}
            padding={reactionsContainerPadding}
            backgroundColor={reactionsContainerBackground}
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
              {reactionsList.slice(0, reactionsDisplayCount || 5).map((key) => (
                <MessageReaction
                  key={key}
                  // onClick={() => handleReactionAddDelete(key)}
                  self={!!message.selfReactions.find((selfReaction: IReaction) => selfReaction.key === key)}
                  border={reactionItemBorder}
                  borderRadius={reactionItemBorderRadius}
                  backgroundColor={reactionItemBackground}
                  padding={reactionItemPadding}
                  margin={reactionItemMargin}
                  isLastReaction={reactionsCount === 1}
                  fontSize={reactionsFontSize}
                >
                  <MessageReactionKey>{`${key} ${
                    showEachReactionCount ? message.reactionScores![key] : ''
                  }`}</MessageReactionKey>
                </MessageReaction>
              ))}
              {reactionsCount && reactionsCount > 1 && (
                <MessageReaction
                  border={reactionItemBorder}
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
          myRole={channel.role}
          allowDeleteIncoming={allowEditDeleteIncomingMessage}
          isDirectChannel={channel.type === CHANNEL_TYPE.DIRECT}
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

export default Message

const MessageReactionKey = styled.span`
  font-family: apple color emoji, segoe ui emoji, noto color emoji, android emoji, emojisymbols, emojione mozilla,
    twemoji mozilla, segoe ui symbol;
`

const MessageReaction = styled.span<{
  self?: boolean
  isLastReaction?: boolean
  border?: string
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
  margin: ${(props) => props.margin || '0 6px 0 0'};
  margin-right: ${(props) => props.isLastReaction && '0'};
  border: ${(props) => props.border || `1px solid ${colors.gray3}`};
  border-color: ${(props) => props.self && colors.primary};
  color: ${(props) => (props.self ? colors.primary : '')};
  box-sizing: border-box;
  border-radius: ${(props) => props.borderRadius || '16px'};
  font-size: ${(props) => props.fontSize || '13px'};
  line-height: ${(props) => props.fontSize || '13px'};
  padding: ${(props) => props.padding || '2px 6px'};
  background-color: ${(props) => props.backgroundColor || colors.white};
  white-space: nowrap;
`

const ThreadMessageCountContainer = styled.div`
  position: relative;
  color: ${colors.primary};
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
  box-shadow: ${(props) => props.boxShadow};
  border-radius: ${(props) => props.borderRadius};
  background-color: ${(props) => props.backgroundColor};
  padding: ${(props) => props.padding};
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
}>`
  display: flex;
  align-items: center;
  padding: ${(props) =>
    props.withPadding &&
    (props.isForwarded
      ? '8px 0 2px 12px'
      : !props.isReplied && !props.messageBody
      ? '8px 0 8px 12px'
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
}>`
  display: flex;
  border-left: 2px solid ${(props) => props.leftBorderColor || '#b8b9c2'};
  padding: 0 6px;
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
  withMediaAttachment?: boolean
  color?: string
}>`
  display: flex;
  align-items: center;
  font-weight: 500;
  font-size: 13px;
  line-height: 16px;
  color: ${(props) => props.color || colors.primary};
  //margin: ${(props) => (props.withAttachments && props.withBody ? '0' : '0 0 4px')};
  margin: 0;
  padding: ${(props) => props.withPadding && '8px 0 0 12px'};
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
    color: ${(props) => props.color || colors.primary};
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

const MessageStatus = styled.span<any>`
  display: inline-block;
  margin-left: 4px;
  text-align: right;
  transform: translate(0px, -1px);
  height: 14px;
  //visibility: ${({ lastMessage }) => (lastMessage ? 'visible' : 'hidden')};
`

const HiddenMessageTime = styled.span<{ hide?: boolean }>`
  display: ${(props) => props.hide && 'none'};
  font-weight: 400;
  font-size: 12px;
  color: ${colors.gray9};
`

export const MessageStatusAndTime = styled.div<{
  withAttachment?: boolean
  fileAttachment?: boolean
  hide?: boolean
  isSelfMessage?: boolean
  marginBottom?: string
  leftMargin?: boolean
  rtlDirection?: boolean
  bottomOfMessage?: boolean
}>`
  display: ${(props) => (props.hide ? 'none' : 'flex')};
  align-items: flex-end;
  border-radius: 16px;
  padding: ${(props) => props.withAttachment && '4px 6px'};
  background-color: ${(props) => props.withAttachment && !props.fileAttachment && 'rgba(1, 1, 1, 0.3)'};
  float: right;
  line-height: 14px;
  margin-right: ${(props) => props.rtlDirection && 'auto'};
  margin-left: ${(props) => props.leftMargin && '12px'};
  margin-bottom: ${(props) => props.marginBottom && '8px'};
  direction: ${(props) => (props.isSelfMessage ? 'initial' : '')};
  transform: translate(0px, 4px);
  white-space: nowrap;
  width: ${(props) => props.bottomOfMessage && '30px'};
  justify-content: ${(props) => props.bottomOfMessage && props.rtlDirection && 'flex-end'};
  & > svg {
    margin-left: 4px;
    transform: translate(0px, -1px);
    height: 14px;
  }

  & > ${HiddenMessageTime} {
    color: ${(props) => (props.fileAttachment ? colors.gray9 : props.withAttachment ? colors.white : '')};
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

const MessageStatusUpdated = styled.span<{ color?: string }>`
  margin-right: 4px;
  font-style: italic;
  font-weight: 400;
  font-size: 12px;
  color: ${(props) => props.color || colors.gray4};
`

const MessageStatusDeleted = styled.span<{ withAttachment?: boolean }>`
  color: ${colors.gray9};
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
        ? props.attachmentWidth < 130
          ? props.isReplyMessage
            ? '210px'
            : '130px'
          : `${props.attachmentWidth}px`
        : '420px'
      : '100%'};
  padding: ${(props) =>
    props.withAttachments
      ? props.isReplyMessage
        ? '1px 0 0 '
        : '0'
      : props.isSelfMessage
      ? '8px 12px'
      : '8px 12px 8px 12px'};
  //direction: ${(props) => (props.isSelfMessage ? 'initial' : '')};
  overflow: ${(props) => props.noBody && 'hidden'};
  transition: all 0.3s;
  transform-origin: right;
`

const MessageContent = styled.div<{ messageWidthPercent?: string | number; withAvatar?: boolean; rtl?: boolean }>`
  position: relative;
  margin-left: ${(props) => props.withAvatar && '13px'};
  margin-right: ${(props) => props.withAvatar && '13px'};
  //transform: ${(props) => !props.withAvatar && (props.rtl ? 'translate(-32px,0)  ' : 'translate(32px,0)')};
  max-width: ${(props) => (props.messageWidthPercent ? `${props.messageWidthPercent}%` : '100%')};

  display: flex;
  flex-direction: column;
`

/* const AudioMessageTime = styled.div`
  position: absolute;
  right: 12px;
  bottom: 8px;
` */

const VoiceIconWrapper = styled(VoiceIcon)`
  transform: translate(0px, 3.5px);
  color: ${(props) => props.color || colors.primary};
`

const MessageItem = styled.div<{
  rtl?: boolean
  hoverBackground?: string
  topMargin?: string
  bottomMargin?: string
  ref?: any
  withAvatar?: boolean
}>`
  display: flex;
  position: relative;
  margin-top: ${(props) => props.topMargin || '12px'};
  margin-bottom: ${(props) => props.bottomMargin};
  padding: 0 4%;
  padding-left: ${(props) => !props.withAvatar && !props.rtl && 'calc(4% + 32px)'};
  padding-right: ${(props) => !props.withAvatar && props.rtl && 'calc(4% + 32px)'};
  transition: all 0.2s;
  width: 100%;
  box-sizing: border-box;

  ${(props) => props.rtl && 'direction: rtl;'}
  /* &:last-child {
    margin-bottom: 0;
  }*/

  &:hover {
    background-color: ${(props) => props.hoverBackground || ''};
  }

  &:hover ${HiddenMessageTime} {
    display: inline-block;
  }
  &:hover ${MessageStatusAndTime} {
    display: flex;
  }

  &:hover ${MessageStatus} {
    visibility: visible;
  }
`

const EmojiContainer = styled.div<any>`
  position: absolute;
  left: ${(props) => (props.rtlDirection ? '' : '0')};
  right: ${(props) => props.rtlDirection && '0'};
  top: ${(props) => (props.position === 'top' ? '-250px' : 'calc(100% + 6px)')};
  z-index: 99;
`
const FrequentlyEmojisContainer = styled.div<any>`
  position: absolute;
  left: ${(props) => (props.rtlDirection ? '' : '0')};
  right: ${(props) => props.rtlDirection && '0'};
  top: -50px;
  z-index: 99;
`
