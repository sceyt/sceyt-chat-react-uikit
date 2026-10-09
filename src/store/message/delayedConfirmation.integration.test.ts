import { runSaga } from 'redux-saga'
import { getMessagesFromMap } from '../../helpers/messagesHalper'
import { MESSAGE_DELIVERY_STATUS } from '../../helpers/constants'
import { makeUser } from '../../testUtils/messageFixtures'
import { IChannel, IMessage } from '../../types'
import { handleChannelMessageEvent, handleMessageMarkersReceivedEvent } from '../evetns/inedx'
import { sendTextMessageAC } from './actions'
import { CONNECTION_STATUS } from '../user/constants'
import {
  fake,
  goOffline,
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
const visible = (): IMessage[] => state().MessageReducer.activeChannelMessages
const preview = (): IMessage | undefined => {
  const channel: IChannel | undefined = state().ChannelReducer.channels.find(
    (channel: IChannel) => channel.id === channelId
  )
  return channel?.lastReactedMessage || channel?.lastMessage
}

const send = async (body: string) => {
  store.dispatch(
    sendTextMessageAC(
      {
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
      },
      channelId,
      CONNECTION_STATUS.CONNECTED
    )
  )
  await waitUntil(() => visible().some((message) => !!message.id && message.body === body), 'send confirmation')
  return { ...fake.server.lastMessage(channelId)! }
}

const receiveRead = async (sent: IMessage) => {
  const read = { ...sent, deliveryStatus: MESSAGE_DELIVERY_STATUS.READ }
  fake.server.histories[channelId] = fake.server.histories[channelId].map((message) =>
    message.id === sent.id ? read : message
  )
  fake.server.channels[channelId] = { ...fake.server.channels[channelId], lastMessage: read }
  await runSaga(
    { dispatch: store.dispatch, getState: store.getState },
    handleMessageMarkersReceivedEvent,
    {
      channelId,
      markerList: {
        name: MESSAGE_DELIVERY_STATUS.READ,
        messageIds: [sent.id],
        user: makeUser({ id: 'remote-user' }),
        createdAt: new Date()
      }
    },
    fake.server.client()
  ).toPromise()
}

describe('integration: delayed confirmation after a read marker', () => {
  it.each([
    [true, false],
    [false, false],
    [true, true],
    [false, true]
  ])(
    'preserves the earlier read status and newer preview (chat open: %s, original channel snapshot: %s)',
    async (chatIsOpen, useOriginalChannel) => {
      fake.server.addChat(channelId, 1000, 5)
      fake.server.addChat('chat-a', 1, 3)
      await syncChatList()
      await openChat(channelId)
      const first = await send('first message, already read')
      const originalChannel = { ...fake.server.channels[channelId], lastMessage: { ...first } }
      await receiveRead(first)
      expect(getMessagesFromMap(channelId)[first.id].deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.READ)
      expect(visible().find((message) => message.id === first.id)?.deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.READ)
      const newer = await send('newer message, not read yet')
      expect(newer.id).not.toBe(first.id)
      expect(preview()?.id).toBe(newer.id)
      expect(preview()?.deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.SENT)
      if (!chatIsOpen) {
        await openChat('chat-a')
      }

      // Replay the original SENT confirmation without changing server history.
      await runSaga(
        { dispatch: store.dispatch, getState: store.getState },
        handleChannelMessageEvent,
        {
          channel: useOriginalChannel ? originalChannel : { ...fake.server.channels[channelId] },
          message: { ...first }
        },
        fake.server.client()
      ).toPromise()
      expect(state().ChannelReducer.activeChannel.id).toBe(chatIsOpen ? channelId : 'chat-a')
      expect({
        cached: getMessagesFromMap(channelId)[first.id].deliveryStatus,
        visible: chatIsOpen ? visible().find((message) => message.id === first.id)?.deliveryStatus : undefined
      }).toEqual({
        cached: MESSAGE_DELIVERY_STATUS.READ,
        visible: chatIsOpen ? MESSAGE_DELIVERY_STATUS.READ : undefined
      })
      await goOffline()
      const requestsBeforeOpen = fake.server.requests.length
      await openChat(channelId)
      expect(fake.server.requests).toHaveLength(requestsBeforeOpen)
      expect(new Set(visibleIds()).size).toBe(visibleIds().length)
      expect(getMessagesFromMap(channelId)[first.tid!]).toBeUndefined()
      expect(getMessagesFromMap(channelId)[newer.id].deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.SENT)
      expect(visible().find((message) => message.id === newer.id)?.deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.SENT)
      expect({
        serverFirstStatus: fake.server.histories[channelId].find((message) => message.id === first.id)?.deliveryStatus,
        cachedFirstStatus: getMessagesFromMap(channelId)[first.id].deliveryStatus,
        visibleFirstStatus: visible().find((message) => message.id === first.id)?.deliveryStatus,
        previewId: preview()?.id,
        previewBody: preview()?.body,
        previewStatus: preview()?.deliveryStatus
      }).toEqual({
        serverFirstStatus: MESSAGE_DELIVERY_STATUS.READ,
        cachedFirstStatus: MESSAGE_DELIVERY_STATUS.READ,
        visibleFirstStatus: MESSAGE_DELIVERY_STATUS.READ,
        previewId: newer.id,
        previewBody: newer.body,
        previewStatus: MESSAGE_DELIVERY_STATUS.SENT
      })
    }
  )

  it('keeps a new own-message event sent when the preceding message is already read', async () => {
    fake.server.addChat(channelId, 1000, 5)
    await syncChatList()
    await openChat(channelId)
    const first = await send('already read message')
    await receiveRead(first)
    // An outgoing message sent from another device has no local pending copy.
    fake.server.appendMessages(channelId, 1000000, 1, false)
    const newer = { ...fake.server.lastMessage(channelId)! }

    await runSaga(
      { dispatch: store.dispatch, getState: store.getState },
      handleChannelMessageEvent,
      { channel: { ...fake.server.channels[channelId] }, message: newer },
      fake.server.client()
    ).toPromise()

    expect({
      cachedFirst: getMessagesFromMap(channelId)[first.id].deliveryStatus,
      visibleFirst: visible().find((message) => message.id === first.id)?.deliveryStatus,
      cachedNewer: getMessagesFromMap(channelId)[newer.id].deliveryStatus,
      visibleNewer: visible().find((message) => message.id === newer.id)?.deliveryStatus,
      previewId: preview()?.id,
      previewStatus: preview()?.deliveryStatus
    }).toEqual({
      cachedFirst: MESSAGE_DELIVERY_STATUS.READ,
      visibleFirst: MESSAGE_DELIVERY_STATUS.READ,
      cachedNewer: MESSAGE_DELIVERY_STATUS.SENT,
      visibleNewer: MESSAGE_DELIVERY_STATUS.SENT,
      previewId: newer.id,
      previewStatus: MESSAGE_DELIVERY_STATUS.SENT
    })
  })
})
