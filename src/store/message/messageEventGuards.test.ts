import MessageReducer, { setMessages, updateMessage } from './reducers'
import {
  addMessageToMap,
  clearMessagesMap,
  getMessagesFromMap,
  updateMessageOnMap,
  updateMessageDeliveryStatusAndMarkers
} from '../../helpers/messagesHalper'
import { MESSAGE_DELIVERY_STATUS, MESSAGE_STATUS } from '../../helpers/constants'
import { MESSAGE_TYPE } from '../../types/enum'
import { makeMessage, makeUser } from '../../testUtils/messageFixtures'
import { IMessage } from '../../types'

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
