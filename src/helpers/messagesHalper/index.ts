import { IMessage, IReaction } from '../../types'
import { checkArraysEqual } from '../index'
import { MESSAGE_DELIVERY_STATUS, MESSAGE_STATUS } from '../constants'
export const MESSAGES_MAX_LENGTH = 60
export const LOAD_MAX_MESSAGE_COUNT = 20
export const MESSAGE_LOAD_DIRECTION = {
  PREV: 'prev',
  NEXT: 'next'
}
export type IAttachmentMeta = {
  thumbnail?: string
  imageWidth?: number
  imageHeight?: number
  duration?: number
}

type draftMessagesMap = { [key: string]: { text: string; mentionedMembers: any; messageForReply?: IMessage } }
type visibleMessagesMap = { [key: string]: { id: string } }

type pendingMessagesMap = {
  [key: string]: IMessage[]
}

type messagesMap = {
  [key: string]: IMessage[]
}

// eslint-disable-next-line no-unused-vars
export let sendMessageHandler: (message: IMessage, channelId: string) => Promise<IMessage>

// eslint-disable-next-line no-unused-vars
export const setSendMessageHandler = (handler: (message: IMessage, channelId: string) => Promise<IMessage>) => {
  sendMessageHandler = handler
}

const pendingAttachments: { [key: string]: { file: File; checksum: string } } = {}
let messagesMap: messagesMap = {}
const pendingMessagesMap: pendingMessagesMap = {}
let activeChannelAllMessages: IMessage[] = []
let prevCached: boolean = false
let nextCached = false

export const setAllMessages = (messages: IMessage[]) => {
  activeChannelAllMessages = messages
}
export const addAllMessages = (messages: IMessage[], direction: string) => {
  if (direction === MESSAGE_LOAD_DIRECTION.PREV) {
    activeChannelAllMessages = [...messages, ...activeChannelAllMessages]
    if (activeChannelAllMessages.length > MESSAGES_MAX_LENGTH) {
      setHasNextCached(true)
    }
  } else {
    activeChannelAllMessages = [...activeChannelAllMessages, ...messages]
    if (activeChannelAllMessages.length > MESSAGES_MAX_LENGTH) {
      setHasPrevCached(true)
    }
  }
}

export const updateMessageOnAllMessages = (messageId: string, updatedParams: any) => {
  activeChannelAllMessages = activeChannelAllMessages.map((message) => {
    if (message.tid === messageId || message.id === messageId) {
      if (updatedParams.state === MESSAGE_STATUS.DELETE) {
        return { ...updatedParams }
      }
      return { ...message, ...updatedParams }
    }
    return message
  })
}

export const removeMessageFromAllMessages = (messageId: string) => {
  activeChannelAllMessages = [...activeChannelAllMessages].filter(
    (msg) => !(msg.id === messageId || msg.tid === messageId)
  )
}

export const updateMarkersOnAllMessages = (markersMap: any, name: string) => {
  activeChannelAllMessages = activeChannelAllMessages.map((message) => {
    if (
      markersMap[message.id] &&
      (message.deliveryStatus === MESSAGE_DELIVERY_STATUS.SENT || name === MESSAGE_DELIVERY_STATUS.READ)
    ) {
      return { ...message, deliveryStatus: name }
    }
    return message
  })
}

export const getAllMessages = () => activeChannelAllMessages

export const removeAllMessages = () => {
  activeChannelAllMessages = []
  setHasPrevCached(false)
  setHasNextCached(false)
}

export const setHasPrevCached = (state: boolean) => {
  prevCached = state
}
export const getHasPrevCached = () => prevCached

export const setHasNextCached = (state: boolean) => (nextCached = state)
export const getHasNextCached = () => nextCached

export const getFromAllMessagesByMessageId = (messageId: string, direction: string, getWithLastMessage?: boolean) => {
  let messagesForAdd: IMessage[] = []
  if (getWithLastMessage) {
    messagesForAdd = [...activeChannelAllMessages].slice(-MESSAGES_MAX_LENGTH)
    setHasPrevCached(activeChannelAllMessages.length > MESSAGES_MAX_LENGTH)
    setHasNextCached(false)
  } else {
    const fromMessageIndex = activeChannelAllMessages.findIndex((mes) => mes.id === messageId)
    if (fromMessageIndex !== 0) {
      if (direction === MESSAGE_LOAD_DIRECTION.PREV) {
        const sliceFromIndex =
          fromMessageIndex <= LOAD_MAX_MESSAGE_COUNT ? 0 : fromMessageIndex - (LOAD_MAX_MESSAGE_COUNT + 1)
        messagesForAdd = activeChannelAllMessages.slice(sliceFromIndex, fromMessageIndex)
        setHasPrevCached(!(messagesForAdd.length < LOAD_MAX_MESSAGE_COUNT || sliceFromIndex === 0))
        setHasNextCached(true)
      } else {
        const toMessage = fromMessageIndex + LOAD_MAX_MESSAGE_COUNT + 1
        messagesForAdd = activeChannelAllMessages.slice(fromMessageIndex + 1, toMessage)
        if (toMessage > activeChannelAllMessages.length - 1) {
          setHasNextCached(false)
        } else {
          setHasNextCached(!(messagesForAdd.length < LOAD_MAX_MESSAGE_COUNT))
        }
        setHasPrevCached(true)
      }
    } else {
      setHasPrevCached(false)
    }
  }

  return messagesForAdd
}

