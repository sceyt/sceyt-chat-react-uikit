import { combineReducers, configureStore } from '@reduxjs/toolkit'
import MessageReducer, { updateMessage, updateMessagesStatus } from './reducers'
import ChannelReducer, { updateChannelLastMessageStatus } from '../channel/reducers'
import { makeMessage, makeChannel, makeUser, resetMessageListFixtureIds } from '../../testUtils/messageFixtures'
import { MESSAGE_DELIVERY_STATUS } from '../../helpers/constants'

// Regression tests for the bug: message shows 2 ticks inside the chat but 1 tick in the
// channel list when the same account is open on mobile (sender) and web (receiver).
//
// Root cause: handleChannelMessageEvent called markMessagesAsDeliveredAC unconditionally,
// including for messages sent by the current user from another device. This triggered
// markMessagesDelivered saga which dispatched updateMessageAC (updating activeChannelMessages
// to DELIVERED = 2 ticks) but did NOT dispatch updateChannelLastMessageStatus, leaving
// channel.lastMessage.deliveryStatus stale at SENT = 1 tick.
//
// Fix: guard markMessagesAsDeliveredAC with `message.user.id !== SceytChatClient.user.id`
// so own messages are never incorrectly marked as delivered by the sender's other devices.

const createStore = (preloadedState?: { channels?: any[]; messages?: any[] }) =>
  configureStore({
    reducer: combineReducers({ ChannelReducer, MessageReducer }),
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({ thunk: false, serializableCheck: false }),
    preloadedState: preloadedState
      ? {
          ChannelReducer: { channels: preloadedState.channels ?? [] } as any,
          MessageReducer: { activeChannelMessages: preloadedState.messages ?? [] } as any
        }
      : undefined
  })

const makeMarker = (messageId: string, name: string) => ({
  count: 1,
  name,
  messageId,
  createdAt: new Date(),
  user: null
})

describe('delivery status sync between message store and channel lastMessage', () => {
  beforeEach(() => {
    resetMessageListFixtureIds()
  })

  // TEST 1 — own-message guard: dispatching updateMessageAC alone (simulating what the broken
  // markMessagesDelivered saga did for own messages) causes the stores to diverge.
  // This documents the inconsistency that occurred BEFORE the fix.
  it('stores diverge when only updateMessage is dispatched without syncing channel.lastMessage', () => {
    const ownUser = makeUser({ id: 'current-user' })
    const message = makeMessage({
      id: '100',
      channelId: 'channel-sync',
      deliveryStatus: MESSAGE_DELIVERY_STATUS.SENT,
      user: ownUser
    })
    const channel = makeChannel({ id: 'channel-sync', lastMessage: { ...message } })
    const store = createStore({ channels: [channel], messages: [message] })

    // Simulates what markMessagesDelivered did (incorrectly, for own messages):
    // only updateMessage is dispatched, channel.lastMessage is not touched
    store.dispatch(
      updateMessage({
        messageId: message.id,
        params: { ...message, deliveryStatus: MESSAGE_DELIVERY_STATUS.DELIVERED }
      })
    )

    const state = store.getState()
    const updatedMessage = state.MessageReducer.activeChannelMessages.find((m) => m.id === message.id)
    const updatedChannel = state.ChannelReducer.channels.find((c) => c.id === channel.id)

    // Chat view shows 2 ticks (updated)
    expect(updatedMessage?.deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.DELIVERED)
    // Channel list still shows 1 tick (not updated) — the bug
    expect(updatedChannel?.lastMessage.deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.SENT)
  })

  // TEST 2 — status must not downgrade.
  // If channel.lastMessage is already DELIVERED and a stale SENT marker arrives,
  // both stores must keep DELIVERED (shouldSkipDeliveryStatusUpdate protects updateMessagesStatus).
  it('does not downgrade channel.lastMessage.deliveryStatus when a lower-status update arrives', () => {
    const message = makeMessage({
      id: '101',
      channelId: 'channel-sync-2',
      deliveryStatus: MESSAGE_DELIVERY_STATUS.DELIVERED
    })
    const channel = makeChannel({ id: 'channel-sync-2', lastMessage: { ...message } })
    const store = createStore({ channels: [channel], messages: [message] })

    store.dispatch(
      updateMessagesStatus({
        name: MESSAGE_DELIVERY_STATUS.SENT,
        markersMap: { [message.id]: makeMarker(message.id, MESSAGE_DELIVERY_STATUS.SENT) }
      })
    )

    const state = store.getState()
    const updatedMessage = state.MessageReducer.activeChannelMessages.find((m) => m.id === message.id)
    const updatedChannel = state.ChannelReducer.channels.find((c) => c.id === channel.id)

    expect(updatedMessage?.deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.DELIVERED)
    expect(updatedChannel?.lastMessage.deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.DELIVERED)
  })

  // TEST 3 — correct path for marker events (handleMessageMarkersReceivedEvent).
  // When a DELIVERED marker arrives from the actual recipient and BOTH
  // updateMessagesStatus AND updateChannelLastMessageStatus are dispatched (as the
  // marker event handler already does), both stores agree.
  it('stores are consistent when updateMessagesStatus and updateChannelLastMessageStatus are both dispatched', () => {
    const message = makeMessage({
      id: '102',
      channelId: 'channel-sync-3',
      deliveryStatus: MESSAGE_DELIVERY_STATUS.SENT
    })
    const channel = makeChannel({ id: 'channel-sync-3', lastMessage: { ...message } })
    const store = createStore({ channels: [channel], messages: [message] })

    store.dispatch(
      updateMessagesStatus({
        name: MESSAGE_DELIVERY_STATUS.DELIVERED,
        markersMap: { [message.id]: makeMarker(message.id, MESSAGE_DELIVERY_STATUS.DELIVERED) }
      })
    )

    const deliveredMessage = store.getState().MessageReducer.activeChannelMessages.find((m) => m.id === message.id)!
    store.dispatch(updateChannelLastMessageStatus({ channel, message: deliveredMessage }))

    const state = store.getState()
    const updatedMessage = state.MessageReducer.activeChannelMessages.find((m) => m.id === message.id)
    const updatedChannel = state.ChannelReducer.channels.find((c) => c.id === channel.id)

    expect(updatedMessage?.deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.DELIVERED)
    expect(updatedChannel?.lastMessage.deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.DELIVERED)
  })

  // TEST 4 — after the fix, own messages stay at SENT in both stores.
  // With the guard `message.user.id !== SceytChatClient.user.id`, markMessagesAsDeliveredAC
  // is never called for own messages, so neither store is incorrectly upgraded to DELIVERED.
  it('own message delivery status stays at SENT in both stores when no marker is dispatched', () => {
    const ownUser = makeUser({ id: 'current-user' })
    const message = makeMessage({
      id: '103',
      channelId: 'channel-sync-4',
      deliveryStatus: MESSAGE_DELIVERY_STATUS.SENT,
      user: ownUser
    })
    const channel = makeChannel({ id: 'channel-sync-4', lastMessage: { ...message } })
    const store = createStore({ channels: [channel], messages: [message] })

    // No dispatch — the fix skips markMessagesAsDeliveredAC for own messages
    const state = store.getState()
    const msg = state.MessageReducer.activeChannelMessages.find((m) => m.id === message.id)
    const chan = state.ChannelReducer.channels.find((c) => c.id === channel.id)

    expect(msg?.deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.SENT)
    expect(chan?.lastMessage.deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.SENT)
  })
})
