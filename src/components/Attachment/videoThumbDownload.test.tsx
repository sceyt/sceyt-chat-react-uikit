import React from 'react'
import { renderToString } from 'react-dom/server'
import { Provider } from 'react-redux'
import { SceytReduxContext } from '../../store/context'
import { act, fireEvent, screen } from '@testing-library/react'
import Attachment from './index'
import { attachmentTypes } from '../../helpers/constants'
import { getAttachmentUrlFromCache, setAttachmentToCache } from '../../helpers/attachmentsCache'
import { CONNECTION_STATUS } from '../../store/user/constants'
import { setConnectionStatusAC } from '../../store/user/actions'
import { pauseAttachmentUploadingAC } from '../../store/message/actions'
import { createMessageListStore, renderWithSceytProvider } from '../../testUtils/messageListHarness'
import {
  cancelMediaDownload,
  requestMediaDownload,
  resetMediaDownloadCoordinatorForTests
} from '../../helpers/mediaDownloadCoordinator'
import {
  fakeEncrypted,
  fakeEncryptionInfo,
  installFakeFilesClient,
  readBlobText
} from '../../testUtils/fakeAttachmentFiles'
import { fileTransfer } from '../../fileTransfer/sceytChatUIKitFileTransfer'
import { DefaultFileTransferTransport } from '../../fileTransfer/defaults/defaultFileTransferTransport'
import {
  AttachmentTransferContext,
  FileDownloadRequest,
  FileTransferCallback,
  FileTransferResult
} from '../../fileTransfer/types'

type DownloadMock = jest.Mock<Promise<FileTransferResult<Blob>>, [FileDownloadRequest, FileTransferCallback]>

// A download that stays open until the test settles it.
const openDownload = (): DownloadMock => jest.fn(() => new Promise<FileTransferResult<Blob>>(() => undefined))

// Sets a custom transport (fileTransfer.transport) whose downloads are `download`.
const setCustomTransport = (download: DownloadMock = openDownload()) => {
  const transport = { upload: jest.fn(), download, cancel: jest.fn() }
  fileTransfer.transport = transport
  return transport
}

// The built-in transport (the chat client over the test's fetch), recording what it is asked for.
const setRecordingDefaultTransport = () => {
  const builtIn = new DefaultFileTransferTransport()
  return setCustomTransport(jest.fn((request, callback) => builtIn.download(request, callback)))
}

// What a transport was asked for, as plain values: the attachment
// holds a File, and a failing diff of a File runs the test worker out of memory.
const asked = ([request]: [FileDownloadRequest, ...any[]]) => [
  (request.context as AttachmentTransferContext | undefined)?.attachment?.messageId,
  request.url
]
const askedFor = (url: string) => ['message-id', url]
let mockCompressAndCacheImage: ((...args: any[]) => Promise<any>) | undefined

jest.mock('../../helpers/getVideoFrame', () => {
  const actual = jest.requireActual('../../helpers/getVideoFrame')
  return {
    ...actual,
    compressAndCacheImage: (...args: any[]) =>
      mockCompressAndCacheImage ? mockCompressAndCacheImage(...args) : actual.compressAndCacheImage(...args)
  }
})

jest.mock('../../hooks', () => {
  const { THEME_COLORS } = require('../../UIHelper/constants')

  return {
    useDidUpdate: () => undefined,
    useColor: () => ({
      [THEME_COLORS.ACCENT]: '#00aa88',
      [THEME_COLORS.TEXT_PRIMARY]: '#111111',
      [THEME_COLORS.TEXT_SECONDARY]: '#666666',
      [THEME_COLORS.ICON_PRIMARY]: '#222222',
      [THEME_COLORS.WARNING]: '#cc0000',
      [THEME_COLORS.OVERLAY_BACKGROUND_2]: '#333333',
      [THEME_COLORS.TEXT_ON_PRIMARY]: '#ffffff',
      [THEME_COLORS.ICON_INACTIVE]: '#999999',
      [THEME_COLORS.BORDER]: '#dddddd',
      [THEME_COLORS.BACKGROUND]: '#ffffff',
      [THEME_COLORS.INCOMING_MESSAGE_BACKGROUND]: '#f1f1f1',
      [THEME_COLORS.OUTGOING_MESSAGE_BACKGROUND]: '#dcf8c6'
    })
  }
})

jest.mock('../../UIHelper', () => ({
  AttachmentIconCont: ({ children }: any) => <div>{children}</div>,
  UploadProgress: ({ children }: any) => <div data-testid='video-download-progress'>{children}</div>,
  UploadPercent: ({ children }: any) => <div>{children}</div>,
  CancelResumeWrapper: ({ children, onClick, ...props }: any) => (
    <button type='button' onClick={onClick} {...props}>
      {children}
    </button>
  )
}))

jest.mock('react-circular-progressbar', () => ({
  CircularProgressbar: ({ value }: { value: number }) => <div data-testid='circular-progress' data-value={value} />
}))

jest.mock('../VideoPreview', () => ({
  __esModule: true,
  default: ({ src }: { src?: string }) => <div data-testid='video-preview' data-src={src || ''} />
}))

jest.mock('../AudioPlayer', () => ({
  __esModule: true,
  default: () => null
}))

jest.mock('../../common/popups/viewOnceMedia/ViewOnceVoiceModal', () => ({
  __esModule: true,
  default: () => null
}))

jest.mock('../../helpers/attachmentsCache', () => ({
  getAttachmentUrlFromCache: jest.fn(),
  getAttachmentURLWithVersion: (url: string) => `${url}_1_0_2`,
  setAttachmentToCache: jest.fn()
}))

const mockSaveAs = jest.fn()
jest.mock('file-saver', () => ({
  __esModule: true,
  default: { saveAs: (...args: any[]) => mockSaveAs(...args) }
}))

jest.mock('../../helpers/videoConversion', () => ({
  ensurePlayableVideoBlob: async (blob: Blob) => blob
}))

const mockGetAttachmentUrlFromCache = getAttachmentUrlFromCache as jest.Mock
const mockSetAttachmentToCache = setAttachmentToCache as jest.Mock

