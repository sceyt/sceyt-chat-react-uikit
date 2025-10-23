import styled, { createGlobalStyle } from 'styled-components'
import { getAvatarColors } from './avatarColors'
import { ReactComponent as CloseSvg } from '../assets/svg/close.svg'
import { ReactComponent as SearchSvg } from '../assets/svg/search.svg'
import { IMessageStyles } from 'components/Message/Message.types'
export function md5(inputString: string) {
  const hc = '0123456789abcdef'
  function rh(n: any) {
    let j
    let s = ''
    for (j = 0; j <= 3; j++) s += hc.charAt((n >> (j * 8 + 4)) & 0x0f) + hc.charAt((n >> (j * 8)) & 0x0f)
    return s
  }
  function ad(x: any, y: any) {
    const l = (x & 0xffff) + (y & 0xffff)
    const m = (x >> 16) + (y >> 16) + (l >> 16)
    return (m << 16) | (l & 0xffff)
  }
  function rl(n: any, c: any) {
    return (n << c) | (n >>> (32 - c))
  }
  function cm(q: any, a: any, b: any, x: any, s: any, t: any) {
    return ad(rl(ad(ad(a, q), ad(x, t)), s), b)
  }
  function ff(a: any, b: any, c: any, d: any, x: any, s: any, t: any) {
    return cm((b & c) | (~b & d), a, b, x, s, t)
  }
  function gg(a: any, b: any, c: any, d: any, x: any, s: any, t: any) {
    return cm((b & d) | (c & ~d), a, b, x, s, t)
  }
  function hh(a: any, b: any, c: any, d: any, x: any, s: any, t: any) {
    return cm(b ^ c ^ d, a, b, x, s, t)
  }
  function ii(a: any, b: any, c: any, d: any, x: any, s: any, t: any) {
    return cm(c ^ (b | ~d), a, b, x, s, t)
  }
  function sb(x: string) {
    let i
    const nblk = ((x.length + 8) >> 6) + 1
    const blks = new Array(nblk * 16)
    for (i = 0; i < nblk * 16; i++) blks[i] = 0
    for (i = 0; i < x.length; i++) blks[i >> 2] |= x.charCodeAt(i) << ((i % 4) * 8)
    blks[i >> 2] |= 0x80 << ((i % 4) * 8)
    blks[nblk * 16 - 2] = x.length * 8
    return blks
  }
  let i
  const x = sb(inputString)
  let a = 1732584193
  let b = -271733879
  let c = -1732584194
  let d = 271733878
  let olda
  let oldb
  let oldc
  let oldd
  for (i = 0; i < x.length; i += 16) {
    olda = a
    oldb = b
    oldc = c
    oldd = d
    a = ff(a, b, c, d, x[i], 7, -680876936)
    d = ff(d, a, b, c, x[i + 1], 12, -389564586)
    c = ff(c, d, a, b, x[i + 2], 17, 606105819)
    b = ff(b, c, d, a, x[i + 3], 22, -1044525330)
    a = ff(a, b, c, d, x[i + 4], 7, -176418897)
    d = ff(d, a, b, c, x[i + 5], 12, 1200080426)
    c = ff(c, d, a, b, x[i + 6], 17, -1473231341)
    b = ff(b, c, d, a, x[i + 7], 22, -45705983)
    a = ff(a, b, c, d, x[i + 8], 7, 1770035416)
    d = ff(d, a, b, c, x[i + 9], 12, -1958414417)
    c = ff(c, d, a, b, x[i + 10], 17, -42063)
    b = ff(b, c, d, a, x[i + 11], 22, -1990404162)
    a = ff(a, b, c, d, x[i + 12], 7, 1804603682)
    d = ff(d, a, b, c, x[i + 13], 12, -40341101)
    c = ff(c, d, a, b, x[i + 14], 17, -1502002290)
    b = ff(b, c, d, a, x[i + 15], 22, 1236535329)
    a = gg(a, b, c, d, x[i + 1], 5, -165796510)
    d = gg(d, a, b, c, x[i + 6], 9, -1069501632)
    c = gg(c, d, a, b, x[i + 11], 14, 643717713)
    b = gg(b, c, d, a, x[i], 20, -373897302)
    a = gg(a, b, c, d, x[i + 5], 5, -701558691)
    d = gg(d, a, b, c, x[i + 10], 9, 38016083)
    c = gg(c, d, a, b, x[i + 15], 14, -660478335)
    b = gg(b, c, d, a, x[i + 4], 20, -405537848)
    a = gg(a, b, c, d, x[i + 9], 5, 568446438)
    d = gg(d, a, b, c, x[i + 14], 9, -1019803690)
    c = gg(c, d, a, b, x[i + 3], 14, -187363961)
    b = gg(b, c, d, a, x[i + 8], 20, 1163531501)
    a = gg(a, b, c, d, x[i + 13], 5, -1444681467)
    d = gg(d, a, b, c, x[i + 2], 9, -51403784)
    c = gg(c, d, a, b, x[i + 7], 14, 1735328473)
    b = gg(b, c, d, a, x[i + 12], 20, -1926607734)
    a = hh(a, b, c, d, x[i + 5], 4, -378558)
    d = hh(d, a, b, c, x[i + 8], 11, -2022574463)
    c = hh(c, d, a, b, x[i + 11], 16, 1839030562)
    b = hh(b, c, d, a, x[i + 14], 23, -35309556)
    a = hh(a, b, c, d, x[i + 1], 4, -1530992060)
    d = hh(d, a, b, c, x[i + 4], 11, 1272893353)
    c = hh(c, d, a, b, x[i + 7], 16, -155497632)
    b = hh(b, c, d, a, x[i + 10], 23, -1094730640)
    a = hh(a, b, c, d, x[i + 13], 4, 681279174)
    d = hh(d, a, b, c, x[i], 11, -358537222)
    c = hh(c, d, a, b, x[i + 3], 16, -722521979)
    b = hh(b, c, d, a, x[i + 6], 23, 76029189)
    a = hh(a, b, c, d, x[i + 9], 4, -640364487)
    d = hh(d, a, b, c, x[i + 12], 11, -421815835)
    c = hh(c, d, a, b, x[i + 15], 16, 530742520)
    b = hh(b, c, d, a, x[i + 2], 23, -995338651)
    a = ii(a, b, c, d, x[i], 6, -198630844)
    d = ii(d, a, b, c, x[i + 7], 10, 1126891415)
    c = ii(c, d, a, b, x[i + 14], 15, -1416354905)
    b = ii(b, c, d, a, x[i + 5], 21, -57434055)
    a = ii(a, b, c, d, x[i + 12], 6, 1700485571)
    d = ii(d, a, b, c, x[i + 3], 10, -1894986606)
    c = ii(c, d, a, b, x[i + 10], 15, -1051523)
    b = ii(b, c, d, a, x[i + 1], 21, -2054922799)
    a = ii(a, b, c, d, x[i + 8], 6, 1873313359)
    d = ii(d, a, b, c, x[i + 15], 10, -30611744)
    c = ii(c, d, a, b, x[i + 6], 15, -1560198380)
    b = ii(b, c, d, a, x[i + 13], 21, 1309151649)
    a = ii(a, b, c, d, x[i + 4], 6, -145523070)
    d = ii(d, a, b, c, x[i + 11], 10, -1120210379)
    c = ii(c, d, a, b, x[i + 2], 15, 718787259)
    b = ii(b, c, d, a, x[i + 9], 21, -343485551)
    a = ad(a, olda)
    b = ad(b, oldb)
    c = ad(c, oldc)
    d = ad(d, oldd)
  }
  return rh(a) + rh(b) + rh(c) + rh(d)
}
export const BKDRHash = (str: string) => {
  const seed = 131
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = hash * seed + str.charCodeAt(i)
  }
  return hash
}
// FIXME need better solution for avatar hash calculation!
export const hashCode = (str: string) => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash &= hash
  }
  return hash
}

