import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { IMarker, IMessage, IOGMetadata, IPollVote, IReaction } from '../../types'
import { DESTROY_SESSION } from '../channel/constants'
import {
  comparePendingMessages,
  compareMessagesForList,
  MESSAGE_LOAD_DIRECTION,
  MESSAGES_MAX_PAGE_COUNT,
  PendingPollAction,
  updateMessageDeliveryStatusAndMarkers
} from '../../helpers/messagesHalper'
import { MESSAGE_STATUS } from '../../helpers/constants'
import log from 'loglevel'
import { handleVoteDetails } from '../../helpers/message'
import store from 'store'
import { getPollVotesAC } from './actions'

export type PendingMessageMutation =
  | {
      type: 'EDIT_MESSAGE'
      channelId: string
      messageId: string
      message: IMessage
      originalMessage: IMessage
      queuedAt: number
    }
  | {
      type: 'DELETE_MESSAGE'
      channelId: string
      messageId: string
      deleteOption: 'forMe' | 'forEveryone'
      originalMessage: IMessage
      queuedAt: number
    }
export interface IMessageStore {
  loadingPrevMessagesState: number | null
  loadingNextMessagesState: number | null
  activePaginationIntent: {
    channelId: string
    direction: 'prev' | 'next'
    requestId: string
    anchorId: string
  } | null
  messagesHasNext: boolean
  messagesHasPrev: boolean
  threadMessagesHasNext: boolean
  threadMessagesHasPrev: boolean
  activeChannelMessages: IMessage[]
  activeChannelNewMessage: IMessage | null
  activeTabAttachments: any[]
  attachmentsForPopup: any[]
  attachmentHasNext: boolean
  attachmentForPopupHasPrev: boolean
  attachmentForPopupHasNext: boolean
  attachmentLoadingState: number | null
  attachmentForPopupLoadingState: number | null
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
  oGMetadata: { [key: string]: IOGMetadata | null } | null
  attachmentUpdatedMap: { [key: string]: string }
  messageMarkers: { [key: string]: { [key: string]: { [key: string]: IMarker[] } } }
  messagesMarkersLoadingState: number | null
  pollVotesList: { [key: string]: IPollVote[] } // key format: pollId_optionId
  pollVotesHasMore: { [key: string]: boolean }
  pollVotesLoadingState: { [key: string]: number | null }
  pollVotesInitialCount: number | null
  pendingPollActions: { [key: string]: PendingPollAction[] }
  pendingMessageMutations: { [key: string]: PendingMessageMutation }
  unreadScrollTo: boolean
  unreadMessageId: string
  stableUnreadAnchor: {
    channelId: string
    messageId: string
  }
}

const initialState: IMessageStore = {
  loadingPrevMessagesState: null,
  loadingNextMessagesState: null,
  activePaginationIntent: null,
  messagesHasNext: false,
  messagesHasPrev: true,
  threadMessagesHasNext: false,
  threadMessagesHasPrev: true,
  activeChannelMessages: [],
  attachmentsForPopup: [],
  activeTabAttachments: [],
  attachmentHasNext: true,
  attachmentForPopupHasNext: true,
  attachmentForPopupHasPrev: true,
  attachmentLoadingState: null,
  attachmentForPopupLoadingState: null,
  messageToEdit: null,
  activeChannelNewMessage: null,
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
  scrollToMentionedMessage: false,
  reactionsList: [],
  reactionsHasNext: true,
  reactionsLoadingState: null,
  openedMessageMenu: '',
  attachmentsUploadingProgress: {},
  playingAudioId: null,
  selectedMessagesMap: null,
  oGMetadata: null,
  attachmentUpdatedMap: {},
  messageMarkers: {},
  messagesMarkersLoadingState: null,
  pollVotesList: {},
  pollVotesHasMore: {},
  pollVotesLoadingState: {},
  pollVotesInitialCount: null,
  pendingPollActions: {},
  pendingMessageMutations: {},
  unreadScrollTo: true,
  unreadMessageId: '',
  stableUnreadAnchor: {
    channelId: '',
    messageId: ''
  }
}

