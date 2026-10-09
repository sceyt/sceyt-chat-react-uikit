import { runSaga } from 'redux-saga'
import {
  addMessageToMap,
  evictLruChannels,
  getMessagesFromMap,
  removeMessagesFromMap,
  MESSAGES_CACHE_MAX_CHANNELS,
  trackChannelVisit
} from '../../helpers/messagesHalper'
import { MESSAGE_DELIVERY_STATUS, MESSAGE_STATUS } from '../../helpers/constants'
import { makeMessage, makeUser } from '../../testUtils/messageFixtures'
import { IChannel, IMessage } from '../../types'
import { MESSAGE_TYPE } from '../../types/enum'
import { deleteMessageAC, editMessageAC } from './actions'
import {
  handleChannelMessageEvent,
  handleDeleteMessageEvent,
  handleEditMessageEvent,
  handleMessageMarkersReceivedEvent
} from '../evetns/inedx'
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

const channelId = 'chat-x'
const earlier = new Date('2026-04-02T12:00:00.000Z')
const later = new Date('2026-04-02T12:01:00.000Z')
const options = () => ({ dispatch: store.dispatch, getState: store.getState })
const channel = () => ({ ...fake.server.channels[channelId] })
const visible = (): IMessage[] => state().MessageReducer.activeChannelMessages
const preview = (): IMessage | undefined => {
  const chat: IChannel | undefined = state().ChannelReducer.channels.find((chat: IChannel) => chat.id === channelId)
  return chat?.lastReactedMessage || chat?.lastMessage
}
const replaceOnServer = (message: IMessage) => {
  fake.server.histories[channelId] = fake.server.histories[channelId].map((stored) =>
    stored.id === message.id ? message : stored
  )
  fake.server.channels[channelId] = { ...channel(), lastMessage: message }
}
const emitMessage = (message: IMessage) =>
  runSaga(
    options(),
    handleChannelMessageEvent,
    { channel: channel(), message: { ...message } },
    fake.server.client()
  ).toPromise()
const emitEdit = (message: IMessage) =>
  runSaga(options(), handleEditMessageEvent, {
    channel: { ...channel(), ...(channel().lastMessage?.id === message.id ? { lastMessage: message } : {}) },
    message: { ...message }
  }).toPromise()
const emitReceipt = (messageId: string, name = MESSAGE_DELIVERY_STATUS.READ, recipient = 'recipient') =>
  runSaga(
    options(),
    handleMessageMarkersReceivedEvent,
    {
      channelId,
      markerList: { name, messageIds: [messageId], user: makeUser({ id: recipient }), createdAt: earlier }
    },
    fake.server.client()
  ).toPromise()
const emitDelete = (deletedMessage: IMessage) =>
  runSaga(options(), handleDeleteMessageEvent, {
    channel: channel(),
    deletedMessage: { ...deletedMessage }
  }).toPromise()
const edited = (message: IMessage, body: string, updatedAt = earlier): IMessage => ({
  ...message,
  body,
  updatedAt,
  state: MESSAGE_STATUS.EDIT
})
const deleted = (message: IMessage): IMessage => ({
  ...message,
  body: '',
  type: MESSAGE_TYPE.DELETED,
  attachments: [],
  reactionTotals: [],
  state: MESSAGE_STATUS.DELETE,
  updatedAt: later
})
const expectContent = (message: IMessage) => {
  const project = (copy?: IMessage) => ({ id: copy?.id, body: copy?.body, state: copy?.state })
  const expected = project(message)
  expect({
    cache: project(getMessagesFromMap(channelId)[message.id]),
    list: project(visible().find((item) => item.id === message.id)),
    preview: project(preview())
  }).toEqual({ cache: expected, list: expected, preview: expected })
  expect(new Set(visibleIds()).size).toBe(visibleIds().length)
}
const reopenOffline = async () => {
  await goOffline()
  const requests = fake.server.requests.length
  await openChat(channelId)
  expect(fake.server.requests).toHaveLength(requests)
}

