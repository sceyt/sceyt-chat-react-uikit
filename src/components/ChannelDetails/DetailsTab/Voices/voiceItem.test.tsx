import React from 'react'
import { act } from '@testing-library/react'
import VoiceItem from './voiceItem'
import { createMessageListStore, renderWithSceytProvider } from '../../../../testUtils/messageListHarness'
import { makeUser } from '../../../../testUtils/messageFixtures'
import { requestMediaDownload } from '../../../../helpers/mediaDownloadCoordinator'
import { getAttachmentUrlFromCache } from '../../../../helpers/attachmentsCache'

jest.mock('../../../../hooks', () => ({
  useColor: () => ({}),
  useDidUpdate: jest.requireActual('../../../../hooks/basic/useDidUpdate').default
}))

jest.mock('../../../../helpers/mediaDownloadCoordinator', () => ({
  requestMediaDownload: jest.fn()
}))

jest.mock('../../../../helpers/attachmentsCache', () => ({
  getAttachmentUrlFromCache: jest.fn()
}))

const mockRequestMediaDownload = requestMediaDownload as jest.Mock
const mockGetAttachmentUrlFromCache = getAttachmentUrlFromCache as jest.Mock

describe('VoiceItem', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetAttachmentUrlFromCache.mockResolvedValue(false)
    mockRequestMediaDownload.mockResolvedValue({ objectUrl: 'blob:voice', blob: new Blob(['voice']) })
  })

  it('downloads an uncached voice message with the message ID of its attachment', async () => {
    const file = {
      id: 'voice-id',
      messageId: 'message-id',
      type: 'voice',
      url: 'https://cdn/voice.mp3',
      name: 'voice.mp3',
      size: 512,
      metadata: JSON.stringify({ dur: 3 }),
      createdAt: new Date(),
      user: makeUser()
    }

    renderWithSceytProvider(<VoiceItem file={file as any} messageType='text' />, { store: createMessageListStore() })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockRequestMediaDownload).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://cdn/voice.mp3',
        kind: 'voice',
        messageType: 'text',
        messageId: 'message-id'
      })
    )
  })
})
