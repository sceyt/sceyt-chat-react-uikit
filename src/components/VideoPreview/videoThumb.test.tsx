import React from 'react'
import { act, fireEvent } from '@testing-library/react'
import VideoPreview from './index'
import { attachmentTypes } from '../../helpers/constants'
import { getVideoFirstFrame } from '../../helpers/getVideoFrame'
import { downloadVideoThumb } from '../../helpers/videoPreview'
import { getAttachmentUrlFromCache } from '../../helpers/attachmentsCache'
import { createMessageListStore, renderWithSceytProvider } from '../../testUtils/messageListHarness'
import { fileTransfer } from '../../fileTransfer/sceytChatUIKitFileTransfer'
import { FileTransferResult, FileTransferProvider } from '../../types/fileTransfer/types'

jest.mock('../../hooks', () => {
  const { THEME_COLORS } = require('../../UIHelper/constants')

  return {
    useColor: () => ({
      [THEME_COLORS.BORDER]: '#dddddd',
      [THEME_COLORS.OVERLAY_BACKGROUND_2]: '#333333',
      [THEME_COLORS.TEXT_ON_PRIMARY]: '#ffffff'
    })
  }
})

jest.mock('../../helpers/getVideoFrame', () => ({
  getVideoFirstFrame: jest.fn()
}))

jest.mock('../../helpers/attachmentsCache', () => {
  const actual = jest.requireActual('../../helpers/attachmentsCache')
  return {
    ...actual,
    getAttachmentUrlFromCache: jest.fn().mockResolvedValue(false),
    setAttachmentToCache: jest.fn()
  }
})

jest.mock('../../helpers/videoPreview', () => {
  const actual = jest.requireActual('../../helpers/videoPreview')
  return {
    ...actual,
    downloadVideoThumb: jest.fn()
  }
})

const mockGetVideoFirstFrame = getVideoFirstFrame as jest.Mock
const mockGetAttachmentUrlFromCache = getAttachmentUrlFromCache as jest.Mock
const mockDownloadVideoThumb = downloadVideoThumb as jest.Mock

