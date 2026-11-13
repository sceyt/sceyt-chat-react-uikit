import { runSaga, stdChannel, Task } from 'redux-saga'
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
  pauseAttachmentUploadingAC,
  resumeAttachmentUploadingAC,
  resendMessageAC,
  sendMessageAC,
  setFileTransferFailedPopupAC,
  updateAttachmentUploadingProgressAC,
  updateAttachmentUploadingStateAC,
  updateMessageAC
} from './actions'
import { RESEND_MESSAGE } from './constants'
import { setSendAttachmentsAsSeparateMessages } from '../../helpers/sendAttachments'
import {
  markUploadNotStarted,
  pauseUpload,
  resetAttachmentUploadsForTests,
  resumeUpload,
  uploadAttachment
} from '../../fileTransfer/attachmentUploadCoordinator'
import { fileTransfer } from '../../fileTransfer/sceytChatUIKitFileTransfer'
import {
  AttachmentTransferContext,
  FileTransferResult,
  FileTransferProvider,
  FileUploadRequest,
  FileUploadResult,
  FileUploadType
} from '../../types/fileTransfer/types'
import { FileEncryptionInfo } from '../../fileTransfer/encryption/types'
import { IAttachment } from '../../types'
import { handleUploadAttachments, __messageSagaTestables, __resetMessageSagaTestState } from './saga'
import store from '../index'
import {
  beginVideoPreparation,
  completeAttachmentPreview,
  completeVideoPreparation
} from '../../helpers/attachmentPreparation'
import {
  fakeEncrypted,
  fakeEncryption,
  installFakeFilesClient,
  makeFakePreparedUpload,
  readBlobText
} from '../../testUtils/fakeAttachmentFiles'

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

// One upload the fake transport was given; the test (or uploadBehavior) settles it.
interface UploadCall {
  request: FileUploadRequest
  /** The attachment the UIKit uploads (a video's preview image is an image attachment of its own). */
  attachment: IAttachment
  /** The file sent. */
  file: Blob
  // eslint-disable-next-line no-unused-vars
  onProgress: (percent: number) => void
  // eslint-disable-next-line no-unused-vars
  succeed: (url?: string, encryptionInfo?: FileEncryptionInfo) => void
  // eslint-disable-next-line no-unused-vars
  fail: (error: Error) => void
}

// The app's transport (fileTransfer.provider), driven per test: records every
// upload request and lets uploadBehavior settle it.
let uploadCalls: UploadCall[] = []
// eslint-disable-next-line no-unused-vars
let uploadBehavior: (call: UploadCall) => void
// Operation ids the transport was told to abandon (transport.cancel).
let cancelledOperations: string[] = []

const makeFakeTransport = (): FileTransferProvider => ({
  upload: (request, callback) =>
    new Promise<FileTransferResult<FileUploadResult>>((resolve) => {
      const call: UploadCall = {
        request,
        attachment: (request.context as AttachmentTransferContext).attachment,
        file: request.sourceFile,
        onProgress: callback.onProgress,
        succeed: (url = 'https://cdn.example/uploaded-1', encryptionInfo) =>
          resolve(FileTransferResult.success({ url, ...(encryptionInfo ? { encryptionInfo } : {}) })),
        fail: (error) => resolve(FileTransferResult.failure(error))
      }
      // A stopped or abandoned attempt stops its work and settles.
      request.signal.addEventListener('abort', () =>
        resolve(FileTransferResult.interrupted(new Error('The upload was stopped')))
      )
      uploadCalls.push(call)
      uploadBehavior(call)
    }),
  download: () => Promise.resolve(FileTransferResult.failure(new Error('Downloads are not used in these tests'))),
  cancel: (operationId) => {
    cancelledOperations.push(operationId)
  }
})

const networkingError = () => {
  const error: any = new Error('Network Failure')
  error.code = 'NetworkingError'
  return error
}

const succeedUpload =
  (uri = 'https://cdn.example/uploaded-1') =>
  (call: UploadCall) =>
    call.succeed(uri)

const failUploadWithNetworkError = () => (call: UploadCall) => call.fail(networkingError())

// Lets queued promise callbacks run (no timers) until `done`, or a bounded number of turns.
const settleMicrotasks = async (done: () => boolean = () => false, turns = 200) => {
  for (let attempt = 0; attempt < turns && !done(); attempt++) {
    await Promise.resolve()
  }
}

