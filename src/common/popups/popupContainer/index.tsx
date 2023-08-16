import React, { useEffect } from 'react'
import styled from 'styled-components'

const PopupContainer = ({ children }: any) => {
  // const [popupContainerDimensions, setPopupContainerDimensions] = useState<any>({})
  useEffect(() => {
    /* const sceytChatContainer = document.getElementById('sceyt_chat_container')
    if (sceytChatContainer) {
      const rect = sceytChatContainer.getBoundingClientRect()
      setPopupContainerDimensions({
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left
      })
    } */
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
  return (
    <Container
    // width={popupContainerDimensions.width}
    // height={popupContainerDimensions.height}
    // left={popupContainerDimensions.left}
    // top={popupContainerDimensions.top}
    >
      {children}
    </Container>
  )
}

export default PopupContainer

const Container = styled.div<{ width?: number; height?: number; left?: number; top?: number }>`
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
  background: rgba(0, 0, 0, 0.4);
`
