import { useSelector } from "react-redux";
import { defaultThemeMode } from "../../UIHelper/constants";

export const themeSelector = (store: any) => store.ThemeReducer.theme

export const useColor = (colorKey: string) => {
    const currentThemeMode = defaultThemeMode.name;
    const theme = useSelector((state: any) => state.ThemeReducer.newTheme);
    let themeColors: string = '';
    if (theme.colors.hasOwnProperty(colorKey)) {
        themeColors = theme.colors[colorKey][currentThemeMode];
    }
    return themeColors;
};