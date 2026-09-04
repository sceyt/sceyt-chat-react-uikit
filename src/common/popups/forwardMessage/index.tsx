import React, { ChangeEvent, KeyboardEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Popup, PopupName, CloseIcon, PopupBody } from '../../../UIHelper'
import { THEME_COLORS } from '../../../UIHelper/constants'
import styled from 'styled-components'
import {
  getChannelsForForwardAC,
  loadMoreChannelsForForward,
  searchChannelsForForwardAC,
  setSearchedChannelsForForwardAC
} from '../../../store/channel/actions'
import { useSelector, useDispatch } from 'store/hooks'
import {
  channelsForForwardHasNextSelector,
  channelsForForwardSelector,
  channelsLoadingStateForForwardSelector,
  searchedChannelsForForwardSelector
} from '../../../store/channel/selector'
import { IAttachment, IBodyAttribute, IChannel, IMember, IUser } from '../../../types'
import ChannelSearch from '../../../components/ChannelList/ChannelSearch'
import { Avatar, ThemeMode } from '../../../components'
import Attachment from '../../../components/Attachment'
import { attachmentTypes, DEFAULT_CHANNEL_TYPE, LOADING_STATE, USER_PRESENCE_STATUS } from '../../../helpers/constants'
import { userLastActiveDateFormat } from '../../../helpers'
import { makeUsername, trimMessageBodyWithAttributes } from '../../../helpers/message'
import { getReplyLinkPreviewImage, shouldShowLinkPreviewErrorFallback } from '../../../helpers/replyPreview'
import { contactsMapSelector } from '../../../store/user/selector'
import { getShowOnlyContactUsers } from '../../../helpers/contacts'
import CustomCheckbox from '../../customCheckbox'

import { ReactComponent as CrossIcon } from '../../../assets/svg/cross.svg'
import { ReactComponent as ForwardIcon } from '../../../assets/svg/forward.svg'
import { ReactComponent as ChooseFileIcon } from '../../../assets/svg/choseFile.svg'
import { ReactComponent as SendIcon } from '../../../assets/svg/send.svg'
import { ReactComponent as LinkIcon } from '../../../assets/svg/linkIcon.svg'
import { hideUserPresence } from '../../../helpers/userHelper'
import { getClient } from '../../client'
import PopupContainer from '../popupContainer'
import { useColor, useUpdatedUser } from '../../../hooks'
import { activeChannelMembersMapSelector } from '../../../store/member/selector'
import { getMembersAC } from '../../../store/member/actions'
import { themeSelector } from 'store/theme/selector'

/** The note is deliberately a normal text message so mention notifications keep their existing behavior. */
export interface IForwardMessageNote {
  body: string
  bodyAttributes: IBodyAttribute[]
  mentionedUsers: IUser[]
  attachments: any[]
  type: 'text'
}

const DEFAULT_FORWARD_NOTE_MAX_LENGTH = 1000
const NOTE_INPUT_LINE_HEIGHT = 20
const NOTE_INPUT_MIN_HEIGHT = NOTE_INPUT_LINE_HEIGHT
const NOTE_INPUT_MAX_HEIGHT = NOTE_INPUT_LINE_HEIGHT * 3
interface ISelectedChannelsData {
  id: string
  displayName: string
  channel: IChannel
}

/** A real IMessage satisfies this — callers with no actual message (e.g. sharing a link) can pass a minimal stand-in. */
export interface IForwardPreviewMessage {
  body?: string
  attachments?: IAttachment[]
}

interface IProps {
  title: string
  /** @deprecated No longer rendered — forwarding is triggered by the note input's send button. */
  buttonText?: string
  togglePopup: () => void
  // eslint-disable-next-line no-unused-vars
  handleForward: (channelIds: string[], note?: IForwardMessageNote) => void
  loading?: boolean
  maxSelectedCount?: number
  /** Defaults to 1000 characters and can be adjusted to match an application's message policy. */
  maxNoteLength?: number
  /** The message(s) being forwarded, used to render the preview above the note input. */
  forwardMessages?: IForwardPreviewMessage[]
}

