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
})
