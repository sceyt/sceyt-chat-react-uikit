import { ICustomAvatarColors } from '../types'
import { defaultTheme } from './constants'

const avatarColors = {
  light: [
    defaultTheme.colors.avatarBrand1.light,
    defaultTheme.colors.avatarBrand2.light,
    defaultTheme.colors.avatarBrand3.light,
    defaultTheme.colors.avatarBrand4.light,
    defaultTheme.colors.avatarBrand5.light,
    defaultTheme.colors.avatarBrand6.light
  ],
  dark: [
    defaultTheme.colors.avatarBrand1.dark,
    defaultTheme.colors.avatarBrand2.dark,
    defaultTheme.colors.avatarBrand3.dark,
    defaultTheme.colors.avatarBrand4.dark,
    defaultTheme.colors.avatarBrand5.dark,
    defaultTheme.colors.avatarBrand6.dark
  ]
}

let _avatarColors = { light: avatarColors.light, dark: avatarColors.dark }

export const setAvatarColor = (colors: ICustomAvatarColors) => {
  _avatarColors = { light: colors, dark: colors }
}

export const getAvatarColors = (theme: 'light' | 'dark') => {
  if (!_avatarColors[theme]?.length) {
    return _avatarColors.light
  }
  return _avatarColors[theme]
}
