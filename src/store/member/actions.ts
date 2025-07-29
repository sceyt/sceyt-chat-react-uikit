import {
  ADD_MEMBERS,
  ADD_MEMBERS_TO_LIST,
  BLOCK_MEMBER,
  CLEAR_MEMBERS,
  GET_MEMBERS,
  KICK_MEMBER,
  LOAD_MORE_MEMBERS,
  REMOVE_MEMBER_FROM_LIST,
  SET_MEMBERS_LOADING_STATE,
  UPDATE_MEMBERS,
  CHANGE_MEMBER_ROLE,
  REPORT_MEMBER,
  GET_ROLES,
  GET_ROLES_SUCCESS,
  SET_MEMBERS_TO_LIST,
  UPDATE_MEMBERS_PRESENCE,
  GET_ROLES_FAIL
} from './constants'
import { IAddMember, IMember, IRole, IUser } from '../../types'

export function getMembersAC(channelId: string) {
  return {
    type: GET_MEMBERS,
    payload: { channelId }
  }
}

export function setMembersToListAC(members: IMember[]) {
  return {
    type: SET_MEMBERS_TO_LIST,
    payload: { members }
  }
}

export function addMembersToListAC(members: IMember[]) {
  return {
    type: ADD_MEMBERS_TO_LIST,
    payload: { members }
  }
}

export function updateMembersAC(members: IMember[]) {
  return {
    type: UPDATE_MEMBERS,
    payload: { members }
  }
}

export function updateMembersPresenceAC(usersMap: { [key: string]: IUser }) {
  return {
    type: UPDATE_MEMBERS_PRESENCE,
    payload: { usersMap }
  }
}

export function loadMoreMembersAC(limit: number, channelId: string) {
  return {
    type: LOAD_MORE_MEMBERS,
    payload: { limit, channelId }
  }
}

export function setMembersLoadingStateAC(state: number) {
  return {
    type: SET_MEMBERS_LOADING_STATE,
    payload: { state }
  }
}

export function clearMembersAC() {
  return {
    type: CLEAR_MEMBERS
  }
}

export function addMembersAC(channelId: string, members: IAddMember[]) {
  return {
    type: ADD_MEMBERS,
    payload: { channelId, members }
  }
}

export function kickMemberAC(channelId: string, memberId: string) {
  return {
    type: KICK_MEMBER,
    payload: { channelId, memberId }
  }
}

export function blockMemberAC(channelId: string, memberId: string) {
  return {
    type: BLOCK_MEMBER,
    payload: { channelId, memberId }
  }
}

export function reportUserAC(reportData: any) {
  return {
    type: REPORT_MEMBER,
    payload: { reportData }
  }
}

export function removeMemberFromListAC(members: IMember[]) {
  return {
    type: REMOVE_MEMBER_FROM_LIST,
    payload: { members }
  }
}

export function getRolesAC(timeout?: number, attempts?: number) {
  return {
    type: GET_ROLES,
    payload: { timeout, attempts }
  }
}
export function getRolesFailAC(timeout?: number, attempts?: number) {
  return {
    type: GET_ROLES_FAIL,
    payload: { timeout, attempts }
  }
}

export function getRolesSuccess(roles: IRole[]) {
  return {
    type: GET_ROLES_SUCCESS,
    payload: { roles }
  }
}

export function changeMemberRoleAC(channelId: string, members: IMember[]) {
  return {
    type: CHANGE_MEMBER_ROLE,
    payload: { channelId, members }
  }
}
