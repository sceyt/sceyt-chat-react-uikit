import { call, put, select, takeEvery } from 'redux-saga/effects'
import { v4 as uuidv4 } from 'uuid'
import { getChannelFromMap, getActiveChannelId } from '../../helpers/channelHalper'
import { getClient } from '../../common/client'
import { checkChannelExistsOnMessagesMap, updateMessageOnMap } from '../../helpers/messagesHalper'
import { sendTextMessageAC, updateMessageAC } from '../message/actions'
import { CONNECTION_STATUS } from '../user/constants'
import { MESSAGE_TYPE } from '../../types/enum'
import {
  persistPinMutation,
  persistPinnedMessages,
  removePersistedPinMutation,
  restorePinnedMessages,
  restorePinnedMutations
} from '../../helpers/messagesIdb'
import { setNotification } from '../../helpers/notifications'
import {
  APPLY_PINNED_MESSAGES_EVENT,
  LOAD_PINNED_MESSAGES,
  PIN_MESSAGE,
  RESEND_PENDING_PIN_MUTATIONS,
  UNPIN_MESSAGE
} from './constants'
import {
  removePendingPinMutationAC,
  removePinnedMessagesAC,
  setPendingPinMutationAC,
  setPinnedMessagesAC,
  upsertPinnedMessagesAC
} from './actions'
import { PendingPinMutation, PinnedMessageRecord } from './reducers'

const pinScopeShared = 0
const sharedPinSystemMessage = (parentMessageId: string) => ({
  body: 'PM',
  type: MESSAGE_TYPE.SYSTEM,
  attachments: [],
  bodyAttributes: [],
  metadata: {},
  mentionedUsers: [],
  displayCount: 0,
  silent: true,
  skipAutoScroll: true,
  parentMessage: { id: parentMessageId }
})

const getChannel = (channelId: string) => getChannelFromMap(channelId) as any
const normalizePins = (pins: any[] = []): PinnedMessageRecord[] =>
  pins.map((pin) => ({
    ...pin,
    id: String(pin.id),
    pinType: Number(pin.pinType),
    message: pin.message
  }))

const sourceMessageId = (pin: PinnedMessageRecord) => pin.message?.id || pin.message?.tid

function* persistChannelPins(channelId: string): any {
  const state = yield select((store: any) => store.PinnedReducer)
  yield call(persistPinnedMessages, channelId, state.byChannel[channelId] || [], state.cursors[channelId])
}

function* loadPinnedMessages({ payload }: any): any {
  const { channelId, nextToken, restoreCache } = payload
  if (restoreCache) {
    const cached = yield call(restorePinnedMessages, channelId)
    if (cached) {
      yield put(setPinnedMessagesAC(channelId, cached.pins || [], cached.nextToken))
    }
  }

  const channel = getChannel(channelId)
  if (!channel?.createPinnedMessageListQueryBuilder) return
  try {
    const builder = channel.createPinnedMessageListQueryBuilder().limit(10)
    builder.byDescendingOrder()
    if (nextToken && builder.setNextToken) {
      builder.setNextToken(nextToken)
    }
    const query = yield call([builder, builder.build])
    const response = yield call([query, query.loadNext])
    const pins = normalizePins(response.pins)
    yield put(setPinnedMessagesAC(channelId, pins, query.nextToken, !!nextToken))
    yield call(updateLoadedMessagesPinState, channelId, pins)
    yield call(persistChannelPins, channelId)
  } catch (error) {
    console.log(error)
    // Cached pins remain visible until the next reconnect.
  }
}

function* queueMutation(mutation: PendingPinMutation): any {
  yield put(setPendingPinMutationAC(mutation))
  yield call(persistPinMutation, mutation)
}

function* executePin(mutation: PendingPinMutation, message?: any): any {
  const channel = getChannel(mutation.channelId)
  if (!channel) throw new Error('Channel is not available')
  if (mutation.operation === 'PIN') {
    const event = yield call([channel, channel.pinMessage], message || mutation.messageId, mutation.pinType)
    const pins = normalizePins(event?.pins)
    if (pins.length) yield put(upsertPinnedMessagesAC(mutation.channelId, pins))
    if (mutation.pinType === pinScopeShared && event?.changed) {
      yield put(
        sendTextMessageAC(sharedPinSystemMessage(mutation.messageId), mutation.channelId, CONNECTION_STATUS.CONNECTED)
      )
    }
    const changedPins: PinnedMessageRecord[] = pins.length
      ? pins
      : [{ id: mutation.messageId, pinType: mutation.pinType ?? pinScopeShared, message }]
    yield call(updateLoadedMessagesPinState, mutation.channelId, changedPins, true)
  } else {
    const event = yield call([channel, channel.unpinMessage], mutation.messageId, mutation.pinType)
    const pins = normalizePins(event?.pins)
    const pinIds = pins.map((pin) => pin.id)
    yield put(removePinnedMessagesAC(mutation.channelId, pinIds, [mutation.messageId], mutation.pinType))
    const changedPins: PinnedMessageRecord[] = pins.length
      ? pins
      : [{ id: mutation.messageId, pinType: mutation.pinType ?? pinScopeShared, message: { id: mutation.messageId } }]
    yield call(updateLoadedMessagesPinState, mutation.channelId, changedPins)
  }
  yield put(removePendingPinMutationAC(mutation.id))
  yield call(removePersistedPinMutation, mutation.id)
  yield call(persistChannelPins, mutation.channelId)
}

