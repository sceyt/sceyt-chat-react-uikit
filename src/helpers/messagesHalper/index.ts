import { IAttachment, IMarker, IMessage, IPollVote, IReaction } from '../../types'
import { checkArraysEqual } from '../index'
import { MESSAGE_DELIVERY_STATUS, MESSAGE_STATUS } from '../constants'
import { cancelUpload, getCustomUploader } from '../customUploader'
import { handleVoteDetails } from '../message'
import store from 'store'
import { removePendingPollActionAC, setPendingPollActionsMapAC } from 'store/message/actions'
export const MESSAGES_MAX_PAGE_COUNT = 60
export const MESSAGES_MAX_LENGTH = 40
export const LOAD_MAX_MESSAGE_COUNT = 20
export const LOAD_MAX_MESSAGE_COUNT_PREFETCH = 50
export const MESSAGE_LOAD_DIRECTION = {
  PREV: 'prev',
  NEXT: 'next'
}
const PENDING_MESSAGE_SORT_MULTIPLIER = BigInt(1000000)

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
type visibleMessagesMap = {
  [key: string]: {
    id?: string
    localRef: string
    sortKey: string
  }
}

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
let activeSegmentChannelId: string | null = null
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
  activeSegmentChannelId = channelId
}

export const extendActiveSegment = (channelId: string, startId: string, endId: string, direction: string) => {
  if (!activeSegment || activeSegmentChannelId !== channelId) {
    upsertSegment(channelId, startId, endId)
    return
  }

  const nextActiveSegment =
    direction === MESSAGE_LOAD_DIRECTION.PREV
      ? { startId, endId: activeSegment.endId }
      : { startId: activeSegment.startId, endId }

  upsertSegment(channelId, nextActiveSegment.startId, nextActiveSegment.endId)

  activeSegment =
    (loadedSegmentsMap[channelId] || []).find(
      (segment) =>
        BigInt(segment.startId) <= BigInt(nextActiveSegment.startId) &&
        BigInt(segment.endId) >= BigInt(nextActiveSegment.endId)
    ) || nextActiveSegment
  activeSegmentChannelId = channelId
}

export const appendMessageToLatestSegment = (
  channelId: string,
  messageId?: string | null,
  expectedPreviousLatestMessageId?: string | null
) => {
  if (!messageId) {
    return false
  }

  const segments = loadedSegmentsMap[channelId]
  if (!segments?.length) {
    return false
  }

  const latestIndex = segments.length - 1
  const latestSegment = segments[latestIndex]
  if (
    expectedPreviousLatestMessageId &&
    compareMessageIds(latestSegment.endId, expectedPreviousLatestMessageId) !== 0
  ) {
    return false
  }
  if (compareMessageIds(messageId, latestSegment.endId) <= 0) {
    return false
  }

  const updatedSegment = {
    startId: latestSegment.startId,
    endId: messageId
  }
  loadedSegmentsMap[channelId][latestIndex] = updatedSegment

  if (
    activeSegment &&
    activeSegmentChannelId === channelId &&
    activeSegment.startId === latestSegment.startId &&
    activeSegment.endId === latestSegment.endId
  ) {
    activeSegment = updatedSegment
  }

  return true
}

export const clearActiveSegment = () => {
  activeSegment = null
  activeSegmentChannelId = null
}

export const getActiveSegment = () => activeSegment

const getCreatedAtSortKey = (createdAt?: IMessage['createdAt']) => {
  const createdAtValue = new Date(createdAt || 0).getTime()
  return BigInt(Number.isNaN(createdAtValue) ? 0 : createdAtValue) * PENDING_MESSAGE_SORT_MULTIPLIER
}

export const compareMessageIds = (leftId?: string | null, rightId?: string | null) => {
  if (!leftId && !rightId) {
    return 0
  }
  if (!leftId) {
    return -1
  }
  if (!rightId) {
    return 1
  }
  const leftValue = BigInt(leftId)
  const rightValue = BigInt(rightId)
  if (leftValue === rightValue) {
    return 0
  }
  return leftValue < rightValue ? -1 : 1
}

