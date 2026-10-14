import {
  hasAppliedRemoteMarker,
  mergeConfirmedMessageDeliveryState,
  resolveRefreshedLastMessage,
  updateMessageDeliveryStatusAndMarkers
} from './index'
import { MESSAGE_DELIVERY_STATUS, MESSAGE_STATUS } from '../constants'
import { makeMessage, makeUser } from '../../testUtils/messageFixtures'
import { IMarker, IMessage } from '../../types'

const channelId = 'delivery-state-merge'
const { SENT, DELIVERED, READ } = MESSAGE_DELIVERY_STATUS
const receipt = (name: string, userId: string) => ({ name, user: makeUser({ id: userId }) })
// A copy that a live receipt event has updated (it records the reader).
const withLiveReceipt = (message: IMessage, name: string, userId: string): IMessage => ({
  ...message,
  ...updateMessageDeliveryStatusAndMarkers(message, { deliveryStatus: name, marker: receipt(name, userId) })
})
const frozen = <T>(value: T): T => Object.freeze(value)
// Receipt totals as the SDK reports them (name and count only).
const totals = (...entries: [string, number][]) => entries.map(([name, count]) => ({ name, count })) as IMarker[]

describe('mergeConfirmedMessageDeliveryState', () => {
  const sent = makeMessage({ id: '9007199254741100', channelId, deliveryStatus: SENT })

  it('keeps the highest status and the highest count per receipt type', () => {
    const read = { ...sent, deliveryStatus: READ, markerTotals: totals([READ, 2]) }
    const delivered = { ...sent, deliveryStatus: DELIVERED, markerTotals: totals([DELIVERED, 3]) }
    const merged = mergeConfirmedMessageDeliveryState(frozen({ ...sent, markerTotals: totals([DELIVERED, 1]) }), [
      frozen(read),
      frozen(delivered)
    ])
    expect(merged.deliveryStatus).toBe(READ)
    expect(merged.markerTotals).toEqual([
      { name: DELIVERED, count: 3 },
      { name: READ, count: 2 }
    ])
  })

  it('never lowers the incoming status', () => {
    const incoming = { ...sent, deliveryStatus: READ }
    expect(mergeConfirmedMessageDeliveryState(incoming, [{ ...sent, deliveryStatus: DELIVERED }])).toBe(incoming)
  })

  it('ignores copies of other messages and returns the input itself when nothing changes', () => {
    const other = makeMessage({ id: '9007199254741101', channelId, deliveryStatus: READ })
    expect(mergeConfirmedMessageDeliveryState(sent, [other, null, undefined, sent])).toBe(sent)
    const pending = { ...sent, id: '' }
    expect(mergeConfirmedMessageDeliveryState(pending, [{ ...sent, deliveryStatus: READ }])).toBe(pending)
  })

  it('carries recorded readers onto a JSON-copied response, so a replayed receipt is recognised', () => {
    const live = withLiveReceipt(sent, DELIVERED, 'reader')
    expect(hasAppliedRemoteMarker(live, receipt(DELIVERED, 'reader'))).toBe(true)
    const response = JSON.parse(JSON.stringify(live)) as IMessage
    expect(hasAppliedRemoteMarker(response, receipt(DELIVERED, 'reader'))).toBe(false)
    const merged = mergeConfirmedMessageDeliveryState(response, [live])
    expect(hasAppliedRemoteMarker(merged, receipt(DELIVERED, 'reader'))).toBe(true)
    expect(hasAppliedRemoteMarker(merged, receipt(DELIVERED, 'someone-else'))).toBe(false)
  })

  it('can merge status and totals without merging readers', () => {
    const live = { ...withLiveReceipt(sent, READ, 'reader'), markerTotals: totals([READ, 1]) }
    const merged = mergeConfirmedMessageDeliveryState(JSON.parse(JSON.stringify(sent)), [live], { receipts: false })
    expect(merged.deliveryStatus).toBe(READ)
    expect(merged.markerTotals).toEqual([{ name: READ, count: 1 }])
    expect(hasAppliedRemoteMarker(merged, receipt(READ, 'reader'))).toBe(false)
  })

  it('unions the readers recorded on different copies', () => {
    const preview = withLiveReceipt(sent, DELIVERED, 'first')
    const cached = withLiveReceipt(sent, DELIVERED, 'second')
    const merged = mergeConfirmedMessageDeliveryState(JSON.parse(JSON.stringify(sent)), [preview, cached])
    expect(hasAppliedRemoteMarker(merged, receipt(DELIVERED, 'first'))).toBe(true)
    expect(hasAppliedRemoteMarker(merged, receipt(DELIVERED, 'second'))).toBe(true)
  })
})

