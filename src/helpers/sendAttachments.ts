import { getClient } from '../common/client'
import { CONNECTION_STATUS } from '../store/user/constants'

let sendAttachmentsAsSeparateMessages: boolean = false

export const setSendAttachmentsAsSeparateMessages = (asSeparate: boolean) => {
  sendAttachmentsAsSeparateMessages = asSeparate
}

export const getSendAttachmentsAsSeparateMessages = () => sendAttachmentsAsSeparateMessages

/**
 * Whether the connection is lost: the browser is offline, or the chat client is
 * not connected (the network may be up but lose every packet). Upload progress
 * reported then is not shown: the browser still puts the rest of a request into
 * the lost connection and counts those bytes as sent (the bar would run to the end).
 */
export const isConnectionLost = () => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const connectionState = getClient()?.connectionState
  return !!connectionState && connectionState !== CONNECTION_STATUS.CONNECTED
}
