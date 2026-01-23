import styled from 'styled-components'
import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { shallowEqual } from 'react-redux'
import { useSelector, useDispatch } from 'store/hooks'
import moment from 'moment'
// Store
import {
  addReactionAC,
  addSelectedMessageAC,
  clearSelectedMessagesAC,
  closePollAC,
  deleteMessageAC,
  deleteMessageFromListAC,
  deleteReactionAC,
  forwardMessageAC,
  removeSelectedMessageAC,
  resendMessageAC,
  scrollToNewMessageAC,
  setMessageForReplyAC,
  setMessageMenuOpenedAC,
  setMessagesLoadingStateAC,
  setMessageToEditAC,
  retractPollVoteAC,
  setReactionsListAC
} from 'store/message/actions'
import {
  createChannelAC,
  getChannelByInviteKeyAC,
  markMessagesAsDeliveredAC,
  markMessagesAsReadAC,
  switchChannelInfoAC
} from 'store/channel/actions'
import { CONNECTION_STATUS } from 'store/user/constants'
// Hooks
import { useDidUpdate, useOnScreen, useColor } from 'hooks'
// Assets
import { ReactComponent as ErrorIcon } from '../../assets/svg/errorIcon.svg'
// Helpers
import {
  deletePendingMessage,
  removeMessageFromVisibleMessagesMap,
  setMessageToVisibleMessagesMap
} from 'helpers/messagesHalper'
import { getOpenChatOnUserInteraction } from 'helpers/channelHalper'
import { DEFAULT_CHANNEL_TYPE, LOADING_STATE, MESSAGE_DELIVERY_STATUS, MESSAGE_STATUS } from 'helpers/constants'
import { THEME_COLORS } from 'UIHelper/constants'
import { IReaction, IUser } from 'types'
// Components
import Avatar from '../Avatar'
import { IMessageProps } from './Message.types'
import MessageBody from './MessageBody'
import MessageStatusAndTime from './MessageStatusAndTime'
import MessageReactions from './MessageReactions'
import MessagePopups from './MessagePopups'
import MessageSelection from './MessageSelection'
import { scrollToNewMessageSelector, unreadScrollToSelector } from 'store/message/selector'
import { MESSAGE_TYPE } from 'types/enum'
import { extractTextFromReactElement, isMessageUnsupported } from 'helpers/message'
import { MessageTextFormat } from 'messageUtils'
import { getShowOnlyContactUsers } from 'helpers/contacts'
import { useMessageState } from './hooks/useMessageState'

