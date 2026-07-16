import { runSaga } from 'redux-saga'
import log from 'loglevel'
import { setClient } from '../../common/client'
import {
  addMessageToMap,
  clearMessagesMap,
  deletePendingAttachment,
  getPendingMessagesFromMap,
  setPendingAttachment
} from '../../helpers/messagesHalper'
import { destroyChannelsMap, setActiveChannelId, setChannelInMap } from '../../helpers/channelHalper'
import { CONNECTION_STATUS } from '../user/constants'
import { attachmentTypes, LOADING_STATE, MESSAGE_STATUS, UPLOAD_STATE } from '../../helpers/constants'
import {
  makeChannel,
  makeMessage,
  makePendingMessage,
  makeUser,
  resetMessageListFixtureIds
} from '../../testUtils/messageFixtures'
import { resendMessageAC, updateAttachmentUploadingStateAC, updateMessageAC } from './actions'
import { RESEND_MESSAGE } from './constants'
import { setCustomUploader, setSendAttachmentsAsSeparateMessages } from '../../helpers/customUploader'
import { handleUploadAttachments, __messageSagaTestables, __resetMessageSagaTestState } from './saga'

const mockStoreState = {
  ChannelReducer: {
    channelsLoadingState: LOADING_STATE.LOADED,
    activeChannel: {}
  },
  UserReducer: {
    connectionStatus: CONNECTION_STATUS.CONNECTED,
    waitToSendPendingMessages: false
  },
  MessageReducer: {
    activeChannelMessages: [],
    activePaginationIntent: null,
    tabAttachmentsCache: {},
    pendingPollActions: {},
    pendingMessageMutations: {},
    oGMetadata: {}
  }
}

