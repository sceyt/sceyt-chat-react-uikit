// Import Redux Toolkit actions from the slice
import {
  setMembersToList,
  addMembersToList,
  updateMembers,
  updateMembersPresence,
  clearMembers,
  removeMemberFromList,
  setMembersLoadingState,
  getRolesSuccess,
  getRolesFail,
  setMembersHasNext,
  setActionIsRestricted,
  setOpenInviteModal
} from './reducers'

// Import saga action constants
import {
  ADD_MEMBERS,
  BLOCK_MEMBER,
  GET_MEMBERS,
  KICK_MEMBER,
  LOAD_MORE_MEMBERS,
  CHANGE_MEMBER_ROLE,
  REPORT_MEMBER,
  GET_ROLES
} from './constants'

import { IAddMember, IMember, IRole, IUser } from '../../types'

// Saga action creators (keep for async operations)
export const getMembersAC = (channelId: string) => ({
  type: GET_MEMBERS,
  payload: { channelId }
})

export const loadMoreMembersAC = (limit: number, channelId: string) => ({
  type: LOAD_MORE_MEMBERS,
  payload: { limit, channelId }
})

export const addMembersAC = (channelId: string, members: IAddMember[]) => ({
  type: ADD_MEMBERS,
  payload: { channelId, members }
})

export const kickMemberAC = (channelId: string, memberId: string) => ({
  type: KICK_MEMBER,
  payload: { channelId, memberId }
})

export const blockMemberAC = (channelId: string, memberId: string) => ({
  type: BLOCK_MEMBER,
  payload: { channelId, memberId }
})

export const reportUserAC = (reportData: any) => ({
  type: REPORT_MEMBER,
  payload: { reportData }
})

export const getRolesAC = (timeout?: number, attempts?: number) => ({
  type: GET_ROLES,
  payload: { timeout, attempts }
})

export const changeMemberRoleAC = (channelId: string, members: IMember[]) => ({
  type: CHANGE_MEMBER_ROLE,
  payload: { channelId, members }
})

// Action creators that now use Redux Toolkit actions
export const setMembersToListAC = (members: IMember[]) => setMembersToList({ members })

export const addMembersToListAC = (members: IMember[]) => addMembersToList({ members })

export const updateMembersAC = (members: IMember[]) => updateMembers({ members })

export const updateMembersPresenceAC = (usersMap: { [key: string]: IUser }) => updateMembersPresence({ usersMap })

export const setMembersLoadingStateAC = (state: number) => setMembersLoadingState({ state })

export const clearMembersAC = () => clearMembers()

export const removeMemberFromListAC = (members: IMember[]) => removeMemberFromList({ members })

export const getRolesSuccessAC = (roles: IRole[]) => getRolesSuccess({ roles })

export const getRolesFailAC = (timeout?: number, attempts?: number) => getRolesFail({ timeout, attempts })

export const setMembersHasNextAC = (hasNext: boolean) => setMembersHasNext({ hasNext })

export const setActionIsRestrictedAC = (isRestricted: boolean, fromChannel: boolean) =>
  setActionIsRestricted({ isRestricted, fromChannel })

export const setOpenInviteModalAC = (open: boolean) => setOpenInviteModal({ open })
