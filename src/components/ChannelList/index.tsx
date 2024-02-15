import React, { FC, useEffect, useRef, useState } from 'react'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import styled from 'styled-components'
// Store
import {
  activeChannelSelector,
  addedChannelSelector,
  addedToChannelSelector,
  channelsHasNextSelector,
  channelsLoadingState,
  channelsSelector,
  closeSearchChannelSelector,
  deletedChannelSelector,
  hiddenChannelSelector,
  searchedChannelsSelector,
  visibleChannelSelector
} from '../../store/channel/selector'
import { connectionStatusSelector, contactsMapSelector } from '../../store/user/selector'
import {
  addChannelAC,
  createChannelAC,
  getChannelsAC,
  loadMoreChannels,
  removeChannelAC,
  searchChannelsAC,
  setChannelListWithAC,
  setChannelsAC,
  setChannelToAddAC,
  setChannelToHideAC,
  setChannelToRemoveAC,
  setChannelToUnHideAC,
  setCloseSearchChannelsAC,
  setSearchedChannelsAC,
  switchChannelActionAC
} from '../../store/channel/actions'
import { themeSelector } from '../../store/theme/selector'
import { getContactsAC } from '../../store/user/actions'
import { CONNECTION_STATUS } from '../../store/user/constants'
// Hooks
import { useDidUpdate } from '../../hooks'
// Helpers
import { getLastChannelFromMap, removeChannelFromMap, setUploadImageIcon } from '../../helpers/channelHalper'
import { getShowOnlyContactUsers } from '../../helpers/contacts'
import { CHANNEL_TYPE, LOADING_STATE, THEME } from '../../helpers/constants'
import { colors, device } from '../../UIHelper/constants'
import { UploadingIcon } from '../../UIHelper'
import { IChannel, IContact, IContactsMap } from '../../types'
// Components
import Channel from '../Channel'
import ChannelSearch from './ChannelSearch'
import ContactItem from './ContactItem'
import CreateChannelButton from './CreateChannelButton'
import ProfileSettings from './ProfileSettings'

interface IChannelListProps {
  List?: FC<{
    channels: IChannel[]
    searchedChannels: { chats_groups: []; channels: []; contacts: [] }
    // eslint-disable-next-line no-unused-vars
    loadMoreChannels: (count?: number) => void
    searchValue: string
    children: React.ReactNode
    activeChannel?: IChannel
    // eslint-disable-next-line no-unused-vars
    setActiveChannel?: (channel: IChannel) => void
  }>
  ListItem?: FC<{
    channel?: IChannel
    contact?: IContact
    // eslint-disable-next-line no-unused-vars
    setActiveChannel?: (channel: IChannel) => void
    // eslint-disable-next-line no-unused-vars
    createChatWithContact?: (contact: IContact) => void
  }>
  className?: string
  Profile?: JSX.Element
  CreateChannel?: JSX.Element
  ChannelsTitle?: JSX.Element
  backgroundColor?: string
  searchInputBackgroundColor?: string
  searchInputTextColor?: string
  searchChannelsPosition?: 'inline' | 'bottom'
  searchInputBorderRadius?: string
  // eslint-disable-next-line no-unused-vars
  getActiveChannel?: (channel: IChannel) => void
  filter?: { channelType?: string }
  limit?: number
  sort?: 'byLastMessage' | 'byCreationDate'
  showAvatar?: boolean
  avatarBorderRadius?: string
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
  channelHoverBackground?: string
  channelSubjectFontSize?: string
  channelSubjectLineHeight?: string
  channelSubjectColor?: string
  channelLastMessageFontSize?: string
  channelLastMessageHeight?: string
  channelLastMessageTimeFontSize?: string
  channelAvatarSize?: number
  channelAvatarTextSize?: number
  searchChannelInputFontSize?: string
  searchedChannelsTitleFontSize?: string
  onChannelDeleted?: (
    // eslint-disable-next-line no-unused-vars
    channelList: IChannel[],
    // eslint-disable-next-line no-unused-vars
    deletedChannel: IChannel,
    // eslint-disable-next-line no-unused-vars
    setChannels: (updatedChannelList: IChannel[]) => void
  ) => void
  onChannelCreated?: (
    // eslint-disable-next-line no-unused-vars
    channelList: IChannel[],
    // eslint-disable-next-line no-unused-vars
    createdChannel: IChannel,
    // eslint-disable-next-line no-unused-vars
    setChannels: (updatedChannelList: IChannel[]) => void
  ) => void
  onChannelHidden?: (
    // eslint-disable-next-line no-unused-vars
    channelList: IChannel[],
    // eslint-disable-next-line no-unused-vars
    hiddenChannel: IChannel,
    // eslint-disable-next-line no-unused-vars
    setChannels: (updatedChannelList: IChannel[]) => void
  ) => void
  onChannelVisible?: (
    // eslint-disable-next-line no-unused-vars
    channelList: IChannel[],
    // eslint-disable-next-line no-unused-vars
    visibleChannel: IChannel,
    // eslint-disable-next-line no-unused-vars
    setChannels: (updatedChannelList: IChannel[]) => void
  ) => void
  onAddedToChannel?: (
    // eslint-disable-next-line no-unused-vars
    channelList: IChannel[],
    // eslint-disable-next-line no-unused-vars
    channel: IChannel,
    // eslint-disable-next-line no-unused-vars
    setChannels: (updatedChannelList: IChannel[]) => void
  ) => void
}

