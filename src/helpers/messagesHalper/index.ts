import { IAttachment, IMarker, IMessage, IPollVote, IReaction } from '../../types'
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
export const MESSAGES_MAX_PAGE_COUNT = 60
export const MESSAGES_MAX_LENGTH = 40
export const LOAD_MAX_MESSAGE_COUNT = 20
export const LOAD_MAX_MESSAGE_COUNT_PREFETCH = 50
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
      currentDeliveryStatus === MESSAGE_DELIVERY_STATUS.PLAYED ||
      currentDeliveryStatus === MESSAGE_DELIVERY_STATUS.OPENED)
  ) {
    return true
  }
  if (
    markerName === MESSAGE_DELIVERY_STATUS.DELIVERED &&
    (currentDeliveryStatus === MESSAGE_DELIVERY_STATUS.DELIVERED ||
      currentDeliveryStatus === MESSAGE_DELIVERY_STATUS.READ ||
      currentDeliveryStatus === MESSAGE_DELIVERY_STATUS.PLAYED ||
      currentDeliveryStatus === MESSAGE_DELIVERY_STATUS.OPENED)
  ) {
    return true
  }
  if (
    markerName === MESSAGE_DELIVERY_STATUS.READ &&
    (currentDeliveryStatus === MESSAGE_DELIVERY_STATUS.READ ||
      currentDeliveryStatus === MESSAGE_DELIVERY_STATUS.PLAYED ||
      currentDeliveryStatus === MESSAGE_DELIVERY_STATUS.OPENED)
  ) {
    return true
  }
  if (
    markerName === MESSAGE_DELIVERY_STATUS.PLAYED &&
    (currentDeliveryStatus === MESSAGE_DELIVERY_STATUS.PLAYED ||
      currentDeliveryStatus === MESSAGE_DELIVERY_STATUS.OPENED)
  ) {
    return true
  }
  if (markerName === MESSAGE_DELIVERY_STATUS.OPENED && currentDeliveryStatus === MESSAGE_DELIVERY_STATUS.OPENED) {
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
  markerName: string,
  isOwnMarker?: boolean
): {
  userMarkers?: IMarker[]
  markerTotals?: IMarker[]
  deliveryStatus: string
} => {
  if (shouldSkipDeliveryStatusUpdate(markerName, message.deliveryStatus)) {
    return {
      markerTotals: message.markerTotals,
      userMarkers: message.userMarkers,
      deliveryStatus: message.deliveryStatus
    }
  }
  const markersTotal = isOwnMarker ? message.userMarkers : message.markerTotals
  const markerInMarkersTotal = (markersTotal || [])?.find((marker: IMarker) => marker.name === markerName)
  if (!markerInMarkersTotal) {
    return {
      [isOwnMarker ? 'userMarkers' : 'markerTotals']: [
        ...(markersTotal || []),
        {
          name: markerName,
          count: 1
        }
      ],
      deliveryStatus: markerName
    }
  } else {
    return {
      [isOwnMarker ? 'userMarkers' : 'markerTotals']: markersTotal.map((marker: { name: string; count: number }) =>
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

const pendingAttachments: { [key: string]: { file: File; messageTid?: string; channelId: string } } = {}
let messagesMap: messagesMap = {}
let activeSegment: { startId: string; endId: string } | null = null
// Per-channel registry of contiguous loaded ranges, kept sorted ascending by startId.
// "Contiguous" means the messages in a range were loaded via adjacent server pages
// (either a single fresh-load window or that window extended by loadMoreMessages pagination).
// A jump to a different position creates a new separate entry; pagination extends the existing one.
let loadedSegmentsMap: { [channelId: string]: Array<{ startId: string; endId: string }> } = {}

export const removeAllMessages = () => {
  clearActiveSegment()
}

// Inserts {startId, endId} into loadedSegmentsMap[channelId], merging any overlapping entries.
function upsertSegment(channelId: string, startId: string, endId: string) {
  if (!loadedSegmentsMap[channelId]) {
    loadedSegmentsMap[channelId] = []
  }
  const bigStart = BigInt(startId)
  const bigEnd = BigInt(endId)
  const overlapping = loadedSegmentsMap[channelId].filter(
    (s) => BigInt(s.startId) <= bigEnd && BigInt(s.endId) >= bigStart
  )
  if (overlapping.length > 0) {
    const mergedStart = [bigStart, ...overlapping.map((s) => BigInt(s.startId))].reduce((a, b) => (a < b ? a : b))
    const mergedEnd = [bigEnd, ...overlapping.map((s) => BigInt(s.endId))].reduce((a, b) => (a > b ? a : b))
    loadedSegmentsMap[channelId] = loadedSegmentsMap[channelId].filter(
      (s) => BigInt(s.startId) > bigEnd || BigInt(s.endId) < bigStart
    )
    loadedSegmentsMap[channelId].push({ startId: mergedStart.toString(), endId: mergedEnd.toString() })
  } else {
    loadedSegmentsMap[channelId].push({ startId, endId })
  }
  loadedSegmentsMap[channelId].sort((a, b) => (BigInt(a.startId) < BigInt(b.startId) ? -1 : 1))
}

export const setActiveSegment = (channelId: string, startId: string, endId: string) => {
  upsertSegment(channelId, startId, endId)
  // After potential merge, find the merged segment that contains our range
  const merged = (loadedSegmentsMap[channelId] || []).find(
    (s) => BigInt(s.startId) <= BigInt(startId) && BigInt(s.endId) >= BigInt(endId)
  )
  activeSegment = merged || { startId, endId }
}

export const extendActiveSegment = (channelId: string, startId: string, endId: string, direction: string) => {
  if (!activeSegment) {
    setActiveSegment(channelId, startId, endId)
    return
  }
  // The new page is server-guaranteed contiguous with activeSegment on one side.
  // Update the matching entry in loadedSegmentsMap in-place (find by the stable boundary).
  const segments = loadedSegmentsMap[channelId] || []
  if (direction === MESSAGE_LOAD_DIRECTION.PREV) {
    // Stable side: endId stays the same
    const idx = segments.findIndex((s) => s.endId === activeSegment!.endId)
    activeSegment = { startId, endId: activeSegment.endId }
    if (idx >= 0) {
      loadedSegmentsMap[channelId][idx] = { ...activeSegment }
    }
  } else {
    // Stable side: startId stays the same
    const idx = segments.findIndex((s) => s.startId === activeSegment!.startId)
    activeSegment = { startId: activeSegment.startId, endId }
    if (idx >= 0) {
      loadedSegmentsMap[channelId][idx] = { ...activeSegment }
    }
  }
}

export const clearActiveSegment = () => {
  activeSegment = null
}

export const getActiveSegment = () => activeSegment

/**
 * Returns up to `limit` cached messages contiguous with and immediately before `fromMessageId`
 * within the loaded segment that contains `fromMessageId`. Returns [] if there is a gap.
 */
export function getContiguousPrevMessages(channelId: string, fromMessageId: string, limit: number): IMessage[] {
  const segments = loadedSegmentsMap[channelId] || []
  const bigFrom = BigInt(fromMessageId)
  const seg = segments.find((s) => BigInt(s.startId) <= bigFrom && BigInt(s.endId) >= bigFrom)
  if (!seg || BigInt(seg.startId) >= bigFrom) return []
  return Object.values(messagesMap[channelId] || {})
    .filter((msg) => msg.id && BigInt(msg.id) >= BigInt(seg.startId) && BigInt(msg.id) < bigFrom)
    .sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1))
    .slice(-limit)
}

/**
 * Returns up to `limit` cached messages contiguous with and immediately after `fromMessageId`
 * within the loaded segment that contains `fromMessageId`. Returns [] if there is a gap.
 */
export function getContiguousNextMessages(channelId: string, fromMessageId: string, limit: number): IMessage[] {
  const segments = loadedSegmentsMap[channelId] || []
  const bigFrom = BigInt(fromMessageId)
  const seg = segments.find((s) => BigInt(s.startId) <= bigFrom && BigInt(s.endId) >= bigFrom)
  if (!seg || BigInt(seg.endId) <= bigFrom) return []
  return Object.values(messagesMap[channelId] || {})
    .filter((msg) => msg.id && BigInt(msg.id) > bigFrom && BigInt(msg.id) <= BigInt(seg.endId))
    .sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1))
    .slice(0, limit)
}

