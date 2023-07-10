import styled from 'styled-components'
import { colors } from '../../UIHelper/constants'

export const Container = styled.div`
  display: flex;
  height: 100vh;
`

export const ChatContainer = styled.div<{ withChannelsList: boolean; backgroundColor?: string }>`
  display: flex;
  height: 100%;
  max-height: 100vh;
  min-width: ${(props) => props.withChannelsList && '1200px'};
  background-color: ${(props) => props.backgroundColor || colors.white};
`

export const Chat = styled.div`
  display: flex;
`
