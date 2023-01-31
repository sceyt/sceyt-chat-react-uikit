import styled from 'styled-components'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import moment from 'moment'
// import { ReactComponent as ReactionIcon } from '../../assets/lib/svg/react2.svg'
import { ReactComponent as VoiceIcon } from '../../assets/svg/voiceIcon.svg'
// import { ReactComponent as ErrorIcon } from '../../assets/svg/errorIcon.svg'
// import { ReactComponent as ResendIcon } from '../../assets/svg/refresh.svg'
// import { ReactComponent as DeleteIcon } from '../../assets/svg/deleteChannel.svg'
import {
  calculateRenderedImageWidth,
  formatAudioVideoTime,
  makeUserName,
  messageStatusIcon,
  MessageTextFormat
} from '../../helpers'
import { getClient } from '../../common/client'
import MessageActions from './MessageActions'
import { attachmentTypes, CHANNEL_TYPE, MESSAGE_DELIVERY_STATUS, MESSAGE_STATUS } from '../../helpers/constants'
import Avatar from '../Avatar'
import { MessageOwner, MessageText } from '../../UIHelper'
import { colors } from '../../UIHelper/constants'
import Attachment from '../Attachment'
import { IAttachment, IChannel, IContact, IMessage, IReaction } from '../../types'
// import EmojisPopup from '../Emojis'
// import AudioPlayer from '../AudioPlayer'
import {
  addReactionAC,
  deleteMessageAC,
  deleteReactionAC,
  // resendMessageAC,
  setMessageForReplyAC,
  setMessageToEditAC
} from '../../store/message/actions'
import ConfirmPopup from '../../common/popups/delete'
import { markMessagesAsReadAC } from '../../store/channel/actions'
import useOnScreen from '../../hooks/useOnScrean'
import ForwardMessagePopup from '../../common/popups/forwardMessage'
import { getUserDisplayNameFromContact } from '../../helpers/contacts'
// import DropDown from '../../common/dropdown'
// import { connectionStatusSelector } from '../../store/user/selector'
// import { getPendingAttachment } from '../../helpers/messagesHalper'

interface IMessageProps {
  message: IMessage
  channel: IChannel
  senderFromContact?: IContact
  parentSenderFromContact?: IContact
  isPendingMessage?: boolean
  prevMessage?: IMessage
  nextMessage: IMessage
  firstMessage: number
  setLastVisibleMessageId: (msgId: string) => void
  handleScrollToRepliedMessage?: (msgId: string) => void
  handleMediaItemClick?: (attachment: IAttachment) => void
  isUnreadMessage: boolean
  isThreadMessage: boolean
  fontFamily?: string
  ownMessageOnRightSide?: boolean
  messageWidthPercent?: string | number
  showSenderNameOnDirectChannel?: boolean
  showSenderNameOnOwnMessages?: boolean
  messageTimePosition?: 'topOfMessage' | 'onMessage'
  ownMessageBackground?: string
  incomingMessageBackground?: string
  showOwnAvatar?: boolean
  showMessageStatus?: boolean
  hoverBackground?: boolean
  messageReaction?: boolean
  editMessage?: boolean
  replyMessage?: boolean
  replyMessageInThread?: boolean
  forwardMessage?: boolean
  deleteMessage?: boolean
  reportMessage?: boolean
  reactionIcon?: JSX.Element
  editIcon?: JSX.Element
  replyIcon?: JSX.Element
  replyInThreadIcon?: JSX.Element
  forwardIcon?: JSX.Element
  deleteIcon?: JSX.Element
  starIcon?: JSX.Element
  staredIcon?: JSX.Element
  reportIcon?: JSX.Element
  reactionIconOrder?: number
  editIconOrder?: number
  replyIconOrder?: number
  replyInThreadIconOrder?: number
  forwardIconOrder?: number
  deleteIconOrder?: number
  starIconOrder?: number
  reportIconOrder?: number
  reactionIconTooltipText?: string
  editIconTooltipText?: string
  replyIconTooltipText?: string
  replyInThreadIconTooltipText?: string
  forwardIconTooltipText?: string
  deleteIconTooltipText?: string
  starIconTooltipText?: string
  reportIconTooltipText?: string
  messageActionIconsColor?: string
  messageActionIconsHoverColor?: string
  inlineReactionIcon?: JSX.Element
  reactionsBorderColor?: string
  selfReactionsBorderColor?: string
  fileAttachmentsBoxWidth?: string
  fileAttachmentsBoxBackground?: string
  fileAttachmentsBoxBorder?: string
  fileAttachmentsTitleColor?: string
  fileAttachmentsSizeColor?: string
  fileAttachmentsIcon?: JSX.Element
}

