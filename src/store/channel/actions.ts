// Import Redux Toolkit actions from the slice
import {
  setChannels,
  setSearchedChannels,
  setSearchedChannelsForForward,
  setCloseSearchChannels,
  setChannelsForForward,
  addChannel,
  addChannels,
  addChannelsForForward,
  removeChannel,
  setChannelToAdd,
  setAddedToChannel,
  setChannelToRemove,
  setChannelToHide,
  setChannelToUnhide,
  setChannelsLoadingState,
  setChannelsHasNext,
  setActiveChannel,
  updateChannelData,
  updateSearchedChannelData,
  updateUserStatusOnChannel,
  updateChannelLastMessage,
  updateChannelLastMessageStatus,
  setChannelInfoOpenClose,
  toggleEditChannel,
  switchTypingIndicator,
  switchRecordingIndicator,
  setIsDragging,
  setDraggedAttachments,
  setChannelListWidth,
  setTabIsActive,
  setHideChannelList,
  setDraftIsRemoved,
  setChannelInviteKeys,
  setJoinableChannel
} from './reducers'

// Import saga action constants
import {
  BLOCK_CHANNEL,
  CLEAR_HISTORY,
  CREATE_CHANNEL,
  DELETE_ALL_MESSAGES,
  DELETE_CHANNEL,
  DESTROY_SESSION,
  GET_CHANNELS,
  GET_CHANNELS_FOR_FORWARD,
  JOIN_TO_CHANNEL,
  LEAVE_CHANNEL,
  LOAD_MORE_CHANNEL,
  LOAD_MORE_CHANNELS_FOR_FORWARD,
  MARK_CHANNEL_AS_READ,
  MARK_CHANNEL_AS_UNREAD,
  MARK_MESSAGES_AS_DELIVERED,
  MARK_MESSAGES_AS_READ,
  MARK_VOICE_MESSAGE_AS_PLAYED,
  PIN_CHANNEL,
  UNPIN_CHANNEL,
  REMOVE_CHANNEL_CACHES,
  SEARCH_CHANNELS,
  SEARCH_CHANNELS_FOR_FORWARD,
  SEND_TYPING,
  SEND_RECORDING,
  SWITCH_CHANNEL,
  TURN_OFF_NOTIFICATION,
  TURN_ON_NOTIFICATION,
  UPDATE_CHANNEL,
  WATCH_FOR_EVENTS,
  GET_CHANNEL_MENTIONS,
  CREATE_CHANNEL_INVITE_KEY,
  GET_CHANNEL_INVITE_KEYS,
  REGENERATE_CHANNEL_INVITE_KEY,
  UPDATE_CHANNEL_INVITE_KEY,
  GET_CHANNEL_BY_INVITE_KEY
} from './constants'

import { ChannelQueryParams, IChannel, IContact, IContactsMap, ICreateChannel, IMessage, IUser } from '../../types'

// Action creators that now use Redux Toolkit actions
export const createChannelAC = (
  channelData: ICreateChannel,
  dontCreateIfNotExists?: boolean,
  callback?: (channel: IChannel) => void
) => ({
  type: CREATE_CHANNEL,
  payload: { channelData, dontCreateIfNotExists, callback }
})

export const getChannelByInviteKeyAC = (key: string) => ({
  type: GET_CHANNEL_BY_INVITE_KEY,
  payload: { key }
})

export const getChannelsAC = (params: ChannelQueryParams, isJoinChannel?: boolean) => ({
  type: GET_CHANNELS,
  payload: { params, isJoinChannel }
})

export const loadMoreChannels = (limit?: number) => ({
  type: LOAD_MORE_CHANNEL,
  payload: { limit }
})

export const searchChannelsAC = (params: ChannelQueryParams, contactsMap: IContactsMap) => ({
  type: SEARCH_CHANNELS,
  payload: { params, contactsMap }
})

export const setSearchedChannelsAC = (searchedChannels: {
  chats_groups: IChannel[]
  channels: IChannel[]
  contacts: IContact[]
}) => setSearchedChannels({ searchedChannels })

export const setCloseSearchChannelsAC = (close: boolean) => setCloseSearchChannels({ close })

export const getChannelsForForwardAC = (searchValue?: string) => ({
  type: GET_CHANNELS_FOR_FORWARD,
  payload: { searchValue }
})

