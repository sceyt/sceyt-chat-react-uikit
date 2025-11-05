import { DEFAULT_CHANNEL_TYPE } from '../helpers/constants'

export interface IAction {
  type: string
  payload?: any
}

export interface IUser {
  id: string
  avatar?: string
  firstName: string
  lastName: string
  avatarUrl?: string
  state: string
  blocked?: boolean
  presence?: {
    state: string
    status?: string
    lastActiveAt?: Date | null
  }
}

export interface IAddMember {
  id: string
  role: string
  [key: string]: any
}

export interface ICreateChannel {
  metadata?: any
  label?: string
  type: (typeof DEFAULT_CHANNEL_TYPE)[keyof typeof DEFAULT_CHANNEL_TYPE] | string
  userId?: string
  members?: IAddMember[]
}

export interface IAttachment {
  id?: string
  messageId: string
  name: string
  type: string
  metadata?: any
  url: any
  size: number
  createdAt: Date
  progress: any
  completion: any
  upload: boolean
  user?: IUser
  tid?: string
  attachmentUrl: string
  data: any
  cachedUrl?: string
}

declare class AttachmentBuilder {
  url: string
  type: string
  name?: string
  metadata?: string
  upload?: boolean

  constructor(url: string, type: string)

  setName: (name: string) => this
  setMetadata: (metadata: string) => this
  setUpload: (upload: boolean) => this
  setFileSize: (fileSize: number) => this
  create: () => IAttachment
}

export interface IReaction {
  id: string
  key: string
  score: number
  reason: string
  createdAt: Date
  messageId: string
  user: IUser
}

export interface IBodyAttribute {
  type: string
  metadata: string
  offset: number
  length: number
}

export interface IMarker {
  name: string
  messageId: string
  createdAt: Date
  user: IUser | null
}
export interface IPollOption {
  id: string
  name: string
}

export interface IPollVote {
  optionId: string
  createdAt: number
  user: {
    id: string
    presence: {
      status: string
    }
    profile: {
      avatar: string
      firstName: string
      lastName: string
      metadata: string
      metadataMap: {
        [key: string]: string
      }
      updatedAt: number
      username: string
      createdAt: number
    }
    createdAt: number
  }
}

export interface IChangedVotes {
  addedVotes: IPollVote[]
  removedVotes: IPollVote[]
}

export interface IVoteDetails {
  votesPerOption: { [key: string]: number }
  votes: IPollVote[]
  ownVotes: IPollVote[]
}

export interface IPollDetails {
  id: string
  name: string
  description: string
  options: IPollOption[]
  anonymous: boolean
  allowMultipleVotes: boolean
  allowVoteRetract: boolean
  changedVotes?: IChangedVotes
  voteDetails: IVoteDetails
  createdAt: number
  updatedAt: number
  closedAt: number
  closed: boolean
}

export interface IMessage {
  id: string
  tid?: string
  body: string
  user: IUser
  channelId: string
  createdAt: Date
  updatedAt?: Date
  type: string
  deliveryStatus: string
  markerTotals: {
    name: string
    count: number
  }[]
  userMarkers: IMarker[]
  incoming: boolean
  metadata: any
  state: string
  userReactions: IReaction[]
  reactionTotals: {
    key: string
    count: number
    score: number
  }[]
  attachments: IAttachment[]
  mentionedUsers: IUser[]
  requestedMentionUserIds: string[] | null
  parentMessage: IMessage | null
  bodyAttributes: IBodyAttribute[] | []
  parentId?: string
  repliedInThread?: boolean
  replyCount?: number
  transient: boolean
  silent: boolean
  forwardingDetails?: {
    channelId: string
    hops: number
    messageId: string
    user: IUser
  }
  pollDetails?: IPollDetails
}

export interface IMember extends IUser {
  role: string
}

