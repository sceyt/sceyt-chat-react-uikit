// Import Redux Toolkit actions from the slice
import {
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
} from './reducers'

// Import saga action constants
import {
  BLOCK_USERS,
  CHECK_USER_STATUS,
  GET_CONTACTS,
  GET_USERS,
  LOAD_MORE_USERS,
  SET_CONTACT_LOADING_STATE,
  UNBLOCK_USERS,
  UPDATE_PROFILE
} from './constants'

import { IContact, IUser } from '../../types'

// Saga action creators (keep for async operations)
export const getUsersAC = (params: any) => ({
  type: GET_USERS,
  payload: { params }
})

export const loadMoreUsersAC = (limit: number) => ({
  type: LOAD_MORE_USERS,
  payload: { limit }
})

export const getContactsAC = () => ({
  type: GET_CONTACTS,
  payload: {}
})

export const blockUserAC = (userIds: string[]) => ({
  type: BLOCK_USERS,
  payload: { userIds }
})

export const unblockUserAC = (userIds: string[]) => ({
  type: UNBLOCK_USERS,
  payload: { userIds }
})

export const setContactsLoadingStateAC = (status: number) => ({
  type: SET_CONTACT_LOADING_STATE,
  payload: { status }
})

export const checkUserStatusAC = () => ({
  type: CHECK_USER_STATUS,
  payload: {}
})

export const updateProfileAC = (
  user: IUser,
  firstName?: string,
  lastName?: string,
  avatarUrl?: string,
  metadata?: string,
  avatarFile?: File,
  presence?: string
) => ({
  type: UPDATE_PROFILE,
  payload: { user, firstName, lastName, avatarUrl, metadata, avatarFile, presence }
})

// Action creators that now use Redux Toolkit actions
export const setConnectionStatusAC = (status: string) => setConnectionStatus({ status })

export const setUsersLoadingStateAC = (state: number) => setUsersLoadingState({ state })

export const setUsersAC = (users: IUser[]) => setUsers({ users })

export const addUsersAC = (users: IUser[]) => addUsers({ users })

export const setContactsAC = (contacts: IContact[]) => setContacts({ contacts })

export const setUserAC = (user: IUser) => setUser({ user })

export const updateUserProfileAC = (profile: any) => updateUserProfile({ profile })

export const browserTabIsActiveAC = (state: boolean) => setBrowserTabIsActive({ state })

export const updateUserStatusOnMapAC = (usersMap: { [key: string]: IUser }) => updateUserMap({ usersMap })

export const setWaitToSendPendingMessagesAC = (state: boolean) => setWaitToSendPendingMessages({ state })
