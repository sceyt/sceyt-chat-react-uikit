import React, { useEffect, useRef, useState } from 'react'
import { Popup, PopupName, CloseIcon, PopupBody, Button, PopupFooter } from '../../../UIHelper'
import { THEME_COLORS } from '../../../UIHelper/constants'
import styled from 'styled-components'
import {
  getChannelsForForwardAC,
  loadMoreChannelsForForward,
  searchChannelsForForwardAC,
  setSearchedChannelsForForwardAC
} from '../../../store/channel/actions'
import { useDispatch, useSelector } from 'react-redux'
import {
  channelsForForwardHasNextSelector,
  channelsForForwardSelector,
  channelsLoadingStateForForwardSelector,
  searchedChannelsForForwardSelector
} from '../../../store/channel/selector'
import { IChannel, IMember } from '../../../types'
import ChannelSearch from '../../../components/ChannelList/ChannelSearch'
import { Avatar } from '../../../components'
import { DEFAULT_CHANNEL_TYPE, LOADING_STATE, USER_PRESENCE_STATUS } from '../../../helpers/constants'
import { userLastActiveDateFormat } from '../../../helpers'
import { makeUsername } from '../../../helpers/message'
import { contactsMapSelector } from '../../../store/user/selector'
import { getShowOnlyContactUsers } from '../../../helpers/contacts'
import CustomCheckbox from '../../customCheckbox'

import { ReactComponent as CrossIcon } from '../../../assets/svg/cross.svg'
import { hideUserPresence } from '../../../helpers/userHelper'
import { getClient } from '../../client'
import PopupContainer from '../popupContainer'
import { useColor } from '../../../hooks'
interface ISelectedChannelsData {
  id: string
  displayName: string
}

interface IProps {
  title: string
  buttonText: string
  togglePopup: () => void
  // eslint-disable-next-line no-unused-vars
  handleForward: (channelIds: string[]) => void
  loading?: boolean
}

