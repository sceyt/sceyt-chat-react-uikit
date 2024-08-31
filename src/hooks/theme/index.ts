import { useSelector } from 'react-redux'
import { useMemo } from 'react'
import { defaultTheme, defaultThemeMode } from '../../UIHelper/constants'

const useColor = (colorKey: string): string => {
  const themeReducer = useSelector((state: any) => state.ThemeReducer)
  const currentThemeMode = themeReducer.theme ? themeReducer.theme : defaultThemeMode
  const theme = themeReducer.newTheme ? themeReducer.newTheme : defaultTheme

  return useMemo(() => {
    if (theme.colors.hasOwnProperty(colorKey)) {
      return theme.colors[colorKey][currentThemeMode]
    }
  }, [theme.colors, colorKey, currentThemeMode])
}

export default useColor