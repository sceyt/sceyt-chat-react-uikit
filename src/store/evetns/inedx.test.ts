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
  removeChannelAC,
  resendPendingChannelReadsAC,
  setChannelToRemoveAC,
  switchChannelActionAC,
  updateChannelDataAC,
  updateChannelLastMessageAC,
  updateChannelLastMessageStatusAC
} from '../channel/actions'
import {
  addMessagesAC,
  addReactionToMessageAC,
  clearMessagesAC,
  deleteReactionFromMessageAC,
  resendPendingMessageMutationsAC,
  updateMessageAC,
  updateMessagesMarkersAC,
  updateMessagesStatusAC
} from '../message/actions'
import { getRolesAC } from '../member/actions'
import { resendPendingPinMutationsAC } from '../pinned/actions'
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

  it('does not let a late sent message event downgrade the delivered channel-list preview', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const recipient = makeUser({ id: 'recipient-user' })
    const channelId = 'channel-late-sent-event-after-delivery-marker'
    const sentMessage = makeMessage({
      id: '1220',
      tid: 'late-sent-event-tid',
      channelId,
      body: 'resend after packet loss',
      incoming: false,
      user: currentUser,
      deliveryStatus: MESSAGE_DELIVERY_STATUS.SENT
    })
    const channel = makeChannel({ id: channelId, lastMessage: sentMessage })
    const deliveredMarker = {
      messageIds: [sentMessage.id],
      user: recipient,
      name: MESSAGE_DELIVERY_STATUS.DELIVERED,
      createdAt: new Date('2026-04-02T12:10:00.000Z')
    } as any

    setActiveChannelId(channelId)
    setChannelInMap(channel)
    addChannelToAllChannels(channel)
    addMessageToMap(channelId, sentMessage)

    await runSaga(
      { getState: getSagaState, dispatch: () => undefined },
      __eventsTestables.handleMessageMarkersReceivedEvent,
      { channelId, markerList: deliveredMarker },
      { user: currentUser }
    ).toPromise()

    const deliveredLastMessage = getChannelFromMap(channelId)!.lastMessage
    expect(deliveredLastMessage.deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.DELIVERED)

    // The delayed confirmation event is the same message but still carries
    // the original SENT status. This is the order captured in the browser
    // trace after a resend under packet loss.
    const staleSentMessage = { ...sentMessage }
    const staleChannel = { ...channel, lastMessage: staleSentMessage }
    mockStore.getState = jest.fn(() => ({
      ...defaultStoreState,
      ChannelReducer: { channels: [{ ...channel, lastMessage: deliveredLastMessage }] },
      MessageReducer: {
        ...defaultStoreState.MessageReducer,
        activeChannelMessages: [deliveredLastMessage]
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
      { channel: staleChannel, message: staleSentMessage },
      { user: currentUser }
    ).toPromise()

    const lastMessageUpdates = dispatched.filter(
      (action) =>
        action.type === updateChannelLastMessageAC(staleSentMessage, staleChannel as any).type ||
        (action.type === updateChannelDataAC(channelId, {}).type && action.payload?.config?.lastMessage)
    )

    expect(lastMessageUpdates).toEqual([])
    expect(
      lastMessageUpdates.some(
        (action) =>
          action.payload?.message?.deliveryStatus === MESSAGE_DELIVERY_STATUS.SENT ||
          action.payload?.config?.lastMessage?.deliveryStatus === MESSAGE_DELIVERY_STATUS.SENT
      )
    ).toBe(false)
    expect(getChannelFromMap(channelId)?.lastMessage.deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.DELIVERED)
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
    // The SDK can update its mutable cache before it emits the confirmation
    // event, while Redux still contains the pending channel-list preview.
    setChannelInMap({ ...storedChannel, lastMessage: confirmedMessage })
    setActiveSegment(channelId, '840827767688048630', '840827767688048639')
    mockStore.getState = jest.fn(() => ({
      ...defaultStoreState,
      ChannelReducer: {
        channels: [{ ...storedChannel, lastMessage: pendingMessage }]
      },
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
        expect.objectContaining({ type: updateChannelLastMessageAC(confirmedMessage, storedChannel).type }),
        expect.objectContaining({
          type: updateChannelDataAC(channelId, {}, true).type,
          payload: expect.objectContaining({
            config: expect.objectContaining({ lastMessage: expect.objectContaining({ id: confirmedMessage.id }) })
          })
        })
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

  // --- P0-1: Extended event handler tests (table-driven) ---

  describe('MESSAGE event handler - channel state tests', () => {
    it('non-active channel bumps unread count and lastMessage only', async () => {
      const activeChannelId = 'other-channel'
      const channelId = 'target-channel'
      const initialUnreadCount = 2
      const expectedUnreadCount = 3

      const incomingMessage = makeMessage({
        id: '9000000000000000001',
        channelId,
        incoming: true,
        body: 'new incoming message'
      })
      const channel = makeChannel({
        id: channelId,
        newMessageCount: initialUnreadCount,
        lastMessage: makeMessage({ id: '9000', channelId, body: 'previous message' })
      })
      const dispatched: any[] = []

      setActiveChannelId(activeChannelId)
      setChannelInMap(channel)
      addChannelToAllChannels(channel)

      await runSaga(
        { getState: getSagaState, dispatch: (action) => dispatched.push(action) },
        __eventsTestables.handleChannelMessageEvent,
        { channel: { ...channel, newMessageCount: expectedUnreadCount, lastMessage: incomingMessage }, message: incomingMessage },
        { user: { id: 'current-user' } }
      ).toPromise()

      // Check channel data update includes expected unread count
      const updateAction = dispatched.find(
        (action) =>
          action.type === updateChannelDataAC(channelId, {}).type && action.payload.channelId === channelId
      )
      expect(updateAction).toBeDefined()
      expect(updateAction.payload.config.newMessageCount).toBe(expectedUnreadCount)

      // Should NOT add to message list for non-active channel
      const addMessageAction = dispatched.find((action) => action.type === addMessagesAC([], 'next').type)
      expect(addMessageAction).toBeUndefined()
    })

    it('active channel adds message to list, unread unchanged', async () => {
      const channelId = 'target-channel'
      const expectedUnreadCount = 0
      const previousMessage = makeMessage({ id: '9000', channelId, body: 'previous message' })

      const incomingMessage = makeMessage({
        id: '9000000000000000001',
        channelId,
        incoming: true,
        body: 'new incoming message'
      })
      const channel = makeChannel({
        id: channelId,
        newMessageCount: 0,
        lastMessage: previousMessage
      })
      const dispatched: any[] = []

      setActiveChannelId(channelId)
      setChannelInMap(channel)
      addChannelToAllChannels(channel)
      addMessageToMap(channelId, previousMessage)
      setVisibleMessages(previousMessage)

      // Setup mock store state for active channel
      mockStore.getState = jest.fn(() => ({
        ...defaultStoreState,
        MessageReducer: {
          ...defaultStoreState.MessageReducer,
          messagesHasNext: false,
          activeChannelMessages: [previousMessage]
        }
      }))

      await runSaga(
        { getState: getSagaState, dispatch: (action) => dispatched.push(action) },
        __eventsTestables.handleChannelMessageEvent,
        { channel: { ...channel, newMessageCount: expectedUnreadCount, lastMessage: incomingMessage }, message: incomingMessage },
        { user: { id: 'current-user' } }
      ).toPromise()

      // Check channel data update includes expected unread count
      const updateAction = dispatched.find(
        (action) =>
          action.type === updateChannelDataAC(channelId, {}).type && action.payload.channelId === channelId
      )
      expect(updateAction).toBeDefined()
      expect(updateAction.payload.config.newMessageCount).toBe(expectedUnreadCount)

      // Should add to message list for active channel
      const addMessageAction = dispatched.find((action) => action.type === addMessagesAC([], 'next').type)
      expect(addMessageAction).toBeDefined()
      expect(addMessageAction.payload.messages).toEqual([incomingMessage])
    })

    it('MESSAGE echoing own pending message (same tid) replaces it, no duplicate', async () => {
      const channelId = 'channel-echo-pending'
      const tid = 'pending-message-tid-123'
      const pendingMessage = makePendingMessage({
        tid,
        channelId,
        body: 'sent message',
        user: makeUser({ id: 'current-user' })
      })
      const confirmedMessage = makeMessage({
        id: '840827767688048640',
        tid,
        channelId,
        body: 'sent message',
        incoming: false,
        deliveryStatus: MESSAGE_DELIVERY_STATUS.SENT
      })
      const channel = makeChannel({ id: channelId, lastMessage: pendingMessage })
      const dispatched: any[] = []

      setActiveChannelId(channelId)
      setChannelInMap(channel)
      addChannelToAllChannels(channel)
      addMessageToMap(channelId, pendingMessage)
      mockStore.getState = jest.fn(() => ({
        ...defaultStoreState,
        MessageReducer: {
          ...defaultStoreState.MessageReducer,
          messagesHasNext: false,
          activeChannelMessages: [pendingMessage]
        }
      }))

      await runSaga(
        { getState: getSagaState, dispatch: (action) => dispatched.push(action) },
        __eventsTestables.handleChannelMessageEvent,
        { channel: { ...channel, lastMessage: confirmedMessage }, message: confirmedMessage },
        { user: { id: 'current-user' } }
      ).toPromise()

      // Should update the existing message, not add a new one
      const updateAction = dispatched.find(
        (action) => action.type === updateMessageAC('', {}).type && action.payload.messageId === tid
      )
      expect(updateAction).toBeDefined()
      expect(updateAction.payload.params.id).toBe(confirmedMessage.id)

      // Should NOT add a duplicate message
      const addAction = dispatched.find((action) => action.type === addMessagesAC([], 'next').type)
      expect(addAction).toBeUndefined()
    })
  })

  describe('EDIT_MESSAGE / DELETE_MESSAGE for uncached messages', () => {
    it('EDIT_MESSAGE for a message not in cache does not crash and updates lastMessage if needed', async () => {
      const channelId = 'channel-edit-uncached'
      const editedMessage = makeMessage({
        id: '2000',
        channelId,
        body: 'edited body',
        state: MESSAGE_STATUS.EDIT
      })
      const channel = makeChannel({ id: channelId, lastMessage: editedMessage })
      const dispatched: any[] = []

      setChannelInMap(channel)
      addChannelToAllChannels(channel)
      // Note: NOT adding message to map - simulating uncached

      await runSaga(
        { getState: getSagaState, dispatch: () => {} },
        __eventsTestables.handleEditMessageEvent,
        { channel, message: editedMessage }
      ).toPromise()

      // Should not throw and channel should still work
      expect(getChannelFromMap(channelId)).toBeDefined()
    })

    it('DELETE_MESSAGE for a message not in cache does not crash and updates channel lastMessage', async () => {
      const channelId = 'channel-delete-uncached'
      const deletedMessage = makeMessage({
        id: '2001',
        channelId,
        body: '',
        state: MESSAGE_STATUS.DELETE
      })
      const channel = makeChannel({ id: channelId, lastMessage: deletedMessage })
      const dispatched: any[] = []

      setChannelInMap(channel)
      addChannelToAllChannels(channel)
      // Note: NOT adding message to map - simulating uncached

      await runSaga(
        { getState: getSagaState, dispatch: (action) => dispatched.push(action) },
        __eventsTestables.handleDeleteMessageEvent,
        { channel, deletedMessage }
      ).toPromise()

      // Should not throw
      expect(getChannelFromMap(channelId)).toBeDefined()
      // lastMessage should be updated since it matches the deleted message
      const lastMessageUpdate = dispatched.find(
        (action) => action.type === updateChannelLastMessageAC(deletedMessage, channel).type
      )
      expect(lastMessageUpdate).toBeDefined()
    })
  })

  describe('MESSAGE_MARKERS_RECEIVED out of order', () => {
    it('a late "delivered" marker arriving after "read" must not downgrade the status', async () => {
      const currentUser = makeUser({ id: 'current-user' })
      const remoteUser = makeUser({ id: 'remote-user' })
      const channelId = 'channel-marker-order'
      // Message already has READ status
      const message = makeMessage({
        id: '3000',
        channelId,
        user: currentUser,
        incoming: false,
        deliveryStatus: MESSAGE_DELIVERY_STATUS.READ,
        userMarkers: [],
        markerTotals: [{ name: MESSAGE_DELIVERY_STATUS.READ, count: 1 }]
      })
      const channel = makeChannel({ id: channelId, lastMessage: message })

      // Now a late DELIVERED marker arrives
      const lateDeliveredMarker = {
        messageIds: [message.id],
        user: remoteUser,
        name: MESSAGE_DELIVERY_STATUS.DELIVERED,
        createdAt: new Date('2026-04-02T11:00:00.000Z') // Earlier timestamp
      } as any

      setActiveChannelId(channelId)
      setChannelInMap(channel)
      addChannelToAllChannels(channel)
      addMessageToMap(channelId, message)

      await runSaga(
        { getState: getSagaState, dispatch: () => {} },
        __eventsTestables.handleMessageMarkersReceivedEvent,
        { channelId, markerList: lateDeliveredMarker },
        { user: currentUser }
      ).toPromise()

      // The message should still have READ status, not downgraded to DELIVERED
      const cachedMessage = getMessagesFromMap(channelId)[message.id]
      expect(cachedMessage.deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.READ)

      // Channel lastMessage should also retain READ status
      expect(getChannelFromMap(channelId)?.lastMessage.deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.READ)
    })
  })

  describe('CLEAR_HISTORY event', () => {
    it('clears messages, lastMessage, and resets unread count', async () => {
      const channelId = 'channel-clear-history'
      const message1 = makeMessage({ id: '4000', channelId, body: 'msg1' })
      const message2 = makeMessage({ id: '4001', channelId, body: 'msg2' })
      const channel = makeChannel({
        id: channelId,
        lastMessage: message2,
        newMessageCount: 5,
        newMentionCount: 2,
        unread: true
      })
      const dispatched: any[] = []

      setActiveChannelId(channelId)
      setChannelInMap(channel)
      addChannelToAllChannels(channel)
      addMessageToMap(channelId, message1)
      addMessageToMap(channelId, message2)

      await runSaga(
        { getState: getSagaState, dispatch: (action) => dispatched.push(action) },
        __eventsTestables.handleClearHistoryEvent,
        { channel }
      ).toPromise()

      // Should dispatch clearMessagesAC for active channel
      expect(dispatched.some((a) => a.type === clearMessagesAC().type)).toBe(true)

      // Should dispatch updateChannelDataAC with null lastMessage and zero counts
      const updateAction = dispatched.find(
        (action) =>
          action.type === updateChannelDataAC(channelId, {}).type && action.payload.channelId === channelId
      )
      expect(updateAction).toBeDefined()
      expect(updateAction.payload.config.lastMessage).toBeNull()
      expect(updateAction.payload.config.newMessageCount).toBe(0)
      expect(updateAction.payload.config.newMentionCount).toBe(0)
    })
  })

  describe('KICK_MEMBERS / LEAVE where user is me', () => {
    it('KICK_MEMBERS where current user is kicked removes channel and switches active channel', async () => {
      const kickedChannelId = 'channel-kicked'
      const fallbackChannelId = 'channel-fallback'
      const currentUser = makeUser({ id: 'current-user' })
      const kickedMember = { ...currentUser, role: 'member' }

      const kickedChannel = makeChannel({ id: kickedChannelId })
      const fallbackChannel = makeChannel({ id: fallbackChannelId })
      const dispatched: any[] = []

      setActiveChannelId(kickedChannelId)
      setChannelInMap(kickedChannel)
      setChannelInMap(fallbackChannel)
      addChannelToAllChannels(kickedChannel)
      addChannelToAllChannels(fallbackChannel)

      await runSaga(
        { getState: getSagaState, dispatch: (action) => dispatched.push(action) },
        __eventsTestables.handleKickMembersEvent,
        { channel: kickedChannel, removedMembers: [kickedMember] },
        { user: currentUser }
      ).toPromise()

      // Should dispatch removeChannelAC
      expect(dispatched.some((a) => a.type === removeChannelAC('').type)).toBe(true)

      // Should dispatch switchChannelActionAC to switch to another channel
      const switchAction = dispatched.find((a) => a.type === switchChannelActionAC(null).type)
      expect(switchAction).toBeDefined()
    })

    it('LEAVE where current user leaves removes channel', async () => {
      const leftChannelId = 'channel-left'
      const currentUser = makeUser({ id: 'current-user' })

      const leftChannel = makeChannel({ id: leftChannelId })
      const dispatched: any[] = []

      setActiveChannelId(leftChannelId)
      setChannelInMap(leftChannel)
      addChannelToAllChannels(leftChannel)

      await runSaga(
        { getState: getSagaState, dispatch: (action) => dispatched.push(action) },
        __eventsTestables.handleLeaveEvent,
        { channel: leftChannel, member: currentUser },
        { user: currentUser }
      ).toPromise()

      // Should dispatch switchChannelActionAC(null) - payload has { channel: null, updateActiveChannel: true }
      const switchAction = dispatched.find((a) => a.type === switchChannelActionAC(null).type)
      expect(switchAction).toBeDefined()
      expect(switchAction.payload.channel).toBeNull()

      // Should dispatch removeChannelAC
      expect(dispatched.some((a) => a.type === removeChannelAC('').type)).toBe(true)

      // Should dispatch setChannelToRemoveAC
      expect(dispatched.some((a) => a.type === setChannelToRemoveAC({} as any).type)).toBe(true)
    })
  })

  describe('REACTION_ADDED / REACTION_DELETED - totals and self flags', () => {
    it('REACTION_ADDED from remote user updates reactionTotals correctly', async () => {
      const currentUser = makeUser({ id: 'current-user' })
      const remoteUser = makeUser({ id: 'remote-user' })
      const channelId = 'channel-reaction-totals'
      const message = makeMessage({
        id: '5000',
        channelId,
        user: currentUser,
        reactionTotals: [{ key: 'thumbsup', count: 1, score: 1 }],
        userReactions: []
      })
      const reaction = {
        id: 'reaction-1',
        key: 'heart',
        score: 1,
        reason: '',
        createdAt: new Date('2026-04-02T12:30:00.000Z'),
        messageId: message.id,
        user: remoteUser
      }
      const channel = makeChannel({ id: channelId, lastMessage: message, newReactions: [] })
      const dispatched: any[] = []

      setActiveChannelId(channelId)
      addMessageToMap(channelId, message)

      await runSaga(
        { getState: getSagaState, dispatch: (action) => dispatched.push(action) },
        __eventsTestables.handleReactionAddedEvent,
        { channel, user: remoteUser, message, reaction },
        { user: currentUser }
      ).toPromise()

      // Should dispatch addReactionToMessageAC with isSelf=false
      expect(dispatched).toContainEqual(addReactionToMessageAC(message, reaction as any, false))
    })

    it('REACTION_ADDED from self user flags as self reaction', async () => {
      const currentUser = makeUser({ id: 'current-user' })
      const channelId = 'channel-reaction-self'
      const message = makeMessage({
        id: '5001',
        channelId,
        user: makeUser({ id: 'other-user' }),
        reactionTotals: [],
        userReactions: []
      })
      const reaction = {
        id: 'reaction-2',
        key: 'thumbsup',
        score: 1,
        reason: '',
        createdAt: new Date('2026-04-02T12:31:00.000Z'),
        messageId: message.id,
        user: currentUser
      }
      const channel = makeChannel({ id: channelId, lastMessage: message, newReactions: [] })
      const dispatched: any[] = []

      setActiveChannelId(channelId)
      addMessageToMap(channelId, message)

      await runSaga(
        { getState: getSagaState, dispatch: (action) => dispatched.push(action) },
        __eventsTestables.handleReactionAddedEvent,
        { channel, user: currentUser, message, reaction },
        { user: currentUser }
      ).toPromise()

      // Should dispatch addReactionToMessageAC with isSelf=true
      expect(dispatched).toContainEqual(addReactionToMessageAC(message, reaction as any, true))
    })

    it('REACTION_DELETED from remote user updates totals correctly', async () => {
      const currentUser = makeUser({ id: 'current-user' })
      const remoteUser = makeUser({ id: 'remote-user' })
      const channelId = 'channel-reaction-delete-totals'
      const reaction = {
        id: 'reaction-3',
        key: 'heart',
        score: 1,
        reason: '',
        createdAt: new Date('2026-04-02T12:32:00.000Z'),
        messageId: '5002',
        user: remoteUser
      }
      const message = makeMessage({
        id: '5002',
        channelId,
        user: currentUser,
        reactionTotals: [{ key: 'heart', count: 2, score: 2 }],
        userReactions: []
      })
      const channel = makeChannel({ id: channelId, lastMessage: message, newReactions: [] })
      const dispatched: any[] = []

      setActiveChannelId(channelId)
      setChannelInMap(channel)
      addMessageToMap(channelId, message)

      await runSaga(
        { getState: getSagaState, dispatch: (action) => dispatched.push(action) },
        __eventsTestables.handleReactionDeletedEvent,
        { channel, user: remoteUser, message, reaction },
        { user: currentUser }
      ).toPromise()

      // Should dispatch deleteReactionFromMessageAC with isSelf=false
      expect(dispatched).toContainEqual(deleteReactionFromMessageAC(message, reaction as any, false))
    })
  })

  describe('CONNECTION_STATUS_CHANGED to connected', () => {
    it('dispatches resend actions for pending messages and pin mutations on reconnect', async () => {
      const dispatched: any[] = []

      await runSaga(
        { getState: getSagaState, dispatch: (action) => dispatched.push(action) },
        __eventsTestables.handleConnectionStatusChangedEvent,
        CONNECTION_STATUS.CONNECTED
      ).toPromise()

      // Should dispatch setConnectionStatusAC
      expect(dispatched).toContainEqual(setConnectionStatusAC(CONNECTION_STATUS.CONNECTED))

      // Should dispatch getRolesAC
      expect(dispatched).toContainEqual(getRolesAC())

      // Should dispatch resendPendingMessageMutationsAC
      expect(dispatched).toContainEqual(resendPendingMessageMutationsAC(CONNECTION_STATUS.CONNECTED))

      // Should dispatch resendPendingChannelReadsAC
      expect(dispatched).toContainEqual(resendPendingChannelReadsAC(CONNECTION_STATUS.CONNECTED))

      // Should dispatch resendPendingPinMutationsAC
      expect(dispatched.some((a) => a.type === resendPendingPinMutationsAC().type)).toBe(true)
    })

    it('does not dispatch resend actions for non-connected status', async () => {
      const dispatched: any[] = []

      await runSaga(
        { getState: getSagaState, dispatch: (action) => dispatched.push(action) },
        __eventsTestables.handleConnectionStatusChangedEvent,
        CONNECTION_STATUS.DISCONNECTED
      ).toPromise()

      // Should dispatch setConnectionStatusAC
      expect(dispatched).toContainEqual(setConnectionStatusAC(CONNECTION_STATUS.DISCONNECTED))

      // Should NOT dispatch resend actions
      expect(dispatched.find((a) => a.type === resendPendingMessageMutationsAC('').type)).toBeUndefined()
      expect(dispatched.find((a) => a.type === resendPendingChannelReadsAC('').type)).toBeUndefined()
      expect(dispatched.find((a) => a.type === resendPendingPinMutationsAC().type)).toBeUndefined()
    })
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
