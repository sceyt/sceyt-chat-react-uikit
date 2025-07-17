import { useColor } from 'hooks'
import React, { useEffect } from 'react'
import styled from 'styled-components'
import { THEME_COLORS } from 'UIHelper/constants'

const PopupContainer = ({ children }: any) => {
  const { [THEME_COLORS.OVERLAY_BACKGROUND]: overlayBackground } = useColor()
  useEffect(() => {
    const body = document.querySelector('body')
    if (body) {
      body.style.overflow = 'hidden'
    }

    return () => {
      if (body) {
        body.style.overflow = 'auto'
      }
    }
  }, [])
  return <Container background={overlayBackground}>{children}</Container>
}

export default PopupContainer

const Container = styled.div<{ width?: number; height?: number; left?: number; top?: number; background: string }>`
  direction: initial;
  position: fixed;
  top: 0;
  left: 0;
  //top: ${(props) => (props.top ? `${props.top}px` : '0px')};
  //left: ${(props) => (props.left ? `${props.left}px` : '0px')};
  z-index: 200;
  //width: ${(props) => (props.width ? `${props.width}px` : '0px')};
  //height: ${(props) => (props.height ? `${props.height}px` : '0px')};
  width: 100%;
  height: 100%;
  overflow: auto;
  display: flex;
  justify-content: center;
  align-items: center;
  background: ${(props) => props.background};
`
