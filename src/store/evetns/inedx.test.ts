import { runSaga } from 'redux-saga'
import { setClient } from '../../common/client'
import {
  addChannelToAllChannels,
  destroyChannelsMap,
  getChannelFromAllChannels,
  getChannelFromMap,
  setActiveChannelId,
  setChannelInMap
} from '../../helpers/channelHalper'
import {
  addMessageToMap,
  clearMessagesMap,
  getActiveSegment,
  getContiguousNextMessages,
  setActiveSegment
} from '../../helpers/messagesHalper'
import {
  makeChannel,
  makeMessage,
  makePendingMessage,
  makeUser,
  resetMessageListFixtureIds
} from '../../testUtils/messageFixtures'
import { updateChannelDataAC, updateChannelLastMessageAC } from '../channel/actions'
import { __eventsTestables } from './inedx'

describe('event message last-message handling', () => {
  const mockStore = require('store') as {
    getState: () => any
    dispatch: jest.Mock
  }
  const defaultStoreState = {
    MessageReducer: {
      pendingPollActions: {},
      messagesHasNext: false
    }
  }

  const keepsNewestPendingTitle =
    'does not replace a newer pending channel last message when an older resend confirmation arrives as a channel message event'
  const keepsNewestPendingUnreadInfoTitle =
    'does not replace a newer pending channel last message when unread info arrives with an older confirmed last message'

  beforeEach(() => {
    resetMessageListFixtureIds()
    clearMessagesMap()
    destroyChannelsMap()
    setActiveChannelId('')
    setClient({
      user: { id: 'current-user' },
      Channel: { create: jest.fn() }
    })
    mockStore.getState = jest.fn(() => defaultStoreState)
    mockStore.dispatch.mockClear()
  })

  afterEach(() => {
    clearMessagesMap()
    destroyChannelsMap()
    setActiveChannelId('')
  })

  it(keepsNewestPendingTitle, async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channelId = 'channel-event-last-message'
    const newestPending = makePendingMessage({
      channelId,
      tid: 'pending-latest-tid',
      body: 'pending-latest',
      createdAt: new Date('2026-04-02T11:05:00.000Z'),
      user: currentUser
    })
    const olderConfirmed = makeMessage({
      id: '901',
      tid: 'pending-older-tid',
      channelId,
      body: 'confirmed-older',
      user: currentUser
    })
    const storedChannel = makeChannel({
      id: channelId,
      lastMessage: newestPending
    })
    const incomingChannel = {
      ...storedChannel,
      lastMessage: olderConfirmed,
      lastReceivedMsgId: olderConfirmed.id
    }

    setChannelInMap(storedChannel)
    addChannelToAllChannels(storedChannel)
    addMessageToMap(channelId, newestPending)

    const dispatched: any[] = []

    await runSaga(
      {
        dispatch: (action) => {
          dispatched.push(action)
        }
      },
      __eventsTestables.handleChannelMessageEvent,
      { channel: incomingChannel, message: olderConfirmed },
      { user: { id: 'current-user' } }
    ).toPromise()

    expect(getChannelFromMap(channelId)?.lastMessage).toEqual(expect.objectContaining({ tid: newestPending.tid }))
    expect(getChannelFromAllChannels(channelId)?.lastMessage).toEqual(
      expect.objectContaining({ tid: newestPending.tid })
    )
    expect(
      dispatched.some(
        (action) =>
          action.type === updateChannelLastMessageAC(olderConfirmed, incomingChannel as any).type &&
          action.payload.channel.id === channelId
      )
    ).toBe(false)
    expect(
      dispatched.some(
        (action) =>
          action.type === updateChannelDataAC(channelId, { lastMessage: olderConfirmed }).type &&
          action.payload.channelId === channelId &&
          action.payload.config?.lastMessage?.id === olderConfirmed.id
      )
    ).toBe(false)
  })

  it(keepsNewestPendingUnreadInfoTitle, async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channelId = 'channel-unread-info-last-message'
    const newestPending = makePendingMessage({
      channelId,
      tid: 'pending-latest-tid',
      body: 'pending-latest',
      createdAt: new Date('2026-04-02T11:15:00.000Z'),
      user: currentUser
    })
    const olderConfirmed = makeMessage({
      id: '902',
      tid: 'pending-older-tid',
      channelId,
      body: 'confirmed-older',
      user: currentUser
    })
    const storedChannel = makeChannel({
      id: channelId,
      lastMessage: newestPending
    })
    const unreadInfoChannel = {
      ...storedChannel,
      lastMessage: olderConfirmed,
      newMessageCount: 3,
      unread: true,
      lastReceivedMsgId: olderConfirmed.id
    }

    setChannelInMap(storedChannel)
    addChannelToAllChannels(storedChannel)
    addMessageToMap(channelId, newestPending)

    const dispatched: any[] = []

    await runSaga(
      {
        dispatch: (action) => {
          dispatched.push(action)
        }
      },
      __eventsTestables.handleUnreadMessagesInfoEvent,
      { channel: unreadInfoChannel as any }
    ).toPromise()

    expect(getChannelFromMap(channelId)?.lastMessage).toEqual(expect.objectContaining({ tid: newestPending.tid }))
    expect(getChannelFromAllChannels(channelId)?.lastMessage).toEqual(
      expect.objectContaining({ tid: newestPending.tid })
    )
    const updateChannelDataAction = dispatched.find(
      (action) =>
        action.type === updateChannelDataAC(channelId, { unread: true }).type && action.payload.channelId === channelId
    )
    expect(updateChannelDataAction?.payload.config?.lastMessage).toBeUndefined()
    expect(
      dispatched.some(
        (action) =>
          action.type === updateChannelDataAC(channelId, { lastMessage: olderConfirmed, unread: true }).type &&
          action.payload.channelId === channelId &&
          action.payload.config?.lastMessage?.id === olderConfirmed.id
      )
    ).toBe(false)
  })

  it('extends the cached latest segment when an incoming message arrives in the active latest window', async () => {
    const channelId = 'channel-event-segment-latest'
    const incomingMessage = makeMessage({
      id: '903',
      channelId,
      body: 'incoming-latest',
      incoming: true
    })
    const storedChannel = makeChannel({
      id: channelId,
      lastMessage: makeMessage({
        id: '902',
        channelId,
        body: 'last-before-incoming',
        incoming: true
      })
    })

    setActiveChannelId(channelId)
    setChannelInMap(storedChannel)
    addChannelToAllChannels(storedChannel)
    addMessageToMap(channelId, makeMessage({ id: '900', channelId, body: 'cached-900', incoming: true }))
    addMessageToMap(channelId, makeMessage({ id: '901', channelId, body: 'cached-901', incoming: true }))
    addMessageToMap(channelId, storedChannel.lastMessage!)
    setActiveSegment(channelId, '900', '902')
    mockStore.getState = jest.fn(() => ({
      MessageReducer: {
        pendingPollActions: {},
        messagesHasNext: false
      }
    }))

    await runSaga(
      {
        dispatch: () => undefined
      },
      __eventsTestables.handleChannelMessageEvent,
      { channel: { ...storedChannel, lastMessage: incomingMessage }, message: incomingMessage },
      { user: { id: incomingMessage.user.id } }
    ).toPromise()

    expect(getContiguousNextMessages(channelId, '902', 10).map((message) => message.id)).toEqual(['903'])
    expect(getActiveSegment()).toEqual({ startId: '900', endId: '903' })
  })

  it('does not extend the cached latest segment when the active window still has newer confirmed pages', async () => {
    const channelId = 'channel-event-segment-has-next'
    const incomingMessage = makeMessage({
      id: '903',
      channelId,
      body: 'incoming-not-latest',
      incoming: true
    })
    const storedChannel = makeChannel({
      id: channelId,
      lastMessage: makeMessage({
        id: '902',
        channelId,
        body: 'last-before-incoming',
        incoming: true
      })
    })

    setActiveChannelId(channelId)
    setChannelInMap(storedChannel)
    addChannelToAllChannels(storedChannel)
    addMessageToMap(channelId, makeMessage({ id: '900', channelId, body: 'cached-900', incoming: true }))
    addMessageToMap(channelId, makeMessage({ id: '901', channelId, body: 'cached-901', incoming: true }))
    addMessageToMap(channelId, storedChannel.lastMessage!)
    setActiveSegment(channelId, '900', '902')
    mockStore.getState = jest.fn(() => ({
      MessageReducer: {
        pendingPollActions: {},
        messagesHasNext: true
      }
    }))

    await runSaga(
      {
        dispatch: () => undefined
      },
      __eventsTestables.handleChannelMessageEvent,
      { channel: { ...storedChannel, lastMessage: incomingMessage }, message: incomingMessage },
      { user: { id: incomingMessage.user.id } }
    ).toPromise()

    expect(getContiguousNextMessages(channelId, '902', 10)).toEqual([])
    expect(getActiveSegment()).toEqual({ startId: '900', endId: '902' })
  })
})
