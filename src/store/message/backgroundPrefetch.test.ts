/**
 * Background prefetch of cached chats after reconnect.
 *
 * Messages that arrived while offline in chats the user opened this session are
 * fetched once the connection is back, so those chats can later be opened
 * offline with the messages. This is best-effort cache warming: a partial page
 * or a new disconnect still leaves messages that are only available online.
 */
import { runSaga } from 'redux-saga'
import log from 'loglevel'
import { setClient } from '../../common/client'
import {
  addMessageToMap,
  clearMessagesMap,
  extendSegmentForward,
  getInMemoryCachedChannelIds,
  isInLoadedSegment,
  getActiveSegment,
  getLatestLoadedSegment,
  getLatestMessageSnapshot,
  getMessageFromMap,
  removeMessagesFromMap,
  setActiveSegment,
  setLatestMessageSnapshot,
  trackChannelVisit
} from '../../helpers/messagesHalper'
import {
  addChannelToAllChannels,
  destroyChannelsMap,
  getChannelFromMap,
  query,
  removeChannelFromMap,
  setActiveChannelId,
  setChannelInMap
} from '../../helpers/channelHalper'
import { CONNECTION_STATUS } from '../user/constants'
import { LOADING_STATE } from '../../helpers/constants'
import {
  makeChannel,
  makeMessage,
  makePendingMessage,
  resetMessageListFixtureIds
} from '../../testUtils/messageFixtures'
import { __messageSagaTestables, __resetMessageSagaTestState } from './saga'
import { loadNearUnreadAC, setMessageListGapAC, setMessagesAC, setUnreadMessageIdAC } from './actions'
import { IMessage } from '../../types'

const state: any = {}
const resetState = () => {
  state.UserReducer = { connectionStatus: CONNECTION_STATUS.CONNECTED, waitToSendPendingMessages: false }
  state.ChannelReducer = { channelsLoadingState: LOADING_STATE.LOADED, activeChannel: {}, channels: [] }
  state.MessageReducer = { activeChannelMessages: [], pendingPollActions: {}, pendingMessageMutations: {} }
}

const mockStore = {
  getState: jest.fn(() => state),
  dispatch: jest.fn()
}

jest.mock('../index', () => ({
  __esModule: true,
  get default() {
    return mockStore
  }
}))

jest.mock('../../helpers/messageListNavigator', () => ({
  navigateToLatest: jest.fn(),
  navigateToMessage: jest.fn(),
  registerJumpToLatest: jest.fn(),
  unregisterJumpToLatest: jest.fn(),
  registerMessageListNavigator: jest.fn(),
  unregisterMessageListNavigator: jest.fn()
}))

const run = (saga: any, ...args: any[]) =>
  runSaga({ dispatch: () => undefined, getState: () => state }, saga, ...args).toPromise()

// Fake server: per-channel history; loadNextMessageId returns up to `limit`
// messages after the given id. `onLoadNext` runs before the response resolves.
type ServerHooks = {
  onLoadNext?: (channelId: string, fromId: string) => void | Promise<void>
  fail?: boolean
  /** Rewrites the server response (e.g. unsorted, duplicated or older messages). */
  transform?: (messages: IMessage[], fromId: string) => IMessage[]
}
const createServer = (histories: Record<string, IMessage[]>, hooks: ServerHooks = {}) => {
  const loadNextCalls: Array<{ channelId: string; fromId: string; limit: number }> = []
  const builtFor: string[] = []
  class MessageListQueryBuilder {
    channelId: string
    limit = jest.fn()
    reverse = jest.fn()
    constructor(channelId: string) {
      this.channelId = channelId
      builtFor.push(channelId)
    }

    build = async () => {
      const channelId = this.channelId
      const query: any = {
        limit: 0,
        reverse: true,
        loadNextMessageId: async (fromId: string) => {
          loadNextCalls.push({ channelId, fromId, limit: query.limit })
          if (hooks.onLoadNext) {
            await hooks.onLoadNext(channelId, fromId)
          }
          if (hooks.fail) {
            throw new Error('network lost')
          }
          const newer = (histories[channelId] || []).filter((message) => BigInt(message.id) > BigInt(fromId))
          const page = newer.slice(0, query.limit)
          return {
            messages: hooks.transform ? hooks.transform(page, fromId) : page,
            hasNext: newer.length > query.limit
          }
        }
      }
      return query
    }
  }
  setClient({ user: { id: 'current-user' }, Channel: { create: jest.fn() }, MessageListQueryBuilder } as any)
  return { loadNextCalls, builtFor }
}

