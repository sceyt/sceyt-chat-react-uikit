import {
  ADD_MEMBERS_TO_LIST,
  CLEAR_MEMBERS, GET_ROLES_SUCCESS,
  REMOVE_MEMBER_FROM_LIST,
  SET_MEMBERS_LOADING_STATE,
  UPDATE_MEMBERS
} from "./constants";
import { DESTROY_SESSION } from '../channel/constants'
import { IAction, IMember, IRole } from "../../types";

export interface IMembersStore {
  membersLoadingState: boolean
  membersHasNext: boolean
  roles: IRole[] | []
  activeChannelMembers: IMember[] | []
}

const initialState: IMembersStore = {
  membersLoadingState: false,
  membersHasNext: true,
  activeChannelMembers: [],
  roles: []
}

export default (state = initialState, { type, payload }: IAction) => {
  let newState = { ...state }

  switch (type) {
    case ADD_MEMBERS_TO_LIST: {
      const { members } = payload
      newState.activeChannelMembers = [
        ...newState.activeChannelMembers,
        ...members
      ]
      return newState
    }
    case UPDATE_MEMBERS: {
      const { members } = payload
      let updateMembers: any = []
      const membersCopy = [...newState.activeChannelMembers]
      if (members.length) {
        const updatedMembersMap: any = {}
        for(let i = 0; i < members.length; i++) {
          updatedMembersMap[members[i].id] = members[i];
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

    case CLEAR_MEMBERS: {
      newState.activeChannelMembers = []
      return newState
    }

    case REMOVE_MEMBER_FROM_LIST: {
      const { members } = payload
      if (members.length) {
        let updateMembers: any = [];
        const membersCopy = [...newState.activeChannelMembers];
        const removedMembersMap: any = {};
        for (let i = 0; i < members.length; i++) {
          removedMembersMap[members[i].id] = members[i];
        }
        updateMembers = membersCopy.filter(
          (member) => !removedMembersMap[member.id]
        )
        newState.activeChannelMembers = updateMembers
      }
      return newState
    }

    case SET_MEMBERS_LOADING_STATE: {
      newState.membersLoadingState = payload.state
      return newState
    }

    case GET_ROLES_SUCCESS: {
      newState.roles = payload.roles
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