export const GlobalStyles = createGlobalStyle`

  .mention_menu_item-active {
    background: #e6f7ff;
  }

  @keyframes makeVisible {
    0% {
      opacity: 0;
      visibility: visible;
    }
    100% {
      opacity: 1;
      visibility: visible;
    }
  }
`

export function generateAvatarColor(itemName: any, theme: 'light' | 'dark') {
  const avatarColors = getAvatarColors(theme)
  if (itemName && itemName !== '') {
    const hash = md5(itemName).toString().padStart(32, '0').slice(-6)
    const hashInt = parseInt(hash, 16)
    const colorIndex = hashInt % avatarColors.length
    return avatarColors[colorIndex]
  }
  return null
}

// return colors[abs((fullName ?: "").hashCode()) % colors.size].toColorInt()

export const DropdownOptionsUl = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
`

export const DropdownOptionLi = styled.li<{
  textColor: string
  hoverBackground: string
  iconWidth?: string
  iconColor?: string
  margin?: string
}>`
  cursor: pointer;
  display: flex;
  align-items: center;
  font-size: 14px;
  line-height: 20px;
  color: ${(props: any) => props.textColor};
  margin: ${(props: any) => props.margin};
  padding: 6px 6px 6px 16px;

  &:hover {
    background: ${(props) => props.hoverBackground};
  }

  & > svg {
    width: ${(props) => props.iconWidth};
    min-width: ${(props) => props.iconWidth};
    height: ${(props) => props.iconWidth};
    color: ${(props) => props.iconColor};
    margin-right: 10px;
  }