export const addChannelsForForwardAC = (channels: IChannel[]) => addChannelsForForward({ channels })

export const setChannelsForForwardAC = (channels: IChannel[]) => setChannelsForForward({ channels })

export const setChannelsLoadingStateAC = (state: number, forForward?: boolean) =>
  setChannelsLoadingState({ state, forForward })

export const channelHasNextAC = (hasNext: boolean, forForward?: boolean) => setChannelsHasNext({ hasNext, forForward })

export const loadMoreChannelsForForward = (limit?: number) => ({
  type: LOAD_MORE_CHANNELS_FOR_FORWARD,
  payload: { limit }
})

export const searchChannelsForForwardAC = (params: ChannelQueryParams, contactsMap: IContactsMap) => ({
  type: SEARCH_CHANNELS_FOR_FORWARD,
  payload: { params, contactsMap }
})

export const setSearchedChannelsForForwardAC = (searchedChannels: {
  chats_groups: IChannel[]
  channels: IChannel[]
  contacts: IContact[]
}) => setSearchedChannelsForForward({ searchedChannels })

export const addChannelAC = (channel: IChannel) => addChannel({ channel })

export const addChannelsAC = (channels: IChannel[]) => addChannels({ channels })

export const deleteChannelAC = (channelId: string) => ({
  type: DELETE_CHANNEL,
  payload: { channelId }
})

export const blockChannelAC = (channelId: string) => ({
  type: BLOCK_CHANNEL,
  payload: { channelId }
})

export const removeChannelAC = (channelId: string) => removeChannel({ channelId })

export const removeChannelCachesAC = (channelId: string) => ({
  type: REMOVE_CHANNEL_CACHES,
  payload: { channelId }
})

export const setChannelToAddAC = (channel: IChannel | null) => setChannelToAdd({ channel })

export const setAddedToChannelAC = (channel: IChannel | null) => setAddedToChannel({ channel })

export const setChannelToRemoveAC = (channel: IChannel | null) => setChannelToRemove({ channel })

export const setChannelToHideAC = (channel: IChannel | null) => setChannelToHide({ channel })

export const setChannelToUnHideAC = (channel: IChannel | null) => setChannelToUnhide({ channel })

export const setChannelsAC = (channels: IChannel[]) => setChannels({ channels })

export const setActiveChannelAC = (channel: IChannel | {}) => setActiveChannel({ channel })

export const switchChannelActionAC = (channel: IChannel | null, updateActiveChannel = true) => ({
  type: SWITCH_CHANNEL,
  payload: { channel, updateActiveChannel }
})

export const updateChannelAC = (channelId: string, config: any) => ({
  type: UPDATE_CHANNEL,
  payload: { channelId, config }
})

export const updateChannelDataAC = (channelId: string, config: any, moveUp?: boolean, sort?: boolean) =>
  updateChannelData({ config, channelId, moveUp, sort })

export const updateSearchedChannelDataAC = (channelId: string, config: any, groupName: string) =>
  updateSearchedChannelData({ updateData: config, groupName, channelId })

export const updateChannelLastMessageAC = (message: IMessage | {}, channel: IChannel) =>
  updateChannelLastMessage({ message, channel })

export const updateChannelLastMessageStatusAC = (message: IMessage, channel: IChannel) =>
  updateChannelLastMessageStatus({ message, channel })

export const markMessagesAsReadAC = (channelId: string, messageIds: string[]) => ({
  type: MARK_MESSAGES_AS_READ,
  payload: { channelId, messageIds }
})

export const markMessagesAsDeliveredAC = (channelId: string, messageIds: string[]) => ({
  type: MARK_MESSAGES_AS_DELIVERED,
  payload: { channelId, messageIds }
})

export const markVoiceMessageAsPlayedAC = (channelId: string, messageIds: string[]) => ({
  type: MARK_VOICE_MESSAGE_AS_PLAYED,
  payload: { channelId, messageIds }
})

export const sendTypingAC = (state: boolean) => ({
  type: SEND_TYPING,
  payload: { state }
})

export const sendRecordingAC = (state: boolean, channelId: string) => ({
  type: SEND_RECORDING,
  payload: { state, channelId }
})

