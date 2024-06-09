import React from 'react'
import { IMessage } from 'sceyt-chat-react-uikit/types'
import styled from 'styled-components'
import { Attachment, MessageTextFormat } from 'sceyt-chat-react-uikit'
import { isJSON, makeUsername } from '../../helpers'
import { ReactComponent as VoiceIcon } from '../../svg/voiceIcon.svg'
import { attachmentTypes, MESSAGE_STATUS, messagesCustomColor } from '../../helpers/constants'

function ReplyMessage(
  {
    client,
    message,
    withAttachments,
    notLinkAttachment,
    showMessageSenderName,
    selectionIsActive,
    parentNotLinkAttachment,
    borderRadius,
    handleScrollToRepliedMessage
  }: {
    client: any;
    message: IMessage;
    withAttachments?: boolean;
    notLinkAttachment?: boolean;
    showMessageSenderName?: boolean;
    selectionIsActive?: boolean;
    parentNotLinkAttachment?: any;
    borderRadius?: string;
    handleScrollToRepliedMessage: (messageId: string) => void;
  }) {

  return (
    <ReplyMessageContainer
      withSenderName={showMessageSenderName}
      withBody={!!message.body}
      withAttachments={withAttachments && notLinkAttachment}
      leftBorderColor={'#5159F6'}
      backgroundColor={
        message.incoming
          ? messagesCustomColor.incomingRepliedMessageBackground
          : messagesCustomColor.ownRepliedMessageBackground
      }
      onClick={() =>
        handleScrollToRepliedMessage &&
        !selectionIsActive &&
        handleScrollToRepliedMessage(message!.parentMessage!.id)
      }
    >
      {
        message.parentMessage?.attachments &&
        !!message.parentMessage?.attachments.length &&
        message.parentMessage?.attachments[0].type !==
        attachmentTypes.voice &&
        parentNotLinkAttachment &&
        // <MessageAttachments>
        (message.parentMessage?.attachments as any[]).map(
          (attachment, index) => (
            <Attachment
              key={attachment.tid || attachment.url}
              backgroundColor={
                message.incoming
                  ? messagesCustomColor.incomingMessageBackground
                  : messagesCustomColor.ownMessageBackground
              }
              attachment={{
                ...attachment,
                metadata: isJSON(attachment.metadata)
                  ? JSON.parse(attachment.metadata)
                  : attachment.metadata
              }}
              isRepliedMessage
              borderRadius={
                index === message.parentMessage!.attachments.length - 1
                  ? borderRadius
                  : '16px'
              }
              selectedFileAttachmentsBoxBorder={'none'}
              selectedFileAttachmentsTitleColor={'#17191C'}
              selectedFileAttachmentsSizeColor={'#757D8B'}
              // fileNameMaxLength={}
            />
          )
        )
        // </MessageAttachments>
      }
      <ReplyMessageBody rtlDirection={!message.incoming}>
        <MessageOwner
          className="reply-message-owner"
          color={'#5159F6'}
          fontSize="12px"
          rtlDirection={!message.incoming}
        >
          {message.parentMessage?.user.id === client.user.id
            ? 'You'
            : makeUsername(
              message.parentMessage?.user,
              true
            )}
        </MessageOwner>

        <ReplyMessageText fontSize="14px" lineHeight="16px">
          {!!message.parentMessage?.attachments.length &&
            message.parentMessage?.attachments[0].type ===
            attachmentTypes.voice && (
              <VoiceIconWrapper color={'#5159F6'} />
            )}
          {message.parentMessage?.state === MESSAGE_STATUS.DELETE ? (
            <MessageStatusDeleted>
              {' '}
              Message was deleted.
            </MessageStatusDeleted>
          ) : message.parentMessage?.body ? (
            MessageTextFormat({
              text: message.parentMessage?.body,
              message: message.parentMessage,
              getFromContacts: true,
              asSampleText: true
            })
          ) : (
            parentNotLinkAttachment &&
            (message.parentMessage?.attachments[0].type ===
            attachmentTypes.image
              ? 'Photo'
              : message.parentMessage?.attachments[0].type ===
              attachmentTypes.video
                ? 'Video'
                : message.parentMessage?.attachments[0].type ===
                attachmentTypes.voice
                  ? ' Voice'
                  : 'File')
          )}
        </ReplyMessageText>
      </ReplyMessageBody>
    </ReplyMessageContainer>
  )
}

export default ReplyMessage

const ReplyMessageContainer = styled.div<{
  leftBorderColor?: string;
  withAttachments?: boolean;
  withSenderName?: boolean;
  withBody?: boolean;
  backgroundColor?: string;
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
  background-color: ${(props) => props.backgroundColor || '#E3E7FF'};
  border-radius: 0 4px 4px 0;
  margin-top: ${(props) =>
    !props.withSenderName && props.withAttachments && '8px'};
  cursor: pointer;
`
const ReplyMessageBody = styled.div<{ rtlDirection?: boolean }>`
  margin-top: auto;
  margin-bottom: auto;
  direction: ${(props) => (props.rtlDirection ? 'initial' : '')};
  max-width: 100%;
`

const MessageOwner = styled.h3<{
  color?: string
  rtlDirection?: boolean
  fontSize?: string
  clickable?: boolean
}>`
  margin: 0 12px 4px 0;
  white-space: nowrap;
  color: #5159F6;
  margin-left: ${(props) => props.rtlDirection && 'auto'};
  font-weight: 500;
  font-size: ${(props) => props.fontSize || '15px'};
  line-height: ${(props) => props.fontSize || '18px'};
  cursor: ${(props) => props.clickable && 'pointer'};
  overflow: hidden;
  text-overflow: ellipsis;
`

export const ReplyMessageText = styled.span<{
  withAttachment?: boolean;
  fontSize?: string;
  lineHeight?: string;
  showMessageSenderName?: boolean;
}>`
  display: -webkit-box;
  position: relative;
  margin: 0;
  padding: ${(props) =>
  props.withAttachment && props.showMessageSenderName
    ? '0 12px 10px'
    : props.withAttachment
      ? '8px 12px 10px'
      : ''};
  font-size: ${(props) => props.fontSize || '15px'};
  font-weight: 400;
  line-height: ${(props) => props.lineHeight || '20px'};
  letter-spacing: -0.2px;
  color: ${'#17191C'};
  user-select: text;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;

  & a {
    color: ${'#438CED'};
  }
`
const VoiceIconWrapper = styled(VoiceIcon)`
  transform: translate(0px, 3.5px);
  color: ${(props) => props.color || '#5159F6'};
`

const MessageStatusDeleted = styled.span<{
  color?: string;
  fontSize?: string;
  withAttachment?: boolean;
}>`
  color: ${(props) => props.color || '#707388'};
  font-size: ${(props) => props.fontSize};
  font-style: italic;
`