const ids = (from: number, count: number) => Array.from({ length: count }, (_, index) => String(from + index))

// A chat the user opened earlier: messages 1000-1005 cached, `missing` newer
// messages on the server, chat list knows the newest one as lastMessage.
const setupCachedChat = (channelId: string, missing: number, visit = true) => {
  const cached = ids(1000, 6).map((id) => makeMessage({ id, channelId, body: `cached-${id}`, incoming: true }))
  const arrived = ids(1006, missing).map((id) => makeMessage({ id, channelId, body: `arrived-${id}`, incoming: true }))
  cached.forEach((message) => addMessageToMap(channelId, message))
  // Registers the segment, then restores the open chat's active segment.
  const previousActive = getActiveSegment()
  setActiveSegment(channelId, '1000', '1005')
  if (previousActive) {
    setActiveSegment('channel-open', previousActive.startId, previousActive.endId)
  }
  const lastMessage = arrived.at(-1) || cached.at(-1)!
  setChannelInMap(makeChannel({ id: channelId, lastMessage, newMessageCount: missing, lastDisplayedMessageId: '1005' }))
  setLatestMessageSnapshot(channelId, lastMessage)
  if (visit) {
    trackChannelVisit(channelId)
  }
  return { cached, arrived, all: [...cached, ...arrived], lastMessage }
}

const setupOpenChat = () => {
  const channelId = 'channel-open'
  addMessageToMap(channelId, makeMessage({ id: '1', channelId, body: 'open-1' }))
  addMessageToMap(channelId, makeMessage({ id: '2', channelId, body: 'open-2' }))
  setChannelInMap(makeChannel({ id: channelId, lastMessage: makeMessage({ id: '2', channelId }) }))
  setActiveSegment(channelId, '1', '2')
  setActiveChannelId(channelId)
  trackChannelVisit(channelId)
  return channelId
}

const cachedIds = (channelId: string, from: number, count: number) =>
  ids(from, count).filter((id) => !!getMessageFromMap(channelId, id))