const isPendingMessage = (message: IMessage) => !message.id && !!message.tid

const messagesMatch = (left: IMessage, right: IMessage) => {
  const leftRefs = [left.id, left.tid].filter(Boolean)
  const rightRefs = [right.id, right.tid].filter(Boolean)

  return leftRefs.some((leftRef) => rightRefs.includes(leftRef))
}

const mergeEquivalentMessages = (existingMessage: IMessage, nextMessage: IMessage) => {
  if (!!existingMessage.id !== !!nextMessage.id) {
    return nextMessage.id ? { ...existingMessage, ...nextMessage } : { ...nextMessage, ...existingMessage }
  }

  return { ...existingMessage, ...nextMessage }
}

const getTrimmedConfirmedMessages = (messages: IMessage[], direction?: string) => {
  if (messages.length <= MESSAGES_MAX_PAGE_COUNT) {
    return messages
  }

  if (direction === MESSAGE_LOAD_DIRECTION.PREV) {
    return messages.slice(0, MESSAGES_MAX_PAGE_COUNT)
  }

  return messages.slice(-MESSAGES_MAX_PAGE_COUNT)
}

const shouldIncludePendingMessages = (confirmedMessages: IMessage[], trimmedConfirmedMessages: IMessage[]) => {
  if (trimmedConfirmedMessages.length === 0) {
    return true
  }

  const latestConfirmedMessage = confirmedMessages[confirmedMessages.length - 1]
  if (!latestConfirmedMessage?.id) {
    return true
  }

  return trimmedConfirmedMessages.some((message) => message.id === latestConfirmedMessage.id)
}

const normalizeActiveChannelMessages = (messages: IMessage[], direction?: string) => {
  const deduplicatedMessages = messages.reduce<IMessage[]>((result, message) => {
    const existingMessageIndex = result.findIndex((item) => messagesMatch(item, message))

    if (existingMessageIndex === -1) {
      result.push(message)
      return result
    }

    result[existingMessageIndex] = mergeEquivalentMessages(result[existingMessageIndex], message)
    return result
  }, [])

  const confirmedMessages = deduplicatedMessages.filter((message) => !!message.id).sort(compareMessagesForList)
  const pendingMessages = deduplicatedMessages
    .filter((message) => isPendingMessage(message))
    .sort(comparePendingMessages)
  const trimmedConfirmedMessages = getTrimmedConfirmedMessages(confirmedMessages, direction)

  return [
    ...trimmedConfirmedMessages,
    ...(shouldIncludePendingMessages(confirmedMessages, trimmedConfirmedMessages) ? pendingMessages : [])
  ]
}