const videoAttachment = {
  id: 'video-attachment-id',
  tid: 'video-attachment-tid',
  messageId: 'message-id',
  name: 'video.mp4',
  type: attachmentTypes.video,
  metadata: JSON.stringify({ szw: 1280, szh: 720, dur: 17, video_thumb: 'https://cdn/video-thumb.jpg' }),
  url: 'https://cdn/video.mp4',
  size: 8,
  createdAt: new Date(),
  progress: 0,
  completion: 0,
  upload: true,
  attachmentUrl: '',
  data: new Blob(['video'], { type: 'video/mp4' })
}

const renderAttachment = (messageState: Record<string, any> = {}, attachmentProps: Record<string, any> = {}) =>
  renderWithSceytProvider(
    <Attachment
      attachment={videoAttachment as any}
      backgroundColor='#ffffff'
      videoAttachmentMaxWidth={420}
      {...attachmentProps}
    />,
    {
      store: createMessageListStore({
        UserReducer: { connectionStatus: CONNECTION_STATUS.CONNECTED },
        MessageReducer: messageState
      })
    }
  )

const renderMediaAttachment = (attachment: any, messageState: Record<string, any> = {}) =>
  renderWithSceytProvider(
    <Attachment attachment={attachment} backgroundColor='#ffffff' imageAttachmentMaxWidth={420} />,
    {
      store: createMessageListStore({
        UserReducer: { connectionStatus: CONNECTION_STATUS.CONNECTED },
        MessageReducer: messageState
      })
    }
  )

// Every test starts with the built-in transport.
afterEach(() => {
  fileTransfer.configure()
})

