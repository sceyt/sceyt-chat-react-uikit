import { runSaga } from 'redux-saga'
import log from 'loglevel'
import { setClient } from '../../common/client'
import {
  addMessageToMap,
  clearMessagesMap,
  getActiveSegment,
  getContiguousNextMessages,
  getContiguousPrevMessages,
  getMessageFromMap,
  getPendingMessagesFromMap,
  MESSAGE_LOAD_DIRECTION,
  setActiveSegment
} from '../../helpers/messagesHalper'
import {
  addChannelToAllChannels,
  destroyChannelsMap,
  getChannelFromAllChannels,
  getChannelFromMap,
  setActiveChannelId,
  setChannelInMap
} from '../../helpers/channelHalper'
import { CONNECTION_STATUS } from '../user/constants'
import { attachmentTypes, LOADING_STATE, MESSAGE_STATUS, UPLOAD_STATE } from '../../helpers/constants'
import {
  makeChannel,
  makeMessage,
  makePendingMessage,
  resetMessageListFixtureIds,
  makeUser
} from '../../testUtils/messageFixtures'
import { resetMockServerDelay, resolveWithMockServerDelay } from '../../testUtils/mockServerDelay'
import {
  addMessageAC,
  addMessagesAC,
  editMessageAC,
  forwardMessageAC,
  loadDefaultMessagesAC,
  loadLatestMessagesAC,
  loadMoreMessagesAC,
  loadNearUnreadAC,
  resendMessageAC,
  sendMessageAC,
  sendTextMessageAC,
  setMessagesAC,
  setMessagesHasNextAC,
  setMessagesHasPrevAC,
  setMessagesLoadingStateAC,
  setUnreadScrollToAC,
  updateAttachmentUploadingStateAC,
  updateMessageAC
} from './actions'
import { updateChannelDataAC, updateChannelLastMessageAC } from '../channel/actions'
import { __messageSagaTestables, __resetMessageSagaTestState } from './saga'
import { navigateToLatest } from '../../helpers/messageListNavigator'

const mockStoreState = {
  UserReducer: {
    connectionStatus: CONNECTION_STATUS.DISCONNECTED,
    waitToSendPendingMessages: false
  },
  MessageReducer: {
    activeChannelMessages: [],
    pendingPollActions: {},
    oGMetadata: {}
  }
}

const mockStore = {
  getState: jest.fn(() => mockStoreState),
  dispatch: jest.fn()
}

let logErrorSpy: jest.SpyInstance

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

type QueryResult = {
  messages: any[]
  hasNext: boolean
}

const createMessageQuery = (overrides: Partial<Record<string, jest.Mock>> = {}) => ({
  limit: 0,
  reverse: true,
  loadPrevious: jest.fn((): Promise<QueryResult> => resolveWithMockServerDelay({ messages: [], hasNext: false })),
  loadNearMessageId: jest.fn((): Promise<QueryResult> => resolveWithMockServerDelay({ messages: [], hasNext: false })),
  loadPreviousMessageId: jest.fn(
    (): Promise<QueryResult> => resolveWithMockServerDelay({ messages: [], hasNext: false })
  ),
  loadNextMessageId: jest.fn((): Promise<QueryResult> => resolveWithMockServerDelay({ messages: [], hasNext: false })),
  ...overrides
})

const createClient = (query: ReturnType<typeof createMessageQuery>, updatedChannel?: any) => ({
  user: { id: 'current-user' },
  Channel: {
    create: jest.fn()
  },
  MessageListQueryBuilder: class {
    channelId: string
    limit = jest.fn()
    reverse = jest.fn()
    build = jest.fn(() => resolveWithMockServerDelay(query))

    constructor(channelId: string) {
      this.channelId = channelId
    }
  },
  getChannel: jest.fn(() => resolveWithMockServerDelay(updatedChannel || null))
})

const runMessageSaga = async (saga: any, ...args: any[]) => {
  const dispatched: any[] = []

  await runSaga(
    {
      dispatch: (effect) => {
        dispatched.push(effect)
      },
      getState: () => mockStoreState
    },
    saga,
    ...args
  ).toPromise()

  return dispatched
}