/**
 * Returns up to `limit` cached messages contiguous with and immediately before `fromMessage`
 * within the loaded segment that contains `fromMessage`. Returns [] if there is a gap.
 */
export function getContiguousPrevMessages(channelId: string, fromMessage: IMessage, limit: number): IMessage[] {
  const segments = loadedSegmentsMap[channelId] || []
  const fromKey = getMessageSortKey(fromMessage)
  const seg = segments.find((s) => BigInt(s.startId) <= fromKey && BigInt(s.endId) >= fromKey)
  if (!seg || BigInt(seg.startId) >= fromKey) return []
  return Object.values(messagesMap[channelId] || {})
    .filter((msg) => msg.id && BigInt(msg.id) >= BigInt(seg.startId) && BigInt(msg.id) < fromKey)
    .sort(compareMessagesForList)
    .slice(-limit)
}

/**
 * Returns up to `limit` cached messages contiguous with and immediately after `fromMessage`
 * within the loaded segment that contains `fromMessage`. Returns [] if there is a gap.
 * When `includePending` is true, also includes pending messages that sit beyond the latest
 * confirmed segment edge (they have no numeric id yet but are in the messages map by tid).
 */
export function getContiguousNextMessages(
  channelId: string,
  fromMessage: IMessage,
  limit: number,
  includePending = false
): IMessage[] {
  const segments = loadedSegmentsMap[channelId] || []
  const fromKey = getMessageSortKey(fromMessage)
  const seg = segments.find((s) => BigInt(s.startId) <= fromKey && BigInt(s.endId) >= fromKey)
  const pendingMessages = Object.values(messagesMap[channelId] || {})
    .filter((msg) => !msg.id && !!msg.tid)
    .sort(compareMessagesForList)

  if (!seg) {
    if (!includePending || fromMessage.id) {
      return []
    }

    return pendingMessages.filter((msg) => getMessageSortKey(msg) > fromKey).slice(0, limit)
  }
  const segEnd = BigInt(seg.endId)
  const confirmedMessages = Object.values(messagesMap[channelId] || {}).filter(
    (msg) => msg.id && BigInt(msg.id) > fromKey && BigInt(msg.id) <= segEnd
  )
  if (!includePending) {
    if (segEnd <= fromKey) return []
    return confirmedMessages.sort(compareMessagesForList).slice(0, limit)
  }
  const latestSeg = segments[segments.length - 1]
  const pendingTailMessages = seg.endId === latestSeg?.endId ? pendingMessages : []
  if (!confirmedMessages.length && !pendingTailMessages.length) return []
  return [...confirmedMessages, ...pendingTailMessages].sort(compareMessagesForList).slice(0, limit)
}

/** True if the map has contiguous messages before `fromMessage` in the same segment. */
export function hasPrevContiguousInMap(channelId: string, fromMessage: IMessage): boolean {
  const segments = loadedSegmentsMap[channelId] || []
  const fromKey = getMessageSortKey(fromMessage)
  return segments.some((s) => BigInt(s.startId) < fromKey && BigInt(s.endId) >= fromKey)
}

/** True if the map has contiguous messages after `fromMessage` in the same segment. */
export function hasNextContiguousInMap(channelId: string, fromMessage: IMessage): boolean {
  const segments = loadedSegmentsMap[channelId] || []
  const fromKey = getMessageSortKey(fromMessage)
  return segments.some((s) => BigInt(s.startId) <= fromKey && BigInt(s.endId) > fromKey)
}

