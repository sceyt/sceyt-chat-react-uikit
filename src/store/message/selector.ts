import { IMessageStore } from './reducers'

export const activeChannelMessagesSelector = (store: { MessageReducer: IMessageStore }) =>
  store.MessageReducer.activeChannelMessages
export const threadReplyMessagesSelector = (store: any) => store.MessageReducer.threadReplyMessages
export const messagesLoadingState = (store: any) => store.MessageReducer.messagesLoadingState

export const messagesHasNextSelector = (store: any) => store.MessageReducer.messagesHasNext
export const messagesHasPrevSelector = (store: any) => store.MessageReducer.messagesHasPrev
export const threadMessagesHasNextSelector = (store: any) => store.MessageReducer.threadMessagesHasNext
export const threadMessagesHasPrevSelector = (store: any) => store.MessageReducer.threadMessagesHasPrev
export const attachmentCompilationStateSelector = (store: any) => store.MessageReducer.attachmentsUploadingState
export const attachmentUploadProgressSelector = (store: any) => store.MessageReducer.uploadAttachmentProgress
export const activeTabAttachmentsSelector = (store: any) => store.MessageReducer.activeTabAttachments
export const activeTabAttachmentsHasNextSelector = (store: any) => store.MessageReducer.attachmentHasNext
export const attachmentsForPopupSelector = (store: any) => store.MessageReducer.attachmentsForPopup
export const attachmentsForPopupHasNextSelector = (store: any) => store.MessageReducer.attachmentForPopupHasNext
export const messageForReplySelector = (store: any) => store.MessageReducer.messageForReply
export const messageForThreadReplySelector = (store: any) => store.MessageReducer.messageForThreadReply
export const messageToEditSelector = (store: any) => store.MessageReducer.messageToEdit
export const pendingMessagesSelector = (store: any) => store.MessageReducer.pendingMessages
export const channelNewMessageSelector = (store: any) => store.MessageReducer.activeChannelNewMessage
export const messageNewMarkersSelector = (store: any) => store.MessageReducer.activeChannelNewMarkers
export const messageUpdatedSelector = (store: any) => store.MessageReducer.activeChannelMessageUpdated
export const scrollToNewMessageSelector = (store: any) => store.MessageReducer.scrollToNewMessage
export const showScrollToNewMessageButtonSelector = (store: any) => store.MessageReducer.showScrollToNewMessageButton
export const sendMessageInputHeightSelector = (store: any) => store.MessageReducer.sendMessageInputHeight
export const scrollToMessageSelector = (store: any) => store.MessageReducer.scrollToMessage
