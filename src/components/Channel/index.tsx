import React, { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import styled from 'styled-components'
import {
  activeChannelSelector,
  channelMessageDraftIsRemovedSelector,
  typingIndicatorSelector
} from '../../store/channel/selector'
import {
  sendTypingAC,
  setChannelDraftMessageIsRemovedAC,
  switchChannelActionAC,
  updateChannelDataAC
} from '../../store/channel/actions'
import { ReactComponent as ImageIcon } from '../../assets/svg/picture.svg'
import { ReactComponent as CameraIcon } from '../../assets/svg/video-call.svg'
import { ReactComponent as FileIcon } from '../../assets/svg/choseFile.svg'
import { ReactComponent as VoiceIcon } from '../../assets/svg/voiceIcon.svg'
import { ReactComponent as MentionIcon } from '../../assets/svg/unreadMention.svg'
import Avatar from '../Avatar'
import { messageStatusIcon, systemMessageUserName } from '../../helpers'
import { isJSON, lastMessageDateFormat, makeUsername, MessageTextFormat } from '../../helpers/message'
import { attachmentTypes, CHANNEL_TYPE, MESSAGE_STATUS, USER_PRESENCE_STATUS, THEME } from '../../helpers/constants'
import { getClient } from '../../common/client'
import { IChannel, IContact } from '../../types'
import { clearMessagesAC } from '../../store/message/actions'
import useUpdatePresence from '../../hooks/useUpdatePresence'
import { colors } from '../../UIHelper/constants'
import { ReactComponent as NotificationOffIcon } from '../../assets/svg/unmuteNotifications.svg'
import { getShowOnlyContactUsers } from '../../helpers/contacts'
import { hideUserPresence } from '../../helpers/userHelper'
import { getDraftMessageFromMap } from '../../helpers/messagesHalper'
import moment from 'moment'
import { updateChannelOnAllChannels } from '../../helpers/channelHalper'

interface IChannelProps {
  channel: IChannel
  showAvatar?: boolean
  theme?: string
  notificationsIsMutedIcon?: JSX.Element
  notificationsIsMutedIconColor?: string
  selectedChannelLeftBorder?: string
  selectedChannelBackground?: string
  contactsMap: { [key: string]: IContact }
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
}

const Channel: React.FC<IChannelProps> = ({
  channel,
  theme,
  showAvatar = true,
  notificationsIsMutedIcon,
  notificationsIsMutedIconColor,
  selectedChannelLeftBorder,
  selectedChannelBackground,
  contactsMap,
  selectedChannelBorderRadius,
  selectedChannelPaddings,
  channelsPaddings,
  channelsMargin,
  channelHoverBackground,
  channelSubjectFontSize,
  channelSubjectLineHeight,
  channelSubjectColor,
  channelLastMessageFontSize,
  channelLastMessageTimeFontSize,
  channelLastMessageHeight,
  channelAvatarSize,
  channelAvatarTextSize
}) => {
  const dispatch = useDispatch()
  const ChatClient = getClient()
  const getFromContacts = getShowOnlyContactUsers()
  const { user } = ChatClient
  const activeChannel = useSelector(activeChannelSelector) || {}
  const channelDraftIsRemoved = useSelector(channelMessageDraftIsRemovedSelector)
  const isDirectChannel = channel.type === CHANNEL_TYPE.DIRECT
  const directChannelUser = isDirectChannel && channel.members.find((member) => member.id !== user.id)
  const typingIndicator = useSelector(typingIndicatorSelector(channel.id))
  const [draftMessageText, setDraftMessageText] = useState<any>()
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

  useUpdatePresence(channel, true)
  useEffect(() => {
    if (messageTimeAndStatusRef.current) {
      setStatusWidth(messageTimeAndStatusRef.current.offsetWidth)
    }
  }, [messageTimeAndStatusRef, lastMessage])
  useEffect(() => {
    if (activeChannel.id !== channel.id) {
      const channelDraftMessage = getDraftMessageFromMap(channel.id)
      if (channelDraftMessage) {
        setDraftMessageText(channelDraftMessage.text)
      } else if (draftMessageText) {
        setDraftMessageText(undefined)
      }
    }
  }, [activeChannel.id])

  useEffect(() => {
    if (channelDraftIsRemoved && channelDraftIsRemoved === channel.id) {
      setDraftMessageText(undefined)
      dispatch(setChannelDraftMessageIsRemovedAC())
    }
  }, [channelDraftIsRemoved])

  useEffect(() => {
    if (channel.muted) {
      const dateDiff = moment(channel.mutedTill).diff(moment())
      if (dateDiff <= 0) {
        dispatch(updateChannelDataAC(channel.id, { muted: false, mutedTill: null }))
        updateChannelOnAllChannels(channel.id, { muted: false, mutedTill: null })
      }
    }
  })
  return (
    <Container
      // ref={channelItemRef}
      theme={theme}
      selectedChannel={channel.id === activeChannel.id}
      selectedChannelLeftBorder={selectedChannelLeftBorder}
      selectedBackgroundColor={
        selectedChannelBackground || (theme === THEME.DARK ? colors.hoverBackgroundColor : colors.primaryLight)
      }
      selectedChannelPaddings={selectedChannelPaddings}
      channelsPaddings={channelsPaddings}
      selectedChannelBorderRadius={selectedChannelBorderRadius}
      channelsMargin={channelsMargin}
      onClick={() => handleChangeActiveChannel(channel)}
      hoverBackground={channelHoverBackground}
    >
      {showAvatar && (
        <AvatarWrapper>
          <Avatar
            // customAvatarColors={userAvatarColors}
            name={
              channel.subject ||
              (isDirectChannel && directChannelUser ? directChannelUser.firstName || directChannelUser.id : '')
            }
            image={channel.avatarUrl || (isDirectChannel && directChannelUser ? directChannelUser.avatarUrl : '')}
            size={channelAvatarSize || 50}
            textSize={channelAvatarTextSize || 16}
            setDefaultAvatar={isDirectChannel}
          />
          {isDirectChannel &&
            directChannelUser &&
            hideUserPresence &&
            (hideUserPresence(directChannelUser)
              ? ''
              : directChannelUser.presence && directChannelUser.presence.state === USER_PRESENCE_STATUS.ONLINE) && (
              <UserStatus backgroundColor={colors.primary} />
            )}
        </AvatarWrapper>
      )}
      <ChannelInfo
        theme={theme}
        avatar={showAvatar}
        isMuted={channel.muted}
        statusWidth={statusWidth}
        uppercase={directChannelUser && hideUserPresence && hideUserPresence(directChannelUser)}
        subjectFontSize={channelSubjectFontSize}
        subjectLineHeight={channelSubjectLineHeight}
        subjectColor={channelSubjectColor}
        avatarSize={channelAvatarSize}
      >
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
        {(lastMessage || !!typingIndicator || draftMessageText) && (
          <LastMessage
            markedAsUnread={!!(channel.unread || (channel.newMessageCount && channel.newMessageCount > 0))}
            unreadMentions={!!(channel.newMentionCount && channel.newMentionCount > 0)}
            fontSize={channelLastMessageFontSize}
            height={channelLastMessageHeight}
          >
            {typingIndicator ? (
              !isDirectChannel ? (
                <LastMessageAuthor theme={theme}>
                  <span ref={messageAuthorRef}>
                    {makeUsername(contactsMap[typingIndicator.from.id], typingIndicator.from, getFromContacts, true)}
                  </span>
                </LastMessageAuthor>
              ) : null
            ) : draftMessageText ? (
              <DraftMessageTitle>Draft</DraftMessageTitle>
            ) : channel.lastReactedMessage && channel.newReactions && channel.newReactions[0] ? (
              lastMessage.state !== MESSAGE_STATUS.DELETE &&
              ((channel.newReactions[0].user && channel.newReactions[0].user.id === user.id) || !isDirectChannel) &&
              lastMessage.type !== 'system' && (
                <LastMessageAuthor theme={theme}>
                  <span ref={messageAuthorRef}>
                    {channel.newReactions[0].user.id === user.id
                      ? 'You'
                      : makeUsername(
                          contactsMap[channel.newReactions[0].user.id],
                          channel.newReactions[0].user,
                          getFromContacts,
                          true
                        )}
                  </span>
                </LastMessageAuthor>
              )
            ) : (
              lastMessage.user &&
              lastMessage.state !== MESSAGE_STATUS.DELETE &&
              ((lastMessage.user && lastMessage.user.id === user.id) || !isDirectChannel) &&
              lastMessage.type !== 'system' && (
                <LastMessageAuthor theme={theme}>
                  <span ref={messageAuthorRef}>
                    {lastMessage.user.id === user.id
                      ? 'You'
                      : makeUsername(contactsMap[lastMessage.user.id], lastMessage.user, getFromContacts, true)}
                  </span>
                </LastMessageAuthor>
              )
            )}
            {(isDirectChannel
              ? !typingIndicator &&
                (draftMessageText ||
                  (lastMessage.user &&
                    lastMessage.state !== MESSAGE_STATUS.DELETE &&
                    (channel.lastReactedMessage && channel.newReactions && channel.newReactions[0]
                      ? channel.newReactions[0].user && channel.newReactions[0].user.id === user.id
                      : lastMessage.user.id === user.id)))
              : typingIndicator ||
                draftMessageText ||
                (lastMessage && lastMessage.state !== MESSAGE_STATUS.DELETE && lastMessage.type !== 'system')) && (
              <Points color={draftMessageText && colors.red1}>: </Points>
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
              ) : draftMessageText ? (
                <DraftMessageText>{draftMessageText}</DraftMessageText>
              ) : lastMessage.state === MESSAGE_STATUS.DELETE ? (
                'Message was deleted.'
              ) : lastMessage.type === 'system' ? (
                `${
                  lastMessage.user &&
                  (lastMessage.user.id === user.id
                    ? 'You '
                    : makeUsername(
                        lastMessage.user && contactsMap[lastMessage.user.id],
                        lastMessage.user,
                        getFromContacts
                      ))
                } ${
                  lastMessage.body === 'CC'
                    ? 'created this channel'
                    : lastMessage.body === 'CG'
                      ? 'created this group'
                      : lastMessage.body === 'AM'
                        ? ` added ${
                            lastMessageMetas &&
                            lastMessageMetas.m &&
                            lastMessageMetas.m
                              .slice(0, 5)
                              .map((mem: string) =>
                                mem === user.id
                                  ? ' You'
                                  : ` ${systemMessageUserName(contactsMap[mem], mem, lastMessage.mentionedUsers)}`
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
                                  mem === user.id
                                    ? ' You'
                                    : ` ${systemMessageUserName(contactsMap[mem], mem, lastMessage.mentionedUsers)}`
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
                      <ReactionItem>
                        {channel.newReactions && channel.newReactions[0] && channel.newReactions[0].key}
                      </ReactionItem>
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
              messageStatusIcon({
                messageStatus: lastMessage.deliveryStatus,
                messageStatusDisplayingType: 'ticks',
                iconColor: colors.primary
              })}
          </DeliveryIconCont>
        )}
        <LastMessageDate fontSize={channelLastMessageTimeFontSize}>
          {lastMessage && lastMessage.createdAt && lastMessageDateFormat(lastMessage.createdAt)}
          {/* {lastMessage &&
            lastMessage.createdAt &&
            moment(lastMessage.createdAt).format('HH:mm')} */}
        </LastMessageDate>
      </ChannelStatus>
      <UnreadInfo bottom={!(lastMessage || !!typingIndicator || draftMessageText) ? '5px' : ''}>
        {!!(channel.newMentionCount && channel.newMentionCount > 0) && (
          <UnreadMentionIconWrapper
            iconColor={colors.primary}
            rightMargin={!!(channel.newMessageCount || channel.unread)}
          >
            <MentionIcon />
          </UnreadMentionIconWrapper>
        )}
        {!!(channel.newMessageCount || channel.unread) && (
          <UnreadCount backgroundColor={colors.primary} isMuted={channel.muted}>
            {channel.newMessageCount ? (channel.newMessageCount > 99 ? '99+' : channel.newMessageCount) : ''}
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
  theme?: string
  hoverBackground?: string
}>`
  position: relative;
  display: flex;
  align-items: center;
  cursor: pointer;
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

  transition: all 0.2s;
  &:hover {
    background-color: ${(props) => props.hoverBackground};
  }
`

export const ChannelInfo = styled.div<{
  statusWidth: number
  avatar?: boolean
  isMuted?: boolean
  theme?: string
  uppercase?: boolean
  subjectFontSize?: string
  subjectLineHeight?: string
  subjectColor?: string
  avatarSize?: number
}>`
  text-align: left;
  margin-left: ${(props) => props.avatar && '12px'};
  width: 100%;
  max-width: ${(props) => (props.avatarSize ? `calc(100% - ${props.avatarSize + 12}px)` : 'calc(100% - 62px)')};

  h3 {
    display: inline-block;
    margin: 0;
    font-size: ${(props) => props.subjectFontSize || '15px'};
    font-weight: 500;
    text-overflow: ellipsis;
    line-height: ${(props) => props.subjectLineHeight || '18px'};
    letter-spacing: -0.2px;%;
    max-width: ${(props) => `calc(100% - ${props.statusWidth + (props.isMuted ? 28 : 4) + 2}px)`};
    overflow: hidden;
    white-space: nowrap;
    color: ${(props) =>
      props.subjectColor || (props.theme === THEME.DARK ? colors.darkModeTextColor1 : colors.textColor1)};
    text-transform: ${(props) => props.uppercase && 'uppercase'};
  }
`

export const MutedIcon = styled.span`
  display: inline-flex;
  & > svg {
    height: 16px;
    width: 16px;
    margin-left: 5px;
    color: ${(props) => props.color || colors.borderColor2};
  }
`

export const LastMessage = styled.div<{
  markedAsUnread?: boolean
  unreadMentions?: boolean
  fontSize?: string
  height?: string
}>`
  display: flex;
  align-items: center;
  font-size: ${(props) => props.fontSize || '14px'};
  color: ${colors.textColor1};
  max-width: ${(props) =>
    props.markedAsUnread || props.unreadMentions
      ? // @ts-ignore
        `calc(100% - ${props.markedAsUnread && props.unreadMentions ? 48 : 24}px)`
      : '100%'};

  height: ${(props) => props.height || '20px'};
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

export const DraftMessageTitle = styled.span<any>`
  color: ${colors.red1};
`
export const DraftMessageText = styled.span<any>`
  color: ${colors.textColor2};
`
export const LastMessageAuthor = styled.div<{ theme?: string; typing?: boolean }>`
  max-width: 120px;
  font-weight: 500;
  color: ${(props) => (props.theme === THEME.DARK ? colors.darkModeTextColor1 : colors.textColor1)};

  & > span {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }
`

export const Points = styled.span<{ color?: string }>`
  margin-right: 4px;
  color: ${(props) => props.color};
`

export const LastMessageText = styled.span<{
  withAttachments?: boolean
  noBody?: boolean
  deletedMessage?: boolean
}>`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${colors.textColor2};
  font-style: ${(props) => props.deletedMessage && 'italic'};
  transform: ${(props) => props.withAttachments && 'translate(0px, -1px)'};
  //height: 20px;

  > svg {
    width: 16px;
    height: 16px;
    margin-right: 4px;
    color: ${colors.textColor2};
    //transform: ${(props) => (props.withAttachments ? 'translate(0px, 3px)' : 'translate(0px, 2px)')};
    transform: translate(0px, 3px);
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

export const LastMessageDate = styled.span<{ fontSize?: string }>`
  color: ${colors.textColor2};
  font-size: ${(props) => props.fontSize || '12px'};
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
  font-family:
    apple color emoji,
    segoe ui emoji,
    noto color emoji,
    android emoji,
    emojisymbols,
    emojione mozilla,
    twemoji mozilla,
    segoe ui symbol;
  padding: 0 3px;
`

export const UnreadInfo = styled.span<{ bottom?: string }>`
  position: absolute;
  bottom: ${(props) => props.bottom || '11px'};
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
