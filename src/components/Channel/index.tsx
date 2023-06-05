import React, { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import styled from 'styled-components'
import { activeChannelSelector, typingIndicatorSelector } from '../../store/channel/selector'
import { sendTypingAC, switchChannelActionAC } from '../../store/channel/actions'
import { ReactComponent as ImageIcon } from '../../assets/svg/picture.svg'
import { ReactComponent as CameraIcon } from '../../assets/svg/video-call.svg'
import { ReactComponent as FileIcon } from '../../assets/svg/choseFile.svg'
import { ReactComponent as VoiceIcon } from '../../assets/svg/voiceIcon.svg'
import { ReactComponent as MentionIcon } from '../../assets/svg/unreadMention.svg'
import Avatar from '../Avatar'
import { messageStatusIcon, systemMessageUserName } from '../../helpers'
import { isJSON, lastMessageDateFormat, makeUsername, MessageTextFormat } from '../../helpers/message'
import { attachmentTypes, CHANNEL_TYPE, MESSAGE_STATUS, PRESENCE_STATUS } from '../../helpers/constants'
import { getClient } from '../../common/client'
import { IChannel, IContact } from '../../types'
import { clearMessagesAC } from '../../store/message/actions'
// import useOnScreen from '../../hooks/useOnScrean'
import useUpdatePresence from '../../hooks/useUpdatePresence'
import { colors } from '../../UIHelper/constants'
import { ReactComponent as NotificationOffIcon } from '../../assets/svg/notificationsOff3.svg'
import { getShowOnlyContactUsers } from '../../helpers/contacts'
import { hideUserPresence } from '../../helpers/userHelper'

interface IChannelProps {
  channel: IChannel
  avatar?: boolean
  notificationsIsMutedIcon?: JSX.Element
  notificationsIsMutedIconColor?: string
  selectedChannelLeftBorder?: string
  selectedChannelBackground?: string
  contactsMap: { [key: string]: IContact }
  selectedChannelBorderRadius?: string
  selectedChannelPaddings?: string
  channelsPaddings?: string
  channelsMargin?: string
}

const Channel: React.FC<IChannelProps> = ({
  channel,
  avatar,
  notificationsIsMutedIcon,
  notificationsIsMutedIconColor,
  selectedChannelLeftBorder,
  selectedChannelBackground,
  contactsMap,
  selectedChannelBorderRadius,
  selectedChannelPaddings,
  channelsPaddings,
  channelsMargin
}) => {
  const dispatch = useDispatch()
  const ChatClient = getClient()
  const getFromContacts = getShowOnlyContactUsers()
  const { user } = ChatClient
  const activeChannel = useSelector(activeChannelSelector) || {}
  const isDirectChannel = channel.type === CHANNEL_TYPE.DIRECT
  const directChannelUser = isDirectChannel && channel.members.find((member) => member.id !== user.id)
  const withAvatar = avatar === undefined ? true : avatar
  const typingIndicator = useSelector(typingIndicatorSelector(channel.id))
  const lastMessage = channel.lastReactedMessage || channel.lastMessage
  const lastMessageMetas =
    lastMessage &&
    lastMessage.type === 'system' &&
    lastMessage.metadata &&
    (isJSON(lastMessage.metadata) ? JSON.parse(lastMessage.metadata) : lastMessage.metadata)
  const [statusWidth, setStatusWidth] = useState(0)
  const handleChangeActiveChannel = (chan: IChannel) => {
    if (activeChannel.id !== chan.id) {
      dispatch(sendTypingAC(false))
      dispatch(clearMessagesAC())
      dispatch(switchChannelActionAC(chan))
    }
  }
  const messageAuthorRef = useRef<any>(null)
  const messageTimeAndStatusRef = useRef<any>(null)

  // const channelItemRef = useRef()
  // const isVisible = useOnScreen(channelItemRef)
  // if (isDirectChannel) {
  useUpdatePresence(channel, true)
  // }

  useEffect(() => {
    if (messageTimeAndStatusRef.current) {
      setStatusWidth(messageTimeAndStatusRef.current.offsetWidth)
    }
  }, [messageTimeAndStatusRef, lastMessage])
  return (
    <Container
      // ref={channelItemRef}
      selectedChannel={channel.id === activeChannel.id}
      selectedChannelLeftBorder={selectedChannelLeftBorder}
      selectedBackgroundColor={selectedChannelBackground || colors.primaryLight}
      selectedChannelPaddings={selectedChannelPaddings}
      channelsPaddings={channelsPaddings}
      selectedChannelBorderRadius={selectedChannelBorderRadius}
      channelsMargin={channelsMargin}
      onClick={() => handleChangeActiveChannel(channel)}
    >
      {withAvatar && (
        <AvatarWrapper>
          <Avatar
            // customAvatarColors={userAvatarColors}
            name={
              channel.subject ||
              (isDirectChannel && directChannelUser ? directChannelUser.firstName || directChannelUser.id : '')
            }
            image={channel.avatarUrl || (isDirectChannel && directChannelUser ? directChannelUser.avatarUrl : '')}
            size={50}
            textSize={16}
            setDefaultAvatar={isDirectChannel}
          />
          {isDirectChannel &&
            directChannelUser &&
            hideUserPresence &&
            (hideUserPresence(directChannelUser)
              ? ''
              : directChannelUser.presence && directChannelUser.presence.state === PRESENCE_STATUS.ONLINE) && (
              <UserStatus backgroundColor={colors.primary} />
            )}
        </AvatarWrapper>
      )}
      <ChannelInfo avatar={withAvatar} isMuted={channel.muted} statusWidth={statusWidth}>
        <h3>
          {channel.subject ||
            (isDirectChannel && directChannelUser
              ? makeUsername(contactsMap[directChannelUser.id], directChannelUser, getFromContacts)
              : '')}
        </h3>
        {channel.muted && (
          <MutedIcon color={notificationsIsMutedIconColor}>
            {notificationsIsMutedIcon || <NotificationOffIcon />}
          </MutedIcon>
        )}
        {(lastMessage || !!typingIndicator) && (
          <LastMessage
            markedAsUnread={
              !!(channel.markedAsUnread || (channel.unreadMessageCount && channel.unreadMessageCount > 0))
            }
            unreadMentions={!!(channel.unreadMentionsCount && channel.unreadMentionsCount > 0)}
          >
            {typingIndicator ? (
              !isDirectChannel ? (
                <LastMessageAuthor
                  typing={typingIndicator}
                  minWidth={messageAuthorRef.current && messageAuthorRef.current.offsetWidth}
                >
                  <span ref={messageAuthorRef}>
                    {typingIndicator
                      ? getFromContacts
                        ? contactsMap[typingIndicator.from.id] && contactsMap[typingIndicator.from.id].firstName
                          ? contactsMap[typingIndicator.from.id]!.firstName!.split(' ')[0]
                          : typingIndicator.from.id
                        : (typingIndicator.from && typingIndicator.from.firstName) || typingIndicator.from.id
                      : ''}
                  </span>
                </LastMessageAuthor>
              ) : null
            ) : channel.lastReactedMessage && channel.userMessageReactions && channel.userMessageReactions[0] ? (
              lastMessage.state !== MESSAGE_STATUS.DELETE &&
              ((channel.userMessageReactions[0].user && channel.userMessageReactions[0].user.id === user.id) ||
                !isDirectChannel) &&
              lastMessage.type !== 'system' && (
                <LastMessageAuthor minWidth={messageAuthorRef.current && messageAuthorRef.current.offsetWidth}>
                  <span ref={messageAuthorRef}>
                    {channel.userMessageReactions[0].user.id === user.id
                      ? 'You'
                      : contactsMap[channel.userMessageReactions[0].user.id]
                      ? contactsMap[channel.userMessageReactions[0].user.id].firstName
                      : channel.userMessageReactions[0].user.id || 'Deleted'}
                  </span>
                </LastMessageAuthor>
              )
            ) : (
              lastMessage.user &&
              lastMessage.state !== MESSAGE_STATUS.DELETE &&
              ((lastMessage.user && lastMessage.user.id === user.id) || !isDirectChannel) &&
              lastMessage.type !== 'system' && (
                <LastMessageAuthor minWidth={messageAuthorRef.current && messageAuthorRef.current.offsetWidth}>
                  <span ref={messageAuthorRef}>
                    {lastMessage.user.id === user.id
                      ? 'You'
                      : contactsMap[lastMessage.user.id]
                      ? contactsMap[lastMessage.user.id].firstName
                      : lastMessage.user.id || 'Deleted'}
                  </span>
                </LastMessageAuthor>
              )
            )}
            {(isDirectChannel
              ? !typingIndicator &&
                lastMessage.user &&
                lastMessage.user.id === user.id &&
                !channel.lastReactedMessage &&
                lastMessage.state !== MESSAGE_STATUS.DELETE
              : typingIndicator ||
                (lastMessage && lastMessage.state !== MESSAGE_STATUS.DELETE && lastMessage.type !== 'system')) && (
              <Points>: </Points>
            )}
            <LastMessageText
              withAttachments={
                !!(
                  lastMessage &&
                  lastMessage.attachments &&
                  lastMessage.attachments.length &&
                  lastMessage.attachments[0].type !== attachmentTypes.link
                ) && !typingIndicator
              }
              noBody={lastMessage && !lastMessage.body}
              deletedMessage={lastMessage && lastMessage.state === MESSAGE_STATUS.DELETE}
            >
              {typingIndicator ? (
                <TypingIndicator>typing...</TypingIndicator>
              ) : lastMessage.state === MESSAGE_STATUS.DELETE ? (
                'Message was deleted.'
              ) : lastMessage.type === 'system' ? (
                `${
                  lastMessage.user &&
                  (lastMessage.user.id === user.id
                    ? 'You '
                    : contactsMap[lastMessage.user.id]
                    ? contactsMap[lastMessage.user.id].firstName
                    : lastMessage.user.id)
                } ${
                  lastMessage.body === 'CC'
                    ? 'Created this channel'
                    : lastMessage.body === 'CG'
                    ? 'Created this group'
                    : lastMessage.body === 'AM'
                    ? ` added ${
                        lastMessageMetas &&
                        lastMessageMetas.m &&
                        lastMessageMetas.m
                          .slice(0, 5)
                          .map((mem: string) =>
                            mem === user.id ? ' You' : ` ${systemMessageUserName(contactsMap[mem], mem)}`
                          )
                      } ${
                        lastMessageMetas && lastMessageMetas.m && lastMessageMetas.m.length > 5
                          ? `and ${lastMessageMetas.m.length - 5} more`
                          : ''
                      }`
                    : lastMessage.body === 'RM'
                    ? ` removed ${
                        lastMessageMetas &&
                        lastMessageMetas.m &&
                        lastMessageMetas.m
                          .slice(0, 5)
                          .map((mem: string) =>
                            mem === user.id ? ' You' : ` ${systemMessageUserName(contactsMap[mem], mem)}`
                          )
                      } ${
                        lastMessageMetas && lastMessageMetas.m && lastMessageMetas.m.length > 5
                          ? `and ${lastMessageMetas.m.length - 5} more`
                          : ''
                      }`
                    : lastMessage.body === 'LG'
                    ? 'Left this group'
                    : ''
                }`
              ) : (
                <React.Fragment>
                  {channel.lastReactedMessage && (
                    <React.Fragment>
                      Reacted
                      <ReactionItem>{channel.userMessageReactions && channel.userMessageReactions[0].key}</ReactionItem>
                      to{' "'}
                    </React.Fragment>
                  )}
                  {!!(lastMessage.attachments && lastMessage.attachments.length) &&
                    (lastMessage.attachments[0].type === attachmentTypes.image ? (
                      <React.Fragment>
                        <ImageIcon />
                        {lastMessage.body ? '' : 'Photo'}
                      </React.Fragment>
                    ) : lastMessage.attachments[0].type === attachmentTypes.video ? (
                      <React.Fragment>
                        <CameraIcon />
                        {lastMessage.body ? '' : 'Video'}
                      </React.Fragment>
                    ) : lastMessage.attachments[0].type === attachmentTypes.file ? (
                      <React.Fragment>
                        <FileIcon />
                        {lastMessage.body ? '' : 'File'}
                      </React.Fragment>
                    ) : lastMessage.attachments[0].type === attachmentTypes.voice ? (
                      <React.Fragment>
                        <VoiceIcon />
                        {lastMessage.body ? '' : 'Voice'}
                      </React.Fragment>
                    ) : null)}
                  {!!(lastMessage && lastMessage.id) &&
                    MessageTextFormat({
                      text: lastMessage.body,
                      message: lastMessage,
                      contactsMap,
                      getFromContacts,
                      isLastMessage: true
                    })}
                  {channel.lastReactedMessage && '"'}
                </React.Fragment>
              )}
            </LastMessageText>
          </LastMessage>
        )}
      </ChannelInfo>

      <ChannelStatus ref={messageTimeAndStatusRef}>
        {lastMessage && lastMessage.state !== MESSAGE_STATUS.DELETE && (
          <DeliveryIconCont>
            {lastMessage &&
              lastMessage.user &&
              lastMessage.user.id === user.id &&
              lastMessage.type !== 'system' &&
              messageStatusIcon(lastMessage.deliveryStatus, 'ticks', undefined, colors.primary)}
          </DeliveryIconCont>
        )}
        <LastMessageDate>
          {lastMessage && lastMessage.createdAt && lastMessageDateFormat(lastMessage.createdAt)}
          {/* {lastMessage &&
            lastMessage.createdAt &&
            moment(lastMessage.createdAt).format('HH:mm')} */}
        </LastMessageDate>
      </ChannelStatus>
      <UnreadInfo>
        {!!(channel.unreadMentionsCount && channel.unreadMentionsCount > 0) && (
          <UnreadMentionIconWrapper
            iconColor={colors.primary}
            rightMargin={!!(channel.unreadMessageCount || channel.markedAsUnread)}
          >
            <MentionIcon />
          </UnreadMentionIconWrapper>
        )}
        {!!(channel.unreadMessageCount || channel.markedAsUnread) && (
          <UnreadCount backgroundColor={colors.primary} isMuted={channel.muted}>
            {channel.unreadMessageCount ? (channel.unreadMessageCount > 99 ? '99+' : channel.unreadMessageCount) : ''}
          </UnreadCount>
        )}
      </UnreadInfo>
    </Container>
  )
}

export default Channel

export interface UnreadCountProps {
  readonly isMuted: boolean
  readonly backgroundColor?: string
  width?: string
  height?: string
  textColor?: string
  fontSize?: string
}

const Container = styled.div<{
  selectedChannel: boolean
  selectedChannelLeftBorder?: string
  selectedBackgroundColor?: string
  channelsPaddings?: string
  selectedChannelPaddings?: string
  channelsMargin?: string
  selectedChannelBorderRadius?: string
}>`
  position: relative;
  display: flex;
  align-items: center;
  cursor: pointer;
  height: 48px;
  background-color: ${(props) =>
    props.selectedChannel ? props.selectedBackgroundColor || colors.primaryLight : 'inherit'};
  border-left: ${(props) => (props.selectedChannel ? props.selectedChannelLeftBorder : null)};
  // padding: selectedChannel ? '8px 16px 8px 13px' : '8px 16px'
  padding: ${(props) =>
    props.selectedChannel
      ? props.selectedChannelPaddings || props.channelsPaddings || '8px'
      : props.channelsPaddings || '8px'};
  margin: ${(props) => props.channelsMargin || '0 8px'};
  border-radius: ${(props) => props.selectedChannelBorderRadius || '12px'};
`

export const ChannelInfo = styled.div<{ avatar?: boolean; isMuted?: boolean; statusWidth: number }>`
  text-align: left;
  margin-left: ${(props) => props.avatar && '12px'};
  width: 100%;
  max-width: calc(100% - 62px);

  h3 {
    display: inline-block;
    margin: 0;
    font-size: 15px;
    font-weight: 500;
    text-overflow: ellipsis;
    line-height: 18px;
    letter-spacing: -0.2px;%;
    max-width: ${(props) => `calc(100% - ${props.statusWidth + (props.isMuted ? 20 : 0) + 2}px)`};
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

export const LastMessage = styled.div<{ markedAsUnread?: boolean; unreadMentions?: boolean }>`
  display: flex;
  align-items: center;
  font-size: 14px;
  color: ${colors.gray6};
  max-width: ${(props) =>
    props.markedAsUnread || props.unreadMentions
      ? // @ts-ignore
        `calc(100% - ${props.markedAsUnread && props.unreadMentions ? 48 : 24}px)`
      : '100%'};
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
  font-style: ${(props) => props.typing && 'italic'};
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
  margin-right: 4px;
`

export const LastMessageText = styled.span<{
  withAttachments?: boolean
  noBody?: boolean
  deletedMessage?: boolean
}>`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${colors.gray9};
  font-style: ${(props) => props.deletedMessage && 'italic'};
  transform: ${(props) => props.withAttachments && 'translate(0px, -1.5px)'};

  > svg {
    width: 16px;
    height: 16px;
    margin-right: 4px;
    color: ${colors.gray4};
    transform: ${(props) => (props.withAttachments ? 'translate(0px, 3px)' : 'translate(0px, 2px)')};
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

export const UnreadMentionIconWrapper = styled.span<{ iconColor?: string; rightMargin?: boolean }>`
  margin-right: ${(props) => props.rightMargin && '8px'};
  line-height: 13px;

  & > svg {
    color: ${(props) => props.iconColor || colors.primary};
  }
`

export const TypingIndicator = styled.span`
  font-style: italic;
`

export const ReactionItem = styled.span`
  font-family: apple color emoji, segoe ui emoji, noto color emoji, android emoji, emojisymbols, emojione mozilla,
    twemoji mozilla, segoe ui symbol;
  padding: 0 3px;
`

export const UnreadInfo = styled.span`
  position: absolute;
  bottom: 11px;
  right: 16px;
  display: flex;
  margin-top: 7px;
  align-items: center;
  flex: 0 0 auto;
  margin-left: auto;
`
const UnreadCount = styled.span<UnreadCountProps>`
  display: inline-block;
  background-color: ${(props) => props.backgroundColor || colors.primary};
  padding: 0 4px;
  font-size: ${(props) => props.fontSize || '13px'};
  line-height: 20px;
  min-width: ${(props) => props.width || '20px'};
  height: ${(props) => props.height || '20px'};
  text-align: center;
  font-weight: 500;
  color: ${(props) => props.textColor || '#fff'};
  border-radius: 10px;
  box-sizing: border-box;

  /*${(props: any) => props.isMuted && 'background-color: #BEBFC7;'}*/
`
