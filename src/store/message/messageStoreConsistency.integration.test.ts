/**
 * Integration tests: the message stores stay consistent (UIKit plan, Phase 2).
 *
 * After send, receive, edit, delete, reactions, reconnect and chat switches,
 * these must agree with each other and with the server:
 *   - the visible message list (Redux activeChannelMessages),
 *   - the message cache (messagesMap),
 *   - the chat list preview (ChannelReducer channels: lastReactedMessage || lastMessage).
 *
 * Real Redux store with every real saga and reducer; only the server is fake.
 * Covers WAAF-1536 (sent message duplicated), WAAF-3063 (messages missing after
 * a message from mobile), WAAF-3462 (edited reacted message not updated in the
 * chat list), WAAF-3457 (deleted reacted message stays in the chat list).
 */
import { runSaga } from 'redux-saga'
import { getMessageFromMap, getMessagesFromMap } from '../../helpers/messagesHalper'
import { MESSAGE_DELIVERY_STATUS, MESSAGE_STATUS } from '../../helpers/constants'
import { makeUser } from '../../testUtils/messageFixtures'
import { IMessage } from '../../types'
import {
  handleChannelMessageEvent,
  handleDeleteMessageEvent,
  handleEditMessageEvent,
  handleMessageMarkersReceivedEvent,
  handleReactionAddedEvent
} from '../evetns/inedx'
import { deleteMessageAC, editMessageAC, sendTextMessageAC } from './actions'
import { CONNECTION_STATUS } from '../user/constants'
import {
  store,
  sleep,
  ids,
  state,
  visibleIds,
  fake,
  syncChatList,
  goOffline,
  goOnline,
  openChat,
  expectNoDuplicates,
  setupPrefetchIntegration,
  waitUntil
} from '../../testUtils/prefetchIntegrationHarness'

// setupTests replaces the store with a stub; these tests need the real one.
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

/** Runs a real-time event handler against the real store (as the SDK event loop does). */
const emit = (handler: any, args: any) =>
  runSaga(
    { dispatch: (action: any) => store.dispatch(action), getState: () => store.getState() },
    handler,
    args,
    fake.server.client()
  ).toPromise()

const serverChannel = (channelId: string) => ({ ...fake.server.channels[channelId] })
const serverMessage = (channelId: string, id: string) =>
  (fake.server.histories[channelId] || []).find((message) => message.id === id)!

const visible = (): IMessage[] => state().MessageReducer.activeChannelMessages
const chatListEntry = (channelId: string) =>
  (state().ChannelReducer.channels || []).find((channel: any) => channel.id === channelId)
/** What the chat list row shows (Channel component: lastReactedMessage || lastMessage). */
const preview = (channelId: string) => {
  const channel = chatListEntry(channelId)
  return channel?.lastReactedMessage || channel?.lastMessage || null
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

/**
 * The open chat's visible list, the message cache and the server agree:
 * every visible message is in the cache with the same content as on the server,
 * nothing is duplicated, and the list is in order.
 */
const expectOpenChatConsistent = (channelId: string) => {
  expectNoDuplicates()
  const tids = visible()
    .map((message) => message.tid)
    .filter(Boolean)
  expect(new Set(tids).size).toBe(tids.length)
  const confirmed = visible().filter((message) => !!message.id)
  expect(confirmed.map((message) => message.id)).toEqual(
    [...confirmed.map((message) => message.id)].sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1))
  )
  confirmed.forEach((message) => {
    const cached = getMessageFromMap(channelId, message.id)
    expect(getMessagesFromMap(channelId)[message.id]).toBe(cached)
    if (message.tid) {
      expect(getMessagesFromMap(channelId)[message.tid]).toBeUndefined()
    }
    const onServer = serverMessage(channelId, message.id)
    expect({ id: message.id, inCache: !!cached }).toEqual({ id: message.id, inCache: true })
    expect([cached.body, cached.state]).toEqual([message.body, message.state])
    expect([message.body, message.state]).toEqual([onServer.body, onServer.state])
  })
}

