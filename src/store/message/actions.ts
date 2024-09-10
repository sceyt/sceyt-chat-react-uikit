import {
  ADD_ATTACHMENTS,
  ADD_MESSAGE,
  DELETE_MESSAGE,
  ADD_MESSAGES,
  ADD_REACTION,
  ADD_REACTION_TO_MESSAGE,
  CLEAR_MESSAGES,
  DELETE_REACTION,
  DELETE_REACTION_FROM_MESSAGE,
  EDIT_MESSAGE,
  EMPTY_CHANNEL_ATTACHMENTS,
  GET_MESSAGES,
  GET_MESSAGES_ATTACHMENTS,
  LOAD_MORE_MESSAGES,
  LOAD_MORE_MESSAGES_ATTACHMENTS,
  SEND_MESSAGE,
  SET_ATTACHMENTS,
  SET_ATTACHMENTS_COMPLETE,
  SET_MESSAGES,
  SET_MESSAGES_LOADING_STATE,
  UPDATE_MESSAGE,
  UPDATE_MESSAGES_STATUS,
  UPLOAD_ATTACHMENT_COMPILATION,
  SET_MESSAGE_TO_EDIT,
  SET_SCROLL_TO_NEW_MESSAGE,
  SET_SHOW_SCROLL_TO_NEW_MESSAGE_BUTTON,
  SET_SEND_MESSAGE_INPUT_HEIGHT,
  RESEND_MESSAGE,
  SET_MESSAGE_FOR_REPLY,
  SEND_TEXT_MESSAGE,
  SET_MESSAGES_HAS_NEXT,
  SET_HAS_PREV_MESSAGES,
  SET_SCROLL_TO_MESSAGE,
  PAUSE_ATTACHMENT_UPLOADING,
  RESUME_ATTACHMENT_UPLOADING,
  SET_ATTACHMENTS_FOR_POPUP,
  SET_ATTACHMENTS_COMPLETE_FOR_POPUP,
  ADD_ATTACHMENTS_FOR_POPUP,
  DELETE_MESSAGE_FROM_LIST,
  FORWARD_MESSAGE,
  GET_REACTIONS,
  LOAD_MORE_REACTIONS,
  SET_REACTIONS_LIST,
  ADD_REACTIONS_TO_LIST,
  SET_REACTIONS_LOADING_STATE,
  DELETE_REACTION_FROM_LIST,
  ADD_REACTION_TO_LIST,
  SET_MESSAGE_MENU_OPENED,
  UPDATE_UPLOAD_PROGRESS,
  REMOVE_UPLOAD_PROGRESS,
  SET_PLAYING_AUDIO_ID,
  ADD_SELECTED_MESSAGE,
  REMOVE_SELECTED_MESSAGE,
  CLEAR_SELECTED_MESSAGES,
  REMOVE_ATTACHMENT,
  ADD_PENDING_MESSAGE
} from './constants'
import { IAttachment, IChannel, IMessage, IReaction } from '../../types'

export function sendMessageAC(
  message: any,
  channelId: string,
  connectionState: string,
  sendAttachmentsAsSeparateMessage?: boolean,
  isResend?: boolean
) {
  return {
    type: SEND_MESSAGE,
    payload: { message, channelId, connectionState, sendAttachmentsAsSeparateMessage, isResend }
  }
}

export function sendTextMessageAC(message: any, channelId: string, connectionState: string) {
  return {
    type: SEND_TEXT_MESSAGE,
    payload: { message, channelId, connectionState }
  }
}

export function resendMessageAC(message: any, channelId: string, connectionState: string) {
  return {
    type: RESEND_MESSAGE,
    payload: { channelId, message, connectionState }
  }
}

export function forwardMessageAC(message: any, channelId: string, connectionState: string) {
  return {
    type: FORWARD_MESSAGE,
    payload: { message, channelId, connectionState }
  }
}

export function deleteMessageAC(channelId: string, messageId: string, deleteOption: 'forMe' | 'forEveryone') {
  return {
    type: DELETE_MESSAGE,
    payload: { channelId, messageId, deleteOption }
  }
}

export function deleteMessageFromListAC(messageId: string) {
  return {
    type: DELETE_MESSAGE_FROM_LIST,
    payload: { messageId }
  }
}

export function editMessageAC(channelId: string, message: IMessage) {
  return {
    type: EDIT_MESSAGE,
    payload: { channelId, message }
  }
}

export function setMessageToEditAC(message: IMessage | null) {
  return {
    type: SET_MESSAGE_TO_EDIT,
    payload: { message }
  }
}

