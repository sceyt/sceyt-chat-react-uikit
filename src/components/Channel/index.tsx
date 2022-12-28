import React, { useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import styled from 'styled-components'
import { activeChannelSelector } from '../../store/channel/selector'
import { switchChannelActionAC } from '../../store/channel/actions'
import { ReactComponent as TrashIcon } from '../../assets/svg/trash.svg'
import { ReactComponent as DefaultAvatar } from '../../assets/svg/devaultAvatar50.svg'
import Avatar from '../Avatar'
import { lastMessageDateFormat, makeUserName, messageStatusIcon } from '../../helpers'
import { CHANNEL_TYPE, MESSAGE_STATUS, PRESENCE_STATUS } from '../../helpers/constants'
import { getClient } from '../../common/client'
import { ICustomColors } from './types'
import { IChannel, IContact } from '../../types'
import { clearMessagesAC } from '../../store/message/actions'
// import useOnScreen from '../../hooks/useOnScrean'
import useUpdatePresence from '../../hooks/useUpdatePresence'
import { colors } from '../../UIHelper/constants'
import { ReactComponent as NotificationOffIcon } from '../../assets/svg/notificationsOff3.svg'

interface IChannelProps {
  channel: IChannel
  customColors?: ICustomColors
  avatar?: boolean
  notificationsIsMutedIcon?: JSX.Element
  notificationsIsMutedIconColor?: string
  contactsMap: { [key: string]: IContact }
}

const Channel: React.FC<IChannelProps> = ({
  channel,
  customColors,
  avatar,
  notificationsIsMutedIcon,
  notificationsIsMutedIconColor,
  contactsMap
}) => {
  const dispatch = useDispatch()
  const ChatClient = getClient()
  const { user } = ChatClient
  const activeChannel = useSelector(activeChannelSelector) || {}
  const isDirectChannel = channel.type === CHANNEL_TYPE.DIRECT
  const withAvatar = avatar === undefined ? true : avatar
  const handleChangeActiveChannel = (chan: IChannel) => {
    if (activeChannel.id !== chan.id) {
      dispatch(clearMessagesAC())
      dispatch(switchChannelActionAC(chan))
    }
  }
  const messageAuthorRef = useRef<any>(null)
  const messageTimeAndStatusRef = useRef<any>(null)

  // const channelItemRef = useRef()
  // const isVisible = useOnScreen(channelItemRef)
  if (isDirectChannel) {
    useUpdatePresence(channel, true)
  }

  return (
    <Container
      // ref={channelItemRef}
      selectedChannel={channel.id === activeChannel.id}
      selectedBorderColor={customColors && customColors.selectedChannelLeftBorder}
      selectedBackgroundColor={customColors && customColors.selectedChannelBackground}
      onClick={() => handleChangeActiveChannel(channel)}
    >
      {withAvatar && (
        <AvatarWrapper>
          <Avatar
            // customAvatarColors={userAvatarColors}
            name={channel.subject || (isDirectChannel ? channel.peer.firstName || channel.peer.id : '')}
            image={channel.avatarUrl || (isDirectChannel ? channel.peer.avatarUrl : '')}
            size={50}
            textSize={16}
            setDefaultAvatar={isDirectChannel}
            defaultAvatarIcon={<DefaultAvatar />}
          />
          {isDirectChannel && channel.peer.presence && channel.peer.presence.state === PRESENCE_STATUS.ONLINE && (
            <UserStatus backgroundColor={customColors && customColors.messageReadStatusTickColor} />
          )}
        </AvatarWrapper>
      )}
      <ChannelInfo
        avatar={withAvatar}
        isMuted={channel.muted}
        statusWidth={(messageTimeAndStatusRef.current && messageTimeAndStatusRef.current.offsetWidth) || 0}
      >
        <h3>{channel.subject || (isDirectChannel ? makeUserName(contactsMap[channel.peer.id], channel.peer) : '')}</h3>
        {channel.muted && (
          <MutedIcon color={notificationsIsMutedIconColor}>
            {notificationsIsMutedIcon || <NotificationOffIcon />}
          </MutedIcon>
        )}

        {channel.lastMessage && (
          <LastMessage>
            {channel.lastMessage.user &&
              channel.lastMessage.state !== MESSAGE_STATUS.DELETE &&
              ((channel.lastMessage.user && channel.lastMessage.user.id === user.id) || !isDirectChannel) &&
              channel.lastMessage.type !== 'system' && (
                <LastMessageAuthor minWidth={messageAuthorRef.current && messageAuthorRef.current.offsetWidth}>
                  <span ref={messageAuthorRef}>
                    {channel.lastMessage.user &&
                      (channel.lastMessage.user.id === user.id
                        ? 'You'
                        : contactsMap[channel.lastMessage.user.id]
                        ? contactsMap[channel.lastMessage.user.id].firstName
                        : channel.lastMessage.user.id)}
                  </span>
                </LastMessageAuthor>
              )}
            {channel.lastMessage.user &&
              channel.lastMessage.state !== MESSAGE_STATUS.DELETE &&
              (channel.lastMessage.user.id === user.id || !isDirectChannel) &&
              channel.lastMessage.type !== 'system' && <Points>: </Points>}
            <LastMessageText authorWith={(messageAuthorRef.current && messageAuthorRef.current.offsetWidth) || 0}>
              {channel.lastMessage.state === MESSAGE_STATUS.DELETE ? (
                <React.Fragment>
                  <TrashIcon />
                  Message was deleted.
                </React.Fragment>
              ) : channel.lastMessage.type === 'system' ? (
                `${
                  channel.lastMessage.user &&
                  (channel.lastMessage.user.id === user.id
                    ? 'You '
                    : contactsMap[channel.lastMessage.user.id]
                    ? contactsMap[channel.lastMessage.user.id].firstName
                    : channel.lastMessage.user.id)
                } ${
                  channel.lastMessage.body === 'CC'
                    ? 'Created this channel'
                    : channel.lastMessage.body === 'CG'
                    ? 'Created this group'
                    : ''
                }`
              ) : channel.lastMessage.body ? (
                channel.lastMessage.body
              ) : channel.lastMessage.attachments && ` ${channel.lastMessage.attachments.length}` ? (
                ' Attachment'
              ) : (
                ''
              )}
            </LastMessageText>
          </LastMessage>
        )}
      </ChannelInfo>

      <ChannelStatus ref={messageTimeAndStatusRef}>
        <DeliveryIconCont>
          {channel.lastMessage &&
            channel.lastMessage.user &&
            channel.lastMessage.user.id === user.id &&
            channel.lastMessage.type !== 'system' &&
            messageStatusIcon(
              channel.lastMessage.deliveryStatus,
              undefined,
              customColors && customColors.messageReadStatusTickColor
            )}
        </DeliveryIconCont>
        <LastMessageDate>
          {channel.lastMessage && channel.lastMessage.createdAt && lastMessageDateFormat(channel.lastMessage.createdAt)}
          {/* {channel.lastMessage &&
            channel.lastMessage.createdAt &&
            moment(channel.lastMessage.createdAt).format('HH:mm')} */}
        </LastMessageDate>
      </ChannelStatus>
      {(!!channel.unreadMessageCount || channel.markedAsUnread) && (
        <UnreadCount backgroundColor={customColors && customColors.messageReadStatusTickColor} isMuted={channel.muted}>
          {channel.unreadMessageCount ? (channel.unreadMessageCount > 99 ? '99+' : channel.unreadMessageCount) : ''}
        </UnreadCount>
      )}
    </Container>
  )
}

export default Channel

interface LastMessageTextProps {
  readonly authorWith: number
}

interface UnreadCountProps {
  readonly isMuted: boolean
  readonly backgroundColor?: string
  width?: string
  height?: string
  textColor?: string
  fontSize?: string
}

export const Container = styled.div<any>(
  {
    position: 'relative',
    padding: '2px 0',
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    height: '48px'
  },
  ({ selectedChannel, selectedBorderColor, selectedBackgroundColor }: any) => ({
    backgroundColor: selectedChannel ? selectedBackgroundColor || colors.gray0 : 'inherit',
    borderLeft: selectedChannel ? `3px solid ${selectedBorderColor || colors.cobalt1}` : 'none',
    padding: selectedChannel ? '8px 16px 8px 13px' : '8px 16px'
  })
)

export const ChannelInfo = styled.div<{ avatar?: boolean; isMuted?: boolean; statusWidth: number }>`
  text-align: left;
  margin-left: ${(props) => props.avatar && '12px'};
  width: 100%;
  max-width: ${(props) => `calc(100% - ${props.statusWidth + 62}px)`};

  h3 {
    display: inline-block;
    margin: 0;
    font-size: 15px;
    font-weight: 500;
    text-overflow: ellipsis;
    line-height: 18px;
    letter-spacing: -0.2px;
    max-width: ${(props) => (props.isMuted ? 'calc(100% - 30px)' : '100%')};
    overflow: hidden;
    white-space: nowrap;
    color: ${colors.gray6};
  }
`

export const MutedIcon = styled.span`
  & > svg {
    height: 16px;
    width: 16px;
    margin-left: 5px;
    color: ${(props) => props.color || '#818C99'};
  }
`

export const LastMessage = styled.div`
  display: flex;
  align-items: center;
  font-size: 14px;
  color: ${colors.gray6};
`

export const AvatarWrapper = styled.div`
  display: flex;
  align-items: center;
  position: relative;
`

export const UserStatus = styled.span<{ backgroundColor?: string }>`
  position: absolute;
  width: 14px;
  height: 14px;
  right: 0;
  bottom: 0;
  border-radius: 50%;
  background-color: ${(props) => props.backgroundColor || '#56E464'};
  border: 2.5px solid #ffffff;
  box-sizing: border-box;
`

export const LastMessageAuthor = styled.div<any>`
  max-width: 120px;
  font-weight: 500;
  color: ${colors.gray8};

  & > span {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }
`

export const Points = styled.span`
  margin-right: 2px;
`

export const LastMessageText = styled.span<LastMessageTextProps>`
  overflow: hidden;
  max-width: ${(props: any) => `calc(100% - ${props.authorWith}px)`};
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${colors.gray9};

  > svg {
    margin-right: 4px;
    transform: translate(0px, 2px);
  }
`

export const ChannelStatus = styled.div`
  position: absolute;
  right: 16px;
  top: 15px;
  display: flex;
  flex-wrap: wrap;
  height: 42px;
  margin-left: auto;
`

export const LastMessageDate = styled.span`
  color: ${colors.gray9};
  font-size: 12px;
  line-height: 16px;
`

export const DeliveryIconCont = styled.span`
  margin-right: 6px;
  line-height: 13px;
`

export const UnreadCount = styled.span<UnreadCountProps>`
  position: absolute;
  bottom: 11px;
  right: 16px;
  flex: 0 0 auto;
  margin-left: auto;
  background-color: ${(props) => props.backgroundColor || colors.cobalt1};
  padding: 0 4px;
  font-size: ${(props) => props.fontSize || '13px'};
  line-height: 20px;
  min-width: ${(props) => props.width || '20px'};
  height: ${(props) => props.height || '20px'};
  text-align: center;
  font-weight: 500;
  color: ${(props) => props.textColor || '#fff'};
  border-radius: 10px;
  margin-top: 7px;
  box-sizing: border-box;

  ${(props: any) => props.isMuted && 'background-color: #BEBFC7;'}
`
