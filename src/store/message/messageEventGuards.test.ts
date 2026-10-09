import MessageReducer, { setMessages, updateMessage } from './reducers'
import {
  addMessageToMap,
  clearMessagesMap,
  getMessagesFromMap,
  hasAppliedRemoteMarker,
  updateMessageOnMap,
  updateMessageDeliveryStatusAndMarkers
} from '../../helpers/messagesHalper'
import { MESSAGE_DELIVERY_STATUS, MESSAGE_STATUS } from '../../helpers/constants'
import { MESSAGE_TYPE } from '../../types/enum'
import { makeMessage, makeUser } from '../../testUtils/messageFixtures'
import { IMessage } from '../../types'
import { shouldSkipMessageContentUpdate } from '../../helpers/messageContentUpdate'

const earlier = new Date('2026-04-02T12:00:00Z')
const later = new Date('2026-04-02T12:01:00Z')
const channelId = 'event-guards'
const original = () =>
  makeMessage({ channelId, id: '9007199254741001', body: 'first edit', state: MESSAGE_STATUS.EDIT, updatedAt: earlier })
const receipt = (message: IMessage, userId = 'recipient', name = MESSAGE_DELIVERY_STATUS.READ) => ({
  deliveryStatus: name,
  marker: { name, messageIds: [message.id], user: makeUser({ id: userId }), createdAt: earlier }
})
const total = (count: number): IMessage['markerTotals'] =>
  [{ name: MESSAGE_DELIVERY_STATUS.READ, count }] as IMessage['markerTotals']

beforeEach(() => clearMessagesMap())
afterEach(() => clearMessagesMap())

it.each([MESSAGE_STATUS.DELETE, MESSAGE_STATUS.EDIT])(
  'protects a %s source and quoted copies from stale edits',
  (state) => {
    const first = original()
    const known = {
      ...first,
      state,
      body: state === MESSAGE_STATUS.DELETE ? '' : 'second edit',
      updatedAt: later,
      type: state === MESSAGE_STATUS.DELETE ? MESSAGE_TYPE.DELETED : MESSAGE_TYPE.TEXT
    }
    const reply = makeMessage({ channelId, id: '9007199254741002', parentMessage: known })
    addMessageToMap(channelId, known)
    addMessageToMap(channelId, reply)
    updateMessageOnMap(channelId, { messageId: first.id, params: first })
    expect(getMessagesFromMap(channelId)[first.id]).toEqual(known)
    expect(getMessagesFromMap(channelId)[reply.id].parentMessage).toEqual(known)
    const initial = MessageReducer(undefined, setMessages({ messages: [known, reply] }))
    const next = MessageReducer(initial, updateMessage({ messageId: first.id, params: first }))
    expect(next.activeChannelMessages[0]).toEqual(known)
    expect(next.activeChannelMessages[1].parentMessage).toEqual(known)
  }
)

it.each([undefined, new Date('invalid')])('accepts edits when timestamps cannot establish order (%s)', (updatedAt) => {
  const first = original()
  const known = { ...first, updatedAt: later }
  addMessageToMap(channelId, known)
  const incoming = { ...first, body: 'undated edit', updatedAt }
  updateMessageOnMap(channelId, { messageId: first.id, params: incoming })
  expect(getMessagesFromMap(channelId)[first.id].body).toBe(incoming.body)
})

it.each([undefined, new Date(later.getTime() + 60000)])(
  'keeps deletion terminal even for an edit timestamp of %s',
  (updatedAt) => {
    const first = original()
    const removed = { ...first, state: MESSAGE_STATUS.DELETE, type: MESSAGE_TYPE.DELETED, body: '', updatedAt: later }
    addMessageToMap(channelId, removed)
    const incoming = { ...first, updatedAt }
    updateMessageOnMap(channelId, { messageId: first.id, params: incoming })
    expect(getMessagesFromMap(channelId)[first.id]).toEqual(removed)
    const initial = MessageReducer(undefined, setMessages({ messages: [removed] }))
    expect(
      MessageReducer(initial, updateMessage({ messageId: first.id, params: incoming })).activeChannelMessages
    ).toEqual([removed])
  }
)

it('accepts edits with equal timestamps rather than assuming timestamp precision proves they are duplicates', () => {
  const first = original()
  addMessageToMap(channelId, first)
  updateMessageOnMap(channelId, { messageId: first.id, params: { ...first, body: 'same timestamp edit' } })
  expect(getMessagesFromMap(channelId)[first.id].body).toBe('same timestamp edit')
})

