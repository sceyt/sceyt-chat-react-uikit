import React, { FC, useEffect, useRef, useState } from 'react'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import styled from 'styled-components'
import {
  activeChannelSelector,
  addedChannelSelector,
  addedToChannelSelector,
  channelsHasNextSelector,
  channelsLoadingState,
  channelsSelector,
  deletedChannelSelector,
  hiddenChannelSelector,
  visibleChannelSelector
} from '../../store/channel/selector'
import { connectionStatusSelector, contactsMapSelector } from '../../store/user/selector'
import {
  addChannelAC,
  getChannelsAC,
  loadMoreChannels,
  removeChannelAC,
  setChannelListWithAC,
  setChannelsAC,
  setChannelToAddAC,
  setChannelToHideAC,
  setChannelToRemoveAC,
  setChannelToUnHideAC,
  switchChannelActionAC
} from '../../store/channel/actions'
import { CONNECTION_STATUS } from '../../store/user/constants'
import { LOADING_STATE } from '../../helpers/constants'

import Channel from '../Channel'
import ChannelSearch from './ChannelSearch'
import { removeChannelFromMap, setUploadImageIcon } from '../../helpers/channelHalper'
import { colors, device } from '../../UIHelper/constants'
import { IChannel, IContactsMap } from '../../types'
// import { ReactComponent as BottomIcon } from '../../assets/svg/chevronBottom.svg'
import CreateChannelButton from './CreateChannelButton'
import { getContactsAC } from '../../store/user/actions'
import ProfileSettings from './ProfileSettings'
import { getShowOnlyContactUsers } from '../../helpers/contacts'
import { useDidUpdate } from '../../hooks'

interface IChannelGroup {
  groupName: string
  channelList: IChannel[]
}

interface IChannelListProps {
  List?: FC<{
    channels: IChannel[]
    loadMoreChannels: (count?: number) => void
    searchValue?: string
    handleSetChannelListWithGroups?: (channelListGroups: IChannelGroup[]) => void
    children?: React.ReactNode
  }>
  ListItem?: FC<any>
  searchChannelsPosition?: 'inline' | 'bottom'
  searchInputBorderRadius?: string
  getActiveChannel?: (channel: IChannel) => void
  Profile?: JSX.Element
  filter?: { channelType?: 'Public' | 'Private' | 'Direct' }
  limit?: number
  sort?: 'byLastMessage' | 'byCreationDate'
  avatar?: boolean
  showSearch?: boolean
  searchOption?: 'custom' | 'default'
  forceUpdateChannelList?: () => void
  showCreateChannelIcon?: boolean
  uriPrefixOnCreateChannel?: string
  notificationsIsMutedIcon?: JSX.Element
  notificationsIsMutedIconColor?: string
  createChannelIcon?: JSX.Element
  newChannelIcon?: JSX.Element
  newGroupIcon?: JSX.Element
  newChatIcon?: JSX.Element
  uploadPhotoIcon?: JSX.Element
  createChannelIconHoverBackground?: string
  selectedChannelBackground?: string
  selectedChannelLeftBorder?: string
  selectedChannelBorderRadius?: string
  selectedChannelPaddings?: string
  channelsPaddings?: string
  channelsMargin?: string
  onChannelDeleted?: (setChannels: (channels: IChannel[]) => void, channel: IChannel) => void
  onChannelCreated?: (setChannels: (channels: IChannel[]) => void, channel: IChannel) => void
  onChannelHidden?: (setChannels: (channels: IChannel[]) => void, channel: IChannel) => void
  onChannelVisible?: (setChannels: (channels: IChannel[]) => void, channel: IChannel) => void
  onAddedToChannel?: (setChannels: (channels: IChannel[]) => void, channel: IChannel) => void
}