describe('resolveRefreshedLastMessage', () => {
  const older = makeMessage({ id: '9007199254741200', channelId })
  const newer = makeMessage({ id: '9007199254741201', channelId })

  it('merges the same message', () => {
    const current = { ...older, deliveryStatus: READ }
    expect(resolveRefreshedLastMessage(older, current, null, older.id)?.deliveryStatus).toBe(READ)
  })

  it('keeps a newer preview that appeared while the request was pending', () => {
    expect(resolveRefreshedLastMessage(older, newer, null, older.id)).toBe(newer)
  })

  it('follows the server when the preview did not change during the request', () => {
    // e.g. the newer message was deleted for everyone while this client was offline
    expect(resolveRefreshedLastMessage(older, newer, null, newer.id)).toBe(older)
  })

  it('follows the server when the newer preview was deleted', () => {
    const deleted = { ...newer, state: MESSAGE_STATUS.DELETE }
    expect(resolveRefreshedLastMessage(older, deleted, null, older.id)).toBe(older)
  })

  it('follows the server when the preview changed to an older message during the request', () => {
    expect(resolveRefreshedLastMessage(newer, older, null, 'another-message')).toBe(newer)
  })

  it('merges the cached status when the server falls back to an older message', () => {
    const cached = { ...older, deliveryStatus: READ, markerTotals: totals([READ, 1]) }
    const resolved = resolveRefreshedLastMessage({ ...older, deliveryStatus: SENT }, newer, cached, newer.id)
    expect(resolved).toEqual(expect.objectContaining({ id: older.id, deliveryStatus: READ }))
  })

  it('merges the cached status of a kept newer preview', () => {
    const cachedNewer = { ...newer, deliveryStatus: DELIVERED, markerTotals: totals([DELIVERED, 1]) }
    const resolved = resolveRefreshedLastMessage(older, newer, null, older.id, cachedNewer)
    expect(resolved).toEqual(expect.objectContaining({ id: newer.id, deliveryStatus: DELIVERED }))
  })

  it('follows the server when its message is the newer one', () => {
    expect(resolveRefreshedLastMessage(newer, older, null, undefined)).toBe(newer)
  })

  it('compares creation times when ids are not numeric', () => {
    // Id order is the opposite of time order, so comparing ids as text fails.
    const before = makeMessage({ id: 'local-b', channelId, createdAt: new Date(1000) })
    const after = makeMessage({ id: 'local-a', channelId, createdAt: new Date(2000) })
    expect(resolveRefreshedLastMessage(before, after, null, undefined)).toBe(after)
    expect(resolveRefreshedLastMessage(after, before, null, undefined)).toBe(after)
  })

  it('returns an empty response when the preview did not change during the request', () => {
    expect(resolveRefreshedLastMessage(null, newer, null, newer.id)).toBeNull()
    expect(resolveRefreshedLastMessage(null, null, null, undefined)).toBeNull()
  })

  it('keeps a preview that appeared during the request when the response is empty', () => {
    expect(resolveRefreshedLastMessage(null, newer, null, older.id)).toBe(newer)
    expect(resolveRefreshedLastMessage(null, newer, null, undefined)).toBe(newer)
  })
})
