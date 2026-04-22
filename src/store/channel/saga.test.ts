import { runSaga } from 'redux-saga'
import { destroyChannelsMap, getChannelFromMap, setChannelInMap } from '../../helpers/channelHalper'
import { MESSAGE_DELIVERY_STATUS } from '../../helpers/constants'
import { makeChannel, makeMessage, makeUser } from '../../testUtils/messageFixtures'
import { updateMessageAC } from '../message/actions'
import { CONNECTION_STATUS } from '../user/constants'
import { markChannelAsReadAC, markMessagesAsReadAC, updateChannelDataAC } from './actions'
import { __channelSagaTestables } from './saga'

const mockStoreState = {
  UserReducer: {
    connectionStatus: CONNECTION_STATUS.CONNECTED
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
  })

  it('advances lastDisplayedMessageId when displayed messages are read', async () => {
    const channel = makeChannel({
      id: 'channel-read-boundary',
      lastMessage: makeMessage({ id: '104', channelId: 'channel-read-boundary', incoming: true }),
      lastDisplayedMessageId: '100',
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
        lastReadMessageId: '103'
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
  })

  it('uses the channel last message as the displayed boundary when marking the channel read', async () => {
    const channel = makeChannel({
      id: 'channel-read-all-boundary',
      lastMessage: makeMessage({ id: '205', channelId: 'channel-read-all-boundary', incoming: true }),
      lastDisplayedMessageId: '200',
      unread: true,
      newMessageCount: 5,
      newMentionCount: 2
    })
    ;(channel as any).markAsRead = jest.fn(async () => channel)
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
})
