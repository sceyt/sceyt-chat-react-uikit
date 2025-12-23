import { IChannel, IMember, IMessage } from '../../types'
import type { ReactNode } from 'react'
import { isJSON } from '../message'
import { CHANNEL_GROUP_TYPES, DEFAULT_CHANNEL_TYPE, MESSAGE_DELIVERY_STATUS } from '../constants'

let baseUrlForInviteMembers: string = ''
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
const allChannelsMap: channelMap = {}
const pendingDeleteChannelMap: { [key: string]: IChannel } = {}

let channelTypesMemberDisplayTextMap: channelTypesMemberDisplayTextMap
let defaultRolesByChannelTypesMap: defaultRolesByChannelTypesMap
let activeChannelId = ''
let UploadImageIcon: JSX.Element
let showChannelDetails: boolean = false
let channelTypesFilter: string[] = []
let memberCount: number = 10
let disableFrowardMentionsCount: boolean = false
let onUpdateChannel: (channel: IChannel, updatedFields: string[]) => void = () => {}
let useInviteLink: boolean = false
let disappearingSettings: { show?: boolean; customOptions?: { label: string; seconds: number }[] } | null
let showOwnMessageForward: boolean = true
export let customLoadMembersFunctions: {
  loadMoreMembers?: (channel: IChannel, limit?: number) => Promise<{ hasNext: boolean; members: IMember[] }>
  getMembers?: (channel: IChannel) => Promise<{ members: IMember[]; hasNext: boolean }>
  addMembersEvent?: (channelId: string, addedMembers: IMember[], members: IMember[]) => IMember[]
  joinMembersEvent?: (channelId: string, joinedMembers: IMember[], members: IMember[]) => IMember[]
  updateMembersEvent?: (channelId: string, updatedMembers: IMember[], members: IMember[]) => IMember[]
} | null

export type InviteLinkListItemRenderParams = {
  onClick?: () => void
  colors: { accentColor: string; textPrimary: string; backgroundHovered: string }
  defaults: { titleText: string }
  DefaultIcon: ReactNode
}
export type InviteLinkListItemOptions = {
  show?: boolean
  titleText?: string
  showIcon?: boolean
  CustomIcon?: ReactNode
  component?: ReactNode
  CustomComponent?: ReactNode
  render?: (params: InviteLinkListItemRenderParams) => ReactNode
}

export type InviteKey = {
  key: string
  maxUses: number
  expiresAt: number
  accessPriorHistory: boolean
}

export type InviteLinkModalRenderParams = {
  onClose: () => void
  onShare: () => void
  onReset: () => void
  inviteUrl: string
  channelId: string
  theme: string
  colors: {
    accentColor: string
    textPrimary: string
    textSecondary: string
    background: string
    backgroundHovered: string
    surface1: string
    textOnPrimary: string
    border: string
    iconPrimary: string
  }
  inviteKey: InviteKey | null
  dispatch: (...args: unknown[]) => unknown
  actions: {
    [key: string]: unknown
  }
}
export type InviteLinkModalOptions = {
  titleText?: string
  linkLabel?: string
  linkDescription?: string
  shareButtonText?: string
  cancelButtonText?: string
  resetButtonText?: string
  showHistorySection?: boolean
  showResetButton?: boolean
  historyTitle?: string
  showPreviousMessagesLabel?: string
  tabs?: { link?: { show?: boolean; title?: string }; qr?: { show?: boolean; title?: string } }
  qrHintText?: string
  component?: ReactNode
  CustomComponent?: ReactNode
  render?: (params: InviteLinkModalRenderParams) => ReactNode
}

export type MemberSummary = {
  avatarUrl: string
  firstName: string
  lastName: string
  id: string
  role: string
}
export type JoinGroupPopupRenderParams = {
  onClose: () => void
  onJoin: () => void
  channel: IChannel & { membersTotalCount: number; avatar: string }
  themeColors: { textPrimary: string; textSecondary: string; background: string; iconPrimary: string; surface1: string }
  contactsMap: { [key: string]: unknown }
  members: MemberSummary[]
  firstMembers: MemberSummary[]
  extraCount: number
  membersLine: string
}
export type JoinGroupPopupOptions = {
  show?: boolean
  titleText?: string
  subtitleText?: string
  joinButtonText?: string
  showMembersAvatars?: boolean
  showMembersLine?: boolean
  component?: ReactNode
  CustomComponent?: ReactNode
  render?: (params: JoinGroupPopupRenderParams) => ReactNode
}

