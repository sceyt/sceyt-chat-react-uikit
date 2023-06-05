import { IChannel } from '../../types'
import { isJSON } from '../message'

type channelMap = {
  [key: string]: IChannel
}

let channelsMap: channelMap = {}
let activeChannelId = ''
let UploadImageIcon: JSX.Element
export function setChannelInMap(channel: IChannel) {
  channelsMap[channel.id] = channel
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
      channel.userMessageReactions &&
      channel.userMessageReactions.length &&
      channel.lastMessage &&
      channel.lastMessage.id < channel.userMessageReactions[0].id &&
      channel.lastMessage.id !== channel.userMessageReactions[0].messageId
    ) {
      channelsForUpdateLastReactionMessage.push(channel)
    }
    channel.metadata = isJSON(channel.metadata) ? JSON.parse(channel.metadata) : channel.metadata
    channelsMap[channel.id] = channel

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
