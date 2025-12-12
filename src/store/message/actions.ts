import {
  ADD_REACTION,
  DELETE_MESSAGE,
  DELETE_REACTION,
  EDIT_MESSAGE,
  FORWARD_MESSAGE,
  GET_MESSAGE,
  GET_MESSAGES,
  GET_MESSAGES_ATTACHMENTS,
  GET_REACTIONS,
  LOAD_MORE_MESSAGES,
  LOAD_MORE_MESSAGES_ATTACHMENTS,
  LOAD_MORE_REACTIONS,
  PAUSE_ATTACHMENT_UPLOADING,
  RESEND_MESSAGE,
  RESUME_ATTACHMENT_UPLOADING,
  SEND_MESSAGE,
  SEND_TEXT_MESSAGE,
  GET_MESSAGE_MARKERS,
  DELETE_POLL_VOTE,
  CLOSE_POLL,
  ADD_POLL_VOTE,
  RETRACT_POLL_VOTE,
  GET_POLL_VOTES,
  LOAD_MORE_POLL_VOTES,
  RESEND_PENDING_POLL_ACTIONS
} from './constants'
import { IAttachment, IChannel, IMarker, IMessage, IOGMetadata, IPollVote, IReaction } from '../../types'
import {
  addMessage,
  deleteMessageFromList,
  setScrollToMessage,
  setScrollToMentionedMessage,
  setScrollToNewMessage,
  setShowScrollToNewMessageButton,
  setUnreadScrollTo,
  setMessages,
  addMessages,
  updateMessagesStatus,
  updateMessage,
  addReactionToMessage,
  deleteReactionFromMessage,
  setHasPrevMessages,
  setMessagesHasNext,
  clearMessages,
  emptyChannelAttachments,
  setAttachments,
  removeAttachment,
  setAttachmentsForPopup,
  addAttachments,
  addAttachmentsForPopup,
  setAttachmentsComplete,
  setAttachmentsCompleteForPopup,
  updateUploadProgress,
  removeUploadProgress,
  setMessageToEdit,
  setMessagesLoadingState,
  setSendMessageInputHeight,
  setMessageForReply,
  uploadAttachmentCompilation,
  setReactionsList,
  addReactionsToList,
  addReactionToList,
  deleteReactionFromList,
  setReactionsLoadingState,
  setMessageMenuOpened,
  setPlayingAudioId,
  addSelectedMessage,
  removeSelectedMessage,
  clearSelectedMessages,
  updateMessageAttachment,
  setOGMetadata,
  updateOGMetadata,
  setMessageMarkers,
  setMessagesMarkersLoadingState,
  updateMessagesMarkers,
  setPollVotesList,
  addPollVotesToList,
  setPollVotesLoadingState,
  deletePollVotesFromList,
  setPollVotesInitialCount,
  removePendingPollAction,
  setPendingPollActionsMap,
  setPendingMessage,
  removePendingMessage,
  updatePendingMessage,
  clearPendingMessagesMap,
  updatePendingPollAction
} from './reducers'
import { PendingPollAction } from 'helpers/messagesHalper'