const originalCreateObjectURL = URL.createObjectURL

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
  // Saga tasks a test leaves running (e.g. after a failed assertion): cancelled after it.
  const runningTasks: Task[] = []
  const track = (task: Task) => {
    runningTasks.push(task)
    return task
  }

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
    cancelledOperations = []
    uploadBehavior = succeedUpload()
    setSendAttachmentsAsSeparateMessages(false)
    fileTransfer.configure({ provider: makeFakeTransport() })
    // The sender plays an uploaded video from its own file (jsdom has no object URLs).
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: jest.fn((blob: Blob) => `blob:local-${blob.size}`)
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
    runningTasks.splice(0).forEach((task) => task.isRunning() && task.cancel())
    fileTransfer.configure()
    resetAttachmentUploadsForTests()
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectURL })
    __resetMessageSagaTestState()
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
    expect(uploadCalls[0].file).toBe(liveFile)
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
    expect(uploadCalls[0].file).toBe(liveFile)
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
    // It waits to be sent again: the user is not told it failed.
    expect(dispatched).not.toContainEqual(setFileTransferFailedPopupAC('upload'))
  })

  it('a refused upload fails its message with no "Upload failed" popup (only a tap on its upload icon shows it)', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channel = makeUploaderChannel('channel-upload-refused')
    uploadBehavior = (call) => call.fail(Object.assign(new Error('Upload failed with status 400'), { status: 400 }))
    const pendingMessage = makePendingMessage({
      channelId: channel.id,
      tid: 'upload-refused-msg-tid',
      body: 'refused attachment',
      user: currentUser,
      attachments: [makeAttachment('upload-refused-file-tid', makeLiveFile())]
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

    expect(dispatched).toEqual(
      expect.arrayContaining([
        updateAttachmentUploadingStateAC(UPLOAD_STATE.FAIL, 'upload-refused-file-tid'),
        updateMessageAC('upload-refused-msg-tid', { state: MESSAGE_STATUS.FAILED })
      ])
    )
    expect(dispatched).not.toContainEqual(setFileTransferFailedPopupAC('upload'))
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
    // The upload stays in progress until the message is deleted.
    uploadBehavior = () => undefined

    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    addMessageToMap(channel.id, pendingMessage)

    const task = track(
      runSaga(
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
    )

    await settleMicrotasks(() => uploadCalls.length > 0)
    expect(uploadCalls).toHaveLength(1)

    deletePendingMessage(channel.id, pendingMessage)
    await settleMicrotasks(() => !task.isRunning())

    // The transport is told to abandon the upload, and the send ends.
    expect(uploadCalls[0].request.signal.aborted).toBe(true)
    expect(cancelledOperations).toEqual(['upload:delete-during-custom-upload-file-tid'])
    expect(task.isRunning()).toBe(false)
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
    // Each upload stays in progress until the test completes it.
    uploadBehavior = () => undefined
    const uploads = uploadCalls
    channel.sendMessage = jest.fn((sent: any) =>
      Promise.resolve({
        ...makeServerResponse(sent.tid, sent.attachments[0].tid, currentUser),
        id: `srv-${sent.tid}`
      })
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
    const settle = settleMicrotasks

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

    uploads[0].succeed('https://cdn.example/first.pdf')
    await settle(() => uploads.length > 1)
    uploads[1].succeed('https://cdn.example/second.pdf')
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
      type: attachmentTypes.file,
      // The progress shown is this size's share: 10% is 1.
      size: 10
    }
    uploadBehavior = () => undefined
    const onLine = jest.spyOn(window.navigator, 'onLine', 'get')
    try {
      const upload = handleUploadAttachments([attachment], { type: 'text' } as any, channel)
      await settleMicrotasks(() => uploadCalls.length > 0)
      const [call] = uploadCalls
      onLine.mockReturnValue(true)
      call.onProgress(10)
      onLine.mockReturnValue(false)
      call.onProgress(100)
      onLine.mockReturnValue(true)
      call.onProgress(20)
      call.succeed('https://cdn.example/report.pdf')
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
      type: attachmentTypes.file,
      // The progress shown is this size's share: 10% is 1.
      size: 10
    }
    uploadBehavior = () => undefined
    const upload = handleUploadAttachments([attachment], { type: 'text' } as any, channel)
    await settleMicrotasks(() => uploadCalls.length > 0)
    const [call] = uploadCalls
    Object.assign(getClient(), { connectionState: CONNECTION_STATUS.CONNECTED })
    call.onProgress(10)
    // The browser stays online; the chat connection timed out.
    Object.assign(getClient(), { connectionState: CONNECTION_STATUS.CONNECTING })
    call.onProgress(100)
    Object.assign(getClient(), { connectionState: CONNECTION_STATUS.CONNECTED })
    call.onProgress(20)
    call.succeed('https://cdn.example/report.pdf')
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
      const uploads: { tid: string; call: UploadCall }[] = []
      uploadBehavior = (call) => uploads.push({ tid: call.attachment.tid!, call })
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
    const settle = settleMicrotasks

    it('are sent one at a time, in order, even when two resends start at once (reconnect, and the chat loading)', async () => {
      const { channel, uploads } = setupPendingFiles('channel-resend-in-order')

      const first = resendPending()
      const second = resendPending()
      await settle()
      // Only the first message's file uploads.
      expect(uploads.map((upload) => upload.tid)).toEqual(['channel-resend-in-order-file-1'])

      uploads[0].call.succeed('https://cdn.example/file-1.pdf')
      await settle(() => uploads.length > 1)
      expect(uploads.map((upload) => upload.tid)).toEqual([
        'channel-resend-in-order-file-1',
        'channel-resend-in-order-file-2'
      ])
      uploads[1].call.succeed('https://cdn.example/file-2.pdf')
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
      uploadBehavior = (call) => {
        uploads.push({ tid: call.attachment.tid!, call })
        if (call.attachment.tid === 'channel-resend-fails-again-file-2') {
          call.succeed('https://cdn.example/file-2.pdf')
        }
      }
      const run = resendPending()
      await settle(() => uploads.length > 0)
      // The connection is lost again while the first message's file uploads.
      uploads[0].call.fail(networkingError())
      await run.toPromise()

      // The second message was not tried meanwhile (it would be sent before the first).
      expect(uploads.map((upload) => upload.tid)).toEqual(['channel-resend-fails-again-file-1'])
      expect(channel.sendMessage).not.toHaveBeenCalled()
      expect(getPendingMessagesFromMap(channel.id).map((message) => message.tid)).toEqual([
        'channel-resend-fails-again-msg-1',
        'channel-resend-fails-again-msg-2'
      ])

      // The connection is back: the next round sends both, in order.
      uploadBehavior = (call) => {
        uploads.push({ tid: call.attachment.tid!, call })
        call.succeed(`https://cdn.example/${call.attachment.tid}`)
      }
      await resendPending().toPromise()

      expect((channel.sendMessage as jest.Mock).mock.calls.map(([sent]) => sent.tid)).toEqual([
        'channel-resend-fails-again-msg-1',
        'channel-resend-fails-again-msg-2'
      ])
      expect(getPendingMessagesFromMap(channel.id)).toHaveLength(0)
    })

    const tooLarge = () => Object.assign(new Error('The file is too large'), { type: 'TooLargeRequest' })

    it('a message that can never be sent (too large) does not hold back the ones after it', async () => {
      const { channel, uploads } = setupPendingFiles('channel-resend-too-large')
      uploadBehavior = (call) => {
        uploads.push({ tid: call.attachment.tid!, call })
        if (call.attachment.tid === 'channel-resend-too-large-file-1') call.fail(tooLarge())
        else call.succeed(`https://cdn.example/${call.attachment.tid}`)
      }

      await resendPending().toPromise()

      expect(uploads.map((upload) => upload.tid)).toEqual([
        'channel-resend-too-large-file-1',
        'channel-resend-too-large-file-2'
      ])
      expect((channel.sendMessage as jest.Mock).mock.calls.map(([sent]) => sent.tid)).toEqual([
        'channel-resend-too-large-msg-2'
      ])
      // Not sent again on the next reconnect: it is no longer pending.
      expect(getPendingMessagesFromMap(channel.id)).toHaveLength(0)
    })

    it('a lost connection in one chat does not hold back the messages of another', async () => {
      const first = setupPendingFiles('channel-resend-chat-a')
      const second = setupPendingFiles('channel-resend-chat-b')
      const uploaded: string[] = []
      uploadBehavior = (call) => {
        uploaded.push(call.attachment.tid!)
        if (call.attachment.tid === 'channel-resend-chat-a-file-1') call.fail(networkingError())
        else call.succeed(`https://cdn.example/${call.attachment.tid}`)
      }

      await resendPending().toPromise()

      expect(uploaded).not.toContain('channel-resend-chat-a-file-2')
      expect(first.channel.sendMessage).not.toHaveBeenCalled()
      expect(getPendingMessagesFromMap(first.channel.id).map((message) => message.tid)).toEqual([
        'channel-resend-chat-a-msg-1',
        'channel-resend-chat-a-msg-2'
      ])
      expect((second.channel.sendMessage as jest.Mock).mock.calls.map(([sent]) => sent.tid)).toEqual([
        'channel-resend-chat-b-msg-1',
        'channel-resend-chat-b-msg-2'
      ])
      expect(getPendingMessagesFromMap(second.channel.id)).toHaveLength(0)
    })

    it('a message that fails again on an error other than a lost connection does not hold back the ones after it', async () => {
      const { channel } = setupPendingFiles('channel-resend-server-error')
      const uploaded: string[] = []
      uploadBehavior = (call) => {
        uploaded.push(call.attachment.tid!)
        // An error with no type (e.g. a provider's expired upload URLs): worth trying again, not a lost connection.
        if (call.attachment.tid === 'channel-resend-server-error-file-1')
          call.fail(new Error('The upload URLs expired'))
        else call.succeed(`https://cdn.example/${call.attachment.tid}`)
      }

      await resendPending().toPromise()

      expect(uploaded).toEqual(['channel-resend-server-error-file-1', 'channel-resend-server-error-file-2'])
      expect((channel.sendMessage as jest.Mock).mock.calls.map(([sent]) => sent.tid)).toEqual([
        'channel-resend-server-error-msg-2'
      ])
      // Still pending, for the next try.
      expect(getPendingMessagesFromMap(channel.id).map((message) => message.tid)).toEqual([
        'channel-resend-server-error-msg-1'
      ])
    })

    it('a message deleted while it is sent again does not hold back the ones after it', async () => {
      const { channel, pending, uploads } = setupPendingFiles('channel-resend-deleted')
      uploadBehavior = (call) => {
        uploads.push({ tid: call.attachment.tid!, call })
        // The first file uploads until its message is deleted; the second goes through.
        if (call.attachment.tid !== 'channel-resend-deleted-file-1') {
          call.succeed(`https://cdn.example/${call.attachment.tid}`)
        }
      }
      const run = track(resendPending())
      await settle(() => uploads.length > 0)

      deletePendingMessage(channel.id, pending[0])
      await settle(() => !run.isRunning())

      expect(cancelledOperations).toEqual(['upload:channel-resend-deleted-file-1'])
      expect(run.isRunning()).toBe(false)
      expect(uploads.map((upload) => upload.tid)).toEqual([
        'channel-resend-deleted-file-1',
        'channel-resend-deleted-file-2'
      ])
      expect((channel.sendMessage as jest.Mock).mock.calls.map(([sent]) => sent.tid)).toEqual([
        'channel-resend-deleted-msg-2'
      ])
      expect(getPendingMessagesFromMap(channel.id)).toHaveLength(0)
    })

    it('a message that keeps failing holds back the ones after it until its attempts run out; then they are sent', async () => {
      const { channel, uploads } = setupPendingFiles('channel-resend-out-of-attempts')
      uploadBehavior = (call) => {
        uploads.push({ tid: call.attachment.tid!, call })
        if (call.attachment.tid === 'channel-resend-out-of-attempts-file-1') call.fail(networkingError())
        else call.succeed(`https://cdn.example/${call.attachment.tid}`)
      }

      // Five reconnects (the attempt budget): each tries the first message only.
      for (let round = 0; round < 5; round++) {
        await resendPending().toPromise()
      }
      expect(uploads.map((upload) => upload.tid)).toEqual(Array(5).fill('channel-resend-out-of-attempts-file-1'))
      expect(channel.sendMessage).not.toHaveBeenCalled()

      // It is not tried again; the next one is sent, and the first stays failed for a manual retry.
      await resendPending().toPromise()
      expect(uploads).toHaveLength(6)
      expect(uploads[5].tid).toBe('channel-resend-out-of-attempts-file-2')
      expect((channel.sendMessage as jest.Mock).mock.calls.map(([sent]) => sent.tid)).toEqual([
        'channel-resend-out-of-attempts-msg-2'
      ])
      expect(getPendingMessagesFromMap(channel.id).map((message) => message.tid)).toEqual([
        'channel-resend-out-of-attempts-msg-1'
      ])
    })

    it('a message sent meanwhile (by another send) is not sent again, nor shown as failed', async () => {
      const { channel, uploads } = setupPendingFiles('channel-resend-sent-meanwhile')
      // A second file to upload (were message 2 sent again) is stored at once.
      uploadBehavior = (call) => {
        uploads.push({ tid: call.attachment.tid!, call })
        if (call.attachment.tid === 'channel-resend-sent-meanwhile-file-2') {
          call.succeed('https://cdn.example/file-2.pdf')
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
      uploads[0].call.fail(networkingError())
      await run.toPromise()

      expect(uploads.map((upload) => upload.tid)).toEqual(['channel-resend-sent-meanwhile-file-1'])
      expect(channel.sendMessage).not.toHaveBeenCalled()
      expect(
        getMessageFromMap(channel.id, 'srv-msg-2') ||
          getMessageFromMap(channel.id, 'channel-resend-sent-meanwhile-msg-2')
      ).toEqual(expect.objectContaining({ id: 'srv-msg-2', state: MESSAGE_STATUS.UNMODIFIED }))
    })
  })

  it('a paused upload does not hold back the next messages: they upload and are sent, and it is sent once resumed', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channel = makeUploaderChannel('channel-paused-no-wait')
    const messageBuilder: any = channel.createMessageBuilder()
    messageBuilder.create
      .mockImplementationOnce(() => makePendingMessage({ channelId: channel.id, tid: 'paused-msg-1' }))
      .mockImplementationOnce(() => makePendingMessage({ channelId: channel.id, tid: 'paused-msg-2' }))
    const uploads: UploadCall[] = []
    uploadBehavior = (call) => {
      uploads.push(call)
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
    const sentTids = () => (channel.sendMessage as jest.Mock).mock.calls.map(([sent]) => sent.tid)
    const until = async (done: () => boolean) => {
      for (let attempt = 0; attempt < 400 && !done(); attempt++) await Promise.resolve()
    }
    // Actions the saga puts reach its takes, as in the store.
    const actions = stdChannel()

    const run = runSaga(
      { channel: actions, dispatch: (output: any) => actions.put(output), getState: () => mockStoreState },
      __messageSagaTestables.sendMessage,
      sendMessageAC(
        {
          body: 'two files',
          bodyAttributes: [],
          attachments: [file('paused-file-1', 'first.pdf'), file('paused-file-2', 'second.pdf')],
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
    runningTasks.push(run)
    await until(() => uploads.length === 1)

    // The user pauses the first upload (what pauseAttachmentUploading does).
    expect(pauseUpload('paused-file-1')).toBe(true)
    actions.put(updateAttachmentUploadingStateAC(UPLOAD_STATE.PAUSED, 'paused-file-1'))
    await until(() => uploads.length === 2)

    // The second one uploads now, and its message is sent.
    expect(uploads.map((call) => call.attachment.tid)).toEqual(['paused-file-1', 'paused-file-2'])
    uploads[1].succeed('https://cdn.example/paused-file-2')
    await run.toPromise()
    expect(sentTids()).toEqual(['paused-msg-2'])

    // Resumed, the first one uploads again and is sent after it.
    expect(resumeUpload('paused-file-1')).toBe(true)
    await until(() => uploads.length === 3)
    uploads[2].succeed('https://cdn.example/paused-file-1')
    await until(() => sentTids().length === 2)
    expect(sentTids()).toEqual(['paused-msg-2', 'paused-msg-1'])
    expect(getPendingMessagesFromMap(channel.id)).toHaveLength(0)
  })

  it("after the first upload is stopped, the second one's stop button stops it", async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channel = makeUploaderChannel('channel-stop-second')
    const messageBuilder: any = channel.createMessageBuilder()
    messageBuilder.create
      .mockImplementationOnce(() => makePendingMessage({ channelId: channel.id, tid: 'stop-msg-1' }))
      .mockImplementationOnce(() => makePendingMessage({ channelId: channel.id, tid: 'stop-msg-2' }))
    const uploads: UploadCall[] = []
    uploadBehavior = (call) => {
      uploads.push(call)
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
    const until = async (done: () => boolean) => {
      for (let attempt = 0; attempt < 400 && !done(); attempt++) await Promise.resolve()
    }
    const actions = stdChannel()
    const dispatched: any[] = []
    const io = {
      channel: actions,
      dispatch: (output: any) => {
        dispatched.push(output)
        actions.put(output)
      },
      getState: () => mockStoreState
    }
    // What the upload's stop button does.
    const stop = (tid: string) =>
      runSaga(io, __messageSagaTestables.pauseAttachmentUploading, pauseAttachmentUploadingAC(tid)).toPromise()

    const run = runSaga(
      io,
      __messageSagaTestables.sendMessage,
      sendMessageAC(
        {
          body: 'two files',
          bodyAttributes: [],
          attachments: [file('stop-file-1', 'first.pdf'), file('stop-file-2', 'second.pdf')],
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
    runningTasks.push(run)
    await until(() => uploads.length === 1)
    await stop('stop-file-1')
    await until(() => uploads.length === 2)

    await stop('stop-file-2')
    await run.toPromise()

    expect(dispatched).toEqual(
      expect.arrayContaining([
        updateAttachmentUploadingStateAC(UPLOAD_STATE.PAUSED, 'stop-file-1'),
        updateAttachmentUploadingStateAC(UPLOAD_STATE.PAUSED, 'stop-file-2')
      ])
    )
    // Both transfers stopped, and neither message was sent.
    expect(uploads.map((call) => [call.attachment.tid, call.request.signal.aborted])).toEqual([
      ['stop-file-1', true],
      ['stop-file-2', true]
    ])
    expect(channel.sendMessage).not.toHaveBeenCalled()
  })

  it('one click stops an upload still waiting for the messages before it; the ones after it do not wait for it', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channel = makeUploaderChannel('channel-stop-waiting')
    const messageBuilder: any = channel.createMessageBuilder()
    messageBuilder.create
      .mockImplementationOnce(() => makePendingMessage({ channelId: channel.id, tid: 'waiting-msg-1' }))
      .mockImplementationOnce(() => makePendingMessage({ channelId: channel.id, tid: 'waiting-msg-2' }))
      .mockImplementationOnce(() => makePendingMessage({ channelId: channel.id, tid: 'waiting-msg-3' }))
    const uploads: UploadCall[] = []
    uploadBehavior = (call) => {
      uploads.push(call)
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
    const sentTids = () => (channel.sendMessage as jest.Mock).mock.calls.map(([sent]) => sent.tid)
    const uploadedTids = () => uploads.map((call) => call.attachment.tid)
    const until = async (done: () => boolean) => {
      for (let attempt = 0; attempt < 400 && !done(); attempt++) await Promise.resolve()
    }
    const actions = stdChannel()
    const dispatched: any[] = []
    const io = {
      channel: actions,
      dispatch: (output: any) => {
        dispatched.push(output)
        actions.put(output)
      },
      getState: () => mockStoreState
    }
    // What the upload's stop and resume buttons do.
    const stop = (tid: string) =>
      runSaga(io, __messageSagaTestables.pauseAttachmentUploading, pauseAttachmentUploadingAC(tid)).toPromise()
    const resume = (tid: string) =>
      runSaga(io, __messageSagaTestables.resumeAttachmentUploading, resumeAttachmentUploadingAC(tid)).toPromise()

    const run = runSaga(
      io,
      __messageSagaTestables.sendMessage,
      sendMessageAC(
        {
          body: 'three files',
          bodyAttributes: [],
          attachments: [
            file('waiting-file-1', 'first.pdf'),
            file('waiting-file-2', 'second.pdf'),
            file('waiting-file-3', 'third.pdf')
          ],
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
    runningTasks.push(run)
    await until(() => uploads.length === 1)

    // The second file's stop button, pressed once while the first one uploads.
    await stop('waiting-file-2')
    expect(dispatched).toContainEqual(updateAttachmentUploadingStateAC(UPLOAD_STATE.PAUSED, 'waiting-file-2'))

    // The first one is sent; the third one goes next, and the second one is not uploaded.
    uploads[0].succeed('https://cdn.example/waiting-file-1')
    await until(() => uploads.length === 2)
    uploads[1].succeed('https://cdn.example/waiting-file-3')
    await run.toPromise()
    expect(uploadedTids()).toEqual(['waiting-file-1', 'waiting-file-3'])
    expect(sentTids()).toEqual(['waiting-msg-1', 'waiting-msg-3'])

    // Resumed, it uploads (shown as uploading, not preparing) and is sent after them.
    await resume('waiting-file-2')
    expect(dispatched).toContainEqual(updateAttachmentUploadingStateAC(UPLOAD_STATE.UPLOADING, 'waiting-file-2'))
    await until(() => uploads.length === 3)
    expect(uploadedTids()[2]).toBe('waiting-file-2')
    uploads[2].succeed('https://cdn.example/waiting-file-2')
    await until(() => sentTids().length === 3)
    expect(sentTids()).toEqual(['waiting-msg-1', 'waiting-msg-3', 'waiting-msg-2'])
    expect(getPendingMessagesFromMap(channel.id)).toHaveLength(0)
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
    uploadBehavior = (call) => {
      uploads.push(call.attachment.tid!)
      if (uploads.length === 1) call.fail(networkingError())
      else call.succeed(`https://cdn.example/${call.attachment.tid}`)
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

  it('a message that fails on an error other than a lost connection does not make the next ones of its send wait', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channel = makeUploaderChannel('channel-server-error-no-wait')
    const messageBuilder: any = channel.createMessageBuilder()
    messageBuilder.create
      .mockImplementationOnce(() => makePendingMessage({ channelId: channel.id, tid: 'server-error-msg-1' }))
      .mockImplementationOnce(() => makePendingMessage({ channelId: channel.id, tid: 'server-error-msg-2' }))
    const uploads: string[] = []
    // The first file fails on an error with no type (not a lost connection); the second goes through.
    uploadBehavior = (call) => {
      uploads.push(call.attachment.tid!)
      if (uploads.length === 1) call.fail(new Error('The upload URLs expired'))
      else call.succeed(`https://cdn.example/${call.attachment.tid}`)
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
          attachments: [file('server-error-file-1', 'first.pdf'), file('server-error-file-2', 'second.pdf')],
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

    expect(uploads).toEqual(['server-error-file-1', 'server-error-file-2'])
    expect((channel.sendMessage as jest.Mock).mock.calls.map(([sent]) => sent.tid)).toEqual(['server-error-msg-2'])
    expect(getPendingMessagesFromMap(channel.id).map((message) => message.tid)).toEqual(['server-error-msg-1'])
  })

  it('a message that can never be sent (too large) does not make the next ones of its send wait: they go at once', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channel = makeUploaderChannel('channel-too-large-no-wait')
    const messageBuilder: any = channel.createMessageBuilder()
    messageBuilder.create
      .mockImplementationOnce(() => makePendingMessage({ channelId: channel.id, tid: 'too-large-msg-1' }))
      .mockImplementationOnce(() => makePendingMessage({ channelId: channel.id, tid: 'too-large-msg-2' }))
    const uploads: string[] = []
    // The first file is refused by the server; the second goes through.
    uploadBehavior = (call) => {
      uploads.push(call.attachment.tid!)
      if (uploads.length === 1) {
        call.fail(Object.assign(new Error('The file is too large'), { type: 'TooLargeRequest' }))
      } else {
        call.succeed(`https://cdn.example/${call.attachment.tid}`)
      }
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
          attachments: [file('too-large-file-1', 'huge.pdf'), file('too-large-file-2', 'small.pdf')],
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
    for (let attempt = 0; attempt < 100; attempt++) {
      await Promise.resolve()
    }

    // Sent in the same send, and nothing is sent again afterwards.
    expect(uploads).toEqual(['too-large-file-1', 'too-large-file-2'])
    expect((channel.sendMessage as jest.Mock).mock.calls.map(([sent]) => sent.tid)).toEqual(['too-large-msg-2'])
    expect(getPendingMessagesFromMap(channel.id)).toHaveLength(0)
  })

  it('a reconnect while messages are still uploading leaves them to that send: each file is uploaded and sent once', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channel = makeUploaderChannel('channel-reconnect-while-uploading')
    const messageBuilder: any = channel.createMessageBuilder()
    messageBuilder.create
      .mockImplementationOnce(() => makePendingMessage({ channelId: channel.id, tid: 'uploading-msg-1' }))
      .mockImplementationOnce(() => makePendingMessage({ channelId: channel.id, tid: 'uploading-msg-2' }))
    // Each upload stays in progress until the test completes it.
    uploadBehavior = () => undefined
    const uploads = uploadCalls
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
    const settle = settleMicrotasks
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

      uploads[0].succeed('https://cdn.example/first.pdf')
      await settle(() => uploads.length > 1)
      uploads[1].succeed('https://cdn.example/second.pdf')
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
    expect(uploadCalls[0].attachment.type).toBe(attachmentTypes.image)
    expect(uploadCalls[1].file === converted).toBe(true)
    expect(uploadCalls[1].request.fileName).toBe('clip.mp4')
    expect(uploadCalls[1].attachment.name).toBe('clip.mp4')
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

    // Compared by reference: a failing diff of File objects runs the test worker out of memory.
    expect(uploadCalls.some((call) => call.attachment.type === attachmentTypes.video && call.file === video)).toBe(true)
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
    expect(uploadCalls[0].file).toBe(liveFile)
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
    uploadBehavior = (call) => {
      if (call.attachment.type === attachmentTypes.image) {
        uploadOrder.push('preview')
        call.succeed('https://cdn.example/clip-preview.jpg')
        return
      }
      uploadOrder.push('video')
      call.succeed('https://cdn.example/clip.mp4')
    }
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
    expect(uploadCalls[0].attachment).toEqual(
      expect.objectContaining({ name: 'clip-preview.jpg', type: attachmentTypes.image })
    )
    expect(uploadCalls[0].request).toEqual(
      expect.objectContaining({ fileName: 'clip-preview.jpg', mimeType: 'image/jpeg' })
    )
    expect(await readBlobText(uploadCalls[0].file)).toBe('preview-bytes')
    expect(uploadOrder).toEqual(['preview', 'video'])
    expect(channel.createAttachmentBuilder).toHaveBeenCalledWith('https://cdn.example/clip.mp4', attachmentTypes.video)
    expect((channel as any).__attachmentBuilder.setMetadata).toHaveBeenCalledWith(
      expect.stringContaining('"pvw":"https://cdn.example/clip-preview.jpg"')
    )
  })

  it('a stop pressed while the video preview uploads keeps the video upload stopped when it starts', async () => {
    const channel = makeUploaderChannel('channel-video-preview-stop')
    const video = new File(['video-bytes'], 'clip.mp4', { type: 'video/mp4' })
    mockGetVideoFirstFrame.mockResolvedValue({ blob: new Blob(['preview-bytes'], { type: 'image/jpeg' }) })
    const pauseDispatched: any[] = []
    uploadBehavior = (call) => {
      if (call.attachment.type === attachmentTypes.image) {
        // The user presses stop while the preview is uploading.
        runSaga(
          { dispatch: (action: any) => pauseDispatched.push(action), getState: () => ({}) },
          __messageSagaTestables.pauseAttachmentUploading as any,
          { payload: { attachmentId: 'video-stop-tid' } }
        )
        call.succeed('https://cdn.example/clip-preview.jpg')
        return
      }
      call.succeed('https://cdn.example/clip.mp4')
    }
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
    let sent = false
    const sending = handleUploadAttachments([attachment], { type: 'text' } as any, channel).then((result) => {
      sent = true
      return result
    })
    // Let the preview upload, the state change and the video upload's start run.
    await settleMicrotasks(() => storeDispatch.mock.calls.length > 0)
    await settleMicrotasks()

    expect(pauseDispatched).toEqual([updateAttachmentUploadingStateAC(UPLOAD_STATE.PAUSED, 'video-stop-tid')])
    // Nothing of the video is sent while it is stopped.
    expect(uploadCalls.map((call) => call.attachment.type)).toEqual([attachmentTypes.image])
    expect(sent).toBe(false)
    // After the preview, the video shows as paused, not uploading.
    expect(storeDispatch).toHaveBeenCalledWith(updateAttachmentUploadingStateAC(UPLOAD_STATE.PAUSED, 'video-stop-tid'))
    expect(storeDispatch).not.toHaveBeenCalledWith(
      updateAttachmentUploadingStateAC(UPLOAD_STATE.UPLOADING, 'video-stop-tid')
    )

    // Resumed: the video is uploaded.
    await runMessageSaga(__messageSagaTestables.resumeAttachmentUploading, {
      payload: { attachmentId: 'video-stop-tid' }
    })
    const [uploadedVideo] = await sending
    expect(uploadCalls.map((call) => call.attachment.type)).toEqual([attachmentTypes.image, attachmentTypes.video])
    expect(uploadedVideo).toEqual(expect.objectContaining({ tid: 'video-stop-tid' }))
  })

  it('a resume pressed while the video preview still uploads shows it as preparing again', () => {
    // A video: its preview uploads first.
    markUploadNotStarted('video-resume-tid', true)
    pauseUpload('video-resume-tid')
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
    uploadBehavior = (call) =>
      call.succeed(
        call.attachment.type === attachmentTypes.image
          ? 'https://cdn.example/compose-preview.jpg'
          : 'https://cdn.example/clip.mp4'
      )
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
    expect(uploadCalls[0].attachment).toEqual(
      expect.objectContaining({ type: attachmentTypes.image, data: expect.any(File), size: composePreviewBlob.size })
    )
    expect(await readBlobText(uploadCalls[0].file)).toBe('compose-preview')
    expect((channel as any).__attachmentBuilder.setMetadata).toHaveBeenCalledWith(
      expect.stringContaining('"pvw":"https://cdn.example/compose-preview.jpg"')
    )
  })

  it('preserves video dimensions, replaces legacy previewImage, and does not extract a second frame after upload', async () => {
    const channel = makeUploaderChannel('channel-video-thumb-metadata')
    const video = new File(['video-bytes'], 'clip.mp4', { type: 'video/mp4' })
    mockGetVideoFirstFrame.mockResolvedValue({ blob: new Blob(['preview'], { type: 'image/jpeg' }) })
    uploadBehavior = (call) =>
      call.succeed(
        call.attachment.type === attachmentTypes.image
          ? 'https://cdn.example/new-thumb.jpg'
          : 'https://cdn.example/clip.mp4'
      )
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
      pvw: 'https://cdn.example/new-thumb.jpg'
    })
    expect(metadata.previewImage).toBeUndefined()
  })

  it('a view-once video is sent without a preview image', async () => {
    const channel = makeUploaderChannel('channel-view-once-video')
    const video = new File(['video-bytes'], 'clip.mp4', { type: 'video/mp4' })
    mockGetVideoFirstFrame.mockResolvedValue({ blob: new Blob(['preview'], { type: 'image/jpeg' }) })
    uploadBehavior = (call) => call.succeed('https://cdn.example/clip.mp4')
    const attachment = {
      tid: 'view-once-video-tid',
      type: attachmentTypes.video,
      name: 'clip.mp4',
      size: video.size,
      url: video,
      data: video,
      metadata: '{"tmb":"thumb","szw":1280,"szh":720,"dur":12}',
      upload: false
    } as any

    const sent = await handleUploadAttachments([attachment], { type: 'view_once', viewOnce: true } as any, channel)

    expect(mockGetVideoPreviewFrame).not.toHaveBeenCalled()
    expect(uploadCalls.map((call) => call.attachment.type)).toEqual([attachmentTypes.video])
    expect(sent.map((sentAttachment: IAttachment) => sentAttachment.tid)).toEqual(['view-once-video-tid'])
    expect(JSON.parse(sent[0].metadata).pvw).toBeUndefined()
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
            metadata: expect.stringContaining('"pvw":"https://cdn.example/uploaded-1"')
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
    uploadBehavior = (call) => {
      if (call.attachment.type === attachmentTypes.image) {
        call.fail(new Error('preview upload failed'))
        return
      }
      call.succeed()
    }

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
    uploadBehavior = (call) => {
      if (call.attachment.type === attachmentTypes.image) {
        call.fail(new Error('preview upload failed'))
        return
      }
      call.succeed()
    }
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
    uploadBehavior = (call) => {
      if (call.attachment.type === attachmentTypes.image) {
        call.succeed('https://cdn.example/clip-preview.jpg')
        return
      }
      if (failVideoUpload) {
        call.fail(networkingError())
        return
      }
      call.succeed('https://cdn.example/clip.mp4')
    }

    await expect(handleUploadAttachments([attachment], { type: 'text' } as any, channel)).rejects.toMatchObject({
      code: 'NetworkingError'
    })

    expect(uploadCalls.filter((call) => call.attachment.type === attachmentTypes.image)).toHaveLength(1)

    failVideoUpload = false
    const [sent] = await handleUploadAttachments([attachment], { type: 'text' } as any, channel)

    // The preview the first send stored goes with the video: it is not made or uploaded again.
    expect(uploadCalls.map((call) => call.attachment.type)).toEqual([
      attachmentTypes.image,
      attachmentTypes.video,
      attachmentTypes.video
    ])
    expect(mockGetVideoPreviewFrame).toHaveBeenCalledTimes(1)
    expect(JSON.parse(sent.metadata)).toMatchObject({ pvw: 'https://cdn.example/clip-preview.jpg' })
  })

  describe('with encryptUploads and a transport of the app', () => {
    // Like Waafi's transport: it encrypts the file with fileTransfer.encryption,
    // stores the encrypted bytes and reports the session's encryption.
    let stored: Blob[]
    // eslint-disable-next-line no-unused-vars
    let uriFor: (attachment: IAttachment) => string
    beforeEach(() => {
      const client = installFakeFilesClient()
      Object.assign(client, { user: { id: 'current-user' }, Channel: { create: jest.fn() } })
      stored = []
      uriFor = () => 'https://cdn.example/uploaded-1'
      uploadBehavior = async (call) => {
        const session = await fileTransfer.encryption.prepareEncryption(call.file)
        try {
          const ciphertext = await session.read(0, session.ciphertextSize)
          stored.push(new Blob([ciphertext as BlobPart], { type: 'application/octet-stream' }))
          call.succeed(uriFor(call.attachment), session.encryptionInfo)
        } finally {
          session.close()
        }
      }
      fileTransfer.configure({ encryptUploads: true, provider: makeFakeTransport() })
    })

    it('uploads the encrypted file and sends its key in the attachment metadata', async () => {
      const channel = makeUploaderChannel('channel-encrypted-image')
      const image = makeLiveFile()
      const attachment = {
        ...makeAttachment('encrypted-image-tid', image),
        url: image,
        metadata: '{"szw":10,"szh":20}'
      }

      const [sent] = await handleUploadAttachments([attachment], { type: 'text' } as any, channel)

      // The transport is asked for an encrypted upload of the plaintext file.
      expect(uploadCalls.map((call) => call.request.type)).toEqual([FileUploadType.ENCRYPTED])
      expect(uploadCalls[0].file).toBe(image)
      expect(await readBlobText(stored[0])).toBe(await readBlobText(fakeEncrypted('key-1', 'file-bytes')))
      expect(JSON.parse(sent.metadata)).toEqual({ szw: 10, szh: 20, 'sceyt.enc': fakeEncryption('key-1') })
      // The size shown and sent is the plaintext's.
      expect((channel as any).__attachmentBuilder.setFileSize).toHaveBeenCalledWith(image.size)
    })

    it('encrypts a video and its preview image with their own keys; the preview is an attachment of its own', async () => {
      const channel = makeUploaderChannel('channel-encrypted-video')
      const video = new File(['video-bytes'], 'clip.mp4', { type: 'video/mp4' })
      mockGetVideoFirstFrame.mockResolvedValue({ blob: new Blob(['preview-bytes'], { type: 'image/jpeg' }) })
      uriFor = (uploadedAttachment) =>
        uploadedAttachment.type === attachmentTypes.preview
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
      let sent: any[] = []
      try {
        sent = await handleUploadAttachments([attachment], { type: 'text' } as any, channel)
      } finally {
        Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectURL })
      }

      expect(uploadCalls.map((call) => call.request.type)).toEqual([FileUploadType.ENCRYPTED, FileUploadType.ENCRYPTED])
      expect(await readBlobText(stored[0])).toBe(await readBlobText(fakeEncrypted('key-1', 'preview-bytes')))
      expect(await readBlobText(stored[1])).toBe(await readBlobText(fakeEncrypted('key-2', 'video-bytes')))
      const [sentVideo, sentPreview] = sent
      // The video has its own enc and names its preview by URL.
      expect(JSON.parse(sentVideo.metadata)).toEqual({
        pvw: 'https://cdn.example/clip-preview.jpg',
        'sceyt.enc': fakeEncryption('key-2')
      })
      // The preview is a preview attachment with its own enc.
      expect(sentPreview).toMatchObject({ type: attachmentTypes.preview, url: 'https://cdn.example/clip-preview.jpg' })
      expect(JSON.parse(sentPreview.metadata)).toEqual({ 'sceyt.enc': fakeEncryption('key-1') })
    })

    it('with a transport that reports no encryption, the message fails instead of sending the file unencrypted', async () => {
      const channel = makeUploaderChannel('channel-encrypted-plain-transport')
      const image = makeLiveFile()
      // It stores the file as it is given, and reports only its URL.
      uploadBehavior = (call) => call.succeed('https://cdn.example/plain.png')

      await expect(
        handleUploadAttachments(
          [{ ...makeAttachment('encrypted-plain-transport-tid', image), url: image }],
          { type: 'text' } as any,
          channel
        )
      ).rejects.toThrow('Encrypted upload returned no encryption information')
      expect(channel.createAttachmentBuilder).not.toHaveBeenCalled()
      expect(channel.sendMessage).not.toHaveBeenCalled()
    })

    it("the provider's prepareUpload: its entries are merged into the metadata before the upload and sent; no sceyt.enc", async () => {
      const channel = makeUploaderChannel('channel-prepared-upload')
      const image = makeLiveFile()
      const prepareUpload = jest.fn(async () => ({ 'app.enc': 'keys-slot-1' }))
      fileTransfer.configure({
        encryptUploads: true,
        provider: Object.assign(makeFakeTransport(), { prepareUpload })
      })
      const attachment = {
        ...makeAttachment('prepared-upload-tid', image),
        url: image,
        metadata: '{"szw":10,"szh":20}'
      }

      const [sent] = await handleUploadAttachments([attachment], { type: 'text' } as any, channel)

      expect(prepareUpload).toHaveBeenCalledTimes(1)
      expect(uploadCalls[0].file).toBe(image)
      // Saved before the upload: the provider gets it in the attachment and in the request's metadata.
      expect(JSON.parse(uploadCalls[0].request.context.attachment.metadata)['app.enc']).toBe('keys-slot-1')
      expect(uploadCalls[0].request.metadata).toEqual({ szw: 10, szh: 20, 'app.enc': 'keys-slot-1' })
      // The provider owns the encryption: its entry is in the metadata, and no "sceyt.enc" is written.
      expect(JSON.parse(sent.metadata)).toEqual({ szw: 10, szh: 20, 'app.enc': 'keys-slot-1' })
    })

    it('a view-once encrypted video is sent without a preview attachment', async () => {
      const channel = makeUploaderChannel('channel-view-once-encrypted-video')
      const video = new File(['video-bytes'], 'clip.mp4', { type: 'video/mp4' })
      mockGetVideoFirstFrame.mockResolvedValue({ blob: new Blob(['preview-bytes'], { type: 'image/jpeg' }) })
      const attachment = {
        tid: 'view-once-encrypted-video-tid',
        type: attachmentTypes.video,
        name: 'clip.mp4',
        size: video.size,
        url: video,
        data: video,
        metadata: JSON.stringify({ szw: 1280, szh: 720, tmb: 'hash', dur: 12 }),
        upload: false
      } as any

      const sent = await handleUploadAttachments([attachment], { type: 'view_once', viewOnce: true } as any, channel)

      expect(mockGetVideoPreviewFrame).not.toHaveBeenCalled()
      expect(uploadCalls.map((call) => call.attachment.tid)).toEqual(['view-once-encrypted-video-tid'])
      expect(sent.map((sentAttachment: IAttachment) => sentAttachment.tid)).toEqual(['view-once-encrypted-video-tid'])
      expect(JSON.parse(sent[0].metadata).pvw).toBeUndefined()
    })

    it("the provider's prepareUpload: a video's preview is a preview attachment of its own, named by its pvw", async () => {
      const channel = makeUploaderChannel('channel-prepared-video')
      const video = new File(['video-bytes'], 'clip.mp4', { type: 'video/mp4' })
      const photo = makeLiveFile()
      mockGetVideoFirstFrame.mockResolvedValue({ blob: new Blob(['preview-bytes'], { type: 'image/jpeg' }) })
      const prepareUpload = jest.fn(async ({ context }: any) => ({ 'app.enc': `keys-${context.attachment.tid}` }))
      uriFor = (uploadedAttachment) => `https://cdn.example/${uploadedAttachment.tid}`
      fileTransfer.configure({
        encryptUploads: true,
        provider: Object.assign(makeFakeTransport(), { prepareUpload })
      })
      const videoAttachment = {
        tid: 'prepared-video-tid',
        type: attachmentTypes.video,
        name: 'clip.mp4',
        size: video.size,
        url: video,
        data: video,
        metadata: JSON.stringify({ szw: 1280, szh: 720, tmb: 'hash', dur: 12 }),
        upload: false
      } as any
      const photoAttachment = {
        ...makeAttachment('prepared-photo-tid', photo),
        url: photo,
        metadata: '{"szw":10,"szh":20}'
      }

      const originalCreateObjectURL = URL.createObjectURL
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: jest.fn(() => 'blob:sender-video') })
      let sent: any[] = []
      try {
        sent = await handleUploadAttachments([videoAttachment, photoAttachment], { type: 'text' } as any, channel)
      } finally {
        Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectURL })
      }

      // The message's own attachments keep their places; the preview comes after them.
      expect(sent.map((attachment) => attachment.tid)).toEqual([
        'prepared-video-tid',
        'prepared-photo-tid',
        'prepared-video-tid-thumbnail'
      ])
      const [sentVideo, , sentPreview] = sent
      // The video names its preview by URL, and carries no sceyt.enc: only the provider's entry.
      expect(JSON.parse(sentVideo.metadata)).toEqual({
        szw: 1280,
        szh: 720,
        tmb: 'hash',
        dur: 12,
        pvw: 'https://cdn.example/prepared-video-tid-thumbnail',
        'app.enc': 'keys-prepared-video-tid'
      })
      // The preview is a preview attachment with its own entry, the video's dimensions and hash.
      expect(sentPreview.type).toBe('preview')
      expect(sentPreview.url).toBe('https://cdn.example/prepared-video-tid-thumbnail')
      expect(JSON.parse(sentPreview.metadata)).toEqual({
        szw: 1280,
        szh: 720,
        tmb: 'hash',
        'app.enc': 'keys-prepared-video-tid-thumbnail'
      })
      expect(prepareUpload.mock.calls.map(([request]: any) => request.context.attachment.tid).sort()).toEqual([
        'prepared-photo-tid',
        'prepared-video-tid',
        'prepared-video-tid-thumbnail'
      ])
    })

    it("the provider's prepareUpload: previews go in their videos' order, whichever finishes uploading first", async () => {
      const channel = makeUploaderChannel('channel-two-videos')
      const first = new File(['first-video'], 'first.mp4', { type: 'video/mp4' })
      const second = new File(['second-video'], 'second.mp4', { type: 'video/mp4' })
      mockGetVideoFirstFrame.mockResolvedValue({ blob: new Blob(['preview-bytes'], { type: 'image/jpeg' }) })
      const prepareUpload = jest.fn(async () => ({ 'app.enc': 'keys' }))
      fileTransfer.configure({
        encryptUploads: true,
        provider: Object.assign(makeFakeTransport(), { prepareUpload })
      })
      // The first video's preview is stored only after the second's.
      let releaseFirstPreview: () => void = () => undefined
      const firstPreviewHeld = new Promise<void>((resolve) => (releaseFirstPreview = resolve))
      uploadBehavior = async (call) => {
        const tid = call.attachment.tid!
        if (tid === 'first-video-tid-thumbnail') await firstPreviewHeld
        call.succeed(`https://cdn.example/${tid}`)
        if (tid === 'second-video-tid-thumbnail') releaseFirstPreview()
      }
      const video = (tid: string, file: File) =>
        ({
          tid,
          type: attachmentTypes.video,
          name: file.name,
          size: file.size,
          url: file,
          data: file,
          metadata: '{}',
          upload: false
        }) as any

      const originalCreateObjectURL = URL.createObjectURL
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: jest.fn(() => 'blob:sender-video') })
      let sent: any[] = []
      try {
        sent = await handleUploadAttachments(
          [video('first-video-tid', first), video('second-video-tid', second)],
          { type: 'text' } as any,
          channel
        )
      } finally {
        Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectURL })
      }

      expect(sent.map((attachment) => attachment.tid)).toEqual([
        'first-video-tid',
        'second-video-tid',
        'first-video-tid-thumbnail',
        'second-video-tid-thumbnail'
      ])
      // Each video names its own preview, so receivers pair them whatever order the server returns.
      expect(JSON.parse(sent[0].metadata).pvw).toBe('https://cdn.example/first-video-tid-thumbnail')
      expect(JSON.parse(sent[1].metadata).pvw).toBe('https://cdn.example/second-video-tid-thumbnail')
    })

    it('a failed prepareUpload of the provider fails the message, uploading nothing', async () => {
      const channel = makeUploaderChannel('channel-prepare-failed')
      const image = makeLiveFile()
      fileTransfer.configure({
        encryptUploads: true,
        provider: Object.assign(makeFakeTransport(), {
          prepareUpload: () => Promise.reject(new Error('the app could not prepare it'))
        })
      })

      await expect(
        handleUploadAttachments(
          [{ ...makeAttachment('prepare-failed-tid', image), url: image }],
          { type: 'text' } as any,
          channel
        )
      ).rejects.toThrow('the app could not prepare it')
      expect(uploadCalls).toEqual([])
      expect(channel.createAttachmentBuilder).not.toHaveBeenCalled()
    })

    it('with the default transport and an SDK without client.uploadEncrypted, the message fails, nothing goes unencrypted', async () => {
      const currentUser = makeUser({ id: 'current-user' })
      const channel = makeUploaderChannel('channel-encrypted-old-sdk')
      const video = new File(['video-bytes'], 'clip.mp4', { type: 'video/mp4' })
      mockGetVideoFirstFrame.mockResolvedValue({ blob: new Blob(['preview-bytes'], { type: 'image/jpeg' }) })
      const pendingMessage = makePendingMessage({
        channelId: channel.id,
        tid: 'encrypted-old-sdk-message-tid',
        user: currentUser,
        attachments: [
          {
            tid: trackedTid('encrypted-old-sdk-attachment-tid'),
            type: attachmentTypes.video,
            name: 'clip.mp4',
            size: video.size,
            data: video,
            metadata: '{}',
            upload: true
          } as any
        ]
      })
      // An SDK that uploads plaintext files only.
      const upload = jest.fn(async () => ({ url: 'https://cdn.example/plain' }))
      const uploadFile = jest.fn()
      Object.assign(getClient(), { upload, uploadFile })
      fileTransfer.configure({ encryptUploads: true })
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
      expect(upload).not.toHaveBeenCalled()
      expect(uploadFile).not.toHaveBeenCalled()
      expect(channel.sendMessage).not.toHaveBeenCalled()
      expect(getPendingMessagesFromMap(channel.id)).toEqual([
        expect.objectContaining({ tid: 'encrypted-old-sdk-message-tid', state: MESSAGE_STATUS.FAILED })
      ])
    })
  })

  describe('with the default transport (the SDK uploads each file)', () => {
    // The SDK uploads one file per call; the uikit uploads each attachment and
    // sends the message with their URLs.
    let sdkUploads: { file: File; options: any }[]
    // client.uploadEncrypted calls: the SDK's prepared (encrypted) upload of each file.
    let encryptedUploads: { prepared: ReturnType<typeof makeFakePreparedUpload>; options: any }[]
    // eslint-disable-next-line no-unused-vars
    let uploadAnswer: (file: File, options: any) => Promise<any>
    let uploadFile: jest.Mock

    beforeEach(() => {
      sdkUploads = []
      encryptedUploads = []
      uploadFile = jest.fn()
      uploadAnswer = async (file) => ({ url: `https://cdn.example/${file.name}`, size: file.size })
      fileTransfer.configure()
      // The default transport: the chat client stores a file (client.upload), or the
      // encrypted bytes of the SDK's prepared upload (client.uploadEncrypted; keys are
      // key-1, key-2, … in the order files are encrypted).
      setClient({
        ...installFakeFilesClient(),
        user: { id: 'current-user' },
        Channel: { create: jest.fn() },
        uploadFile,
        upload: (file: File, options: any) => {
          sdkUploads.push({ file, options })
          return uploadAnswer(file, options)
        },
        uploadEncrypted: (prepared: ReturnType<typeof makeFakePreparedUpload>, options: any) => {
          encryptedUploads.push({ prepared, options })
          return uploadAnswer(prepared.source as File, options)
        }
      })
    })

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
          tid: trackedTid(`${tid}-attachment-${i}`),
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
      // Not encrypted: the files are stored as they are.
      expect(encryptedUploads).toHaveLength(0)
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
      expect(sent.map((attachment: any) => JSON.parse(attachment.metadata)['sceyt.enc'])).toEqual([
        undefined,
        undefined
      ])
    })

    it('with encryptUploads, each file is encrypted before it is sent and its own key goes in its metadata', async () => {
      fileTransfer.encryptUploads = true
      const channel = makeUploaderChannel('channel-sdk-upload-encrypted')
      const first = new File(['first'], 'first.pdf', { type: 'application/pdf' })
      const second = new File(['second'], 'second.pdf', { type: 'application/pdf' })
      channel.sendMessage = jest.fn(() =>
        Promise.resolve(
          makeServerResponse('sdk-encrypted', 'sdk-encrypted-attachment-0', makeUser({ id: 'current-user' }))
        )
      )

      await sendPending(channel, pendingWith(channel, 'sdk-encrypted', [first, second]))

      // The client is given each file's encrypted upload, with the file's own key; nothing goes unencrypted.
      expect(sdkUploads).toHaveLength(0)
      expect(encryptedUploads.map(({ prepared }) => (prepared.source as File).name)).toEqual([
        'first.pdf',
        'second.pdf'
      ])
      expect(await Promise.all(encryptedUploads.map(({ prepared }) => readBlobText(prepared.stored)))).toEqual(
        await Promise.all([fakeEncrypted('key-1', 'first'), fakeEncrypted('key-2', 'second')].map(readBlobText))
      )
      const sent = (channel.sendMessage as jest.Mock).mock.calls[0][0].attachments
      expect(sent.map((attachment: any) => JSON.parse(attachment.metadata)['sceyt.enc'])).toEqual([
        fakeEncryption('key-1'),
        fakeEncryption('key-2')
      ])
    })

    it('uploads a video preview with client.uploadEncrypted before the video, each with its own key, as its own attachment', async () => {
      fileTransfer.encryptUploads = true
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
      expect(encryptedUploads.map(({ prepared }) => (prepared.source as File).name)).toEqual([
        'video-preview.jpg',
        'clip.mp4'
      ])
      // Both are stored encrypted, the preview with its own key.
      expect(await Promise.all(encryptedUploads.map(({ prepared }) => readBlobText(prepared.stored)))).toEqual(
        await Promise.all(
          [fakeEncrypted('key-1', 'preview-bytes'), fakeEncrypted('key-2', 'video-bytes')].map(readBlobText)
        )
      )
      expect(sdkUploads).toHaveLength(0)
      expect(uploadFile).not.toHaveBeenCalled()
      const [sent, sentPreview] = (channel.sendMessage as jest.Mock).mock.calls[0][0].attachments
      expect(sent).toMatchObject({ url: 'https://cdn.example/clip.mp4', upload: false })
      // The video has its own enc and names its preview by URL.
      expect(JSON.parse(sent.metadata)).toEqual({
        pvw: 'https://cdn.example/video-preview.jpg',
        'sceyt.enc': fakeEncryption('key-2')
      })
      // The preview is a preview attachment with its own enc.
      expect(sentPreview).toMatchObject({
        type: attachmentTypes.preview,
        url: 'https://cdn.example/video-preview.jpg',
        upload: false
      })
      expect(JSON.parse(sentPreview.metadata)).toEqual({ 'sceyt.enc': fakeEncryption('key-1') })
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
      uploadAttachment(
        { tid: 'sdk-stop-tid', url: file } as IAttachment,
        { file, fileName: file.name, mimeType: file.type },
        () => undefined
      )
      await settleMicrotasks(() => sdkUploads.length > 0)

      const paused = await runMessageSaga(__messageSagaTestables.pauseAttachmentUploading, {
        payload: { attachmentId: 'sdk-stop-tid' }
      })
      expect(paused).toContainEqual(updateAttachmentUploadingStateAC(UPLOAD_STATE.PAUSED, 'sdk-stop-tid'))
      expect(sdkUploads[0].options.signal.aborted).toBe(true)

      const resumed = await runMessageSaga(__messageSagaTestables.resumeAttachmentUploading, {
        payload: { attachmentId: 'sdk-stop-tid' }
      })
      expect(resumed).toContainEqual(updateAttachmentUploadingStateAC(UPLOAD_STATE.UPLOADING, 'sdk-stop-tid'))
      await settleMicrotasks(() => sdkUploads.length > 1)
      expect(sdkUploads).toHaveLength(2)
      expect(sdkUploads[1].file).toBe(file)
      expect(sdkUploads[1].options.signal.aborted).toBe(false)
    })

    it('deleting a pending message stops the SDK upload of its attachment', async () => {
      uploadAnswer = () => new Promise(() => undefined)
      const file = new File(['x'], 'x.pdf', { type: 'application/pdf' })
      uploadAttachment(
        { tid: 'sdk-delete-tid', url: file } as IAttachment,
        { file, fileName: file.name, mimeType: file.type },
        () => undefined
      )
      await settleMicrotasks(() => sdkUploads.length > 0)

      deletePendingMessage('channel-sdk-delete', {
        tid: 'sdk-delete-msg',
        attachments: [{ tid: 'sdk-delete-tid' }]
      } as any)

      expect(sdkUploads[0].options.signal.aborted).toBe(true)
    })
  })
})
