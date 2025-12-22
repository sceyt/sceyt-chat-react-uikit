import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { IMember, IRole, IUser } from '../../types'

export interface IMembersStore {
  channelsMembersLoadingState: { [key: string]: number }
  channelsMembersHasNextMap: { [key: string]: boolean }
  roles: IRole[]
  rolesMap: { [key: string]: IRole }
  getRolesFail: { attempts: number; timeout: number } | undefined
  channelsMembersMap: { [key: string]: IMember[] }
  restricted: {
    isRestricted: boolean
    fromChannel: boolean
    members: IMember[] | null
  }
  openInviteModal: boolean
}

const initialState: IMembersStore = {
  channelsMembersLoadingState: {},
  channelsMembersHasNextMap: {},
  channelsMembersMap: {},
  roles: [],
  getRolesFail: undefined,
  rolesMap: {},
  restricted: {
    isRestricted: false,
    fromChannel: false,
    members: []
  },
  openInviteModal: false
}

const memberSlice = createSlice({
  name: 'members',
  initialState,
  reducers: {
    setMembersToList: (state, action: PayloadAction<{ channelId: string; members: IMember[] }>) => {
      const { channelId, members } = action.payload
      if (!state.channelsMembersMap[channelId]) {
        state.channelsMembersMap[channelId] = []
      }
      state.channelsMembersMap[channelId] = Array.from(new Set([...members]))
    },

    addMembersToList: (state, action: PayloadAction<{ channelId: string; members: IMember[] }>) => {
      const { channelId, members } = action.payload
      if (!state.channelsMembersMap[channelId]) {
        state.channelsMembersMap[channelId] = []
      }
      state.channelsMembersMap[channelId] = Array.from(new Set([...state.channelsMembersMap[channelId], ...members]))
    },

    updateMembers: (state, action: PayloadAction<{ channelId: string; members: IMember[] }>) => {
      const { channelId, members } = action.payload

      if (members.length) {
        const updatedMembersMap: { [key: string]: IMember } = {}
        for (let i = 0; i < members.length; i++) {
          updatedMembersMap[members[i].id] = members[i]
        }

        state.channelsMembersMap[channelId] = state.channelsMembersMap[channelId]?.map((member) => {
          if (updatedMembersMap[member.id]) {
            return updatedMembersMap[member.id]
          }
          return member
        })
      }
    },

    updateMembersPresence: (state, action: PayloadAction<{ usersMap: { [key: string]: IUser } }>) => {
      const { usersMap } = action.payload
      for (const channelId in usersMap) {
        if (state.channelsMembersMap[channelId]?.length) {
          state.channelsMembersMap[channelId] = state.channelsMembersMap[channelId]?.map((member: IMember) => {
            if (usersMap[member.id]) {
              return { ...member, ...usersMap[member.id] }
            }
            return member
          })
        }
      }
    },

    clearMembers: (state, action: PayloadAction<{ channelId: string }>) => {
      const { channelId } = action.payload
      if (state.channelsMembersMap[channelId]) {
        state.channelsMembersMap[channelId] = []
      }
    },

    removeMemberFromList: (state, action: PayloadAction<{ channelId: string; members: IMember[] }>) => {
      const { channelId, members } = action.payload
      if (members.length && state.channelsMembersMap[channelId]) {
        const removedMembersMap: { [key: string]: IMember } = {}
        for (let i = 0; i < members.length; i++) {
          removedMembersMap[members[i].id] = members[i]
        }
        state.channelsMembersMap[channelId] = state.channelsMembersMap[channelId]?.filter(
          (member) => !removedMembersMap[member.id]
        )
      }
    },

    setMembersLoadingState: (state, action: PayloadAction<{ channelId: string; loadingState: number }>) => {
      const { channelId, loadingState } = action.payload
      state.channelsMembersLoadingState[channelId] = loadingState
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

    setMembersHasNext: (state, action: PayloadAction<{ channelId: string; hasNext: boolean }>) => {
      const { channelId, hasNext } = action.payload
      state.channelsMembersHasNextMap[channelId] = hasNext
    },

    setActionIsRestricted: (
      state,
      action: PayloadAction<{ isRestricted: boolean; fromChannel: boolean; members: IMember[] | null }>
    ) => {
      const { isRestricted, fromChannel, members } = action.payload
      state.restricted.isRestricted = isRestricted
      state.restricted.fromChannel = fromChannel
      state.restricted.members = members
    },

    setOpenInviteModal: (state, action: PayloadAction<{ open: boolean }>) => {
      state.openInviteModal = action.payload.open
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
  setMembersHasNext,
  setActionIsRestricted,
  setOpenInviteModal
} = memberSlice.actions

// Export reducer
export default memberSlice.reducer
