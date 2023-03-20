import styled from 'styled-components'

export const Container = styled.div`
  display: flex;
  height: 100vh;
`

export const ChatContainer = styled.div<{ withHeader: any }>`
  display: flex;
  //height: ${(props) => (props.withHeader ? 'calc(100vh - 60px)' : '100vh')};
  height: 100%;
  min-width: 1200px;
`

export const Chat = styled.div`
  display: flex;
`