const flushAttachmentEffects = async () => {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('video attachment preview and download states', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.clearAllMocks()
    resetMediaDownloadCoordinatorForTests()
    mockSetAttachmentToCache.mockResolvedValue(undefined)
    // The built-in transport downloads with the SDK (client.download), over the test's fetch.
    installFakeFilesClient()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('shows progress for a missing original video even when its thumbnail is already cached', async () => {
    mockGetAttachmentUrlFromCache.mockResolvedValueOnce('blob:cached-thumb').mockResolvedValueOnce(false)
    global.fetch = jest.fn(() => new Promise(() => undefined)) as any

    renderAttachment()
    await flushAttachmentEffects()

    expect(screen.getByTestId('video-download-progress')).toBeInTheDocument()

    expect(mockGetAttachmentUrlFromCache).toHaveBeenNthCalledWith(1, 'https://cdn/video-thumb.jpg')
    expect(mockGetAttachmentUrlFromCache).toHaveBeenNthCalledWith(2, 'https://cdn/video.mp4_original_video_url')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://cdn/video.mp4',
      expect.objectContaining({ signal: expect.anything() })
    )
  })

  it('does not show the full-video progress UI or fetch the video when the original is cached', async () => {
    mockGetAttachmentUrlFromCache.mockResolvedValueOnce(false).mockResolvedValueOnce('blob:cached-video')
    global.fetch = jest.fn()

    renderAttachment()
    await flushAttachmentEffects()

    expect(mockGetAttachmentUrlFromCache).toHaveBeenCalledTimes(2)

    expect(mockGetAttachmentUrlFromCache).toHaveBeenNthCalledWith(1, 'https://cdn/video-thumb.jpg')
    expect(mockGetAttachmentUrlFromCache).toHaveBeenNthCalledWith(2, 'https://cdn/video.mp4_original_video_url')
    expect(screen.queryByTestId('video-download-progress')).not.toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('does not prefetch a full original for a media-grid video', async () => {
    mockGetAttachmentUrlFromCache.mockResolvedValueOnce('blob:cached-thumb')
    global.fetch = jest.fn(() => new Promise(() => undefined)) as any

    renderAttachment({}, { isDetailsView: true })
    await flushAttachmentEffects()

    expect(screen.queryByTestId('video-download-progress')).not.toBeInTheDocument()
    expect(mockGetAttachmentUrlFromCache).toHaveBeenCalledTimes(1)
    expect(mockGetAttachmentUrlFromCache).toHaveBeenCalledWith('https://cdn/video-thumb.jpg')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('shows the retry control and restarts a cancelled media-grid video download', async () => {
    mockGetAttachmentUrlFromCache.mockResolvedValue(false)
    global.fetch = jest.fn(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            const error = new Error('cancelled')
            error.name = 'AbortError'
            reject(error)
          })
        })
    ) as any
    const resourceKey = 'original-video:https://cdn/video.mp4'
    const first = requestMediaDownload({
      key: resourceKey,
      attachment: videoAttachment as any,
      url: videoAttachment.url,
      cacheKey: `${videoAttachment.url}_original_video_url`,
      kind: 'original-video'
    })
    await flushAttachmentEffects()
    cancelMediaDownload(resourceKey)
    await expect(first).rejects.toMatchObject({ name: 'AbortError' })

    renderAttachment({}, { isDetailsView: true })
    await flushAttachmentEffects()

    // The cancelled shared state renders a Download control, not a stale
    // progress ring. Its click increments the explicit Media-tab retry.
    expect(screen.getByLabelText('Download video')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Download video'))
    expect(screen.getByTestId('video-download-progress')).toBeInTheDocument()
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    })

    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('video-download-progress')).toBeInTheDocument()
  })

  it('joins the chat-thread and media-grid views to one original-video download', async () => {
    mockGetAttachmentUrlFromCache.mockResolvedValue(false)
    global.fetch = jest.fn(() => new Promise(() => undefined)) as any

    renderWithSceytProvider(
      <React.Fragment>
        <Attachment attachment={videoAttachment as any} backgroundColor='#ffffff' videoAttachmentMaxWidth={420} />
        <Attachment
          attachment={videoAttachment as any}
          backgroundColor='#ffffff'
          videoAttachmentMaxWidth={420}
          isDetailsView
        />
      </React.Fragment>,
      {
        store: createMessageListStore({
          UserReducer: { connectionStatus: CONNECTION_STATUS.CONNECTED }
        })
      }
    )
    await flushAttachmentEffects()

    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(screen.getAllByTestId('video-download-progress')).toHaveLength(2)
  })

  it.each([
    ['message list', 0, 1],
    ['Media tab', 1, 0]
  ])(
    'synchronizes video cancellation from the %s to every matching attachment',
    async (_source, cancelIndex, retryIndex) => {
      mockGetAttachmentUrlFromCache.mockResolvedValue(false)
      global.fetch = jest.fn(
        (_url, options) =>
          new Promise((_resolve, reject) => {
            options.signal.addEventListener('abort', () => {
              const error = new Error('cancelled')
              error.name = 'AbortError'
              reject(error)
            })
          })
      ) as any

      renderWithSceytProvider(
        <React.Fragment>
          <Attachment attachment={videoAttachment as any} backgroundColor='#ffffff' videoAttachmentMaxWidth={420} />
          <Attachment
            attachment={videoAttachment as any}
            backgroundColor='#ffffff'
            videoAttachmentMaxWidth={420}
            isDetailsView
          />
        </React.Fragment>,
        {
          store: createMessageListStore({
            UserReducer: { connectionStatus: CONNECTION_STATUS.CONNECTED }
          })
        }
      )
      await flushAttachmentEffects()

      fireEvent.click(screen.getAllByLabelText('Cancel video download')[cancelIndex])
      expect(screen.getAllByLabelText('Download video')).toHaveLength(2)

      fireEvent.click(screen.getAllByLabelText('Download video')[retryIndex])
      expect(screen.getAllByLabelText('Cancel video download')).toHaveLength(2)
      expect(screen.getAllByTestId('video-download-progress')).toHaveLength(2)
    }
  )

  it('keeps chat and Media-tab progress synchronized across repeated video cancel/retry cycles', async () => {
    mockGetAttachmentUrlFromCache.mockResolvedValue(false)
    global.fetch = jest.fn(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            const error = new Error('cancelled')
            error.name = 'AbortError'
            reject(error)
          })
        })
    ) as any

    renderWithSceytProvider(
      <React.Fragment>
        <Attachment attachment={videoAttachment as any} backgroundColor='#ffffff' videoAttachmentMaxWidth={420} />
        <Attachment
          attachment={videoAttachment as any}
          backgroundColor='#ffffff'
          videoAttachmentMaxWidth={420}
          isDetailsView
        />
      </React.Fragment>,
      {
        store: createMessageListStore({
          UserReducer: { connectionStatus: CONNECTION_STATUS.CONNECTED }
        })
      }
    )
    await flushAttachmentEffects()

    for (let cycle = 0; cycle < 2; cycle += 1) {
      fireEvent.click(screen.getAllByLabelText('Cancel video download')[0])
      expect(screen.getAllByLabelText('Download video')).toHaveLength(2)

      fireEvent.click(screen.getAllByLabelText('Download video')[0])
      expect(screen.getAllByLabelText('Cancel video download')).toHaveLength(2)
      expect(screen.getAllByTestId('video-download-progress')).toHaveLength(2)
      await act(async () => {
        await Promise.resolve()
      })
    }
  })

  it('does not automatically restart a cancelled retry without another Download tap', async () => {
    mockGetAttachmentUrlFromCache.mockResolvedValue(false)
    global.fetch = jest.fn(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            const error = new Error('cancelled')
            error.name = 'AbortError'
            reject(error)
          })
        })
    ) as any

    renderWithSceytProvider(
      <React.Fragment>
        <Attachment attachment={videoAttachment as any} backgroundColor='#ffffff' videoAttachmentMaxWidth={420} />
        <Attachment
          attachment={videoAttachment as any}
          backgroundColor='#ffffff'
          videoAttachmentMaxWidth={420}
          isDetailsView
        />
      </React.Fragment>,
      {
        store: createMessageListStore({
          UserReducer: { connectionStatus: CONNECTION_STATUS.CONNECTED }
        })
      }
    )
    await flushAttachmentEffects()

    fireEvent.click(screen.getAllByLabelText('Cancel video download')[0])
    await flushAttachmentEffects()
    fireEvent.click(screen.getAllByLabelText('Download video')[0])
    await flushAttachmentEffects()
    expect(global.fetch).toHaveBeenCalledTimes(2)

    fireEvent.click(screen.getAllByLabelText('Cancel video download')[0])
    await flushAttachmentEffects()

    expect(screen.getAllByLabelText('Download video')).toHaveLength(2)
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('keeps both views in progress on every retry when a custom transport reports generic cancellation errors', async () => {
    mockGetAttachmentUrlFromCache.mockResolvedValue(false)
    // A stopped request ends as an ordinary failure, not an AbortError.
    const download: DownloadMock = jest.fn(
      (request: FileDownloadRequest) =>
        new Promise<FileTransferResult<Blob>>((resolve) => {
          request.signal.addEventListener('abort', () =>
            resolve(FileTransferResult.failure(new Error('DOWNLOAD_CANCELLED')))
          )
        })
    )
    const { cancel } = setCustomTransport(download)

    renderWithSceytProvider(
      <React.Fragment>
        <Attachment attachment={videoAttachment as any} backgroundColor='#ffffff' videoAttachmentMaxWidth={420} />
        <Attachment
          attachment={videoAttachment as any}
          backgroundColor='#ffffff'
          videoAttachmentMaxWidth={420}
          isDetailsView
        />
      </React.Fragment>,
      {
        store: createMessageListStore({
          UserReducer: { connectionStatus: CONNECTION_STATUS.CONNECTED }
        })
      }
    )
    await flushAttachmentEffects()

    for (let cycle = 0; cycle < 2; cycle += 1) {
      fireEvent.click(screen.getAllByLabelText('Cancel video download')[0])
      expect(screen.getAllByLabelText('Download video')).toHaveLength(2)

      fireEvent.click(screen.getAllByLabelText('Download video')[0])
      expect(screen.getAllByLabelText('Cancel video download')).toHaveLength(2)
      expect(screen.getAllByTestId('video-download-progress')).toHaveLength(2)
      await flushAttachmentEffects()
    }

    expect(download).toHaveBeenCalledTimes(3)
    expect(cancel).toHaveBeenCalledTimes(2)
    expect(cancel).toHaveBeenCalledWith('download:original-video:https://cdn/video.mp4')
  })

  it('does not download a default-uploaded video when its sender source is already registered', async () => {
    global.fetch = jest.fn()

    renderAttachment({
      attachmentUpdatedMap: {
        'https://cdn/video.mp4_original_video_url_1_0_2': 'blob:sender-video-source'
      }
    })
    await flushAttachmentEffects()

    // This is populated by the default SDK upload-completion callback before
    // the confirmation message renders. It must win over cache probing.
    expect(mockGetAttachmentUrlFromCache).not.toHaveBeenCalled()
    expect(screen.queryByTestId('video-download-progress')).not.toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('starts the original-video download after a thumbnail cache miss, without fetching the thumbnail as video data', async () => {
    mockGetAttachmentUrlFromCache.mockResolvedValueOnce(false).mockResolvedValueOnce(false)
    global.fetch = jest.fn(() => new Promise(() => undefined)) as any

    renderAttachment()
    await flushAttachmentEffects()

    expect(screen.getByTestId('video-download-progress')).toBeInTheDocument()

    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(global.fetch).toHaveBeenCalledWith(
      'https://cdn/video.mp4',
      expect.objectContaining({ signal: expect.anything() })
    )
    expect(global.fetch).not.toHaveBeenCalledWith('https://cdn/video-thumb.jpg')
  })

  it('starts the original-video download when legacy metadata provides only an inline tmb preview', async () => {
    const inlineThumbnailVideo = {
      ...videoAttachment,
      id: 'inline-thumbnail-video-id',
      url: 'https://cdn/inline-thumbnail-video.mp4',
      metadata: JSON.stringify({ szw: 1080, szh: 1920, dur: 46, tmb: 'inline-video-thumbnail' })
    }
    mockGetAttachmentUrlFromCache.mockResolvedValueOnce(false)
    global.fetch = jest.fn(() => new Promise(() => undefined)) as any

    renderAttachment({}, { attachment: inlineThumbnailVideo })
    await flushAttachmentEffects()

    expect(screen.getByTestId('video-download-progress')).toBeInTheDocument()
    expect(mockGetAttachmentUrlFromCache).toHaveBeenCalledTimes(2)
    expect(mockGetAttachmentUrlFromCache).toHaveBeenCalledWith(
      'https://cdn/inline-thumbnail-video.mp4_original_video_url'
    )
    expect(global.fetch).toHaveBeenCalledWith(
      'https://cdn/inline-thumbnail-video.mp4',
      expect.objectContaining({ signal: expect.anything() })
    )
  })

  it('hydrates the original video after its initiating attachment effect is replaced during download', async () => {
    let resolveDownload: ((blob: Blob) => void) | undefined
    let cachedOriginalVideo: string | false = false
    const originalVideoCacheKey = `${videoAttachment.url}_original_video_url`
    const { download } = setCustomTransport(
      jest.fn(
        () =>
          new Promise<FileTransferResult<Blob>>((resolve) => {
            resolveDownload = (blob) => resolve(FileTransferResult.success(blob))
          })
      )
    )
    mockGetAttachmentUrlFromCache.mockImplementation((cacheKey: string) =>
      Promise.resolve(cacheKey === originalVideoCacheKey ? cachedOriginalVideo : false)
    )
    mockSetAttachmentToCache.mockImplementation(async () => {
      cachedOriginalVideo = 'blob:completed-original-video'
    })

    const store = createMessageListStore({
      UserReducer: { connectionStatus: CONNECTION_STATUS.CONNECTED }
    })
    const { rerender } = renderWithSceytProvider(
      <Attachment
        attachment={videoAttachment as any}
        backgroundColor='#ffffff'
        videoAttachmentMaxWidth={420}
        messageType='initial'
      />,
      { store }
    )
    await flushAttachmentEffects()
    expect(download).toHaveBeenCalledTimes(1)

    // A prop update replaces the effect while its shared request is active.
    // The original callback must not be the only path that publishes the blob.
    rerender(
      <Attachment
        attachment={videoAttachment as any}
        backgroundColor='#ffffff'
        videoAttachmentMaxWidth={420}
        messageType='updated'
      />
    )
    await act(async () => {
      resolveDownload!(new Blob(['video'], { type: 'video/mp4' }))
      await Promise.resolve()
      await Promise.resolve()
    })
    await flushAttachmentEffects()

    expect(screen.getByTestId('video-preview')).toHaveAttribute('data-src', 'blob:completed-original-video')
  })

  it('does not prefetch a media-grid video without preview metadata', async () => {
    const noPreviewVideo = {
      ...videoAttachment,
      id: 'no-preview-video-id',
      url: 'https://cdn/no-preview-video.mp4',
      metadata: JSON.stringify({ szw: 1080, szh: 1920, dur: 46 })
    }
    mockGetAttachmentUrlFromCache.mockResolvedValueOnce(false)
    global.fetch = jest.fn(() => new Promise(() => undefined)) as any

    renderAttachment({}, { attachment: noPreviewVideo, isDetailsView: true })
    await flushAttachmentEffects()

    expect(screen.queryByTestId('video-download-progress')).not.toBeInTheDocument()
    expect(mockGetAttachmentUrlFromCache).not.toHaveBeenCalled()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('converts default SDK progress fractions to the circular-progress percentage', async () => {
    mockGetAttachmentUrlFromCache.mockResolvedValueOnce('blob:cached-thumb').mockResolvedValueOnce('blob:cached-video')
    renderAttachment({
      attachmentsUploadingState: { 'video-attachment-tid': 'uploading' },
      attachmentsUploadingProgress: {
        'video-attachment-tid': { uploaded: 7.4, total: 13.8, progress: 7.4 / 13.8 }
      }
    })

    await flushAttachmentEffects()

    expect(screen.getByTestId('circular-progress')).toHaveAttribute('data-value', expect.stringMatching(/^53\./))
  })

  it('shows the initial video progress ring and cancel control while preparing', async () => {
    mockGetAttachmentUrlFromCache.mockResolvedValue(false)
    renderAttachment({
      attachmentsUploadingState: { 'video-attachment-tid': 'preparing' }
    })

    await flushAttachmentEffects()

    expect(screen.getByTestId('video-download-progress')).toBeInTheDocument()
    expect(screen.getByTestId('circular-progress')).toHaveAttribute('data-value', '3')
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('keeps the inline image thumbnail visible until the full image has loaded', () => {
    const imageAttachment = {
      ...videoAttachment,
      id: 'image-attachment-id',
      tid: 'image-attachment-tid',
      type: attachmentTypes.image,
      url: 'https://cdn/image.jpg',
      attachmentUrl: 'blob:full-image',
      metadata: JSON.stringify({ szw: 1280, szh: 720, tmb: 'a'.repeat(80) })
    }

    const { container } = renderMediaAttachment(imageAttachment)
    const images = container.querySelectorAll('img')

    expect(images[0]).toHaveAttribute('src', `data:image/jpeg;base64,${'a'.repeat(80)}`)
    expect(images[1]).toHaveAttribute('src', 'blob:full-image')

    fireEvent.load(images[1])

    expect(Array.from(container.querySelectorAll('img')).map((image) => image.getAttribute('src'))).toEqual(
      expect.arrayContaining([`data:image/jpeg;base64,${'a'.repeat(80)}`, 'blob:full-image'])
    )
  })

  it('uses the cached image blob on remount instead of briefly restoring a stale compose blob', () => {
    const imageAttachment = {
      ...videoAttachment,
      id: 'sent-image-attachment-id',
      tid: 'sent-image-attachment-tid',
      type: attachmentTypes.image,
      url: 'https://cdn/sent-image.jpg',
      // This is the short-lived object URL from the compose preview. A
      // confirmed message can still carry it while its cache entry has the
      // long-lived session URL used by every remounted message row.
      attachmentUrl: 'blob:compose-image-url',
      metadata: JSON.stringify({ szw: 1280, szh: 720, tmb: 'a'.repeat(80) })
    }
    const messageState = {
      attachmentUpdatedMap: {
        'https://cdn/sent-image.jpg_1_0_2': 'blob:cached-image-url'
      }
    }

    const first = renderMediaAttachment(imageAttachment, messageState)
    expect(first.container.querySelector('img[src="blob:cached-image-url"]')).toBeInTheDocument()
    expect(first.container.querySelector('img[src="blob:compose-image-url"]')).not.toBeInTheDocument()

    first.unmount()

    const remounted = renderMediaAttachment(imageAttachment, messageState)
    expect(remounted.container.querySelector('img[src="blob:cached-image-url"]')).toBeInTheDocument()
    expect(remounted.container.querySelector('img[src="blob:compose-image-url"]')).not.toBeInTheDocument()
  })

  it('does not open an image in the slider while its original download is in progress', async () => {
    const handleMediaItemClick = jest.fn()
    const imageAttachment = {
      ...videoAttachment,
      id: 'downloading-image-id',
      tid: 'downloading-image-tid',
      type: attachmentTypes.image,
      url: 'https://cdn/downloading-image.jpg',
      attachmentUrl: '',
      metadata: JSON.stringify({ szw: 1280, szh: 720, tmb: 'a'.repeat(80) })
    }
    mockGetAttachmentUrlFromCache.mockResolvedValue(false)
    global.fetch = jest.fn(() => new Promise(() => undefined)) as any

    const { container: clickableContainer } = renderWithSceytProvider(
      <Attachment
        attachment={imageAttachment as any}
        backgroundColor='#ffffff'
        imageAttachmentMaxWidth={420}
        handleMediaItemClick={handleMediaItemClick}
      />,
      {
        store: createMessageListStore({
          UserReducer: { connectionStatus: CONNECTION_STATUS.CONNECTED }
        })
      }
    )
    await flushAttachmentEffects()

    fireEvent.click(clickableContainer.querySelector('img')!)
    expect(handleMediaItemClick).not.toHaveBeenCalled()
  })

  it('shows Download immediately after cancelling an image and retries without opening the slider', async () => {
    const handleMediaItemClick = jest.fn()
    const imageAttachment = {
      ...videoAttachment,
      id: 'cancelled-image-id',
      tid: 'cancelled-image-tid',
      type: attachmentTypes.image,
      url: 'https://cdn/cancelled-image.jpg',
      attachmentUrl: '',
      metadata: JSON.stringify({ szw: 1280, szh: 720, tmb: 'a'.repeat(80) })
    }
    mockGetAttachmentUrlFromCache.mockResolvedValue(false)
    global.fetch = jest.fn(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            const error = new Error('cancelled')
            error.name = 'AbortError'
            reject(error)
          })
        })
    ) as any

    const { container } = renderWithSceytProvider(
      <Attachment
        attachment={imageAttachment as any}
        backgroundColor='#ffffff'
        imageAttachmentMaxWidth={420}
        handleMediaItemClick={handleMediaItemClick}
      />,
      {
        store: createMessageListStore({
          UserReducer: { connectionStatus: CONNECTION_STATUS.CONNECTED }
        })
      }
    )
    await flushAttachmentEffects()

    fireEvent.click(screen.getByLabelText('Cancel image download'))
    expect(screen.getByLabelText('Download image')).toBeInTheDocument()

    fireEvent.click(container.querySelector('img')!)
    expect(handleMediaItemClick).not.toHaveBeenCalled()

    fireEvent.click(screen.getByLabelText('Download image'))
    expect(screen.getByLabelText('Cancel image download')).toBeInTheDocument()
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    })

    expect(global.fetch).toHaveBeenCalledTimes(2)
  })
})

