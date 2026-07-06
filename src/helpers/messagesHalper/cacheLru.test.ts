import {
  MESSAGES_CACHE_MAX_CHANNELS,
  addMessageToMap,
  checkChannelExistsOnMessagesMap,
  clearMessagesMap,
  destroyChannelsMap,
  ensureChannelCacheLoaded,
  evictLruChannels,
  getMessagesFromMap,
  trackChannelVisit
} from './index'
import { persistChannelMessages, restoreChannelMessages } from '../messagesIdb'
import { makeMessage, makePendingMessage, resetMessageListFixtureIds } from '../../testUtils/messageFixtures'

jest.mock('../messagesIdb', () => ({
  persistChannelMessages: jest.fn(async () => undefined),
  restoreChannelMessages: jest.fn(async () => null)
}))

const persistMock = persistChannelMessages as jest.Mock
const restoreMock = restoreChannelMessages as jest.Mock

describe('messagesMap channel LRU + IndexedDB spill', () => {
  beforeEach(() => {
    resetMessageListFixtureIds()
    clearMessagesMap()
    persistMock.mockClear()
    restoreMock.mockClear()
  })

  afterEach(() => {
    clearMessagesMap()
  })

  const fillChannel = (channelId: string) => {
    addMessageToMap(channelId, makeMessage({ channelId }))
    trackChannelVisit(channelId)
  }

  it('keeps the active channel plus the LRU limit and spills the oldest to IndexedDB', () => {
    const total = MESSAGES_CACHE_MAX_CHANNELS + 3
    for (let i = 0; i < total; i++) {
      fillChannel(`channel-${i}`)
    }
    const activeChannelId = `channel-${total - 1}`
    const evicted = evictLruChannels(activeChannelId)

    // two channels over the cap (active channel excluded from the count)
    expect(evicted).toEqual(['channel-0', 'channel-1'])
    expect(checkChannelExistsOnMessagesMap('channel-0')).toBe(false)
    expect(checkChannelExistsOnMessagesMap('channel-1')).toBe(false)
    expect(checkChannelExistsOnMessagesMap('channel-2')).toBe(true)
    expect(checkChannelExistsOnMessagesMap(activeChannelId)).toBe(true)
    expect(persistMock).toHaveBeenCalledTimes(2)
    expect(persistMock.mock.calls.map((call) => call[0])).toEqual(['channel-0', 'channel-1'])
  })

  it('re-visiting a channel refreshes its LRU position', () => {
    const total = MESSAGES_CACHE_MAX_CHANNELS + 2
    for (let i = 0; i < total; i++) {
      fillChannel(`channel-${i}`)
    }
    trackChannelVisit('channel-0')
    const evicted = evictLruChannels(`channel-${total - 1}`)
    expect(evicted).toEqual(['channel-1'])
    expect(checkChannelExistsOnMessagesMap('channel-0')).toBe(true)
  })

  it('never evicts channels holding pending (unsent) messages', () => {
    const total = MESSAGES_CACHE_MAX_CHANNELS + 2
    for (let i = 0; i < total; i++) {
      fillChannel(`channel-${i}`)
    }
    addMessageToMap('channel-0', makePendingMessage({ channelId: 'channel-0' }))
    const evicted = evictLruChannels(`channel-${total - 1}`)
    expect(evicted).toEqual(['channel-1'])
    expect(checkChannelExistsOnMessagesMap('channel-0')).toBe(true)
  })

  it('does nothing while within the limit', () => {
    for (let i = 0; i < MESSAGES_CACHE_MAX_CHANNELS; i++) {
      fillChannel(`channel-${i}`)
    }
    expect(evictLruChannels('channel-0')).toEqual([])
    expect(persistMock).not.toHaveBeenCalled()
  })

  it('ensureChannelCacheLoaded restores spilled messages and segments', async () => {
    const message = makeMessage({ channelId: 'restored-channel' })
    restoreMock.mockResolvedValueOnce({
      channelId: 'restored-channel',
      messages: [message],
      segments: [{ startId: message.id, endId: message.id }],
      savedAt: 1
    })

    const restored = await ensureChannelCacheLoaded('restored-channel')
    expect(restored).toBe(true)
    expect(checkChannelExistsOnMessagesMap('restored-channel')).toBe(true)
    expect(Object.keys(getMessagesFromMap('restored-channel'))).toEqual([message.id])
  })

  it('ensureChannelCacheLoaded is a no-op when the channel is already in memory', async () => {
    fillChannel('channel-live')
    const restored = await ensureChannelCacheLoaded('channel-live')
    expect(restored).toBe(false)
    expect(restoreMock).not.toHaveBeenCalled()
  })

  it('destroyChannelsMap clears the visit order so stale ids cannot leak into later sessions', () => {
    fillChannel('channel-a')
    fillChannel('channel-b')
    destroyChannelsMap()
    expect(checkChannelExistsOnMessagesMap('channel-a')).toBe(false)
    // refill fewer than the cap — nothing should be evicted or persisted
    for (let i = 0; i < 3; i++) {
      fillChannel(`fresh-${i}`)
    }
    expect(evictLruChannels('fresh-2')).toEqual([])
    expect(persistMock).not.toHaveBeenCalled()
  })
})