export function sendMessageAC(
  message: any,
  channelId: string,
  connectionState: string,
  sendAttachmentsAsSeparateMessage?: boolean,
  isResend?: boolean
) {
  return {
    type: SEND_MESSAGE,
    payload: {
      message,
      channelId,
      connectionState,
      sendAttachmentsAsSeparateMessage,
      isResend
    }
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

export function forwardMessageAC(message: any, channelId: string, connectionState: string, isForward: boolean = true) {
  return {
    type: FORWARD_MESSAGE,
    payload: { message, channelId, connectionState, isForward }
  }
}

export function deleteMessageAC(channelId: string, messageId: string, deleteOption: 'forMe' | 'forEveryone') {
  return {
    type: DELETE_MESSAGE,
    payload: { channelId, messageId, deleteOption }
  }
}

export function deleteMessageFromListAC(messageId: string) {
  return deleteMessageFromList({ messageId })
}

export function editMessageAC(channelId: string, message: IMessage) {
  return {
    type: EDIT_MESSAGE,
    payload: { channelId, message }
  }
}

export function setMessageToEditAC(message: IMessage | null) {
  return setMessageToEdit({ message })
}

export function getMessagesAC(
  channel: IChannel,
  loadWithLastMessage?: boolean,
  messageId?: string,
  limit?: number,
  highlight = true,
  behavior?: 'smooth' | 'instant' | 'auto',
  scrollToMessage: boolean = true,
  networkChanged: boolean = false
) {
  return {
    type: GET_MESSAGES,
    payload: {
      channel,
      loadWithLastMessage,
      messageId,
      limit,
      highlight,
      behavior,
      scrollToMessage,
      networkChanged
    }
  }
}

export function getMessageAC(channelId: string, messageId?: string, limit?: number) {
  return {
    type: GET_MESSAGE,
    payload: { channelId, messageId, limit }
  }
}

export function setScrollToMessagesAC(
  messageId: string | null,
  highlight = true,
  behavior?: 'smooth' | 'instant' | 'auto'
) {
  return setScrollToMessage({ messageId: messageId || '', highlight, behavior })
}

export function setScrollToMentionedMessageAC(isScrollToMentionedMessage: boolean | null) {
  return setScrollToMentionedMessage({ isScrollToMentionedMessage: !!isScrollToMentionedMessage })
}

export function setMessagesLoadingStateAC(state: number) {
  return setMessagesLoadingState({ state })
}

export function addMessagesAC(messages: any, direction: string) {
  return addMessages({ messages, direction })
}

export function setMessagesAC(messages: any) {
  return setMessages({ messages })
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
  return addReactionToMessage({ message, reaction, isSelf })
}

export function deleteReactionFromMessageAC(message: IMessage, reaction: IReaction, isSelf: boolean) {
  return deleteReactionFromMessage({ message, reaction, isSelf })
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
  return setReactionsList({ reactions, hasNext })
}

export function addReactionsToListAC(reactions: IReaction[], hasNext: boolean) {
  return addReactionsToList({ reactions, hasNext })
}

export function addReactionToListAC(reaction: IReaction) {
  return addReactionToList({ reaction })
}
export function deleteReactionFromListAC(reaction: IReaction) {
  return deleteReactionFromList({ reaction })
}

export function setReactionsLoadingStateAC(state: number) {
  return setReactionsLoadingState({ state })
}

export function updateAttachmentUploadingStateAC(attachmentUploadingState: string, attachmentId?: any) {
  return uploadAttachmentCompilation({ attachmentUploadingState, attachmentId })
}

export function updateAttachmentUploadingProgressAC(uploaded: number, total: number, attachmentId: any) {
  return updateUploadProgress({ uploaded, total, attachmentId })
}

export function removeAttachmentProgressAC(attachmentId: any) {
  return removeUploadProgress({ attachmentId })
}

export function emptyChannelAttachmentsAC() {
  return emptyChannelAttachments()
}

export function addMessageAC(message: IMessage) {
  return addMessage({ message })
}

export function scrollToNewMessageAC(
  scrollToBottom: boolean,
  updateMessageList?: boolean,
  isIncomingMessage?: boolean
) {
  return setScrollToNewMessage({
    scrollToBottom,
    updateMessageList: !!updateMessageList,
    isIncomingMessage: !!isIncomingMessage
  })
}

export function showScrollToNewMessageButtonAC(state: boolean) {
  return setShowScrollToNewMessageButton({ state })
}

export function setUnreadScrollToAC(state: boolean) {
  return setUnreadScrollTo({ state })
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
  return setHasPrevMessages({ hasPrev })
}

export function setMessagesHasNextAC(hasNext: boolean) {
  return setMessagesHasNext({ hasNext })
}

export function setOGMetadataAC(url: string, metadata: IOGMetadata | null) {
  return setOGMetadata({ url, metadata })
}

export function updateOGMetadataAC(url: string, metadata: IOGMetadata | null) {
  return updateOGMetadata({ url, metadata })
}

export function setUpdateMessageAttachmentAC(url: string, attachmentUrl: string) {
  return updateMessageAttachment({ url, attachmentUrl })
}

export function updateMessageAC(
  messageId: string,
  params: any,
  addIfNotExists?: boolean,
  voteDetails?: {
    type: 'add' | 'delete' | 'addOwn' | 'deleteOwn' | 'close'
    vote?: IPollVote
    incrementVotesPerOptionCount: number
  }
) {
  return updateMessage({ messageId, params, addIfNotExists, voteDetails })
}

export function updateMessagesStatusAC(name: string, markersMap: { [key: string]: IMarker }) {
  return updateMessagesStatus({ name, markersMap })
}

export function clearMessagesAC() {
  return clearMessages()
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
  return setAttachments({ attachments })
}

export function removeAttachmentAC(attachmentId: string) {
  return removeAttachment({ attachmentId })
}

export function setAttachmentsForPopupAC(attachments: IAttachment[]) {
  return setAttachmentsForPopup({ attachments })
}

export function loadMoreAttachmentsAC(limit: number) {
  return {
    type: LOAD_MORE_MESSAGES_ATTACHMENTS,
    payload: { limit }
  }
}

export function addAttachmentsAC(attachments: IAttachment[]) {
  return addAttachments({ attachments })
}

export function addAttachmentsForPopupAC(attachments: IAttachment[], direction: string) {
  return addAttachmentsForPopup({ attachments, direction })
}

export function setAttachmentsCompleteAC(hasPrev: boolean) {
  return setAttachmentsComplete({ hasPrev })
}

export function setAttachmentsCompleteForPopupAC(hasPrev: boolean) {
  return setAttachmentsCompleteForPopup({ hasPrev })
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
  return setSendMessageInputHeight({ height })
}

export function setMessageMenuOpenedAC(messageId: string) {
  return setMessageMenuOpened({ messageId })
}

export function setMessageForReplyAC(message: IMessage | null) {
  return setMessageForReply({ message })
}

export function setPlayingAudioIdAC(id: string | null) {
  return setPlayingAudioId({ id })
}

export function addSelectedMessageAC(message: IMessage) {
  return addSelectedMessage({ message })
}

export function removeSelectedMessageAC(messageId: string) {
  return removeSelectedMessage({ messageId })
}

export function clearSelectedMessagesAC() {
  return clearSelectedMessages()
}

export function getMessageMarkersAC(messageId: string, channelId: string, deliveryStatus: string) {
  return {
    type: GET_MESSAGE_MARKERS,
    payload: { messageId, channelId, deliveryStatus }
  }
}

export function setMessageMarkersAC(
  channelId: string,
  messageId: string,
  messageMarkers: IMarker[],
  deliveryStatus: string
) {
  return setMessageMarkers({ channelId, messageId, messageMarkers, deliveryStatus })
}

export function updateMessagesMarkersAC(channelId: string, deliveryStatus: string, marker: IMarker) {
  return updateMessagesMarkers({ channelId, deliveryStatus, marker })
}

export function setMessagesMarkersLoadingStateAC(state: number) {
  return setMessagesMarkersLoadingState({ state })
}

export function addPollVoteAC(
  channelId: string,
  pollId: string,
  optionId: string,
  message: IMessage,
  isResend?: boolean
) {
  return {
    type: ADD_POLL_VOTE,
    payload: { channelId, pollId, optionId, message, isResend }
  }
}

export function deletePollVoteAC(
  channelId: string,
  pollId: string,
  optionId: string,
  message: IMessage,
  isResend?: boolean
) {
  return {
    type: DELETE_POLL_VOTE,
    payload: { channelId, pollId, optionId, message, isResend }
  }
}

export function closePollAC(channelId: string, pollId: string, message: IMessage) {
  return {
    type: CLOSE_POLL,
    payload: { channelId, pollId, message }
  }
}

export function retractPollVoteAC(channelId: string, pollId: string, message: IMessage, isResend?: boolean) {
  return {
    type: RETRACT_POLL_VOTE,
    payload: { channelId, pollId, message, isResend }
  }
}

export function resendPendingPollActionsAC(connectionState: string) {
  return {
    type: RESEND_PENDING_POLL_ACTIONS,
    payload: { connectionState }
  }
}

export function getPollVotesAC(messageId: string | number, pollId: string, optionId: string, limit?: number) {
  return {
    type: GET_POLL_VOTES,
    payload: { messageId, pollId, optionId, limit }
  }
}

export function loadMorePollVotesAC(pollId: string, optionId: string, limit?: number) {
  return {
    type: LOAD_MORE_POLL_VOTES,
    payload: { pollId, optionId, limit }
  }
}

export function setPollVotesListAC(pollId: string, optionId: string, votes: IPollVote[], hasNext: boolean) {
  return setPollVotesList({ pollId, optionId, votes, hasNext })
}

export function addPollVotesToListAC(
  pollId: string,
  optionId: string,
  votes: IPollVote[],
  hasNext: boolean,
  previousVotes?: IPollVote[]
) {
  return addPollVotesToList({ pollId, optionId, votes, hasNext, previousVotes })
}

export function deletePollVotesFromListAC(pollId: string, optionId: string, votes: IPollVote[], messageId: string) {
  return deletePollVotesFromList({ pollId, optionId, votes, messageId })
}

export function setPollVotesLoadingStateAC(pollId: string, optionId: string, loadingState: number | null) {
  return setPollVotesLoadingState({ pollId, optionId, loadingState })
}

export function setPollVotesInitialCountAC(initialCount: number) {
  return setPollVotesInitialCount({ initialCount })
}

export function removePendingPollActionAC(messageId: string, actionType: string, optionId?: string) {
  return removePendingPollAction({ messageId, actionType, optionId })
}

export function setPendingPollActionsMapAC(messageId: string, event: PendingPollAction) {
  return setPendingPollActionsMap({ messageId, event })
}

export function updatePendingPollActionAC(messageId: string, message: IMessage) {
  return updatePendingPollAction({ messageId, message })
}

export function setPendingMessageAC(channelId: string, message: IMessage) {
  return setPendingMessage({ channelId, message })
}

export function removePendingMessageAC(channelId: string, messageId: string) {
  return removePendingMessage({ channelId, messageId })
}

export function updatePendingMessageAC(channelId: string, messageId: string, updatedMessage: Partial<IMessage>) {
  return updatePendingMessage({ channelId, messageId, updatedMessage })
}

export function clearPendingMessagesMapAC() {
  return clearPendingMessagesMap()
}
