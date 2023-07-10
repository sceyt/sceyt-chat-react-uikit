import { SET_THEME } from './constants'
import { IAction } from '../../types'

export interface IThemeStore {
  theme?: string
}

const initialState: IThemeStore = {
  theme: 'light'
}

export default (state = initialState, { type, payload }: IAction) => {
  const newState = { ...state }

  switch (type) {
    case SET_THEME: {
      const { theme } = payload
      newState.theme = theme
      return newState
    }

    default:
      return state
  }
}