// Constants
const MESSAGE_ACTIONS_HOVER_DELAY = 450
const MAX_SELECTED_MESSAGES = 30
const EMOJI_POPUP_THRESHOLD = 300

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
  outgoingMessageStyles,
  incomingMessageStyles,
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
  showInfoMessage = true,
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
  retractVoteIcon,
  endVoteIcon,
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
  infoIconOrder,
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
  messageTextFontSize,
  messageTextLineHeight,
  messageTimeColorOnAttachment,
  shouldOpenUserProfileForMention,
  ogMetadataProps,
  showInfoMessageProps = {},
  collapsedCharacterLimit
}: IMessageProps) => {
  const {
    [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.BACKGROUND_SECTIONS]: backgroundSections,
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.OUTGOING_MESSAGE_BACKGROUND]: outgoingMessageBackground,
    [THEME_COLORS.INCOMING_MESSAGE_BACKGROUND]: incomingMessageBackground,
    [THEME_COLORS.TEXT_ON_PRIMARY]: textOnPrimary,
    [THEME_COLORS.BORDER]: border
  } = useColor()

  const bubbleOutgoing = outgoingMessageBackground
  const bubbleIncoming = incomingMessageBackground

  const dispatch = useDispatch()
  const { state: messageState, setters: stateSetters, messageActionsTimeout } = useMessageState()
  const {
    deletePopupOpen,
    forwardPopupOpen,
    infoPopupOpen,
    messageActionsShow,
    showEndVoteConfirmPopup,
    emojisPopupOpen,
    frequentlyEmojisOpen,
    reactionsPopupOpen,
    reactionsPopupPosition,
    emojisPopupPosition,
    reactionsPopupHorizontalPosition
  } = messageState
  const {
    setDeletePopupOpen,
    setForwardPopupOpen,
    setInfoPopupOpen,
    setMessageActionsShow,
    setShowEndVoteConfirmPopup,
    setEmojisPopupOpen,
    setFrequentlyEmojisOpen,
    setReactionsPopupOpen,
    setReactionsPopupPosition,
    setEmojisPopupPosition,
    setReactionsPopupHorizontalPosition,
    setReportPopupOpen
  } = stateSetters
  const scrollToNewMessage = useSelector(scrollToNewMessageSelector, shallowEqual)
  const unreadScrollTo = useSelector(unreadScrollToSelector, shallowEqual)
  const messageItemRef = useRef<HTMLDivElement>(null)
  const isVisible = useOnScreen(messageItemRef)
  const reactionsCount = useMemo(() => {
    return message.reactionTotals
      ? message.reactionTotals.reduce((prevValue, currentValue) => prevValue + currentValue.count, 0)
      : 0
  }, [message.reactionTotals])
  const messageTextRef = useRef<HTMLDivElement>(null)
  const messageUserID = message.user ? message.user.id : 'deleted'
  const prevMessageUserID = prevMessage ? (prevMessage.user ? prevMessage.user.id : 'deleted') : null
  const current = moment(message.createdAt).startOf('day')
  const firstMessageInInterval =
    !(prevMessage && current.diff(moment(prevMessage.createdAt).startOf('day'), 'days') === 0) ||
    prevMessage?.type === MESSAGE_TYPE.SYSTEM ||
    unreadMessageId === prevMessage.id

  const messageTimeVisible = showMessageTime && (showMessageTimeForEachMessage || !nextMessage)
  const messageStatusVisible =
    !message.incoming &&
    showMessageStatus &&
    message.state !== MESSAGE_STATUS.DELETE &&
    (showMessageStatusForEachMessage || !nextMessage)

  const renderAvatar =
    (isUnreadMessage || prevMessageUserID !== messageUserID || firstMessageInInterval) &&
    !(channel.type === DEFAULT_CHANNEL_TYPE.DIRECT && !showSenderNameOnDirectChannel) &&
    !(!message.incoming && !showOwnAvatar)

  const selectionIsActive = selectedMessagesMap && selectedMessagesMap.size > 0

  const isSelectedMessage = selectedMessagesMap && selectedMessagesMap.get(message.id || message.tid!)
  const tooManySelected = selectedMessagesMap && selectedMessagesMap.size >= MAX_SELECTED_MESSAGES

  const toggleEditMode = useCallback(() => {
    dispatch(setMessageToEditAC(message))
    setMessageActionsShow(false)
  }, [dispatch, message])

  const handleRetractVote = useCallback(() => {
    if (message?.pollDetails?.id) {
      dispatch(retractPollVoteAC(channel.id, message?.pollDetails?.id, message))
      setMessageActionsShow(false)
    }
  }, [dispatch, channel.id, message])

  const handleEndVote = useCallback(() => {
    setShowEndVoteConfirmPopup(true)
    setMessageActionsShow(false)
  }, [])

  const endVote = useCallback(() => {
    if (!message?.pollDetails?.id) return
    dispatch(closePollAC(channel.id, message?.pollDetails?.id, message))
    setShowEndVoteConfirmPopup(false)
  }, [dispatch, channel.id, message])

  const handleDeletePendingMessage = useCallback(() => {
    deletePendingMessage(channel.id, message)
    dispatch(deleteMessageFromListAC(message.id || message.tid!))
  }, [dispatch, channel.id, message])

  const handleToggleDeleteMessagePopup = useCallback(() => {
    if (!message.deliveryStatus || message.deliveryStatus === MESSAGE_DELIVERY_STATUS.PENDING) {
      handleDeletePendingMessage()
    } else {
      setDeletePopupOpen((prev) => !prev)
    }
    setMessageActionsShow(false)
  }, [message.deliveryStatus, handleDeletePendingMessage])

  const handleToggleForwardMessagePopup = useCallback(() => {
    setForwardPopupOpen((prev) => {
      stopScrolling(!prev)
      return !prev
    })
    setMessageActionsShow(false)
  }, [stopScrolling])

  const handleToggleInfoMessagePopupOpen = useCallback(() => {
    setInfoPopupOpen((prev) => !prev)
    setMessageActionsShow(false)
  }, [])

  const handleReplyMessage = useCallback(
    (threadReply?: boolean) => {
      if (threadReply) {
        // dispatch(setMessageForThreadReply(message));
      } else {
        dispatch(setMessageForReplyAC(message))
      }
      setMessageActionsShow(false)
    },
    [dispatch, message]
  )

  const handleToggleReportPopupOpen = useCallback(() => {
    setReportPopupOpen((prev: boolean) => !prev)
    setMessageActionsShow(false)
  }, [setReportPopupOpen])

  const handleSelectMessage = useCallback(
    (e?: React.MouseEvent) => {
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
    },
    [dispatch, isSelectedMessage, selectedMessagesMap, message, tooManySelected]
  )

  const handleDeleteMessage = useCallback(
    (deleteOption: 'forMe' | 'forEveryone') => {
      dispatch(deleteMessageAC(channel.id, message.id, deleteOption))
      setMessageActionsShow(false)
    },
    [dispatch, channel.id, message.id]
  )

  const handleResendMessage = useCallback(() => {
    dispatch(resendMessageAC(message, channel.id, connectionStatus))
    setMessageActionsShow(false)
  }, [dispatch, message, channel.id, connectionStatus])

  const handleCopyMessage = useCallback(() => {
    const getFromContacts = getShowOnlyContactUsers()
    const textToCopyHTML = MessageTextFormat({
      text: message.body,
      message,
      contactsMap,
      getFromContacts,
      accentColor: '',
      textSecondary: ''
    })
    const textToCopy = typeof textToCopyHTML === 'string' ? textToCopyHTML : extractTextFromReactElement(textToCopyHTML)
    navigator.clipboard.writeText(textToCopy)
    setMessageActionsShow(false)
  }, [message, contactsMap])

  const handleToggleReactionsPopup = useCallback(() => {
    const reactionsContainer = document.getElementById(`${message.id}_reactions_container`)
    const reactionsContPos = reactionsContainer?.getBoundingClientRect()
    const bottomPos = messageItemRef.current?.getBoundingClientRect().bottom
    const offsetBottom = bottomPos ? window.innerHeight - bottomPos : 0
    setReactionsPopupPosition(offsetBottom)
    setReactionsPopupHorizontalPosition({
      left: reactionsContainer ? reactionsContainer.getBoundingClientRect().left : 0,
      right: reactionsContPos ? window.innerWidth - reactionsContPos.left - reactionsContPos.width : 0
    })
    dispatch(setReactionsListAC([], false))
    setReactionsPopupOpen((prev) => !prev)
  }, [dispatch, message.id])

  const handleMouseEnter = useCallback(() => {
    if (message.state !== MESSAGE_STATUS.DELETE && !selectionIsActive) {
      messageActionsTimeout.current = setTimeout(() => {
        setMessageActionsShow(true)
        dispatch(setMessageMenuOpenedAC(message.id || message.tid!))
      }, MESSAGE_ACTIONS_HOVER_DELAY)
    }
  }, [dispatch, message.state, message.id, message.tid, selectionIsActive])

  const closeMessageActions = useCallback(
    (close?: boolean) => {
      setMessageActionsShow(!close)
      if (close && !messageActionsShow && messageActionsTimeout.current) {
        clearTimeout(messageActionsTimeout.current)
      }
    },
    [messageActionsShow]
  )

  const handleMouseLeave = useCallback(() => {
    if (messageActionsTimeout.current) {
      clearTimeout(messageActionsTimeout.current)
    }
    setMessageActionsShow(false)
  }, [])

  const handleReactionAddDelete = useCallback(
    (selectedEmoji: string) => {
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
    },
    [dispatch, channel.id, channel.lastReactedMessage, message.id, message.userReactions]
  )

  const handleSendReadMarker = useCallback(() => {
    if (message.incoming && !message.userMarkers.find((marker) => marker.name === MESSAGE_DELIVERY_STATUS.DELIVERED)) {
      if (
        message.userMarkers &&
        message.userMarkers.length &&
        message.userMarkers.find((marker) => marker.name === MESSAGE_DELIVERY_STATUS.READ) &&
        !unreadScrollTo
      ) {
        dispatch(markMessagesAsDeliveredAC(channel.id, [message.id]))
      }
    }

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
      connectionStatus === CONNECTION_STATUS.CONNECTED &&
      !unreadScrollTo
    ) {
      dispatch(markMessagesAsReadAC(channel.id, [message.id]))
    }
  }, [
    dispatch,
    message.incoming,
    message.userMarkers,
    message.id,
    isVisible,
    channel.id,
    channel.newMessageCount,
    connectionStatus,
    unreadScrollTo
  ])

  const handleForwardMessage = useCallback(
    (channelIds: string[]) => {
      if (channelIds && channelIds.length) {
        channelIds.forEach((channelId) => {
          dispatch(forwardMessageAC(message, channelId, connectionStatus))
        })
      }
    },
    [dispatch, message, connectionStatus]
  )

  const handleClick = useCallback((e: MouseEvent) => {
    const target = e.target as Node
    const emojisContainer = document.getElementById('emojisContainer')
    const frequentlyEmojisContainer = document.getElementById('frequently_emojis_container')
    if (emojisContainer && !emojisContainer.contains(target)) {
      setEmojisPopupOpen(false)
    }
    if (frequentlyEmojisContainer && !frequentlyEmojisContainer.contains(target)) {
      setFrequentlyEmojisOpen(false)
    }
  }, [])

  const handleOpenEmojis = useCallback(() => {
    if (openFrequentlyUsedReactions) {
      setFrequentlyEmojisOpen(true)
    } else {
      setEmojisPopupOpen(true)
    }
  }, [openFrequentlyUsedReactions])

  const handleCreateChat = useCallback(
    (user?: IUser) => {
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
    },
    [dispatch, selectionIsActive]
  )

  useEffect(() => {
    if (isVisible && !unreadScrollTo) {
      if (setLastVisibleMessageId) {
        setLastVisibleMessageId(message.id)
      }
      handleSendReadMarker()
      if (!channel.isLinkedChannel) {
        setMessageToVisibleMessagesMap(message)
      }

      if (scrollToNewMessage.scrollToBottom && (message?.id === channel.lastMessage?.id || !message?.id)) {
        dispatch(scrollToNewMessageAC(false, false, false))
        dispatch(setMessagesLoadingStateAC(LOADING_STATE.LOADED))
      }
    } else {
      if (!channel.isLinkedChannel) {
        removeMessageFromVisibleMessagesMap(message)
      }
    }
  }, [
    isVisible,
    unreadScrollTo,
    setLastVisibleMessageId,
    message.id,
    handleSendReadMarker,
    channel.isLinkedChannel,
    channel.lastMessage?.id,
    scrollToNewMessage.scrollToBottom,
    dispatch,
    message
  ])

  useEffect(() => {
    if (!isVisible && infoPopupOpen) {
      setInfoPopupOpen(false)
    }
  }, [isVisible, infoPopupOpen])

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
      setEmojisPopupPosition(offsetBottom < EMOJI_POPUP_THRESHOLD ? 'top' : 'bottom')
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
  }, [handleClick])

  const handleOpenChannelDetails = useCallback(() => {
    dispatch(switchChannelInfoAC(true))
  }, [dispatch])

  const handleOpenUserProfile = useCallback(
    (user?: IUser) => {
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
        handleOpenChannelDetails()
      }
    },
    [dispatch, selectionIsActive, handleOpenChannelDetails]
  )

  const unsupportedMessage = useMemo(() => {
    return isMessageUnsupported(message)
  }, [message])

  const onInviteLinkClick = useCallback(
    (key: string) => {
      dispatch(getChannelByInviteKeyAC(key))
    },
    [dispatch]
  )

  return (
    <MessageItem
      className='message_item'
      rtl={ownMessageOnRightSide && !message.incoming}
      withAvatar={renderAvatar}
      showOwnAvatar={showOwnAvatar}
      hoverBackground={
        hoverBackground
          ? message.incoming
            ? incomingMessageStyles?.background || bubbleIncoming
            : outgoingMessageStyles?.background || bubbleOutgoing
          : ''
      }
      topMargin={
        prevMessage?.type === MESSAGE_TYPE.SYSTEM
          ? '0'
          : prevMessage && unreadMessageId === prevMessage.id
            ? '16px'
            : prevMessageUserID !== messageUserID || firstMessageInInterval
              ? differentUserMessageSpacing || '16px'
              : sameUserMessageSpacing || '6px'
      }
      bottomMargin={message.reactionTotals && message.reactionTotals.length ? reactionsContainerTopPosition : ''}
      ref={messageItemRef}
      selectMessagesIsActive={selectionIsActive}
      onClick={(e: React.MouseEvent<HTMLDivElement>) => selectionIsActive && handleSelectMessage(e)}
      // id={message.id}
    >
      <MessageSelection
        isActive={!!selectionIsActive}
        isSelected={!!isSelectedMessage}
        tooManySelected={!!tooManySelected}
        messageState={message.state}
        accentColor={accentColor}
        borderColor={border}
        onSelect={handleSelectMessage}
      />
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
          <FailedMessageIcon rtl={ownMessageOnRightSide && !message.incoming} onClick={handleResendMessage}>
            <ErrorIconWrapper />
          </FailedMessageIcon>
        )}
        {CustomMessageItem ? (
          <CustomMessageItem
            key={message.id || message.tid}
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
            handleRetractVote={handleRetractVote}
            handleEndVote={handleEndVote}
            handleResendMessage={handleResendMessage}
            handleOpenInfoMessage={handleToggleInfoMessagePopupOpen}
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
            handleOpenUserProfile={handleOpenUserProfile}
            unsupportedMessage={unsupportedMessage}
            onInviteLinkClick={onInviteLinkClick}
          />
        ) : (
          <MessageBody
            onInviteLinkClick={onInviteLinkClick}
            handleRetractVote={handleRetractVote}
            handleEndVote={handleEndVote}
            message={message}
            channel={channel}
            MessageActionsMenu={MessageActionsMenu}
            handleScrollToRepliedMessage={handleScrollToRepliedMessage}
            handleMediaItemClick={handleMediaItemClick}
            isPendingMessage={isPendingMessage}
            prevMessage={prevMessage}
            nextMessage={nextMessage}
            isUnreadMessage={isUnreadMessage}
            unreadMessageId={unreadMessageId}
            isThreadMessage={isThreadMessage}
            fontFamily={fontFamily}
            ownMessageOnRightSide={ownMessageOnRightSide}
            showSenderNameOnDirectChannel={showSenderNameOnDirectChannel}
            showSenderNameOnGroupChannel={showSenderNameOnGroupChannel}
            showSenderNameOnOwnMessages={showSenderNameOnOwnMessages}
            messageStatusAndTimePosition={messageStatusAndTimePosition}
            messageStatusDisplayingType={messageStatusDisplayingType}
            outgoingMessageStyles={outgoingMessageStyles}
            incomingMessageStyles={incomingMessageStyles}
            ownRepliedMessageBackground={ownRepliedMessageBackground}
            incomingRepliedMessageBackground={incomingRepliedMessageBackground}
            showMessageStatus={showMessageStatus}
            showMessageTimeAndStatusOnlyOnHover={showMessageTimeAndStatusOnlyOnHover}
            showMessageTime={showMessageTime}
            showMessageStatusForEachMessage={showMessageStatusForEachMessage}
            showMessageTimeForEachMessage={showMessageTimeForEachMessage}
            messageReaction={messageReaction}
            editMessage={editMessage}
            copyMessage={copyMessage}
            replyMessage={replyMessage}
            replyMessageInThread={replyMessageInThread}
            deleteMessage={deleteMessage}
            selectMessage={selectMessage}
            showInfoMessage={showInfoMessage}
            allowEditDeleteIncomingMessage={allowEditDeleteIncomingMessage}
            forwardMessage={forwardMessage}
            reportMessage={reportMessage}
            reactionIcon={reactionIcon}
            editIcon={editIcon}
            copyIcon={copyIcon}
            replyIcon={replyIcon}
            replyInThreadIcon={replyInThreadIcon}
            forwardIcon={forwardIcon}
            deleteIcon={deleteIcon}
            selectIcon={selectIcon}
            starIcon={starIcon}
            staredIcon={staredIcon}
            reportIcon={reportIcon}
            retractVoteIcon={retractVoteIcon}
            endVoteIcon={endVoteIcon}
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
            infoIconOrder={infoIconOrder}
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
            infoIconTooltipText={infoIconTooltipText}
            messageActionIconsColor={messageActionIconsColor}
            messageStatusSize={messageStatusSize}
            messageStatusColor={messageStatusColor}
            messageReadStatusColor={messageReadStatusColor}
            messageStateFontSize={messageStateFontSize}
            messageStateColor={messageStateColor}
            messageTimeFontSize={messageTimeFontSize}
            messageTimeColor={messageTimeColor}
            messageStatusAndTimeLineHeight={messageStatusAndTimeLineHeight}
            fileAttachmentsIcon={fileAttachmentsIcon}
            fileAttachmentsBoxWidth={fileAttachmentsBoxWidth}
            fileAttachmentsBoxBorder={fileAttachmentsBoxBorder}
            fileAttachmentsTitleColor={fileAttachmentsTitleColor}
            fileAttachmentsSizeColor={fileAttachmentsSizeColor}
            imageAttachmentMaxWidth={imageAttachmentMaxWidth}
            imageAttachmentMaxHeight={imageAttachmentMaxHeight}
            videoAttachmentMaxWidth={videoAttachmentMaxWidth}
            videoAttachmentMaxHeight={videoAttachmentMaxHeight}
            emojisCategoryIconsPosition={emojisCategoryIconsPosition}
            emojisContainerBorderRadius={emojisContainerBorderRadius}
            fixEmojiCategoriesTitleOnTop={fixEmojiCategoriesTitleOnTop}
            selectedMessagesMap={selectedMessagesMap}
            contactsMap={contactsMap}
            openedMessageMenuId={openedMessageMenuId}
            connectionStatus={connectionStatus}
            messageTextFontSize={messageTextFontSize}
            messageTextLineHeight={messageTextLineHeight}
            messageActionsShow={messageActionsShow}
            frequentlyEmojisOpen={frequentlyEmojisOpen}
            setMessageActionsShow={setMessageActionsShow}
            closeMessageActions={closeMessageActions}
            handleToggleForwardMessagePopup={handleToggleForwardMessagePopup}
            handleToggleInfoMessagePopupOpen={handleToggleInfoMessagePopupOpen}
            handleReplyMessage={handleReplyMessage}
            handleToggleDeleteMessagePopup={handleToggleDeleteMessagePopup}
            handleToggleReportPopupOpen={handleToggleReportPopupOpen}
            handleResendMessage={handleResendMessage}
            handleOpenEmojis={handleOpenEmojis}
            setEmojisPopupOpen={setEmojisPopupOpen}
            emojisPopupOpen={emojisPopupOpen}
            emojisPopupPosition={emojisPopupPosition}
            handleCopyMessage={handleCopyMessage}
            toggleEditMode={toggleEditMode}
            handleSelectMessage={handleSelectMessage}
            handleReactionAddDelete={handleReactionAddDelete}
            handleMouseEnter={handleMouseEnter}
            handleMouseLeave={handleMouseLeave}
            handleDeletePendingMessage={handleDeletePendingMessage}
            handleCreateChat={handleCreateChat}
            messageTextRef={messageTextRef}
            messageTimeColorOnAttachment={messageTimeColorOnAttachment || textOnPrimary}
            handleOpenUserProfile={handleOpenUserProfile}
            shouldOpenUserProfileForMention={shouldOpenUserProfileForMention}
            ogMetadataProps={ogMetadataProps}
            unsupportedMessage={unsupportedMessage}
            collapsedCharacterLimit={collapsedCharacterLimit}
          />
        )}
        {messageStatusAndTimePosition === 'bottomOfMessage' && (messageStatusVisible || messageTimeVisible) && (
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
            bottomOfMessage
            marginBottom={sameUserMessageSpacing}
            ownMessageOnRightSide={ownMessageOnRightSide}
            messageTimeColorOnAttachment={messageTimeColorOnAttachment || textOnPrimary}
          />
        )}
        {message.replyCount && message.replyCount > 0 && !isThreadMessage && (
          <ThreadMessageCountContainer color={accentColor} onClick={() => handleReplyMessage(true)}>
            {`${message.replyCount} replies`}
          </ThreadMessageCountContainer>
        )}
        <MessageReactions
          message={message}
          reactionsCount={reactionsCount}
          reactionsPopupOpen={reactionsPopupOpen}
          reactionsPopupPosition={reactionsPopupPosition}
          reactionsPopupHorizontalPosition={reactionsPopupHorizontalPosition}
          rtlDirection={!!(ownMessageOnRightSide && !message.incoming)}
          backgroundSections={backgroundSections}
          textPrimary={textPrimary}
          reactionsDisplayCount={reactionsDisplayCount || 5}
          showEachReactionCount={showEachReactionCount ?? true}
          showTotalReactionCount={!!showTotalReactionCount}
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
          reactionsContainerTopPosition={reactionsContainerTopPosition}
          reactionsContainerPadding={reactionsContainerPadding}
          reactionsDetailsPopupBorderRadius={reactionsDetailsPopupBorderRadius}
          reactionsDetailsPopupHeaderItemsStyle={reactionsDetailsPopupHeaderItemsStyle}
          onToggleReactionsPopup={handleToggleReactionsPopup}
          onReactionAddDelete={handleReactionAddDelete}
          onOpenUserProfile={handleOpenUserProfile}
        />
      </MessageContent>
      <MessagePopups
        message={message}
        channel={channel}
        deletePopupOpen={deletePopupOpen}
        forwardPopupOpen={forwardPopupOpen}
        infoPopupOpen={infoPopupOpen}
        showEndVoteConfirmPopup={showEndVoteConfirmPopup}
        allowEditDeleteIncomingMessage={allowEditDeleteIncomingMessage}
        showInfoMessageProps={showInfoMessageProps}
        contactsMap={contactsMap}
        onDeleteMessage={handleDeleteMessage}
        onToggleDeletePopup={handleToggleDeleteMessagePopup}
        onForwardMessage={handleForwardMessage}
        onToggleForwardPopup={handleToggleForwardMessagePopup}
        onToggleInfoPopup={handleToggleInfoMessagePopupOpen}
        onEndVote={endVote}
        onToggleEndVotePopup={() => setShowEndVoteConfirmPopup(false)}
        onOpenUserProfile={handleOpenUserProfile}
      />
    </MessageItem>
  )
}