it('does not share receipt consumption between independent message copies', () => {
  const message = original()
  const copies = [message, { ...message }, { ...message }].map((copy) => ({
    ...copy,
    ...updateMessageDeliveryStatusAndMarkers(copy, receipt(copy))
  }))
  for (const copy of copies) {
    expect(copy.markerTotals).toEqual(total(1))
    expect(updateMessageDeliveryStatusAndMarkers(copy, receipt(copy)).markerTotals).toEqual(total(1))
  }
  expect(message.markerTotals).toEqual([])
})

it('deduplicates a recipient across timestamps, while counting different marker names separately', () => {
  const message = original()
  const read = { ...message, ...updateMessageDeliveryStatusAndMarkers(message, receipt(message)) }
  const duplicate = receipt(read)
  duplicate.marker.createdAt = later
  const repeated = { ...read, ...updateMessageDeliveryStatusAndMarkers(read, duplicate) }
  expect(repeated.markerTotals).toEqual(total(1))
  const delivered = updateMessageDeliveryStatusAndMarkers(
    repeated,
    receipt(repeated, 'recipient', MESSAGE_DELIVERY_STATUS.DELIVERED)
  )
  expect(delivered.deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.READ)
  expect(delivered.markerTotals).toEqual([...total(1), { name: MESSAGE_DELIVERY_STATUS.DELIVERED, count: 1 }])
})

it('retains authoritative server totals and known receipt identities across a content update', () => {
  const message = original()
  addMessageToMap(channelId, message)
  const params = receipt(message)
  const first = { ...message, ...updateMessageDeliveryStatusAndMarkers(message, params) }
  getMessagesFromMap(channelId)[message.id] = first
  updateMessageOnMap(channelId, {
    messageId: message.id,
    params: { ...first, body: 'new body', markerTotals: total(2), updatedAt: later }
  })
  const merged = getMessagesFromMap(channelId)[message.id]
  expect(merged.markerTotals).toEqual(total(2))
  expect(updateMessageDeliveryStatusAndMarkers(merged, params).markerTotals).toEqual(total(2))
  expect(updateMessageDeliveryStatusAndMarkers(merged, { ...params, markerTotals: total(0) }).markerTotals).toEqual(
    total(0)
  )
  expect(JSON.stringify(merged)).not.toContain('recipient')
})

it('does not invent receipt counts when a server snapshot supplies empty totals', () => {
  const message = original()
  expect(
    updateMessageDeliveryStatusAndMarkers(message, {
      deliveryStatus: MESSAGE_DELIVERY_STATUS.SENT,
      markerTotals: []
    }).markerTotals
  ).toEqual([])
})

it.each(['message', 'channel'] as const)('keeps receipt identity isolated by %s', (scope) => {
  const message = original()
  const params = receipt(message)
  const read = { ...message, ...updateMessageDeliveryStatusAndMarkers(message, params) }
  const other = {
    ...read,
    ...(scope === 'message' ? { id: '9007199254741002' } : { channelId: 'other-channel' }),
    markerTotals: []
  }
  expect(hasAppliedRemoteMarker(read, params.marker)).toBe(true)
  expect(hasAppliedRemoteMarker(other, params.marker)).toBe(false)
  expect(updateMessageDeliveryStatusAndMarkers(other, receipt(other)).markerTotals).toEqual(total(1))
  expect(read.markerTotals).toEqual(total(1))
})

it('keeps receipt provenance immutable when another reader is added', () => {
  const message = original()
  const firstReceipt = receipt(message, 'reader-a')
  const secondReceipt = receipt(message, 'reader-b')
  const first = { ...message, ...updateMessageDeliveryStatusAndMarkers(message, firstReceipt) }
  const second = { ...first, ...updateMessageDeliveryStatusAndMarkers(first, secondReceipt) }
  expect(hasAppliedRemoteMarker(message, firstReceipt.marker)).toBe(false)
  expect(hasAppliedRemoteMarker(first, secondReceipt.marker)).toBe(false)
  expect(hasAppliedRemoteMarker(second, firstReceipt.marker)).toBe(true)
  expect(hasAppliedRemoteMarker(second, secondReceipt.marker)).toBe(true)
  expect(first.markerTotals).toEqual(total(1))
  expect(second.markerTotals).toEqual(total(2))
})

