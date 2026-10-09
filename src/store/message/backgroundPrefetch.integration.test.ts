/**
 * Integration tests: background prefetch of cached chats after reconnect.
 *
 * These run the real Redux store with every real saga and reducer. Only the
 * chat server is replaced (FakeMessageServer). Each test drives the app the
 * way the UI does (open a chat, go offline, come back online, the chat list
 * syncs, open a chat offline) and asserts what the user would see in the
 * message list, plus what was requested from the server.
 */
import log from 'loglevel'
import { runSaga } from 'redux-saga'
import store from '../index'
import { setClient } from '../../common/client'
import { FakeMessageServer } from '../../testUtils/fakeMessageServer'
import { resetMessageListFixtureIds } from '../../testUtils/messageFixtures'
import {
  clearMessagesMap,
  getContiguousNextMessages,
  getContiguousPrevMessages,
  getLatestLoadedSegment,
  getLatestMessageSnapshot,
  getMessageFromMap
} from '../../helpers/messagesHalper'
import {
  deleteChannelFromAllChannels,
  destroyChannelsMap,
  getChannelFromMap,
  setActiveChannelId
} from '../../helpers/channelHalper'
import { CONNECTION_STATUS } from '../user/constants'
import { LOADING_STATE } from '../../helpers/constants'
import { setConnectionStatusAC } from '../user/actions'
import { getChannelsAC, removeChannelCachesAC, switchChannelActionAC } from '../channel/actions'
import { handleChannelMessageEvent, handleClearHistoryEvent } from '../evetns/inedx'
import {
  addMessagesAC,
  clearVisibleMessagesMapAC,
  loadDefaultMessagesAC,
  loadNearUnreadAC,
  reloadActiveChannelAfterReconnectAC
} from './actions'
import { __resetMessageSagaTestState } from './saga'

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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const waitUntil = async (condition: () => boolean, what: string, timeoutMs = 8000) => {
  const started = Date.now()
  while (!condition()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error(`Timed out waiting for: ${what}`)
    }
    await sleep(20)
  }
}

const ids = (from: number, count: number) => Array.from({ length: count }, (_, index) => String(from + index))

const state = () => store.getState() as any
const visibleIds = () => state().MessageReducer.activeChannelMessages.map((message: any) => message.id)

let server: FakeMessageServer

const syncChatList = async () => {
  store.dispatch(getChannelsAC({ filter: {}, limit: 20, sort: 'byLastMessage', search: '' } as any) as any)
  await waitUntil(() => state().ChannelReducer.channelsLoadingState === LOADING_STATE.LOADED, 'chat list sync')
  await sleep(50)
}

const goOffline = async () => {
  store.dispatch(setConnectionStatusAC(CONNECTION_STATUS.DISCONNECTED))
  await sleep(20)
}

// Like the app: the connection comes back, then the chat list syncs.
const goOnline = async () => {
  store.dispatch(setConnectionStatusAC(CONNECTION_STATUS.CONNECTED))
  await syncChatList()
}

/**
 * Waits until the background prefetch is done. It starts once the chat list
 * sync has settled (at most a 1.5 s grace period), then requests page by page.
 */
const waitForPrefetchToFinish = async () => {
  await sleep(1800)
  let lastCount = -1
  let stableFor = 0
  while (stableFor < 500) {
    await sleep(100)
    stableFor = server.requests.length === lastCount ? stableFor + 100 : 0
    lastCount = server.requests.length
  }
}

const prefetchRequests = (channelId?: string) =>
  server.requests.filter(
    (request) =>
      request.method === 'loadNextMessageId' &&
      request.limit === 40 &&
      (!channelId || request.channelId === channelId) &&
      !openLoadRequests.has(request)
  )

// Requests made by the chat's own load (openChat), so they are not counted as prefetch.
const openLoadRequests = new Set<any>()

/** The user reads the chat up to its newest message (as the server records it). */
const markRead = (channelId: string) => {
  const last = server.lastMessage(channelId)
  server.channels[channelId] = {
    ...server.channels[channelId],
    newMessageCount: 0,
    lastDisplayedMessageId: last ? last.id : ''
  }
}

/** Opens a chat online so its messages are cached, reads it, then leaves it for `next`. */
const cacheChat = async (channelId: string, next: string) => {
  await openChat(channelId)
  markRead(channelId)
  await openChat(next)
}

const expectNoDuplicates = () => {
  const visible = visibleIds()
  expect(new Set(visible).size).toBe(visible.length)
}

