import { runSaga } from 'redux-saga'
import log from 'loglevel'
import { getClient, setClient } from '../../common/client'
import {
  addMessageToMap,
  clearMessagesMap,
  deletePendingMessage,
  deletePendingAttachment,
  getPendingAttachment,
  getMessageFromMap,
  getPendingMessagesFromMap,
  setPendingAttachment,
  updateMessageOnMap
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
import {
  deleteMessageAC,
  resendMessageAC,
  sendMessageAC,
  updateAttachmentUploadingProgressAC,
  updateAttachmentUploadingStateAC,
  updateMessageAC
} from './actions'
import { RESEND_MESSAGE } from './constants'
import {
  markUploadNotStarted,
  pauseUpload,
  setCustomUploader,
  setSendAttachmentsAsSeparateMessages,
  uploadAttachmentFile
} from '../../helpers/customUploader'
import { handleUploadAttachments, __messageSagaTestables, __resetMessageSagaTestState } from './saga'
import store from '../index'
import {
  beginVideoPreparation,
  completeAttachmentPreview,
  completeVideoPreparation
} from '../../helpers/attachmentPreparation'
import { setEncryptAttachments } from '../../helpers/attachmentEncryption'
import { installFakeFilesClient, readBlobText } from '../../testUtils/fakeAttachmentFiles'

const mockGetVideoFirstFrame = jest.fn()
const mockGetVideoPreviewFrame = jest.fn()
jest.mock('helpers/getVideoFrame', () => ({
  getVideoFirstFrame: (...args: any[]) => mockGetVideoFirstFrame(...args),
  getVideoPreviewFrame: (...args: any[]) => {
    mockGetVideoPreviewFrame(...args)
    return mockGetVideoFirstFrame(...args)
  }
}))

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
  channel.createAttachmentBuilder = jest.fn((_url: any, type: string) => {
    let metadata = '{}'
    let upload = false
    const attachmentBuilder = {
      setName: jest.fn().mockReturnThis(),
      setMetadata: jest.fn((value: string) => {
        metadata = value
        return attachmentBuilder
      }),
      setUpload: jest.fn((value: boolean) => {
        upload = value
        return attachmentBuilder
      }),
      setFileSize: jest.fn().mockReturnThis(),
      create: jest.fn(() => ({ url: _url, data: _url, type, metadata, upload }))
    }
    ;(channel as any).__attachmentBuilder = attachmentBuilder
    return attachmentBuilder as any
  })
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
  // An attachment tid whose pending entry (the sending code may add one) is cleared after the test.
  const trackedTid = (tid: string) => {
    usedAttachmentTids.push(tid)
    return tid
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
    mockGetVideoFirstFrame.mockReset()
    mockGetVideoPreviewFrame.mockReset()
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

  it('does not start an upload for a pending attachment deleted before its send work resumes', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channel = makeUploaderChannel('channel-deleted-pending-attachment')
    const liveFile = makeLiveFile()
    const pendingMessage = makePendingMessage({
      channelId: channel.id,
      tid: 'deleted-pending-message-tid',
      body: 'delete before upload',
      user: currentUser,
      state: MESSAGE_STATUS.FAILED,
      attachments: [makeAttachment('deleted-pending-file-tid', liveFile)]
    })

    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    addMessageToMap(channel.id, pendingMessage)

    // This mirrors deleting a pending bubble while its video preparation or
    // upload callback is still queued.
    deletePendingMessage(channel.id, pendingMessage)

    await runMessageSaga(__messageSagaTestables.sendMessage, {
      type: RESEND_MESSAGE,
      payload: {
        message: pendingMessage,
        connectionState: CONNECTION_STATUS.CONNECTED,
        channelId: channel.id,
        sendAttachmentsAsSeparateMessage: false
      }
    })

    expect(uploadCalls).toHaveLength(0)
    expect(channel.sendMessage).not.toHaveBeenCalled()
    expect(getMessageFromMap(channel.id, pendingMessage.tid!)).toBeNull()
  })

  it('cancels a still-uploading attachment locally even after the SDK assigns an id', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channel = makeUploaderChannel('channel-delete-sdk-pending-attachment')
    const liveFile = makeLiveFile()
    const pendingMessage = makePendingMessage({
      id: 'sdk-pending-message-id',
      channelId: channel.id,
      tid: 'sdk-pending-message-tid',
      body: 'delete before attachment upload completes',
      user: currentUser,
      attachments: [makeAttachment('sdk-pending-file-tid', liveFile)]
    })

    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    setPendingAttachment('sdk-pending-file-tid', {
      file: liveFile,
      messageTid: pendingMessage.tid,
      channelId: channel.id
    })
    addMessageToMap(channel.id, pendingMessage)

    await runMessageSaga(
      __messageSagaTestables.deleteMessage,
      deleteMessageAC(channel.id, pendingMessage.id!, 'forEveryone')
    )

    expect(channel.deleteMessageById).not.toHaveBeenCalled()
    expect(getMessageFromMap(channel.id, pendingMessage.id!)).toBeNull()
  })

  it('does not call channel.sendMessage when deletion cancels a custom upload in progress', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channel = makeUploaderChannel('channel-delete-during-custom-upload')
    const liveFile = makeLiveFile()
    const pendingMessage = makePendingMessage({
      channelId: channel.id,
      tid: 'delete-during-custom-upload-message-tid',
      body: 'delete during custom upload',
      user: currentUser,
      state: MESSAGE_STATUS.FAILED,
      attachments: [makeAttachment('delete-during-custom-upload-file-tid', liveFile)]
    })
    uploadBehavior = (_attachment, uploadTask) => {
      uploadTask.cancel = () => uploadTask.failure(new Error('Upload cancelled by user'))
    }

    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    addMessageToMap(channel.id, pendingMessage)

    const task = runSaga(
      {
        dispatch: jest.fn(),
        getState: () => mockStoreState
      },
      __messageSagaTestables.sendMessage,
      {
        type: RESEND_MESSAGE,
        payload: {
          message: pendingMessage,
          connectionState: CONNECTION_STATUS.CONNECTED,
          channelId: channel.id,
          sendAttachmentsAsSeparateMessage: false
        }
      }
    )

    for (let attempt = 0; attempt < 20 && uploadCalls.length === 0; attempt++) {
      await Promise.resolve()
    }
    expect(uploadCalls).toHaveLength(1)

    deletePendingMessage(channel.id, pendingMessage)
    await task.toPromise()

    expect(channel.sendMessage).not.toHaveBeenCalled()
    expect(channel.deleteMessageById).not.toHaveBeenCalled()
    expect(getMessageFromMap(channel.id, pendingMessage.tid!)).toBeNull()
  })

  it('retracts a response that wins the race with pending-message deletion', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channel = makeUploaderChannel('channel-deleted-pending-race')
    const liveFile = makeLiveFile()
    const pendingMessage = makePendingMessage({
      channelId: channel.id,
      tid: 'deleted-pending-race-message-tid',
      body: 'delete during upload',
      user: currentUser,
      attachments: [makeAttachment('deleted-pending-race-file-tid', liveFile)]
    })
    let resolveSend!: (value: any) => void
    channel.sendMessage = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveSend = resolve
        })
    )

    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    addMessageToMap(channel.id, pendingMessage)

    const dispatched: any[] = []
    const task = runSaga(
      {
        dispatch: (effect: any) => dispatched.push(effect),
        getState: () => mockStoreState
      },
      __messageSagaTestables.sendMessage,
      {
        type: RESEND_MESSAGE,
        payload: {
          message: pendingMessage,
          connectionState: CONNECTION_STATUS.CONNECTED,
          channelId: channel.id,
          sendAttachmentsAsSeparateMessage: false
        }
      }
    )

    for (let attempt = 0; attempt < 20 && !channel.sendMessage.mock.calls.length; attempt++) {
      await Promise.resolve()
    }
    expect(channel.sendMessage).toHaveBeenCalledTimes(1)

    deletePendingMessage(channel.id, pendingMessage)
    resolveSend(makeServerResponse(pendingMessage.tid!, 'deleted-pending-race-file-tid', currentUser))
    await task.toPromise()

    expect(channel.deleteMessageById).toHaveBeenCalledWith('srv-1', false)
    expect(getMessageFromMap(channel.id, pendingMessage.tid!)).toBeNull()
  })

  it('does not add an optimistic image row until its local preview preparation resolves', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channel = makeUploaderChannel('channel-image-preview-before-pending')
    const image = new File(['image-bytes'], 'photo.png', { type: 'image/png' })
    const attachmentTid = 'image-preview-before-pending-file-tid'
    let resolveSend!: (value: any) => void
    channel.sendMessage = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveSend = resolve
        })
    )
    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    beginVideoPreparation(attachmentTid, image)

    const task = runSaga(
      { dispatch: () => undefined, getState: () => mockStoreState },
      __messageSagaTestables.sendMessage,
      sendMessageAC(
        {
          body: 'photo',
          bodyAttributes: [],
          attachments: [
            {
              tid: attachmentTid,
              type: attachmentTypes.image,
              name: image.name,
              size: image.size,
              data: image,
              metadata: '{}',
              upload: false
            }
          ],
          mentionedUsers: [],
          type: 'text',
          metadata: {},
          parentMessage: null,
          repliedInThread: false
        },
        channel.id,
        CONNECTION_STATUS.CONNECTED,
        false
      )
    )

    await Promise.resolve()
    expect(getPendingMessagesFromMap(channel.id)).toHaveLength(0)
    expect(channel.sendMessage).not.toHaveBeenCalled()

    completeVideoPreparation(attachmentTid, {
      file: image,
      metadata: { tmb: 'image-thumb', szw: 640, szh: 480 }
    })
    for (let attempt = 0; attempt < 20 && !channel.sendMessage.mock.calls.length; attempt++) {
      await Promise.resolve()
    }

    const [pendingMessage] = getPendingMessagesFromMap(channel.id)
    expect(pendingMessage).toEqual(
      expect.objectContaining({
        attachments: [
          expect.objectContaining({ tid: attachmentTid, metadata: { tmb: 'image-thumb', szw: 640, szh: 480 } })
        ]
      })
    )

    resolveSend(makeServerResponse(pendingMessage.tid!, attachmentTid, currentUser))
    await task.toPromise()
  })

  it('attachments sent as separate messages all show while the first one still uploads, and are sent in order', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channel = makeUploaderChannel('channel-separate-rows')
    const messageBuilder: any = channel.createMessageBuilder()
    messageBuilder.create
      .mockImplementationOnce(() => makePendingMessage({ channelId: channel.id, tid: 'separate-msg-1' }))
      .mockImplementationOnce(() => makePendingMessage({ channelId: channel.id, tid: 'separate-msg-2' }))
    const uploads: any[] = []
    uploadBehavior = (_attachment, uploadTask) => uploads.push(uploadTask)
    channel.sendMessage = jest.fn((sent: any) =>
      Promise.resolve({
        ...makeServerResponse(sent.tid, sent.attachments[0].tid, currentUser),
        id: `srv-${sent.tid}`
      })
    )
    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    const file = (tid: string, name: string) => ({
      tid,
      type: attachmentTypes.file,
      name,
      size: 3,
      data: new File(['abc'], name, { type: 'application/pdf' }),
      metadata: '{}',
      upload: false
    })
    const settle = async (done: () => boolean) => {
      for (let attempt = 0; attempt < 200 && !done(); attempt++) {
        await Promise.resolve()
      }
    }

    const task = runSaga(
      { dispatch: () => undefined, getState: () => mockStoreState },
      __messageSagaTestables.sendMessage,
      sendMessageAC(
        {
          body: 'two files',
          bodyAttributes: [],
          attachments: [file('separate-file-1', 'first.pdf'), file('separate-file-2', 'second.pdf')],
          mentionedUsers: [],
          type: 'text',
          metadata: {},
          parentMessage: null,
          repliedInThread: false
        },
        channel.id,
        CONNECTION_STATUS.CONNECTED,
        true
      )
    )

    await settle(() => uploads.length > 0)
    expect(uploads).toHaveLength(1)
    expect(getPendingMessagesFromMap(channel.id).map((pending) => pending.tid)).toEqual([
      'separate-msg-1',
      'separate-msg-2'
    ])
    expect(channel.sendMessage).not.toHaveBeenCalled()

    uploads[0].success({ uri: 'https://cdn.example/first.pdf', blob: null })
    await settle(() => uploads.length > 1)
    uploads[1].success({ uri: 'https://cdn.example/second.pdf', blob: null })
    await task.toPromise()

    expect((channel.sendMessage as jest.Mock).mock.calls.map(([sent]) => sent.tid)).toEqual([
      'separate-msg-1',
      'separate-msg-2'
    ])
    expect(getPendingMessagesFromMap(channel.id)).toHaveLength(0)
  })

  it('shows no upload progress reported while the browser is offline (bytes that went into a lost connection)', async () => {
    const channel = makeUploaderChannel('channel-offline-progress')
    const file = new File(['abc'], 'report.pdf', { type: 'application/pdf' })
    const attachment = {
      ...makeAttachment(trackedTid('offline-progress-tid'), file),
      url: file,
      type: attachmentTypes.file
    }
    let task: any
    uploadBehavior = (_attachment, uploadTask) => (task = uploadTask)
    const onLine = jest.spyOn(window.navigator, 'onLine', 'get')
    try {
      const upload = handleUploadAttachments([attachment], { type: 'text' } as any, channel)
      await Promise.resolve()
      await Promise.resolve()
      onLine.mockReturnValue(true)
      task.progress({ loaded: 1, total: 10 })
      onLine.mockReturnValue(false)
      task.progress({ loaded: 10, total: 10 })
      onLine.mockReturnValue(true)
      task.progress({ loaded: 2, total: 10 })
      task.success({ uri: 'https://cdn.example/report.pdf', blob: null })
      await upload

      expect(
        mockStore.dispatch.mock.calls
          .map(([action]) => action)
          .filter((action) => action.type === updateAttachmentUploadingProgressAC(0, 0, '').type)
          .map((action) => action.payload.uploaded)
      ).toEqual([1, 2])
    } finally {
      onLine.mockRestore()
    }
  })

  it('shows no upload progress reported while the chat is not connected (online, but every packet lost)', async () => {
    const channel = makeUploaderChannel('channel-disconnected-progress')
    const file = new File(['abc'], 'report.pdf', { type: 'application/pdf' })
    const attachment = {
      ...makeAttachment(trackedTid('disconnected-progress-tid'), file),
      url: file,
      type: attachmentTypes.file
    }
    let task: any
    uploadBehavior = (_attachment, uploadTask) => (task = uploadTask)
    const upload = handleUploadAttachments([attachment], { type: 'text' } as any, channel)
    await Promise.resolve()
    await Promise.resolve()
    Object.assign(getClient(), { connectionState: CONNECTION_STATUS.CONNECTED })
    task.progress({ loaded: 1, total: 10 })
    // The browser stays online; the chat connection timed out.
    Object.assign(getClient(), { connectionState: CONNECTION_STATUS.CONNECTING })
    task.progress({ loaded: 10, total: 10 })
    Object.assign(getClient(), { connectionState: CONNECTION_STATUS.CONNECTED })
    task.progress({ loaded: 2, total: 10 })
    task.success({ uri: 'https://cdn.example/report.pdf', blob: null })
    await upload

    expect(
      mockStore.dispatch.mock.calls
        .map(([action]) => action)
        .filter((action) => action.type === updateAttachmentUploadingProgressAC(0, 0, '').type)
        .map((action) => action.payload.uploaded)
    ).toEqual([1, 2])
  })

  describe('pending messages sent again (after a lost connection)', () => {
    // Two failed messages of a chat, each with a file, waiting to be sent again.
    const setupPendingFiles = (channelId: string) => {
      const currentUser = makeUser({ id: 'current-user' })
      const channel = makeUploaderChannel(channelId)
      const pending = [1, 2].map((n) => {
        const file = new File([`file-${n}`], `file-${n}.pdf`, { type: 'application/pdf' })
        trackPendingAttachment(`${channelId}-file-${n}`, { file })
        const message = makePendingMessage({
          channelId,
          tid: `${channelId}-msg-${n}`,
          user: currentUser,
          state: MESSAGE_STATUS.FAILED,
          attachments: [
            { ...makeAttachment(`${channelId}-file-${n}`, file), type: attachmentTypes.file, name: file.name }
          ]
        })
        addMessageToMap(channelId, message)
        return message
      })
      const uploads: { tid: string; task: any }[] = []
      uploadBehavior = (attachment, uploadTask) => uploads.push({ tid: attachment.tid, task: uploadTask })
      channel.sendMessage = jest.fn((sent: any) =>
        Promise.resolve({
          ...makeServerResponse(sent.tid, sent.attachments[0].tid, currentUser),
          id: `srv-${sent.tid}`
        })
      )
      setActiveChannelId(channelId)
      setChannelInMap(channel)
      return { channel, pending, uploads }
    }
    const resendPending = () =>
      runSaga(
        { dispatch: () => undefined, getState: () => mockStoreState },
        __messageSagaTestables.sendPendingMessages,
        CONNECTION_STATUS.CONNECTED
      )
    const settle = async (done: () => boolean = () => false) => {
      for (let attempt = 0; attempt < 200 && !done(); attempt++) {
        await Promise.resolve()
      }
    }

    it('are sent one at a time, in order, even when two resends start at once (reconnect, and the chat loading)', async () => {
      const { channel, uploads } = setupPendingFiles('channel-resend-in-order')

      const first = resendPending()
      const second = resendPending()
      await settle()
      // Only the first message's file uploads.
      expect(uploads.map((upload) => upload.tid)).toEqual(['channel-resend-in-order-file-1'])

      uploads[0].task.success({ uri: 'https://cdn.example/file-1.pdf', blob: null })
      await settle(() => uploads.length > 1)
      expect(uploads.map((upload) => upload.tid)).toEqual([
        'channel-resend-in-order-file-1',
        'channel-resend-in-order-file-2'
      ])
      uploads[1].task.success({ uri: 'https://cdn.example/file-2.pdf', blob: null })
      await first.toPromise()
      await second.toPromise()

      expect((channel.sendMessage as jest.Mock).mock.calls.map(([sent]) => sent.tid)).toEqual([
        'channel-resend-in-order-msg-1',
        'channel-resend-in-order-msg-2'
      ])
      expect(getPendingMessagesFromMap(channel.id)).toHaveLength(0)
    })

    it('when one fails again, the ones after it wait: the next round sends them after it, in order', async () => {
      const { channel, uploads } = setupPendingFiles('channel-resend-fails-again')
      // Were the second message tried, its small file would go through (the network came back meanwhile).
      uploadBehavior = (attachment, uploadTask) => {
        uploads.push({ tid: attachment.tid, task: uploadTask })
        if (attachment.tid === 'channel-resend-fails-again-file-2') {
          uploadTask.success({ uri: 'https://cdn.example/file-2.pdf', blob: null })
        }
      }
      const run = resendPending()
      await settle(() => uploads.length > 0)
      // The connection is lost again while the first message's file uploads.
      uploads[0].task.failure(networkingError())
      await run.toPromise()

      // The second message was not tried meanwhile (it would be sent before the first).
      expect(uploads.map((upload) => upload.tid)).toEqual(['channel-resend-fails-again-file-1'])
      expect(channel.sendMessage).not.toHaveBeenCalled()
      expect(getPendingMessagesFromMap(channel.id).map((message) => message.tid)).toEqual([
        'channel-resend-fails-again-msg-1',
        'channel-resend-fails-again-msg-2'
      ])

      // The connection is back: the next round sends both, in order.
      uploadBehavior = (attachment, uploadTask) => {
        uploads.push({ tid: attachment.tid, task: uploadTask })
        uploadTask.success({ uri: `https://cdn.example/${attachment.tid}`, blob: null })
      }
      await resendPending().toPromise()

      expect((channel.sendMessage as jest.Mock).mock.calls.map(([sent]) => sent.tid)).toEqual([
        'channel-resend-fails-again-msg-1',
        'channel-resend-fails-again-msg-2'
      ])
      expect(getPendingMessagesFromMap(channel.id)).toHaveLength(0)
    })

    it('a message sent meanwhile (by another send) is not sent again, nor shown as failed', async () => {
      const { channel, uploads } = setupPendingFiles('channel-resend-sent-meanwhile')
      // A second file to upload (were message 2 sent again) is stored at once.
      uploadBehavior = (attachment, uploadTask) => {
        uploads.push({ tid: attachment.tid, task: uploadTask })
        if (attachment.tid === 'channel-resend-sent-meanwhile-file-2') {
          uploadTask.success({ uri: 'https://cdn.example/file-2.pdf', blob: null })
        }
      }
      const run = resendPending()
      await settle(() => uploads.length > 0)

      // Message 2 is sent by another send while the first message uploads.
      updateMessageOnMap(channel.id, {
        messageId: 'channel-resend-sent-meanwhile-msg-2',
        params: { id: 'srv-msg-2', state: MESSAGE_STATUS.UNMODIFIED }
      })
      // The first message's upload is lost again.
      uploads[0].task.failure(networkingError())
      await run.toPromise()

      expect(uploads.map((upload) => upload.tid)).toEqual(['channel-resend-sent-meanwhile-file-1'])
      expect(channel.sendMessage).not.toHaveBeenCalled()
      expect(
        getMessageFromMap(channel.id, 'srv-msg-2') ||
          getMessageFromMap(channel.id, 'channel-resend-sent-meanwhile-msg-2')
      ).toEqual(expect.objectContaining({ id: 'srv-msg-2', state: MESSAGE_STATUS.UNMODIFIED }))
    })
  })

  it('when a lost connection fails a message, the next ones wait for it: they are sent after it, in order', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channel = makeUploaderChannel('channel-wait-for-failed')
    const messageBuilder: any = channel.createMessageBuilder()
    messageBuilder.create
      .mockImplementationOnce(() => makePendingMessage({ channelId: channel.id, tid: 'wait-msg-1' }))
      .mockImplementationOnce(() => makePendingMessage({ channelId: channel.id, tid: 'wait-msg-2' }))
    const uploads: string[] = []
    // The first upload is cut by a lost connection; every later one goes through.
    uploadBehavior = (attachment, uploadTask) => {
      uploads.push(attachment.tid)
      if (uploads.length === 1) uploadTask.failure(networkingError())
      else uploadTask.success({ uri: `https://cdn.example/${attachment.tid}`, blob: null })
    }
    channel.sendMessage = jest.fn((sent: any) =>
      Promise.resolve({ ...makeServerResponse(sent.tid, sent.attachments[0].tid, currentUser), id: `srv-${sent.tid}` })
    )
    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    const file = (tid: string, name: string) => ({
      tid: trackedTid(tid),
      type: attachmentTypes.file,
      name,
      size: 3,
      data: new File(['abc'], name, { type: 'application/pdf' }),
      metadata: '{}',
      upload: false
    })

    await runSaga(
      { dispatch: () => undefined, getState: () => mockStoreState },
      __messageSagaTestables.sendMessage,
      sendMessageAC(
        {
          body: 'two files',
          bodyAttributes: [],
          attachments: [file('wait-file-1', 'first.pdf'), file('wait-file-2', 'second.pdf')],
          mentionedUsers: [],
          type: 'text',
          metadata: {},
          parentMessage: null,
          repliedInThread: false
        },
        channel.id,
        CONNECTION_STATUS.CONNECTED,
        true
      )
    ).toPromise()
    // The connection is back: the waiting messages are sent again, one at a time, in order.
    for (let attempt = 0; attempt < 400 && getPendingMessagesFromMap(channel.id).length > 0; attempt++) {
      await Promise.resolve()
    }

    expect(uploads).toEqual(['wait-file-1', 'wait-file-1', 'wait-file-2'])
    expect((channel.sendMessage as jest.Mock).mock.calls.map(([sent]) => sent.tid)).toEqual([
      'wait-msg-1',
      'wait-msg-2'
    ])
    expect(getPendingMessagesFromMap(channel.id)).toHaveLength(0)
  })

  it('a reconnect while messages are still uploading leaves them to that send: each file is uploaded and sent once', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channel = makeUploaderChannel('channel-reconnect-while-uploading')
    const messageBuilder: any = channel.createMessageBuilder()
    messageBuilder.create
      .mockImplementationOnce(() => makePendingMessage({ channelId: channel.id, tid: 'uploading-msg-1' }))
      .mockImplementationOnce(() => makePendingMessage({ channelId: channel.id, tid: 'uploading-msg-2' }))
    const uploads: any[] = []
    uploadBehavior = (_attachment, uploadTask) => uploads.push(uploadTask)
    channel.sendMessage = jest.fn((sent: any) =>
      Promise.resolve({
        ...makeServerResponse(sent.tid, sent.attachments[0].tid, currentUser),
        id: `srv-${sent.tid}`
      })
    )
    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    const file = (tid: string, name: string) => ({
      tid,
      type: attachmentTypes.file,
      name,
      size: 3,
      data: new File(['abc'], name, { type: 'application/pdf' }),
      metadata: '{}',
      upload: false
    })
    const settle = async (done: () => boolean = () => false) => {
      for (let attempt = 0; attempt < 200 && !done(); attempt++) {
        await Promise.resolve()
      }
    }
    const send = runSaga(
      { dispatch: () => undefined, getState: () => mockStoreState },
      __messageSagaTestables.sendMessage,
      sendMessageAC(
        {
          body: 'two files',
          bodyAttributes: [],
          attachments: [file('uploading-file-1', 'first.pdf'), file('uploading-file-2', 'second.pdf')],
          mentionedUsers: [],
          type: 'text',
          metadata: {},
          parentMessage: null,
          repliedInThread: false
        },
        channel.id,
        CONNECTION_STATUS.CONNECTED,
        true
      )
    )
    await settle(() => uploads.length > 0)

    // The connection drops and comes back while the first file uploads (its uploader goes on by itself).
    mockStoreState.UserReducer.waitToSendPendingMessages = true
    try {
      const reconnect = runSaga(
        { dispatch: () => undefined, getState: () => mockStoreState },
        __messageSagaTestables.resumePendingMessagesAfterReconnect,
        { payload: { status: CONNECTION_STATUS.CONNECTED } }
      )
      await settle()
      expect(uploads).toHaveLength(1)

      uploads[0].success({ uri: 'https://cdn.example/first.pdf', blob: null })
      await settle(() => uploads.length > 1)
      uploads[1].success({ uri: 'https://cdn.example/second.pdf', blob: null })
      await send.toPromise()
      await reconnect.toPromise()
    } finally {
      mockStoreState.UserReducer.waitToSendPendingMessages = false
    }

    expect(uploads).toHaveLength(2)
    expect((channel.sendMessage as jest.Mock).mock.calls.map(([sent]) => sent.tid)).toEqual([
      'uploading-msg-1',
      'uploading-msg-2'
    ])
    expect(getPendingMessagesFromMap(channel.id)).toHaveLength(0)
  })

  it('shows a video row as soon as its preview is ready, while its conversion still runs, and uploads the converted file', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channel = makeUploaderChannel('channel-video-row-before-conversion')
    const original = new File(['quicktime-bytes'], 'clip.mov', { type: 'video/quicktime' })
    const converted = new File(['mp4-bytes'], 'clip.mp4', { type: 'video/mp4' })
    const attachmentTid = 'video-row-before-conversion-tid'
    const preview = {
      metadata: { tmb: 'video-thumb', szw: 1280, szh: 720, dur: 9 },
      videoPreviewBlob: new Blob(['frame'], { type: 'image/jpeg' })
    }
    let resolveSend!: (value: any) => void
    channel.sendMessage = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveSend = resolve
        })
    )
    const settle = async (until: () => boolean) => {
      for (let attempt = 0; attempt < 50 && !until(); attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
    }
    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    beginVideoPreparation(attachmentTid, original)

    const task = runSaga(
      { dispatch: () => undefined, getState: () => mockStoreState },
      __messageSagaTestables.sendMessage,
      sendMessageAC(
        {
          body: 'video',
          bodyAttributes: [],
          attachments: [
            {
              tid: attachmentTid,
              type: attachmentTypes.video,
              name: original.name,
              size: original.size,
              data: original,
              metadata: '{}',
              upload: false
            }
          ],
          mentionedUsers: [],
          type: 'text',
          metadata: {},
          parentMessage: null,
          repliedInThread: false
        },
        channel.id,
        CONNECTION_STATUS.CONNECTED,
        false
      )
    )

    await Promise.resolve()
    expect(getPendingMessagesFromMap(channel.id)).toHaveLength(0)

    // The frame is ready; the QuickTime-to-MP4 conversion is still running.
    completeAttachmentPreview(attachmentTid, preview)
    await settle(() => getPendingMessagesFromMap(channel.id).length > 0)

    const [pendingMessage] = getPendingMessagesFromMap(channel.id)
    expect(pendingMessage.attachments[0]).toEqual(
      expect.objectContaining({ tid: attachmentTid, metadata: preview.metadata })
    )
    expect(uploadCalls).toHaveLength(0)

    completeVideoPreparation(attachmentTid, { file: converted, ...preview })
    await settle(() => channel.sendMessage.mock.calls.length > 0)

    // The preview image, then the converted video (not the original .mov).
    expect(uploadCalls).toHaveLength(2)
    expect(uploadCalls[1].url === converted).toBe(true)
    expect(uploadCalls[1].name).toBe('clip.mp4')
    // The pending row now describes the converted file too.
    const pendingAttachment = getMessageFromMap(channel.id, pendingMessage.tid!)!.attachments[0]
    expect(pendingAttachment.name).toBe('clip.mp4')
    expect(pendingAttachment.data === converted).toBe(true)

    resolveSend(makeServerResponse(pendingMessage.tid!, attachmentTid, currentUser))
    await task.toPromise()
  })

  it('waits for the offline video preview before adding its pending message, then preserves it for reconnect', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channel = makeUploaderChannel('channel-offline-video-reconnect')
    const video = new File(['video-bytes'], 'offline-video.mp4', { type: 'video/mp4' })
    const attachmentTid = 'offline-video-file-tid'

    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    // The compose background work is still running when Send is pressed. The
    // pending row must not be rendered until it can show a video preview.
    beginVideoPreparation(attachmentTid, video)

    const task = runSaga(
      {
        dispatch: () => undefined,
        getState: () => mockStoreState
      },
      __messageSagaTestables.sendMessage,
      sendMessageAC(
        {
          body: 'offline video',
          bodyAttributes: [],
          attachments: [
            {
              tid: attachmentTid,
              type: attachmentTypes.video,
              name: video.name,
              size: video.size,
              data: video,
              metadata: '{}',
              upload: false
            }
          ],
          mentionedUsers: [],
          type: 'text',
          metadata: {},
          parentMessage: null,
          repliedInThread: false
        },
        channel.id,
        CONNECTION_STATUS.DISCONNECTED,
        false
      )
    )

    await Promise.resolve()
    expect(getPendingMessagesFromMap(channel.id)).toHaveLength(0)

    completeVideoPreparation(attachmentTid, {
      file: video,
      metadata: { tmb: 'local-thumb', szw: 1280, szh: 720, dur: 4 },
      videoPreviewBlob: new Blob(['preview'], { type: 'image/jpeg' })
    })
    await task.toPromise()

    const [offlinePendingMessage] = getPendingMessagesFromMap(channel.id)
    expect(offlinePendingMessage).toEqual(expect.objectContaining({ state: MESSAGE_STATUS.FAILED }))
    expect(offlinePendingMessage.attachments).toEqual(
      expect.arrayContaining([expect.objectContaining({ tid: attachmentTid, type: attachmentTypes.video })])
    )
    expect(offlinePendingMessage.attachments[0].data).toBe(video)
    expect(getPendingAttachment(attachmentTid)?.file).toBe(video)
    expect(uploadCalls).toHaveLength(0)

    // Retry the serialized pending message, as reconnect does after Redux has
    // rendered it. The File must be restored from the per-attachment source map.
    channel.sendMessage = jest.fn((outgoingMessage: any) =>
      Promise.resolve({
        ...makeServerResponse(offlinePendingMessage.tid, attachmentTid, currentUser),
        attachments: [
          {
            ...outgoingMessage.attachments[0],
            id: 'offline-video-server-attachment-id',
            tid: attachmentTid,
            // The reconnect event can arrive with only IDs and metadata.
            // The saga must retain the local uploaded video fields.
            type: undefined,
            name: '',
            url: ''
          }
        ]
      })
    )
    // Channel maps intentionally keep a shallow snapshot; refresh it after
    // replacing the transport mock to mirror an SDK reconnect.
    setChannelInMap(channel)

    await runMessageSaga(__messageSagaTestables.sendPendingMessages, CONNECTION_STATUS.CONNECTED)

    expect(uploadCalls).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: attachmentTypes.video, url: video })])
    )
    expect(channel.sendMessage).toHaveBeenCalledTimes(1)
    expect(getPendingMessagesFromMap(channel.id)).toHaveLength(0)
    expect(getMessageFromMap(channel.id, offlinePendingMessage.tid!)?.attachments).toEqual([
      expect.objectContaining({
        type: attachmentTypes.video,
        tid: attachmentTid,
        name: video.name,
        url: 'https://cdn.example/uploaded-1'
      })
    ])
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

  it('uploads a first-frame JPEG before the video and includes its URL in video metadata', async () => {
    const channel = makeUploaderChannel('channel-video-preview')
    const video = new File(['video-bytes'], 'clip.mp4', { type: 'video/mp4' })
    const previewBlob = new Blob(['preview-bytes'], { type: 'image/jpeg' })
    const uploadOrder: string[] = []
    mockGetVideoFirstFrame.mockResolvedValue({ blob: previewBlob })
    uploadBehavior = (uploadedAttachment, uploadTask) => {
      if (uploadedAttachment.type === attachmentTypes.image) {
        uploadOrder.push('preview')
        uploadTask.success({ uri: 'https://cdn.example/clip-preview.jpg', blob: null })
        return
      }
      uploadOrder.push('video')
      uploadTask.success({ uri: 'https://cdn.example/clip.mp4', blob: null })
    }
    setCustomUploader({
      upload: (attachment: any, uploadTask: any) => {
        uploadCalls.push(attachment)
        uploadBehavior(attachment, uploadTask)
      },
      download: jest.fn()
    })
    const attachment = {
      tid: 'video-preview-tid',
      type: attachmentTypes.video,
      name: 'clip.mp4',
      size: video.size,
      url: video,
      data: video,
      metadata: '{"tmb":"thumb","szw":1280,"szh":720,"dur":12}',
      upload: false
    } as any

    await handleUploadAttachments([attachment], { type: 'text' } as any, channel)

    expect(mockGetVideoFirstFrame).toHaveBeenCalledWith(video)
    expect(uploadCalls[0]).toEqual(expect.objectContaining({ name: 'clip-preview.jpg', type: attachmentTypes.image }))
    expect(uploadOrder).toEqual(['preview', 'video'])
    expect(channel.createAttachmentBuilder).toHaveBeenCalledWith('https://cdn.example/clip.mp4', attachmentTypes.video)
    expect((channel as any).__attachmentBuilder.setMetadata).toHaveBeenCalledWith(
      expect.stringContaining('"video_thumb":"https://cdn.example/clip-preview.jpg"')
    )
  })

  it('a stop pressed while the video preview uploads keeps the video upload stopped when it starts', async () => {
    const channel = makeUploaderChannel('channel-video-preview-stop')
    const video = new File(['video-bytes'], 'clip.mp4', { type: 'video/mp4' })
    mockGetVideoFirstFrame.mockResolvedValue({ blob: new Blob(['preview-bytes'], { type: 'image/jpeg' }) })
    let videoTask: any
    const videoStopped = jest.fn()
    const pauseDispatched: any[] = []
    setCustomUploader({
      upload: (uploadedAttachment: any, uploadTask: any) => {
        if (uploadedAttachment.type === attachmentTypes.image) {
          // The user presses stop while the preview is uploading.
          runSaga(
            { dispatch: (action: any) => pauseDispatched.push(action), getState: () => ({}) },
            __messageSagaTestables.pauseAttachmentUploading as any,
            { payload: { attachmentId: 'video-stop-tid' } }
          )
          uploadTask.success({ uri: 'https://cdn.example/clip-preview.jpg', blob: null })
          return
        }
        videoTask = uploadTask
        uploadTask.stop = videoStopped
      },
      download: jest.fn()
    })
    const attachment = {
      tid: 'video-stop-tid',
      type: attachmentTypes.video,
      name: 'clip.mp4',
      size: video.size,
      url: video,
      data: video,
      metadata: '{"tmb":"thumb","szw":1280,"szh":720,"dur":12}',
      upload: false
    } as any

    const storeDispatch = jest.spyOn(store, 'dispatch')
    const sending = handleUploadAttachments([attachment], { type: 'text' } as any, channel)
    // Let the preview upload, the state change and the video upload's start run.
    for (let i = 0; i < 20; i += 1) await Promise.resolve()

    expect(pauseDispatched).toEqual([updateAttachmentUploadingStateAC(UPLOAD_STATE.PAUSED, 'video-stop-tid')])
    expect(videoStopped).toHaveBeenCalledTimes(1)
    // After the preview, the video shows as paused, not uploading.
    expect(storeDispatch).toHaveBeenCalledWith(updateAttachmentUploadingStateAC(UPLOAD_STATE.PAUSED, 'video-stop-tid'))
    expect(storeDispatch).not.toHaveBeenCalledWith(
      updateAttachmentUploadingStateAC(UPLOAD_STATE.UPLOADING, 'video-stop-tid')
    )

    videoTask?.success({ uri: 'https://cdn.example/clip.mp4', blob: null })
    await sending
  })

  it('a resume pressed while the video preview still uploads shows it as preparing again', () => {
    markUploadNotStarted('video-resume-tid')
    pauseUpload('video-resume-tid')
    setCustomUploader({ upload: jest.fn(), download: jest.fn() })
    const dispatched: any[] = []

    runSaga(
      { dispatch: (action: any) => dispatched.push(action), getState: () => ({}) },
      __messageSagaTestables.resumeAttachmentUploading as any,
      { payload: { attachmentId: 'video-resume-tid' } }
    )

    expect(dispatched).toEqual([updateAttachmentUploadingStateAC(UPLOAD_STATE.PREPARING, 'video-resume-tid')])
  })

  it('uploads the JPEG already generated for the compose preview without extracting a second frame', async () => {
    const channel = makeUploaderChannel('channel-reuse-video-preview')
    const video = new File(['video-bytes'], 'clip.mp4', { type: 'video/mp4' })
    const composePreviewBlob = new Blob(['compose-preview'], { type: 'image/jpeg' })
    uploadBehavior = (uploadedAttachment, uploadTask) => {
      uploadTask.success({
        uri:
          uploadedAttachment.type === attachmentTypes.image
            ? 'https://cdn.example/compose-preview.jpg'
            : 'https://cdn.example/clip.mp4',
        blob: null
      })
    }
    const attachment = {
      tid: 'reuse-video-preview-tid',
      type: attachmentTypes.video,
      name: 'clip.mp4',
      size: video.size,
      url: video,
      data: video,
      metadata: '{"tmb":"thumb","szw":1280,"szh":720,"dur":12}',
      videoPreviewBlob: composePreviewBlob,
      upload: false
    } as any

    await handleUploadAttachments([attachment], { type: 'text' } as any, channel)

    expect(mockGetVideoFirstFrame).not.toHaveBeenCalled()
    expect(uploadCalls[0]).toEqual(
      expect.objectContaining({ type: attachmentTypes.image, data: expect.any(File), size: composePreviewBlob.size })
    )
    expect((channel as any).__attachmentBuilder.setMetadata).toHaveBeenCalledWith(
      expect.stringContaining('"video_thumb":"https://cdn.example/compose-preview.jpg"')
    )
  })

  it('preserves video dimensions, replaces legacy previewImage, and does not extract a second frame after upload', async () => {
    const channel = makeUploaderChannel('channel-video-thumb-metadata')
    const video = new File(['video-bytes'], 'clip.mp4', { type: 'video/mp4' })
    mockGetVideoFirstFrame.mockResolvedValue({ blob: new Blob(['preview'], { type: 'image/jpeg' }) })
    setCustomUploader({
      upload: (attachment: any, uploadTask: any) => {
        uploadCalls.push(attachment)
        uploadTask.success({
          uri:
            attachment.type === attachmentTypes.image
              ? 'https://cdn.example/new-thumb.jpg'
              : 'https://cdn.example/clip.mp4',
          blob: attachment.type === attachmentTypes.video ? video : null
        })
      },
      download: jest.fn()
    })
    const attachment = {
      tid: 'video-thumb-metadata-tid',
      type: attachmentTypes.video,
      name: 'clip.mp4',
      size: video.size,
      url: video,
      data: video,
      metadata: '{"tmb":"legacy-thumb","szw":1280,"szh":720,"dur":12,"previewImage":"https://cdn/old.jpg"}',
      upload: false
    } as any

    const originalCreateObjectURL = URL.createObjectURL
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: jest.fn().mockReturnValue('blob:original-video')
    })
    const [uploadedVideo] = await handleUploadAttachments([attachment], { type: 'text' } as any, channel)
    const metadata = JSON.parse(uploadedVideo.metadata)
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectURL })

    expect(mockGetVideoFirstFrame).toHaveBeenCalledTimes(1)
    expect(metadata).toEqual({
      tmb: 'legacy-thumb',
      szw: 1280,
      szh: 720,
      dur: 12,
      video_thumb: 'https://cdn.example/new-thumb.jpg'
    })
    expect(metadata.previewImage).toBeUndefined()
  })

  it('sends the video only after its preview URL is embedded in the attachment payload', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channel = makeUploaderChannel('channel-video-preview-send')
    const video = new File(['video-bytes'], 'clip.mp4', { type: 'video/mp4' })
    const pendingMessage = makePendingMessage({
      channelId: channel.id,
      tid: 'video-preview-send-tid',
      body: 'video',
      user: currentUser,
      attachments: [
        {
          tid: 'video-preview-send-file-tid',
          type: attachmentTypes.video,
          name: 'clip.mp4',
          size: video.size,
          data: video,
          metadata: '{"tmb":"thumb","szw":1280,"szh":720,"dur":12}',
          upload: false
        } as any
      ]
    })
    mockGetVideoFirstFrame.mockResolvedValue({ blob: new Blob(['preview'], { type: 'image/jpeg' }) })
    channel.sendMessage = jest.fn((message: any) =>
      Promise.resolve({
        ...pendingMessage,
        id: 'video-preview-send-server-id',
        state: MESSAGE_STATUS.UNMODIFIED,
        deliveryStatus: 'sent',
        attachments: [
          {
            ...message.attachments[0],
            id: 'video-preview-send-server-attachment-id',
            tid: 'video-preview-send-file-tid',
            url: 'https://cdn.example/clip.mp4'
          }
        ]
      })
    )
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

    expect(dispatched).toContainEqual(
      updateAttachmentUploadingStateAC(UPLOAD_STATE.PREPARING, 'video-preview-send-file-tid')
    )
    expect(mockStore.dispatch).toHaveBeenCalledWith(
      updateAttachmentUploadingStateAC(UPLOAD_STATE.UPLOADING, 'video-preview-send-file-tid')
    )
    expect(channel.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          expect.objectContaining({
            metadata: expect.stringContaining('"video_thumb":"https://cdn.example/uploaded-1"')
          })
        ]
      })
    )
  })

  it('does not upload the video when preview generation fails', async () => {
    const channel = makeUploaderChannel('channel-video-preview-failure')
    const video = new File(['video-bytes'], 'clip.mp4', { type: 'video/mp4' })
    const attachment = {
      tid: 'video-preview-failure-tid',
      type: attachmentTypes.video,
      name: 'clip.mp4',
      size: video.size,
      url: video,
      data: video,
      metadata: '{}',
      upload: false
    } as any
    mockGetVideoFirstFrame.mockResolvedValue(null)

    await expect(handleUploadAttachments([attachment], { type: 'text' } as any, channel)).rejects.toThrow(
      'Unable to generate video preview image'
    )
    expect(uploadCalls).toHaveLength(0)
  })

  it('does not upload the video when preview upload fails', async () => {
    const channel = makeUploaderChannel('channel-video-preview-upload-failure')
    const video = new File(['video-bytes'], 'clip.mp4', { type: 'video/mp4' })
    const attachment = {
      tid: 'video-preview-upload-failure-tid',
      type: attachmentTypes.video,
      name: 'clip.mp4',
      size: video.size,
      url: video,
      data: video,
      metadata: '{}',
      upload: false
    } as any
    mockGetVideoFirstFrame.mockResolvedValue({ blob: new Blob(['preview'], { type: 'image/jpeg' }) })
    setCustomUploader({
      upload: (attachment: any, uploadTask: any) => {
        uploadCalls.push(attachment)
        if (attachment.type === attachmentTypes.image) {
          uploadTask.failure(new Error('preview upload failed'))
          return
        }
        uploadBehavior(attachment, uploadTask)
      },
      download: jest.fn()
    })

    await expect(handleUploadAttachments([attachment], { type: 'text' } as any, channel)).rejects.toThrow(
      'preview upload failed'
    )
    expect(uploadCalls).toHaveLength(1)
  })

  it('marks the message failed and does not send the video when preview upload fails', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channel = makeUploaderChannel('channel-video-preview-send-failure')
    const video = new File(['video-bytes'], 'clip.mp4', { type: 'video/mp4' })
    const pendingMessage = makePendingMessage({
      channelId: channel.id,
      tid: 'video-preview-send-message-tid',
      body: 'video',
      user: currentUser,
      attachments: [
        {
          tid: 'video-preview-send-attachment-tid',
          type: attachmentTypes.video,
          name: 'clip.mp4',
          size: video.size,
          data: video,
          metadata: '{}',
          upload: false
        } as any
      ]
    })
    mockGetVideoFirstFrame.mockResolvedValue({ blob: new Blob(['preview'], { type: 'image/jpeg' }) })
    setCustomUploader({
      upload: (attachment: any, uploadTask: any) => {
        uploadCalls.push(attachment)
        if (attachment.type === attachmentTypes.image) {
          uploadTask.failure(new Error('preview upload failed'))
          return
        }
        uploadBehavior(attachment, uploadTask)
      },
      download: jest.fn()
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
    expect(channel.sendMessage).not.toHaveBeenCalled()
    expect(dispatched).toEqual(
      expect.arrayContaining([
        updateAttachmentUploadingStateAC(UPLOAD_STATE.FAIL, 'video-preview-send-attachment-tid'),
        updateMessageAC('video-preview-send-message-tid', { state: MESSAGE_STATUS.FAILED })
      ])
    )
    expect(getPendingMessagesFromMap(channel.id)).toEqual([
      expect.objectContaining({ tid: 'video-preview-send-message-tid', state: MESSAGE_STATUS.FAILED })
    ])
  })

  it('after a retryable video upload failure, the video is uploaded again with the preview already uploaded', async () => {
    const channel = makeUploaderChannel('channel-video-preview-retry')
    const video = new File(['video-bytes'], 'clip.mp4', { type: 'video/mp4' })
    const attachment = {
      tid: trackedTid('video-preview-retry-attachment-tid'),
      type: attachmentTypes.video,
      name: 'clip.mp4',
      size: video.size,
      url: video,
      data: video,
      metadata: '{}',
      upload: false
    } as any
    mockGetVideoFirstFrame.mockResolvedValue({ blob: new Blob(['preview'], { type: 'image/jpeg' }) })
    let failVideoUpload = true
    setCustomUploader({
      upload: (attachment: any, uploadTask: any) => {
        uploadCalls.push(attachment)
        if (attachment.type === attachmentTypes.image) {
          uploadTask.success({ uri: 'https://cdn.example/clip-preview.jpg', blob: null })
          return
        }
        if (failVideoUpload) {
          uploadTask.failure(networkingError())
          return
        }
        uploadTask.success({ uri: 'https://cdn.example/clip.mp4', blob: null })
      },
      download: jest.fn()
    })

    await expect(handleUploadAttachments([attachment], { type: 'text' } as any, channel)).rejects.toMatchObject({
      code: 'NetworkingError'
    })

    expect(uploadCalls.filter((uploadedAttachment) => uploadedAttachment.type === attachmentTypes.image)).toHaveLength(
      1
    )

    failVideoUpload = false
    const [sent] = await handleUploadAttachments([attachment], { type: 'text' } as any, channel)

    // The preview the first send stored goes with the video: it is not made or uploaded again.
    expect(uploadCalls.map((uploadedAttachment) => uploadedAttachment.type)).toEqual([
      attachmentTypes.image,
      attachmentTypes.video,
      attachmentTypes.video
    ])
    expect(mockGetVideoPreviewFrame).toHaveBeenCalledTimes(1)
    expect(JSON.parse(sent.metadata)).toMatchObject({ video_thumb: 'https://cdn.example/clip-preview.jpg' })
  })

  describe('with encryptAttachments', () => {
    // Like Waafi's uploader: it prepares the file with the chat client, stores
    // it and reports its encryption.
    let stored: Blob[]
    let uriFor: (attachment: any) => string
    beforeEach(() => {
      const client = installFakeFilesClient()
      Object.assign(client, { user: { id: 'current-user' }, Channel: { create: jest.fn() } })
      setEncryptAttachments(true)
      stored = []
      uriFor = () => 'https://cdn.example/uploaded-1'
      setCustomUploader({
        preparesFiles: true,
        upload: async (attachment: any, uploadTask: any, _messageType: any, options: any) => {
          uploadCalls.push(attachment)
          const uri = uriFor(attachment)
          const prepared = await getClient().prepareUpload(attachment.data, { encrypt: options.encrypt })
          stored.push(await prepared.getAll())
          uploadTask.success({ uri, blob: attachment.data, encryption: prepared.encryption })
        },
        download: jest.fn()
      })
    })

    afterEach(() => setEncryptAttachments(false))

    it('uploads the encrypted file and sends its key in the attachment metadata', async () => {
      const channel = makeUploaderChannel('channel-encrypted-image')
      const image = makeLiveFile()
      const attachment = {
        ...makeAttachment('encrypted-image-tid', image),
        url: image,
        metadata: '{"szw":10,"szh":20}'
      }

      const [sent] = await handleUploadAttachments([attachment], { type: 'text' } as any, channel)

      expect(stored[0].type).toBe('application/octet-stream')
      expect(await readBlobText(stored[0])).toBe('enc(key-1@id-1):file-bytes')
      expect(JSON.parse(sent.metadata)).toEqual({
        szw: 10,
        szh: 20,
        enc: { v: 1, alg: 'tink-aes256-gcm-hkdf-64k+commit-v1', attachmentId: 'id-1', key: 'key-1' }
      })
      // The size shown and sent is the plaintext's.
      expect((channel as any).__attachmentBuilder.setFileSize).toHaveBeenCalledWith(image.size)
    })

    it('encrypts a video and its preview image with their own keys', async () => {
      const channel = makeUploaderChannel('channel-encrypted-video')
      const video = new File(['video-bytes'], 'clip.mp4', { type: 'video/mp4' })
      mockGetVideoFirstFrame.mockResolvedValue({ blob: new Blob(['preview-bytes'], { type: 'image/jpeg' }) })
      uriFor = (uploadedAttachment) =>
        uploadedAttachment.type === attachmentTypes.image
          ? 'https://cdn.example/clip-preview.jpg'
          : 'https://cdn.example/clip.mp4'
      const attachment = {
        tid: 'encrypted-video-tid',
        type: attachmentTypes.video,
        name: 'clip.mp4',
        size: video.size,
        url: video,
        data: video,
        metadata: '{}',
        upload: false
      } as any

      // The sender keeps the plaintext video to play it without downloading it.
      const originalCreateObjectURL = URL.createObjectURL
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: jest.fn(() => 'blob:sender-video') })
      let sent: any
      try {
        ;[sent] = await handleUploadAttachments([attachment], { type: 'text' } as any, channel)
      } finally {
        Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectURL })
      }

      expect(await readBlobText(stored[0])).toBe('enc(key-1@id-1):preview-bytes')
      expect(await readBlobText(stored[1])).toBe('enc(key-2@id-2):video-bytes')
      expect(JSON.parse(sent.metadata)).toEqual({
        video_thumb: 'https://cdn.example/clip-preview.jpg',
        enc: {
          v: 1,
          alg: 'tink-aes256-gcm-hkdf-64k+commit-v1',
          attachmentId: 'id-2',
          key: 'key-2',
          renditions: [{ role: 'thumbnail', attachmentId: 'id-1', key: 'key-1' }]
        }
      })
    })

    it('with an uploader without preparesFiles, the message fails instead of sending the file unencrypted', async () => {
      const channel = makeUploaderChannel('channel-encrypted-simple-uploader')
      const image = makeLiveFile()
      setCustomUploader({ upload: jest.fn(), download: jest.fn() })

      await expect(
        handleUploadAttachments(
          [{ ...makeAttachment('encrypted-simple-uploader-tid', image), url: image }],
          { type: 'text' } as any,
          channel
        )
      ).rejects.toThrow('preparesFiles')
      expect(channel.sendMessage).not.toHaveBeenCalled()
    })

    it('without a custom uploader and with an SDK that has no client.upload, the message fails before anything is uploaded', async () => {
      const currentUser = makeUser({ id: 'current-user' })
      const channel = makeUploaderChannel('channel-encrypted-old-sdk')
      const video = new File(['video-bytes'], 'clip.mp4', { type: 'video/mp4' })
      const pendingMessage = makePendingMessage({
        channelId: channel.id,
        tid: 'encrypted-old-sdk-message-tid',
        user: currentUser,
        attachments: [
          {
            tid: 'encrypted-old-sdk-attachment-tid',
            type: attachmentTypes.video,
            name: 'clip.mp4',
            size: video.size,
            data: video,
            metadata: '{}',
            upload: true
          } as any
        ]
      })
      const uploadFile = jest.fn()
      Object.assign(getClient(), { uploadFile })
      setCustomUploader(undefined)
      setActiveChannelId(channel.id)
      setChannelInMap(channel)
      addMessageToMap(channel.id, pendingMessage)

      await runMessageSaga(__messageSagaTestables.sendMessage, {
        type: RESEND_MESSAGE,
        payload: {
          message: pendingMessage,
          connectionState: CONNECTION_STATUS.CONNECTED,
          channelId: channel.id,
          sendAttachmentsAsSeparateMessage: false
        }
      })

      // Neither the preview nor the video is uploaded unencrypted, and nothing is sent.
      expect(uploadFile).not.toHaveBeenCalled()
      expect(channel.sendMessage).not.toHaveBeenCalled()
      expect(getPendingMessagesFromMap(channel.id)).toEqual([
        expect.objectContaining({ tid: 'encrypted-old-sdk-message-tid', state: MESSAGE_STATUS.FAILED })
      ])
    })
  })

  describe('with an SDK that has client.upload and no custom uploader', () => {
    // The SDK uploads one file per call; the uikit uploads each attachment and
    // sends the message with their URLs.
    let sdkUploads: { file: File; options: any }[]
    let uploadAnswer: (file: File, options: any) => Promise<any>
    let uploadFile: jest.Mock
    const encryptionFor = (n: number) => ({
      v: 1,
      alg: 'tink-aes256-gcm-hkdf-64k+commit-v1',
      attachmentId: `id-${n}`,
      key: `key-${n}`
    })

    beforeEach(() => {
      sdkUploads = []
      uploadFile = jest.fn()
      uploadAnswer = async (file) => ({ url: `https://cdn.example/${file.name}`, size: file.size })
      setCustomUploader(undefined)
      // The default transport: the chat client stores the bytes it is given, encrypted
      // before by the default encryption (its prepareUpload; keys are key-1, key-2, …).
      setClient({
        ...installFakeFilesClient(),
        user: { id: 'current-user' },
        Channel: { create: jest.fn() },
        uploadFile,
        upload: (file: File, options: any) => {
          sdkUploads.push({ file, options })
          return uploadAnswer(file, options)
        }
      })
    })

    afterEach(() => setEncryptAttachments(false))

    const sendPending = async (channel: any, pendingMessage: any) => {
      setActiveChannelId(channel.id)
      setChannelInMap(channel)
      addMessageToMap(channel.id, pendingMessage)
      return runMessageSaga(__messageSagaTestables.sendMessage, {
        type: RESEND_MESSAGE,
        payload: {
          message: pendingMessage,
          connectionState: CONNECTION_STATUS.CONNECTED,
          channelId: channel.id,
          sendAttachmentsAsSeparateMessage: false
        }
      })
    }
    const pendingWith = (channel: any, tid: string, attachments: any[]) =>
      makePendingMessage({
        channelId: channel.id,
        tid,
        user: makeUser({ id: 'current-user' }),
        attachments: attachments.map((file: File, i: number) => ({
          tid: `${tid}-attachment-${i}`,
          type: file.type.startsWith('video/') ? attachmentTypes.video : attachmentTypes.file,
          name: file.name,
          size: file.size,
          data: file,
          metadata: '{}',
          upload: true
        }))
      })

    it('uploads each attachment with its own client.upload call and sends the message with their URLs', async () => {
      const channel = makeUploaderChannel('channel-sdk-upload-two-files')
      const first = new File(['first'], 'first.pdf', { type: 'application/pdf' })
      const second = new File(['second file'], 'second.txt', { type: 'text/plain' })
      channel.sendMessage = jest.fn(() =>
        Promise.resolve(
          makeServerResponse('sdk-two-files', 'sdk-two-files-attachment-0', makeUser({ id: 'current-user' }))
        )
      )

      await sendPending(channel, pendingWith(channel, 'sdk-two-files', [first, second]))

      // Compared by name: a failing diff of File objects runs the test worker out of memory.
      expect(sdkUploads.map(({ file }) => file.name)).toEqual(['first.pdf', 'second.txt'])
      expect(sdkUploads.every(({ file }, i) => file === [first, second][i])).toBe(true)
      expect(sdkUploads.every(({ options }) => options.encrypt === false)).toBe(true)
      expect(uploadFile).not.toHaveBeenCalled()
      const sent = (channel.sendMessage as jest.Mock).mock.calls[0][0].attachments
      expect(sent).toEqual([
        expect.objectContaining({
          url: 'https://cdn.example/first.pdf',
          upload: false,
          tid: 'sdk-two-files-attachment-0'
        }),
        expect.objectContaining({
          url: 'https://cdn.example/second.txt',
          upload: false,
          tid: 'sdk-two-files-attachment-1'
        })
      ])
      expect(sent[0].completion).toBeUndefined()
    })

    it('with encryptAttachments, each file is encrypted before it is sent and its own key goes in its metadata', async () => {
      setEncryptAttachments(true)
      const channel = makeUploaderChannel('channel-sdk-upload-encrypted')
      const first = new File(['first'], 'first.pdf', { type: 'application/pdf' })
      const second = new File(['second'], 'second.pdf', { type: 'application/pdf' })
      channel.sendMessage = jest.fn(() =>
        Promise.resolve(
          makeServerResponse('sdk-encrypted', 'sdk-encrypted-attachment-0', makeUser({ id: 'current-user' }))
        )
      )

      await sendPending(channel, pendingWith(channel, 'sdk-encrypted', [first, second]))

      // The client is given the stored bytes, encrypted with each file's own key, with the file's name.
      expect(sdkUploads.every(({ options }) => options.encrypt === false)).toBe(true)
      expect(sdkUploads.map(({ file }) => file.name)).toEqual(['first.pdf', 'second.pdf'])
      expect(await Promise.all(sdkUploads.map(({ file }) => readBlobText(file)))).toEqual([
        'enc(key-1@id-1):first',
        'enc(key-2@id-2):second'
      ])
      const sent = (channel.sendMessage as jest.Mock).mock.calls[0][0].attachments
      expect(sent.map((attachment: any) => JSON.parse(attachment.metadata).enc.attachmentId).sort()).toEqual([
        'id-1',
        'id-2'
      ])
    })

    it('uploads a video preview with client.upload before the video, each with its own key', async () => {
      setEncryptAttachments(true)
      const channel = makeUploaderChannel('channel-sdk-upload-video')
      const video = new File(['video-bytes'], 'clip.mp4', { type: 'video/mp4' })
      mockGetVideoFirstFrame.mockResolvedValue({ blob: new Blob(['preview-bytes'], { type: 'image/jpeg' }) })
      channel.sendMessage = jest.fn(() =>
        Promise.resolve(makeServerResponse('sdk-video', 'sdk-video-attachment-0', makeUser({ id: 'current-user' })))
      )
      const originalCreateObjectURL = URL.createObjectURL
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: jest.fn(() => 'blob:sender-video') })
      try {
        await sendPending(channel, pendingWith(channel, 'sdk-video', [video]))
      } finally {
        Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectURL })
      }

      // The test's attachment builder keeps no name, so the preview is "video-preview.jpg".
      expect(sdkUploads.map(({ file }) => file.name)).toEqual(['video-preview.jpg', 'clip.mp4'])
      // Both are stored encrypted, the preview with its own key.
      expect(sdkUploads.map(({ file }) => file.type)).toEqual(['application/octet-stream', 'application/octet-stream'])
      expect(await readBlobText(sdkUploads[0].file)).toBe('enc(key-1@id-1):preview-bytes')
      expect(uploadFile).not.toHaveBeenCalled()
      const [sent] = (channel.sendMessage as jest.Mock).mock.calls[0][0].attachments
      expect(sent).toMatchObject({ url: 'https://cdn.example/clip.mp4', upload: false })
      expect(JSON.parse(sent.metadata)).toEqual({
        video_thumb: 'https://cdn.example/video-preview.jpg',
        enc: { ...encryptionFor(2), renditions: [{ role: 'thumbnail', attachmentId: 'id-1', key: 'key-1' }] }
      })
    })

    it('a failed upload fails the message, and nothing is sent', async () => {
      const channel = makeUploaderChannel('channel-sdk-upload-failure')
      uploadAnswer = () => Promise.reject(Object.assign(new Error('storage is down'), { code: 1500 }))

      await sendPending(
        channel,
        pendingWith(channel, 'sdk-failure', [new File(['x'], 'x.pdf', { type: 'application/pdf' })])
      )

      expect(channel.sendMessage).not.toHaveBeenCalled()
      expect(getPendingMessagesFromMap(channel.id)).toEqual([
        expect.objectContaining({ tid: 'sdk-failure', state: MESSAGE_STATUS.FAILED })
      ])
    })

    it('stop and resume work on an attachment the SDK uploads', async () => {
      uploadAnswer = () => new Promise(() => undefined)
      const file = new File(['x'], 'x.pdf', { type: 'application/pdf' })
      uploadAttachmentFile({ tid: 'sdk-stop-tid', url: file } as any, () => undefined, 'text')

      const paused = await runMessageSaga(__messageSagaTestables.pauseAttachmentUploading, {
        payload: { attachmentId: 'sdk-stop-tid' }
      })
      expect(paused).toContainEqual(updateAttachmentUploadingStateAC(UPLOAD_STATE.PAUSED, 'sdk-stop-tid'))
      expect(sdkUploads[0].options.signal.aborted).toBe(true)

      const resumed = await runMessageSaga(__messageSagaTestables.resumeAttachmentUploading, {
        payload: { attachmentId: 'sdk-stop-tid' }
      })
      expect(resumed).toContainEqual(updateAttachmentUploadingStateAC(UPLOAD_STATE.UPLOADING, 'sdk-stop-tid'))
      expect(sdkUploads).toHaveLength(2)
    })

    it('deleting a pending message stops the SDK upload of its attachment', () => {
      uploadAnswer = () => new Promise(() => undefined)
      const file = new File(['x'], 'x.pdf', { type: 'application/pdf' })
      uploadAttachmentFile({ tid: 'sdk-delete-tid', url: file } as any, () => undefined, 'text')

      deletePendingMessage('channel-sdk-delete', {
        tid: 'sdk-delete-msg',
        attachments: [{ tid: 'sdk-delete-tid' }]
      } as any)

      expect(sdkUploads[0].options.signal.aborted).toBe(true)
    })
  })
})
