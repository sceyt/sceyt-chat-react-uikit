import styled from 'styled-components'
import React from 'react'
import moment from 'moment'
// Hooks
import { useColor } from '../../../hooks'
// Assets
import { ReactComponent as VoiceIcon } from '../../../assets/svg/voiceIcon.svg'
// Helpers
import { isJSON, makeUsername } from '../../../helpers/message'
import { getClient } from '../../../common/client'
import { getShowOnlyContactUsers } from '../../../helpers/contacts'
import { attachmentTypes, DEFAULT_CHANNEL_TYPE, MESSAGE_STATUS } from '../../../helpers/constants'
import { MessageOwner, ReplyMessageText } from '../../../UIHelper'
import { colors, THEME_COLOR_NAMES } from '../../../UIHelper/constants'
import { IAttachment, IChannel, IMessage } from '../../../types'
import { MessageTextFormat } from '../../../messageUtils'
import Attachment from '../../Attachment'
// Components

interface IMessageProps {
  message: IMessage
  channel: IChannel
  isPendingMessage?: boolean
  prevMessage?: IMessage
  nextMessage: IMessage
  handleScrollToRepliedMessage: (msgId: string) => void
  unreadMessageId: string
  isUnreadMessage: boolean
  ownMessageOnRightSide?: boolean
  showSenderNameOnDirectChannel?: boolean
  showSenderNameOnGroupChannel?: boolean
  showSenderNameOnOwnMessages?: boolean
  ownMessageBackground?: string
  incomingMessageBackground?: string
  ownRepliedMessageBackground?: string
  incomingRepliedMessageBackground?: string
  fileAttachmentsBoxWidth?: number
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
}

