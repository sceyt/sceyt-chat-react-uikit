import { ICustomColors } from '../components/Channel/types'

export const colors = {
  white: '#ffffff',

  black1: '#383B51',

  blue1: '#172268',
  // blue2: '#4f6aff',
  blue2: '#2F81FF',
  blue3: '#63afff',
  // blue4: '#283379',
  blue4: '#1F223C',
  blue5: '#172268',
  blue6: '#18273A',
  blue7: '#383B51',
  blue8: '#9AABFB',
  blue9: '#2d44bf',
  blue10: '#060A26',

  // gray0: '#EFF1FF',
  gray0: '#F3F5F8',
  gray1: '#EDEDED',
  gray2: '#ecedf0',
  gray3: '#DBDBDB',
  gray4: '#818C99',
  gray5: '#F3F5F7',
  gray6: '#17191C',
  gray7: '#898B99',
  gray8: '#3A3C3E',
  gray9: '#757D8B',
  pink1: '#ff3e74',

  purple1: '#9f35e7',

  // cobalt1: '#4f6aff',
  cobalt1: '#2F81FF',

  green1: '#0DBD8B',
  green2: '#2ba57a',

  red1: '#FA4C56',
  red2: '#d7596c',
  red3: '#F0506D',

  yellow1: '#FCD36E'
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

export const customColors: ICustomColors = {}

export const setCustomColors = (colorsKeyValues: ICustomColors) => {
  const colorsKeys = Object.keys(colorsKeyValues)
  colorsKeys.map((key) => {
    customColors[key] = colorsKeyValues[key]
  })
}
