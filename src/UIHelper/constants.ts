import { ThemeMode } from '../components'

export const THEME_COLORS = {
  ACCENT: 'accent',
  AVATAR_BRAND_1: 'avatarBrand1',
  AVATAR_BRAND_2: 'avatarBrand2',
  AVATAR_BRAND_3: 'avatarBrand3',
  AVATAR_BRAND_4: 'avatarBrand4',
  AVATAR_BRAND_5: 'avatarBrand5',
  AVATAR_BRAND_6: 'avatarBrand6',
  TEXT_PRIMARY: 'textPrimary',
  TEXT_SECONDARY: 'textSecondary',
  TEXT_FOOTNOTE: 'textFootnote',
  TEXT_ON_PRIMARY: 'textOnPrimary',
  BORDER: 'border',
  ICON_INACTIVE: 'iconInactive',
  ICON_PRIMARY: 'iconPrimary',
  BACKGROUND: 'background',
  BACKGROUND_SECTIONS: 'backgroundSections',
  BACKGROUND_FOCUSED: 'backgroundFocused',
  BACKGROUND_HOVERED: 'backgroundHovered',
  OVERLAY_BACKGROUND: 'overlayBackground',
  OVERLAY_BACKGROUND_2: 'overlayBackground2',
  SURFACE_1: 'surface1',
  SURFACE_2: 'surface2',
  SURFACE_X: 'surfaceX',
  WARNING: 'warning',
  ATTENTION: 'attention',
  ONLINE_STATUS: 'onlineStatus',
  SUCCESS: 'success',
  OUTGOING_MESSAGE_BACKGROUND: 'outgoingMessageBackground',
  OUTGOING_MESSAGE_BACKGROUND_X: 'outgoingMessageBackgroundX',
  INCOMING_MESSAGE_BACKGROUND: 'incomingMessageBackground',
  INCOMING_MESSAGE_BACKGROUND_X: 'incomingMessageBackgroundX',
  LINK_COLOR: 'linkColor',
  HIGHLIGHTED_BACKGROUND: 'highlightedBackground',
  TOOLTIP_BACKGROUND: 'tooltipBackground'
} as const

