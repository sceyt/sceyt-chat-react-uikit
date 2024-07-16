import { useSelector } from "react-redux"; 

export const themeSelector = (store: any) => store.ThemeReducer.theme

export const useColor = (colorKey: string) => {
    const themeReducer = useSelector((state: any) => state.ThemeReducer);
    const currentThemeMode = themeReducer.theme;
    const theme = themeReducer.newTheme;
    let themeColors: string = '';
    if (theme.colors.hasOwnProperty(colorKey)) {
        themeColors = theme.colors[colorKey][currentThemeMode];
    }
    return themeColors;
};