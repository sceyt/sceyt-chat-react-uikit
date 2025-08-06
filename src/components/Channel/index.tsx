import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import styled from 'styled-components'
import moment from 'moment'
// Hooks
import useUpdatePresence from '../../hooks/useUpdatePresence'
// Store
import {
  activeChannelSelector,
  channelMessageDraftIsRemovedSelector,
  typingOrRecordingIndicatorArraySelector
} from '../../store/channel/selector'
import {
  sendTypingAC,
  setChannelDraftMessageIsRemovedAC,
  switchChannelActionAC,
  updateChannelDataAC
} from '../../store/channel/actions'
import { clearMessagesAC } from '../../store/message/actions'
// Assets
import { ReactComponent as ImageIcon } from '../../assets/svg/picture.svg'
import { ReactComponent as CameraIcon } from '../../assets/svg/video-call.svg'
import { ReactComponent as FileIcon } from '../../assets/svg/choseFile.svg'
import { ReactComponent as VoiceIcon } from '../../assets/svg/voiceIcon.svg'
import { ReactComponent as MentionIcon } from '../../assets/svg/unreadMention.svg'
import { ReactComponent as NotificationOffIcon } from '../../assets/svg/unmuteNotifications.svg'
import { ReactComponent as PinedIcon } from '../../assets/svg/pin.svg'
// Components
import Avatar from '../Avatar'
// Helpers
import { systemMessageUserName } from '../../helpers'
import { isJSON, lastMessageDateFormat, makeUsername } from '../../helpers/message'
import { hideUserPresence } from '../../helpers/userHelper'
import { getAudioRecordingFromMap, getDraftMessageFromMap } from '../../helpers/messagesHalper'
import { updateChannelOnAllChannels } from '../../helpers/channelHalper'
import { attachmentTypes, DEFAULT_CHANNEL_TYPE, MESSAGE_STATUS, USER_PRESENCE_STATUS } from '../../helpers/constants'
import { THEME_COLORS } from '../../UIHelper/constants'
import { getShowOnlyContactUsers } from '../../helpers/contacts'
import { getClient } from '../../common/client'
import { IChannel, IContact, IMessage, IUser } from '../../types'
import { MessageStatusIcon, MessageTextFormat } from '../../messageUtils'
import { useColor } from '../../hooks'

interface IChannelProps {
  channel: IChannel
  showAvatar?: boolean
  avatarBorderRadius?: string
  theme?: string
  notificationsIsMutedIcon?: JSX.Element
  notificationsIsMutedIconColor?: string
  selectedChannelLeftBorder?: string
  selectedChannelBackground?: string
  pinedIcon?: JSX.Element
  contactsMap?: { [key: string]: IContact }
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

const LastMessageAttachments = ({ lastMessage }: { lastMessage: IMessage }) => {
  return (
    !!(lastMessage.attachments && lastMessage.attachments.length) &&
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
    ) : null)
  )
}

