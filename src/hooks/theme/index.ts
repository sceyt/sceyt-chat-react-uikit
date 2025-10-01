import { useSelector } from 'store/hooks'
import { useMemo } from 'react'
import { defaultTheme, defaultThemeMode } from '../../UIHelper/constants'

const useColors = (): Record<string, string> => {
  const themeReducer = useSelector((state: any) => state.ThemeReducer)
  const currentThemeMode = themeReducer?.theme || defaultThemeMode
  const theme = themeReducer?.newTheme || defaultTheme

  return useMemo(() => {
    const colorsWithMode: Record<string, string> = {}

    Object.keys(theme.colors).forEach((colorKey) => {
      colorsWithMode[colorKey] = theme.colors[colorKey][currentThemeMode]!
    })

    return colorsWithMode
  }, [theme.colors, currentThemeMode])
}

export default useColors