const getForwardPreviewLabel = (message?: IForwardPreviewMessage) => {
  const attachment = message?.attachments?.[0]
  if (!attachment) return message?.body || 'Message'
  switch (attachment.type) {
    case attachmentTypes.voice:
      return 'Voice'
    case attachmentTypes.image:
      return 'Photo'
    case attachmentTypes.video:
      return 'Video'
    case attachmentTypes.audio:
      return 'Audio'
    case attachmentTypes.link:
      return attachment.url || 'File'
    default:
      return 'File'
  }
}

const ChannelMembersItem = ({
  channel,
  directChannelUser,
  isDirectChannel
}: {
  channel: IChannel
  directChannelUser: IMember
  isDirectChannel: boolean
}) => {
  const { [THEME_COLORS.TEXT_SECONDARY]: textSecondary } = useColor()
  // Always call the hook, but only use the updated value for direct channels
  const updatedUser = useUpdatedUser(directChannelUser)
  const directChannelUserUpdated = isDirectChannel ? updatedUser : directChannelUser

  return (
    <ChannelMembers color={textSecondary}>
      {isDirectChannel && directChannelUserUpdated
        ? (
            hideUserPresence && hideUserPresence(directChannelUserUpdated)
              ? ''
              : directChannelUserUpdated.presence &&
                directChannelUserUpdated.presence.state === USER_PRESENCE_STATUS.ONLINE
          )
          ? 'Online'
          : directChannelUserUpdated &&
            directChannelUserUpdated.presence &&
            directChannelUserUpdated.presence.lastActiveAt &&
            userLastActiveDateFormat(directChannelUserUpdated.presence.lastActiveAt)
        : `${channel?.memberCount} ${
            channel.type === DEFAULT_CHANNEL_TYPE.BROADCAST || channel.type === DEFAULT_CHANNEL_TYPE.PUBLIC
              ? channel?.memberCount > 1
                ? 'subscribers'
                : 'subscriber'
              : channel?.memberCount > 1
                ? 'members'
                : 'member'
          } `}
    </ChannelMembers>
  )
}