`

export const CustomSelect = styled.div<{
  isError?: boolean
  minWidth?: string
  maxWidth?: string
  marginTop?: string
  backgroundColor: string
  color: string
  placeholderColor: string
  errorColor: string
  borderColor: string
  disabledColor: string
}>`
  display: flex;
  height: 40px;
  min-height: 40px;
  width: 100%;
  min-width: ${(props) => props.minWidth};
  max-width: ${(props) => props.maxWidth};
  background: ${(props) => props.backgroundColor};
  border: ${(props) => (props.isError ? `1px solid ${props.errorColor}` : `1px solid ${props.borderColor}`)};
  box-sizing: border-box;
  border-radius: 4px;
  font-style: normal;
  font-weight: normal;
  font-size: 14px;
  line-height: 16px;
  color: ${(props) => props.color};
  margin-top: ${(props) => props.marginTop};

  ::placeholder {
    color: ${(props) => props.placeholderColor};
  }

  &:disabled {
    background-color: ${(props) => props.disabledColor};
  }

  .dropdown-wrapper {
    width: 100%;
  }

  .dropdown-body {
    width: 100%;
  }
`

export const CustomSelectTrigger = styled.span<{ color: string }>`
  display: block;
  width: calc(100% - 22px);
  padding: 8px 10px 8px 15px;
  text-align: left;
  font-style: normal;
  font-weight: normal;
  font-size: 14px;
  line-height: 23px;
  color: ${(props) => props.color};
  text-transform: capitalize;
`

export const Label = styled.label<{ color: string }>`
  display: inline-block;
  font-style: normal;
  font-weight: 500;
  font-size: 13px;
  line-height: 20px;
  margin-top: 20px;
  margin-bottom: 4px;
  color: ${(props) => props.color};
`

export const UploadFile = styled.input`
  display: none;
`

export const UploadFileLabel = styled.label`
  cursor: pointer;
  width: 100%;
  display: block;
`

export const InputErrorMessage = styled.p<{ color: string }>`
  font-size: 12px;
  color: ${(props) => props.color};
  margin: 4px 0 0;
`

export const CustomInput = styled.input<{
  error?: boolean
  theme?: string
  color: string
  placeholderColor: string
  backgroundColor: string
  errorColor: string
  borderColor: string
  disabledColor: string
}>`
  height: 40px;
  width: 100%;
  background: ${(props) => props.backgroundColor};
  border: ${(props) => (props.error ? `1px solid ${props.errorColor}` : `1px solid ${props.borderColor}`)};
  color: ${(props) => props.color};
  box-sizing: border-box;
  border-radius: 8px;
  padding: 11px 14px;
  font-family: Inter, sans-serif;
  font-style: normal;
  font-weight: normal;
  font-size: 15px;
  line-height: 20px;
  opacity: 1;
  outline: none;

  &:focus {
    border: 1px solid ${(props) => (props.error ? `1px solid ${props.errorColor}` : 'transparent')};
    outline: ${(props) => (props.error ? `1px solid ${props.errorColor}` : `2px solid ${props.borderColor}`)};
  }
  &:disabled {
    background-color: ${(props) => props.disabledColor};
    opacity: 1;
    color: #383b51;
  }
  &::placeholder {
    opacity: 1;
    color: ${(props) => props.placeholderColor};
  }
