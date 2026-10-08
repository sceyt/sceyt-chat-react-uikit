/**
 * Offline / reconnect scenarios for sending messages.
 *
 * Unlike the unit tests in saga.test.ts, these tests feed every action the
 * sagas dispatch into the real MessageReducer, so they assert what the user
 * would actually see in the message list after the network comes back:
 * no lost messages, no duplicates, no messages stuck as pending.
 *
 * Covers: pending messages not recovered after network restore, and a video
 * not sent / sent as a file after reconnect.
 */
import { runSaga } from 'redux-saga'
import log from 'loglevel'
import { setClient } from '../../common/client'
import { addMessageToMap, clearMessagesMap, getPendingMessagesFromMap } from '../../helpers/messagesHalper'
import { destroyChannelsMap, setActiveChannelId, setChannelInMap } from '../../helpers/channelHalper'
import { CONNECTION_STATUS } from '../user/constants'
import { attachmentTypes, LOADING_STATE, MESSAGE_DELIVERY_STATUS, MESSAGE_STATUS } from '../../helpers/constants'
import {
  makeChannel,
  makeMessage,
  makePendingMessage,
  makeUser,
  resetMessageListFixtureIds
} from '../../testUtils/messageFixtures'
import { resetMockServerDelay } from '../../testUtils/mockServerDelay'
import { sendTextMessageAC } from './actions'
import { __messageSagaTestables, __resetMessageSagaTestState } from './saga'
import MessageReducer, { addMessage } from './reducers'

const state: any = {}

const resetState = () => {
  state.MessageReducer = {
    ...MessageReducer(undefined, { type: '@@INIT' } as any),
    activeChannelMessages: [],
    pendingPollActions: {},
    pendingMessageMutations: {}
  }
  state.ChannelReducer = { channelsLoadingState: LOADING_STATE.LOADED, activeChannel: {}, channels: [] }
  state.UserReducer = { connectionStatus: CONNECTION_STATUS.DISCONNECTED, waitToSendPendingMessages: false }
}

const mockStore = {
  getState: jest.fn(() => state),
  dispatch: jest.fn((action: any) => applyAction(action))
}

jest.mock('../index', () => ({
  __esModule: true,
  get default() {
    return mockStore
  }
}))

jest.mock('../../helpers/messageListNavigator', () => ({
  navigateToLatest: jest.fn(),
  navigateToMessage: jest.fn(),
  registerJumpToLatest: jest.fn(),
  unregisterJumpToLatest: jest.fn(),
  registerMessageListNavigator: jest.fn(),
  unregisterMessageListNavigator: jest.fn()
}))

const applyAction = (action: any) => {
  if (action && typeof action.type === 'string' && action.type.startsWith('messages/')) {
    state.MessageReducer = MessageReducer(state.MessageReducer, action)
  }
}

const run = (saga: any, ...args: any[]) =>
  runSaga({ dispatch: (action: any) => applyAction(action), getState: () => state }, saga, ...args).toPromise()

const flushTimers = () => new Promise((resolve) => setTimeout(resolve, 100))

const visibleMessages = () =>
  state.MessageReducer.activeChannelMessages.map((m: any) => ({
    id: m.id || '',
    tid: m.tid,
    body: m.body,
    state: m.state,
    deliveryStatus: m.deliveryStatus
  }))

const makeBuilder = (create: (fields: { body: string; metadata: string }) => any) => {
  const fields = { body: '', metadata: '' }
  const builder: any = {
    setBody: jest.fn((body: string) => {
      fields.body = body
      return builder
    }),
    setBodyAttributes: jest.fn().mockReturnThis(),
    setAttachments: jest.fn().mockReturnThis(),
    setMentionUserIds: jest.fn().mockReturnThis(),
    setType: jest.fn().mockReturnThis(),
    setDisplayCount: jest.fn().mockReturnThis(),
    setSilent: jest.fn().mockReturnThis(),
    setMetadata: jest.fn((metadata?: string) => {
      // The SDK stores an empty string when no metadata is given.
      fields.metadata = metadata || ''
      return builder
    }),
    setPollDetails: jest.fn().mockReturnThis(),
    setParentMessageId: jest.fn().mockReturnThis(),
    setReplyInThread: jest.fn().mockReturnThis(),
    setDisableMentionsCount: jest.fn().mockReturnThis(),
    setViewOnce: jest.fn().mockReturnThis(),
    create: jest.fn(() => create(fields))
  }
  return builder
}

