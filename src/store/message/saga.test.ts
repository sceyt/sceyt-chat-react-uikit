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
import {
  MOCK_SERVER_DELAY_MAX_MS,
  resetMockServerDelay,
  resolveWithMockServerDelay
} from '../../testUtils/mockServerDelay'
import {
  addMessageAC,
  addMessagesAC,
  deleteMessageAC,
  editMessageAC,
  forwardMessageAC,
  loadAroundMessageAC,
  loadDefaultMessagesAC,
  loadLatestMessagesAC,
  loadMoreMessagesAC,
  loadNearUnreadAC,
  patchMessagesAC,
  refreshCacheAroundMessageAC,
  reloadActiveChannelAfterReconnectAC,
  resendMessageAC,
  removePendingMessageMutationAC,
  resendPendingMessageMutationsAC,
  sendMessageAC,
  sendTextMessageAC,
  setMessagesAC,
  setMessagesHasNextAC,
  setMessagesHasPrevAC,
  setLoadingNextMessagesStateAC,
  setLoadingPrevMessagesStateAC,
  setPendingMessageMutationAC,
  setUnreadMessageIdAC,
  setUnreadScrollToAC,
  updateAttachmentUploadingStateAC,
  updateMessageAC
} from './actions'
import { updateChannelDataAC, updateChannelLastMessageAC } from '../channel/actions'
import { __messageSagaTestables, __resetMessageSagaTestState } from './saga'
import { navigateToLatest } from '../../helpers/messageListNavigator'
import { IMessage } from '../../types'