export function getCachedNearMessages(
  channelId: string,
  boundaryMessageId: string,
  limit: number
): {
  messages: IMessage[]
  hasEnoughCache: boolean
  hasNextMessages: boolean
  hasPrevMessages: boolean
} {
  const segments = loadedSegmentsMap[channelId] || []
  const channelMessages = messagesMap[channelId] || {}
  if (!segments.length || !Object.keys(channelMessages).length) {
    return {
      messages: [],
      hasEnoughCache: false,
      hasNextMessages: false,
      hasPrevMessages: false
    }
  }

  const hasOlderSegmentBefore = (startId: string) =>
    segments.some((segment) => compareMessageIds(segment.endId, startId) < 0)
  const hasNewerSegmentAfter = (endId: string) =>
    segments.some((segment) => compareMessageIds(segment.startId, endId) > 0)

  if (!boundaryMessageId) {
    const latestSegment = segments[segments.length - 1]
    const latestMessages = Object.values(channelMessages)
      .filter(
        (message): message is IMessage =>
          !!message.id &&
          compareMessageIds(message.id, latestSegment.startId) >= 0 &&
          compareMessageIds(message.id, latestSegment.endId) <= 0
      )
      .sort(compareMessagesForList)
      .slice(-limit)

    if (!latestMessages.length) {
      return {
        messages: [],
        hasEnoughCache: false,
        hasNextMessages: false,
        hasPrevMessages: false
      }
    }

    const firstMessageId = latestMessages[0]?.id || ''
    return {
      messages: latestMessages,
      hasEnoughCache: true,
      hasNextMessages: false,
      hasPrevMessages:
        (firstMessageId ? compareMessageIds(firstMessageId, latestSegment.startId) > 0 : false) ||
        hasOlderSegmentBefore(latestSegment.startId)
    }
  }

  const containingSegment = segments.find(
    (segment) =>
      compareMessageIds(segment.startId, boundaryMessageId) <= 0 &&
      compareMessageIds(segment.endId, boundaryMessageId) >= 0
  )
  if (!containingSegment) {
    return {
      messages: [],
      hasEnoughCache: false,
      hasNextMessages: false,
      hasPrevMessages: false
    }
  }

  const segmentMessages = Object.values(channelMessages)
    .filter(
      (message): message is IMessage =>
        !!message.id &&
        compareMessageIds(message.id, containingSegment.startId) >= 0 &&
        compareMessageIds(message.id, containingSegment.endId) <= 0
    )
    .sort(compareMessagesForList)
  const boundaryIndex = segmentMessages.findIndex((message) => message.id === boundaryMessageId)

  if (boundaryIndex < 0) {
    return {
      messages: [],
      hasEnoughCache: false,
      hasNextMessages: false,
      hasPrevMessages: false
    }
  }

  const nextMessages = segmentMessages.slice(boundaryIndex + 1, boundaryIndex + 1 + Math.max(limit - 1, 0))
  const remainingSlots = Math.max(limit - 1 - nextMessages.length, 0)
  const previousMessages =
    remainingSlots > 0 ? segmentMessages.slice(Math.max(0, boundaryIndex - remainingSlots), boundaryIndex) : []
  const messages = [...previousMessages, segmentMessages[boundaryIndex], ...nextMessages]

  const firstMessageId = messages[0]?.id || ''
  const lastMessageId = messages[messages.length - 1]?.id || ''

  return {
    messages,
    hasEnoughCache: messages.length > 0,
    hasNextMessages:
      (lastMessageId ? compareMessageIds(lastMessageId, containingSegment.endId) < 0 : false) ||
      hasNewerSegmentAfter(containingSegment.endId),
    hasPrevMessages:
      (firstMessageId ? compareMessageIds(firstMessageId, containingSegment.startId) > 0 : false) ||
      hasOlderSegmentBefore(containingSegment.startId)
  }
}

/**
 * Returns the exact cached messages for the interval [startId, endId], plus
 * contiguity flags, for cache-first window restoration.
 *
 * isFullyCached is true only when the entire interval is covered by a single
 * loaded segment AND both startId and endId are present in the messages map.
 */
