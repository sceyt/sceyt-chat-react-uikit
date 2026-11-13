import store from '../store'
import { setFileTransferFailedPopupAC } from '../store/message/actions'
import type { FileTransferFailedPopup } from '../store/message/reducers'

/** Shows the "Download failed" or "Upload failed" popup (common/popups/fileTransferFailed). */
export const showFileTransferFailedPopup = (popup: FileTransferFailedPopup) => {
  store.dispatch(setFileTransferFailedPopupAC(popup))
}

/**
 * The browser has no network: a transfer the user asks for cannot run. The chat still
 * reconnecting does not count: files go over HTTP, and a resend waits for the chat itself.
 */
export const isNetworkOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false

/** The error of a download the user starts while the connection is lost: it is not tried. */
export const createConnectionLostDownloadError = () =>
  Object.assign(new Error('The connection is lost: the file cannot be downloaded'), { name: 'ConnectionLost' })
