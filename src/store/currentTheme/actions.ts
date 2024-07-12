import { ISceytChatUIKitTheme } from '../../components/ChatContainer'
import { SET_THEME } from './constants'

export function setTheme(theme: ISceytChatUIKitTheme) {
  return {
    type: SET_THEME,
    payload: { theme }
  }
}