function* pinMessage({ payload }: any): any {
  const mutation: PendingPinMutation = {
    id: uuidv4(),
    channelId: payload.channelId,
    operation: 'PIN',
    messageId: payload.message.id || payload.message.tid,
    pinType: payload.pinType,
    queuedAt: Date.now()
  }
  try {
    yield call(executePin, mutation, payload.message)
  } catch (_) {
    yield call(queueMutation, mutation)
  }
}

function* unpinMessage({ payload }: any): any {
  const pin = payload.pin
  const mutation: PendingPinMutation = {
    id: uuidv4(),
    channelId: payload.channelId,
    operation: 'UNPIN',
    messageId: pin.message?.id || pin.message?.tid,
    pinType: pin.pinType,
    queuedAt: Date.now()
  }
  try {
    yield call(executePin, mutation)
  } catch (_) {
    yield call(queueMutation, mutation)
  }
}

/**
 * Pinned-message BMPs are delivered independently from the message stream.
 * Keep every already-loaded source message in sync, so action menus update
 * without waiting for history to be fetched again.
 */
function* updateLoadedMessagesPinState(
  channelId: string,
  pins: PinnedMessageRecord[],
  forcedPinnedState?: boolean
): any {
  if (!pins.length) return

  const state = yield select((store: any) => store.PinnedReducer)
  const channelPins: PinnedMessageRecord[] = state.byChannel[channelId] || []
  const activeChannelId = getActiveChannelId()

  for (const pin of pins) {
    const messageId = sourceMessageId(pin)
    if (!messageId) continue

    const stillPinned = forcedPinnedState ?? channelPins.some((candidate) => sourceMessageId(candidate) === messageId)
    const pinnedTill = pin.message?.pinDetails?.pinnedTill || pin.pinTill || undefined
    const params = {
      pinDetails: {
        pinned: stillPinned,
        ...(stillPinned && pinnedTill ? { pinnedTill } : {})
      }
    }

    if (activeChannelId === channelId) {
      yield put(updateMessageAC(messageId, params))
    }
    if (checkChannelExistsOnMessagesMap(channelId)) {
      updateMessageOnMap(channelId, { messageId, params })
    }
  }
}

function* applyPinnedMessagesEvent({ payload }: any): any {
  const { channel, event } = payload
  const channelId = channel?.id
  if (!channelId || !event) return
  const pins = normalizePins(event.pins)
  if (event.operation === 0) {
    yield put(upsertPinnedMessagesAC(channelId, pins))
  } else if (event.operation === 1) {
    yield put(
      removePinnedMessagesAC(
        channelId,
        pins.map((pin) => pin.id),
        pins.map((pin) => pin.message?.id),
        event.scope
      )
    )
  }
  yield call(updateLoadedMessagesPinState, channelId, pins)
  yield call(persistChannelPins, channelId)

  const actorId = event.actor?.id
  const client = getClient() as any
  if (
    event.operation === 0 &&
    event.changed &&
    event.scope === pinScopeShared &&
    actorId &&
    actorId !== client?.user?.id &&
    getActiveChannelId() !== channelId &&
    typeof Notification !== 'undefined' &&
    Notification.permission === 'granted'
  ) {
    const name = event.actor?.firstName || event.actor?.username || actorId
    setNotification(`@${name} pinned a message`, event.actor, channel)
  }
}

function* resendPendingPinMutations(): any {
  const pinnedState = yield select((store: any) => store.PinnedReducer)
  const inMemory = Object.values(pinnedState.pendingMutations || {})
  const persisted = yield call(restorePinnedMutations)
  const byId = new Map<string, PendingPinMutation>()
  ;[...inMemory, ...persisted].forEach((mutation: any) => byId.set(mutation.id, mutation))
  for (const mutation of byId.values()) {
    try {
      yield call(executePin, mutation)
    } catch (_) {
      // Leave the durable mutation in place for another reconnect.
    }
  }
  const channelIds = new Set<string>([...Object.keys(pinnedState.byChannel || {}), getActiveChannelId()])
  for (const channelId of channelIds) {
    if (channelId) {
      yield call(loadPinnedMessages, { payload: { channelId, restoreCache: false } })
    }
  }
}

export default function* PinnedMessagesSaga() {
  yield takeEvery(LOAD_PINNED_MESSAGES, loadPinnedMessages)
  yield takeEvery(PIN_MESSAGE, pinMessage)
  yield takeEvery(UNPIN_MESSAGE, unpinMessage)
  yield takeEvery(APPLY_PINNED_MESSAGES_EVENT, applyPinnedMessagesEvent)
  yield takeEvery(RESEND_PENDING_PIN_MUTATIONS, resendPendingPinMutations)
}
