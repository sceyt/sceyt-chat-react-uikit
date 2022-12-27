import { IMessage, IReaction } from '../../types'
import { checkArraysEqual } from '../index'
import { MESSAGE_DELIVERY_STATUS } from '../constants'
export const MESSAGES_MAX_LENGTH = 50
export const LOAD_MAX_MESSAGE_COUNT = 10
export const MESSAGE_LOAD_DIRECTION = {
  PREV: 'prev',
  NEXT: 'next'
}
export type IAttachmentMeta = { thumbnail?: string; imageWidth?: number; imageHeight?: number; duration?: number }

type messagesMap = {
  [key: string]: IMessage[]
}
let messagesMap: messagesMap = {}
let activeChannelAllMessages: IMessage[] = []
let prevCached: boolean = false
let nextCached = false

export const setAllMessages = (messages: IMessage[]) => {
  activeChannelAllMessages = messages
}
export const addAllMessages = (messages: IMessage[], direction: string) => {
  if (direction === MESSAGE_LOAD_DIRECTION.PREV) {
    activeChannelAllMessages = [...messages, ...activeChannelAllMessages]
  } else {
    activeChannelAllMessages = [...activeChannelAllMessages, ...messages]
  }
}

export const updateMessageOnAllMessages = (messageId: string, updatedParams: any) => {
  activeChannelAllMessages = activeChannelAllMessages.map((message) => {
    if (message.tid === messageId || message.id === messageId) {
      return { ...message, ...updatedParams }
    }
    return message
  })
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

export const getAllMessages = () => [...activeChannelAllMessages]

export const setHasPrevCached = (state: boolean) => (prevCached = state)
export const getHasPrevCached = () => prevCached

export const setHasNextCached = (state: boolean) => (nextCached = state)
export const getHasNextCached = () => nextCached

export const getFromAllMessagesByMessageId = (messageId: string, direction: string, getWithLastMessage?: boolean) => {
  let messagesForAdd: IMessage[] = []

  if (getWithLastMessage) {
    messagesForAdd = activeChannelAllMessages.slice(-MESSAGES_MAX_LENGTH)
  } else {
    const fromMessageIndex = activeChannelAllMessages.findIndex((mes) => mes.id === messageId)

    if (direction === MESSAGE_LOAD_DIRECTION.PREV) {
      messagesForAdd = activeChannelAllMessages.slice(
        fromMessageIndex <= LOAD_MAX_MESSAGE_COUNT ? 0 : fromMessageIndex - (LOAD_MAX_MESSAGE_COUNT + 1),
        fromMessageIndex - 1
      )
      setHasPrevCached(!(messagesForAdd.length < LOAD_MAX_MESSAGE_COUNT || fromMessageIndex === 0))
      setHasNextCached(true)
    } else {
      messagesForAdd = activeChannelAllMessages.slice(
        fromMessageIndex + 1,
        fromMessageIndex + LOAD_MAX_MESSAGE_COUNT + 1
      )
      setHasPrevCached(true)
      setHasNextCached(!(messagesForAdd.length < LOAD_MAX_MESSAGE_COUNT))
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
  messagesMap[channelId].push(message)
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
  if (messagesMap[channelId]) {
    messagesMap[channelId] = messagesMap[channelId].map((mes) => {
      if (mes.tid === updatedMessage.messageId || mes.id === updatedMessage.messageId) {
        return { ...mes, ...updatedMessage.params }
      }
      return mes
    })
  }
}

export function addReactionToMessageOnMap(channelId: string, message: IMessage, reaction: IReaction, isSelf: boolean) {
  if (messagesMap[channelId]) {
    messagesMap[channelId] = messagesMap[channelId].map((msg) => {
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
  }
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
  !checkArraysEqual(message.selfMarkers, updatedMessage.selfMarkers) ||
  !checkArraysEqual(message.mentionedUsers, updatedMessage.mentionedUsers) ||
  !checkArraysEqual(message.selfReactions, updatedMessage.selfReactions) ||
  !checkArraysEqual(message.lastReactions, updatedMessage.lastReactions)

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