const Message = ({
  message,
  channel,
  senderFromContact,
  parentSenderFromContact,
  handleScrollToRepliedMessage,
  handleMediaItemClick,
  isPendingMessage,
  prevMessage,
  nextMessage,
  firstMessage,
  setLastVisibleMessageId,
  isUnreadMessage,
  isThreadMessage,
  fontFamily,
  ownMessageOnRightSide,
  messageWidthPercent,
  showSenderNameOnDirectChannel = false,
  showSenderNameOnOwnMessages = false,
  messageTimePosition = 'topOfMessage',
  ownMessageBackground = '',
  incomingMessageBackground = '',
  showOwnAvatar = false,
  showMessageStatus = true,
  hoverBackground = true,
  messageReaction = true,
  editMessage = true,
  replyMessage = true,
  replyMessageInThread = true,
  deleteMessage = true,
  forwardMessage = true,
  reportMessage = true,
  reactionIcon,
  editIcon,
  replyIcon,
  replyInThreadIcon,
  forwardIcon,
  deleteIcon,
  starIcon,
  staredIcon,
  reportIcon,
  reactionIconOrder,
  editIconOrder,
  replyIconOrder,
  replyInThreadIconOrder,
  forwardIconOrder,
  deleteIconOrder,
  starIconOrder,
  reportIconOrder,
  reactionIconTooltipText,
  editIconTooltipText,
  replyIconTooltipText,
  replyInThreadIconTooltipText,
  forwardIconTooltipText,
  deleteIconTooltipText,
  starIconTooltipText,
  reportIconTooltipText,
  messageActionIconsHoverColor,
  messageActionIconsColor,
  // inlineReactionIcon,
  selfReactionsBorderColor,
  reactionsBorderColor,
  fileAttachmentsIcon,
  // fileAttachmentsBoxWidth,
  // fileAttachmentsBoxBackground,
  fileAttachmentsBoxBorder,
  fileAttachmentsTitleColor,
  fileAttachmentsSizeColor
}: IMessageProps) => {
  const dispatch = useDispatch()
  const ChatClient = getClient()
  const { user } = ChatClient
  const getFromContacts = getUserDisplayNameFromContact()
  // const [editMode, setEditMode] = useState(false)
  // const connectionStatus = useSelector(connectionStatusSelector, shallowEqual)
  const [deletePopupOpen, setDeletePopupOpen] = useState(false)
  const [forwardPopupOpen, setForwardPopupOpen] = useState(false)
  const [reportPopupOpen, setReportPopupOpen] = useState(false)
  const [messageActionsShow, setMessageActionsShow] = useState(false)
  // const [reactionIsOpen, setReactionIsOpen] = useState(false)
  // const emojisRef = useRef<any>(null)
  const messageUserID = message.user ? message.user.id : 'deleted'
  const prevMessageUserID = prevMessage ? (prevMessage.user ? prevMessage.user.id : 'deleted') : null
  const nextMessageUserID = nextMessage ? (nextMessage.user ? nextMessage.user.id : 'deleted') : null
  const firstMessageInInterval = prevMessage
    ? (message.createdAt as number) - (prevMessage.createdAt as number) > 300000
    : false
  const lastMessageInInterval = nextMessage
    ? (nextMessage.createdAt as number) - (message.createdAt as number) > 300000
    : false
  const withAttachments = message.attachments && message.attachments.length > 0

  const renderAvatar =
    (isUnreadMessage || prevMessageUserID !== messageUserID || firstMessageInInterval) &&
    !(channel.type === CHANNEL_TYPE.DIRECT && !showSenderNameOnDirectChannel) &&
    !(!message.incoming && !showOwnAvatar)
  // const selfReactionKeys = message.lastReactions.filter((reaction) => reaction.user.id === user.id);
  const borderRadius = !message.incoming
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
    !(channel.type === CHANNEL_TYPE.DIRECT && !showSenderNameOnDirectChannel) &&
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
  }

  const handleToggleDeleteMessagePopup = () => {
    setDeletePopupOpen(!deletePopupOpen)
  }

  const handleToggleForwardMessagePopup = () => {
    setForwardPopupOpen(!forwardPopupOpen)
  }

  // TODO implement reply message
  const handleReplyMessage = (threadReply: boolean) => {
    if (threadReply) {
      // dispatch(setMessageForThreadReply(message));
    } else {
      dispatch(setMessageForReplyAC(message))
    }
  }

  const handleToggleReportPopupOpen = () => {
    setReportPopupOpen(!reportPopupOpen)
  }

  const handleDeleteMessage = (deleteOption: 'forMe' | 'forEveryone') => {
    dispatch(deleteMessageAC(channel.id, message.id, deleteOption))
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
  /* const handleResendMessage = () => {
    const messageToResend = { ...message }
    if (message.attachments && message.attachments.length) {
      messageToResend.attachments = (message.attachments as IAttachment[]).map((att) => {
        const pendingAttachment = getPendingAttachment(att.attachmentId!)
        return { ...att, data: new File([pendingAttachment], att.data.name) }
      })
    }

    dispatch(resendMessageAC(messageToResend, channel.id, connectionStatus))
  } */

  const handleRemoveFailedAttachment = (attachmentId: string) => {
    console.log('remove attachment .. ', attachmentId)
    // TODO implement remove failed attachment
    // dispatch(removeFailedAttachment(message.tid, attachmentId));
  }

  const handleReactionAddDelete = (selectedEmoji: any) => {
    if (message.selfReactions && message.selfReactions.some((item: IReaction) => item.key === selectedEmoji)) {
      dispatch(deleteReactionAC(channel.id, message.id, selectedEmoji))
    } else {
      const score = 1
      const reason = 'mmm'
      const enforceUnique = false
      dispatch(addReactionAC(channel.id, message.id, selectedEmoji, score, reason, enforceUnique))
    }
    // setReactionIsOpen(false)
  }

  const handleSendReadMarker = () => {
    if (
      message.incoming &&
      !(message.selfMarkers.length && message.selfMarkers.includes(MESSAGE_DELIVERY_STATUS.READ))
    ) {
      dispatch(markMessagesAsReadAC(channel.id, [message.id]))
    }
  }

  const messageItemRef = useRef()
  const isVisible = useOnScreen(messageItemRef)

  const MessageActionsCont = () =>
    useMemo(
      () => (
        <MessageActions
          messageFrom={message.user}
          channelType={channel.type}
          editModeToggle={toggleEditMode}
          messageStatus={message.deliveryStatus || MESSAGE_DELIVERY_STATUS.PENDING}
          handleOpenDeleteMessage={handleToggleDeleteMessagePopup}
          handleOpenForwardMessage={handleToggleForwardMessagePopup}
          // handleResendMessage={handleResendMessage}
          handleReplyMessage={handleReplyMessage}
          handleReportMessage={handleToggleReportPopupOpen}
          handleAddReaction={handleReactionAddDelete}
          selfMessage={message.user && messageUserID === user.id}
          isThreadMessage={!!isThreadMessage}
          rtlDirection={ownMessageOnRightSide && !message.incoming}
          showMessageReaction={messageReaction}
          showEditMessage={editMessage}
          showReplyMessage={replyMessage}
          showReplyMessageInThread={replyMessageInThread}
          showForwardMessage={forwardMessage}
          showDeleteMessage={deleteMessage}
          showReportMessage={reportMessage}
          reactionIcon={reactionIcon}
          editIcon={editIcon}
          replyIcon={replyIcon}
          replyInThreadIcon={replyInThreadIcon}
          forwardIcon={forwardIcon}
          deleteIcon={deleteIcon}
          starIcon={starIcon}
          staredIcon={staredIcon}
          reportIcon={reportIcon}
          reactionIconOrder={reactionIconOrder}
          editIconOrder={editIconOrder}
          replyIconOrder={replyIconOrder}
          replyInThreadIconOrder={replyInThreadIconOrder}
          forwardIconOrder={forwardIconOrder}
          deleteIconOrder={deleteIconOrder}
          starIconOrder={starIconOrder}
          reportIconOrder={reportIconOrder}
          reactionIconTooltipText={reactionIconTooltipText}
          editIconTooltipText={editIconTooltipText}
          replyIconTooltipText={replyIconTooltipText}
          replyInThreadIconTooltipText={replyInThreadIconTooltipText}
          forwardIconTooltipText={forwardIconTooltipText}
          deleteIconTooltipText={deleteIconTooltipText}
          starIconTooltipText={starIconTooltipText}
          reportIconTooltipText={reportIconTooltipText}
          messageActionIconsColor={messageActionIconsColor}
          messageActionIconsHoverColor={messageActionIconsHoverColor}
          myRole={channel.role}
          isIncoming={message.incoming}
        />
      ),
      [message.id]
    )
  const MessageHeader = () => (
    <MessageHeaderCont>
      {showMessageSenderName && (
        <MessageOwner
          withPadding={
            withAttachments || (message.parent && message.parent.attachments && !!message.parent.attachments.length)
          }
          messageBody={!!message.body}
          color={colors.primary}
          rtlDirection={ownMessageOnRightSide && !message.incoming}
        >
          {makeUserName(senderFromContact, message.user, getFromContacts)}
        </MessageOwner>
      )}
      {messageTimePosition === 'topOfMessage' && (
        <MessageTime>{`${moment(message.createdAt).format('HH:mm')}`}</MessageTime>
      )}
    </MessageHeaderCont>
  )

  useEffect(() => {
    if (isVisible) {
      setLastVisibleMessageId(message.id)
      handleSendReadMarker()
    }
  }, [isVisible])
  return (
    <MessageItem
      key={message.id || message.tid}
      rtl={ownMessageOnRightSide && !message.incoming}
      withAvatar={renderAvatar}
      hoverBackground={hoverBackground ? (message.incoming ? incomingMessageBackground : ownMessageBackground) : ''}
      topMargin={(prevMessageUserID !== messageUserID || firstMessageInInterval) && !isPendingMessage}
      ref={messageItemRef}
      id={message.id}
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
        withAvatar={renderAvatar}
        className='messageContent'
      >
        {message.state === MESSAGE_STATUS.FAILED && (
          <FailedMessageIcon rtl={ownMessageOnRightSide && !message.incoming}>
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
          className='MessageBody'
          isSelfMessage={!message.incoming}
          ownMessageBackground={ownMessageBackground}
          incomingMessageBackground={incomingMessageBackground}
          borderRadius={borderRadius}
          withAttachments={withAttachments && message.attachments[0].type !== attachmentTypes.link}
          attachmentWidth={
            withAttachments
              ? message.attachments[0].type === attachmentTypes.image
                ? message.attachments[0].metadata &&
                  message.attachments[0].metadata.szw &&
                  calculateRenderedImageWidth(
                    message.attachments[0].metadata.szw,
                    message.attachments[0].metadata.szh
                  )[0]
                : /*: message.attachments[0].type === attachmentTypes.link
                ? 324 */
                message.attachments[0].type === attachmentTypes.voice
                ? 254
                : undefined
              : undefined
          }
          noBody={!message.body && !withAttachments}
          onMouseEnter={() => setMessageActionsShow(true)}
          onMouseLeave={() => setMessageActionsShow(false)}
          showMessageActions={messageActionsShow}
        >
          {/* {withAttachments && !!message.body && <MessageHeader />} */}
          {(showMessageSenderName || messageTimePosition === 'topOfMessage') && <MessageHeader />}

          {!isThreadMessage && messageActionsShow && <MessageActionsCont />}
          {message.parent && message.parent.id && !isThreadMessage && (
            <ReplyMessageContainer
              withAttachments={withAttachments}
              leftBorderColor={colors.primary}
              onClick={() => handleScrollToRepliedMessage && handleScrollToRepliedMessage(message!.parent!.id)}
            >
              {
                message.parent.attachments &&
                  !!message.parent.attachments.length &&
                  message.parent.attachments[0].type !== attachmentTypes.voice &&
                  message.parent.attachments[0].type !== attachmentTypes.link &&
                  // <MessageAttachments>
                  (message.parent.attachments as any[]).map((attachment, index) => (
                    <Attachment
                      key={attachment.attachmentId || attachment.url}
                      backgroundColor={message.incoming ? incomingMessageBackground : ownMessageBackground}
                      attachment={attachment}
                      removeSelected={handleRemoveFailedAttachment}
                      attachments={message.parent!.attachments}
                      selectedFileAttachmentsIcon={fileAttachmentsIcon}
                      isRepliedMessage
                      borderRadius={index === message.parent!.attachments.length - 1 ? borderRadius : '16px'}
                      selectedFileAttachmentsBoxBorder={fileAttachmentsBoxBorder}
                      selectedFileAttachmentsTitleColor={fileAttachmentsTitleColor}
                      selectedFileAttachmentsSizeColor={fileAttachmentsSizeColor}
                    />
                  ))
                // </MessageAttachments>
              }
              <ReplyMessageBody>
                <MessageOwner
                  color={colors.primary}
                  fontSize='12px'
                  rtlDirection={ownMessageOnRightSide && !message.incoming}
                >
                  {message.parent.user.id === user.id
                    ? 'You'
                    : makeUserName(parentSenderFromContact, message.parent.user, getFromContacts)}
                </MessageOwner>

                <MessageText fontSize='14px' lineHeight='16px' isRepliedMessage>
                  {!!message.parent.attachments.length &&
                    message.parent.attachments[0].type === attachmentTypes.voice && <VoiceIconWrapper />}
                  {message.parent.body
                    ? MessageTextFormat({
                        text: message.parent.body,
                        message: message.parent
                      })
                    : message.parent.attachments.length &&
                      message.parent.attachments[0].type !== attachmentTypes.link &&
                      (message.parent.attachments[0].type === attachmentTypes.image
                        ? 'Photo'
                        : message.parent.attachments[0].type === attachmentTypes.video
                        ? 'Video'
                        : message.parent.attachments[0].type === attachmentTypes.voice
                        ? ' Voice Message '
                        : 'File')}
                  {!!message.parent.attachments.length &&
                    message.parent.attachments[0].type === attachmentTypes.voice && (
                      <VoiceDuration>
                        {formatAudioVideoTime(message.parent.attachments[0].metadata.dur, 0)}
                      </VoiceDuration>
                    )}
                </MessageText>
              </ReplyMessageBody>
            </ReplyMessageContainer>
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
            showMessageSenderName={showMessageSenderName}
            withAttachment={withAttachments && !!message.body}
            fontFamily={fontFamily}
          >
            {MessageTextFormat({
              text: message.body,
              message
            })}
            {/* <Linkify>{wrapTags(message.text, mentionRegex, 'mention')}</Linkify> */}
            {!withAttachments && message.state === MESSAGE_STATUS.DELETE ? (
              <MessageStatusDeleted> Message was deleted. </MessageStatusDeleted>
            ) : (
              ''
            )}
            {!withAttachments || (withAttachments && message.attachments[0].type === attachmentTypes.link) ? (
              <MessageStatusAndTime>
                {message.state === MESSAGE_STATUS.EDIT ? <MessageStatusUpdated>edited</MessageStatusUpdated> : ''}
                {messageTimePosition === 'onMessage' && (
                  <HiddenMessageTime>{`${moment(message.createdAt).format('HH:mm')}`}</HiddenMessageTime>
                )}
                {!message.incoming && showMessageStatus && message.state !== MESSAGE_STATUS.DELETE && (
                  <MessageStatus iconColor={colors.primary} lastMessage={!firstMessage}>
                    {messageStatusIcon(message.deliveryStatus)}
                  </MessageStatus>
                )}
              </MessageStatusAndTime>
            ) : null}
          </MessageText>
          {/* )} */}
          {withAttachments && message.attachments[0].type !== attachmentTypes.link && (
            <MessageStatusAndTime
              withAttachment
              fileAttachment={message.attachments[0].type === 'file' || message.attachments[0].type === 'voice'}
            >
              {message.state === MESSAGE_STATUS.EDIT ? (
                <MessageStatusUpdated color={message.attachments[0].type !== 'voice' ? colors.white : ''}>
                  edited
                </MessageStatusUpdated>
              ) : (
                ''
              )}
              {messageTimePosition === 'onMessage' && (
                <HiddenMessageTime>{`${moment(message.createdAt).format('HH:mm')}`}</HiddenMessageTime>
              )}
              {!message.incoming &&
                showMessageStatus &&
                message.state !== MESSAGE_STATUS.DELETE &&
                messageStatusIcon(
                  message.deliveryStatus,
                  message.attachments[0].type !== 'voice' && message.attachments[0].type !== 'file' ? colors.white : ''
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
              (message.attachments as any[]).map((attachment: any, index) => (
                <Attachment
                  key={attachment.attachmentId || attachment.url}
                  handleMediaItemClick={handleMediaItemClick}
                  attachment={attachment}
                  removeSelected={handleRemoveFailedAttachment}
                  attachments={message.attachments}
                  borderRadius={index === message.attachments.length - 1 ? borderRadius : '16px'}
                  selectedFileAttachmentsIcon={fileAttachmentsIcon}
                  backgroundColor={message.incoming ? incomingMessageBackground : ownMessageBackground}
                  selectedFileAttachmentsBoxBorder={fileAttachmentsBoxBorder}
                  selectedFileAttachmentsTitleColor={fileAttachmentsTitleColor}
                  selectedFileAttachmentsSizeColor={fileAttachmentsSizeColor}
                />
              ))
            // </MessageAttachments>
          }
        </MessageBody>

        {message.replyCount && message.replyCount > 0 && !isThreadMessage && (
          <ThreadMessageCountContainer onClick={() => handleReplyMessage(true)}>
            {`${message.replyCount} replies`}
          </ThreadMessageCountContainer>
        )}
        {message.reactionScores && (
          <ReactionsContainer>
            {/* <ReactionEmojis>
              <span onClick={() => setReactionIsOpen(true)}>{inlineReactionIcon || <ReactionIcon />}</span>
              <EmojiContainer ref={emojisRef} rtl={!!(ownMessageOnRightSide && !message.incoming)}>
                {reactionIsOpen && (
                  <EmojisPopup handleEmojiPopupToggle={setReactionIsOpen} handleAddReaction={handleReactionAddDelete} />
                )}
              </EmojiContainer>
            </ReactionEmojis> */}
            <MessageReactionsCont>
              {Object.keys(message.reactionScores).map((key) => (
                <MessageReaction
                  key={key}
                  onClick={() => handleReactionAddDelete(key)}
                  selfBorderColor={selfReactionsBorderColor}
                  borderColor={reactionsBorderColor}
                  self={message.selfReactions.find((selfReaction: IReaction) => selfReaction.key === key)}
                >
                  {`${key} ${message.reactionScores![key]}`}
                </MessageReaction>
              ))}
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
          isDirectChannel={channel.type === CHANNEL_TYPE.DIRECT}
          title='Delete message'
        />
      )}
      {forwardPopupOpen && (
        <ForwardMessagePopup
          handleForward={() => {
            console.log('forward')
          }}
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

const MessageReaction = styled.span<any>`
  display: inline-block;
  cursor: pointer;
  margin-right: 6px;
  border: ${(props) =>
    props.self ? `1px solid ${props.selfBorderColor || '#4F6AFF'}` : `1px solid ${props.borderColor || '#CDCDCF'}`};
  color: ${(props) => (props.self ? `${props.selfBorderColor || '#4F6AFF'}` : '')};
  box-sizing: border-box;
  border-radius: 16px;
  font-size: 13px;
  padding: 2px 6px;
  white-space: nowrap;
`

const ThreadMessageCountContainer = styled.div`
  position: relative;
  color: ${colors.cobalt1};
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
  bottom: 0;
  left: ${(props) => !props.rtl && '-24px'};
  right: ${(props) => props.rtl && '-24px'};
  width: 20px;
  height: 20px;
`
/* const ErrorIconWrapper = styled(ErrorIcon)`
  width: 20px;
  height: 20px;
` */
const ReactionsContainer = styled.div`
  display: flex;
  margin-top: 4px;
  justify-content: flex-end;
`
const MessageReactionsCont = styled.div`
  display: inline-flex;
  max-width: 300px;
  overflow-x: auto;
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

const MessageHeaderCont = styled.div`
  display: flex;
  align-items: center;
`

const MessageTime = styled.span`
  font-weight: 400;
  font-size: 12px;
  margin-right: 4px;
  color: ${colors.gray6};
`

const ReplyMessageContainer = styled.div<{ leftBorderColor?: string; withAttachments?: boolean }>`
  display: flex;
  border-left: 2px solid ${(props) => props.leftBorderColor || '#b8b9c2'};
  padding: 0 8px;
  position: relative;
  margin: ${(props) => (props.withAttachments ? '8px 12px' : '8px 0')};
  cursor: pointer;
`
const ReplyMessageBody = styled.div`
  margin-top: auto;
  margin-bottom: auto;
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

const HiddenMessageTime = styled.span`
  //display: none;
  font-weight: 400;
  font-size: 12px;
  color: ${colors.gray9};
`

export const MessageStatusAndTime = styled.div<{ withAttachment?: boolean; fileAttachment?: boolean }>`
  display: flex;
  align-items: flex-end;
  border-radius: 16px;
  padding: ${(props) => props.withAttachment && '4px 6px'};
  background-color: ${(props) => props.withAttachment && !props.fileAttachment && 'rgba(1, 1, 1, 0.3)'};
  float: right;
  line-height: 14px;
  margin-left: 12px;
  transform: translate(0px, 4px);
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
  showMessageActions?: boolean
  attachmentWidth?: number
}>`
  position: relative;
  background-color: ${(props) => (props.isSelfMessage ? props.ownMessageBackground : props.incomingMessageBackground)};
  display: inline-block;
  border-radius: ${(props) => props.borderRadius || '4px 16px 16px 4px'};
  max-width: ${(props) =>
    props.withAttachments
      ? props.attachmentWidth && props.attachmentWidth < 420
        ? props.attachmentWidth < 130
          ? '130px'
          : `${props.attachmentWidth}px`
        : '420px'
      : '100%'};
  padding: ${(props) => (props.withAttachments ? '0' : props.isSelfMessage ? '8px 12px' : '8px 12px 8px 12px')};
  direction: ${(props) => (props.isSelfMessage ? 'initial' : '')};
  overflow: ${(props) => props.noBody && 'hidden'};
  transition: all 0.3s;
  transform-origin: right;
  &:hover .message_actions_cont {
      visibility: visible;
      opacity: 1;
    }
  }
`

const MessageContent = styled.div<{ messageWidthPercent?: string | number; withAvatar?: boolean; rtl?: boolean }>`
  position: relative;
  margin-left: 13px;
  margin-right: 13px;
  //transform: ${(props) => !props.withAvatar && (props.rtl ? 'translate(-32px,0)  ' : 'translate(32px,0)')};
  max-width: ${(props) => (props.messageWidthPercent ? `${props.messageWidthPercent}%` : '100%')};
`

/* const AudioMessageTime = styled.div`
  position: absolute;
  right: 12px;
  bottom: 8px;
` */

const VoiceIconWrapper = styled(VoiceIcon)`
  transform: translate(0px, 2px);
  color: ${colors.primary};
`
const VoiceDuration = styled.span`
  color: ${colors.primary};
`

const MessageItem = styled.div<{
  rtl?: boolean
  hoverBackground?: string
  topMargin?: boolean
  ref?: any
  withAvatar?: boolean
}>`
  display: flex;
  position: relative;
  margin-top: ${(props) => props.topMargin && '10px'};
  padding: 3px 40px;
  padding-left: ${(props) => !props.withAvatar && !props.rtl && '72px'};
  padding-right: ${(props) => !props.withAvatar && props.rtl && '72px'};
  transition: all 0.2s;
  width: 100%;
  box-sizing: border-box;

  ${(props) => props.rtl && 'direction: rtl;'}
  &:last-child {
    margin-bottom: 0;
  }

  &:hover {
    background-color: ${(props) => props.hoverBackground || ''};
  }

  &:hover ${HiddenMessageTime} {
    display: inline-block;
  }

  &:hover ${MessageStatus} {
    visibility: visible;
  }

  &.highlight ${MessageBody} {
    transform: scale(1.1);
    background-color: #d5d5d5;
  }
`
