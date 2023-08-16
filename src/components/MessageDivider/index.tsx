import React from 'react'
import styled from 'styled-components'
import { colors } from '../../UIHelper/constants'
import { THEME } from '../../helpers/constants'

export const Container = styled.div<any>`
  text-align: center;
  margin: ${(props) => (props.noMargin ? '0 auto' : `${props.marginTop || '16px'} auto 0`)};
  margin-bottom: ${(props) => (props.marginBottom ? '8px' : '0')};
  display: ${(props) => (props.dividerVisibility ? 'flex' : 'none')};
  align-items: center;
  width: ${(props) => props.width || '100%'};
  height: 26px;
  z-index: 5;
  top: 0;
  background: transparent;
  div {
    position: relative;
    border-bottom: ${(props) => props.dateDividerBorder};
    width: 100%;
    display: flex;
    justify-content: center;
    background: transparent;
    span {
      position: absolute;
      top: -13px;
      font-style: normal;
      font-weight: normal;
      font-size: ${(props) => props.dateDividerFontSize || '14px'};
      color: ${(props) => props.dateDividerTextColor || colors.textColor1};
      background: ${(props) => props.dateDividerBackgroundColor};
      //border: ${(props) => props.dateDividerBorder || `1px solid ${colors.gray1}`};
      box-sizing: border-box;
      border-radius: ${(props) => props.dateDividerBorderRadius || '14px'};
      padding: 5px 16px;

      &::before {
        content: '';
        position: absolute;
        left: ${(props) =>
          props.newMessagesSeparatorLeftRightSpaceWidth
            ? `-${props.newMessagesSeparatorLeftRightSpaceWidth}`
            : '-12px'};
        top: 0;
        height: 100%;
        width: ${(props) =>
          props.newMessagesSeparatorLeftRightSpaceWidth ? `${props.newMessagesSeparatorLeftRightSpaceWidth}` : '12px'};
        background-color: ${(props) => (props.theme === THEME.DARK ? colors.dark : colors.white)};
      }

      &::after {
        content: '';
        position: absolute;
        right: ${(props) =>
          props.newMessagesSeparatorLeftRightSpaceWidth
            ? `-${props.newMessagesSeparatorLeftRightSpaceWidth}`
            : '-12px'};
        top: 0;
        height: 100%;
        width: ${(props) =>
          props.newMessagesSeparatorLeftRightSpaceWidth ? `${props.newMessagesSeparatorLeftRightSpaceWidth}` : '12px'};
        background-color: ${(props) => (props.theme === THEME.DARK ? colors.dark : colors.white)};
      }
    }
  }
`

interface IProps {
  dividerText: string
  theme?: string
  visibility?: boolean
  unread?: boolean
  dateDividerFontSize?: string
  dateDividerTextColor?: string
  dateDividerBorder?: string
  dateDividerBackgroundColor?: string
  dateDividerBorderRadius?: string
  systemMessage?: boolean
  newMessagesSeparatorTextColor?: string
  newMessagesSeparatorFontSize?: string
  newMessagesSeparatorWidth?: string
  newMessagesSeparatorBorder?: string
  newMessagesSeparatorBorderRadius?: string
  newMessagesSeparatorBackground?: string
  newMessagesSeparatorLeftRightSpaceWidth?: string
  noMargin?: boolean
  marginBottom?: boolean
  marginTop?: string
}

export default function MessageDivider({
  dividerText,
  visibility,
  unread,
  dateDividerFontSize,
  dateDividerTextColor,
  dateDividerBorder,
  dateDividerBackgroundColor,
  dateDividerBorderRadius,
  systemMessage,
  newMessagesSeparatorTextColor,
  newMessagesSeparatorFontSize,
  newMessagesSeparatorWidth,
  newMessagesSeparatorBorder,
  newMessagesSeparatorBorderRadius,
  newMessagesSeparatorBackground,
  newMessagesSeparatorLeftRightSpaceWidth,
  noMargin,
  marginTop,
  theme,
  marginBottom
}: IProps) {
  return (
    <Container
      className={unread ? 'unread' : 'divider'}
      theme={theme}
      systemMessage={systemMessage}
      marginTop={marginTop}
      dividerVisibility={!visibility || unread}
      dateDividerFontSize={dateDividerFontSize || newMessagesSeparatorFontSize}
      dateDividerTextColor={dateDividerTextColor || newMessagesSeparatorTextColor || colors.textColor1}
      dateDividerBorder={dateDividerBorder || newMessagesSeparatorBorder}
      dateDividerBackgroundColor={
        dateDividerBackgroundColor || newMessagesSeparatorBackground || colors.backgroundColor
      }
      dateDividerBorderRadius={dateDividerBorderRadius || newMessagesSeparatorBorderRadius}
      width={newMessagesSeparatorWidth}
      newMessagesSeparatorLeftRightSpaceWidth={newMessagesSeparatorLeftRightSpaceWidth}
      noMargin={noMargin}
      marginBottom={marginBottom}
    >
      <div>
        <span>{dividerText}</span>
      </div>
    </Container>
  )
}
