import { SceytChatUIKitTheme } from '../../components'
import { SET_THEME, SET_THEME_NEW } from './constants'

export function setThemeAC(theme: string) {
  return {
    type: SET_THEME,
    payload: { theme }
  }
}
export function setTheme(theme: SceytChatUIKitTheme) {
  return {
    type: SET_THEME_NEW,
    payload: { theme }
  }
}
