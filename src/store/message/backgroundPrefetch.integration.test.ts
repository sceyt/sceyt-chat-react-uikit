/**
 * Integration tests: background prefetch of cached chats after reconnect.
 *
 * These run the real Redux store with every real saga and reducer. Only the
 * chat server is replaced (FakeMessageServer). Each test drives the app the
 * way the UI does (open a chat, go offline, come back online, the chat list
 * syncs, open a chat offline) and asserts what the user would see in the
 * message list, plus what was requested from the server.
 */
import { runSaga } from 'redux-saga'
import { getLatestLoadedSegment, getLatestMessageSnapshot, getMessageFromMap } from '../../helpers/messagesHalper'
import { deleteChannelFromAllChannels } from '../../helpers/channelHalper'
import { CONNECTION_STATUS } from '../user/constants'
import { setConnectionStatusAC } from '../user/actions'
import { removeChannelCachesAC } from '../channel/actions'
import { handleChannelMessageEvent, handleClearHistoryEvent } from '../evetns/inedx'
import {
  store,
  sleep,
  ids,
  state,
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
  setupPrefetchIntegration
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

describe('integration: prefetch of cached chats after reconnect', () => {
  it("the user's steps: open X, leave it, offline, 10 arrive, online, offline again, open X -> all 10 shown", async () => {
    fake.server.addChat('chat-a', 1, 5)
    fake.server.addChat('chat-x', 1000, 6)
    await syncChatList()

    await openChat('chat-x')
    expect(visibleIds()).toEqual(ids(1000, 6))
    await openChat('chat-a')

    await goOffline()
    fake.server.appendMessages('chat-x', 1006, 10)
    await goOnline()
    await waitForPrefetchToFinish()

    await goOffline()
    const requestsBefore = fake.server.requests.length
    await openChat('chat-x')

    expect(visibleIds()).toEqual(ids(1000, 16))
    expect(fake.server.requests.length).toBe(requestsBefore)
    expect(state().MessageReducer.messageListGap).toBeNull()
    expect(getLatestMessageSnapshot('chat-x')).toBeNull()
  })

  it('same steps for a chat that was read: opening offline lands on the unread messages with nothing missing', async () => {
    fake.server.addChat('chat-a', 1, 5)
    fake.server.addChat('chat-x', 1000, 6)
    await syncChatList()
    await cacheChat('chat-x', 'chat-a')

    await goOffline()
    fake.server.appendMessages('chat-x', 1006, 10)
    await goOnline()
    expect(currentChannel('chat-x').newMessageCount).toBe(10)
    expect(currentChannel('chat-x').lastDisplayedMessageId).toBe('1005')
    await waitForPrefetchToFinish()

    await goOffline()
    const requestsBefore = fake.server.requests.length
    await openChat('chat-x')

    expect(visibleIds()).toEqual(ids(1000, 16))
    expect(state().MessageReducer.unreadMessageId).toBe('1005')
    expect(state().MessageReducer.messageListGap).toBeNull()
    expect(fake.server.requests.length).toBe(requestsBefore)
  })

  it('prefetches all 20 cached chats with new messages (no chat limit), most recently visited first', async () => {
    fake.server.addChat('chat-home', 1, 3)
    for (let index = 0; index < 20; index++) {
      fake.server.addChat(`chat-${index}`, 1000, 6)
    }
    await syncChatList()
    for (let index = 0; index < 20; index++) {
      await cacheChat(`chat-${index}`, 'chat-home')
    }

    await goOffline()
    for (let index = 0; index < 20; index++) {
      fake.server.appendMessages(`chat-${index}`, 1006, 5)
    }
    await goOnline()
    await waitForPrefetchToFinish()

    expect(prefetchRequests().map((request) => request.channelId)).toEqual(
      Array.from({ length: 20 }, (_, index) => `chat-${19 - index}`)
    )

    await goOffline()
    const requestsBefore = fake.server.requests.length
    for (const index of [0, 7, 8, 19]) {
      await openChat(`chat-${index}`)
      expect(visibleIds()).toEqual(ids(1000, 11))
    }
    expect(fake.server.requests.length).toBe(requestsBefore)
  })

  it('prefetches messages sent from another device while offline (no unread count)', async () => {
    fake.server.addChat('chat-a', 1, 5)
    fake.server.addChat('chat-x', 1000, 6)
    await syncChatList()
    await cacheChat('chat-x', 'chat-a')

    await goOffline()
    fake.server.appendMessages('chat-x', 1006, 4, false)
    await goOnline()
    expect(currentChannel('chat-x').newMessageCount).toBe(0)
    await waitForPrefetchToFinish()

    await goOffline()
    await openChat('chat-x')

    expect(visibleIds()).toEqual(ids(1000, 10))
  })

  it('does not prefetch chats that were never opened, or chats that are up to date', async () => {
    fake.server.addChat('chat-a', 1, 5)
    fake.server.addChat('chat-cached', 1000, 6)
    fake.server.addChat('chat-never-opened', 5000, 6)
    await syncChatList()
    await cacheChat('chat-cached', 'chat-a')

    await goOffline()
    fake.server.appendMessages('chat-never-opened', 5006, 10)
    await goOnline()
    await waitForPrefetchToFinish()

    expect(prefetchRequests()).toEqual([])
    expect(fake.server.requestsFor('chat-never-opened')).toEqual([])
  })

  it('leaves the open chat alone: no prefetch request for it and its message list is unchanged', async () => {
    fake.server.addChat('chat-x', 1000, 6)
    fake.server.addChat('chat-open', 1, 5)
    await syncChatList()
    await cacheChat('chat-x', 'chat-open')
    const openBefore = visibleIds()

    await goOffline()
    fake.server.appendMessages('chat-open', 6, 3)
    fake.server.appendMessages('chat-x', 1006, 3)
    await goOnline()
    await waitForPrefetchToFinish()

    expect(prefetchRequests('chat-open')).toEqual([])
    expect(prefetchRequests('chat-x')).toHaveLength(1)
    expect(state().ChannelReducer.activeChannel.id).toBe('chat-open')
    expect(visibleIds()).toEqual(openBefore)
  })

  it('fills a large gap page by page and stops at 400; the rest stays available online only', async () => {
    fake.server.addChat('chat-a', 1, 5)
    fake.server.addChat('chat-x', 1000, 6)
    await syncChatList()
    await cacheChat('chat-x', 'chat-a')

    await goOffline()
    fake.server.appendMessages('chat-x', 1006, 450)
    await goOnline()
    await waitForPrefetchToFinish()

    const requests = prefetchRequests('chat-x')
    expect(requests).toHaveLength(10)
    expect(requests.map((request) => request.messageId)).toEqual(
      Array.from({ length: 10 }, (_, page) => String(1005 + page * 40))
    )
    // The newest message is still known (latest-message snapshot) for the part not fetched.
    expect(getLatestMessageSnapshot('chat-x')?.id).toBe('1455')
    expect(getLatestLoadedSegment('chat-x')).toEqual({ startId: '1000', endId: '1405' })
  })

  it('the connection drops in the middle: pages that arrived are kept, and the next reconnect finishes the rest', async () => {
    fake.server.addChat('chat-a', 1, 5)
    fake.server.addChat('chat-x', 1000, 6)
    await syncChatList()
    await cacheChat('chat-x', 'chat-a')

    await goOffline()
    fake.server.appendMessages('chat-x', 1006, 100)
    let dropped = false
    fake.server.hooks.beforeResponse = async (request) => {
      if (!dropped && request.channelId === 'chat-x' && request.messageId === '1045') {
        dropped = true
        store.dispatch(setConnectionStatusAC(CONNECTION_STATUS.DISCONNECTED))
      }
    }
    await goOnline()
    await waitForPrefetchToFinish()

    expect(dropped).toBe(true)
    // Page 1 (1006-1045) was stored; page 2 was cut off by the disconnect.
    expect(getLatestLoadedSegment('chat-x')).toEqual({ startId: '1000', endId: '1045' })

    fake.server.hooks = {}
    await goOnline()
    await waitForPrefetchToFinish()

    expect(getLatestLoadedSegment('chat-x')).toEqual({ startId: '1000', endId: '1105' })
    await goOffline()
    await openChat('chat-x')
    // Every message is cached once, in one contiguous range.
    expect(ids(1000, 106).filter((id) => !getMessageFromMap('chat-x', id))).toEqual([])
    // Offline the chat opens at the first unread message (window of 40), contiguous, no duplicates.
    expect(visibleIds()).toEqual(ids(1005, 40))
    expectNoDuplicates()
    expect(getLatestMessageSnapshot('chat-x')).toBeNull()
  })

  it('a failed request for one chat does not stop the others', async () => {
    fake.server.addChat('chat-home', 1, 3)
    fake.server.addChat('chat-ok', 1000, 6)
    fake.server.addChat('chat-broken', 2000, 6)
    await syncChatList()
    await cacheChat('chat-ok', 'chat-home')
    await cacheChat('chat-broken', 'chat-home')

    await goOffline()
    fake.server.appendMessages('chat-ok', 1006, 5)
    fake.server.appendMessages('chat-broken', 2006, 5)
    fake.server.hooks.shouldFail = (request) => request.channelId === 'chat-broken' && request.limit === 40
    await goOnline()
    await waitForPrefetchToFinish()

    expect(prefetchRequests().map((request) => request.channelId)).toEqual(['chat-broken', 'chat-ok'])
    expect(getLatestLoadedSegment('chat-ok')).toEqual({ startId: '1000', endId: '1010' })
    expect(getLatestLoadedSegment('chat-broken')).toEqual({ startId: '2000', endId: '2005' })
  })

  it('the user opens the chat while its prefetch request is running: one correct list, no duplicates', async () => {
    fake.server.addChat('chat-a', 1, 5)
    fake.server.addChat('chat-x', 1000, 6)
    await syncChatList()
    await cacheChat('chat-x', 'chat-a')

    await goOffline()
    fake.server.appendMessages('chat-x', 1006, 10)
    let opened = false
    fake.server.hooks.beforeResponse = async (request) => {
      if (!opened && request.channelId === 'chat-x' && request.method === 'loadNextMessageId') {
        opened = true
        await openChat('chat-x')
      }
    }
    await goOnline()
    await waitForPrefetchToFinish()

    expect(opened).toBe(true)
    expect(state().ChannelReducer.activeChannel.id).toBe('chat-x')
    expect(visibleIds()).toEqual(ids(1000, 16))
    expectNoDuplicates()
  })

  it('history is cleared while the prefetch request is running: nothing is brought back', async () => {
    fake.server.addChat('chat-a', 1, 5)
    fake.server.addChat('chat-x', 1000, 6)
    await syncChatList()
    await cacheChat('chat-x', 'chat-a')

    await goOffline()
    fake.server.appendMessages('chat-x', 1006, 10)
    let cleared = false
    fake.server.hooks.beforeResponse = async (request) => {
      if (!cleared && request.channelId === 'chat-x' && request.method === 'loadNextMessageId') {
        cleared = true
        await runSaga(
          { dispatch: (action: any) => store.dispatch(action), getState: () => store.getState() },
          handleClearHistoryEvent as any,
          { channel: currentChannel('chat-x') }
        ).toPromise()
      }
    }
    await goOnline()
    await waitForPrefetchToFinish()

    expect(cleared).toBe(true)
    expect(getLatestLoadedSegment('chat-x')).toBeNull()
    expect(getMessageFromMap('chat-x', '1006')).toBeFalsy()
    expect(getMessageFromMap('chat-x', '1000')).toBeFalsy()
  })

  it('a chat deleted while the prefetch runs is skipped and the other chats are still prefetched', async () => {
    fake.server.addChat('chat-home', 1, 3)
    fake.server.addChat('chat-keep', 1000, 6)
    fake.server.addChat('chat-delete', 2000, 6)
    await syncChatList()
    await cacheChat('chat-keep', 'chat-home')
    await cacheChat('chat-delete', 'chat-home')

    await goOffline()
    fake.server.appendMessages('chat-keep', 1006, 5)
    fake.server.appendMessages('chat-delete', 2006, 5)
    let deleted = false
    fake.server.hooks.beforeResponse = async (request) => {
      if (!deleted && request.channelId === 'chat-delete' && request.method === 'loadNextMessageId') {
        deleted = true
        delete fake.server.channels['chat-delete']
        deleteChannelFromAllChannels('chat-delete')
        store.dispatch(removeChannelCachesAC('chat-delete') as any)
        await sleep(20)
      }
    }
    await goOnline()
    await waitForPrefetchToFinish()

    expect(deleted).toBe(true)
    expect(getLatestLoadedSegment('chat-delete')).toBeNull()
    expect(getMessageFromMap('chat-delete', '2006')).toBeFalsy()
    expect(getLatestLoadedSegment('chat-keep')).toEqual({ startId: '1000', endId: '1010' })
  })

  it('a flapping connection (online, offline, online) ends with every message once', async () => {
    fake.server.addChat('chat-a', 1, 5)
    fake.server.addChat('chat-x', 1000, 6)
    await syncChatList()
    await cacheChat('chat-x', 'chat-a')

    await goOffline()
    fake.server.appendMessages('chat-x', 1006, 60)
    await goOnline()
    await sleep(200)
    await goOffline()
    await goOnline()
    await waitForPrefetchToFinish()

    await goOffline()
    await openChat('chat-x')
    expectNoDuplicates()
    expect(getLatestLoadedSegment('chat-x')).toEqual({ startId: '1000', endId: '1065' })
    expect(getLatestMessageSnapshot('chat-x')).toBeNull()
  })

  it('reconnecting with nothing new makes no prefetch requests', async () => {
    fake.server.addChat('chat-a', 1, 5)
    fake.server.addChat('chat-x', 1000, 6)
    await syncChatList()
    await cacheChat('chat-x', 'chat-a')

    await goOffline()
    await goOnline()
    await waitForPrefetchToFinish()

    expect(prefetchRequests()).toEqual([])
  })

  it('a live message after the prefetch joins the same cache, so it is shown offline too', async () => {
    fake.server.addChat('chat-a', 1, 5)
    fake.server.addChat('chat-x', 1000, 6)
    await syncChatList()
    await cacheChat('chat-x', 'chat-a')

    await goOffline()
    fake.server.appendMessages('chat-x', 1006, 5)
    await goOnline()
    await waitForPrefetchToFinish()

    // Online, a new message arrives in chat X (which is not open).
    const [live] = fake.server.appendMessages('chat-x', 1011, 1)
    await runSaga(
      { dispatch: (action: any) => store.dispatch(action), getState: () => store.getState() },
      handleChannelMessageEvent as any,
      { channel: { ...fake.server.channels['chat-x'] }, message: { ...live } },
      fake.server.client()
    ).toPromise()

    await goOffline()
    await openChat('chat-x')
    expect(visibleIds()).toEqual(ids(1000, 12))
  })
})
