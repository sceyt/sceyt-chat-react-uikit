import { IAttachment, IMessage, IPollVote, IReaction } from '../../types'
import { checkArraysEqual } from '../index'
import { MESSAGE_DELIVERY_STATUS, MESSAGE_STATUS } from '../constants'
import { cancelUpload, getCustomUploader } from '../customUploader'
import { handleVoteDetails } from '../message'
import store from 'store'
import {
  removePendingPollActionAC,
  setPendingPollActionsMapAC,
  setPendingMessageAC,
  removePendingMessageAC,
  updatePendingMessageAC,
  clearPendingMessagesMapAC
} from 'store/message/actions'
export const MESSAGES_MAX_PAGE_COUNT = 80
export const MESSAGES_MAX_LENGTH = 50
export const LOAD_MAX_MESSAGE_COUNT = 30
export const MESSAGE_LOAD_DIRECTION = {
  PREV: 'prev',
  NEXT: 'next'
}

/**
 * Checks if a message should be skipped when updating delivery status.
 * Returns true if the message already has a status that is equal or higher than the new marker name.
 * @param markerName - The new delivery status marker name (SENT, DELIVERED, READ, PLAYED)
 * @param currentDeliveryStatus - The current delivery status of the message
 * @returns true if the update should be skipped, false otherwise
 */
export const shouldSkipDeliveryStatusUpdate = (markerName: string, currentDeliveryStatus: string): boolean => {
  if (
    markerName === MESSAGE_DELIVERY_STATUS.SENT &&
    (currentDeliveryStatus === MESSAGE_DELIVERY_STATUS.SENT ||
      currentDeliveryStatus === MESSAGE_DELIVERY_STATUS.DELIVERED ||
      currentDeliveryStatus === MESSAGE_DELIVERY_STATUS.READ ||
      currentDeliveryStatus === MESSAGE_DELIVERY_STATUS.PLAYED)
  ) {
    return true
  }
  if (
    markerName === MESSAGE_DELIVERY_STATUS.DELIVERED &&
    (currentDeliveryStatus === MESSAGE_DELIVERY_STATUS.DELIVERED ||
      currentDeliveryStatus === MESSAGE_DELIVERY_STATUS.READ ||
      currentDeliveryStatus === MESSAGE_DELIVERY_STATUS.PLAYED)
  ) {
    return true
  }
  if (
    markerName === MESSAGE_DELIVERY_STATUS.READ &&
    (currentDeliveryStatus === MESSAGE_DELIVERY_STATUS.READ || currentDeliveryStatus === MESSAGE_DELIVERY_STATUS.PLAYED)
  ) {
    return true
  }
  if (markerName === MESSAGE_DELIVERY_STATUS.PLAYED && currentDeliveryStatus === MESSAGE_DELIVERY_STATUS.PLAYED) {
    return true
  }
  return false
}

/**
 * Updates a message's delivery status and markerTotals array.
 * If the marker doesn't exist in markerTotals, it adds it with count 1.
 * If it exists, it increments the count.
 * @param message - The message object to update
 * @param markerName - The new delivery status marker name (SENT, DELIVERED, READ, PLAYED)
 * @returns A new message object with updated deliveryStatus and markerTotals
 */
export const updateMessageDeliveryStatusAndMarkers = (
  message: IMessage,
  markerName: string
): { markerTotals: { name: string; count: number }[]; deliveryStatus: string } => {
  if (shouldSkipDeliveryStatusUpdate(markerName, message.deliveryStatus)) {
    return {
      markerTotals: message.markerTotals,
      deliveryStatus: message.deliveryStatus
    }
  }
  const markerInMarkersTotal = message?.markerTotals?.find(
    (marker: { name: string; count: number }) => marker.name === markerName
  )
  if (!markerInMarkersTotal) {
    return {
      markerTotals: [
        ...(message.markerTotals || []),
        {
          name: markerName,
          count: 1
        }
      ],
      deliveryStatus: markerName
    }
  } else {
    return {
      markerTotals: message.markerTotals.map((marker: { name: string; count: number }) =>
        marker.name === markerName ? { ...marker, count: marker.count + 1 } : marker
      ),
      deliveryStatus: markerName
    }
  }
}