it('keeps own read markers separate from remote reader totals', () => {
  const message = original()
  const params = receipt(message, 'current-user')
  const first = { ...message, ...updateMessageDeliveryStatusAndMarkers(message, params, true) }
  const repeated = { ...first, ...updateMessageDeliveryStatusAndMarkers(first, params, true) }
  expect(repeated.userMarkers).toHaveLength(1)
  expect(repeated.markerTotals).toEqual([])
  expect(hasAppliedRemoteMarker(repeated, params.marker)).toBe(false)
  expect(updateMessageDeliveryStatusAndMarkers(repeated, receipt(message, 'other-user')).markerTotals).toEqual(total(1))
})

it('leaves status and receipt collections intact when no delivery status is supplied', () => {
  const message = { ...original(), deliveryStatus: MESSAGE_DELIVERY_STATUS.READ, markerTotals: total(2) }
  const patch = updateMessageDeliveryStatusAndMarkers(message, { markerTotals: total(0) })
  expect({ ...message, ...patch }).toEqual(message)
})

it.each([undefined, new Date('invalid')])('accepts a dated edit when the known timestamp is %s', (updatedAt) => {
  expect(shouldSkipMessageContentUpdate({ ...original(), updatedAt }, { ...original(), updatedAt: earlier })).toBe(
    false
  )
})

it.each([
  [later.toISOString(), earlier],
  [later, earlier.toISOString()],
  [later.getTime(), earlier.getTime()]
])('orders edit timestamps restored from serialized snapshots (%s, %s)', (knownTime, incomingTime) => {
  expect(
    shouldSkipMessageContentUpdate(
      { ...original(), updatedAt: knownTime as unknown as Date },
      { ...original(), updatedAt: incomingTime as unknown as Date }
    )
  ).toBe(true)
})

it.each([MESSAGE_STATUS.EDIT, MESSAGE_STATUS.DELETE])(
  'allows a delivery-only update without changing %s content',
  (state) => {
    const known = { ...original(), state, body: state === MESSAGE_STATUS.DELETE ? '' : 'new text', updatedAt: later }
    addMessageToMap(channelId, known)
    const params = { deliveryStatus: MESSAGE_DELIVERY_STATUS.READ }
    updateMessageOnMap(channelId, { messageId: known.id, params })
    const initial = MessageReducer(undefined, setMessages({ messages: [known] }))
    const next = MessageReducer(initial, updateMessage({ messageId: known.id, params }))
    for (const copy of [getMessagesFromMap(channelId)[known.id], next.activeChannelMessages[0]]) {
      expect(copy).toMatchObject({
        id: known.id,
        body: known.body,
        state: known.state,
        type: known.type,
        updatedAt: known.updatedAt,
        deliveryStatus: MESSAGE_DELIVERY_STATUS.READ
      })
    }
  }
)

it.each([MESSAGE_STATUS.EDIT, MESSAGE_STATUS.DELETE])(
  'restores source and quoted content after an explicitly allowed failed optimistic %s',
  (state) => {
    const restored = original()
    const optimistic = {
      ...restored,
      state,
      body: state === MESSAGE_STATUS.DELETE ? '' : 'queued edit',
      updatedAt: later
    }
    const reply = makeMessage({ channelId, id: '9007199254741002', parentMessage: optimistic })
    addMessageToMap(channelId, optimistic)
    addMessageToMap(channelId, reply)
    const payload = { messageId: restored.id, params: restored, allowStaleContent: true }
    updateMessageOnMap(channelId, payload)
    const initial = MessageReducer(undefined, setMessages({ messages: [optimistic, reply] }))
    const next = MessageReducer(initial, updateMessage(payload))
    expect(getMessagesFromMap(channelId)[restored.id]).toEqual(restored)
    expect(getMessagesFromMap(channelId)[reply.id].parentMessage).toEqual(restored)
    expect(next.activeChannelMessages[0]).toEqual(restored)
    expect(next.activeChannelMessages[1].parentMessage).toEqual(restored)
  }
)

it('updates a quoted parent with a newer edit even when the source is outside the loaded window', () => {
  const parent = original()
  const reply = makeMessage({ channelId, id: '9007199254741002', parentMessage: parent })
  const params = { ...parent, body: 'new quoted text', updatedAt: later }
  addMessageToMap(channelId, reply)
  updateMessageOnMap(channelId, { messageId: parent.id, params })
  const initial = MessageReducer(undefined, setMessages({ messages: [reply] }))
  const next = MessageReducer(initial, updateMessage({ messageId: parent.id, params }))
  expect(Object.keys(getMessagesFromMap(channelId))).toEqual([reply.id])
  expect(getMessagesFromMap(channelId)[reply.id].parentMessage).toEqual(params)
  expect(next.activeChannelMessages).toHaveLength(1)
  expect(next.activeChannelMessages[0].parentMessage).toEqual(params)
})