export function setMessagesToMap(channelId: string, messages: IMessage[]) {
  messagesMap[channelId] = messages
}

export function addMessageToMap(channelId: string, message: IMessage) {
  if (messagesMap[channelId] && messagesMap[channelId].length >= MESSAGES_MAX_LENGTH) {
    messagesMap[channelId].shift()
  }
  if (messagesMap[channelId]) {
    messagesMap[channelId].push(message)
  } else {
    messagesMap[channelId] = [message]
  }

  if (message.deliveryStatus === MESSAGE_DELIVERY_STATUS.PENDING) {
    if (pendingMessagesMap[channelId]) {
      pendingMessagesMap[channelId].push(message)
    } else {
      pendingMessagesMap[channelId] = [message]
    }
  }
}

export function addMessagesToMap(channelId: string, messages: IMessage[], direction: 'next' | 'prev') {
  if (messagesMap[channelId]) {
    const newMessagesLength = messages.length
    if (messagesMap[channelId].length > MESSAGES_MAX_LENGTH) {
      if (direction === MESSAGE_LOAD_DIRECTION.NEXT) {
        messagesMap[channelId].splice(0, newMessagesLength)
        messagesMap[channelId] = [...messagesMap[channelId], ...messages]
      }
    } else if (newMessagesLength + messagesMap[channelId].length > MESSAGES_MAX_LENGTH) {
      const sliceElementCount = newMessagesLength + messagesMap[channelId].length - MESSAGES_MAX_LENGTH
      if (direction === MESSAGE_LOAD_DIRECTION.PREV) {
        messages.splice(0, sliceElementCount)
        messagesMap[channelId] = [...messages, ...messagesMap[channelId]]
      } else {
        messagesMap[channelId].splice(0, sliceElementCount)
        messagesMap[channelId] = [...messagesMap[channelId], ...messages]
      }
    } else {
      messagesMap[channelId] =
        direction === MESSAGE_LOAD_DIRECTION.PREV
          ? [...messages, ...messagesMap[channelId]]
          : [...messagesMap[channelId], ...messages]
    }
  }
}

export function updateMessageOnMap(channelId: string, updatedMessage: { messageId: string; params: any }) {
  if (updatedMessage.params.deliveryStatus !== MESSAGE_DELIVERY_STATUS.PENDING && pendingMessagesMap[channelId]) {
    if (updatedMessage.params.state === MESSAGE_STATUS.FAILED) {
      pendingMessagesMap[channelId] = pendingMessagesMap[channelId].map((msg) => {
        if (msg.tid === updatedMessage.messageId) {
          return { ...msg, ...updatedMessage.params }
        }
        return msg
      })
    } else {
      const filteredMessages = pendingMessagesMap[channelId].filter((msg) => msg.tid !== updatedMessage.messageId)
      if (filteredMessages && filteredMessages.length && filteredMessages.length > 0) {
        pendingMessagesMap[channelId] = filteredMessages
      } else {
        delete pendingMessagesMap[channelId]
      }
    }
  }
  if (messagesMap[channelId]) {
    messagesMap[channelId] = messagesMap[channelId].map((mes) => {
      if (mes.tid === updatedMessage.messageId || mes.id === updatedMessage.messageId) {
        if (updatedMessage.params.state === MESSAGE_STATUS.DELETE) {
          return { ...updatedMessage.params }
        } else {
          return { ...mes, ...updatedMessage.params }
        }
      }
      return mes
    })
  }
}

