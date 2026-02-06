import React, { FC, useEffect, useRef, useState } from 'react'
import { shallowEqual } from 'react-redux'
import { useSelector, useDispatch } from 'store/hooks'
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
  getChannelMentionsAC,
  getChannelsAC,
  loadMoreChannels,
  removeChannelAC,
  searchChannelsAC,
  sendTypingAC,
  setChannelListWithAC,
  setChannelsAC,
  setChannelToAddAC,
  setChannelToHideAC,
  setChannelToRemoveAC,
  setChannelToUnHideAC,
  setCloseSearchChannelsAC,
  setSearchedChannelsAC,
  switchChannelActionAC,
  switchChannelInfoAC
} from '../../store/channel/actions'
import { getContactsAC } from '../../store/user/actions'
import { CONNECTION_STATUS } from '../../store/user/constants'
// Hooks
import { useColor, useDidUpdate } from '../../hooks'
// Helpers
import {
  getChannelMembersCount,
  getLastChannelFromMap,
  getPendingDeleteChannel,
  removeChannelFromMap,
  setUploadImageIcon
} from '../../helpers/channelHalper'
import { getShowOnlyContactUsers } from '../../helpers/contacts'
import { DEFAULT_CHANNEL_TYPE, LOADING_STATE } from '../../helpers/constants'
import { device, THEME_COLORS } from '../../UIHelper/constants'
import { UploadingIcon } from '../../UIHelper'
import { IChannel, IContact, IContactsMap, ICreateChannel, IMessage, IUser } from '../../types'
// Components
import Channel from '../Channel'
import ChannelSearch from './ChannelSearch'
import ContactItem from './ContactItem'
import CreateChannelButton from './CreateChannelButton'
import ProfileSettings from './ProfileSettings'
import { clearMessagesAC } from 'store/message/actions'

interface IChannelListProps {
  List?: FC<{
    channels: IChannel[]
    searchedChannels: { chats_groups: []; channels: []; contacts: [] }
    loadMoreChannels: (count?: number) => void
    searchValue: string
    children: React.ReactNode
    selectedChannel?: IChannel
    setSelectedChannel?: (channel: IChannel) => void
  }>
  ListItem?: FC<{
    channel?: IChannel
    contact?: IContact
    setSelectedChannel?: (channel: IChannel) => void
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
  channelSearchWidth?: string
  searchInputBorderRadius?: string
  searchChannelsPadding?: string
  getSelectedChannel?: (channel: IChannel) => void
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
  pinedIcon?: JSX.Element
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
    channelList: IChannel[],
    deletedChannel: IChannel,
    setChannels: (updatedChannelList: IChannel[]) => void
  ) => void
  onChannelCreated?: (
    channelList: IChannel[],
    createdChannel: IChannel,
    setChannels: (updatedChannelList: IChannel[]) => void
  ) => void
  onChannelHidden?: (
    channelList: IChannel[],
    hiddenChannel: IChannel,
    setChannels: (updatedChannelList: IChannel[]) => void
  ) => void
  onChannelVisible?: (
    channelList: IChannel[],
    visibleChannel: IChannel,
    setChannels: (updatedChannelList: IChannel[]) => void
  ) => void
  onAddedToChannel?: (
    channelList: IChannel[],
    channel: IChannel,
    setChannels: (updatedChannelList: IChannel[]) => void
  ) => void
  getCustomLatestMessage?: (
    lastMessage: IMessage,
    typingOrRecording: any,
    draftMessageText: any,
    textSecondary: string,
    channel: IChannel,
    channelLastMessageFontSize: string,
    channelLastMessageHeight: string,
    isDirectChannel: boolean,
    textPrimary: string,
    messageAuthorRef: any,
    contactsMap: { [key: string]: IContact },
    getFromContacts: boolean,
    warningColor: string,
    user: IUser,
    MessageText: any
  ) => any
  doNotShowMessageDeliveryTypes?: string[]
  showPhoneNumber?: boolean
}