export function getMessagesAC(channel: IChannel, loadWithLastMessage?: boolean, messageId?: string, limit?: number) {
  return {
    type: GET_MESSAGES,
    payload: { channel, loadWithLastMessage, messageId, limit }
  }
}

export function setScrollToMessagesAC(messageId: string | null) {
  return {
    type: SET_SCROLL_TO_MESSAGE,
    payload: { messageId }
  }
}

export function setMessagesLoadingStateAC(state: number) {
  return {
    type: SET_MESSAGES_LOADING_STATE,
    payload: { state }
  }
}

export function addMessagesAC(messages: any, direction: string) {
  return {
    type: ADD_MESSAGES,
    payload: { messages, direction }
  }
}

export function setMessagesAC(messages: any) {
  return {
    type: SET_MESSAGES,
    payload: { messages }
  }
}

export function addReactionAC(
  channelId: string,
  messageId: string,
  key: string,
  score: number,
  reason: string,
  enforceUnique: boolean
) {
  return {
    type: ADD_REACTION,
    payload: {
      channelId,
      messageId,
      key,
      score,
      reason,
      enforceUnique
    }
  }
}

export function deleteReactionAC(channelId: string, messageId: string, key: string, isLastReaction?: boolean) {
  return {
    type: DELETE_REACTION,
    payload: {
      channelId,
      messageId,
      key,
      isLastReaction
    }
  }
}

export function addReactionToMessageAC(message: IMessage, reaction: IReaction, isSelf: boolean) {
  return {
    type: ADD_REACTION_TO_MESSAGE,
    payload: { message, reaction, isSelf }
  }
}

export function deleteReactionFromMessageAC(message: IMessage, reaction: IReaction, isSelf: boolean) {
  return {
    type: DELETE_REACTION_FROM_MESSAGE,
    payload: { message, reaction, isSelf }
  }
}

export function getReactionsAC(messageId: string, key?: string, limit?: number) {
  return {
    type: GET_REACTIONS,
    payload: { messageId, key, limit }
  }
}

export function loadMoreReactionsAC(limit: number) {
  return {
    type: LOAD_MORE_REACTIONS,
    payload: { limit }
  }
}

export function setReactionsListAC(reactions: IReaction[], hasNext: boolean) {
  return {
    type: SET_REACTIONS_LIST,
    payload: { reactions, hasNext }
  }
}

export function addReactionsToListAC(reactions: IReaction[], hasNext: boolean) {
  return {
    type: ADD_REACTIONS_TO_LIST,
    payload: { reactions, hasNext }
  }
}

export function addReactionToListAC(reaction: IReaction) {
  return {
    type: ADD_REACTION_TO_LIST,
    payload: { reaction }
  }
}
export function deleteReactionFromListAC(reaction: IReaction) {
  return {
    type: DELETE_REACTION_FROM_LIST,
    payload: { reaction }
  }
}

export function setReactionsLoadingStateAC(state: number) {
  return {
    type: SET_REACTIONS_LOADING_STATE,
    payload: { state }
  }
}

export function updateAttachmentUploadingStateAC(attachmentUploadingState: string, attachmentId?: any) {
  return {
    type: UPLOAD_ATTACHMENT_COMPILATION,
    payload: {
      attachmentUploadingState,
      attachmentId
    }
  }
}

export function updateAttachmentUploadingProgressAC(uploaded: number, total: number, attachmentId: any) {
  return {
    type: UPDATE_UPLOAD_PROGRESS,
    payload: {
      uploaded,
      total,
      attachmentId
    }
  }
}

export function removeAttachmentProgressAC(attachmentId: any) {
  return {
    type: REMOVE_UPLOAD_PROGRESS,
    payload: {
      attachmentId
    }
  }
}

export function emptyChannelAttachmentsAC() {
  return {
    type: EMPTY_CHANNEL_ATTACHMENTS
  }
}

export function addMessageAC(message: IMessage) {
  return {
    type: ADD_MESSAGE,
    payload: { message }
  }
}

export function addPendingMessageAC(pendingMessage: IMessage, channel: IChannel) {
  return {
    type: ADD_PENDING_MESSAGE,
    payload: { pendingMessage, channel }
  }
}

export function scrollToNewMessageAC(
  scrollToBottom: boolean,
  updateMessageList?: boolean,
  isIncomingMessage?: boolean
) {
  return {
    type: SET_SCROLL_TO_NEW_MESSAGE,
    payload: { scrollToBottom, updateMessageList, isIncomingMessage }
  }
}

