import * as messagesHalper from './index'
import {
  addMessageToMap,
  checkChannelExistsOnMessagesMap,
  clearMessagesMap,
  destroyChannelsMap,
  getInMemoryCachedChannelIds,
  removeMessagesFromMap,
  trackChannelVisit
} from './index'
import { makeMessage, resetMessageListFixtureIds } from '../../testUtils/messageFixtures'

// The message cache lives in memory only: no channel limit and no IndexedDB.
describe('in-memory message cache of visited chats', () => {
  beforeEach(() => {
    resetMessageListFixtureIds()
    clearMessagesMap()
  })

  afterEach(() => {
    clearMessagesMap()
  })

  const fillChannel = (channelId: string) => {
    addMessageToMap(channelId, makeMessage({ channelId }))
    trackChannelVisit(channelId)
  }

  it('has no channel limit and no IndexedDB spill', () => {
    expect((messagesHalper as any).MESSAGES_CACHE_MAX_CHANNELS).toBeUndefined()
    expect((messagesHalper as any).evictLruChannels).toBeUndefined()
    expect((messagesHalper as any).ensureChannelCacheLoaded).toBeUndefined()
  })

  it('keeps every visited chat in memory', () => {
    for (let i = 0; i < 30; i++) {
      fillChannel(`channel-${i}`)
    }
    for (let i = 0; i < 30; i++) {
      expect(checkChannelExistsOnMessagesMap(`channel-${i}`)).toBe(true)
    }
    expect(getInMemoryCachedChannelIds()).toHaveLength(30)
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
  })
})