export type IAttachmentMeta = {
  thumbnail?: string
  imageWidth?: number
  imageHeight?: number
  duration?: number
}

type draftMessagesMap = {
  [key: string]: { text: string; mentionedUsers: any; messageForReply?: IMessage; bodyAttributes?: any }
}
type audioRecordingMap = { [key: string]: any }
type visibleMessagesMap = { [key: string]: { id: string } }

type messagesMap = {
  [key: string]: { [key: string]: IMessage }
}

// eslint-disable-next-line no-unused-vars
export let sendMessageHandler: (message: IMessage, channelId: string) => Promise<IMessage>

// eslint-disable-next-line no-unused-vars
export const setSendMessageHandler = (handler: (message: IMessage, channelId: string) => Promise<IMessage>) => {
  sendMessageHandler = handler
}

const pendingAttachments: { [key: string]: { file: File; checksum: string; messageTid?: string; channelId: string } } =
  {}
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
    if (activeChannelAllMessages.length > MESSAGES_MAX_PAGE_COUNT) {
      setHasNextCached(true)
    }
  } else {
    activeChannelAllMessages = [...activeChannelAllMessages, ...messages]
    if (activeChannelAllMessages.length > MESSAGES_MAX_PAGE_COUNT) {
      setHasPrevCached(true)
    }
  }
}

export const updateMessageOnAllMessages = (
  messageId: string,
  updatedParams: any,
  voteDetails?: {
    type: 'add' | 'delete' | 'addOwn' | 'deleteOwn' | 'close'
    vote?: IPollVote
  }
) => {
  activeChannelAllMessages = activeChannelAllMessages.map((message) => {
    if (message.tid === messageId || message.id === messageId) {
      if (updatedParams.state === MESSAGE_STATUS.DELETE) {
        return { ...updatedParams }
      }
      const statusUpdatedMessage = updateMessageDeliveryStatusAndMarkers(message, updatedParams.deliveryStatus)
      let updatedMessage = {
        ...message,
        ...updatedParams,
        ...statusUpdatedMessage
      }
      if (voteDetails) {
        updatedMessage = {
          ...updatedMessage,
          pollDetails: handleVoteDetails(voteDetails, updatedMessage)
        }
      }
      return updatedMessage
    }
    return message
  })
}

