import { useSelector } from 'react-redux';
import { useMemo } from 'react';
import { defaultTheme, defaultThemeMode } from '../../UIHelper/constants';

const useThemeColor = (colorKey: string): string => {
  const themeReducer = useSelector((state: any) => state.ThemeReducer);
  const currentThemeMode = themeReducer.theme ? themeReducer.theme : defaultThemeMode;
  const theme = themeReducer.newTheme ? themeReducer.newTheme : defaultTheme;

  const themeColors = useMemo(() => {
    if (theme.colors.hasOwnProperty(colorKey)) {
      return theme.colors[colorKey][currentThemeMode];
    }
  }, [theme.colors, colorKey, currentThemeMode]);

  return themeColors;
};

export default useThemeColor;