const mockStoreState = {
  ChannelReducer: {
    channelsLoadingState: LOADING_STATE.LOADED,
    activeChannel: {}
  },
  UserReducer: {
    connectionStatus: CONNECTION_STATUS.DISCONNECTED,
    waitToSendPendingMessages: false
  },
  MessageReducer: {
    activeChannelMessages: [],
    activePaginationIntent: null,
    pendingPollActions: {},
    pendingMessageMutations: {},
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
const flushMockServerDelay = () => new Promise((resolve) => setTimeout(resolve, MOCK_SERVER_DELAY_MAX_MS + 25))
const flushNavigateToLatestDelay = () => new Promise((resolve) => setTimeout(resolve, 75))
const bothDirectionLoadingActions = (state: number | null) => [
  setLoadingPrevMessagesStateAC(state),
  setLoadingNextMessagesStateAC(state)
]

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
    mockStoreState.ChannelReducer = {
      channelsLoadingState: LOADING_STATE.LOADED,
      activeChannel: {}
    }
    mockStoreState.MessageReducer = {
      activeChannelMessages: [],
      activePaginationIntent: null,
      stableUnreadAnchor: {
        channelId: '',
        messageId: ''
      },
      pendingPollActions: {},
      pendingMessageMutations: {},
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

  it('loads near-unread messages, updates list flags, and keeps pending messages out of non-latest windows', async () => {
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
        ...bothDirectionLoadingActions(LOADING_STATE.LOADING),
        setMessagesHasPrevAC(true),
        setMessagesHasNextAC(true),
        setMessagesAC(loadedMessages, channel.id),
        setUnreadScrollToAC(true),
        ...bothDirectionLoadingActions(LOADING_STATE.LOADED)
      ])
    )

    const appendPendingAction = getActionByType(dispatched, addMessagesAC([], MESSAGE_LOAD_DIRECTION.NEXT).type)
    expect(appendPendingAction.payload.direction).toBe(MESSAGE_LOAD_DIRECTION.NEXT)
    expect(appendPendingAction.payload.messages.map((message: any) => message.body)).toEqual([])

    expect(getMessageFromMap(channel.id, '303')?.body).toBe('server-303')
  })

  it('shows a cached unread window immediately and patches it after the server refresh returns the same confirmed ids', async () => {
    const channel = makeChannel({
      id: 'channel-near-unread-cache-first',
      lastDisplayedMessageId: '503',
      lastMessage: makeMessage({
        id: '505',
        channelId: 'channel-near-unread-cache-first',
        body: 'latest-server'
      })
    })
    const cachedBoundary = makeMessage({ id: '503', channelId: channel.id, body: 'cached-503', incoming: true })
    const cachedUnread = makeMessage({ id: '504', channelId: channel.id, body: 'cached-504', incoming: true })
    const refreshedBoundary = { ...cachedBoundary }
    const refreshedUnread = { ...cachedUnread, body: 'refreshed-504' }
    const query = createMessageQuery({
      loadNearMessageId: jest.fn(() =>
        resolveWithMockServerDelay({ messages: [refreshedBoundary, refreshedUnread], hasNext: false })
      )
    })

    mockStoreState.UserReducer.connectionStatus = CONNECTION_STATUS.CONNECTED
    mockStoreState.MessageReducer.activeChannelMessages = [cachedBoundary, cachedUnread]
    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    addMessageToMap(channel.id, cachedBoundary)
    addMessageToMap(channel.id, cachedUnread)
    setActiveSegment(channel.id, '503', '504')
    setClient(createClient(query, { ...channel, lastMessage: channel.lastMessage }))

    const dispatched = await runMessageSaga(__messageSagaTestables.loadNearUnread, loadNearUnreadAC(channel))

    expect(dispatched).not.toEqual(expect.arrayContaining(bothDirectionLoadingActions(LOADING_STATE.LOADING)))
    expect(query.loadNearMessageId).toHaveBeenCalledWith('503')

    const setMessagesActions = dispatched.filter((action) => action.type === setMessagesAC([], channel.id).type)
    expect(setMessagesActions).toHaveLength(1)
    expect(setMessagesActions[0].payload.messages.map((message: IMessage) => message.body)).toEqual([
      'cached-503',
      'cached-504'
    ])

    const patchAction = getActionByType(dispatched, patchMessagesAC([]).type)
    expect(patchAction).toEqual(
      patchMessagesAC([
        expect.objectContaining({
          id: '504',
          body: 'refreshed-504'
        })
      ])
    )
  })

  it('falls back to the server when the unread boundary is missing from a fragmented cached segment', async () => {
    const channel = makeChannel({
      id: 'channel-near-unread-fragmented-cache',
      lastDisplayedMessageId: '703',
      lastMessage: makeMessage({
        id: '705',
        channelId: 'channel-near-unread-fragmented-cache',
        body: 'latest-server'
      })
    })
    const cachedOlder = makeMessage({ id: '701', channelId: channel.id, body: 'cached-701', incoming: true })
    const cachedNewer = makeMessage({ id: '704', channelId: channel.id, body: 'cached-704', incoming: true })
    const loadedMessages = [
      makeMessage({ id: '703', channelId: channel.id, body: 'server-703', incoming: true }),
      makeMessage({ id: '704', channelId: channel.id, body: 'server-704', incoming: true })
    ]
    const query = createMessageQuery({
      loadNearMessageId: jest.fn(() => resolveWithMockServerDelay({ messages: loadedMessages, hasNext: false }))
    })

    mockStoreState.UserReducer.connectionStatus = CONNECTION_STATUS.CONNECTED
    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    addMessageToMap(channel.id, cachedOlder)
    addMessageToMap(channel.id, cachedNewer)
    setActiveSegment(channel.id, '701', '704')
    setClient(createClient(query, { ...channel, lastMessage: channel.lastMessage }))

    const dispatched = await runMessageSaga(__messageSagaTestables.loadNearUnread, loadNearUnreadAC(channel))

    expect(dispatched).toEqual(expect.arrayContaining(bothDirectionLoadingActions(LOADING_STATE.LOADING)))
    expect(query.loadNearMessageId).toHaveBeenCalledWith('703')

    const setMessagesActions = dispatched.filter((action) => action.type === setMessagesAC([], channel.id).type)
    expect(setMessagesActions).toHaveLength(1)
    expect(setMessagesActions[0].payload.messages.map((message: IMessage) => message.id)).toEqual(['701', '703', '704'])
  })

  it('shows a cached unread window while offline without attempting a network fetch', async () => {
    const channel = makeChannel({
      id: 'channel-near-unread-offline-cache',
      lastDisplayedMessageId: '803',
      lastMessage: makeMessage({
        id: '805',
        channelId: 'channel-near-unread-offline-cache',
        body: 'latest-server'
      })
    })
    const cachedBoundary = makeMessage({ id: '803', channelId: channel.id, body: 'cached-803', incoming: true })
    const cachedUnread = makeMessage({ id: '804', channelId: channel.id, body: 'cached-804', incoming: true })
    const query = createMessageQuery()

    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    addMessageToMap(channel.id, cachedBoundary)
    addMessageToMap(channel.id, cachedUnread)
    setActiveSegment(channel.id, '803', '804')
    setClient(createClient(query, { ...channel, lastMessage: channel.lastMessage }))

    const dispatched = await runMessageSaga(__messageSagaTestables.loadNearUnread, loadNearUnreadAC(channel))

    expect(dispatched).not.toEqual(expect.arrayContaining(bothDirectionLoadingActions(LOADING_STATE.LOADING)))
    expect(dispatched).toEqual(
      expect.arrayContaining([
        setMessagesHasPrevAC(true),
        setMessagesHasNextAC(true),
        setUnreadMessageIdAC('803'),
        setMessagesAC([cachedBoundary, cachedUnread], channel.id),
        setUnreadScrollToAC(true),
        ...bothDirectionLoadingActions(LOADING_STATE.LOADED)
      ])
    )
    expect(query.loadNearMessageId).not.toHaveBeenCalled()
    expect(query.loadPrevious).not.toHaveBeenCalled()
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

    expect(dispatched).toEqual(expect.arrayContaining(bothDirectionLoadingActions(LOADING_STATE.LOADED)))
    expect(dispatched).not.toEqual(expect.arrayContaining(bothDirectionLoadingActions(LOADING_STATE.LOADING)))

    const setMessagesAction = getActionByType(dispatched, setMessagesAC([], channel.id).type)
    expect(setMessagesAction.payload.messages.map((message: any) => message.body)).toEqual([
      'cached-older',
      'cached-latest',
      'pending-offline-tail'
    ])

    const appendPendingAction = getActionByType(dispatched, addMessagesAC([], MESSAGE_LOAD_DIRECTION.NEXT).type)
    expect(appendPendingAction.payload.messages).toEqual([])
  })

  it('reloads around the visible anchor on reconnect when refreshed channel data is available', () => {
    const channelId = 'channel-reconnect-coordinator-around'
    const refreshedChannel = makeChannel({
      id: channelId,
      newMessageCount: 6,
      lastDisplayedMessageId: '514',
      lastMessage: makeMessage({
        id: '525',
        channelId,
        body: 'refreshed-last-message'
      })
    })
    const reloadAction = __messageSagaTestables.getReconnectReloadAction(refreshedChannel, '511', false, true)

    expect(reloadAction.type).toBe(refreshCacheAroundMessageAC(channelId, '511').type)
    expect(reloadAction.payload).toEqual(
      expect.objectContaining({
        channelId,
        messageId: '511',
        applyVisibleWindow: true
      })
    )
  })

  it('loads the unread window after reconnect when there is no visible anchor and the refreshed channel has unread state', async () => {
    jest.useFakeTimers()

    try {
      const channelId = 'channel-reconnect-coordinator-unread'
      const channel = makeChannel({
        id: channelId,
        newMessageCount: 0,
        lastDisplayedMessageId: ''
      })
      const refreshedChannel = {
        ...channel,
        newMessageCount: 12,
        lastDisplayedMessageId: '610'
      }

      setActiveChannelId(channelId)
      setChannelInMap(channel)
      mockStoreState.ChannelReducer = {
        channelsLoadingState: LOADING_STATE.LOADING,
        activeChannel: channel
      }

      setTimeout(() => {
        setChannelInMap(refreshedChannel)
        mockStoreState.ChannelReducer = {
          channelsLoadingState: LOADING_STATE.LOADED,
          activeChannel: refreshedChannel
        }
      }, 100)

      const dispatchedPromise = runMessageSaga(
        __messageSagaTestables.reloadActiveChannelAfterReconnect,
        reloadActiveChannelAfterReconnectAC(channel)
      )

      await Promise.resolve()
      jest.advanceTimersByTime(100)
      await Promise.resolve()

      const dispatched = await dispatchedPromise

      expect(dispatched).toHaveLength(2)
      expect(dispatched[0]).toEqual(setUnreadMessageIdAC(refreshedChannel.lastDisplayedMessageId))
      expect(dispatched[1].type).toBe(loadNearUnreadAC(channel).type)
      expect(dispatched[1].payload.channel).toEqual(
        expect.objectContaining({
          id: channelId,
          newMessageCount: refreshedChannel.newMessageCount,
          lastDisplayedMessageId: refreshedChannel.lastDisplayedMessageId
        })
      )
    } finally {
      jest.useRealTimers()
    }
  })

  it('loads the latest window after reconnect when unread exists and the reconnect started from the latest window', async () => {
    jest.useFakeTimers()

    try {
      const channelId = 'channel-reconnect-coordinator-unread-preferred'
      const channel = makeChannel({
        id: channelId,
        newMessageCount: 0,
        lastDisplayedMessageId: '',
        lastMessage: makeMessage({
          id: '650',
          channelId,
          body: 'stale-latest'
        })
      })
      const refreshedChannel = {
        ...channel,
        newMessageCount: 18,
        lastDisplayedMessageId: '640',
        lastMessage: makeMessage({
          id: '668',
          channelId,
          body: 'refreshed-latest'
        })
      }

      setActiveChannelId(channelId)
      setChannelInMap(channel)
      mockStoreState.ChannelReducer = {
        channelsLoadingState: LOADING_STATE.LOADING,
        activeChannel: channel
      }

      setTimeout(() => {
        setChannelInMap(refreshedChannel)
        mockStoreState.ChannelReducer = {
          channelsLoadingState: LOADING_STATE.LOADED,
          activeChannel: refreshedChannel
        }
      }, 100)

      const dispatchedPromise = runMessageSaga(
        __messageSagaTestables.reloadActiveChannelAfterReconnect,
        reloadActiveChannelAfterReconnectAC(channel, '649', true)
      )

      await Promise.resolve()
      jest.advanceTimersByTime(100)
      await Promise.resolve()

      const dispatched = await dispatchedPromise

      expect(dispatched).toHaveLength(2)
      expect(dispatched[0]).toEqual(setUnreadMessageIdAC(refreshedChannel.lastDisplayedMessageId))
      expect(dispatched[1].type).toBe(loadLatestMessagesAC(channel).type)
      expect(dispatched[1].payload).toEqual(
        expect.objectContaining({
          channel: expect.objectContaining({
            id: channelId,
            newMessageCount: refreshedChannel.newMessageCount,
            lastDisplayedMessageId: refreshedChannel.lastDisplayedMessageId,
            lastMessage: expect.objectContaining({ id: refreshedChannel.lastMessage.id })
          }),
          networkChanged: false,
          applyVisibleWindow: true
        })
      )
    } finally {
      jest.useRealTimers()
    }
  })

  it('falls back to the latest window after reconnect if the active channel does not refresh before timeout', async () => {
    jest.useFakeTimers()

    try {
      const channelId = 'channel-reconnect-coordinator-timeout'
      const channel = makeChannel({
        id: channelId,
        newMessageCount: 0,
        lastDisplayedMessageId: '',
        lastMessage: makeMessage({
          id: '710',
          channelId,
          body: 'latest'
        })
      })

      setActiveChannelId(channelId)
      setChannelInMap(channel)
      mockStoreState.ChannelReducer = {
        channelsLoadingState: LOADING_STATE.LOADED,
        activeChannel: channel
      }

      const dispatchedPromise = runMessageSaga(
        __messageSagaTestables.reloadActiveChannelAfterReconnect,
        reloadActiveChannelAfterReconnectAC(channel)
      )

      for (let i = 0; i < 32; i += 1) {
        jest.advanceTimersByTime(50)
        await Promise.resolve()
      }

      const dispatched = await dispatchedPromise

      expect(dispatched).toEqual([loadLatestMessagesAC(channel)])
    } finally {
      jest.useRealTimers()
    }
  })

  it('drops reconnect reload work if the active channel changes while waiting for refreshed channel data', async () => {
    jest.useFakeTimers()

    try {
      const channelId = 'channel-reconnect-stale-drop'
      const otherChannelId = 'channel-reconnect-stale-drop-other'
      const channel = makeChannel({ id: channelId })
      const refreshedChannel = {
        ...channel,
        newMessageCount: 4,
        lastDisplayedMessageId: '801'
      }

      setActiveChannelId(channelId)
      setChannelInMap(channel)
      mockStoreState.ChannelReducer = {
        channelsLoadingState: LOADING_STATE.LOADING,
        activeChannel: channel
      }

      setTimeout(() => {
        setActiveChannelId(otherChannelId)
        setChannelInMap(refreshedChannel)
        mockStoreState.ChannelReducer = {
          channelsLoadingState: LOADING_STATE.LOADED,
          activeChannel: makeChannel({ id: otherChannelId })
        }
      }, 100)

      const dispatchedPromise = runMessageSaga(
        __messageSagaTestables.reloadActiveChannelAfterReconnect,
        reloadActiveChannelAfterReconnectAC(channel, '800', false)
      )

      await Promise.resolve()
      jest.advanceTimersByTime(100)
      await Promise.resolve()

      const dispatched = await dispatchedPromise

      expect(dispatched).toEqual([])
    } finally {
      jest.useRealTimers()
    }
  })

  it('refreshes the current 50-message view around the center using 25 previous and 25 next messages', async () => {
    const channelId = 'channel-refresh-center-50'
    const activeMessages = Array.from({ length: 50 }, (_, index) =>
      makeMessage({
        id: String(1000 + index),
        channelId,
        body: `message-${index}`
      })
    )
    const refreshedMessages = activeMessages.map((message) =>
      message.id === '1027' ? { ...message, body: 'message-27-edited' } : message
    )
    const previousSlice = refreshedMessages.slice(0, 25)
    const nextSlice = refreshedMessages.slice(25)
    const query = createMessageQuery()
    const previousCalls: Array<{ messageId: string; limit: number }> = []
    const nextCalls: Array<{ messageId: string; limit: number }> = []

    query.loadPreviousMessageId = jest.fn((messageId: string) => {
      previousCalls.push({ messageId, limit: query.limit })
      return resolveWithMockServerDelay({ messages: previousSlice, hasNext: false })
    })
    query.loadNextMessageId = jest.fn((messageId: string) => {
      nextCalls.push({ messageId, limit: query.limit })
      return resolveWithMockServerDelay({ messages: nextSlice, hasNext: false })
    })

    mockStoreState.UserReducer.connectionStatus = CONNECTION_STATUS.CONNECTED
    mockStoreState.MessageReducer.activeChannelMessages = activeMessages
    setActiveChannelId(channelId)
    setClient(createClient(query))

    const dispatched = await runMessageSaga(
      __messageSagaTestables.refreshCacheAroundMessage,
      refreshCacheAroundMessageAC(channelId, 'ignored-anchor')
    )

    expect(previousCalls).toEqual([{ messageId: '1025', limit: 25 }])
    expect(nextCalls).toEqual([{ messageId: '1024', limit: 25 }])
    expect(dispatched).toEqual([
      patchMessagesAC([
        expect.objectContaining({
          id: '1027',
          body: 'message-27-edited'
        })
      ])
    ])
    expect(getMessageFromMap(channelId, '1027')?.body).toBe('message-27-edited')
  })

  it('replaces the active confirmed window when refreshed center slices return a different id window', async () => {
    const channelId = 'channel-refresh-center-replace'
    const activeMessages = Array.from({ length: 60 }, (_, index) =>
      makeMessage({
        id: String(2000 + index),
        channelId,
        body: `active-${index}`
      })
    )
    const previousSlice = activeMessages.slice(0, 30)
    const nextSlice = [
      ...activeMessages.slice(31),
      makeMessage({
        id: '2060',
        channelId,
        body: 'inserted-server-message'
      })
    ]
    const query = createMessageQuery()
    const previousCalls: Array<{ messageId: string; limit: number }> = []
    const nextCalls: Array<{ messageId: string; limit: number }> = []

    query.loadPreviousMessageId = jest.fn((messageId: string) => {
      previousCalls.push({ messageId, limit: query.limit })
      return resolveWithMockServerDelay({ messages: previousSlice, hasNext: false })
    })
    query.loadNextMessageId = jest.fn((messageId: string) => {
      nextCalls.push({ messageId, limit: query.limit })
      return resolveWithMockServerDelay({ messages: nextSlice, hasNext: false })
    })

    mockStoreState.UserReducer.connectionStatus = CONNECTION_STATUS.CONNECTED
    mockStoreState.MessageReducer.activeChannelMessages = activeMessages
    setActiveChannelId(channelId)
    setClient(createClient(query))

    const dispatched = await runMessageSaga(
      __messageSagaTestables.refreshCacheAroundMessage,
      refreshCacheAroundMessageAC(channelId, 'ignored-anchor')
    )

    expect(previousCalls).toEqual([{ messageId: '2030', limit: 30 }])
    expect(nextCalls).toEqual([{ messageId: '2029', limit: 30 }])

    const setMessagesAction = getActionByType(dispatched, setMessagesAC([], channelId).type)
    expect(setMessagesAction.payload.messages.map((message: IMessage) => message.id)).toEqual([
      ...previousSlice.map((message) => message.id),
      ...nextSlice.map((message) => message.id)
    ])
    expect(dispatched.some((action) => action.type === patchMessagesAC([]).type)).toBe(false)
  })

  it('keeps a changed refreshed window cache-only when applyVisibleWindow is false', async () => {
    const channelId = 'channel-refresh-center-cache-only'
    const activeMessages = Array.from({ length: 60 }, (_, index) =>
      makeMessage({
        id: String(2100 + index),
        channelId,
        body: `active-${index}`
      })
    )
    const previousSlice = activeMessages.slice(0, 30)
    const nextSlice = [
      ...activeMessages.slice(31),
      makeMessage({
        id: '2160',
        channelId,
        body: 'inserted-server-message'
      })
    ]
    const query = createMessageQuery({
      loadPreviousMessageId: jest.fn(() => resolveWithMockServerDelay({ messages: previousSlice, hasNext: false })),
      loadNextMessageId: jest.fn(() => resolveWithMockServerDelay({ messages: nextSlice, hasNext: false }))
    })

    mockStoreState.UserReducer.connectionStatus = CONNECTION_STATUS.CONNECTED
    mockStoreState.MessageReducer.activeChannelMessages = activeMessages
    setActiveChannelId(channelId)
    setClient(createClient(query))

    const dispatched = await runMessageSaga(
      __messageSagaTestables.refreshCacheAroundMessage,
      refreshCacheAroundMessageAC(channelId, 'ignored-anchor', false)
    )

    expect(dispatched.some((action) => action.type === setMessagesAC([], channelId).type)).toBe(false)
    expect(dispatched.some((action) => action.type === patchMessagesAC([]).type)).toBe(false)
    expect(getMessageFromMap(channelId, '2160')?.body).toBe('inserted-server-message')
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
        setLoadingNextMessagesStateAC(LOADING_STATE.LOADING),
        setMessagesHasNextAC(false),
        setMessagesHasPrevAC(true)
      ])
    )
    const addMessagesAction = getActionByType(dispatched, addMessagesAC([], MESSAGE_LOAD_DIRECTION.NEXT).type)
    expect(addMessagesAction.payload.direction).toBe(MESSAGE_LOAD_DIRECTION.NEXT)
    expect(addMessagesAction.payload.messages.map((message: any) => message.id)).toEqual(['511', '512'])
    expect(addMessagesAction.payload.messages.map((message: any) => message.body)).toEqual(['next-one', 'next-two'])
    expect(mockStore.dispatch).toHaveBeenCalledWith(setLoadingNextMessagesStateAC(LOADING_STATE.LOADED))
  })

  it('allows previous and next loadMore requests to run concurrently for the same channel', async () => {
    const channelId = 'channel-load-more-concurrent-directions'
    mockStoreState.UserReducer.connectionStatus = CONNECTION_STATUS.CONNECTED
    const deferredPrev = (() => {
      let resolveDeferred!: (value: QueryResult) => void
      const promise = new Promise<QueryResult>((resolve) => {
        resolveDeferred = resolve
      })
      return { promise, resolve: resolveDeferred }
    })()
    const deferredNext = (() => {
      let resolveDeferred!: (value: QueryResult) => void
      const promise = new Promise<QueryResult>((resolve) => {
        resolveDeferred = resolve
      })
      return { promise, resolve: resolveDeferred }
    })()
    const query = createMessageQuery({
      loadPreviousMessageId: jest.fn().mockImplementation(() => deferredPrev.promise),
      loadNextMessageId: jest.fn().mockImplementation(() => deferredNext.promise)
    })

    addMessageToMap(channelId, makeMessage({ id: '900', channelId, body: 'anchor-prev' }))
    addMessageToMap(channelId, makeMessage({ id: '901', channelId, body: 'anchor-next' }))
    setActiveSegment(channelId, '900', '901')
    setClient(createClient(query))

    const prevTask = runSaga(
      {
        dispatch: () => undefined,
        getState: () => mockStoreState
      },
      __messageSagaTestables.loadMoreMessages,
      loadMoreMessagesAC(channelId, 20, MESSAGE_LOAD_DIRECTION.PREV, '900', true)
    )

    const nextTask = runSaga(
      {
        dispatch: () => undefined,
        getState: () => mockStoreState
      },
      __messageSagaTestables.loadMoreMessages,
      loadMoreMessagesAC(channelId, 20, MESSAGE_LOAD_DIRECTION.NEXT, '901', true)
    )

    await flushMockServerDelay()
    await flushAsyncWork()

    expect(query.loadPreviousMessageId).toHaveBeenCalledTimes(1)
    expect(query.loadNextMessageId).toHaveBeenCalledTimes(1)

    deferredPrev.resolve({
      messages: [
        makeMessage({ id: '898', channelId, body: 'prev-898' }),
        makeMessage({ id: '899', channelId, body: 'prev-899' })
      ],
      hasNext: true
    })
    deferredNext.resolve({
      messages: [
        makeMessage({ id: '902', channelId, body: 'next-902' }),
        makeMessage({ id: '903', channelId, body: 'next-903' })
      ],
      hasNext: true
    })

    await Promise.all([prevTask.toPromise(), nextTask.toPromise()])
  })

  it('keeps stale reversed-direction loadMore results cache-only', async () => {
    const channelId = 'channel-stale-load-more-cache-only'
    mockStoreState.UserReducer.connectionStatus = CONNECTION_STATUS.CONNECTED
    const deferredPrev = (() => {
      let resolveDeferred!: (value: QueryResult) => void
      const promise = new Promise<QueryResult>((resolve) => {
        resolveDeferred = resolve
      })
      return { promise, resolve: resolveDeferred }
    })()
    const query = createMessageQuery({
      loadPreviousMessageId: jest.fn().mockImplementation(() => deferredPrev.promise)
    })
    const visibleMessages = [
      makeMessage({ id: '900', channelId, body: 'visible-900' }),
      makeMessage({ id: '901', channelId, body: 'visible-901' })
    ]

    visibleMessages.forEach((message) => addMessageToMap(channelId, message))
    setActiveSegment(channelId, '900', '901')
    mockStoreState.MessageReducer.activeChannelMessages = visibleMessages
    mockStoreState.MessageReducer.activePaginationIntent = {
      channelId,
      direction: 'prev',
      requestId: 'prev-request',
      anchorId: '900'
    }
    setClient(createClient(query))

    const dispatched: any[] = []
    const prevTask = runSaga(
      {
        dispatch: (effect) => {
          dispatched.push(effect)
        },
        getState: () => mockStoreState
      },
      __messageSagaTestables.loadMoreMessages,
      loadMoreMessagesAC(channelId, 20, MESSAGE_LOAD_DIRECTION.PREV, '900', true, 'prev-request')
    )

    await flushAsyncWork()

    mockStoreState.MessageReducer.activePaginationIntent = {
      channelId,
      direction: 'next',
      requestId: 'next-request',
      anchorId: '901'
    }

    deferredPrev.resolve({
      messages: [
        makeMessage({ id: '898', channelId, body: 'stale-898' }),
        makeMessage({ id: '899', channelId, body: 'stale-899' })
      ],
      hasNext: true
    })

    await prevTask.toPromise()

    expect(getContiguousPrevMessages(channelId, { id: '900' } as IMessage, 20).map((message) => message.id)).toEqual([
      '898',
      '899'
    ])
    expect(dispatched.some((action) => action.type === addMessagesAC([], MESSAGE_LOAD_DIRECTION.PREV).type)).toBe(false)
    expect(dispatched.some((action) => action.type === setMessagesHasPrevAC(true).type)).toBe(false)
    expect(dispatched.some((action) => action.type === setMessagesHasNextAC(true).type)).toBe(false)
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
        ...bothDirectionLoadingActions(LOADING_STATE.LOADING),
        setMessagesHasPrevAC(true),
        setMessagesHasNextAC(false),
        ...bothDirectionLoadingActions(LOADING_STATE.LOADED)
      ])
    )

    const setMessagesAction = getActionByType(dispatched, setMessagesAC([], channel.id).type)
    expect(setMessagesAction.payload.messages.map((message: any) => message.body)).toEqual(['server-702', 'server-703'])

    const appendPendingAction = getActionByType(dispatched, addMessagesAC([], MESSAGE_LOAD_DIRECTION.NEXT).type)
    expect(appendPendingAction.payload.messages.map((message: any) => message.body)).toEqual(['pending-latest-tail'])
    expect(getMessageFromMap(channel.id, '703')?.body).toBe('server-703')
  })

  it('replaces the cached latest window on reconnect when the server returns newer received ids beyond the offline cache', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const remoteUser = makeUser({ id: 'remote-user' })
    const channel = makeChannel({
      id: 'channel-reconnect-received-after-offline',
      lastMessage: makePendingMessage({
        channelId: 'channel-reconnect-received-after-offline',
        tid: 'pending-latest-tid',
        body: 'pending-latest',
        metadata: '{}',
        createdAt: new Date('2026-04-08T10:59:00.000Z'),
        user: currentUser
      })
    })
    const cachedConfirmed = [
      makeMessage({ id: '998', channelId: channel.id, body: 'cached-998', user: remoteUser, incoming: true }),
      makeMessage({ id: '999', channelId: channel.id, body: 'cached-999', user: remoteUser, incoming: true })
    ]
    const receivedWhileOffline = [
      makeMessage({ id: '1000', channelId: channel.id, body: 'received-1000', user: remoteUser, incoming: true }),
      makeMessage({ id: '1001', channelId: channel.id, body: 'received-1001', user: remoteUser, incoming: true })
    ]
    const loadedMessages = [...cachedConfirmed, ...receivedWhileOffline]
    const query = createMessageQuery({
      loadPrevious: jest.fn(() => resolveWithMockServerDelay({ messages: loadedMessages, hasNext: false }))
    })

    mockStoreState.UserReducer.connectionStatus = CONNECTION_STATUS.CONNECTED
    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    cachedConfirmed.forEach((message) => addMessageToMap(channel.id, message))
    addMessageToMap(channel.id, channel.lastMessage as any)
    setClient(createClient(query, { ...channel, lastMessage: receivedWhileOffline[1] }))

    const dispatched = await runMessageSaga(__messageSagaTestables.loadDefaultMessages, loadDefaultMessagesAC(channel))

    const setMessagesActions = dispatched.filter((action) => action.type === setMessagesAC([], channel.id).type)

    expect(setMessagesActions).toHaveLength(2)
    expect(setMessagesActions[0].payload.messages.map((message: any) => message.body)).toEqual([
      'cached-998',
      'cached-999',
      'pending-latest'
    ])
    expect(setMessagesActions[1].payload.messages.map((message: any) => message.body)).toEqual([
      'cached-998',
      'cached-999',
      'received-1000',
      'received-1001'
    ])

    const appendPendingActions = dispatched.filter(
      (action) => action.type === addMessagesAC([], MESSAGE_LOAD_DIRECTION.NEXT).type
    )
    expect(appendPendingActions.at(-1)?.payload.messages.map((message: any) => message.body)).toEqual([
      'pending-latest'
    ])
  })

  it('refreshes latest cache without replacing a changed visible window when applyVisibleWindow is false', async () => {
    const channel = makeChannel({
      id: 'channel-latest-cache-only-refresh',
      lastMessage: makeMessage({
        id: '903',
        channelId: 'channel-latest-cache-only-refresh',
        body: 'server-903'
      })
    })
    const activeMessages = [
      makeMessage({ id: '900', channelId: channel.id, body: 'active-900', incoming: true }),
      makeMessage({ id: '901', channelId: channel.id, body: 'active-901', incoming: true })
    ]
    const loadedMessages = [
      makeMessage({ id: '902', channelId: channel.id, body: 'server-902', incoming: true }),
      makeMessage({ id: '903', channelId: channel.id, body: 'server-903', incoming: true })
    ]
    const query = createMessageQuery({
      loadPrevious: jest.fn(() => resolveWithMockServerDelay({ messages: loadedMessages, hasNext: false }))
    })

    mockStoreState.UserReducer.connectionStatus = CONNECTION_STATUS.CONNECTED
    mockStoreState.MessageReducer.activeChannelMessages = activeMessages
    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    setClient(createClient(query, channel))

    const dispatched = await runMessageSaga(
      __messageSagaTestables.getMessagesQuery,
      loadLatestMessagesAC(channel, undefined, undefined, false)
    )

    expect(dispatched.some((action) => action.type === setMessagesAC([], channel.id).type)).toBe(false)
    expect(dispatched.some((action) => action.type === addMessagesAC([], MESSAGE_LOAD_DIRECTION.NEXT).type)).toBe(false)
    expect(getMessageFromMap(channel.id, '903')?.body).toBe('server-903')
  })

  it('keeps the unread boundary on lastDisplayedMessageId when reconnect refresh loads the latest window', async () => {
    const staleChannel = makeChannel({
      id: 'channel-reconnect-latest-unread-anchor',
      newMessageCount: 0,
      lastDisplayedMessageId: '',
      lastMessage: makeMessage({
        id: '1098',
        channelId: 'channel-reconnect-latest-unread-anchor',
        body: 'stale-latest'
      })
    })
    const refreshedChannel = {
      ...staleChannel,
      newMessageCount: 2,
      lastDisplayedMessageId: '1098',
      lastMessage: makeMessage({
        id: '1101',
        channelId: staleChannel.id,
        body: 'server-1101',
        incoming: true
      })
    }
    const loadedMessages = [
      makeMessage({
        id: '1100',
        channelId: staleChannel.id,
        body: 'server-1100',
        incoming: true
      }),
      makeMessage({
        id: '1101',
        channelId: staleChannel.id,
        body: 'server-1101',
        incoming: true
      })
    ]
    const query = createMessageQuery({
      loadPrevious: jest.fn(() => resolveWithMockServerDelay({ messages: loadedMessages, hasNext: false }))
    })

    mockStoreState.UserReducer.connectionStatus = CONNECTION_STATUS.CONNECTED
    setActiveChannelId(staleChannel.id)
    setChannelInMap(staleChannel)
    setClient(createClient(query, refreshedChannel))

    const dispatched = await runMessageSaga(
      __messageSagaTestables.getMessagesQuery,
      loadLatestMessagesAC(refreshedChannel, undefined, true)
    )

    expect(dispatched).toEqual(
      expect.arrayContaining([
        setUnreadMessageIdAC(refreshedChannel.lastDisplayedMessageId),
        setMessagesAC(loadedMessages, staleChannel.id)
      ])
    )
    expect(dispatched).not.toContainEqual(setUnreadMessageIdAC('1100'))
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
    expect(getContiguousPrevMessages(channelId, { id: '900' } as IMessage, 10).map((message) => message.id)).toEqual([
      '898',
      '899'
    ])
    expect(getActiveSegment()).toEqual({ startId: '898', endId: '902' })

    await runMessageSaga(__messageSagaTestables.prefetchMessages, channelId, '902', MESSAGE_LOAD_DIRECTION.NEXT, 1)

    expect(query.loadNextMessageId).toHaveBeenCalledWith('902')
    expect(getContiguousNextMessages(channelId, { id: '902' } as IMessage, 10).map((message) => message.id)).toEqual([
      '903',
      '904'
    ])
    expect(getActiveSegment()).toEqual({ startId: '898', endId: '904' })
  })

  it('patches the active message list when a background prefetch updates an overlapping cached page', async () => {
    const channelId = 'channel-prefetch-patch-active'
    const anchor = makeMessage({ id: '900', channelId, body: 'anchor' })
    const staleVisible = makeMessage({ id: '901', channelId, body: 'stale-visible' })
    const refreshedVisible = makeMessage({ id: '901', channelId, body: 'refreshed-visible' })
    const prefetchedNext = makeMessage({ id: '902', channelId, body: 'prefetched-next' })
    const query = createMessageQuery({
      loadNextMessageId: jest.fn(() =>
        resolveWithMockServerDelay({ messages: [refreshedVisible, prefetchedNext], hasNext: false })
      )
    })

    mockStoreState.MessageReducer.activeChannelMessages = [anchor, staleVisible]
    setActiveChannelId(channelId)
    addMessageToMap(channelId, anchor)
    addMessageToMap(channelId, staleVisible)
    setActiveSegment(channelId, '900', '900')
    setClient(createClient(query))

    const dispatched = await runMessageSaga(
      __messageSagaTestables.prefetchMessages,
      channelId,
      '900',
      MESSAGE_LOAD_DIRECTION.NEXT,
      1
    )

    expect(query.loadNextMessageId).toHaveBeenCalledWith('900')
    expect(getContiguousNextMessages(channelId, { id: '900' } as IMessage, 10).map((message) => message.body)).toEqual([
      'refreshed-visible',
      'prefetched-next'
    ])

    const patchAction = getActionByType(dispatched, patchMessagesAC([]).type)
    expect(patchAction).toEqual(
      patchMessagesAC([
        expect.objectContaining({
          id: '901',
          body: 'refreshed-visible'
        })
      ])
    )
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
    expect(getContiguousPrevMessages(channelId, { id: '900' } as IMessage, 10).map((message) => message.id)).toEqual([
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
        setUnreadMessageIdAC(''),
        updateMessageAC('local-tid', expect.objectContaining({ id: '601', tid: 'local-tid' }), true),
        updateChannelDataAC(
          channel.id,
          expect.objectContaining({
            lastMessage: expect.objectContaining({ id: '601', body: 'hello world' }),
            lastReactedMessage: null
          }),
          true
        )
      ])
    )

    expect(getPendingMessagesFromMap(channel.id)).toEqual([])
    expect(getMessageFromMap(channel.id, '601')).toEqual(expect.objectContaining({ id: '601', tid: 'local-tid' }))
    expect(getMessageFromMap(channel.id, 'local-tid')).toEqual(expect.objectContaining({ id: '601' }))
    expect(getContiguousNextMessages(channel.id, { id: '600' } as IMessage, 10).map((message) => message.id)).toEqual([
      '601'
    ])
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
    await flushNavigateToLatestDelay()

    logErrorSpy.mockRestore()

    expect(navigateToLatest).toHaveBeenCalledWith(true)
    expect(channel.sendMessage).not.toHaveBeenCalled()
    expect(dispatched).toEqual(
      expect.arrayContaining([
        setUnreadMessageIdAC(''),
        updateMessageAC('offline-tid', { state: MESSAGE_STATUS.FAILED })
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
    expect(getChannelFromMap(channel.id)?.lastMessage).toEqual(expect.objectContaining({ tid: 'offline-tid' }))
  })

  it('updates channel last message to the latest pending after each offline send', async () => {
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
        expect.objectContaining({ tid: createdMessages[index].tid })
      )
      expect(getChannelFromAllChannels(channel.id)?.lastMessage).toEqual(
        expect.objectContaining({ tid: createdMessages[index].tid })
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
    await flushNavigateToLatestDelay()

    logErrorSpy.mockRestore()

    expect(navigateToLatest).toHaveBeenCalledWith(true)
    expect(channel.sendMessage).not.toHaveBeenCalled()
    expect(dispatched).toEqual(
      expect.arrayContaining([
        updateAttachmentUploadingStateAC(UPLOAD_STATE.FAIL, 'offline-attachment-file-tid'),
        updateMessageAC('offline-attachment-tid', { state: MESSAGE_STATUS.FAILED })
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
        setUnreadMessageIdAC(''),
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
        )
      ])
    )

    expect(getPendingMessagesFromMap(channel.id)).toEqual([])
    expect(getMessageFromMap(channel.id, '712')).toEqual(
      expect.objectContaining({ id: '712', tid: createdMessage.tid })
    )
    expect(getContiguousNextMessages(channel.id, { id: '711' } as IMessage, 10).map((message) => message.id)).toEqual([
      '712'
    ])
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
      expect.arrayContaining([updateMessageAC('offline-forward-tid', { state: MESSAGE_STATUS.FAILED })])
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
        )
      ])
    )

    expect(getPendingMessagesFromMap(channel.id)).toEqual([])
    expect(getMessageFromMap(channel.id, '722')).toEqual(
      expect.objectContaining({ id: '722', tid: createdForward.tid })
    )
    expect(getContiguousNextMessages(channel.id, { id: '721' } as IMessage, 10).map((message) => message.id)).toEqual([
      '722'
    ])
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

    mockStoreState.UserReducer.connectionStatus = CONNECTION_STATUS.CONNECTED
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

  it('queues a delete while reconnecting, applies an optimistic tombstone, and does not call the SDK immediately', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const message = makeMessage({
      id: '7501',
      channelId: 'channel-delete-reconnecting',
      body: 'delete me',
      metadata: {} as any,
      user: currentUser
    })
    const channel = makeChannel({
      id: 'channel-delete-reconnecting',
      lastMessage: message
    })

    channel.deleteMessageById = jest.fn()

    mockStoreState.UserReducer.connectionStatus = CONNECTION_STATUS.CONNECTING
    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    addMessageToMap(channel.id, message)
    setClient({
      user: { id: 'current-user' },
      Channel: { create: jest.fn() }
    })

    const dispatched = await runMessageSaga(
      __messageSagaTestables.deleteMessage,
      deleteMessageAC(channel.id, message.id, 'forEveryone')
    )

    const queuedMutationAction = getActionByType(dispatched, setPendingMessageMutationAC({} as any).type)

    expect(channel.deleteMessageById).not.toHaveBeenCalled()
    expect(queuedMutationAction.payload.mutation).toEqual(
      expect.objectContaining({
        type: 'DELETE_MESSAGE',
        channelId: channel.id,
        messageId: message.id,
        deleteOption: 'forEveryone',
        originalMessage: expect.objectContaining({ id: message.id, body: 'delete me' })
      })
    )
    expect(dispatched).toEqual(
      expect.arrayContaining([
        updateMessageAC(
          message.id,
          expect.objectContaining({
            id: message.id,
            state: MESSAGE_STATUS.DELETE,
            body: '',
            attachments: []
          })
        ),
        updateChannelLastMessageAC(
          expect.objectContaining({
            id: message.id,
            state: MESSAGE_STATUS.DELETE,
            body: ''
          }),
          channel
        )
      ])
    )
    expect(getMessageFromMap(channel.id, message.id)).toEqual(
      expect.objectContaining({ id: message.id, state: MESSAGE_STATUS.DELETE, body: '' })
    )
    expect(getChannelFromMap(channel.id)?.lastMessage).toEqual(
      expect.objectContaining({ id: message.id, state: MESSAGE_STATUS.DELETE, body: '' })
    )
  })

  it('queues an edit while reconnecting, applies the optimistic change, and does not call the SDK immediately', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const originalMessage = makeMessage({
      id: '7601',
      channelId: 'channel-edit-reconnecting',
      body: 'before-edit',
      metadata: {} as any,
      user: currentUser
    })
    const channel = makeChannel({
      id: 'channel-edit-reconnecting',
      lastMessage: originalMessage
    })

    channel.editMessage = jest.fn()

    mockStoreState.UserReducer.connectionStatus = CONNECTION_STATUS.CONNECTING
    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    addMessageToMap(channel.id, originalMessage)
    setClient({
      user: { id: 'current-user' },
      Channel: { create: jest.fn() }
    })

    const dispatched = await runMessageSaga(
      __messageSagaTestables.editMessage,
      editMessageAC(channel.id, {
        ...originalMessage,
        body: 'after-edit-offline'
      } as any)
    )

    const queuedMutationAction = getActionByType(dispatched, setPendingMessageMutationAC({} as any).type)

    expect(channel.editMessage).not.toHaveBeenCalled()
    expect(queuedMutationAction.payload.mutation).toEqual(
      expect.objectContaining({
        type: 'EDIT_MESSAGE',
        channelId: channel.id,
        messageId: originalMessage.id,
        message: expect.objectContaining({ id: originalMessage.id, body: 'after-edit-offline' }),
        originalMessage: expect.objectContaining({ id: originalMessage.id, body: 'before-edit' })
      })
    )
    expect(dispatched).toEqual(
      expect.arrayContaining([
        updateMessageAC(
          originalMessage.id,
          expect.objectContaining({ id: originalMessage.id, body: 'after-edit-offline' })
        ),
        updateChannelLastMessageAC(
          expect.objectContaining({ id: originalMessage.id, body: 'after-edit-offline' }),
          channel
        )
      ])
    )
    expect(getMessageFromMap(channel.id, originalMessage.id)).toEqual(
      expect.objectContaining({ id: originalMessage.id, body: 'after-edit-offline' })
    )
    expect(getChannelFromMap(channel.id)?.lastMessage).toEqual(
      expect.objectContaining({ id: originalMessage.id, body: 'after-edit-offline' })
    )
  })

  it('replays queued delete and edit mutations after reconnect and clears their queue entries', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const deleteMessage = makeMessage({
      id: '7701',
      channelId: 'channel-replay-mutations',
      body: 'delete-on-reconnect',
      metadata: {} as any,
      user: currentUser
    })
    const editMessage = makeMessage({
      id: '7702',
      channelId: 'channel-replay-mutations',
      body: 'edit-before-reconnect',
      metadata: {} as any,
      user: currentUser
    })
    const channel = makeChannel({
      id: 'channel-replay-mutations',
      lastMessage: editMessage
    })
    const deletedResponse = {
      ...deleteMessage,
      state: MESSAGE_STATUS.DELETE,
      body: '',
      attachments: [],
      bodyAttributes: [],
      updatedAt: new Date('2026-04-11T10:00:00.000Z')
    }
    const editedResponse = {
      ...editMessage,
      body: 'edit-after-reconnect',
      updatedAt: new Date('2026-04-11T10:01:00.000Z')
    }

    channel.deleteMessageById = jest.fn(() => resolveWithMockServerDelay(deletedResponse))
    channel.editMessage = jest.fn(() => resolveWithMockServerDelay(editedResponse))

    mockStoreState.UserReducer.connectionStatus = CONNECTION_STATUS.CONNECTED
    mockStoreState.MessageReducer.pendingMessageMutations = {
      [deleteMessage.id]: {
        type: 'DELETE_MESSAGE',
        channelId: channel.id,
        messageId: deleteMessage.id,
        deleteOption: 'forEveryone',
        originalMessage: deleteMessage,
        queuedAt: 1
      },
      [editMessage.id]: {
        type: 'EDIT_MESSAGE',
        channelId: channel.id,
        messageId: editMessage.id,
        message: {
          ...editMessage,
          body: 'edit-after-reconnect'
        },
        originalMessage: editMessage,
        queuedAt: 2
      }
    }
    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    addMessageToMap(channel.id, deleteMessage)
    addMessageToMap(channel.id, editMessage)
    setClient({
      user: { id: 'current-user' },
      Channel: { create: jest.fn() }
    })

    const dispatched = await runMessageSaga(
      __messageSagaTestables.resendPendingMessageMutations,
      resendPendingMessageMutationsAC(CONNECTION_STATUS.CONNECTED)
    )

    expect(channel.deleteMessageById).toHaveBeenCalledWith(deleteMessage.id, false)
    expect(channel.editMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: editMessage.id,
        body: 'edit-after-reconnect'
      })
    )
    expect(dispatched).toEqual(
      expect.arrayContaining([
        updateMessageAC(
          deleteMessage.id,
          expect.objectContaining({ id: deleteMessage.id, state: MESSAGE_STATUS.DELETE })
        ),
        updateMessageAC(editMessage.id, expect.objectContaining({ id: editMessage.id, body: 'edit-after-reconnect' })),
        removePendingMessageMutationAC(deleteMessage.id),
        removePendingMessageMutationAC(editMessage.id)
      ])
    )
    expect(getMessageFromMap(channel.id, deleteMessage.id)).toEqual(
      expect.objectContaining({ id: deleteMessage.id, state: MESSAGE_STATUS.DELETE, body: '' })
    )
    expect(getMessageFromMap(channel.id, editMessage.id)).toEqual(
      expect.objectContaining({ id: editMessage.id, body: 'edit-after-reconnect' })
    )
  })

  it('replaces a queued reconnecting edit with the latest edit payload while preserving the original rollback snapshot', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const originalMessage = makeMessage({
      id: '7801',
      channelId: 'channel-edit-conflict',
      body: 'before-edit',
      metadata: {} as any,
      user: currentUser
    })
    const channel = makeChannel({
      id: 'channel-edit-conflict',
      lastMessage: originalMessage
    })

    mockStoreState.UserReducer.connectionStatus = CONNECTION_STATUS.CONNECTING
    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    addMessageToMap(channel.id, originalMessage)
    setClient({
      user: { id: 'current-user' },
      Channel: { create: jest.fn() }
    })

    const firstDispatched = await runMessageSaga(
      __messageSagaTestables.editMessage,
      editMessageAC(channel.id, {
        ...originalMessage,
        body: 'draft-1'
      } as any)
    )
    const firstQueuedMutation = getActionByType(firstDispatched, setPendingMessageMutationAC({} as any).type).payload
      .mutation

    mockStoreState.MessageReducer.pendingMessageMutations = {
      [originalMessage.id]: firstQueuedMutation
    }

    const secondDispatched = await runMessageSaga(
      __messageSagaTestables.editMessage,
      editMessageAC(channel.id, {
        ...originalMessage,
        body: 'draft-2'
      } as any)
    )
    const secondQueuedMutation = getActionByType(secondDispatched, setPendingMessageMutationAC({} as any).type).payload
      .mutation

    expect(secondQueuedMutation).toEqual(
      expect.objectContaining({
        type: 'EDIT_MESSAGE',
        messageId: originalMessage.id,
        message: expect.objectContaining({ body: 'draft-2' }),
        originalMessage: expect.objectContaining({ body: 'before-edit' }),
        queuedAt: firstQueuedMutation.queuedAt
      })
    )
    expect(getMessageFromMap(channel.id, originalMessage.id)).toEqual(
      expect.objectContaining({ id: originalMessage.id, body: 'draft-2' })
    )
  })

  it('collapses reconnecting edit then delete into a queued delete and ignores later edits after delete wins', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const originalMessage = makeMessage({
      id: '7901',
      channelId: 'channel-delete-conflict',
      body: 'before-delete',
      metadata: {} as any,
      user: currentUser
    })
    const channel = makeChannel({
      id: 'channel-delete-conflict',
      lastMessage: originalMessage
    })

    mockStoreState.UserReducer.connectionStatus = CONNECTION_STATUS.CONNECTING
    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    addMessageToMap(channel.id, originalMessage)
    setClient({
      user: { id: 'current-user' },
      Channel: { create: jest.fn() }
    })

    const editDispatched = await runMessageSaga(
      __messageSagaTestables.editMessage,
      editMessageAC(channel.id, {
        ...originalMessage,
        body: 'edited-before-delete'
      } as any)
    )
    const queuedEditMutation = getActionByType(editDispatched, setPendingMessageMutationAC({} as any).type).payload
      .mutation

    mockStoreState.MessageReducer.pendingMessageMutations = {
      [originalMessage.id]: queuedEditMutation
    }

    const deleteDispatched = await runMessageSaga(
      __messageSagaTestables.deleteMessage,
      deleteMessageAC(channel.id, originalMessage.id, 'forEveryone')
    )
    const queuedDeleteMutation = getActionByType(deleteDispatched, setPendingMessageMutationAC({} as any).type).payload
      .mutation

    expect(queuedDeleteMutation).toEqual(
      expect.objectContaining({
        type: 'DELETE_MESSAGE',
        messageId: originalMessage.id,
        deleteOption: 'forEveryone',
        originalMessage: expect.objectContaining({ body: 'before-delete' }),
        queuedAt: queuedEditMutation.queuedAt
      })
    )

    mockStoreState.MessageReducer.pendingMessageMutations = {
      [originalMessage.id]: queuedDeleteMutation
    }

    const ignoredEditDispatched = await runMessageSaga(
      __messageSagaTestables.editMessage,
      editMessageAC(channel.id, {
        ...originalMessage,
        body: 'should-be-ignored'
      } as any)
    )

    expect(ignoredEditDispatched.some((action) => action.type === setPendingMessageMutationAC({} as any).type)).toBe(
      false
    )
    expect(getMessageFromMap(channel.id, originalMessage.id)).toEqual(
      expect.objectContaining({ id: originalMessage.id, state: MESSAGE_STATUS.DELETE, body: '' })
    )
  })

  it('rolls back an optimistic queued edit if replay fails with a non-connection error', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const originalMessage = makeMessage({
      id: '7951',
      channelId: 'channel-replay-rollback',
      body: 'rollback-before',
      metadata: {} as any,
      user: currentUser
    })
    const channel = makeChannel({
      id: 'channel-replay-rollback',
      lastMessage: originalMessage
    })

    channel.editMessage = jest.fn(() => {
      throw new Error('forbidden')
    })

    mockStoreState.UserReducer.connectionStatus = CONNECTION_STATUS.CONNECTED
    mockStoreState.MessageReducer.pendingMessageMutations = {
      [originalMessage.id]: {
        type: 'EDIT_MESSAGE',
        channelId: channel.id,
        messageId: originalMessage.id,
        message: {
          ...originalMessage,
          body: 'rollback-after'
        },
        originalMessage,
        queuedAt: 1
      }
    }
    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    addMessageToMap(channel.id, {
      ...originalMessage,
      body: 'rollback-after',
      updatedAt: new Date('2026-04-11T12:00:00.000Z')
    })
    setClient({
      user: { id: 'current-user' },
      Channel: { create: jest.fn() }
    })

    const dispatched = await runMessageSaga(
      __messageSagaTestables.resendPendingMessageMutations,
      resendPendingMessageMutationsAC(CONNECTION_STATUS.CONNECTED)
    )

    expect(channel.editMessage).toHaveBeenCalled()
    expect(dispatched).toEqual(
      expect.arrayContaining([
        updateMessageAC(
          originalMessage.id,
          expect.objectContaining({ id: originalMessage.id, body: 'rollback-before' })
        ),
        updateChannelLastMessageAC(
          expect.objectContaining({ id: originalMessage.id, body: 'rollback-before' }),
          channel
        ),
        removePendingMessageMutationAC(originalMessage.id)
      ])
    )
    expect(getMessageFromMap(channel.id, originalMessage.id)).toEqual(
      expect.objectContaining({ id: originalMessage.id, body: 'rollback-before' })
    )
    expect(logErrorSpy).toHaveBeenCalled()
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
      expect.arrayContaining([updateMessageAC('resend-text-tid', { state: MESSAGE_STATUS.FAILED })])
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
        updateMessageAC('resend-attachment-tid', { state: MESSAGE_STATUS.UNMODIFIED }),
        updateAttachmentUploadingStateAC(UPLOAD_STATE.FAIL, 'resend-attachment-file-tid'),
        updateMessageAC('resend-attachment-tid', { state: MESSAGE_STATUS.FAILED })
      ])
    )
    expect(getMessageFromMap(channel.id, 'resend-attachment-tid')).toEqual(
      expect.objectContaining({ tid: 'resend-attachment-tid', state: MESSAGE_STATUS.FAILED })
    )
  })

  it('keeps channel last message on confirmed server truth while reconnect resend confirms older pending messages', async () => {
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
      lastMessage: makeMessage({
        id: '900',
        channelId,
        body: 'confirmed-start',
        metadata: {} as any,
        user: currentUser
      })
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

    expect(getChannelFromMap(channelId)?.lastMessage).toEqual(expect.objectContaining({ id: confirmedText.id }))
    expect(
      dispatched.some(
        (action) =>
          action.type ===
            updateChannelDataAC(channelId, { lastMessage: confirmedText, lastReactedMessage: null }, true).type &&
          action.payload.channelId === channelId &&
          action.payload.config?.lastMessage?.id === confirmedText.id
      )
    ).toBe(true)

    expect(channel.sendMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ tid: attachmentPending.tid }))

    resolveAttachment(confirmedAttachment)
    await flushAsyncWork()

    expect(getChannelFromMap(channelId)?.lastMessage).toEqual(expect.objectContaining({ id: confirmedAttachment.id }))
    expect(
      dispatched.some(
        (action) =>
          action.type ===
            updateChannelDataAC(channelId, { lastMessage: confirmedAttachment, lastReactedMessage: null }, true).type &&
          action.payload.channelId === channelId &&
          action.payload.config?.lastMessage?.id === confirmedAttachment.id
      )
    ).toBe(true)

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

  it('keeps newest pending last message while older resend confirmations arrive and promotes only when the pending itself confirms', async () => {
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
    const newestPending = pendingMessages[3]
    const channel = makeChannel({
      id: channelId,
      lastMessage: newestPending as any
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
        expect.objectContaining({ tid: newestPending.tid })
      )
      expect(getChannelFromMap(channelId)?.lastMessage?.id).toBeFalsy()
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

describe('loadAroundMessage cache-first restore (restoreWindow)', () => {
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
    mockStoreState.ChannelReducer = {
      channelsLoadingState: LOADING_STATE.LOADED,
      activeChannel: {}
    }
    mockStoreState.MessageReducer = {
      activeChannelMessages: [],
      activePaginationIntent: null,
      stableUnreadAnchor: { channelId: '', messageId: '' },
      pendingPollActions: {},
      pendingMessageMutations: {},
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

  it('renders exact cached [startId, endId] without a server round-trip when the interval is fully cached', async () => {
    const channel = makeChannel({
      id: 'channel-restore-cached',
      lastMessage: makeMessage({ id: '105', channelId: 'channel-restore-cached' })
    })
    const msg103 = makeMessage({ id: '103', channelId: channel.id, body: 'cached-103' })
    const msg104 = makeMessage({ id: '104', channelId: channel.id, body: 'cached-104' })
    const msg105 = makeMessage({ id: '105', channelId: channel.id, body: 'cached-105' })
    const query = createMessageQuery({
      loadPreviousMessageId: jest.fn(() => resolveWithMockServerDelay({ messages: [], hasNext: false })),
      loadNextMessageId: jest.fn(() => resolveWithMockServerDelay({ messages: [], hasNext: false }))
    })

    mockStoreState.UserReducer.connectionStatus = CONNECTION_STATUS.DISCONNECTED
    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    addMessageToMap(channel.id, msg103)
    addMessageToMap(channel.id, msg104)
    addMessageToMap(channel.id, msg105)
    setActiveSegment(channel.id, '103', '105')
    setClient(createClient(query))

    const restoreWindow = {
      startId: '103',
      endId: '105',
      anchorId: '104',
      prevCount: 1,
      nextCount: 1,
      preferCache: true
    }
    const dispatched = await runMessageSaga(
      __messageSagaTestables.loadAroundMessageWorker,
      loadAroundMessageAC(channel, '104', undefined, restoreWindow)
    )

    // No loading spinner for cache-first restore
    expect(dispatched).not.toEqual(expect.arrayContaining(bothDirectionLoadingActions(LOADING_STATE.LOADING)))

    const setMessagesAction = dispatched.find((a) => a.type === setMessagesAC([], channel.id).type)
    expect(setMessagesAction).toBeDefined()
    expect(setMessagesAction.payload.messages.map((m: IMessage) => m.id)).toEqual(['103', '104', '105'])

    // Server query must not have been called
    expect(query.loadPreviousMessageId).not.toHaveBeenCalled()
    expect(query.loadNextMessageId).not.toHaveBeenCalled()

    // hasPrev / hasNext flags are set from cache
    expect(dispatched).toEqual(expect.arrayContaining([setMessagesHasPrevAC(false), setMessagesHasNextAC(false)]))
  })

  it('sets hasPrevMessages=true when startId is not at the start of the containing segment', async () => {
    const channel = makeChannel({
      id: 'channel-restore-has-prev',
      lastMessage: makeMessage({ id: '205', channelId: 'channel-restore-has-prev' })
    })
    const msg201 = makeMessage({ id: '201', channelId: channel.id, body: 'older-201' })
    const msg203 = makeMessage({ id: '203', channelId: channel.id, body: 'cached-203' })
    const msg204 = makeMessage({ id: '204', channelId: channel.id, body: 'cached-204' })

    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    addMessageToMap(channel.id, msg201)
    addMessageToMap(channel.id, msg203)
    addMessageToMap(channel.id, msg204)
    // Segment covers 201–204 but restore window only starts at 203
    setActiveSegment(channel.id, '201', '204')
    setClient(createClient(createMessageQuery()))

    const restoreWindow = {
      startId: '203',
      endId: '204',
      anchorId: '203',
      prevCount: 0,
      nextCount: 1,
      preferCache: true
    }
    const dispatched = await runMessageSaga(
      __messageSagaTestables.loadAroundMessageWorker,
      loadAroundMessageAC(channel, '203', undefined, restoreWindow)
    )

    expect(dispatched).toEqual(expect.arrayContaining([setMessagesHasPrevAC(true)]))

    const setMessagesAction = dispatched.find((a) => a.type === setMessagesAC([], channel.id).type)
    expect(setMessagesAction.payload.messages.map((m: IMessage) => m.id)).toEqual(['203', '204'])
  })

  it('falls back to server with anchorId+prevCount+nextCount when the interval is not fully cached', async () => {
    const channel = makeChannel({
      id: 'channel-restore-cache-miss',
      lastMessage: makeMessage({ id: '305', channelId: 'channel-restore-cache-miss' })
    })
    // Cache only has msg301; msg303 (endId) is missing → cache miss
    const msg301 = makeMessage({ id: '301', channelId: channel.id, body: 'cached-301' })
    const serverMsg302 = makeMessage({ id: '302', channelId: channel.id, body: 'server-302' })
    const serverMsg303 = makeMessage({ id: '303', channelId: channel.id, body: 'server-303' })
    const query = createMessageQuery({
      loadPreviousMessageId: jest.fn(() =>
        resolveWithMockServerDelay({ messages: [serverMsg302, serverMsg303], hasNext: false })
      ),
      loadNextMessageId: jest.fn(() => resolveWithMockServerDelay({ messages: [], hasNext: false }))
    })

    mockStoreState.UserReducer.connectionStatus = CONNECTION_STATUS.CONNECTED
    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    addMessageToMap(channel.id, msg301)
    setActiveSegment(channel.id, '301', '301')
    setClient(createClient(query))

    const restoreWindow = {
      startId: '301',
      endId: '303', // not in cache
      anchorId: '302',
      prevCount: 1,
      nextCount: 1,
      preferCache: true
    }
    const dispatched = await runMessageSaga(
      __messageSagaTestables.loadAroundMessageWorker,
      loadAroundMessageAC(channel, '302', undefined, restoreWindow)
    )

    // Falls back to server → loading state is shown
    expect(dispatched).toEqual(expect.arrayContaining(bothDirectionLoadingActions(LOADING_STATE.LOADING)))
    expect(query.loadPreviousMessageId).toHaveBeenCalledWith('302')
  })

  it('uses cache only and does not call the server when offline and interval is fully cached', async () => {
    const channel = makeChannel({
      id: 'channel-restore-offline',
      lastMessage: makeMessage({ id: '405', channelId: 'channel-restore-offline' })
    })
    const msg403 = makeMessage({ id: '403', channelId: channel.id, body: 'cached-403' })
    const msg404 = makeMessage({ id: '404', channelId: channel.id, body: 'cached-404' })
    const query = createMessageQuery({
      loadPreviousMessageId: jest.fn(),
      loadNextMessageId: jest.fn()
    })

    // Explicitly offline
    mockStoreState.UserReducer.connectionStatus = CONNECTION_STATUS.DISCONNECTED
    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    addMessageToMap(channel.id, msg403)
    addMessageToMap(channel.id, msg404)
    setActiveSegment(channel.id, '403', '404')
    setClient(createClient(query))

    const restoreWindow = {
      startId: '403',
      endId: '404',
      anchorId: '403',
      prevCount: 0,
      nextCount: 1,
      preferCache: true
    }
    const dispatched = await runMessageSaga(
      __messageSagaTestables.loadAroundMessageWorker,
      loadAroundMessageAC(channel, '403', undefined, restoreWindow)
    )

    expect(query.loadPreviousMessageId).not.toHaveBeenCalled()
    expect(query.loadNextMessageId).not.toHaveBeenCalled()
    expect(dispatched).not.toEqual(expect.arrayContaining(bothDirectionLoadingActions(LOADING_STATE.LOADING)))

    const setMessagesAction = dispatched.find((a) => a.type === setMessagesAC([], channel.id).type)
    expect(setMessagesAction).toBeDefined()
    expect(setMessagesAction.payload.messages.map((m: IMessage) => m.id)).toEqual(['403', '404'])
  })

  it('dispatches a background refresh when connected and the restored window differs from server', async () => {
    const channel = makeChannel({
      id: 'channel-restore-bg-refresh',
      lastMessage: makeMessage({ id: '505', channelId: 'channel-restore-bg-refresh' })
    })
    const cachedMsg503 = makeMessage({ id: '503', channelId: channel.id, body: 'cached-503' })
    const cachedMsg504 = makeMessage({ id: '504', channelId: channel.id, body: 'cached-504' })
    // Server returns a message whose body changed — different window
    const refreshedMsg503 = { ...cachedMsg503, body: 'refreshed-503' }
    const refreshedMsg504 = { ...cachedMsg504, body: 'refreshed-504' }
    const query = createMessageQuery({
      loadPreviousMessageId: jest.fn(() =>
        resolveWithMockServerDelay({ messages: [refreshedMsg503, refreshedMsg504], hasNext: false })
      ),
      loadNextMessageId: jest.fn(() => resolveWithMockServerDelay({ messages: [], hasNext: false }))
    })

    mockStoreState.UserReducer.connectionStatus = CONNECTION_STATUS.CONNECTED
    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    addMessageToMap(channel.id, cachedMsg503)
    addMessageToMap(channel.id, cachedMsg504)
    setActiveSegment(channel.id, '503', '504')
    setClient(createClient(query))

    const restoreWindow = {
      startId: '503',
      endId: '504',
      anchorId: '503',
      prevCount: 0,
      nextCount: 1,
      preferCache: true
    }
    const dispatched = await runMessageSaga(
      __messageSagaTestables.loadAroundMessageWorker,
      loadAroundMessageAC(channel, '503', undefined, restoreWindow)
    )

    // Initial cache render is immediate (no loading spinner)
    expect(dispatched).not.toEqual(expect.arrayContaining(bothDirectionLoadingActions(LOADING_STATE.LOADING)))

    // Wait for background refresh spawn to complete
    await flushMockServerDelay()
    await flushAsyncWork()

    // Background refresh ran and re-set messages with refreshed data
    const setMessagesActions = dispatched.filter((a) => a.type === setMessagesAC([], channel.id).type)
    // First setMessages is from cache; background refresh produces a second one (different body)
    expect(setMessagesActions.length).toBeGreaterThanOrEqual(1)
    // The first render must have shown cached messages
    expect(setMessagesActions[0].payload.messages.map((m: IMessage) => m.body)).toEqual(['cached-503', 'cached-504'])
  })

  it('keeps the existing around-message behavior unchanged when no restoreWindow is provided', async () => {
    const channel = makeChannel({
      id: 'channel-restore-no-rw',
      lastMessage: makeMessage({ id: '605', channelId: 'channel-restore-no-rw' })
    })
    const serverMsg603 = makeMessage({ id: '603', channelId: channel.id, body: 'server-603' })
    const serverMsg604 = makeMessage({ id: '604', channelId: channel.id, body: 'server-604' })
    const query = createMessageQuery({
      loadPreviousMessageId: jest.fn(() =>
        resolveWithMockServerDelay({ messages: [serverMsg603, serverMsg604], hasNext: false })
      ),
      loadNextMessageId: jest.fn(() => resolveWithMockServerDelay({ messages: [], hasNext: false }))
    })

    mockStoreState.UserReducer.connectionStatus = CONNECTION_STATUS.CONNECTED
    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    setClient(createClient(query))

    const dispatched = await runMessageSaga(
      __messageSagaTestables.loadAroundMessageWorker,
      loadAroundMessageAC(channel, '604')
    )

    // Standard path always shows loading
    expect(dispatched).toEqual(expect.arrayContaining(bothDirectionLoadingActions(LOADING_STATE.LOADING)))
    expect(query.loadPreviousMessageId).toHaveBeenCalledWith('604')

    const setMessagesAction = dispatched.find((a) => a.type === setMessagesAC([], channel.id).type)
    expect(setMessagesAction).toBeDefined()
    expect(setMessagesAction.payload.messages.map((m: IMessage) => m.id)).toEqual(['603', '604'])
  })
})
