import { SET_THEME, SET_THEME_NEW } from './constants'
import { IAction } from '../../types'
import { SceytChatUIKitTheme } from '../../components'
import { defaultTheme, defaultThemeMode } from '../../UIHelper/constants'

export interface IThemeStore {
  theme?: string
  newTheme?: SceytChatUIKitTheme
}

const initialState: IThemeStore = {
  theme: defaultThemeMode,
  newTheme: defaultTheme
}

export default (state = initialState, { type, payload }: IAction) => {
  const newState = { ...state }

  switch (type) {
    case SET_THEME: {
      const { theme } = payload
      newState.theme = theme
      return newState
    }
    case SET_THEME_NEW: {
      const { theme } = payload
      newState.newTheme = theme
      return newState
    }
    default:
      return state
  }
}
