import {
  ADD_CHANNEL,
  ADD_CHANNELS,
  ADD_CHANNELS_FOR_FORWARD,
  CHANNEL_INFO_OPEN_CLOSE,
  CHANNELS_HAS_NEXT,
  DESTROY_SESSION,
  DRAFT_IS_REMOVED,
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
  SET_CLOSE_SEARCH_CHANNELS,
  SET_DRAGGED_ATTACHMENTS,
  SET_HIDE_CHANNEL_LIST,
  SET_IS_DRAGGING,
  SET_SEARCHED_CHANNELS,
  SET_SEARCHED_CHANNELS_FOR_FORWARD,
  SET_TAB_IS_ACTIVE,
  SWITCH_TYPING_INDICATOR,
  SWITCH_RECORDING_INDICATOR,
  TOGGLE_EDIT_CHANNEL,
  UPDATE_CHANNEL_DATA,
  UPDATE_CHANNEL_LAST_MESSAGE,
  UPDATE_CHANNEL_LAST_MESSAGE_STATUS,
  UPDATE_SEARCHED_CHANNEL_DATA,
  UPDATE_USER_STATUS_ON_CHANNEL
} from './constants'
import { IAction, IChannel, IContact, IMember, IUser } from '../../types'
import { DEFAULT_CHANNEL_TYPE, MESSAGE_STATUS } from '../../helpers/constants'
import { getClient } from '../../common/client'
import { setUserToMap } from '../../helpers/userHelper'
import { sortChannelByLastMessage } from '../../helpers/channelHalper'