`

export const FilterField = styled.div`
  border: 1px solid #d7d8e3;
  border-radius: 4px;
  background-color: transparent;
  margin-left: 12px;
`

export const FilterFieldSpan = styled.span`
  display: block;
  width: 100px;
  padding: 8px 0 8px 8px;
  text-align: left;
  font-size: 0.875rem;
  line-height: 1rem;
`

export const Row = styled.div<any>`
  display: flex;
  flex-direction: row;
  margin: ${(props) => props.margin};
  margin-top: ${(props) => props.marginTop};
  margin-bottom: ${(props) => props.marginBottom};
  margin-right: ${(props) => props.marginRight};
  margin-left: ${(props) => props.marginLeft};
  align-items: ${(props) => props.align};
  justify-content: ${(props) => props.justify};
  width: ${(props) => props.width};
  height: ${(props) => props.height};
  min-height: ${(props) => props.minHeight};
  padding: ${(props) => props.padding};
  padding-left: ${(props) => props.paddingLeft};
  padding-right: ${(props) => props.paddingRight};
  flex-wrap: ${(props) => props.flexWrap};
`

export const Button = styled.button<{
  color: string
  backgroundColor: string
  borderColor?: string
  borderRadius?: string
  disabled?: boolean
  margin?: string
}>`
  display: inline-block;
  box-sizing: border-box;
  text-decoration: none;
  outline: none;
  cursor: ${(props) => !props.disabled && 'pointer'};
  text-align: center;
  font-style: normal;
  border-radius: ${(props) => props.borderRadius || '4px'};
  font-weight: 500;
  font-size: 15px;
  line-height: 20px;
  padding: 8px 16px;
  background-color: ${(props) => props.backgroundColor};
  color: ${(props) => props.color};
  border: ${(props) => (props.borderColor ? `1px solid ${props.borderColor}` : 'none')};
  margin: ${(props) => props.margin || '0'};
  user-select: none;
  transition: opacity 0.1s;
  opacity: ${(props) => (props.disabled ? 0.5 : 1)};
  &:hover,
  &:focus {
    opacity: ${(props) => (props.disabled ? 0.5 : 0.8)};
  }
`

export const PopupName = styled.h3<{
  marginTop?: string
  marginBottom?: string
  padding?: string
  isDelete?: boolean
  color: string
}>`
  font-style: normal;
  font-weight: 500;
  font-size: 20px;
  line-height: 23px;
  color: ${(props) => props.color};
  margin: 0;
  margin-top: ${(props: any) => props.marginTop};
  margin-bottom: ${(props: any) => props.marginBottom};
  padding: ${(props: any) => props.padding};
  word-break: break-word;

  ${(props: any) => {
    if (props.isDelete) {
      return `
            max-width: calc(100% - 20px);
            white-space: nowrap;
            text-overflow: ellipsis;
            overflow: hidden;
        `
    }

    return ''
  }}
`

export const ButtonBlock = styled.div<any>`
  display: flex;
  align-items: center;
  margin-top: ${(props) => props.marginTop || '10px'};
  padding-right: ${(props) => props.paddingRight || '0px'};
  justify-content: ${(props) => props.justify || 'flex-end'};
  height: ${(props) => props.height};
  min-height: ${(props) => props.height};
  background-color: ${(props) => props.backgroundColor};

  a {
    width: 88px;
    height: 40px;
    margin: 0 4px;
    font-size: 15px;
    font-weight: 500;
  }