const currentChannel = (channelId: string) => getChannelFromMap(channelId) || server.channels[channelId]

/** Opens a chat the way the chat list + message list do. */
const openChat = async (channelId: string) => {
  const before = server.requests.length
  const channel = currentChannel(channelId)
  store.dispatch(switchChannelActionAC(channel) as any)
  await waitUntil(() => state().ChannelReducer.activeChannel?.id === channelId, `switch to ${channelId}`)
  const opened = currentChannel(channelId)
  store.dispatch(clearVisibleMessagesMapAC() as any)
  if (opened.newMessageCount && opened.lastDisplayedMessageId) {
    store.dispatch(loadNearUnreadAC(opened) as any)
  } else {
    store.dispatch(loadDefaultMessagesAC(opened) as any)
  }
  await sleep(300)
  server.requests.slice(before).forEach((request) => openLoadRequests.add(request))
}

beforeAll(() => {
  jest.spyOn(log, 'info').mockImplementation(() => undefined)
  jest.spyOn(log, 'error').mockImplementation(() => undefined)
  jest.spyOn(log, 'warn').mockImplementation(() => undefined)
})

beforeEach(async () => {
  resetMessageListFixtureIds()
  clearMessagesMap()
  destroyChannelsMap()
  setActiveChannelId('')
  __resetMessageSagaTestState()
  openLoadRequests.clear()
  server = new FakeMessageServer()
  server.isAppOnline = () => state().UserReducer.connectionStatus === CONNECTION_STATUS.CONNECTED
  setClient(server.client() as any)
  store.dispatch(setConnectionStatusAC(CONNECTION_STATUS.CONNECTED))
})

afterEach(async () => {
  // Stop any prefetch still waiting, so it cannot leak into the next test.
  store.dispatch(setConnectionStatusAC(CONNECTION_STATUS.DISCONNECTED))
  server.hooks = {}
  await sleep(50)
})

