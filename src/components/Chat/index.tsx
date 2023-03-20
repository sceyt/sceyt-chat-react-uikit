import React, { useEffect } from 'react'
import styled from 'styled-components'
import { shallowEqual, useSelector } from 'react-redux'
import { channelInfoIsOpenSelector, channelListWidthSelector } from '../../store/channel/selector'

interface IProps {
  children?: JSX.Element | JSX.Element[]
}

export default function Chat({ children }: IProps) {
  const channelListWidth = useSelector(channelListWidthSelector, shallowEqual)
  const channelDetailsIsOpen = useSelector(channelInfoIsOpenSelector, shallowEqual)

  useEffect(() => {})
  return (
    <Container widthOffset={channelListWidth} channelDetailsIsOpen={channelDetailsIsOpen}>
      {children}
    </Container>
  )
}

const Container = styled.div<{ widthOffset: number; channelDetailsIsOpen?: boolean }>`
  position: relative;
  width: 100%;
  max-width: ${(props) =>
    props.widthOffset || props.channelDetailsIsOpen
      ? `calc(100% - ${props.widthOffset + (props.channelDetailsIsOpen ? 362 : 0)}px)`
      : ''};
  display: flex;
  flex-direction: column;
`
