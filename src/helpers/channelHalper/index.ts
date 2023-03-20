import { IChannel } from '../../types'

type channelMap = {
  [key: string]: IChannel
}

let channelsMap: channelMap = {}
let activeChannelId = ''
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
  const channelsArr: IChannel[] = []
  channels.forEach((channel) => {
    if (!channelsMap[channel.id]) {
      channelsArr.push(channel)
    }
    channelsMap[channel.id] = channel
  })
  return JSON.parse(JSON.stringify(channels))
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
  AttachmentByTypeQueryForPopup: null
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
