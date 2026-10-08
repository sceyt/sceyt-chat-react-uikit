/**
 * Latest-message snapshot store (staging for the offline gap fix).
 *
 * Chat-list sync can bring a channel's newest message without loading it into
 * the message cache. The snapshot keeps it, separately from messagesMap and
 * the loaded segments, so that no existing latest-window logic changes.
 */
import {
  MESSAGES_CACHE_MAX_CHANNELS,
  addMessageToMap,
  clearAllLatestMessageSnapshots,
  clearLatestMessageSnapshot,
  clearMessagesMap,
  destroyChannelsMap,
  evictLruChannels,
  getActiveSegment,
  getCachedNearMessages,
  getLatestCachedConfirmedMessageId,
  getLatestContiguousMessagesFromMap,
  getLatestMessageSnapshot,
  getMessagesFromMap,
  hasNextContiguousInMap,
  removeMessagesFromMap,
  setActiveSegment,
  setLatestMessageSnapshot,
  trackChannelVisit
} from './index'
import { MESSAGE_DELIVERY_STATUS } from '../constants'
import { makeMessage, makePendingMessage, resetMessageListFixtureIds } from '../../testUtils/messageFixtures'

jest.mock('../messagesIdb', () => ({
  persistChannelMessages: jest.fn(async () => undefined),
  restoreChannelMessages: jest.fn(async () => null)
}))

const channelId = 'channel-snapshot'

const seedCache = () => {
  const cached = ['700', '701', '702', '703', '704', '705'].map((id) =>
    makeMessage({ id, channelId, body: `cached-${id}`, incoming: true })
  )
  cached.forEach((message) => addMessageToMap(channelId, message))
  setActiveSegment(channelId, '700', '705')
  return cached
}