describe('background prefetch of cached chats after reconnect', () => {
  beforeEach(() => {
    jest.spyOn(log, 'info').mockImplementation(() => undefined)
    jest.spyOn(log, 'error').mockImplementation(() => undefined)
    resetMessageListFixtureIds()
    clearMessagesMap()
    destroyChannelsMap()
    setActiveChannelId('')
    __resetMessageSagaTestState()
    resetState()
    mockStore.getState.mockImplementation(() => state)
  })

  afterEach(() => {
    jest.restoreAllMocks()
    clearMessagesMap()
    destroyChannelsMap()
    setActiveChannelId('')
    __resetMessageSagaTestState()
  })

  it('fetches the 10 messages that arrived while offline into the cache of a chat that is not open', async () => {
    setupOpenChat()
    const chat = setupCachedChat('channel-x', 10)
    const server = createServer({ 'channel-x': chat.all })

    await run(__messageSagaTestables.runBackgroundPrefetch)

    expect(server.loadNextCalls).toEqual([{ channelId: 'channel-x', fromId: '1005', limit: 40 }])
    expect(cachedIds('channel-x', 1006, 10)).toHaveLength(10)
    // Joined to the cached segment: contiguous 1000-1015.
    expect(getLatestLoadedSegment('channel-x')).toEqual({ startId: '1000', endId: '1015' })
    // The newest message is now in the normal cache path, so its snapshot is cleared.
    expect(getLatestMessageSnapshot('channel-x')).toBeNull()
  })

  it('your steps: after the prefetch, opening the chat offline shows all 10 messages', async () => {
    setupOpenChat()
    const chat = setupCachedChat('channel-x', 10)
    createServer({ 'channel-x': chat.all })
    await run(__messageSagaTestables.runBackgroundPrefetch)

    // Go offline again and open chat X.
    state.UserReducer.connectionStatus = CONNECTION_STATUS.DISCONNECTED
    setActiveChannelId('channel-x')
    const channel = makeChannel({
      id: 'channel-x',
      lastMessage: chat.lastMessage,
      newMessageCount: 10,
      lastDisplayedMessageId: '1005'
    })
    const dispatched: any[] = []
    await runSaga(
      { dispatch: (action: any) => dispatched.push(action), getState: () => state },
      __messageSagaTestables.loadNearUnread,
      loadNearUnreadAC(channel)
    ).toPromise()

    const lastSetMessages = dispatched.filter((action) => action.type === setMessagesAC([], 'channel-x').type).at(-1)
    expect(lastSetMessages.payload.messages.map((message: any) => message.id)).toEqual(ids(1000, 16))
    expect(dispatched).toContainEqual(setUnreadMessageIdAC('1005'))
    // Nothing missing between the cache and the newest message: no gap is recorded.
    expect(dispatched.some((action) => action.type === setMessageListGapAC(null).type)).toBe(false)
  })

  it('does not touch the open chat or its active segment', async () => {
    const openChannelId = setupOpenChat()
    const chat = setupCachedChat('channel-x', 10)
    setActiveSegment(openChannelId, '1', '2')
    setActiveChannelId(openChannelId)
    const server = createServer({ 'channel-x': chat.all })

    await run(__messageSagaTestables.runBackgroundPrefetch)

    expect(server.builtFor).toEqual(['channel-x'])
    expect(getActiveSegment()).toEqual({ startId: '1', endId: '2' })
  })

  it('skips the open chat even when it has newer messages', async () => {
    setupCachedChat('channel-x', 10)
    setActiveChannelId('channel-x')
    const server = createServer({})

    await run(__messageSagaTestables.runBackgroundPrefetch)

    expect(server.loadNextCalls).toEqual([])
  })

  it('fills a gap larger than one page with several requests', async () => {
    setupOpenChat()
    const chat = setupCachedChat('channel-x', 100)
    const server = createServer({ 'channel-x': chat.all })

    await run(__messageSagaTestables.runBackgroundPrefetch)

    expect(server.loadNextCalls.map((call) => call.fromId)).toEqual(['1005', '1045', '1085'])
    expect(cachedIds('channel-x', 1006, 100)).toHaveLength(100)
    expect(getLatestLoadedSegment('channel-x')).toEqual({ startId: '1000', endId: '1105' })
    expect(getLatestMessageSnapshot('channel-x')).toBeNull()
  })

  it('stops a chat at 400 messages and keeps the snapshot for the rest', async () => {
    setupOpenChat()
    const chat = setupCachedChat('channel-x', 450)
    const server = createServer({ 'channel-x': chat.all })

    await run(__messageSagaTestables.runBackgroundPrefetch)

    expect(server.loadNextCalls).toHaveLength(10)
    expect(cachedIds('channel-x', 1006, 450)).toEqual(ids(1006, 400))
    // The fetched part is contiguous with the cache.
    expect(getLatestLoadedSegment('channel-x')).toEqual({ startId: '1000', endId: '1405' })
    // 1406-1455 are still only available online; the newest stays known via the snapshot.
    expect(getLatestMessageSnapshot('channel-x')?.id).toBe('1455')
  })

  it('stops when the connection drops during a request, keeping what already arrived', async () => {
    setupOpenChat()
    const chatA = setupCachedChat('channel-a', 5)
    const chatB = setupCachedChat('channel-b', 5)
    const server = createServer(
      { 'channel-a': chatA.all, 'channel-b': chatB.all },
      {
        onLoadNext: () => {
          state.UserReducer.connectionStatus = CONNECTION_STATUS.DISCONNECTED
        }
      }
    )

    await run(__messageSagaTestables.runBackgroundPrefetch)

    // channel-b was visited last, so it goes first; then the loop stops.
    expect(server.loadNextCalls.map((call) => call.channelId)).toEqual(['channel-b'])
    expect(cachedIds('channel-b', 1006, 5)).toHaveLength(5)
    expect(cachedIds('channel-a', 1006, 5)).toHaveLength(0)
  })

  it('stops when a request fails because the network is gone', async () => {
    setupOpenChat()
    const chatA = setupCachedChat('channel-a', 5)
    const chatB = setupCachedChat('channel-b', 5)
    const server = createServer(
      { 'channel-a': chatA.all, 'channel-b': chatB.all },
      {
        fail: true,
        onLoadNext: () => {
          state.UserReducer.connectionStatus = CONNECTION_STATUS.DISCONNECTED
        }
      }
    )

    await run(__messageSagaTestables.runBackgroundPrefetch)

    expect(server.loadNextCalls).toHaveLength(1)
    expect(getLatestLoadedSegment('channel-b')).toEqual({ startId: '1000', endId: '1005' })
    expect(getLatestMessageSnapshot('channel-b')?.id).toBe('1010')
  })

  it('discards the result when the user opens that chat while its request is running', async () => {
    setupOpenChat()
    const chat = setupCachedChat('channel-x', 10)
    createServer(
      { 'channel-x': chat.all },
      {
        onLoadNext: () => {
          setActiveChannelId('channel-x')
        }
      }
    )

    await run(__messageSagaTestables.runBackgroundPrefetch)

    expect(cachedIds('channel-x', 1006, 10)).toHaveLength(0)
    expect(getLatestLoadedSegment('channel-x')).toEqual({ startId: '1000', endId: '1005' })
  })

  it('discards the result when the history is cleared while its request is running', async () => {
    setupOpenChat()
    const chat = setupCachedChat('channel-x', 10)
    createServer(
      { 'channel-x': chat.all },
      {
        onLoadNext: () => {
          removeMessagesFromMap('channel-x')
        }
      }
    )

    await run(__messageSagaTestables.runBackgroundPrefetch)

    expect(cachedIds('channel-x', 1006, 10)).toHaveLength(0)
    expect(getLatestLoadedSegment('channel-x')).toBeNull()
  })

  it('keeps a newer snapshot recorded while the request is running', async () => {
    setupOpenChat()
    const chat = setupCachedChat('channel-x', 10)
    createServer(
      { 'channel-x': chat.all },
      {
        onLoadNext: () => {
          setLatestMessageSnapshot(
            'channel-x',
            makeMessage({ id: '1020', channelId: 'channel-x', body: 'newer', incoming: true })
          )
        }
      }
    )

    await run(__messageSagaTestables.runBackgroundPrefetch)

    expect(cachedIds('channel-x', 1006, 10)).toHaveLength(10)
    expect(getLatestMessageSnapshot('channel-x')?.id).toBe('1020')
  })

  it('fetches every cached chat with new messages (20 chats, no chat limit), most recently visited first', async () => {
    setupOpenChat()
    const histories: Record<string, IMessage[]> = {}
    for (let index = 0; index < 20; index++) {
      histories[`channel-${index}`] = setupCachedChat(`channel-${index}`, 3).all
    }
    const server = createServer(histories)

    await run(__messageSagaTestables.runBackgroundPrefetch)

    expect(server.loadNextCalls.map((call) => call.channelId)).toEqual(
      Array.from({ length: 20 }, (_, index) => `channel-${19 - index}`)
    )
    for (let index = 0; index < 20; index++) {
      expect(cachedIds(`channel-${index}`, 1006, 3)).toHaveLength(3)
    }
  })

  it('skips chats without cached messages and chats that are already up to date', async () => {
    setupOpenChat()
    // Known from the chat list only, never opened: nothing cached.
    setChannelInMap(
      makeChannel({
        id: 'channel-never-opened',
        lastMessage: makeMessage({ id: '50', channelId: 'channel-never-opened' })
      })
    )
    // Opened and already up to date.
    setupCachedChat('channel-up-to-date', 0)
    const server = createServer({})

    await run(__messageSagaTestables.runBackgroundPrefetch)

    expect(server.loadNextCalls).toEqual([])
  })
})

