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
  getActiveSegment,
  getContiguousNextMessages,
  getMessageLocalRef,
  getMessageSortKey,
  getMessagesFromMap,
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
import { MESSAGE_DELIVERY_STATUS, MESSAGE_STATUS } from '../../helpers/constants'
import {
  markMessagesAsDeliveredAC,
  resendPendingChannelReadsAC,
  updateChannelDataAC,
  updateChannelLastMessageAC,
  updateChannelLastMessageStatusAC
} from '../channel/actions'
import {
  addMessagesAC,
  addReactionToMessageAC,
  deleteReactionFromMessageAC,
  resendPendingMessageMutationsAC,
  updateMessageAC,
  updateMessagesMarkersAC,
  updateMessagesStatusAC
} from '../message/actions'
import { getRolesAC } from '../member/actions'
import { setConnectionStatusAC } from '../user/actions'
import { CONNECTION_STATUS } from '../user/constants'
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
      messagesHasNext: false,
      visibleMessagesMap: {}
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
  const setVisibleMessages = (...messages: IMessage[]) => {
    defaultStoreState.MessageReducer.visibleMessagesMap = messages.reduce<Record<string, any>>((result, message) => {
      const localRef = getMessageLocalRef(message)
      if (!localRef) {
        return result
      }

      result[localRef] = {
        id: message.id,
        localRef,
        sortKey: getMessageSortKey(message).toString()
      }
      return result
    }, {})
  }

  beforeEach(() => {
    resetMessageListFixtureIds()
    clearMessagesMap()
    defaultStoreState.MessageReducer.visibleMessagesMap = {}
    destroyChannelsMap()
    setActiveChannelId('')
    setClient({
      user: { id: 'current-user' },
      Channel: { create: jest.fn() }
    })
    mockStore.getState = jest.fn(() => defaultStoreState)
    mockStore.dispatch.mockClear()
    ;(navigateToLatest as jest.Mock).mockClear()
    if (typeof Notification === 'undefined') {
      ;(global as any).Notification = { permission: 'default' }
    }
  })

  afterEach(() => {
    clearMessagesMap()
    defaultStoreState.MessageReducer.visibleMessagesMap = {}
    destroyChannelsMap()
    setActiveChannelId('')
  })

  it('dispatches pending read and message resend hooks when connection becomes connected', async () => {
    const dispatched: any[] = []

    await runSaga(
      {
        getState: getSagaState,
        dispatch: (action) => {
          dispatched.push(action)
        }
      },
      __eventsTestables.handleConnectionStatusChangedEvent,
      CONNECTION_STATUS.CONNECTED
    ).toPromise()

    expect(dispatched).toContainEqual(setConnectionStatusAC(CONNECTION_STATUS.CONNECTED))
    expect(dispatched).toContainEqual(getRolesAC())
    expect(dispatched).toContainEqual(resendPendingMessageMutationsAC(CONNECTION_STATUS.CONNECTED))
    expect(dispatched).toContainEqual(resendPendingChannelReadsAC(CONNECTION_STATUS.CONNECTED))
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

  it('keeps cached self reactions untouched for remote reaction-added events and tolerates missing cached messages', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const remoteUser = makeUser({ id: 'remote-user' })
    const channelId = 'channel-reaction-added-event'
    const selfReaction = {
      id: 'self-reaction',
      key: 'thumbsup',
      score: 1,
      reason: '',
      createdAt: new Date('2026-04-02T12:10:00.000Z'),
      messageId: '1300',
      user: currentUser
    }
    const cachedMessage = makeMessage({
      id: '1300',
      channelId,
      user: currentUser,
      userReactions: [selfReaction]
    })
    const reaction = {
      id: 'remote-reaction',
      key: 'heart',
      score: 1,
      reason: '',
      createdAt: new Date('2026-04-02T12:11:00.000Z'),
      messageId: cachedMessage.id,
      user: remoteUser
    }
    const missingMessage = makeMessage({
      id: '1301',
      channelId,
      user: currentUser,
      reactionTotals: [{ key: 'heart', count: 1, score: 1 }]
    })
    const channel = makeChannel({ id: channelId, lastMessage: cachedMessage, newReactions: [] })
    const dispatched: any[] = []

    setActiveChannelId(channelId)
    addMessageToMap(channelId, cachedMessage)

    await runSaga(
      {
        getState: getSagaState,
        dispatch: (action) => {
          dispatched.push(action)
        }
      },
      __eventsTestables.handleReactionAddedEvent,
      { channel, user: remoteUser, message: cachedMessage, reaction },
      { user: currentUser }
    ).toPromise()

    await runSaga(
      {
        getState: getSagaState,
        dispatch: (action) => {
          dispatched.push(action)
        }
      },
      __eventsTestables.handleReactionAddedEvent,
      { channel, user: remoteUser, message: missingMessage, reaction },
      { user: currentUser }
    ).toPromise()

    expect(dispatched).toContainEqual(addReactionToMessageAC(cachedMessage, reaction as any, false))
    expect(getMessagesFromMap(channelId)[cachedMessage.id].userReactions).toEqual([selfReaction])
    expect(getMessagesFromMap(channelId)[missingMessage.id]).toBeUndefined()
  })

  it('keeps cached self reactions untouched for remote reaction-deleted events', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const remoteUser = makeUser({ id: 'remote-user' })
    const channelId = 'channel-reaction-deleted-event'
    const reaction = {
      id: 'self-reaction',
      key: 'thumbsup',
      score: 1,
      reason: '',
      createdAt: new Date('2026-04-02T12:20:00.000Z'),
      messageId: '1310',
      user: currentUser
    }
    const cachedMessage = makeMessage({
      id: '1310',
      channelId,
      user: currentUser,
      userReactions: [reaction]
    })
    const channel = makeChannel({ id: channelId, lastMessage: cachedMessage, newReactions: [] })
    const dispatched: any[] = []

    setActiveChannelId(channelId)
    addMessageToMap(channelId, cachedMessage)
    setChannelInMap(channel)

    await runSaga(
      {
        getState: getSagaState,
        dispatch: (action) => {
          dispatched.push(action)
        }
      },
      __eventsTestables.handleReactionDeletedEvent,
      { channel, user: remoteUser, message: cachedMessage, reaction },
      { user: currentUser }
    ).toPromise()

    expect(dispatched).toContainEqual(deleteReactionFromMessageAC(cachedMessage, reaction as any, false))
    expect(getMessagesFromMap(channelId)[cachedMessage.id].userReactions).toEqual([reaction])
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

  it('clears badge-driving unread fields when a channel-marked-as-read event arrives without unread-info reconciliation', async () => {
    const channelId = 'channel-marked-as-read-event'
    const channel = makeChannel({
      id: channelId,
      unread: true,
      newMessageCount: 7,
      newMentionCount: 2,
      lastReceivedMsgId: '1507',
      lastDisplayedMessageId: '1507'
    })
    const dispatched: any[] = []

    setChannelInMap(channel)
    addChannelToAllChannels(channel)

    await runSaga(
      {
        getState: getSagaState,
        dispatch: (action) => {
          dispatched.push(action)
        }
      },
      __eventsTestables.handleChannelMarkedAsReadEvent,
      { channel }
    ).toPromise()

    expect(dispatched).toContainEqual(
      updateChannelDataAC(channelId, {
        unread: false,
        newMessageCount: 0,
        newMentionCount: 0,
        muted: channel.muted,
        mutedTill: channel.mutedTill,
        lastReceivedMsgId: '1507',
        lastDisplayedMessageId: '1507'
      })
    )
    expect(getChannelFromMap(channelId)).toEqual(
      expect.objectContaining({
        unread: false,
        newMessageCount: 0,
        newMentionCount: 0,
        lastReceivedMsgId: '1507',
        lastDisplayedMessageId: '1507'
      })
    )
  })

  it('lets unread-messages-info re-apply the authoritative unread state after a local read-all clear', async () => {
    const channelId = 'channel-marked-read-then-unread-info'
    const storedChannel = makeChannel({
      id: channelId,
      unread: true,
      newMessageCount: 9,
      newMentionCount: 3,
      lastReceivedMsgId: '1609',
      lastDisplayedMessageId: '1600'
    })

    setChannelInMap(storedChannel)
    addChannelToAllChannels(storedChannel)

    await runSaga(
      {
        getState: getSagaState,
        dispatch: () => undefined
      },
      __eventsTestables.handleChannelMarkedAsReadEvent,
      {
        channel: {
          ...storedChannel,
          unread: true,
          newMessageCount: 9,
          newMentionCount: 3,
          lastDisplayedMessageId: '1609'
        } as any
      }
    ).toPromise()

    expect(getChannelFromMap(channelId)).toEqual(
      expect.objectContaining({
        unread: false,
        newMessageCount: 0,
        newMentionCount: 0,
        lastDisplayedMessageId: '1609'
      })
    )

    await runSaga(
      {
        getState: getSagaState,
        dispatch: () => undefined
      },
      __eventsTestables.handleUnreadMessagesInfoEvent,
      {
        channel: {
          ...storedChannel,
          unread: true,
          newMessageCount: 2,
          newMentionCount: 1,
          lastReceivedMsgId: '1611',
          lastDisplayedMessageId: '1609'
        } as any
      }
    ).toPromise()

    expect(getChannelFromMap(channelId)).toEqual(
      expect.objectContaining({
        unread: true,
        newMessageCount: 2,
        newMentionCount: 1,
        lastReceivedMsgId: '1611',
        lastDisplayedMessageId: '1609'
      })
    )
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
    setVisibleMessages(storedChannel.lastMessage!)
    setActiveSegment(channelId, '900', '902')
    mockStore.getState = jest.fn(() => ({
      ...defaultStoreState,
      MessageReducer: {
        ...defaultStoreState.MessageReducer,
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
      ...defaultStoreState,
      MessageReducer: {
        ...defaultStoreState.MessageReducer,
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
      ...defaultStoreState,
      MessageReducer: {
        ...defaultStoreState.MessageReducer,
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

  it('reconciles the active thread when a reconnect confirmation replaces its pending last message', async () => {
    const channelId = 'channel-reconnect-pending-thread'
    const pendingMessage = makePendingMessage({
      tid: 'offline-message-tid',
      channelId,
      body: 'sent during packet loss',
      state: MESSAGE_STATUS.PENDING
    })
    const confirmedMessage = makeMessage({
      id: '840827767688048640',
      tid: pendingMessage.tid,
      channelId,
      body: pendingMessage.body,
      incoming: false,
      state: MESSAGE_STATUS.UNMODIFIED,
      deliveryStatus: MESSAGE_DELIVERY_STATUS.SENT
    })
    const storedChannel = makeChannel({ id: channelId, lastMessage: pendingMessage })

    setActiveChannelId(channelId)
    setChannelInMap(storedChannel)
    addChannelToAllChannels(storedChannel)
    addMessageToMap(channelId, pendingMessage)
    setActiveSegment(channelId, '840827767688048630', '840827767688048639')
    mockStore.getState = jest.fn(() => ({
      ...defaultStoreState,
      MessageReducer: {
        ...defaultStoreState.MessageReducer,
        // The reconnect event arrives while the active list is a history window.
        messagesHasNext: true,
        activeChannelMessages: [pendingMessage]
      }
    }))

    const dispatched: any[] = []
    await runSaga(
      { getState: getSagaState, dispatch: (action) => dispatched.push(action) },
      __eventsTestables.handleChannelMessageEvent,
      { channel: { ...storedChannel, lastMessage: confirmedMessage }, message: confirmedMessage },
      { user: { id: 'current-user' } }
    ).toPromise()

    // The channel/list receives the confirmed copy.
    expect(dispatched).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: updateChannelLastMessageAC(confirmedMessage, storedChannel).type })
      ])
    )
    // The active thread must receive the same confirmed message, even while a
    // history window is open, so it does not remain Pending.
    expect(
      dispatched.some(
        (action) =>
          action.type === updateMessageAC(pendingMessage.tid!, {}).type &&
          action.payload?.messageId === pendingMessage.tid
      )
    ).toBe(true)
  })

  it('reconciles the active thread in the latest window after an offline pending message is confirmed', async () => {
    const channelId = 'channel-reconnect-latest-pending-thread'
    const pendingMessage = makePendingMessage({
      tid: 'offline-latest-message-tid',
      channelId,
      body: 'sent during packet loss',
      state: MESSAGE_STATUS.PENDING
    })
    const confirmedMessage = makeMessage({
      id: '840827767688048641',
      tid: pendingMessage.tid,
      channelId,
      body: pendingMessage.body,
      incoming: false,
      state: MESSAGE_STATUS.UNMODIFIED,
      deliveryStatus: MESSAGE_DELIVERY_STATUS.SENT
    })
    const storedChannel = makeChannel({ id: channelId, lastMessage: pendingMessage })

    setActiveChannelId(channelId)
    setChannelInMap(storedChannel)
    addChannelToAllChannels(storedChannel)
    addMessageToMap(channelId, pendingMessage)
    mockStore.getState = jest.fn(() => ({
      ...defaultStoreState,
      MessageReducer: {
        ...defaultStoreState.MessageReducer,
        messagesHasNext: false,
        activeChannelMessages: [pendingMessage]
      }
    }))

    const dispatched: any[] = []
    await runSaga(
      { getState: getSagaState, dispatch: (action) => dispatched.push(action) },
      __eventsTestables.handleChannelMessageEvent,
      { channel: { ...storedChannel, lastMessage: confirmedMessage }, message: confirmedMessage },
      { user: { id: 'current-user' } }
    ).toPromise()

    expect(dispatched).toContainEqual(
      updateMessageAC(
        pendingMessage.tid!,
        expect.objectContaining({
          id: confirmedMessage.id,
          state: MESSAGE_STATUS.UNMODIFIED,
          deliveryStatus: MESSAGE_DELIVERY_STATUS.SENT
        })
      )
    )
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
      ...defaultStoreState,
      MessageReducer: {
        ...defaultStoreState.MessageReducer,
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

  // --- markMessagesAsDeliveredAC dispatch tests ---
  // These tests cover the bug where a thread-reply message uses message.parentMessage.id
  // (a message ID) as the channelId argument to markMessagesAsDeliveredAC instead of
  // channel.id. Using the wrong ID means the delivery marker never fires for the real
  // channel, so MESSAGE_MARKERS_RECEIVED is never dispatched for the correct channel and
  // channel.lastMessage.deliveryStatus stays stale while the chat view shows the update.

  it('dispatches markMessagesAsDeliveredAC with channel.id for a regular incoming message', async () => {
    const channelId = 'channel-deliver-regular'
    const incomingMessage = makeMessage({
      id: '1000',
      channelId,
      incoming: true,
      deliveryStatus: MESSAGE_DELIVERY_STATUS.SENT
    })
    const channel = makeChannel({ id: channelId, lastMessage: incomingMessage })
    const dispatched: any[] = []

    setChannelInMap(channel)
    addChannelToAllChannels(channel)

    await runSaga(
      { getState: getSagaState, dispatch: (action) => dispatched.push(action) },
      __eventsTestables.handleChannelMessageEvent,
      { channel: { ...channel, lastMessage: incomingMessage }, message: incomingMessage },
      // SceytChatClient: current user is different from the message sender
      { user: { id: 'current-user' } }
    ).toPromise()

    const deliverAction = dispatched.find((action) => action.type === markMessagesAsDeliveredAC('', []).type)
    expect(deliverAction).toBeDefined()
    expect(deliverAction.payload.channelId).toBe(channelId)
    expect(deliverAction.payload.messageIds).toEqual([incomingMessage.id])
  })

  // BUG REPRODUCTION: currently FAILS because the code passes message.parentMessage.id
  // (a message ID) instead of channel.id as channelId.
  // The fix is to change line 290 in events/inedx.ts from:
  //   markMessagesAsDeliveredAC(message.parentMessage.id, [message.id])
  // to:
  //   markMessagesAsDeliveredAC(channel.id, [message.id])
  it('dispatches markMessagesAsDeliveredAC with channel.id for a thread-reply incoming message', async () => {
    const channelId = 'channel-deliver-thread'
    const parentMessage = makeMessage({ id: '990', channelId, incoming: true })
    const threadMessage = makeMessage({
      id: '1001',
      channelId,
      incoming: true,
      deliveryStatus: MESSAGE_DELIVERY_STATUS.SENT,
      repliedInThread: true,
      parentMessage,
      parentId: parentMessage.id
    })
    const channel = makeChannel({ id: channelId, lastMessage: parentMessage })
    const dispatched: any[] = []

    setChannelInMap(channel)
    addChannelToAllChannels(channel)

    await runSaga(
      { getState: getSagaState, dispatch: (action) => dispatched.push(action) },
      __eventsTestables.handleChannelMessageEvent,
      { channel: { ...channel, lastMessage: threadMessage }, message: threadMessage },
      { user: { id: 'current-user' } }
    ).toPromise()

    const deliverAction = dispatched.find((action) => action.type === markMessagesAsDeliveredAC('', []).type)
    expect(deliverAction).toBeDefined()
    // BUG: currently fails — channelId is message.parentMessage.id ('990') instead of channel.id
    expect(deliverAction.payload.channelId).toBe(channelId)
    expect(deliverAction.payload.messageIds).toEqual([threadMessage.id])
  })

  it('does not dispatch markMessagesAsDeliveredAC for own messages', async () => {
    const channelId = 'channel-deliver-own'
    const ownMessage = makeMessage({
      id: '1002',
      channelId,
      incoming: false,
      deliveryStatus: MESSAGE_DELIVERY_STATUS.SENT
    })
    const channel = makeChannel({ id: channelId, lastMessage: ownMessage })
    const dispatched: any[] = []

    setChannelInMap(channel)
    addChannelToAllChannels(channel)

    await runSaga(
      { getState: getSagaState, dispatch: (action) => dispatched.push(action) },
      __eventsTestables.handleChannelMessageEvent,
      { channel: { ...channel, lastMessage: ownMessage }, message: ownMessage },
      // SceytChatClient.user.id matches the message sender — own message
      { user: { id: ownMessage.user.id } }
    ).toPromise()

    const deliverAction = dispatched.find((action) => action.type === markMessagesAsDeliveredAC('', []).type)
    expect(deliverAction).toBeUndefined()
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
      ...defaultStoreState,
      MessageReducer: {
        ...defaultStoreState.MessageReducer,
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

  it('updates cached reply parent snapshots when an edit event arrives', async () => {
    const channelId = 'channel-event-edit-reply'
    const sourceMessage = makeMessage({
      id: '930',
      channelId,
      body: 'before-edit'
    })
    const replyMessage = makeMessage({
      id: '931',
      channelId,
      body: 'reply-message',
      parentMessage: sourceMessage
    })
    const editedMessage = {
      ...sourceMessage,
      body: 'after-edit',
      updatedAt: new Date('2026-04-02T12:10:00.000Z')
    }
    const channel = makeChannel({
      id: channelId,
      lastMessage: replyMessage
    })

    setChannelInMap(channel)
    addChannelToAllChannels(channel)
    addMessageToMap(channelId, sourceMessage)
    addMessageToMap(channelId, replyMessage)

    await runSaga(
      {
        getState: getSagaState,
        dispatch: () => undefined
      },
      __eventsTestables.handleEditMessageEvent,
      { channel, message: editedMessage }
    ).toPromise()

    expect(getMessagesFromMap(channelId)[replyMessage.id].parentMessage).toEqual(
      expect.objectContaining({
        id: sourceMessage.id,
        body: 'after-edit',
        updatedAt: editedMessage.updatedAt
      })
    )
  })

  it('updates cached reply parent snapshots when a delete event arrives', async () => {
    const channelId = 'channel-event-delete-reply'
    const sourceMessage = makeMessage({
      id: '940',
      channelId,
      body: 'before-delete',
      attachments: [{ id: 'att-delete' } as any]
    })
    const replyMessage = makeMessage({
      id: '941',
      channelId,
      body: 'reply-message',
      parentMessage: sourceMessage
    })
    const deletedMessage = {
      ...sourceMessage,
      state: MESSAGE_STATUS.DELETE,
      body: '',
      attachments: [],
      updatedAt: new Date('2026-04-02T12:12:00.000Z')
    }
    const channel = makeChannel({
      id: channelId,
      lastMessage: replyMessage
    })

    setChannelInMap(channel)
    addChannelToAllChannels(channel)
    addMessageToMap(channelId, sourceMessage)
    addMessageToMap(channelId, replyMessage)

    await runSaga(
      {
        getState: getSagaState,
        dispatch: () => undefined
      },
      __eventsTestables.handleDeleteMessageEvent,
      { channel, deletedMessage }
    ).toPromise()

    expect(getMessagesFromMap(channelId)[replyMessage.id].parentMessage).toEqual(
      expect.objectContaining({
        id: sourceMessage.id,
        state: MESSAGE_STATUS.DELETE,
        body: '',
        attachments: []
      })
    )
  })
})
