import { runSaga } from 'redux-saga'
import { setClient } from '../../common/client'
import {
  addChannelToAllChannels,
  destroyChannelsMap,
  getChannelFromMap,
  setActiveChannelId,
  setChannelInMap
} from '../../helpers/channelHalper'
import {
  addMessageToMap,
  clearMessagesMap,
  clearVisibleMessagesMap,
  getActiveSegment,
  getContiguousNextMessages,
  getMessagesFromMap,
  setMessageToVisibleMessagesMap,
  setActiveSegment
} from '../../helpers/messagesHalper'
import { IMessage } from '../../types'
import {
  makeChannel,
  makeMessage,
  makePendingMessage,
  makeUser,
  resetMessageListFixtureIds
} from '../../testUtils/messageFixtures'
import { MESSAGE_DELIVERY_STATUS } from '../../helpers/constants'
import { updateChannelDataAC, updateChannelLastMessageAC, updateChannelLastMessageStatusAC } from '../channel/actions'
import { addMessagesAC, updateMessagesMarkersAC, updateMessagesStatusAC } from '../message/actions'
import { navigateToLatest } from '../../helpers/messageListNavigator'
import { __eventsTestables } from './inedx'

jest.mock('../../helpers/messageListNavigator', () => ({
  navigateToLatest: jest.fn()
}))

