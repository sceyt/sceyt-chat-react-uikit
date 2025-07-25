import {
  ADD_CHANNEL,
  ADD_CHANNELS,
  ADD_CHANNELS_FOR_FORWARD,
  BLOCK_CHANNEL,
  CHANNEL_INFO_OPEN_CLOSE,
  CHANNELS_HAS_NEXT,
  CLEAR_HISTORY,
  CREATE_CHANNEL,
  DELETE_ALL_MESSAGES,
  DELETE_CHANNEL,
  DESTROY_SESSION,
  DRAFT_IS_REMOVED,
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
  PIN_CHANNEL,
  UNPIN_CHANNEL,
  REMOVE_CHANNEL,
  REMOVE_CHANNEL_CACHES,
  SEARCH_CHANNELS,
  SEARCH_CHANNELS_FOR_FORWARD,
  SEND_TYPING,
  SEND_RECORDING,
  SET_ACTIVE_CHANNEL,
  SET_ADDED_TO_CHANNEL,
  SET_CHANNEL_LIST_WIDTH,
  SET_CHANNEL_TO_ADD,
  SET_CHANNEL_TO_HIDE,
  SET_CHANNEL_TO_REMOVE,
  SET_CHANNEL_TO_UNHIDE,
  SET_CHANNELS,
  SET_CHANNELS_FOR_FORWARD,
  SET_CHANNELS_LOADING_STATE,
  SET_CLOSE_SEARCH_CHANNELS,
  SET_DRAGGED_ATTACHMENTS,
  SET_HIDE_CHANNEL_LIST,
  SET_IS_DRAGGING,
  SET_SEARCHED_CHANNELS,
  SET_SEARCHED_CHANNELS_FOR_FORWARD,
  SET_TAB_IS_ACTIVE,
  SWITCH_CHANNEL,
  SWITCH_TYPING_INDICATOR,
  TOGGLE_EDIT_CHANNEL,
  TURN_OFF_NOTIFICATION,
  TURN_ON_NOTIFICATION,
  UPDATE_CHANNEL,
  UPDATE_CHANNEL_DATA,
  UPDATE_CHANNEL_LAST_MESSAGE,
  UPDATE_CHANNEL_LAST_MESSAGE_STATUS,
  UPDATE_SEARCHED_CHANNEL_DATA,
  UPDATE_USER_STATUS_ON_CHANNEL,
  WATCH_FOR_EVENTS,
  SWITCH_RECORDING_INDICATOR
} from './constants'
import { ChannelQueryParams, IChannel, IContact, IContactsMap, ICreateChannel, IMessage, IUser } from '../../types'

export function createChannelAC(channelData: ICreateChannel, dontCreateIfNotExists?: boolean) {
  return {
    type: CREATE_CHANNEL,
    payload: { channelData, dontCreateIfNotExists }
  }
}

export function getChannelsAC(params: ChannelQueryParams, isJoinChannel?: boolean) {
  return {
    type: GET_CHANNELS,
    payload: { params, isJoinChannel }
  }
}

export function loadMoreChannels(limit?: number) {
  return {
    type: LOAD_MORE_CHANNEL,
    payload: { limit }
  }
}

export function searchChannelsAC(params: ChannelQueryParams, contactsMap: IContactsMap) {
  return {
    type: SEARCH_CHANNELS,
    payload: { params, contactsMap }
  }
}

export function setSearchedChannelsAC(searchedChannels: {
  chats_groups: IChannel[]
  channels: IChannel[]
  contacts: IContact[]
}) {
  return {
    type: SET_SEARCHED_CHANNELS,
    payload: { searchedChannels }
  }
}
export function setCloseSearchChannelsAC(close: boolean) {
  return {
    type: SET_CLOSE_SEARCH_CHANNELS,
    payload: { close }
  }
}

export function getChannelsForForwardAC(searchValue?: string) {
  return {
    type: GET_CHANNELS_FOR_FORWARD,
    payload: { searchValue }
  }
}

export function addChannelsForForwardAC(channels: IChannel[]) {
  return {
    type: ADD_CHANNELS_FOR_FORWARD,
    payload: { channels }
  }
}

export function setChannelsForForwardAC(channels: IChannel[]) {
  return {
    type: SET_CHANNELS_FOR_FORWARD,
    payload: { channels }
  }
}

