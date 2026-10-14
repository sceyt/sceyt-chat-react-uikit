import { runSaga, Task } from 'redux-saga'
import log from 'loglevel'
import { setClient } from '../../common/client'
import { MESSAGE_DELIVERY_STATUS, MESSAGE_STATUS } from '../../helpers/constants'
import { addMessageToMap, clearMessagesMap, getMessagesFromMap } from '../../helpers/messagesHalper'
import { destroyChannelsMap, getChannelFromMap, setActiveChannelId, setChannelInMap } from '../../helpers/channelHalper'
import { FakeMessageServer } from '../../testUtils/fakeMessageServer'
import { createMessageListStore } from '../../testUtils/messageListHarness'
import { makeMessage, makeUser, resetMessageListFixtureIds } from '../../testUtils/messageFixtures'
import { IMessage } from '../../types'
import { setConnectionStatusAC } from '../user/actions'
import { updateChannelDataAC } from '../channel/actions'
import { CONNECTION_STATUS } from '../user/constants'
import { handleChannelMessageEvent, handleMessageMarkersReceivedEvent } from '../evetns/inedx'
import { resendMessageAC, sendTextMessageAC, setMessageMarkersAC, setMessagesAC } from './actions'
import { __messageSagaTestables, __resetMessageSagaTestState } from './saga'

// Real reducers, caches and send/event workers; only the SDK/network are fake.
// Workers run directly so automatic reconnect retries cannot replace the
// manual "Send again" action being tested (WAAF-3290).
let mockStore: ReturnType<typeof createMessageListStore>
jest.mock('../index', () => ({
  __esModule: true,
  get default() {
    return mockStore
  }
}))
jest.mock('../../helpers/messageListNavigator', () => ({
  navigateToLatest: jest.fn(),
  navigateToMessage: jest.fn()
}))

const channelId = 'resend-chat'
const otherChannelId = 'other-chat'
const confirmedId = '9007199254741013'
const options = () => ({ dispatch: mockStore.dispatch, getState: mockStore.getState })
const visible = () => mockStore.getState().MessageReducer.activeChannelMessages
const preview = () =>
  mockStore.getState().ChannelReducer.channels.find((channel) => channel.id === channelId)?.lastMessage

const deferred = <T>() => {
  let resolvePromise: (value: T) => void = () => undefined
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve
  })
  return { promise, resolve: resolvePromise }
}

