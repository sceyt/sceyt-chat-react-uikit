/**
 * Shared harness for the background-prefetch integration tests: the real Redux
 * store with every real saga and reducer, and a fake chat server.
 *
 * Test files using it must call, at the top level:
 *   jest.unmock('store')   // setupTests replaces the store with a stub
 *   jest.mock('../../helpers/messageListNavigator', ...)
 *   setupPrefetchIntegration()
 */
import log from 'loglevel'
import store from '../store'
import { setClient } from '../common/client'
import { FakeMessageServer } from './fakeMessageServer'
import { resetMessageListFixtureIds } from './messageFixtures'
import { clearMessagesMap, getContiguousNextMessages, getContiguousPrevMessages } from '../helpers/messagesHalper'
import { destroyChannelsMap, getChannelFromMap, setActiveChannelId } from '../helpers/channelHalper'
import { CONNECTION_STATUS } from '../store/user/constants'
import { LOADING_STATE } from '../helpers/constants'
import { setConnectionStatusAC } from '../store/user/actions'
import { getChannelsAC, resendPendingChannelReadsAC, switchChannelActionAC } from '../store/channel/actions'
import { resendPendingPinMutationsAC } from '../store/pinned/actions'
import {
  addMessagesAC,
  clearVisibleMessagesMapAC,
  loadDefaultMessagesAC,
  loadNearUnreadAC,
  removeChannelMarkersAC,
  resendPendingMessageMutationsAC
} from '../store/message/actions'
import { __resetMessageSagaTestState } from '../store/message/saga'

export { store }

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const waitUntil = async (condition: () => boolean, what: string, timeoutMs = 8000) => {
  const started = Date.now()
  while (!condition()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error(`Timed out waiting for: ${what}`)
    }
    await sleep(20)
  }
}

export const ids = (from: number, count: number) => Array.from({ length: count }, (_, index) => String(from + index))

export const state = () => store.getState() as any
export const visibleIds = () => state().MessageReducer.activeChannelMessages.map((message: any) => message.id)

/** The fake server of the current test (replaced before each test). */
export const fake = {} as { server: FakeMessageServer }

export const syncChatList = async () => {
  store.dispatch(getChannelsAC({ filter: {}, limit: 20, sort: 'byLastMessage', search: '' } as any) as any)
  await waitUntil(() => state().ChannelReducer.channelsLoadingState === LOADING_STATE.LOADED, 'chat list sync')
  await sleep(50)
}

export const goOffline = async () => {
  store.dispatch(setConnectionStatusAC(CONNECTION_STATUS.DISCONNECTED))
  await sleep(20)
}

/**
 * Like the app: the connection comes back, then the chat list syncs. Mirrors
 * handleConnectionStatusChangedEvent (store/evetns), which also resends queued
 * edits/deletes, read markers and pin changes (roles loading is left out).
 */
export const goOnline = async () => {
  store.dispatch(setConnectionStatusAC(CONNECTION_STATUS.CONNECTED))
  store.dispatch(resendPendingMessageMutationsAC(CONNECTION_STATUS.CONNECTED) as any)
  store.dispatch(resendPendingChannelReadsAC(CONNECTION_STATUS.CONNECTED) as any)
  store.dispatch(resendPendingPinMutationsAC() as any)
  await syncChatList()
}

/**
 * Waits until the background prefetch is done. It starts once the chat list
 * sync has settled (at most a 1.5 s grace period), then requests page by page.
 */
export const waitForPrefetchToFinish = async () => {
  await sleep(1800)
  let lastCount = -1
  let stableFor = 0
  while (stableFor < 500) {
    await sleep(100)
    stableFor = fake.server.requests.length === lastCount ? stableFor + 100 : 0
    lastCount = fake.server.requests.length
  }
}

export const prefetchRequests = (channelId?: string) =>
  fake.server.requests.filter(
    (request) =>
      request.method === 'loadNextMessageId' &&
      request.limit === 40 &&
      (!channelId || request.channelId === channelId) &&
      !openLoadRequests.has(request)
  )

// Requests made by the chat's own load (openChat), so they are not counted as prefetch.
export const openLoadRequests = new Set<any>()

/** The user reads the chat up to its newest message (as the server records it). */
export const markRead = (channelId: string) => {
  const last = fake.server.lastMessage(channelId)
  fake.server.channels[channelId] = {
    ...fake.server.channels[channelId],
    newMessageCount: 0,
    lastDisplayedMessageId: last ? last.id : ''
  }
}

/** Opens a chat online so its messages are cached, reads it, then leaves it for `next`. */
export const cacheChat = async (channelId: string, next: string) => {
  await openChat(channelId)
  markRead(channelId)
  await openChat(next)
}

export const expectNoDuplicates = () => {
  const visible = visibleIds()
  expect(new Set(visible).size).toBe(visible.length)
}

export const currentChannel = (channelId: string) => getChannelFromMap(channelId) || fake.server.channels[channelId]

/** Opens a chat the way the chat list + message list do. */
export const openChat = async (channelId: string) => {
  const before = fake.server.requests.length
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
  fake.server.requests.slice(before).forEach((request) => openLoadRequests.add(request))
}

/** Registers the per-test setup: real store, fresh fake server, connected. */
export const setupPrefetchIntegration = () => {
  beforeAll(() => {
    jest.spyOn(log, 'info').mockImplementation(() => undefined)
    jest.spyOn(log, 'error').mockImplementation(() => undefined)
    jest.spyOn(log, 'warn').mockImplementation(() => undefined)
  })

  beforeEach(async () => {
    resetMessageListFixtureIds()
    clearMessagesMap()
    // Receipt identities are session state too; repeated test IDs must not
    // inherit the previous fake server's readers.
    for (const channelId of Object.keys(store.getState().MessageReducer.messageMarkers)) {
      store.dispatch(removeChannelMarkersAC(channelId))
    }
    destroyChannelsMap()
    setActiveChannelId('')
    __resetMessageSagaTestState()
    openLoadRequests.clear()
    fake.server = new FakeMessageServer()
    fake.server.isAppOnline = () => state().UserReducer.connectionStatus === CONNECTION_STATUS.CONNECTED
    setClient(fake.server.client() as any)
    store.dispatch(setConnectionStatusAC(CONNECTION_STATUS.CONNECTED))
  })

  afterEach(async () => {
    // Stop any prefetch still waiting, so it cannot leak into the next test.
    store.dispatch(setConnectionStatusAC(CONNECTION_STATUS.DISCONNECTED))
    fake.server.hooks = {}
    await sleep(50)
  })
}

/**
 * Scrolls the open chat offline the way the message list does (cached pages of
 * 20, no server): to the end, then back to the start. Returns every id shown.
 */
export const scrollThroughCacheOffline = (channelId: string) => {
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
