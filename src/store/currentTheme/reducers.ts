import { SET_THEME } from './constants'
import { IAction } from '../../types'
import { defaultTheme } from '../../UIHelper/constants'
import { ISceytChatUIKitTheme } from '../../components/ChatContainer'

export interface ICustomThemeStore {
  currentTheme?: ISceytChatUIKitTheme
}

const initialState: ICustomThemeStore = {
  currentTheme: defaultTheme
}

export default (state = initialState, { type, payload }: IAction) => {
  const newState = { ...state }

  switch (type) {
    case SET_THEME: {
      const { theme } = payload
      newState.currentTheme = theme
      return newState
    }
    default:
      return state
  }
}
