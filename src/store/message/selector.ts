import { IMessage } from 'types'
import { IMessageStore } from './reducers'

export const activeChannelMessagesSelector = (store: { MessageReducer: IMessageStore }): IMessage[] =>
  store.MessageReducer.activeChannelMessages
export const threadReplyMessagesSelector = (store: any) => store.MessageReducer.threadReplyMessages
export const messagesLoadingState = (store: any) => store.MessageReducer.messagesLoadingState

export const messagesHasNextSelector = (store: any) => store.MessageReducer.messagesHasNext
export const messagesHasPrevSelector = (store: any) => store.MessageReducer.messagesHasPrev
export const threadMessagesHasNextSelector = (store: any) => store.MessageReducer.threadMessagesHasNext
export const threadMessagesHasPrevSelector = (store: any) => store.MessageReducer.threadMessagesHasPrev
export const attachmentCompilationStateSelector = (store: any) => store.MessageReducer.attachmentsUploadingState
export const attachmentsUploadProgressSelector = (store: any) => store.MessageReducer.attachmentsUploadingProgress
export const activeTabAttachmentsSelector = (store: any) => store.MessageReducer.activeTabAttachments
export const activeTabAttachmentsHasNextSelector = (store: any) => store.MessageReducer.attachmentHasNext
export const attachmentsForPopupSelector = (store: any) => store.MessageReducer.attachmentsForPopup
export const attachmentsForPopupHasNextSelector = (store: any) => store.MessageReducer.attachmentForPopupHasNext
export const messageForReplySelector = (store: any) => store.MessageReducer.messageForReply
export const messageForThreadReplySelector = (store: any) => store.MessageReducer.messageForThreadReply
export const messageToEditSelector = (store: any) => store.MessageReducer.messageToEdit
export const pendingMessagesSelector = (store: any) => store.MessageReducer.pendingMessages
export const channelNewMessageSelector = (store: any) => store.MessageReducer.activeChannelNewMessage
export const messageUpdatedSelector = (store: any) => store.MessageReducer.activeChannelMessageUpdated
export const scrollToNewMessageSelector = (store: any) => store.MessageReducer.scrollToNewMessage
export const scrollToMentionedMessageSelector = (store: any) => store.MessageReducer.scrollToMentionedMessage
export const showScrollToNewMessageButtonSelector = (store: any) => store.MessageReducer.showScrollToNewMessageButton
export const sendMessageInputHeightSelector = (store: any) => store.MessageReducer.sendMessageInputHeight
export const scrollToMessageSelector = (store: any) => store.MessageReducer.scrollToMessage
export const scrollToMessageHighlightSelector = (store: any) => store.MessageReducer.scrollToMessageHighlight
export const scrollToMessageBehaviorSelector = (store: any) => store.MessageReducer.scrollToMessageBehavior
export const reactionsListSelector = (store: any) => store.MessageReducer.reactionsList
export const reactionsHasNextSelector = (store: any) => store.MessageReducer.reactionsHasNext
export const reactionsLoadingStateSelector = (store: any) => store.MessageReducer.reactionsLoadingState
export const openedMessageMenuSelector = (store: any) => store.MessageReducer.openedMessageMenu
export const playingAudioIdSelector = (store: any) => store.MessageReducer.playingAudioId
export const selectedMessagesMapSelector = (store: any) => store.MessageReducer.selectedMessagesMap
export const attachmentUpdatedMapSelector = (store: any) => store.MessageReducer.attachmentUpdatedMap
export const messageMarkersSelector = (store: any) => store.MessageReducer.messageMarkers
export const messagesMarkersLoadingStateSelector = (store: any) => store.MessageReducer.messagesMarkersLoadingState
export const pollVotesListSelector = (store: any) => store.MessageReducer.pollVotesList
export const pollVotesHasMoreSelector = (store: any) => store.MessageReducer.pollVotesHasMore
export const pollVotesLoadingStateSelector = (store: any) => store.MessageReducer.pollVotesLoadingState
export const pendingPollActionsSelector = (store: any) => store.MessageReducer.pendingPollActions
export const pendingMessagesMapSelector = (store: any) => store.MessageReducer.pendingMessagesMap
export const unreadScrollToSelector = (store: any) => store.MessageReducer.unreadScrollTo
