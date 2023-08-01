import { IUser } from '../../types'

export let hideUserPresence: (user: IUser) => boolean

export const setHideUserPresence = (callback: (user: IUser) => boolean) => {
  hideUserPresence = callback
}

export const usersMap = {}

export const updateUserOnMap = (user: IUser) => {
  usersMap[user.id] = { ...usersMap[user.id], ...user.presence }
}

export const setUserToMap = (user: IUser) => {
  usersMap[user.id] = user
}
export const deleteUserFromMap = (userId: string) => {
  delete usersMap[userId]
}
