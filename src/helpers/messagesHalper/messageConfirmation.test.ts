import { addMessageToMap, clearMessagesMap, getMessagesFromMap, updateMessageStatusOnMap } from './index'
import { MESSAGE_DELIVERY_STATUS } from '../constants'
import { makeMessage, makePendingMessage } from '../../testUtils/messageFixtures'

describe('message cache confirmation', () => {
  const channelId = 'channel-confirmation'

  beforeEach(() => clearMessagesMap())
  afterEach(() => clearMessagesMap())

  it('stores an unconfirmed message under its temporary id', () => {
    const pending = makePendingMessage({ channelId, tid: 'local-message' })
    addMessageToMap(channelId, pending)

    expect(getMessagesFromMap(channelId)).toEqual({ [pending.tid!]: pending })
  })

  it('moves a pending message to its server id while retaining its temporary reference and local data', () => {
    const pending = makePendingMessage({ channelId, tid: 'local-message', metadata: 'local-metadata' })
    addMessageToMap(channelId, pending)
    addMessageToMap(channelId, makeMessage({ channelId, id: '900001', tid: pending.tid }))

    const cache = getMessagesFromMap(channelId)
    expect(Object.keys(cache)).toEqual(['900001'])
    expect(cache['900001']).toEqual(
      expect.objectContaining({ id: '900001', tid: pending.tid, metadata: pending.metadata })
    )
    expect(cache[pending.tid!]).toBeUndefined()
  })

  it('keeps one server-keyed entry when confirmation is followed by its duplicate echo', () => {
    const pending = makePendingMessage({ channelId, tid: 'local-message' })
    const confirmed = makeMessage({ channelId, id: '900001', tid: pending.tid })
    addMessageToMap(channelId, pending)
    addMessageToMap(channelId, confirmed)
    addMessageToMap(channelId, { ...confirmed })

    expect(Object.keys(getMessagesFromMap(channelId))).toEqual([confirmed.id])
    expect(getMessagesFromMap(channelId)[confirmed.id].tid).toBe(pending.tid)
  })

  it('removes a pending alias when the server-keyed entry already exists', () => {
    const pending = makePendingMessage({ channelId, tid: 'local-message' })
    const confirmed = makeMessage({ channelId, id: '900001', tid: pending.tid })
    addMessageToMap(channelId, confirmed)
    // Both copies can exist when confirmation and pending insertion race.
    getMessagesFromMap(channelId)[pending.tid!] = pending
    addMessageToMap(channelId, { ...confirmed })

    expect(Object.keys(getMessagesFromMap(channelId))).toEqual([confirmed.id])
  })

  it('applies server-id delivery markers after confirmation and retains read after a late delivered marker', () => {
    const pending = makePendingMessage({ channelId, tid: 'local-message' })
    const confirmed = makeMessage({ channelId, id: '900001', tid: pending.tid })
    addMessageToMap(channelId, pending)
    addMessageToMap(channelId, confirmed)

    for (const status of [MESSAGE_DELIVERY_STATUS.DELIVERED, MESSAGE_DELIVERY_STATUS.READ]) {
      updateMessageStatusOnMap(channelId, { name: status, markersMap: { [confirmed.id]: true } })
      expect(getMessagesFromMap(channelId)[confirmed.id]?.deliveryStatus).toBe(status)
    }
    updateMessageStatusOnMap(channelId, {
      name: MESSAGE_DELIVERY_STATUS.DELIVERED,
      markersMap: { [confirmed.id]: true }
    })
    expect(getMessagesFromMap(channelId)[confirmed.id].deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.READ)
  })
})
