import {
  addMessageToMap,
  clearMessagesMap,
  getActiveSegment,
  getContiguousNextMessages,
  getLatestCachedConfirmedMessageId,
  getMessagesFromMap,
  setActiveSegment,
  syncCachedMessagesDeliveryStatus
} from './index'
import { MESSAGE_DELIVERY_STATUS, MESSAGE_STATUS } from '../constants'
import { makeMessage, makePendingMessage, makeUser } from '../../testUtils/messageFixtures'

describe('delivery status from channel-list sync', () => {
  const channelId = 'channel-status-sync'

  beforeEach(() => clearMessagesMap())
  afterEach(() => clearMessagesMap())

  it('updates cached delivery status without overwriting a local edit or changing loaded ranges', () => {
    const cached = makeMessage({ id: '705', channelId, body: 'local edit', state: MESSAGE_STATUS.EDIT })
    addMessageToMap(channelId, cached)
    setActiveSegment(channelId, cached.id, cached.id)
    const snapshot = {
      ...cached,
      body: 'server body',
      state: MESSAGE_STATUS.UNMODIFIED,
      deliveryStatus: MESSAGE_DELIVERY_STATUS.READ
    }

    syncCachedMessagesDeliveryStatus(channelId, snapshot)

    expect(getMessagesFromMap(channelId)[cached.id]).toEqual({
      ...cached,
      deliveryStatus: MESSAGE_DELIVERY_STATUS.READ
    })
    expect(getActiveSegment()).toEqual({ startId: cached.id, endId: cached.id })
    expect(getLatestCachedConfirmedMessageId(channelId)).toBe(cached.id)
    expect(cached.deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.SENT)
  })

  it('does not downgrade read on a stale delivered or sent snapshot, or change totals on a duplicate', () => {
    const cached = makeMessage({
      id: '705',
      channelId,
      deliveryStatus: MESSAGE_DELIVERY_STATUS.READ,
      markerTotals: [{ name: MESSAGE_DELIVERY_STATUS.READ, count: 1 } as any]
    })
    addMessageToMap(channelId, cached)

    for (const status of [
      MESSAGE_DELIVERY_STATUS.SENT,
      MESSAGE_DELIVERY_STATUS.DELIVERED,
      MESSAGE_DELIVERY_STATUS.READ
    ]) {
      expect(syncCachedMessagesDeliveryStatus(channelId, { ...cached, deliveryStatus: status })).toEqual([])
      expect(getMessagesFromMap(channelId)[cached.id]).toBe(cached)
    }
  })

  it('does not insert an uncached last message or create a channel cache', () => {
    const snapshot = makeMessage({ id: '706', channelId, deliveryStatus: MESSAGE_DELIVERY_STATUS.READ })
    expect(syncCachedMessagesDeliveryStatus(channelId, snapshot)).toEqual([])
    expect(getMessagesFromMap(channelId)).toBeUndefined()

    const cached = makeMessage({ id: '705', channelId })
    addMessageToMap(channelId, cached)
    setActiveSegment(channelId, cached.id, cached.id)
    const updated = { ...cached, deliveryStatus: MESSAGE_DELIVERY_STATUS.READ }
    expect(syncCachedMessagesDeliveryStatus(channelId, snapshot)).toEqual([updated])
    expect(getMessagesFromMap(channelId)).toEqual({ [cached.id]: updated })
    expect(getActiveSegment()).toEqual({ startId: cached.id, endId: cached.id })
  })

  it('ignores pending snapshots and keeps incoming messages unchanged', () => {
    const cached = makeMessage({ id: '705', channelId })
    const other = makeMessage({ id: '704', channelId, incoming: true })
    addMessageToMap(channelId, cached)
    addMessageToMap(channelId, other)
    expect(syncCachedMessagesDeliveryStatus(channelId, makePendingMessage({ channelId, id: cached.id }))).toEqual([])

    syncCachedMessagesDeliveryStatus(channelId, { ...cached, deliveryStatus: MESSAGE_DELIVERY_STATUS.READ })
    expect(getMessagesFromMap(channelId)[other.id]).toBe(other)
  })

  it.each([MESSAGE_DELIVERY_STATUS.READ, MESSAGE_DELIVERY_STATUS.DELIVERED])(
    'reconciles earlier outgoing messages for %s even when the last message is already read',
    (status) => {
      const earlier = makeMessage({ id: '7290000000000000001', channelId })
      const latest = makeMessage({ id: '7290000000000000003', channelId, deliveryStatus: MESSAGE_DELIVERY_STATUS.READ })
      const newer = makeMessage({ id: '7290000000000000004', channelId })
      const incoming = makeMessage({ id: '7290000000000000002', channelId, incoming: true })
      const played = makeMessage({
        id: '7290000000000000000',
        channelId,
        deliveryStatus: MESSAGE_DELIVERY_STATUS.PLAYED
      })
      const pending = makePendingMessage({ channelId })
      ;[earlier, latest, newer, incoming, played, pending].forEach((message) => addMessageToMap(channelId, message))

      const changed = syncCachedMessagesDeliveryStatus(channelId, { ...latest, deliveryStatus: status })

      expect(changed).toEqual([{ ...earlier, deliveryStatus: status }])
      const cache = getMessagesFromMap(channelId)
      expect(cache[earlier.id].deliveryStatus).toBe(status)
      for (const untouched of [latest, newer, incoming, played, pending]) {
        expect(cache[untouched.id || untouched.tid!]).toBe(untouched)
      }
      expect(syncCachedMessagesDeliveryStatus(channelId, { ...latest, deliveryStatus: status })).toEqual([])
    }
  )

  it('does not use an incoming read snapshot to mark outgoing messages read', () => {
    const outgoing = makeMessage({ id: '704', channelId })
    const incoming = makeMessage({ id: '705', channelId, incoming: true })
    addMessageToMap(channelId, outgoing)
    addMessageToMap(channelId, incoming)

    expect(
      syncCachedMessagesDeliveryStatus(channelId, { ...incoming, deliveryStatus: MESSAGE_DELIVERY_STATUS.READ })
    ).toEqual([{ ...incoming, deliveryStatus: MESSAGE_DELIVERY_STATUS.READ }])
    expect(getMessagesFromMap(channelId)[outgoing.id]).toBe(outgoing)
  })

  it.each([MESSAGE_DELIVERY_STATUS.PLAYED, MESSAGE_DELIVERY_STATUS.OPENED])(
    'does not propagate message-specific %s status to earlier outgoing messages',
    (status) => {
      const earlier = makeMessage({ id: '704', channelId })
      const latest = makeMessage({ id: '705', channelId })
      addMessageToMap(channelId, earlier)
      addMessageToMap(channelId, latest)

      expect(syncCachedMessagesDeliveryStatus(channelId, { ...latest, deliveryStatus: status })).toEqual([
        { ...latest, deliveryStatus: status }
      ])
      expect(getMessagesFromMap(channelId)[earlier.id]).toBe(earlier)
    }
  )

  it.each([MESSAGE_DELIVERY_STATUS.DELIVERED, MESSAGE_DELIVERY_STATUS.READ])(
    'limits cumulative %s updates to the snapshot author and channel',
    (status) => {
      const own = makeMessage({ id: '701', channelId })
      const otherAuthor = makeMessage({ id: '702', channelId, user: makeUser({ id: 'another-user' }) })
      const otherChannel = makeMessage({ id: own.id, channelId: 'another-channel' })
      addMessageToMap(channelId, own)
      addMessageToMap(channelId, otherAuthor)
      addMessageToMap(otherChannel.channelId, otherChannel)

      expect(
        syncCachedMessagesDeliveryStatus(channelId, makeMessage({ id: '705', channelId, deliveryStatus: status }))
      ).toEqual([{ ...own, deliveryStatus: status }])
      expect(getMessagesFromMap(channelId)[otherAuthor.id]).toBe(otherAuthor)
      expect(getMessagesFromMap(otherChannel.channelId)[own.id]).toBe(otherChannel)
    }
  )

  it('does not merge disjoint cached segments when advancing statuses across both', () => {
    const older = [makeMessage({ id: '700', channelId }), makeMessage({ id: '701', channelId })]
    const newer = [makeMessage({ id: '705', channelId }), makeMessage({ id: '706', channelId })]
    older.forEach((message) => addMessageToMap(channelId, message))
    setActiveSegment(channelId, '700', '701')
    newer.forEach((message) => addMessageToMap(channelId, message))
    setActiveSegment(channelId, '705', '706')

    const changed = syncCachedMessagesDeliveryStatus(channelId, {
      ...newer[1],
      deliveryStatus: MESSAGE_DELIVERY_STATUS.READ
    })

    expect(changed.map((message) => message.id)).toEqual(['700', '701', '705', '706'])
    expect(changed.every((message) => message.deliveryStatus === MESSAGE_DELIVERY_STATUS.READ)).toBe(true)
    expect(Object.keys(getMessagesFromMap(channelId))).toEqual(['700', '701', '705', '706'])
    expect(getContiguousNextMessages(channelId, older[1], 40)).toEqual([])
    expect(getActiveSegment()).toEqual({ startId: '705', endId: '706' })
  })

  it.each([MESSAGE_STATUS.EDIT, MESSAGE_STATUS.DELETE])(
    'preserves local %s content and marker collections on an immutable cached message',
    (state) => {
      const cached = makeMessage({
        id: '704',
        channelId,
        state,
        body: 'local content',
        metadata: 'local metadata',
        markerTotals: [{ name: MESSAGE_DELIVERY_STATUS.DELIVERED, count: 2 } as any],
        userMarkers: [{ name: MESSAGE_DELIVERY_STATUS.SENT } as any]
      })
      Object.freeze(cached.markerTotals)
      Object.freeze(cached.userMarkers)
      Object.freeze(cached)
      addMessageToMap(channelId, cached)
      const snapshot = Object.freeze(
        makeMessage({ id: '705', channelId, deliveryStatus: MESSAGE_DELIVERY_STATUS.READ })
      )

      const changed = syncCachedMessagesDeliveryStatus(channelId, snapshot)

      expect(changed).toEqual([{ ...cached, deliveryStatus: MESSAGE_DELIVERY_STATUS.READ }])
      expect(changed[0].markerTotals).toBe(cached.markerTotals)
      expect(changed[0].userMarkers).toBe(cached.userMarkers)
      expect(cached.deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.SENT)
      expect(syncCachedMessagesDeliveryStatus(channelId, snapshot)).toEqual([])
    }
  )

  it.each([MESSAGE_DELIVERY_STATUS.PLAYED, MESSAGE_DELIVERY_STATUS.OPENED])(
    'retains %s while a delivered snapshot is followed by a read snapshot',
    (status) => {
      const higher = makeMessage({ id: '701', channelId, deliveryStatus: status })
      const pendingWithId = makePendingMessage({ id: '702', channelId })
      const sent = makeMessage({ id: '703', channelId })
      ;[higher, pendingWithId, sent].forEach((message) => addMessageToMap(channelId, message))

      for (const next of [MESSAGE_DELIVERY_STATUS.DELIVERED, MESSAGE_DELIVERY_STATUS.READ]) {
        expect(
          syncCachedMessagesDeliveryStatus(channelId, makeMessage({ id: '705', channelId, deliveryStatus: next }))
        ).toEqual([{ ...sent, deliveryStatus: next }])
        expect(getMessagesFromMap(channelId)[higher.id]).toBe(higher)
        expect(getMessagesFromMap(channelId)[pendingWithId.id]).toBe(pendingWithId)
      }
    }
  )

  it.each([
    ['incoming flag', { incoming: undefined }],
    ['author id', { user: { ...makeUser({ id: 'snapshot-user' }), id: '' } }]
  ])('does not infer a cumulative read when the snapshot lacks an %s', (_field, missing) => {
    const earlier = makeMessage({ id: '704', channelId })
    const latest = makeMessage({ id: '705', channelId })
    addMessageToMap(channelId, earlier)
    addMessageToMap(channelId, latest)
    const snapshot = { ...latest, deliveryStatus: MESSAGE_DELIVERY_STATUS.READ, ...missing } as any

    expect(syncCachedMessagesDeliveryStatus(channelId, snapshot)).toEqual([
      { ...latest, deliveryStatus: MESSAGE_DELIVERY_STATUS.READ }
    ])
    expect(getMessagesFromMap(channelId)[earlier.id]).toBe(earlier)
  })
})