const flushPreviewEffects = async () => {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('VideoPreview pvw rendering', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('shows the downloaded pvw immediately and never extracts a frame from the original video', async () => {
    mockDownloadVideoThumb.mockResolvedValue('blob:downloaded-video-thumb')
    const file = {
      id: 'video-id',
      tid: 'video-tid',
      messageId: 'message-id',
      name: 'video.mp4',
      type: attachmentTypes.video,
      url: 'https://cdn/video.mp4',
      metadata: JSON.stringify({ szw: 1280, szh: 720, dur: 17, pvw: 'https://cdn/video-thumb.jpg' }),
      attachmentUrl: '',
      size: 100,
      createdAt: new Date(),
      progress: 0,
      completion: 0,
      upload: true,
      data: new Blob(['video'], { type: 'video/mp4' })
    }

    const { container } = renderWithSceytProvider(
      <VideoPreview
        width='420px'
        height='240px'
        file={file as any}
        src='https://cdn/video.mp4'
        backgroundColor='#ffffff'
        downloading={false}
      />,
      { store: createMessageListStore() }
    )

    await flushPreviewEffects()

    // The video attachment: its message id, and its metadata, which holds the preview's key when it is encrypted.
    expect(mockDownloadVideoThumb).toHaveBeenCalledWith(
      'https://cdn/video-thumb.jpg',
      expect.objectContaining({
        messageId: 'message-id',
        metadata: expect.stringContaining('"pvw":"https://cdn/video-thumb.jpg"')
      }),
      undefined
    )
    expect(mockGetVideoFirstFrame).not.toHaveBeenCalled()
    const pendingPreview = Array.from(container.querySelectorAll('img')).find(
      (image) => image.getAttribute('src') === 'blob:downloaded-video-thumb'
    )
    expect(pendingPreview).toBeDefined()
    fireEvent.load(pendingPreview!)
    expect(container.querySelector('img')).toHaveAttribute('src', 'blob:downloaded-video-thumb')
  })

  it('cross-fades from the inline thumbnail to pvw only after the remote preview has loaded', async () => {
    let resolvePreview: ((value: string) => void) | undefined
    mockDownloadVideoThumb.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolvePreview = resolve
        })
    )
    const file = {
      id: 'video-cross-fade-id',
      tid: 'video-cross-fade-tid',
      messageId: 'message-id',
      name: 'video.mp4',
      type: attachmentTypes.video,
      url: 'https://cdn/cross-fade-video.mp4',
      metadata: JSON.stringify({
        szw: 1280,
        szh: 720,
        dur: 17,
        tmb: 'a'.repeat(80),
        pvw: 'https://cdn/cross-fade-video-thumb.jpg'
      }),
      attachmentUrl: '',
      size: 100,
      createdAt: new Date(),
      progress: 0,
      completion: 0,
      upload: true,
      data: new Blob(['video'], { type: 'video/mp4' })
    }

    const { container } = renderWithSceytProvider(
      <VideoPreview
        width='420px'
        height='240px'
        file={file as any}
        src='https://cdn/cross-fade-video.mp4'
        backgroundColor='#ffffff'
        downloading={false}
      />,
      { store: createMessageListStore() }
    )

    expect(container.querySelector('img')).toHaveAttribute('src', `data:image/jpeg;base64,${'a'.repeat(80)}`)

    await act(async () => {
      resolvePreview!('blob:cross-fade-video-thumb')
      await Promise.resolve()
    })

    const pendingPreview = Array.from(container.querySelectorAll('img')).find(
      (image) => image.getAttribute('src') === 'blob:cross-fade-video-thumb'
    )
    expect(pendingPreview).toBeDefined()
    expect(container.querySelector('img')).toHaveAttribute('src', `data:image/jpeg;base64,${'a'.repeat(80)}`)

    fireEvent.load(pendingPreview!)

    expect(Array.from(container.querySelectorAll('img')).map((image) => image.getAttribute('src'))).toEqual(
      expect.arrayContaining([`data:image/jpeg;base64,${'a'.repeat(80)}`, 'blob:cross-fade-video-thumb'])
    )
  })

  it('replaces the inline thumbnail with the video first frame when pvw download fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    mockDownloadVideoThumb.mockRejectedValue(new Error('preview unavailable'))
    mockGetVideoFirstFrame.mockResolvedValue({
      frameBlobUrl: 'blob:preview-failure-first-frame',
      blob: new Blob(['frame'], { type: 'image/jpeg' })
    })
    const file = {
      id: 'video-preview-failure-id',
      tid: 'video-preview-failure-tid',
      messageId: 'message-id',
      name: 'video.mp4',
      type: attachmentTypes.video,
      url: 'https://cdn/preview-failure-video.mp4',
      metadata: JSON.stringify({
        szw: 1280,
        szh: 720,
        dur: 17,
        tmb: 'b'.repeat(80),
        pvw: 'https://cdn/preview-failure-thumb.jpg'
      }),
      attachmentUrl: '',
      size: 100,
      createdAt: new Date(),
      progress: 0,
      completion: 0,
      upload: true,
      data: new Blob(['video'], { type: 'video/mp4' })
    }

    const { container } = renderWithSceytProvider(
      <VideoPreview
        width='420px'
        height='240px'
        file={file as any}
        src='blob:decrypted-preview-failure-video'
        backgroundColor='#ffffff'
        downloading={false}
      />,
      { store: createMessageListStore() }
    )

    await flushPreviewEffects()

    expect(container.querySelector('img')).toHaveAttribute('src', `data:image/jpeg;base64,${'b'.repeat(80)}`)
    expect(mockGetVideoFirstFrame).toHaveBeenCalledWith(
      'blob:decrypted-preview-failure-video',
      expect.any(Number),
      expect.any(Number)
    )
    const frame = container.querySelector('img[src="blob:preview-failure-first-frame"]')
    expect(frame).toBeInTheDocument()
    fireEvent.load(frame!)
    act(() => {
      jest.advanceTimersByTime(180)
    })
    expect(container.querySelector('img')).toHaveAttribute('src', 'blob:preview-failure-first-frame')
    expect(container.querySelector('img')).toBeVisible()
    errorSpy.mockRestore()
  })

  it.each(['download', 'image decode', 'displayed image'])(
    'uses the downloaded video first frame after a preview %s failure',
    async (failure) => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
      mockDownloadVideoThumb.mockImplementation(() =>
        failure === 'download'
          ? Promise.reject(new Error('preview unavailable'))
          : Promise.resolve('blob:invalid-preview')
      )
      mockGetVideoFirstFrame.mockResolvedValue({
        frameBlobUrl: `blob:fallback-frame-${failure}`,
        blob: new Blob(['frame'], { type: 'image/jpeg' })
      })
      const file = {
        id: `fallback-${failure}`,
        messageId: 'message-id',
        name: 'video.mp4',
        type: attachmentTypes.video,
        url: `https://cdn/fallback-${failure}.mp4`,
        metadata: JSON.stringify({ pvw: `https://cdn/fallback-${failure}.jpg` }),
        size: 100,
        createdAt: new Date()
      }
      const renderPreview = (src: string) => (
        <VideoPreview width='420px' height='240px' file={file} src={src} backgroundColor='#ffffff' downloading={!src} />
      )
      const { container, rerender } = renderWithSceytProvider(renderPreview(''), { store: createMessageListStore() })
      await flushPreviewEffects()
      if (failure !== 'download') {
        if (failure === 'displayed image') {
          fireEvent.load(container.querySelector('img[src="blob:invalid-preview"]')!)
        }
        fireEvent.error(container.querySelector('img[src="blob:invalid-preview"]')!)
        await flushPreviewEffects()
      }
      expect(mockGetVideoFirstFrame).not.toHaveBeenCalled()

      rerender(renderPreview('blob:decrypted-fallback-video'))
      await flushPreviewEffects()
      expect(mockGetVideoFirstFrame).toHaveBeenCalledTimes(1)
      expect(mockGetVideoFirstFrame).toHaveBeenCalledWith(
        'blob:decrypted-fallback-video',
        expect.any(Number),
        expect.any(Number)
      )
      const frame = container.querySelector(`img[src="blob:fallback-frame-${failure}"]`)
      expect(frame).toBeInTheDocument()
      fireEvent.load(frame!)
      expect(container.querySelector('img')).toHaveAttribute('src', `blob:fallback-frame-${failure}`)
      errorSpy.mockRestore()
    }
  )

  it('does not start a competing frame extraction while the compose preparation owns the preview', async () => {
    const file = {
      id: 'compose-video-id',
      tid: 'compose-video-tid',
      messageId: 'message-id',
      name: 'compose-video.mp4',
      type: attachmentTypes.video,
      url: 'blob:compose-video',
      metadata: '{}',
      attachmentUrl: 'blob:compose-video',
      size: 100,
      createdAt: new Date(),
      progress: 0,
      completion: 0,
      upload: true,
      data: new Blob(['video'], { type: 'video/mp4' })
    }
    const setVideoIsReadyToSend = jest.fn()

    renderWithSceytProvider(
      <VideoPreview
        width='420px'
        height='240px'
        file={file as any}
        src='blob:compose-video'
        backgroundColor='#ffffff'
        downloading={false}
        isPreview
        setVideoIsReadyToSend={setVideoIsReadyToSend}
      />,
      { store: createMessageListStore() }
    )

    await flushPreviewEffects()

    expect(mockGetVideoFirstFrame).not.toHaveBeenCalled()
    expect(setVideoIsReadyToSend).not.toHaveBeenCalled()
  })

  it('replaces the placeholder with an extracted first frame as soon as a no-preview video finishes downloading', async () => {
    mockGetVideoFirstFrame.mockResolvedValue({
      frameBlobUrl: 'blob:extracted-first-frame',
      blob: new Blob(['first-frame'], { type: 'image/jpeg' })
    })
    const file = {
      id: 'no-preview-video-id',
      tid: 'no-preview-video-tid',
      messageId: 'message-id',
      name: 'no-preview.mp4',
      type: attachmentTypes.video,
      url: 'https://cdn/no-preview.mp4',
      // No pvw / previewImage / inline tmb is supplied by the server.
      metadata: JSON.stringify({ szw: 1280, szh: 720, dur: 17 }),
      attachmentUrl: '',
      size: 100,
      createdAt: new Date(),
      progress: 0,
      completion: 0,
      upload: true,
      data: new Blob(['video'], { type: 'video/mp4' })
    }
    const store = createMessageListStore()
    const { container, rerender } = renderWithSceytProvider(
      <VideoPreview width='420px' height='240px' file={file as any} src='' backgroundColor='#ffffff' downloading />,
      { store }
    )

    await flushPreviewEffects()
    expect(mockGetVideoFirstFrame).not.toHaveBeenCalled()

    rerender(
      <VideoPreview
        width='420px'
        height='240px'
        file={file as any}
        src='blob:downloaded-original-video'
        backgroundColor='#ffffff'
        downloading={false}
      />
    )
    await flushPreviewEffects()

    expect(mockGetVideoFirstFrame).toHaveBeenCalledWith(
      'blob:downloaded-original-video',
      expect.any(Number),
      expect.any(Number)
    )
    const extractedFrame = Array.from(container.querySelectorAll('img')).find(
      (image) => image.getAttribute('src') === 'blob:extracted-first-frame'
    )
    expect(extractedFrame).toBeDefined()
    fireEvent.load(extractedFrame!)
    expect(
      Array.from(container.querySelectorAll('img')).some(
        (image) => image.getAttribute('src') === 'blob:extracted-first-frame'
      )
    ).toBe(true)
  })

  it('retries first-frame extraction when the downloaded original replaces an earlier failed source', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    mockGetVideoFirstFrame.mockRejectedValueOnce(new Error('remote source is not ready')).mockResolvedValueOnce({
      frameBlobUrl: 'blob:frame-after-download',
      blob: new Blob(['first-frame'], { type: 'image/jpeg' })
    })
    const file = {
      id: 'retry-frame-video-id',
      tid: 'retry-frame-video-tid',
      messageId: 'message-id',
      name: 'retry-frame.mp4',
      type: attachmentTypes.video,
      url: 'https://cdn/retry-frame.mp4',
      metadata: JSON.stringify({ szw: 1280, szh: 720, dur: 17 }),
      attachmentUrl: '',
      size: 100,
      createdAt: new Date(),
      progress: 0,
      completion: 0,
      upload: true,
      data: new Blob(['video'], { type: 'video/mp4' })
    }
    const store = createMessageListStore()
    const { rerender } = renderWithSceytProvider(
      <VideoPreview
        width='420px'
        height='240px'
        file={file as any}
        src='https://cdn/retry-frame.mp4'
        backgroundColor='#ffffff'
        downloading
      />,
      { store }
    )

    await flushPreviewEffects()
    expect(mockGetVideoFirstFrame).toHaveBeenCalledWith(
      'https://cdn/retry-frame.mp4',
      expect.any(Number),
      expect.any(Number)
    )

    rerender(
      <VideoPreview
        width='420px'
        height='240px'
        file={file as any}
        src='blob:downloaded-retry-frame-video'
        backgroundColor='#ffffff'
        downloading={false}
      />
    )
    await flushPreviewEffects()

    expect(mockGetVideoFirstFrame).toHaveBeenCalledWith(
      'blob:downloaded-retry-frame-video',
      expect.any(Number),
      expect.any(Number)
    )
    errorSpy.mockRestore()
  })

  it('hides video controls while the attachment upload overlay is active', () => {
    const file = {
      id: 'uploading-video-id',
      tid: 'uploading-video-tid',
      messageId: 'message-id',
      name: 'uploading-video.mp4',
      type: attachmentTypes.video,
      url: 'https://cdn/video.mp4',
      metadata: '{}',
      attachmentUrl: '',
      size: 100,
      createdAt: new Date(),
      progress: 0,
      completion: 0,
      upload: true,
      data: new Blob(['video'], { type: 'video/mp4' })
    }

    const { container } = renderWithSceytProvider(
      <VideoPreview
        width='420px'
        height='240px'
        file={file as any}
        src='https://cdn/video.mp4'
        backgroundColor='#ffffff'
        downloading={false}
        uploading
      />,
      { store: createMessageListStore() }
    )

    expect(container.querySelector('.video-controls')).not.toBeInTheDocument()
  })
})

