import {
  ADD_CHANNEL,
  ADD_CHANNELS,
  ADD_CHANNELS_FOR_FORWARD,
  CHANNEL_INFO_OPEN_CLOSE,
  CHANNELS_HAS_NEXT,
  DESTROY_SESSION,
  GET_CHANNELS,
  REMOVE_CHANNEL,
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
  SET_DRAGGED_ATTACHMENTS,
  SET_HIDE_CHANNEL_LIST,
  SET_IS_DRAGGING,
  SET_TAB_IS_ACTIVE,
  SWITCH_TYPING_INDICATOR,
  TOGGLE_EDIT_CHANNEL,
  UPDATE_CHANNEL_DATA,
  UPDATE_CHANNEL_LAST_MESSAGE,
  UPDATE_CHANNEL_LAST_MESSAGE_STATUS,
  UPDATE_USER_STATUS_ON_CHANNEL
} from './constants'
import { IAction, IChannel } from '../../types'
import { CHANNEL_TYPE } from '../../helpers/constants'

const initialState: {
  channelsLoadingState: string | null
  channelsForForwardLoadingState: string | null
  usersLoadingState: string | null
  channelsHasNext: boolean
  channelsForForwardHasNext: boolean
  channels: IChannel[]
  channelsForForward: IChannel[]
  activeChannel: IChannel | {}
  roles: []
  users: []
  errorNotification: string
  notifications: []
  typingIndicator: {
    [key: string]: {
      typingState: boolean
      from: {}
    }
  }
  searchValue: string
  addedChannel: IChannel | null
  addedToChannel: IChannel | null
  deletedChannel: IChannel | null
  hiddenChannel: IChannel | null
  visibleChannel: IChannel | null
  channelInfoIsOpen: boolean
  channelEditMode: boolean
  channelListWidth: number
  isDragging: boolean
  draggedAttachments: { attachment: File; type: 'media' | 'file' }[]
  tabIsActive: boolean
  hideChannelList: boolean
} = {
  channelsLoadingState: null,
  channelsForForwardLoadingState: null,
  usersLoadingState: null,
  channelsHasNext: true,
  channelsForForwardHasNext: true,
  channels: [],
  channelsForForward: [],
  activeChannel: {},
  roles: [],
  users: [],
  errorNotification: '',
  notifications: [],
  typingIndicator: {},
  searchValue: '',
  addedChannel: null,
  addedToChannel: null,
  deletedChannel: null,
  hiddenChannel: null,
  visibleChannel: null,
  channelInfoIsOpen: false,
  channelEditMode: false,
  channelListWidth: 0,
  isDragging: false,
  tabIsActive: true,
  hideChannelList: false,
  draggedAttachments: []
}

