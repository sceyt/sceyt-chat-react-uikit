import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { IContact, IUser } from '../../types'
import { CONNECTION_STATUS } from './constants'

export interface IUserStore {
  connectionStatus: string
  contactList: IContact[]
  usersList: IUser[]
  usersLoadingState: number | null
  contactsMap: { [key: string]: IContact }
  updatedUserMap: { [key: string]: IUser }
  user: IUser
  browserTabIsActive: boolean
  waitToSendPendingMessages: boolean
}

const initialState: IUserStore = {
  connectionStatus: '',
  contactList: [],
  usersList: [],
  usersLoadingState: null,
  contactsMap: {},
  updatedUserMap: {},
  user: { id: '', firstName: '', lastName: '', state: '' },
  browserTabIsActive: true,
  waitToSendPendingMessages: false
}

const userSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    setConnectionStatus: (state, action: PayloadAction<{ status: string }>) => {
      state.connectionStatus = action.payload.status
      if (action.payload.status === CONNECTION_STATUS.CONNECTED) {
        state.waitToSendPendingMessages = true
      }
    },

    setUser: (state, action: PayloadAction<{ user: IUser }>) => {
      state.user = { ...action.payload.user }
    },

    setUsers: (state, action: PayloadAction<{ users: IUser[] }>) => {
      state.usersList = [...action.payload.users]
    },

    addUsers: (state, action: PayloadAction<{ users: IUser[] }>) => {
      state.usersList.push(...action.payload.users)
    },

    setUsersLoadingState: (state, action: PayloadAction<{ state: number | null }>) => {
      state.usersLoadingState = action.payload.state
    },

    updateUserMap: (state, action: PayloadAction<{ usersMap: { [key: string]: IUser } }>) => {
      // Merge updates instead of replacing the entire map
      state.updatedUserMap = { ...state.updatedUserMap, ...action.payload.usersMap }
    },

    setContacts: (state, action: PayloadAction<{ contacts: IContact[] }>) => {
      const { contacts } = action.payload
      state.contactList = [...contacts]
      const contactsMap: { [key: string]: IContact } = {}
      contacts.forEach((contact: IContact) => {
        contactsMap[contact.id] = contact
      })
      state.contactsMap = contactsMap
    },

    updateUserProfile: (state, action: PayloadAction<{ profile: any }>) => {
      state.user = { ...state.user, ...action.payload.profile }
    },

    setBrowserTabIsActive: (state, action: PayloadAction<{ state: boolean }>) => {
      state.browserTabIsActive = action.payload.state
    },

    setWaitToSendPendingMessages: (state, action: PayloadAction<{ state: boolean }>) => {
      state.waitToSendPendingMessages = action.payload.state
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
  setConnectionStatus,
  setUser,
  setUsers,
  addUsers,
  setUsersLoadingState,
  updateUserMap,
  setContacts,
  updateUserProfile,
  setBrowserTabIsActive,
  setWaitToSendPendingMessages
} = userSlice.actions

// Export reducer
export default userSlice.reducer