const ReplyMessage = ({
  message,
  channel,
  handleScrollToRepliedMessage,
  prevMessage,
  nextMessage,
  isUnreadMessage,
  unreadMessageId,
  ownMessageOnRightSide,
  showSenderNameOnDirectChannel = false,
  showSenderNameOnGroupChannel = true,
  showSenderNameOnOwnMessages = true,
  ownMessageBackground = colors.primaryLight,
  incomingMessageBackground,
  ownRepliedMessageBackground,
  incomingRepliedMessageBackground,

  fileAttachmentsIcon,
  fileAttachmentsBoxWidth,
  fileAttachmentsBoxBorder,
  fileAttachmentsTitleColor,
  fileAttachmentsSizeColor,
  imageAttachmentMaxWidth,
  imageAttachmentMaxHeight,
  videoAttachmentMaxWidth,
  videoAttachmentMaxHeight,
  selectedMessagesMap,
  contactsMap
}: IMessageProps) => {
  const accentColor = useColor(THEME_COLOR_NAMES.ACCENT)
  const bubbleOutgoing = useColor(THEME_COLOR_NAMES.BUBBLE_OUTGOING)
  const bubbleIncoming = useColor(THEME_COLOR_NAMES.BUBBLE_INCOMING)
  const bubbleOutgoingX = useColor(THEME_COLOR_NAMES.BUBBLE_INCOMING_X)
  const bubbleIncomingX = useColor(THEME_COLOR_NAMES.BUBBLE_OUTGOING_X)
  const textPrimary = useColor(THEME_COLOR_NAMES.TEXT_PRIMARY)
  const textSecondary = useColor(THEME_COLOR_NAMES.TEXT_SECONDARY)
  const ChatClient = getClient()
  const { user } = ChatClient
  const getFromContacts = getShowOnlyContactUsers()
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
  const withAttachments = message.attachments && message.attachments.length > 0
  const notLinkAttachment =
    withAttachments && message.attachments.some((a: IAttachment) => a.type !== attachmentTypes.link)
  const parentNotLinkAttachment =
    message.parentMessage &&
    message.parentMessage.attachments &&
    message.parentMessage.attachments.some((a: IAttachment) => a.type !== attachmentTypes.link)

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

  return (
    <ReplyMessageContainer
      withSenderName={showMessageSenderName}
      withBody={!!message.body}
      withAttachments={withAttachments && notLinkAttachment}
      leftBorderColor={accentColor}
      backgroundColor={
        message.incoming
          ? incomingRepliedMessageBackground || bubbleIncomingX
          : ownRepliedMessageBackground || bubbleOutgoingX
      }
      onClick={() =>
        handleScrollToRepliedMessage && !selectionIsActive && handleScrollToRepliedMessage(message!.parentMessage!.id)
      }
    >
      {message.parentMessage!.attachments &&
        !!message.parentMessage!.attachments.length &&
        message.parentMessage!.attachments[0].type !== attachmentTypes.voice &&
        parentNotLinkAttachment &&
        // <MessageAttachments>
        (message.parentMessage!.attachments as any[]).map((attachment, index) => (
          <Attachment
            key={attachment.tid || attachment.url}
            backgroundColor={
              message.incoming ? incomingMessageBackground || bubbleIncoming : ownMessageBackground || bubbleOutgoing
            }
            attachment={{
              ...attachment,
              metadata: isJSON(attachment.metadata) ? JSON.parse(attachment.metadata) : attachment.metadata
            }}
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
          />
        ))}
      <ReplyMessageBody rtlDirection={ownMessageOnRightSide && !message.incoming}>
        <MessageOwner
          className='reply-message-owner'
          color={accentColor}
          fontSize='12px'
          rtlDirection={ownMessageOnRightSide && !message.incoming}
        >
          {message.parentMessage!.user.id === user.id
            ? 'You'
            : makeUsername(contactsMap[message.parentMessage!.user.id], message.parentMessage!.user, getFromContacts)}
        </MessageOwner>

        <ReplyMessageText color={textPrimary} fontSize='14px' lineHeight='16px'>
          {!!message.parentMessage!.attachments.length &&
            message.parentMessage!.attachments[0].type === attachmentTypes.voice && (
              <VoiceIconWrapper color={accentColor} />
            )}
          {message.parentMessage!.state === MESSAGE_STATUS.DELETE ? (
            <MessageStatusDeleted color={textSecondary}> Message was deleted. </MessageStatusDeleted>
          ) : message.parentMessage!.body ? (
            MessageTextFormat({
              text: message.parentMessage!.body,
              message: message.parentMessage,
              contactsMap,
              getFromContacts,
              asSampleText: true,
              accentColor
            })
          ) : (
            parentNotLinkAttachment &&
            (message.parentMessage!.attachments[0].type === attachmentTypes.image
              ? 'Photo'
              : message.parentMessage!.attachments[0].type === attachmentTypes.video
                ? 'Video'
                : message.parentMessage!.attachments[0].type === attachmentTypes.voice
                  ? ' Voice'
                  : 'File')
          )}
        </ReplyMessageText>
      </ReplyMessageBody>
    </ReplyMessageContainer>
  )
}

export default React.memo(ReplyMessage, (prevProps, nextProps) => {
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
    prevProps.contactsMap === nextProps.contactsMap
  )
})

const ReplyMessageContainer = styled.div<{
  leftBorderColor?: string
  withAttachments?: boolean
  withSenderName?: boolean
  withBody?: boolean
  backgroundColor?: string
}>`
  display: flex;
  border-left: 2px solid ${(props: any) => props.leftBorderColor || '#b8b9c2'};
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
  direction: ${(props: any) => (props.rtlDirection ? 'initial' : '')};
  max-width: 100%;
`

const MessageStatusDeleted = styled.span<{ color: string; fontSize?: string; withAttachment?: boolean }>`
  color: ${(props) => props.color};
  font-size: ${(props) => props.fontSize};
  font-style: italic;
`

const VoiceIconWrapper = styled(VoiceIcon)`
  transform: translate(0px, 3.5px);
  color: ${(props) => props.color};
`
