import { useSelector } from 'store/hooks'
import { useMemo } from 'react'
import { defaultTheme, defaultThemeMode } from '../../UIHelper/constants'
import { newThemeSelector, themeSelector } from 'store/theme/selector'

const useColors = (): Record<string, string> => {
  const newTheme = useSelector(newThemeSelector)
  const themeMode = useSelector(themeSelector)
  const currentThemeMode = themeMode || defaultThemeMode
  const theme = newTheme || defaultTheme

  return useMemo(() => {
    const colorsWithMode: Record<string, string> = {}

    Object.keys(theme.colors).forEach((colorKey) => {
      colorsWithMode[colorKey] = theme.colors[colorKey][currentThemeMode]!
    })

    return colorsWithMode
  }, [theme.colors, currentThemeMode])
}

export default useColors
