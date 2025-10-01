import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { IMarker, IMessage, IOGMetadata, IReaction } from '../../types'
import { DESTROY_SESSION } from '../channel/constants'
import {
  MESSAGE_LOAD_DIRECTION,
  MESSAGES_MAX_LENGTH,
  removePendingMessageFromMap,
  setHasNextCached,
  setHasPrevCached
} from '../../helpers/messagesHalper'
import { MESSAGE_DELIVERY_STATUS, MESSAGE_STATUS } from '../../helpers/constants'
import log from 'loglevel'

export interface IMessageStore {
  messagesLoadingState: number | null
  messagesHasNext: boolean
  messagesHasPrev: boolean
  threadMessagesHasNext: boolean
  threadMessagesHasPrev: boolean
  activeChannelMessages: IMessage[]
  pendingMessages: { [key: string]: IMessage[] }
  activeChannelNewMessage: IMessage | null
  activeTabAttachments: any[]
  attachmentsForPopup: any[]
  attachmentHasNext: boolean
  attachmentForPopupHasNext: boolean
  messageToEdit: IMessage | null
  messageForReply?: IMessage | null
  activeChannelMessageUpdated: { messageId: string; params: IMessage } | null
  scrollToNewMessage: {
    scrollToBottom: boolean
    updateMessageList: boolean
    isIncomingMessage: boolean
  }
  showScrollToNewMessageButton: boolean
  sendMessageInputHeight: number
  attachmentsUploadingState: { [key: string]: any }
  scrollToMessage: string | null
  scrollToMessageHighlight: boolean
  scrollToMessageBehavior: 'smooth' | 'instant' | 'auto'
  scrollToMentionedMessage: boolean | null
  reactionsList: IReaction[]
  reactionsHasNext: boolean
  reactionsLoadingState: number | null
  openedMessageMenu: string
  attachmentsUploadingProgress: {
    [key: string]: {
      uploaded: number
      total: number
      progress: number
    }
  }
  playingAudioId: string | null
  selectedMessagesMap: Map<string, IMessage> | null
  oGMetadata: { [key: string]: IOGMetadata | null }
  attachmentUpdatedMap: { [key: string]: string }
  messageMarkers: { [key: string]: { [key: string]: { [key: string]: IMarker[] } } }
  messagesMarkersLoadingState: number | null
}

const initialState: IMessageStore = {
  messagesLoadingState: null,
  messagesHasNext: false,
  messagesHasPrev: true,
  threadMessagesHasNext: false,
  threadMessagesHasPrev: true,
  activeChannelMessages: [],
  attachmentsForPopup: [],
  activeTabAttachments: [],
  attachmentHasNext: true,
  attachmentForPopupHasNext: true,
  messageToEdit: null,
  activeChannelNewMessage: null,
  pendingMessages: {},
  activeChannelMessageUpdated: null,
  scrollToNewMessage: {
    scrollToBottom: false,
    updateMessageList: false,
    isIncomingMessage: false
  },
  showScrollToNewMessageButton: false,
  sendMessageInputHeight: 0,
  messageForReply: null,
  attachmentsUploadingState: {},
  scrollToMessage: null,
  scrollToMessageHighlight: true,
  scrollToMessageBehavior: 'smooth',
  scrollToMentionedMessage: false,
  reactionsList: [],
  reactionsHasNext: true,
  reactionsLoadingState: null,
  openedMessageMenu: '',
  attachmentsUploadingProgress: {},
  playingAudioId: null,
  selectedMessagesMap: null,
  oGMetadata: {},
  attachmentUpdatedMap: {},
  messageMarkers: {},
  messagesMarkersLoadingState: null
}

