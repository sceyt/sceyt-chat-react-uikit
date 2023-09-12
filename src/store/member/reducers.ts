import {
  ADD_MEMBERS_TO_LIST,
  CLEAR_MEMBERS,
  GET_ROLES_FAIL,
  GET_ROLES_SUCCESS,
  REMOVE_MEMBER_FROM_LIST,
  SET_MEMBERS_LOADING_STATE,
  SET_MEMBERS_TO_LIST,
  UPDATE_MEMBERS,
  UPDATE_MEMBERS_PRESENCE
} from './constants'
import { DESTROY_SESSION } from '../channel/constants'
import { IAction, IMember, IRole } from '../../types'

export interface IMembersStore {
  membersLoadingState: boolean
  membersHasNext: boolean
  roles: IRole[] | []
  rolesMap: { [key: string]: IRole }
  getRolesFail: { attempts: number; timeout: number } | undefined
  activeChannelMembers: IMember[] | []
}

const initialState: IMembersStore = {
  membersLoadingState: false,
  membersHasNext: true,
  activeChannelMembers: [],
  roles: [],
  getRolesFail: undefined,
  rolesMap: {}
}

export default (state = initialState, { type, payload }: IAction) => {
  let newState = { ...state }

  switch (type) {
    case SET_MEMBERS_TO_LIST: {
      const { members } = payload
      newState.activeChannelMembers = [...members]
      return newState
    }
    case ADD_MEMBERS_TO_LIST: {
      const { members } = payload
      newState.activeChannelMembers = [...newState.activeChannelMembers, ...members]
      return newState
    }
    case UPDATE_MEMBERS: {
      const { members } = payload
      console.log('UPDATE_MEMBERS . ... .. ', members)
      let updateMembers: any = []
      const membersCopy = [...newState.activeChannelMembers]
      if (members.length) {
        const updatedMembersMap: any = {}
        for (let i = 0; i < members.length; i++) {
          updatedMembersMap[members[i].id] = members[i]
        }
        updateMembers = membersCopy.map((member) => {
          if (updatedMembersMap[member.id]) {
            return updatedMembersMap[member.id]
          }
          return member
        })
        newState.activeChannelMembers = updateMembers
      }
      return newState
    }
    case UPDATE_MEMBERS_PRESENCE: {
      const { usersMap } = payload
      console.log('UPDATE_MEMBERS_PRESENCE . ... .. ', usersMap)
      let updateMembers: any = []
      if (newState.activeChannelMembers.length) {
        const membersCopy = [...newState.activeChannelMembers]
        updateMembers = membersCopy.map((member: IMember) => {
          if (usersMap[member.id]) {
            return { ...member, ...usersMap[member.id] }
          }
          return member
        })
        newState.activeChannelMembers = updateMembers
      }
      return newState
    }

    case CLEAR_MEMBERS: {
      newState.activeChannelMembers = []
      return newState
    }

    case REMOVE_MEMBER_FROM_LIST: {
      const { members } = payload
      if (members.length) {
        let updateMembers: any = []
        const membersCopy = [...newState.activeChannelMembers]
        const removedMembersMap: any = {}
        for (let i = 0; i < members.length; i++) {
          removedMembersMap[members[i].id] = members[i]
        }
        updateMembers = membersCopy.filter((member) => !removedMembersMap[member.id])
        newState.activeChannelMembers = updateMembers
      }
      return newState
    }

    case SET_MEMBERS_LOADING_STATE: {
      newState.membersLoadingState = payload.state
      return newState
    }

    case GET_ROLES_SUCCESS: {
      const { roles } = payload
      const rolesMap = {}
      roles.forEach((role: IRole) => {
        rolesMap[role.name] = role
      })
      newState.rolesMap = rolesMap
      newState.roles = roles
      return newState
    }
    case GET_ROLES_FAIL: {
      const { attempts, timeout } = payload
      if (attempts || timeout) {
        newState.getRolesFail = { attempts, timeout }
      } else {
        newState.getRolesFail = undefined
      }
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