describe('latest-message snapshot store', () => {
  beforeEach(() => {
    resetMessageListFixtureIds()
    clearMessagesMap()
  })

  afterEach(() => {
    clearMessagesMap()
  })

  describe('recording', () => {
    it('stores a confirmed message', () => {
      const message = makeMessage({ id: '706', channelId, body: 'received' })

      expect(setLatestMessageSnapshot(channelId, message)).toBe(true)
      expect(getLatestMessageSnapshot(channelId)).toEqual(expect.objectContaining({ id: '706', body: 'received' }))
    })

    it('ignores pending messages, messages still being sent, and missing input', () => {
      expect(setLatestMessageSnapshot(channelId, makePendingMessage({ channelId }))).toBe(false)
      expect(
        setLatestMessageSnapshot(
          channelId,
          makeMessage({ id: '706', channelId, deliveryStatus: MESSAGE_DELIVERY_STATUS.PENDING })
        )
      ).toBe(false)
      expect(setLatestMessageSnapshot(channelId, null)).toBe(false)
      expect(setLatestMessageSnapshot('', makeMessage({ id: '706', channelId }))).toBe(false)
      expect(getLatestMessageSnapshot(channelId)).toBeNull()
    })

    it('stores a copy, so later mutation of the synced object does not change it', () => {
      const message = makeMessage({ id: '706', channelId, body: 'original' })
      setLatestMessageSnapshot(channelId, message)
      message.body = 'mutated elsewhere'

      expect(getLatestMessageSnapshot(channelId)?.body).toBe('original')
    })
  })

  describe('ordering', () => {
    it('replaces an older snapshot with a newer message id', () => {
      setLatestMessageSnapshot(channelId, makeMessage({ id: '706', channelId }))

      expect(setLatestMessageSnapshot(channelId, makeMessage({ id: '707', channelId }))).toBe(true)
      expect(getLatestMessageSnapshot(channelId)?.id).toBe('707')
    })

    it('never replaces a newer snapshot with an older message id', () => {
      setLatestMessageSnapshot(channelId, makeMessage({ id: '707', channelId, body: 'newer' }))

      expect(setLatestMessageSnapshot(channelId, makeMessage({ id: '706', channelId, body: 'older' }))).toBe(false)
      expect(getLatestMessageSnapshot(channelId)).toEqual(expect.objectContaining({ id: '707', body: 'newer' }))
    })

    it('compares ids numerically, not as strings', () => {
      setLatestMessageSnapshot(channelId, makeMessage({ id: '999', channelId }))
      setLatestMessageSnapshot(channelId, makeMessage({ id: '1000', channelId }))

      expect(getLatestMessageSnapshot(channelId)?.id).toBe('1000')
    })

    it('is harmless when the identical message is recorded again', () => {
      const message = makeMessage({ id: '706', channelId, body: 'same' })
      setLatestMessageSnapshot(channelId, message)
      setLatestMessageSnapshot(channelId, { ...message })

      expect(getLatestMessageSnapshot(channelId)).toEqual(expect.objectContaining({ id: '706', body: 'same' }))
    })

    it('updates the same message id with fresher content (edit, delivery state)', () => {
      setLatestMessageSnapshot(
        channelId,
        makeMessage({ id: '706', channelId, body: 'first', deliveryStatus: MESSAGE_DELIVERY_STATUS.SENT })
      )
      setLatestMessageSnapshot(
        channelId,
        makeMessage({ id: '706', channelId, body: 'edited', deliveryStatus: MESSAGE_DELIVERY_STATUS.READ })
      )

      expect(getLatestMessageSnapshot(channelId)).toEqual(
        expect.objectContaining({ id: '706', body: 'edited', deliveryStatus: MESSAGE_DELIVERY_STATUS.READ })
      )
    })

    it('keeps snapshots per channel', () => {
      setLatestMessageSnapshot('channel-a', makeMessage({ id: '10', channelId: 'channel-a' }))
      setLatestMessageSnapshot('channel-b', makeMessage({ id: '20', channelId: 'channel-b' }))

      expect(getLatestMessageSnapshot('channel-a')?.id).toBe('10')
      expect(getLatestMessageSnapshot('channel-b')?.id).toBe('20')
    })
  })

  describe('does not change the message cache', () => {
    it('leaves messagesMap, segments and the active segment untouched', () => {
      seedCache()
      const activeBefore = getActiveSegment()

      setLatestMessageSnapshot(channelId, makeMessage({ id: '706', channelId, body: 'received-while-away' }))

      expect(Object.keys(getMessagesFromMap(channelId)).sort()).toEqual(['700', '701', '702', '703', '704', '705'])
      expect(getActiveSegment()).toEqual(activeBefore)
      expect(getActiveSegment()).toEqual({ startId: '700', endId: '705' })
    })

    // These are the latest-window checks that would treat a lone cached 706 as
    // the whole chat (open online without a server fetch, jump-to-latest skipping
    // the server sync). They must still see 705 as the cached latest.
    it('does not change what the latest-window checks see', () => {
      seedCache()
      setLatestMessageSnapshot(channelId, makeMessage({ id: '706', channelId, body: 'received-while-away' }))

      expect(getLatestContiguousMessagesFromMap(channelId, 50).map((message) => message.id)).toEqual([
        '700',
        '701',
        '702',
        '703',
        '704',
        '705'
      ])
      expect(getLatestCachedConfirmedMessageId(channelId)).toBe('705')
      expect(hasNextContiguousInMap(channelId, makeMessage({ id: '705', channelId }))).toBe(false)
      const near = getCachedNearMessages(channelId, '705', 50)
      expect(near.messages.map((message) => message.id)).not.toContain('706')
    })
  })

  describe('clearing', () => {
    it('clears only the snapshot that was reconciled, not a newer one recorded meanwhile', () => {
      setLatestMessageSnapshot(channelId, makeMessage({ id: '706', channelId }))
      setLatestMessageSnapshot(channelId, makeMessage({ id: '707', channelId }))

      clearLatestMessageSnapshot(channelId, '706')
      expect(getLatestMessageSnapshot(channelId)?.id).toBe('707')

      clearLatestMessageSnapshot(channelId, '707')
      expect(getLatestMessageSnapshot(channelId)).toBeNull()
    })

    it('clears unconditionally when no message id is given', () => {
      setLatestMessageSnapshot(channelId, makeMessage({ id: '706', channelId }))
      clearLatestMessageSnapshot(channelId)

      expect(getLatestMessageSnapshot(channelId)).toBeNull()
    })

    it('is cleared when the channel cache is removed (delete, leave, clear history)', () => {
      seedCache()
      setLatestMessageSnapshot(channelId, makeMessage({ id: '706', channelId }))

      removeMessagesFromMap(channelId)

      expect(getLatestMessageSnapshot(channelId)).toBeNull()
    })

    it('is kept when the channel is only evicted from memory by the LRU cache', () => {
      const total = MESSAGES_CACHE_MAX_CHANNELS + 2
      for (let i = 0; i < total; i++) {
        addMessageToMap(`channel-${i}`, makeMessage({ channelId: `channel-${i}` }))
        trackChannelVisit(`channel-${i}`)
      }
      setLatestMessageSnapshot('channel-0', makeMessage({ id: '900', channelId: 'channel-0' }))

      const evicted = evictLruChannels(`channel-${total - 1}`)

      expect(evicted).toContain('channel-0')
      expect(getLatestMessageSnapshot('channel-0')?.id).toBe('900')
    })

    it('is cleared by the global resets', () => {
      setLatestMessageSnapshot('channel-a', makeMessage({ id: '10', channelId: 'channel-a' }))
      clearMessagesMap()
      expect(getLatestMessageSnapshot('channel-a')).toBeNull()

      setLatestMessageSnapshot('channel-a', makeMessage({ id: '10', channelId: 'channel-a' }))
      destroyChannelsMap()
      expect(getLatestMessageSnapshot('channel-a')).toBeNull()

      setLatestMessageSnapshot('channel-a', makeMessage({ id: '10', channelId: 'channel-a' }))
      clearAllLatestMessageSnapshots()
      expect(getLatestMessageSnapshot('channel-a')).toBeNull()
    })
  })
})