describe('custom transport receives the message ID', () => {
  const imageAttachment = {
    ...videoAttachment,
    id: 'image-attachment-id',
    tid: 'image-attachment-tid',
    type: attachmentTypes.image,
    url: 'https://cdn/image.jpg',
    attachmentUrl: '',
    metadata: JSON.stringify({ szw: 1280, szh: 720, tmb: 'a'.repeat(80) })
  }
  let download: DownloadMock

  beforeEach(() => {
    jest.clearAllMocks()
    resetMediaDownloadCoordinatorForTests()
    mockSetAttachmentToCache.mockResolvedValue(undefined)
    download = setCustomTransport().download
  })

  it('original image', async () => {
    mockGetAttachmentUrlFromCache.mockResolvedValue(false)

    renderMediaAttachment(imageAttachment)
    await flushAttachmentEffects()

    expect(download.mock.calls.map(asked)).toContainEqual(askedFor('https://cdn/image.jpg'))
  })

  it('original video', async () => {
    mockGetAttachmentUrlFromCache.mockResolvedValueOnce('blob:cached-thumb').mockResolvedValueOnce(false)

    renderAttachment()
    await flushAttachmentEffects()

    expect(download.mock.calls.map(asked)).toContainEqual(askedFor('https://cdn/video.mp4'))
  })

  it('voice message', async () => {
    mockGetAttachmentUrlFromCache.mockResolvedValue(false)

    renderMediaAttachment({ ...imageAttachment, type: attachmentTypes.voice, url: 'https://cdn/voice.mp3' })
    await flushAttachmentEffects()

    expect(download.mock.calls.map(asked)).toContainEqual(askedFor('https://cdn/voice.mp3'))
  })

  it('retrying a cancelled image download sends the message ID', async () => {
    mockGetAttachmentUrlFromCache.mockResolvedValue(false)

    renderMediaAttachment(imageAttachment)
    await flushAttachmentEffects()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel image download' }))
    await flushAttachmentEffects()
    fireEvent.click(screen.getByRole('button', { name: 'Download image' }))
    await flushAttachmentEffects()

    expect(download).toHaveBeenCalledTimes(2)
    download.mock.calls.forEach((call) => {
      expect(asked(call)).toEqual(askedFor('https://cdn/image.jpg'))
    })
  })

  it('resuming from the cancel control downloads the file through the transport, never a bare URL', async () => {
    const originalCreateObjectURL = URL.createObjectURL
    URL.createObjectURL = jest.fn(() => 'blob:image')
    // Hold compression open so the retry stays in its restarting state after
    // the bytes arrive; the cancel control then toggles cancel/resume locally.
    mockCompressAndCacheImage = () => new Promise(() => undefined)
    mockGetAttachmentUrlFromCache.mockResolvedValue(false)
    try {
      renderMediaAttachment(imageAttachment)
      await flushAttachmentEffects()
      fireEvent.click(screen.getByRole('button', { name: 'Cancel image download' }))
      await flushAttachmentEffects()
      download.mockResolvedValueOnce(FileTransferResult.success(new Blob(['image'], { type: 'image/jpeg' })))
      fireEvent.click(screen.getByRole('button', { name: 'Download image' }))
      await flushAttachmentEffects()
      await flushAttachmentEffects()
      fireEvent.click(screen.getByRole('button', { name: 'Cancel image download' }))
      await flushAttachmentEffects()
      fireEvent.click(screen.getByRole('button', { name: 'Cancel image download' }))
      await flushAttachmentEffects()

      expect(download).toHaveBeenCalledTimes(3)
      expect(asked(download.mock.calls[2])).toEqual(askedFor('https://cdn/image.jpg'))
    } finally {
      mockCompressAndCacheImage = undefined
      URL.createObjectURL = originalCreateObjectURL
    }
  })

  it('direct download after a failed cache lookup', async () => {
    mockGetAttachmentUrlFromCache.mockRejectedValue(new Error('cache unavailable'))

    renderMediaAttachment(imageAttachment)
    await flushAttachmentEffects()

    expect(download.mock.calls.map(asked)).toContainEqual(askedFor('https://cdn/image.jpg'))
  })
})

