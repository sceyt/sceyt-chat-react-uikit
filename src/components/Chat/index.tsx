import React, { FC, useEffect, useState } from 'react'
import styled from 'styled-components'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
// Store
import {
  activeChannelSelector,
  addedChannelSelector,
  addedToChannelSelector,
  channelInfoIsOpenSelector,
  channelListWidthSelector,
  channelsSelector
} from '../../store/channel/selector'
import {
  getChannelsAC,
  setActiveChannelAC,
  setHideChannelListAC,
  switchChannelActionAC
} from '../../store/channel/actions'
// Assets
import { ReactComponent as MessageIcon } from '../../assets/svg/message.svg'
// Hooks
import { useDidUpdate } from '../../hooks'
// Helpers
import { IChannel } from '../../types'
import { getAutoSelectFitsChannel, setActiveChannelId } from '../../helpers/channelHalper'
import { colors } from '../../UIHelper/constants'
import { themeSelector } from '../../store/theme/selector'
import { getThemeColors } from '../../store/currentTheme/selector'

interface IProps {
  hideChannelList?: boolean
  className?: string
  children?: JSX.Element | JSX.Element[]
  // eslint-disable-next-line no-unused-vars
  onActiveChannelUpdated?: (activeChannel: IChannel) => void
  setActiveChannel?: (channel: IChannel) => void
  CustomChannelHandler?: FC<{
    channels: IChannel[]
    activeChannel?: IChannel
    setActiveChannel?: (channel: IChannel) => void
  }>
  noChannelSelectedBackgroundColor?: string
  CustomNoChannelSelected?: JSX.Element
}

let detailsSwitcherTimeout: NodeJS.Timeout

export default function Chat({
  children,
  hideChannelList,
  onActiveChannelUpdated,
  CustomChannelHandler,
  className,
  noChannelSelectedBackgroundColor,
  CustomNoChannelSelected
}: IProps) {
  const dispatch = useDispatch()
  const channelListWidth = useSelector(channelListWidthSelector, shallowEqual)
  const channelDetailsIsOpen = useSelector(channelInfoIsOpenSelector, shallowEqual)
  const channels = useSelector(channelsSelector, shallowEqual)
  const theme = useSelector(themeSelector, shallowEqual)
  const themeColors = useSelector(getThemeColors)
  const addedChannel = useSelector(addedToChannelSelector)
  const channelCreated = useSelector(addedChannelSelector)
  const activeChannel = useSelector(activeChannelSelector)
  const autoSelectChannel = getAutoSelectFitsChannel()
  const [channelDetailsWidth, setChannelDetailsWidth] = useState<number>(0)

  const handleChangeActiveChannel = (chan: IChannel) => {
    if (activeChannel && chan && activeChannel.id !== chan.id) {
      dispatch(switchChannelActionAC(chan))
    }
  }

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
    if (hideChannelList && (!activeChannel || !activeChannel.id) && channelCreated && channelCreated.id) {
      setActiveChannelId(channelCreated.id)
      dispatch(setActiveChannelAC(channelCreated))
    }
  }, [channelCreated])

  useDidUpdate(() => {
    if (hideChannelList && (!activeChannel || !activeChannel.id) && addedChannel && addedChannel.id) {
      setActiveChannelId(addedChannel.id)
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
    <Container className={className} widthOffset={channelListWidth} channelDetailsWidth={channelDetailsWidth}>
      {CustomChannelHandler && (
        <ChannelHandlerWrapper>
          <CustomChannelHandler
            channels={channels}
            activeChannel={activeChannel}
            setActiveChannel={handleChangeActiveChannel}
          />
        </ChannelHandlerWrapper>
      )}
      {!autoSelectChannel && (!activeChannel || !activeChannel.id) && (
        <SelectChatContainer
          backgroundColor={noChannelSelectedBackgroundColor || (theme && theme.backgroundColor) || colors.white}
        >
          {CustomNoChannelSelected || (
            <SelectChatContent iconColor={themeColors.accent}>
              <MessageIcon />
              <SelectChatTitle>Select a chat</SelectChatTitle>
              <SelectChatDescription>Please select a chat to start messaging.</SelectChatDescription>
            </SelectChatContent>
          )}
        </SelectChatContainer>
      )}
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

const SelectChatContainer = styled.div<{ backgroundColor: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background: ${(props) => props.backgroundColor};
  z-index: 99;
`

const SelectChatContent = styled.div<{ iconColor?: string }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  & > svg {
    color: ${(props) => props.iconColor};
  }
`

const SelectChatTitle = styled.h3`
  font-size: 20px;
  font-style: normal;
  font-weight: 500;
  line-height: 24px;
  color: ${colors.textColor1};
  margin: 24px 0 8px;
`
const SelectChatDescription = styled.p`
  font-size: 16px;
  font-style: normal;
  font-weight: 400;
  line-height: 22px;
  margin: 0;
  color: ${colors.textColor2};
`

const ChannelHandlerWrapper = styled.div`
  display: none;
`