export const defaultTheme = {
  colors: {
    // 1. accent color
    [THEME_COLORS.ACCENT]: {
      light: '#5159F6',
      dark: '#6B72FF'
    },
    // 2. avatar brand 1 colors
    [THEME_COLORS.AVATAR_BRAND_1]: {
      light: '#FBB019',
      dark: '#FBB019'
    },
    // 3. avatar brand 2 colors
    [THEME_COLORS.AVATAR_BRAND_2]: {
      light: '#B463E7',
      dark: '#B463E7'
    },
    // 4. avatar brand 2 colors
    [THEME_COLORS.AVATAR_BRAND_3]: {
      light: '#63AFFF',
      dark: '#63AFFF'
    },
    // 5. avatar brand 1 colors
    [THEME_COLORS.AVATAR_BRAND_4]: {
      light: '#67D292',
      dark: '#67D292'
    },
    // 5. avatar brand 1 colors
    [THEME_COLORS.AVATAR_BRAND_5]: {
      light: '#9F35E7',
      dark: '#9F35E7'
    },
    // 6. avatar brand 1 colors
    [THEME_COLORS.AVATAR_BRAND_6]: {
      light: '#63AFFF',
      dark: '#63AFFF'
    },
    // 6. background colors
    [THEME_COLORS.BACKGROUND]: {
      light: '#FFFFFF',
      dark: '#19191B'
    },
    // 7. background sections colors
    [THEME_COLORS.BACKGROUND_SECTIONS]: {
      light: '#FFFFFF',
      dark: '#2D2D2F'
    },
    // 8. background focused colors
    [THEME_COLORS.BACKGROUND_FOCUSED]: {
      light: '#E3E7FF',
      dark: '#212239'
    },
    // 9. background hovered colors
    [THEME_COLORS.BACKGROUND_HOVERED]: {
      light: '#F9FAFB',
      dark: '#1D1D1F'
    },
    // 10. text primary colors
    [THEME_COLORS.TEXT_PRIMARY]: {
      light: '#111539',
      dark: '#E1E3E6'
    },
    // 11. text secondary colors
    [THEME_COLORS.TEXT_SECONDARY]: {
      light: '#707388',
      dark: '#969A9F'
    },
    // 12. text footnote colors
    [THEME_COLORS.TEXT_FOOTNOTE]: {
      light: '#A0A1B0',
      dark: '#76787A'
    },
    // 13. text on primary colors
    [THEME_COLORS.TEXT_ON_PRIMARY]: {
      light: '#ffffff',
      dark: '#ffffff'
    },
    // 14. border colors
    [THEME_COLORS.BORDER]: {
      light: '#E4E6EE',
      dark: '#303032'
    },
    // 15. icon primary colors
    [THEME_COLORS.ICON_PRIMARY]: {
      light: '#707388',
      dark: '#969A9F'
    },
    // 16. icon inactive colors
    [THEME_COLORS.ICON_INACTIVE]: {
      light: '#A0A1B0',
      dark: '#76787A'
    },
    // 17. surface 1 colors
    [THEME_COLORS.SURFACE_1]: {
      light: '#F1F2F6',
      dark: '#232324'
    },
    // 18. surface 2 colors
    [THEME_COLORS.SURFACE_2]: {
      light: '#A0A1B0',
      dark: '#3B3B3D'
    },
    // 19. surface x colors
    [THEME_COLORS.SURFACE_X]: {
      light: '#D9D9DF',
      dark: '#303032'
    },
    // 20. overlay background colors
    [THEME_COLORS.OVERLAY_BACKGROUND]: {
      light: 'rgba(0, 0, 0, 0.5)',
      dark: 'rgba(0, 0, 0, 0.5)'
    },
    // 21. overlay background 2 colors
    [THEME_COLORS.OVERLAY_BACKGROUND_2]: {
      light: 'rgba(17, 21, 57, 0.4)',
      dark: 'rgba(17, 21, 57, 0.4)'
    },
    // 22. warning colors
    [THEME_COLORS.WARNING]: {
      light: '#FA4C56',
      dark: '#FA4C56'
    },
    // 23. attention colors
    [THEME_COLORS.ATTENTION]: {
      light: '#FBB019',
      dark: '#FBB019'
    },
    // 24. success colors
    [THEME_COLORS.SUCCESS]: {
      light: '#24C383',
      dark: '#24C383'
    },
    // 25. online status colors
    [THEME_COLORS.ONLINE_STATUS]: {
      light: '#4BB34B',
      dark: '#4BB34B'
    },
    // 26. outgoing message background colors
    [THEME_COLORS.OUTGOING_MESSAGE_BACKGROUND]: {
      light: '#E3E7FF',
      dark: '#212239'
    },
    // 27. outgoing message background x colors
    [THEME_COLORS.OUTGOING_MESSAGE_BACKGROUND_X]: {
      light: '#D1D8FF',
      dark: '#2E3052'
    },
    // 28. incoming message background colors
    [THEME_COLORS.INCOMING_MESSAGE_BACKGROUND]: {
      light: '#F1F2F6',
      dark: '#232324'
    },
    // 29. incoming message background x colors
    [THEME_COLORS.INCOMING_MESSAGE_BACKGROUND_X]: {
      light: '#E4E6EE',
      dark: '#303032'
    },
    // 30. link color colors
    [THEME_COLORS.LINK_COLOR]: {
      light: '#5159F6',
      dark: '#6B72FF'
    },
    // 31. highlighted background colors
    [THEME_COLORS.HIGHLIGHTED_BACKGROUND]: {
      light: '#C8D0FF',
      dark: '#3B3D68'
    },
    // 32. tooltip background colors
    [THEME_COLORS.TOOLTIP_BACKGROUND]: {
      light: '#111539E5',
      dark: '#000000E5'
    }
  }
}
export const defaultThemeMode: ThemeMode = 'light'

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
