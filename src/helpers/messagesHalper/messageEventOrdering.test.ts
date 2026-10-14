import {
  addMessageToMap,
  clearMessagesMap,
  getMessagesFromMap,
  updateMessageOnMap,
  updateMessageStatusOnMap
} from './index'
import { MESSAGE_DELIVERY_STATUS, MESSAGE_STATUS } from '../constants'
import { makeMessage, makeUser, resetMessageListFixtureIds } from '../../testUtils/messageFixtures'
import { MESSAGE_TYPE } from '../../types/enum'

describe('message cache event ordering', () => {
  const channelId = 'event-order-channel'
  const messageId = '9007199254741001'
  const earlier = new Date('2026-04-02T12:00:00.000Z')
  const later = new Date('2026-04-02T12:01:00.000Z')
  const cached = () => getMessagesFromMap(channelId)[messageId]

  beforeEach(() => {
    resetMessageListFixtureIds()
    clearMessagesMap()
    addMessageToMap(channelId, makeMessage({ id: messageId, channelId, incoming: false }))
  })
  afterEach(() => clearMessagesMap())

  it('counts a repeated read marker from the same recipient once', () => {
    const marker = {
      name: MESSAGE_DELIVERY_STATUS.READ,
      messageIds: [messageId],
      messageId,
      count: 1,
      user: makeUser({ id: 'recipient' }),
      createdAt: earlier
    }
    const event = { name: marker.name, markersMap: { [messageId]: true }, marker }
    updateMessageStatusOnMap(channelId, event)
    expect(cached().markerTotals).toEqual([{ name: marker.name, count: 1 }])

    updateMessageStatusOnMap(channelId, event)

    expect(cached().deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.READ)
    expect(cached().markerTotals).toEqual([{ name: marker.name, count: 1 }])
  })

  it('counts read markers from two different recipients separately', () => {
    for (const id of ['recipient-a', 'recipient-b']) {
      updateMessageStatusOnMap(channelId, {
        name: MESSAGE_DELIVERY_STATUS.READ,
        markersMap: { [messageId]: true },
        marker: {
          name: MESSAGE_DELIVERY_STATUS.READ,
          messageIds: [messageId],
          messageId,
          count: 1,
          user: makeUser({ id }),
          createdAt: earlier
        }
      })
    }

    expect(cached().deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.READ)
    expect(cached().markerTotals).toEqual([{ name: MESSAGE_DELIVERY_STATUS.READ, count: 2 }])
  })

  it('preserves the newer edit when an older edit arrives afterwards', () => {
    const first = { ...cached(), body: 'first edit', state: MESSAGE_STATUS.EDIT, updatedAt: earlier }
    const second = { ...first, body: 'second edit', updatedAt: later }
    updateMessageOnMap(channelId, { messageId, params: second })
    expect(cached().body).toBe(second.body)

    updateMessageOnMap(channelId, { messageId, params: first })

    expect({ body: cached().body, updatedAt: cached().updatedAt, state: cached().state }).toEqual({
      body: second.body,
      updatedAt: later,
      state: MESSAGE_STATUS.EDIT
    })
  })

  it('keeps a deleted message deleted when an earlier edit is replayed', () => {
    const edited = { ...cached(), body: 'edited before deletion', state: MESSAGE_STATUS.EDIT, updatedAt: earlier }
    updateMessageOnMap(channelId, { messageId, params: edited })
    const deleted = {
      ...edited,
      body: '',
      type: MESSAGE_TYPE.DELETED,
      attachments: [],
      state: MESSAGE_STATUS.DELETE,
      updatedAt: later
    }
    updateMessageOnMap(channelId, { messageId, params: deleted })
    expect(cached().state).toBe(MESSAGE_STATUS.DELETE)

    updateMessageOnMap(channelId, { messageId, params: edited })

    expect({ body: cached().body, updatedAt: cached().updatedAt, state: cached().state }).toEqual({
      body: '',
      state: MESSAGE_STATUS.DELETE,
      updatedAt: later
    })
  })
})