const ChannelList: React.FC<IChannelListProps> = ({
  className,
  selectedChannelBackground,
  selectedChannelLeftBorder,
  backgroundColor,
  searchInputBackgroundColor,
  searchInputTextColor,
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
  CreateChannel,
  ChannelsTitle,
  filter,
  limit,
  sort,
  showAvatar = true,
  avatarBorderRadius,
  showSearch = true,
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
  uploadPhotoIcon,
  channelHoverBackground,
  channelSubjectFontSize,
  channelSubjectLineHeight,
  channelSubjectColor,
  channelLastMessageFontSize,
  channelLastMessageHeight,
  channelLastMessageTimeFontSize,
  channelAvatarSize,
  channelAvatarTextSize,
  searchChannelInputFontSize,
  searchedChannelsTitleFontSize
}) => {
  const dispatch = useDispatch()
  const getFromContacts = getShowOnlyContactUsers()
  const theme = useSelector(themeSelector)
  const channelListRef = useRef<HTMLInputElement>(null)
  const channelsScrollRef = useRef<HTMLInputElement>(null)
  const [searchValue, setSearchValue] = useState('')
  const connectionStatus = useSelector(connectionStatusSelector)
  const channels = useSelector(channelsSelector, shallowEqual) || []
  const contactsMap: IContactsMap = useSelector(contactsMapSelector)
  const addedChannel = useSelector(addedChannelSelector)
  const closeSearchChannels = useSelector(closeSearchChannelSelector)
  const addedToChannel = useSelector(addedToChannelSelector)
  const deletedChannel = useSelector(deletedChannelSelector)
  const hiddenChannel = useSelector(hiddenChannelSelector)
  const visibleChannel = useSelector(visibleChannelSelector)
  const channelsHasNext = useSelector(channelsHasNextSelector) || false
  const searchedChannels = useSelector(searchedChannelsSelector) || []
  const channelsLoading = useSelector(channelsLoadingState) || {}
  const activeChannel = useSelector(activeChannelSelector) || {}
  const [listWidthIsSet, setListWidthIsSet] = useState(false)
  const [profileIsOpen, setProfileIsOpen] = useState(false)
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
  const handleCrateChatWithContact = (contact: IContact) => {
    if (contact) {
      const channelData = {
        metadata: '',
        label: '',
        type: CHANNEL_TYPE.DIRECT,
        members: [
          {
            ...contact,
            role: 'owner'
          }
        ]
      }
      dispatch(createChannelAC(channelData))
    }
    getMyChannels()
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
        onChannelDeleted(channels, deletedChannel, (updatedChannels) => handleSetChannelList(updatedChannels, true))
      } else {
        removeChannelFromMap(deletedChannel.id)
        dispatch(removeChannelAC(deletedChannel.id))
        if (activeChannel.id === deletedChannel.id) {
          const activeChannel = getLastChannelFromMap()
          dispatch(switchChannelActionAC(JSON.parse(JSON.stringify(activeChannel))))
        }
      }
      dispatch(setChannelToRemoveAC(null))
      if (searchValue) {
        getMyChannels()
      }
    }
  }, [deletedChannel])

  useDidUpdate(() => {
    if (connectionStatus === CONNECTION_STATUS.CONNECTED) {
      dispatch(getChannelsAC({ filter, limit, sort, search: '' }, false))
    }
  }, [connectionStatus])

  useDidUpdate(() => {
    if (addedChannel) {
      if (onChannelCreated) {
        onChannelCreated(channels, addedChannel, (updatedChannels) => handleSetChannelList(updatedChannels, false))
      } else {
        dispatch(addChannelAC(addedChannel))
      }
      dispatch(setChannelToAddAC(null))
    }
  }, [addedChannel])

  useEffect(() => {
    if (addedToChannel) {
      if (onAddedToChannel) {
        onAddedToChannel(channels, addedToChannel, (updatedChannels) => handleSetChannelList(updatedChannels, false))
      } else {
        dispatch(addChannelAC(addedToChannel))
      }
      dispatch(setChannelToAddAC(null))
    }
  }, [addedToChannel])

  useEffect(() => {
    if (hiddenChannel) {
      if (onChannelHidden) {
        onChannelHidden(channels, hiddenChannel, (updatedChannels) => handleSetChannelList(updatedChannels, true))
      } else {
        dispatch(removeChannelAC(hiddenChannel.id))
      }
      dispatch(setChannelToHideAC(null))
    }
  }, [hiddenChannel])

  useEffect(() => {
    if (visibleChannel) {
      if (onChannelVisible) {
        onChannelVisible(channels, visibleChannel, (updatedChannels) => handleSetChannelList(updatedChannels, true))
      } else {
        dispatch(addChannelAC(hiddenChannel))
      }
      dispatch(setChannelToUnHideAC(null))
    }
  }, [visibleChannel])

  useDidUpdate(() => {
    if (searchValue) {
      dispatch(searchChannelsAC({ filter, limit, sort, search: searchValue }, contactsMap))
    } else {
      dispatch(setSearchedChannelsAC({ chats_groups: [], channels: [], contacts: [] }))
    }
  }, [searchValue])
  useDidUpdate(() => {
    if (getActiveChannel) {
      getActiveChannel(activeChannel)
    }
  }, [activeChannel.id])

  useDidUpdate(() => {
    if (closeSearchChannels) {
      getMyChannels()
      dispatch(setCloseSearchChannelsAC(false))
    }
  }, [closeSearchChannels])

  useEffect(() => {
    if (uploadPhotoIcon) {
      setUploadImageIcon(uploadPhotoIcon)
    }
    dispatch(getChannelsAC({ filter, limit, sort, search: '' }, false))
    if (getFromContacts) {
      dispatch(getContactsAC())
    }
  }, [])

  useDidUpdate(() => {
    if (channels && channels.length) {
      if (!listWidthIsSet) {
        dispatch(setChannelListWithAC((channelListRef.current && channelListRef.current.clientWidth) || 0))
        setListWidthIsSet(true)
      }
    } else {
      setListWidthIsSet(false)
    }
    // console.log('channels. ...........................', channels)
  }, [channels])

  /* useEffect(() => {
    if (contactsMap) {
      console.log('contactsMap.>>>...', contactsMap)
    }
  }, [contactsMap]) */
  return (
    <Container
      className={className}
      withCustomList={!!List}
      ref={channelListRef}
      backgroundColor={backgroundColor || (theme === THEME.DARK ? colors.darkModeSecondaryBackgroundColor : '')}
    >
      <ChannelListHeader
        withCustomList={!!List}
        maxWidth={(channelListRef.current && channelListRef.current.clientWidth) || 0}
        borderColor={colors.backgroundColor}
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
            searchInputBackgroundColor={searchInputBackgroundColor}
            searchInputTextColor={searchInputTextColor}
            fontSize={searchChannelInputFontSize}
          />
        ) : (
          ChannelsTitle || <ChatsTitle theme={theme}>Chats</ChatsTitle>
        )}

        {showCreateChannelIcon &&
          (CreateChannel || (
            <CreateChannelButton
              theme={theme}
              newChannelIcon={newChannelIcon}
              newGroupIcon={newGroupIcon}
              newChatIcon={newChatIcon}
              uploadPhotoIcon={uploadPhotoIcon}
              createChannelIcon={createChannelIcon}
              showSearch={showSearch}
              uriPrefixOnCreateChannel={uriPrefixOnCreateChannel}
            />
          ))}
      </ChannelListHeader>
      {showSearch && searchChannelsPosition === 'bottom' && (
        <ChannelSearch
          searchValue={searchValue}
          theme={theme}
          borderRadius={searchInputBorderRadius}
          handleSearchValueChange={handleSearchValueChange}
          getMyChannels={getMyChannels}
          searchInputBackgroundColor={searchInputBackgroundColor}
          searchInputTextColor={searchInputTextColor}
          fontSize={searchChannelInputFontSize}
        />
      )}
      {/* <ChannelTabs /> */}
      {List ? (
        <List
          channels={channels}
          searchedChannels={searchedChannels}
          activeChannel={activeChannel}
          setActiveChannel={handleChangeActiveChannel}
          loadMoreChannels={handleLoadMoreChannels}
          searchValue={searchValue}
        >
          {!searchValue ? (
            <React.Fragment>
              {channels.map((channel: IChannel) =>
                ListItem ? (
                  <ListItem channel={channel} setActiveChannel={handleChangeActiveChannel} key={channel.id} />
                ) : (
                  <Channel
                    theme={theme}
                    selectedChannelLeftBorder={selectedChannelLeftBorder}
                    selectedChannelBackground={selectedChannelBackground}
                    selectedChannelBorderRadius={selectedChannelBorderRadius}
                    selectedChannelPaddings={selectedChannelPaddings}
                    channelHoverBackground={channelHoverBackground}
                    channelSubjectFontSize={channelSubjectFontSize}
                    channelSubjectLineHeight={channelSubjectLineHeight}
                    channelSubjectColor={channelSubjectColor}
                    channelLastMessageFontSize={channelLastMessageFontSize}
                    channelLastMessageHeight={channelLastMessageHeight}
                    channelLastMessageTimeFontSize={channelLastMessageTimeFontSize}
                    channelAvatarSize={channelAvatarSize}
                    channelAvatarTextSize={channelAvatarTextSize}
                    channelsPaddings={channelsPaddings}
                    channelsMargin={channelsMargin}
                    notificationsIsMutedIcon={notificationsIsMutedIcon}
                    notificationsIsMutedIconColor={notificationsIsMutedIconColor}
                    showAvatar={showAvatar}
                    avatarBorderRadius={avatarBorderRadius}
                    channel={channel}
                    key={channel.id}
                    contactsMap={contactsMap}
                  />
                )
              )}
            </React.Fragment>
          ) : channelsLoading === LOADING_STATE.LOADED && searchValue ? (
            <React.Fragment>
              {!(searchedChannels.chats_groups && searchedChannels.chats_groups.length) &&
              !(searchedChannels.channels && searchedChannels.channels.length) &&
              !(searchedChannels.contacts && searchedChannels.contacts.length) ? (
                <NoData fontSize={searchedChannelsTitleFontSize}>No channels found</NoData>
              ) : (
                <React.Fragment>
                  {!!(searchedChannels.chats_groups && searchedChannels.chats_groups.length) && (
                    <DirectChannels>
                      <SearchedChannelsHeader fontSize={searchedChannelsTitleFontSize}>
                        Chats & Groups
                      </SearchedChannelsHeader>
                      {searchedChannels.chats_groups.map((channel: IChannel) =>
                        ListItem ? (
                          <ListItem channel={channel} setActiveChannel={handleChangeActiveChannel} key={channel.id} />
                        ) : (
                          <Channel
                            theme={theme}
                            selectedChannelLeftBorder={selectedChannelLeftBorder}
                            selectedChannelBackground={selectedChannelBackground}
                            selectedChannelBorderRadius={selectedChannelBorderRadius}
                            selectedChannelPaddings={selectedChannelPaddings}
                            channelHoverBackground={channelHoverBackground}
                            channelSubjectFontSize={channelSubjectFontSize}
                            channelSubjectLineHeight={channelSubjectLineHeight}
                            channelSubjectColor={channelSubjectColor}
                            channelLastMessageFontSize={channelLastMessageFontSize}
                            channelLastMessageHeight={channelLastMessageHeight}
                            channelLastMessageTimeFontSize={channelLastMessageTimeFontSize}
                            channelAvatarSize={channelAvatarSize}
                            channelAvatarTextSize={channelAvatarTextSize}
                            channelsPaddings={channelsPaddings}
                            channelsMargin={channelsMargin}
                            notificationsIsMutedIcon={notificationsIsMutedIcon}
                            notificationsIsMutedIconColor={notificationsIsMutedIconColor}
                            showAvatar={showAvatar}
                            avatarBorderRadius={avatarBorderRadius}
                            channel={channel}
                            key={channel.id}
                            contactsMap={contactsMap}
                          />
                        )
                      )}
                    </DirectChannels>
                  )}
                  {!!(searchedChannels.contacts && searchedChannels.contacts.length) && (
                    <GroupChannels>
                      <SearchedChannelsHeader fontSize={searchedChannelsTitleFontSize}>Contacts</SearchedChannelsHeader>
                      {searchedChannels.contacts.map((contact: IContact) =>
                        ListItem ? (
                          <ListItem
                            contact={contact}
                            createChatWithContact={handleCrateChatWithContact}
                            setActiveChannel={handleChangeActiveChannel}
                            key={contact.id}
                          />
                        ) : (
                          <ContactItem
                            theme={theme}
                            selectedChannelLeftBorder={selectedChannelLeftBorder}
                            selectedChannelBackground={selectedChannelBackground}
                            selectedChannelBorderRadius={selectedChannelBorderRadius}
                            selectedChannelPaddings={selectedChannelPaddings}
                            channelHoverBackground={channelHoverBackground}
                            channelSubjectFontSize={channelSubjectFontSize}
                            channelSubjectLineHeight={channelSubjectLineHeight}
                            channelSubjectColor={channelSubjectColor}
                            channelAvatarSize={channelAvatarSize}
                            channelAvatarTextSize={channelAvatarTextSize}
                            channelsPaddings={channelsPaddings}
                            channelsMargin={channelsMargin}
                            notificationsIsMutedIcon={notificationsIsMutedIcon}
                            notificationsIsMutedIconColor={notificationsIsMutedIconColor}
                            showAvatar={showAvatar}
                            avatarBorderRadius={avatarBorderRadius}
                            contact={contact}
                            createChatWithContact={handleCrateChatWithContact}
                            key={contact.id}
                            contactsMap={contactsMap}
                          />
                        )
                      )}
                    </GroupChannels>
                  )}
                  {!!(searchedChannels.channels && searchedChannels.channels.length) && (
                    <GroupChannels>
                      <SearchedChannelsHeader fontSize={searchedChannelsTitleFontSize}>Channels</SearchedChannelsHeader>
                      {searchedChannels.channels.map((channel: IChannel) =>
                        ListItem ? (
                          <ListItem channel={channel} setActiveChannel={handleChangeActiveChannel} key={channel.id} />
                        ) : (
                          <Channel
                            theme={theme}
                            selectedChannelLeftBorder={selectedChannelLeftBorder}
                            selectedChannelBackground={selectedChannelBackground}
                            selectedChannelBorderRadius={selectedChannelBorderRadius}
                            selectedChannelPaddings={selectedChannelPaddings}
                            channelHoverBackground={channelHoverBackground}
                            channelSubjectFontSize={channelSubjectFontSize}
                            channelSubjectLineHeight={channelSubjectLineHeight}
                            channelSubjectColor={channelSubjectColor}
                            channelLastMessageFontSize={channelLastMessageFontSize}
                            channelLastMessageHeight={channelLastMessageHeight}
                            channelLastMessageTimeFontSize={channelLastMessageTimeFontSize}
                            channelAvatarSize={channelAvatarSize}
                            channelAvatarTextSize={channelAvatarTextSize}
                            channelsPaddings={channelsPaddings}
                            channelsMargin={channelsMargin}
                            notificationsIsMutedIcon={notificationsIsMutedIcon}
                            notificationsIsMutedIconColor={notificationsIsMutedIconColor}
                            showAvatar={showAvatar}
                            avatarBorderRadius={avatarBorderRadius}
                            channel={channel}
                            key={channel.id}
                            contactsMap={contactsMap}
                          />
                        )
                      )}
                    </GroupChannels>
                  )}
                </React.Fragment>
              )}
            </React.Fragment>
          ) : (
            <LoadingWrapper>
              <UploadingIcon color={colors.textColor3} />
            </LoadingWrapper>
          )}
        </List>
      ) : (
        <React.Fragment>
          {!searchValue && (
            <ChannelsList ref={channelsScrollRef} onScroll={handleAllChannelsListScroll}>
              {channels.map((channel: IChannel) =>
                ListItem ? (
                  <ListItem channel={channel} setActiveChannel={handleChangeActiveChannel} key={channel.id} />
                ) : (
                  <Channel
                    theme={theme}
                    selectedChannelLeftBorder={selectedChannelLeftBorder}
                    selectedChannelBackground={selectedChannelBackground}
                    selectedChannelBorderRadius={selectedChannelBorderRadius}
                    selectedChannelPaddings={selectedChannelPaddings}
                    channelHoverBackground={channelHoverBackground}
                    channelSubjectFontSize={channelSubjectFontSize}
                    channelSubjectLineHeight={channelSubjectLineHeight}
                    channelSubjectColor={channelSubjectColor}
                    channelLastMessageFontSize={channelLastMessageFontSize}
                    channelLastMessageHeight={channelLastMessageHeight}
                    channelLastMessageTimeFontSize={channelLastMessageTimeFontSize}
                    channelAvatarSize={channelAvatarSize}
                    channelAvatarTextSize={channelAvatarTextSize}
                    channelsPaddings={channelsPaddings}
                    channelsMargin={channelsMargin}
                    notificationsIsMutedIcon={notificationsIsMutedIcon}
                    notificationsIsMutedIconColor={notificationsIsMutedIconColor}
                    showAvatar={showAvatar}
                    avatarBorderRadius={avatarBorderRadius}
                    channel={channel}
                    key={channel.id}
                    contactsMap={contactsMap}
                  />
                )
              )}
            </ChannelsList>
          )}
          {!!searchValue &&
            (channelsLoading === LOADING_STATE.LOADED ? (
              !searchedChannels.chats_groups.length && !searchedChannels.chats_groups.length ? (
                <NoData fontSize={searchedChannelsTitleFontSize}>
                  Nothing found for <b>{searchValue}</b>
                </NoData>
              ) : (
                <SearchedChannels>
                  {!!searchedChannels.chats_groups.length && (
                    <DirectChannels>
                      <SearchedChannelsHeader fontSize={searchedChannelsTitleFontSize}>
                        Chats & Groups
                      </SearchedChannelsHeader>
                      {searchedChannels.chats_groups.map((channel: IChannel) =>
                        ListItem ? (
                          <ListItem channel={channel} setActiveChannel={handleChangeActiveChannel} key={channel.id} />
                        ) : (
                          <Channel
                            theme={theme}
                            selectedChannelLeftBorder={selectedChannelLeftBorder}
                            selectedChannelBackground={selectedChannelBackground}
                            selectedChannelBorderRadius={selectedChannelBorderRadius}
                            selectedChannelPaddings={selectedChannelPaddings}
                            channelHoverBackground={channelHoverBackground}
                            channelSubjectFontSize={channelSubjectFontSize}
                            channelSubjectLineHeight={channelSubjectLineHeight}
                            channelSubjectColor={channelSubjectColor}
                            channelLastMessageFontSize={channelLastMessageFontSize}
                            channelLastMessageHeight={channelLastMessageHeight}
                            channelLastMessageTimeFontSize={channelLastMessageTimeFontSize}
                            channelAvatarSize={channelAvatarSize}
                            channelAvatarTextSize={channelAvatarTextSize}
                            channelsPaddings={channelsPaddings}
                            channelsMargin={channelsMargin}
                            notificationsIsMutedIcon={notificationsIsMutedIcon}
                            notificationsIsMutedIconColor={notificationsIsMutedIconColor}
                            showAvatar={showAvatar}
                            avatarBorderRadius={avatarBorderRadius}
                            channel={channel}
                            contactsMap={contactsMap}
                            key={channel.id}
                          />
                        )
                      )}
                    </DirectChannels>
                  )}
                  {!!searchedChannels.channels.length && (
                    <GroupChannels>
                      <SearchedChannelsHeader fontSize={searchedChannelsTitleFontSize}>Channels</SearchedChannelsHeader>
                      {searchedChannels.channels.map((channel: IChannel) =>
                        ListItem ? (
                          <ListItem channel={channel} setActiveChannel={handleChangeActiveChannel} key={channel.id} />
                        ) : (
                          <Channel
                            theme={theme}
                            selectedChannelLeftBorder={selectedChannelLeftBorder}
                            selectedChannelBackground={selectedChannelBackground}
                            selectedChannelBorderRadius={selectedChannelBorderRadius}
                            selectedChannelPaddings={selectedChannelPaddings}
                            channelHoverBackground={channelHoverBackground}
                            channelSubjectFontSize={channelSubjectFontSize}
                            channelSubjectLineHeight={channelSubjectLineHeight}
                            channelSubjectColor={channelSubjectColor}
                            channelLastMessageFontSize={channelLastMessageFontSize}
                            channelLastMessageHeight={channelLastMessageHeight}
                            channelLastMessageTimeFontSize={channelLastMessageTimeFontSize}
                            channelAvatarSize={channelAvatarSize}
                            channelAvatarTextSize={channelAvatarTextSize}
                            channelsPaddings={channelsPaddings}
                            channelsMargin={channelsMargin}
                            notificationsIsMutedIcon={notificationsIsMutedIcon}
                            notificationsIsMutedIconColor={notificationsIsMutedIconColor}
                            showAvatar={showAvatar}
                            avatarBorderRadius={avatarBorderRadius}
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
              )
            ) : (
              <LoadingWrapper>
                <UploadingIcon color={colors.textColor3} />
              </LoadingWrapper>
            ))}
        </React.Fragment>
      )}

      {profileIsOpen && <ProfileSettings handleCloseProfile={handleOpenProfile} />}
    </Container>
  )
}

export default ChannelList

const Container = styled.div<{ withCustomList?: boolean; ref?: any; backgroundColor?: string }>`
  position: relative;
  display: flex;
  flex-direction: column;
  width: ${(props) => (props.withCustomList ? '' : '400px')};
  min-width: ${(props) => (props.withCustomList ? '' : '400px')};
  border-right: ${(props) => (props.withCustomList ? '' : `1px solid ${colors.backgroundColor}`)};
  background-color: ${(props) => props.backgroundColor};
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
const SearchedChannelsHeader = styled.p<{ fontSize?: string }>`
  padding-left: 16px;
  font-weight: 500;
  font-size: ${(props) => props.fontSize || '15px'};
  line-height: 14px;
  color: ${colors.textColor2};
`
const DirectChannels = styled.div``
const GroupChannels = styled.div``

const ChatsTitle = styled.h3<{ theme?: string }>`
  font-family: Inter, sans-serif;
  font-style: normal;
  font-weight: 500;
  font-size: 20px;
  line-height: 28px;
  margin: 0 auto;
  color: ${(props) => (props.theme === THEME.DARK ? colors.darkModeTextColor1 : colors.textColor1)};
`

const NoData = styled.div<{ fontSize?: string }>`
  text-align: center;
  padding: 10px;
  font-size: ${(props) => props.fontSize};
  color: ${colors.textColor2};
`
const LoadingWrapper = styled.div`
  position: absolute;
  left: calc(50% - 20px);
  top: calc(50% - 20px);
`
const ChannelListHeader = styled.div<{
  maxWidth?: number
  withoutProfile?: any
  withCustomList?: boolean
  borderColor?: string
}>`
  display: flex;
  align-items: center;
  flex-direction: row;
  justify-content: space-between;
  //justify-content: flex-end;
  padding: 12px;
  box-sizing: border-box;
  max-width: ${(props) => (props.maxWidth ? `${props.maxWidth}px` : 'inherit')};
  padding-left: ${(props) => props.withoutProfile && '52px'};
  border-right: ${(props) => props.withCustomList && `1px solid ${props.borderColor}`};
`
