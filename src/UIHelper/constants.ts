import { ThemeMode } from '../components'

export const THEME_COLORS = {
  ACCENT: 'accent',
  BACKGROUND: 'background',
  SECTION_BACKGROUND: 'sectionBackground',
  FOCUS_BACKGROUND: 'focusBackground',
  HOVER_BACKGROUND: 'hoverBackground',
  TEXT_PRIMARY: 'textPrimary',
  TEXT_SECONDARY: 'textSecondary',
  TEXT_FOOTNOTE: 'textFootnote',
  TEXT_ON_PRIMARY: 'textOnPrimary',
  BORDER: 'border',
  ICON_PRIMARY: 'iconPrimary',
  ICON_INACTIVE: 'iconInactive',
  SURFACE_1: 'surface1',
  SURFACE_2: 'surface2',
  OVERLAY_BACKGROUND: 'overlayBackground',
  OVERLAY_BACKGROUND_2: 'overlayBackground2',
  WARNING: 'warning',
  ONLINE: 'online'
} as const

export const defaultTheme = {
  colors: {
    [THEME_COLORS.ACCENT]: {
      light: '#5159F6',
      dark: '#6B72FF'
    },
    [THEME_COLORS.BACKGROUND]: {
      light: '#FFFFFF',
      dark: '#19191B'
    },
    [THEME_COLORS.SECTION_BACKGROUND]: {
      light: '#FFFFFF',
      dark: '#232324'
    },
    [THEME_COLORS.FOCUS_BACKGROUND]: {
      light: '#E3E7FF',
      dark: '#212239'
    },
    [THEME_COLORS.HOVER_BACKGROUND]: {
      light: '#F9FAFB',
      dark: '#1D1D1F'
    },
    [THEME_COLORS.TEXT_PRIMARY]: {
      light: '#111539',
      dark: '#E1E3E6'
    },
    [THEME_COLORS.TEXT_SECONDARY]: {
      light: '#707388',
      dark: '#969A9F'
    },
    [THEME_COLORS.TEXT_FOOTNOTE]: {
      light: '#A0A1B0',
      dark: '#76787A'
    },
    [THEME_COLORS.TEXT_ON_PRIMARY]: {
      light: '#fff',
      dark: '#fff'
    },
    [THEME_COLORS.BORDER]: {
      light: '#E4E6EE',
      dark: '#303032'
    },
    [THEME_COLORS.ICON_PRIMARY]: {
      light: '#707388',
      dark: '#969A9F'
    },
    [THEME_COLORS.ICON_INACTIVE]: {
      light: '#A0A1B0',
      dark: '#64666A'
    },
    [THEME_COLORS.SURFACE_1]: {
      light: '#F1F2F6',
      dark: '#232324'
    },
    [THEME_COLORS.SURFACE_2]: {
      light: '#A0A1B0',
      dark: '#3B3B3D'
    },
    [THEME_COLORS.OVERLAY_BACKGROUND]: {
      light: 'rgba(0, 0, 0, 0.5)',
      dark: 'rgba(0, 0, 0, 0.5)'
    },
    [THEME_COLORS.OVERLAY_BACKGROUND_2]: {
      light: 'rgba(17, 21, 57, 0.4)',
      dark: 'rgba(17, 21, 57, 0.4)'
    },
    [THEME_COLORS.WARNING]: {
      light: '#FA4C56',
      dark: '#FA4C56'
    },
    [THEME_COLORS.ONLINE]: {
      light: '#0DBD8B',
      dark: '#0DBD8B'
    }
  }
}
export const defaultThemeMode: ThemeMode = 'light'
export const colors = {
  white: '#ffffff',
  black: '#000000',
  // dark: '#050610',
  dark: '#161616',
  blue: '#438CED',
  backgroundColor: '#f1f2f6',
  darkModeBackgroundColor: '#1e1f28',
  darkModeSecondaryBackgroundColor: '#1B1C25',
  lightModeBackgroundColor: '#f1f2f6',
  hoverBackgroundColor: '#f1f2f6',
  darkModeHoverBackgroundColor: '#25262E',
  lightModeHoverBackgroundColor: '#f1f2f6',
  textColor1: '#111539',
  darkModeTextColor1: '#ffffffcc',
  lightModeTextColor1: '#111539',
  textColor2: '#707388',
  textColor3: '#A0A1B0',
  placeholderTextColor: '#acacad',

  gray0: '#F3F5F8',
  gray1: '#EDEDED',
  borderColor: '#dfe0eb',
  borderColor2: '#818C99',

  primary: '#5159F6',
  primaryLight: '#E3E7FF',
  darkModePrimary: '#6B72FF',
  lightModePrimary: '#5159F6',
  darkModePrimaryLight: '#1c1f47',
  lightModePrimaryLight: '#E3E7FF',

  incomingMessageBackgroundLight: '#dfe0eb',
  incomingMessageBackgroundDark: '#1c1f47',
  incomingMessageBackgroundXLight: '#E4E6EE',
  incomingMessageBackgroundXDark: '#303032',
  outgoingMessageBackgroundLight: '',
  outgoingMessageBackgroundDark: '',
  outgoingMessageBackgroundXLight: '',
  outgoingMessageBackgroundXDark: '',

  incomingRepliedMessageBackground: '#fbfbfc',
  ownRepliedMessageBackground: '#f9fbfd',

  purple: '#7A6EF6',

  defaultAvatarBackground: '#A0A1B0',
  deleteUserIconBackground: '#D0D8E3',

  errorBlur: '#d7596c'
}

export const size = {
  mobileS: '320px',
  mobileM: '375px',
  mobileL: '425px',
  tablet: '768px',
  laptop: '1024px',
  laptopL: '1440px',
  max: '2560px'
}

export const device = {
  mobileS: `(min-width: ${size.mobileS})`,
  mobileM: `(min-width: ${size.mobileM})`,
  mobileL: `(min-width: ${size.mobileL})`,
  tablet: `screen and (max-width: ${size.tablet})`,
  laptop: `screen and (max-width: ${size.laptop})`,
  laptopL: `screen and (min-width: ${size.laptopL})`,
  max: `screen and (max-width: ${size.max})`
}
