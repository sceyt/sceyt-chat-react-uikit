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
} from 'store/message/actions'
import { createChannelAC, markMessagesAsReadAC } from 'store/channel/actions'
import { CONNECTION_STATUS } from 'store/user/constants'
// Hooks
import { useDidUpdate, useOnScreen, useColor } from 'hooks'
// Assets
import { ReactComponent as ErrorIcon } from '../../assets/svg/errorIcon.svg'
import { ReactComponent as SelectionIcon } from '../../assets/svg/selectionIcon.svg'
// Helpers
import {
  deletePendingMessage,
  getPendingAttachment,
  removeMessageFromVisibleMessagesMap,
  setMessageToVisibleMessagesMap
} from 'helpers/messagesHalper'
import { getOpenChatOnUserInteraction } from 'helpers/channelHalper'
import { DEFAULT_CHANNEL_TYPE, MESSAGE_DELIVERY_STATUS, MESSAGE_STATUS, THEME } from 'helpers/constants'
import { colors, THEME_COLORS } from 'UIHelper/constants'
import { IAttachment, IReaction } from 'types'
// Components
import Avatar from '../Avatar'
import ConfirmPopup from 'common/popups/delete'
import ForwardMessagePopup from 'common/popups/forwardMessage'
import ReactionsPopup from 'common/popups/reactions'
import { IMessageProps } from './Message.types'
import MessageBody from './MessageBody'
import MessageStatusAndTime from './MessageStatusAndTime'

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
  const {
    [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.SECTION_BACKGROUND]: sectionBackground,
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary
  } = useColor()

  const bubbleOutgoing =
    theme === THEME.DARK ? colors.outgoingMessageBackgroundDark : colors.outgoingMessageBackgroundLight
  const bubbleIncoming =
    theme === THEME.DARK ? colors.incomingMessageBackgroundDark : colors.incomingMessageBackgroundLight

  const dispatch = useDispatch()
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
  const current = moment(message.createdAt).startOf('day')
  const firstMessageInInterval =
    !(prevMessage && current.diff(moment(prevMessage.createdAt).startOf('day'), 'days') === 0) ||
    prevMessage?.type === 'system' ||
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
    <MessageItem
      key={message.id || message.tid}
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
        {CustomMessageItem ? (
          <CustomMessageItem
            key={message.id}
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
            theme={theme}
            messageTextFontSize={messageTextFontSize}
            messageTextLineHeight={messageTextLineHeight}
            messageActionsShow={messageActionsShow}
            frequentlyEmojisOpen={frequentlyEmojisOpen}
            setMessageActionsShow={setMessageActionsShow}
            closeMessageActions={closeMessageActions}
            handleToggleForwardMessagePopup={handleToggleForwardMessagePopup}
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
          />
        )}
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
            backgroundColor={reactionsContainerBackground || sectionBackground}
            rtlDirection={ownMessageOnRightSide && !message.incoming}
          >
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
                  backgroundColor={reactionItemBackground || sectionBackground}
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
  margin: ${(props: any) => props.margin || '0 8px 0 0'};
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

const FailedMessageIcon = styled.div<{ rtl?: boolean }>`
  position: absolute;
  top: -6px;
  left: ${(props: any) => !props.rtl && '-24px'};
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
  cursor: ${(props: any) => !props.disabled && 'pointer'};
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
  margin-left: ${(props: any) => props.rtlDirection && 'auto'};
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
  direction: ${(props: any) => props.rtlDirection && 'ltr'};
  cursor: pointer;
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
