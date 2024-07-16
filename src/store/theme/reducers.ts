import { SET_THEME, SET_THEME_NEW } from './constants'
import { IAction } from '../../types'
import { ISceytChatUIKitTheme } from '../../components/ChatContainer'
import { defaultTheme, defaultThemeMode } from '../../UIHelper/constants'

export interface IThemeStore {
  theme?: string,
  newTheme?: ISceytChatUIKitTheme
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