function ForwardMessagePopup({
  title,
  togglePopup,
  handleForward,
  loading,
  maxSelectedCount = 5,
  maxNoteLength = DEFAULT_FORWARD_NOTE_MAX_LENGTH,
  forwardMessages = []
}: IProps) {
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
    [THEME_COLORS.SURFACE_2]: surface2,
    [THEME_COLORS.TOOLTIP_BACKGROUND]: tooltipBackground,
    [THEME_COLORS.BORDER]: border
  } = useColor()
  const theme = useSelector(themeSelector)

  const firstForwardMessage = forwardMessages[0]
  const firstForwardAttachment = firstForwardMessage?.attachments?.[0]
  const forwardPreviewLabel = getForwardPreviewLabel(firstForwardMessage)
  const forwardMoreCount = forwardMessages.length > 1 ? forwardMessages.length - 1 : 0
  const forwardLinkPreviewImage = getReplyLinkPreviewImage(firstForwardMessage?.attachments)
  const [forwardLinkPreviewImageFailed, setForwardLinkPreviewImageFailed] = useState(false)

  const ChatClient = getClient()
  const { user } = ChatClient
  const dispatch = useDispatch()
  const channels = useSelector(channelsForForwardSelector) || []
  const searchedChannels = useSelector(searchedChannelsForForwardSelector) || []
  const contactsMap = useSelector(contactsMapSelector)
  const getFromContacts = getShowOnlyContactUsers()
  const channelsLoading = useSelector(channelsLoadingStateForForwardSelector)
  const channelsHasNext = useSelector(channelsForForwardHasNextSelector)
  const channelMembersMap = useSelector(activeChannelMembersMapSelector) || {}
  const [searchValue, setSearchValue] = useState('')
  const [selectedChannelsContHeight, setSelectedChannelsHeight] = useState(0)
  const [selectedChannels, setSelectedChannels] = useState<ISelectedChannelsData[]>([])
  const selectedChannelsContRef = useRef<any>()
  const [isScrolling, setIsScrolling] = useState<boolean>(false)
  const [isNoteScrolling, setIsNoteScrolling] = useState<boolean>(false)
  const [warningChannelId, setWarningChannelId] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [noteAttributes, setNoteAttributes] = useState<IBodyAttribute[]>([])
  const [noteMentionedUsers, setNoteMentionedUsers] = useState<IUser[]>([])
  const [mentionQuery, setMentionQuery] = useState<{ start: number; value: string } | null>(null)
  const noteInputRef = useRef<HTMLTextAreaElement>(null)
  const noteContainerRef = useRef<HTMLDivElement>(null)
  const [noteContainerHeight, setNoteContainerHeight] = useState(0)
  const loadingRef = useRef(false)
  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showWarning = (channelId: string) => {
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current)
    setWarningChannelId(channelId)
    warningTimeoutRef.current = setTimeout(() => setWarningChannelId(null), 3000)
  }

  const mentionCandidates = useMemo(() => {
    const members = selectedChannels.flatMap((selectedChannel) =>
      channelMembersMap[selectedChannel.id]?.length
        ? channelMembersMap[selectedChannel.id]
        : selectedChannel.channel.members || []
    )
    const membersById = new Map<string, IMember>()
    members.forEach((member: IMember) => {
      if (member.id !== user.id) membersById.set(member.id, member)
    })
    return Array.from(membersById.values())
  }, [channelMembersMap, selectedChannels, user.id])

  const visibleMentionCandidates = useMemo(() => {
    if (!mentionQuery) return []
    const normalizedQuery = mentionQuery.value.toLowerCase()
    return mentionCandidates
      .filter((member) => {
        const displayName = makeUsername(contactsMap[member.id], member, getFromContacts)
        return displayName.toLowerCase().includes(normalizedQuery)
      })
      .slice(0, 5)
  }, [contactsMap, getFromContacts, mentionCandidates, mentionQuery])

  const handleForwardMessage = () => {
    const { body, bodyAttributes } = trimMessageBodyWithAttributes(noteText, noteAttributes)
    const mentionedUsers = bodyAttributes
      .filter((attribute: IBodyAttribute) => attribute.type === 'mention')
      .map((attribute: IBodyAttribute) => noteMentionedUsers.find((member) => member.id === attribute.metadata))
      .filter(Boolean) as IUser[]
    const note = body
      ? {
          body,
          bodyAttributes,
          mentionedUsers,
          attachments: [],
          type: 'text' as const
        }
      : undefined
    handleForward(
      selectedChannels.map((channel) => channel.id),
      note
    )
    togglePopup()
  }

  const handleChannelListScroll = (event: any) => {
    if (event.target.scrollTop >= event.target.scrollHeight - event.target.offsetHeight - 100) {
      if (channelsLoading === LOADING_STATE.LOADED && channelsHasNext && !loadingRef.current) {
        loadingRef.current = true
        dispatch(loadMoreChannelsForForward(20))
        const timeout = setTimeout(() => {
          loadingRef.current = false
          clearTimeout(timeout)
        }, 100)
      }
    }
  }

  useEffect(() => {
    if (channelsLoading === LOADING_STATE.LOADED) {
      loadingRef.current = false
    }
  }, [channelsLoading])

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
    const isSelfChannel =
      isDirectChannel && channel.memberCount === 1 && channel.members.length > 0 && channel.members[0].id === user.id
    const directChannelUser = isDirectChannel && channel.members.find((member: IMember) => member.id !== user.id)
    if (isSelected && selectedChannels.length >= maxSelectedCount) {
      showWarning(channel.id)
      return
    }
    if (isSelected && selectedChannels.length < maxSelectedCount) {
      newSelectedChannels.push({
        id: channel.id,
        channel,
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

  const getMentionQuery = (value: string, selectionStart: number) => {
    const beforeCursor = value.slice(0, selectionStart)
    const match = /(^|\s)@([^\s@]*)$/.exec(beforeCursor)
    return match ? { start: selectionStart - match[2].length - 1, value: match[2] } : null
  }

  const reconcileNoteAttributes = (previousText: string, nextText: string) => {
    let changeStart = 0
    while (changeStart < previousText.length && previousText[changeStart] === nextText[changeStart]) changeStart += 1

    let previousEnd = previousText.length
    let nextEnd = nextText.length
    while (
      previousEnd > changeStart &&
      nextEnd > changeStart &&
      previousText[previousEnd - 1] === nextText[nextEnd - 1]
    ) {
      previousEnd -= 1
      nextEnd -= 1
    }

    const delta = nextEnd - changeStart - (previousEnd - changeStart)
    const nextAttributes = noteAttributes.reduce<IBodyAttribute[]>((attributes, attribute) => {
      const attributeEnd = attribute.offset + attribute.length
      if (attributeEnd <= changeStart) {
        attributes.push(attribute)
      } else if (attribute.offset >= previousEnd) {
        attributes.push({ ...attribute, offset: attribute.offset + delta })
      }
      // An edit across a mention turns it back into plain text, matching the composer behavior.
      return attributes
    }, [])
    setNoteAttributes(nextAttributes)
    setNoteMentionedUsers((members) => members.filter((member) => nextAttributes.some((a) => a.metadata === member.id)))
  }

  const handleNoteChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const nextText = event.target.value.slice(0, maxNoteLength)
    reconcileNoteAttributes(noteText, nextText)
    setNoteText(nextText)
    setMentionQuery(getMentionQuery(nextText, Math.min(event.target.selectionStart, nextText.length)))
  }

  useLayoutEffect(() => {
    const noteInput = noteInputRef.current
    if (!noteInput) return
    noteInput.style.height = `${NOTE_INPUT_MIN_HEIGHT}px`
    noteInput.style.height = `${Math.min(noteInput.scrollHeight, NOTE_INPUT_MAX_HEIGHT)}px`
  }, [noteText])

  useLayoutEffect(() => {
    setNoteContainerHeight(noteContainerRef.current ? noteContainerRef.current.offsetHeight : 0)
  }, [selectedChannels.length, firstForwardMessage, noteText])

  const insertMention = (member: IMember) => {
    if (!mentionQuery) return
    const displayName = makeUsername(contactsMap[member.id], member, getFromContacts)
    const mentionText = `@${displayName}`
    const end = noteInputRef.current?.selectionStart || noteText.length
    const nextText = `${noteText.slice(0, mentionQuery.start)}${mentionText}${noteText.slice(end)}`
    if (nextText.length > maxNoteLength) return
    const removedLength = end - mentionQuery.start
    const delta = mentionText.length - removedLength
    const nextAttributes = [
      ...noteAttributes
        .filter((attribute) => attribute.offset + attribute.length <= mentionQuery.start || attribute.offset >= end)
        .map((attribute) => (attribute.offset >= end ? { ...attribute, offset: attribute.offset + delta } : attribute)),
      { type: 'mention', metadata: member.id, offset: mentionQuery.start, length: mentionText.length }
    ].sort((a, b) => a.offset - b.offset)
    setNoteText(nextText)
    setNoteAttributes(nextAttributes)
    setNoteMentionedUsers((members) => (members.some((item) => item.id === member.id) ? members : [...members, member]))
    setMentionQuery(null)
    requestAnimationFrame(() => {
      noteInputRef.current?.focus()
      noteInputRef.current?.setSelectionRange(
        mentionQuery.start + mentionText.length,
        mentionQuery.start + mentionText.length
      )
    })
  }

  const handleNoteKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape' && mentionQuery) {
      event.preventDefault()
      setMentionQuery(null)
    }
  }

  const removeChannel = (channel: ISelectedChannelsData) => {
    const newSelectedChannels = [...selectedChannels]

    const itemToDeleteIndex = newSelectedChannels.findIndex((c) => channel.id === c.id)
    if (itemToDeleteIndex >= 0) {
      newSelectedChannels.splice(itemToDeleteIndex, 1)
    }
    setSelectedChannels(newSelectedChannels)
  }

  useLayoutEffect(() => {
    if (selectedChannelsContRef.current) {
      setSelectedChannelsHeight(selectedChannelsContRef.current.offsetHeight)
    } else {
      setSelectedChannelsHeight(0)
    }
  }, [selectedChannels])

  useEffect(() => {
    if (selectedChannels.length < maxSelectedCount) {
      setWarningChannelId(null)
    }
  }, [selectedChannels])

  useEffect(() => {
    selectedChannels.forEach((selectedChannel) => dispatch(getMembersAC(selectedChannel.id)))
  }, [dispatch, selectedChannels])

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
        height='640px'
        isLoading={loading}
        padding='0'
        backgroundColor={background}
      >
        <PopupBody paddingH='24px' paddingV='24px'>
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
            selectedChannelsHeight={selectedChannelsContHeight + 120}
            className={isScrolling ? 'show-scrollbar' : ''}
            onMouseEnter={() => setIsScrolling(true)}
            onMouseLeave={() => setIsScrolling(false)}
            thumbColor={surface2}
            noteContainerHeight={selectedChannels.length ? noteContainerHeight : 0}
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
                      const isSelfChannel =
                        isDirectChannel &&
                        channel.memberCount === 1 &&
                        channel.members.length > 0 &&
                        channel.members[0].id === user.id
                      const directChannelUser =
                        isDirectChannel && isSelfChannel
                          ? user
                          : channel.members.find((member: IMember) => member.id !== user.id)
                      return (
                        <ChannelItemWrapper key={channel.id}>
                          {warningChannelId === channel.id && selectedChannels.length >= maxSelectedCount && (
                            <WarningTooltip color={textOnPrimary} backgroundColor={tooltipBackground}>
                              {`You can select up to ${maxSelectedCount} conversation${
                                maxSelectedCount === 1 ? '' : 's'
                              }. To add more, remove an existing one.`}
                            </WarningTooltip>
                          )}
                          <ChannelItem
                            onClick={() => handleChannelSelect(!isSelected, channel)}
                            disabled={selectedChannels.length >= maxSelectedCount && !isSelected}
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
                              <ChannelMembersItem
                                channel={channel}
                                directChannelUser={directChannelUser}
                                isDirectChannel={isDirectChannel}
                              />
                            </ChannelInfo>
                            <CustomCheckbox
                              borderColor={iconInactive}
                              index={channel.id}
                              disabled={selectedChannels.length >= maxSelectedCount && !isSelected}
                              state={isSelected}
                              onClick={(e) => {
                                e.stopPropagation()
                              }}
                              size='18px'
                              backgroundColor={'transparent'}
                              checkedBackgroundColor={accentColor}
                            />
                          </ChannelItem>
                        </ChannelItemWrapper>
                      )
                    })}
                  </React.Fragment>
                )}
                {!!(searchedChannels.channels && searchedChannels.channels.length) && (
                  <React.Fragment>
                    <ChannelsGroupTitle color={textSecondary}>Channels</ChannelsGroupTitle>
                    {searchedChannels.channels.map((channel: IChannel) => {
                      const isSelected = selectedChannels.findIndex((chan) => chan.id === channel.id) >= 0
                      const isDirectChannel = channel.type === DEFAULT_CHANNEL_TYPE.DIRECT
                      const isSelfChannel =
                        isDirectChannel &&
                        channel.memberCount === 1 &&
                        channel.members.length > 0 &&
                        channel.members[0].id === user.id
                      const directChannelUser =
                        isDirectChannel && isSelfChannel
                          ? user
                          : channel.members.find((member: IMember) => member.id !== user.id)
                      return (
                        <ChannelItemWrapper key={channel.id}>
                          {warningChannelId === channel.id && selectedChannels.length >= maxSelectedCount && (
                            <WarningTooltip color={textOnPrimary} backgroundColor={tooltipBackground}>
                              {`You can select up to ${maxSelectedCount} conversation${
                                maxSelectedCount === 1 ? '' : 's'
                              }. To add more, remove an existing one.`}
                            </WarningTooltip>
                          )}
                          <ChannelItem
                            onClick={() => handleChannelSelect(!isSelected, channel)}
                            disabled={selectedChannels.length >= maxSelectedCount && !isSelected}
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
                              <ChannelMembersItem
                                channel={channel}
                                directChannelUser={directChannelUser}
                                isDirectChannel={isDirectChannel}
                              />
                            </ChannelInfo>
                            <CustomCheckbox
                              borderColor={iconInactive}
                              index={channel.id}
                              disabled={selectedChannels.length >= maxSelectedCount && !isSelected}
                              state={isSelected}
                              onClick={(e) => {
                                e.stopPropagation()
                              }}
                              size='18px'
                              backgroundColor={'transparent'}
                              checkedBackgroundColor={accentColor}
                            />
                          </ChannelItem>
                        </ChannelItemWrapper>
                      )
                    })}
                  </React.Fragment>
                )}
                {!searchedChannels.chats_groups.length && !searchedChannels.channels.length && (
                  <NoResults color={textSecondary}>No channels found</NoResults>
                )}
              </React.Fragment>
            ) : (
              channels.map((channel: IChannel) => {
                const isDirectChannel = channel.type === DEFAULT_CHANNEL_TYPE.DIRECT
                const isSelfChannel =
                  isDirectChannel &&
                  channel.memberCount === 1 &&
                  channel.members.length > 0 &&
                  channel.members[0].id === user.id
                const directChannelUser =
                  isDirectChannel && isSelfChannel
                    ? user
                    : channel.members.find((member: IMember) => member.id !== user.id)
                const isSelected = selectedChannels.findIndex((chan) => chan.id === channel.id) >= 0
                return (
                  <ChannelItemWrapper key={channel.id}>
                    {warningChannelId === channel.id && selectedChannels.length >= maxSelectedCount && (
                      <WarningTooltip color={textOnPrimary} backgroundColor={tooltipBackground}>
                        {`You can select up to ${maxSelectedCount} conversation${
                          maxSelectedCount === 1 ? '' : 's'
                        }. To add more, remove an existing one.`}
                      </WarningTooltip>
                    )}
                    <ChannelItem
                      onClick={() => handleChannelSelect(!isSelected, channel)}
                      disabled={selectedChannels.length >= maxSelectedCount && !isSelected}
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
                        <ChannelMembersItem
                          channel={channel}
                          directChannelUser={directChannelUser}
                          isDirectChannel={isDirectChannel}
                        />
                      </ChannelInfo>
                      <CustomCheckbox
                        borderColor={iconInactive}
                        index={channel.id}
                        disabled={selectedChannels.length >= maxSelectedCount && !isSelected}
                        state={isSelected}
                        onClick={(e) => {
                          e.stopPropagation()
                        }}
                        size='18px'
                        backgroundColor={'transparent'}
                        checkedBackgroundColor={accentColor}
                      />
                    </ChannelItem>
                  </ChannelItemWrapper>
                )
              })
            )}
          </ForwardChannelsCont>
          {!!selectedChannels.length && (
            <ForwardNoteContainer ref={noteContainerRef} borderColor={iconInactive} $theme={theme}>
              {!!firstForwardMessage && (
                <React.Fragment>
                  <ForwardPreviewRow>
                    {firstForwardAttachment &&
                    (firstForwardAttachment.type === attachmentTypes.image ||
                      firstForwardAttachment.type === attachmentTypes.video) ? (
                      <Attachment attachment={firstForwardAttachment} backgroundColor={surface1} isRepliedMessage />
                    ) : firstForwardAttachment?.type === attachmentTypes.link ? (
                      forwardLinkPreviewImage &&
                      !shouldShowLinkPreviewErrorFallback(forwardLinkPreviewImage, forwardLinkPreviewImageFailed) ? (
                        <ForwardLinkPreviewImage
                          src={forwardLinkPreviewImage}
                          alt='Link preview'
                          onError={() => setForwardLinkPreviewImageFailed(true)}
                        />
                      ) : (
                        <ForwardLinkPreviewIconWrapper backgroundColor={surface1}>
                          <ForwardLinkPreviewIcon color={accentColor} bg={surface1} />
                        </ForwardLinkPreviewIconWrapper>
                      )
                    ) : firstForwardAttachment ? (
                      <ForwardPreviewIconWrapper backgroundColor={accentColor} iconColor={textOnPrimary}>
                        <ChooseFileIcon />
                      </ForwardPreviewIconWrapper>
                    ) : null}
                    <ForwardPreviewInfo>
                      <ForwardPreviewTitle color={accentColor}>
                        <ForwardIcon />
                        Forwarded message
                      </ForwardPreviewTitle>
                      <ForwardPreviewLabel color={textPrimary}>
                        {forwardPreviewLabel}
                        {forwardMoreCount > 0 && (
                          <ForwardPreviewMoreCount color={textSecondary}>
                            {` +${forwardMoreCount} more`}
                          </ForwardPreviewMoreCount>
                        )}
                      </ForwardPreviewLabel>
                    </ForwardPreviewInfo>
                  </ForwardPreviewRow>
                  <ForwardPreviewDivider color={border} />
                </React.Fragment>
              )}
              <ForwardNoteInputRow>
                <ForwardNoteInputWrapper>
                  <ForwardNoteInput
                    id='forward-message-note'
                    ref={noteInputRef}
                    color={textPrimary}
                    value={noteText}
                    maxLength={maxNoteLength}
                    onChange={handleNoteChange}
                    onKeyDown={handleNoteKeyDown}
                    onBlur={() => window.setTimeout(() => setMentionQuery(null), 150)}
                    placeholder='Write a message'
                    className={isNoteScrolling ? 'show-scrollbar' : ''}
                    onMouseEnter={() => setIsNoteScrolling(true)}
                    onMouseLeave={() => setIsNoteScrolling(false)}
                    thumbColor={surface2}
                  />
                  {mentionQuery && visibleMentionCandidates.length > 0 && (
                    <ForwardMentionList backgroundColor={background} borderColor={tooltipBackground}>
                      {visibleMentionCandidates.map((member) => {
                        const displayName = makeUsername(contactsMap[member.id], member, getFromContacts)
                        return (
                          <ForwardMentionOption
                            key={member.id}
                            type='button'
                            onMouseDown={(event: React.MouseEvent<HTMLButtonElement>) => event.preventDefault()}
                            onClick={() => insertMention(member)}
                            color={textPrimary}
                          >
                            <Avatar
                              name={displayName}
                              image={member.avatarUrl || ''}
                              size={28}
                              textSize={11}
                              setDefaultAvatar
                            />
                            {displayName}
                          </ForwardMentionOption>
                        )
                      })}
                    </ForwardMentionList>
                  )}
                </ForwardNoteInputWrapper>
                <SendNoteButton
                  type='button'
                  iconColor={accentColor}
                  disabled={!selectedChannels.length}
                  onClick={handleForwardMessage}
                  aria-label='Forward'
                >
                  <SendIcon />
                </SendNoteButton>
              </ForwardNoteInputRow>
            </ForwardNoteContainer>
          )}
        </PopupBody>
      </Popup>
    </PopupContainer>
  )
}