export function showScrollToNewMessageButtonAC(state: boolean) {
  return {
    type: SET_SHOW_SCROLL_TO_NEW_MESSAGE_BUTTON,
    payload: { state }
  }
}

export function loadMoreMessagesAC(
  channelId: string,
  limit: number,
  direction: string,
  messageId: string,
  hasNext: boolean
) {
  return {
    type: LOAD_MORE_MESSAGES,
    payload: { limit, direction, channelId, messageId, hasNext }
  }
}

export function setMessagesHasPrevAC(hasPrev: boolean) {
  return {
    type: SET_HAS_PREV_MESSAGES,
    payload: { hasPrev }
  }
}

export function setMessagesHasNextAC(hasNext: boolean) {
  return {
    type: SET_MESSAGES_HAS_NEXT,
    payload: { hasNext }
  }
}

export function updateMessageAC(messageId: string, params: any, addIfNotExists?: boolean) {
  return {
    type: UPDATE_MESSAGE,
    payload: { messageId, params, addIfNotExists }
  }
}

export function updateMessagesStatusAC(name: string, markersMap: { [key: string]: boolean }) {
  return {
    type: UPDATE_MESSAGES_STATUS,
    payload: {
      name,
      markersMap
    }
  }
}

export function clearMessagesAC() {
  return {
    type: CLEAR_MESSAGES
  }
}

export function getAttachmentsAC(
  channelId: string,
  attachmentType: string,
  limit?: number,
  direction?: string,
  attachmentId?: string,
  forPopup?: boolean
) {
  return {
    type: GET_MESSAGES_ATTACHMENTS,
    payload: { channelId, attachmentType, limit, direction, forPopup, attachmentId }
  }
}

export function setAttachmentsAC(attachments: IAttachment[]) {
  return {
    type: SET_ATTACHMENTS,
    payload: { attachments }
  }
}

export function removeAttachmentAC(attachmentId: string) {
  return {
    type: REMOVE_ATTACHMENT,
    payload: { attachmentId }
  }
}

export function setAttachmentsForPopupAC(attachments: IAttachment[]) {
  return {
    type: SET_ATTACHMENTS_FOR_POPUP,
    payload: { attachments }
  }
}

export function loadMoreAttachmentsAC(limit: number) {
  return {
    type: LOAD_MORE_MESSAGES_ATTACHMENTS,
    payload: { limit }
  }
}

export function addAttachmentsAC(attachments: IAttachment[]) {
  return {
    type: ADD_ATTACHMENTS,
    payload: { attachments }
  }
}

export function addAttachmentsForPopupAC(attachments: IAttachment[], direction: string) {
  return {
    type: ADD_ATTACHMENTS_FOR_POPUP,
    payload: { attachments, direction }
  }
}

export function setAttachmentsCompleteAC(hasPrev: boolean) {
  return {
    type: SET_ATTACHMENTS_COMPLETE,
    payload: { hasPrev }
  }
}

export function setAttachmentsCompleteForPopupAC(hasPrev: boolean) {
  return {
    type: SET_ATTACHMENTS_COMPLETE_FOR_POPUP,
    payload: { hasPrev }
  }
}

export function pauseAttachmentUploadingAC(attachmentId: string) {
  return {
    type: PAUSE_ATTACHMENT_UPLOADING,
    payload: { attachmentId }
  }
}

export function resumeAttachmentUploadingAC(attachmentId: string) {
  return {
    type: RESUME_ATTACHMENT_UPLOADING,
    payload: { attachmentId }
  }
}

export function setSendMessageInputHeightAC(height: number) {
  return {
    type: SET_SEND_MESSAGE_INPUT_HEIGHT,
    payload: { height }
  }
}

export function setMessageMenuOpenedAC(messageId: string) {
  return {
    type: SET_MESSAGE_MENU_OPENED,
    payload: { messageId }
  }
}

export function setMessageForReplyAC(message: IMessage | null) {
  return {
    type: SET_MESSAGE_FOR_REPLY,
    payload: { message }
  }
}

export function setPlayingAudioIdAC(id: string | null) {
  return {
    type: SET_PLAYING_AUDIO_ID,
    payload: { id }
  }
}

export function addSelectedMessageAC(message: IMessage) {
  return {
    type: ADD_SELECTED_MESSAGE,
    payload: { message }
  }
}

export function removeSelectedMessageAC(messageId: string) {
  return {
    type: REMOVE_SELECTED_MESSAGE,
    payload: { messageId }
  }
}

export function clearSelectedMessagesAC() {
  return {
    type: CLEAR_SELECTED_MESSAGES
  }
}