// Same shape SendMessageInput dispatches for a plain text message (no message metadata).
const textInput = (body: string, extra: Record<string, any> = {}) => ({
  body,
  bodyAttributes: [],
  attachments: [],
  mentionedUsers: [],
  type: 'text',
  pollDetails: null,
  parentMessage: null,
  repliedInThread: false,
  displayCount: 1,
  silent: false,
  ...extra
})

/** Sets up an open channel whose SDK creates pending messages with the given tids in order. */
const setupChannel = (channelId: string, tids: string[]) => {
  const currentUser = makeUser({ id: 'current-user' })
  const channel = makeChannel({
    id: channelId,
    lastMessage: makeMessage({ id: '100', channelId, body: 'before offline' })
  })
  let created = 0
  const builder = makeBuilder(({ body, metadata }) => {
    const tid = tids[created++]
    // Like the SDK: create() returns a local message with a tid and no id.
    return {
      tid,
      id: '',
      body,
      user: currentUser,
      metadata,
      attachments: [],
      createdAt: new Date(Date.UTC(2026, 9, 8, 12, 0, created)),
      deliveryStatus: MESSAGE_DELIVERY_STATUS.PENDING,
      state: MESSAGE_STATUS.UNMODIFIED,
      incoming: false,
      type: 'text'
    }
  })
  // The channel map stores copies of the channel object, so the SDK call goes
  // through a delegate that each test can swap.
  const sdk = { sendMessage: jest.fn() as jest.Mock }
  channel.createMessageBuilder = jest.fn(() => builder as any)
  channel.sendMessage = jest.fn((message: any) => sdk.sendMessage(message)) as any

  setActiveChannelId(channel.id)
  setChannelInMap(channel)
  state.ChannelReducer.channels = [channel]
  state.ChannelReducer.activeChannel = channel

  return { channel, builder, sdk }
}

const sendOffline = async (channelId: string, body: string, extra: Record<string, any> = {}) => {
  state.UserReducer.connectionStatus = CONNECTION_STATUS.DISCONNECTED
  await run(
    __messageSagaTestables.sendTextMessage,
    sendTextMessageAC(textInput(body, extra), channelId, CONNECTION_STATUS.DISCONNECTED)
  )
}

const reconnect = async () => {
  state.UserReducer.connectionStatus = CONNECTION_STATUS.CONNECTED
  state.UserReducer.waitToSendPendingMessages = true
  await run(__messageSagaTestables.resumePendingMessagesAfterReconnect, {
    payload: { status: CONNECTION_STATUS.CONNECTED }
  })
  await flushTimers()
}

/** SDK sendMessage that confirms each message with the next server id. */
const confirmingSend = (channelId: string, firstId = 500) => {
  let nextId = firstId
  return jest.fn(async (message: any) =>
    makeMessage({
      id: String(nextId++),
      tid: message.tid,
      channelId,
      body: message.body,
      incoming: false,
      deliveryStatus: MESSAGE_DELIVERY_STATUS.SENT,
      metadata: '{}'
    })
  )
}

