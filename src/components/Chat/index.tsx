import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
import { shallowEqual } from 'react-redux'
import { useSelector, useDispatch } from 'store/hooks'
// Store
import {
  activeChannelSelector,
  addedChannelSelector,
  addedToChannelSelector,
  channelInfoIsOpenSelector,
  channelListWidthSelector
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
import { useDidUpdate, useColor } from '../../hooks'
// Helpers
import { IChannel } from '../../types'
import { getAutoSelectFitsChannel, getChannelMembersCount, setActiveChannelId } from '../../helpers/channelHalper'
import { THEME_COLORS } from '../../UIHelper/constants'
import { connectionStatusSelector } from 'store/user/selector'
import { CONNECTION_STATUS } from 'store/user/constants'

interface IProps {
  hideChannelList?: boolean
  className?: string
  children?: JSX.Element | JSX.Element[]
  onSelectedChannelUpdated?: (selectedChannel: IChannel) => void
  selectedChannelId?: string
  noChannelSelectedBackgroundColor?: string
  CustomNoChannelSelected?: JSX.Element
}

let detailsSwitcherTimeout: NodeJS.Timeout

export default function Chat({
  children,
  hideChannelList,
  onSelectedChannelUpdated,
  selectedChannelId,
  className,
  noChannelSelectedBackgroundColor,
  CustomNoChannelSelected
}: IProps) {
  const {
    [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.BACKGROUND]: background,
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary
  } = useColor()

  const dispatch = useDispatch()
  const channelListWidth = useSelector(channelListWidthSelector, shallowEqual)
  const channelDetailsIsOpen = useSelector(channelInfoIsOpenSelector, shallowEqual)
  const addedChannel = useSelector(addedToChannelSelector)
  const channelCreated = useSelector(addedChannelSelector)
  const activeChannel = useSelector(activeChannelSelector)
  const autoSelectChannel = getAutoSelectFitsChannel()
  const [channelDetailsWidth, setChannelDetailsWidth] = useState<number>(0)
  const connectionStatus = useSelector(connectionStatusSelector, shallowEqual)

  useEffect(() => {
    if (hideChannelList && !channelListWidth && connectionStatus === CONNECTION_STATUS.CONNECTED) {
      dispatch(setHideChannelListAC(true))
      dispatch(
        getChannelsAC(
          { filter: {}, limit: 1, sort: 'byLastMessage', search: '', memberCount: getChannelMembersCount() },
          false
        )
      )
    }
  }, [channelListWidth, connectionStatus])

  useEffect(() => {
    if (onSelectedChannelUpdated) {
      onSelectedChannelUpdated(activeChannel)
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
      dispatch(switchChannelActionAC(addedChannel))
    }
  }, [addedChannel])

  useDidUpdate(() => {
    if (selectedChannelId && (activeChannel ? activeChannel.id !== selectedChannelId : true)) {
      dispatch(switchChannelActionAC({ id: selectedChannelId } as IChannel))
    }
  }, [selectedChannelId])

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
      {!autoSelectChannel && (!activeChannel || !activeChannel.id) && (
        <SelectChatContainer backgroundColor={noChannelSelectedBackgroundColor || background}>
          {CustomNoChannelSelected || (
            <SelectChatContent iconColor={accentColor}>
              <MessageIcon />
              <SelectChatTitle color={textPrimary}> Select a chat</SelectChatTitle>
              <SelectChatDescription color={textSecondary}>
                Please select a chat to start messaging.
              </SelectChatDescription>
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

const SelectChatContent = styled.div<{ iconColor: string }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  & > svg {
    color: ${(props) => props.iconColor};
  }
`

const SelectChatTitle = styled.h3<{ color: string }>`
  font-size: 20px;
  font-style: normal;
  font-weight: 500;
  line-height: 24px;
  color: ${(props) => props.color};
  margin: 24px 0 8px;
`
const SelectChatDescription = styled.p<{ color: string }>`
  font-size: 16px;
  font-style: normal;
  font-weight: 400;
  line-height: 22px;
  margin: 0;
  color: ${(props) => props.color};
`
