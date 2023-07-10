import React, { useEffect, useState } from 'react'
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

let detailsSwitcherTimeout: NodeJS.Timeout

export default function Chat({ children, hideChannelList, onActiveChannelUpdated }: IProps) {
  const dispatch = useDispatch()
  const channelListWidth = useSelector(channelListWidthSelector, shallowEqual)
  const channelDetailsIsOpen = useSelector(channelInfoIsOpenSelector, shallowEqual)
  const addedChannel = useSelector(addedToChannelSelector)
  const activeChannel = useSelector(activeChannelSelector)
  const [channelDetailsWidth, setChannelDetailsWidth] = useState<number>(0)

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

  useDidUpdate(() => {
    if (channelDetailsIsOpen) {
      detailsSwitcherTimeout = setTimeout(() => {
        const detailsContainer = document.getElementById('channel_details_wrapper')
        if (detailsContainer) {
          setChannelDetailsWidth(detailsContainer.offsetWidth)
        }
      }, 1)
    } else {
      clearTimeout(detailsSwitcherTimeout)
      setChannelDetailsWidth(0)
    }
  }, [channelDetailsIsOpen])

  return (
    <Container widthOffset={channelListWidth} channelDetailsWidth={channelDetailsWidth}>
      {children}
    </Container>
  )
}

const Container = styled.div<{ widthOffset: number; channelDetailsWidth?: number }>`
  position: relative;
  width: 100%;
  max-width: ${(props) =>
    props.widthOffset || props.channelDetailsWidth
      ? `calc(100% - ${props.widthOffset + (props.channelDetailsWidth ? props.channelDetailsWidth + 1 : 0)}px)`
      : ''};
  display: flex;
  transition: all 0.1s;
  flex-direction: column;
`
