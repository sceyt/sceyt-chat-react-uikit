import React from 'react'
import { act, fireEvent, screen } from '@testing-library/react'
import FileTransferFailedPopup from './index'
import { setFileTransferFailedPopupAC } from '../../../store/message/actions'
import { renderWithSceytProvider } from '../../../testUtils/messageListHarness'

const popupOf = (store: any) => store.getState().MessageReducer.fileTransferFailedPopup

describe('the "Download failed" / "Upload failed" popup', () => {
  it('shows nothing until a transfer fails', () => {
    renderWithSceytProvider(<FileTransferFailedPopup />)

    expect(screen.queryByText('Download failed')).not.toBeInTheDocument()
    expect(screen.queryByText('Upload failed')).not.toBeInTheDocument()
  })

  it('a failed download tells the file is unavailable; Close closes it', () => {
    const { store } = renderWithSceytProvider(<FileTransferFailedPopup />)

    act(() => {
      store.dispatch(setFileTransferFailedPopupAC('download'))
    })

    expect(screen.getByText('Download failed')).toBeVisible()
    expect(screen.getByText('This file is unavailable and cannot be downloaded.')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByText('Download failed')).not.toBeInTheDocument()
    expect(popupOf(store)).toBeNull()
  })

  it('a failed upload asks to try again', () => {
    const { store } = renderWithSceytProvider(<FileTransferFailedPopup />)

    act(() => {
      store.dispatch(setFileTransferFailedPopupAC('upload'))
    })

    expect(screen.getByText('Upload failed')).toBeVisible()
    expect(screen.getByText('The file could not be uploaded. Please try again.')).toBeVisible()
  })
})
