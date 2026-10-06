import { IUser } from '../../types'

// eslint-disable-next-line no-unused-vars
export let hideUserPresence: (user: IUser) => boolean

// eslint-disable-next-line no-unused-vars
export const setHideUserPresence = (callback: (user: IUser) => boolean) => {
  hideUserPresence = callback
}
