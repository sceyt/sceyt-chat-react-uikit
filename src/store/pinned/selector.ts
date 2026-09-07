import { IPinnedStore, PendingPinMutation, PinnedMessageRecord } from './reducers'

const EMPTY_PINNED_MESSAGES: PinnedMessageRecord[] = []
const EMPTY_PENDING_MUTATIONS: PendingPinMutation[] = []
const pendingMutationsCache = new WeakMap<object, PendingPinMutation[]>()

export const pinnedMessagesSelector = (channelId: string) => (store: { PinnedReducer: IPinnedStore }) =>
  store?.PinnedReducer?.byChannel?.[channelId] || EMPTY_PINNED_MESSAGES
export const pinnedMessagesCursorSelector = (channelId: string) => (store: { PinnedReducer: IPinnedStore }) =>
  store?.PinnedReducer?.cursors?.[channelId]
export const pendingPinMutationsSelector = (store: { PinnedReducer: IPinnedStore }) => {
  const mutations = store?.PinnedReducer?.pendingMutations

  if (!mutations) return EMPTY_PENDING_MUTATIONS

  const cached = pendingMutationsCache.get(mutations)
  if (cached) return cached

  const result = Object.values(mutations)
  pendingMutationsCache.set(mutations, result)
  return result
}
