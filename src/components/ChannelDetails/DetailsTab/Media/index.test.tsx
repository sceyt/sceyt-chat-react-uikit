import React from 'react'
import { act } from '@testing-library/react'
import Media from './index'
import {
  createMessageListStore,
  renderWithSceytProvider,
  setElementIntersecting
} from '../../../../testUtils/messageListHarness'
import { getMediaDownloadSnapshot, requestMediaDownload } from '../../../../helpers/mediaDownloadCoordinator'
import { LOADING_STATE } from '../../../../helpers/constants'
import { setAttachmentsAC } from '../../../../store/message/actions'

jest.mock('../../../Attachment', () => ({
  __esModule: true,
  default: ({ attachment, handleMediaItemClick }: any) => (
    <button type='button' onClick={() => handleMediaItemClick(attachment)}>
      Open {attachment.name}
    </button>
  )
}))

jest.mock('../../../../common/popups/sliderPopup', () => ({
  __esModule: true,
  default: () => null
}))

jest.mock('../../../../hooks', () => ({
  useColor: () => ({ background: '#fff', textSecondary: '#666', surface1: '#eee' })
}))

jest.mock('../../../../helpers/mediaDownloadCoordinator', () => ({
  getMediaDownloadSnapshot: jest.fn(() => ({ state: 'idle' })),
  requestMediaDownload: jest.fn()
}))

const mockRequestMediaDownload = requestMediaDownload as jest.Mock
const mockGetMediaDownloadSnapshot = getMediaDownloadSnapshot as jest.Mock

describe('Media details tab', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetMediaDownloadSnapshot.mockReturnValue({ state: 'idle' })
    mockRequestMediaDownload.mockResolvedValue({ objectUrl: 'blob:video', blob: new Blob(['video']) })
  })

  it('starts an original download when a video tile becomes visible', async () => {
    const video = {
      id: 'video-id',
      messageId: 'message-id',
      type: 'video',
      url: 'https://cdn.example/video.mp4',
      name: 'video.mp4',
      size: 1024,
      metadata: JSON.stringify({ szw: 1280, szh: 720, dur: 3 }),
      createdAt: new Date()
    }
    const store = createMessageListStore({ MessageReducer: { attachmentLoadingState: LOADING_STATE.LOADED } })

    renderWithSceytProvider(<Media channel={{ id: 'channel-id', type: 'group' } as any} />, { store })
    await act(async () => {
      store.dispatch(setAttachmentsAC([video as any]))
      await Promise.resolve()
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
      const tile = document.querySelector('button')?.parentElement
      if (!tile) throw new Error('Expected the visible media tile')
      setElementIntersecting(tile, true)
      await Promise.resolve()
    })

    expect(mockRequestMediaDownload).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'original-video:https://cdn.example/video.mp4',
        url: 'https://cdn.example/video.mp4',
        cacheKey: 'https://cdn.example/video.mp4_original_video_url',
        kind: 'original-video',
        size: 1024
      })
    )
    expect(store.getState().MessageReducer.attachmentUpdatedMap).toMatchObject({
      'https://cdn.example/video.mp4_original_video_url_1_0_2': 'blob:video'
    })
  })

  it('keeps a globally cancelled video idle when its Media-tab tile becomes visible', async () => {
    const video = {
      id: 'cancelled-video-id',
      messageId: 'message-id',
      type: 'video',
      url: 'https://cdn.example/cancelled.mp4',
      name: 'cancelled.mp4',
      size: 1024,
      metadata: JSON.stringify({ szw: 1280, szh: 720, dur: 3 }),
      createdAt: new Date()
    }
    mockGetMediaDownloadSnapshot.mockReturnValue({ state: 'cancelled' })
    const store = createMessageListStore({ MessageReducer: { attachmentLoadingState: LOADING_STATE.LOADED } })

    renderWithSceytProvider(<Media channel={{ id: 'channel-id', type: 'group' } as any} />, { store })
    await act(async () => {
      store.dispatch(setAttachmentsAC([video as any]))
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
      const tile = document.querySelector('button')?.parentElement
      if (!tile) throw new Error('Expected the visible media tile')
      setElementIntersecting(tile, true)
    })

    expect(mockRequestMediaDownload).not.toHaveBeenCalled()
  })
})
