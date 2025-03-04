import {
  ADD_ATTACHMENTS,
  ADD_MESSAGE,
  ADD_MESSAGES,
  ADD_REACTION_TO_MESSAGE,
  CLEAR_MESSAGES,
  DELETE_REACTION_FROM_MESSAGE,
  EMPTY_CHANNEL_ATTACHMENTS,
  SET_ATTACHMENTS,
  SET_ATTACHMENTS_COMPLETE,
  SET_MESSAGE_FOR_REPLY,
  SET_MESSAGE_TO_EDIT,
  SET_MESSAGES,
  SET_MESSAGES_HAS_NEXT,
  SET_MESSAGES_LOADING_STATE,
  SET_HAS_PREV_MESSAGES,
  SET_SCROLL_TO_NEW_MESSAGE,
  SET_SEND_MESSAGE_INPUT_HEIGHT,
  SET_SHOW_SCROLL_TO_NEW_MESSAGE_BUTTON,
  UPDATE_MESSAGE,
  UPDATE_MESSAGES_STATUS,
  UPLOAD_ATTACHMENT_COMPILATION,
  SET_SCROLL_TO_MESSAGE,
  SET_ATTACHMENTS_FOR_POPUP,
  ADD_ATTACHMENTS_FOR_POPUP,
  queryDirection,
  SET_ATTACHMENTS_COMPLETE_FOR_POPUP,
  DELETE_MESSAGE_FROM_LIST,
  SET_REACTIONS_LIST,
  ADD_REACTIONS_TO_LIST,
  SET_REACTIONS_LOADING_STATE,
  DELETE_REACTION_FROM_LIST,
  ADD_REACTION_TO_LIST,
  SET_MESSAGE_MENU_OPENED,
  REMOVE_UPLOAD_PROGRESS,
  UPDATE_UPLOAD_PROGRESS,
  SET_PLAYING_AUDIO_ID,
  ADD_SELECTED_MESSAGE,
  REMOVE_SELECTED_MESSAGE,
  CLEAR_SELECTED_MESSAGES,
  REMOVE_ATTACHMENT
} from './constants'
import { IAction, IMarker, IMessage, IReaction } from '../../types'
import { DESTROY_SESSION } from '../channel/constants'
import {
  MESSAGE_LOAD_DIRECTION,
  MESSAGES_MAX_LENGTH,
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
  activeChannelMessages: any[]
  pendingMessages: { [key: string]: IMessage[] }
  activeChannelNewMessage: IMessage | null
  activeTabAttachments: any[]
  attachmentsForPopup: any[]
  attachmentHasNext: boolean
  attachmentForPopupHasNext: boolean
  messageToEdit: IMessage | null
  messageForReply?: IMessage | null
  activeChannelMessageUpdated: { messageId: string; params: IMessage } | null
  activeChannelNewMarkers: { name: string; markersMap: { [key: string]: IMarker } }
  scrollToNewMessage: {}
  showScrollToNewMessageButton: boolean
  sendMessageInputHeight: number
  attachmentsUploadingState: { [key: string]: any }
  scrollToMessage: string | null
  reactionsList: IReaction[]
  reactionsHasNext: boolean
  reactionsLoadingState: number | null
  openedMessageMenu: string
  attachmentsUploadingProgress: {
    [key: string]: {
      uploaded: number
      total: number
      progress?: number
    }
  }
  playingAudioId: string | null
  selectedMessagesMap: Map<string, IMessage> | null
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
  activeChannelNewMarkers: { name: '', markersMap: {} },
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
  reactionsList: [],
  reactionsHasNext: true,
  reactionsLoadingState: null,
  openedMessageMenu: '',
  attachmentsUploadingProgress: {},
  playingAudioId: null,
  selectedMessagesMap: null
}