describe('background prefetch edge cases', () => {
  beforeEach(() => {
    jest.spyOn(log, 'info').mockImplementation(() => undefined)
    jest.spyOn(log, 'error').mockImplementation(() => undefined)
    resetMessageListFixtureIds()
    clearMessagesMap()
    destroyChannelsMap()
    setActiveChannelId('')
    __resetMessageSagaTestState()
    resetState()
    mockStore.getState.mockImplementation(() => state)
  })

  afterEach(() => {
    jest.restoreAllMocks()
    clearMessagesMap()
    destroyChannelsMap()
    setActiveChannelId('')
    __resetMessageSagaTestState()
  })

  it('exactly 40 missing: one request, all cached, snapshot cleared', async () => {
    setupOpenChat()
    const chat = setupCachedChat('channel-x', 40)
    const server = createServer({ 'channel-x': chat.all })

    await run(__messageSagaTestables.runBackgroundPrefetch)

    expect(server.loadNextCalls).toHaveLength(1)
    expect(cachedIds('channel-x', 1006, 40)).toHaveLength(40)
    expect(getLatestMessageSnapshot('channel-x')).toBeNull()
  })

  it('exactly 400 missing: 10 requests, all cached, no 11th request, snapshot cleared', async () => {
    setupOpenChat()
    const chat = setupCachedChat('channel-x', 400)
    const server = createServer({ 'channel-x': chat.all })

    await run(__messageSagaTestables.runBackgroundPrefetch)

    expect(server.loadNextCalls).toHaveLength(10)
    expect(cachedIds('channel-x', 1006, 400)).toHaveLength(400)
    expect(getLatestLoadedSegment('channel-x')).toEqual({ startId: '1000', endId: '1405' })
    expect(getLatestMessageSnapshot('channel-x')).toBeNull()
  })

  it('stops when the server returns nothing newer, even if lastMessage says there is more', async () => {
    setupOpenChat()
    setupCachedChat('channel-x', 10)
    // The server no longer has the newer messages (e.g. deleted meanwhile).
    const server = createServer({ 'channel-x': [] })

    await run(__messageSagaTestables.runBackgroundPrefetch)

    expect(server.loadNextCalls).toHaveLength(1)
    expect(getLatestLoadedSegment('channel-x')).toEqual({ startId: '1000', endId: '1005' })
  })

  it('ignores messages at or before the request point and sorts the page', async () => {
    setupOpenChat()
    const chat = setupCachedChat('channel-x', 5)
    const server = createServer(
      { 'channel-x': chat.all },
      {
        transform: (page) => [
          ...[...page].reverse(),
          makeMessage({ id: '1005', channelId: 'channel-x', body: 'server copy of the cache end' }),
          makeMessage({ id: '999', channelId: 'channel-x', body: 'older' })
        ]
      }
    )

    await run(__messageSagaTestables.runBackgroundPrefetch)

    expect(server.loadNextCalls).toHaveLength(1)
    expect(getLatestLoadedSegment('channel-x')).toEqual({ startId: '1000', endId: '1010' })
    expect(getMessageFromMap('channel-x', '999')).toBeFalsy()
    expect((getMessageFromMap('channel-x', '1005') as any).body).toBe('cached-1005')
  })

  it('continues from the newest cached range when the chat also has an older, separate range', async () => {
    setupOpenChat()
    // Older range 500-502 (e.g. from a jump to a search result), then 1000-1005.
    ;['500', '501', '502'].forEach((id) => addMessageToMap('channel-x', makeMessage({ id, channelId: 'channel-x' })))
    setActiveSegment('channel-x', '500', '502')
    setActiveSegment('channel-open', '1', '2')
    const chat = setupCachedChat('channel-x', 5)
    const server = createServer({ 'channel-x': chat.all })

    await run(__messageSagaTestables.runBackgroundPrefetch)

    expect(server.loadNextCalls.map((call) => call.fromId)).toEqual(['1005'])
    expect(isInLoadedSegment('channel-x', '501')).toBe(true)
    expect(getLatestLoadedSegment('channel-x')).toEqual({ startId: '1000', endId: '1010' })
  })

  it('skips mock (not yet created) chats', async () => {
    setupOpenChat()
    setupCachedChat('channel-x', 5)
    setChannelInMap({ ...getChannelFromMap('channel-x'), isMockChannel: true } as any)
    const server = createServer({})

    await run(__messageSagaTestables.runBackgroundPrefetch)

    expect(server.loadNextCalls).toEqual([])
  })

  it('skips a chat whose lastMessage is still pending (not confirmed by the server)', async () => {
    setupOpenChat()
    setupCachedChat('channel-x', 0)
    setChannelInMap({
      ...getChannelFromMap('channel-x'),
      lastMessage: makePendingMessage({ channelId: 'channel-x', tid: 'tid-1' })
    } as any)
    const server = createServer({})

    await run(__messageSagaTestables.runBackgroundPrefetch)

    expect(server.loadNextCalls).toEqual([])
  })

  it('skips a chat whose cache is already ahead of the chat list (lastMessage older than the cache end)', async () => {
    setupOpenChat()
    setupCachedChat('channel-x', 0)
    setChannelInMap({
      ...getChannelFromMap('channel-x'),
      lastMessage: makeMessage({ id: '1003', channelId: 'channel-x' })
    } as any)
    const server = createServer({})

    await run(__messageSagaTestables.runBackgroundPrefetch)

    expect(server.loadNextCalls).toEqual([])
  })

  it('skips a chat whose cached range end is no longer in the cache', async () => {
    setupOpenChat()
    setupCachedChat('channel-x', 5)
    require('../../helpers/messagesHalper').removeMessageFromMap('channel-x', '1005')
    const server = createServer({})

    await run(__messageSagaTestables.runBackgroundPrefetch)

    expect(server.loadNextCalls).toEqual([])
  })

  it('prefetches a chat known only from the full chat list (not in the channel map)', async () => {
    setupOpenChat()
    const chat = setupCachedChat('channel-x', 5)
    const channel = getChannelFromMap('channel-x')
    removeChannelFromMap('channel-x')
    addChannelToAllChannels(channel)
    const server = createServer({ 'channel-x': chat.all })

    await run(__messageSagaTestables.runBackgroundPrefetch)

    expect(server.loadNextCalls).toHaveLength(1)
    expect(cachedIds('channel-x', 1006, 5)).toHaveLength(5)
  })

  it('discards the result when the chat is deleted while its request is running', async () => {
    setupOpenChat()
    const chat = setupCachedChat('channel-x', 5)
    createServer({ 'channel-x': chat.all }, { onLoadNext: () => removeChannelFromMap('channel-x') })

    await run(__messageSagaTestables.runBackgroundPrefetch)

    expect(cachedIds('channel-x', 1006, 5)).toHaveLength(0)
  })

  it('an error for one chat while still online does not stop the next chat', async () => {
    setupOpenChat()
    const chatA = setupCachedChat('channel-a', 5)
    setupCachedChat('channel-b', 5)
    let calls = 0
    const server = createServer(
      { 'channel-a': chatA.all },
      {
        onLoadNext: (channelId) => {
          calls++
          if (channelId === 'channel-b') {
            throw new Error('server error')
          }
        }
      }
    )

    await run(__messageSagaTestables.runBackgroundPrefetch)

    expect(calls).toBe(2)
    expect(server.loadNextCalls.map((call) => call.channelId)).toEqual(['channel-b', 'channel-a'])
    expect(cachedIds('channel-a', 1006, 5)).toHaveLength(5)
  })

  it('keeps unsent (pending) messages of the chat', async () => {
    setupOpenChat()
    const chat = setupCachedChat('channel-x', 5)
    const pending = makePendingMessage({ channelId: 'channel-x', tid: 'pending-tid', body: 'not sent yet' })
    addMessageToMap('channel-x', pending)
    createServer({ 'channel-x': chat.all })

    await run(__messageSagaTestables.runBackgroundPrefetch)

    expect(cachedIds('channel-x', 1006, 5)).toHaveLength(5)
    expect(getMessageFromMap('channel-x', 'pending-tid')).toEqual(expect.objectContaining({ body: 'not sent yet' }))
  })

  it("does not change the open chat's shared message query", async () => {
    setupOpenChat()
    const chat = setupCachedChat('channel-x', 5)
    const sharedQuery = { shared: true }
    query.messageQuery = sharedQuery as any
    createServer({ 'channel-x': chat.all })

    await run(__messageSagaTestables.runBackgroundPrefetch)

    expect(query.messageQuery).toBe(sharedQuery)
  })

  it('does nothing when the connection is already gone', async () => {
    setupOpenChat()
    setupCachedChat('channel-x', 5)
    state.UserReducer.connectionStatus = CONNECTION_STATUS.DISCONNECTED
    const server = createServer({})

    await run(__messageSagaTestables.runBackgroundPrefetch)

    expect(server.loadNextCalls).toEqual([])
  })
})

