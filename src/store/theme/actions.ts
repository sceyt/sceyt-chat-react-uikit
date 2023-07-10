import { SET_THEME } from './constants'

export function setThemeAC(theme: string) {
  return {
    type: SET_THEME,
    payload: { theme }
  }
}