export interface IChannel {
  id: string
  parentId?: string
  uri?: string
  type: string
  subject?: string
  avatarUrl?: string
  metadata: any
  createdAt: Date
  updatedAt: Date | null
  messagesClearedAt: Date | null
  memberCount: number
  messageCount: number
  createdBy: IUser
  userRole: string
  unread: boolean
  newMessageCount: number
  newMentionCount: number
  newReactedMessageCount: number
  hidden: boolean
  archived: boolean
  muted: boolean
  mutedTill: Date | null
  pinnedAt: Date | null
  lastReceivedMsgId: string
  lastDisplayedMessageId: string
  messageRetentionPeriod?: number
  isMockChannel?: boolean
  isLinkedChannel?: boolean
  backToLinkedChannel?: boolean
  linkedFrom?: string
  lastMessage: IMessage
  messages: IMessage[]
  members: IMember[]
  newReactions: IReaction[]
  lastReactedMessage?: IMessage
  mentionsIds?: string[]
  delete: () => Promise<void>
  // eslint-disable-next-line no-unused-vars
  deleteAllMessages: (forEveryone?: boolean) => Promise<void>
  hide: () => Promise<boolean>
  unhide: () => Promise<boolean>
  markAsUnRead: () => Promise<IChannel>
  pin: () => Promise<IChannel>
  unpin: () => Promise<IChannel>
  // eslint-disable-next-line no-unused-vars
  mute: (_muteExpireTime: number) => Promise<IChannel>
  unmute: () => Promise<IChannel>
  // eslint-disable-next-line no-unused-vars
  markMessagesAsReceived: (_messageIds: string[]) => Promise<void>
  // eslint-disable-next-line no-unused-vars
  markMessagesAsDisplayed: (_messageIds: string[]) => Promise<void>
  startTyping: () => void
  stopTyping: () => void
  // eslint-disable-next-line no-unused-vars
  sendMessage: (message: any) => Promise<any>
  // eslint-disable-next-line no-unused-vars
  editMessage: (message: any) => Promise<any>
  // eslint-disable-next-line no-unused-vars
  reSendMessage: (failedMessage: any) => Promise<any>
  // eslint-disable-next-line no-unused-vars
  deleteMessageById: (messageId: string) => Promise<any>
  // eslint-disable-next-line no-unused-vars
  deleteMessage: (message: any) => Promise<any>
  addReaction: (
    // eslint-disable-next-line no-unused-vars
    messageId: string,
    // eslint-disable-next-line no-unused-vars
    key: string,
    // eslint-disable-next-line no-unused-vars
    score: number,
    // eslint-disable-next-line no-unused-vars
    reason: string,
    // eslint-disable-next-line no-unused-vars
    enforceUnique: boolean
  ) => Promise<{ message: any; reaction: any }>
  // eslint-disable-next-line no-unused-vars
  deleteReaction: (messageId: string, key: string) => Promise<{ message: any; reaction: any }>
  createMessageBuilder: () => any
  // eslint-disable-next-line no-unused-vars
  createAttachmentBuilder: (url: string, type: string) => AttachmentBuilder
  // eslint-disable-next-line no-unused-vars
  createThread: (messageId: string) => IChannel
  // eslint-disable-next-line no-unused-vars
  getMessagesById: (messageIds: string[]) => Promise<IMessage[]>
}

export interface IMedia extends IAttachment {
  user: IUser
  updatedAt: Date
}

export interface IMarker {
  messageIds: string[]
  user: IUser | null
  name: string
  createdAt: Date
}

export interface IRole {
  name: string
  permissions?: string[]
  priority?: number
}

export interface IContact {
  id: string
  firstName?: string
  lastName?: string
  metadata?: string
  keys: any[]
  user: IUser
}

export interface IContactsMap {
  [key: string]: IContact
}

export interface IOGMetadata {
  id: string
  url: string
  og: {
    audio: { url: string }[]
    description: string
    favicon: { url: string }
    image: { url: string }[]
    localeAlternate: any[]
    title: string
    video: { url: string }[]
  }
  imageWidth?: number
  imageHeight?: number
}

export type MuteTime = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 24

export type ICustomAvatarColors = [string, string, string, string, string, string]

export interface ChannelQueryParams {
  filter?: { channelType?: string }
  limit?: number
  sort?: 'byLastMessage' | 'byCreationDate'
  search: string
  memberCount?: number
}
export interface ITabsStyles {
  activeColor?: string
  inactiveColor?: string
  indicatorColor?: string
}

export interface IListItemStyles {
  hoverBackground?: string
  nameColor?: string
  dateColor?: string
}

export type MessageInfoTab = 'played' | 'received' | 'displayed'

export interface ILabels {
  playedBy?: string
  receivedBy?: string
  displayedBy?: string
}

export interface OGMetadataProps {
  maxWidth?: number
  maxHeight?: number
  ogLayoutOrder?: 'link-first' | 'og-first'
  ogShowUrl?: boolean
  ogShowTitle?: boolean
  ogShowDescription?: boolean
  ogShowFavicon?: boolean
  order?: { image?: number; title?: number; description?: number; link?: number }
  ogContainerBorderRadius?: string | number
  ogContainerPadding?: string
  ogContainerClassName?: string
  ogContainerShowBackground?: boolean
  ogContainerBackground?: string
  infoPadding?: string
  isInviteLink?: boolean
  target?: string
}