const getActionByType = (actions: any[], type: string) => actions.find((action) => action.type === type)
const flushAsyncWork = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('message saga message-list flows', () => {
  beforeEach(() => {
    logErrorSpy = jest.spyOn(log, 'error').mockImplementation(() => undefined)
    resetMessageListFixtureIds()
    resetMockServerDelay()
    clearMessagesMap()
    destroyChannelsMap()
    setActiveChannelId('')
    __resetMessageSagaTestState()
    mockStore.dispatch.mockClear()
    mockStore.getState.mockImplementation(() => mockStoreState)
    ;(navigateToLatest as jest.Mock).mockClear()
    mockStoreState.UserReducer = {
      connectionStatus: CONNECTION_STATUS.DISCONNECTED,
      waitToSendPendingMessages: false
    }
    mockStoreState.MessageReducer = {
      activeChannelMessages: [],
      pendingPollActions: {},
      oGMetadata: {}
    }
    setClient({
      user: { id: 'current-user' },
      Channel: { create: jest.fn() },
      MessageListQueryBuilder: class {
        limit = jest.fn()
        reverse = jest.fn()
        build = jest.fn(() => resolveWithMockServerDelay(createMessageQuery()))
      },
      getChannel: jest.fn(() => resolveWithMockServerDelay(null))
    })
  })

  afterEach(() => {
    logErrorSpy?.mockRestore()
    clearMessagesMap()
    destroyChannelsMap()
    setActiveChannelId('')
    __resetMessageSagaTestState()
  })

  it('loads near-unread messages, updates list flags, and appends pending messages from the map', async () => {
    const channel = makeChannel({
      id: 'channel-near-unread',
      lastDisplayedMessageId: '303',
      lastMessage: makeMessage({
        id: '305',
        channelId: 'channel-near-unread',
        body: 'latest-server'
      })
    })
    const loadedMessages = [
      makeMessage({ id: '303', channelId: channel.id, body: 'server-303', incoming: true }),
      makeMessage({ id: '304', channelId: channel.id, body: 'server-304', incoming: true })
    ]
    const pendingMessage = makePendingMessage({
      channelId: channel.id,
      body: 'pending-near-unread',
      createdAt: new Date('2026-04-01T12:06:00.000Z')
    })
    const query = createMessageQuery({
      loadNearMessageId: jest.fn(() => resolveWithMockServerDelay({ messages: loadedMessages, hasNext: false }))
    })

    mockStoreState.UserReducer.connectionStatus = CONNECTION_STATUS.CONNECTED
    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    addMessageToMap(channel.id, pendingMessage)
    setClient(createClient(query, { ...channel, lastMessage: channel.lastMessage }))

    const dispatched = await runMessageSaga(__messageSagaTestables.loadNearUnread, loadNearUnreadAC(channel))

    expect(dispatched).toEqual(
      expect.arrayContaining([
        setMessagesLoadingStateAC(LOADING_STATE.LOADING),
        setMessagesHasPrevAC(true),
        setMessagesHasNextAC(true),
        setMessagesAC(loadedMessages, channel.id),
        setUnreadScrollToAC(true),
        setMessagesLoadingStateAC(LOADING_STATE.LOADED)
      ])
    )

    const appendPendingAction = getActionByType(dispatched, addMessagesAC([], MESSAGE_LOAD_DIRECTION.NEXT).type)
    expect(appendPendingAction.payload.direction).toBe(MESSAGE_LOAD_DIRECTION.NEXT)
    expect(appendPendingAction.payload.messages.map((message: any) => message.body)).toEqual(['pending-near-unread'])

    expect(getMessageFromMap(channel.id, '303')?.body).toBe('server-303')
    expect(dispatched).toEqual(
      expect.arrayContaining([
        updateChannelLastMessageAC(channel.lastMessage, { ...channel, lastMessage: channel.lastMessage })
      ])
    )
  })

  it('loads default messages from the local cache while offline and still queues pending messages for the list tail', async () => {
    const channel = makeChannel({
      id: 'channel-default-offline',
      lastMessage: makeMessage({
        id: '402',
        channelId: 'channel-default-offline',
        body: 'cached-latest'
      })
    })
    const cachedOlder = makeMessage({ id: '401', channelId: channel.id, body: 'cached-older' })
    const cachedLatest = channel.lastMessage
    const pendingMessage = makePendingMessage({
      channelId: channel.id,
      body: 'pending-offline-tail',
      createdAt: new Date('2026-04-01T12:10:00.000Z')
    })

    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    addMessageToMap(channel.id, cachedOlder)
    addMessageToMap(channel.id, cachedLatest)
    addMessageToMap(channel.id, pendingMessage)
    setClient(createClient(createMessageQuery(), { ...channel, lastMessage: cachedLatest }))

    const dispatched = await runMessageSaga(__messageSagaTestables.loadDefaultMessages, loadDefaultMessagesAC(channel))

    expect(dispatched).toEqual(expect.arrayContaining([setMessagesLoadingStateAC(LOADING_STATE.LOADED)]))
    expect(dispatched).not.toEqual(expect.arrayContaining([setMessagesLoadingStateAC(LOADING_STATE.LOADING)]))

    const setMessagesAction = getActionByType(dispatched, setMessagesAC([], channel.id).type)
    expect(setMessagesAction.payload.messages.map((message: any) => message.body)).toEqual([
      'cached-older',
      'cached-latest',
      'pending-offline-tail'
    ])

    const appendPendingAction = getActionByType(dispatched, addMessagesAC([], MESSAGE_LOAD_DIRECTION.NEXT).type)
    expect(appendPendingAction.payload.messages).toEqual([])
  })

  it('loads the next page from the contiguous message map without hitting the network path', async () => {
    const channelId = 'channel-next-cache'
    const anchor = makeMessage({ id: '510', channelId, body: 'anchor' })
    const nextOne = makeMessage({ id: '511', channelId, body: 'next-one' })
    const nextTwo = makeMessage({ id: '512', channelId, body: 'next-two' })

    addMessageToMap(channelId, anchor)
    addMessageToMap(channelId, nextOne)
    addMessageToMap(channelId, nextTwo)
    setActiveSegment(channelId, anchor.id, nextTwo.id)
    setClient(createClient(createMessageQuery()))

    const dispatched = await runMessageSaga(
      __messageSagaTestables.loadMoreMessages,
      loadMoreMessagesAC(channelId, 20, MESSAGE_LOAD_DIRECTION.NEXT, anchor.id, false)
    )

    expect(dispatched).toEqual(
      expect.arrayContaining([
        setMessagesLoadingStateAC(LOADING_STATE.LOADING),
        setMessagesHasNextAC(false),
        setMessagesHasPrevAC(true)
      ])
    )
    const addMessagesAction = getActionByType(dispatched, addMessagesAC([], MESSAGE_LOAD_DIRECTION.NEXT).type)
    expect(addMessagesAction.payload.direction).toBe(MESSAGE_LOAD_DIRECTION.NEXT)
    expect(addMessagesAction.payload.messages.map((message: any) => message.id)).toEqual(['511', '512'])
    expect(addMessagesAction.payload.messages.map((message: any) => message.body)).toEqual(['next-one', 'next-two'])
    expect(mockStore.dispatch).toHaveBeenCalledWith(setMessagesLoadingStateAC(LOADING_STATE.LOADED))
  })

  it('re-appends pending messages when next-page pagination reaches the latest confirmed edge', async () => {
    const channelId = 'channel-next-latest-edge'
    const anchor = makeMessage({ id: '810', channelId, body: 'anchor' })
    const nextConfirmed = makeMessage({ id: '811', channelId, body: 'next-confirmed' })
    const pendingTail = makePendingMessage({
      channelId,
      body: 'pending-tail',
      createdAt: new Date('2026-04-01T12:22:00.000Z')
    })

    addMessageToMap(channelId, anchor)
    addMessageToMap(channelId, nextConfirmed)
    addMessageToMap(channelId, pendingTail)
    setActiveChannelId(channelId)
    setActiveSegment(channelId, anchor.id, nextConfirmed.id)
    setClient(createClient(createMessageQuery()))

    const dispatched = await runMessageSaga(
      __messageSagaTestables.loadMoreMessages,
      loadMoreMessagesAC(channelId, 20, MESSAGE_LOAD_DIRECTION.NEXT, anchor.id, false)
    )

    const addMessagesActions = dispatched.filter(
      (action) => action.type === addMessagesAC([], MESSAGE_LOAD_DIRECTION.NEXT).type
    )
    expect(addMessagesActions).toHaveLength(2)
    expect(addMessagesActions[0].payload.messages.map((message: any) => message.body)).toEqual(['next-confirmed'])
    expect(addMessagesActions[1].payload.messages.map((message: any) => message.body)).toEqual(['pending-tail'])
  })

  it('marks next pages as available after previous-page pagination trims latest messages out of view', async () => {
    const channelId = 'channel-prev-exposes-next'
    const visibleConfirmedWindow = Array.from({ length: 60 }, (_, index) =>
      makeMessage({
        id: String(941 + index),
        channelId,
        body: `visible-${index}`
      })
    )
    const olderPage = Array.from({ length: 40 }, (_, index) =>
      makeMessage({
        id: String(901 + index),
        channelId,
        body: `older-${index}`
      })
    )
    const pendingTail = makePendingMessage({
      channelId,
      body: 'pending-tail',
      createdAt: new Date('2026-04-01T12:24:00.000Z')
    })

    visibleConfirmedWindow.forEach((message) => addMessageToMap(channelId, message))
    olderPage.forEach((message) => addMessageToMap(channelId, message))
    addMessageToMap(channelId, pendingTail)
    setActiveSegment(channelId, '901', '1000')
    mockStoreState.MessageReducer.activeChannelMessages = [...visibleConfirmedWindow, pendingTail]
    setClient(createClient(createMessageQuery()))

    const dispatched = await runMessageSaga(
      __messageSagaTestables.loadMoreMessages,
      loadMoreMessagesAC(channelId, 40, MESSAGE_LOAD_DIRECTION.PREV, '941', true)
    )

    expect(dispatched).toEqual(expect.arrayContaining([setMessagesHasNextAC(true)]))
  })

  it('restores the pending tail after paginating from deep offline history back to the latest edge', async () => {
    const channelId = 'channel-offline-roundtrip'
    const latestWindow = [
      makeMessage({ id: '999', channelId, body: 'confirmed-before-latest' }),
      makeMessage({ id: '1000', channelId, body: 'confirmed-latest' })
    ]
    const firstHistoryPage = Array.from({ length: 40 }, (_, index) =>
      makeMessage({
        id: String(959 + index),
        channelId,
        body: `history-page-1-${index}`
      })
    )
    const secondHistoryPage = Array.from({ length: 40 }, (_, index) =>
      makeMessage({
        id: String(919 + index),
        channelId,
        body: `history-page-2-${index}`
      })
    )
    const pendingTail = makePendingMessage({
      channelId,
      body: 'pending-tail',
      createdAt: new Date('2026-04-01T12:30:00.000Z')
    })

    ;[...latestWindow, ...firstHistoryPage, ...secondHistoryPage, pendingTail].forEach((message) =>
      addMessageToMap(channelId, message)
    )
    setActiveChannelId(channelId)
    setActiveSegment(channelId, '919', '1000')
    setClient(createClient(createMessageQuery()))

    mockStoreState.MessageReducer.activeChannelMessages = [...latestWindow, pendingTail]

    await runMessageSaga(
      __messageSagaTestables.loadMoreMessages,
      loadMoreMessagesAC(channelId, 40, MESSAGE_LOAD_DIRECTION.PREV, '999', true)
    )

    mockStoreState.MessageReducer.activeChannelMessages = [...firstHistoryPage, ...latestWindow, pendingTail]

    const previousDispatched = await runMessageSaga(
      __messageSagaTestables.loadMoreMessages,
      loadMoreMessagesAC(channelId, 40, MESSAGE_LOAD_DIRECTION.PREV, '959', true)
    )

    expect(previousDispatched).toEqual(expect.arrayContaining([setMessagesHasNextAC(true)]))

    mockStoreState.MessageReducer.activeChannelMessages = [...secondHistoryPage, ...firstHistoryPage.slice(0, 20)]

    const nextDispatched = await runMessageSaga(
      __messageSagaTestables.loadMoreMessages,
      loadMoreMessagesAC(channelId, 40, MESSAGE_LOAD_DIRECTION.NEXT, '978', true)
    )

    const addMessagesActions = nextDispatched.filter(
      (action) => action.type === addMessagesAC([], MESSAGE_LOAD_DIRECTION.NEXT).type
    )

    expect(addMessagesActions).toHaveLength(2)
    expect(addMessagesActions[0].payload.messages.map((message: any) => message.id)).toEqual([
      '979',
      '980',
      '981',
      '982',
      '983',
      '984',
      '985',
      '986',
      '987',
      '988',
      '989',
      '990',
      '991',
      '992',
      '993',
      '994',
      '995',
      '996',
      '997',
      '998',
      '999',
      '1000'
    ])
    expect(addMessagesActions[1].payload.messages.map((message: any) => message.body)).toEqual(['pending-tail'])
  })

  it('loads latest messages from the network when cache is stale and appends only missing pending tail messages', async () => {
    const channel = makeChannel({
      id: 'channel-load-latest',
      lastMessage: makeMessage({
        id: '703',
        channelId: 'channel-load-latest',
        body: 'server-latest'
      })
    })
    const staleCached = makeMessage({
      id: '701',
      channelId: channel.id,
      body: 'stale-cached'
    })
    const loadedMessages = [
      makeMessage({ id: '702', channelId: channel.id, body: 'server-702', incoming: true }),
      makeMessage({ id: '703', channelId: channel.id, body: 'server-703', incoming: true })
    ]
    const pendingTail = makePendingMessage({
      channelId: channel.id,
      body: 'pending-latest-tail',
      createdAt: new Date('2026-04-01T12:18:00.000Z')
    })
    const query = createMessageQuery({
      loadPrevious: jest.fn(() => resolveWithMockServerDelay({ messages: loadedMessages, hasNext: false }))
    })

    mockStoreState.UserReducer.connectionStatus = CONNECTION_STATUS.CONNECTED
    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    addMessageToMap(channel.id, staleCached)
    addMessageToMap(channel.id, pendingTail)
    setClient(createClient(query, { ...channel, lastMessage: channel.lastMessage }))

    const dispatched = await runMessageSaga(__messageSagaTestables.getMessagesQuery, loadLatestMessagesAC(channel))

    expect(query.loadPrevious).toHaveBeenCalledTimes(1)
    expect(dispatched).toEqual(
      expect.arrayContaining([
        setMessagesLoadingStateAC(LOADING_STATE.LOADING),
        setMessagesHasPrevAC(true),
        setMessagesHasNextAC(false),
        setMessagesLoadingStateAC(LOADING_STATE.LOADED)
      ])
    )

    const setMessagesAction = getActionByType(dispatched, setMessagesAC([], channel.id).type)
    expect(setMessagesAction.payload.messages.map((message: any) => message.body)).toEqual(['server-702', 'server-703'])

    const appendPendingAction = getActionByType(dispatched, addMessagesAC([], MESSAGE_LOAD_DIRECTION.NEXT).type)
    expect(appendPendingAction.payload.messages.map((message: any) => message.body)).toEqual(['pending-latest-tail'])
    expect(getMessageFromMap(channel.id, '703')?.body).toBe('server-703')
  })

  it('does not overwrite a newer pending channel last message during network-changed refresh before resend completes', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channel = makeChannel({
      id: 'channel-network-changed-last-message',
      lastMessage: makePendingMessage({
        channelId: 'channel-network-changed-last-message',
        tid: 'pending-latest-tid',
        body: 'pending-latest',
        metadata: '{}',
        createdAt: new Date('2026-04-02T12:30:00.000Z'),
        user: currentUser
      })
    })
    const cachedConfirmed = makeMessage({
      id: '801',
      channelId: channel.id,
      body: 'cached-confirmed'
    })
    const olderConfirmed = makeMessage({
      id: '802',
      tid: 'pending-older-tid',
      channelId: channel.id,
      body: 'confirmed-older',
      metadata: {} as any,
      user: currentUser
    })
    const query = createMessageQuery({
      loadPrevious: jest.fn(() => resolveWithMockServerDelay({ messages: [cachedConfirmed], hasNext: false }))
    })

    mockStoreState.UserReducer.connectionStatus = CONNECTION_STATUS.CONNECTED
    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    addMessageToMap(channel.id, cachedConfirmed)
    addMessageToMap(
      channel.id,
      makePendingMessage({
        channelId: channel.id,
        tid: 'pending-older-tid',
        body: 'pending-older',
        metadata: '{}',
        createdAt: new Date('2026-04-02T12:29:00.000Z'),
        user: currentUser
      })
    )
    addMessageToMap(channel.id, channel.lastMessage as any)
    setClient(createClient(query, { ...channel, lastMessage: olderConfirmed, newMessageCount: 2, unread: true }))

    const dispatched = await runMessageSaga(
      __messageSagaTestables.getMessagesQuery,
      loadLatestMessagesAC(channel, undefined, undefined, undefined, undefined, true)
    )

    expect(
      dispatched.some(
        (action) =>
          action.type === updateChannelDataAC(channel.id, { ...channel, lastMessage: olderConfirmed }).type &&
          action.payload.channelId === channel.id &&
          action.payload.config?.lastMessage?.id === olderConfirmed.id
      )
    ).toBe(false)

    const initialChannelUpdate = dispatched.find(
      (action) =>
        action.type === updateChannelDataAC(channel.id, { unread: true }).type &&
        action.payload.channelId === channel.id
    )

    expect(initialChannelUpdate).toBeDefined()
    expect(initialChannelUpdate.payload.config?.lastMessage).toBeUndefined()
  })

  it('prefetches previous and next pages into the message map while extending the active segment', async () => {
    const channelId = 'channel-prefetch'
    const prevQueryMessages = [
      makeMessage({ id: '898', channelId, body: 'prefetch-prev-1' }),
      makeMessage({ id: '899', channelId, body: 'prefetch-prev-2' })
    ]
    const nextQueryMessages = [
      makeMessage({ id: '903', channelId, body: 'prefetch-next-1' }),
      makeMessage({ id: '904', channelId, body: 'prefetch-next-2' })
    ]
    const query = createMessageQuery({
      loadPreviousMessageId: jest.fn(() => resolveWithMockServerDelay({ messages: prevQueryMessages, hasNext: true })),
      loadNextMessageId: jest.fn(() => resolveWithMockServerDelay({ messages: nextQueryMessages, hasNext: false }))
    })

    addMessageToMap(channelId, makeMessage({ id: '900', channelId, body: 'anchor-start' }))
    addMessageToMap(channelId, makeMessage({ id: '901', channelId, body: 'anchor-middle' }))
    addMessageToMap(channelId, makeMessage({ id: '902', channelId, body: 'anchor-end' }))
    setActiveSegment(channelId, '900', '902')
    setClient(createClient(query))

    await runMessageSaga(__messageSagaTestables.prefetchMessages, channelId, '900', MESSAGE_LOAD_DIRECTION.PREV, 1)

    expect(query.loadPreviousMessageId).toHaveBeenCalledWith('900')
    expect(getContiguousPrevMessages(channelId, '900', 10).map((message) => message.id)).toEqual(['898', '899'])
    expect(getActiveSegment()).toEqual({ startId: '898', endId: '902' })

    await runMessageSaga(__messageSagaTestables.prefetchMessages, channelId, '902', MESSAGE_LOAD_DIRECTION.NEXT, 1)

    expect(query.loadNextMessageId).toHaveBeenCalledWith('902')
    expect(getContiguousNextMessages(channelId, '902', 10).map((message) => message.id)).toEqual(['903', '904'])
    expect(getActiveSegment()).toEqual({ startId: '898', endId: '904' })
  })

  it('queues overlapping prefetch requests for the same direction instead of dropping the later request', async () => {
    const channelId = 'channel-prefetch-overlap'
    const firstDeferred = (() => {
      let resolveDeferred!: (value: QueryResult) => void
      const promise = new Promise<QueryResult>((resolve) => {
        resolveDeferred = resolve
      })
      return { promise, resolve: resolveDeferred }
    })()
    const query = createMessageQuery({
      loadPreviousMessageId: jest
        .fn()
        .mockImplementationOnce(() => firstDeferred.promise)
        .mockImplementationOnce(() =>
          resolveWithMockServerDelay({
            messages: [
              makeMessage({ id: '896', channelId, body: 'queued-prev-1' }),
              makeMessage({ id: '897', channelId, body: 'queued-prev-2' })
            ],
            hasNext: false
          })
        )
    })

    addMessageToMap(channelId, makeMessage({ id: '900', channelId, body: 'anchor-start' }))
    addMessageToMap(channelId, makeMessage({ id: '901', channelId, body: 'anchor-middle' }))
    addMessageToMap(channelId, makeMessage({ id: '902', channelId, body: 'anchor-end' }))
    setActiveSegment(channelId, '900', '902')
    setClient(createClient(query))

    const firstTask = runSaga(
      {
        dispatch: () => undefined,
        getState: () => mockStoreState
      },
      __messageSagaTestables.prefetchMessages,
      channelId,
      '900',
      MESSAGE_LOAD_DIRECTION.PREV,
      1
    )

    await flushAsyncWork()

    const secondTask = runSaga(
      {
        dispatch: () => undefined,
        getState: () => mockStoreState
      },
      __messageSagaTestables.prefetchMessages,
      channelId,
      '898',
      MESSAGE_LOAD_DIRECTION.PREV,
      1
    )

    firstDeferred.resolve({
      messages: [
        makeMessage({ id: '898', channelId, body: 'prefetch-prev-1' }),
        makeMessage({ id: '899', channelId, body: 'prefetch-prev-2' })
      ],
      hasNext: true
    })

    await Promise.all([firstTask.toPromise(), secondTask.toPromise()])

    expect(query.loadPreviousMessageId).toHaveBeenNthCalledWith(1, '900')
    expect(query.loadPreviousMessageId).toHaveBeenNthCalledWith(2, '898')
    expect(getContiguousPrevMessages(channelId, '900', 10).map((message) => message.id)).toEqual([
      '896',
      '897',
      '898',
      '899'
    ])
    expect(getActiveSegment()).toEqual({ startId: '896', endId: '902' })
  })

  it('waits for an in-flight next-direction prefetch before falling back to a manual next-page network load', async () => {
    const channelId = 'channel-prefetch-waits-next-load-more'
    const deferredPrefetch = (() => {
      let resolveDeferred!: (value: QueryResult) => void
      const promise = new Promise<QueryResult>((resolve) => {
        resolveDeferred = resolve
      })
      return { promise, resolve: resolveDeferred }
    })()
    const prefetchedNextMessages = [
      makeMessage({ id: '901', channelId, body: 'prefetched-next-1' }),
      makeMessage({ id: '902', channelId, body: 'prefetched-next-2' })
    ]
    const query = createMessageQuery({
      loadNextMessageId: jest.fn().mockImplementationOnce(() => deferredPrefetch.promise)
    })

    addMessageToMap(channelId, makeMessage({ id: '900', channelId, body: 'anchor' }))
    setActiveSegment(channelId, '900', '900')
    setClient({
      user: { id: 'current-user' },
      Channel: { create: jest.fn() },
      MessageListQueryBuilder: class {
        channelId: string
        limit = jest.fn()
        reverse = jest.fn()
        build = jest.fn(() => Promise.resolve(query))

        constructor(nextChannelId: string) {
          this.channelId = nextChannelId
        }
      },
      getChannel: jest.fn(() => resolveWithMockServerDelay(null))
    })

    const prefetchTask = runSaga(
      {
        dispatch: () => undefined,
        getState: () => mockStoreState
      },
      __messageSagaTestables.prefetchMessages,
      channelId,
      '900',
      MESSAGE_LOAD_DIRECTION.NEXT,
      1
    )

    await flushAsyncWork()

    const dispatched: any[] = []
    const loadMoreTask = runSaga(
      {
        dispatch: (effect) => {
          dispatched.push(effect)
        },
        getState: () => mockStoreState
      },
      __messageSagaTestables.loadMoreMessages,
      loadMoreMessagesAC(channelId, 20, MESSAGE_LOAD_DIRECTION.NEXT, '900', true)
    )

    await flushAsyncWork()

    expect(query.loadNextMessageId).toHaveBeenCalledTimes(1)

    deferredPrefetch.resolve({
      messages: prefetchedNextMessages,
      hasNext: true
    })

    await Promise.all([prefetchTask.toPromise(), loadMoreTask.toPromise()])

    expect(query.loadNextMessageId.mock.calls.filter(([messageId]) => messageId === '900')).toHaveLength(1)
    const addMessagesAction = getActionByType(dispatched, addMessagesAC([], MESSAGE_LOAD_DIRECTION.NEXT).type)
    expect(addMessagesAction.payload.messages.map((message: any) => message.id)).toEqual(['901', '902'])
  })

  it('waits for an in-flight previous-direction prefetch before falling back to a manual previous-page network load', async () => {
    const channelId = 'channel-prefetch-waits-prev-load-more'
    const deferredPrefetch = (() => {
      let resolveDeferred!: (value: QueryResult) => void
      const promise = new Promise<QueryResult>((resolve) => {
        resolveDeferred = resolve
      })
      return { promise, resolve: resolveDeferred }
    })()
    const prefetchedPrevMessages = [
      makeMessage({ id: '898', channelId, body: 'prefetched-prev-1' }),
      makeMessage({ id: '899', channelId, body: 'prefetched-prev-2' })
    ]
    const query = createMessageQuery({
      loadPreviousMessageId: jest.fn().mockImplementationOnce(() => deferredPrefetch.promise)
    })

    addMessageToMap(channelId, makeMessage({ id: '900', channelId, body: 'anchor' }))
    setActiveSegment(channelId, '900', '900')
    setClient({
      user: { id: 'current-user' },
      Channel: { create: jest.fn() },
      MessageListQueryBuilder: class {
        channelId: string
        limit = jest.fn()
        reverse = jest.fn()
        build = jest.fn(() => Promise.resolve(query))

        constructor(nextChannelId: string) {
          this.channelId = nextChannelId
        }
      },
      getChannel: jest.fn(() => resolveWithMockServerDelay(null))
    })

    const prefetchTask = runSaga(
      {
        dispatch: () => undefined,
        getState: () => mockStoreState
      },
      __messageSagaTestables.prefetchMessages,
      channelId,
      '900',
      MESSAGE_LOAD_DIRECTION.PREV,
      1
    )

    await flushAsyncWork()

    const dispatched: any[] = []
    const loadMoreTask = runSaga(
      {
        dispatch: (effect) => {
          dispatched.push(effect)
        },
        getState: () => mockStoreState
      },
      __messageSagaTestables.loadMoreMessages,
      loadMoreMessagesAC(channelId, 20, MESSAGE_LOAD_DIRECTION.PREV, '900', true)
    )

    await flushAsyncWork()

    expect(query.loadPreviousMessageId).toHaveBeenCalledTimes(1)

    deferredPrefetch.resolve({
      messages: prefetchedPrevMessages,
      hasNext: true
    })

    await Promise.all([prefetchTask.toPromise(), loadMoreTask.toPromise()])

    expect(query.loadPreviousMessageId.mock.calls.filter(([messageId]) => messageId === '900')).toHaveLength(1)
    const addMessagesAction = getActionByType(dispatched, addMessagesAC([], MESSAGE_LOAD_DIRECTION.PREV).type)
    expect(addMessagesAction.payload.messages.map((message: any) => message.id)).toEqual(['898', '899'])
  })

  it('sends a text message optimistically, confirms it, and replaces the pending map entry', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channel = makeChannel({
      id: 'channel-send-text',
      lastMessage: makeMessage({
        id: '600',
        channelId: 'channel-send-text',
        body: 'last-before-send'
      })
    })
    const createdMessage = makePendingMessage({
      channelId: channel.id,
      tid: 'local-tid',
      body: 'hello world',
      metadata: '{}',
      user: currentUser
    })
    const confirmedMessage = makeMessage({
      id: '601',
      tid: 'local-tid',
      channelId: channel.id,
      body: 'hello world',
      metadata: {} as any,
      user: currentUser
    })
    const builder = {
      setBody: jest.fn().mockReturnThis(),
      setBodyAttributes: jest.fn().mockReturnThis(),
      setAttachments: jest.fn().mockReturnThis(),
      setMentionUserIds: jest.fn().mockReturnThis(),
      setType: jest.fn().mockReturnThis(),
      setDisplayCount: jest.fn().mockReturnThis(),
      setSilent: jest.fn().mockReturnThis(),
      setMetadata: jest.fn().mockReturnThis(),
      setPollDetails: jest.fn().mockReturnThis(),
      setParentMessageId: jest.fn().mockReturnThis(),
      setReplyInThread: jest.fn().mockReturnThis(),
      create: jest.fn(() => createdMessage)
    }

    channel.createMessageBuilder = jest.fn(() => builder as any)
    channel.sendMessage = jest.fn(() => resolveWithMockServerDelay(confirmedMessage))

    mockStoreState.UserReducer.connectionStatus = CONNECTION_STATUS.CONNECTED
    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    addMessageToMap(channel.id, makeMessage({ id: '598', channelId: channel.id, body: 'cached-598' }))
    addMessageToMap(channel.id, makeMessage({ id: '599', channelId: channel.id, body: 'cached-599' }))
    addMessageToMap(channel.id, channel.lastMessage)
    setActiveSegment(channel.id, '598', '600')
    setClient({
      user: { id: 'current-user' },
      Channel: { create: jest.fn() }
    })

    const inputMessage = {
      body: 'hello world',
      bodyAttributes: [],
      attachments: [],
      mentionedUsers: [],
      type: 'text',
      metadata: {},
      pollDetails: null,
      parentMessage: null,
      repliedInThread: false,
      displayCount: 1,
      silent: false
    }

    const dispatched = await runMessageSaga(
      __messageSagaTestables.sendTextMessage,
      sendTextMessageAC(inputMessage, channel.id, CONNECTION_STATUS.CONNECTED)
    )

    expect(navigateToLatest).toHaveBeenCalledWith(true)
    expect(dispatched).toEqual(
      expect.arrayContaining([
        setMessagesLoadingStateAC(LOADING_STATE.LOADING),
        updateMessageAC('local-tid', expect.objectContaining({ id: '601', tid: 'local-tid' }), true),
        updateChannelDataAC(
          channel.id,
          expect.objectContaining({
            lastMessage: expect.objectContaining({ id: '601', body: 'hello world' }),
            lastReactedMessage: null
          }),
          true
        ),
        setMessagesLoadingStateAC(LOADING_STATE.LOADED)
      ])
    )

    expect(getPendingMessagesFromMap(channel.id)).toEqual([])
    expect(getMessageFromMap(channel.id, '601')).toEqual(expect.objectContaining({ id: '601', tid: 'local-tid' }))
    expect(getMessageFromMap(channel.id, 'local-tid')).toEqual(expect.objectContaining({ id: '601' }))
    expect(getContiguousNextMessages(channel.id, '600', 10).map((message) => message.id)).toEqual(['601'])
    expect(getActiveSegment()).toEqual({ startId: '598', endId: '601' })
    expect(getChannelFromMap(channel.id)?.lastMessage).toEqual(
      expect.objectContaining({ id: '601', body: 'hello world' })
    )
  })

  it('keeps an offline text message as a failed pending item for resend and visible list updates', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channel = makeChannel({
      id: 'channel-send-offline',
      lastMessage: makeMessage({
        id: '700',
        channelId: 'channel-send-offline',
        body: 'last-before-offline'
      })
    })
    const createdMessage = makePendingMessage({
      channelId: channel.id,
      tid: 'offline-tid',
      body: 'offline hello',
      metadata: '{}',
      user: currentUser
    })
    const builder = {
      setBody: jest.fn().mockReturnThis(),
      setBodyAttributes: jest.fn().mockReturnThis(),
      setAttachments: jest.fn().mockReturnThis(),
      setMentionUserIds: jest.fn().mockReturnThis(),
      setType: jest.fn().mockReturnThis(),
      setDisplayCount: jest.fn().mockReturnThis(),
      setSilent: jest.fn().mockReturnThis(),
      setMetadata: jest.fn().mockReturnThis(),
      setPollDetails: jest.fn().mockReturnThis(),
      setParentMessageId: jest.fn().mockReturnThis(),
      setReplyInThread: jest.fn().mockReturnThis(),
      create: jest.fn(() => createdMessage)
    }

    channel.createMessageBuilder = jest.fn(() => builder as any)
    channel.sendMessage = jest.fn()

    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    setClient({
      user: { id: 'current-user' },
      Channel: { create: jest.fn() }
    })

    const inputMessage = {
      body: 'offline hello',
      bodyAttributes: [],
      attachments: [],
      mentionedUsers: [],
      type: 'text',
      metadata: {},
      pollDetails: null,
      parentMessage: null,
      repliedInThread: false,
      displayCount: 1,
      silent: false
    }

    const logErrorSpy = jest.spyOn(log, 'error').mockImplementation(() => undefined)

    const dispatched = await runMessageSaga(
      __messageSagaTestables.sendTextMessage,
      sendTextMessageAC(inputMessage, channel.id, CONNECTION_STATUS.DISCONNECTED)
    )

    logErrorSpy.mockRestore()

    expect(navigateToLatest).toHaveBeenCalledWith(true)
    expect(channel.sendMessage).not.toHaveBeenCalled()
    expect(dispatched).toEqual(
      expect.arrayContaining([
        setMessagesLoadingStateAC(LOADING_STATE.LOADING),
        updateMessageAC('offline-tid', { state: MESSAGE_STATUS.FAILED }),
        updateChannelDataAC(
          channel.id,
          expect.objectContaining({
            lastMessage: expect.objectContaining({ tid: 'offline-tid', state: MESSAGE_STATUS.FAILED }),
            lastReactedMessage: null
          }),
          true
        ),
        setMessagesLoadingStateAC(LOADING_STATE.LOADED)
      ])
    )

    expect(getPendingMessagesFromMap(channel.id)).toEqual([
      expect.objectContaining({
        tid: 'offline-tid',
        body: 'offline hello',
        state: MESSAGE_STATUS.FAILED
      })
    ])
    expect(getMessageFromMap(channel.id, 'offline-tid')).toEqual(
      expect.objectContaining({ tid: 'offline-tid', state: MESSAGE_STATUS.FAILED })
    )
    expect(getChannelFromMap(channel.id)?.lastMessage).toEqual(
      expect.objectContaining({ tid: 'offline-tid', state: MESSAGE_STATUS.FAILED })
    )
  })

  it('keeps the newest failed pending text message as channel last message across multiple offline sends', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channel = makeChannel({
      id: 'channel-send-offline-sequence',
      lastMessage: makeMessage({
        id: '706',
        channelId: 'channel-send-offline-sequence',
        body: 'last-before-offline-sequence'
      })
    })
    const createdMessages = [1, 2, 3].map((index) =>
      makePendingMessage({
        channelId: channel.id,
        tid: `offline-sequence-${index}`,
        body: `offline-${index}`,
        metadata: '{}',
        createdAt: new Date(`2026-04-02T13:0${index}:00.000Z`),
        user: currentUser
      })
    )
    let createIndex = 0
    const builder = {
      setBody: jest.fn().mockReturnThis(),
      setBodyAttributes: jest.fn().mockReturnThis(),
      setAttachments: jest.fn().mockReturnThis(),
      setMentionUserIds: jest.fn().mockReturnThis(),
      setType: jest.fn().mockReturnThis(),
      setDisplayCount: jest.fn().mockReturnThis(),
      setSilent: jest.fn().mockReturnThis(),
      setMetadata: jest.fn().mockReturnThis(),
      setPollDetails: jest.fn().mockReturnThis(),
      setParentMessageId: jest.fn().mockReturnThis(),
      setReplyInThread: jest.fn().mockReturnThis(),
      create: jest.fn(() => createdMessages[createIndex++])
    }

    channel.createMessageBuilder = jest.fn(() => builder as any)
    channel.sendMessage = jest.fn()

    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    addChannelToAllChannels(channel)
    setClient({
      user: { id: 'current-user' },
      Channel: { create: jest.fn() }
    })

    const logErrorSpy = jest.spyOn(log, 'error').mockImplementation(() => undefined)

    for (let index = 0; index < createdMessages.length; index++) {
      await runMessageSaga(
        __messageSagaTestables.sendTextMessage,
        sendTextMessageAC(
          {
            body: `offline-${index + 1}`,
            bodyAttributes: [],
            attachments: [],
            mentionedUsers: [],
            type: 'text',
            metadata: {},
            pollDetails: null,
            parentMessage: null,
            repliedInThread: false,
            displayCount: 1,
            silent: false
          },
          channel.id,
          CONNECTION_STATUS.DISCONNECTED
        )
      )

      expect(getChannelFromMap(channel.id)?.lastMessage).toEqual(
        expect.objectContaining({ tid: createdMessages[index].tid, state: MESSAGE_STATUS.FAILED })
      )
      expect(getChannelFromAllChannels(channel.id)?.lastMessage).toEqual(
        expect.objectContaining({ tid: createdMessages[index].tid, state: MESSAGE_STATUS.FAILED })
      )
    }

    logErrorSpy.mockRestore()
  })

  it('keeps an offline attachment message as a failed pending item and marks its attachment upload as failed', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channel = makeChannel({
      id: 'channel-send-attachment-offline',
      lastMessage: makeMessage({
        id: '710',
        channelId: 'channel-send-attachment-offline',
        body: 'last-before-attachment-offline'
      })
    })
    const createdMessage = makePendingMessage({
      channelId: channel.id,
      tid: 'offline-attachment-tid',
      body: 'photo offline',
      metadata: '{}',
      user: currentUser,
      attachments: [
        {
          tid: 'offline-attachment-file-tid',
          type: attachmentTypes.image,
          name: 'photo.png',
          size: 128,
          data: 'blob://photo',
          metadata: '{}',
          upload: false
        } as any
      ]
    })
    const attachmentBuilder = {
      setName: jest.fn().mockReturnThis(),
      setMetadata: jest.fn().mockReturnThis(),
      setUpload: jest.fn().mockReturnThis(),
      setFileSize: jest.fn().mockReturnThis(),
      create: jest.fn(() => ({
        tid: 'offline-attachment-file-tid',
        type: attachmentTypes.image,
        size: 128,
        metadata: '{}',
        upload: false,
        data: 'blob://photo'
      }))
    }
    const builder = {
      setBody: jest.fn().mockReturnThis(),
      setBodyAttributes: jest.fn().mockReturnThis(),
      setAttachments: jest.fn().mockReturnThis(),
      setMentionUserIds: jest.fn().mockReturnThis(),
      setType: jest.fn().mockReturnThis(),
      setDisplayCount: jest.fn().mockReturnThis(),
      setSilent: jest.fn().mockReturnThis(),
      setMetadata: jest.fn().mockReturnThis(),
      setParentMessageId: jest.fn().mockReturnThis(),
      setReplyInThread: jest.fn().mockReturnThis(),
      setViewOnce: jest.fn().mockReturnThis(),
      create: jest.fn(() => createdMessage)
    }

    channel.createAttachmentBuilder = jest.fn(() => attachmentBuilder as any)
    channel.createMessageBuilder = jest.fn(() => builder as any)
    channel.sendMessage = jest.fn()

    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    setClient({
      user: { id: 'current-user' },
      Channel: { create: jest.fn() }
    })

    const inputMessage = {
      body: 'photo offline',
      bodyAttributes: [],
      attachments: [
        {
          tid: 'offline-attachment-file-tid',
          type: attachmentTypes.image,
          name: 'photo.png',
          size: 128,
          data: 'blob://photo',
          metadata: '{}',
          upload: false
        }
      ],
      mentionedUsers: [],
      type: 'text',
      metadata: {},
      parentMessage: null,
      repliedInThread: false
    }

    const logErrorSpy = jest.spyOn(log, 'error').mockImplementation(() => undefined)

    const dispatched = await runMessageSaga(
      __messageSagaTestables.sendMessage,
      sendMessageAC(inputMessage, channel.id, CONNECTION_STATUS.DISCONNECTED, false)
    )

    logErrorSpy.mockRestore()

    expect(navigateToLatest).toHaveBeenCalledWith(true)
    expect(channel.sendMessage).not.toHaveBeenCalled()
    expect(dispatched).toEqual(
      expect.arrayContaining([
        setMessagesLoadingStateAC(LOADING_STATE.LOADING),
        updateAttachmentUploadingStateAC(UPLOAD_STATE.FAIL, 'offline-attachment-file-tid'),
        updateMessageAC('offline-attachment-tid', { state: MESSAGE_STATUS.FAILED }),
        updateChannelDataAC(
          channel.id,
          expect.objectContaining({
            lastMessage: expect.objectContaining({ tid: 'offline-attachment-tid', state: MESSAGE_STATUS.FAILED }),
            lastReactedMessage: null
          }),
          true
        ),
        setMessagesLoadingStateAC(LOADING_STATE.LOADED)
      ])
    )

    expect(getPendingMessagesFromMap(channel.id)).toEqual([
      expect.objectContaining({
        tid: 'offline-attachment-tid',
        body: 'photo offline',
        state: MESSAGE_STATUS.FAILED
      })
    ])
    expect(getMessageFromMap(channel.id, 'offline-attachment-tid')).toEqual(
      expect.objectContaining({ tid: 'offline-attachment-tid', state: MESSAGE_STATUS.FAILED })
    )
  })

  it('sends an attachment message while connected and promotes it in the visible list and channel last message', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channel = makeChannel({
      id: 'channel-send-attachment-connected',
      lastMessage: makeMessage({
        id: '711',
        channelId: 'channel-send-attachment-connected',
        body: 'last-before-attachment-connected'
      })
    })
    const createdMessage = makePendingMessage({
      channelId: channel.id,
      tid: 'connected-attachment-tid',
      body: 'photo connected',
      metadata: '{}',
      user: currentUser,
      attachments: [
        {
          tid: 'connected-attachment-file-tid',
          type: attachmentTypes.image,
          name: 'photo.png',
          size: 128,
          data: 'blob://photo',
          metadata: '{}',
          upload: false
        } as any
      ]
    })
    const confirmedMessage = makeMessage({
      id: '712',
      tid: createdMessage.tid,
      channelId: channel.id,
      body: 'photo connected',
      metadata: {} as any,
      user: currentUser,
      attachments: [
        {
          tid: 'connected-attachment-file-tid',
          type: attachmentTypes.image,
          name: 'photo.png',
          size: 128,
          metadata: '{}'
        } as any
      ]
    })
    const attachmentBuilder = {
      setName: jest.fn().mockReturnThis(),
      setMetadata: jest.fn().mockReturnThis(),
      setUpload: jest.fn().mockReturnThis(),
      setFileSize: jest.fn().mockReturnThis(),
      create: jest.fn(() => ({
        tid: 'connected-attachment-file-tid',
        type: attachmentTypes.image,
        size: 128,
        metadata: '{}',
        upload: false,
        data: 'blob://photo'
      }))
    }
    const builder = {
      setBody: jest.fn().mockReturnThis(),
      setBodyAttributes: jest.fn().mockReturnThis(),
      setAttachments: jest.fn().mockReturnThis(),
      setMentionUserIds: jest.fn().mockReturnThis(),
      setType: jest.fn().mockReturnThis(),
      setDisplayCount: jest.fn().mockReturnThis(),
      setSilent: jest.fn().mockReturnThis(),
      setMetadata: jest.fn().mockReturnThis(),
      setParentMessageId: jest.fn().mockReturnThis(),
      setReplyInThread: jest.fn().mockReturnThis(),
      setViewOnce: jest.fn().mockReturnThis(),
      create: jest.fn(() => createdMessage)
    }

    channel.createAttachmentBuilder = jest.fn(() => attachmentBuilder as any)
    channel.createMessageBuilder = jest.fn(() => builder as any)
    channel.sendMessage = jest.fn(() => resolveWithMockServerDelay(confirmedMessage))

    mockStoreState.UserReducer.connectionStatus = CONNECTION_STATUS.CONNECTED
    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    addMessageToMap(channel.id, makeMessage({ id: '709', channelId: channel.id, body: 'cached-709' }))
    addMessageToMap(channel.id, makeMessage({ id: '710', channelId: channel.id, body: 'cached-710' }))
    addMessageToMap(channel.id, channel.lastMessage)
    setActiveSegment(channel.id, '709', '711')
    setClient({
      user: { id: 'current-user' },
      Channel: { create: jest.fn() }
    })

    const inputMessage = {
      body: 'photo connected',
      bodyAttributes: [],
      attachments: [
        {
          tid: 'connected-attachment-file-tid',
          type: attachmentTypes.image,
          name: 'photo.png',
          size: 128,
          data: 'blob://photo',
          metadata: '{}',
          upload: false
        }
      ],
      mentionedUsers: [],
      type: 'text',
      metadata: {},
      parentMessage: null,
      repliedInThread: false
    }

    const dispatched = await runMessageSaga(
      __messageSagaTestables.sendMessage,
      sendMessageAC(inputMessage, channel.id, CONNECTION_STATUS.CONNECTED, false)
    )

    expect(navigateToLatest).toHaveBeenCalledWith(true)
    expect(dispatched).toEqual(
      expect.arrayContaining([
        setMessagesLoadingStateAC(LOADING_STATE.LOADING),
        updateMessageAC(
          'connected-attachment-tid',
          expect.objectContaining({ id: '712', tid: 'connected-attachment-tid', body: 'photo connected' }),
          true
        ),
        updateChannelDataAC(
          channel.id,
          expect.objectContaining({
            lastMessage: expect.objectContaining({ id: '712', body: 'photo connected' }),
            lastReactedMessage: null
          }),
          true
        ),
        setMessagesLoadingStateAC(LOADING_STATE.LOADED)
      ])
    )

    expect(getPendingMessagesFromMap(channel.id)).toEqual([])
    expect(getMessageFromMap(channel.id, '712')).toEqual(
      expect.objectContaining({ id: '712', tid: createdMessage.tid })
    )
    expect(getContiguousNextMessages(channel.id, '711', 10).map((message) => message.id)).toEqual(['712'])
    expect(getActiveSegment()).toEqual({ startId: '709', endId: '712' })
    expect(getChannelFromMap(channel.id)?.lastMessage).toEqual(
      expect.objectContaining({ id: '712', body: 'photo connected' })
    )
  })

  it('keeps an offline forwarded message as a failed pending item and reloads latest messages when history is open', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channel = makeChannel({
      id: 'channel-forward-offline',
      lastMessage: makeMessage({
        id: '720',
        channelId: 'channel-forward-offline',
        body: 'last-before-forward-offline'
      })
    })
    const createdForward = makePendingMessage({
      channelId: channel.id,
      tid: 'offline-forward-tid',
      body: 'forward body',
      metadata: '{}',
      user: currentUser,
      forwardingDetails: {
        messageId: 'origin-1'
      } as any
    })
    const builder = {
      setBody: jest.fn().mockReturnThis(),
      setBodyAttributes: jest.fn().mockReturnThis(),
      setAttachments: jest.fn().mockReturnThis(),
      setMentionUserIds: jest.fn().mockReturnThis(),
      setType: jest.fn().mockReturnThis(),
      setDisableMentionsCount: jest.fn().mockReturnThis(),
      setMetadata: jest.fn().mockReturnThis(),
      setForwardingMessageId: jest.fn().mockReturnThis(),
      setPollDetails: jest.fn().mockReturnThis(),
      create: jest.fn(() => createdForward)
    }

    channel.createMessageBuilder = jest.fn(() => builder as any)
    channel.sendMessage = jest.fn()

    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    mockStoreState.MessageReducer.messagesHasNext = true
    setClient({
      user: { id: 'current-user' },
      Channel: { create: jest.fn() }
    })

    const sourceMessage = makeMessage({
      id: 'origin-1',
      channelId: 'source-channel',
      body: 'forward body',
      metadata: {} as any,
      user: currentUser,
      attachments: []
    })

    const logErrorSpy = jest.spyOn(log, 'error').mockImplementation(() => undefined)

    const dispatched = await runMessageSaga(
      __messageSagaTestables.forwardMessage,
      forwardMessageAC(sourceMessage, channel.id, CONNECTION_STATUS.DISCONNECTED, true)
    )

    logErrorSpy.mockRestore()

    expect(channel.sendMessage).not.toHaveBeenCalled()
    expect(dispatched).toEqual(
      expect.arrayContaining([
        setMessagesLoadingStateAC(LOADING_STATE.LOADING),
        updateMessageAC('offline-forward-tid', { state: MESSAGE_STATUS.FAILED }),
        updateChannelDataAC(
          channel.id,
          expect.objectContaining({
            lastMessage: expect.objectContaining({ tid: 'offline-forward-tid', state: MESSAGE_STATUS.FAILED }),
            lastReactedMessage: null
          }),
          true
        ),
        setMessagesLoadingStateAC(LOADING_STATE.LOADED)
      ])
    )

    expect(getPendingMessagesFromMap(channel.id)).toEqual([
      expect.objectContaining({
        tid: 'offline-forward-tid',
        body: 'forward body',
        state: MESSAGE_STATUS.FAILED
      })
    ])
  })

  it('forwards a message while connected and promotes it in the visible list and channel last message', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const sourceUser = makeUser({ id: 'source-user' })
    const channel = makeChannel({
      id: 'channel-forward-connected',
      lastMessage: makeMessage({
        id: '721',
        channelId: 'channel-forward-connected',
        body: 'last-before-forward-connected'
      })
    })
    const createdForward = makePendingMessage({
      channelId: channel.id,
      tid: 'connected-forward-tid',
      body: 'forward body',
      metadata: '{}',
      user: currentUser,
      forwardingDetails: {
        messageId: 'origin-connected'
      } as any
    })
    const confirmedForward = makeMessage({
      id: '722',
      tid: createdForward.tid,
      channelId: channel.id,
      body: 'forward body',
      metadata: {} as any,
      user: currentUser,
      forwardingDetails: {
        messageId: 'origin-connected'
      } as any
    })
    const builder = {
      setBody: jest.fn().mockReturnThis(),
      setBodyAttributes: jest.fn().mockReturnThis(),
      setAttachments: jest.fn().mockReturnThis(),
      setMentionUserIds: jest.fn().mockReturnThis(),
      setType: jest.fn().mockReturnThis(),
      setDisableMentionsCount: jest.fn().mockReturnThis(),
      setMetadata: jest.fn().mockReturnThis(),
      setForwardingMessageId: jest.fn().mockReturnThis(),
      setPollDetails: jest.fn().mockReturnThis(),
      create: jest.fn(() => createdForward)
    }

    channel.createMessageBuilder = jest.fn(() => builder as any)
    channel.sendMessage = jest.fn(() => resolveWithMockServerDelay(confirmedForward))

    mockStoreState.UserReducer.connectionStatus = CONNECTION_STATUS.CONNECTED
    mockStoreState.MessageReducer.messagesHasNext = false
    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    addMessageToMap(channel.id, makeMessage({ id: '719', channelId: channel.id, body: 'cached-719' }))
    addMessageToMap(channel.id, makeMessage({ id: '720', channelId: channel.id, body: 'cached-720' }))
    addMessageToMap(channel.id, channel.lastMessage)
    setActiveSegment(channel.id, '719', '721')
    setClient({
      user: { id: 'current-user' },
      Channel: { create: jest.fn() }
    })

    const sourceMessage = makeMessage({
      id: 'origin-connected',
      channelId: 'source-channel',
      body: 'forward body',
      metadata: {} as any,
      user: sourceUser,
      attachments: []
    })

    const dispatched = await runMessageSaga(
      __messageSagaTestables.forwardMessage,
      forwardMessageAC(sourceMessage, channel.id, CONNECTION_STATUS.CONNECTED, true)
    )

    expect(dispatched).toEqual(
      expect.arrayContaining([
        setMessagesLoadingStateAC(LOADING_STATE.LOADING),
        updateMessageAC(
          'connected-forward-tid',
          expect.objectContaining({ id: '722', tid: 'connected-forward-tid', body: 'forward body' }),
          true
        ),
        updateChannelDataAC(
          channel.id,
          expect.objectContaining({
            lastMessage: expect.objectContaining({ id: '722', body: 'forward body' }),
            lastReactedMessage: null
          }),
          true
        ),
        setMessagesLoadingStateAC(LOADING_STATE.LOADED)
      ])
    )

    expect(getPendingMessagesFromMap(channel.id)).toEqual([])
    expect(getMessageFromMap(channel.id, '722')).toEqual(
      expect.objectContaining({ id: '722', tid: createdForward.tid })
    )
    expect(getContiguousNextMessages(channel.id, '721', 10).map((message) => message.id)).toEqual(['722'])
    expect(getActiveSegment()).toEqual({ startId: '719', endId: '722' })
    expect(getChannelFromMap(channel.id)?.lastMessage).toEqual(
      expect.objectContaining({ id: '722', body: 'forward body' })
    )
  })

  it('edits the latest message and updates both the visible list state and channel last message', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channel = makeChannel({
      id: 'channel-edit-latest',
      lastMessage: makeMessage({
        id: '7401',
        channelId: 'channel-edit-latest',
        body: 'before-edit',
        metadata: {} as any,
        user: currentUser
      })
    })
    const editedResponse = {
      ...channel.lastMessage,
      body: 'after-edit',
      updatedAt: new Date('2026-04-03T14:10:00.000Z')
    }

    channel.editMessage = jest.fn(() => resolveWithMockServerDelay(editedResponse))

    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    addMessageToMap(channel.id, channel.lastMessage)
    setClient({
      user: { id: 'current-user' },
      Channel: { create: jest.fn() }
    })

    const dispatched = await runMessageSaga(
      __messageSagaTestables.editMessage,
      editMessageAC(channel.id, {
        ...channel.lastMessage,
        body: 'after-edit'
      } as any)
    )

    expect(channel.editMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '7401',
        body: 'after-edit'
      })
    )
    expect(dispatched).toEqual(
      expect.arrayContaining([
        updateMessageAC('7401', expect.objectContaining({ id: '7401', body: 'after-edit' })),
        updateChannelLastMessageAC(expect.objectContaining({ id: '7401', body: 'after-edit' }), channel)
      ])
    )
    expect(getMessageFromMap(channel.id, '7401')).toEqual(expect.objectContaining({ id: '7401', body: 'after-edit' }))
    expect(getChannelFromMap(channel.id)?.lastMessage).toEqual(
      expect.objectContaining({ id: '7401', body: 'after-edit' })
    )
  })

  it('resends an offline text message without creating a duplicate optimistic item', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channel = makeChannel({
      id: 'channel-resend-text-offline',
      lastMessage: makeMessage({
        id: '730',
        channelId: 'channel-resend-text-offline',
        body: 'last-before-resend-text'
      })
    })
    const failedMessage = makePendingMessage({
      channelId: channel.id,
      tid: 'resend-text-tid',
      body: 'retry me',
      metadata: '{}',
      user: currentUser,
      state: MESSAGE_STATUS.FAILED
    })
    const builder = {
      setBody: jest.fn().mockReturnThis(),
      setBodyAttributes: jest.fn().mockReturnThis(),
      setAttachments: jest.fn().mockReturnThis(),
      setMentionUserIds: jest.fn().mockReturnThis(),
      setType: jest.fn().mockReturnThis(),
      setDisplayCount: jest.fn().mockReturnThis(),
      setSilent: jest.fn().mockReturnThis(),
      setMetadata: jest.fn().mockReturnThis(),
      setPollDetails: jest.fn().mockReturnThis(),
      setParentMessageId: jest.fn().mockReturnThis(),
      setReplyInThread: jest.fn().mockReturnThis(),
      create: jest.fn(() => failedMessage)
    }

    channel.createMessageBuilder = jest.fn(() => builder as any)
    channel.sendMessage = jest.fn()

    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    addMessageToMap(channel.id, failedMessage)
    setClient({
      user: { id: 'current-user' },
      Channel: { create: jest.fn() }
    })

    const logErrorSpy = jest.spyOn(log, 'error').mockImplementation(() => undefined)

    const dispatched = await runMessageSaga(
      __messageSagaTestables.resendMessage,
      resendMessageAC(failedMessage, channel.id, CONNECTION_STATUS.DISCONNECTED)
    )

    logErrorSpy.mockRestore()

    expect(navigateToLatest).not.toHaveBeenCalled()
    expect(dispatched.some((action) => action.type === addMessageAC(failedMessage).type)).toBe(false)
    expect(dispatched).toEqual(
      expect.arrayContaining([
        setMessagesLoadingStateAC(LOADING_STATE.LOADING),
        updateMessageAC('resend-text-tid', { state: MESSAGE_STATUS.FAILED }),
        updateChannelDataAC(
          channel.id,
          expect.objectContaining({
            lastMessage: expect.objectContaining({ tid: 'resend-text-tid', state: MESSAGE_STATUS.FAILED }),
            lastReactedMessage: null
          }),
          true
        ),
        setMessagesLoadingStateAC(LOADING_STATE.LOADED)
      ])
    )
    expect(getMessageFromMap(channel.id, 'resend-text-tid')).toEqual(
      expect.objectContaining({ tid: 'resend-text-tid', state: MESSAGE_STATUS.FAILED })
    )
  })

  it('resends an offline attachment message by clearing failed state temporarily and restoring it on failure', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channel = makeChannel({
      id: 'channel-resend-attachment-offline',
      lastMessage: makeMessage({
        id: '740',
        channelId: 'channel-resend-attachment-offline',
        body: 'last-before-resend-attachment'
      })
    })
    const failedMessage = makePendingMessage({
      channelId: channel.id,
      tid: 'resend-attachment-tid',
      body: 'retry attachment',
      metadata: '{}',
      user: currentUser,
      state: MESSAGE_STATUS.FAILED,
      attachments: [
        {
          tid: 'resend-attachment-file-tid',
          type: attachmentTypes.image,
          name: 'retry.png',
          size: 128,
          data: 'blob://retry',
          metadata: '{}',
          upload: false
        } as any
      ]
    })
    const attachmentBuilder = {
      setName: jest.fn().mockReturnThis(),
      setMetadata: jest.fn().mockReturnThis(),
      setUpload: jest.fn().mockReturnThis(),
      setFileSize: jest.fn().mockReturnThis(),
      create: jest.fn(() => ({
        tid: 'resend-attachment-file-tid',
        type: attachmentTypes.image,
        size: 128,
        metadata: '{}',
        upload: false,
        data: 'blob://retry'
      }))
    }
    const builder = {
      setBody: jest.fn().mockReturnThis(),
      setBodyAttributes: jest.fn().mockReturnThis(),
      setAttachments: jest.fn().mockReturnThis(),
      setMentionUserIds: jest.fn().mockReturnThis(),
      setType: jest.fn().mockReturnThis(),
      setDisplayCount: jest.fn().mockReturnThis(),
      setSilent: jest.fn().mockReturnThis(),
      setMetadata: jest.fn().mockReturnThis(),
      setParentMessageId: jest.fn().mockReturnThis(),
      setReplyInThread: jest.fn().mockReturnThis(),
      setViewOnce: jest.fn().mockReturnThis(),
      create: jest.fn(() => failedMessage)
    }

    channel.createAttachmentBuilder = jest.fn(() => attachmentBuilder as any)
    channel.createMessageBuilder = jest.fn(() => builder as any)
    channel.sendMessage = jest.fn()

    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    addMessageToMap(channel.id, failedMessage)
    setClient({
      user: { id: 'current-user' },
      Channel: { create: jest.fn() }
    })

    const logErrorSpy = jest.spyOn(log, 'error').mockImplementation(() => undefined)

    const dispatched = await runMessageSaga(
      __messageSagaTestables.resendMessage,
      resendMessageAC(failedMessage, channel.id, CONNECTION_STATUS.DISCONNECTED)
    )

    logErrorSpy.mockRestore()

    expect(dispatched.some((action) => action.type === addMessageAC(failedMessage).type)).toBe(false)
    expect(dispatched).toEqual(
      expect.arrayContaining([
        setMessagesLoadingStateAC(LOADING_STATE.LOADING),
        updateMessageAC('resend-attachment-tid', { state: MESSAGE_STATUS.UNMODIFIED }),
        updateAttachmentUploadingStateAC(UPLOAD_STATE.FAIL, 'resend-attachment-file-tid'),
        updateMessageAC('resend-attachment-tid', { state: MESSAGE_STATUS.FAILED }),
        updateChannelDataAC(
          channel.id,
          expect.objectContaining({
            lastMessage: expect.objectContaining({ tid: 'resend-attachment-tid', state: MESSAGE_STATUS.FAILED }),
            lastReactedMessage: null
          }),
          true
        ),
        setMessagesLoadingStateAC(LOADING_STATE.LOADED)
      ])
    )
    expect(getMessageFromMap(channel.id, 'resend-attachment-tid')).toEqual(
      expect.objectContaining({ tid: 'resend-attachment-tid', state: MESSAGE_STATUS.FAILED })
    )
  })

  it('keeps the newest pending channel last message while reconnect resend confirms older pending messages', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channelId = 'channel-resend-last-message-order'
    const textPending = makePendingMessage({
      channelId,
      tid: 'pending-text-tid',
      body: 'pending-text',
      metadata: '{}',
      createdAt: new Date('2026-04-02T10:00:00.000Z'),
      user: currentUser
    })
    const attachmentPending = makePendingMessage({
      channelId,
      tid: 'pending-attachment-tid',
      body: 'pending-attachment',
      metadata: '{}',
      createdAt: new Date('2026-04-02T10:01:00.000Z'),
      user: currentUser,
      attachments: [
        {
          tid: 'pending-attachment-file-tid',
          type: attachmentTypes.image,
          name: 'photo.png',
          size: 128,
          data: 'blob://photo',
          metadata: '{}',
          upload: false
        } as any
      ]
    })
    const latestForwardPending = makePendingMessage({
      channelId,
      tid: 'pending-forward-tid',
      body: 'pending-forward',
      metadata: '{}',
      createdAt: new Date('2026-04-02T10:02:00.000Z'),
      user: currentUser,
      forwardingDetails: {
        messageId: 'source-forward-id'
      } as any
    })
    const confirmedText = makeMessage({
      id: '901',
      tid: textPending.tid,
      channelId,
      body: 'pending-text',
      metadata: {} as any,
      user: currentUser
    })
    const confirmedAttachment = makeMessage({
      id: '902',
      tid: attachmentPending.tid,
      channelId,
      body: 'pending-attachment',
      metadata: {} as any,
      user: currentUser,
      attachments: []
    })
    const confirmedForward = makeMessage({
      id: '903',
      tid: latestForwardPending.tid,
      channelId,
      body: 'pending-forward',
      metadata: {} as any,
      user: currentUser,
      forwardingDetails: {
        messageId: 'source-forward-id'
      } as any
    })
    const channel = makeChannel({
      id: channelId,
      lastMessage: latestForwardPending
    })
    const messageBuilder = {
      setBody: jest.fn().mockReturnThis(),
      setBodyAttributes: jest.fn().mockReturnThis(),
      setAttachments: jest.fn().mockReturnThis(),
      setMentionUserIds: jest.fn().mockReturnThis(),
      setType: jest.fn().mockReturnThis(),
      setDisplayCount: jest.fn().mockReturnThis(),
      setSilent: jest.fn().mockReturnThis(),
      setMetadata: jest.fn().mockReturnThis(),
      setPollDetails: jest.fn().mockReturnThis(),
      setParentMessageId: jest.fn().mockReturnThis(),
      setReplyInThread: jest.fn().mockReturnThis(),
      setViewOnce: jest.fn().mockReturnThis(),
      setDisableMentionsCount: jest.fn().mockReturnThis(),
      setForwardingMessageId: jest.fn().mockReturnThis(),
      create: jest.fn()
    }
    const attachmentBuilder = {
      setName: jest.fn().mockReturnThis(),
      setMetadata: jest.fn().mockReturnThis(),
      setUpload: jest.fn().mockReturnThis(),
      setFileSize: jest.fn().mockReturnThis(),
      create: jest.fn(() => ({
        tid: 'pending-attachment-file-tid',
        type: attachmentTypes.image,
        size: 128,
        metadata: '{}',
        upload: false,
        data: 'blob://photo'
      }))
    }

    let resolveText!: (value: any) => void
    let resolveAttachment!: (value: any) => void
    let resolveForward!: (value: any) => void
    const textPromise = new Promise((resolve) => {
      resolveText = resolve
    })
    const attachmentPromise = new Promise((resolve) => {
      resolveAttachment = resolve
    })
    const forwardPromise = new Promise((resolve) => {
      resolveForward = resolve
    })

    channel.createMessageBuilder = jest.fn(() => messageBuilder as any)
    channel.createAttachmentBuilder = jest.fn(() => attachmentBuilder as any)
    channel.sendMessage = jest.fn((message: any) => {
      if (message.tid === textPending.tid) {
        return textPromise
      }
      if (message.tid === attachmentPending.tid) {
        return attachmentPromise
      }
      if (message.tid === latestForwardPending.tid) {
        return forwardPromise
      }
      throw new Error(`Unexpected resend message ${message.tid}`)
    })

    setChannelInMap(channel)
    addMessageToMap(channelId, textPending)
    addMessageToMap(channelId, attachmentPending)
    addMessageToMap(channelId, latestForwardPending)
    setClient({
      user: { id: 'current-user' },
      Channel: { create: jest.fn() }
    })

    const dispatched: any[] = []
    const task = runSaga(
      {
        dispatch: (effect) => {
          dispatched.push(effect)
        },
        getState: () => mockStoreState
      },
      __messageSagaTestables.sendPendingMessages,
      CONNECTION_STATUS.CONNECTED
    )

    await flushAsyncWork()

    expect(channel.sendMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ tid: textPending.tid }))

    resolveText(confirmedText)
    await flushAsyncWork()

    expect(getChannelFromMap(channelId)?.lastMessage).toEqual(
      expect.objectContaining({ tid: latestForwardPending.tid })
    )
    expect(
      dispatched.some(
        (action) =>
          action.type ===
            updateChannelDataAC(channelId, { lastMessage: confirmedText, lastReactedMessage: null }, true).type &&
          action.payload.channelId === channelId &&
          action.payload.config?.lastMessage?.id === confirmedText.id
      )
    ).toBe(false)

    expect(channel.sendMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ tid: attachmentPending.tid }))

    resolveAttachment(confirmedAttachment)
    await flushAsyncWork()

    expect(getChannelFromMap(channelId)?.lastMessage).toEqual(
      expect.objectContaining({ tid: latestForwardPending.tid })
    )
    expect(
      dispatched.some(
        (action) =>
          action.type ===
            updateChannelDataAC(channelId, { lastMessage: confirmedAttachment, lastReactedMessage: null }, true).type &&
          action.payload.channelId === channelId &&
          action.payload.config?.lastMessage?.id === confirmedAttachment.id
      )
    ).toBe(false)

    expect(channel.sendMessage).toHaveBeenNthCalledWith(3, expect.objectContaining({ tid: latestForwardPending.tid }))

    resolveForward(confirmedForward)
    await task.toPromise()

    expect(getChannelFromMap(channelId)?.lastMessage).toEqual(expect.objectContaining({ id: confirmedForward.id }))
    expect(
      dispatched.some(
        (action) =>
          action.type ===
            updateChannelDataAC(channelId, { lastMessage: confirmedForward, lastReactedMessage: null }, true).type &&
          action.payload.channelId === channelId &&
          action.payload.config?.lastMessage?.id === confirmedForward.id
      )
    ).toBe(true)
  })

  it('keeps the last pending text message as channel last message until that same text message confirms on reconnect', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channelId = 'channel-resend-last-text-order'
    const pendingMessages = [1, 2, 3, 4].map((index) =>
      makePendingMessage({
        channelId,
        tid: `pending-text-${index}`,
        body: `pending-${index}`,
        metadata: '{}',
        createdAt: new Date(`2026-04-02T12:0${index}:00.000Z`),
        user: currentUser
      })
    )
    const confirmedMessages = pendingMessages.map((message, index) =>
      makeMessage({
        id: `90000000000000000${index + 1}`,
        tid: message.tid,
        channelId,
        body: message.body,
        metadata: {} as any,
        user: currentUser
      })
    )
    const channel = makeChannel({
      id: channelId,
      lastMessage: pendingMessages[3]
    })
    const builder = {
      setBody: jest.fn().mockReturnThis(),
      setBodyAttributes: jest.fn().mockReturnThis(),
      setAttachments: jest.fn().mockReturnThis(),
      setMentionUserIds: jest.fn().mockReturnThis(),
      setType: jest.fn().mockReturnThis(),
      setDisplayCount: jest.fn().mockReturnThis(),
      setSilent: jest.fn().mockReturnThis(),
      setMetadata: jest.fn().mockReturnThis(),
      setPollDetails: jest.fn().mockReturnThis(),
      setParentMessageId: jest.fn().mockReturnThis(),
      setReplyInThread: jest.fn().mockReturnThis(),
      create: jest.fn()
    }

    const resolvers: Array<(value: any) => void> = []
    const sendPromises = pendingMessages.map(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve)
        })
    )

    channel.createMessageBuilder = jest.fn(() => builder as any)
    channel.sendMessage = jest.fn((message: any) => {
      const index = pendingMessages.findIndex((pendingMessage) => pendingMessage.tid === message.tid)
      return sendPromises[index]
    })

    setChannelInMap(channel)
    pendingMessages.forEach((message) => addMessageToMap(channelId, message))
    setClient({
      user: { id: 'current-user' },
      Channel: { create: jest.fn() }
    })

    const dispatched: any[] = []
    const task = runSaga(
      {
        dispatch: (action) => {
          dispatched.push(action)
        },
        getState: () => mockStoreState
      },
      __messageSagaTestables.sendPendingMessages,
      CONNECTION_STATUS.CONNECTED
    )

    await flushAsyncWork()

    for (let index = 0; index < 3; index++) {
      resolvers[index](confirmedMessages[index])
      await flushAsyncWork()

      expect(getChannelFromMap(channelId)?.lastMessage).toEqual(
        expect.objectContaining({ tid: pendingMessages[3].tid })
      )
      expect(
        dispatched.some(
          (action) =>
            action.type ===
              updateChannelDataAC(channelId, { lastMessage: confirmedMessages[index], lastReactedMessage: null }, true)
                .type &&
            action.payload.channelId === channelId &&
            action.payload.config?.lastMessage?.id === confirmedMessages[index].id
        )
      ).toBe(false)
    }

    resolvers[3](confirmedMessages[3])
    await task.toPromise()

    expect(getChannelFromMap(channelId)?.lastMessage).toEqual(expect.objectContaining({ id: confirmedMessages[3].id }))
    expect(
      dispatched.some(
        (action) =>
          action.type ===
            updateChannelDataAC(channelId, { lastMessage: confirmedMessages[3], lastReactedMessage: null }, true)
              .type &&
          action.payload.channelId === channelId &&
          action.payload.config?.lastMessage?.id === confirmedMessages[3].id
      )
    ).toBe(true)
  })
})
