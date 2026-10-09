import { addMessageToMap, clearMessagesMap, getMessagesFromMap, updateMessageStatusOnMap } from './index'
import { MESSAGE_DELIVERY_STATUS } from '../constants'
import { makeMessage, makePendingMessage } from '../../testUtils/messageFixtures'

describe('delayed confirmation delivery status', () => {
  const channelId = 'channel-delayed-confirmation'

  beforeEach(() => clearMessagesMap())
  afterEach(() => clearMessagesMap())

  it('keeps an earlier read message read when a late sent echo arrives after a newer message', () => {
    const pending = makePendingMessage({ channelId, tid: 'local-message' })
    const confirmed = makeMessage({ channelId, id: '900001', tid: pending.tid })
    addMessageToMap(channelId, pending)
    addMessageToMap(channelId, confirmed)
    updateMessageStatusOnMap(channelId, {
      name: MESSAGE_DELIVERY_STATUS.READ,
      markersMap: { [confirmed.id]: true }
    })
    expect(getMessagesFromMap(channelId)[confirmed.id].deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.READ)
    const newer = makeMessage({ channelId, id: '900002', tid: 'newer-message' })
    addMessageToMap(channelId, newer)

    addMessageToMap(channelId, { ...confirmed, deliveryStatus: MESSAGE_DELIVERY_STATUS.SENT })

    expect({
      earlier: getMessagesFromMap(channelId)[confirmed.id].deliveryStatus,
      newer: getMessagesFromMap(channelId)[newer.id].deliveryStatus,
      keys: Object.keys(getMessagesFromMap(channelId))
    }).toEqual({
      earlier: MESSAGE_DELIVERY_STATUS.READ,
      newer: MESSAGE_DELIVERY_STATUS.SENT,
      keys: [confirmed.id, newer.id]
    })
  })
})