const ChannelList: React.FC<IChannelListProps> = ({
  className,
  selectedChannelBackground,
  selectedChannelLeftBorder,
  backgroundColor,
  searchInputBackgroundColor,
  searchInputTextColor,
  searchChannelsPosition = 'bottom',
  channelSearchWidth,
  searchInputBorderRadius,
  selectedChannelBorderRadius,
  selectedChannelPaddings,
  channelsPaddings,
  channelsMargin,
  List,
  ListItem,
  getSelectedChannel,
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
  pinedIcon,
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
  searchedChannelsTitleFontSize,
  searchChannelsPadding,
  getCustomLatestMessage,
  doNotShowMessageDeliveryTypes = ['system'],
  showPhoneNumber = false
}) => {
  const {
    [THEME_COLORS.BACKGROUND]: background,
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.TEXT_FOOTNOTE]: textFootnote,
    [THEME_COLORS.BORDER]: borderColor,
    [THEME_COLORS.SURFACE_2]: surface2
  } = useColor()
  const dispatch = useDispatch()
  const getFromContacts = getShowOnlyContactUsers()
  const channelListRef = useRef<HTMLInputElement | null>(null)
  const channelsScrollRef = useRef<HTMLInputElement | null>(null)
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
  const [isScrolling, setIsScrolling] = useState<boolean>(false)

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

  const handleCrateChatWithContact = (contact: IContact) => {
    if (contact) {
      const channelData: ICreateChannel = {
        metadata: '',
        label: '',
        type: DEFAULT_CHANNEL_TYPE.DIRECT,
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
          dispatch(switchChannelActionAC(activeChannel ? JSON.parse(JSON.stringify(activeChannel)) : {}))
          if (!activeChannel) {
            dispatch(switchChannelInfoAC(false))
          }
        }
      }
      dispatch(setChannelToRemoveAC(null))
      if (searchValue) {
        getMyChannels()
      }
    }
  }, [deletedChannel])

  useEffect(() => {
    if (connectionStatus === CONNECTION_STATUS.CONNECTED) {
      dispatch(getChannelsAC({ filter, limit, sort, search: '', memberCount: getChannelMembersCount() }, false))
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
      dispatch(
        searchChannelsAC(
          { filter, limit, sort, search: searchValue, memberCount: getChannelMembersCount() },
          contactsMap
        )
      )
    } else {
      dispatch(setSearchedChannelsAC({ chats_groups: [], channels: [], contacts: [] }))
    }
  }, [searchValue])

  useDidUpdate(() => {
    if (getSelectedChannel) {
      if (!activeChannel?.mentionsIds && activeChannel?.id && connectionStatus === CONNECTION_STATUS.CONNECTED) {
        dispatch(getChannelMentionsAC(activeChannel.id))
      }
      getSelectedChannel(activeChannel)
    }
  }, [activeChannel, activeChannel?.members, activeChannel?.members?.length, activeChannel?.id, connectionStatus])

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
    if (getFromContacts) {
      dispatch(getContactsAC())
    }
  }, [])

  useDidUpdate(() => {
    if (channels && channels.length) {
      if (!listWidthIsSet) {
        dispatch(setChannelListWithAC((channelListRef.current && channelListRef.current?.clientWidth) || 0))
        setListWidthIsSet(true)
      }
    } else {
      setListWidthIsSet(false)
    }
  }, [channels])

  const setSelectedChannel = (channel: IChannel) => {
    if (activeChannel.id !== channel.id) {
      dispatch(sendTypingAC(false))
      dispatch(clearMessagesAC())
      dispatch(switchChannelActionAC(channel))
    }
  }

  // useEffect(() => {
  //   const closeActiveChannel = (e: any) => {
  //     if (e.key === 'Escape') {
  //       dispatch(switchChannelActionAC(null))
  //     }
  //   }
  //   window.addEventListener('keydown', closeActiveChannel)
  //   return () => {
  //     window.removeEventListener('keydown', closeActiveChannel)
  //   }
  // }, [])

  return (
    <Container
      className={className}
      withCustomList={!!List}
      ref={channelListRef}
      borderColor={borderColor}
      backgroundColor={backgroundColor || background}
    >
      <ChannelListHeader
        withCustomList={!!List}
        maxWidth='100%'
        borderColor={borderColor}
        padding={searchChannelsPadding}
      >
        {Profile}
        {showSearch && searchChannelsPosition === 'inline' ? (
          <ChannelSearch
            inline
            width={channelSearchWidth}
            borderRadius={searchInputBorderRadius}
            searchValue={searchValue}
            handleSearchValueChange={handleSearchValueChange}
            getMyChannels={getMyChannels}
            searchInputBackgroundColor={searchInputBackgroundColor}
            searchInputTextColor={searchInputTextColor}
            fontSize={searchChannelInputFontSize}
          />
        ) : (
          ChannelsTitle || <ChatsTitle color={textPrimary}>Chats</ChatsTitle>
        )}

        {showCreateChannelIcon &&
          (CreateChannel || (
            <CreateChannelButton
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
          width={channelSearchWidth}
          borderRadius={searchInputBorderRadius}
          handleSearchValueChange={handleSearchValueChange}
          getMyChannels={getMyChannels}
          searchInputBackgroundColor={searchInputBackgroundColor}
          searchInputTextColor={searchInputTextColor}
          fontSize={searchChannelInputFontSize}
        />
      )}
      {List ? (
        <List
          channels={channels}
          searchedChannels={searchedChannels}
          selectedChannel={activeChannel}
          setSelectedChannel={setSelectedChannel}
          loadMoreChannels={handleLoadMoreChannels}
          searchValue={searchValue}
        >
          {!searchValue ? (
            <React.Fragment>
              {channels.map(
                (channel: IChannel) =>
                  !getPendingDeleteChannel(channel.id) &&
                  (ListItem ? (
                    <ListItem channel={channel} setSelectedChannel={setSelectedChannel} key={channel.id} />
                  ) : (
                    <Channel
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
                      pinedIcon={pinedIcon}
                      showAvatar={showAvatar}
                      avatarBorderRadius={avatarBorderRadius}
                      channel={channel}
                      key={channel.id}
                      contactsMap={contactsMap}
                      setSelectedChannel={setSelectedChannel}
                      getCustomLatestMessage={getCustomLatestMessage as any}
                      doNotShowMessageDeliveryTypes={doNotShowMessageDeliveryTypes}
                      showPhoneNumber={showPhoneNumber}
                    />
                  ))
              )}
            </React.Fragment>
          ) : channelsLoading === LOADING_STATE.LOADED && searchValue ? (
            <React.Fragment>
              {searchedChannels?.chats_groups?.length ||
              searchedChannels?.channels?.length ||
              searchedChannels?.contacts?.length ? (
                <React.Fragment>
                  {!!(searchedChannels.chats_groups && searchedChannels.chats_groups.length) && (
                    <DirectChannels>
                      <SearchedChannelsHeader color={textSecondary} fontSize={searchedChannelsTitleFontSize}>
                        Chats & Groups
                      </SearchedChannelsHeader>
                      {searchedChannels.chats_groups.map((channel: IChannel) =>
                        ListItem ? (
                          <ListItem channel={channel} setSelectedChannel={setSelectedChannel} key={channel.id} />
                        ) : (
                          <Channel
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
                            pinedIcon={pinedIcon}
                            showAvatar={showAvatar}
                            avatarBorderRadius={avatarBorderRadius}
                            channel={channel}
                            key={channel.id}
                            contactsMap={contactsMap}
                            setSelectedChannel={setSelectedChannel}
                            getCustomLatestMessage={getCustomLatestMessage as any}
                            doNotShowMessageDeliveryTypes={doNotShowMessageDeliveryTypes}
                            showPhoneNumber={showPhoneNumber}
                          />
                        )
                      )}
                    </DirectChannels>
                  )}
                  {!!(searchedChannels.contacts && searchedChannels.contacts.length) && (
                    <GroupChannels>
                      <SearchedChannelsHeader color={textSecondary} fontSize={searchedChannelsTitleFontSize}>
                        Contacts
                      </SearchedChannelsHeader>
                      {searchedChannels.contacts.map((contact: IContact) =>
                        ListItem ? (
                          <ListItem
                            contact={contact}
                            createChatWithContact={handleCrateChatWithContact}
                            setSelectedChannel={setSelectedChannel}
                            key={contact.id}
                          />
                        ) : (
                          <ContactItem
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
                  {!!searchedChannels.channels?.length && (
                    <GroupChannels>
                      <SearchedChannelsHeader color={textSecondary} fontSize={searchedChannelsTitleFontSize}>
                        Channels
                      </SearchedChannelsHeader>
                      {searchedChannels.channels.map((channel: IChannel) =>
                        ListItem ? (
                          <ListItem channel={channel} setSelectedChannel={setSelectedChannel} key={channel.id} />
                        ) : (
                          <Channel
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
                            pinedIcon={pinedIcon}
                            showAvatar={showAvatar}
                            avatarBorderRadius={avatarBorderRadius}
                            channel={channel}
                            key={channel.id}
                            contactsMap={contactsMap}
                            setSelectedChannel={setSelectedChannel}
                            getCustomLatestMessage={getCustomLatestMessage as any}
                            doNotShowMessageDeliveryTypes={doNotShowMessageDeliveryTypes}
                            showPhoneNumber={showPhoneNumber}
                          />
                        )
                      )}
                    </GroupChannels>
                  )}
                </React.Fragment>
              ) : (
                <NoData color={textSecondary} fontSize={searchedChannelsTitleFontSize}>
                  No channels found
                </NoData>
              )}
            </React.Fragment>
          ) : (
            <LoadingWrapper>
              <UploadingIcon color={textFootnote} />
            </LoadingWrapper>
          )}
        </List>
      ) : (
        <React.Fragment>
          {!searchValue && (
            <ChannelsList
              ref={channelsScrollRef}
              onScroll={handleAllChannelsListScroll}
              onMouseEnter={() => setIsScrolling(true)}
              onMouseLeave={() => setIsScrolling(false)}
              className={isScrolling ? 'show-scrollbar' : ''}
              thumbColor={surface2}
            >
              {channels.map((channel: IChannel) =>
                ListItem ? (
                  <ListItem channel={channel} setSelectedChannel={setSelectedChannel} key={channel.id} />
                ) : (
                  <Channel
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
                    pinedIcon={pinedIcon}
                    showAvatar={showAvatar}
                    avatarBorderRadius={avatarBorderRadius}
                    channel={channel}
                    key={channel.id}
                    contactsMap={contactsMap}
                    setSelectedChannel={setSelectedChannel}
                    getCustomLatestMessage={getCustomLatestMessage as any}
                    doNotShowMessageDeliveryTypes={doNotShowMessageDeliveryTypes}
                    showPhoneNumber={showPhoneNumber}
                  />
                )
              )}
            </ChannelsList>
          )}
          {!!searchValue &&
            (channelsLoading === LOADING_STATE.LOADED ? (
              !searchedChannels.chats_groups?.length &&
              !searchedChannels.chats_groups?.length &&
              !searchedChannels.channels?.length ? (
                <NoData color={textSecondary} fontSize={searchedChannelsTitleFontSize}>
                  Nothing found for <b>{searchValue}</b>
                </NoData>
              ) : (
                <SearchedChannels>
                  {!!searchedChannels.chats_groups.length && (
                    <DirectChannels>
                      <SearchedChannelsHeader color={textSecondary} fontSize={searchedChannelsTitleFontSize}>
                        Chats & Groups
                      </SearchedChannelsHeader>
                      {searchedChannels.chats_groups.map((channel: IChannel) =>
                        ListItem ? (
                          <ListItem channel={channel} setSelectedChannel={setSelectedChannel} key={channel.id} />
                        ) : (
                          <Channel
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
                            pinedIcon={pinedIcon}
                            showAvatar={showAvatar}
                            avatarBorderRadius={avatarBorderRadius}
                            channel={channel}
                            contactsMap={contactsMap}
                            key={channel.id}
                            setSelectedChannel={setSelectedChannel}
                            getCustomLatestMessage={getCustomLatestMessage as any}
                            doNotShowMessageDeliveryTypes={doNotShowMessageDeliveryTypes}
                            showPhoneNumber={showPhoneNumber}
                          />
                        )
                      )}
                    </DirectChannels>
                  )}
                  {!!searchedChannels.channels.length && (
                    <GroupChannels>
                      <SearchedChannelsHeader color={textSecondary} fontSize={searchedChannelsTitleFontSize}>
                        Channels
                      </SearchedChannelsHeader>
                      {searchedChannels.channels.map((channel: IChannel) =>
                        ListItem ? (
                          <ListItem channel={channel} setSelectedChannel={setSelectedChannel} key={channel.id} />
                        ) : (
                          <Channel
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
                            pinedIcon={pinedIcon}
                            showAvatar={showAvatar}
                            avatarBorderRadius={avatarBorderRadius}
                            channel={channel}
                            key={channel.id}
                            contactsMap={contactsMap}
                            setSelectedChannel={setSelectedChannel}
                            getCustomLatestMessage={getCustomLatestMessage as any}
                            doNotShowMessageDeliveryTypes={doNotShowMessageDeliveryTypes}
                            showPhoneNumber={showPhoneNumber}
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
                <UploadingIcon color={textFootnote} />
              </LoadingWrapper>
            ))}
        </React.Fragment>
      )}

      {profileIsOpen && <ProfileSettings handleCloseProfile={handleOpenProfile} />}
    </Container>
  )
}

export default ChannelList

const Container = styled.div<{ borderColor: string; withCustomList?: boolean; ref?: any; backgroundColor?: string }>`
  position: relative;
  display: flex;
  flex-direction: column;
  width: ${(props: { withCustomList?: boolean; ref?: any; backgroundColor?: string }) =>
    props.withCustomList ? '' : '400px'};
  min-width: ${(props) => (props.withCustomList ? '' : '400px')};
  border-right: ${(props) => (props.withCustomList ? '' : `1px solid ${props.borderColor}`)};
  background-color: ${(props) => props.backgroundColor};
  height: 100%;
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

const ChannelsList = styled.div<{ thumbColor: string }>`
  overflow-y: auto;
  width: 400px;
  height: 100%;

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
const SearchedChannels = styled.div`
  height: calc(100vh - 123px);
  overflow-x: hidden;
`
const SearchedChannelsHeader = styled.p<{ color: string; fontSize?: string }>`
  padding-left: 16px;
  font-weight: 500;
  font-size: ${(props: { fontSize?: string }) => props.fontSize || '15px'};
  line-height: 14px;
  color: ${(props) => props.color};
`
const DirectChannels = styled.div``
const GroupChannels = styled.div``

const ChatsTitle = styled.h3<{ color: string }>`
  font-family: Inter, sans-serif;
  font-style: normal;
  font-weight: 500;
  font-size: 20px;
  line-height: 28px;
  margin: 0 auto;
  color: ${(props) => props.color};
`

const NoData = styled.div<{ color: string; fontSize?: string }>`
  text-align: center;
  padding: 10px;
  font-size: ${(props) => props.fontSize};
  color: ${(props) => props.color};
`
const LoadingWrapper = styled.div`
  position: absolute;
  left: calc(50% - 20px);
  top: calc(50% - 20px);
`
const ChannelListHeader = styled.div<{
  maxWidth?: string
  withoutProfile?: any
  withCustomList?: boolean
  borderColor?: string
  padding?: string
}>`
  display: flex;
  align-items: center;
  flex-direction: row;
  justify-content: space-between;
  max-width: ${(props: {
    maxWidth?: string
    withoutProfile?: any
    withCustomList?: boolean
    borderColor?: string
    padding?: string
  }) => (props.maxWidth ? `${props.maxWidth}` : 'inherit')};
  padding: ${(props) => props.padding || '12px'};
  box-sizing: border-box;
  padding-left: ${(props) => props.withoutProfile && '52px'};
  border-right: ${(props) => props.withCustomList && `1px solid ${props.borderColor}`};
`