const ChannelList: React.FC<IChannelListProps> = ({
  selectedChannelBackground,
  selectedChannelLeftBorder,
  searchChannelsPosition = 'bottom',
  searchInputBorderRadius,
  selectedChannelBorderRadius,
  selectedChannelPaddings,
  channelsPaddings,
  channelsMargin,
  List,
  ListItem,
  getActiveChannel,
  Profile,
  filter,
  limit,
  sort,
  avatar,
  showSearch = true,
  searchOption = 'default',
  showCreateChannelIcon = true,
  uriPrefixOnCreateChannel,
  onChannelDeleted,
  onChannelCreated,
  onChannelHidden,
  onChannelVisible,
  onAddedToChannel,
  notificationsIsMutedIcon,
  notificationsIsMutedIconColor,
  // forceUpdateChannelList
  createChannelIcon,
  newChannelIcon,
  newGroupIcon,
  newChatIcon,
  uploadPhotoIcon
}) => {
  const dispatch = useDispatch()
  // const [searchValue, setSearchValue] = useState('');
  const getFromContacts = getShowOnlyContactUsers()
  const channelListRef = useRef<HTMLInputElement>(null)
  const [searchValue, setSearchValue] = useState('')
  const connectionStatus = useSelector(connectionStatusSelector)
  // const searchValue = useSelector(searchValueSelector) || ''
  const channels = useSelector(channelsSelector, shallowEqual) || []
  const contactsMap: IContactsMap = useSelector(contactsMapSelector)
  const addedChannel = useSelector(addedChannelSelector)
  const addedToChannel = useSelector(addedToChannelSelector)
  const deletedChannel = useSelector(deletedChannelSelector)
  const hiddenChannel = useSelector(hiddenChannelSelector)
  const visibleChannel = useSelector(visibleChannelSelector)
  const channelsHasNext = useSelector(channelsHasNextSelector) || false
  const directChannels = searchValue ? channels.filter((channel: any) => channel.type === 'Direct') : []
  const groupChannels = searchValue ? channels.filter((channel: any) => channel.type !== 'Direct') : []
  const channelsLoading = useSelector(channelsLoadingState) || {}
  const activeChannel = useSelector(activeChannelSelector) || {}
  const [profileIsOpen, setProfileIsOpen] = useState(false)
  const [channelGroupsList, setChannelGroupsList] = useState<IChannelGroup[] | undefined>()
  const handleSetChannelList = (updatedChannels: IChannel[], isRemove?: boolean): any => {
    if (isRemove) {
      const channelsMap: any = {}
      const makeMapFrom = isRemove ? updatedChannels : channels
      const findIn = isRemove ? channels : updatedChannels
      for (let i = 0; i < makeMapFrom.length; i++) {
        channelsMap[makeMapFrom[i].id] = true
      }
      const channelsForAction: any = []
      for (let j = 0; j < findIn.length; j++) {
        if (!channelsMap[findIn[j].id]) {
          channelsForAction.push(findIn[j])
        }
      }
      channelsForAction.forEach((channelToDelete: any) => removeChannelFromMap(channelToDelete.id))
    }
    dispatch(setChannelsAC(updatedChannels))
  }

  const handleSetChannelListWithGroups = (channelGroupsList: IChannelGroup[]) => {
    setChannelGroupsList(channelGroupsList)
  }

  const handleLoadMoreChannels = (count?: number) => {
    if (channelsLoading === LOADING_STATE.LOADED && !searchValue) {
      dispatch(loadMoreChannels(count))
    }
  }

  const handleAllChannelsListScroll = (e: any) => {
    if (!searchValue && channelsHasNext && e.target.scrollTop >= e.target.scrollHeight - e.target.offsetHeight - 200) {
      handleLoadMoreChannels()
    }
  }

  const handleChangeActiveChannel = (chan: IChannel) => {
    if (activeChannel.id !== chan.id) {
      dispatch(switchChannelActionAC(chan))
    }
  }

  const handleSearchValueChange = (e: any) => {
    setSearchValue(e.target.value)
  }

  const getMyChannels = () => {
    setSearchValue('')
  }

  const handleOpenProfile = () => {
    setProfileIsOpen(!profileIsOpen)
  }

  useEffect(() => {
    if (deletedChannel) {
      if (onChannelDeleted) {
        onChannelDeleted((updatedChannels) => handleSetChannelList(updatedChannels, true), deletedChannel)
      } else {
        removeChannelFromMap(deletedChannel.id)
        dispatch(removeChannelAC(deletedChannel.id))
      }
      dispatch(setChannelToRemoveAC(null))
    }
  }, [deletedChannel])

  useDidUpdate(() => {
    if (connectionStatus === CONNECTION_STATUS.CONNECTED) {
      dispatch(getChannelsAC({ filter, limit, sort, search: '' }, false))
      /*  if (activeChannel.id) {
        dispatch(getMessagesAC(activeChannel))
      }
      clearMessagesMap()
      removeAllMessages() */
      // dispatch(switchChannelActionAC(activeChannel.id))
    }
  }, [connectionStatus])

  useEffect(() => {
    if (addedChannel) {
      if (onChannelCreated) {
        onChannelCreated((updatedChannels) => handleSetChannelList(updatedChannels, false), addedChannel)
      } else {
        dispatch(addChannelAC(addedChannel))
      }
      dispatch(setChannelToAddAC(null))
    }
  }, [addedChannel])

  useEffect(() => {
    if (addedToChannel) {
      if (onAddedToChannel) {
        onAddedToChannel((updatedChannels) => handleSetChannelList(updatedChannels, false), addedToChannel)
      } else {
        dispatch(addChannelAC(addedToChannel))
      }
      dispatch(setChannelToAddAC(null))
    }
  }, [addedToChannel])

  useEffect(() => {
    if (hiddenChannel) {
      if (onChannelHidden) {
        onChannelHidden((updatedChannels) => handleSetChannelList(updatedChannels, true), hiddenChannel)
      } else {
        dispatch(removeChannelAC(hiddenChannel.id))
      }
      dispatch(setChannelToHideAC(null))
    }
  }, [hiddenChannel])

  useEffect(() => {
    if (visibleChannel) {
      if (onChannelVisible) {
        onChannelVisible((updatedChannels) => handleSetChannelList(updatedChannels, true), visibleChannel)
      } else {
        dispatch(addChannelAC(hiddenChannel))
      }
      dispatch(setChannelToUnHideAC(null))
    }
  }, [visibleChannel])

  useDidUpdate(() => {
    if (searchOption === 'default') {
      dispatch(getChannelsAC({ filter, limit, sort, search: searchValue }))
    }
  }, [searchValue])
  useDidUpdate(() => {
    if (getActiveChannel) {
      getActiveChannel(activeChannel)
    }
  }, [activeChannel.id])
  useEffect(() => {
    if (uploadPhotoIcon) {
      setUploadImageIcon(uploadPhotoIcon)
    }
    dispatch(getChannelsAC({ filter, limit, sort, search: '' }, false))
    if (getFromContacts) {
      dispatch(getContactsAC())
    }
    dispatch(setChannelListWithAC((channelListRef.current && channelListRef.current.clientWidth) || 0))
  }, [])
  return (
    <Container withCustomList={!!List} ref={channelListRef}>
      <ChannelListHeader
        withCustomList={!!List}
        maxWidth={(channelListRef.current && channelListRef.current.clientWidth) || 0}
      >
        {Profile /* || <ProfileSettings handleCloseProfile={() => setProfileIsOpen(false)} /> */}
        {/* <ProfileCont onClick={handleOpenProfile}>
            <Avatar image={user.avatarUrl} name={user.firstName || user.id} size={32} textSize={15} setDefaultAvatar />
            <BottomIcon />
          </ProfileCont> */}
        {showSearch && searchChannelsPosition === 'inline' ? (
          <ChannelSearch
            inline
            borderRadius={searchInputBorderRadius}
            searchValue={searchValue}
            handleSearchValueChange={handleSearchValueChange}
            getMyChannels={getMyChannels}
          />
        ) : (
          <ChannelsTitle>Chats</ChannelsTitle>
        )}

        {showCreateChannelIcon && (
          <CreateChannelButton
            newChannelIcon={newChannelIcon}
            newGroupIcon={newGroupIcon}
            newChatIcon={newChatIcon}
            uploadPhotoIcon={uploadPhotoIcon}
            createChannelIcon={createChannelIcon}
            showSearch={showSearch}
            uriPrefixOnCreateChannel={uriPrefixOnCreateChannel}
          />
        )}
      </ChannelListHeader>
      {showSearch && searchChannelsPosition === 'bottom' && (
        <ChannelSearch
          searchValue={searchValue}
          borderRadius={searchInputBorderRadius}
          handleSearchValueChange={handleSearchValueChange}
          getMyChannels={getMyChannels}
        />
      )}
      {/* <ChannelTabs /> */}
      {List ? (
        <List
          channels={channels}
          loadMoreChannels={handleLoadMoreChannels}
          searchValue={searchValue}
          handleSetChannelListWithGroups={handleSetChannelListWithGroups}
        >
          {!directChannels.length && !searchValue ? (
            <React.Fragment>
              {channels.map((channel: IChannel) =>
                ListItem ? (
                  <ListItem channel={channel} setActiveChannel={handleChangeActiveChannel} key={channel.id} />
                ) : (
                  <Channel
                    selectedChannelLeftBorder={selectedChannelLeftBorder}
                    selectedChannelBackground={selectedChannelBackground}
                    selectedChannelBorderRadius={selectedChannelBorderRadius}
                    selectedChannelPaddings={selectedChannelPaddings}
                    channelsPaddings={channelsPaddings}
                    channelsMargin={channelsMargin}
                    notificationsIsMutedIcon={notificationsIsMutedIcon}
                    notificationsIsMutedIconColor={notificationsIsMutedIconColor}
                    avatar={avatar}
                    channel={channel}
                    key={channel.id}
                    contactsMap={contactsMap}
                  />
                )
              )}
            </React.Fragment>
          ) : (
            channelsLoading === LOADING_STATE.LOADED &&
            searchValue &&
            (searchOption === 'custom' ? (
              <div>
                {channelGroupsList
                  ? channelGroupsList.map((channelGroup) => (
                      <React.Fragment>
                        <SearchedChannelsHeader>{channelGroup.groupName}</SearchedChannelsHeader>
                        {channelGroup.channelList.map((channel) => (
                          <Channel
                            selectedChannelLeftBorder={selectedChannelLeftBorder}
                            selectedChannelBackground={selectedChannelBackground}
                            selectedChannelBorderRadius={selectedChannelBorderRadius}
                            selectedChannelPaddings={selectedChannelPaddings}
                            channelsPaddings={channelsPaddings}
                            channelsMargin={channelsMargin}
                            notificationsIsMutedIcon={notificationsIsMutedIcon}
                            notificationsIsMutedIconColor={notificationsIsMutedIconColor}
                            avatar={avatar}
                            channel={channel}
                            key={channel.id}
                            contactsMap={contactsMap}
                          />
                        ))}
                      </React.Fragment>
                    ))
                  : ''}
              </div>
            ) : (
              <React.Fragment>
                {!!directChannels.length && (
                  <DirectChannels>
                    <SearchedChannelsHeader>DIRECT</SearchedChannelsHeader>
                    {directChannels.map((channel: IChannel) =>
                      ListItem ? (
                        <ListItem channel={channel} setActiveChannel={handleChangeActiveChannel} key={channel.id} />
                      ) : (
                        <Channel
                          selectedChannelLeftBorder={selectedChannelLeftBorder}
                          selectedChannelBackground={selectedChannelBackground}
                          selectedChannelBorderRadius={selectedChannelBorderRadius}
                          selectedChannelPaddings={selectedChannelPaddings}
                          channelsPaddings={channelsPaddings}
                          channelsMargin={channelsMargin}
                          notificationsIsMutedIcon={notificationsIsMutedIcon}
                          notificationsIsMutedIconColor={notificationsIsMutedIconColor}
                          avatar={avatar}
                          channel={channel}
                          key={channel.id}
                          contactsMap={contactsMap}
                        />
                      )
                    )}
                  </DirectChannels>
                )}
                {!!groupChannels.length && (
                  <GroupChannels>
                    <SearchedChannelsHeader>GROUP</SearchedChannelsHeader>
                    {groupChannels.map((channel: IChannel) =>
                      ListItem ? (
                        <ListItem channel={channel} setActiveChannel={handleChangeActiveChannel} key={channel.id} />
                      ) : (
                        <Channel
                          selectedChannelLeftBorder={selectedChannelLeftBorder}
                          selectedChannelBackground={selectedChannelBackground}
                          selectedChannelBorderRadius={selectedChannelBorderRadius}
                          selectedChannelPaddings={selectedChannelPaddings}
                          channelsPaddings={channelsPaddings}
                          channelsMargin={channelsMargin}
                          notificationsIsMutedIcon={notificationsIsMutedIcon}
                          notificationsIsMutedIconColor={notificationsIsMutedIconColor}
                          avatar={avatar}
                          channel={channel}
                          key={channel.id}
                          contactsMap={contactsMap}
                        />
                      )
                    )}
                  </GroupChannels>
                )}

                {/* {!channels.length && (
            <NoDataPage
              title="Nothing found"
              text="Sorry, there is nothing that matches your search."
              NoDataIcon={NoChannelList}
              styledHeight="50%"
              styledTextWidth="190px"
            />
          )} */}
              </React.Fragment>
            ))
          )}
        </List>
      ) : (
        <React.Fragment>
          {!directChannels.length && !searchValue && (
            <ChannelsList onScroll={handleAllChannelsListScroll}>
              {channels.map((channel: IChannel) =>
                ListItem ? (
                  <ListItem channel={channel} setActiveChannel={handleChangeActiveChannel} key={channel.id} />
                ) : (
                  <Channel
                    selectedChannelLeftBorder={selectedChannelLeftBorder}
                    selectedChannelBackground={selectedChannelBackground}
                    selectedChannelBorderRadius={selectedChannelBorderRadius}
                    selectedChannelPaddings={selectedChannelPaddings}
                    channelsPaddings={channelsPaddings}
                    channelsMargin={channelsMargin}
                    notificationsIsMutedIcon={notificationsIsMutedIcon}
                    notificationsIsMutedIconColor={notificationsIsMutedIconColor}
                    avatar={avatar}
                    channel={channel}
                    key={channel.id}
                    contactsMap={contactsMap}
                  />
                )
              )}
            </ChannelsList>
          )}
          {channelsLoading === LOADING_STATE.LOADED && searchValue && (
            <SearchedChannels>
              {!!directChannels.length && (
                <DirectChannels>
                  <SearchedChannelsHeader>DIRECT</SearchedChannelsHeader>
                  {directChannels.map((channel: IChannel) =>
                    ListItem ? (
                      <ListItem channel={channel} setActiveChannel={handleChangeActiveChannel} key={channel.id} />
                    ) : (
                      <Channel
                        selectedChannelLeftBorder={selectedChannelLeftBorder}
                        selectedChannelBackground={selectedChannelBackground}
                        selectedChannelBorderRadius={selectedChannelBorderRadius}
                        selectedChannelPaddings={selectedChannelPaddings}
                        channelsPaddings={channelsPaddings}
                        channelsMargin={channelsMargin}
                        notificationsIsMutedIcon={notificationsIsMutedIcon}
                        notificationsIsMutedIconColor={notificationsIsMutedIconColor}
                        avatar={avatar}
                        channel={channel}
                        contactsMap={contactsMap}
                        key={channel.id}
                      />
                    )
                  )}
                </DirectChannels>
              )}
              {!!groupChannels.length && (
                <GroupChannels>
                  <SearchedChannelsHeader>GROUP</SearchedChannelsHeader>
                  {groupChannels.map((channel: IChannel) =>
                    ListItem ? (
                      <ListItem channel={channel} setActiveChannel={handleChangeActiveChannel} key={channel.id} />
                    ) : (
                      <Channel
                        selectedChannelLeftBorder={selectedChannelLeftBorder}
                        selectedChannelBackground={selectedChannelBackground}
                        selectedChannelBorderRadius={selectedChannelBorderRadius}
                        selectedChannelPaddings={selectedChannelPaddings}
                        channelsPaddings={channelsPaddings}
                        channelsMargin={channelsMargin}
                        notificationsIsMutedIcon={notificationsIsMutedIcon}
                        notificationsIsMutedIconColor={notificationsIsMutedIconColor}
                        avatar={avatar}
                        channel={channel}
                        key={channel.id}
                        contactsMap={contactsMap}
                      />
                    )
                  )}
                </GroupChannels>
              )}

              {/* {!channels.length && (
                      <NoDataPage
                        title="Nothing found"
                        text="Sorry, there is nothing that matches your search."
                        NoDataIcon={NoChannelList}
                        styledHeight="50%"
                        styledTextWidth="190px"
                      />
                    )} */}
            </SearchedChannels>
          )}
        </React.Fragment>
      )}

      {profileIsOpen && <ProfileSettings handleCloseProfile={handleOpenProfile} />}
    </Container>
  )
}

