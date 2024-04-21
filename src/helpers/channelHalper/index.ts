import { IChannel, IMessage } from '../../types'
import { isJSON } from '../message'
import { CHANNEL_GROUP_TYPES, CHANNEL_TYPE, MESSAGE_DELIVERY_STATUS } from '../constants'

type channelMap = {
  [key: string]: IChannel
}

type channelTypesMemberDisplayTextMap = {
  [key: string]: string
}
type defaultRolesByChannelTypesMap = {
  [key: string]: string
}

let autoSelectFitsChannel = false
let allChannels: IChannel[] = []
let channelsMap: channelMap = {}
let channelTypesMemberDisplayTextMap: channelTypesMemberDisplayTextMap
let defaultRolesByChannelTypesMap: defaultRolesByChannelTypesMap
let activeChannelId = ''
let UploadImageIcon: JSX.Element
let showChannelDetails: boolean = false

export function setChannelInMap(channel: IChannel) {
  channelsMap[channel.id] = { ...channel }
}

export function setActiveChannelId(id: string) {
  activeChannelId = id
}

export function getActiveChannelId() {
  return activeChannelId
}

export function setChannelsInMap(channels: IChannel[]) {
  // const channelsArr: IChannel[] = []
  const channelsForUpdateLastReactionMessage: IChannel[] = []
  const formattedChannel = channels.map((channel) => {
    /* if (!channelsMap[channel.id]) {
      channelsArr.push(channel)
    } */
    if (
      channel.newReactions &&
      channel.newReactions.length &&
      channel.lastMessage &&
      channel.lastMessage.id < channel.newReactions[0].id
    ) {
      channelsForUpdateLastReactionMessage.push(channel)
    }
    channel.metadata = isJSON(channel.metadata) ? JSON.parse(channel.metadata) : channel.metadata
    channelsMap[channel.id] = { ...channel }

    return channel
  })
  return { channels: JSON.parse(JSON.stringify(formattedChannel)), channelsForUpdateLastReactionMessage }
}

export function getChannelFromMap(channelId: string) {
  return channelsMap[channelId]
}

export function getLastChannelFromMap() {
  return Object.values(channelsMap)[0]
}

export function removeChannelFromMap(channelId: string) {
  delete channelsMap[channelId]
}

export function checkChannelExists(channelId: string) {
  return !!channelsMap[channelId]
}

export function destroyChannelsMap() {
  channelsMap = {}
  allChannels = []
  defaultRolesByChannelTypesMap = {}
  channelTypesMemberDisplayTextMap = {}
}

export const query: any = {
  channelQuery: null,
  channelQueryForward: null,
  blockedQuery: null,
  current: null,
  membersQuery: null,
  usersQuery: null,
  hiddenQuery: null,
  messageQuery: null,
  blockedMembersQuery: null,
  AttachmentByTypeQuery: null,
  AttachmentByTypeQueryForPopup: null,
  ReactionsQuery: null
}

const unreadScrollTo = {
  isScrolled: true
}

export function getUnreadScrollTo() {
  return unreadScrollTo.isScrolled
}

export function setUnreadScrollTo(state: boolean) {
  unreadScrollTo.isScrolled = state
}

export function getUploadImageIcon() {
  return UploadImageIcon
}

export function setUploadImageIcon(icon: JSX.Element) {
  UploadImageIcon = icon
}

export function getChannelTypesMemberDisplayTextMap() {
  return channelTypesMemberDisplayTextMap
}

export function setChannelTypesMemberDisplayTextMap(map: channelTypesMemberDisplayTextMap) {
  channelTypesMemberDisplayTextMap = map
}

export function getDefaultRolesByChannelTypesMap() {
  return defaultRolesByChannelTypesMap
}

export function setDefaultRolesByChannelTypesMap(map: channelTypesMemberDisplayTextMap) {
  defaultRolesByChannelTypesMap = map
}

// eslint-disable-next-line no-unused-vars
export let handleNewMessages: (message: IMessage, channel: IChannel) => IMessage | null

// eslint-disable-next-line no-unused-vars
export function setHandleNewMessages(callback: (message: IMessage, channel: IChannel) => IMessage | null) {
  handleNewMessages = callback
}

export function addChannelsToAllChannels(channels: IChannel[]) {
  allChannels = [...allChannels, ...channels]
}

