import React, { FC, useEffect, useRef } from 'react'
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
  searchValueSelector,
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
import {
  ChannelsList,
  Container,
  DirectChannels,
  GroupChannels,
  SearchedChannels,
  SearchedChannelsHeader
} from './styled'
import Channel from '../Channel'
import ChannelSearch from './ChannelSearch'
import Avatar from '../Avatar'
import { getClient } from '../../common/client'
import { removeChannelFromMap } from '../../helpers/channelHalper'
import { colors, setCustomColors } from '../../UIHelper/constants'
import { ICustomColors } from '../Channel/types'
import { IChannel, IContactsMap } from '../../types'
import { ReactComponent as BottomIcon } from '../../assets/svg/chevronBottom.svg'
import CreateChannelButton from './CreateChannelButton'
import { getContactsAC } from '../../store/user/actions'

interface IChannelListProps {
  customColors?: ICustomColors
  List?: FC<{ channels: IChannel[]; loadMoreChannels: (count?: number) => void; children?: React.ReactNode }>
  ListItem?: FC<any>
  filter?: { channelType: 'Public' | 'Private' | 'Direct' }
  limit?: number
  sort?: 'byLastMessage' | 'byCreationDate'
  avatar?: boolean
  showSearch?: boolean
  forceUpdateChannelList?: () => void
  showCreateChannelIcon?: boolean
  notificationsIsMutedIcon?: JSX.Element
  notificationsIsMutedIconColor?: string
  onChannelDeleted?: (setChannels: (channels: IChannel[]) => void, channel: IChannel) => void
  onChannelCreated?: (setChannels: (channels: IChannel[]) => void, channel: IChannel) => void
  onChannelHidden?: (setChannels: (channels: IChannel[]) => void, channel: IChannel) => void
  onChannelVisible?: (setChannels: (channels: IChannel[]) => void, channel: IChannel) => void
  onAddedToChannel?: (setChannels: (channels: IChannel[]) => void, channel: IChannel) => void
}

