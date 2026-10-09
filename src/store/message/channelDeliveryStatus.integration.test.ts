import { runSaga } from 'redux-saga'
import { getMessagesFromMap } from '../../helpers/messagesHalper'
import { MESSAGE_DELIVERY_STATUS } from '../../helpers/constants'
import { makeUser } from '../../testUtils/messageFixtures'
import { IMessage } from '../../types'
import { handleMessageMarkersReceivedEvent } from '../evetns/inedx'
import { sendTextMessageAC, setUnreadMessageIdAC } from './actions'
import { CONNECTION_STATUS } from '../user/constants'
import {
  fake,
  goOffline,
  goOnline,
  ids,
  openChat,
  setupPrefetchIntegration,
  state,
  store,
  syncChatList,
  visibleIds,
  waitUntil
} from '../../testUtils/prefetchIntegrationHarness'

jest.unmock('store')
jest.mock('../../helpers/messageListNavigator', () => ({
  navigateToLatest: jest.fn(),
  navigateToMessage: jest.fn(),
  registerJumpToLatest: jest.fn(),
  unregisterJumpToLatest: jest.fn(),
  registerMessageListNavigator: jest.fn(),
  unregisterMessageListNavigator: jest.fn()
}))
jest.setTimeout(30000)
setupPrefetchIntegration()

const visible = (): IMessage[] => state().MessageReducer.activeChannelMessages
const preview = (channelId: string): IMessage =>
  state().ChannelReducer.channels.find((channel: any) => channel.id === channelId).lastMessage
const ownIds = ids(1000, 5)

const addOutgoingChat = (channelId: string, firstId: number, count: number) => {
  fake.server.addChat(channelId, firstId, 0)
  fake.server.appendMessages(channelId, firstId, count, false)
}

const setupChats = async () => {
  addOutgoingChat('chat-x', 1000, 5)
  fake.server.addChat('chat-a', 2000, 3)
  await syncChatList()
  await openChat('chat-x')
}

// Only the server changes. No message-marker event is emitted to the client.
const setServerStatus = (channelId: string, messageIds: string[], status: string) => {
  const targets = new Set(messageIds)
  fake.server.histories[channelId] = fake.server.histories[channelId].map((message) =>
    targets.has(message.id) ? { ...message, deliveryStatus: status } : message
  )
  fake.server.channels[channelId] = {
    ...fake.server.channels[channelId],
    lastMessage: { ...fake.server.lastMessage(channelId)! }
  }
}

const expectStatuses = (channelId: string, messageIds: string[], statuses: string[]) => {
  expect(messageIds.map((id) => getMessagesFromMap(channelId)[id]?.deliveryStatus)).toEqual(statuses)
  expect(
    messageIds.map((id) => fake.server.histories[channelId].find((message) => message.id === id)?.deliveryStatus)
  ).toEqual(statuses)
  if (state().ChannelReducer.activeChannel.id === channelId) {
    expect(messageIds.map((id) => visible().find((message) => message.id === id)?.deliveryStatus)).toEqual(statuses)
    expect(
      visible()
        .filter((message) => messageIds.includes(message.id))
        .map((message) => message.id)
    ).toEqual(messageIds)
    expect(new Set(visibleIds()).size).toBe(visibleIds().length)
  }
}

const textInput = (body: string) => ({
  body,
  bodyAttributes: [],
  attachments: [],
  mentionedUsers: [],
  type: 'text',
  pollDetails: null,
  parentMessage: null,
  repliedInThread: false,
  displayCount: 1,
  silent: false
})