describe('offline / reconnect: sending messages', () => {
  beforeEach(() => {
    jest.spyOn(log, 'error').mockImplementation(() => undefined)
    jest.spyOn(log, 'info').mockImplementation(() => undefined)
    resetMessageListFixtureIds()
    resetMockServerDelay()
    clearMessagesMap()
    destroyChannelsMap()
    __resetMessageSagaTestState()
    resetState()
    // react-scripts resets mock implementations before each test.
    mockStore.getState.mockImplementation(() => state)
    mockStore.dispatch.mockImplementation((action: any) => applyAction(action))
    setClient({ user: { id: 'current-user' }, Channel: { create: jest.fn() } })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    clearMessagesMap()
    destroyChannelsMap()
    setActiveChannelId('')
    __resetMessageSagaTestState()
  })

  it('a text sent while offline is shown once, then sent once and confirmed after reconnect', async () => {
    const channelId = 'channel-offline-text'
    const { sdk } = setupChannel(channelId, ['tid-a'])

    await sendOffline(channelId, 'hello offline')

    expect(sdk.sendMessage).not.toHaveBeenCalled()
    expect(visibleMessages()).toEqual([
      expect.objectContaining({ id: '', tid: 'tid-a', body: 'hello offline', state: MESSAGE_STATUS.FAILED })
    ])
    expect(getPendingMessagesFromMap(channelId)).toHaveLength(1)

    sdk.sendMessage = confirmingSend(channelId)
    await reconnect()

    expect(sdk.sendMessage).toHaveBeenCalledTimes(1)
    expect(visibleMessages()).toEqual([
      expect.objectContaining({
        id: '500',
        tid: 'tid-a',
        body: 'hello offline',
        deliveryStatus: MESSAGE_DELIVERY_STATUS.SENT
      })
    ])
    expect(visibleMessages()[0].state).not.toBe(MESSAGE_STATUS.FAILED)
    expect(getPendingMessagesFromMap(channelId)).toHaveLength(0)
  })

  it('several texts sent while offline are all sent after reconnect, in order, with no duplicates', async () => {
    const channelId = 'channel-offline-many'
    const { sdk } = setupChannel(channelId, ['tid-1', 'tid-2', 'tid-3'])

    await sendOffline(channelId, 'first')
    await sendOffline(channelId, 'second')
    await sendOffline(channelId, 'third')
    expect(visibleMessages().map((m: any) => m.body)).toEqual(['first', 'second', 'third'])

    sdk.sendMessage = confirmingSend(channelId)
    await reconnect()

    expect(sdk.sendMessage.mock.calls.map(([m]) => m.tid)).toEqual(['tid-1', 'tid-2', 'tid-3'])
    expect(visibleMessages().map((m: any) => `${m.id}:${m.body}`)).toEqual(['500:first', '501:second', '502:third'])
    expect(getPendingMessagesFromMap(channelId)).toHaveLength(0)
  })

  it('keeps the message when the network drops again during the resend, and sends it once on the next reconnect', async () => {
    const channelId = 'channel-offline-flaky'
    const { sdk } = setupChannel(channelId, ['tid-flaky'])

    await sendOffline(channelId, 'flaky network')

    // First reconnect: the request fails with a network error (no SDK error type = resendable).
    sdk.sendMessage = jest.fn(async () => {
      throw new Error('network lost')
    })
    await reconnect()

    expect(visibleMessages()).toEqual([expect.objectContaining({ id: '', tid: 'tid-flaky', body: 'flaky network' })])
    expect(getPendingMessagesFromMap(channelId)).toHaveLength(1)

    // Second reconnect: the network is stable and the message is confirmed exactly once.
    sdk.sendMessage = confirmingSend(channelId, 700)
    await reconnect()

    expect(sdk.sendMessage).toHaveBeenCalledTimes(1)
    expect(visibleMessages()).toEqual([expect.objectContaining({ id: '700', tid: 'tid-flaky', body: 'flaky network' })])
    expect(getPendingMessagesFromMap(channelId)).toHaveLength(0)
  })

  it('a video queued while offline is sent as a video after reconnect', async () => {
    const channelId = 'channel-offline-video'
    const { channel, sdk } = setupChannel(channelId, [])
    const currentUser = makeUser({ id: 'current-user' })
    const videoAttachment = {
      tid: 'video-att-tid',
      type: attachmentTypes.video,
      name: 'clip.mp4',
      size: 2048,
      // The live File is kept so the reconnect resend can generate the preview and upload.
      data: new File(['video-bytes'], 'clip.mp4', { type: 'video/mp4' }),
      videoPreviewBlob: new Blob(['preview'], { type: 'image/jpeg' }),
      metadata: '{"dur":3,"szw":320,"szh":240}',
      upload: false
    }
    const pendingVideo = makePendingMessage({
      channelId,
      tid: 'tid-video',
      body: '',
      metadata: '',
      user: currentUser,
      state: MESSAGE_STATUS.FAILED,
      attachments: [videoAttachment as any]
    })
    const attachmentBuilder = {
      setName: jest.fn().mockReturnThis(),
      setMetadata: jest.fn().mockReturnThis(),
      setUpload: jest.fn().mockReturnThis(),
      setFileSize: jest.fn().mockReturnThis(),
      create: jest.fn(() => ({ ...videoAttachment }))
    }
    channel.createAttachmentBuilder = jest.fn(() => attachmentBuilder as any)
    setChannelInMap(channel)
    addMessageToMap(channelId, pendingVideo)
    state.MessageReducer = MessageReducer(state.MessageReducer, addMessage({ message: pendingVideo } as any))

    setClient({
      user: { id: 'current-user' },
      Channel: { create: jest.fn() },
      uploadFile: jest.fn(async () => 'https://cdn.example/clip-preview.jpg')
    })
    sdk.sendMessage = jest.fn(async (message: any) =>
      makeMessage({
        id: '600',
        tid: message.tid,
        channelId,
        body: '',
        incoming: false,
        deliveryStatus: MESSAGE_DELIVERY_STATUS.SENT,
        metadata: '',
        attachments: message.attachments
      })
    )
    await reconnect()

    expect(sdk.sendMessage).toHaveBeenCalledTimes(1)
    const sent = sdk.sendMessage.mock.calls[0][0]
    expect(sent.attachments.map((a: any) => a.type)).toEqual([attachmentTypes.video])
    const visible = state.MessageReducer.activeChannelMessages
    expect(visible).toHaveLength(1)
    expect(visible[0]).toEqual(expect.objectContaining({ id: '600', tid: 'tid-video' }))
    expect(visible[0].attachments.map((a: any) => a.type)).toEqual([attachmentTypes.video])
    expect(getPendingMessagesFromMap(channelId)).toHaveLength(0)
  })

  it('does not send anything while still offline', async () => {
    const channelId = 'channel-still-offline'
    const { sdk } = setupChannel(channelId, ['tid-wait'])

    await sendOffline(channelId, 'wait for network')
    await run(__messageSagaTestables.resumePendingMessagesAfterReconnect, {
      payload: { status: CONNECTION_STATUS.CONNECTING }
    })

    expect(sdk.sendMessage).not.toHaveBeenCalled()
    expect(visibleMessages()).toHaveLength(1)
    expect(getPendingMessagesFromMap(channelId)).toHaveLength(1)
  })
})

