import React from 'react'
import { act, screen } from '@testing-library/react'
import SliderPopup from './index'
import { createMessageListStore, renderWithSceytProvider } from '../../../testUtils/messageListHarness'
import { setAttachmentsForPopupAC } from '../../../store/message/actions'
import { setClient } from '../../client'
import { getAttachmentUrlFromCache } from '../../../helpers/attachmentsCache'
import { requestMediaDownload } from '../../../helpers/mediaDownloadCoordinator'
import { getRegisteredBlobUrl } from '../../../helpers/attachmentBlobUrls'

jest.mock('../../Carousel', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid='carousel'>{children}</div>
}))

jest.mock('../../../components', () => ({
  Avatar: () => <div data-testid='avatar' />
}))

jest.mock('../../../components/VideoPlayer', () => ({
  __esModule: true,
  default: ({ src, videoFileId, poster }: any) => (
    <video data-testid='slider-video-player' data-file-id={videoFileId} src={src} data-poster={poster || ''} />
  )
}))

jest.mock('../../../hooks', () => ({
  useColor: () => ({ textOnPrimary: '#ffffff', overlayBackground2: '#222222' })
}))

jest.mock('../../../hooks/basic/useMediaDownload', () => ({
  useMediaDownload: () => ({ state: 'idle', loaded: 0, total: 0, progress: 0 })
}))

jest.mock('../../../helpers/attachmentsCache', () => ({
  ATTACHMENT_VERSION: '_1_0_2',
  getAttachmentUrlFromCache: jest.fn(),
  getAttachmentURLWithVersion: (key: string) => `${key}_1_0_2`
}))

jest.mock('../../../helpers/attachmentBlobUrls', () => ({
  pinOriginalBlobUrl: jest.fn(),
  unpinOriginalBlobUrl: jest.fn(),
  registerBlobUrl: jest.fn(),
  getRegisteredBlobUrl: jest.fn()
}))

jest.mock('../../../helpers/mediaDownloadCoordinator', () => ({
  requestMediaDownload: jest.fn()
}))

jest.mock('../forwardMessage', () => ({
  __esModule: true,
  default: () => null
}))

jest.mock('../delete', () => ({
  __esModule: true,
  default: () => null
}))

jest.mock('react-circular-progressbar', () => ({
  CircularProgressbar: () => <div />
}))

const mockGetAttachmentUrlFromCache = getAttachmentUrlFromCache as jest.Mock
const mockRequestMediaDownload = requestMediaDownload as jest.Mock
const mockGetRegisteredBlobUrl = getRegisteredBlobUrl as jest.Mock

const selectedVideo = {
  id: 'selected-video',
  messageId: 'message-1',
  url: 'https://cdn/selected.mp4',
  name: 'selected.mp4',
  type: 'video',
  size: 1024,
  metadata: JSON.stringify({ tmb: 'a'.repeat(80) }),
  createdAt: new Date(),
  user: { id: 'user-1', firstName: 'Test', lastName: 'User' }
}

const anotherVideo = {
  ...selectedVideo,
  id: 'another-video',
  messageId: 'message-2',
  url: 'https://cdn/another.mp4',
  name: 'another.mp4'
}

const renderSlider = (messageState: Record<string, any> = {}) => {
  const store = createMessageListStore({
    UserReducer: { connectionStatus: 'connected' },
    MessageReducer: messageState
  })
  return {
    store,
    ...renderWithSceytProvider(
      <SliderPopup
        channel={{ id: 'channel-1', type: 'group' } as any}
        currentMediaFile={selectedVideo as any}
        setIsSliderOpen={jest.fn()}
      />,
      { store }
    )
  }
}

const flushEffects = async () => {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  })
}

describe('SliderPopup cached media', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setClient({ user: { id: 'current-user' } })
    mockGetAttachmentUrlFromCache.mockResolvedValue(false)
    mockGetRegisteredBlobUrl.mockReturnValue(undefined)
  })

  it('renders the selected cached video immediately without a cache lookup or downloader', () => {
    const cacheKey = `${selectedVideo.url}_original_video_url_1_0_2`
    renderSlider({ attachmentUpdatedMap: { [cacheKey]: 'blob:cached-video' }, attachmentsForPopup: [anotherVideo] })

    const video = screen.getByTestId('slider-video-player')
    expect(video).toHaveAttribute('src', 'blob:cached-video')
    expect(video).toHaveAttribute('data-file-id', selectedVideo.id)
    expect(video).toHaveAttribute('data-poster', '')
    expect(mockGetAttachmentUrlFromCache).not.toHaveBeenCalled()
    expect(mockRequestMediaDownload).not.toHaveBeenCalled()
  })

  it('rehydrates a Cache Storage hit once without a remote download', async () => {
    mockGetAttachmentUrlFromCache.mockResolvedValue('blob:cached-video')
    renderSlider()
    await flushEffects()

    expect(screen.getByTestId('slider-video-player')).toHaveAttribute('src', 'blob:cached-video')
    expect(mockGetAttachmentUrlFromCache).toHaveBeenCalledWith(`${selectedVideo.url}_original_video_url`)
    expect(mockRequestMediaDownload).not.toHaveBeenCalled()
  })

  it('uses a retained session blob URL without waiting for Cache Storage', () => {
    mockGetRegisteredBlobUrl.mockReturnValue('blob:retained-video')
    renderSlider()

    expect(screen.getByTestId('slider-video-player')).toHaveAttribute('src', 'blob:retained-video')
    expect(mockGetAttachmentUrlFromCache).not.toHaveBeenCalled()
    expect(mockRequestMediaDownload).not.toHaveBeenCalled()
  })

  it('does not pass a thumbnail poster to a player using a cached blob URL', () => {
    const cacheKey = `${selectedVideo.url}_original_video_url_1_0_2`
    renderSlider({ attachmentUpdatedMap: { [cacheKey]: 'blob:cached-video' } })

    expect(screen.getByTestId('slider-video-player')).toHaveAttribute('data-poster', '')
  })

  it('keeps the selected player mounted when the near-media list replaces the initial item', async () => {
    const cacheKey = `${selectedVideo.url}_original_video_url_1_0_2`
    const { store } = renderSlider({ attachmentUpdatedMap: { [cacheKey]: 'blob:cached-video' } })
    const initialPlayer = screen.getByTestId('slider-video-player')

    await act(async () => {
      store.dispatch(setAttachmentsForPopupAC([anotherVideo as any, selectedVideo as any]))
    })

    expect(screen.getByTestId('slider-video-player')).toBe(initialPlayer)
    expect(screen.getByAltText(anotherVideo.name)).toBeInTheDocument()
  })

  it('mounts only the selected video player and leaves other videos as thumbnails', async () => {
    const cacheKey = `${selectedVideo.url}_original_video_url_1_0_2`
    const { store } = renderSlider({ attachmentUpdatedMap: { [cacheKey]: 'blob:cached-video' } })

    await act(async () => {
      store.dispatch(setAttachmentsForPopupAC([selectedVideo as any, anotherVideo as any]))
    })

    expect(screen.getAllByTestId('slider-video-player')).toHaveLength(1)
    expect(screen.getByAltText(anotherVideo.name)).toBeInTheDocument()
  })
})