describe('WAAF-3290: delivery status after sending or retrying a text', () => {
  let server: FakeMessageServer
  const tasks: Task[] = []

  beforeEach(() => {
    jest.useFakeTimers()
    jest.spyOn(log, 'error').mockImplementation(() => undefined)
    jest.spyOn(log, 'info').mockImplementation(() => undefined)
    clearMessagesMap()
    destroyChannelsMap()
    __resetMessageSagaTestState()
    resetMessageListFixtureIds()
    server = new FakeMessageServer()
    const previous = makeMessage({ id: '9007199254741000', channelId, body: 'previous message' })
    const channel = server.addChat(channelId, 1, 0, { lastMessage: previous })
    server.histories[channelId] = [previous]
    const otherChannel = server.addChat(otherChannelId, 1, 0)
    mockStore = createMessageListStore({
      ChannelReducer: { channels: [channel, otherChannel], activeChannel: channel },
      UserReducer: { connectionStatus: CONNECTION_STATUS.CONNECTED }
    })
    setClient(server.client())
    setActiveChannelId(channelId)
    setChannelInMap(channel)
    addMessageToMap(channelId, previous)
    mockStore.dispatch(setMessagesAC([previous], channelId))
  })

  afterEach(() => {
    tasks.splice(0).forEach((task) => task.cancel())
    jest.clearAllTimers()
    jest.useRealTimers()
    jest.restoreAllMocks()
    clearMessagesMap()
    destroyChannelsMap()
    __resetMessageSagaTestState()
  })

  const startSend = async (retryFailedMessage = true) => {
    const body = retryFailedMessage ? 'retry me' : 'first send'
    const acknowledgement = deferred<IMessage>()
    let confirmed: IMessage = makeMessage({ id: confirmedId, channelId })
    const send = jest.fn<Promise<IMessage>, [IMessage]>()
    if (retryFailedMessage) {
      send.mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            // A connected socket with 100% packet loss eventually times out.
            setTimeout(() => reject(Object.assign(new Error('Request timed out'), { code: 9901 })), 10000)
          })
      )
    }
    send.mockImplementation((message) => {
      confirmed = makeMessage({
        id: confirmedId,
        tid: message.tid,
        channelId,
        body: message.body,
        metadata: message.metadata,
        createdAt: new Date(),
        deliveryStatus: MESSAGE_DELIVERY_STATUS.SENT
      })
      server.histories[channelId] = [...server.histories[channelId], confirmed]
      server.channels[channelId] = { ...server.channels[channelId], lastMessage: confirmed }
      return acknowledgement.promise
    })
    const channel = getChannelFromMap(channelId)!
    channel.sendMessage = send
    let action = sendTextMessageAC(makeMessage({ id: '', channelId, body }), channelId, CONNECTION_STATUS.CONNECTED)
    let worker = __messageSagaTestables.sendTextMessage
    let failed: IMessage | undefined
    if (retryFailedMessage) {
      const initial = runSaga(options(), worker, action)
      tasks.push(initial)
      jest.advanceTimersByTime(10000)
      await initial.toPromise()
      failed = visible().find((message) => message.body === body)!
      expect(failed.state).toBe(MESSAGE_STATUS.FAILED)
      expect(getMessagesFromMap(channelId)[failed.tid!]?.state).toBe(MESSAGE_STATUS.FAILED)
      expect(preview()?.state).toBe(MESSAGE_STATUS.FAILED)
      expect(server.histories[channelId]).toHaveLength(1)

      mockStore.dispatch(setConnectionStatusAC(CONNECTION_STATUS.DISCONNECTED))
      mockStore.dispatch(setConnectionStatusAC(CONNECTION_STATUS.CONNECTING))
      mockStore.dispatch(setConnectionStatusAC(CONNECTION_STATUS.CONNECTED))
      action = resendMessageAC(failed, channelId, CONNECTION_STATUS.CONNECTED)
      worker = __messageSagaTestables.resendMessage
    }
    const sending = runSaga(options(), worker, action)
    tasks.push(sending)
    expect(send).toHaveBeenCalledTimes(retryFailedMessage ? 2 : 1)
    const lastRequest = send.mock.calls[send.mock.calls.length - 1][0]
    if (failed) expect(lastRequest.tid).toBe(failed.tid)
    expect(lastRequest.state).toBe(MESSAGE_STATUS.UNMODIFIED)
    // Leave the "3G" acknowledgement pending while events can overtake it.
    jest.advanceTimersByTime(800)
    expect(sending.isRunning()).toBe(true)
    const finish = async (snapshot: Partial<IMessage> = {}) => {
      // The send response is a snapshot taken before any later receipt.
      acknowledgement.resolve({ ...confirmed, ...snapshot })
      await sending.toPromise()
    }
    return { confirmed, finish }
  }

  const startRetry = () => startSend(true)

  const emitConfirmation = (message: IMessage) =>
    runSaga(
      options(),
      handleChannelMessageEvent,
      { channel: { ...server.channels[channelId], lastMessage: message }, message: { ...message } },
      server.client()
    ).toPromise()

  const emitReceipt = async (message: IMessage, name: string) => {
    server.setDeliveryStatus(channelId, message.id, name)
    await runSaga(
      options(),
      handleMessageMarkersReceivedEvent,
      {
        channelId,
        markerList: {
          name,
          count: 1,
          messageId: message.id,
          messageIds: [message.id],
          user: makeUser({ id: 'recipient' }),
          createdAt: new Date()
        }
      },
      server.client()
    ).toPromise()
  }

  const expectConsistentStatus = (message: IMessage, status: string, chatIsOpen = true) => {
    const copies = {
      cache: getMessagesFromMap(channelId)[message.id],
      preview: preview(),
      channelCache: getChannelFromMap(channelId)?.lastMessage,
      server: server.lastMessage(channelId),
      ...(chatIsOpen ? { visible: visible().find((item) => item.id === message.id) } : {})
    }
    const actual = Object.fromEntries(
      Object.entries(copies).map(([location, copy]) => [
        location,
        { id: copy?.id, status: copy?.deliveryStatus, state: copy?.state }
      ])
    )
    const expected = Object.fromEntries(
      Object.keys(copies).map((location) => [location, { id: message.id, status, state: MESSAGE_STATUS.UNMODIFIED }])
    )
    expect(actual).toEqual(expected)
    expect(getMessagesFromMap(channelId)[message.tid!]).toBeUndefined()
    if (chatIsOpen) expect(visible().filter((item) => item.tid === message.tid)).toHaveLength(1)
    expect(server.histories[channelId]).toHaveLength(2)
  }

  it('keeps one tick until a recipient receipt actually arrives', async () => {
    const { confirmed, finish } = await startRetry()
    await finish()
    expectConsistentStatus(confirmed, MESSAGE_DELIVERY_STATUS.SENT)
  })

  it.each([MESSAGE_DELIVERY_STATUS.DELIVERED, MESSAGE_DELIVERY_STATUS.READ])(
    'updates the chat-list preview when %s arrives after the retry response',
    async (status) => {
      const { confirmed, finish } = await startRetry()
      await finish()
      await emitReceipt(confirmed, status)
      expectConsistentStatus(confirmed, status)
    }
  )

  it.each([MESSAGE_DELIVERY_STATUS.DELIVERED, MESSAGE_DELIVERY_STATUS.READ])(
    'retains %s when a receipt overtakes the first send response without any failed retry',
    async (status) => {
      const { confirmed, finish } = await startSend(false)
      await emitConfirmation(confirmed)
      await emitReceipt(confirmed, status)
      expectConsistentStatus(confirmed, status)
      await finish()
      expectConsistentStatus(confirmed, status)
      await emitReceipt(confirmed, status)
      for (const copy of [
        preview(),
        getMessagesFromMap(channelId)[confirmed.id],
        visible().find((m) => m.id === confirmed.id)
      ]) {
        expect(copy?.markerTotals.find((total) => total.name === status)?.count).toBe(1)
      }
    }
  )

  it('replays an early receipt without changing the other chat currently open', async () => {
    const { confirmed, finish } = await startRetry()
    setActiveChannelId(otherChannelId)
    mockStore.dispatch(setMessagesAC([], otherChannelId))
    await emitReceipt(confirmed, MESSAGE_DELIVERY_STATUS.READ)
    await finish()
    expectConsistentStatus(confirmed, MESSAGE_DELIVERY_STATUS.READ, false)
    expect(visible()).toEqual([])
  })

  it('keeps a newer channel-sync read snapshot while replaying an earlier delivery receipt', async () => {
    const { confirmed, finish } = await startRetry()
    await emitReceipt(confirmed, MESSAGE_DELIVERY_STATUS.DELIVERED)
    const read = { ...confirmed, deliveryStatus: MESSAGE_DELIVERY_STATUS.READ }
    setChannelInMap({ ...getChannelFromMap(channelId)!, lastMessage: read })
    mockStore.dispatch(updateChannelDataAC(channelId, { lastMessage: read }))
    server.setDeliveryStatus(channelId, confirmed.id, MESSAGE_DELIVERY_STATUS.READ)
    await finish()
    expectConsistentStatus(confirmed, MESSAGE_DELIVERY_STATUS.READ)
  })

  it('does not transfer the confirmed message read status to a newer incoming preview', async () => {
    const { confirmed, finish } = await startRetry()
    await emitReceipt(confirmed, MESSAGE_DELIVERY_STATUS.READ)
    const newer = makeMessage({
      id: '9007199254741014',
      channelId,
      body: 'newer incoming',
      incoming: true
    })
    server.histories[channelId].push(newer)
    server.channels[channelId] = { ...server.channels[channelId], lastMessage: newer }
    // The SDK updates its cached channel before notifying the message listener.
    setChannelInMap({ ...getChannelFromMap(channelId)!, lastMessage: newer })
    await emitConfirmation(newer)
    await finish()
    expect(preview()?.id).toBe(newer.id)
    expect(preview()?.deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.SENT)
    expect(getChannelFromMap(channelId)?.lastMessage.id).toBe(newer.id)
    expect(getMessagesFromMap(channelId)[confirmed.id]?.deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.READ)
    expect(visible().find((message) => message.id === confirmed.id)?.deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.READ)
  })

  it.each([false, true])(
    'keeps server receipt totals without recounting readers (own event first: %s)',
    async (ownEventFirst) => {
      const { confirmed, finish } = await startRetry()
      if (ownEventFirst) await emitConfirmation(confirmed)
      await emitReceipt(confirmed, MESSAGE_DELIVERY_STATUS.DELIVERED)
      await finish({
        deliveryStatus: MESSAGE_DELIVERY_STATUS.DELIVERED,
        markerTotals: [
          {
            name: MESSAGE_DELIVERY_STATUS.DELIVERED,
            count: 3,
            messageId: confirmed.id,
            messageIds: [confirmed.id],
            user: makeUser({ id: 'recipient' }),
            createdAt: new Date()
          }
        ]
      })
      expectConsistentStatus(confirmed, MESSAGE_DELIVERY_STATUS.DELIVERED)
      for (const copy of [
        preview(),
        getMessagesFromMap(channelId)[confirmed.id],
        visible().find((m) => m.id === confirmed.id)
      ]) {
        expect(copy?.markerTotals.find((total) => total.name === MESSAGE_DELIVERY_STATUS.DELIVERED)?.count).toBe(3)
      }
    }
  )

  it('does not treat fetched Message info as an unapplied live receipt', async () => {
    const { confirmed, finish } = await startRetry()
    mockStore.dispatch(
      setMessageMarkersAC(
        channelId,
        confirmed.id,
        {
          [MESSAGE_DELIVERY_STATUS.READ]: [
            {
              name: MESSAGE_DELIVERY_STATUS.READ,
              count: 1,
              messageId: confirmed.id,
              messageIds: [confirmed.id],
              user: makeUser({ id: 'recipient' }),
              createdAt: new Date()
            }
          ]
        },
        [MESSAGE_DELIVERY_STATUS.READ]
      )
    )
    await finish()
    expectConsistentStatus(confirmed, MESSAGE_DELIVERY_STATUS.SENT)
  })

  it.each([MESSAGE_DELIVERY_STATUS.DELIVERED, MESSAGE_DELIVERY_STATUS.READ])(
    'retains %s when the own-message event and receipt overtake the slow retry response',
    async (status) => {
      const { confirmed, finish } = await startRetry()
      await emitConfirmation(confirmed)
      await emitReceipt(confirmed, status)
      expectConsistentStatus(confirmed, status)
      await finish()
      expectConsistentStatus(confirmed, status)
    }
  )

  it.each([MESSAGE_DELIVERY_STATUS.DELIVERED, MESSAGE_DELIVERY_STATUS.READ])(
    'retains an early %s receipt when the retry is still known only by its temporary id',
    async (status) => {
      const { confirmed, finish } = await startRetry()
      expect(getMessagesFromMap(channelId)[confirmed.id]).toBeUndefined()
      await emitReceipt(confirmed, status)
      // The event is recorded even though no message copy has this server id.
      // Confirmation must apply it; recording it only for deduplication is insufficient.
      const receiptState = mockStore.getState().MessageReducer
      expect(
        receiptState.messageMarkers[channelId]?.[confirmed.id]?.[status]?.map((marker) => marker.user?.id)
      ).toEqual(['recipient'])
      expect(receiptState.appliedMessageReceipts[channelId]?.[confirmed.id]).toBeDefined()
      await finish()
      expectConsistentStatus(confirmed, status)
    }
  )

  it('updates the resent chat preview after switching away before the delivery receipt', async () => {
    const { confirmed, finish } = await startRetry()
    await finish()
    setActiveChannelId(otherChannelId)
    mockStore.dispatch(setMessagesAC([], otherChannelId))
    await emitReceipt(confirmed, MESSAGE_DELIVERY_STATUS.DELIVERED)
    expectConsistentStatus(confirmed, MESSAGE_DELIVERY_STATUS.DELIVERED, false)
    expect(visible()).toEqual([])
  })

  it('keeps read when a delayed delivered receipt follows it after retry', async () => {
    const { confirmed, finish } = await startRetry()
    await finish()
    await emitReceipt(confirmed, MESSAGE_DELIVERY_STATUS.READ)
    await runSaga(
      options(),
      handleMessageMarkersReceivedEvent,
      {
        channelId,
        markerList: {
          name: MESSAGE_DELIVERY_STATUS.DELIVERED,
          count: 1,
          messageId: confirmed.id,
          messageIds: [confirmed.id],
          user: makeUser({ id: 'recipient' }),
          createdAt: new Date()
        }
      },
      server.client()
    ).toPromise()
    expectConsistentStatus(confirmed, MESSAGE_DELIVERY_STATUS.READ)
  })
})