export type ResetLinkConfirmRenderParams = {
  onCancel: () => void
  onConfirm: () => void
  defaults: { titleText: string; descriptionText: ReactNode; buttonText: string }
}
export type ResetLinkConfirmOptions = {
  show?: boolean
  titleText?: string
  descriptionText?: string | JSX.Element
  buttonText?: string
  component?: ReactNode
  CustomComponent?: ReactNode
  render?: (params: ResetLinkConfirmRenderParams) => ReactNode
}

export type InviteLinkOptions = {
  ListItemInviteLink?: InviteLinkListItemOptions
  JoinGroupPopup?: JoinGroupPopupOptions
  InviteLinkModal?: InviteLinkModalOptions
  ResetLinkConfirmModal?: ResetLinkConfirmOptions
}

let inviteLinkOptions: InviteLinkOptions | null = null

export function setBaseUrlForInviteMembers(url: string) {
  baseUrlForInviteMembers = url
}

export function setUseInviteLink(use: boolean) {
  useInviteLink = use
}

export function setInviteLinkOptions(options: InviteLinkOptions) {
  inviteLinkOptions = options
}

export function getBaseUrlForInviteMembers() {
  return baseUrlForInviteMembers
}

export function getUseInviteLink() {
  return useInviteLink
}

export function getInviteLinkOptions(): InviteLinkOptions | null {
  return inviteLinkOptions
}

export function setChannelInMap(channel: IChannel) {
  channelsMap[channel.id] = { ...channel }
  allChannelsMap[channel.id] = { ...channel }
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
    channel.metadata = isJSON(channel.metadata) ? JSON.parse(channel.metadata) : channel.metadata
    if (
      channel.newReactions &&
      channel.newReactions.length &&
      channel.lastMessage &&
      channel.lastMessage.id < channel.newReactions[0].id
    ) {
      channelsForUpdateLastReactionMessage.push(channel)
    }
    channelsMap[channel.id] = { ...channel }
    allChannelsMap[channel.id] = { ...channel }
    return channel
  })
  return { channels: JSON.parse(JSON.stringify(formattedChannel)), channelsForUpdateLastReactionMessage }
}

export function getChannelFromMap(channelId: string) {
  return channelsMap[channelId]
}

export function getLastChannelFromMap(deletePending: boolean = false) {
  const channels = Object.values(channelsMap)
  if (deletePending) {
    for (const channel of channels) {
      if (!getPendingDeleteChannel(channel.id)) {
        return channel
      }
    }
  }
  return channels[0]
}

export function removeChannelFromMap(channelId: string) {
  delete channelsMap[channelId]
  delete allChannelsMap[channelId]
}

export function checkChannelExists(channelId: string) {
  return !!channelsMap[channelId]
}

export function destroyChannelsMap() {
  channelsMap = {}
  allChannels = []
  defaultRolesByChannelTypesMap = {}
  channelTypesMemberDisplayTextMap = {}
  memberCount = 0
}

