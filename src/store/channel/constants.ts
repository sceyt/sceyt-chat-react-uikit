export const CREATE_CHANNEL = 'CREATE_CHANNEL'
export const GET_CHANNELS = 'GET_CHANNELS'
export const GET_CHANNELS_FOR_FORWARD = 'GET_CHANNELS_FOR_FORWARD'
export const LOAD_MORE_CHANNEL = 'LOAD_MORE_CHANNEL'
export const LOAD_MORE_CHANNELS_FOR_FORWARD = 'LOAD_MORE_CHANNELS_FOR_FORWARD'
export const ADD_CHANNEL = 'ADD_CHANNEL'
export const ADD_CHANNELS = 'ADD_CHANNELS'
export const ADD_CHANNELS_FOR_FORWARD = 'ADD_CHANNELS_FOR_FORWARD'
export const SET_CHANNELS = 'SET_CHANNELS'
export const SET_CHANNELS_FOR_FORWARD = 'SET_CHANNELS_FOR_FORWARD'
export const DELETE_CHANNEL = 'DELETE_CHANNEL'
export const BLOCK_CHANNEL = 'BLOCK_CHANNEL'
export const SET_CHANNELS_LOADING_STATE = 'SET_CHANNELS_LOADING_STATE'
export const CHANNELS_HAS_NEXT = 'CHANNELS_HAS_NEXT'
export const SWITCH_CHANNEL = 'SWITCH_CHANNEL'
export const SET_ACTIVE_CHANNEL = 'SET_ACTIVE_CHANNEL'
export const UPDATE_CHANNEL = 'UPDATE_CHANNEL'
export const UPDATE_CHANNEL_DATA = 'UPDATE_CHANNEL_DATA'
export const REMOVE_CHANNEL = 'REMOVE_CHANNEL'
export const REMOVE_CHANNEL_CACHES = 'REMOVE_CHANNEL_CACHES'
export const UPDATE_CHANNEL_LAST_MESSAGE = 'UPDATE_CHANNEL_LAST_MESSAGE'
export const UPDATE_CHANNEL_LAST_MESSAGE_STATUS = 'UPDATE_CHANNEL_LAST_MESSAGE_STATUS'
export const MARK_MESSAGES_AS_READ = 'MARK_MESSAGES_AS_READ'
export const MARK_MESSAGES_AS_DELIVERED = 'MARK_MESSAGES_AS_DELIVERED'
export const SEND_TYPING = 'SEND_TYPING'
export const SWITCH_TYPING_INDICATOR = 'SWITCH_TYPING_INDICATOR'
export const JOIN_TO_CHANNEL = 'JOIN_TO_CHANNEL'
export const SET_IS_DRAGGING = 'SET_IS_DRAGGING'
export const SET_DRAGGED_ATTACHMENTS = 'SET_DRAGGED_ATTACHMENTS'
export const WATCH_FOR_EVENTS = 'WATCH_FOR_EVENTS'
export const SET_CHANNEL_TO_REMOVE = 'SET_CHANNEL_TO_REMOVE'
export const SET_CHANNEL_TO_ADD = 'SET_CHANNEL_TO_ADD'
export const SET_ADDED_TO_CHANNEL = 'SET_ADDED_TO_CHANNEL'
export const SET_CHANNEL_TO_HIDE = 'SET_CHANNEL_TO_HIDE'
export const SET_CHANNEL_TO_UNHIDE = 'SET_CHANNEL_TO_UNHIDE'
export const TURN_OFF_NOTIFICATION = 'TURN_OFF_NOTIFICATION'
export const TURN_ON_NOTIFICATION = 'TURN_ON_NOTIFICATION'
export const MARK_CHANNEL_AS_READ = 'MARK_CHANNEL_AS_READ'
export const MARK_CHANNEL_AS_UNREAD = 'MARK_CHANNEL_AS_UNREAD'
export const CHANNEL_INFO_OPEN_CLOSE = 'CHANNEL_INFO_OPEN_CLOSE'
export const LEAVE_CHANNEL = 'LEAVE_CHANNEL'
export const TOGGLE_EDIT_CHANNEL = 'TOGGLE_EDIT_CHANNEL'
export const UPDATE_USER_STATUS_ON_CHANNEL = 'UPDATE_USER_STATUS_ON_CHANNEL'
export const SET_CHANNEL_LIST_WIDTH = 'SET_CHANNEL_LIST_WIDTH'
export const CLEAR_HISTORY = 'CLEAR_HISTORY'
export const DELETE_ALL_MESSAGES = 'DELETE_ALL_MESSAGES'

export const DESTROY_SESSION = 'DESTROY_SESSION'

export const SET_TAB_IS_ACTIVE = 'SET_TAB_IS_ACTIVE'
export const SET_HIDE_CHANNEL_LIST = 'SET_HIDE_CHANNEL_LIST'

export const DRAFT_IS_REMOVED = 'DRAFT_IS_REMOVED'

export const CHANNEL_EVENT_TYPES = {
  CREATE: 'CREATE',
  JOIN: 'JOIN',
  LEAVE: 'LEAVE',
  BLOCK: 'BLOCK',
  UNBLOCK: 'UNBLOCK',
  ADD_MEMBERS: 'ADD_MEMBERS',
  KICK_MEMBERS: 'KICK_MEMBERS',
  BLOCK_MEMBERS: 'BLOCK_MEMBERS',
  UPDATE_CHANNEL: 'UPDATE_CHANNEL',
  MESSAGE: 'MESSAGE',
  DELETE: 'DELETE',
  DELETE_MESSAGE: 'DELETE_MESSAGE',
  REACTION_ADDED: 'REACTION_ADDED',
  REACTION_DELETED: 'REACTION_DELETED',
  EDIT_MESSAGE: 'EDIT_MESSAGE',
  START_TYPING: 'START_TYPING',
  STOP_TYPING: 'STOP_TYPING',
  MESSAGE_MARKERS_RECEIVED: 'MESSAGE_MARKERS_RECEIVED',
  UNREAD_MESSAGES_INFO: 'UNREAD_MESSAGES_INFO',
  HIDE: 'HIDE',
  UNHIDE: 'UNHIDE',
  MUTE: 'MUTE',
  UNMUTE: 'UNMUTE',
  CHANNEL_MARKED_AS_UNREAD: 'CHANNEL_MARKED_AS_UNREAD',
  CHANNEL_MARKED_AS_READ: 'CHANNEL_MARKED_AS_READ',
  CLEAR_HISTORY: 'CLEAR_HISTORY',
  CHANGE_ROLE: 'CHANGE_ROLE',
  CHANGE_OWNER: 'CHANGE_OWNER',
  MEMBER_BLOCKED: 'MEMBER_BLOCKED',
  MEMBER_UNBLOCKED: 'MEMBER_UNBLOCKED'
}