export default ForwardMessagePopup

const ForwardChannelsCont = styled.div<{
  selectedChannelsHeight: number
  thumbColor: string
  /** Measured height of ForwardNoteContainer — varies with the note preview and the auto-growing textarea. */
  noteContainerHeight: number
}>`
  overflow-y: auto;
  margin-top: 16px;
  max-height: ${(props) =>
    `calc(100% - ${
      props.selectedChannelsHeight + (props.noteContainerHeight ? props.noteContainerHeight - 4 : -8)
    }px)`};
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
  overscroll-behavior: none;

  @supports (overflow: overlay) {
    overflow-y: overlay;
  }

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

  &.show-scrollbar {
    scrollbar-color: ${(props) => props.thumbColor} transparent;
  }
`

const ForwardNoteContainer = styled.div<{ borderColor: string; $theme: ThemeMode }>`
  position: relative;
  z-index: 1;
  margin-top: 16px;
  box-shadow: ${(props) =>
    props.$theme === 'dark' ? 'rgb(0 0 0 / 73%) 0px 0px 24px 0px' : '0px 0px 24px 0px #11153929'};
  border-radius: 12px;
  box-sizing: border-box;
`

const ForwardPreviewRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
`

const ForwardPreviewIconWrapper = styled.span<{ backgroundColor: string; iconColor: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: ${(props) => props.backgroundColor};

  & > svg {
    width: 18px;
    height: 18px;
    color: ${(props) => props.iconColor};
  }
`