export function getCachedWindowInterval(
  channelId: string,
  startId: string,
  endId: string
): {
  messages: IMessage[]
  isFullyCached: boolean
  hasPrevMessages: boolean
  hasNextMessages: boolean
} {
  const segments = loadedSegmentsMap[channelId] || []
  const channelMessages = messagesMap[channelId] || {}

  const containingSegment = segments.find(
    (s) => compareMessageIds(s.startId, startId) <= 0 && compareMessageIds(s.endId, endId) >= 0
  )

  if (!containingSegment) {
    return { messages: [], isFullyCached: false, hasPrevMessages: false, hasNextMessages: false }
  }

  const messages = Object.values(channelMessages)
    .filter(
      (m): m is IMessage => !!m.id && compareMessageIds(m.id, startId) >= 0 && compareMessageIds(m.id, endId) <= 0
    )
    .sort(compareMessagesForList)

  const hasStart = messages.some((m) => compareMessageIds(m.id!, startId) === 0)
  const hasEnd = messages.some((m) => compareMessageIds(m.id!, endId) === 0)

  const hasOlderSegmentBefore = segments.some((s) => compareMessageIds(s.endId, containingSegment.startId) < 0)
  const hasNewerSegmentAfter = segments.some((s) => compareMessageIds(s.startId, containingSegment.endId) > 0)

  return {
    messages,
    isFullyCached: hasStart && hasEnd,
    hasPrevMessages: compareMessageIds(startId, containingSegment.startId) > 0 || hasOlderSegmentBefore,
    hasNextMessages: compareMessageIds(endId, containingSegment.endId) < 0 || hasNewerSegmentAfter
  }
}

export const getMessageSortKey = (message: IMessage): bigint => {
  if (message.id) {
    return BigInt(message.id)
  }
  return getCreatedAtSortKey(message.createdAt)
}

export const comparePendingMessages = (a: IMessage, b: IMessage) => {
  const aCreatedAt = getCreatedAtSortKey(a.createdAt)
  const bCreatedAt = getCreatedAtSortKey(b.createdAt)

  if (aCreatedAt === bCreatedAt) {
    return (a.tid || a.id || '').localeCompare(b.tid || b.id || '')
  }

  return aCreatedAt < bCreatedAt ? -1 : 1
}

export const getMessageLocalRef = (message?: Partial<Pick<IMessage, 'id' | 'tid' | 'createdAt'>> | null) => {
  if (!message) {
    return ''
  }
  if (message.id) {
    return message.id
  }
  if (message.tid) {
    return message.tid
  }
  return getCreatedAtSortKey(message.createdAt).toString()
}

export const messagesShareReference = (
  left?: Partial<Pick<IMessage, 'id' | 'tid'>> | null,
  right?: Partial<Pick<IMessage, 'id' | 'tid'>> | null
) => {
  if (!left || !right) {
    return false
  }

  const leftRefs = [left.id, left.tid].filter(Boolean)
  const rightRefs = [right.id, right.tid].filter(Boolean)

  return leftRefs.some((leftRef) => rightRefs.includes(leftRef))
}

export const compareMessagesForList = (a: IMessage, b: IMessage) => {
  const aKey = getMessageSortKey(a)
  const bKey = getMessageSortKey(b)
  if (aKey === bKey) {
    return (a.tid || a.id || '').localeCompare(b.tid || b.id || '')
  }
  return aKey < bKey ? -1 : 1
}

export const shouldReplaceLastMessage = (
  currentLastMessage: IMessage | null | undefined,
  nextLastMessage: IMessage,
  sourceMessage?: IMessage | null
) => {
  if (!nextLastMessage?.id) {
    return false
  }

  if (!currentLastMessage) {
    return true
  }

  if (!currentLastMessage.id) {
    if (messagesShareReference(currentLastMessage, nextLastMessage)) {
      return true
    }
    return false
  }

  if (sourceMessage && getMessageLocalRef(currentLastMessage) === getMessageLocalRef(sourceMessage)) {
    return true
  }

  return compareMessagesForList(nextLastMessage, currentLastMessage) >= 0
}

export const getFirstConfirmedMessageId = (messages: IMessage[]) =>
  messages.find((message) => !!message.id)?.id || undefined

export const getLastConfirmedMessageId = (messages: IMessage[]) => {
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index]?.id) {
      return messages[index].id
    }
  }
  return ''
}

