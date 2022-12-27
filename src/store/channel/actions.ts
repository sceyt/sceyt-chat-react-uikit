import {
  ADD_CHANNEL,
  ADD_CHANNELS,
  BLOCK_CHANNEL,
  CHANNEL_INFO_OPEN_CLOSE,
  CHANNELS_HAS_NEXT,
  CHECK_USER_STATUS,
  CREATE_CHANNEL,
  DELETE_CHANNEL,
  DESTROY_SESSION,
  GET_CHANNELS,
  LEAVE_CHANNEL,
  LOAD_MORE_CHANNEL,
  MARK_CHANNEL_AS_READ,
  MARK_CHANNEL_AS_UNREAD,
  MARK_MESSAGES_AS_DELIVERED,
  MARK_MESSAGES_AS_READ,
  REMOVE_CHANNEL,
  SEND_TYPING,
  SET_ACTIVE_CHANNEL,
  SET_ADDED_TO_CHANNEL,
  SET_CHANNEL_LIST_WIDTH,
  SET_CHANNEL_TO_ADD,
  SET_CHANNEL_TO_HIDE,
  SET_CHANNEL_TO_REMOVE,
  SET_CHANNEL_TO_UNHIDE,
  SET_CHANNELS,
  SET_CHANNELS_LOADING_STATE,
  SWITCH_CHANNEL,
  SWITCH_TYPING_INDICATOR,
  TOGGLE_EDIT_CHANNEL,
  TURN_OFF_NOTIFICATION,
  TURN_ON_NOTIFICATION,
  UPDATE_CHANNEL,
  UPDATE_CHANNEL_DATA,
  UPDATE_CHANNEL_LAST_MESSAGE,
  UPDATE_CHANNEL_LAST_MESSAGE_STATUS,
  UPDATE_USER_STATUS_ON_CHANNEL,
  WATCH_FOR_EVENTS
} from './constants'
import { ChannelQueryParams } from '../../components/Channel/types'
import { IChannel, ICreateChannel, IMessage, IUser } from '../../types'

export function createChannelAC(channelData: ICreateChannel) {
  return {
    type: CREATE_CHANNEL,
    payload: { channelData }
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

export function setChannelsLoadingStateAC(state: number) {
  return {
    type: SET_CHANNELS_LOADING_STATE,
    payload: { state }
  }
}

export function channelHasNextAC(bool: boolean) {
  return {
    type: CHANNELS_HAS_NEXT,
    payload: { bool }
  }
}

export function setActiveChannelAC(channel: IChannel) {
  return {
    type: SET_ACTIVE_CHANNEL,
    payload: { channel }
  }
}

export function switchChannelActionAC(channel: IChannel) {
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

export function updateChannelDataAC(channelId: string, config: any) {
  return {
    type: UPDATE_CHANNEL_DATA,
    payload: {
      channelId,
      config
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

export function switchTypingIndicatorAC(typingState: boolean, from?: IUser) {
  return {
    type: SWITCH_TYPING_INDICATOR,
    payload: { typingState, from }
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

export function checkUserStatusAC(usersMap: { [key: string]: string }) {
  return {
    type: CHECK_USER_STATUS,
    payload: {
      usersMap
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
