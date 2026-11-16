import React from 'react'
import { act, screen } from '@testing-library/react'
import Attachment from './index'
import { attachmentTypes, UPLOAD_STATE } from '../../helpers/constants'
import { CONNECTION_STATUS } from '../../store/user/constants'
import { setConnectionStatusAC } from '../../store/user/actions'
import { updateAttachmentUploadingProgressAC, updateAttachmentUploadingStateAC } from '../../store/message/actions'
import { createMessageListStore, renderWithSceytProvider } from '../../testUtils/messageListHarness'

// The 20 s timer that fails an upload which made no progress after a reconnect.
// The other Attachment tests stub useDidUpdate, so the timer never runs there.

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
  tid: 'reconnect-upload-tid',
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

// An upload going on while the chat is disconnected; the chat then reconnects (which starts the timer).
const renderReconnectedUpload = (attachmentsUploadingProgress = {}) => {
  const store = createMessageListStore({
    UserReducer: { connectionStatus: CONNECTION_STATUS.DISCONNECTED },
    MessageReducer: {
      attachmentsUploadingState: { [attachment.tid]: UPLOAD_STATE.UPLOADING },
      attachmentsUploadingProgress
    }
  })
  renderWithSceytProvider(<Attachment attachment={attachment as any} backgroundColor='#ffffff' />, { store })
  act(() => {
    store.dispatch(setConnectionStatusAC(CONNECTION_STATUS.CONNECTED))
  })
  return store
}

const uploadStateOf = (store: ReturnType<typeof createMessageListStore>) =>
  (store.getState() as any).MessageReducer.attachmentsUploadingState[attachment.tid]

describe('the upload fail timer after a reconnect', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('an upload that succeeds after the reconnect without any progress is not shown as failed', () => {
    const store = renderReconnectedUpload()

    // Its parts were all stored before the outage: only the completion goes, with no progress.
    act(() => {
      store.dispatch(updateAttachmentUploadingStateAC(UPLOAD_STATE.SUCCESS, attachment.tid))
    })
    act(() => {
      jest.advanceTimersByTime(20_000)
    })

    expect(uploadStateOf(store)).toBe(UPLOAD_STATE.SUCCESS)
    expect(screen.queryByRole('button', { name: 'Retry upload' })).not.toBeInTheDocument()
  })

  it('an upload still making no progress 20 s after the reconnect is shown as failed', () => {
    const store = renderReconnectedUpload()

    act(() => {
      jest.advanceTimersByTime(20_000)
    })

    expect(uploadStateOf(store)).toBe(UPLOAD_STATE.FAIL)
    expect(screen.getByRole('button', { name: 'Retry upload' })).toBeVisible()
  })

  it('an upload going on below the progress shown before the outage (held there) is not shown as failed', () => {
    const MB = 1024 * 1024
    const store = renderReconnectedUpload({
      [attachment.tid]: { uploaded: 4 * MB, total: 10 * MB, progress: 0.4 }
    })

    // Sent again from the stored parts on a slow network: for 30 s it reports less than the 4 MB shown.
    for (let second = 5; second <= 30; second += 5) {
      act(() => {
        jest.advanceTimersByTime(5_000)
        store.dispatch(updateAttachmentUploadingProgressAC(second * 0.1 * MB, 10 * MB, attachment.tid))
      })
    }

    expect(uploadStateOf(store)).toBe(UPLOAD_STATE.UPLOADING)
    expect(screen.queryByRole('button', { name: 'Retry upload' })).not.toBeInTheDocument()
  })
})
