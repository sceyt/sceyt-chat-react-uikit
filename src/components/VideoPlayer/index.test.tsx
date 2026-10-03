import React from 'react'
import { act, render } from '@testing-library/react'
import VideoPlayer from './index'

jest.mock('../../hooks', () => ({
  useColor: () => ({ TEXT_ON_PRIMARY: '#ffffff' })
}))

describe('VideoPlayer cached source startup', () => {
  const originalPlay = HTMLMediaElement.prototype.play

  const flushEffects = async () => {
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
  }

  afterEach(() => {
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: originalPlay
    })
  })

  it('starts an active cached source without waiting for loadeddata', async () => {
    const play = jest.fn().mockResolvedValue(undefined)
    Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: play })

    render(<VideoPlayer src='blob:cached-video' videoFileId='video-1' activeFileId='video-1' readyToPlay />)

    await flushEffects()
    expect(play).toHaveBeenCalledTimes(1)
  })

  it('does not start an inactive source', async () => {
    const play = jest.fn().mockResolvedValue(undefined)
    Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: play })

    render(<VideoPlayer src='blob:cached-video' videoFileId='video-1' activeFileId='video-2' readyToPlay />)

    await flushEffects()
    expect(play).not.toHaveBeenCalled()
  })

  it('retries muted when browser autoplay is blocked', async () => {
    const play = jest.fn().mockRejectedValueOnce(new Error('Autoplay blocked')).mockResolvedValueOnce(undefined)
    Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: play })

    const { container } = render(
      <VideoPlayer src='blob:cached-video' videoFileId='video-1' activeFileId='video-1' readyToPlay />
    )

    await flushEffects()
    expect(container.querySelector('video')?.muted).toBe(true)
  })
})