export function addReactionToMessageOnMap(channelId: string, message: IMessage, reaction: IReaction, isSelf: boolean) {
  if (messagesMap[channelId]) {
    messagesMap[channelId] = messagesMap[channelId].map((msg) => {
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
  }
}

export const addReactionOnAllMessages = (message: IMessage, reaction: IReaction, isSelf: boolean) => {
  activeChannelAllMessages = activeChannelAllMessages.map((msg) => {
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
}

export function removeReactionToMessageOnMap(
  channelId: string,
  message: IMessage,
  reaction: IReaction,
  isSelf: boolean
) {
  if (messagesMap[channelId]) {
    messagesMap[channelId] = messagesMap[channelId].map((msg) => {
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
  }
}

export const removeReactionOnAllMessages = (message: IMessage, reaction: IReaction, isSelf: boolean) => {
  activeChannelAllMessages = activeChannelAllMessages.map((msg) => {
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
}

export function updateMessageStatusOnMap(channelId: string, newMarkers: { name: string; markersMap: any }) {
  if (messagesMap[channelId] && newMarkers && newMarkers.markersMap) {
    messagesMap[channelId] = messagesMap[channelId].map((mes) => {
      const { name } = newMarkers
      const { markersMap } = newMarkers
      if (
        markersMap[mes.id] &&
        (mes.deliveryStatus === MESSAGE_DELIVERY_STATUS.SENT || name === MESSAGE_DELIVERY_STATUS.READ)
      ) {
        return { ...mes, deliveryStatus: name }
      }
      return mes
    })
  }
}

export function getMessagesFromMap(channelId: string) {
  return messagesMap[channelId]
}

export function removeMessagesFromMap(channelId: string) {
  delete messagesMap[channelId]
}

export function removeMessageFromMap(channelId: string, messageId: string) {
  messagesMap[channelId] = [...messagesMap[channelId]].filter((msg) => !(msg.id === messageId || msg.tid === messageId))

  pendingMessagesMap[channelId] = [...pendingMessagesMap[channelId]].filter(
    (msg) => !(msg.id === messageId || msg.tid === messageId)
  )
}
export function removePendingMessageFromMap(channelId: string, messageId: string) {
  if (pendingMessagesMap[channelId]) {
    pendingMessagesMap[channelId] = [...pendingMessagesMap[channelId]].filter(
      (msg) => !(msg.id === messageId || msg.tid === messageId)
    )
  }
}

export function clearMessagesMap() {
  messagesMap = {}
}

export function checkChannelExistsOnMessagesMap(channelId: string) {
  return !!messagesMap[channelId]
}

export function destroyChannelsMap() {
  messagesMap = {}
}

export const messagesDiff = (message: IMessage, updatedMessage: IMessage) =>
  message.deliveryStatus !== updatedMessage.deliveryStatus ||
  message.body !== updatedMessage.body ||
  message.state !== updatedMessage.state ||
  !checkArraysEqual(message.markerTotals, updatedMessage.markerTotals) ||
  !checkArraysEqual(message.mentionedUsers, updatedMessage.mentionedUsers) ||
  !checkArraysEqual(message.userReactions, updatedMessage.userReactions)

const pendingVideoAttachmentsThumbs: { [key: string]: IAttachmentMeta } = {}

export const setVideoThumb = (attachmentId: string, thumb: IAttachmentMeta) => {
  pendingVideoAttachmentsThumbs[attachmentId] = thumb
}

export const getVideoThumb = (attachmentId: string): IAttachmentMeta => {
  return pendingVideoAttachmentsThumbs[attachmentId]
}

export const deleteVideoThumb = (attachmentId: string) => {
  delete pendingVideoAttachmentsThumbs[attachmentId]
}

export const setPendingAttachment = (attachmentId: string, data: { file?: File; checksum?: string }) => {
  pendingAttachments[attachmentId] = { ...pendingAttachments[attachmentId], ...data }
}

export const getPendingAttachment = (attachmentId: string) => pendingAttachments[attachmentId]

export const deletePendingAttachment = (attachmentId: string) => delete pendingAttachments[attachmentId]

export const getPendingMessages = (channelId: string) => pendingMessagesMap[channelId]
export const addPendingMessageToMap = (channelId: string, pendingMessage: IMessage) => {
  if (pendingMessagesMap[channelId]) {
    pendingMessagesMap[channelId].push(pendingMessage)
  } else {
    pendingMessagesMap[channelId] = [pendingMessage]
  }
}

export const setPendingMessages = (channelId: string, pendingMessages: any) => {
  pendingMessagesMap[channelId] = pendingMessages
}
export const getPendingMessagesMap = () => pendingMessagesMap

export const draftMessagesMap: draftMessagesMap = {}

export const getDraftMessageFromMap = (channelId: string) => draftMessagesMap[channelId]

export const checkDraftMessagesIsEmpty = () => Object.keys(draftMessagesMap).length === 0

export const removeDraftMessageFromMap = (channelId: string) => {
  delete draftMessagesMap[channelId]
}

export const setDraftMessageToMap = (
  channelId: string,
  draftMessage: { text: string; mentionedMembers: any; messageForReply?: IMessage }
) => {
  draftMessagesMap[channelId] = draftMessage
}

let visibleMessagesMap: visibleMessagesMap = {}

export const getVisibleMessagesMap = () => visibleMessagesMap

export const clearVisibleMessagesMap = () => {
  visibleMessagesMap = {}
}

export const setMessageToVisibleMessagesMap = (message: IMessage) => {
  visibleMessagesMap[message.id] = { id: message.id }
}

export const removeMessageFromVisibleMessagesMap = (message: IMessage) => {
  delete visibleMessagesMap[message.id]
}
