import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { IChannel, IContact, IMember, IUser, ChannelQueryParams, IMessage } from '../../types'
import { DEFAULT_CHANNEL_TYPE, MESSAGE_STATUS } from '../../helpers/constants'
import { getClient } from '../../common/client'
import { setUserToMap } from '../../helpers/userHelper'
import { sortChannelByLastMessage } from '../../helpers/channelHalper'

export interface IChannelState {
  channelsLoadingState: number | null
  channelsForForwardLoadingState: number | null
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
  draggedAttachments: { data: any; name: any; type: any; attachmentType: string }[]
  hideChannelList: boolean
  draftIsRemoved: string
  channelInviteKeys: {
    [key: string]: {
      key: string
      maxUses: number
      expiresAt: number
      accessPriorHistory: boolean
    }[]
  }
  joinableChannel: IChannel | null
  channelInviteKeyAvailable: boolean
  mutualChannels: IChannel[]
  mutualChannelsHasNext: boolean
  mutualChannelsLoadingState: number | null
}

const initialState: IChannelState = {
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
  hideChannelList: false,
  draggedAttachments: [],
  draftIsRemoved: '',
  channelInviteKeys: {},
  joinableChannel: null,
  channelInviteKeyAvailable: true,
  mutualChannels: [],
  mutualChannelsHasNext: false,
  mutualChannelsLoadingState: null
}