describe('VideoPreview pvw with a custom transport', () => {
  // A forwarded video is rendered before the send is confirmed: the SDK gives
  // the pending attachment an empty message ID.
  const pendingFile = {
    id: 'video-id',
    tid: 'video-tid',
    messageId: '',
    name: 'video.mp4',
    type: attachmentTypes.video,
    url: 'https://cdn/video.mp4',
    metadata: JSON.stringify({ szw: 1280, szh: 720, dur: 17, pvw: 'https://cdn/video-thumb.jpg' }),
    attachmentUrl: '',
    size: 100,
    createdAt: new Date()
  }
  const renderPreview = (file: any) => (
    <VideoPreview
      width='420px'
      height='240px'
      file={file}
      src='https://cdn/video.mp4'
      backgroundColor='#ffffff'
      downloading={false}
    />
  )

  beforeEach(() => {
    jest.clearAllMocks()
    const transport: FileTransferProvider = {
      upload: async () => FileTransferResult.failure(new Error('not used')),
      download: async () => FileTransferResult.failure(new Error('not used')),
      cancel: () => undefined
    }
    fileTransfer.provider = transport
    mockGetAttachmentUrlFromCache.mockResolvedValue(false)
  })

  afterEach(() => {
    fileTransfer.configure()
  })

  it('shows a cached preview of a pending forwarded video', async () => {
    mockGetAttachmentUrlFromCache.mockResolvedValue('blob:cached-video-thumb')

    const { container } = renderWithSceytProvider(renderPreview(pendingFile), { store: createMessageListStore() })
    await flushPreviewEffects()

    expect(mockDownloadVideoThumb).not.toHaveBeenCalled()
    const cachedPreview = Array.from(container.querySelectorAll('img')).find(
      (image) => image.getAttribute('src') === 'blob:cached-video-thumb'
    )
    expect(cachedPreview).toBeDefined()
  })

  it('downloads the preview once the message ID of a pending forwarded video arrives', async () => {
    mockDownloadVideoThumb.mockResolvedValue('blob:downloaded-video-thumb')

    const { rerender } = renderWithSceytProvider(renderPreview(pendingFile), { store: createMessageListStore() })
    await flushPreviewEffects()

    expect(mockDownloadVideoThumb).not.toHaveBeenCalled()

    rerender(renderPreview({ ...pendingFile, messageId: '9223372036854775807' }))
    await flushPreviewEffects()

    expect(mockDownloadVideoThumb).toHaveBeenCalledTimes(1)
    expect(mockDownloadVideoThumb).toHaveBeenCalledWith(
      'https://cdn/video-thumb.jpg',
      expect.objectContaining({
        messageId: '9223372036854775807',
        metadata: expect.stringContaining('"pvw":"https://cdn/video-thumb.jpg"')
      }),
      undefined
    )
  })
})