/** True if the map has contiguous messages before `fromMessageId` in the same segment. */
export function hasPrevContiguousInMap(channelId: string, fromMessageId: string): boolean {
  const segments = loadedSegmentsMap[channelId] || []
  const bigFrom = BigInt(fromMessageId)
  return segments.some((s) => BigInt(s.startId) < bigFrom && BigInt(s.endId) >= bigFrom)
}

/** True if the map has contiguous messages after `fromMessageId` in the same segment. */
export function hasNextContiguousInMap(channelId: string, fromMessageId: string): boolean {
  const segments = loadedSegmentsMap[channelId] || []
  const bigFrom = BigInt(fromMessageId)
  return segments.some((s) => BigInt(s.startId) <= bigFrom && BigInt(s.endId) > bigFrom)
}

export function getLatestMessagesFromMap(channelId: string, limit: number): IMessage[] {
  return Object.values(messagesMap[channelId] || {})
    .filter((m) => !!m.id)
    .sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1))
    .slice(-limit)
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
            userMarkers: [...(msg.userMarkers || []), ...(updatedMessage.params.userMarkers || [])],
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
  delete loadedSegmentsMap[channelId]
}

export function removeMessageFromMap(channelId: string, messageId: string) {
  if (messagesMap[channelId] && messagesMap[channelId][messageId]) {
    delete messagesMap[channelId][messageId]
  }

  store.dispatch(removePendingMessageAC(channelId, messageId))
}

export function updatePendingMessageOnMap(
  channelId: string,
  messageId: string,
  updatedMessage: Partial<IMessage & { isOwnMarker?: boolean }>
) {
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
  loadedSegmentsMap = {}
  clearActiveSegment()
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

export const setPendingAttachment = (attachmentId: string, data: { file?: File }) => {
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
