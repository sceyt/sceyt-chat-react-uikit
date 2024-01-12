import { ICustomAvatarColors } from '../types'

let _avatarColors = ['#FF3E74', '#4F6AFF', '#FBB019', '#00CC99', '#9F35E7', '#63AFFF']

export const setAvatarColor = (colors: ICustomAvatarColors) => {
  _avatarColors = colors
}

export const getAvatarColors = () => _avatarColors