describe('integration: channel sync delivery-status regressions', () => {
  it.each([MESSAGE_DELIVERY_STATUS.DELIVERED, MESSAGE_DELIVERY_STATUS.READ])(
    'restores cumulative %s offline without loading history on reconnect',
    async (status) => {
      await setupChats()
      await openChat('chat-a')
      await goOffline()
      setServerStatus('chat-x', ownIds, status)
      const requestsBeforeReconnect = fake.server.requests.length

      await goOnline()
      expect(preview('chat-x').deliveryStatus).toBe(status)
      expectStatuses('chat-x', ownIds, Array(5).fill(status))
      expect(
        fake.server.requests.slice(requestsBeforeReconnect).filter((request) => request.channelId === 'chat-x')
      ).toHaveLength(0)

      await goOffline()
      const requestsBeforeOpen = fake.server.requests.length
      await openChat('chat-x')
      expect(fake.server.requests).toHaveLength(requestsBeforeOpen)
      expectStatuses('chat-x', ownIds, Array(5).fill(status))
    }
  )

  it('repeated reconnects preserve read statuses and marker collections without duplicates', async () => {
    await setupChats()
    const markersBefore = ownIds.map((id) => {
      const message = getMessagesFromMap('chat-x')[id]
      return { totals: [...message.markerTotals], own: [...message.userMarkers] }
    })
    await openChat('chat-a')
    setServerStatus('chat-x', ownIds, MESSAGE_DELIVERY_STATUS.READ)

    for (let attempt = 0; attempt < 2; attempt++) {
      await goOffline()
      await goOnline()
      expectStatuses('chat-x', ownIds, Array(5).fill(MESSAGE_DELIVERY_STATUS.READ))
      expect(preview('chat-x').deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.READ)
    }
    expect(
      ownIds.map((id) => {
        const message = getMessagesFromMap('chat-x')[id]
        return { totals: message.markerTotals, own: message.userMarkers }
      })
    ).toEqual(markersBefore)
    await goOffline()
    await openChat('chat-x')
    expectStatuses('chat-x', ownIds, Array(5).fill(MESSAGE_DELIVERY_STATUS.READ))
  })

  it('patches the open chat without changing message order, unread anchor or pagination flags', async () => {
    await setupChats()
    store.dispatch(setUnreadMessageIdAC('1002'))
    const before = {
      ids: visibleIds(),
      bodies: visible().map((message) => message.body),
      unread: state().MessageReducer.unreadMessageId,
      hasPrev: state().MessageReducer.messagesHasPrev,
      hasNext: state().MessageReducer.messagesHasNext
    }
    const requestsBefore = fake.server.requests.length
    setServerStatus('chat-x', ownIds, MESSAGE_DELIVERY_STATUS.READ)

    await syncChatList()

    expectStatuses('chat-x', ownIds, Array(5).fill(MESSAGE_DELIVERY_STATUS.READ))
    expect(preview('chat-x').deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.READ)
    expect({
      ids: visibleIds(),
      bodies: visible().map((message) => message.body),
      unread: state().MessageReducer.unreadMessageId,
      hasPrev: state().MessageReducer.messagesHasPrev,
      hasNext: state().MessageReducer.messagesHasNext
    }).toEqual(before)
    expect(fake.server.requests).toHaveLength(requestsBefore)
  })

  it('a late delivered event cannot undo cumulative read learned through channel sync', async () => {
    await setupChats()
    setServerStatus('chat-x', ownIds, MESSAGE_DELIVERY_STATUS.READ)
    await syncChatList()

    await runSaga(
      { dispatch: (action) => store.dispatch(action), getState: () => store.getState() },
      handleMessageMarkersReceivedEvent,
      {
        channelId: 'chat-x',
        markerList: {
          name: MESSAGE_DELIVERY_STATUS.DELIVERED,
          messageIds: ['1004'],
          user: makeUser({ id: 'remote-user' }),
          createdAt: new Date('2026-04-01T12:00:00Z')
        } as any
      },
      fake.server.client()
    ).toPromise()

    expectStatuses('chat-x', ownIds, Array(5).fill(MESSAGE_DELIVERY_STATUS.READ))
    expect(preview('chat-x').deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.READ)
    await goOffline()
    await openChat('chat-a')
    await openChat('chat-x')
    expectStatuses('chat-x', ownIds, Array(5).fill(MESSAGE_DELIVERY_STATUS.READ))
  })

  it('an incoming last message marked read does not acknowledge earlier outgoing messages', async () => {
    addOutgoingChat('chat-x', 1000, 5)
    fake.server.appendMessages('chat-x', 1005, 1, true)
    await syncChatList()
    await openChat('chat-x')
    setServerStatus('chat-x', ['1005'], MESSAGE_DELIVERY_STATUS.READ)

    await syncChatList()
    await goOffline()
    const requestsBeforeOpen = fake.server.requests.length
    await openChat('chat-x')

    expect(fake.server.requests).toHaveLength(requestsBeforeOpen)
    expectStatuses('chat-x', ownIds, Array(5).fill(MESSAGE_DELIVERY_STATUS.SENT))
    expectStatuses('chat-x', ['1005'], [MESSAGE_DELIVERY_STATUS.READ])
    expect(preview('chat-x').deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.READ)
  })

  it('cumulative read updates only outgoing messages in an interleaved conversation', async () => {
    addOutgoingChat('chat-x', 1000, 5)
    fake.server.histories['chat-x'] = fake.server.histories['chat-x'].map((message) =>
      ['1001', '1003'].includes(message.id)
        ? { ...message, incoming: true, user: makeUser({ id: 'remote-user' }) }
        : message
    )
    await syncChatList()
    await openChat('chat-x')
    setServerStatus('chat-x', ['1000', '1002', '1004'], MESSAGE_DELIVERY_STATUS.READ)

    await syncChatList()
    await goOffline()
    const requestsBefore = fake.server.requests.length
    await openChat('chat-x')

    expect(fake.server.requests).toHaveLength(requestsBefore)
    expectStatuses('chat-x', ownIds, [
      MESSAGE_DELIVERY_STATUS.READ,
      MESSAGE_DELIVERY_STATUS.SENT,
      MESSAGE_DELIVERY_STATUS.READ,
      MESSAGE_DELIVERY_STATUS.SENT,
      MESSAGE_DELIVERY_STATUS.READ
    ])
    expect(
      visible()
        .filter((message) => message.incoming)
        .map((message) => message.id)
    ).toEqual(['1001', '1003'])
  })

  it('an offline pending send remains unconfirmed while earlier acknowledged messages stay read', async () => {
    await setupChats()
    setServerStatus('chat-x', ownIds, MESSAGE_DELIVERY_STATUS.READ)
    await syncChatList()
    await goOffline()
    const requestsBefore = fake.server.requests.length
    store.dispatch(sendTextMessageAC(textInput('still pending'), 'chat-x', CONNECTION_STATUS.DISCONNECTED) as any)
    await waitUntil(() => visible().some((message) => message.body === 'still pending'), 'pending send')
    const pending = visible().find((message) => message.body === 'still pending')!
    await openChat('chat-a')
    await openChat('chat-x')

    expect(fake.server.requests).toHaveLength(requestsBefore)
    expectStatuses('chat-x', ownIds, Array(5).fill(MESSAGE_DELIVERY_STATUS.READ))
    expect(visible().filter((message) => message.tid === pending.tid)).toHaveLength(1)
    expect(visible().find((message) => message.tid === pending.tid)).toEqual(
      expect.objectContaining({
        id: '',
        tid: pending.tid,
        deliveryStatus: MESSAGE_DELIVERY_STATUS.PENDING
      })
    )
    expect(getMessagesFromMap('chat-x')[pending.tid!].deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.PENDING)
    expect(fake.server.histories['chat-x'].some((message) => message.body === 'still pending')).toBe(false)
  })

  it('reading X does not update another chat with the same message IDs', async () => {
    addOutgoingChat('chat-x', 1000, 5)
    addOutgoingChat('chat-a', 1000, 5)
    await syncChatList()
    await openChat('chat-x')
    await openChat('chat-a')
    await goOffline()
    setServerStatus('chat-x', ownIds, MESSAGE_DELIVERY_STATUS.READ)

    await goOnline()

    expectStatuses('chat-x', ownIds, Array(5).fill(MESSAGE_DELIVERY_STATUS.READ))
    expectStatuses('chat-a', ownIds, Array(5).fill(MESSAGE_DELIVERY_STATUS.SENT))
    expect(preview('chat-x').deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.READ)
    expect(preview('chat-a').deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.SENT)
    await goOffline()
    await openChat('chat-x')
    expectStatuses('chat-x', ownIds, Array(5).fill(MESSAGE_DELIVERY_STATUS.READ))
    await openChat('chat-a')
    expectStatuses('chat-a', ownIds, Array(5).fill(MESSAGE_DELIVERY_STATUS.SENT))
  })

  it('a new outgoing message after read acknowledgement stays sent through sync and offline reopening', async () => {
    await setupChats()
    setServerStatus('chat-x', ownIds, MESSAGE_DELIVERY_STATUS.READ)
    await syncChatList()
    store.dispatch(sendTextMessageAC(textInput('after read'), 'chat-x', CONNECTION_STATUS.CONNECTED) as any)
    await waitUntil(
      () => visible().some((message) => !!message.id && message.body === 'after read'),
      'send confirmation'
    )
    const newest = fake.server.lastMessage('chat-x')!

    await syncChatList()
    expect(preview('chat-x').deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.SENT)
    await goOffline()
    const requestsBefore = fake.server.requests.length
    await openChat('chat-a')
    await openChat('chat-x')

    expect(fake.server.requests).toHaveLength(requestsBefore)
    expectStatuses(
      'chat-x',
      [...ownIds, newest.id],
      [...Array(5).fill(MESSAGE_DELIVERY_STATUS.READ), MESSAGE_DELIVERY_STATUS.SENT]
    )
    expect(getMessagesFromMap('chat-x')[newest.tid!]).toBeUndefined()
  })
})