export default React.memo(Message, (prevProps, nextProps) => {
  // Custom comparison function - using shallow comparison for arrays/objects
  // For arrays/objects, we check reference equality which is acceptable
  // since Redux should maintain referential stability for unchanged data

  // Compare message properties
  if (prevProps.message.id !== nextProps.message.id) return false
  if (prevProps.message.deliveryStatus !== nextProps.message.deliveryStatus) return false
  if (prevProps.message.state !== nextProps.message.state) return false
  if (prevProps.message.body !== nextProps.message.body) return false
  if (prevProps.message.incoming !== nextProps.message.incoming) return false

  // Shallow comparison for arrays/objects (reference equality)
  if (prevProps.message.userReactions !== nextProps.message.userReactions) return false
  if (prevProps.message.reactionTotals !== nextProps.message.reactionTotals) return false
  if (prevProps.message.attachments !== nextProps.message.attachments) return false
  if (prevProps.message.metadata !== nextProps.message.metadata) return false
  if (prevProps.message.userMarkers !== nextProps.message.userMarkers) return false
  if (prevProps.message.pollDetails !== nextProps.message.pollDetails) return false
  if (prevProps.message.replyCount !== nextProps.message.replyCount) return false

  // Compare other props
  if (prevProps.prevMessage?.id !== nextProps.prevMessage?.id) return false
  if (prevProps.nextMessage?.id !== nextProps.nextMessage?.id) return false
  if (prevProps.channel.id !== nextProps.channel.id) return false
  if (prevProps.channel.lastMessage?.id !== nextProps.channel.lastMessage?.id) return false
  if (prevProps.channel.newMessageCount !== nextProps.channel.newMessageCount) return false
  if (prevProps.selectedMessagesMap !== nextProps.selectedMessagesMap) return false
  if (prevProps.contactsMap !== nextProps.contactsMap) return false
  if (prevProps.connectionStatus !== nextProps.connectionStatus) return false
  if (prevProps.openedMessageMenuId !== nextProps.openedMessageMenuId) return false
  if (prevProps.isUnreadMessage !== nextProps.isUnreadMessage) return false
  if (prevProps.unreadMessageId !== nextProps.unreadMessageId) return false
  if (prevProps.tabIsActive !== nextProps.tabIsActive) return false

  return true
})

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

