export const LOGIN_STATE = {
  FAILED_TO_LOGIN: 0,
  CONNECTING: 1,
  LOGGED_IN: 2,
  IS_NOT_LOGGED_IN: 3
}

export const MESSAGE_DELIVERY_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  DELIVERED: 'received',
  READ: 'displayed',
  PLAYED: 'played'
}

export const MESSAGE_STATUS = {
  UNMODIFIED: 'unmodified',
  EDIT: 'edited',
  DELETE: 'deleted',
  FAILED: 'failed'
}

export const UPLOAD_STATE = {
  UPLOADING: 'uploading',
  PAUSED: 'paused',
  SUCCESS: 'success',
  FAIL: 'fail'
}

export const LOADING_STATE = {
  LOADING: 1,
  LOADED: 2
}

export const DEFAULT_CHANNEL_TYPE = {
  GROUP: 'group',
  BROADCAST: 'broadcast',
  DIRECT: 'direct',
  PUBLIC: 'public',
  PRIVATE: 'private'
}

export const USER_PRESENCE_STATUS = {
  OFFLINE: 'offline',
  ONLINE: 'online'
}

export const USER_STATE = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  DELETED: 'deleted'
}

export const userSearchMethods = {
  ALL: 'all',
  FIRST_NAME: 'firstname',
  LAST_NAME: 'lastname',
  USERNAME: 'username'
}

export const userFilterOptionsTest: { name: string; option: string }[] = [
  {
    name: 'All',
    option: userSearchMethods.ALL
  },
  {
    name: 'Username',
    option: userSearchMethods.USERNAME
  },
  {
    name: 'First name',
    option: userSearchMethods.FIRST_NAME
  },
  {
    name: 'Last name',
    option: userSearchMethods.LAST_NAME
  }
]

export const attachmentTypes = {
  image: 'image',
  video: 'video',
  audio: 'audio',
  file: 'file',
  link: 'link',
  voice: 'voice'
}
export const channelDetailsTabs = {
  member: 'Members',
  media: 'Media',
  file: 'Files',
  link: 'Links',
  voice: 'Voice'
}

export const DB_NAMES = {
  FILES_STORAGE: 'files-storage'
}
export const DB_STORE_NAMES = {
  CHANNELS: 'channels',
  MESSAGES: 'messages',
  ATTACHMENTS: 'attachments'
}

export const THEME = {
  DARK: 'dark',
  LIGHT: 'light'
}

export const CHANNEL_GROUP_TYPES = {
  DIRECT_PRIVATE: 'chats_groups',
  PUBLIC: 'channels'
}

export type TimerOption = 'off' | '1day' | '1week' | '1month' | 'custom'

export const FIXED_TIMER_OPTIONS: Record<TimerOption, number | null> = {
  off: 0,
  '1day': 60 * 60 * 24,
  '1week': 60 * 60 * 24 * 7,
  '1month': 60 * 60 * 24 * 30,
  custom: 60 * 60 * 24 * 2
}

export const CUSTOM_OPTIONS = [
  { label: '1 day', value: '1day', seconds: 60 * 60 * 24 },
  { label: '2 days', value: '2days', seconds: 60 * 60 * 24 * 2 },
  { label: '3 days', value: '3days', seconds: 60 * 60 * 24 * 3 },
  { label: '4 days', value: '4days', seconds: 60 * 60 * 24 * 4 },
  { label: '5 days', value: '5days', seconds: 60 * 60 * 24 * 5 },
  { label: '1 week', value: '1week', seconds: 60 * 60 * 24 * 7 },
  { label: '2 weeks', value: '2weeks', seconds: 60 * 60 * 24 * 14 },
  { label: '1 month', value: '1month', seconds: 60 * 60 * 24 * 30 }
]

export const CUSTOM_SECONDS_MAP = Object.fromEntries(CUSTOM_OPTIONS.map((o) => [o.value, o.seconds]))
