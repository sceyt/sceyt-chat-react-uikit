import { runSaga } from 'redux-saga'
import {
  destroyChannelsMap,
  getChannelFromMap,
  getPendingChannelRead,
  setChannelInMap,
  setPendingChannelRead
} from '../../helpers/channelHalper'
import { addMessageToMap } from '../../helpers/messagesHalper'
import { MESSAGE_DELIVERY_STATUS } from '../../helpers/constants'
import { makeChannel, makeMessage, makePendingMessage, makeUser } from '../../testUtils/messageFixtures'
import { updateMessageAC } from '../message/actions'
import { CONNECTION_STATUS } from '../user/constants'
import {
  markChannelAsReadAC,
  markMessagesAsReadAC,
  resendPendingChannelReadsAC,
  setChannelsAC,
  updateChannelDataAC
} from './actions'
import { __channelSagaTestables } from './saga'
import { setClient } from '../../common/client'

const mockStoreState: any = {
  UserReducer: {
    connectionStatus: CONNECTION_STATUS.CONNECTED
  },
  ChannelReducer: {
    channels: [],
    channelsLoadingState: null,
    activeChannel: {}
  }
}

const mockStore = {
  getState: jest.fn(() => mockStoreState)
}

jest.mock('store', () => ({
  __esModule: true,
  get default() {
    return mockStore
  }
}))

jest.mock('../evetns/inedx', () => ({
  __esModule: true,
  default: jest.fn()
}))

const runChannelSaga = async (saga: (...args: any[]) => Generator, ...args: any[]) => {
  const dispatched: any[] = []
  await runSaga(
    {
      dispatch: (action) => dispatched.push(action),
      getState: () => mockStoreState
    },
    saga,
    ...args
  ).toPromise()
  return dispatched
}