const FailedMessageIcon = styled.div<{ rtl?: boolean }>`
  position: absolute;
  top: -6px;
  left: ${(props: any) => !props.rtl && '-24px'};
  right: ${(props) => props.rtl && '-24px'};
  width: 20px;
  height: 20px;
  cursor: pointer;
`
const ErrorIconWrapper = styled(ErrorIcon)`
  width: 20px;
  height: 20px;
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

const MessageContent = styled.div<{
  messageWidthPercent?: string | number
  withAvatar?: boolean
  rtl?: boolean
  selectionIsActive?: boolean
}>`
  position: relative;
  margin-left: ${(props: any) => props.withAvatar && '13px'};
  margin-right: ${(props) => props.withAvatar && '13px'};
  //transform: ${(props) => !props.withAvatar && (props.rtl ? 'translate(-32px,0)  ' : 'translate(32px,0)')};
  max-width: ${(props) => (props.messageWidthPercent ? `${props.messageWidthPercent}%` : '100%')};

  display: flex;
  flex-direction: column;
  pointer-events: ${(props) => props.selectionIsActive && 'none'};
`

const MessageItem = styled.div<{
  rtl?: boolean
  hoverBackground?: string
  topMargin?: string
  bottomMargin?: string
  ref?: any
  withAvatar?: boolean
  selectMessagesIsActive?: boolean
  showOwnAvatar?: boolean
}>`
  display: flex;
  position: relative;
  margin-top: ${(props: any) => props.topMargin || '12px'};
  margin-bottom: ${(props) => props.bottomMargin};
  padding: ${(props) => (props.selectMessagesIsActive ? '0 calc(4% + 52px)' : '0 4%')};
  padding-left: ${(props) =>
    !props.withAvatar && !props.rtl && `calc(4% + ${props.selectMessagesIsActive ? '84px' : '32px'})`};
  padding-right: ${(props) => !props.withAvatar && props.rtl && `calc(4% + ${props.showOwnAvatar ? '32px' : '0'})`};
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
  &:hover .message_status_time {
    display: flex;
    visibility: visible;
  }

  &:hover ${MessageStatus} {
    visibility: visible;
  }
`