describe('event message last-message handling', () => {
  const mockStore = require('store') as {
    getState: () => any
    dispatch: jest.Mock
  }
  const defaultStoreState = {
    MessageReducer: {
      pendingPollActions: {},
      messagesHasNext: false
    },
    UserReducer: {
      browserTabIsActive: true
    }
  }
  const getSagaState = () => ({ ...defaultStoreState, ...mockStore.getState() })

  const keepsNewestPendingTitle =
    'restores confirmed channel last message when an older resend confirmation arrives as a channel message event'
  const keepsNewestPendingUnreadInfoTitle =
    'restores confirmed channel last message when unread info arrives with an older confirmed last message'

  beforeEach(() => {
    resetMessageListFixtureIds()
    clearMessagesMap()
    clearVisibleMessagesMap()
    destroyChannelsMap()
    setActiveChannelId('')
    setClient({
      user: { id: 'current-user' },
      Channel: { create: jest.fn() }
    })
    mockStore.getState = jest.fn(() => defaultStoreState)
    mockStore.dispatch.mockClear()
    ;(navigateToLatest as jest.Mock).mockClear()
  })

  afterEach(() => {
    clearMessagesMap()
    clearVisibleMessagesMap()
    destroyChannelsMap()
    setActiveChannelId('')
  })

  it('handles current-user message markers as userMarkers across active action, cache, and last message', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channelId = 'channel-own-marker-event'
    const message = makeMessage({
      id: '1200',
      channelId,
      incoming: true,
      deliveryStatus: MESSAGE_DELIVERY_STATUS.SENT,
      userMarkers: [],
      markerTotals: []
    })
    const channel = makeChannel({ id: channelId, lastMessage: message })
    const markerList = {
      messageIds: [message.id],
      user: currentUser,
      name: MESSAGE_DELIVERY_STATUS.DELIVERED,
      createdAt: new Date('2026-04-02T12:00:00.000Z')
    } as any
    const dispatched: any[] = []

    setActiveChannelId(channelId)
    setChannelInMap(channel)
    addChannelToAllChannels(channel)
    addMessageToMap(channelId, message)

    await runSaga(
      {
        getState: getSagaState,
        dispatch: (action) => {
          dispatched.push(action)
        }
      },
      __eventsTestables.handleMessageMarkersReceivedEvent,
      { channelId, markerList },
      { user: currentUser }
    ).toPromise()

    const activeStatusAction = dispatched.find(
      (action) => action.type === updateMessagesStatusAC(markerList.name, {}, true, markerList).type
    )

    expect(activeStatusAction).toEqual(
      expect.objectContaining({
        payload: expect.objectContaining({
          isOwnMarker: true,
          marker: markerList
        })
      })
    )
    expect(
      dispatched.some((action) => action.type === updateMessagesMarkersAC(channelId, markerList.name, markerList).type)
    ).toBe(false)
    expect(getMessagesFromMap(channelId)[message.id].userMarkers).toEqual([
      expect.objectContaining({
        name: MESSAGE_DELIVERY_STATUS.DELIVERED,
        messageId: message.id,
        user: currentUser
      })
    ])
    expect(getMessagesFromMap(channelId)[message.id].markerTotals).toEqual([])
    expect(getChannelFromMap(channelId)?.lastMessage.userMarkers).toEqual([
      expect.objectContaining({
        name: MESSAGE_DELIVERY_STATUS.DELIVERED,
        messageId: message.id,
        user: currentUser
      })
    ])
    expect(getChannelFromMap(channelId)?.lastMessage.markerTotals).toEqual([])
    expect(dispatched.some((action) => action.type === updateChannelLastMessageStatusAC(message, channel).type)).toBe(
      true
    )
  })

  it('handles remote-user message markers as markerTotals across active action, cache, and last message', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const remoteUser = makeUser({ id: 'remote-user' })
    const channelId = 'channel-remote-marker-event'
    const message = makeMessage({
      id: '1210',
      channelId,
      user: currentUser,
      incoming: false,
      deliveryStatus: MESSAGE_DELIVERY_STATUS.SENT,
      userMarkers: [],
      markerTotals: []
    })
    const channel = makeChannel({ id: channelId, lastMessage: message })
    const markerList = {
      messageIds: [message.id],
      user: remoteUser,
      name: MESSAGE_DELIVERY_STATUS.READ,
      createdAt: new Date('2026-04-02T12:05:00.000Z')
    } as any
    const dispatched: any[] = []

    setActiveChannelId(channelId)
    setChannelInMap(channel)
    addChannelToAllChannels(channel)
    addMessageToMap(channelId, message)

    await runSaga(
      {
        getState: getSagaState,
        dispatch: (action) => {
          dispatched.push(action)
        }
      },
      __eventsTestables.handleMessageMarkersReceivedEvent,
      { channelId, markerList },
      { user: currentUser }
    ).toPromise()

    const activeStatusAction = dispatched.find(
      (action) => action.type === updateMessagesStatusAC(markerList.name, {}, false, markerList).type
    )

    expect(activeStatusAction).toEqual(
      expect.objectContaining({
        payload: expect.objectContaining({
          isOwnMarker: false,
          marker: markerList
        })
      })
    )
    expect(
      dispatched.some((action) => action.type === updateMessagesMarkersAC(channelId, markerList.name, markerList).type)
    ).toBe(true)
    expect(getMessagesFromMap(channelId)[message.id].markerTotals).toEqual([
      { name: MESSAGE_DELIVERY_STATUS.READ, count: 1 }
    ])
    expect(getMessagesFromMap(channelId)[message.id].userMarkers).toEqual([])
    expect(getChannelFromMap(channelId)?.lastMessage.markerTotals).toEqual([
      { name: MESSAGE_DELIVERY_STATUS.READ, count: 1 }
    ])
    expect(getChannelFromMap(channelId)?.lastMessage.userMarkers).toEqual([])
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
        getState: getSagaState,
        dispatch: (action) => {
          dispatched.push(action)
        }
      },
      __eventsTestables.handleChannelMessageEvent,
      { channel: incomingChannel, message: olderConfirmed },
      { user: { id: 'current-user' } }
    ).toPromise()

    expect(getChannelFromMap(channelId)?.lastMessage).toEqual(expect.objectContaining({ tid: newestPending.tid }))
    expect(getChannelFromMap(channelId)?.lastMessage?.id).toBeFalsy()
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
        getState: getSagaState,
        dispatch: (action) => {
          dispatched.push(action)
        }
      },
      __eventsTestables.handleUnreadMessagesInfoEvent,
      { channel: unreadInfoChannel as any }
    ).toPromise()

    expect(getChannelFromMap(channelId)?.lastMessage).toEqual(expect.objectContaining({ tid: newestPending.tid }))
    expect(getChannelFromMap(channelId)?.lastMessage?.id).toBeFalsy()
    const updateChannelDataAction = dispatched.find(
      (action) =>
        action.type === updateChannelDataAC(channelId, { unread: true }).type && action.payload.channelId === channelId
    )
    expect(updateChannelDataAction?.payload.config?.lastMessage).toBeUndefined()
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
    setMessageToVisibleMessagesMap(storedChannel.lastMessage!)
    setActiveSegment(channelId, '900', '902')
    mockStore.getState = jest.fn(() => ({
      MessageReducer: {
        pendingPollActions: {},
        messagesHasNext: false,
        activeChannelMessages: [
          makeMessage({ id: '900', channelId, body: 'cached-900', incoming: true }),
          makeMessage({ id: '901', channelId, body: 'cached-901', incoming: true }),
          storedChannel.lastMessage
        ]
      }
    }))

    const dispatched: any[] = []

    await runSaga(
      {
        getState: getSagaState,
        dispatch: (action) => {
          dispatched.push(action)
        }
      },
      __eventsTestables.handleChannelMessageEvent,
      { channel: { ...storedChannel, lastMessage: incomingMessage }, message: incomingMessage },
      { user: { id: incomingMessage.user.id } }
    ).toPromise()

    await new Promise((resolve) => setTimeout(resolve, 60))

    expect(dispatched).toEqual(expect.arrayContaining([addMessagesAC([incomingMessage], 'next')]))
    expect(navigateToLatest).toHaveBeenCalledWith(true)
    expect(getContiguousNextMessages(channelId, { id: '902' } as IMessage, 10).map((message) => message.id)).toEqual([
      '903'
    ])
    expect(getActiveSegment()).toEqual({ startId: '900', endId: '903' })
  })

  it('appends an incoming message without auto-jumping when the previous latest message is loaded but not visible', async () => {
    const channelId = 'channel-event-segment-latest-not-visible'
    const incomingMessage = makeMessage({
      id: '913',
      channelId,
      body: 'incoming-latest',
      incoming: true
    })
    const storedChannel = makeChannel({
      id: channelId,
      lastMessage: makeMessage({
        id: '912',
        channelId,
        body: 'last-before-incoming',
        incoming: true
      })
    })

    setActiveChannelId(channelId)
    setChannelInMap(storedChannel)
    addChannelToAllChannels(storedChannel)
    addMessageToMap(channelId, makeMessage({ id: '910', channelId, body: 'cached-910', incoming: true }))
    addMessageToMap(channelId, makeMessage({ id: '911', channelId, body: 'cached-911', incoming: true }))
    addMessageToMap(channelId, storedChannel.lastMessage!)
    setActiveSegment(channelId, '910', '912')
    mockStore.getState = jest.fn(() => ({
      MessageReducer: {
        pendingPollActions: {},
        messagesHasNext: false,
        activeChannelMessages: [
          makeMessage({ id: '910', channelId, body: 'cached-910', incoming: true }),
          makeMessage({ id: '911', channelId, body: 'cached-911', incoming: true }),
          storedChannel.lastMessage
        ]
      }
    }))

    const dispatched: any[] = []

    await runSaga(
      {
        getState: getSagaState,
        dispatch: (action) => {
          dispatched.push(action)
        }
      },
      __eventsTestables.handleChannelMessageEvent,
      { channel: { ...storedChannel, lastMessage: incomingMessage }, message: incomingMessage },
      { user: { id: incomingMessage.user.id } }
    ).toPromise()

    expect(dispatched).toEqual(expect.arrayContaining([addMessagesAC([incomingMessage], 'next')]))
    expect(navigateToLatest).not.toHaveBeenCalled()
  })

  it('extends the cached latest segment for a real incoming message even when the user is reading history', async () => {
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
        messagesHasNext: true,
        activeChannelMessages: [
          makeMessage({ id: '900', channelId, body: 'cached-900', incoming: true }),
          makeMessage({ id: '901', channelId, body: 'cached-901', incoming: true }),
          storedChannel.lastMessage
        ]
      }
    }))

    const dispatched: any[] = []

    await runSaga(
      {
        getState: getSagaState,
        dispatch: (action) => {
          dispatched.push(action)
        }
      },
      __eventsTestables.handleChannelMessageEvent,
      { channel: { ...storedChannel, lastMessage: incomingMessage }, message: incomingMessage },
      { user: { id: incomingMessage.user.id } }
    ).toPromise()

    expect(getContiguousNextMessages(channelId, { id: '902' } as IMessage, 10).map((message) => message.id)).toEqual([
      '903'
    ])
    expect(getActiveSegment()).toEqual({ startId: '900', endId: '903' })
  })

  it('extends an inactive channel cached latest segment when a background message arrives after the cached latest edge', async () => {
    const activeChannelId = 'channel-active-other'
    const channelId = 'channel-event-segment-inactive-latest'
    const previousLatest = makeMessage({
      id: '952',
      channelId,
      body: 'last-before-background',
      incoming: true
    })
    const incomingMessage = makeMessage({
      id: '953',
      channelId,
      body: 'incoming-background',
      incoming: true
    })
    const storedChannel = makeChannel({
      id: channelId,
      lastMessage: previousLatest
    })

    setActiveChannelId(activeChannelId)
    setChannelInMap(storedChannel)
    addChannelToAllChannels(storedChannel)
    addMessageToMap(channelId, makeMessage({ id: '950', channelId, body: 'cached-950', incoming: true }))
    addMessageToMap(channelId, makeMessage({ id: '951', channelId, body: 'cached-951', incoming: true }))
    addMessageToMap(channelId, previousLatest)
    setActiveSegment(channelId, '950', '952')
    mockStore.getState = jest.fn(() => ({
      MessageReducer: {
        pendingPollActions: {},
        messagesHasNext: false
      }
    }))

    await runSaga(
      {
        getState: getSagaState,
        dispatch: () => undefined
      },
      __eventsTestables.handleChannelMessageEvent,
      { channel: { ...storedChannel, lastMessage: incomingMessage }, message: incomingMessage },
      { user: { id: incomingMessage.user.id } }
    ).toPromise()

    expect(getContiguousNextMessages(channelId, { id: '952' } as IMessage, 10).map((message) => message.id)).toEqual([
      '953'
    ])
  })

  it('does not extend an inactive channel cached segment when the cached range is not the channel latest edge', async () => {
    const activeChannelId = 'channel-active-other-safety'
    const channelId = 'channel-event-segment-inactive-history'
    const storedChannel = makeChannel({
      id: channelId,
      lastMessage: makeMessage({
        id: '965',
        channelId,
        body: 'latest-known-outside-cache',
        incoming: true
      })
    })
    const incomingMessage = makeMessage({
      id: '966',
      channelId,
      body: 'incoming-background',
      incoming: true
    })

    setActiveChannelId(activeChannelId)
    setChannelInMap(storedChannel)
    addChannelToAllChannels(storedChannel)
    addMessageToMap(channelId, makeMessage({ id: '950', channelId, body: 'cached-950', incoming: true }))
    addMessageToMap(channelId, makeMessage({ id: '951', channelId, body: 'cached-951', incoming: true }))
    addMessageToMap(channelId, makeMessage({ id: '952', channelId, body: 'cached-952', incoming: true }))
    setActiveSegment(channelId, '950', '952')
    mockStore.getState = jest.fn(() => ({
      MessageReducer: {
        pendingPollActions: {},
        messagesHasNext: false
      }
    }))

    await runSaga(
      {
        getState: getSagaState,
        dispatch: () => undefined
      },
      __eventsTestables.handleChannelMessageEvent,
      { channel: { ...storedChannel, lastMessage: incomingMessage }, message: incomingMessage },
      { user: { id: incomingMessage.user.id } }
    ).toPromise()

    expect(getContiguousNextMessages(channelId, { id: '952' } as IMessage, 10)).toEqual([])
  })
})
