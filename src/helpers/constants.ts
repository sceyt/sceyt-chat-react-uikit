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
  FAILED: 'failed'
}

export const MESSAGE_STATUS = {
  NONE: 'None',
  EDIT: 'Edited',
  DELETE: 'Deleted'
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
  PRIVATE: 'Private',
  PUBLIC: 'Public',
  DIRECT: 'Direct'
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
  link: 'link'
}
export const channelDetailsTabs = {
  member: 'member',
  media: 'media',
  file: 'file',
  link: 'link'
}