const mockStore = {
  getState: jest.fn(() => mockStoreState),
  dispatch: jest.fn()
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

const runMessageSaga = async (saga: any, ...args: any[]) => {
  const dispatched: any[] = []

  await runSaga(
    {
      dispatch: (effect: any) => {
        dispatched.push(effect)
      },
      getState: () => mockStoreState
    },
    saga,
    ...args
  ).toPromise()

  return dispatched
}

// Stub CustomUploader driven per test: records every attachment handed to
// upload() and settles the upload task synchronously.
let uploadCalls: any[] = []
let uploadBehavior: (attachment: any, uploadTask: any) => void

const networkingError = () => {
  const error: any = new Error('Network Failure')
  error.code = 'NetworkingError'
  return error
}

const succeedUpload =
  (uri = 'https://cdn.example/uploaded-1') =>
  (_attachment: any, uploadTask: any) =>
    uploadTask.success({ uri, blob: null })

const failUploadWithNetworkError = () => (_attachment: any, uploadTask: any) => uploadTask.failure(networkingError())

const makeUploaderChannel = (id: string) => {
  const channel = makeChannel({
    id,
    lastMessage: makeMessage({ id: '900', channelId: id, body: 'last-message' })
  })
  const attachmentBuilder = {
    setName: jest.fn().mockReturnThis(),
    setMetadata: jest.fn().mockReturnThis(),
    setUpload: jest.fn().mockReturnThis(),
    setFileSize: jest.fn().mockReturnThis(),
    create: jest.fn(() => ({ type: attachmentTypes.image, metadata: '{}', upload: false }))
  }
  const messageBuilder = {
    setBody: jest.fn().mockReturnThis(),
    setBodyAttributes: jest.fn().mockReturnThis(),
    setAttachments: jest.fn().mockReturnThis(),
    setMentionUserIds: jest.fn().mockReturnThis(),
    setType: jest.fn().mockReturnThis(),
    setDisplayCount: jest.fn().mockReturnThis(),
    setSilent: jest.fn().mockReturnThis(),
    setMetadata: jest.fn().mockReturnThis(),
    setParentMessageId: jest.fn().mockReturnThis(),
    setReplyInThread: jest.fn().mockReturnThis(),
    setViewOnce: jest.fn().mockReturnThis(),
    setDisableMentionsCount: jest.fn().mockReturnThis(),
    create: jest.fn(() => makePendingMessage({ channelId: id }))
  }
  channel.createAttachmentBuilder = jest.fn(() => attachmentBuilder as any)
  channel.createMessageBuilder = jest.fn(() => messageBuilder as any)
  channel.sendMessage = jest.fn()
  return channel
}

const makeServerResponse = (messageTid: string, attachmentTid: string, user: any) => ({
  id: 'srv-1',
  tid: messageTid,
  body: 'retry attachment',
  type: 'text',
  state: MESSAGE_STATUS.UNMODIFIED,
  deliveryStatus: 'sent',
  user,
  createdAt: new Date().toISOString(),
  attachments: [
    {
      id: 'att-srv-1',
      tid: attachmentTid,
      url: 'https://cdn.example/uploaded-1',
      type: attachmentTypes.image,
      name: 'retry.png',
      size: 128,
      metadata: '{}'
    }
  ]
})

const makeAttachment = (tid: string, data: any) =>
  ({
    tid,
    type: attachmentTypes.image,
    name: 'retry.png',
    size: 128,
    data,
    metadata: '{}',
    upload: false
  }) as any

const makeLiveFile = () => new File(['file-bytes'], 'retry.png', { type: 'image/png' })

// Simulates what JSON.parse(JSON.stringify(...)) does to a File.
const serializedFile = () => ({})

describe('attachment upload recovery', () => {
  let logErrorSpy: jest.SpyInstance
  let logWarnSpy: jest.SpyInstance
  let logInfoSpy: jest.SpyInstance
  const usedAttachmentTids: string[] = []

  const trackPendingAttachment = (tid: string, data: { file?: File }) => {
    usedAttachmentTids.push(tid)
    setPendingAttachment(tid, data)
  }

  beforeEach(() => {
    resetMessageListFixtureIds()
    clearMessagesMap()
    destroyChannelsMap()
    setActiveChannelId('')
    __resetMessageSagaTestState()
    mockStore.dispatch.mockClear()
    mockStore.getState.mockImplementation(() => mockStoreState)
    uploadCalls = []
    uploadBehavior = succeedUpload()
    setSendAttachmentsAsSeparateMessages(false)
    setCustomUploader({
      upload: (attachment: any, uploadTask: any) => {
        uploadCalls.push(attachment)
        uploadBehavior(attachment, uploadTask)
      },
      download: jest.fn()
    })
    setClient({
      user: { id: 'current-user' },
      Channel: { create: jest.fn() }
    })
    logErrorSpy = jest.spyOn(log, 'error').mockImplementation(() => undefined)
    logWarnSpy = jest.spyOn(log, 'warn').mockImplementation(() => undefined)
    logInfoSpy = jest.spyOn(log, 'info').mockImplementation(() => undefined)
  })

  afterEach(() => {
    setCustomUploader(undefined)
    usedAttachmentTids.splice(0).forEach((tid) => deletePendingAttachment(tid))
    logErrorSpy.mockRestore()
    logWarnSpy.mockRestore()
    logInfoSpy.mockRestore()
  })

  it('manual resend of a serialized redux copy uploads the live File from the messages map', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channel = makeUploaderChannel('channel-resend-live-map')
    const liveFile = makeLiveFile()
    const liveMessage = makePendingMessage({
      channelId: channel.id,
      tid: 'live-map-msg-tid',
      body: 'retry attachment',
      user: currentUser,
      state: MESSAGE_STATUS.FAILED,
      attachments: [makeAttachment('live-map-file-tid', liveFile)]
    })
    channel.sendMessage = jest.fn(() =>
      Promise.resolve(makeServerResponse('live-map-msg-tid', 'live-map-file-tid', currentUser))
    )
    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    addMessageToMap(channel.id, liveMessage)

    // The retry button dispatches the redux copy: File fields degraded to {}.
    const reduxCopy = JSON.parse(JSON.stringify(liveMessage))

    const dispatched = await runMessageSaga(
      __messageSagaTestables.resendMessage,
      resendMessageAC(reduxCopy, channel.id, CONNECTION_STATUS.CONNECTED)
    )

    expect(uploadCalls).toHaveLength(1)
    expect(uploadCalls[0].url).toBe(liveFile)
    expect(dispatched).toEqual(
      expect.arrayContaining([updateMessageAC('live-map-msg-tid', expect.objectContaining({ id: 'srv-1' }), true)])
    )
    expect(getPendingMessagesFromMap(channel.id)).toHaveLength(0)
  })

  it('rehydrates a serialized attachment from the pending attachments map before uploading', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channel = makeUploaderChannel('channel-rehydrate-pending')
    const liveFile = makeLiveFile()
    trackPendingAttachment('rehydrate-file-tid', { file: liveFile })
    const serializedMessage = makePendingMessage({
      channelId: channel.id,
      tid: 'rehydrate-msg-tid',
      body: 'retry attachment',
      user: currentUser,
      state: MESSAGE_STATUS.FAILED,
      attachments: [makeAttachment('rehydrate-file-tid', serializedFile())]
    })
    channel.sendMessage = jest.fn(() =>
      Promise.resolve(makeServerResponse('rehydrate-msg-tid', 'rehydrate-file-tid', currentUser))
    )
    setActiveChannelId(channel.id)
    setChannelInMap(channel)

    await runMessageSaga(__messageSagaTestables.sendMessage, {
      type: RESEND_MESSAGE,
      payload: {
        message: serializedMessage,
        connectionState: CONNECTION_STATUS.CONNECTED,
        channelId: channel.id,
        sendAttachmentsAsSeparateMessage: false
      }
    })

    expect(uploadCalls).toHaveLength(1)
    expect(uploadCalls[0].url).toBe(liveFile)
    expect(channel.sendMessage).toHaveBeenCalledTimes(1)
  })

  it('fails without retry loop when the attachment file is gone (post-reload)', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channel = makeUploaderChannel('channel-file-gone')
    const brokenMessage = makePendingMessage({
      channelId: channel.id,
      tid: 'file-gone-msg-tid',
      body: 'retry attachment',
      user: currentUser,
      state: MESSAGE_STATUS.FAILED,
      attachments: [makeAttachment('file-gone-file-tid', serializedFile())]
    })
    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    addMessageToMap(channel.id, brokenMessage)
    expect(getPendingMessagesFromMap(channel.id)).toHaveLength(1)

    const dispatched = await runMessageSaga(__messageSagaTestables.sendMessage, {
      type: RESEND_MESSAGE,
      payload: {
        message: JSON.parse(JSON.stringify(brokenMessage)),
        connectionState: CONNECTION_STATUS.CONNECTED,
        channelId: channel.id,
        sendAttachmentsAsSeparateMessage: false
      }
    })

    expect(uploadCalls).toHaveLength(0)
    expect(channel.sendMessage).not.toHaveBeenCalled()
    expect(dispatched).toEqual(
      expect.arrayContaining([
        updateAttachmentUploadingStateAC(UPLOAD_STATE.FAIL, 'file-gone-file-tid'),
        updateMessageAC('file-gone-msg-tid', { state: MESSAGE_STATUS.FAILED })
      ])
    )
    // Non-resendable: removed from the pending map so reconnects stop retrying it.
    expect(getPendingMessagesFromMap(channel.id)).toHaveLength(0)
  })

  it('keeps a message failed by a network error in the pending map for reconnect resend', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channel = makeUploaderChannel('channel-network-error')
    uploadBehavior = failUploadWithNetworkError()
    const liveFile = makeLiveFile()
    const pendingMessage = makePendingMessage({
      channelId: channel.id,
      tid: 'network-error-msg-tid',
      body: 'retry attachment',
      user: currentUser,
      attachments: [makeAttachment('network-error-file-tid', liveFile)]
    })
    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    addMessageToMap(channel.id, pendingMessage)

    const dispatched = await runMessageSaga(__messageSagaTestables.sendMessage, {
      type: RESEND_MESSAGE,
      payload: {
        message: pendingMessage,
        connectionState: CONNECTION_STATUS.CONNECTED,
        channelId: channel.id,
        sendAttachmentsAsSeparateMessage: false
      }
    })

    expect(uploadCalls).toHaveLength(1)
    expect(dispatched).toEqual(
      expect.arrayContaining([
        updateAttachmentUploadingStateAC(UPLOAD_STATE.FAIL, 'network-error-file-tid'),
        updateMessageAC('network-error-msg-tid', { state: MESSAGE_STATUS.FAILED })
      ])
    )
    expect(getPendingMessagesFromMap(channel.id)).toHaveLength(1)
    expect(getPendingMessagesFromMap(channel.id)[0]).toEqual(
      expect.objectContaining({ tid: 'network-error-msg-tid', state: MESSAGE_STATUS.FAILED })
    )
  })

  it('stops auto-resending after the attempt budget and resumes after a manual retry', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channel = makeUploaderChannel('channel-resend-budget')
    uploadBehavior = failUploadWithNetworkError()
    const liveFile = makeLiveFile()
    const pendingMessage = makePendingMessage({
      channelId: channel.id,
      tid: 'budget-msg-tid',
      body: 'retry attachment',
      user: currentUser,
      attachments: [makeAttachment('budget-file-tid', liveFile)]
    })
    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    addMessageToMap(channel.id, pendingMessage)

    for (let i = 0; i < 6; i++) {
      await runMessageSaga(__messageSagaTestables.sendPendingMessages, CONNECTION_STATUS.CONNECTED)
    }
    // 6 reconnect cycles, but only MAX_AUTO_RESEND_ATTEMPTS (5) upload attempts.
    expect(uploadCalls).toHaveLength(5)
    expect(getPendingMessagesFromMap(channel.id)).toHaveLength(1)

    // A manual retry grants a fresh budget (and performs its own attempt).
    await runMessageSaga(
      __messageSagaTestables.resendMessage,
      resendMessageAC(JSON.parse(JSON.stringify(pendingMessage)), channel.id, CONNECTION_STATUS.CONNECTED)
    )
    expect(uploadCalls).toHaveLength(6)

    await runMessageSaga(__messageSagaTestables.sendPendingMessages, CONNECTION_STATUS.CONNECTED)
    expect(uploadCalls).toHaveLength(7)
  })

  it('does not throw for cachedUrl attachments whose serialized url has no type', async () => {
    const channel = makeUploaderChannel('channel-cached-url')
    const attachment = {
      ...makeAttachment('cached-file-tid', serializedFile()),
      url: serializedFile(),
      cachedUrl: 'https://cdn.example/cached-1'
    }

    const result = await handleUploadAttachments([attachment], { type: 'text' } as any, channel)

    expect(uploadCalls).toHaveLength(0)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(expect.objectContaining({ tid: 'cached-file-tid' }))
  })

  it('handleUploadAttachments recovers the live File by tid when url is serialized', async () => {
    const channel = makeUploaderChannel('channel-direct-rehydrate')
    const liveFile = makeLiveFile()
    trackPendingAttachment('direct-rehydrate-file-tid', { file: liveFile })
    const attachment = {
      ...makeAttachment('direct-rehydrate-file-tid', serializedFile()),
      url: serializedFile()
    }

    const result = await handleUploadAttachments([attachment], { type: 'text' } as any, channel)

    expect(uploadCalls).toHaveLength(1)
    expect(uploadCalls[0].url).toBe(liveFile)
    expect(result[0]).toEqual(expect.objectContaining({ tid: 'direct-rehydrate-file-tid' }))
  })

  it('handleUploadAttachments rejects as AttachmentUnavailable when no live File exists', async () => {
    const channel = makeUploaderChannel('channel-direct-unavailable')
    const attachment = {
      ...makeAttachment('direct-unavailable-file-tid', serializedFile()),
      url: serializedFile()
    }

    await expect(handleUploadAttachments([attachment], { type: 'text' } as any, channel)).rejects.toMatchObject({
      type: 'AttachmentUnavailable'
    })
    expect(uploadCalls).toHaveLength(0)
  })
})