export const getFirstConfirmedMessage = (messages: IMessage[]): IMessage | undefined => messages.find((m) => !!m.id)

export const getLastConfirmedMessage = (messages: IMessage[]): IMessage | undefined => {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.id || messages[i]?.tid) return messages[i]
  }
  return undefined
}

export const getClosestConfirmedMessageId = (
  messages: IMessage[],
  index: number,
  preferredDirection: 'previous' | 'next' | 'nearest' = 'nearest'
) => {
  if (!messages.length) {
    return ''
  }

  const safeIndex = Math.max(0, Math.min(index, messages.length - 1))

  for (let offset = 0; offset < messages.length; offset++) {
    const candidates =
      preferredDirection === 'previous'
        ? [safeIndex - offset, safeIndex + offset]
        : preferredDirection === 'next'
          ? [safeIndex + offset, safeIndex - offset]
          : [safeIndex - offset, safeIndex + offset]

    for (const candidateIndex of candidates) {
      if (candidateIndex < 0 || candidateIndex >= messages.length) {
        continue
      }
      if (messages[candidateIndex]?.id) {
        return messages[candidateIndex].id
      }
    }
  }

  return ''
}

export function getLatestMessagesFromMap(channelId: string, limit: number): IMessage[] {
  return Object.values(messagesMap[channelId] || {})
    .filter((m) => !!m.id || m.tid)
    .sort(compareMessagesForList)
    .slice(-limit)
}

