import React from 'react'
import { act, fireEvent, screen } from '@testing-library/react'
import Attachment from './index'
import { attachmentTypes } from '../../helpers/constants'
import { getAttachmentUrlFromCache, setAttachmentToCache } from '../../helpers/attachmentsCache'
import { CONNECTION_STATUS } from '../../store/user/constants'
import { createMessageListStore, renderWithSceytProvider } from '../../testUtils/messageListHarness'

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
  CancelResumeWrapper: ({ children }: any) => <button type='button'>{children}</button>
}))

jest.mock('react-circular-progressbar', () => ({
  CircularProgressbar: ({ value }: { value: number }) => <div data-testid='circular-progress' data-value={value} />
}))

jest.mock('../VideoPreview', () => ({
  __esModule: true,
  default: () => <div data-testid='video-preview' />
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

jest.mock('../../helpers/customUploader', () => ({
  getCustomDownloader: () => undefined,
  getCustomUploader: () => undefined
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

const renderAttachment = (messageState: Record<string, any> = {}) =>
  renderWithSceytProvider(
    <Attachment attachment={videoAttachment as any} backgroundColor='#ffffff' videoAttachmentMaxWidth={420} />,
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
    mockSetAttachmentToCache.mockResolvedValue(undefined)
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
    expect(global.fetch).toHaveBeenCalledWith('https://cdn/video.mp4')
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
    expect(global.fetch).toHaveBeenCalledWith('https://cdn/video.mp4')
    expect(global.fetch).not.toHaveBeenCalledWith('https://cdn/video-thumb.jpg')
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
})