describe('channel saga read markers', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockStore.getState.mockReturnValue(mockStoreState)
    destroyChannelsMap()
    mockStoreState.UserReducer.connectionStatus = CONNECTION_STATUS.CONNECTED
    __channelSagaTestables.setWaitForReadMarkerRetry(() => Promise.resolve())
  })

  afterEach(() => {
    __channelSagaTestables.resetWaitForReadMarkerRetry()
  })

  it('advances lastDisplayedMessageId when displayed messages are read', async () => {
    const channel = makeChannel({
      id: 'channel-read-boundary',
      lastMessage: makeMessage({ id: '104', channelId: 'channel-read-boundary', incoming: true }),
      lastDisplayedMessageId: '100',
      unread: true,
      newMessageCount: 4,
      markMessagesAsDisplayed: jest.fn(async () => ({
        messageIds: ['101', '103'],
        user: makeUser({ id: 'current-user' }),
        createdAt: new Date('2026-04-01T12:00:00.000Z')
      }))
    })
    setChannelInMap(channel)

    const dispatched = await runChannelSaga(
      __channelSagaTestables.markMessagesRead,
      markMessagesAsReadAC(channel.id, ['101', '103'])
    )

    expect(channel.markMessagesAsDisplayed).toHaveBeenCalledWith(['101', '103'])
    expect(dispatched).toContainEqual(
      updateChannelDataAC(channel.id, {
        lastDisplayedMessageId: '103',
        newMessageCount: 2
      })
    )
    expect(dispatched).toContainEqual(
      updateMessageAC(
        '103',
        expect.objectContaining({
          deliveryStatus: MESSAGE_DELIVERY_STATUS.READ
        })
      )
    )
    expect(getChannelFromMap(channel.id).lastDisplayedMessageId).toBe('103')
    expect(getChannelFromMap(channel.id).newMessageCount).toBe(2)
    expect(getChannelFromMap(channel.id).unread).toBe(true)
  })

  it('clears unread badge fields when displayed reads reach the latest unread boundary', async () => {
    const channel = makeChannel({
      id: 'channel-read-boundary-clears',
      lastMessage: makeMessage({ id: '103', channelId: 'channel-read-boundary-clears', incoming: true }),
      lastDisplayedMessageId: '100',
      unread: true,
      newMessageCount: 3,
      newMentionCount: 2,
      markMessagesAsDisplayed: jest.fn(async () => ({
        messageIds: ['101', '102', '103'],
        user: makeUser({ id: 'current-user' }),
        createdAt: new Date('2026-04-01T12:05:00.000Z')
      }))
    })
    setChannelInMap(channel)

    const dispatched = await runChannelSaga(
      __channelSagaTestables.markMessagesRead,
      markMessagesAsReadAC(channel.id, ['101', '102', '103'])
    )

    expect(dispatched).toContainEqual(
      updateChannelDataAC(channel.id, {
        lastDisplayedMessageId: '103',
        unread: false,
        newMessageCount: 0,
        newMentionCount: 0
      })
    )
    expect(getChannelFromMap(channel.id).lastDisplayedMessageId).toBe('103')
    expect(getChannelFromMap(channel.id).newMessageCount).toBe(0)
    expect(getChannelFromMap(channel.id).newMentionCount).toBe(0)
    expect(getChannelFromMap(channel.id).unread).toBe(false)
  })

  it('applies the optimistic unread badge clear before markMessagesAsDisplayed resolves', async () => {
    const channel = makeChannel({
      id: 'channel-read-optimistic-clear',
      lastMessage: makeMessage({ id: '303', channelId: 'channel-read-optimistic-clear', incoming: true }),
      lastDisplayedMessageId: '300',
      unread: true,
      newMessageCount: 3,
      newMentionCount: 1,
      markMessagesAsDisplayed: jest.fn(async () => {
        expect(getChannelFromMap('channel-read-optimistic-clear')).toEqual(
          expect.objectContaining({
            unread: false,
            newMessageCount: 0,
            newMentionCount: 0,
            lastDisplayedMessageId: '303'
          })
        )

        return {
          messageIds: ['301', '302', '303'],
          user: makeUser({ id: 'current-user' }),
          createdAt: new Date('2026-07-02T08:00:00.000Z')
        }
      })
    })
    setChannelInMap(channel)

    const dispatched = await runChannelSaga(
      __channelSagaTestables.markMessagesRead,
      markMessagesAsReadAC(channel.id, ['301', '302', '303'])
    )

    expect(dispatched).toContainEqual(
      updateChannelDataAC(channel.id, {
        unread: false,
        newMessageCount: 0,
        newMentionCount: 0,
        lastDisplayedMessageId: '303'
      })
    )
    expect(getPendingChannelRead(channel.id)).toBeUndefined()
  })

  it('retries resendable displayed-read timeouts without a second controller dispatch', async () => {
    const markMessagesAsDisplayed = jest
      .fn()
      .mockRejectedValueOnce({ type: 'InternalError', message: 'first timeout' })
      .mockRejectedValueOnce({ type: 'InternalError', message: 'second timeout' })
      .mockResolvedValue({
        messageIds: ['401', '402'],
        user: makeUser({ id: 'current-user' }),
        createdAt: new Date('2026-07-02T09:00:00.000Z')
      })
    const channel = makeChannel({
      id: 'channel-read-retry',
      lastMessage: makeMessage({ id: '402', channelId: 'channel-read-retry', incoming: true }),
      lastDisplayedMessageId: '400',
      unread: true,
      newMessageCount: 2,
      markMessagesAsDisplayed
    })
    setChannelInMap(channel)

    const dispatched = await runChannelSaga(
      __channelSagaTestables.markMessagesRead,
      markMessagesAsReadAC(channel.id, ['401', '402'])
    )

    expect(markMessagesAsDisplayed).toHaveBeenCalledTimes(3)
    expect(
      dispatched.filter((action) => action.type === updateChannelDataAC(channel.id, { lastDisplayedMessageId: '402' }).type)
    ).toHaveLength(1)
    expect(getPendingChannelRead(channel.id)).toBeUndefined()
  })

  it('keeps exhausted resendable displayed reads queued and replays them after reconnect', async () => {
    const channel = makeChannel({
      id: 'channel-read-replay',
      lastMessage: makeMessage({ id: '502', channelId: 'channel-read-replay', incoming: true }),
      lastDisplayedMessageId: '500',
      unread: true,
      newMessageCount: 2,
      markMessagesAsDisplayed: jest.fn().mockRejectedValue({ type: 'InternalError', message: 'timeout' })
    })
    setChannelInMap(channel)

    await runChannelSaga(__channelSagaTestables.markMessagesRead, markMessagesAsReadAC(channel.id, ['501', '502']))

    expect(channel.markMessagesAsDisplayed).toHaveBeenCalledTimes(3)
    expect(getPendingChannelRead(channel.id)).toEqual(
      expect.objectContaining({ channelId: channel.id, messageIds: ['501', '502'], readAll: false })
    )

    ;(getChannelFromMap(channel.id) as any).markMessagesAsDisplayed = jest.fn().mockResolvedValue({
      messageIds: ['501', '502'],
      user: makeUser({ id: 'current-user' }),
      createdAt: new Date('2026-07-02T09:05:00.000Z')
    })

    const replayDispatched = await runChannelSaga(
      __channelSagaTestables.resendPendingChannelReads,
      resendPendingChannelReadsAC(CONNECTION_STATUS.CONNECTED)
    )

    expect((getChannelFromMap(channel.id) as any).markMessagesAsDisplayed).toHaveBeenCalledTimes(1)
    expect(getPendingChannelRead(channel.id)).toBeUndefined()
    expect(replayDispatched).toContainEqual(
      updateMessageAC(
        '502',
        expect.objectContaining({
          deliveryStatus: MESSAGE_DELIVERY_STATUS.READ
        })
      )
    )
  })

  it('uses the latest unread boundary when markChannelAsRead returns a stale displayed id', async () => {
    const channel = makeChannel({
      id: 'channel-read-all-boundary',
      lastMessage: makeMessage({ id: '205', channelId: 'channel-read-all-boundary', incoming: true }),
      lastDisplayedMessageId: '200',
      unread: true,
      newMessageCount: 5,
      newMentionCount: 2
    })
    ;(channel as any).markAsRead = jest.fn(async () => ({ ...channel, lastDisplayedMessageId: '200' }))
    setChannelInMap(channel)

    const dispatched = await runChannelSaga(__channelSagaTestables.markChannelAsRead, markChannelAsReadAC(channel.id))

    expect((channel as any).markAsRead).toHaveBeenCalled()
    expect(dispatched).toContainEqual(
      updateChannelDataAC(channel.id, {
        unread: false,
        newMessageCount: 0,
        newMentionCount: 0,
        lastDisplayedMessageId: '205'
      })
    )
    expect(getChannelFromMap(channel.id).lastDisplayedMessageId).toBe('205')
  })

  it('upgrades queued per-message reads to a read-all retry when markChannelAsRead runs', async () => {
    const channel = makeChannel({
      id: 'channel-read-all-upgrade',
      lastMessage: makeMessage({ id: '605', channelId: 'channel-read-all-upgrade', incoming: true }),
      lastDisplayedMessageId: '600',
      unread: true,
      newMessageCount: 5,
      newMentionCount: 2
    })
    ;(channel as any).markAsRead = jest.fn(async () => {
      expect(getPendingChannelRead(channel.id)).toEqual(
        expect.objectContaining({
          channelId: channel.id,
          readAll: true,
          messageIds: []
        })
      )
      return { ...channel, lastDisplayedMessageId: '605' }
    })
    setChannelInMap(channel)
    setPendingChannelRead({ channelId: channel.id, messageIds: ['601', '602'] })

    await runChannelSaga(__channelSagaTestables.markChannelAsRead, markChannelAsReadAC(channel.id))

    expect((channel as any).markAsRead).toHaveBeenCalledTimes(1)
    expect(getPendingChannelRead(channel.id)).toBeUndefined()
  })

  it('falls back to the latest cached incoming message when the read-all response does not advance the boundary', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const remoteUser = makeUser({ id: 'remote-user' })
    const channel = makeChannel({
      id: 'channel-read-all-cache-fallback',
      lastMessage: makeMessage({
        id: '206',
        channelId: 'channel-read-all-cache-fallback',
        body: 'own-latest',
        incoming: false,
        user: currentUser
      }),
      lastReceivedMsgId: '',
      lastDisplayedMessageId: '200',
      unread: true,
      newMessageCount: 1,
      newMentionCount: 1
    })
    const latestIncoming = makeMessage({
      id: '205',
      channelId: channel.id,
      body: 'remote-latest',
      incoming: true,
      user: remoteUser
    })
    channel.lastReceivedMsgId = ''
    ;(channel as any).markAsRead = jest.fn(async () => ({ ...channel, lastDisplayedMessageId: '200' }))
    setChannelInMap(channel)
    addMessageToMap(channel.id, latestIncoming)
    addMessageToMap(channel.id, channel.lastMessage)

    const dispatched = await runChannelSaga(__channelSagaTestables.markChannelAsRead, markChannelAsReadAC(channel.id))

    expect(dispatched).toContainEqual(
      updateChannelDataAC(channel.id, {
        unread: false,
        newMessageCount: 0,
        newMentionCount: 0,
        lastDisplayedMessageId: '205'
      })
    )
    expect(getChannelFromMap(channel.id).lastDisplayedMessageId).toBe('205')
  })
})