const ChannelMessageText = ({
  isTypingOrRecording,
  textPrimary,
  textSecondary,
  draftMessageText,
  lastMessage,
  user,
  contactsMap,
  getFromContacts,
  lastMessageMetas,
  accentColor,
  typingOrRecording,
  channel,
  isDirectChannel
}: {
  isTypingOrRecording?: boolean
  textPrimary: string
  textSecondary: string
  draftMessageText: string
  lastMessage: IMessage
  user: IUser
  contactsMap: { [key: string]: IContact } | undefined
  getFromContacts: boolean
  lastMessageMetas: any
  accentColor: string
  typingOrRecording: any
  channel: IChannel
  isDirectChannel: boolean
}) => {
  const audioRecording = useMemo(() => {
    return getAudioRecordingFromMap(channel.id)
  }, [channel.id, draftMessageText])

  return (
    <MessageTextContainer>
      {isTypingOrRecording && (
        <TypingIndicator>
          {!isDirectChannel && <Points color={textPrimary}>:</Points>}
          {typingOrRecording.isTyping ? 'typing' : 'recording'}
          ...
        </TypingIndicator>
      )}
      {!isTypingOrRecording &&
        (draftMessageText ? (
          <DraftMessageText color={textSecondary}>
            {audioRecording && <VoiceIcon />}
            {draftMessageText}
          </DraftMessageText>
        ) : lastMessage.state === MESSAGE_STATUS.DELETE ? (
          'Message was deleted.'
        ) : lastMessage.type === 'system' ? (
          `${
            lastMessage.user &&
            (lastMessage.user.id === user.id
              ? 'You '
              : makeUsername(
                  lastMessage.user && contactsMap && contactsMap[lastMessage.user.id],
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
                            : ` ${systemMessageUserName(
                                mem,
                                contactsMap && contactsMap[mem],
                                lastMessage.mentionedUsers
                              )}`
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
                              : ` ${systemMessageUserName(
                                  mem,
                                  contactsMap && contactsMap[mem],
                                  lastMessage.mentionedUsers
                                )}`
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
            <LastMessageDescription>
              {channel.lastReactedMessage && (
                <React.Fragment>
                  Reacted
                  <ReactionItem>
                    {channel.newReactions && channel.newReactions[0] && channel.newReactions[0].key}
                  </ReactionItem>
                  to{' "'}
                </React.Fragment>
              )}
              {LastMessageAttachments({ lastMessage })}
              {!!(lastMessage && lastMessage.id) &&
                MessageTextFormat({
                  text: lastMessage.body,
                  message: lastMessage,
                  contactsMap,
                  getFromContacts,
                  isLastMessage: true,
                  accentColor,
                  textSecondary
                })}
              {channel.lastReactedMessage && '"'}
            </LastMessageDescription>
          </React.Fragment>
        ))}
    </MessageTextContainer>
  )
}

const Channel: React.FC<IChannelProps> = ({
  channel,
  theme,
  showAvatar = true,
  avatarBorderRadius,
  notificationsIsMutedIcon,
  notificationsIsMutedIconColor,
  pinedIcon,
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
  const {
    [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.BACKGROUND_HOVERED]: backgroundHovered,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.SURFACE_2]: surface2,
    [THEME_COLORS.WARNING]: warningColor,
    [THEME_COLORS.ICON_PRIMARY]: iconPrimary,
    [THEME_COLORS.ONLINE_STATUS]: onlineStatus,
    [THEME_COLORS.BACKGROUND_FOCUSED]: backgroundFocused,
    [THEME_COLORS.ICON_INACTIVE]: iconInactive,
    [THEME_COLORS.TEXT_ON_PRIMARY]: textOnPrimary,
    [THEME_COLORS.BACKGROUND]: background
  } = useColor()

  const dispatch = useDispatch()
  const ChatClient = getClient()
  const getFromContacts = getShowOnlyContactUsers()
  const { user } = ChatClient
  const activeChannel = useSelector(activeChannelSelector) || {}
  const channelDraftIsRemoved = useSelector(channelMessageDraftIsRemovedSelector)
  const isDirectChannel = channel.type === DEFAULT_CHANNEL_TYPE.DIRECT
  const isSelfChannel = isDirectChannel && channel.metadata?.s
  const directChannelUser = isDirectChannel && channel.members.find((member) => member.id !== user.id)
  const typingOrRecordingIndicator = useSelector(typingOrRecordingIndicatorArraySelector(channel.id))
  const [draftMessageText, setDraftMessageText] = useState<any>()
  const lastMessage = channel.lastReactedMessage || channel.lastMessage
  const lastMessageMetas =
    lastMessage &&
    lastMessage.type === 'system' &&
    lastMessage.metadata &&
    (isJSON(lastMessage.metadata) ? JSON.parse(lastMessage.metadata) : lastMessage.metadata)
  const [statusWidth, setStatusWidth] = useState(0)

  const avatarName =
    channel.subject ||
    (isDirectChannel && directChannelUser
      ? directChannelUser.firstName || directChannelUser.id
      : isSelfChannel
        ? 'Me'
        : '')

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
      const draftAudioRecording = getAudioRecordingFromMap(channel.id)
      if (channelDraftMessage || draftAudioRecording) {
        if (channelDraftMessage) {
          setDraftMessageText(channelDraftMessage.text)
        } else if (draftAudioRecording) {
          setDraftMessageText('Voice')
        }
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
  }, [channel.muted])

  const typingOrRecording = useMemo(() => {
    const dataValues = typingOrRecordingIndicator ? Object.values(typingOrRecordingIndicator) : []
    const filteredItems = dataValues.filter((item: any) => item.typingState || item.recordingState)
    return {
      items: filteredItems,
      isTyping: !!filteredItems.find((item: any) => item.typingState)
    }
  }, [typingOrRecordingIndicator])

  const isTypingOrRecording = useMemo(() => {
    return typingOrRecording.items.length > 0
  }, [typingOrRecording])

  const MessageText = useMemo(() => {
    return (
      <ChannelMessageText
        isTypingOrRecording={isTypingOrRecording}
        user={user}
        contactsMap={contactsMap}
        getFromContacts={getFromContacts}
        lastMessageMetas={lastMessageMetas}
        accentColor={accentColor}
        typingOrRecording={typingOrRecording}
        channel={channel}
        textPrimary={textPrimary}
        textSecondary={textSecondary}
        draftMessageText={draftMessageText}
        lastMessage={lastMessage}
        isDirectChannel={isDirectChannel}
      />
    )
  }, [
    isTypingOrRecording,
    draftMessageText,
    lastMessage,
    user,
    contactsMap,
    getFromContacts,
    lastMessageMetas,
    accentColor,
    typingOrRecording,
    channel,
    isDirectChannel
  ])

  return (
    <Container
      // ref={channelItemRef}
      theme={theme}
      selectedChannel={channel.id === activeChannel.id}
      selectedChannelLeftBorder={selectedChannelLeftBorder}
      selectedBackgroundColor={selectedChannelBackground || backgroundFocused}
      selectedChannelPaddings={selectedChannelPaddings}
      channelsPaddings={channelsPaddings}
      selectedChannelBorderRadius={selectedChannelBorderRadius}
      channelsMargin={channelsMargin}
      onClick={() => handleChangeActiveChannel(channel)}
      hoverBackground={channelHoverBackground || backgroundHovered}
    >
      {showAvatar && (
        <AvatarWrapper>
          <Avatar
            // customAvatarColors={userAvatarColors}
            name={avatarName}
            borderRadius={avatarBorderRadius}
            image={
              channel.avatarUrl ||
              (isDirectChannel && directChannelUser ? directChannelUser.avatarUrl : isSelfChannel ? user.avatarUrl : '')
            }
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
              <UserStatus backgroundColor={onlineStatus} borderColor={background} />
            )}
        </AvatarWrapper>
      )}
      <ChannelInfo
        theme={theme}
        avatar={showAvatar}
        isMuted={channel.muted}
        isPinned={!!channel.pinnedAt}
        statusWidth={statusWidth}
        uppercase={directChannelUser && hideUserPresence && hideUserPresence(directChannelUser)}
        subjectFontSize={channelSubjectFontSize}
        subjectLineHeight={channelSubjectLineHeight}
        subjectColor={channelSubjectColor || textPrimary}
        avatarSize={channelAvatarSize}
      >
        <h3>
          {channel.subject ||
            (isDirectChannel && directChannelUser
              ? makeUsername(contactsMap && contactsMap[directChannelUser.id], directChannelUser, getFromContacts)
              : channel.metadata?.s
                ? 'Me'
                : '')}
        </h3>
        {channel.muted && (
          <MutedIcon color={notificationsIsMutedIconColor || iconInactive}>
            {notificationsIsMutedIcon || <NotificationOffIcon />}
          </MutedIcon>
        )}
        {(lastMessage || typingOrRecording.items.length > 0 || draftMessageText) && (
          <LastMessage
            color={textSecondary}
            markedAsUnread={!!(channel.unread || (channel.newMessageCount && channel.newMessageCount > 0))}
            unreadMentions={!!(channel.newMentionCount && channel.newMentionCount > 0)}
            fontSize={channelLastMessageFontSize}
            height={channelLastMessageHeight}
          >
            {isTypingOrRecording ? (
              !isDirectChannel ? (
                <LastMessageAuthor
                  typing={typingOrRecording.isTyping}
                  recording={!typingOrRecording.isTyping}
                  color={textPrimary}
                >
                  <span ref={messageAuthorRef}>
                    {typingOrRecording.items.map((item: any, index: number) => (
                      <React.Fragment key={item.from.id}>
                        {makeUsername(contactsMap && contactsMap[item.from.id], item.from, getFromContacts, true)}
                        {index < typingOrRecording.items.length - 1 && ', '}
                      </React.Fragment>
                    ))}
                  </span>
                </LastMessageAuthor>
              ) : null
            ) : draftMessageText ? (
              <DraftMessageTitle color={warningColor}>Draft</DraftMessageTitle>
            ) : channel.lastReactedMessage && channel.newReactions && channel.newReactions[0] ? (
              lastMessage.state !== MESSAGE_STATUS.DELETE &&
              ((channel.newReactions[0].user && channel.newReactions[0].user.id === user.id) || !isDirectChannel) &&
              lastMessage.type !== 'system' && (
                <LastMessageAuthor color={textPrimary}>
                  <span ref={messageAuthorRef}>
                    {channel.newReactions[0].user.id === user.id
                      ? 'You'
                      : makeUsername(
                          contactsMap && contactsMap[channel.newReactions[0].user.id],
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
                <LastMessageAuthor color={textPrimary}>
                  <span ref={messageAuthorRef}>
                    {lastMessage.user.id === user.id
                      ? 'You'
                      : makeUsername(
                          contactsMap && contactsMap[lastMessage.user.id],
                          lastMessage.user,
                          getFromContacts,
                          true
                        )}
                  </span>
                </LastMessageAuthor>
              )
            )}
            {!isTypingOrRecording &&
              (isDirectChannel
                ? !isTypingOrRecording &&
                  (draftMessageText ||
                    (lastMessage.user &&
                      lastMessage.state !== MESSAGE_STATUS.DELETE &&
                      (channel.lastReactedMessage && channel.newReactions && channel.newReactions[0]
                        ? channel.newReactions[0].user && channel.newReactions[0].user.id === user.id
                        : lastMessage.user.id === user.id)))
                : (isTypingOrRecording && draftMessageText) ||
                  (lastMessage && lastMessage.state !== MESSAGE_STATUS.DELETE && lastMessage.type !== 'system')) && (
                <Points color={(draftMessageText && warningColor) || textPrimary}>: </Points>
              )}
            <LastMessageText
              color={textSecondary}
              withAttachments={
                !!(
                  lastMessage &&
                  lastMessage.attachments &&
                  lastMessage.attachments.length &&
                  lastMessage.attachments[0].type !== attachmentTypes.link
                ) && !isTypingOrRecording
              }
              noBody={lastMessage && !lastMessage.body}
              deletedMessage={lastMessage && lastMessage.state === MESSAGE_STATUS.DELETE}
            >
              {MessageText}
            </LastMessageText>
          </LastMessage>
        )}
      </ChannelInfo>

      <ChannelStatus color={iconInactive} ref={messageTimeAndStatusRef}>
        {lastMessage && lastMessage.state !== MESSAGE_STATUS.DELETE && (
          <DeliveryIconCont>
            {lastMessage &&
              lastMessage.user &&
              lastMessage.user.id === user.id &&
              lastMessage.type !== 'system' &&
              MessageStatusIcon({
                messageStatus: lastMessage.deliveryStatus,
                messageStatusDisplayingType: 'ticks',
                readIconColor: accentColor,
                color: iconPrimary,
                accentColor,
                size: '16px'
              })}
          </DeliveryIconCont>
        )}
        <LastMessageDate color={textSecondary} fontSize={channelLastMessageTimeFontSize}>
          {lastMessage && lastMessage.createdAt && lastMessageDateFormat(lastMessage.createdAt)}
          {/* {lastMessage &&
            lastMessage.createdAt &&
            moment(lastMessage.createdAt).format('HH:mm')} */}
        </LastMessageDate>
      </ChannelStatus>
      <UnreadInfo bottom={!(lastMessage || typingOrRecording.items.length > 0 || draftMessageText) ? '5px' : ''}>
        {!!(channel.newMentionCount && channel.newMentionCount > 0) && (
          <UnreadMentionIconWrapper
            iconColor={channel?.muted ? iconInactive : accentColor}
            rightMargin={!!(channel.newMessageCount || channel.unread)}
          >
            <MentionIcon />
          </UnreadMentionIconWrapper>
        )}
        {!!(channel.newMessageCount || channel.unread) && (
          <UnreadCount
            backgroundColor={accentColor}
            textColor={textOnPrimary}
            isMuted={channel.muted}
            mutedBackgroundColor={surface2}
          >
            {channel.newMessageCount ? (channel.newMessageCount > 99 ? '99+' : channel.newMessageCount) : ''}
          </UnreadCount>
        )}
        {channel.pinnedAt &&
          !(channel.newMessageCount || channel.unread) &&
          !(channel.newMentionCount && channel.newMentionCount > 0) && (
            <PinnedIconWrapper color={iconInactive}>{pinedIcon || <PinedIcon />}</PinnedIconWrapper>
          )}
      </UnreadInfo>
    </Container>
  )
}

export default Channel

export interface UnreadCountProps {
  readonly isMuted: boolean
  readonly backgroundColor: string
  readonly mutedBackgroundColor?: string
  width?: string
  height?: string
  textColor?: string
  fontSize?: string
}

export const ChannelInfo = styled.div<{
  statusWidth: number
  avatar?: boolean
  isMuted?: boolean
  theme?: string
  uppercase?: boolean
  subjectFontSize?: string
  subjectLineHeight?: string
  subjectColor: string
  avatarSize?: number
  isPinned?: boolean
}>`
  text-align: left;
  margin-left: ${(props) => props.avatar && '12px'};
  width: 100%;
  max-width: ${(props) =>
    props.avatarSize ? `calc(100% - ${props.avatarSize + 52}px)` : `calc(100% - ${props.isPinned ? 92 : 72}px)`};

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
    color: ${(props) => props.subjectColor};
    text-transform: ${(props) => props.uppercase && 'uppercase'};
  }
`

export const MutedIcon = styled.span<{ color: string }>`
  display: inline-flex;
  & > svg {
    height: 16px;
    width: 16px;
    margin-left: 5px;
    color: ${(props) => props.color};
  }
`

export const LastMessage = styled.div<{
  color: string
  markedAsUnread?: boolean
  unreadMentions?: boolean
  fontSize?: string
  height?: string
}>`
  display: flex;
  align-items: center;
  font-size: ${(props) => props.fontSize || '14px'};
  color: ${(props) => props.color};
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

export const UserStatus = styled.span<{ backgroundColor?: string; borderColor?: string }>`
  position: absolute;
  width: 12px;
  height: 12px;
  right: 0;
  bottom: 0;
  border-radius: 50%;
  background-color: ${(props) => props.backgroundColor || '#56E464'};
  border: 2.5px solid ${(props) => props.borderColor || '#ffffff'};
  box-sizing: border-box;
`
const Container = styled.div<{
  selectedChannel: boolean
  selectedChannelLeftBorder?: string
  selectedBackgroundColor: string
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
  background-color: ${(props) => (props.selectedChannel ? props.selectedBackgroundColor : 'inherit')};
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
    ${({ selectedChannel, hoverBackground }) =>
      !selectedChannel &&
      `
      background-color: ${hoverBackground};
    `}
    ${UserStatus} {
      border-color: ${(props) => (props.selectedChannel ? props.selectedBackgroundColor : props.hoverBackground)};
    }
  }
  ${UserStatus} {
    ${(props) =>
      props.selectedChannel &&
      `
      border-color: ${props.selectedBackgroundColor};
    `}
  }
`

export const DraftMessageTitle = styled.span<{ color: string }>`
  color: ${(props) => props.color};
`
export const DraftMessageText = styled.span<{ color: string }>`
  color: ${(props) => props.color};
  display: flex;
  align-items: flex-end;
  gap: 4px;
`
export const LastMessageAuthor = styled.div<{ color: string; typing?: boolean; recording?: boolean }>`
  max-width: 120px;
  font-weight: 500;
  color: ${(props) => props.color};

  ${({ typing, recording }) =>
    (typing || recording) &&
    `
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: calc(100% - ${typing ? 62 : 76}px);
  `}
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
  font-style: normal;
`

export const LastMessageText = styled.span<{
  color: string
  withAttachments?: boolean
  noBody?: boolean
  deletedMessage?: boolean
}>`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${(props) => props.color};
  font-style: ${(props) => props.deletedMessage && 'italic'};
  transform: ${(props) => props.withAttachments && 'translate(0px, -1px)'};
  //height: 20px;

  > svg {
    width: 16px;
    height: 16px;
    min-width: 16px;
    min-height: 16px;
    margin-right: 4px;
    color: ${(props) => props.color};
    transform: translate(0px, 3px);
  }
  & > span {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }
  & > div {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
    & > svg {
      width: 18px;
      height: 18px;
      min-width: 18px;
      min-height: 18px;
      color: ${(props) => props.color};
    }
  }
`
export const LastMessageDescription = styled.div`
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  & > svg {
    width: 18px;
    height: 18px;
    margin: 3px 0 -3px 0;
    margin-right: 4px;
  }
`

export const ChannelStatus = styled.div<{ color: string }>`
  position: absolute;
  right: 16px;
  top: 15px;
  display: flex;
  flex-wrap: wrap;
  height: 42px;
  margin-left: auto;

  & > svg {
    width: 16px;
    height: 16px;
    color: ${(props) => props.color};
  }
`

export const LastMessageDate = styled.span<{ color: string; fontSize?: string }>`
  color: ${(props) => props.color};
  font-size: ${(props) => props.fontSize || '12px'};
  line-height: 16px;
`

export const DeliveryIconCont = styled.span`
  margin-right: 6px;
  line-height: 13px;
`

export const UnreadMentionIconWrapper = styled.span<{ iconColor: string; rightMargin?: boolean }>`
  margin-right: ${(props) => props.rightMargin && '8px'};
  line-height: 13px;

  & > svg {
    color: ${(props) => props.iconColor};
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
const UnreadCount = styled.span<UnreadCountProps & { backgroundColor: string; textColor: string }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: ${(props) => props.backgroundColor};
  padding: 0 4px;
  font-size: ${(props) => props.fontSize || '13px'};
  min-width: ${(props) => props.width || '20px'};
  height: ${(props) => props.height || '20px'};
  text-align: center;
  font-weight: 500;
  color: ${(props) => props.textColor};
  border-radius: 10px;
  box-sizing: border-box;

  ${(props: any) => props.isMuted && `background-color: ${props.mutedBackgroundColor};`}
`

const PinnedIconWrapper = styled.span<{ color: string }>`
  & > svg {
    color: ${(props) => props.color};
  }
`

const MessageTextContainer = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 4px;
`
