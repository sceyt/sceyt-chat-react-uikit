import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { IMember, IRole, IUser } from '../../types'

export interface IMembersStore {
  membersLoadingState: number
  membersHasNext: boolean
  roles: IRole[]
  rolesMap: { [key: string]: IRole }
  getRolesFail: { attempts: number; timeout: number } | undefined
  activeChannelMembers: IMember[]
}

const initialState: IMembersStore = {
  membersLoadingState: 0,
  membersHasNext: true,
  activeChannelMembers: [],
  roles: [],
  getRolesFail: undefined,
  rolesMap: {}
}

const memberSlice = createSlice({
  name: 'members',
  initialState,
  reducers: {
    setMembersToList: (state, action: PayloadAction<{ members: IMember[] }>) => {
      const { members } = action.payload
      state.activeChannelMembers = [...members]
    },

    addMembersToList: (state, action: PayloadAction<{ members: IMember[] }>) => {
      const { members } = action.payload
      state.activeChannelMembers.push(...members)
    },

    updateMembers: (state, action: PayloadAction<{ members: IMember[] }>) => {
      const { members } = action.payload

      if (members.length) {
        const updatedMembersMap: { [key: string]: IMember } = {}
        for (let i = 0; i < members.length; i++) {
          updatedMembersMap[members[i].id] = members[i]
        }

        state.activeChannelMembers = state.activeChannelMembers.map((member) => {
          if (updatedMembersMap[member.id]) {
            return updatedMembersMap[member.id]
          }
          return member
        })
      }
    },

    updateMembersPresence: (state, action: PayloadAction<{ usersMap: { [key: string]: IUser } }>) => {
      const { usersMap } = action.payload
      if (state.activeChannelMembers.length) {
        state.activeChannelMembers = state.activeChannelMembers.map((member: IMember) => {
          if (usersMap[member.id]) {
            return { ...member, ...usersMap[member.id] }
          }
          return member
        })
      }
    },

    clearMembers: (state) => {
      state.activeChannelMembers = []
    },

    removeMemberFromList: (state, action: PayloadAction<{ members: IMember[] }>) => {
      const { members } = action.payload
      if (members.length) {
        const removedMembersMap: { [key: string]: IMember } = {}
        for (let i = 0; i < members.length; i++) {
          removedMembersMap[members[i].id] = members[i]
        }
        state.activeChannelMembers = state.activeChannelMembers.filter((member) => !removedMembersMap[member.id])
      }
    },

    setMembersLoadingState: (state, action: PayloadAction<{ state: number }>) => {
      state.membersLoadingState = action.payload.state
    },

    getRolesSuccess: (state, action: PayloadAction<{ roles: IRole[] }>) => {
      const { roles } = action.payload
      const rolesMap: { [key: string]: IRole } = {}
      roles.forEach((role: IRole) => {
        rolesMap[role.name] = role
      })
      state.rolesMap = rolesMap
      state.roles = roles
    },

    getRolesFail: (state, action: PayloadAction<{ attempts?: number; timeout?: number }>) => {
      const { attempts, timeout } = action.payload
      if (attempts || timeout) {
        state.getRolesFail = { attempts: attempts || 0, timeout: timeout || 0 }
      } else {
        state.getRolesFail = undefined
      }
    },

    setMembersHasNext: (state, action: PayloadAction<{ hasNext: boolean }>) => {
      state.membersHasNext = action.payload.hasNext
    }
  },
  extraReducers: (builder) => {
    builder.addCase('DESTROY_SESSION', () => {
      return initialState
    })
  }
})

// Export actions
export const {
  setMembersToList,
  addMembersToList,
  updateMembers,
  updateMembersPresence,
  clearMembers,
  removeMemberFromList,
  setMembersLoadingState,
  getRolesSuccess,
  getRolesFail,
  setMembersHasNext
} = memberSlice.actions

// Export reducer
export default memberSlice.reducer
