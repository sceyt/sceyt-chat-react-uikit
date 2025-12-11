import React, { useEffect, useCallback, useRef, useState, useMemo } from 'react'
import { Popup, PopupName, CloseIcon, PopupBody } from '../../../UIHelper'
import { THEME_COLORS } from '../../../UIHelper/constants'
import styled from 'styled-components'
import { useSelector, useDispatch } from 'store/hooks'
import { IMember, IChannel, IUser, IContact } from '../../../types'
import { Avatar } from '../../../components'
import { DEFAULT_CHANNEL_TYPE, LOADING_STATE } from '../../../helpers/constants'
import {
  mutualChannelsSelector,
  mutualChannelsHasNextSelector,
  mutualChannelsLoadingStateSelector,
  activeChannelSelector
} from '../../../store/channel/selector'
import {
  getChannelsWithUserAC,
  loadMoreMutualChannelsAC,
  setMutualChannelsAC,
  switchChannelActionAC
} from '../../../store/channel/actions'
import PopupContainer from '../popupContainer'
import { useColor } from '../../../hooks'
import { getClient } from 'common/client'
import { makeUsername } from 'helpers/message'
import { getShowOnlyContactUsers } from 'helpers/contacts'
import { connectionStatusSelector, contactsMapSelector } from 'store/user/selector'
import { ReactComponent as ChevronRightIcon } from '../../../assets/svg/chevronBottom.svg'
import { clearMessagesAC } from 'store/message/actions'
import { CONNECTION_STATUS } from 'store/user/constants'

interface IProps {
  theme?: string
  togglePopup: () => void
  user: IMember | null | undefined
}

const formatMemberCount = (count: number, channelType: string) => {
  if (channelType === DEFAULT_CHANNEL_TYPE.BROADCAST || channelType === DEFAULT_CHANNEL_TYPE.PUBLIC) {
    return `${count} ${count > 1 ? 'subscribers' : 'subscriber'}`
  }
  return `${count} ${count > 1 ? 'members' : 'member'}`
}

const MutualChannelItem = ({
  channel,
  backgroundHovered,
  textPrimary,
  textSecondary,
  currentUser,
  contactsMap,
  getFromContacts,
  iconPrimary,
  activeChannel,
  togglePopup
}: {
  channel: IChannel
  backgroundHovered: string
  textPrimary: string
  textSecondary: string
  currentUser: IUser
  contactsMap: { [key: string]: IContact }
  getFromContacts: boolean
  iconPrimary: string
  activeChannel: IChannel
  togglePopup: () => void
}) => {
  const dispatch = useDispatch()
  const setSelectedChannel = (channel: IChannel) => {
    if (activeChannel.id !== channel.id) {
      dispatch(clearMessagesAC())
      dispatch(switchChannelActionAC(channel))
      togglePopup()
    }
  }

  const isDirectChannel = useMemo(() => channel.type === DEFAULT_CHANNEL_TYPE.DIRECT, [channel.type])
  const directChannelUser = useMemo(
    () => isDirectChannel && channel.members.find((member: IMember) => member.id !== currentUser?.id || ''),
    [isDirectChannel, channel.members, currentUser?.id]
  )
  const avatarName = useMemo(
    () =>
      channel.subject ||
      (isDirectChannel && directChannelUser ? directChannelUser.firstName || directChannelUser.id : ''),
    [channel.subject, isDirectChannel, directChannelUser]
  )

  return (
    <ChannelItem
      key={`mutual-channel-${channel.id}`}
      backgroundHover={backgroundHovered}
      onClick={() => setSelectedChannel(channel)}
    >
      <Avatar
        name={avatarName}
        image={channel.avatarUrl || (isDirectChannel && directChannelUser ? directChannelUser?.avatarUrl : '')}
        size={40}
        textSize={12}
        setDefaultAvatar={isDirectChannel}
      />
      <ChannelInfo>
        <ChannelTitle color={textPrimary}>
          {channel.subject ||
            (isDirectChannel && directChannelUser
              ? makeUsername(contactsMap[directChannelUser.id], directChannelUser, getFromContacts)
              : '')}
        </ChannelTitle>
        <ChannelMembers color={textSecondary}>{formatMemberCount(channel.memberCount, channel.type)}</ChannelMembers>
      </ChannelInfo>
      <ChevronRightIconWrapper>
        <ChevronRightIcon color={iconPrimary} />
      </ChevronRightIconWrapper>
    </ChannelItem>
  )
}