`

export const Popup = styled.div<{
  minWidth?: string
  maxWidth?: string
  maxHeight?: string
  width?: string
  height?: string
  display?: string
  padding?: string
  backgroundColor: string
  isLoading?: boolean
}>`
  position: relative;
  min-height: 150px;
  min-width: ${(props) => props.minWidth || '400px'};
  max-width: ${(props) => props.maxWidth || '600px'};
  max-height: ${(props) => props.maxHeight || '650px'};
  width: ${(props) => props.width || 'unset'};
  height: ${(props) => props.height || 'unset'};
  display: ${(props) => props.display || 'flex'};
  flex-direction: column;
  padding: ${(props) => (props.padding ? props.padding : '22px 24px')};
  background: ${(props) => props.backgroundColor};
  border-radius: 8px;
  box-sizing: border-box;

  ${(props: any) =>
    props.isLoading &&
    `
        user-select: none;

        & > * {
           pointer-events: none;
           user-select: none;
        }

         ${ButtonBlock} {
          a, button {
            pointer-events: none;
            user-select: none;
            opacity: 0.7;
          }
        }
    `};
`

export const PopupBody = styled.div<{ withFooter?: boolean; paddingH?: string; paddingV?: string }>`
  padding: ${(props) => `${props.paddingV || 0} ${props.paddingH || 0}`};
  margin-bottom: 8px;
  height: ${(props) => (props.withFooter ? `calc(100% - (54px + ${props.paddingV}))` : 'calc(100% - 54px)')};
`

export const PopupDescription = styled.span<{ color: string; highlightColor: string }>`
  font-style: normal;
  font-weight: normal;
  font-size: 15px;
  line-height: 22px;
  color: ${(props) => props.color};
  cursor: default;
  white-space: pre-line;
  margin-top: ${(props: any) => props.marginTop || '10px'};
  margin-bottom: ${(props: any) => props.marginBottom || '10px'};
  word-break: break-word;

  .highlight {
    text-decoration: underline;
    font-weight: 500;
    color: ${(props) => props.highlightColor};
  }
`

export const BoltText = styled.span`
  font-weight: 500;
`
export const PopupFooter = styled(ButtonBlock)`
  margin-top: ${(props) => props.marginTop || '0'};
  padding: 8px 16px;
  border-radius: 0 0 8px 8px;
  z-index: 2;
`

export const SectionHeader = styled.h4<{
  color: string
  margin?: string
  theme?: string
  uppercase?: boolean
  fontSize?: string
  lineHeight?: string
}>`
  font-weight: 500;
  font-size: ${(props) => props.fontSize || '15px'};
  line-height: ${(props) => props.lineHeight || '20px'};
  color: ${(props) => props.color};
  margin: ${(props) => props.margin || 0};
  text-transform: ${(props) => props.uppercase && 'uppercase'};
`

export const ItemNote = styled.div<{ disabledColor: string; bgColor: string; direction: string }>`
  display: none;
  position: absolute;
  z-index: 301;
  padding: 10px 12px;
  background-color: ${(props) => props.bgColor};
  border-radius: 12px;
  font-size: 0.75rem;
  white-space: nowrap;
  font-weight: 600;
  color: white;
  pointer-events: none;
  user-select: none;

  & > svg {
    width: 20px;
    height: 20px;
    color: ${(props) => props.bgColor};
    fill: ${(props) => props.bgColor};
    position: absolute;
    top: 100%;
    left: calc(50% - 10px);
    path {
      fill: ${(props) => props.bgColor} !important;
    }
  }
  ${(props: any) =>
    props.visible &&
    `
       display: block;
    `} ${(props: any) =>
    props.direction === 'right' &&
    `
        top: 50%;
        left: calc(100% + 15px);
        transform: translateY(-50%);
    `} ${(props: any) =>
    props.direction === 'top' &&
    `
        bottom: calc(100% + 15px);
        left: 50%;
        transform: translateX(-50%);
    `} ${(props: any) => props.disabled && `color: ${(props: any) => props.disabledColor};`}
`
export const CustomSwitcher = styled.div`
  display: inline-block;
  position: relative;
