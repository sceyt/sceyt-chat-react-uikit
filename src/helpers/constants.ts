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
  READ: 'displayed'
}

export const MESSAGE_STATUS = {
  NONE: 'none',
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

export const CHANNEL_TYPE = {
  GROUP: 'group',
  BROADCAST: 'broadcast',
  DIRECT: 'direct',
  PUBLIC: 'public',
  PRIVATE: 'private'
}

export const PRESENCE_STATUS = {
  OFFLINE: 'Offline',
  ONLINE: 'Online'
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

export const DB_NAME = 'sceytChatDatabase'
export const DB_STORE_NAMES = {
  CHANNELS: 'channels',
  MESSAGES: 'messages'
}

export const THEME = {
  DARK: 'dark',
  LIGHT: 'light'
}
