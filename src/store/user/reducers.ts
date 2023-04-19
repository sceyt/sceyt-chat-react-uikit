import { DESTROY_SESSION } from '../channel/constants'
import {
  ADD_USERS,
  BROWSER_TAB_IS_ACTIVE,
  SET_CONNECTION_STATUS,
  SET_CONTACTS,
  SET_ROLES,
  SET_USER,
  SET_USERS,
  SET_USERS_LOADING_STATE,
  UPDATE_USER_MAP,
  UPDATE_USER_PROFILE
} from './constants'
import { IAction, IContact, IRole, IUser } from '../../types'

export interface IUserStore {
  connectionStatus: string
  contactList: IContact[]
  usersList: IUser[]
  usersLoadingState: number | null
  rolesMap: { [key: string]: IRole }
  contactsMap: { [key: string]: IContact }
  updatedUserMap: { [key: string]: IUser }
  user: IUser
  browserTabIsActive: boolean
}

const initialState: IUserStore = {
  connectionStatus: '',
  contactList: [],
  usersList: [],
  usersLoadingState: null,
  rolesMap: {},
  contactsMap: {},
  updatedUserMap: {},
  user: { id: '', firstName: '', lastName: '' },
  browserTabIsActive: true
}

export default (state = initialState, { type, payload }: IAction) => {
  let newState = { ...state }

  switch (type) {
    case SET_CONNECTION_STATUS: {
      const { status } = payload
      newState.connectionStatus = status
      return newState
    }

    case SET_USER: {
      newState.user = { ...payload.user }
      return newState
    }

    case SET_USERS: {
      newState.usersList = [...payload.users]
      return newState
    }
    case ADD_USERS: {
      newState.usersList = [...newState.usersList, ...payload.users]
      return newState
    }

    case SET_USERS_LOADING_STATE: {
      newState.usersLoadingState = payload.state
      return newState
    }

    case UPDATE_USER_MAP: {
      newState.updatedUserMap = payload.usersMap
      return newState
    }

    case SET_CONTACTS: {
      const { contacts } = payload
      newState.contactList = [...contacts]
      const contactsMap = {}
      contacts.forEach((contact: IContact) => {
        contactsMap[contact.id] = contact
      })
      newState.contactsMap = contactsMap
      return newState
    }

    case SET_ROLES: {
      const { roles } = payload
      const rolesMap = {}
      roles.forEach((role: IRole) => {
        rolesMap[role.name] = role
      })
      newState.rolesMap = rolesMap
      return newState
    }

    case UPDATE_USER_PROFILE: {
      console.log('update user.... ')
      newState.user = { ...newState.user, ...payload.profile }
      return newState
    }

    case BROWSER_TAB_IS_ACTIVE: {
      newState.browserTabIsActive = payload.state
      return newState
    }
    case DESTROY_SESSION: {
      newState = initialState
      return newState
    }
    default:
      return state
  }
}
