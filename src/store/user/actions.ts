import {
  ADD_USERS,
  BLOCK_USERS,
  BROWSER_TAB_IS_ACTIVE,
  GET_CONTACTS,
  GET_ROLES,
  GET_USERS,
  LOAD_MORE_USERS,
  SET_CONNECTION_STATUS,
  SET_CONTACT_LOADING_STATE,
  SET_CONTACTS,
  SET_ROLES,
  SET_USER,
  SET_USERS,
  SET_USERS_LOADING_STATE,
  UNBLOCK_USERS,
  UPDATE_PROFILE,
  UPDATE_USER_PROFILE
} from './constants'
import { IContact, IRole, IUser } from '../../types'

export function setConnectionStatusAC(status: string) {
  return {
    type: SET_CONNECTION_STATUS,
    payload: { status }
  }
}

export function getUsersAC(params: any) {
  return {
    type: GET_USERS,
    payload: { params }
  }
}
export function loadMoreUsersAC(limit: number) {
  return {
    type: LOAD_MORE_USERS,
    payload: { limit }
  }
}

export function setUsersLoadingStateAC(state: number) {
  return {
    type: SET_USERS_LOADING_STATE,
    payload: { state }
  }
}

export function setUsersAC(users: IUser[]) {
  return {
    type: SET_USERS,
    payload: { users }
  }
}

export function addUsersAC(users: IUser[]) {
  return {
    type: ADD_USERS,
    payload: { users }
  }
}

export function getContactsAC() {
  return {
    type: GET_CONTACTS,
    payload: {}
  }
}

export function setContactsAC(contacts: IContact[]) {
  return {
    type: SET_CONTACTS,
    payload: { contacts }
  }
}

export function getRolesAC() {
  return {
    type: GET_ROLES,
    payload: {}
  }
}

export function setRolesAC(roles: IRole[]) {
  return {
    type: SET_ROLES,
    payload: { roles }
  }
}

export function blockUserAC(userIds: string[]) {
  return {
    type: BLOCK_USERS,
    payload: { userIds }
  }
}

export function unblockUserAC(userIds: string[]) {
  return {
    type: UNBLOCK_USERS,
    payload: { userIds }
  }
}

export function setContactsLoadingStateAC(status: number) {
  return {
    type: SET_CONTACT_LOADING_STATE,
    payload: { status }
  }
}

export function setUserAC(user: IUser) {
  return {
    type: SET_USER,
    payload: { user }
  }
}

export function updateUserProfileAC(profile: any) {
  return {
    type: UPDATE_USER_PROFILE,
    payload: { profile }
  }
}

export function browserTabIsActiveAC(state: boolean) {
  return {
    type: BROWSER_TAB_IS_ACTIVE,
    payload: { state }
  }
}

export function updateProfileAC(
  user: IUser,
  firstName?: string,
  lastName?: string,
  avatarUrl?: string,
  metadata?: string,
  avatarFile?: File,
  presence?: string
) {
  return {
    type: UPDATE_PROFILE,
    payload: { user, firstName, lastName, avatarUrl, metadata, avatarFile, presence }
  }
}
