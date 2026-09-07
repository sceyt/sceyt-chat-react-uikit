import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { DESTROY_SESSION } from '../channel/constants'

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

const pinnedSlice = createSlice({
  name: 'pinnedMessages',
  initialState,
  reducers: {
    setPinnedMessages: (
      state,
      action: PayloadAction<{ channelId: string; pins: PinnedMessageRecord[]; nextToken?: string; append?: boolean }>
    ) => {
      const { channelId, pins, nextToken, append } = action.payload
      const current = append ? state.byChannel[channelId] || [] : []
      const byId = new Map(current.map((pin) => [pin.id, pin]))
      pins.forEach((pin) => byId.set(pin.id, { ...byId.get(pin.id), ...pin }))
      state.byChannel[channelId] = Array.from(byId.values())
      state.cursors[channelId] = nextToken
      state.loaded[channelId] = true
    },
    upsertPinnedMessages: (state, action: PayloadAction<{ channelId: string; pins: PinnedMessageRecord[] }>) => {
      const { channelId, pins } = action.payload
      const byId = new Map((state.byChannel[channelId] || []).map((pin) => [pin.id, pin]))
      pins.forEach((pin) => byId.set(pin.id, { ...byId.get(pin.id), ...pin }))
      state.byChannel[channelId] = Array.from(byId.values())
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
    setPendingPinMutation: (state, action: PayloadAction<{ mutation: PendingPinMutation }>) => {
      state.pendingMutations[action.payload.mutation.id] = action.payload.mutation
    },
    removePendingPinMutation: (state, action: PayloadAction<{ id: string }>) => {
      delete state.pendingMutations[action.payload.id]
    }
  },
  extraReducers: (builder) => {
    builder.addCase(DESTROY_SESSION, () => initialState)
  }
})

export const {
  setPinnedMessages,
  upsertPinnedMessages,
  removePinnedMessages,
  setPendingPinMutation,
  removePendingPinMutation
} = pinnedSlice.actions

export { sourceId, samePin }
export default pinnedSlice.reducer
