import { ISceytChatUIKitTheme } from '../../components/ChatContainer'
import { SET_THEME, SET_THEME_NEW } from './constants'

export function setThemeAC(theme: string) {
  return {
    type: SET_THEME,
    payload: { theme }
  }
}
export function setTheme(theme: ISceytChatUIKitTheme) {
  return {
    type: SET_THEME_NEW,
    payload: { theme }
  }
}
