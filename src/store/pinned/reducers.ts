import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { DESTROY_SESSION } from '../channel/constants'
import {
  addReactionToMessage,
  deleteReactionFromMessage,
  patchMessages,
  updateMessage,
  updateMessagesStatus
} from '../message/reducers'
import { MESSAGE_STATUS } from '../../helpers/constants'

export type PinnedMessageRecord = {
  id: string
  pinType: number
  pinTill?: Date | null
  pinnedBy?: any
  message: any
}

export type PendingPinMutation = {
  id: string
  channelId: string
  operation: 'PIN' | 'UNPIN'
  messageId: string
  pinType?: number
  queuedAt: number
}

export interface IPinnedStore {
  byChannel: Record<string, PinnedMessageRecord[]>
  cursors: Record<string, string | undefined>
  loaded: Record<string, boolean>
  pendingMutations: Record<string, PendingPinMutation>
}

const initialState: IPinnedStore = {
  byChannel: {},
  cursors: {},
  loaded: {},
  pendingMutations: {}
}

const samePin = (left: PinnedMessageRecord, right: PinnedMessageRecord) => left.id === right.id
const sourceId = (pin: PinnedMessageRecord) => pin.message?.id || pin.message?.tid || ''
const messageMatches = (message: any, messageId: string) => message?.id === messageId || message?.tid === messageId

const updatePinnedMessageSnapshots = (state: IPinnedStore, messageId: string, update: (message: any) => any | null) => {
  Object.keys(state.byChannel).forEach((channelId) => {
    state.byChannel[channelId] = state.byChannel[channelId]
      .map((pin) => {
        if (!messageMatches(pin.message, messageId)) return pin
        const message = update(pin.message)
        return message ? { ...pin, message } : null
      })
      .filter((pin): pin is PinnedMessageRecord => !!pin)
  })
}

const pinnedSlice = createSlice({
  name: 'pinnedMessages',
  initialState,
  reducers: {
    setPinnedMessages: (
      state,
      action: PayloadAction<{
        channelId: string
        pins: PinnedMessageRecord[]
        nextToken?: string
        append?: boolean
        merge?: boolean
      }>
    ) => {
      const { channelId, pins, nextToken, append, merge } = action.payload
      const current = append || merge ? state.byChannel[channelId] || [] : []
      const byId = new Map(current.map((pin) => [pin.id, pin]))
      pins.forEach((pin) => byId.set(pin.id, { ...byId.get(pin.id), ...pin }))
      const serverPinIds = new Set(pins.map((pin) => pin.id))
      state.byChannel[channelId] = merge
        ? [
            ...pins.map((pin) => byId.get(pin.id)!),
            ...current.filter((pin) => !serverPinIds.has(pin.id)).map((pin) => byId.get(pin.id)!)
          ]
        : Array.from(byId.values())
      state.cursors[channelId] = nextToken
      state.loaded[channelId] = true
    },
    upsertPinnedMessages: (state, action: PayloadAction<{ channelId: string; pins: PinnedMessageRecord[] }>) => {
      const { channelId, pins } = action.payload
      const current = state.byChannel[channelId] || []
      const existingIds = new Set(current.map((pin) => pin.id))
      const byId = new Map(current.map((pin) => [pin.id, pin]))
      pins.forEach((pin) => byId.set(pin.id, { ...byId.get(pin.id), ...pin }))

      const prependedIds = new Set<string>()
      const newPins = pins.filter((pin) => {
        if (existingIds.has(pin.id) || prependedIds.has(pin.id)) return false
        prependedIds.add(pin.id)
        return true
      })

      state.byChannel[channelId] = [
        ...newPins.map((pin) => byId.get(pin.id)!),
        ...current.map((pin) => byId.get(pin.id)!)
      ]
      state.loaded[channelId] = true
    },
    removePinnedMessages: (
      state,
      action: PayloadAction<{ channelId: string; pinIds?: string[]; messageIds?: string[]; pinType?: number }>
    ) => {
      const { channelId, pinIds = [], messageIds = [], pinType } = action.payload
      state.byChannel[channelId] = (state.byChannel[channelId] || []).filter((pin) => {
        if (pinIds.includes(pin.id)) return false
        if (messageIds.includes(sourceId(pin)) && (pinType === undefined || pin.pinType === pinType)) return false
        return true
      })
    },
    clearPinnedMessages: (state, action: PayloadAction<{ channelId: string }>) => {
      const { channelId } = action.payload
      delete state.byChannel[channelId]
      delete state.cursors[channelId]
      delete state.loaded[channelId]
      Object.keys(state.pendingMutations).forEach((mutationId) => {
        if (state.pendingMutations[mutationId].channelId === channelId) {
          delete state.pendingMutations[mutationId]
        }
      })
    },
    setPendingPinMutation: (state, action: PayloadAction<{ mutation: PendingPinMutation }>) => {
      state.pendingMutations[action.payload.mutation.id] = action.payload.mutation
    },
    removePendingPinMutation: (state, action: PayloadAction<{ id: string }>) => {
      delete state.pendingMutations[action.payload.id]
    }
  },
  extraReducers: (builder) => {
    builder.addCase(DESTROY_SESSION, () => initialState)
    builder.addCase(updateMessage, (state, action) => {
      const { messageId, params } = action.payload
      updatePinnedMessageSnapshots(state, messageId, (message) => {
        if (params.state === MESSAGE_STATUS.DELETE) return null
        return {
          ...message,
          ...params,
          id: params.id || message.id,
          tid: params.tid || message.tid,
          userMarkers: [...(message.userMarkers || []), ...(params.userMarkers || [])]
        }
      })
    })
    builder.addCase(patchMessages, (state, action) => {
      action.payload.messages.forEach((message) => {
        const messageId = message.id || message.tid
        if (!messageId) return
        updatePinnedMessageSnapshots(state, messageId, () => (message.state === MESSAGE_STATUS.DELETE ? null : message))
      })
    })
    builder.addCase(addReactionToMessage, (state, action) => {
      const { message, reaction, isSelf } = action.payload
      const messageId = message.id || message.tid
      if (!messageId) return
      updatePinnedMessageSnapshots(state, messageId, (pinnedMessage) => ({
        ...pinnedMessage,
        reactionTotals: message.reactionTotals || pinnedMessage.reactionTotals || [],
        userReactions: isSelf ? [...(pinnedMessage.userReactions || []), reaction] : pinnedMessage.userReactions || []
      }))
    })
    builder.addCase(deleteReactionFromMessage, (state, action) => {
      const { message, reaction, isSelf } = action.payload
      const messageId = message.id || message.tid
      if (!messageId) return
      updatePinnedMessageSnapshots(state, messageId, (pinnedMessage) => ({
        ...pinnedMessage,
        reactionTotals: message.reactionTotals || pinnedMessage.reactionTotals || [],
        userReactions: isSelf
          ? (pinnedMessage.userReactions || []).filter((currentReaction: any) => currentReaction.key !== reaction.key)
          : pinnedMessage.userReactions || []
      }))
    })
    builder.addCase(updateMessagesStatus, (state, action) => {
      const { name, markersMap } = action.payload
      Object.keys(markersMap).forEach((messageId) => {
        updatePinnedMessageSnapshots(state, messageId, (message) => ({ ...message, deliveryStatus: name }))
      })
    })
  }
})

export const {
  setPinnedMessages,
  upsertPinnedMessages,
  removePinnedMessages,
  clearPinnedMessages,
  setPendingPinMutation,
  removePendingPinMutation
} = pinnedSlice.actions

export { sourceId, samePin }
export default pinnedSlice.reducer
