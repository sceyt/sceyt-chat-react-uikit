import React, { useEffect, useRef, useState } from 'react'
import { Popup, PopupName, CloseIcon, PopupBody, Button, PopupFooter } from '../../../UIHelper'
import { colors } from '../../../UIHelper/constants'
import styled from 'styled-components'
import { getChannelsForForwardAC, loadMoreChannelsForForward } from '../../../store/channel/actions'
import { useDispatch, useSelector } from 'react-redux'
import {
  channelsForForwardHasNextSelector,
  channelsForForwardSelector,
  channelsLoadingState
} from '../../../store/channel/selector'
import { IChannel, IMember } from '../../../types'
import ChannelSearch from '../../../components/ChannelList/ChannelSearch'
import { Avatar } from '../../../components'
import { CHANNEL_TYPE, LOADING_STATE, PRESENCE_STATUS } from '../../../helpers/constants'
import { userLastActiveDateFormat } from '../../../helpers'
import { makeUsername } from '../../../helpers/message'
import { contactsMapSelector } from '../../../store/user/selector'
import { getShowOnlyContactUsers } from '../../../helpers/contacts'
import CustomCheckbox from '../../customCheckbox'

import { ReactComponent as CrossIcon } from '../../../assets/svg/cross.svg'
import { hideUserPresence } from '../../../helpers/userHelper'
import { getClient } from '../../client'
import PopupContainer from '../popupContainer'

interface ISelectedChannelsData {
  id: string
  displayName: string
}

interface IProps {
  title: string
  buttonText: string
  togglePopup: () => void
  handleForward: (channelIds: string[]) => void
  loading?: boolean
}

function ForwardMessagePopup({ title, buttonText, togglePopup, handleForward, loading }: IProps) {
  const ChatClient = getClient()
  const { user } = ChatClient
  const dispatch = useDispatch()
  const channels = useSelector(channelsForForwardSelector) || []
  const contactsMap = useSelector(contactsMapSelector)
  const getFromContacts = getShowOnlyContactUsers()
  const channelsLoading = useSelector(channelsLoadingState)
  const channelsHasNext = useSelector(channelsForForwardHasNextSelector)
  const [searchValue, setSearchValue] = useState('')
  const [selectedChannelsContHeight, setSelectedChannelsHeight] = useState(0)
  const [selectedChannels, setSelectedChannels] = useState<ISelectedChannelsData[]>([])
  const [channelIds, setChannelIds] = useState<string[]>([])
  const selectedChannelsContRef = useRef<any>()

  const handleForwardMessage = () => {
    handleForward(channelIds)
    togglePopup()
  }

  const handleChannelListScroll = (event: any) => {
    // setCloseMenu(true)
    if (event.target.scrollTop >= event.target.scrollHeight - event.target.offsetHeight - 100) {
      if (channelsLoading === LOADING_STATE.LOADED && channelsHasNext) {
        dispatch(loadMoreChannelsForForward(15))
      }
    }
  }
  const handleChoseChannel = (e: any, channelId: string) => {
    if (e.target.checked) {
      setChannelIds((prevState) => [...prevState, channelId])
    }
  }

  const handleSearchValueChange = (e: any) => {
    const { value } = e.target
    setSearchValue(value)
  }

  const getMyChannels = () => {
    setSearchValue('')
  }

  const handleChannelSelect = (event: any, channel: IChannel) => {
    const newSelectedChannels = [...selectedChannels]
    const isDirectChannel = channel.type === CHANNEL_TYPE.DIRECT
    const directChannelUser = isDirectChannel && channel.members.find((member: IMember) => member.id !== user.id)
    if (event.target.checked && selectedChannels.length < 5) {
      newSelectedChannels.push({
        id: channel.id,
        displayName:
          channel.subject ||
          (isDirectChannel && directChannelUser
            ? makeUsername(contactsMap[directChannelUser.id], directChannelUser, getFromContacts)
            : '')
      })
    } else {
      const itemToDeleteIndex = newSelectedChannels.findIndex((chan) => channel.id === chan.id)
      if (itemToDeleteIndex >= 0) {
        newSelectedChannels.splice(itemToDeleteIndex, 1)
      }
    }
    setSearchValue('')
    setSelectedChannels(newSelectedChannels)
  }

  const removeChannel = (channel: ISelectedChannelsData) => {
    const newSelectedChannels = [...selectedChannels]

    const itemToDeleteIndex = newSelectedChannels.findIndex((c) => channel.id === c.id)
    if (itemToDeleteIndex >= 0) {
      newSelectedChannels.splice(itemToDeleteIndex, 1)
    }
    setSelectedChannels(newSelectedChannels)
  }

  useEffect(() => {
    if (selectedChannelsContRef.current) {
      setSelectedChannelsHeight(selectedChannelsContRef.current.offsetHeight)
    } else {
      setSelectedChannelsHeight(0)
    }
  }, [selectedChannels])

  useEffect(() => {
    dispatch(getChannelsForForwardAC())
  }, [])

  useEffect(() => {
    dispatch(getChannelsForForwardAC(searchValue))
  }, [searchValue])
  return (
    <PopupContainer>
      <Popup maxWidth='522px' minWidth='522px' height='540px' isLoading={loading} padding='0'>
        <PopupBody paddingH='24px' paddingV='24px' withFooter>
          <CloseIcon onClick={() => togglePopup()} />
          <PopupName isDelete marginBottom='20px'>
            {title}
          </PopupName>
          <ChannelSearch
            searchValue={searchValue}
            handleSearchValueChange={handleSearchValueChange}
            getMyChannels={getMyChannels}
          />
          <SelectedChannelsContainer ref={selectedChannelsContRef}>
            {selectedChannels.map((channel) => {
              return (
                <SelectedChannelBuble key={`selected-${channel.id}`}>
                  <SelectedChannelName>{channel.displayName}</SelectedChannelName>
                  <StyledSubtractSvg onClick={() => removeChannel(channel)} />
                </SelectedChannelBuble>
              )
            })}
          </SelectedChannelsContainer>
          <ForwardChannelsCont onScroll={handleChannelListScroll} selectedChannelsHeight={selectedChannelsContHeight}>
            {channels.map((channel: IChannel) => {
              const isDirectChannel = channel.type === CHANNEL_TYPE.DIRECT
              const directChannelUser =
                isDirectChannel && channel.members.find((member: IMember) => member.id !== user.id)
              const isSelected = selectedChannels.findIndex((chan) => chan.id === channel.id) >= 0
              return (
                <ChannelItem key={channel.id} onClick={(e: any) => handleChoseChannel(e, channel.id)}>
                  <Avatar
                    name={
                      channel.subject ||
                      (isDirectChannel && directChannelUser ? directChannelUser.firstName || directChannelUser.id : '')
                    }
                    image={
                      channel.avatarUrl || (isDirectChannel && directChannelUser ? directChannelUser.avatarUrl : '')
                    }
                    size={40}
                    textSize={12}
                    setDefaultAvatar={isDirectChannel}
                  />
                  <ChannelInfo>
                    <ChannelTitle>
                      {channel.subject ||
                        (isDirectChannel && directChannelUser
                          ? makeUsername(contactsMap[directChannelUser.id], directChannelUser, getFromContacts)
                          : '')}
                    </ChannelTitle>
                    <ChannelMembers>
                      {isDirectChannel && directChannelUser
                        ? (
                            hideUserPresence && hideUserPresence(directChannelUser)
                              ? ''
                              : directChannelUser.presence &&
                                directChannelUser.presence.state === PRESENCE_STATUS.ONLINE
                          )
                          ? 'Online'
                          : directChannelUser &&
                            directChannelUser.presence &&
                            directChannelUser.presence.lastActiveAt &&
                            userLastActiveDateFormat(directChannelUser.presence.lastActiveAt)
                        : `${channel.memberCount} ${
                            channel.type === CHANNEL_TYPE.BROADCAST
                              ? channel.memberCount > 1
                                ? 'subscribers'
                                : 'subscriber'
                              : channel.memberCount > 1
                              ? 'members'
                              : 'member'
                          } `}
                    </ChannelMembers>
                  </ChannelInfo>
                  <CustomCheckbox
                    index={channel.id}
                    disabled={selectedChannels.length >= 5 && !isSelected}
                    state={isSelected}
                    onChange={(e) => handleChannelSelect(e, channel)}
                    size='18px'
                  />
                </ChannelItem>
              )
            })}
          </ForwardChannelsCont>
        </PopupBody>
        <PopupFooter backgroundColor={colors.backgroundColor}>
          <Button type='button' color={colors.textColor1} backgroundColor='transparent' onClick={() => togglePopup()}>
            Cancel
          </Button>
          <Button type='button' backgroundColor={colors.primary} borderRadius='8px' onClick={handleForwardMessage}>
            {buttonText || 'Forward'}
          </Button>
        </PopupFooter>
      </Popup>
    </PopupContainer>
  )
}

