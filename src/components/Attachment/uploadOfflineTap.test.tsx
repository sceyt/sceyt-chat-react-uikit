import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import Attachment from './index'
import { attachmentTypes, UPLOAD_STATE } from '../../helpers/constants'
import { createMessageListStore, renderWithSceytProvider } from '../../testUtils/messageListHarness'
import { setClient } from '../../common/client'

// The upload icon tapped with the connection lost: the upload cannot run, so the
// "Upload failed" popup tells the user, and the upload stays as it is.

jest.mock('../../hooks', () => {
  const actual = jest.requireActual('../../hooks')
  return { ...actual, useColor: () => ({}) }
})

jest.mock('../../UIHelper', () => ({
  AttachmentIconCont: ({ children }: any) => <div>{children}</div>,
  UploadProgress: ({ children }: any) => <div>{children}</div>,
  UploadPercent: ({ children }: any) => <div>{children}</div>,
  CancelResumeWrapper: ({ children, onClick, ...props }: any) => (
    <button type='button' onClick={onClick} {...props}>
      {children}
    </button>
  )
}))

jest.mock('react-circular-progressbar', () => ({
  CircularProgressbar: () => <div data-testid='circular-progress' />
}))

jest.mock('../AudioPlayer', () => ({ __esModule: true, default: () => null }))

jest.mock('../../common/popups/viewOnceMedia/ViewOnceVoiceModal', () => ({ __esModule: true, default: () => null }))

jest.mock('../../helpers/attachmentsCache', () => ({
  getAttachmentUrlFromCache: jest.fn(() => Promise.resolve(false)),
  getAttachmentURLWithVersion: (url: string) => `${url}_1_0_2`,
  setAttachmentToCache: jest.fn()
}))

const attachment = {
  id: '',
  tid: 'offline-tap-tid',
  messageId: '',
  name: 'report.pdf',
  type: attachmentTypes.file,
  metadata: '{}',
  url: 'blob:report',
  attachmentUrl: 'blob:report',
  size: 10 * 1024 * 1024,
  upload: true,
  createdAt: new Date()
}

const renderUpload = (uploadState: number) => {
  const store = createMessageListStore({
    MessageReducer: { attachmentsUploadingState: { [attachment.tid]: uploadState } }
  })
  renderWithSceytProvider(<Attachment attachment={attachment as any} backgroundColor='#ffffff' />, { store })
  return store
}

const stateOf = (store: ReturnType<typeof createMessageListStore>) => (store.getState() as any).MessageReducer

describe('the upload icon tapped with the connection lost', () => {
  afterEach(() => {
    jest.restoreAllMocks()
    setClient(undefined)
  })

  it('a failed upload is not sent again: the "Upload failed" popup shows, and it stays failed', () => {
    jest.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const store = renderUpload(UPLOAD_STATE.FAIL)

    fireEvent.click(screen.getByRole('button', { name: 'Retry upload' }))

    expect(stateOf(store).fileTransferFailedPopup).toBe('upload')
    expect(stateOf(store).attachmentsUploadingState[attachment.tid]).toBe(UPLOAD_STATE.FAIL)
  })

  it('a stopped upload is not resumed: the "Upload failed" popup shows, and it stays stopped', () => {
    jest.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const store = renderUpload(UPLOAD_STATE.PAUSED)

    fireEvent.click(screen.getByRole('button', { name: 'Resume upload' }))

    expect(stateOf(store).fileTransferFailedPopup).toBe('upload')
    expect(stateOf(store).attachmentsUploadingState[attachment.tid]).toBe(UPLOAD_STATE.PAUSED)
  })

  it('just after the network is back, while the chat still reconnects, Retry does not show the popup', () => {
    setClient({ connectionState: 'Reconnecting' })
    const store = renderUpload(UPLOAD_STATE.FAIL)

    fireEvent.click(screen.getByRole('button', { name: 'Retry upload' }))

    expect(stateOf(store).fileTransferFailedPopup).toBeNull()
  })

  it('with the connection up, a stopped upload resumes with no popup', () => {
    const store = renderUpload(UPLOAD_STATE.PAUSED)

    fireEvent.click(screen.getByRole('button', { name: 'Resume upload' }))

    expect(stateOf(store).fileTransferFailedPopup).toBeNull()
  })
})
