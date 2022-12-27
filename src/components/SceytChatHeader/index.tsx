import React from 'react'
import styled from 'styled-components'
import { ReactComponent as ChatLogoSVG } from '../../assets/svg/chatLogo.svg'
// import Profile from './Profile';
// import ConnectionStatus from './ConnectionStatus';
import { colors } from '../../UIHelper/constants'

const Container = styled.div`
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 60px;
  flex: none;
  background-color: ${colors.blue10};
`

const Logo = styled.div`
  width: 134px;
  height: 22px;
`

function SceytChatHeader() {
  return (
    <Container>
      <Logo>
        <ChatLogoSVG />
      </Logo>
      {/* <ConnectionStatus /> */}
      {/* <Profile /> */}
    </Container>
  )
}

export default SceytChatHeader