const GroupsInCommonPopup = ({ theme, togglePopup, user }: IProps) => {
  const ChatClient = getClient()
  const { user: currentUser } = ChatClient
  const {
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.BACKGROUND]: background,
    [THEME_COLORS.ICON_PRIMARY]: iconPrimary,
    [THEME_COLORS.BACKGROUND_HOVERED]: backgroundHovered
  } = useColor()
  const contactsMap: { [key: string]: IContact } = useSelector(contactsMapSelector)
  const getFromContacts = getShowOnlyContactUsers()
  const dispatch = useDispatch()
  const mutualChannels = useSelector(mutualChannelsSelector) || []
  const mutualChannelsHasNext = useSelector(mutualChannelsHasNextSelector)
  const mutualChannelsLoadingState = useSelector(mutualChannelsLoadingStateSelector)
  const connectionStatus = useSelector(connectionStatusSelector)
  const activeChannel = useSelector(activeChannelSelector)
  const [isScrolling, setIsScrolling] = useState<boolean>(false)
  const loadingRef = useRef(false)

  const isLoading = mutualChannelsLoadingState === LOADING_STATE.LOADING
  const isLoadingInitial = mutualChannels.length === 0 && isLoading

  useEffect(() => {
    if (mutualChannelsLoadingState === LOADING_STATE.LOADED) {
      loadingRef.current = false
    }
  }, [mutualChannelsLoadingState])

  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const target = event.currentTarget
      const isNearBottom = target.scrollTop >= target.scrollHeight - target.offsetHeight - 100

      if (isNearBottom && mutualChannelsHasNext && !isLoading && !loadingRef.current) {
        loadingRef.current = true
        dispatch(loadMoreMutualChannelsAC(15))
      }
    },
    [mutualChannelsHasNext, isLoading, dispatch]
  )

  useEffect(() => {
    console.log('connectionStatus', connectionStatus, 'mutualChannels', !mutualChannels?.length, 'user', user?.id)
    if (connectionStatus === CONNECTION_STATUS.CONNECTED && !mutualChannels?.length) {
      if (user?.id) {
        dispatch(getChannelsWithUserAC(user.id))
      }
    }
  }, [connectionStatus, dispatch, user?.id, mutualChannels?.length])

  useEffect(() => {
    return () => {
      dispatch(setMutualChannelsAC([]))
    }
  }, [dispatch])

  return (
    <PopupContainer>
      <Popup
        theme={theme}
        backgroundColor={background}
        maxWidth='520px'
        minWidth='520px'
        isLoading={isLoadingInitial}
        padding='0'
      >
        <PopupBody paddingH='24px' paddingV='24px'>
          <CloseIcon color={iconPrimary} onClick={togglePopup} />
          <PopupName color={textPrimary} marginBottom='20px'>
            Groups in common
          </PopupName>

          <ChannelsList
            onScroll={handleScroll}
            className={isScrolling ? 'show-scrollbar' : ''}
            onMouseEnter={() => setIsScrolling(true)}
            onMouseLeave={() => setIsScrolling(false)}
            thumbColor={background}
          >
            {isLoadingInitial ? (
              <LoadingText color={textSecondary}>Loading...</LoadingText>
            ) : mutualChannels.length > 0 ? (
              mutualChannels.map((channel: IChannel) => {
                return (
                  <MutualChannelItem
                    key={`mutual-channel-${channel.id}`}
                    channel={channel}
                    backgroundHovered={backgroundHovered}
                    textPrimary={textPrimary}
                    textSecondary={textSecondary}
                    currentUser={currentUser}
                    contactsMap={contactsMap}
                    getFromContacts={getFromContacts}
                    iconPrimary={iconPrimary}
                    activeChannel={activeChannel}
                    togglePopup={togglePopup}
                  />
                )
              })
            ) : (
              <EmptyText color={textSecondary}>No groups in common</EmptyText>
            )}
            {isLoading && mutualChannels.length > 0 && <LoadingText color={textSecondary}>Loading more...</LoadingText>}
          </ChannelsList>
        </PopupBody>
      </Popup>
    </PopupContainer>
  )
}

export default GroupsInCommonPopup

const ChannelsList = styled.div<{ thumbColor: string }>`
  max-height: 400px;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 8px;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: ${(props) => props.thumbColor};
    border-radius: 3px;
    opacity: 0.3;
  }

  &.show-scrollbar::-webkit-scrollbar-thumb {
    opacity: 0.6;
  }
`

const ChannelItem = styled.div<{ backgroundHover: string }>`
  display: flex;
  align-items: center;
  padding: 6px 2px 6px 6px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: ${(props) => props.backgroundHover};
  }
`

const ChannelInfo = styled.div`
  flex: 1;
  margin-left: 12px;
  min-width: 0;
`

const ChannelTitle = styled.div<{ color: string }>`
  font-size: 15px;
  font-weight: 500;
  line-height: 20px;
  color: ${(props) => props.color};
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const ChannelMembers = styled.div<{ color: string }>`
  font-size: 13px;
  line-height: 16px;
  color: ${(props) => props.color};
`

const LoadingText = styled.div<{ color: string }>`
  text-align: center;
  padding: 20px;
  font-size: 14px;
  color: ${(props) => props.color};
`

const EmptyText = styled.div<{ color: string }>`
  text-align: center;
  padding: 40px 20px;
  font-size: 14px;
  color: ${(props) => props.color};
`

const ChevronRightIconWrapper = styled.span`
  display: flex;
  align-items: center;

  & > svg {
    width: 16px;
    height: 16px;
    transform: rotate(-90deg);
  }
`
