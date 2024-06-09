import { IUser } from '../types'

export const makeUsername = ( user?: IUser, getFirstNameOnly?: boolean) => {
  return  user
      ? user.firstName
        ? getFirstNameOnly
          ? `~${user.firstName.split(' ')[0]}`
          : `~${user.firstName.trim()} ${user.lastName.trim()}`.trim()
        : user.id || 'Deleted user'
      : 'Deleted user'
}

export const isJSON = (str: any) => {
  try {
    return JSON.parse(str) && !!str
  } catch (e) {
    return false
  }
}

export const calculateRenderedImageWidth = (width: number, height: number, maxWidth?: number, maxHeight?: number) => {
  const maxWdt = maxWidth || 420
  const maxHg = maxHeight || 400
  const minWidth = 165
  const aspectRatio = width / height
  if (aspectRatio >= maxWdt / maxHg) {
    return [Math.max(minWidth, Math.min(maxWdt, width)), Math.min(maxHg, height, maxWdt / aspectRatio) + 2]
  } else {
    if (maxHg <= height) {
      return [Math.min(maxWdt, maxHg * aspectRatio), Math.min(maxHg, height)]
    } else {
      return [Math.min(maxWdt, height * aspectRatio), Math.min(maxHg, height)]
    }
  }
}
