import {
  APPLY_PINNED_MESSAGES_EVENT,
  LOAD_PINNED_MESSAGES,
  PIN_MESSAGE,
  RESEND_PENDING_PIN_MUTATIONS,
  UNPIN_MESSAGE
} from './constants'
import {
  PendingPinMutation,
  PinnedMessageRecord,
  clearPinnedMessages,
  removePendingPinMutation,
  removePinnedMessages,
  setPendingPinMutation,
  setPinnedMessages,
  upsertPinnedMessages
} from './reducers'

export const loadPinnedMessagesAC = (
  channelId: string,
  nextToken?: string,
  restoreCache = true,
  limit = 20,
  reconcileAll = false
) => ({
  type: LOAD_PINNED_MESSAGES,
  payload: { channelId, nextToken, restoreCache, limit, reconcileAll }
})
export const pinMessageAC = (channelId: string, message: any, pinType: number) => ({
  type: PIN_MESSAGE,
  payload: { channelId, message, pinType }
})
export const unpinMessageAC = (channelId: string, pin: PinnedMessageRecord | { message: any; pinType?: number }) => ({
  type: UNPIN_MESSAGE,
  payload: { channelId, pin }
})
export const applyPinnedMessagesEventAC = (channel: any, event: any) => ({
  type: APPLY_PINNED_MESSAGES_EVENT,
  payload: { channel, event }
})
export const resendPendingPinMutationsAC = () => ({ type: RESEND_PENDING_PIN_MUTATIONS })
export const setPinnedMessagesAC = (
  channelId: string,
  pins: PinnedMessageRecord[],
  nextToken?: string,
  append?: boolean,
  merge?: boolean
) => setPinnedMessages({ channelId, pins, nextToken, append, merge })
export const upsertPinnedMessagesAC = (channelId: string, pins: PinnedMessageRecord[]) =>
  upsertPinnedMessages({ channelId, pins })
export const removePinnedMessagesAC = (channelId: string, pinIds?: string[], messageIds?: string[], pinType?: number) =>
  removePinnedMessages({ channelId, pinIds, messageIds, pinType })
export const clearPinnedMessagesAC = (channelId: string) => clearPinnedMessages({ channelId })
export const setPendingPinMutationAC = (mutation: PendingPinMutation) => setPendingPinMutation({ mutation })
export const removePendingPinMutationAC = (id: string) => removePendingPinMutation({ id })