describe('starting the prefetch on a connection status change', () => {
  beforeEach(() => {
    jest.spyOn(log, 'info').mockImplementation(() => undefined)
    resetMessageListFixtureIds()
    clearMessagesMap()
    destroyChannelsMap()
    setActiveChannelId('')
    __resetMessageSagaTestState()
    resetState()
    mockStore.getState.mockImplementation(() => state)
  })

  afterEach(() => {
    jest.restoreAllMocks()
    clearMessagesMap()
    destroyChannelsMap()
    setActiveChannelId('')
  })

  it.each([CONNECTION_STATUS.DISCONNECTED, CONNECTION_STATUS.CONNECTING])('ignores the status %s', async (status) => {
    setupOpenChat()
    setupCachedChat('channel-x', 5)
    const server = createServer({})

    await run(__messageSagaTestables.prefetchCachedChannelsAfterReconnect, { type: 'x', payload: { status } })

    expect(server.loadNextCalls).toEqual([])
  })

  it('on CONNECTED waits for the sync to settle, then prefetches', async () => {
    setupOpenChat()
    const chat = setupCachedChat('channel-x', 5)
    const server = createServer({ 'channel-x': chat.all })

    await run(__messageSagaTestables.prefetchCachedChannelsAfterReconnect, {
      type: 'x',
      payload: { status: CONNECTION_STATUS.CONNECTED }
    })

    expect(server.loadNextCalls).toHaveLength(1)
    expect(cachedIds('channel-x', 1006, 5)).toHaveLength(5)
  })

  it('on CONNECTED does not prefetch if the connection drops while waiting', async () => {
    setupOpenChat()
    const chat = setupCachedChat('channel-x', 5)
    const server = createServer({ 'channel-x': chat.all })
    setTimeout(() => {
      state.UserReducer.connectionStatus = CONNECTION_STATUS.DISCONNECTED
    }, 200)

    await run(__messageSagaTestables.prefetchCachedChannelsAfterReconnect, {
      type: 'x',
      payload: { status: CONNECTION_STATUS.CONNECTED }
    })

    expect(server.loadNextCalls).toEqual([])
  })
})