export function setChannelsLoadingStateAC(state: number, forForward?: boolean) {
  return {
    type: SET_CHANNELS_LOADING_STATE,
    payload: { state, forForward }
  }
}

export function channelHasNextAC(hasNext: boolean, forForward?: boolean) {
  return {
    type: CHANNELS_HAS_NEXT,
    payload: { hasNext, forForward }
  }
}
export function loadMoreChannelsForForward(limit?: number) {
  return {
    type: LOAD_MORE_CHANNELS_FOR_FORWARD,
    payload: { limit }
  }
}

export function searchChannelsForForwardAC(params: ChannelQueryParams, contactsMap: IContactsMap) {
  return {
    type: SEARCH_CHANNELS_FOR_FORWARD,
    payload: { params, contactsMap }
  }
}

export function setSearchedChannelsForForwardAC(searchedChannels: {
  chats_groups: IChannel[]
  channels: IChannel[]
  contacts: IContact[]
}) {
  return {
    type: SET_SEARCHED_CHANNELS_FOR_FORWARD,
    payload: { searchedChannels }
  }
}

export function addChannelAC(channel: IChannel) {
  return {
    type: ADD_CHANNEL,
    payload: { channel }
  }
}

export function addChannelsAC(channels: IChannel[]) {
  return {
    type: ADD_CHANNELS,
    payload: { channels }
  }
}

export function deleteChannelAC(channelId: string) {
  return {
    type: DELETE_CHANNEL,
    payload: {
      channelId
    }
  }
}

export function blockChannelAC(channelId: string) {
  return {
    type: BLOCK_CHANNEL,
    payload: { channelId }
  }
}

export function removeChannelAC(channelId: string) {
  return {
    type: REMOVE_CHANNEL,
    payload: { channelId }
  }
}

export function removeChannelCachesAC(channelId: string) {
  return {
    type: REMOVE_CHANNEL_CACHES,
    payload: { channelId }
  }
}

export function setChannelToAddAC(channel: IChannel | null) {
  return {
    type: SET_CHANNEL_TO_ADD,
    payload: { channel }
  }
}

export function setAddedToChannelAC(channel: IChannel | null) {
  return {
    type: SET_ADDED_TO_CHANNEL,
    payload: { channel }
  }
}

export function setChannelToRemoveAC(channel: IChannel | null) {
  return {
    type: SET_CHANNEL_TO_REMOVE,
    payload: { channel }
  }
}

export function setChannelToHideAC(channel: IChannel | null) {
  return {
    type: SET_CHANNEL_TO_HIDE,
    payload: { channel }
  }
}

export function setChannelToUnHideAC(channel: IChannel | null) {
  return {
    type: SET_CHANNEL_TO_UNHIDE,
    payload: { channel }
  }
}

export function setChannelsAC(channels: IChannel[]) {
  return {
    type: SET_CHANNELS,
    payload: { channels }
  }
}

export function setActiveChannelAC(channel: IChannel | {}) {
  return {
    type: SET_ACTIVE_CHANNEL,
    payload: { channel }
  }
}

export function switchChannelActionAC(channel: IChannel | {}) {
  return {
    type: SWITCH_CHANNEL,
    payload: { channel }
  }
}

export function updateChannelAC(channelId: string, config: any) {
  return {
    type: UPDATE_CHANNEL,
    payload: {
      channelId,
      config
    }
  }
}

export function updateChannelDataAC(channelId: string, config: any, moveUp?: boolean, sort?: boolean) {
  return {
    type: UPDATE_CHANNEL_DATA,
    payload: {
      channelId,
      config,
      moveUp,
      sort
    }
  }
}

export function updateSearchedChannelDataAC(channelId: string, config: any, groupName: string) {
  return {
    type: UPDATE_SEARCHED_CHANNEL_DATA,
    payload: {
      channelId,
      updateData: config,
      groupName
    }
  }
}

export function updateChannelLastMessageAC(message: IMessage | {}, channel: IChannel) {
  return {
    type: UPDATE_CHANNEL_LAST_MESSAGE,
    payload: {
      message,
      channel
    }
  }
}

export function updateChannelLastMessageStatusAC(message: IMessage, channel: IChannel) {
  return {
    type: UPDATE_CHANNEL_LAST_MESSAGE_STATUS,
    payload: {
      message,
      channel
    }
  }
}