export const switchTypingIndicatorAC = (typingState: boolean, channelId: string, from?: IUser) =>
  switchTypingIndicator({ typingState, channelId, from: from! })

export const switchRecordingIndicatorAC = (recordingState: boolean, channelId: string, from?: IUser) =>
  switchRecordingIndicator({ recordingState, channelId, from: from! })

export const turnOffNotificationsAC = (expireTime?: number) => ({
  type: TURN_OFF_NOTIFICATION,
  payload: { expireTime }
})

export const turnOnNotificationsAC = () => ({
  type: TURN_ON_NOTIFICATION
})

export const markChannelAsReadAC = (channelId: string) => ({
  type: MARK_CHANNEL_AS_READ,
  payload: { channelId }
})

export const markChannelAsUnReadAC = (channelId: string) => ({
  type: MARK_CHANNEL_AS_UNREAD,
  payload: { channelId }
})

export const pinChannelAC = (channelId: string) => ({
  type: PIN_CHANNEL,
  payload: { channelId }
})

export const unpinChannelAC = (channelId: string) => ({
  type: UNPIN_CHANNEL,
  payload: { channelId }
})

export const switchChannelInfoAC = (open: boolean) => setChannelInfoOpenClose({ open })

export const leaveChannelAC = (channelId: string) => ({
  type: LEAVE_CHANNEL,
  payload: { channelId }
})

export const toggleEditChannelAC = (state: boolean) => toggleEditChannel({ state })

export const updateUserStatusOnChannelAC = (usersMap: { [key: string]: IUser }) =>
  updateUserStatusOnChannel({ usersMap })

export const setChannelListWithAC = (width: number) => setChannelListWidth({ width })

export const setJoinableChannelAC = (channel: IChannel) => setJoinableChannel({ channel })

export const clearHistoryAC = (channelId: string) => ({
  type: CLEAR_HISTORY,
  payload: { channelId }
})

export const deleteAllMessagesAC = (channelId: string) => ({
  type: DELETE_ALL_MESSAGES,
  payload: { channelId }
})

export const joinChannelAC = (channelId: string) => ({
  type: JOIN_TO_CHANNEL,
  payload: { channelId }
})

export const setIsDraggingAC = (isDragging: boolean) => setIsDragging({ isDragging })

export const setDraggedAttachmentsAC = (attachments: File[], type: string) =>
  setDraggedAttachments({ attachments, type })

export const setTabIsActiveAC = (isActive: boolean) => setTabIsActive({ isActive })

export const setHideChannelListAC = (hide: boolean) => setHideChannelList({ hide })

export const setChannelDraftMessageIsRemovedAC = (channelId?: string) =>
  setDraftIsRemoved({ channelId: channelId || '' })

export const watchForEventsAC = () => ({
  type: WATCH_FOR_EVENTS
})

export const destroySession = () => ({
  type: DESTROY_SESSION
})

export const getChannelMentionsAC = (channelId: string) => ({
  type: GET_CHANNEL_MENTIONS,
  payload: { channelId }
})

export const createChannelInviteKeyAC = (
  channelId: string,
  accessPriorHistory: boolean = true,
  expiresAt: number = 0,
  maxUses: number = 0
) => ({
  type: CREATE_CHANNEL_INVITE_KEY,
  payload: { channelId, accessPriorHistory, expiresAt, maxUses }
})

export const setChannelInviteKeysAC = (
  channelId: string,
  inviteKeys: {
    key: string
    maxUses: number
    expiresAt: number
    accessPriorHistory: boolean
  }[]
) => setChannelInviteKeys({ channelId, inviteKeys })

export const getChannelInviteKeysAC = (channelId: string) => ({
  type: GET_CHANNEL_INVITE_KEYS,
  payload: { channelId }
})

export const regenerateChannelInviteKeyAC = (channelId: string, key: string) => ({
  type: REGENERATE_CHANNEL_INVITE_KEY,
  payload: { channelId, key }
})

export const updateChannelInviteKeyAC = (
  channelId: string,
  key: string,
  accessPriorHistory: boolean,
  expiresAt: number = 0,
  maxUses: number = 0
) => ({
  type: UPDATE_CHANNEL_INVITE_KEY,
  payload: { channelId, key, accessPriorHistory, expiresAt, maxUses }
})
