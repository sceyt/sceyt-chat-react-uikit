import { runSaga } from 'redux-saga'
import {
  destroyChannelsMap,
  getChannelFromMap,
  getPendingChannelRead,
  getPendingChannelReads,
  removePendingChannelRead,
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

describe('channel saga READ_MESSAGE resendable mechanism', () => {
  const clearPendingChannelReads = () => {
    getPendingChannelReads().forEach((pendingRead) => removePendingChannelRead(pendingRead.channelId))
  }
  let nowSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    mockStore.getState.mockReturnValue(mockStoreState)
    destroyChannelsMap()
    clearPendingChannelReads()
    mockStoreState.UserReducer.connectionStatus = CONNECTION_STATUS.CONNECTED
    __channelSagaTestables.setWaitForReadMarkerRetry(() => Promise.resolve())
    // deterministic, strictly increasing queuedAt for pending reads
    let now = 1750000000000
    nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => ++now)
  })

  afterEach(() => {
    nowSpy.mockRestore()
    __channelSagaTestables.resetWaitForReadMarkerRetry()
    clearPendingChannelReads()
    destroyChannelsMap()
  })

  it('drops the read without retrying when the SDK fails with a non-resendable error', async () => {
    const markMessagesAsDisplayed = jest.fn().mockRejectedValue({ type: 'BadRequest', message: 'invalid ids' })
    const channel = makeChannel({
      id: 'channel-read-drop',
      lastMessage: makeMessage({ id: '702', channelId: 'channel-read-drop', incoming: true }),
      lastDisplayedMessageId: '700',
      unread: true,
      newMessageCount: 2,
      markMessagesAsDisplayed
    })
    setChannelInMap(channel)

    const dispatched = await runChannelSaga(
      __channelSagaTestables.markMessagesRead,
      markMessagesAsReadAC(channel.id, ['701', '702'])
    )

    expect(markMessagesAsDisplayed).toHaveBeenCalledTimes(1)
    expect(getPendingChannelRead(channel.id)).toBeUndefined()
    expect(dispatched.filter((action) => action.type === updateMessageAC('701', {}).type)).toHaveLength(0)
  })

  it('queues the read without calling the SDK when offline at dispatch time', async () => {
    mockStoreState.UserReducer.connectionStatus = CONNECTION_STATUS.DISCONNECTED
    const markMessagesAsDisplayed = jest.fn()
    const channel = makeChannel({
      id: 'channel-read-offline',
      lastMessage: makeMessage({ id: '712', channelId: 'channel-read-offline', incoming: true }),
      lastDisplayedMessageId: '710',
      unread: true,
      newMessageCount: 2,
      markMessagesAsDisplayed
    })
    setChannelInMap(channel)

    const dispatched = await runChannelSaga(
      __channelSagaTestables.markMessagesRead,
      markMessagesAsReadAC(channel.id, ['711', '712'])
    )

    expect(markMessagesAsDisplayed).not.toHaveBeenCalled()
    expect(getPendingChannelRead(channel.id)).toEqual(
      expect.objectContaining({ channelId: channel.id, messageIds: ['711', '712'], readAll: false })
    )
    // the optimistic channel update is still applied so the UI clears immediately
    expect(dispatched).toContainEqual(
      updateChannelDataAC(channel.id, expect.objectContaining({ lastDisplayedMessageId: '712' }))
    )
  })

  it('stops retrying and keeps the read queued when the connection drops between retries', async () => {
    const markMessagesAsDisplayed = jest.fn().mockRejectedValue({ type: 'InternalError', message: 'timeout' })
    const channel = makeChannel({
      id: 'channel-read-drop-midway',
      lastMessage: makeMessage({ id: '722', channelId: 'channel-read-drop-midway', incoming: true }),
      lastDisplayedMessageId: '720',
      unread: true,
      newMessageCount: 2,
      markMessagesAsDisplayed
    })
    setChannelInMap(channel)
    __channelSagaTestables.setWaitForReadMarkerRetry(() => {
      mockStoreState.UserReducer.connectionStatus = CONNECTION_STATUS.DISCONNECTED
      return Promise.resolve()
    })

    await runChannelSaga(__channelSagaTestables.markMessagesRead, markMessagesAsReadAC(channel.id, ['721', '722']))

    expect(markMessagesAsDisplayed).toHaveBeenCalledTimes(1)
    expect(getPendingChannelRead(channel.id)).toEqual(
      expect.objectContaining({ channelId: channel.id, messageIds: ['721', '722'], readAll: false })
    )
  })

  it('preserves a pending read merged while the confirmation was in flight', async () => {
    const channelId = 'channel-read-merge-in-flight'
    const markMessagesAsDisplayed = jest.fn(async (ids: string[]) => {
      // another view marks message 733 as read while this request is in flight
      setPendingChannelRead({ channelId, messageIds: ['733'] })
      return {
        messageIds: ids,
        user: makeUser({ id: 'current-user' }),
        createdAt: new Date('2026-07-16T10:00:00.000Z')
      }
    })
    const channel = makeChannel({
      id: channelId,
      lastMessage: makeMessage({ id: '733', channelId, incoming: true }),
      lastDisplayedMessageId: '730',
      unread: true,
      newMessageCount: 3,
      markMessagesAsDisplayed
    })
    setChannelInMap(channel)

    await runChannelSaga(__channelSagaTestables.markMessagesRead, markMessagesAsReadAC(channel.id, ['731', '732']))

    // the newer merged queue entry must survive the older confirmation
    expect(getPendingChannelRead(channelId)).toEqual(
      expect.objectContaining({ channelId, messageIds: ['731', '732', '733'], readAll: false })
    )
  })

  it('deduplicates message ids before calling the SDK', async () => {
    const markMessagesAsDisplayed = jest.fn(async (ids: string[]) => ({
      messageIds: ids,
      user: makeUser({ id: 'current-user' }),
      createdAt: new Date('2026-07-16T10:05:00.000Z')
    }))
    const channel = makeChannel({
      id: 'channel-read-dedup',
      lastMessage: makeMessage({ id: '742', channelId: 'channel-read-dedup', incoming: true }),
      lastDisplayedMessageId: '740',
      unread: true,
      newMessageCount: 2,
      markMessagesAsDisplayed
    })
    setChannelInMap(channel)

    await runChannelSaga(
      __channelSagaTestables.markMessagesRead,
      markMessagesAsReadAC(channel.id, ['741', '741', '', '742'])
    )

    expect(markMessagesAsDisplayed).toHaveBeenCalledWith(['741', '742'])
  })

  it('does nothing when the requested message id list is empty', async () => {
    const markMessagesAsDisplayed = jest.fn()
    const channel = makeChannel({
      id: 'channel-read-empty',
      lastDisplayedMessageId: '750',
      markMessagesAsDisplayed
    })
    setChannelInMap(channel)

    const dispatched = await runChannelSaga(
      __channelSagaTestables.markMessagesRead,
      markMessagesAsReadAC(channel.id, ['', ''])
    )

    expect(markMessagesAsDisplayed).not.toHaveBeenCalled()
    expect(getPendingChannelRead(channel.id)).toBeUndefined()
    expect(dispatched).toHaveLength(0)
  })

  it('replays a queued read-all via markAsRead and clears it without per-message updates', async () => {
    const channel = makeChannel({
      id: 'channel-resend-read-all',
      lastMessage: makeMessage({ id: '762', channelId: 'channel-resend-read-all', incoming: true }),
      lastDisplayedMessageId: '760'
    })
    ;(channel as any).markAsRead = jest.fn(async () => ({ ...channel, lastDisplayedMessageId: '762' }))
    setChannelInMap(channel)
    setPendingChannelRead({ channelId: channel.id, readAll: true })

    const dispatched = await runChannelSaga(
      __channelSagaTestables.resendPendingChannelReads,
      resendPendingChannelReadsAC(CONNECTION_STATUS.CONNECTED)
    )

    expect((channel as any).markAsRead).toHaveBeenCalledTimes(1)
    expect(getPendingChannelRead(channel.id)).toBeUndefined()
    expect(dispatched.filter((action) => action.type === updateMessageAC('762', {}).type)).toHaveLength(0)
  })

  it('removes pending reads for channels that no longer exist instead of replaying them forever', async () => {
    setPendingChannelRead({ channelId: 'channel-resend-missing', messageIds: ['771'] })

    await runChannelSaga(
      __channelSagaTestables.resendPendingChannelReads,
      resendPendingChannelReadsAC(CONNECTION_STATUS.CONNECTED)
    )

    expect(getPendingChannelRead('channel-resend-missing')).toBeUndefined()
  })

  it('removes the pending read when the replay fails with a non-resendable error', async () => {
    const markMessagesAsDisplayed = jest.fn().mockRejectedValue({ type: 'NotAllowed', message: 'kicked' })
    const channel = makeChannel({
      id: 'channel-resend-drop',
      lastMessage: makeMessage({ id: '782', channelId: 'channel-resend-drop', incoming: true }),
      lastDisplayedMessageId: '780',
      markMessagesAsDisplayed
    })
    setChannelInMap(channel)
    setPendingChannelRead({ channelId: channel.id, messageIds: ['781', '782'] })

    await runChannelSaga(
      __channelSagaTestables.resendPendingChannelReads,
      resendPendingChannelReadsAC(CONNECTION_STATUS.CONNECTED)
    )

    expect(markMessagesAsDisplayed).toHaveBeenCalledTimes(1)
    expect(getPendingChannelRead(channel.id)).toBeUndefined()
  })

  it('keeps the pending read queued when the replay keeps failing with resendable errors', async () => {
    const markMessagesAsDisplayed = jest.fn().mockRejectedValue({ type: 'TooManyRequests', message: 'rate limited' })
    const channel = makeChannel({
      id: 'channel-resend-still-failing',
      lastMessage: makeMessage({ id: '792', channelId: 'channel-resend-still-failing', incoming: true }),
      lastDisplayedMessageId: '790',
      markMessagesAsDisplayed
    })
    setChannelInMap(channel)
    setPendingChannelRead({ channelId: channel.id, messageIds: ['791', '792'] })

    await runChannelSaga(
      __channelSagaTestables.resendPendingChannelReads,
      resendPendingChannelReadsAC(CONNECTION_STATUS.CONNECTED)
    )

    // initial attempt + the in-call retry schedule, then stays queued for the next reconnect
    expect(markMessagesAsDisplayed).toHaveBeenCalledTimes(3)
    expect(getPendingChannelRead(channel.id)).toEqual(
      expect.objectContaining({ channelId: channel.id, messageIds: ['791', '792'], readAll: false })
    )
  })

  it('stops the replay loop when the connection drops mid-way, leaving later reads queued', async () => {
    const firstChannel = makeChannel({
      id: 'channel-resend-loop-first',
      lastMessage: makeMessage({ id: '802', channelId: 'channel-resend-loop-first', incoming: true }),
      lastDisplayedMessageId: '800',
      markMessagesAsDisplayed: jest.fn(async (ids: string[]) => {
        mockStoreState.UserReducer.connectionStatus = CONNECTION_STATUS.DISCONNECTED
        return {
          messageIds: ids,
          user: makeUser({ id: 'current-user' }),
          createdAt: new Date('2026-07-16T10:10:00.000Z')
        }
      })
    })
    const secondChannel = makeChannel({
      id: 'channel-resend-loop-second',
      lastMessage: makeMessage({ id: '812', channelId: 'channel-resend-loop-second', incoming: true }),
      lastDisplayedMessageId: '810',
      markMessagesAsDisplayed: jest.fn()
    })
    setChannelInMap(firstChannel)
    setChannelInMap(secondChannel)
    setPendingChannelRead({ channelId: firstChannel.id, messageIds: ['801', '802'] })
    setPendingChannelRead({ channelId: secondChannel.id, messageIds: ['811', '812'] })

    await runChannelSaga(
      __channelSagaTestables.resendPendingChannelReads,
      resendPendingChannelReadsAC(CONNECTION_STATUS.CONNECTED)
    )

    expect(firstChannel.markMessagesAsDisplayed).toHaveBeenCalledTimes(1)
    expect(getPendingChannelRead(firstChannel.id)).toBeUndefined()
    expect(secondChannel.markMessagesAsDisplayed).not.toHaveBeenCalled()
    expect(getPendingChannelRead(secondChannel.id)).toEqual(
      expect.objectContaining({ channelId: secondChannel.id, messageIds: ['811', '812'] })
    )
  })

  it('ignores replay requests for non-connected connection states', async () => {
    const markMessagesAsDisplayed = jest.fn()
    const channel = makeChannel({
      id: 'channel-resend-not-connected',
      lastDisplayedMessageId: '820',
      markMessagesAsDisplayed
    })
    setChannelInMap(channel)
    setPendingChannelRead({ channelId: channel.id, messageIds: ['821'] })

    await runChannelSaga(
      __channelSagaTestables.resendPendingChannelReads,
      resendPendingChannelReadsAC(CONNECTION_STATUS.DISCONNECTED)
    )

    expect(markMessagesAsDisplayed).not.toHaveBeenCalled()
    expect(getPendingChannelRead(channel.id)).toEqual(
      expect.objectContaining({ channelId: channel.id, messageIds: ['821'] })
    )
  })

  it('treats a typeless network timeout as resendable and replays it after reconnect', async () => {
    // real network timeouts reject with a plain Error that carries no SDK type
    const markMessagesAsDisplayed = jest.fn().mockRejectedValue(new Error('Request timed out'))
    const channel = makeChannel({
      id: 'channel-read-typeless-timeout',
      lastMessage: makeMessage({ id: '832', channelId: 'channel-read-typeless-timeout', incoming: true }),
      lastDisplayedMessageId: '830',
      unread: true,
      newMessageCount: 2,
      markMessagesAsDisplayed
    })
    setChannelInMap(channel)

    await runChannelSaga(__channelSagaTestables.markMessagesRead, markMessagesAsReadAC(channel.id, ['831', '832']))

    // initial attempt + full retry schedule, then queued instead of dropped
    expect(markMessagesAsDisplayed).toHaveBeenCalledTimes(3)
    expect(getPendingChannelRead(channel.id)).toEqual(
      expect.objectContaining({ channelId: channel.id, messageIds: ['831', '832'], readAll: false })
    )

    ;(getChannelFromMap(channel.id) as any).markMessagesAsDisplayed = jest.fn().mockResolvedValue({
      messageIds: ['831', '832'],
      user: makeUser({ id: 'current-user' }),
      createdAt: new Date('2026-07-16T11:00:00.000Z')
    })

    const replayDispatched = await runChannelSaga(
      __channelSagaTestables.resendPendingChannelReads,
      resendPendingChannelReadsAC(CONNECTION_STATUS.CONNECTED)
    )

    expect(getPendingChannelRead(channel.id)).toBeUndefined()
    expect(replayDispatched).toContainEqual(
      updateMessageAC('832', expect.objectContaining({ deliveryStatus: MESSAGE_DELIVERY_STATUS.READ }))
    )
  })

  it('keeps the read queued while the SDK call hangs and lets the reconnect replay confirm it', async () => {
    let resolveHangingCall!: (value: any) => void
    const hangingCall = new Promise<any>((resolve) => {
      resolveHangingCall = resolve
    })
    const markMessagesAsDisplayed = jest.fn(() => hangingCall)
    const channel = makeChannel({
      id: 'channel-read-hanging-call',
      lastMessage: makeMessage({ id: '842', channelId: 'channel-read-hanging-call', incoming: true }),
      lastDisplayedMessageId: '840',
      unread: true,
      newMessageCount: 2,
      markMessagesAsDisplayed
    })
    setChannelInMap(channel)

    const dispatched: any[] = []
    const hangingTask = runSaga(
      { dispatch: (action) => dispatched.push(action), getState: () => mockStoreState },
      __channelSagaTestables.markMessagesRead,
      markMessagesAsReadAC(channel.id, ['841', '842'])
    )
    await new Promise((resolve) => setTimeout(resolve, 0))

    // the request never responds: the read stays queued for a later replay
    expect(markMessagesAsDisplayed).toHaveBeenCalledTimes(1)
    expect(getPendingChannelRead(channel.id)).toEqual(
      expect.objectContaining({ channelId: channel.id, messageIds: ['841', '842'], readAll: false })
    )

    ;(getChannelFromMap(channel.id) as any).markMessagesAsDisplayed = jest.fn().mockResolvedValue({
      messageIds: ['841', '842'],
      user: makeUser({ id: 'current-user' }),
      createdAt: new Date('2026-07-16T11:05:00.000Z')
    })

    const replayDispatched = await runChannelSaga(
      __channelSagaTestables.resendPendingChannelReads,
      resendPendingChannelReadsAC(CONNECTION_STATUS.CONNECTED)
    )

    expect(getPendingChannelRead(channel.id)).toBeUndefined()
    expect(replayDispatched).toContainEqual(
      updateMessageAC('842', expect.objectContaining({ deliveryStatus: MESSAGE_DELIVERY_STATUS.READ }))
    )

    // the hung response finally arrives — the saga must finish cleanly without
    // resurrecting the already-confirmed queue entry
    resolveHangingCall({
      messageIds: ['841', '842'],
      user: makeUser({ id: 'current-user' }),
      createdAt: new Date('2026-07-16T11:06:00.000Z')
    })
    await hangingTask.toPromise()

    expect(getPendingChannelRead(channel.id)).toBeUndefined()
  })

  it('keeps a read merged while the confirmation hung when that confirmation is finally rejected as non-resendable', async () => {
    let rejectHangingCall!: (reason: any) => void
    const hangingCall = new Promise<any>((_resolve, reject) => {
      rejectHangingCall = reject
    })
    const markMessagesAsDisplayed = jest.fn(() => hangingCall)
    const channel = makeChannel({
      id: 'channel-read-hang-then-drop',
      lastMessage: makeMessage({ id: '853', channelId: 'channel-read-hang-then-drop', incoming: true }),
      lastDisplayedMessageId: '850',
      unread: true,
      newMessageCount: 3,
      markMessagesAsDisplayed
    })
    setChannelInMap(channel)

    const hangingTask = runSaga(
      { dispatch: () => undefined, getState: () => mockStoreState },
      __channelSagaTestables.markMessagesRead,
      markMessagesAsReadAC(channel.id, ['851', '852'])
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(markMessagesAsDisplayed).toHaveBeenCalledTimes(1)

    // connection drops, then the user reads one more message: it merges into
    // the queued entry and waits for the next reconnect
    mockStoreState.UserReducer.connectionStatus = CONNECTION_STATUS.DISCONNECTED
    await runChannelSaga(__channelSagaTestables.markMessagesRead, markMessagesAsReadAC(channel.id, ['853']))
    expect(getPendingChannelRead(channel.id)).toEqual(
      expect.objectContaining({ channelId: channel.id, messageIds: ['851', '852', '853'], readAll: false })
    )

    // the hung confirmation is finally rejected as non-resendable — it must
    // only drop its own queue entry, not the newer merged one
    rejectHangingCall({ type: 'BadRequest', message: 'stale request' })
    await hangingTask.toPromise()

    expect(getPendingChannelRead(channel.id)).toEqual(
      expect.objectContaining({ channelId: channel.id, messageIds: ['851', '852', '853'], readAll: false })
    )
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