describe('a failed download is not shown as downloaded', () => {
  const fileAttachment = {
    ...videoAttachment,
    id: 'file-attachment-id',
    tid: 'file-attachment-tid',
    name: 'report.pdf',
    type: attachmentTypes.file,
    url: 'https://cdn/report.pdf',
    metadata: ''
  }
  const forbidden = () =>
    FileTransferResult.failure<Blob>(Object.assign(new Error('DOWNLOAD_FORBIDDEN'), { status: 403 }))
  const originalFetch = global.fetch
  let transport: ReturnType<typeof setCustomTransport>
  let download: DownloadMock

  beforeEach(() => {
    jest.clearAllMocks()
    resetMediaDownloadCoordinatorForTests()
    mockSetAttachmentToCache.mockResolvedValue(undefined)
    transport = setCustomTransport()
    download = transport.download
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('a failed video download shows the Download control, which retries it', async () => {
    mockGetAttachmentUrlFromCache.mockResolvedValueOnce('blob:cached-thumb').mockResolvedValue(false)
    download.mockResolvedValueOnce(forbidden())

    renderAttachment()
    await flushAttachmentEffects()
    await flushAttachmentEffects()

    fireEvent.click(screen.getByLabelText('Download video'))
    await flushAttachmentEffects()

    expect(download).toHaveBeenCalledTimes(2)
    expect(asked(download.mock.calls[1])).toEqual(askedFor('https://cdn/video.mp4'))
    expect(screen.queryByLabelText('Download video')).not.toBeInTheDocument()
  })

  it('a video that fails to decrypt is not downloaded again when it is shown again, only when the user retries', async () => {
    installFakeFilesClient()
    mockGetAttachmentUrlFromCache.mockImplementation(async (key: string) =>
      key.includes('video-thumb') ? 'blob:cached-thumb' : false
    )
    // The built-in transport decrypts the stored file, encrypted with another key.
    const { download } = setRecordingDefaultTransport()
    global.fetch = jest.fn(async () => ({ ok: true, blob: async () => fakeEncrypted('another-key', 'movie') })) as any
    const encryptedVideo = {
      ...videoAttachment,
      metadata: JSON.stringify({
        ...JSON.parse(videoAttachment.metadata),
        enc: { v: 1, alg: 'tink-aes256-gcm-hkdf-64k+commit-v1', aid: 'id-9', k: 'key-9' }
      })
    }
    const videoDownloads = () =>
      download.mock.calls.filter(([request]) => request.url === 'https://cdn/video.mp4').length

    const first = renderAttachment({}, { attachment: encryptedVideo })
    for (let i = 0; i < 5; i += 1) await flushAttachmentEffects()
    expect(videoDownloads()).toBe(1)
    first.unmount()

    renderAttachment({}, { attachment: encryptedVideo })
    for (let i = 0; i < 5; i += 1) await flushAttachmentEffects()
    expect(videoDownloads()).toBe(1)

    fireEvent.click(screen.getByLabelText('Download video'))
    for (let i = 0; i < 5; i += 1) await flushAttachmentEffects()
    expect(videoDownloads()).toBe(2)
  })

  it('a retry after a failed video download shows its progress', async () => {
    mockGetAttachmentUrlFromCache.mockResolvedValueOnce('blob:cached-thumb').mockResolvedValue(false)
    let reportProgress: (percent: number) => void = () => undefined
    download.mockResolvedValueOnce(forbidden()).mockImplementationOnce((_request, callback) => {
      reportProgress = callback.onProgress
      return new Promise(() => undefined)
    })

    renderAttachment()
    await flushAttachmentEffects()
    await flushAttachmentEffects()
    fireEvent.click(screen.getByLabelText('Download video'))
    await flushAttachmentEffects()
    act(() => reportProgress(50))
    await flushAttachmentEffects()

    expect(screen.getByTestId('video-download-progress')).toBeInTheDocument()
    expect(screen.getByTestId('circular-progress')).toHaveAttribute('data-value', '50')
  })

  it('a failed file download stays visible as failed, and retrying it downloads the file', async () => {
    let finishRetry: (result: FileTransferResult<Blob>) => void = () => undefined
    download.mockResolvedValueOnce(forbidden()).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRetry = resolve
        })
    )

    renderMediaAttachment(fileAttachment)
    await flushAttachmentEffects()
    expect(screen.getByLabelText('Download file')).not.toBeVisible()

    fireEvent.click(screen.getByLabelText('Download file'))
    await flushAttachmentEffects()

    const retry = screen.getByLabelText('Download failed, retry')
    expect(retry).toBeVisible()
    expect(mockSaveAs).not.toHaveBeenCalled()

    fireEvent.click(retry)
    await flushAttachmentEffects()
    // While the retry runs it is an ordinary download again, not a failed one.
    expect(screen.queryByLabelText('Download failed, retry')).not.toBeInTheDocument()

    await act(async () => finishRetry(FileTransferResult.success(new Blob(['pdf']))))
    await flushAttachmentEffects()

    expect(download).toHaveBeenCalledTimes(2)
    expect(mockSaveAs).toHaveBeenCalledWith(expect.any(Blob), 'report.pdf')
    expect(screen.getByLabelText('Download file')).not.toBeVisible()
  })

  it('a file download the user cancels is not shown as failed', async () => {
    const cancelled = Object.assign(new Error('DOWNLOAD_CANCELLED'), { name: 'Error' })
    let settleDownload: (result: FileTransferResult<Blob>) => void = () => undefined
    download.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          settleDownload = resolve
        })
    )
    // The transport ends the cancelled request as an ordinary failure.
    transport.cancel.mockImplementation(() => settleDownload(FileTransferResult.failure(cancelled)))

    renderMediaAttachment(fileAttachment)
    await flushAttachmentEffects()
    fireEvent.click(screen.getByLabelText('Download file'))
    await flushAttachmentEffects()
    fireEvent.click(screen.getByLabelText('Download file'))
    await flushAttachmentEffects()

    expect(transport.cancel).toHaveBeenCalledTimes(1)
    expect(transport.cancel).toHaveBeenCalledWith('download:file-attachment-tid')
    expect(screen.queryByLabelText('Download failed, retry')).not.toBeInTheDocument()
  })
})

