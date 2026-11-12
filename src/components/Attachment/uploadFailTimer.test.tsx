import React from 'react'
import { act, screen } from '@testing-library/react'
import Attachment from './index'
import { attachmentTypes, UPLOAD_STATE } from '../../helpers/constants'
import { CONNECTION_STATUS } from '../../store/user/constants'
import { setConnectionStatusAC } from '../../store/user/actions'
import { updateAttachmentUploadingStateAC } from '../../store/message/actions'
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
const renderReconnectedUpload = () => {
  const store = createMessageListStore({
    UserReducer: { connectionStatus: CONNECTION_STATUS.DISCONNECTED },
    MessageReducer: { attachmentsUploadingState: { [attachment.tid]: UPLOAD_STATE.UPLOADING } }
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
})
