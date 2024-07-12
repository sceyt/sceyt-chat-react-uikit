import { defaultThemeMode } from "../../UIHelper/constants";

export const customThemeSelector = (store: any) => store.CurrentThemeReducer.currentTheme

export const getThemeColors = (store: any) => {
    const currentThemeMode = defaultThemeMode.name;
    const theme = store.CurrentThemeReducer.currentTheme;
    const themeColors: { [key: string]: string } = {};
    for (const key in theme.colors) {
        if (theme.colors.hasOwnProperty(key)) {
            themeColors[key] = theme.colors[key][currentThemeMode]
        }
    }
    return themeColors;
};