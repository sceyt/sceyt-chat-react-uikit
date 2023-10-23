import { IUser } from '../../types'

// eslint-disable-next-line no-unused-vars
export let hideUserPresence: (user: IUser) => boolean

// eslint-disable-next-line no-unused-vars
export const setHideUserPresence = (callback: (user: IUser) => boolean) => {
  hideUserPresence = callback
}

export const usersMap = {}

export const updateUserOnMap = (user: IUser) => {
  usersMap[user.id] = user
}

export const setUserToMap = (user: IUser) => {
  usersMap[user.id] = user
}
export const deleteUserFromMap = (userId: string) => {
  delete usersMap[userId]
}
