import * as messagesIdb from '../messagesIdb'
import * as messagesHalper from './index'
import {
  MESSAGES_CACHE_MAX_CHANNELS,
  addMessageToMap,
  checkChannelExistsOnMessagesMap,
  clearMessagesMap,
  destroyChannelsMap,
  evictLruChannels,
  getInMemoryCachedChannelIds,
  getLatestMessageSnapshot,
  removeMessagesFromMap,
  setLatestMessageSnapshot,
  trackChannelVisit
} from './index'
import { makeMessage, makePendingMessage, resetMessageListFixtureIds } from '../../testUtils/messageFixtures'

// The message cache lives in memory only: older chats beyond the limit are
// dropped from memory, never written to IndexedDB.
describe('in-memory message cache limit', () => {
  beforeEach(() => {
    resetMessageListFixtureIds()
    clearMessagesMap()
  })

  afterEach(() => {
    jest.restoreAllMocks()
    clearMessagesMap()
  })

  const fillChannel = (channelId: string) => {
    addMessageToMap(channelId, makeMessage({ channelId }))
    trackChannelVisit(channelId)
  }

  const fill = (count: number) => {
    for (let i = 0; i < count; i++) {
      fillChannel(`channel-${i}`)
    }
  }

  it('keeps 30 chats besides the open one', () => {
    expect(MESSAGES_CACHE_MAX_CHANNELS).toBe(30)
  })

  it('has no IndexedDB message storage to spill to or restore from', () => {
    expect((messagesHalper as any).ensureChannelCacheLoaded).toBeUndefined()
    expect((messagesIdb as any).persistChannelMessages).toBeUndefined()
    expect((messagesIdb as any).restoreChannelMessages).toBeUndefined()
  })

  it('keeps the open chat plus the limit and drops the least recently visited from memory', () => {
    const total = MESSAGES_CACHE_MAX_CHANNELS + 3
    fill(total)
    const activeChannelId = `channel-${total - 1}`

    const evicted = evictLruChannels(activeChannelId)

    // Two chats over the limit (the open chat is not counted).
    expect(evicted).toEqual(['channel-0', 'channel-1'])
    expect(checkChannelExistsOnMessagesMap('channel-0')).toBe(false)
    expect(checkChannelExistsOnMessagesMap('channel-1')).toBe(false)
    expect(checkChannelExistsOnMessagesMap('channel-2')).toBe(true)
    expect(checkChannelExistsOnMessagesMap(activeChannelId)).toBe(true)
    expect(getInMemoryCachedChannelIds()).toHaveLength(MESSAGES_CACHE_MAX_CHANNELS + 1)
  })

  it('writes nothing to IndexedDB when dropping chats', () => {
    const idbCalls = Object.keys(messagesIdb)
      .filter((key) => typeof (messagesIdb as any)[key] === 'function')
      .map((key) => jest.spyOn(messagesIdb as any, key))
    fill(MESSAGES_CACHE_MAX_CHANNELS + 5)

    evictLruChannels(`channel-${MESSAGES_CACHE_MAX_CHANNELS + 4}`)

    idbCalls.forEach((spy) => expect(spy).not.toHaveBeenCalled())
  })

  it('a chat opened before its messages load is still tracked and can be dropped later', () => {
    // Like the app: switching to a chat (visit + limit check) happens before its messages arrive.
    for (let i = 0; i < MESSAGES_CACHE_MAX_CHANNELS + 3; i++) {
      const channelId = `channel-${i}`
      trackChannelVisit(channelId)
      evictLruChannels(channelId)
      addMessageToMap(channelId, makeMessage({ channelId }))
    }

    // channel-0 and channel-1 were dropped by the switches inside the loop, channel-2 now.
    expect(evictLruChannels('channel-home')).toEqual(['channel-2'])
    ;['channel-0', 'channel-1', 'channel-2'].forEach((id) => expect(checkChannelExistsOnMessagesMap(id)).toBe(false))
    expect(getInMemoryCachedChannelIds()).toHaveLength(MESSAGES_CACHE_MAX_CHANNELS)
    expect(getInMemoryCachedChannelIds()[0]).toBe(`channel-${MESSAGES_CACHE_MAX_CHANNELS + 2}`)
  })

  it('re-visiting a chat refreshes its position', () => {
    const total = MESSAGES_CACHE_MAX_CHANNELS + 2
    fill(total)
    trackChannelVisit('channel-0')

    expect(evictLruChannels(`channel-${total - 1}`)).toEqual(['channel-1'])
    expect(checkChannelExistsOnMessagesMap('channel-0')).toBe(true)
  })

  it('never drops a chat with unsent (pending) messages', () => {
    const total = MESSAGES_CACHE_MAX_CHANNELS + 2
    fill(total)
    addMessageToMap('channel-0', makePendingMessage({ channelId: 'channel-0' }))

    expect(evictLruChannels(`channel-${total - 1}`)).toEqual(['channel-1'])
    expect(checkChannelExistsOnMessagesMap('channel-0')).toBe(true)
  })

  it('never drops the open chat, even when it is the least recently visited', () => {
    const total = MESSAGES_CACHE_MAX_CHANNELS + 2
    fill(total)

    expect(evictLruChannels('channel-0')).toEqual(['channel-1'])
    expect(checkChannelExistsOnMessagesMap('channel-0')).toBe(true)
  })

  it('keeps the latest-message snapshot of a dropped chat (the chat still exists)', () => {
    const total = MESSAGES_CACHE_MAX_CHANNELS + 2
    fill(total)
    setLatestMessageSnapshot('channel-0', makeMessage({ id: '900', channelId: 'channel-0' }))

    expect(evictLruChannels(`channel-${total - 1}`)).toContain('channel-0')
    expect(getLatestMessageSnapshot('channel-0')?.id).toBe('900')
  })

  it('does nothing within the limit', () => {
    fill(MESSAGES_CACHE_MAX_CHANNELS + 1)

    expect(evictLruChannels('channel-0')).toEqual([])
    expect(getInMemoryCachedChannelIds()).toHaveLength(MESSAGES_CACHE_MAX_CHANNELS + 1)
  })

  it('lists cached chats most recently visited first', () => {
    fillChannel('channel-a')
    fillChannel('channel-b')
    fillChannel('channel-c')
    trackChannelVisit('channel-a')

    expect(getInMemoryCachedChannelIds()).toEqual(['channel-a', 'channel-c', 'channel-b'])
  })

  it('drops a chat from the list when its cache is removed (delete, leave, clear history)', () => {
    fillChannel('channel-a')
    fillChannel('channel-b')

    removeMessagesFromMap('channel-a')

    expect(getInMemoryCachedChannelIds()).toEqual(['channel-b'])
  })

  it('destroyChannelsMap clears the cache and the visit order', () => {
    fillChannel('channel-a')
    fillChannel('channel-b')

    destroyChannelsMap()

    expect(checkChannelExistsOnMessagesMap('channel-a')).toBe(false)
    expect(getInMemoryCachedChannelIds()).toEqual([])
    fill(3)
    expect(evictLruChannels('channel-2')).toEqual([])
  })
})
