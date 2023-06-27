import React, { useEffect } from 'react'
import styled from 'styled-components'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import {
  activeChannelSelector,
  addedToChannelSelector,
  channelInfoIsOpenSelector,
  channelListWidthSelector
} from '../../store/channel/selector'
import { getChannelsAC, setActiveChannelAC, setHideChannelListAC } from '../../store/channel/actions'
import { IChannel } from '../../types'
import { useDidUpdate } from '../../hooks'

interface IProps {
  hideChannelList?: boolean
  children?: JSX.Element | JSX.Element[]
  onActiveChannelUpdated?: (activeChannel: IChannel) => void
}

export default function Chat({ children, hideChannelList, onActiveChannelUpdated }: IProps) {
  const dispatch = useDispatch()
  const channelListWidth = useSelector(channelListWidthSelector, shallowEqual)
  const channelDetailsIsOpen = useSelector(channelInfoIsOpenSelector, shallowEqual)
  const addedChannel = useSelector(addedToChannelSelector)
  const activeChannel = useSelector(activeChannelSelector)

  useEffect(() => {
    if (hideChannelList && !channelListWidth) {
      dispatch(setHideChannelListAC(true))
      dispatch(getChannelsAC({ filter: {}, limit: 1, sort: 'byLastMessage', search: '' }, false))
    }
  }, [channelListWidth])

  useEffect(() => {
    if (onActiveChannelUpdated) {
      onActiveChannelUpdated(activeChannel)
    }
  }, [activeChannel])

  useDidUpdate(() => {
    if (hideChannelList && (!activeChannel || !activeChannel.id) && addedChannel && addedChannel.id) {
      dispatch(setActiveChannelAC(addedChannel))
    }
  }, [addedChannel])

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
      ? `calc(100% - ${props.widthOffset + (props.channelDetailsIsOpen ? 402 : 0)}px)`
      : ''};
  display: flex;
  flex-direction: column;
`
