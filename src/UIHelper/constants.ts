export const themeColors = {
  colors: {
    accent: {
      light: '#d7596c',
      dark: '#7A6EF6'
    },
    background: {
      light: '#000000',
      dark: '#438CED'
    }
  }
}
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

  incomingRepliedMessageBackground: '#fbfbfc',
  ownRepliedMessageBackground: '#f9fbfd',

  red1: '#FA4C56',
  red2: '#d7596c',

  purple: '#7A6EF6',

  defaultAvatarBackground: '#A0A1B0',
  deleteUserIconBackground: '#D0D8E3',
  accent: themeColors.colors.accent.light,
  background: themeColors.colors.background.light,
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