export default (state = initialState, { type, payload }: IAction = { type: '' }) => {
  let newState = { ...state }

  switch (type) {
    case GET_CHANNELS: {
      const {
        params: { search }
      } = payload
      if (search === '' || search) {
        newState.searchValue = search
      }
      return newState
    }
    case SET_CHANNELS: {
      newState.channels = [...payload.channels]
      return newState
    }

    case SET_CHANNELS_FOR_FORWARD: {
      newState.channelsForForward = [...payload.channels]
      return newState
    }

    case ADD_CHANNEL: {
      if (!newState.channels.find((chan) => chan.id === payload.channel.id)) {
        newState.channels = [payload.channel, ...newState.channels]
      }
      return newState
    }

    case ADD_CHANNELS: {
      newState.channels = [...newState.channels, ...payload.channels]
      return newState
    }

    case ADD_CHANNELS_FOR_FORWARD: {
      newState.channelsForForward = [...newState.channelsForForward, ...payload.channels]
      return newState
    }

    case REMOVE_CHANNEL: {
      const { channelId } = payload
      const channelsCpy = newState.channels
      newState.channels = channelsCpy.filter((chan) => chan.id !== channelId)

      return newState
    }

    case SET_CHANNEL_TO_ADD: {
      const { channel } = payload
      newState.addedChannel = channel

      return newState
    }

    case SET_ADDED_TO_CHANNEL: {
      const { channel } = payload
      newState.addedToChannel = channel

      return newState
    }

    case SET_CHANNEL_TO_REMOVE: {
      const { channel } = payload
      newState.deletedChannel = channel

      return newState
    }

    case SET_CHANNEL_TO_HIDE: {
      const { channel } = payload
      newState.hiddenChannel = channel

      return newState
    }

    case SET_CHANNEL_TO_UNHIDE: {
      const { channel } = payload
      newState.visibleChannel = channel

      return newState
    }

    case SET_CHANNELS_LOADING_STATE: {
      const { state, forForward } = payload
      if (forForward) {
        newState.channelsForForwardLoadingState = state
      } else {
        newState.channelsLoadingState = state
      }
      return newState
    }

    case CHANNELS_HAS_NEXT: {
      const { hasNext, forForward } = payload
      if (forForward) {
        newState.channelsForForwardHasNext = hasNext
      } else {
        newState.channelsHasNext = hasNext
      }
      return newState
    }

    case SET_ACTIVE_CHANNEL: {
      newState.activeChannel = payload.channel || {}
      return newState
    }

    case UPDATE_CHANNEL_DATA: {
      const updateData = payload.config
      const updatedChannels = newState.channels.map((channel) => {
        if (channel.id === payload.channelId) {
          return { ...channel, ...updateData }
        }
        return channel
      })
      if ((newState.activeChannel as IChannel).id === payload.channelId) {
        const activeChannelCopy = { ...newState.activeChannel }
        newState.activeChannel = {
          ...activeChannelCopy,
          ...updateData
        }
      }
      newState.channels = updatedChannels
      return newState
    }

    case UPDATE_USER_STATUS_ON_CHANNEL: {
      const usersMap = payload.usersMap
      // console.log('UPDATE_USER_STATUS_ON_CHANNEL . .  .', payload.usersMap)
      const updatedChannels = newState.channels.map((channel) => {
        if (channel.type === CHANNEL_TYPE.DIRECT && usersMap[channel.peer.id]) {
          return { ...channel, peer: { ...channel.peer, presence: usersMap[channel.peer.id].presence } }
        }
        return channel
      })
      if (
        (newState.activeChannel as IChannel).type === CHANNEL_TYPE.DIRECT &&
        usersMap[(newState.activeChannel as IChannel).peer.id]
      ) {
        if ('peer' in newState.activeChannel) {
          newState.activeChannel = {
            ...newState.activeChannel,
            peer: {
              ...(newState.activeChannel.peer && newState.activeChannel.peer),
              presence: usersMap[(newState.activeChannel as IChannel).peer.id].presence
            }
          }
        }
      }
      newState.channels = [...updatedChannels]
      return newState
    }

    case UPDATE_CHANNEL_LAST_MESSAGE: {
      const { channel, message } = payload
      let updateChannel = newState.channels.find((chan) => chan.id === channel.id)
      if (message.state === 'Deleted' || message.state === 'Edited') {
        if (updateChannel?.lastMessage.id === message.id) {
          newState.channels = newState.channels.map((chan) => {
            if (chan.id === channel.id) {
              return { ...chan, lastMessage: message }
            }
            return chan
          })
        }
      } else {
        const updatedChannels = newState.channels.filter((chan) => chan.id !== channel.id)
        if (updateChannel) {
          updateChannel = { ...updateChannel, lastMessage: message }
          newState.channels = [updateChannel, ...updatedChannels]
        }
      }
      return newState
    }

    case UPDATE_CHANNEL_LAST_MESSAGE_STATUS: {
      const { channel, message } = payload

      newState.channels = newState.channels.map((chan) => {
        if (chan.id === channel.id) {
          return {
            ...channel,
            lastMessage: {
              ...channel.lastMessage,
              deliveryStatus: message.deliveryStatus,
              selfMarkers: message.selfMarkers,
              state: message.state
            }
          }
        }
        return chan
      })

      return newState
    }

    case CHANNEL_INFO_OPEN_CLOSE: {
      newState.channelInfoIsOpen = payload.open
      return newState
    }

    case TOGGLE_EDIT_CHANNEL: {
      newState.channelEditMode = payload.state
      return newState
    }

    case SWITCH_TYPING_INDICATOR: {
      const { typingState, channelId, from } = payload
      if (typingState) {
        newState.typingIndicator = { ...newState.typingIndicator, ...{ [channelId]: { from, typingState } } }
      } else {
        if (newState.typingIndicator[channelId]) {
          const copyData = { ...newState.typingIndicator }
          delete copyData[channelId]
          newState.typingIndicator = copyData
        }
      }
      return newState
    }

    case SET_IS_DRAGGING: {
      const { isDragging } = payload
      newState.isDragging = isDragging
      return newState
    }

    case SET_DRAGGED_ATTACHMENTS: {
      const { attachments, type } = payload
      if (attachments.length && attachments.length > 0) {
        newState.draggedAttachments = attachments.map((attachment: any) => ({
          data: attachment.data,
          name: attachment.name,
          type: attachment.type,
          attachmentType: type
        }))
      } else {
        newState.draggedAttachments = []
      }
      return newState
    }

    case SET_CHANNEL_LIST_WIDTH: {
      const { width } = payload
      newState.channelListWidth = width
      return newState
    }

    case SET_TAB_IS_ACTIVE: {
      const { isActive } = payload
      newState.tabIsActive = isActive
      return newState
    }
    case SET_HIDE_CHANNEL_LIST: {
      const { hide } = payload
      newState.hideChannelList = hide
      return newState
    }

    case DESTROY_SESSION: {
      newState = initialState
      return newState
    }
    default:
      return state
  }
}