`
export const SwitcherLabel = styled.label`
  width: 48px;
  height: 28px;
  background: rgb(226, 226, 226);
  display: inline-block;
  border-radius: 50px;
  position: relative;
  transition: all 0.3s ease;
  transform-origin: 20% center;
  border: 3px solid #fff;
  cursor: pointer;

  &:before {
    content: '';
    position: absolute;
    display: block;
    transition: all 0.2s ease;
    width: 24px;
    height: 24px;
    top: 2px;
    left: 2px;
    border-radius: 20px;
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.251475),
      0 2px 6px rgba(0, 0, 0, 0.404256);
    background: #fff;
  }
`
/* export const SwitcherInput = styled.input`
  display: none;

  &:checked + label {
    background-color: ${colors.cobalt1};

    &:before {
      transform: translateX(20px);
    }
  }
` */

export const UploadAvatarButton = styled.button<{ backgroundColor: string }>`
  display: block;
  height: 32px;
  margin-top: 8px;
  border: none;
  color: #fff;
  font-weight: 500;
  font-size: 14px;
  background: ${(props) => props.backgroundColor};
  border-radius: 4px;
  outline: none !important;
  cursor: pointer;
  padding: 7px 12px;
  line-height: 10px;
`
export const UploadAvatarHandler = styled.div<{ color: string }>`
  margin-left: 18px;
  font-size: 13px;
  color: ${(props) => props.color};
`

export const StyledText = styled.span<{
  color: string
  fontWeight?: string
  fontFamily?: string
  fontStyle?: string
  isLastMessage?: boolean
  textDecoration?: string
  letterSpacing?: string
  shouldOpenUserProfileForMention?: boolean
}>`
  font-weight: ${(props) => props.fontWeight || (props.isLastMessage && '500')};
  font-family: ${(props) => props.fontFamily};
  font-style: ${(props) => props.fontStyle};
  text-decoration: ${(props) => props.textDecoration};
  letter-spacing: ${(props) => props.letterSpacing};

  &.mention {
    color: ${(props) => props.color};
    font-weight: ${(props) => props.isLastMessage && '500'};
    cursor: ${(props) => props.shouldOpenUserProfileForMention && 'pointer'};
  }
  &.bold {
    font-weight: 600;
  }
  &.italic {
    font-style: italic;
  }
  &.underline {
    text-decoration: underline;
  }
  &.strikethrough {
    text-decoration: line-through;
  }
  &.underline.strikethrough {
    text-decoration: underline line-through;
  }
  &.monospace {
    letter-spacing: 4px;
  }
`

export const MessageOwner = styled.h3<{
  color: string
  rtlDirection?: boolean
  fontSize?: string
  clickable?: boolean
}>`
  margin: 0 12px 4px 0;
  white-space: nowrap;
  color: ${(props) => props.color};
  margin-left: ${(props) => props.rtlDirection && 'auto'};
  font-weight: 500;
  font-size: ${(props) => props.fontSize || '15px'};
  line-height: ${(props) => props.fontSize || '18px'};
  cursor: ${(props) => props.clickable && 'pointer'};
  overflow: hidden;
  text-overflow: ellipsis;
`

export const MessageText = styled.pre<{
  fontFamily?: string
  color: string
  withAttachment?: boolean
  fontSize?: string
  lineHeight?: string
  showMessageSenderName?: boolean
  isRepliedMessage?: boolean
  withMediaAttachment?: boolean
  isForwarded?: boolean
  withPaddings?: boolean
  theme: string
  outgoingMessageStyles?: IMessageStyles
  incomingMessageStyles?: IMessageStyles
  incoming: boolean
  linkColor: string
}>`
  display: flow-root;
  position: relative;
  font-family: ${(props) => props.fontFamily || 'sans-serif'};
  margin: 0;
  padding: ${(props) =>
    props.withAttachment &&
    (props.showMessageSenderName
      ? props.withPaddings
        ? '0 12px 10px'
        : '0 0 10px'
      : props.isForwarded
        ? props.withPaddings
          ? '4px 12px 10px'
          : '4px 0px 10px'
        : '8px 12px 10px')};
  padding-bottom: ${(props) => props.withAttachment && !props.withMediaAttachment && '2px'};
  //font-size: ${(props) => props.fontSize || '15px'};
  font-size: ${(props) => props.fontSize || '16px'};
  line-height: ${(props) => props.lineHeight || '20px'};
  font-weight: 400;
  word-wrap: break-word;
  white-space: pre-wrap;
  //white-space: normal;
  //letter-spacing: -0.2px;
  letter-spacing: 0.3px;
  color: ${(props) =>
    (props.incoming ? props?.incomingMessageStyles?.textColor : props?.outgoingMessageStyles?.textColor) ||
    props.color};
  user-select: text;
  //overflow: hidden;

  ${(props) =>
    props.isRepliedMessage &&
    `
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-overflow: ellipsis;
  `}

  &::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0;
    height: 1px;
  }

  & a {
    color: ${(props) => props.linkColor};
  }