const messageSlice = createSlice({
  name: 'messages',
  initialState,
  reducers: {
    addMessage: (state, action: PayloadAction<{ message: IMessage }>) => {
      const { message } = action.payload
      state.activeChannelMessages = normalizeActiveChannelMessages([...state.activeChannelMessages, message])
    },

    deleteMessageFromList: (state, action: PayloadAction<{ messageId: string }>) => {
      const { messageId } = action.payload
      state.activeChannelMessages = state.activeChannelMessages.filter(
        (msg) => !(msg.id === messageId || msg.tid === messageId)
      )
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

    setUnreadScrollTo: (state, action: PayloadAction<{ state: boolean }>) => {
      state.unreadScrollTo = action.payload.state
    },

    setMessages: (state, action: PayloadAction<{ messages: IMessage[]; channelId?: string }>) => {
      const { messages } = action.payload
      state.activeChannelMessages = normalizeActiveChannelMessages(messages)
    },

    addMessages: (
      state,
      action: PayloadAction<{
        messages: IMessage[]
        direction: string
      }>
    ) => {
      const { messages, direction } = action.payload
      state.activeChannelMessages = normalizeActiveChannelMessages(
        [...state.activeChannelMessages, ...messages],
        direction
      )
    },

    updateMessagesStatus: (
      state,
      action: PayloadAction<{
        name: string
        markersMap: { [key: string]: IMarker }
        isOwnMarker?: boolean
      }>
    ) => {
      const { name, markersMap, isOwnMarker } = action.payload
      const markerName = name
      for (let index = 0; index < state.activeChannelMessages.length; index++) {
        if (!markersMap[state.activeChannelMessages[index].id]) {
          continue
        }
        if (state.activeChannelMessages[index].state !== 'Deleted') {
          const message = state.activeChannelMessages[index]
          const statusUpdatedMessage = updateMessageDeliveryStatusAndMarkers(message, markerName, isOwnMarker)
          state.activeChannelMessages[index] = {
            ...message,
            ...statusUpdatedMessage
          }
        }
      }
      state.activeChannelMessages = normalizeActiveChannelMessages(state.activeChannelMessages)
    },

    updateMessage: (
      state,
      action: PayloadAction<{
        messageId: string
        params: IMessage
        addIfNotExists?: boolean
        voteDetails?: {
          type: 'add' | 'delete' | 'addOwn' | 'deleteOwn' | 'close'
          vote?: IPollVote
        }
      }>
    ) => {
      const { messageId, params, addIfNotExists, voteDetails } = action.payload
      let messageFound = false
      state.activeChannelMessages = state.activeChannelMessages.map((message) => {
        if (message.tid === messageId || message.id === messageId) {
          messageFound = true
          if (params.state === MESSAGE_STATUS.DELETE) {
            return { ...params }
          } else {
            let statusUpdatedMessage = null
            if (params?.deliveryStatus) {
              statusUpdatedMessage = updateMessageDeliveryStatusAndMarkers(message, params.deliveryStatus)
            }
            const messageOldData: IMessage = {
              ...message,
              ...params,
              userMarkers: [...(message.userMarkers || []), ...(params.userMarkers || [])],
              ...statusUpdatedMessage
            }
            let messageData = { ...messageOldData }
            if (voteDetails) {
              messageData = {
                ...messageOldData,
                pollDetails: handleVoteDetails(voteDetails, messageOldData)
              }
            }
            return messageData
          }
        }
        return message
      })
      if (!messageFound && addIfNotExists) {
        state.activeChannelMessages.push(params)
      }
      state.activeChannelMessages = normalizeActiveChannelMessages(state.activeChannelMessages)
    },

    // Replace messages by ID without merging — used for lightweight cache-refresh patches.
    // Only messages whose IDs appear in both the patch list and the active list are replaced.
    patchMessages: (state, action: PayloadAction<{ messages: IMessage[] }>) => {
      const patchMap = new Map(action.payload.messages.filter((m) => !!m.id).map((m) => [m.id, m]))
      state.activeChannelMessages = state.activeChannelMessages.map((msg) =>
        msg.id && patchMap.has(msg.id) ? patchMap.get(msg.id)! : msg
      )
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
        state.attachmentsForPopup.unshift(...attachments)
      } else {
        state.attachmentsForPopup.push(...attachments)
      }
    },

    setAttachmentsComplete: (state, action: PayloadAction<{ hasPrev: boolean }>) => {
      state.attachmentHasNext = action.payload.hasPrev
    },

    setAttachmentsCompleteForPopup: (state, action: PayloadAction<{ hasPrev?: boolean; hasNext?: boolean }>) => {
      if (action.payload.hasPrev !== undefined) {
        state.attachmentForPopupHasPrev = action.payload.hasPrev
      }
      if (action.payload.hasNext !== undefined) {
        state.attachmentForPopupHasNext = action.payload.hasNext
      }
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

    setLoadingPrevMessagesState: (state, action: PayloadAction<{ state: number | null }>) => {
      state.loadingPrevMessagesState = action.payload.state
    },

    setLoadingNextMessagesState: (state, action: PayloadAction<{ state: number | null }>) => {
      state.loadingNextMessagesState = action.payload.state
    },

    setActivePaginationIntent: (
      state,
      action: PayloadAction<{
        channelId: string
        direction: 'prev' | 'next'
        requestId: string
        anchorId: string
      }>
    ) => {
      state.activePaginationIntent = action.payload
    },

    clearActivePaginationIntent: (state, action: PayloadAction<{ requestId?: string } | undefined>) => {
      if (action.payload?.requestId && state.activePaginationIntent?.requestId !== action.payload.requestId) {
        return
      }

      state.activePaginationIntent = null
    },

    setAttachmentsLoadingState: (state, action: PayloadAction<{ state: number | null; forPopup?: boolean }>) => {
      if (action.payload.forPopup) {
        state.attachmentForPopupLoadingState = action.payload.state
      } else {
        state.attachmentLoadingState = action.payload.state
      }
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
      if (!state.oGMetadata) {
        state.oGMetadata = {}
      }
      state.oGMetadata[url] = metadata
    },

    updateOGMetadata: (state, action: PayloadAction<{ url: string; metadata: IOGMetadata | null }>) => {
      const { url, metadata } = action.payload
      if (metadata) {
        if (!state.oGMetadata) {
          state.oGMetadata = {}
        }
        const existing = state.oGMetadata[url]
        state.oGMetadata[url] = existing ? { ...existing, ...metadata } : metadata
      }
    },

    setMessageMarkers: (
      state,
      action: PayloadAction<{
        channelId: string
        messageId: string
        messageMarkers: { [key: string]: IMarker[] }
        deliveryStatuses: string[]
      }>
    ) => {
      const { channelId, messageId, messageMarkers, deliveryStatuses } = action.payload
      if (!state.messageMarkers[channelId]) {
        state.messageMarkers[channelId] = {}
      }
      if (!state.messageMarkers[channelId][messageId]) {
        state.messageMarkers[channelId][messageId] = {}
      }
      for (const deliveryStatus of deliveryStatuses) {
        if (!state.messageMarkers[channelId][messageId][deliveryStatus]) {
          state.messageMarkers[channelId][messageId][deliveryStatus] = [] as IMarker[]
        }
        state.messageMarkers[channelId][messageId][deliveryStatus] = [...messageMarkers[deliveryStatus]]
      }
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
    },

    setPollVotesList: (
      state,
      action: PayloadAction<{
        pollId: string
        optionId: string
        votes: IPollVote[]
        hasNext: boolean
      }>
    ) => {
      const { pollId, optionId, votes, hasNext } = action.payload
      const key = `${pollId}_${optionId}`
      state.pollVotesHasMore[key] = hasNext
      // Sort by createdAt desc (latest first)
      const sortedVotes = [...votes].sort((a: any, b: any) => +new Date(b.createdAt) - +new Date(a.createdAt))
      state.pollVotesList[key] = sortedVotes
    },

    addPollVotesToList: (
      state,
      action: PayloadAction<{
        pollId: string
        optionId: string
        votes: IPollVote[]
        hasNext: boolean
        previousVotes?: IPollVote[]
      }>
    ) => {
      const { pollId, optionId, votes, hasNext, previousVotes } = action.payload
      const key = `${pollId}_${optionId}`
      state.pollVotesHasMore[key] = hasNext
      const existing = state.pollVotesList[key]
      if (!existing) {
        return
      }

      // Deduplicate by user.id
      const existingIds = new Set(existing.map((v) => v.user.id))
      const newVotes = votes.filter((v) => !existingIds.has(v.user.id))
      const merged = [
        ...(previousVotes && previousVotes.length > 0 ? [...newVotes] : []),
        ...existing,
        ...(!previousVotes || previousVotes.length === 0 ? [...newVotes] : [])
      ]
      // Sort by createdAt desc
      merged.sort((a: any, b: any) => +new Date(b.createdAt) - +new Date(a.createdAt))
      state.pollVotesList[key] = merged
    },

    deletePollVotesFromList: (
      state,
      action: PayloadAction<{
        pollId: string
        optionId: string
        votes: IPollVote[]
        messageId: string
      }>
    ) => {
      const { pollId, optionId, votes, messageId } = action.payload
      const key = `${pollId}_${optionId}`
      const existing = state.pollVotesList[key]
      if (!existing || !existing?.length) {
        return
      }
      state.pollVotesList[key] = state.pollVotesList[key].filter(
        (v) => !votes.find((vote) => vote.user.id === v.user.id)
      )

      if (state.pollVotesList[key]?.length === 0) {
        store.dispatch(getPollVotesAC(messageId, pollId, optionId, state.pollVotesInitialCount || 3))
      }
    },

    setPollVotesLoadingState: (
      state,
      action: PayloadAction<{
        pollId: string
        optionId: string
        loadingState: number | null
      }>
    ) => {
      const { pollId, optionId, loadingState } = action.payload
      const key = `${pollId}_${optionId}`
      state.pollVotesLoadingState[key] = loadingState
    },

    setPollVotesInitialCount: (
      state,
      action: PayloadAction<{
        initialCount: number
      }>
    ) => {
      state.pollVotesInitialCount = action.payload.initialCount
    },
    removePendingPollAction: (
      state,
      action: PayloadAction<{ messageId: string; actionType: string; optionId?: string }>
    ) => {
      const { messageId, actionType, optionId } = action.payload
      if (!state.pendingPollActions[messageId]) {
        return
      }
      state.pendingPollActions[messageId] = state.pendingPollActions[messageId].filter(
        (action) => !(action.type === actionType && (!optionId || action.optionId === optionId))
      )
      if (state.pendingPollActions[messageId].length === 0) {
        delete state.pendingPollActions[messageId]
      }
    },
    setPendingPollActionsMap: (state, action: PayloadAction<{ messageId: string; event: PendingPollAction }>) => {
      const { messageId, event } = action.payload
      if (!state.pendingPollActions[messageId]) {
        state.pendingPollActions[messageId] = []
      }
      state.pendingPollActions[messageId] = [...state.pendingPollActions[messageId], event]
    },
    updatePendingPollAction: (state, action: PayloadAction<{ messageId: string; message: IMessage }>) => {
      const { messageId, message } = action.payload
      if (!state.pendingPollActions[messageId]) {
        return
      }
      state.pendingPollActions[messageId] = state.pendingPollActions[messageId].map((action) => {
        return action.message?.id === messageId || action.message?.tid === messageId ? { ...action, message } : action
      })
    },
    setPendingMessageMutation: (state, action: PayloadAction<{ mutation: PendingMessageMutation }>) => {
      const { mutation } = action.payload
      state.pendingMessageMutations[mutation.messageId] = mutation
    },
    removePendingMessageMutation: (state, action: PayloadAction<{ messageId: string }>) => {
      delete state.pendingMessageMutations[action.payload.messageId]
    },
    setUnreadMessageId: (state, action: PayloadAction<{ messageId: string }>) => {
      state.unreadMessageId = action.payload.messageId
    },
    setStableUnreadAnchor: (state, action: PayloadAction<{ channelId: string; messageId: string }>) => {
      state.stableUnreadAnchor = action.payload
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
  setScrollToMentionedMessage,
  setScrollToNewMessage,
  setShowScrollToNewMessageButton,
  setUnreadScrollTo,
  setMessages,
  addMessages,
  updateMessagesStatus,
  updateMessage,
  patchMessages,
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
  setLoadingPrevMessagesState,
  setLoadingNextMessagesState,
  setActivePaginationIntent,
  clearActivePaginationIntent,
  setAttachmentsLoadingState,
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
  updateMessagesMarkers,
  setPollVotesList,
  addPollVotesToList,
  setPollVotesLoadingState,
  deletePollVotesFromList,
  setPollVotesInitialCount,
  removePendingPollAction,
  setPendingPollActionsMap,
  updatePendingPollAction,
  setPendingMessageMutation,
  removePendingMessageMutation,
  setUnreadMessageId,
  setStableUnreadAnchor
} = messageSlice.actions

// Export reducer
export default messageSlice.reducer
