import React, { useEffect } from 'react'
import styled from 'styled-components'
import { THEME_COLORS } from '../../UIHelper/constants'
import { useColor } from '../../hooks'

export const Container = styled.div<{
  chatBackgroundColor?: string
  noMargin?: boolean
  marginTop?: string
  marginBottom?: string
  dividerVisibility?: boolean
  width?: string
  dateDividerBorder?: string
  dateDividerFontSize?: string
  dateDividerTextColor?: string
  dateDividerBackgroundColor?: string
  newMessagesSeparatorSpaceColor: string
  dateDividerBorderRadius?: string
  newMessagesSeparatorLeftRightSpaceWidth?: string
  height?: number
}>`
  text-align: center;
  margin: ${(props) => (props.noMargin ? '0 auto' : `${props.marginTop || '16px'} auto 0`)};
  margin-bottom: ${(props) => props.marginBottom || '0'};
  display: ${(props) => (props.dividerVisibility ? 'flex' : 'none')};
  align-items: center;
  width: ${(props) => props.width || '100%'};
  height: ${(props) => (props.height ? `${props.height}px` : '25px')};
  z-index: 5;
  top: 0;
  background: transparent;
  max-width: calc(100% - 8px);

  div {
    position: relative;
    border-bottom: ${(props) => props.dateDividerBorder};
    width: 100%;
    display: flex;
    justify-content: center;
    background: transparent;
    span {
      position: absolute;
      top: -18px;
      font-style: normal;
      font-weight: normal;
      font-size: ${(props) => props.dateDividerFontSize || '14px'};
      color: ${(props) => props.dateDividerTextColor};
      background-color: ${(props) => `${props.dateDividerBackgroundColor}40`};
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
        top: 50%;
        height: 2px;
        width: ${(props) =>
          props.newMessagesSeparatorLeftRightSpaceWidth ? `${props.newMessagesSeparatorLeftRightSpaceWidth}` : '0'};
        background-color: ${(props) => props.newMessagesSeparatorSpaceColor};
      }

      &::after {
        content: '';
        position: absolute;
        right: ${(props) =>
          props.newMessagesSeparatorLeftRightSpaceWidth
            ? `-${props.newMessagesSeparatorLeftRightSpaceWidth}`
            : '-12px'};
        top: 50%;
        height: 2px;
        width: ${(props) =>
          props.newMessagesSeparatorLeftRightSpaceWidth ? `${props.newMessagesSeparatorLeftRightSpaceWidth}` : '0'};
        background-color: ${(props) => props.newMessagesSeparatorSpaceColor};
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
  newMessagesSeparatorTextColor?: string
  newMessagesSeparatorFontSize?: string
  newMessagesSeparatorWidth?: string
  newMessagesSeparatorBorder?: string
  newMessagesSeparatorBorderRadius?: string
  newMessagesSeparatorBackground?: string
  newMessagesSeparatorLeftRightSpaceWidth?: string
  newMessagesSeparatorSpaceColor?: string
  noMargin?: boolean
  marginBottom?: string
  marginTop?: string
  chatBackgroundColor?: string
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
  newMessagesSeparatorTextColor,
  newMessagesSeparatorFontSize,
  newMessagesSeparatorWidth,
  newMessagesSeparatorBorder,
  newMessagesSeparatorBorderRadius,
  newMessagesSeparatorBackground,
  newMessagesSeparatorLeftRightSpaceWidth,
  newMessagesSeparatorSpaceColor,
  noMargin,
  marginTop,
  theme,
  marginBottom,
  chatBackgroundColor
}: IProps) {
  const {
    [THEME_COLORS.TEXT_ON_PRIMARY]: textOnPrimary,
    [THEME_COLORS.OVERLAY_BACKGROUND]: overlayBackground,
    [THEME_COLORS.BORDER]: border
  } = useColor()

  const textRef = React.useRef<HTMLSpanElement | null>(null)
  const [textHeight, setTextHeight] = React.useState<number>(0)

  useEffect(() => {
    if (textRef.current) {
      setTextHeight(textRef.current.offsetHeight)
    }
  }, [textRef])
  return (
    <Container
      className={unread ? 'unread' : 'divider'}
      theme={theme}
      marginTop={marginTop}
      dividerVisibility={!visibility || unread}
      dateDividerFontSize={dateDividerFontSize || newMessagesSeparatorFontSize}
      dateDividerTextColor={dateDividerTextColor || newMessagesSeparatorTextColor || textOnPrimary}
      dateDividerBorder={dateDividerBorder || newMessagesSeparatorBorder}
      dateDividerBackgroundColor={dateDividerBackgroundColor || newMessagesSeparatorBackground || overlayBackground}
      chatBackgroundColor={chatBackgroundColor}
      dateDividerBorderRadius={dateDividerBorderRadius || newMessagesSeparatorBorderRadius}
      width={newMessagesSeparatorWidth}
      newMessagesSeparatorLeftRightSpaceWidth={newMessagesSeparatorLeftRightSpaceWidth}
      newMessagesSeparatorSpaceColor={newMessagesSeparatorSpaceColor || border}
      noMargin={noMargin}
      marginBottom={marginBottom}
      height={textHeight}
    >
      <div>
        <span ref={textRef}>{dividerText}</span>
      </div>
    </Container>
  )
}