describe('cache helpers used by the prefetch', () => {
  beforeEach(() => {
    resetMessageListFixtureIds()
    clearMessagesMap()
  })

  afterEach(() => {
    clearMessagesMap()
  })

  const seed = (channelId: string, from: number, count: number) => {
    ids(from, count).forEach((id) => addMessageToMap(channelId, makeMessage({ id, channelId })))
    setActiveSegment(channelId, String(from), String(from + count - 1))
  }

  it('getLatestLoadedSegment returns a copy of the newest range, or null', () => {
    expect(getLatestLoadedSegment('channel-x')).toBeNull()
    seed('channel-x', 500, 3)
    seed('channel-x', 1000, 3)

    const latest = getLatestLoadedSegment('channel-x')!
    expect(latest).toEqual({ startId: '1000', endId: '1002' })
    latest.endId = '9999'
    expect(getLatestLoadedSegment('channel-x')).toEqual({ startId: '1000', endId: '1002' })
  })

  it('isInLoadedSegment checks every loaded range, edges included', () => {
    seed('channel-x', 500, 3)
    seed('channel-x', 1000, 3)

    expect(isInLoadedSegment('channel-x', '500')).toBe(true)
    expect(isInLoadedSegment('channel-x', '1002')).toBe(true)
    expect(isInLoadedSegment('channel-x', '503')).toBe(false)
    expect(isInLoadedSegment('channel-y', '500')).toBe(false)
  })

  it('extendSegmentForward extends only the range containing fromId and only forward', () => {
    seed('channel-x', 500, 3)
    seed('channel-x', 1000, 3)

    expect(extendSegmentForward('channel-x', '1002', '1010')).toBe(true)
    expect(getLatestLoadedSegment('channel-x')).toEqual({ startId: '1000', endId: '1010' })
    expect(extendSegmentForward('channel-x', '1002', '1005')).toBe(false)
    expect(extendSegmentForward('channel-x', '700', '800')).toBe(false)
    expect(isInLoadedSegment('channel-x', '501')).toBe(true)
  })

  it('extendSegmentForward merges with a newer range it reaches', () => {
    seed('channel-x', 500, 3)
    seed('channel-x', 1000, 3)

    expect(extendSegmentForward('channel-x', '502', '1000')).toBe(true)

    expect(getLatestLoadedSegment('channel-x')).toEqual({ startId: '500', endId: '1002' })
  })

  it('getInMemoryCachedChannelIds lists visited chats first, then other cached chats', () => {
    addMessageToMap('channel-unvisited', makeMessage({ id: '1', channelId: 'channel-unvisited' }))
    addMessageToMap('channel-a', makeMessage({ id: '1', channelId: 'channel-a' }))
    addMessageToMap('channel-b', makeMessage({ id: '1', channelId: 'channel-b' }))
    trackChannelVisit('channel-a')
    trackChannelVisit('channel-b')
    trackChannelVisit('channel-without-cache')

    expect(getInMemoryCachedChannelIds()).toEqual(['channel-b', 'channel-a', 'channel-unvisited'])
  })
})