describe.each([true, false])('integration: replayed SDK events (chat open: %s)', (chatIsOpen) => {
  beforeEach(async () => {
    fake.server.addChat(channelId, 1000, 0)
    fake.server.appendMessages(channelId, 1000, 5, false)
    fake.server.addChat('chat-a', 2000, 3)
    await syncChatList()
    await openChat(channelId)
    if (!chatIsOpen) await openChat('chat-a')
  })

  it('keeps a duplicated own-message event from another device single without losing history', async () => {
    const [message] = fake.server.appendMessages(channelId, 1005, 1, false)
    await emitMessage(message)
    await emitMessage(message)
    expect(Object.keys(getMessagesFromMap(channelId)).sort()).toEqual(ids(1000, 6))
    await reopenOffline()
    expect(visibleIds()).toEqual(ids(1000, 6))
    expectContent(message)
  })

  it('keeps the newest preview when two new-message events arrive in reverse order', async () => {
    const [first, second] = fake.server.appendMessages(channelId, 1005, 2, false)
    await emitMessage(second)
    await emitMessage(first)
    expect(preview()?.id).toBe(second.id)
    await reopenOffline()
    expect(visibleIds()).toEqual(ids(1000, 7))
    expectContent(second)
  })

  it('applies a duplicated edit once and preserves it on offline reopening', async () => {
    const message = edited(fake.server.lastMessage(channelId)!, 'edited once')
    replaceOnServer(message)
    await emitEdit(message)
    await emitEdit(message)
    await reopenOffline()
    expect(visibleIds()).toEqual(ids(1000, 5))
    expectContent(message)
  })

  it('keeps a duplicated delete as one deleted message on offline reopening', async () => {
    const message = deleted(fake.server.lastMessage(channelId)!)
    replaceOnServer(message)
    await emitDelete(message)
    await emitDelete(message)
    await reopenOffline()
    expect(visibleIds()).toEqual(ids(1000, 5))
    expectContent(message)
  })

  it('counts a duplicate read marker from the same recipient once across all message stores', async () => {
    const message = {
      ...fake.server.lastMessage(channelId)!,
      deliveryStatus: MESSAGE_DELIVERY_STATUS.READ,
      markerTotals: [{ name: MESSAGE_DELIVERY_STATUS.READ, count: 1 }]
    } as IMessage
    replaceOnServer(message)
    const markerList = {
      name: MESSAGE_DELIVERY_STATUS.READ,
      messageIds: [message.id],
      messageId: message.id,
      count: 1,
      user: makeUser({ id: 'recipient' }),
      createdAt: earlier
    }
    const emit = () =>
      runSaga(options(), handleMessageMarkersReceivedEvent, { channelId, markerList }, fake.server.client()).toPromise()
    await emit()
    expect(getMessagesFromMap(channelId)[message.id].markerTotals).toEqual(message.markerTotals)
    await emit()
    await reopenOffline()
    const project = (copy?: IMessage) => ({ status: copy?.deliveryStatus, totals: copy?.markerTotals })
    const expected = project(message)
    expect({
      cache: project(getMessagesFromMap(channelId)[message.id]),
      list: project(visible().find((item) => item.id === message.id)),
      preview: project(preview())
    }).toEqual({ cache: expected, list: expected, preview: expected })
  })

  it('preserves the newer edit when the first edit event arrives again afterwards', async () => {
    const first = edited(fake.server.lastMessage(channelId)!, 'first edit')
    const second = edited(first, 'second edit', later)
    replaceOnServer(second)
    await emitEdit(second)
    expect(getMessagesFromMap(channelId)[second.id].body).toBe(second.body)
    await emitEdit(first)
    await reopenOffline()
    expectContent(second)
    expect(getMessagesFromMap(channelId)[second.id].updatedAt).toEqual(later)
  })

  it('accepts a genuinely newer edit after an older one', async () => {
    const first = edited(fake.server.lastMessage(channelId)!, 'first edit')
    const second = edited(first, 'second edit', later)
    replaceOnServer(second)
    await emitEdit(first)
    await emitEdit(second)
    await reopenOffline()
    expectContent(second)
  })

  it('counts overlapping read batches once per recipient and message', async () => {
    const messages = fake.server.histories[channelId].slice(-3)
    const emit = (messageIds: string[], recipient: string) =>
      runSaga(
        options(),
        handleMessageMarkersReceivedEvent,
        {
          channelId,
          markerList: {
            name: MESSAGE_DELIVERY_STATUS.READ,
            messageIds,
            messageId: messageIds[0],
            count: 1,
            user: makeUser({ id: recipient }),
            createdAt: earlier
          }
        },
        fake.server.client()
      ).toPromise()
    await emit(
      messages.slice(0, 2).map((message) => message.id),
      'recipient-a'
    )
    await emit(
      messages.slice(1).map((message) => message.id),
      'recipient-a'
    )
    await emit(
      messages.map((message) => message.id),
      'recipient-b'
    )
    await emit(
      messages.map((message) => message.id),
      'recipient-b'
    )
    await reopenOffline()
    for (const message of messages) {
      const total = [{ name: MESSAGE_DELIVERY_STATUS.READ, count: 2 }]
      expect(getMessagesFromMap(channelId)[message.id].markerTotals).toEqual(total)
      expect(visible().find((item) => item.id === message.id)?.markerTotals).toEqual(total)
    }
    expect(preview()?.markerTotals).toEqual([{ name: MESSAGE_DELIVERY_STATUS.READ, count: 2 }])
  })

  it('does not recount a known reader after fetching a fresh server message snapshot', async () => {
    const message = {
      ...fake.server.lastMessage(channelId)!,
      deliveryStatus: MESSAGE_DELIVERY_STATUS.READ,
      markerTotals: [{ name: MESSAGE_DELIVERY_STATUS.READ, count: 1 }]
    } as IMessage
    replaceOnServer(message)
    const markerList = {
      name: MESSAGE_DELIVERY_STATUS.READ,
      messageIds: [message.id],
      messageId: message.id,
      count: 1,
      user: makeUser({ id: 'reader-after-refresh' }),
      createdAt: earlier
    }
    const emit = () =>
      runSaga(options(), handleMessageMarkersReceivedEvent, { channelId, markerList }, fake.server.client()).toPromise()
    await emit()
    removeMessagesFromMap(channelId)
    const requests = fake.server.requests.length
    await openChat(channelId)
    expect(fake.server.requests.length).toBeGreaterThan(requests)
    await emit()
    await reopenOffline()
    for (const copy of [
      getMessagesFromMap(channelId)[message.id],
      visible().find((item) => item.id === message.id),
      preview()
    ]) {
      expect(copy?.markerTotals).toEqual(message.markerTotals)
    }
  })

  it('protects the newer preview even when the message cache has been discarded', async () => {
    const first = edited(fake.server.lastMessage(channelId)!, 'first edit')
    const second = edited(first, 'second edit', later)
    replaceOnServer(second)
    await emitEdit(second)
    removeMessagesFromMap(channelId)
    await emitEdit(first)
    expect(preview()?.body).toBe(second.body)
    expect(getMessagesFromMap(channelId)).toBeUndefined()
  })

  it.each([MESSAGE_STATUS.DELETE, MESSAGE_STATUS.EDIT])(
    'keeps a newer %s version when an earlier edit response arrives late',
    async (state) => {
      const response = edited(fake.server.lastMessage(channelId)!, 'delayed edit response')
      let resolveResponse: ((message: IMessage) => void) | undefined
      const request = jest.fn(
        () =>
          new Promise<IMessage>((resolve) => {
            resolveResponse = resolve
          })
      )
      fake.server.channels[channelId] = { ...channel(), editMessage: request }
      await syncChatList()
      store.dispatch(editMessageAC(channelId, response))
      await waitUntil(() => request.mock.calls.length === 1, 'in-flight edit')
      const known = state === MESSAGE_STATUS.DELETE ? deleted(response) : edited(response, 'newer remote edit', later)
      replaceOnServer(known)
      if (state === MESSAGE_STATUS.DELETE) await emitDelete(known)
      else await emitEdit(known)
      resolveResponse!(response)
      await reopenOffline()
      expectContent(known)
    }
  )

  it('does not roll back a queued edit after a deletion event has confirmed removal', async () => {
    const original = fake.server.lastMessage(channelId)!
    let rejectResponse: ((error: Error) => void) | undefined
    const request = jest.fn(
      () =>
        new Promise<IMessage>((_resolve, reject) => {
          rejectResponse = reject
        })
    )
    fake.server.channels[channelId] = { ...channel(), editMessage: request }
    await syncChatList()
    await goOffline()
    store.dispatch(editMessageAC(channelId, edited(original, 'queued edit')))
    await waitUntil(() => !!state().MessageReducer.pendingMessageMutations[original.id], 'queued edit')
    await goOnline()
    await waitUntil(() => request.mock.calls.length === 1, 'replayed edit in flight')
    const removed = deleted(original)
    replaceOnServer(removed)
    await emitDelete(removed)
    expect(state().MessageReducer.pendingMessageMutations[original.id]).toBeUndefined()
    rejectResponse!(new Error('message already deleted'))
    // Keep the app online while the rejection is handled. Going offline first
    // would legitimately leave the mutation for a retry and mask rollback.
    await openChat(channelId)
    await reopenOffline()
    expectContent(removed)
  })

  it.each(['edit', 'delete'] as const)(
    'restores an edited original when a queued %s fails on reconnect',
    async (kind) => {
      const original = edited(fake.server.lastMessage(channelId)!, 'original edited text')
      replaceOnServer(original)
      await emitEdit(original)
      const reject = jest.fn(async () => {
        throw new Error('forbidden')
      })
      fake.server.channels[channelId] = {
        ...channel(),
        ...(kind === 'edit' ? { editMessage: reject } : { deleteMessageById: reject })
      }
      await syncChatList()
      await goOffline()
      store.dispatch(
        kind === 'edit'
          ? editMessageAC(channelId, edited(original, 'queued text', later))
          : deleteMessageAC(channelId, original.id, 'forEveryone')
      )
      await waitUntil(() => !!state().MessageReducer.pendingMessageMutations[original.id], 'queued mutation')
      expect(getMessagesFromMap(channelId)[original.id].body).toBe(kind === 'edit' ? 'queued text' : '')
      await goOnline()
      await waitUntil(() => !state().MessageReducer.pendingMessageMutations[original.id], 'failed mutation rollback')
      expect(reject).toHaveBeenCalledTimes(1)
      await reopenOffline()
      expectContent(original)
    }
  )

  it('keeps a deleted message deleted when its earlier edit event is replayed', async () => {
    const first = edited(fake.server.lastMessage(channelId)!, 'edited before deletion')
    replaceOnServer(first)
    await emitEdit(first)
    const removed = deleted(first)
    replaceOnServer(removed)
    await emitDelete(removed)
    expect(getMessagesFromMap(channelId)[removed.id].state).toBe(MESSAGE_STATUS.DELETE)
    await emitEdit(first)
    await reopenOffline()
    expectContent(removed)
    expect(fake.server.lastMessage(channelId)?.state).toBe(MESSAGE_STATUS.DELETE)
  })

  it('keeps read status when delivered is replayed after read, without recounting either marker', async () => {
    const message = fake.server.lastMessage(channelId)!
    await emitReceipt(message.id, MESSAGE_DELIVERY_STATUS.DELIVERED)
    await emitReceipt(message.id)
    await emitReceipt(message.id, MESSAGE_DELIVERY_STATUS.DELIVERED)
    await emitReceipt(message.id)
    await reopenOffline()
    for (const copy of [
      getMessagesFromMap(channelId)[message.id],
      visible().find((item) => item.id === message.id),
      preview()
    ]) {
      expect(copy?.deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.READ)
      expect(copy?.markerTotals).toEqual([
        { name: MESSAGE_DELIVERY_STATUS.DELIVERED, count: 1 },
        { name: MESSAGE_DELIVERY_STATUS.READ, count: 1 }
      ])
    }
  })

  it('does not turn an own read marker into a remote read count', async () => {
    const message = fake.server.lastMessage(channelId)!
    await emitReceipt(message.id, MESSAGE_DELIVERY_STATUS.READ, 'current-user')
    await emitReceipt(message.id, MESSAGE_DELIVERY_STATUS.READ, 'current-user')
    await emitReceipt(message.id)
    await emitReceipt(message.id)
    await reopenOffline()
    for (const copy of [
      getMessagesFromMap(channelId)[message.id],
      visible().find((item) => item.id === message.id),
      preview()
    ]) {
      expect(copy?.markerTotals).toEqual([{ name: MESSAGE_DELIVERY_STATUS.READ, count: 1 }])
      expect(copy?.userMarkers.filter((marker) => marker.name === MESSAGE_DELIVERY_STATUS.READ)).toHaveLength(1)
    }
  })

  it('preserves receipt identity after accepting a newer edit', async () => {
    const original = fake.server.lastMessage(channelId)!
    await emitReceipt(original.id)
    const message = {
      ...edited(original, 'edited after being read', later),
      deliveryStatus: MESSAGE_DELIVERY_STATUS.READ,
      markerTotals: [{ name: MESSAGE_DELIVERY_STATUS.READ, count: 1 }]
    } as IMessage
    replaceOnServer(message)
    await emitEdit(message)
    await emitReceipt(message.id)
    await reopenOffline()
    expectContent(message)
    for (const copy of [
      getMessagesFromMap(channelId)[message.id],
      visible().find((item) => item.id === message.id),
      preview()
    ]) {
      expect(copy?.markerTotals).toEqual(message.markerTotals)
      expect(copy?.deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.READ)
    }
  })

  it('updates an older message and its quoted copy without replacing the latest chat preview', async () => {
    const original = fake.server.histories[channelId][1]
    const [reply] = fake.server.appendMessages(channelId, 1005, 1, false)
    reply.parentMessage = original
    reply.parentId = original.id
    await emitMessage(reply)
    const latestPreview = preview()
    const first = edited(original, 'first parent edit')
    const second = edited(first, 'second parent edit', later)
    fake.server.histories[channelId][1] = second
    await emitEdit(second)
    await emitEdit(first)
    await reopenOffline()
    expect(preview()).toMatchObject({
      id: latestPreview!.id,
      body: latestPreview!.body,
      state: latestPreview!.state,
      parentMessage: { id: original.id, body: second.body, state: second.state }
    })
    expect(getMessagesFromMap(channelId)[original.id].body).toBe(second.body)
    expect(visible().find((message) => message.id === original.id)?.body).toBe(second.body)
    expect(getMessagesFromMap(channelId)[reply.id].parentMessage?.body).toBe(second.body)
    expect(visible().find((message) => message.id === reply.id)?.parentMessage?.body).toBe(second.body)
    expect(visibleIds()).toEqual(ids(1000, 6))
  })

  it('rejects an edit against a deleted preview after its message cache has been discarded', async () => {
    const original = fake.server.lastMessage(channelId)!
    const removed = deleted(original)
    replaceOnServer(removed)
    await emitDelete(removed)
    removeMessagesFromMap(channelId)
    await emitEdit(edited(original, 'later edit must not restore deletion', new Date(later.getTime() + 60000)))
    expect(preview()?.state).toBe(MESSAGE_STATUS.DELETE)
    expect(preview()?.body).toBe('')
    expect(getMessagesFromMap(channelId)).toBeUndefined()
    if (chatIsOpen) {
      expect(visible().find((message) => message.id === original.id)?.state).toBe(MESSAGE_STATUS.DELETE)
    }
  })

  it('accepts a queued edit acknowledgement with a server timestamp older than the optimistic client timestamp', async () => {
    const original = fake.server.lastMessage(channelId)!
    const response = edited(original, 'server normalized text')
    const request = jest.fn(async () => {
      replaceOnServer(response)
      return response
    })
    fake.server.channels[channelId] = { ...channel(), editMessage: request }
    await syncChatList()
    await goOffline()
    store.dispatch(editMessageAC(channelId, edited(original, 'client text')))
    await waitUntil(() => !!state().MessageReducer.pendingMessageMutations[original.id], 'queued edit')
    expect(getMessagesFromMap(channelId)[original.id].updatedAt!.getTime()).toBeGreaterThan(earlier.getTime())
    await goOnline()
    await waitUntil(() => !state().MessageReducer.pendingMessageMutations[original.id], 'queued edit acknowledged')
    expect(request).toHaveBeenCalledTimes(1)
    await reopenOffline()
    expectContent(response)
    expect(getMessagesFromMap(channelId)[original.id].updatedAt).toEqual(earlier)
  })

  it('does not roll back a queued edit after a newer remote edit confirms its replacement', async () => {
    const original = fake.server.lastMessage(channelId)!
    let rejectResponse: ((error: Error) => void) | undefined
    const request = jest.fn(
      () =>
        new Promise<IMessage>((_resolve, reject) => {
          rejectResponse = reject
        })
    )
    fake.server.channels[channelId] = { ...channel(), editMessage: request }
    await syncChatList()
    await goOffline()
    store.dispatch(editMessageAC(channelId, edited(original, 'queued edit')))
    await waitUntil(() => !!state().MessageReducer.pendingMessageMutations[original.id], 'queued edit')
    await goOnline()
    await waitUntil(() => request.mock.calls.length === 1, 'edit retry in flight')
    const optimistic = getMessagesFromMap(channelId)[original.id]
    const confirmed = edited(original, 'newer remote text', new Date(optimistic.updatedAt!.getTime() + 60000))
    replaceOnServer(confirmed)
    await emitEdit(confirmed)
    expect(state().MessageReducer.pendingMessageMutations[original.id]).toBeUndefined()
    rejectResponse!(new Error('superseded edit rejected'))
    await openChat(channelId)
    await reopenOffline()
    expectContent(confirmed)
  })
})

it('handles duplicate events after memory eviction and fetches complete history when reopened online', async () => {
  fake.server.addChat(channelId, 1000, 5)
  fake.server.addChat('chat-a', 2000, 3)
  await syncChatList()
  await openChat(channelId)
  await openChat('chat-a')
  for (let index = 0; index < MESSAGES_CACHE_MAX_CHANNELS; index++) {
    const id = `other-${index}`
    addMessageToMap(id, makeMessage({ channelId: id }))
    trackChannelVisit(id)
  }
  expect(evictLruChannels('chat-a')).toContain(channelId)
  expect(getMessagesFromMap(channelId)).toBeUndefined()
  const [message] = fake.server.appendMessages(channelId, 1005, 1, false)
  await emitMessage(message)
  await emitMessage(message)
  expect(Object.keys(getMessagesFromMap(channelId))).toEqual([message.id])
  await openChat(channelId)
  expect(visibleIds()).toEqual(ids(1000, 6))
  expectContent(message)
})
