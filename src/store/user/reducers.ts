import { DESTROY_SESSION } from '../channel/constants'
import { SET_CONNECTION_STATUS, SET_CONTACTS, SET_ROLES } from './constants'
import { IAction, IContact, IRole } from '../../types'

export interface IUserStore {
  connectionStatus: string
  contactList: IContact[]
  rolesMap: { [key: string]: IRole }
  contactsMap: { [key: string]: IContact }
}

const initialState: IUserStore = {
  connectionStatus: '',
  contactList: [],
  rolesMap: {},
  contactsMap: {}
}

export default (state = initialState, { type, payload }: IAction) => {
  let newState = { ...state }

  switch (type) {
    case SET_CONNECTION_STATUS: {
      const { status } = payload
      newState.connectionStatus = status
      return newState
    }
    case SET_CONTACTS: {
      const { contacts } = payload
      newState.contactList = contacts
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

    case DESTROY_SESSION: {
      newState = initialState
      return newState
    }
    default:
      return state
  }
}