export function getLatestCachedConfirmedMessageId(channelId: string): string {
  const latestSegment = loadedSegmentsMap[channelId]?.at(-1)
  if (latestSegment?.endId) {
    return latestSegment.endId
  }

  const latestConfirmedMessage = Object.values(messagesMap[channelId] || {})
    .filter((message): message is IMessage => !!message.id)
    .sort(compareMessagesForList)
    .at(-1)

  return latestConfirmedMessage?.id || ''
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
      if (
        element.id &&
        compareMessageIds(element.id, firstMessageId) >= 0 &&
        compareMessageIds(element.id, lastMessageId) <= 0
      ) {
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
  const channelMessages = messagesMap[channelId]
  const existingById = message.id ? channelMessages[message.id] : undefined
  const existingByTid = message.tid ? channelMessages[message.tid] : undefined
  const existing =
    existingById ||
    existingByTid ||
    Object.values(channelMessages).find(
      (m) => (message.id && m.id === message.id) || (message.tid && m.tid === message.tid)
    )

  if (existing) {
    const merged = {
      ...existing,
      id: message.id,
      deliveryStatus: message.deliveryStatus,
      state: MESSAGE_STATUS.UNMODIFIED
    }
    if (existing.tid && channelMessages[existing.tid] && existing.tid !== (existing.id || existing.tid)) {
      delete channelMessages[existing.tid]
    }
    channelMessages[existing.id || existing.tid!] = merged
    return
  }

  channelMessages[message.id || message.tid!] = message
}

export function checkIsItSentAlready(messageId: string, channelId: string) {
  if (messagesMap[channelId]) {
    const messages = Object.values(messagesMap[channelId] || {})
    const message = messages.find((m) => m.tid === messageId || m.id === messageId)
    if (
      message?.deliveryStatus === MESSAGE_DELIVERY_STATUS.SENT ||
      message?.deliveryStatus === MESSAGE_DELIVERY_STATUS.DELIVERED ||
      message?.deliveryStatus === MESSAGE_DELIVERY_STATUS.READ ||
      message?.deliveryStatus === MESSAGE_DELIVERY_STATUS.PLAYED ||
      message?.deliveryStatus === MESSAGE_DELIVERY_STATUS.OPENED
    ) {
      return true
    }
  }
  return false
}

export function updateMessageOnMap(
  channelId: string,
  updatedMessage: { messageId: string; params: any },
  voteDetails?: {
    vote?: IPollVote
    type: 'add' | 'delete' | 'addOwn' | 'deleteOwn' | 'close'
  }
) {
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
          const statusUpdatedMessage = updatedMessage.params?.deliveryStatus
            ? updateMessageDeliveryStatusAndMarkers(mes, updatedMessage.params.deliveryStatus)
            : {}
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

export function getMessageFromMap(channelId: string, messageId: string) {
  const channelMessages = messagesMap[channelId]
  if (!channelMessages) {
    return null
  }
  if (channelMessages[messageId]) {
    return channelMessages[messageId]
  }
  return Object.values(channelMessages).find((message) => message.id === messageId || message.tid === messageId) || null
}

export function removeMessagesFromMap(channelId: string) {
  delete messagesMap[channelId]
  delete loadedSegmentsMap[channelId]
}

export function removeMessageFromMap(channelId: string, messageId: string) {
  if (messagesMap[channelId] && messagesMap[channelId][messageId]) {
    delete messagesMap[channelId][messageId]
    return
  }
  if (messagesMap[channelId]) {
    for (const key in messagesMap[channelId]) {
      if (!Object.prototype.hasOwnProperty.call(messagesMap[channelId], key)) {
        continue
      }
      const message = messagesMap[channelId][key]
      if (message.id === messageId || message.tid === messageId) {
        delete messagesMap[channelId][key]
        return
      }
    }
  }
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

export function getPendingMessagesFromMap(channelId: string): IMessage[] {
  return Object.values(messagesMap[channelId] || {})
    .filter((message) => !message.id && !!message.tid)
    .sort(comparePendingMessages)
}

export function getAllPendingFromMap(): { [channelId: string]: IMessage[] } {
  const result: { [channelId: string]: IMessage[] } = {}
  for (const channelId in messagesMap) {
    if (!Object.prototype.hasOwnProperty.call(messagesMap, channelId)) {
      continue
    }
    const pendingMessages = getPendingMessagesFromMap(channelId)
    if (pendingMessages.length > 0) {
      result[channelId] = pendingMessages
    }
  }
  return result
}

export function getLatestPendingMessageFromMap(
  channelId: string,
  excludeMessage?: Partial<Pick<IMessage, 'id' | 'tid'>> | null
): IMessage | null {
  const pendingMessages = getPendingMessagesFromMap(channelId)

  for (let index = pendingMessages.length - 1; index >= 0; index--) {
    if (!excludeMessage || !messagesShareReference(pendingMessages[index], excludeMessage)) {
      return pendingMessages[index]
    }
  }

  return null
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
  const localRef = getMessageLocalRef(message)
  if (!localRef) {
    return
  }
  visibleMessagesMap[localRef] = {
    id: message.id,
    localRef,
    sortKey: getMessageSortKey(message).toString()
  }
}

export const removeMessageFromVisibleMessagesMap = (message: IMessage) => {
  delete visibleMessagesMap[getMessageLocalRef(message)]
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
  if (!messages.length) {
    return {
      mid1: { messageId: '', index: 0 },
      mid2: { messageId: '', index: 0 }
    }
  }

  const mid = Math.floor(messages.length / 2)

  if (messages.length === 1) {
    return {
      mid1: {
        messageId: getClosestConfirmedMessageId(messages, 0, 'previous'),
        index: 0
      },
      mid2: {
        messageId: getClosestConfirmedMessageId(messages, 0, 'next'),
        index: 0
      }
    }
  }

  if (messages.length % 2 === 0) {
    return {
      mid1: {
        messageId: getClosestConfirmedMessageId(messages, mid - 1, 'previous'),
        index: mid - 1
      },
      mid2: {
        messageId: getClosestConfirmedMessageId(messages, mid, 'next'),
        index: mid
      }
    }
  }

  return {
    mid1: {
      messageId: getClosestConfirmedMessageId(messages, mid - 1, 'previous'),
      index: mid - 1
    },
    mid2: {
      messageId: getClosestConfirmedMessageId(messages, mid + 1, 'next'),
      index: mid + 1
    }
  }
}