const messageSlice = createSlice({
  name: 'messages',
  initialState,
  reducers: {
    addMessage: (state, action: PayloadAction<{ message: IMessage }>) => {
      const { message } = action.payload
      state.activeChannelMessages.push(message)
    },

    deleteMessageFromList: (state, action: PayloadAction<{ messageId: string }>) => {
      const { messageId } = action.payload
      state.activeChannelMessages = state.activeChannelMessages.filter(
        (msg) => !(msg.id === messageId || msg.tid === messageId)
      )
    },

    setScrollToMessage: (
      state,
      action: PayloadAction<{ messageId: string; highlight: boolean; behavior?: 'smooth' | 'instant' | 'auto' }>
    ) => {
      state.scrollToMessage = action.payload.messageId
      state.scrollToMessageHighlight = action.payload.highlight
      state.scrollToMessageBehavior = action.payload.behavior || 'smooth'
    },

    setScrollToMentionedMessage: (state, action: PayloadAction<{ isScrollToMentionedMessage: boolean }>) => {
      state.scrollToMentionedMessage = action.payload.isScrollToMentionedMessage
    },

    setScrollToNewMessage: (
      state,
      action: PayloadAction<{
        scrollToBottom: boolean
        updateMessageList: boolean
        isIncomingMessage: boolean
      }>
    ) => {
      state.scrollToNewMessage = {
        scrollToBottom: action.payload.scrollToBottom,
        updateMessageList: action.payload.updateMessageList,
        isIncomingMessage: action.payload.isIncomingMessage
      }
    },

    setShowScrollToNewMessageButton: (state, action: PayloadAction<{ state: boolean }>) => {
      state.showScrollToNewMessageButton = action.payload.state
    },

    setMessages: (state, action: PayloadAction<{ messages: IMessage[] }>) => {
      log.info('setMessages ... ', action.payload)
      state.activeChannelMessages = action.payload.messages
    },

    addMessages: (
      state,
      action: PayloadAction<{
        messages: IMessage[]
        direction: string
      }>
    ) => {
      const { messages, direction } = action.payload
      const newMessagesLength = messages.length
      const currentMessagesLength = state.activeChannelMessages.length
      const messagesIsNotIncludeInActiveChannelMessages = messages.filter(
        (message) => !state.activeChannelMessages.some((msg) => msg.tid === message.tid || msg.id === message.id)
      )

      if (direction === MESSAGE_LOAD_DIRECTION.PREV && newMessagesLength > 0) {
        if (currentMessagesLength + newMessagesLength >= MESSAGES_MAX_LENGTH) {
          setHasNextCached(true)
          if (newMessagesLength > 0) {
            if (currentMessagesLength >= MESSAGES_MAX_LENGTH) {
              state.activeChannelMessages.splice(-newMessagesLength)
            } else {
              state.activeChannelMessages.splice(-(newMessagesLength - (MESSAGES_MAX_LENGTH - currentMessagesLength)))
            }
          }
          state.activeChannelMessages.splice(0, 0, ...messagesIsNotIncludeInActiveChannelMessages)
        } else if (newMessagesLength + currentMessagesLength > MESSAGES_MAX_LENGTH) {
          const sliceElementCount = newMessagesLength + currentMessagesLength - MESSAGES_MAX_LENGTH
          setHasNextCached(true)
          state.activeChannelMessages.splice(-sliceElementCount)
          state.activeChannelMessages.splice(0, 0, ...messagesIsNotIncludeInActiveChannelMessages)
        } else {
          state.activeChannelMessages.splice(0, 0, ...messagesIsNotIncludeInActiveChannelMessages)
        }
      } else if (direction === 'next' && newMessagesLength > 0) {
        if (currentMessagesLength >= MESSAGES_MAX_LENGTH) {
          setHasPrevCached(true)
          state.activeChannelMessages.splice(0, messagesIsNotIncludeInActiveChannelMessages.length)
          state.activeChannelMessages.push(...messagesIsNotIncludeInActiveChannelMessages)
        } else if (newMessagesLength + currentMessagesLength > MESSAGES_MAX_LENGTH) {
          const sliceElementCount = newMessagesLength + currentMessagesLength - MESSAGES_MAX_LENGTH
          setHasPrevCached(true)
          state.activeChannelMessages.splice(0, sliceElementCount)
          state.activeChannelMessages.push(...messagesIsNotIncludeInActiveChannelMessages)
        } else {
          state.activeChannelMessages.push(...messagesIsNotIncludeInActiveChannelMessages)
        }
      }
    },

    updateMessagesStatus: (
      state,
      action: PayloadAction<{
        name: string
        markersMap: { [key: string]: IMarker }
      }>
    ) => {
      const { name, markersMap } = action.payload
      const markerName = name
      for (let index = 0; index < state.activeChannelMessages.length; index++) {
        if (
          markersMap[state.activeChannelMessages[index].id] &&
          (state.activeChannelMessages[index].deliveryStatus === MESSAGE_DELIVERY_STATUS.SENT ||
            markerName === MESSAGE_DELIVERY_STATUS.READ) &&
          state.activeChannelMessages[index].state !== 'Deleted'
        ) {
          state.activeChannelMessages[index].deliveryStatus = markerName
        }
      }
    },

    updateMessage: (
      state,
      action: PayloadAction<{
        messageId: string
        params: IMessage
        addIfNotExists?: boolean
      }>
    ) => {
      const { messageId, params, addIfNotExists } = action.payload
      let messageFound = false
      state.activeChannelMessages = state.activeChannelMessages.map((message) => {
        if (message.tid === messageId || message.id === messageId) {
          messageFound = true
          if (params.state === MESSAGE_STATUS.DELETE) {
            return { ...params }
          } else {
            const messageData: IMessage = { ...message, ...params }
            if (messageData.deliveryStatus !== MESSAGE_DELIVERY_STATUS.PENDING) {
              removePendingMessageFromMap(messageData.channelId, messageData.tid || messageData.id)
            }
            return messageData
          }
        }
        return message
      })

      if (!messageFound && addIfNotExists) {
        log.info('message not found on update message, add message to list .. ...', params)
        state.activeChannelMessages.push(params)
      }
    },

    updateMessageAttachment: (state, action: PayloadAction<{ url: string; attachmentUrl: string }>) => {
      const { url, attachmentUrl } = action.payload
      state.attachmentUpdatedMap[url] = attachmentUrl
    },

    addReactionToMessage: (
      state,
      action: PayloadAction<{
        message: IMessage
        reaction: IReaction
        isSelf: boolean
      }>
    ) => {
      const { message, reaction, isSelf } = action.payload
      state.activeChannelMessages = state.activeChannelMessages.map((msg) => {
        if (msg.id === message.id) {
          let slfReactions = [...msg.userReactions]
          if (isSelf) {
            if (slfReactions) {
              slfReactions.push(reaction)
            } else {
              slfReactions = [reaction]
            }
          }
          return {
            ...msg,
            userReactions: slfReactions,
            reactionTotals: message.reactionTotals
          }
        }
        return msg
      })
    },

    deleteReactionFromMessage: (
      state,
      action: PayloadAction<{
        reaction: IReaction
        message: IMessage
        isSelf: boolean
      }>
    ) => {
      const { reaction, message, isSelf } = action.payload
      state.activeChannelMessages = state.activeChannelMessages.map((msg) => {
        if (msg.id === message.id) {
          let { userReactions } = msg
          if (isSelf) {
            userReactions = msg.userReactions.filter((selfReaction: IReaction) => selfReaction.key !== reaction.key)
          }
          return {
            ...msg,
            reactionTotals: message.reactionTotals,
            userReactions
          }
        }
        return msg
      })
    },

    setHasPrevMessages: (state, action: PayloadAction<{ hasPrev: boolean }>) => {
      state.messagesHasPrev = action.payload.hasPrev
    },

    setMessagesHasNext: (state, action: PayloadAction<{ hasNext: boolean }>) => {
      state.messagesHasNext = action.payload.hasNext
    },

    clearMessages: (state) => {
      state.activeChannelMessages = []
    },

    emptyChannelAttachments: (state) => {
      state.activeTabAttachments = []
    },

    setAttachments: (state, action: PayloadAction<{ attachments: any[] }>) => {
      state.activeTabAttachments = action.payload.attachments
    },

    removeAttachment: (state, action: PayloadAction<{ attachmentId: string }>) => {
      const { attachmentId } = action.payload
      state.activeTabAttachments = state.activeTabAttachments.filter((item) => item.id !== attachmentId)
      state.attachmentsForPopup = state.attachmentsForPopup.filter((item) => item.id !== attachmentId)
    },

    setAttachmentsForPopup: (state, action: PayloadAction<{ attachments: any[] }>) => {
      state.attachmentsForPopup = action.payload.attachments
    },

    addAttachments: (state, action: PayloadAction<{ attachments: any[] }>) => {
      state.activeTabAttachments.push(...action.payload.attachments)
    },

    addAttachmentsForPopup: (
      state,
      action: PayloadAction<{
        attachments: any[]
        direction: string
      }>
    ) => {
      const { attachments, direction } = action.payload
      if (direction === 'prev') {
        state.attachmentsForPopup.push(...attachments)
      } else {
        state.attachmentsForPopup.unshift(...attachments)
      }
    },

    setAttachmentsComplete: (state, action: PayloadAction<{ hasPrev: boolean }>) => {
      state.attachmentHasNext = action.payload.hasPrev
    },

    setAttachmentsCompleteForPopup: (state, action: PayloadAction<{ hasPrev: boolean }>) => {
      state.attachmentForPopupHasNext = action.payload.hasPrev
    },

    updateUploadProgress: (
      state,
      action: PayloadAction<{
        uploaded: number
        total: number
        attachmentId: string
      }>
    ) => {
      const { uploaded, total, attachmentId } = action.payload
      const progress = uploaded / total
      const updateData = { uploaded, total, progress }
      state.attachmentsUploadingProgress[attachmentId] = {
        ...state.attachmentsUploadingProgress[attachmentId],
        ...updateData
      }
    },

    removeUploadProgress: (state, action: PayloadAction<{ attachmentId: string }>) => {
      delete state.attachmentsUploadingProgress[action.payload.attachmentId]
    },

    setMessageToEdit: (state, action: PayloadAction<{ message: IMessage | null }>) => {
      state.messageToEdit = action.payload.message
    },

    setMessagesLoadingState: (state, action: PayloadAction<{ state: number | null }>) => {
      state.messagesLoadingState = action.payload.state
    },

    setSendMessageInputHeight: (state, action: PayloadAction<{ height: number }>) => {
      state.sendMessageInputHeight = action.payload.height
    },

    setMessageForReply: (state, action: PayloadAction<{ message: IMessage | null }>) => {
      state.messageForReply = action.payload.message
    },

    uploadAttachmentCompilation: (
      state,
      action: PayloadAction<{
        attachmentUploadingState: any
        attachmentId: string
      }>
    ) => {
      const { attachmentUploadingState, attachmentId } = action.payload
      state.attachmentsUploadingState[attachmentId] = attachmentUploadingState
    },

    setReactionsList: (
      state,
      action: PayloadAction<{
        reactions: IReaction[]
        hasNext: boolean
      }>
    ) => {
      const { reactions, hasNext } = action.payload
      state.reactionsHasNext = hasNext
      state.reactionsList = [...reactions]
    },

    addReactionsToList: (
      state,
      action: PayloadAction<{
        reactions: IReaction[]
        hasNext: boolean
      }>
    ) => {
      const { reactions, hasNext } = action.payload
      state.reactionsHasNext = hasNext
      state.reactionsList.push(...reactions)
    },

    addReactionToList: (state, action: PayloadAction<{ reaction: IReaction }>) => {
      state.reactionsList.push(action.payload.reaction)
    },

    deleteReactionFromList: (state, action: PayloadAction<{ reaction: IReaction }>) => {
      const { reaction } = action.payload
      state.reactionsList = state.reactionsList.filter((item) => item.id !== reaction.id)
    },

    setReactionsLoadingState: (state, action: PayloadAction<{ state: number | null }>) => {
      state.reactionsLoadingState = action.payload.state
    },

    setMessageMenuOpened: (state, action: PayloadAction<{ messageId: string }>) => {
      state.openedMessageMenu = action.payload.messageId
    },

    setPlayingAudioId: (state, action: PayloadAction<{ id: string | null }>) => {
      state.playingAudioId = action.payload.id
    },

    addSelectedMessage: (state, action: PayloadAction<{ message: IMessage }>) => {
      if (!state.selectedMessagesMap) {
        const messagesMap = new Map()
        messagesMap.set(action.payload.message.id, action.payload.message)
        state.selectedMessagesMap = messagesMap
      } else {
        const messagesMap = new Map(state.selectedMessagesMap)
        messagesMap.set(action.payload.message.id, action.payload.message)
        state.selectedMessagesMap = messagesMap
      }
    },

    removeSelectedMessage: (state, action: PayloadAction<{ messageId: string }>) => {
      if (state.selectedMessagesMap) {
        const messagesMap = new Map(state.selectedMessagesMap)
        messagesMap.delete(action.payload.messageId)
        state.selectedMessagesMap = messagesMap
      }
    },

    clearSelectedMessages: (state) => {
      state.selectedMessagesMap = null
    },

    setOGMetadata: (state, action: PayloadAction<{ url: string; metadata: IOGMetadata | null }>) => {
      const { url, metadata } = action.payload
      state.oGMetadata[url] = metadata
    },

    updateOGMetadata: (state, action: PayloadAction<{ url: string; metadata: IOGMetadata | null }>) => {
      const { url, metadata } = action.payload
      if (metadata) {
        const existing = state.oGMetadata[url]
        state.oGMetadata[url] = existing ? { ...existing, ...metadata } : metadata
      }
    },

    setMessageMarkers: (
      state,
      action: PayloadAction<{ channelId: string; messageId: string; messageMarkers: IMarker[]; deliveryStatus: string }>
    ) => {
      const { channelId, messageId, messageMarkers, deliveryStatus } = action.payload
      if (!state.messageMarkers[channelId]) {
        state.messageMarkers[channelId] = {}
      }
      if (!state.messageMarkers[channelId][messageId]) {
        state.messageMarkers[channelId][messageId] = {}
      }
      if (!state.messageMarkers[channelId][messageId][deliveryStatus]) {
        state.messageMarkers[channelId][messageId][deliveryStatus] = [] as IMarker[]
      }
      state.messageMarkers[channelId][messageId][deliveryStatus] = [...messageMarkers]
    },

    updateMessagesMarkers: (
      state,
      action: PayloadAction<{ channelId: string; deliveryStatus: string; marker: IMarker }>
    ) => {
      const { channelId, deliveryStatus, marker } = action.payload
      const userId = marker.user?.id
      const messageIds = marker.messageIds
      for (const messageId of messageIds) {
        if (!state.messageMarkers[channelId]) {
          state.messageMarkers[channelId] = {}
        }
        if (!state.messageMarkers[channelId][messageId]) {
          state.messageMarkers[channelId][messageId] = {}
        }
        if (!state.messageMarkers[channelId][messageId][deliveryStatus]) {
          state.messageMarkers[channelId][messageId][deliveryStatus] = [] as IMarker[]
        }
        const isUserMarkered = state.messageMarkers[channelId][messageId][deliveryStatus].some(
          (marker) => marker.user?.id === userId
        )
        if (!isUserMarkered) {
          let time = marker.createdAt
          try {
            time = new Date(marker.createdAt)
            if (isNaN(time.getTime())) {
              time = new Date()
            }
          } catch (e) {
            log.error('error in update messages markers', e)
            time = new Date()
          }
          state.messageMarkers[channelId][messageId][deliveryStatus].push({ ...marker, createdAt: time })
        }
      }
    },

    setMessagesMarkersLoadingState: (state, action: PayloadAction<{ state: number }>) => {
      state.messagesMarkersLoadingState = action.payload.state
    }
  },
  extraReducers: (builder) => {
    builder.addCase(DESTROY_SESSION, () => {
      return initialState
    })
  }
})

// Export actions
export const {
  addMessage,
  deleteMessageFromList,
  setScrollToMessage,
  setScrollToMentionedMessage,
  setScrollToNewMessage,
  setShowScrollToNewMessageButton,
  setMessages,
  addMessages,
  updateMessagesStatus,
  updateMessage,
  updateMessageAttachment,
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
  setOGMetadata,
  updateOGMetadata,
  setMessageMarkers,
  setMessagesMarkersLoadingState,
  updateMessagesMarkers
} = messageSlice.actions

// Export reducer
export default messageSlice.reducer
