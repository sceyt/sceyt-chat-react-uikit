import { select } from 'redux-saga/effects'
import { IMember } from '../../types'

// Utility functions to update active channel members
export function* updateActiveChannelMembersAdd(addedMembers: IMember[]): any {
  const state = yield select()
  const activeChannel = state.ChannelReducer.activeChannel
  if (activeChannel && activeChannel.id) {
    let updatedMembers = [...(activeChannel.members || []), ...addedMembers]
    // remove duplicates
    updatedMembers = Array.from(new Set(updatedMembers))
    return { members: updatedMembers }
  }
  return {}
}

export function* updateActiveChannelMembersRemove(removedMembers: IMember[]): any {
  const state = yield select()
  const activeChannel = state.ChannelReducer.activeChannel
  if (activeChannel && activeChannel.id) {
    let updatedMembers = (activeChannel.members || []).filter(
      (member: IMember) => !removedMembers.find((removed: IMember) => removed.id === member.id)
    )
    // remove duplicates
    updatedMembers = Array.from(new Set(updatedMembers))
    return { members: updatedMembers }
  }
  return {}
}