export default ChannelList

const Container = styled.div<{ withCustomList?: boolean; ref?: any }>`
  position: relative;
  display: flex;
  flex-direction: column;
  width: ${(props) => (props.withCustomList ? '' : '400px')};
  min-width: ${(props) => (props.withCustomList ? '' : '400px')};
  border-right: ${(props) => (props.withCustomList ? '' : '1px solid rgb(237, 237, 237)')};

  ${(props) =>
    props.withCustomList
      ? ''
      : `
    @media  ${device.laptopL} {
      width: 400px;
      min-width: 400px;
    }
 `};
`

const ChannelsList = styled.div`
  overflow-y: auto;
  width: 400px;
  height: 100%;
`
const SearchedChannels = styled.div`
  height: calc(100vh - 123px);
  overflow-x: hidden;
`
const SearchedChannelsHeader = styled.p`
  padding-left: 16px;
  font-weight: 500;
  font-size: 15px;
  line-height: 14px;
  color: #676a7c;
`
const DirectChannels = styled.div``
const GroupChannels = styled.div``

const ChannelsTitle = styled.h3`
  font-family: Inter, sans-serif;
  font-style: normal;
  font-weight: 500;
  font-size: 20px;
  line-height: 28px;
  margin: 0 auto;
  color: ${colors.textColor1};
`

const ChannelListHeader = styled.div<{ maxWidth?: number; withoutProfile?: any; withCustomList?: boolean }>`
  display: flex;
  align-items: center;
  flex-direction: row;
  justify-content: space-between;
  //justify-content: flex-end;
  padding: 12px;
  box-sizing: border-box;
  max-width: ${(props) => props.maxWidth && `${props.maxWidth}px`};
  padding-left: ${(props) => props.withoutProfile && '52px'};
  border-right: ${(props) => (props.withCustomList ? '1px solid rgb(237, 237, 237)' : '')};
`
