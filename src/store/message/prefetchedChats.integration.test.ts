/**
 * Integration tests: using prefetched chats (offline scrolling, reconnect with
 * a chat open, a second reconnect) and the memory limit of the message cache.
 *
 * Same setup as backgroundPrefetch.integration.test.ts: the real Redux store
 * with every real saga and reducer, and a fake chat server.
 */
import {
  clearMessagesMap,
  getLatestLoadedSegment,
  getLatestMessageSnapshot,
  getMessageFromMap,
  MESSAGES_CACHE_MAX_CHANNELS
} from '../../helpers/messagesHalper'
import { CONNECTION_STATUS } from '../user/constants'
import { setConnectionStatusAC } from '../user/actions'
import { reloadActiveChannelAfterReconnectAC } from './actions'
import {
  store,
  sleep,
  ids,
  visibleIds,
  fake,
  syncChatList,
  goOffline,
  goOnline,
  waitForPrefetchToFinish,
  prefetchRequests,
  cacheChat,
  expectNoDuplicates,
  currentChannel,
  openChat,
  setupPrefetchIntegration,
  scrollThroughCacheOffline
} from '../../testUtils/prefetchIntegrationHarness'

// setupTests replaces the store with a stub; these tests need the real one.
jest.unmock('store')

jest.mock('../../helpers/messageListNavigator', () => ({
  navigateToLatest: jest.fn(),
  navigateToMessage: jest.fn(),
  registerJumpToLatest: jest.fn(),
  unregisterJumpToLatest: jest.fn(),
  registerMessageListNavigator: jest.fn(),
  unregisterMessageListNavigator: jest.fn()
}))

jest.setTimeout(30000)

setupPrefetchIntegration()

describe('integration: using prefetched chats, and the app around the prefetch', () => {
  it('offline, every prefetched message can be reached by scrolling, with no server requests', async () => {
    fake.server.addChat('chat-a', 1, 5)
    fake.server.addChat('chat-x', 1000, 6)
    await syncChatList()
    await cacheChat('chat-x', 'chat-a')

    await goOffline()
    fake.server.appendMessages('chat-x', 1006, 100)
    await goOnline()
    await waitForPrefetchToFinish()

    await goOffline()
    const requestsBefore = fake.server.requests.length
    await openChat('chat-x')
    expect(visibleIds()).toEqual(ids(1005, 40))

    // Scrolling down and up through the cache, the way the message list does offline.
    const { seen, reachedEnd, reachedStart } = scrollThroughCacheOffline('chat-x')

    expect(reachedEnd).toBe('1105')
    expect(reachedStart).toBe('1000')
    expect(Array.from(seen).sort()).toEqual(ids(1000, 106))
    expectNoDuplicates()
    expect(fake.server.requests.length).toBe(requestsBefore)
  })

  it('reconnect with a chat open: the open chat reloads first, other chats are prefetched after it finishes', async () => {
    fake.server.addChat('chat-x', 1000, 6)
    fake.server.addChat('chat-open', 1, 5)
    await syncChatList()
    await cacheChat('chat-x', 'chat-open')

    await goOffline()
    fake.server.appendMessages('chat-open', 6, 3)
    fake.server.appendMessages('chat-x', 1006, 5)
    // The open chat's reload is slow.
    fake.server.hooks.beforeResponse = async (request) => {
      if (request.channelId === 'chat-open') {
        await sleep(800)
      }
    }
    store.dispatch(setConnectionStatusAC(CONNECTION_STATUS.CONNECTED))
    // What the message list does on reconnect.
    store.dispatch(reloadActiveChannelAfterReconnectAC(currentChannel('chat-open'), '5', true) as any)
    await syncChatList()
    await waitForPrefetchToFinish()

    const openReload = fake.server.requestsFor('chat-open').filter((request) => (request.sentAt || 0) > 0)
    const xPrefetch = prefetchRequests('chat-x')
    expect(openReload.length).toBeGreaterThan(0)
    expect(xPrefetch).toHaveLength(1)
    const reloadDone = Math.max(...openReload.map((request) => request.respondedAt || 0))
    expect(xPrefetch[0].sentAt).toBeGreaterThanOrEqual(reloadDone)
    expect(visibleIds().slice(-3)).toEqual(['6', '7', '8'])
    expect(getLatestLoadedSegment('chat-x')).toEqual({ startId: '1000', endId: '1010' })
  })

  it('the connection drops while a chat is loading: its follow-up page loads send nothing while offline', async () => {
    fake.server.addChat('chat-a', 1, 5)
    fake.server.addChat('chat-y', 1000, 120)
    await syncChatList()

    let dropped = false
    fake.server.hooks.beforeResponse = async (request) => {
      if (!dropped && request.channelId === 'chat-y') {
        dropped = true
        store.dispatch(setConnectionStatusAC(CONNECTION_STATUS.DISCONNECTED))
      }
    }
    await openChat('chat-y')
    await sleep(500)

    expect(dropped).toBe(true)
    expect(fake.server.requests.filter((request) => request.sentOnline === false)).toEqual([])
  })

  it('a second reconnect continues from where the cache ends, without fetching the same messages again', async () => {
    fake.server.addChat('chat-a', 1, 5)
    fake.server.addChat('chat-x', 1000, 6)
    await syncChatList()
    await cacheChat('chat-x', 'chat-a')

    await goOffline()
    fake.server.appendMessages('chat-x', 1006, 5)
    await goOnline()
    await waitForPrefetchToFinish()

    await goOffline()
    fake.server.appendMessages('chat-x', 1011, 7)
    await goOnline()
    await waitForPrefetchToFinish()

    expect(prefetchRequests('chat-x').map((request) => request.messageId)).toEqual(['1005', '1010'])
    expect(getLatestLoadedSegment('chat-x')).toEqual({ startId: '1000', endId: '1017' })
    expect(getLatestMessageSnapshot('chat-x')).toBeNull()
  })

  it('the 400 limit is per chat: a big chat does not take from the others', async () => {
    fake.server.addChat('chat-home', 1, 3)
    fake.server.addChat('chat-big', 1000, 6)
    fake.server.addChat('chat-small', 5000, 6)
    await syncChatList()
    await cacheChat('chat-small', 'chat-home')
    await cacheChat('chat-big', 'chat-home')

    await goOffline()
    fake.server.appendMessages('chat-big', 1006, 450)
    fake.server.appendMessages('chat-small', 5006, 5)
    await goOnline()
    await waitForPrefetchToFinish()

    expect(getLatestLoadedSegment('chat-big')).toEqual({ startId: '1000', endId: '1405' })
    expect(getLatestLoadedSegment('chat-small')).toEqual({ startId: '5000', endId: '5010' })
    expect(getLatestMessageSnapshot('chat-small')).toBeNull()
  })

  it('the whole cache is cleared during the prefetch (e.g. logout): nothing is written back and it stops', async () => {
    fake.server.addChat('chat-home', 1, 3)
    fake.server.addChat('chat-1', 1000, 6)
    fake.server.addChat('chat-2', 2000, 6)
    await syncChatList()
    await cacheChat('chat-1', 'chat-home')
    await cacheChat('chat-2', 'chat-home')

    await goOffline()
    fake.server.appendMessages('chat-1', 1006, 5)
    fake.server.appendMessages('chat-2', 2006, 5)
    let cleared = false
    fake.server.hooks.beforeResponse = async (request) => {
      if (!cleared && request.method === 'loadNextMessageId' && request.limit === 40) {
        cleared = true
        clearMessagesMap()
      }
    }
    await goOnline()
    await waitForPrefetchToFinish()

    expect(cleared).toBe(true)
    expect(prefetchRequests()).toHaveLength(1)
    expect(getLatestLoadedSegment('chat-1')).toBeNull()
    expect(getLatestLoadedSegment('chat-2')).toBeNull()
    expect(getMessageFromMap('chat-2', '2006')).toBeFalsy()
  })
})

