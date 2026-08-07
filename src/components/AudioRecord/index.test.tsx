import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import MicRecorder from 'mic-recorder-to-mp3'

import AudioRecord from './index'

const mockDispatch = jest.fn()
const mockRecorderStart = jest.fn()

jest.mock('store/hooks', () => ({
  useDispatch: () => mockDispatch
}))

jest.mock('../../hooks', () => ({
  useColor: () => ({
    accent: '#00a884',
    textSecondary: '#667085',
    warning: '#f59e0b',
    iconPrimary: '#667085',
    surface1: '#f2f4f7',
    textPrimary: '#101828',
    iconInactive: '#98a2b3',
    textOnPrimary: '#ffffff'
  })
}))

jest.mock('mic-recorder-to-mp3', () => ({
  __esModule: true,
  default: jest.fn()
}))

jest.mock('../AudioPlayer/AudioVisualization', () => () => null)

describe('AudioRecord microphone permission', () => {
  beforeEach(() => {
    mockDispatch.mockClear()
    mockRecorderStart.mockReset()
    ;(MicRecorder as unknown as jest.Mock).mockImplementation(() => ({ start: mockRecorderStart }))
  })

  it('shows a permission warning and does not publish recording when microphone access is denied', async () => {
    const permissionError = new Error('Microphone access denied')
    permissionError.name = 'NotAllowedError'
    mockRecorderStart.mockRejectedValue(permissionError)

    const { container } = render(
      <AudioRecord
        sendRecordedFile={jest.fn()}
        setShowRecording={jest.fn()}
        showRecording={false}
        isSelfChannel={false}
        channelId='channel-1'
        showViewOnceToggle={false}
        viewOnce={false}
        setViewOnce={jest.fn()}
        ViewOnceSelectedSVGIcon={null}
        ViewOnceNotSelectedSVGIcon={null}
      />
    )

    await act(async () => {
      await Promise.resolve()
    })
    expect(MicRecorder).toHaveBeenCalled()
    mockDispatch.mockClear()

    fireEvent.click(container.querySelector('svg')!.parentElement!)

    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByText('Microphone Permission Denied')).toBeTruthy()
    expect(mockRecorderStart).toHaveBeenCalledTimes(1)
    expect(mockDispatch).not.toHaveBeenCalled()
  })
})