describe('integration: message stores stay consistent', () => {
  describe('confirmed message delivery status', () => {
    const send = async () => {
      fake.server.addChat('chat-x', 1000, 5)
      fake.server.addChat('chat-a', 1, 3)
      await syncChatList()
      await openChat('chat-x')
      store.dispatch(sendTextMessageAC(textInput('delivery test'), 'chat-x', CONNECTION_STATUS.CONNECTED) as any)
      await waitUntil(
        () => visible().some((message) => !!message.id && message.body === 'delivery test'),
        'send confirmation'
      )
      return fake.server.lastMessage('chat-x')!
    }

    const receiveMarker = async (sent: IMessage, name: string, serverStatus = name) => {
      // The server's current status can be newer than a delayed marker event.
      const updated = { ...serverMessage('chat-x', sent.id), deliveryStatus: serverStatus }
      fake.server.histories['chat-x'] = fake.server.histories['chat-x'].map((message) =>
        message.id === sent.id ? updated : message
      )
      fake.server.channels['chat-x'] = { ...serverChannel('chat-x'), lastMessage: updated }
      await emit(handleMessageMarkersReceivedEvent, {
        channelId: 'chat-x',
        markerList: { name, messageIds: [sent.id], user: makeUser({ id: 'remote-user' }), createdAt: new Date() }
      })
    }

    const expectStatus = (sent: IMessage, status: string, checkVisible = true) => {
      expect(getMessagesFromMap('chat-x')[sent.id]?.deliveryStatus).toBe(status)
      expect(getMessagesFromMap('chat-x')[sent.tid!]).toBeUndefined()
      expect(preview('chat-x')?.deliveryStatus).toBe(status)
      expect(serverMessage('chat-x', sent.id).deliveryStatus).toBe(status)
      if (checkVisible) {
        expect(visible().find((message) => message.id === sent.id)?.deliveryStatus).toBe(status)
        expectOpenChatConsistent('chat-x')
      }
    }

    it('keeps sent, delivered and read consistent, including a read received while another chat is open', async () => {
      const sent = await send()
      expectStatus(sent, MESSAGE_DELIVERY_STATUS.SENT)
      await receiveMarker(sent, MESSAGE_DELIVERY_STATUS.DELIVERED)
      expectStatus(sent, MESSAGE_DELIVERY_STATUS.DELIVERED)
      await openChat('chat-a')
      await receiveMarker(sent, MESSAGE_DELIVERY_STATUS.READ)
      expectStatus(sent, MESSAGE_DELIVERY_STATUS.READ, false)
      await goOffline()
      const requestsBeforeOpen = fake.server.requests.length
      await openChat('chat-x')
      expect(fake.server.requests).toHaveLength(requestsBeforeOpen)
      expectStatus(sent, MESSAGE_DELIVERY_STATUS.READ)
    })

    it('keeps read in every store when a delayed delivered marker arrives', async () => {
      const sent = await send()
      await receiveMarker(sent, MESSAGE_DELIVERY_STATUS.READ)
      expectStatus(sent, MESSAGE_DELIVERY_STATUS.READ)
      await receiveMarker(sent, MESSAGE_DELIVERY_STATUS.DELIVERED, MESSAGE_DELIVERY_STATUS.READ)
      expectStatus(sent, MESSAGE_DELIVERY_STATUS.READ)
    })

    it('keeps read from reconnect channel sync when the sent chat is subsequently opened offline', async () => {
      // A sends in X, switches away, and disconnects before B reads it.
      const sent = await send()
      expectStatus(sent, MESSAGE_DELIVERY_STATUS.SENT)
      await openChat('chat-a')
      await goOffline()

      // Only the server learns about B's read. A misses the real-time marker.
      const readMessage = { ...serverMessage('chat-x', sent.id), deliveryStatus: MESSAGE_DELIVERY_STATUS.READ }
      fake.server.histories['chat-x'] = fake.server.histories['chat-x'].map((message) =>
        message.id === sent.id ? readMessage : message
      )
      fake.server.channels['chat-x'] = { ...serverChannel('chat-x'), lastMessage: readMessage }
      expect(getMessagesFromMap('chat-x')[sent.id].deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.SENT)

      // Reconnect refreshes the preview through the channel list, without opening X.
      const requestsBeforeReconnect = fake.server.requests.length
      await goOnline()
      await waitUntil(() => preview('chat-x')?.deliveryStatus === MESSAGE_DELIVERY_STATUS.READ, 'read preview sync')
      expect(state().ChannelReducer.activeChannel.id).toBe('chat-a')
      expect(
        fake.server.requests.slice(requestsBeforeReconnect).filter((request) => request.channelId === 'chat-x')
      ).toHaveLength(0)

      // Disconnect again: reopening X must retain read without a history fetch.
      await goOffline()
      const requestsBeforeOpen = fake.server.requests.length
      await openChat('chat-x')
      expect(fake.server.requests).toHaveLength(requestsBeforeOpen)
      expect(visible().filter((message) => message.id === sent.id)).toHaveLength(1)
      expect({
        visible: visible().find((message) => message.id === sent.id)?.deliveryStatus,
        cache: getMessagesFromMap('chat-x')[sent.id]?.deliveryStatus,
        preview: preview('chat-x')?.deliveryStatus,
        server: serverMessage('chat-x', sent.id).deliveryStatus
      }).toEqual({
        visible: MESSAGE_DELIVERY_STATUS.READ,
        cache: MESSAGE_DELIVERY_STATUS.READ,
        preview: MESSAGE_DELIVERY_STATUS.READ,
        server: MESSAGE_DELIVERY_STATUS.READ
      })
    })

    it('keeps all five sent messages read after reconnect channel sync and reopening the chat offline', async () => {
      const sentMessages = [await send()]
      for (let index = 1; index < 5; index++) {
        const body = `delivery test ${index}`
        store.dispatch(sendTextMessageAC(textInput(body), 'chat-x', CONNECTION_STATUS.CONNECTED) as any)
        await waitUntil(() => visible().some((message) => !!message.id && message.body === body), 'send confirmation')
        sentMessages.push(fake.server.lastMessage('chat-x')!)
      }
      expect(sentMessages).toHaveLength(5)
      expect(new Set(sentMessages.map((message) => message.id)).size).toBe(5)
      expect(sentMessages.map((message) => getMessagesFromMap('chat-x')[message.id].deliveryStatus)).toEqual(
        Array(5).fill(MESSAGE_DELIVERY_STATUS.SENT)
      )
      await openChat('chat-a')
      await goOffline()

      // B reads the five messages while A is offline; no marker event reaches A.
      const sentIds = new Set(sentMessages.map((message) => message.id))
      fake.server.histories['chat-x'] = fake.server.histories['chat-x'].map((message) =>
        sentIds.has(message.id) ? { ...message, deliveryStatus: MESSAGE_DELIVERY_STATUS.READ } : message
      )
      const lastSent = sentMessages[sentMessages.length - 1]
      fake.server.channels['chat-x'] = {
        ...serverChannel('chat-x'),
        lastMessage: { ...serverMessage('chat-x', lastSent.id) }
      }

      // A reconnects in the other chat and learns the read status through channel sync only.
      const requestsBeforeReconnect = fake.server.requests.length
      await goOnline()
      await waitUntil(() => preview('chat-x')?.deliveryStatus === MESSAGE_DELIVERY_STATUS.READ, 'read preview sync')
      expect(state().ChannelReducer.activeChannel.id).toBe('chat-a')
      expect(
        fake.server.requests.slice(requestsBeforeReconnect).filter((request) => request.channelId === 'chat-x')
      ).toHaveLength(0)
      await goOffline()

      const requestsBeforeOpen = fake.server.requests.length
      await openChat('chat-x')
      expect(fake.server.requests).toHaveLength(requestsBeforeOpen)
      expectNoDuplicates()
      expect(
        visible()
          .filter((message) => sentIds.has(message.id))
          .map((message) => message.id)
      ).toEqual(sentMessages.map((message) => message.id))
      expect({
        visible: sentMessages.map((sent) => visible().find((message) => message.id === sent.id)?.deliveryStatus),
        cache: sentMessages.map((sent) => getMessagesFromMap('chat-x')[sent.id]?.deliveryStatus),
        server: sentMessages.map((sent) => serverMessage('chat-x', sent.id).deliveryStatus),
        preview: preview('chat-x')?.deliveryStatus
      }).toEqual({
        visible: Array(5).fill(MESSAGE_DELIVERY_STATUS.READ),
        cache: Array(5).fill(MESSAGE_DELIVERY_STATUS.READ),
        server: Array(5).fill(MESSAGE_DELIVERY_STATUS.READ),
        preview: MESSAGE_DELIVERY_STATUS.READ
      })
    })
  })

  describe('WAAF-1536: a sent message appears once', () => {
    it('send online: one message, confirmed, in the list, the cache and the chat list', async () => {
      fake.server.addChat('chat-x', 1000, 5)
      await syncChatList()
      await openChat('chat-x')

      store.dispatch(sendTextMessageAC(textInput('hello'), 'chat-x', CONNECTION_STATUS.CONNECTED) as any)
      await sleep(300)

      const sent = fake.server.lastMessage('chat-x')!
      expect(sent.body).toBe('hello')
      expect(visibleIds()).toEqual([...ids(1000, 5), sent.id])
      expect(visible().filter((message) => message.body === 'hello')).toHaveLength(1)
      expectOpenChatConsistent('chat-x')
      expect(preview('chat-x')?.id).toBe(sent.id)
    })

    it('the server echo of the sent message (same tid) does not add a second copy', async () => {
      fake.server.addChat('chat-x', 1000, 5)
      await syncChatList()
      await openChat('chat-x')
      store.dispatch(sendTextMessageAC(textInput('hello'), 'chat-x', CONNECTION_STATUS.CONNECTED) as any)
      await sleep(300)
      const sent = fake.server.lastMessage('chat-x')!

      await emit(handleChannelMessageEvent, { channel: serverChannel('chat-x'), message: { ...sent } })
      await sleep(50)

      expect(visible().filter((message) => message.body === 'hello')).toHaveLength(1)
      expect(
        Object.values(getMessagesFromMap('chat-x')).filter((message: any) => message.body === 'hello')
      ).toHaveLength(1)
      expectOpenChatConsistent('chat-x')
    })

    it('the echo arrives before the send response: still one message', async () => {
      fake.server.addChat('chat-x', 1000, 5)
      await syncChatList()
      await openChat('chat-x')
      // The SDK delivers the server's own-message event while sendMessage is still pending.
      const channel: any = fake.server.channels['chat-x']
      const originalSend = channel.sendMessage
      channel.sendMessage = async (message: any) => {
        const confirmed = await originalSend(message)
        await emit(handleChannelMessageEvent, { channel: serverChannel('chat-x'), message: { ...confirmed } })
        return confirmed
      }
      await syncChatList()

      store.dispatch(sendTextMessageAC(textInput('race'), 'chat-x', CONNECTION_STATUS.CONNECTED) as any)
      await sleep(300)

      expect(visible().filter((message) => message.body === 'race')).toHaveLength(1)
      expectOpenChatConsistent('chat-x')
    })
  })

  describe('WAAF-3063: a message sent from mobile does not make older messages disappear', () => {
    const sendFromMobile = async (channelId: string) => {
      const [own] = fake.server.appendMessages(channelId, 1005, 1, false)
      await emit(handleChannelMessageEvent, { channel: serverChannel(channelId), message: { ...own } })
      await sleep(50)
      return own
    }

    it('chat opened before (cached), user is in another chat: opening it shows history plus the new message', async () => {
      fake.server.addChat('chat-a', 1, 3)
      fake.server.addChat('chat-x', 1000, 5)
      await syncChatList()
      await openChat('chat-x')
      await openChat('chat-a')

      await sendFromMobile('chat-x')
      await openChat('chat-x')

      expect(visibleIds()).toEqual(ids(1000, 6))
      expectOpenChatConsistent('chat-x')
      expect(preview('chat-x')?.id).toBe('1005')
    })

    it('chat never opened on Web: opening it shows history plus the new message', async () => {
      fake.server.addChat('chat-a', 1, 3)
      fake.server.addChat('chat-x', 1000, 5)
      await syncChatList()
      await openChat('chat-a')

      await sendFromMobile('chat-x')
      await openChat('chat-x')

      expect(visibleIds()).toEqual(ids(1000, 6))
      expectOpenChatConsistent('chat-x')
    })

    it('chat open on Web while the mobile message arrives: appended, nothing lost', async () => {
      fake.server.addChat('chat-x', 1000, 5)
      await syncChatList()
      await openChat('chat-x')

      await sendFromMobile('chat-x')

      expect(visibleIds()).toEqual(ids(1000, 6))
      expectOpenChatConsistent('chat-x')
    })

    it('after a reconnect the chat still has all its messages', async () => {
      fake.server.addChat('chat-a', 1, 3)
      fake.server.addChat('chat-x', 1000, 5)
      await syncChatList()
      await openChat('chat-x')
      await openChat('chat-a')
      await goOffline()
      fake.server.appendMessages('chat-x', 1005, 1, false)
      await goOnline()
      await sleep(2500)

      await openChat('chat-x')

      expect(visibleIds()).toEqual(ids(1000, 6))
      expectOpenChatConsistent('chat-x')
    })
  })

  describe('WAAF-3462 / WAAF-3457: edited or deleted reacted last message in the chat list', () => {
    // Web user sends the last message; the remote user reacts to it.
    const sendAndGetReaction = async () => {
      fake.server.addChat('chat-x', 1000, 5)
      await syncChatList()
      await openChat('chat-x')
      store.dispatch(sendTextMessageAC(textInput('original'), 'chat-x', CONNECTION_STATUS.CONNECTED) as any)
      await sleep(300)
      const sent = fake.server.lastMessage('chat-x')!
      const { message, reaction } = fake.server.react('chat-x', sent.id)
      await emit(handleReactionAddedEvent, {
        channel: serverChannel('chat-x'),
        user: reaction.user,
        message: { ...message },
        reaction
      })
      await sleep(50)
      expect(preview('chat-x')?.id).toBe(sent.id)
      return sent
    }

    it('WAAF-3462: editing it updates the chat list preview, the list and the cache', async () => {
      const sent = await sendAndGetReaction()

      store.dispatch(editMessageAC('chat-x', { ...getMessageFromMap('chat-x', sent.id), body: 'edited' }) as any)
      await sleep(300)

      expect(preview('chat-x')).toEqual(expect.objectContaining({ id: sent.id, body: 'edited' }))
      expect(chatListEntry('chat-x').lastMessage).toEqual(expect.objectContaining({ id: sent.id, body: 'edited' }))
      expect(visible().find((message) => message.id === sent.id)?.body).toBe('edited')
      expectOpenChatConsistent('chat-x')
    })

    it('WAAF-3457: deleting it removes the reacted message from the chat list preview', async () => {
      const sent = await sendAndGetReaction()

      store.dispatch(deleteMessageAC('chat-x', sent.id, 'forEveryone') as any)
      await sleep(300)

      expect(chatListEntry('chat-x').lastReactedMessage || null).toBeNull()
      expect(preview('chat-x')).toEqual(expect.objectContaining({ id: sent.id, state: MESSAGE_STATUS.DELETE }))
      expect(visible().find((message) => message.id === sent.id)?.state).toBe(MESSAGE_STATUS.DELETE)
      expectOpenChatConsistent('chat-x')
    })

    it('edit while offline: shown at once, and after reconnect everything matches the server', async () => {
      const sent = await sendAndGetReaction()
      await goOffline()

      store.dispatch(
        editMessageAC('chat-x', { ...getMessageFromMap('chat-x', sent.id), body: 'edited offline' }) as any
      )
      await sleep(100)
      expect(visible().find((message) => message.id === sent.id)?.body).toBe('edited offline')
      expect(preview('chat-x')?.body).toBe('edited offline')

      await goOnline()
      await sleep(1000)

      expect(serverMessage('chat-x', sent.id).body).toBe('edited offline')
      expect(preview('chat-x')?.body).toBe('edited offline')
      expectOpenChatConsistent('chat-x')
    })

    it('delete while offline: shown at once, and after reconnect everything matches the server', async () => {
      const sent = await sendAndGetReaction()
      await goOffline()

      store.dispatch(deleteMessageAC('chat-x', sent.id, 'forEveryone') as any)
      await sleep(100)
      expect(visible().find((message) => message.id === sent.id)?.state).toBe(MESSAGE_STATUS.DELETE)

      await goOnline()
      await sleep(1000)

      expect(serverMessage('chat-x', sent.id).state).toBe(MESSAGE_STATUS.DELETE)
      expect(chatListEntry('chat-x').lastReactedMessage || null).toBeNull()
      expectOpenChatConsistent('chat-x')
    })
  })

  describe('edits and deletes from the other user', () => {
    it('in the open chat: the list, the cache and the chat list preview all update', async () => {
      fake.server.addChat('chat-x', 1000, 5)
      await syncChatList()
      await openChat('chat-x')

      const edited = { ...serverMessage('chat-x', '1004'), body: 'edited by them', state: MESSAGE_STATUS.EDIT }
      fake.server.histories['chat-x'] = fake.server.histories['chat-x'].map((m) => (m.id === '1004' ? edited : m))
      fake.server.channels['chat-x'] = { ...fake.server.channels['chat-x'], lastMessage: edited }
      await emit(handleEditMessageEvent, { channel: serverChannel('chat-x'), message: { ...edited } })
      await sleep(50)

      expect(preview('chat-x')?.body).toBe('edited by them')
      expectOpenChatConsistent('chat-x')
    })

    it('in a chat that is not open: the cache is updated, so opening it shows the change', async () => {
      fake.server.addChat('chat-a', 1, 3)
      fake.server.addChat('chat-x', 1000, 5)
      await syncChatList()
      await openChat('chat-x')
      await openChat('chat-a')

      const deleted = {
        ...serverMessage('chat-x', '1002'),
        body: '',
        state: MESSAGE_STATUS.DELETE,
        type: 'deleted'
      }
      fake.server.histories['chat-x'] = fake.server.histories['chat-x'].map((m) => (m.id === '1002' ? deleted : m))
      await emit(handleDeleteMessageEvent, { channel: serverChannel('chat-x'), deletedMessage: { ...deleted } })
      await sleep(50)
      expect(getMessageFromMap('chat-x', '1002')?.state).toBe(MESSAGE_STATUS.DELETE)

      await goOffline()
      await openChat('chat-x')

      expect(visible().find((message) => message.id === '1002')?.state).toBe(MESSAGE_STATUS.DELETE)
      expectOpenChatConsistent('chat-x')
    })
  })

  describe('unsent messages', () => {
    it('sent offline, chat switched away and back: shown once as pending, then once confirmed after reconnect', async () => {
      fake.server.addChat('chat-a', 1, 3)
      fake.server.addChat('chat-x', 1000, 5)
      await syncChatList()
      await openChat('chat-x')
      await goOffline()

      store.dispatch(sendTextMessageAC(textInput('offline'), 'chat-x', CONNECTION_STATUS.DISCONNECTED) as any)
      await sleep(100)
      await openChat('chat-a')
      await openChat('chat-x')

      const pending = visible().filter((message) => message.body === 'offline')
      expect(pending).toHaveLength(1)
      expect(pending[0].id).toBeFalsy()

      await goOnline()
      await sleep(1500)

      const confirmed = visible().filter((message) => message.body === 'offline')
      expect(confirmed).toHaveLength(1)
      expect(confirmed[0].id).toBe(fake.server.lastMessage('chat-x')!.id)
      expect(fake.server.histories['chat-x'].filter((message) => message.body === 'offline')).toHaveLength(1)
      expectOpenChatConsistent('chat-x')
      expect(preview('chat-x')?.body).toBe('offline')
    })
  })

  describe('switching chats', () => {
    it('going back and forth keeps each chat identical to its cache and the server', async () => {
      fake.server.addChat('chat-a', 1, 3)
      fake.server.addChat('chat-x', 1000, 5)
      await syncChatList()

      for (let round = 0; round < 3; round++) {
        await openChat('chat-x')
        expect(visibleIds()).toEqual(ids(1000, 5))
        expectOpenChatConsistent('chat-x')
        await openChat('chat-a')
        expect(visibleIds()).toEqual(ids(1, 3))
        expectOpenChatConsistent('chat-a')
      }
    })
  })
})
