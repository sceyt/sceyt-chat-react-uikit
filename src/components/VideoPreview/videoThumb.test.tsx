import React from 'react'
import { act, fireEvent } from '@testing-library/react'
import VideoPreview from './index'
import { attachmentTypes } from '../../helpers/constants'
import { getVideoFirstFrame } from '../../helpers/getVideoFrame'
import { downloadVideoThumb } from '../../helpers/videoPreview'
import { createMessageListStore, renderWithSceytProvider } from '../../testUtils/messageListHarness'

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

jest.mock('../../helpers/customUploader', () => ({
  getCustomDownloader: () => undefined
}))

jest.mock('../../helpers/getVideoFrame', () => ({
  getVideoFirstFrame: jest.fn()
}))

jest.mock('../../helpers/videoPreview', () => {
  const actual = jest.requireActual('../../helpers/videoPreview')
  return {
    ...actual,
    downloadVideoThumb: jest.fn()
  }
})

const mockGetVideoFirstFrame = getVideoFirstFrame as jest.Mock
const mockDownloadVideoThumb = downloadVideoThumb as jest.Mock

const flushPreviewEffects = async () => {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('VideoPreview video_thumb rendering', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows the downloaded video_thumb immediately and never extracts a frame from the original video', async () => {
    mockDownloadVideoThumb.mockResolvedValue('blob:downloaded-video-thumb')
    const file = {
      id: 'video-id',
      tid: 'video-tid',
      messageId: 'message-id',
      name: 'video.mp4',
      type: attachmentTypes.video,
      url: 'https://cdn/video.mp4',
      metadata: JSON.stringify({ szw: 1280, szh: 720, dur: 17, video_thumb: 'https://cdn/video-thumb.jpg' }),
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

    expect(mockDownloadVideoThumb).toHaveBeenCalledWith('https://cdn/video-thumb.jpg', undefined, undefined)
    expect(mockGetVideoFirstFrame).not.toHaveBeenCalled()
    const pendingPreview = Array.from(container.querySelectorAll('img')).find(
      (image) => image.getAttribute('src') === 'blob:downloaded-video-thumb'
    )
    expect(pendingPreview).toBeDefined()
    fireEvent.load(pendingPreview!)
    expect(container.querySelector('img')).toHaveAttribute('src', 'blob:downloaded-video-thumb')
  })

  it('cross-fades from the inline thumbnail to video_thumb only after the remote preview has loaded', async () => {
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
        video_thumb: 'https://cdn/cross-fade-video-thumb.jpg'
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

  it('keeps the inline thumbnail when video_thumb download fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    mockDownloadVideoThumb.mockRejectedValue(new Error('preview unavailable'))
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
        video_thumb: 'https://cdn/preview-failure-thumb.jpg'
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
        src='https://cdn/preview-failure-video.mp4'
        backgroundColor='#ffffff'
        downloading={false}
      />,
      { store: createMessageListStore() }
    )

    await flushPreviewEffects()

    expect(container.querySelector('img')).toHaveAttribute('src', `data:image/jpeg;base64,${'b'.repeat(80)}`)
    expect(mockGetVideoFirstFrame).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })

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
