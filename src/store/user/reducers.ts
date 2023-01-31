import { DESTROY_SESSION } from '../channel/constants'
import {
  ADD_USERS,
  SET_CONNECTION_STATUS,
  SET_CONTACTS,
  SET_ROLES,
  SET_USER,
  SET_USERS,
  SET_USERS_LOADING_STATE,
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
  user: IUser
}

const initialState: IUserStore = {
  connectionStatus: '',
  contactList: [],
  usersList: [],
  usersLoadingState: null,
  rolesMap: {},
  contactsMap: {},
  user: { id: '', firstName: '', lastName: '' }
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

    case SET_CONTACTS: {
      const { contacts } = payload
      newState.contactList = [...contacts]
      const contactsMap = {}
      contacts.map((contact: IContact) => {
        contactsMap[contact.id] = contact
      })
      newState.contactsMap = contactsMap
      return newState
    }

    case SET_ROLES: {
      const { roles } = payload
      const rolesMap = {}
      roles.map((role: IRole) => {
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

    case DESTROY_SESSION: {
      newState = initialState
      return newState
    }
    default:
      return state
  }
}