function ForwardMessagePopup({ title, buttonText, togglePopup, handleForward, loading }: IProps) {
  const {
    [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.SURFACE_1]: surface1,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.BACKGROUND]: background,
    [THEME_COLORS.ICON_INACTIVE]: iconInactive,
    [THEME_COLORS.TEXT_ON_PRIMARY]: textOnPrimary,
    [THEME_COLORS.ICON_PRIMARY]: iconPrimary,
    [THEME_COLORS.BACKGROUND_HOVERED]: backgroundHovered,
    [THEME_COLORS.SURFACE_2]: surface2
  } = useColor()

  const ChatClient = getClient()
  const { user } = ChatClient
  const dispatch = useDispatch()
  const channels = useSelector(channelsForForwardSelector) || []
  const searchedChannels = useSelector(searchedChannelsForForwardSelector) || []
  const contactsMap = useSelector(contactsMapSelector)
  const getFromContacts = getShowOnlyContactUsers()
  const channelsLoading = useSelector(channelsLoadingStateForForwardSelector)
  const channelsHasNext = useSelector(channelsForForwardHasNextSelector)
  const [searchValue, setSearchValue] = useState('')
  const [selectedChannelsContHeight, setSelectedChannelsHeight] = useState(0)
  const [selectedChannels, setSelectedChannels] = useState<ISelectedChannelsData[]>([])
  const selectedChannelsContRef = useRef<any>()
  const [isScrolling, setIsScrolling] = useState<boolean>(false)

  const handleForwardMessage = () => {
    handleForward(selectedChannels.map((channel) => channel.id))
    togglePopup()
  }

  const handleChannelListScroll = (event: any) => {
    if (event.target.scrollTop >= event.target.scrollHeight - event.target.offsetHeight - 100) {
      if (channelsLoading === LOADING_STATE.LOADED && channelsHasNext) {
        dispatch(loadMoreChannelsForForward(15))
      }
    }
  }

  const handleSearchValueChange = (e: any) => {
    const { value } = e.target
    setSearchValue(value)
  }

  const getMyChannels = () => {
    setSearchValue('')
  }

  const handleChannelSelect = (isSelected: boolean, channel: IChannel) => {
    const newSelectedChannels = [...selectedChannels]
    const isDirectChannel = channel.type === DEFAULT_CHANNEL_TYPE.DIRECT
    const isSelfChannel = isDirectChannel && channel.metadata?.s
    const directChannelUser = isDirectChannel && channel.members.find((member: IMember) => member.id !== user.id)
    if (isSelected && selectedChannels.length < 5) {
      newSelectedChannels.push({
        id: channel.id,
        displayName:
          channel.subject ||
          (isDirectChannel && isSelfChannel
            ? 'Me'
            : directChannelUser
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
    return () => {
      dispatch(setSearchedChannelsForForwardAC({ chats_groups: [], channels: [], contacts: [] }))
    }
  }, [])

  useEffect(() => {
    // dispatch(getChannelsForForwardAC(searchValue))
    if (searchValue) {
      dispatch(searchChannelsForForwardAC({ search: searchValue }, contactsMap))
    } else {
      dispatch(setSearchedChannelsForForwardAC({ chats_groups: [], channels: [], contacts: [] }))
    }
  }, [searchValue])
  return (
    <PopupContainer>
      <Popup
        maxWidth='522px'
        minWidth='522px'
        height='540px'
        isLoading={loading}
        padding='0'
        backgroundColor={background}
      >
        <PopupBody paddingH='24px' paddingV='24px' withFooter>
          <CloseIcon onClick={() => togglePopup()} color={iconPrimary} />
          <PopupName color={textPrimary} isDelete marginBottom='20px'>
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
                <SelectedChannelBuble backgroundColor={surface1} key={`selected-${channel.id}`}>
                  <SelectedChannelName color={textPrimary}>{channel.displayName}</SelectedChannelName>
                  <StyledSubtractSvg onClick={() => removeChannel(channel)} color={iconPrimary} />
                </SelectedChannelBuble>
              )
            })}
          </SelectedChannelsContainer>
          <ForwardChannelsCont
            onScroll={handleChannelListScroll}
            selectedChannelsHeight={selectedChannelsContHeight}
            className={isScrolling ? 'show-scrollbar' : ''}
            onMouseEnter={() => setIsScrolling(true)}
            onMouseLeave={() => setIsScrolling(false)}
            thumbColor={surface2}
          >
            {searchValue ? (
              <React.Fragment>
                {!!(searchedChannels.chats_groups && searchedChannels.chats_groups.length) && (
                  <React.Fragment>
                    <ChannelsGroupTitle color={textSecondary} margin='0 0 12px'>
                      Chats & Groups
                    </ChannelsGroupTitle>
                    {searchedChannels.chats_groups.map((channel: IChannel) => {
                      const isSelected = selectedChannels.findIndex((chan) => chan.id === channel.id) >= 0
                      const isDirectChannel = channel.type === DEFAULT_CHANNEL_TYPE.DIRECT
                      const isSelfChannel = isDirectChannel && channel.metadata?.s
                      const directChannelUser =
                        isDirectChannel && isSelfChannel
                          ? user
                          : channel.members.find((member: IMember) => member.id !== user.id)
                      return (
                        <ChannelItem
                          key={channel.id}
                          onClick={() => handleChannelSelect(!isSelected, channel)}
                          disabled={selectedChannels.length >= 5 && !isSelected}
                          backgroundHover={backgroundHovered}
                        >
                          <Avatar
                            name={
                              channel.subject ||
                              (isDirectChannel && directChannelUser
                                ? directChannelUser.firstName || directChannelUser.id
                                : '')
                            }
                            image={
                              channel.avatarUrl ||
                              (isDirectChannel && directChannelUser ? directChannelUser.avatarUrl : '')
                            }
                            size={40}
                            textSize={12}
                            setDefaultAvatar={isDirectChannel}
                          />
                          <ChannelInfo>
                            <ChannelTitle color={textPrimary}>
                              {isDirectChannel
                                ? isSelfChannel
                                  ? 'Me'
                                  : directChannelUser
                                    ? makeUsername(
                                        contactsMap[directChannelUser.id],
                                        directChannelUser,
                                        getFromContacts
                                      )
                                    : 'Deleted User'
                                : channel.subject}
                            </ChannelTitle>
                            <ChannelMembers color={textSecondary}>
                              {isDirectChannel && directChannelUser
                                ? (
                                    hideUserPresence && hideUserPresence(directChannelUser)
                                      ? ''
                                      : directChannelUser.presence &&
                                        directChannelUser.presence.state === USER_PRESENCE_STATUS.ONLINE
                                  )
                                  ? 'Online'
                                  : directChannelUser &&
                                    directChannelUser.presence &&
                                    directChannelUser.presence.lastActiveAt &&
                                    userLastActiveDateFormat(directChannelUser.presence.lastActiveAt)
                                : `${channel?.memberCount} ${
                                    channel.type === DEFAULT_CHANNEL_TYPE.BROADCAST ||
                                    channel.type === DEFAULT_CHANNEL_TYPE.PUBLIC
                                      ? channel?.memberCount > 1
                                        ? 'subscribers'
                                        : 'subscriber'
                                      : directChannelUser?.memberCount > 1
                                        ? 'members'
                                        : 'member'
                                  } `}
                            </ChannelMembers>
                          </ChannelInfo>
                          <CustomCheckbox
                            borderColor={iconInactive}
                            index={channel.id}
                            disabled={selectedChannels.length >= 5 && !isSelected}
                            state={isSelected}
                            onClick={(e) => {
                              e.stopPropagation()
                            }}
                            size='18px'
                            backgroundColor={'transparent'}
                            checkedBackgroundColor={accentColor}
                          />
                        </ChannelItem>
                      )
                    })}
                  </React.Fragment>
                )}
                {!!(searchedChannels.channels && searchedChannels.channels.length) && (
                  <React.Fragment>
                    <ChannelsGroupTitle color={textSecondary}>Channels</ChannelsGroupTitle>
                    {searchedChannels.channels.map((channel: IChannel) => {
                      const isSelected = selectedChannels.findIndex((chan) => chan.id === channel.id) >= 0
                      return (
                        <ChannelItem
                          key={channel.id}
                          onClick={() => handleChannelSelect(!isSelected, channel)}
                          disabled={selectedChannels.length >= 5 && !isSelected}
                          backgroundHover={backgroundHovered}
                        >
                          <Avatar
                            name={channel.subject || ''}
                            image={channel.avatarUrl}
                            size={40}
                            textSize={12}
                            setDefaultAvatar={false}
                          />
                          <ChannelInfo>
                            <ChannelTitle color={textPrimary}>{channel.subject}</ChannelTitle>
                            <ChannelMembers color={textSecondary}>
                              {`${channel.memberCount} ${
                                channel.type === DEFAULT_CHANNEL_TYPE.BROADCAST ||
                                channel.type === DEFAULT_CHANNEL_TYPE.PUBLIC
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
                            borderColor={iconInactive}
                            index={channel.id}
                            disabled={selectedChannels.length >= 5 && !isSelected}
                            state={isSelected}
                            onClick={(e) => {
                              e.stopPropagation()
                            }}
                            size='18px'
                            backgroundColor={'transparent'}
                            checkedBackgroundColor={accentColor}
                          />
                        </ChannelItem>
                      )
                    })}
                  </React.Fragment>
                )}
              </React.Fragment>
            ) : (
              channels.map((channel: IChannel) => {
                const isDirectChannel = channel.type === DEFAULT_CHANNEL_TYPE.DIRECT
                const isSelfChannel = isDirectChannel && channel.metadata?.s
                const directChannelUser =
                  isDirectChannel && isSelfChannel
                    ? user
                    : channel.members.find((member: IMember) => member.id !== user.id)
                const isSelected = selectedChannels.findIndex((chan) => chan.id === channel.id) >= 0
                return (
                  <ChannelItem
                    key={channel.id}
                    onClick={() => handleChannelSelect(!isSelected, channel)}
                    disabled={selectedChannels.length >= 5 && !isSelected}
                  >
                    <Avatar
                      name={
                        channel.subject ||
                        (isDirectChannel && directChannelUser
                          ? directChannelUser.firstName || directChannelUser.id
                          : '')
                      }
                      image={
                        channel.avatarUrl || (isDirectChannel && directChannelUser ? directChannelUser.avatarUrl : '')
                      }
                      size={40}
                      textSize={12}
                      setDefaultAvatar={isDirectChannel}
                    />
                    <ChannelInfo>
                      <ChannelTitle color={textPrimary}>
                        {channel.subject ||
                          (isDirectChannel && isSelfChannel
                            ? 'Me'
                            : directChannelUser
                              ? makeUsername(contactsMap[directChannelUser.id], directChannelUser, getFromContacts)
                              : '')}
                      </ChannelTitle>
                      <ChannelMembers color={textSecondary}>
                        {isDirectChannel && directChannelUser
                          ? (
                              hideUserPresence && hideUserPresence(directChannelUser)
                                ? ''
                                : directChannelUser.presence &&
                                  directChannelUser.presence.state === USER_PRESENCE_STATUS.ONLINE
                            )
                            ? 'Online'
                            : directChannelUser &&
                              directChannelUser.presence &&
                              directChannelUser.presence.lastActiveAt &&
                              userLastActiveDateFormat(directChannelUser.presence.lastActiveAt)
                          : `${channel.memberCount} ${
                              channel.type === DEFAULT_CHANNEL_TYPE.BROADCAST ||
                              channel.type === DEFAULT_CHANNEL_TYPE.PUBLIC
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
                      borderColor={iconInactive}
                      index={channel.id}
                      disabled={selectedChannels.length >= 5 && !isSelected}
                      state={isSelected}
                      onClick={(e) => {
                        e.stopPropagation()
                      }}
                      size='18px'
                      backgroundColor={'transparent'}
                      checkedBackgroundColor={accentColor}
                    />
                  </ChannelItem>
                )
              })
            )}
          </ForwardChannelsCont>
        </PopupBody>
        <PopupFooter backgroundColor={surface1}>
          <Button type='button' color={textPrimary} backgroundColor='transparent' onClick={() => togglePopup()}>
            Cancel
          </Button>
          <Button
            type='button'
            color={textOnPrimary}
            backgroundColor={accentColor}
            borderRadius='8px'
            onClick={handleForwardMessage}
          >
            {buttonText || 'Forward'}
          </Button>
        </PopupFooter>
      </Popup>
    </PopupContainer>
  )
}

export default ForwardMessagePopup

const ForwardChannelsCont = styled.div<{ selectedChannelsHeight: number; thumbColor: string }>`
  overflow-y: auto;
  margin-top: 16px;
  max-height: ${(props) => `calc(100% - ${props.selectedChannelsHeight + 64}px)`};
  padding-right: 22px;

  &::-webkit-scrollbar {
    width: 8px;
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: transparent;
  }

  &.show-scrollbar::-webkit-scrollbar-thumb {
    background: ${(props) => props.thumbColor};
    border-radius: 4px;
  }
  &.show-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
`

const ChannelItem = styled.div<{ backgroundHover?: string; disabled?: boolean }>`
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  cursor: pointer;
  &:hover {
    background-color: ${(props) => props.backgroundHover};
  }
  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`

const ChannelInfo = styled.div<any>`
  margin-left: 12px;
  margin-right: auto;
  max-width: calc(100% - 74px);
`

const ChannelsGroupTitle = styled.h4<{ color: string; margin?: string }>`
  font-weight: 500;
  font-size: 15px;
  line-height: 14px;
  margin: ${(props) => props.margin || '20px 0 12px'};
  color: ${(props) => props.color};
`
const ChannelTitle = styled.h3<{ color: string }>`
  margin: 0 0 2px;
  font-weight: 500;
  font-size: 15px;
  line-height: 18px;
  letter-spacing: -0.2px;
  color: ${(props) => props.color};
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
`

const ChannelMembers = styled.h4<{ color: string }>`
  margin: 0;
  font-weight: 400;
  font-size: 14px;
  line-height: 16px;
  letter-spacing: -0.078px;
  color: ${(props) => props.color};
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

const SelectedChannelBuble = styled.div<{ backgroundColor: string }>`
  display: flex;
  justify-content: space-between;
  background: ${(props) => props.backgroundColor};
  border-radius: 16px;
  align-items: center;
  padding: 4px 10px;
  height: 26px;
  margin: 8px 8px 0 0;
  box-sizing: border-box;
`

const SelectedChannelName = styled.span<{ color: string }>`
  font-style: normal;
  font-weight: 500;
  font-size: 14px;
  line-height: 16px;
  color: ${(props) => props.color};
`

const StyledSubtractSvg = styled(CrossIcon)`
  cursor: pointer;
  margin-left: 4px;
  transform: translate(2px, 0);
`