describe('a failed video or image download starts again when the chat reconnects', () => {
  const imageAttachment = {
    ...videoAttachment,
    id: 'reconnect-image-id',
    tid: 'reconnect-image-tid',
    type: attachmentTypes.image,
    url: 'https://cdn/reconnect-image.jpg',
    attachmentUrl: '',
    metadata: JSON.stringify({ szw: 1280, szh: 720, tmb: 'a'.repeat(80) })
  }
  const networkError = () => FileTransferResult.interrupted<Blob>(new TypeError('Failed to fetch'))
  let download: DownloadMock

  const reconnect = async (store: any) => {
    act(() => {
      store.dispatch(setConnectionStatusAC(CONNECTION_STATUS.CONNECTING))
    })
    await flushAttachmentEffects()
    act(() => {
      store.dispatch(setConnectionStatusAC(CONNECTION_STATUS.CONNECTED))
    })
    await flushAttachmentEffects()
    await flushAttachmentEffects()
  }

  beforeEach(() => {
    jest.clearAllMocks()
    resetMediaDownloadCoordinatorForTests()
    mockSetAttachmentToCache.mockResolvedValue(undefined)
    download = setCustomTransport().download
  })

  afterEach(() => {
    mockCompressAndCacheImage = undefined
  })

  it('a video download that failed on the network starts again after the reconnect', async () => {
    mockGetAttachmentUrlFromCache.mockResolvedValueOnce('blob:cached-thumb').mockResolvedValue(false)
    download.mockResolvedValueOnce(networkError())

    const { store } = renderAttachment()
    await flushAttachmentEffects()
    await flushAttachmentEffects()
    expect(download).toHaveBeenCalledTimes(1)

    await reconnect(store)

    expect(download).toHaveBeenCalledTimes(2)
    expect(asked(download.mock.calls[1])).toEqual(askedFor('https://cdn/video.mp4'))
    expect(screen.queryByLabelText('Download video')).not.toBeInTheDocument()
  })

  it('an image download that failed on the network starts again after the reconnect', async () => {
    mockGetAttachmentUrlFromCache.mockResolvedValue(false)
    download.mockResolvedValueOnce(networkError())

    const { store } = renderMediaAttachment(imageAttachment)
    await flushAttachmentEffects()
    await flushAttachmentEffects()
    expect(download).toHaveBeenCalledTimes(1)

    await reconnect(store)

    expect(download).toHaveBeenCalledTimes(2)
    expect(download.mock.calls[1][0].url).toBe('https://cdn/reconnect-image.jpg')
  })

  it('without a reconnect a failed download waits for the user, so a rejection is not repeated', async () => {
    mockGetAttachmentUrlFromCache.mockResolvedValueOnce('blob:cached-thumb').mockResolvedValue(false)
    download.mockResolvedValue(
      FileTransferResult.failure(Object.assign(new Error('DOWNLOAD_FORBIDDEN'), { status: 403 }))
    )

    const { store } = renderAttachment()
    await flushAttachmentEffects()
    await flushAttachmentEffects()
    // Another status change that is not a reconnect.
    act(() => {
      store.dispatch(setConnectionStatusAC(CONNECTION_STATUS.CONNECTED))
    })
    for (let i = 0; i < 5; i += 1) await flushAttachmentEffects()

    expect(download).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Download video')).toBeInTheDocument()
  })

  it('a reconnect does not restart a download the user cancelled, or one still running', async () => {
    mockGetAttachmentUrlFromCache.mockResolvedValueOnce('blob:cached-thumb').mockResolvedValue(false)

    const { store } = renderAttachment()
    await flushAttachmentEffects()
    await flushAttachmentEffects()
    await reconnect(store)
    expect(download).toHaveBeenCalledTimes(1)

    cancelMediaDownload('original-video:https://cdn/video.mp4')
    await flushAttachmentEffects()
    await reconnect(store)

    expect(download).toHaveBeenCalledTimes(1)
  })
})

