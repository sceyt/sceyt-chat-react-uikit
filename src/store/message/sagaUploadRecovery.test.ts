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
import {
  deleteMessageAC,
  resendMessageAC,
  sendMessageAC,
  setUpdateMessageAttachmentAC,
  updateAttachmentUploadingStateAC,
  updateMessageAC
} from './actions'
import { RESEND_MESSAGE } from './constants'
import {
  markUploadNotStarted,
  pauseUpload,
  setCustomUploader,
  setSendAttachmentsAsSeparateMessages
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

  it('after an SDK upload, the sender sees the full sent image, not a copy cut to the bubble size', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channel = makeUploaderChannel('channel-default-image')
    const image = new File(['full-image-bytes'], 'photo.png', { type: 'image/png' })
    const pendingMessage = makePendingMessage({
      channelId: channel.id,
      tid: 'default-image-message-tid',
      user: currentUser,
      attachments: [
        {
          tid: 'default-image-attachment-tid',
          type: attachmentTypes.image,
          name: 'photo.png',
          size: image.size,
          data: image,
          metadata: '{"szw":1280,"szh":1080}',
          upload: true
        } as any
      ]
    })
    setCustomUploader(undefined)
    setClient({ user: { id: 'current-user' }, Channel: { create: jest.fn() } })
    // The SDK calls the attachment's completion once the file is stored.
    channel.sendMessage = jest.fn(async (message: any) => {
      message.attachments[0].completion({ url: 'https://cdn.example/uploaded-1' }, null)
      return makeServerResponse('default-image-message-tid', 'default-image-attachment-tid', currentUser)
    })
    setActiveChannelId(channel.id)
    setChannelInMap(channel)
    addMessageToMap(channel.id, pendingMessage)
    const originalCreateObjectURL = URL.createObjectURL
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: jest.fn((blob: Blob) => (blob === image ? 'blob:sent-image' : 'blob:another-copy'))
    })
    try {
      await runMessageSaga(__messageSagaTestables.sendMessage, {
        type: RESEND_MESSAGE,
        payload: {
          message: pendingMessage,
          connectionState: CONNECTION_STATUS.CONNECTED,
          channelId: channel.id,
          sendAttachmentsAsSeparateMessage: false
        }
      })
      // The cache update runs after the completion returns.
      for (let i = 0; i < 20 && !(URL.createObjectURL as jest.Mock).mock.calls.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, 0))
      }

      expect(mockStore.dispatch).toHaveBeenCalledWith(
        setUpdateMessageAttachmentAC('https://cdn.example/uploaded-1', 'blob:sent-image')
      )
      expect(mockStore.dispatch).not.toHaveBeenCalledWith(
        setUpdateMessageAttachmentAC('https://cdn.example/uploaded-1', 'blob:another-copy')
      )
    } finally {
      Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectURL })
    }
  })

  it('uploads the preview with the SDK before sending a default-upload video', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channel = makeUploaderChannel('channel-video-preview-required')
    const video = new File(['video-bytes'], 'clip.mp4', { type: 'video/mp4' })
    const pendingMessage = makePendingMessage({
      channelId: channel.id,
      tid: 'video-preview-required-message-tid',
      body: 'video',
      user: currentUser,
      attachments: [
        {
          tid: 'video-preview-required-attachment-tid',
          type: attachmentTypes.video,
          name: 'clip.mp4',
          size: video.size,
          data: video,
          metadata: '{}',
          upload: true
        } as any
      ]
    })
    const uploadFile = jest.fn().mockResolvedValue('https://cdn.example/default-preview.jpg')
    setCustomUploader(undefined)
    setClient({ user: { id: 'current-user' }, Channel: { create: jest.fn() }, uploadFile })
    mockGetVideoFirstFrame.mockResolvedValue({ blob: new Blob(['preview'], { type: 'image/jpeg' }) })
    channel.sendMessage = jest.fn(() =>
      Promise.resolve({
        ...makeServerResponse(
          'video-preview-required-message-tid',
          'video-preview-required-attachment-tid',
          currentUser
        ),
        attachments: [
          {
            id: 'default-video-upload-id',
            tid: 'video-preview-required-attachment-tid',
            url: 'https://cdn.example/default-video.mp4',
            type: attachmentTypes.video,
            name: 'clip.mp4',
            size: video.size,
            metadata: '{}'
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

    expect(uploadFile).toHaveBeenCalledWith({ data: expect.any(File), progress: expect.any(Function) })
    expect(mockGetVideoPreviewFrame).toHaveBeenCalledWith(video)
    expect(mockStore.dispatch).toHaveBeenCalledWith(
      updateAttachmentUploadingStateAC(UPLOAD_STATE.PREPARING, 'video-preview-required-attachment-tid')
    )
    expect(dispatched).toContainEqual(
      updateAttachmentUploadingStateAC(UPLOAD_STATE.UPLOADING, 'video-preview-required-attachment-tid')
    )
    expect(channel.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          expect.objectContaining({
            metadata: expect.stringContaining('"video_thumb":"https://cdn.example/default-preview.jpg"'),
            progress: expect.any(Function),
            completion: expect.any(Function)
          })
        ]
      })
    )
  })

  it('does not send a default-upload video when the SDK preview upload fails', async () => {
    const currentUser = makeUser({ id: 'current-user' })
    const channel = makeUploaderChannel('channel-default-video-preview-failure')
    const video = new File(['video-bytes'], 'clip.mp4', { type: 'video/mp4' })
    const pendingMessage = makePendingMessage({
      channelId: channel.id,
      tid: 'default-video-preview-failure-message-tid',
      user: currentUser,
      attachments: [
        {
          tid: 'default-video-preview-failure-attachment-tid',
          type: attachmentTypes.video,
          name: 'clip.mp4',
          size: video.size,
          data: video,
          metadata: '{}',
          upload: true
        } as any
      ]
    })
    setCustomUploader(undefined)
    setClient({
      user: { id: 'current-user' },
      Channel: { create: jest.fn() },
      uploadFile: jest.fn().mockRejectedValue(new Error('preview upload failed'))
    })
    mockGetVideoFirstFrame.mockResolvedValue({ blob: new Blob(['preview'], { type: 'image/jpeg' }) })
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

    expect(channel.sendMessage).not.toHaveBeenCalled()
    expect(dispatched).toEqual(
      expect.arrayContaining([
        updateAttachmentUploadingStateAC(UPLOAD_STATE.FAIL, 'default-video-preview-failure-attachment-tid'),
        updateMessageAC('default-video-preview-failure-message-tid', { state: MESSAGE_STATUS.FAILED })
      ])
    )
  })

  it('re-runs preview and video upload after a retryable video upload failure', async () => {
    const channel = makeUploaderChannel('channel-video-preview-retry')
    const video = new File(['video-bytes'], 'clip.mp4', { type: 'video/mp4' })
    const attachment = {
      tid: 'video-preview-retry-attachment-tid',
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
    await handleUploadAttachments([attachment], { type: 'text' } as any, channel)

    expect(uploadCalls.filter((uploadedAttachment) => uploadedAttachment.type === attachmentTypes.image)).toHaveLength(
      2
    )
    expect(uploadCalls).toHaveLength(4)
  })

  describe('with encryptAttachments', () => {
    // Like Waafi's uploader: it prepares the file and stores what prepareFile returns.
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
        upload: async (attachment: any, uploadTask: any, _messageType: any, helpers: any) => {
          uploadCalls.push(attachment)
          const uri = uriFor(attachment)
          const prepared = await helpers.prepareFile(attachment.data)
          stored.push(await prepared.getAll())
          uploadTask.success({ uri, blob: attachment.data })
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
        enc: { id: 'id-1', v: 1, k: 'key-1' }
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
        enc: { id: 'id-2', v: 1, k: 'key-2', thumb: { id: 'id-1', k: 'key-1' } }
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

    it('without a custom uploader, the SDK uploads the whole encrypted video and preview, with their keys in the metadata', async () => {
      const currentUser = makeUser({ id: 'current-user' })
      const channel = makeUploaderChannel('channel-encrypted-sdk-upload')
      const video = new File(['video-bytes'], 'clip.mp4', { type: 'video/mp4' })
      const pendingMessage = makePendingMessage({
        channelId: channel.id,
        tid: 'encrypted-sdk-upload-message-tid',
        user: currentUser,
        attachments: [
          {
            tid: 'encrypted-sdk-upload-attachment-tid',
            type: attachmentTypes.video,
            name: 'clip.mp4',
            size: video.size,
            data: video,
            metadata: '{}',
            upload: true
          } as any
        ]
      })
      const uploadFile = jest.fn().mockResolvedValue('https://cdn.example/sdk-preview.jpg')
      Object.assign(getClient(), { uploadFile })
      setCustomUploader(undefined)
      mockGetVideoFirstFrame.mockResolvedValue({ blob: new Blob(['preview-bytes'], { type: 'image/jpeg' }) })
      channel.sendMessage = jest.fn(() =>
        Promise.resolve(
          makeServerResponse('encrypted-sdk-upload-message-tid', 'encrypted-sdk-upload-attachment-tid', currentUser)
        )
      )
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

      // The preview is made from the plaintext video, then encrypted and uploaded whole.
      expect(mockGetVideoPreviewFrame).toHaveBeenCalledWith(video)
      const preview = uploadFile.mock.calls[0][0].data
      expect(preview.type).toBe('application/octet-stream')
      expect(await readBlobText(preview)).toBe('enc(key-1@id-1):preview-bytes')
      // The SDK is given the whole encrypted video, and keeps its progress and completion callbacks.
      const [sent] = (channel.sendMessage as jest.Mock).mock.calls[0][0].attachments
      expect(sent).toMatchObject({ upload: true, progress: expect.any(Function), completion: expect.any(Function) })
      expect(sent.url.type).toBe('application/octet-stream')
      expect(sent.url.name).toBe('clip.mp4')
      expect(await readBlobText(sent.url)).toBe('enc(key-2@id-2):video-bytes')
      expect(JSON.parse(sent.metadata)).toEqual({
        video_thumb: 'https://cdn.example/sdk-preview.jpg',
        enc: { id: 'id-2', v: 1, k: 'key-2', thumb: { id: 'id-1', k: 'key-1' } }
      })
    })
  })
})
