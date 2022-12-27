import {
  BLOCK_USERS,
  GET_CONTACTS,
  GET_ROLES,
  SET_CONNECTION_STATUS,
  SET_CONTACT_LOADING_STATE,
  SET_CONTACTS,
  SET_ROLES,
  UNBLOCK_USERS
} from './constants'
import { IContact, IRole } from '../../types'

export function setConnectionStatusAC(status: string) {
  return {
    type: SET_CONNECTION_STATUS,
    payload: { status }
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