export function markMessagesAsReadAC(channelId: string, messageIds: string[]) {
  return {
    type: MARK_MESSAGES_AS_READ,
    payload: { channelId, messageIds }
  }
}

export function markMessagesAsDeliveredAC(channelId: string, messageIds: string[]) {
  return {
    type: MARK_MESSAGES_AS_DELIVERED,
    payload: { channelId, messageIds }
  }
}

export function sendTypingAC(state: boolean) {
  return {
    type: SEND_TYPING,
    payload: { state }
  }
}

export function sendRecordingAC(state: boolean) {
  return {
    type: SEND_RECORDING,
    payload: { state }
  }
}

export function switchTypingIndicatorAC(typingState: boolean, channelId: string, from?: IUser) {
  return {
    type: SWITCH_TYPING_INDICATOR,
    payload: { typingState, from, channelId }
  }
}

export function switchRecordingIndicatorAC(recordingState: boolean, channelId: string, from?: IUser) {
  return {
    type: SWITCH_RECORDING_INDICATOR,
    payload: { recordingState, from, channelId }
  }
}

export function turnOffNotificationsAC(expireTime?: number) {
  return {
    type: TURN_OFF_NOTIFICATION,
    payload: { expireTime }
  }
}

export function turnOnNotificationsAC() {
  return {
    type: TURN_ON_NOTIFICATION
  }
}

export function markChannelAsReadAC(channelId: string) {
  return {
    type: MARK_CHANNEL_AS_READ,
    payload: { channelId }
  }
}

export function markChannelAsUnReadAC(channelId: string) {
  return {
    type: MARK_CHANNEL_AS_UNREAD,
    payload: { channelId }
  }
}

export function pinChannelAC(channelId: string) {
  return {
    type: PIN_CHANNEL,
    payload: { channelId }
  }
}

export function unpinChannelAC(channelId: string) {
  return {
    type: UNPIN_CHANNEL,
    payload: { channelId }
  }
}

export function switchChannelInfoAC(open: boolean) {
  return {
    type: CHANNEL_INFO_OPEN_CLOSE,
    payload: { open }
  }
}

export function leaveChannelAC(channelId: string) {
  return {
    type: LEAVE_CHANNEL,
    payload: {
      channelId
    }
  }
}

export function toggleEditChannelAC(state: boolean) {
  return {
    type: TOGGLE_EDIT_CHANNEL,
    payload: {
      state
    }
  }
}

export function updateUserStatusOnChannelAC(usersMap: { [key: string]: IUser }) {
  return {
    type: UPDATE_USER_STATUS_ON_CHANNEL,
    payload: {
      usersMap
    }
  }
}

export function setChannelListWithAC(width: number) {
  return {
    type: SET_CHANNEL_LIST_WIDTH,
    payload: {
      width
    }
  }
}

export function clearHistoryAC(channelId: string) {
  return {
    type: CLEAR_HISTORY,
    payload: {
      channelId
    }
  }
}

export function deleteAllMessagesAC(channelId: string) {
  return {
    type: DELETE_ALL_MESSAGES,
    payload: {
      channelId
    }
  }
}

export function joinChannelAC(channelId: string) {
  return {
    type: JOIN_TO_CHANNEL,
    payload: {
      channelId
    }
  }
}

export function setIsDraggingAC(isDragging: boolean) {
  return {
    type: SET_IS_DRAGGING,
    payload: {
      isDragging
    }
  }
}

export function setDraggedAttachmentsAC(attachments: File[], type: string) {
  return {
    type: SET_DRAGGED_ATTACHMENTS,
    payload: {
      attachments,
      type
    }
  }
}
export function setTabIsActiveAC(isActive: boolean) {
  return {
    type: SET_TAB_IS_ACTIVE,
    payload: {
      isActive
    }
  }
}
export function setHideChannelListAC(hide: boolean) {
  return {
    type: SET_HIDE_CHANNEL_LIST,
    payload: {
      hide
    }
  }
}

export function setChannelDraftMessageIsRemovedAC(channelId?: string) {
  return {
    type: DRAFT_IS_REMOVED,
    payload: {
      channelId
    }
  }
}

export function watchForEventsAC() {
  return {
    type: WATCH_FOR_EVENTS
  }
}

export function destroySession() {
  return {
    type: DESTROY_SESSION
  }
}