export const updateMessageStatusOnAllMessages = (name: string, markersMap: any) => {
  activeChannelAllMessages = activeChannelAllMessages.map((message) => {
    if (markersMap[message.id]) {
      const statusUpdatedMessage = updateMessageDeliveryStatusAndMarkers(message, name)
      return { ...message, ...statusUpdatedMessage }
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
    if (!markersMap[message.id]) {
      return message
    }
    const statusUpdatedMessage = updateMessageDeliveryStatusAndMarkers(message, name)
    return { ...message, ...statusUpdatedMessage }
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
    messagesForAdd = [...activeChannelAllMessages.slice(-MESSAGES_MAX_PAGE_COUNT)]
    setHasPrevCached(activeChannelAllMessages.length > MESSAGES_MAX_PAGE_COUNT)
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

export function setMessagesToMap(
  channelId: string,
  messages: IMessage[],
  firstMessageId: string = '0',
  lastMessageId: string = '0'
) {
  if (!messagesMap[channelId]) {
    messagesMap[channelId] = {}
  }
  for (const key in messagesMap[channelId]) {
    if (Object.prototype.hasOwnProperty.call(messagesMap[channelId], key)) {
      const element = messagesMap[channelId][key]
      if (element.id >= firstMessageId && element.id <= lastMessageId) {
        delete messagesMap[channelId][key]
      }
    }
  }
  messages.forEach((msg: IMessage) => {
    if (msg.tid && messagesMap[channelId][msg.tid]) {
      delete messagesMap[channelId][msg.tid]
    }
    messagesMap[channelId][msg.id || msg.tid!] = msg
  })
}

export function addMessageToMap(channelId: string, message: IMessage) {
  if (!messagesMap[channelId]) {
    messagesMap[channelId] = {}
  }
  if (message.tid && messagesMap[channelId][message.tid]) {
    delete messagesMap[channelId][message.tid]
  }
  messagesMap[channelId][message.id || message.tid!] = message
}

export function updateMessageOnMap(
  channelId: string,
  updatedMessage: { messageId: string; params: any },
  voteDetails?: {
    vote?: IPollVote
    type: 'add' | 'delete' | 'addOwn' | 'deleteOwn' | 'close'
  }
) {
  const pendingMessagesMap = store.getState().MessageReducer.pendingMessagesMap
  if (updatedMessage.params.deliveryStatus !== MESSAGE_DELIVERY_STATUS.PENDING && pendingMessagesMap[channelId]) {
    if (
      updatedMessage.params.state === MESSAGE_STATUS.FAILED ||
      updatedMessage.params.state === MESSAGE_STATUS.UNMODIFIED
    ) {
      const updatedPendingMessages = pendingMessagesMap[channelId]?.map((msg: IMessage) => {
        if (msg.tid === updatedMessage.messageId) {
          const statusUpdatedMessage = updateMessageDeliveryStatusAndMarkers(msg, updatedMessage.params.deliveryStatus)
          return {
            ...msg,
            ...updatedMessage.params,
            ...statusUpdatedMessage
          }
        }
        return msg
      })
      updatedPendingMessages.forEach((msg: IMessage) => {
        store.dispatch(updatePendingMessageAC(channelId, msg.tid || msg.id, msg))
      })
    }
  }
  let updatedMessageData = null
  if (messagesMap[channelId]) {
    const messagesList: IMessage[] = []
    for (const mes of Object.values(messagesMap[channelId] || {})) {
      if (mes.tid === updatedMessage.messageId || mes.id === updatedMessage.messageId) {
        if (updatedMessage.params.state === MESSAGE_STATUS.DELETE) {
          updatedMessageData = { ...updatedMessage.params }
          messagesList.push({ ...mes, ...updatedMessageData })
          continue
        } else {
          const statusUpdatedMessage = updateMessageDeliveryStatusAndMarkers(mes, updatedMessage.params.deliveryStatus)
          updatedMessageData = {
            ...mes,
            ...updatedMessage.params,
            ...statusUpdatedMessage
          }
          let voteDetailsData = mes?.pollDetails
          if (voteDetails) {
            voteDetailsData = handleVoteDetails(voteDetails, updatedMessageData)
          }
          updatedMessageData = {
            ...updatedMessageData,
            pollDetails: voteDetailsData
          }
          messagesList.push({ ...mes, ...updatedMessageData })
          continue
        }
      }
      messagesList.push(mes)
    }
    messagesList.forEach((msg) => {
      if (!messagesMap[channelId]) {
        messagesMap[channelId] = {}
      }
      if (msg.tid && messagesMap[channelId][msg.tid]) {
        delete messagesMap[channelId][msg.tid]
      }
      messagesMap[channelId][msg.id || msg.tid!] = msg
    })
  }

  return updatedMessageData
}

export function addReactionToMessageOnMap(channelId: string, message: IMessage, reaction: IReaction, isSelf: boolean) {
  if (messagesMap[channelId]) {
    const messageShouldBeUpdated = messagesMap[channelId][message.id]

    let slfReactions = [...messageShouldBeUpdated.userReactions]
    if (isSelf) {
      if (slfReactions) {
        slfReactions.push(reaction)
      } else {
        slfReactions = [reaction]
      }
    }
    if (message.tid && messagesMap[channelId][message.tid]) {
      delete messagesMap[channelId][message.tid]
    }
    messagesMap[channelId][message.id || message.tid!] = {
      ...messageShouldBeUpdated,
      userReactions: slfReactions,
      reactionTotals: message.reactionTotals
    }
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
    const messageShouldBeUpdated = messagesMap[channelId][message.id]
    let { userReactions } = messageShouldBeUpdated
    if (isSelf) {
      userReactions = messageShouldBeUpdated.userReactions.filter(
        (selfReaction: IReaction) => selfReaction.key !== reaction.key
      )
    }
    if (message.tid && messagesMap[channelId][message.tid]) {
      delete messagesMap[channelId][message.tid]
    }
    messagesMap[channelId][message.id || message.tid!] = {
      ...messageShouldBeUpdated,
      reactionTotals: message.reactionTotals,
      userReactions
    }
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
    const messageIds: string[] = []
    Object.keys(newMarkers.markersMap).forEach((messageId) => {
      if (newMarkers.markersMap[messageId]) {
        messageIds.push(messageId)
      }
    })
    messageIds.forEach((messageId: string) => {
      const messageShouldBeUpdated = messagesMap[channelId][messageId]
      if (messageShouldBeUpdated) {
        const statusUpdatedMessage = updateMessageDeliveryStatusAndMarkers(messageShouldBeUpdated, newMarkers.name)
        if (messageShouldBeUpdated.tid && messagesMap[channelId][messageShouldBeUpdated.tid]) {
          delete messagesMap[channelId][messageShouldBeUpdated.tid]
        }
        messagesMap[channelId][messageId] = {
          ...messageShouldBeUpdated,
          ...statusUpdatedMessage
        }
      }
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
  delete messagesMap[channelId][messageId]

  store.dispatch(removePendingMessageAC(channelId, messageId))
}

export function updatePendingMessageOnMap(channelId: string, messageId: string, updatedMessage: Partial<IMessage>) {
  store.dispatch(updatePendingMessageAC(channelId, messageId, updatedMessage))
}

export function getMessageFromPendingMessagesMap(channelId: string, messageId: string) {
  const pendingMessagesMap = store.getState().MessageReducer.pendingMessagesMap
  if (pendingMessagesMap[channelId]) {
    return pendingMessagesMap[channelId].find((msg: IMessage) => msg.id === messageId || msg.tid === messageId)
  }
  return null
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

export const deletePendingMessage = (channelId: string, message: IMessage) => {
  if (message.attachments && message.attachments.length) {
    const customUploader = getCustomUploader()
    message.attachments.forEach((att: IAttachment) => {
      if (customUploader) {
        cancelUpload(att.tid!)
        deletePendingAttachment(att.tid!)
      }
    })
  }
  removeMessageFromMap(channelId, message.id || message.tid!)
  removeMessageFromAllMessages(message.id || message.tid!)
}

export const getPendingMessages = (channelId: string) => {
  const pendingMessagesMap = store.getState().MessageReducer.pendingMessagesMap
  return pendingMessagesMap[channelId]
}

export const setPendingMessage = (channelId: string, pendingMessage: IMessage) => {
  store.dispatch(setPendingMessageAC(channelId, pendingMessage))
}

export const getPendingMessagesMap = () => {
  return store.getState().MessageReducer.pendingMessagesMap
}

export const clearPendingMessagesMap = () => {
  store.dispatch(clearPendingMessagesMapAC())
}

export const draftMessagesMap: draftMessagesMap = {}
export const audioRecordingMap: audioRecordingMap = {}
export const getDraftMessageFromMap = (channelId: string) => draftMessagesMap[channelId]
export const getAudioRecordingFromMap = (channelId: string) => audioRecordingMap[channelId]

export const checkDraftMessagesIsEmpty = () => Object.keys(draftMessagesMap).length === 0

export const setAudioRecordingToMap = (channelId: string, audioRecording: any) => {
  audioRecordingMap[channelId] = audioRecording
}

export const removeDraftMessageFromMap = (channelId: string) => {
  delete draftMessagesMap[channelId]
}

export const removeAudioRecordingFromMap = (channelId: string) => {
  delete audioRecordingMap[channelId]
}

export const setDraftMessageToMap = (
  channelId: string,
  draftMessage: {
    text: string
    mentionedUsers: any
    messageForReply?: IMessage
    editorState?: any
    bodyAttributes?: any
  }
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

export type PendingPollAction = {
  type: 'ADD_POLL_VOTE' | 'DELETE_POLL_VOTE' | 'CLOSE_POLL' | 'RETRACT_POLL_VOTE'
  channelId: string
  pollId: string
  optionId?: string
  message: IMessage
}

export const checkPendingPollActionConflict = (
  action: PendingPollAction
): { hasConflict: boolean; shouldSkip: boolean } => {
  const messageId = action.message.id || action.message.tid
  if (!messageId) return { hasConflict: false, shouldSkip: false }
  const pendingPollActionsMap = store.getState().MessageReducer.pendingPollActions
  if (!pendingPollActionsMap[messageId]) {
    return { hasConflict: false, shouldSkip: false }
  }

  // Check if deletePollVote comes and there's a pending addPollVote for same option - should skip both
  if (action.type === 'DELETE_POLL_VOTE' && action.optionId) {
    const hasPendingAdd = pendingPollActionsMap[messageId].some(
      (pendingAction: PendingPollAction) =>
        pendingAction.type === 'ADD_POLL_VOTE' && pendingAction.optionId === action.optionId
    )
    if (hasPendingAdd && pendingPollActionsMap[messageId].length === 1) {
      return { hasConflict: true, shouldSkip: true }
    }
  }

  // Check if addPollVote comes and there's a pending deletePollVote for same option - should remove pending delete
  if (action.type === 'ADD_POLL_VOTE' && action.optionId) {
    const hasPendingDelete = pendingPollActionsMap[messageId].some(
      (pendingAction: PendingPollAction) =>
        pendingAction.type === 'DELETE_POLL_VOTE' && pendingAction.optionId === action.optionId
    )
    if (hasPendingDelete) {
      return { hasConflict: true, shouldSkip: false }
    }
  }

  return { hasConflict: false, shouldSkip: false }
}

export const setPendingPollAction = (action: PendingPollAction) => {
  const messageId = action.message.id || action.message.tid
  if (!messageId) return
  const pendingPollActionsMap = store.getState().MessageReducer.pendingPollActions
  const pendingPollActionsMapCopy = JSON.parse(JSON.stringify(pendingPollActionsMap))
  if (!pendingPollActionsMapCopy[messageId]) {
    pendingPollActionsMapCopy[messageId] = []
  }

  // Handle conflict resolution: if addPollVote is pending and deletePollVote comes, remove the pending addPollVote
  if (action.type === 'DELETE_POLL_VOTE' && action.optionId) {
    const isAddedPollVote = pendingPollActionsMapCopy[messageId].some(
      (pendingAction: PendingPollAction) =>
        pendingAction.type === 'ADD_POLL_VOTE' && pendingAction.optionId === action.optionId
    )
    if (isAddedPollVote) {
      store.dispatch(removePendingPollActionAC(messageId, 'ADD_POLL_VOTE', action.optionId))
      return
    }
  }

  // Handle conflict: if deletePollVote is pending and addPollVote comes, remove the pending deletePollVote
  if (action.type === 'ADD_POLL_VOTE' && action.optionId) {
    const isDeletedPollVote = pendingPollActionsMapCopy[messageId].some(
      (pendingAction: PendingPollAction) =>
        pendingAction.type === 'DELETE_POLL_VOTE' && pendingAction.optionId === action.optionId
    )
    if (isDeletedPollVote) {
      store.dispatch(removePendingPollActionAC(messageId, 'DELETE_POLL_VOTE', action.optionId))
      return
    }
  }

  store.dispatch(setPendingPollActionsMapAC(messageId, action))
}

export const getCenterTwoMessages = (
  messages: IMessage[]
): {
  mid1: { messageId: string; index: number }
  mid2: { messageId: string; index: number }
} => {
  const mid = Math.floor(messages.length / 2)

  if (messages.length % 2 === 0) {
    return {
      mid1: {
        messageId: messages[mid - 1].id,
        index: mid - 1
      },
      mid2: {
        messageId: messages[mid].id,
        index: mid
      }
    }
  }

  return {
    mid1: {
      messageId: messages[mid - 1].id,
      index: mid - 1
    },
    mid2: {
      messageId: messages[mid + 1].id,
      index: mid + 1
    }
  }
}