const channelSlice = createSlice({
  name: 'channels',
  initialState,
  reducers: {
    getChannels: (state, action: PayloadAction<{ params: ChannelQueryParams; isJoinChannel?: boolean }>) => {
      const {
        params: { search }
      } = action.payload
      if (search === '' || search) {
        state.searchValue = search
      }
    },

    setChannels: (state, action: PayloadAction<{ channels: IChannel[] }>) => {
      state.channels = sortChannelByLastMessage([...action.payload.channels])
    },

    setSearchedChannels: (
      state,
      action: PayloadAction<{
        searchedChannels: {
          chats_groups: IChannel[]
          channels: IChannel[]
          contacts: IContact[]
        }
      }>
    ) => {
      state.searchedChannels = action.payload.searchedChannels
    },

    setSearchedChannelsForForward: (
      state,
      action: PayloadAction<{
        searchedChannels: {
          chats_groups: IChannel[]
          channels: IChannel[]
          contacts: IContact[]
        }
      }>
    ) => {
      state.searchedChannelsForForward = action.payload.searchedChannels
    },

    setCloseSearchChannels: (state, action: PayloadAction<{ close: boolean }>) => {
      state.closeSearchChannel = action.payload.close
    },

    setChannelsForForward: (state, action: PayloadAction<{ channels: IChannel[] }>) => {
      state.channelsForForward = [...action.payload.channels]
    },

    addChannel: (state, action: PayloadAction<{ channel: IChannel }>) => {
      if (!state.channels.find((chan) => chan.id === action.payload.channel.id)) {
        state.channels = sortChannelByLastMessage([action.payload.channel, ...state.channels])
      }
    },

    addChannels: (state, action: PayloadAction<{ channels: IChannel[] }>) => {
      state.channels.push(...action.payload.channels)
    },

    addChannelsForForward: (state, action: PayloadAction<{ channels: IChannel[] }>) => {
      state.channelsForForward.push(...action.payload.channels)
    },

    removeChannel: (state, action: PayloadAction<{ channelId: string }>) => {
      const { channelId } = action.payload
      state.channels = state.channels.filter((chan) => chan.id !== channelId)
    },

    setChannelToAdd: (state, action: PayloadAction<{ channel: IChannel | null }>) => {
      state.addedChannel = action.payload.channel
    },

    setAddedToChannel: (state, action: PayloadAction<{ channel: IChannel | null }>) => {
      state.addedToChannel = action.payload.channel
    },

    setChannelToRemove: (state, action: PayloadAction<{ channel: IChannel | null }>) => {
      state.deletedChannel = action.payload.channel
    },

    setChannelToHide: (state, action: PayloadAction<{ channel: IChannel | null }>) => {
      state.hiddenChannel = action.payload.channel
    },

    setChannelToUnhide: (state, action: PayloadAction<{ channel: IChannel | null }>) => {
      state.visibleChannel = action.payload.channel
    },

    setChannelsLoadingState: (state, action: PayloadAction<{ state: number; forForward?: boolean }>) => {
      const { state: loadingState, forForward } = action.payload
      if (forForward) {
        state.channelsForForwardLoadingState = loadingState
      } else {
        state.channelsLoadingState = loadingState
      }
    },

    setChannelsHasNext: (state, action: PayloadAction<{ hasNext: boolean; forForward?: boolean }>) => {
      const { hasNext, forForward } = action.payload
      if (forForward) {
        state.channelsForForwardHasNext = hasNext
      } else {
        state.channelsHasNext = hasNext
      }
    },

    setActiveChannel: (state, action: PayloadAction<{ channel: IChannel | {} }>) => {
      state.activeChannel = action.payload.channel || {}
      if ((action.payload.channel as IChannel).type === DEFAULT_CHANNEL_TYPE.DIRECT) {
        const ChatClient = getClient()
        const { user } = ChatClient
        const directChannelUser = (action.payload.channel as IChannel).members.find(
          (member: IMember) => member.id !== user.id
        )
        if (directChannelUser) {
          setUserToMap(directChannelUser)
        }
      }
    },

    updateChannelData: (
      state,
      action: PayloadAction<{
        config: any
        channelId: string
        moveUp?: boolean
        sort?: boolean
      }>
    ) => {
      const { config, channelId, moveUp, sort } = action.payload

      if (moveUp) {
        let updateChannel: any
        const updatedChannels = state.channels.filter((chan) => {
          if (chan.id === channelId) {
            updateChannel = chan
          }
          return chan.id !== channelId
        })
        if (updateChannel) {
          updateChannel = { ...updateChannel, ...config }
          state.channels = sortChannelByLastMessage([updateChannel, ...updatedChannels])
        }
      } else {
        state.channels = state.channels.map((channel) => {
          if (channel.id === channelId) {
            if (
              state.activeChannel &&
              Object.prototype.hasOwnProperty.call(state.activeChannel, 'id') &&
              channel.id === (state.activeChannel as IChannel).id
            ) {
              state.activeChannel = { ...state.activeChannel, ...config }
            }
            return { ...channel, ...config }
          }
          return channel
        })
        if (sort) {
          state.channels = sortChannelByLastMessage(state.channels)
        }
      }

      if ((state.activeChannel as IChannel).id === channelId) {
        const activeChannelCopy = { ...state.activeChannel }
        state.activeChannel = {
          ...activeChannelCopy,
          ...config
        }
      }
    },

    updateChannelsMembers: (state, action: PayloadAction<{ members: IUser[] }>) => {
      const { members } = action.payload
      let usersMap: { [key: string]: IUser } = {}
      for (const member of members) {
        usersMap = { ...usersMap, [member.id]: member }
      }
      const updateMembers = (members: IMember[]): IMember[] =>
        members.map((member) => (usersMap[member.id] ? { ...member, ...usersMap[member.id] } : member))

      state.channels = state.channels.map((channel) => {
        if (channel.members?.length && channel.members.some((m) => usersMap[m.id])) {
          return { ...channel, members: updateMembers(channel.members) }
        }
        return channel
      })

      if (
        (state.activeChannel as IChannel).id &&
        (state.activeChannel as IChannel).members?.length &&
        (state.activeChannel as IChannel).members.some((m) => usersMap[m.id])
      ) {
        state.activeChannel = {
          ...state.activeChannel,
          members: updateMembers((state.activeChannel as IChannel).members)
        }
      }
    },

    updateSearchedChannelData: (
      state,
      action: PayloadAction<{
        updateData: any
        groupName: string
        channelId: string
      }>
    ) => {
      const { updateData, groupName, channelId } = action.payload
      const groupKey = groupName as keyof typeof state.searchedChannels
      if (state.searchedChannels[groupKey] && state.searchedChannels[groupKey].length) {
        state.searchedChannels = {
          ...state.searchedChannels,
          [groupName]: [...state.searchedChannels[groupKey]].map((channel: IChannel) => {
            if (channel.id === channelId) {
              return { ...channel, ...updateData }
            }
            return channel
          })
        }
      }
    },

    updateUserStatusOnChannel: (state, action: PayloadAction<{ usersMap: { [key: string]: IUser } }>) => {
      const usersMap = action.payload.usersMap
      const ChatClient = getClient()
      const { user } = ChatClient

      const updatedChannels = state.channels.map((channel) => {
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
        (state.activeChannel as IChannel).type === DEFAULT_CHANNEL_TYPE.DIRECT &&
        (state.activeChannel as IChannel).members.find((member: IMember) => member.id !== user.id)

      if (activeChannelUser && usersMap[activeChannelUser.id]) {
        state.activeChannel = {
          ...state.activeChannel,
          members: (state.activeChannel as IChannel).members.map((member) => {
            if (member.id !== user.id) {
              return { ...member, ...usersMap[activeChannelUser.id] }
            } else {
              return member
            }
          })
        }
      }
      state.channels = sortChannelByLastMessage([...updatedChannels])
    },

    updateChannelLastMessage: (state, action: PayloadAction<{ message: IMessage | {}; channel: IChannel }>) => {
      const { channel, message } = action.payload
      let updateChannel = state.channels.find((chan) => chan.id === channel.id)

      if (
        (message as IMessage).state === MESSAGE_STATUS.DELETE ||
        (message as IMessage).state === MESSAGE_STATUS.EDIT
      ) {
        if (updateChannel?.lastMessage.id === (message as IMessage).id) {
          state.channels = state.channels.map((chan) => {
            if (chan.id === channel.id) {
              return { ...chan, lastMessage: message as IMessage }
            }
            return chan
          })
          state.channels = sortChannelByLastMessage(state.channels)
        }
      } else {
        const updatedChannels = state.channels.filter((chan) => chan.id !== channel.id)
        if (updateChannel) {
          updateChannel = { ...updateChannel, lastMessage: message as IMessage }
          state.channels = sortChannelByLastMessage([updateChannel, ...updatedChannels])
        }
      }
    },

    updateChannelLastMessageStatus: (state, action: PayloadAction<{ message: IMessage; channel: IChannel }>) => {
      const { channel, message } = action.payload
      state.channels = state.channels.map((chan) => {
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
      state.channels = sortChannelByLastMessage(state.channels)
    },

    setChannelInfoOpenClose: (state, action: PayloadAction<{ open: boolean }>) => {
      state.channelInfoIsOpen = action.payload.open
    },

    toggleEditChannel: (state, action: PayloadAction<{ state: boolean }>) => {
      state.channelEditMode = action.payload.state
    },

    switchTypingIndicator: (
      state,
      action: PayloadAction<{
        typingState: boolean
        channelId: string
        from: IUser
      }>
    ) => {
      const { typingState, channelId, from } = action.payload
      const currentChannelIndicators = state.typingOrRecordingIndicator[channelId] || {}
      const updatedChannelIndicators = {
        ...currentChannelIndicators,
        [from.id]: {
          ...currentChannelIndicators[from.id],
          from,
          typingState
        }
      }

      state.typingOrRecordingIndicator = {
        ...state.typingOrRecordingIndicator,
        [channelId]: updatedChannelIndicators
      }
    },

    switchRecordingIndicator: (
      state,
      action: PayloadAction<{
        recordingState: boolean
        channelId: string
        from: IUser
      }>
    ) => {
      const { recordingState, channelId, from } = action.payload
      const currentChannelIndicators = state.typingOrRecordingIndicator[channelId] || {}
      const updatedChannelIndicators = {
        ...currentChannelIndicators,
        [from.id]: {
          ...currentChannelIndicators[from.id],
          from,
          recordingState
        }
      }

      state.typingOrRecordingIndicator = {
        ...state.typingOrRecordingIndicator,
        [channelId]: updatedChannelIndicators
      }
    },

    setIsDragging: (state, action: PayloadAction<{ isDragging: boolean }>) => {
      state.isDragging = action.payload.isDragging
    },

    setDraggedAttachments: (state, action: PayloadAction<{ attachments: any[]; type: string }>) => {
      const { attachments, type } = action.payload
      if (attachments.length && attachments.length > 0) {
        state.draggedAttachments = attachments.map((attachment: any) => ({
          data: attachment.data,
          name: attachment.name,
          type: attachment.type,
          attachmentType: type
        }))
      } else {
        state.draggedAttachments = []
      }
    },

    setChannelListWidth: (state, action: PayloadAction<{ width: number }>) => {
      state.channelListWidth = action.payload.width
    },

    setHideChannelList: (state, action: PayloadAction<{ hide: boolean }>) => {
      state.hideChannelList = action.payload.hide
    },

    setDraftIsRemoved: (state, action: PayloadAction<{ channelId: string }>) => {
      state.draftIsRemoved = action.payload.channelId
    },

    setChannelInviteKeys: (
      state,
      action: PayloadAction<{
        channelId: string
        inviteKeys: {
          key: string
          maxUses: number
          expiresAt: number
          accessPriorHistory: boolean
        }[]
      }>
    ) => {
      state.channelInviteKeys = {
        ...state.channelInviteKeys,
        [action.payload.channelId]: action.payload.inviteKeys
      }
    },

    setJoinableChannel: (state, action: PayloadAction<{ channel: IChannel | null }>) => {
      state.joinableChannel = action.payload.channel
    },

    setChannelInviteKeyAvailable: (state, action: PayloadAction<{ available: boolean }>) => {
      state.channelInviteKeyAvailable = action.payload.available
    },

    setMutualChannels: (state, action: PayloadAction<{ channels: IChannel[] }>) => {
      // If empty array is passed, replace the list (for clearing/resetting)
      // Otherwise, append to existing list (for pagination)
      if (action.payload.channels.length === 0 && state.mutualChannels.length > 0) {
        state.mutualChannels = []
      } else {
        state.mutualChannels = [...state.mutualChannels, ...action.payload.channels]
      }
    },

    setMutualChannelsHasNext: (state, action: PayloadAction<{ hasNext: boolean }>) => {
      state.mutualChannelsHasNext = action.payload.hasNext
    },

    setMutualChannelsLoadingState: (state, action: PayloadAction<{ state: number }>) => {
      state.mutualChannelsLoadingState = action.payload.state
    }
  },
  extraReducers: (builder) => {
    builder.addCase('DESTROY_SESSION', (state) => {
      return { ...initialState, channelListWidth: state.channelListWidth }
    })
  }
})

// Export actions
export const {
  getChannels,
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
  updateChannelsMembers,
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
  setHideChannelList,
  setDraftIsRemoved,
  setChannelInviteKeys,
  setJoinableChannel,
  setChannelInviteKeyAvailable,
  setMutualChannels,
  setMutualChannelsHasNext,
  setMutualChannelsLoadingState
} = channelSlice.actions

// Export reducer
export default channelSlice.reducer