export default ForwardMessagePopup

const ForwardChannelsCont = styled.div<{ selectedChannelsHeight: number }>`
  overflow-y: auto;
  margin-top: 16px;
  max-height: ${(props) => `calc(100% - ${props.selectedChannelsHeight + 64}px)`};
  padding-right: 14px;
`

const ChannelItem = styled.div<any>`
  display: flex;
  align-items: center;
  margin-bottom: 8px;
`

const ChannelInfo = styled.div<any>`
  margin-left: 12px;
  margin-right: auto;
  max-width: calc(100% - 74px);
`

const ChannelTitle = styled.h3<any>`
  margin: 0 0 2px;
  font-weight: 500;
  font-size: 15px;
  line-height: 18px;
  letter-spacing: -0.2px;
  color: ${colors.textColor1};
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
`

const ChannelMembers = styled.h4<any>`
  margin: 0;
  font-weight: 400;
  font-size: 14px;
  line-height: 16px;
  letter-spacing: -0.078px;
  color: ${colors.textColor2};
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
`

const SelectedChannelsContainer = styled.div<any>`
  display: flex;
  justify-content: flex-start;
  flex-wrap: wrap;
  width: 100%;
  max-height: 85px;
  overflow-x: hidden;
  padding-top: 2px;
  box-sizing: border-box;
  //flex: 0 0 auto;
`

const SelectedChannelBuble = styled.div`
  display: flex;
  justify-content: space-between;
  background: ${colors.backgroundColor};
  border-radius: 16px;
  align-items: center;
  padding: 4px 10px;
  height: 26px;
  margin: 8px 8px 0 0;
  box-sizing: border-box;
`

const SelectedChannelName = styled.span`
  font-style: normal;
  font-weight: 500;
  font-size: 14px;
  line-height: 16px;
  color: ${colors.textColor1};
`

const StyledSubtractSvg = styled(CrossIcon)`
  cursor: pointer;
  margin-left: 4px;
  transform: translate(2px, 0);
`