const ChannelList: React.FC<IChannelListProps> = ({
  customColors,
  List,
  ListItem,
  filter,
  limit,
  sort,
  avatar,
  showSearch = true,
  showCreateChannelIcon = true,
  onChannelDeleted,
  onChannelCreated,
  onChannelHidden,
  onChannelVisible,
  onAddedToChannel,
  notificationsIsMutedIcon,
  notificationsIsMutedIconColor
  // forceUpdateChannelList
}) => {
  const dispatch = useDispatch()
  // const [searchValue, setSearchValue] = useState('');
  const channelListRef = useRef<HTMLInputElement>(null)
  const connectionStatus = useSelector(connectionStatusSelector)
  const searchValue = useSelector(searchValueSelector) || ''
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
  const SceytChatClient = getClient()
  const user = SceytChatClient.chatClient.user
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
    if (channelsLoading === LOADING_STATE.LOADED) {
      dispatch(loadMoreChannels(count))
    }
  }

  const handleAllChannelsListScroll = (e: any) => {
    console.log(' e.target.scrollTop ... . ', e.target.scrollTop)
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
    const { value } = e.target
    console.log('dispatch get channels  4 ')
    dispatch(getChannelsAC({ search: value }))
  }

  const getMyChannels = () => {
    dispatch(getContactsAC())
    console.log('dispatch get channels  2 ')
    dispatch(getChannelsAC({ search: '' }))
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

  useEffect(() => {
    if (connectionStatus === CONNECTION_STATUS.CONNECTED) {
      dispatch(getChannelsAC({ filter, limit, sort, search: '' }, false))
      dispatch(getContactsAC())
    }
  }, [connectionStatus])

  useEffect(() => {
    if (addedChannel) {
      if (onChannelCreated) {
        onChannelCreated((updatedChannels) => handleSetChannelList(updatedChannels, false), addedChannel)
      } else {
        console.log('addedChannel add channel from comp ... ', addedToChannel)
        dispatch(addChannelAC(addedChannel))
      }
      dispatch(setChannelToAddAC(null))
    }
  }, [addedChannel])

  useEffect(() => {
    if (addedToChannel) {
      if (onAddedToChannel) {
        console.log('call added to channel on use effect')
        onAddedToChannel((updatedChannels) => handleSetChannelList(updatedChannels, false), addedToChannel)
      } else {
        console.log('addedToChannel add channel from comp ... ', addedToChannel)
        dispatch(addChannelAC(addedToChannel))
      }
      dispatch(setChannelToAddAC(null))
    }
  }, [addedToChannel])

  useEffect(() => {
    if (hiddenChannel) {
      if (onChannelHidden) {
        console.log('call hidden channel')
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
        console.log('call visible channel')
        onChannelVisible((updatedChannels) => handleSetChannelList(updatedChannels, true), visibleChannel)
      } else {
        dispatch(addChannelAC(hiddenChannel))
      }
      dispatch(setChannelToUnHideAC(null))
    }
  }, [visibleChannel])

  useEffect(() => {
    if (customColors) {
      setCustomColors(customColors)
    }
    dispatch(setChannelListWithAC((channelListRef.current && channelListRef.current.clientWidth) || 0))
  }, [])

  return (
    <React.Fragment>
      <Container isCustomContainer={!!List} ref={channelListRef}>
        <ChannelListHeader maxWidth={(channelListRef.current && channelListRef.current.clientWidth) || 0}>
          <ProfileCont>
            <Avatar image={user.avatarUrl} name={user.firstName || user.id} size={32} textSize={15} setDefaultAvatar />
            <BottomIcon />
          </ProfileCont>
          {showSearch && (
            <ChannelSearch
              searchValue={searchValue}
              handleSearchValueChange={handleSearchValueChange}
              getMyChannels={getMyChannels}
            />
          )}
          {showCreateChannelIcon && <CreateChannelButton showSearch={showSearch} />}
        </ChannelListHeader>
        {/* <ChannelTabs /> */}
        {List ? (
          <List channels={channels} loadMoreChannels={handleLoadMoreChannels}>
            {!directChannels.length && !searchValue && (
              <React.Fragment>
                {channels.map((channel: IChannel) =>
                  ListItem ? (
                    <ListItem channel={channel} setActiveChannel={handleChangeActiveChannel} key={channel.id} />
                  ) : (
                    <Channel
                      notificationsIsMutedIcon={notificationsIsMutedIcon}
                      notificationsIsMutedIconColor={notificationsIsMutedIconColor}
                      avatar={avatar}
                      customColors={customColors}
                      channel={channel}
                      key={channel.id}
                      contactsMap={contactsMap}
                    />
                  )
                )}
              </React.Fragment>
            )}
            {channelsLoading === LOADING_STATE.LOADED && searchValue && (
              <React.Fragment>
                {!!directChannels.length && (
                  <DirectChannels>
                    <SearchedChannelsHeader>DIRECT</SearchedChannelsHeader>
                    {directChannels.map((channel: IChannel) =>
                      ListItem ? (
                        <ListItem channel={channel} setActiveChannel={handleChangeActiveChannel} key={channel.id} />
                      ) : (
                        <Channel
                          notificationsIsMutedIcon={notificationsIsMutedIcon}
                          notificationsIsMutedIconColor={notificationsIsMutedIconColor}
                          avatar={avatar}
                          customColors={customColors}
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
                          notificationsIsMutedIcon={notificationsIsMutedIcon}
                          notificationsIsMutedIconColor={notificationsIsMutedIconColor}
                          avatar={avatar}
                          customColors={customColors}
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
                      notificationsIsMutedIcon={notificationsIsMutedIcon}
                      notificationsIsMutedIconColor={notificationsIsMutedIconColor}
                      avatar={avatar}
                      customColors={customColors}
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
                          notificationsIsMutedIcon={notificationsIsMutedIcon}
                          notificationsIsMutedIconColor={notificationsIsMutedIconColor}
                          avatar={avatar}
                          customColors={customColors}
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
                          notificationsIsMutedIcon={notificationsIsMutedIcon}
                          notificationsIsMutedIconColor={notificationsIsMutedIconColor}
                          avatar={avatar}
                          customColors={customColors}
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
      </Container>
    </React.Fragment>
  )
}

export default ChannelList

const ChannelListHeader = styled.div<{ maxWidth?: number }>`
  display: flex;
  align-items: center;
  flex-direction: row;
  justify-content: space-between;
  //justify-content: flex-end;
  padding: 12px;
  border-right: 1px solid ${colors.gray1};
  min-height: 68px;
  box-sizing: border-box;
  max-width: ${(props) => props.maxWidth && `${props.maxWidth}px`};
`

const ProfileCont = styled.div`
  display: flex;
  align-items: center;
  margin-right: 12px;
  cursor: pointer;

  & > svg {
    margin-left: 4px;
  }
`
