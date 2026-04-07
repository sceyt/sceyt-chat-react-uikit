import { select } from 'redux-saga/effects'
import { IMember } from '../../types'

// Utility functions to update active channel members
export function* updateActiveChannelMembersAdd(addedMembers: IMember[], channelId?: string): any {
  const state = yield select()
  const activeChannel = state.ChannelReducer.activeChannel
  if (!activeChannel?.id) return {}
  if (channelId && activeChannel.id !== channelId) return {}
  const members = activeChannel.members || []
  const shouldUpdateMembers = addedMembers.filter((member) => !members.some((m: IMember) => m.id === member.id))
  let updatedMembers = [...members, ...shouldUpdateMembers]
  updatedMembers = Array.from(new Set(updatedMembers))
  return { members: updatedMembers }
}

export function* updateActiveChannelMembersRemove(removedMembers: IMember[], channelId?: string): any {
  const state = yield select()
  const activeChannel = state.ChannelReducer.activeChannel
  if (!activeChannel?.id) return {}
  if (channelId && activeChannel.id !== channelId) return {}
  let updatedMembers = (activeChannel.members || []).filter(
    (member: IMember) => !removedMembers.find((removed: IMember) => removed.id === member.id)
  )
  updatedMembers = Array.from(new Set(updatedMembers))
  return { members: updatedMembers }
}