describe('waiting for the reconnect sync before prefetching', () => {
  beforeEach(() => {
    __resetMessageSagaTestState()
    resetState()
    mockStore.getState.mockImplementation(() => state)
  })

  it('returns false when the connection drops while waiting', async () => {
    state.UserReducer.connectionStatus = CONNECTION_STATUS.DISCONNECTED

    await expect(run(__messageSagaTestables.waitForReconnectSyncToSettle)).resolves.toBe(false)
  })

  it('waits until the open chat reload has actually finished', async () => {
    state.ChannelReducer.channelsLoadingState = LOADING_STATE.LOADING
    let finishReload: () => void = () => undefined
    const reloadFinished = new Promise<void>((resolve) => {
      finishReload = resolve
    })
    const trackedReload = __messageSagaTestables.trackActiveChannelLoad(function* () {
      yield reloadFinished
    } as any)
    const reloadTask = run(trackedReload, { type: 'RELOAD', payload: {} })

    let settled = false
    const waitTask = run(__messageSagaTestables.waitForReconnectSyncToSettle).then((result) => {
      settled = result
    })

    // Channel sync finishes, but the open chat reload is still running.
    state.ChannelReducer.channelsLoadingState = LOADING_STATE.LOADED
    await new Promise((resolve) => setTimeout(resolve, 500))
    expect(settled).toBe(false)
    expect(__messageSagaTestables.getActiveChannelLoadsInFlight()).toBe(1)

    finishReload()
    await reloadTask
    await waitTask
    expect(settled).toBe(true)
    expect(__messageSagaTestables.getActiveChannelLoadsInFlight()).toBe(0)
  })

  it('counts a load as finished even when it fails', async () => {
    // redux-saga logs the uncaught error of the task.
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const failingLoad = __messageSagaTestables.trackActiveChannelLoad(function* () {
      yield Promise.resolve()
      throw new Error('load failed')
    } as any)

    await expect(run(failingLoad, { type: 'LOAD', payload: {} })).rejects.toThrow('load failed')

    expect(__messageSagaTestables.getActiveChannelLoadsInFlight()).toBe(0)
    consoleError.mockRestore()
  })

  it('without a chat list sync, starts after the grace period', async () => {
    const started = Date.now()

    await expect(run(__messageSagaTestables.waitForReconnectSyncToSettle)).resolves.toBe(true)

    expect(Date.now() - started).toBeGreaterThanOrEqual(1400)
  })
})