`
export const ReplyMessageText = styled.span<{
  withAttachment?: boolean
  fontSize?: string
  lineHeight?: string
  showMessageSenderName?: boolean
  color: string
  linkColor: string
}>`
  display: -webkit-box;
  position: relative;
  margin: 0;
  padding: ${(props) =>
    props.withAttachment && props.showMessageSenderName ? '0 12px 10px' : props.withAttachment ? '8px 12px 10px' : ''};
  font-size: ${(props) => props.fontSize || '15px'};
  font-weight: 400;
  line-height: ${(props) => props.lineHeight || '20px'};
  letter-spacing: -0.2px;
  color: ${(props) => props.color};
  user-select: text;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;

  & a {
    color: ${(props) => props.linkColor};
  }
`

export const CloseIcon = styled(CloseSvg)`
  position: absolute;
  top: 13px;
  right: 13px;
  cursor: pointer;
  padding: 15px;
  box-sizing: content-box;
  color: ${(props) => props.color};
`

export const ClearTypedText = styled(CloseIcon)<{ color?: string }>`
  position: absolute;
  top: 8px;
  right: 10px;
  cursor: pointer;
  padding: 4px;
  color: ${(props) => props.color};
`

export const StyledSearchSvg = styled(SearchSvg)<{ color?: string }>`
  cursor: pointer;
  position: absolute;
  top: 12px;
  left: ${(props) => props.left || '14px'};
  color: ${(props) => props.color};
`
export const SubTitle = styled.span<{ color: string; margin?: string; fontSize?: string; lineHeight?: string }>`
  font-size: ${(props) => props.fontSize || '13px'};
  line-height: ${(props) => props.lineHeight || '16px'};
  letter-spacing: -0.078px;
  color: ${(props) => props.color};
  margin: ${(props) => props.margin};
`

export const AttachmentIconCont = styled.span<{ backgroundColor: string }>`
  display: inline-flex;
  width: 40px;
  height: 40px;
  background-color: ${(props) => props.backgroundColor};
  border-radius: 50%;
`

export const UploadingIcon = styled.span<{
  width?: string
  height?: string
  color?: string
  borderWidth?: string
  fileAttachment?: boolean
  isRepliedMessage?: boolean
}>`
  display: inline-block;
  border-style: solid;
  border-color: ${(props) => props.color || 'rgba(255, 255, 255, 0.8)'};
  border-width: ${(props) => props.borderWidth || (props.fileAttachment ? '2px' : '3px')};
  border-top-width: ${(props) => props.borderWidth || (props.fileAttachment ? '2px' : '3px')};
  border-top-color: rgba(0, 0, 0, 0);
  border-radius: 50%;
  width: ${(props) => props.width || (props.fileAttachment ? '26px' : props.isRepliedMessage ? '28px' : '40px')};
  height: ${(props) => props.height || (props.fileAttachment ? '26px' : props.isRepliedMessage ? '28px' : '40px')};

  animation: preloader 1.5s linear infinite;

  @keyframes preloader {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
`

export const TextInOneLine = styled.span`
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
`
export const CancelResumeWrapper = styled.span<{ isRepliedMessage?: boolean; onClick?: any }>`
  position: absolute;
  width: 20px;
  height: 20px;
  z-index: 3;

  > svg {
    width: 20px;
    height: 20px;
  }
`
export const UploadPercent = styled.span<{
  fileAttachment?: boolean
  isDetailsView?: boolean
  isRepliedMessage?: boolean
  borderRadius?: string
  backgroundColor?: string
}>`
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  color: #fff;
  width: ${(props) => (props.fileAttachment || props.isRepliedMessage || props.isDetailsView ? '40px' : '56px')};
  height: ${(props) => (props.fileAttachment || props.isRepliedMessage || props.isDetailsView ? '40px' : '56px')};
  background-color: ${(props) => `${props.backgroundColor}66`};
  border-radius: ${(props) =>
    props.borderRadius ? props.borderRadius : props.fileAttachment ? '8px' : props.isRepliedMessage ? '4px' : ' 50%'};
}
  ${(props) =>
    (props.fileAttachment || props.isRepliedMessage) &&
    `& > svg {
    width: 15px;
    height: 15px;
  }`}