export const query: any = {
  channelQuery: null,
  channelQueryForward: null,
  channelMembersQuery: null,
  blockedQuery: null,
  current: null,
  membersQuery: null,
  usersQuery: null,
  hiddenQuery: null,
  messageQuery: null,
  blockedMembersQuery: null,
  AttachmentByTypeQuery: null,
  AttachmentByTypeQueryForPopup: null,
  ReactionsQuery: null,
  PollVotesQueries: {} // key format: pollId_optionId
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

export function getChannelTypesFilter() {
  return channelTypesFilter
}

export function setChannelTypesFilter(types: string[]) {
  channelTypesFilter = types
}

export function getDefaultRolesByChannelTypesMap() {
  return defaultRolesByChannelTypesMap
}

export function setDefaultRolesByChannelTypesMap(map: channelTypesMemberDisplayTextMap) {
  defaultRolesByChannelTypesMap = map
}

export function getChannelMembersCount() {
  return memberCount
}

export function setChannelMembersCount(count: number) {
  memberCount = count
}

export function setDisableFrowardMentionsCount(disable: boolean) {
  disableFrowardMentionsCount = disable
}

export function getDisableFrowardMentionsCount() {
  return disableFrowardMentionsCount
}

export function getCustomLoadMembersFunctions() {
  return customLoadMembersFunctions
}

export function setOnUpdateChannel(callback: (channel: IChannel, updatedFields: string[]) => void) {
  onUpdateChannel = callback
}

export function getOnUpdateChannel() {
  return onUpdateChannel
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

export function getChannelFromAllChannelsMap(channelId: string) {
  return allChannelsMap[channelId]
}

export function deleteChannelFromAllChannels(channelId: string) {
  allChannels = allChannels.filter((channel) => channel.id !== channelId)
}

export function updateChannelLastMessageOnAllChannels(channelId: string, message: IMessage) {
  let updateChannel = allChannels.find((chan) => chan.id === channelId)
  if (message?.state === 'Deleted' || message?.state === 'Edited') {
    if (updateChannel?.lastMessage.id === message.id) {
      allChannels = allChannels.map((chan) => {
        if (chan.id === channelId) {
          // update channel on channel map
          channelsMap[channelId] = { ...chan, lastMessage: message }
          allChannelsMap[channelId] = { ...chan, lastMessage: message }
          // update channel on all channels
          return { ...chan, lastMessage: message }
        }
        return chan
      })
    }
  } else {
    const updatedChannels = allChannels.filter((chan) => chan.id !== channelId)
    if (updateChannel) {
      let updateMessage = message
      if (
        updateChannel.lastMessage &&
        updateChannel.lastMessage.id === message.id &&
        updateChannel.lastMessage.deliveryStatus === MESSAGE_DELIVERY_STATUS.READ
      ) {
        updateMessage = { ...message, deliveryStatus: MESSAGE_DELIVERY_STATUS.READ }
      }
      updateChannel = { ...updateChannel, lastMessage: updateMessage }
      // update channel on channel map
      channelsMap[channelId] = updateChannel
      allChannelsMap[channelId] = updateChannel
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
        let updateMessage = messageUpdateData
        if (
          channel.lastMessage.id === messageUpdateData.id &&
          channel.lastMessage.deliveryStatus === MESSAGE_DELIVERY_STATUS.READ
        ) {
          updateMessage = { ...messageUpdateData, deliveryStatus: MESSAGE_DELIVERY_STATUS.READ }
        }
        channel.lastMessage = { ...channel.lastMessage, ...updateMessage }
      }
    }
    return channel
  })
  if (channelsMap[channelId]) {
    channelsMap[channelId] = { ...channelsMap[channelId], ...config }
    allChannelsMap[channelId] = { ...channelsMap[channelId], ...config }
  }
}

export const getChannelGroupName = (channel: IChannel) =>
  channel.type === DEFAULT_CHANNEL_TYPE.DIRECT ||
  channel.type === DEFAULT_CHANNEL_TYPE.PRIVATE ||
  channel.type === DEFAULT_CHANNEL_TYPE.GROUP
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

export const setDisappearingSettings = (
  settings: { show?: boolean; customOptions?: { label: string; seconds: number }[] } | null
) => {
  disappearingSettings = settings
}

export const setCustomLoadMembersFunctions = (functions: {
  loadMoreMembers?: (channel: IChannel, limit?: number) => Promise<{ hasNext: boolean; members: IMember[] }>
  getMembers?: (channel: IChannel) => Promise<{ members: IMember[]; hasNext: boolean }>
  addMembersEvent?: (channelId: string, addedMembers: IMember[], members: IMember[]) => IMember[]
  joinMembersEvent?: (channelId: string, joinedMembers: IMember[], members: IMember[]) => IMember[]
  updateMembersEvent?: (channelId: string, updatedMembers: IMember[], members: IMember[]) => IMember[]
}) => {
  customLoadMembersFunctions = functions
}

export const setShowOwnMessageForward = (show: boolean) => {
  showOwnMessageForward = show
}

export const getShowOwnMessageForward = () => {
  return showOwnMessageForward
}

export const getDisappearingSettings = () => disappearingSettings

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

export const setPendingDeleteChannel = (channel: IChannel) => {
  pendingDeleteChannelMap[channel?.id] = channel
}

export const getPendingDeleteChannel = (channelId: string) => {
  return pendingDeleteChannelMap[channelId]
}

export const getPendingDeleteChannels = () => {
  return Object.values(pendingDeleteChannelMap)
}

export const removePendingDeleteChannel = (channelId: string) => {
  delete pendingDeleteChannelMap[channelId]
}