export default (state = initialState, { type, payload }: IAction = { type: '' }) => {
  let newState = { ...state }
  switch (type) {
    case ADD_MESSAGE: {
      /* if (payload.message.tid) {
        log.info('add pending on reducer .... ', payload.message)
        newState.pendingMessages = { ...newState.pendingMessages, [payload.message.tid]: payload.message }
        newState.scrollToNewMessage = {
          scrollToBottom: true,
          updateMessageList: false
        }
      } else { */
      const messagesCopy = [...newState.activeChannelMessages]
      if (newState.activeChannelMessages.length >= MESSAGES_MAX_LENGTH) {
        messagesCopy.shift()
        newState.activeChannelMessages = [...messagesCopy, payload.message]
      } else {
        newState.activeChannelMessages = [...messagesCopy, payload.message]
      }
      /* if (payload.message.deliveryStatus === MESSAGE_DELIVERY_STATUS.PENDING) {
        newState.scrollToNewMessage = {
          scrollToBottom: true,
          updateMessageList: true
        }
      } */
      // log.info('add new message on reducer .... ', payload.message)
      // newState.activeChannelNewMessage = { ...payload.message }
      // }
      // newState.activeChannelMessages = [...payload.message, ...newState.activeChannelMessages]
      return newState
    }

    case DELETE_MESSAGE_FROM_LIST: {
      newState.activeChannelMessages = [...newState.activeChannelMessages].filter(
        (msg) => !(msg.id === payload.messageId || msg.tid === payload.messageId)
      )
      return newState
    }
    case SET_SCROLL_TO_MESSAGE: {
      newState.scrollToMessage = payload.messageId
      return newState
    }
    case SET_SCROLL_TO_NEW_MESSAGE: {
      newState.scrollToNewMessage = {
        scrollToBottom: payload.scrollToBottom,
        updateMessageList: payload.updateMessageList,
        isIncomingMessage: payload.isIncomingMessage
      }
      return newState
    }

    case SET_SHOW_SCROLL_TO_NEW_MESSAGE_BUTTON: {
      newState.showScrollToNewMessageButton = payload.state
      return newState
    }

    case SET_MESSAGES: {
      // const { messages, direction, unreadCount } = payload
      const { messages } = payload
      newState.activeChannelMessages = messages
      return newState
    }

    case ADD_MESSAGES: {
      const { messages, direction } = payload
      const messagesCopy = [...newState.activeChannelMessages]
      const newMessagesLength = messages.length
      const currentMessagesLength = newState.activeChannelMessages.length
      if (direction === MESSAGE_LOAD_DIRECTION.PREV) {
        if (currentMessagesLength + newMessagesLength >= MESSAGES_MAX_LENGTH) {
          setHasNextCached(true)
          // newState.messagesHasNext = true
          if (newMessagesLength > 0) {
            if (currentMessagesLength >= MESSAGES_MAX_LENGTH) {
              messagesCopy.splice(-newMessagesLength)
            } else {
              messagesCopy.splice(-(newMessagesLength - (MESSAGES_MAX_LENGTH - currentMessagesLength)))
            }
          }
          newState.activeChannelMessages = [...messages, ...messagesCopy]
        } else if (newMessagesLength + currentMessagesLength > MESSAGES_MAX_LENGTH) {
          const sliceElementCount = newMessagesLength + currentMessagesLength - MESSAGES_MAX_LENGTH
          setHasNextCached(true)
          // newState.messagesHasNext = true
          messagesCopy.splice(-sliceElementCount)
          newState.activeChannelMessages = [...messages, ...messagesCopy]
        } else {
          newState.activeChannelMessages = [...messages, ...newState.activeChannelMessages]
        }
      } else if (direction === 'next') {
        if (currentMessagesLength >= MESSAGES_MAX_LENGTH) {
          setHasPrevCached(true)
          // newState.messagesHasPrev = true
          messagesCopy.splice(0, messages.length)
          newState.activeChannelMessages = [...messagesCopy, ...messages]
        } else if (newMessagesLength + currentMessagesLength > MESSAGES_MAX_LENGTH) {
          const sliceElementCount = newMessagesLength + currentMessagesLength - MESSAGES_MAX_LENGTH
          setHasPrevCached(true)
          // newState.messagesHasPrev = true
          messagesCopy.splice(0, sliceElementCount)
          newState.activeChannelMessages = [...messagesCopy, ...messages]
        } else {
          newState.activeChannelMessages = [...newState.activeChannelMessages, ...messages]
        }
      }
      return newState
    }

    case UPDATE_MESSAGES_STATUS: {
      const { name, markersMap } = payload
      const markerName = name
      const messagesCopy = [...newState.activeChannelMessages]
      let isChanged = false
      // eslint-disable-next-line no-return-assign
      newState.activeChannelNewMarkers = { name, markersMap }
      messagesCopy.forEach((message, index) => {
        if (
          markersMap[message.id] &&
          (message.deliveryStatus === MESSAGE_DELIVERY_STATUS.SENT || markerName === MESSAGE_DELIVERY_STATUS.READ) &&
          // (markerName !== MESSAGE_DELIVERY_STATUS.DELIVERED &&
          //   message.deliveryStatus === MESSAGE_DELIVERY_STATUS.DELIVERED)) &&
          message.state !== 'Deleted'
        ) {
          const messageCopy = { ...message }
          messageCopy.deliveryStatus = markerName
          messagesCopy[index] = messageCopy
          if (!isChanged) {
            isChanged = true
          }
        }
      })
      if (isChanged) {
        newState.activeChannelMessages = messagesCopy
      }
      return newState
    }

    case UPDATE_MESSAGE: {
      const { messageId, params, addIfNotExists } = payload
      const messagesCopy = [...newState.activeChannelMessages]
      let messageFound = false
      newState.activeChannelMessages = messagesCopy.map((message) => {
        if (message.tid === messageId || message.id === messageId) {
          messageFound = true
          if (params.state === MESSAGE_STATUS.DELETE) {
            return { ...params }
          } else {
            return { ...message, ...params }
          }
        }
        return message
      })
      if (!messageFound && addIfNotExists) {
        log.info('message not found on update message, add message to list .. ...', params)
        newState.activeChannelMessages = [...newState.activeChannelMessages, params]
      }
      return newState
    }

    case ADD_REACTION_TO_MESSAGE: {
      const { message, reaction, isSelf } = payload
      // const messagesCopy = [...newState.activeChannelMessages]
      newState.activeChannelMessages = newState.activeChannelMessages.map((msg) => {
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
      return newState
    }

    case DELETE_REACTION_FROM_MESSAGE: {
      const { reaction, message, isSelf } = payload

      const messagesCopy = [...newState.activeChannelMessages]
      newState.activeChannelMessages = messagesCopy.map((msg) => {
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
      return newState
    }

    case SET_HAS_PREV_MESSAGES: {
      newState.messagesHasPrev = payload.hasPrev
      return newState
    }

    case SET_MESSAGES_HAS_NEXT: {
      newState.messagesHasNext = payload.hasNext
      return newState
    }

    case CLEAR_MESSAGES: {
      newState.activeChannelMessages = []
      return newState
    }

    case EMPTY_CHANNEL_ATTACHMENTS: {
      newState.activeTabAttachments = []
      return newState
    }

    case SET_ATTACHMENTS: {
      const { attachments } = payload
      newState.activeTabAttachments = attachments
      return newState
    }
    case REMOVE_ATTACHMENT: {
      const { attachmentId } = payload
      newState.activeTabAttachments = [...newState.activeTabAttachments].filter((item) => item.id !== attachmentId)
      newState.attachmentsForPopup = [...newState.attachmentsForPopup].filter((item) => item.id !== attachmentId)
      return newState
    }

    case SET_ATTACHMENTS_FOR_POPUP: {
      const { attachments } = payload
      newState.attachmentsForPopup = attachments
      return newState
    }

    case ADD_ATTACHMENTS: {
      const { attachments } = payload
      const attachmentsCopy = [...newState.activeTabAttachments]
      newState.activeTabAttachments = [...attachmentsCopy, ...attachments]
      return newState
    }

    case ADD_ATTACHMENTS_FOR_POPUP: {
      const { attachments, direction } = payload
      const attachmentsCopy = [...newState.attachmentsForPopup]
      if (direction === queryDirection.PREV) {
        newState.attachmentsForPopup = [...attachmentsCopy, ...attachments]
      } else {
        newState.attachmentsForPopup = [...attachments, ...attachmentsCopy]
      }
      return newState
    }

    case SET_ATTACHMENTS_COMPLETE: {
      const { hasPrev } = payload
      newState.attachmentHasNext = hasPrev
      return newState
    }

    case SET_ATTACHMENTS_COMPLETE_FOR_POPUP: {
      const { hasPrev } = payload
      newState.attachmentForPopupHasNext = hasPrev
      return newState
    }

    case UPDATE_UPLOAD_PROGRESS: {
      const { uploaded, total, attachmentId, progress } = payload
      const attachmentsUploadingProgressCopy = { ...newState.attachmentsUploadingProgress }
      const updateData = { uploaded, total, progress }
      attachmentsUploadingProgressCopy[attachmentId] = {
        ...attachmentsUploadingProgressCopy[attachmentId],
        ...updateData
      }
      newState.attachmentsUploadingProgress = attachmentsUploadingProgressCopy
      return newState
    }

    case REMOVE_UPLOAD_PROGRESS: {
      const { attachmentId } = payload
      const attachmentsUploadingProgressCopy = { ...newState.attachmentsUploadingProgress }
      delete attachmentsUploadingProgressCopy[attachmentId]
      newState.attachmentsUploadingProgress = attachmentsUploadingProgressCopy
      return newState
    }

    case SET_MESSAGE_TO_EDIT: {
      newState.messageToEdit = payload.message
      return newState
    }

    case SET_MESSAGES_LOADING_STATE: {
      newState.messagesLoadingState = payload.state
      return newState
    }

    case SET_SEND_MESSAGE_INPUT_HEIGHT: {
      newState.sendMessageInputHeight = payload.height
      return newState
    }

    case SET_MESSAGE_FOR_REPLY: {
      const { message } = payload
      newState.messageForReply = message
      return newState
    }

    case UPLOAD_ATTACHMENT_COMPILATION: {
      const { attachmentUploadingState, attachmentId } = payload
      newState.attachmentsUploadingState = {
        ...newState.attachmentsUploadingState,
        [attachmentId]: attachmentUploadingState
      }
      return newState
    }

    case SET_REACTIONS_LIST: {
      const { reactions, hasNext } = payload
      newState.reactionsHasNext = hasNext
      newState.reactionsList = [...reactions]
      return newState
    }

    case ADD_REACTIONS_TO_LIST: {
      const { reactions, hasNext } = payload
      newState.reactionsHasNext = hasNext
      newState.reactionsList = [...newState.reactionsList, ...reactions]
      return newState
    }

    case ADD_REACTION_TO_LIST: {
      newState.reactionsList = [...newState.reactionsList, payload.reaction]
      return newState
    }

    case DELETE_REACTION_FROM_LIST: {
      const { reaction } = payload
      newState.reactionsList = [...newState.reactionsList].filter((item) => item.id !== reaction.id)
      return newState
    }

    case SET_REACTIONS_LOADING_STATE: {
      newState.reactionsLoadingState = payload.state
      return newState
    }

    case SET_MESSAGE_MENU_OPENED: {
      newState.openedMessageMenu = payload.messageId
      return newState
    }
    case SET_PLAYING_AUDIO_ID: {
      newState.playingAudioId = payload.id
      return newState
    }

    case ADD_SELECTED_MESSAGE: {
      if (!newState.selectedMessagesMap) {
        const messagesMap = new Map()
        messagesMap.set(payload.message.id, payload.message)
        newState.selectedMessagesMap = messagesMap
      } else {
        const messagesMap = new Map(newState.selectedMessagesMap)
        messagesMap.set(payload.message.id, payload.message)
        newState.selectedMessagesMap = messagesMap
      }
      return newState
    }

    case REMOVE_SELECTED_MESSAGE: {
      if (newState.selectedMessagesMap) {
        const messagesMap = new Map(newState.selectedMessagesMap)
        messagesMap.delete(payload.messageId)
        newState.selectedMessagesMap = messagesMap
      }
      return newState
    }

    case CLEAR_SELECTED_MESSAGES: {
      newState.selectedMessagesMap = null
      return newState
    }

    case DESTROY_SESSION: {
      newState = initialState
      return newState
    }

    default:
      return state
  }
}