const ForwardLinkPreviewImage = styled.img`
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
`

const ForwardLinkPreviewIconWrapper = styled.div<{ backgroundColor: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 4px;
  background-color: ${(props) => props.backgroundColor};
`

const ForwardLinkPreviewIcon = styled(LinkIcon)<{ color: string; bg: string }>`
  color: ${(props) => props.color};
  rect {
    fill: ${(props) => props.bg};
    fill-opacity: 1;
  }
`

const ForwardPreviewInfo = styled.div`
  min-width: 0;
  overflow: hidden;
`

const ForwardPreviewTitle = styled.h4<{ color: string }>`
  display: flex;
  align-items: center;
  margin: 0 0 2px;
  font-weight: 400;
  font-size: 13px;
  line-height: 16px;
  color: ${(props) => props.color};

  > svg {
    margin-right: 4px;
    width: 14px;
    height: 14px;
  }
`

const ForwardPreviewLabel = styled.div<{ color: string }>`
  font-weight: 500;
  font-size: 14px;
  line-height: 18px;
  color: ${(props) => props.color};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const ForwardPreviewMoreCount = styled.span<{ color: string }>`
  font-weight: 400;
  color: ${(props) => props.color};
`

const ForwardPreviewDivider = styled.div<{ color: string }>`
  height: 1px;
  background-color: ${(props) => props.color};
  opacity: 0.5;
`

const ForwardNoteInputRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
`

const ForwardNoteInputWrapper = styled.div`
  position: relative;
  flex: 1;
  min-width: 0;
`

const ForwardNoteInput = styled.textarea<{ color: string; thumbColor: string }>`
  display: block;
  width: 100%;
  height: ${NOTE_INPUT_MIN_HEIGHT}px;
  max-height: ${NOTE_INPUT_MAX_HEIGHT}px;
  box-sizing: border-box;
  resize: none;
  overflow-y: auto;
  border: 0;
  outline: none;
  background: transparent;
  padding: 0;
  color: ${(props) => props.color};
  font: inherit;
  line-height: ${NOTE_INPUT_LINE_HEIGHT}px;
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
  overscroll-behavior: none;

  &::placeholder {
    color: #7c899b;
  }

  &::-webkit-scrollbar {
    width: 6px;
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

  &.show-scrollbar {
    scrollbar-color: ${(props) => props.thumbColor} transparent;
  }
`

const SendNoteButton = styled.button<{ iconColor: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: ${(props) => props.iconColor};
  transform: translateX(-1px);
  margin-top: auto;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
  padding: 0;

  &:disabled {
    opacity: 0.4;
    cursor: none;
  }

  & > svg {
    color: ${(props) => props.iconColor};
  }
`

const ForwardMentionList = styled.div<{ backgroundColor: string; borderColor: string }>`
  position: absolute;
  z-index: 10;
  bottom: calc(100% + 4px);
  left: 0;
  width: 280px;
  max-height: 180px;
  overflow-y: auto;
  background: ${(props) => props.backgroundColor};
  border: 1px solid ${(props) => props.borderColor};
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
`

const ForwardMentionOption = styled.button<{ color: string }>`
  display: flex;
  align-items: center;
  width: 100%;
  gap: 8px;
  padding: 8px 10px;
  border: 0;
  background: transparent;
  color: ${(props) => props.color};
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: rgba(127, 127, 127, 0.12);
  }
`

const ChannelItem = styled.div<{ backgroundHover?: string; disabled?: boolean }>`
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 8px;
  position: relative;

  ${({ disabled, backgroundHover }) =>
    disabled
      ? `
    cursor: not-allowed;
    opacity: 0.5;
  `
      : `  &:hover {
    background-color: ${backgroundHover};
  }`}
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

const NoResults = styled.div`
  font-size: 15px;
  line-height: 16px;
  font-weight: 500;
  text-align: center;
  margin-top: 20px;
  color: ${(props) => props.color};
`

const ChannelItemWrapper = styled.div`
  position: relative;
`

const WarningTooltip = styled.div<{ color: string; backgroundColor: string }>`
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: ${(props) => props.backgroundColor};
  color: ${(props) => props.color};
  font-size: 13px;
  line-height: 18px;
  font-weight: 400;
  padding: 10px 14px;
  border-radius: 8px;
  text-align: center;
  margin-top: 8px;
  pointer-events: none;
  z-index: 10;

  &::after {
    content: '';
    position: absolute;
    bottom: -7px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-top: 8px solid ${(props) => props.backgroundColor};
  }
`
