import styled from 'styled-components'
import React, { useMemo } from 'react'
// Hooks
import { useColor } from '../../../hooks'
// Assets
import { ReactComponent as VoiceIcon } from '../../../assets/svg/voiceIcon.svg'
// Helpers
import { isJSON, isMessageUnsupported, makeUsername } from '../../../helpers/message'
import { getClient } from '../../../common/client'
import { getShowOnlyContactUsers } from '../../../helpers/contacts'
import { attachmentTypes, MESSAGE_STATUS } from '../../../helpers/constants'
import { MessageOwner, ReplyMessageText } from '../../../UIHelper'
import { THEME_COLORS } from '../../../UIHelper/constants'
import { IAttachment, IMessage } from '../../../types'
import { MessageTextFormat } from '../../../messageUtils'
// Components
import Attachment from '../../Attachment'

interface IRepliedMessageProps {
  message: IMessage
  isPendingMessage?: boolean
  handleScrollToRepliedMessage: (msgId: string) => void
  showMessageSenderName?: boolean
  ownMessageOnRightSide?: boolean
  borderRadius?: string
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
  selectionIsActive?: boolean
  notLinkAttachment?: boolean
  selectedMessagesMap?: Map<string, IMessage>
  contactsMap: { [key: string]: any }
}

const RepliedMessage = ({
  message,
  handleScrollToRepliedMessage,
  ownMessageOnRightSide,
  ownRepliedMessageBackground,
  incomingRepliedMessageBackground,
  showMessageSenderName,
  borderRadius,
  fileAttachmentsIcon,
  fileAttachmentsBoxWidth,
  fileAttachmentsBoxBorder,
  fileAttachmentsTitleColor,
  fileAttachmentsSizeColor,
  imageAttachmentMaxWidth,
  imageAttachmentMaxHeight,
  videoAttachmentMaxWidth,
  videoAttachmentMaxHeight,
  selectionIsActive,
  notLinkAttachment,
  contactsMap
}: IRepliedMessageProps) => {
  const {
    [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.OUTGOING_MESSAGE_BACKGROUND_X]: outgoingMessageBackgroundX,
    [THEME_COLORS.INCOMING_MESSAGE_BACKGROUND_X]: incomingMessageBackgroundX,
    [THEME_COLORS.LINK_COLOR]: linkColor
  } = useColor()

  const bubbleOutgoingX = outgoingMessageBackgroundX
  const bubbleIncomingX = incomingMessageBackgroundX

  const ChatClient = getClient()
  const { user } = ChatClient
  const getFromContacts = getShowOnlyContactUsers()

  const withAttachments = message.attachments && message.attachments.length > 0

  const parentNotLinkAttachment =
    message.parentMessage &&
    message.parentMessage.attachments &&
    message.parentMessage.attachments.some((a: IAttachment) => a.type !== attachmentTypes.link)

  const attachementsLength = useMemo(() => {
    if (
      message.parentMessage!.attachments &&
      !!message.parentMessage!.attachments.length &&
      message.parentMessage!.attachments[0].type !== attachmentTypes.voice &&
      parentNotLinkAttachment
    ) {
      return message.parentMessage!.attachments.length
    }
    return 0
  }, [
    message.parentMessage!.attachments,
    parentNotLinkAttachment,
    message.parentMessage!.attachments[0]?.type,
    message.parentMessage!.attachments.length
  ])

  const unsupportedMessage = useMemo(() => {
    return isMessageUnsupported(message.parentMessage!)
  }, [message.parentMessage!.type])

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
      {attachementsLength > 0 &&
        // <MessageAttachments>
        (message.parentMessage!.attachments as any[]).map((attachment, index) => (
          <Attachment
            key={attachment.tid || attachment.url}
            backgroundColor={
              message.incoming
                ? incomingRepliedMessageBackground || bubbleIncomingX
                : ownRepliedMessageBackground || bubbleOutgoingX
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
            messageType={message.type}
          />
        ))}
      <ReplyMessageBody
        rtlDirection={ownMessageOnRightSide && !message.incoming}
        maxWidth={`calc(100% - ${attachementsLength * 40 + 10}px)`}
      >
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

        <ReplyMessageText color={textPrimary} fontSize='14px' lineHeight='16px' linkColor={linkColor}>
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
              accentColor,
              textSecondary,
              unsupportedMessage
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

export default React.memo(RepliedMessage, (prevProps, nextProps) => {
  // Custom comparison function to check if only 'messages' prop has changed
  return (
    prevProps.message.deliveryStatus === nextProps.message.deliveryStatus &&
    prevProps.message.state === nextProps.message.state &&
    prevProps.message.userReactions === nextProps.message.userReactions &&
    prevProps.message.body === nextProps.message.body &&
    prevProps.message.reactionTotals === nextProps.message.reactionTotals &&
    prevProps.message.attachments === nextProps.message.attachments &&
    prevProps.message.userMarkers === nextProps.message.userMarkers &&
    prevProps.selectedMessagesMap === nextProps.selectedMessagesMap &&
    prevProps.selectionIsActive === nextProps.selectionIsActive &&
    prevProps.contactsMap === nextProps.contactsMap
  )
})

const ReplyMessageContainer = styled.div<{
  leftBorderColor?: string
  withAttachments?: boolean
  withSenderName?: boolean
  withBody?: boolean
  backgroundColor: string
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
  background-color: ${(props) => props.backgroundColor};
  border-radius: 0 4px 4px 0;
  margin-top: ${(props) => !props.withSenderName && props.withAttachments && '8px'};
  cursor: pointer;
`
const ReplyMessageBody = styled.div<{ rtlDirection?: boolean; maxWidth?: string }>`
  margin-top: auto;
  margin-bottom: auto;
  direction: ${(props: any) => (props.rtlDirection ? 'initial' : '')};
  max-width: ${(props) => props.maxWidth || '100%'};
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
