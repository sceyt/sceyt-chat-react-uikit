import { IUser } from '../../types'

export let hideUserPresence: (user: IUser) => boolean

export const setHideUserPresence = (callback: (user: IUser) => boolean) => {
  hideUserPresence = callback
}