export function addChannelToAllChannels(channel: IChannel) {
  allChannels.push(channel)
}

export function getAllChannels() {
  return allChannels
}
export function getChannelFromAllChannels(channelId: string) {
  return allChannels.find((channel) => channel.id === channelId)
}

export function deleteChannelFromAllChannels(channelId: string) {
  allChannels = allChannels.filter((channel) => channel.id !== channelId)
}

export function updateChannelLastMessageOnAllChannels(channelId: string, message: IMessage) {
  let updateChannel = allChannels.find((chan) => chan.id === channelId)
  if (message.state === 'Deleted' || message.state === 'Edited') {
    if (updateChannel?.lastMessage.id === message.id) {
      allChannels = allChannels.map((chan) => {
        if (chan.id === channelId) {
          // update channel on channel map
          channelsMap[channelId] = { ...chan, lastMessage: message }
          // update channel on all channels
          return { ...chan, lastMessage: message }
        }
        return chan
      })
    }
  } else {
    const updatedChannels = allChannels.filter((chan) => chan.id !== channelId)
    if (updateChannel) {
      const updateMessage = message
      if (
        updateChannel.lastMessage &&
        updateChannel.lastMessage.id === message.id &&
        updateChannel.lastMessage.deliveryStatus === MESSAGE_DELIVERY_STATUS.READ
      ) {
        updateMessage.deliveryStatus = MESSAGE_DELIVERY_STATUS.READ
      }
      updateChannel = { ...updateChannel, lastMessage: updateMessage }
      // update channel on channel map
      channelsMap[channelId] = updateChannel
      // update channel on all channels
      allChannels = [updateChannel, ...updatedChannels]
    }
  }
}
export function updateChannelOnAllChannels(channelId: string, config: any, messageUpdateData?: any) {
  allChannels = allChannels.map((channel) => {
    if (channel.id === channelId) {
      channel = { ...channel, ...config }
      if (messageUpdateData && channel.lastMessage && messageUpdateData.id === channel.lastMessage.id) {
        const updateMessage = messageUpdateData
        if (
          channel.lastMessage.id === messageUpdateData.id &&
          channel.lastMessage.deliveryStatus === MESSAGE_DELIVERY_STATUS.READ
        ) {
          updateMessage.deliveryStatus = MESSAGE_DELIVERY_STATUS.READ
        }
        channel.lastMessage = { ...channel.lastMessage, ...updateMessage }
      }
    }
    return channel
  })
  if (channelsMap[channelId]) {
    channelsMap[channelId] = { ...channelsMap[channelId], ...config }
  }
}

export const getChannelGroupName = (channel: IChannel) =>
  channel.type === CHANNEL_TYPE.DIRECT || channel.type === CHANNEL_TYPE.PRIVATE || channel.type === CHANNEL_TYPE.GROUP
    ? CHANNEL_GROUP_TYPES.DIRECT_PRIVATE
    : CHANNEL_GROUP_TYPES.PUBLIC

let openChatOnUserInteraction = true

export const setOpenChatOnUserInteraction = (state: boolean) => {
  openChatOnUserInteraction = state
}

export const getOpenChatOnUserInteraction = () => {
  return openChatOnUserInteraction
}

export const setAutoSelectFitsChannel = (state: boolean) => {
  autoSelectFitsChannel = state
}

export const getAutoSelectFitsChannel = () => autoSelectFitsChannel

export const setShowChannelDetails = (state: boolean) => {
  showChannelDetails = state
}

export const getShowChannelDetails = () => showChannelDetails

export const sortChannelByLastMessage = (channels: IChannel[]) => {
  return channels.sort((a, b) => {
    const aPinnedAt = a.pinnedAt ? new Date(a.pinnedAt) : null
    const bPinnedAt = b.pinnedAt ? new Date(b.pinnedAt) : null

    if (aPinnedAt && bPinnedAt) {
      return bPinnedAt.getTime() - aPinnedAt.getTime()
    } else if (aPinnedAt) {
      return -1
    } else if (bPinnedAt) {
      return 1
    } else {
      const aDate = a.lastMessage?.createdAt || a.createdAt
      const bDate = b.lastMessage?.createdAt || b.createdAt
      return new Date(bDate).getTime() - new Date(aDate).getTime()
    }
  })
}