describe('the upload stop and resume control', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetMediaDownloadCoordinatorForTests()
    mockGetAttachmentUrlFromCache.mockResolvedValue(false)
  })

  afterEach(async () => {
    // Let the render's cache lookups settle, then drop the download they started.
    await flushAttachmentEffects()
    resetMediaDownloadCoordinatorForTests()
  })

  it('the stop control shown while a video is prepared pauses it, not resumes it', async () => {
    const { store } = renderAttachment({
      attachmentsUploadingState: { 'video-attachment-tid': 'preparing' }
    })
    const dispatch = jest.spyOn(store, 'dispatch')
    await flushAttachmentEffects()

    fireEvent.click(screen.getByRole('button', { name: 'Stop upload' }))

    expect(dispatch).toHaveBeenCalledWith(pauseAttachmentUploadingAC('video-attachment-tid'))
  })

  describe('the upload progress of a video sent again (after a lost connection)', () => {
    // The first render, before any effect runs: what the message shows the moment it is drawn.
    const firstRender = (messageState: Record<string, any>) =>
      renderToString(
        <Provider
          context={SceytReduxContext}
          store={createMessageListStore({
            UserReducer: { connectionStatus: CONNECTION_STATUS.CONNECTED },
            MessageReducer: messageState
          })}
        >
          <Attachment attachment={videoAttachment as any} backgroundColor='#ffffff' videoAttachmentMaxWidth={420} />
        </Provider>
      )
    const stored = { 'video-attachment-tid': { uploaded: 4_000_000, total: 10_000_000, progress: 0.4 } }

    it('shows what was uploaded, not 0, when the message is drawn again', () => {
      const html = firstRender({
        attachmentsUploadingState: { 'video-attachment-tid': 'uploading' },
        attachmentsUploadingProgress: stored
      })

      expect(html).toContain('4 MB')
      expect(html).not.toContain('0 Bytes')
    })

    it('shows what was uploaded, not 0, while the video is prepared again', () => {
      const html = firstRender({
        attachmentsUploadingState: { 'video-attachment-tid': 'preparing' },
        attachmentsUploadingProgress: stored
      })

      expect(html).toContain('4 MB')
      expect(html).not.toContain('0 Bytes')
    })

    it('a video prepared for the first time shows no progress yet', () => {
      const html = firstRender({ attachmentsUploadingState: { 'video-attachment-tid': 'preparing' } })

      expect(html).toContain('0 Bytes')
    })
  })

  it('the upload control is named after what a click does', async () => {
    const uploading = renderAttachment({ attachmentsUploadingState: { 'video-attachment-tid': 'uploading' } })
    await flushAttachmentEffects()
    expect(screen.getByRole('button', { name: 'Stop upload' })).toBeTruthy()
    uploading.unmount()

    renderAttachment({ attachmentsUploadingState: { 'video-attachment-tid': 'paused' } })
    await flushAttachmentEffects()
    expect(screen.getByRole('button', { name: 'Resume upload' })).toBeTruthy()
  })

  it('shows an encrypted video only after decrypting it with the key in its metadata', async () => {
    installFakeFilesClient()
    mockGetAttachmentUrlFromCache.mockResolvedValue(false)
    // The built-in transport downloads the stored (encrypted) file and decrypts it.
    const { download } = setRecordingDefaultTransport()
    const originalFetch = global.fetch
    global.fetch = jest.fn(async () => ({ ok: true, blob: async () => fakeEncrypted('key-9', 'movie') })) as any
    const shown: Blob[] = []
    const originalCreateObjectURL = URL.createObjectURL
    URL.createObjectURL = jest.fn((blob: Blob) => {
      shown.push(blob)
      return 'blob:decrypted-video'
    })
    const encryptedVideo = {
      ...videoAttachment,
      // The size in the message: the decrypted file must have it.
      size: 'movie'.length,
      metadata: JSON.stringify({
        ...JSON.parse(videoAttachment.metadata),
        enc: { v: 1, alg: 'tink-aes256-gcm-hkdf-64k+commit-v1', aid: 'id-9', k: 'key-9' }
      })
    }
    try {
      renderAttachment({}, { attachment: encryptedVideo })
      for (let i = 0; i < 10 && !shown.length; i++) {
        await flushAttachmentEffects()
      }

      const videoRequest = download.mock.calls.find(([request]) => request.url === 'https://cdn/video.mp4')
      expect(videoRequest && asked(videoRequest)).toEqual(askedFor('https://cdn/video.mp4'))
      // The key and attachment id in the video's metadata, and its trusted size.
      expect(videoRequest![0].encryptionInfo).toEqual(fakeEncryptionInfo('key-9'))
      expect(videoRequest![0].plaintextSize).toBe('movie'.length)
      expect(shown).toHaveLength(1)
      expect(shown[0].type).toBe('video/mp4')
      expect(await readBlobText(shown[0])).toBe('movie')
    } finally {
      URL.createObjectURL = originalCreateObjectURL
      global.fetch = originalFetch
    }
  })
})