describe('integration: prefetch of cached chats after reconnect', () => {
  it("the user's steps: open X, leave it, offline, 10 arrive, online, offline again, open X -> all 10 shown", async () => {
    server.addChat('chat-a', 1, 5)
    server.addChat('chat-x', 1000, 6)
    await syncChatList()

    await openChat('chat-x')
    expect(visibleIds()).toEqual(ids(1000, 6))
    await openChat('chat-a')

    await goOffline()
    server.appendMessages('chat-x', 1006, 10)
    await goOnline()
    await waitForPrefetchToFinish()

    await goOffline()
    const requestsBefore = server.requests.length
    await openChat('chat-x')

    expect(visibleIds()).toEqual(ids(1000, 16))
    expect(server.requests.length).toBe(requestsBefore)
    expect(state().MessageReducer.messageListGap).toBeNull()
    expect(getLatestMessageSnapshot('chat-x')).toBeNull()
  })

  it('same steps for a chat that was read: opening offline lands on the unread messages with nothing missing', async () => {
    server.addChat('chat-a', 1, 5)
    server.addChat('chat-x', 1000, 6)
    await syncChatList()
    await cacheChat('chat-x', 'chat-a')

    await goOffline()
    server.appendMessages('chat-x', 1006, 10)
    await goOnline()
    expect(currentChannel('chat-x').newMessageCount).toBe(10)
    expect(currentChannel('chat-x').lastDisplayedMessageId).toBe('1005')
    await waitForPrefetchToFinish()

    await goOffline()
    const requestsBefore = server.requests.length
    await openChat('chat-x')

    expect(visibleIds()).toEqual(ids(1000, 16))
    expect(state().MessageReducer.unreadMessageId).toBe('1005')
    expect(state().MessageReducer.messageListGap).toBeNull()
    expect(server.requests.length).toBe(requestsBefore)
  })

  it('prefetches all 20 cached chats with new messages (no chat limit), most recently visited first', async () => {
    server.addChat('chat-home', 1, 3)
    for (let index = 0; index < 20; index++) {
      server.addChat(`chat-${index}`, 1000, 6)
    }
    await syncChatList()
    for (let index = 0; index < 20; index++) {
      await cacheChat(`chat-${index}`, 'chat-home')
    }

    await goOffline()
    for (let index = 0; index < 20; index++) {
      server.appendMessages(`chat-${index}`, 1006, 5)
    }
    await goOnline()
    await waitForPrefetchToFinish()

    expect(prefetchRequests().map((request) => request.channelId)).toEqual(
      Array.from({ length: 20 }, (_, index) => `chat-${19 - index}`)
    )

    await goOffline()
    const requestsBefore = server.requests.length
    for (const index of [0, 7, 8, 19]) {
      await openChat(`chat-${index}`)
      expect(visibleIds()).toEqual(ids(1000, 11))
    }
    expect(server.requests.length).toBe(requestsBefore)
  })

  it('prefetches messages sent from another device while offline (no unread count)', async () => {
    server.addChat('chat-a', 1, 5)
    server.addChat('chat-x', 1000, 6)
    await syncChatList()
    await cacheChat('chat-x', 'chat-a')

    await goOffline()
    server.appendMessages('chat-x', 1006, 4, false)
    await goOnline()
    expect(currentChannel('chat-x').newMessageCount).toBe(0)
    await waitForPrefetchToFinish()

    await goOffline()
    await openChat('chat-x')

    expect(visibleIds()).toEqual(ids(1000, 10))
  })

  it('does not prefetch chats that were never opened, or chats that are up to date', async () => {
    server.addChat('chat-a', 1, 5)
    server.addChat('chat-cached', 1000, 6)
    server.addChat('chat-never-opened', 5000, 6)
    await syncChatList()
    await cacheChat('chat-cached', 'chat-a')

    await goOffline()
    server.appendMessages('chat-never-opened', 5006, 10)
    await goOnline()
    await waitForPrefetchToFinish()

    expect(prefetchRequests()).toEqual([])
    expect(server.requestsFor('chat-never-opened')).toEqual([])
  })

  it('leaves the open chat alone: no prefetch request for it and its message list is unchanged', async () => {
    server.addChat('chat-x', 1000, 6)
    server.addChat('chat-open', 1, 5)
    await syncChatList()
    await cacheChat('chat-x', 'chat-open')
    const openBefore = visibleIds()

    await goOffline()
    server.appendMessages('chat-open', 6, 3)
    server.appendMessages('chat-x', 1006, 3)
    await goOnline()
    await waitForPrefetchToFinish()

    expect(prefetchRequests('chat-open')).toEqual([])
    expect(prefetchRequests('chat-x')).toHaveLength(1)
    expect(state().ChannelReducer.activeChannel.id).toBe('chat-open')
    expect(visibleIds()).toEqual(openBefore)
  })

  it('fills a large gap page by page and stops at 400; the rest stays available online only', async () => {
    server.addChat('chat-a', 1, 5)
    server.addChat('chat-x', 1000, 6)
    await syncChatList()
    await cacheChat('chat-x', 'chat-a')

    await goOffline()
    server.appendMessages('chat-x', 1006, 450)
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
    server.addChat('chat-a', 1, 5)
    server.addChat('chat-x', 1000, 6)
    await syncChatList()
    await cacheChat('chat-x', 'chat-a')

    await goOffline()
    server.appendMessages('chat-x', 1006, 100)
    let dropped = false
    server.hooks.beforeResponse = async (request) => {
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

    server.hooks = {}
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
    server.addChat('chat-home', 1, 3)
    server.addChat('chat-ok', 1000, 6)
    server.addChat('chat-broken', 2000, 6)
    await syncChatList()
    await cacheChat('chat-ok', 'chat-home')
    await cacheChat('chat-broken', 'chat-home')

    await goOffline()
    server.appendMessages('chat-ok', 1006, 5)
    server.appendMessages('chat-broken', 2006, 5)
    server.hooks.shouldFail = (request) => request.channelId === 'chat-broken' && request.limit === 40
    await goOnline()
    await waitForPrefetchToFinish()

    expect(prefetchRequests().map((request) => request.channelId)).toEqual(['chat-broken', 'chat-ok'])
    expect(getLatestLoadedSegment('chat-ok')).toEqual({ startId: '1000', endId: '1010' })
    expect(getLatestLoadedSegment('chat-broken')).toEqual({ startId: '2000', endId: '2005' })
  })

  it('the user opens the chat while its prefetch request is running: one correct list, no duplicates', async () => {
    server.addChat('chat-a', 1, 5)
    server.addChat('chat-x', 1000, 6)
    await syncChatList()
    await cacheChat('chat-x', 'chat-a')

    await goOffline()
    server.appendMessages('chat-x', 1006, 10)
    let opened = false
    server.hooks.beforeResponse = async (request) => {
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
    server.addChat('chat-a', 1, 5)
    server.addChat('chat-x', 1000, 6)
    await syncChatList()
    await cacheChat('chat-x', 'chat-a')

    await goOffline()
    server.appendMessages('chat-x', 1006, 10)
    let cleared = false
    server.hooks.beforeResponse = async (request) => {
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
    server.addChat('chat-home', 1, 3)
    server.addChat('chat-keep', 1000, 6)
    server.addChat('chat-delete', 2000, 6)
    await syncChatList()
    await cacheChat('chat-keep', 'chat-home')
    await cacheChat('chat-delete', 'chat-home')

    await goOffline()
    server.appendMessages('chat-keep', 1006, 5)
    server.appendMessages('chat-delete', 2006, 5)
    let deleted = false
    server.hooks.beforeResponse = async (request) => {
      if (!deleted && request.channelId === 'chat-delete' && request.method === 'loadNextMessageId') {
        deleted = true
        delete server.channels['chat-delete']
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
    server.addChat('chat-a', 1, 5)
    server.addChat('chat-x', 1000, 6)
    await syncChatList()
    await cacheChat('chat-x', 'chat-a')

    await goOffline()
    server.appendMessages('chat-x', 1006, 60)
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
    server.addChat('chat-a', 1, 5)
    server.addChat('chat-x', 1000, 6)
    await syncChatList()
    await cacheChat('chat-x', 'chat-a')

    await goOffline()
    await goOnline()
    await waitForPrefetchToFinish()

    expect(prefetchRequests()).toEqual([])
  })

  it('a live message after the prefetch joins the same cache, so it is shown offline too', async () => {
    server.addChat('chat-a', 1, 5)
    server.addChat('chat-x', 1000, 6)
    await syncChatList()
    await cacheChat('chat-x', 'chat-a')

    await goOffline()
    server.appendMessages('chat-x', 1006, 5)
    await goOnline()
    await waitForPrefetchToFinish()

    // Online, a new message arrives in chat X (which is not open).
    const [live] = server.appendMessages('chat-x', 1011, 1)
    await runSaga(
      { dispatch: (action: any) => store.dispatch(action), getState: () => store.getState() },
      handleChannelMessageEvent as any,
      { channel: { ...server.channels['chat-x'] }, message: { ...live } },
      server.client()
    ).toPromise()

    await goOffline()
    await openChat('chat-x')
    expect(visibleIds()).toEqual(ids(1000, 12))
  })
})

/**
 * Scrolls the open chat offline the way the message list does (cached pages of
 * 20, no server): to the end, then back to the start. Returns every id shown.
 */
const scrollThroughCacheOffline = (channelId: string) => {
  const seen = new Set<string>(visibleIds())
  const remember = () => visibleIds().forEach((id: string) => seen.add(id))
  for (let page = 0; page < 50; page++) {
    const visible = state().MessageReducer.activeChannelMessages
    const next = getContiguousNextMessages(channelId, visible[visible.length - 1], 20, true)
    if (!next.length) break
    store.dispatch(addMessagesAC(JSON.parse(JSON.stringify(next)), 'next') as any)
    remember()
  }
  const reachedEnd = visibleIds().at(-1)
  for (let page = 0; page < 50; page++) {
    const visible = state().MessageReducer.activeChannelMessages
    const previous = getContiguousPrevMessages(channelId, visible[0], 20)
    if (!previous.length) break
    store.dispatch(addMessagesAC(JSON.parse(JSON.stringify(previous)), 'prev') as any)
    remember()
  }
  return { seen, reachedEnd, reachedStart: visibleIds()[0] }
}

describe('integration: using prefetched chats, and the app around the prefetch', () => {
  it('offline, every prefetched message can be reached by scrolling, with no server requests', async () => {
    server.addChat('chat-a', 1, 5)
    server.addChat('chat-x', 1000, 6)
    await syncChatList()
    await cacheChat('chat-x', 'chat-a')

    await goOffline()
    server.appendMessages('chat-x', 1006, 100)
    await goOnline()
    await waitForPrefetchToFinish()

    await goOffline()
    const requestsBefore = server.requests.length
    await openChat('chat-x')
    expect(visibleIds()).toEqual(ids(1005, 40))

    // Scrolling down and up through the cache, the way the message list does offline.
    const { seen, reachedEnd, reachedStart } = scrollThroughCacheOffline('chat-x')

    expect(reachedEnd).toBe('1105')
    expect(reachedStart).toBe('1000')
    expect(Array.from(seen).sort()).toEqual(ids(1000, 106))
    expectNoDuplicates()
    expect(server.requests.length).toBe(requestsBefore)
  })

  it('reconnect with a chat open: the open chat reloads first, other chats are prefetched after it finishes', async () => {
    server.addChat('chat-x', 1000, 6)
    server.addChat('chat-open', 1, 5)
    await syncChatList()
    await cacheChat('chat-x', 'chat-open')

    await goOffline()
    server.appendMessages('chat-open', 6, 3)
    server.appendMessages('chat-x', 1006, 5)
    // The open chat's reload is slow.
    server.hooks.beforeResponse = async (request) => {
      if (request.channelId === 'chat-open') {
        await sleep(800)
      }
    }
    store.dispatch(setConnectionStatusAC(CONNECTION_STATUS.CONNECTED))
    // What the message list does on reconnect.
    store.dispatch(reloadActiveChannelAfterReconnectAC(currentChannel('chat-open'), '5', true) as any)
    await syncChatList()
    await waitForPrefetchToFinish()

    const openReload = server.requestsFor('chat-open').filter((request) => (request.sentAt || 0) > 0)
    const xPrefetch = prefetchRequests('chat-x')
    expect(openReload.length).toBeGreaterThan(0)
    expect(xPrefetch).toHaveLength(1)
    const reloadDone = Math.max(...openReload.map((request) => request.respondedAt || 0))
    expect(xPrefetch[0].sentAt).toBeGreaterThanOrEqual(reloadDone)
    expect(visibleIds().slice(-3)).toEqual(['6', '7', '8'])
    expect(getLatestLoadedSegment('chat-x')).toEqual({ startId: '1000', endId: '1010' })
  })

  it('the connection drops while a chat is loading: its follow-up page loads send nothing while offline', async () => {
    server.addChat('chat-a', 1, 5)
    server.addChat('chat-y', 1000, 120)
    await syncChatList()

    let dropped = false
    server.hooks.beforeResponse = async (request) => {
      if (!dropped && request.channelId === 'chat-y') {
        dropped = true
        store.dispatch(setConnectionStatusAC(CONNECTION_STATUS.DISCONNECTED))
      }
    }
    await openChat('chat-y')
    await sleep(500)

    expect(dropped).toBe(true)
    expect(server.requests.filter((request) => request.sentOnline === false)).toEqual([])
  })

  it('a second reconnect continues from where the cache ends, without fetching the same messages again', async () => {
    server.addChat('chat-a', 1, 5)
    server.addChat('chat-x', 1000, 6)
    await syncChatList()
    await cacheChat('chat-x', 'chat-a')

    await goOffline()
    server.appendMessages('chat-x', 1006, 5)
    await goOnline()
    await waitForPrefetchToFinish()

    await goOffline()
    server.appendMessages('chat-x', 1011, 7)
    await goOnline()
    await waitForPrefetchToFinish()

    expect(prefetchRequests('chat-x').map((request) => request.messageId)).toEqual(['1005', '1010'])
    expect(getLatestLoadedSegment('chat-x')).toEqual({ startId: '1000', endId: '1017' })
    expect(getLatestMessageSnapshot('chat-x')).toBeNull()
  })

  it('the 400 limit is per chat: a big chat does not take from the others', async () => {
    server.addChat('chat-home', 1, 3)
    server.addChat('chat-big', 1000, 6)
    server.addChat('chat-small', 5000, 6)
    await syncChatList()
    await cacheChat('chat-small', 'chat-home')
    await cacheChat('chat-big', 'chat-home')

    await goOffline()
    server.appendMessages('chat-big', 1006, 450)
    server.appendMessages('chat-small', 5006, 5)
    await goOnline()
    await waitForPrefetchToFinish()

    expect(getLatestLoadedSegment('chat-big')).toEqual({ startId: '1000', endId: '1405' })
    expect(getLatestLoadedSegment('chat-small')).toEqual({ startId: '5000', endId: '5010' })
    expect(getLatestMessageSnapshot('chat-small')).toBeNull()
  })

  it('the whole cache is cleared during the prefetch (e.g. logout): nothing is written back and it stops', async () => {
    server.addChat('chat-home', 1, 3)
    server.addChat('chat-1', 1000, 6)
    server.addChat('chat-2', 2000, 6)
    await syncChatList()
    await cacheChat('chat-1', 'chat-home')
    await cacheChat('chat-2', 'chat-home')

    await goOffline()
    server.appendMessages('chat-1', 1006, 5)
    server.appendMessages('chat-2', 2006, 5)
    let cleared = false
    server.hooks.beforeResponse = async (request) => {
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