describe('channel saga getChannels pending-message preservation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockStore.getState.mockReturnValue(mockStoreState)
    destroyChannelsMap()
    mockStoreState.UserReducer.connectionStatus = CONNECTION_STATUS.CONNECTED
    mockStoreState.ChannelReducer = {
      channels: [],
      channelsLoadingState: null,
      activeChannel: {},
      hideChannelList: true
    }
  })

  afterEach(() => {
    destroyChannelsMap()
  })

  it('preserves the confirmed lastMessage when sendPendingMessages confirms before setChannelsAC dispatches', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channelId = 'channel-race-condition'
    const pendingMsg = makePendingMessage({
      channelId,
      tid: 'race-tid',
      body: 'offline-body',
      metadata: '{}',
      createdAt: new Date('2026-06-01T10:00:00.000Z'),
      user: currentUser
    })
    const confirmedMsg = makeMessage({
      id: '999',
      tid: pendingMsg.tid,
      channelId,
      body: 'offline-body',
      metadata: {} as any,
      user: currentUser
    })

    const channel = makeChannel({ id: channelId, lastMessage: pendingMsg as any })

    // Simulate: sendPendingMessages already confirmed the message and updated Redux
    mockStoreState.ChannelReducer.channels = [{ ...channel, lastMessage: confirmedMsg }]

    // channelsMap still has the pending version (as it was before confirmation)
    setChannelInMap({ ...channel, lastMessage: pendingMsg as any })

    // Mock the SDK client: ChannelListQueryBuilder returns this channel from server
    // (server returns old lastMessage — it may be slightly behind)
    const serverChannel = makeChannel({ id: channelId, lastMessage: confirmedMsg })
    const channelQuery = {
      loadNextPage: jest.fn(async () => ({ channels: [serverChannel], hasNext: false }))
    }
    const channelQueryBuilder: any = {
      types: jest.fn().mockReturnThis(),
      memberCount: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      build: jest.fn(async () => channelQuery)
    }
    setClient({
      user: { id: 'current-user' },
      ChannelListQueryBuilder: jest.fn(() => channelQueryBuilder)
    } as any)

    const dispatched: any[] = []
    await runSaga(
      { dispatch: (action) => dispatched.push(action), getState: () => mockStoreState },
      __channelSagaTestables.getChannels,
      { type: 'GET_CHANNELS', payload: { params: { limit: 20 } } }
    ).toPromise()

    const setChannelsAction = dispatched.find((a) => a.type === setChannelsAC([]).type)
    expect(setChannelsAction).toBeDefined()

    const channelInAction = setChannelsAction?.payload?.channels?.find((ch: any) => ch.id === channelId)
    expect(channelInAction).toBeDefined()

    // The confirmed message must be preserved — must NOT revert to the pending version
    expect(channelInAction.lastMessage.id).toBe(confirmedMsg.id)
    expect(channelInAction.lastMessage.id).not.toBe('')

    // channelsMap also updated to confirmed
    expect(getChannelFromMap(channelId)?.lastMessage?.id).toBe(confirmedMsg.id)
  })
})
