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
  SET_SCROLL_TO_MESSAGE
} from './constants'
import { IAction, IMarker, IMessage, IReaction } from '../../types'
import { DESTROY_SESSION } from '../channel/constants'
import { getAttachmentsAndLinksFromMessages } from '../../helpers'
import {
  MESSAGE_LOAD_DIRECTION,
  MESSAGES_MAX_LENGTH,
  setHasNextCached,
  setHasPrevCached
} from '../../helpers/messagesHalper'
import { MESSAGE_DELIVERY_STATUS } from '../../helpers/constants'

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
  attachmentHasNext: boolean
  messageToEdit: IMessage | null
  messageForReply?: IMessage | null
  activeChannelMessageUpdated: { messageId: string; params: IMessage } | null
  activeChannelNewMarkers: { name: string; markersMap: { [key: string]: IMarker } }
  scrollToNewMessage: {}
  showScrollToNewMessageButton: boolean
  sendMessageInputHeight: number
  attachmentsUploadingState: { [key: string]: any }
  scrollToMessage: string | null
}
const initialState: IMessageStore = {
  messagesLoadingState: null,
  messagesHasNext: false,
  messagesHasPrev: true,
  threadMessagesHasNext: false,
  threadMessagesHasPrev: true,
  activeChannelMessages: [],
  activeTabAttachments: [],
  attachmentHasNext: true,
  messageToEdit: null,
  activeChannelNewMessage: null,
  pendingMessages: {},
  activeChannelNewMarkers: { name: '', markersMap: {} },
  activeChannelMessageUpdated: null,
  scrollToNewMessage: {
    scrollToBottom: false,
    updateMessageList: false
  },
  showScrollToNewMessageButton: false,
  sendMessageInputHeight: 0,
  messageForReply: null,
  attachmentsUploadingState: {},
  scrollToMessage: null
}

export default (state = initialState, { type, payload }: IAction = { type: '' }) => {
  let newState = { ...state }
  switch (type) {
    case ADD_MESSAGE: {
      /* if (payload.message.tid) {
        console.log('add pending on reducer .... ', payload.message)
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
      // console.log('add new message on reducer .... ', payload.message)
      // newState.activeChannelNewMessage = { ...payload.message }
      // }
      // newState.activeChannelMessages = [...payload.message, ...newState.activeChannelMessages]
      return newState
    }

    case SET_SCROLL_TO_MESSAGE: {
      newState.scrollToMessage = payload.messageId
      return newState
    }
    case SET_SCROLL_TO_NEW_MESSAGE: {
      newState.scrollToNewMessage = {
        scrollToBottom: payload.scrollToBottom,
        updateMessageList: payload.updateMessageList
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
        if (currentMessagesLength >= MESSAGES_MAX_LENGTH) {
          setHasNextCached(true)
          // newState.messagesHasNext = true
          messagesCopy.splice(-newMessagesLength)
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
      const { messageId, params } = payload
      const messagesCopy = [...newState.activeChannelMessages]
      newState.activeChannelMessages = messagesCopy.map((message) => {
        if (message.tid === messageId || message.id === messageId) {
          return { ...message, ...params }
        }
        return message
      })
      return newState
    }

    case ADD_REACTION_TO_MESSAGE: {
      const { message, reaction, isSelf } = payload
      const messagesCopy = [...newState.activeChannelMessages]
      newState.activeChannelMessages = messagesCopy.map((msg) => {
        if (msg.id === message.id) {
          let slfReactions = [...msg.selfReactions]
          if (isSelf) {
            if (slfReactions) {
              slfReactions.push(reaction)
            } else {
              slfReactions = [reaction]
            }
          }
          return {
            ...msg,
            selfReactions: slfReactions,
            lastReactions: message.lastReactions,
            reactionScores: message.reactionScores
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
          let { selfReactions } = msg
          if (isSelf) {
            selfReactions = msg.selfReactions.filter((selfReaction: IReaction) => selfReaction.key !== reaction.key)
          }
          return {
            ...msg,
            lastReactions: message.lastReactions,
            reactionScores: message.reactionScores,
            selfReactions
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
      // TODO after getting more reliable attachment query refactor
      const { messages, messageType } = payload
      newState.activeTabAttachments = getAttachmentsAndLinksFromMessages(messages, messageType)
      return newState
    }

    case ADD_ATTACHMENTS: {
      // TODO after getting more reliable attachment query refactor
      const { messages, messageType } = payload
      const activeTabAttachments = getAttachmentsAndLinksFromMessages(messages, messageType)
      const attachmentsCopy = [...newState.activeTabAttachments]
      newState.activeTabAttachments = [...attachmentsCopy, ...activeTabAttachments]
      return newState
    }

    case SET_ATTACHMENTS_COMPLETE: {
      const { hasPrev } = payload
      newState.attachmentHasNext = hasPrev
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
      const { attachmentUploadingState, attachment } = payload
      newState.attachmentsUploadingState = {
        ...newState.attachmentsUploadingState,
        [attachment.attachmentId]: attachmentUploadingState
      }
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