`

export const UploadProgress = styled.div<{
  positionStatic?: boolean
  isFailedAttachment?: boolean
  whiteBackground?: boolean
  fileAttachment?: boolean
  withPrefix?: boolean
  isRepliedMessage?: boolean
  onClick?: any
  backgroundImage?: string
  borderRadius?: string
  width?: number
  height?: number
  withBorder?: boolean
  isDetailsView?: boolean
  backgroundColor?: string
  imageMinWidth?: string
  zIndex?: number
  borderColor: string
}>`
  position: ${(props) => !props.positionStatic && 'absolute'};
  top: ${(props) => (props.fileAttachment ? '8px' : '0')};
  left: ${(props) => (props.fileAttachment ? '12px' : '0')};
  width: ${(props) =>
    props.fileAttachment || props.isRepliedMessage ? '40px' : props.width ? `${props.width}px` : '100%'};
  height: ${(props) =>
    props.fileAttachment || props.isRepliedMessage ? '40px' : props.height ? `${props.height}px` : '100%'};
  min-width: ${(props) => (!props.fileAttachment && !props.isRepliedMessage ? props.imageMinWidth || '165px' : null)};
  min-height: ${(props) => !props.fileAttachment && !props.isRepliedMessage && !props.isDetailsView && '165px'};
  display: flex;
  //display: none;
  align-items: center;
  justify-content: center;
  //border-radius: ${(props) => (props.fileAttachment ? '8px' : props.isRepliedMessage ? '4px' : ' 50%')};
  background-image: url(${(props) =>
    props.backgroundImage && `${props.withPrefix ? 'data:image/jpeg;base64,' : ''}${props.backgroundImage}`});
  background-size: cover;
  background-position: center;
  border-radius: ${(props) =>
    props.fileAttachment ? '8px' : props.borderRadius ? props.borderRadius : props.isRepliedMessage ? '4px' : '8px'};
  z-index: ${(props) => props.zIndex || 5};
  cursor: pointer;
  border: ${(props) =>
    props.isRepliedMessage
      ? '0.5px solid rgba(0, 0, 0, 0.1)'
      : props.withBorder && `2px solid ${props.backgroundColor}`};
  box-sizing: border-box;
  /* ${(props) => props.isFailedAttachment && 'background-color: rgba(237, 77, 96, 0.1);'}*/
  ${(props) =>
    props.whiteBackground &&
    `
    background-color: rgba(255,255,255,0.3);
    border: 1px solid  ${props.borderColor};

    ${UploadingIcon} {
        border: 4px solid rgba(238,238,238,0.8);
        border-top: 4px solid ${props.borderColor};
    }
  `}
  ${(props) =>
    props.isDetailsView &&
    `
    width: 100%;
    height: 100%;
    min-width: inherit;
  `}
`

export const AttachmentPreviewTitle = styled.span<{ color: string; fontSize?: string; lineHeight?: string }>`
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  max-width: calc(100% - 20px);
  font-style: normal;
  font-weight: normal;
  font-size: ${(props) => props.fontSize || '15px'};
  line-height: ${(props) => props.lineHeight || '20px'};
  height: ${(props) => props.lineHeight || '20px'};
  color: ${(props) => props.color};
`