const initialState: {
  channelsLoadingState: string | null
  channelsForForwardLoadingState: string | null
  usersLoadingState: string | null
  channelsHasNext: boolean
  channelsForForwardHasNext: boolean
  channels: IChannel[]
  searchedChannels: {
    chats_groups: IChannel[]
    channels: IChannel[]
    contacts: IContact[]
  }
  searchedChannelsForForward: {
    chats_groups: IChannel[]
    channels: IChannel[]
    contacts: IContact[]
  }
  closeSearchChannel: boolean
  channelsForForward: IChannel[]
  activeChannel: IChannel | {}
  roles: []
  users: []
  errorNotification: string
  notifications: []
  typingOrRecordingIndicator: {
    [key: string]: { [key: string]: { typingState?: boolean; from: IUser; recordingState?: boolean } }
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
  draftIsRemoved: string
} = {
  channelsLoadingState: null,
  channelsForForwardLoadingState: null,
  usersLoadingState: null,
  channelsHasNext: true,
  channelsForForwardHasNext: true,
  channels: [],
  searchedChannels: { chats_groups: [], channels: [], contacts: [] },
  searchedChannelsForForward: { chats_groups: [], channels: [], contacts: [] },
  closeSearchChannel: false,
  channelsForForward: [],
  activeChannel: {},
  roles: [],
  users: [],
  errorNotification: '',
  notifications: [],
  typingOrRecordingIndicator: {},
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
  draggedAttachments: [],
  draftIsRemoved: ''
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

    case SET_SEARCHED_CHANNELS: {
      newState.searchedChannels = payload.searchedChannels
      return newState
    }

    case SET_SEARCHED_CHANNELS_FOR_FORWARD: {
      newState.searchedChannelsForForward = payload.searchedChannels
      return newState
    }

    case SET_CLOSE_SEARCH_CHANNELS: {
      newState.closeSearchChannel = payload.close
      return newState
    }

    case SET_CHANNELS_FOR_FORWARD: {
      newState.channelsForForward = [...payload.channels]
      return newState
    }

    case ADD_CHANNEL: {
      if (!newState.channels.find((chan) => chan.id === payload.channel.id)) {
        newState.channels = sortChannelByLastMessage([payload.channel, ...newState.channels])
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
      if (payload.channel.type === DEFAULT_CHANNEL_TYPE.DIRECT) {
        const ChatClient = getClient()
        const { user } = ChatClient
        const directChannelUser = payload.channel.members.find((member: IMember) => member.id !== user.id)
        if (directChannelUser) {
          setUserToMap(directChannelUser)
        }
      }
      return newState
    }

    case UPDATE_CHANNEL_DATA: {
      const { config, channelId, moveUp, sort } = payload
      if (moveUp) {
        let updateChannel: any
        const updatedChannels = newState.channels.filter((chan) => {
          if (chan.id === channelId) {
            updateChannel = chan
          }
          return chan.id !== channelId
        })
        if (updateChannel) {
          updateChannel = { ...updateChannel, ...config }
          newState.channels = sortChannelByLastMessage([updateChannel, ...updatedChannels])
        }
      } else {
        newState.channels = newState.channels.map((channel) => {
          if (channel.id === channelId) {
            return { ...channel, ...config }
          }
          return channel
        })
        if (sort) {
          newState.channels = sortChannelByLastMessage(newState.channels)
        }
      }

      if ((newState.activeChannel as IChannel).id === channelId) {
        const activeChannelCopy = { ...newState.activeChannel }
        newState.activeChannel = {
          ...activeChannelCopy,
          ...config
        }
      }
      return newState
    }

    case UPDATE_SEARCHED_CHANNEL_DATA: {
      const { updateData, groupName, channelId } = payload
      if (newState.searchedChannels[groupName] && newState.searchedChannels[groupName].length) {
        newState.searchedChannels = {
          ...newState.searchedChannels,
          [groupName]: [...newState.searchedChannels[groupName]].map((channel: IChannel) => {
            if (channel.id === channelId) {
              return { ...channel, ...updateData }
            }
            return channel
          })
        }
      }
      return newState
    }

    case UPDATE_USER_STATUS_ON_CHANNEL: {
      const usersMap = payload.usersMap
      // log.info('UPDATE_USER_STATUS_ON_CHANNEL . .  .', payload.usersMap)
      const ChatClient = getClient()
      const { user } = ChatClient
      const updatedChannels = newState.channels.map((channel) => {
        const isDirectChannel = channel.type === DEFAULT_CHANNEL_TYPE.DIRECT
        const directChannelUser = isDirectChannel && channel.members.find((member: IMember) => member.id !== user.id)
        if (isDirectChannel && directChannelUser && usersMap[directChannelUser.id]) {
          const membersToUpdate = channel.members.map((member) => {
            if (member.id === usersMap[directChannelUser.id].id) {
              return { ...member, ...usersMap[directChannelUser.id] }
            } else {
              return member
            }
          })
          return { ...channel, members: membersToUpdate }
        }
        return channel
      })
      const activeChannelUser =
        (newState.activeChannel as IChannel).type === DEFAULT_CHANNEL_TYPE.DIRECT &&
        (newState.activeChannel as IChannel).members.find((member: IMember) => member.id !== user.id)
      if (activeChannelUser && usersMap[activeChannelUser.id]) {
        newState.activeChannel = {
          ...newState.activeChannel,
          members: (newState.activeChannel as IChannel).members.map((member) => {
            if (member.id !== user.id) {
              return { ...member, ...usersMap[activeChannelUser.id] }
            } else {
              return member
            }
          })
        }
      }
      newState.channels = [...updatedChannels]
      return newState
    }

    case UPDATE_CHANNEL_LAST_MESSAGE: {
      const { channel, message } = payload
      let updateChannel = newState.channels.find((chan) => chan.id === channel.id)
      if (message.state === MESSAGE_STATUS.DELETE || message.state === MESSAGE_STATUS.EDIT) {
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
          newState.channels = sortChannelByLastMessage([updateChannel, ...updatedChannels])
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
              userMarkers: message.userMarkers,
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
      const currentChannelIndicators = newState.typingOrRecordingIndicator[channelId] || {}
      const updatedChannelIndicators = {
        ...currentChannelIndicators,
        [from.id]: {
          ...currentChannelIndicators[from.id],
          from,
          typingState
        }
      }

      newState.typingOrRecordingIndicator = {
        ...newState.typingOrRecordingIndicator,
        [channelId]: updatedChannelIndicators
      }
      return newState
    }

    case SWITCH_RECORDING_INDICATOR: {
      const { recordingState, channelId, from } = payload
      const currentChannelIndicators = newState.typingOrRecordingIndicator[channelId] || {}
      const updatedChannelIndicators = {
        ...currentChannelIndicators,
        [from.id]: {
          ...currentChannelIndicators[from.id],
          from,
          recordingState
        }
      }

      newState.typingOrRecordingIndicator = {
        ...newState.typingOrRecordingIndicator,
        [channelId]: updatedChannelIndicators
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

    case DRAFT_IS_REMOVED: {
      const { channelId } = payload
      newState.draftIsRemoved = channelId
      return newState
    }

    case DESTROY_SESSION: {
      newState = { ...initialState, channelListWidth: newState.channelListWidth }
      return newState
    }
    default:
      return state
  }
}