describe('integration: memory limit of the message cache with the prefetch', () => {
  // Opens chat-0..chat-(count-1) online (each is cached), then goes back to chat-home.
  const cacheChats = async (count: number) => {
    fake.server.addChat('chat-home', 1, 3)
    for (let index = 0; index < count; index++) {
      fake.server.addChat(`chat-${index}`, 1000, 6)
    }
    await syncChatList()
    for (let index = 0; index < count; index++) {
      await cacheChat(`chat-${index}`, 'chat-home')
    }
  }

  it('after visiting 35 chats, the open chat plus the 30 most recent stay cached; older ones are dropped from memory', async () => {
    await cacheChats(35)

    // chat-home is open; chat-5..chat-34 are the 30 most recently visited.
    for (let index = 0; index < 5; index++) {
      expect(getLatestLoadedSegment(`chat-${index}`)).toBeNull()
    }
    for (let index = 5; index < 35; index++) {
      expect(getLatestLoadedSegment(`chat-${index}`)).toEqual({ startId: '1000', endId: '1005' })
    }
    expect(MESSAGES_CACHE_MAX_CHANNELS).toBe(30)
  })

  it('the prefetch covers every chat still in memory and skips the dropped ones', async () => {
    await cacheChats(35)

    await goOffline()
    for (let index = 0; index < 35; index++) {
      fake.server.appendMessages(`chat-${index}`, 1006, 5)
    }
    await goOnline()
    await waitForPrefetchToFinish()

    const prefetched = prefetchRequests().map((request) => request.channelId)
    expect(prefetched).toHaveLength(30)
    expect(prefetched).toEqual(Array.from({ length: 30 }, (_, index) => `chat-${34 - index}`))
    for (let index = 0; index < 5; index++) {
      expect(getMessageFromMap(`chat-${index}`, '1006')).toBeFalsy()
    }
  })

  it('a dropped chat opens normally online with all its messages', async () => {
    await cacheChats(35)
    await goOffline()
    fake.server.appendMessages('chat-0', 1006, 5)
    await goOnline()
    await waitForPrefetchToFinish()

    await openChat('chat-0')

    expect(visibleIds()).toEqual(ids(1000, 11))
    expectNoDuplicates()
  })

  it('the prefetch itself never pushes a chat out of memory', async () => {
    await cacheChats(30)
    await goOffline()
    for (let index = 0; index < 30; index++) {
      fake.server.appendMessages(`chat-${index}`, 1006, 50)
    }
    await goOnline()
    await waitForPrefetchToFinish()

    for (let index = 0; index < 30; index++) {
      expect(getLatestLoadedSegment(`chat-${index}`)).toEqual({ startId: '1000', endId: '1055' })
    }
  })
})