describe('offline / reconnect: messages with metadata', () => {
  beforeEach(() => {
    jest.spyOn(log, 'error').mockImplementation(() => undefined)
    jest.spyOn(log, 'info').mockImplementation(() => undefined)
    resetMessageListFixtureIds()
    resetMockServerDelay()
    clearMessagesMap()
    destroyChannelsMap()
    __resetMessageSagaTestState()
    resetState()
    mockStore.getState.mockImplementation(() => state)
    mockStore.dispatch.mockImplementation((action: any) => applyAction(action))
    setClient({ user: { id: 'current-user' }, Channel: { create: jest.fn() } })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    clearMessagesMap()
    destroyChannelsMap()
    setActiveChannelId('')
    __resetMessageSagaTestState()
  })

  // Regression: the first (offline) send stores the pending message with its
  // metadata parsed to an object. The resend used to JSON.parse that object,
  // throw, and never send the message.
  it('a message with metadata sent while offline is sent after reconnect, with metadata as a string', async () => {
    const channelId = 'channel-offline-metadata'
    const { sdk } = setupChannel(channelId, ['tid-meta'])

    await sendOffline(channelId, 'with metadata', { metadata: { kind: 'custom' } })
    sdk.sendMessage = confirmingSend(channelId, 800)
    await reconnect()

    expect(sdk.sendMessage).toHaveBeenCalledTimes(1)
    expect(sdk.sendMessage.mock.calls[0][0].metadata).toBe(JSON.stringify({ kind: 'custom' }))
    expect(visibleMessages()).toEqual([expect.objectContaining({ id: '800', tid: 'tid-meta' })])
    expect(getPendingMessagesFromMap(channelId)).toHaveLength(0)
  })
})
