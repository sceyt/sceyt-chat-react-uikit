export interface IAction {
  type: string,
  payload?: any
}

export interface IUser {
  id: string,
  firstName: string,
  lastName: string,
  avatarUrl?: string,
  presence?: {
    state: string;
    status?: string;
    lastActiveAt?: Date | null
  }
}

export interface ICreateChannel {
  metadata?: any
  label?: string
  type: string
  userId?: string
  members?: IAddMember[]
}

export interface IChannel {
  id: string;
  createdAt: Date | number;
  updatedAt: Date | number;
  unreadCount: number;
  lastReadMessageId: string;
  lastDeliveredMessageId: string;
  lastMessage: any | null;
  memberCount: number;
  markedAsUnread: boolean;
  muted: boolean;
  muteExpireTime: Date | number;
  type: 'Public' | 'Private' | 'Direct';
  peer?: any,
  subject?: string,
  label?: string,
  metadata: any;
  role: string;
  avatarUrl?: string,
  unreadMessageCount?: number,
  delete: () => Promise<void>;
  deleteAllMessages: (deleteForMe?: boolean) => Promise<void>;
  hide: () => Promise<boolean>;
  unhide: () => Promise<boolean>;
  markAsUnRead: () => Promise<IChannel>;
  mute: (_muteExpireTime: number) => Promise<IChannel>;
  unmute: () => Promise<IChannel>;
  markMessagesAsDelivered: (_messageIds: string[]) => Promise<void>;
  markMessagesAsRead: (_messageIds: string[]) => Promise<void>;
  startTyping: () => void;
  stopTyping: () => void;
  sendMessage: (message: any) => Promise<any>;
  editMessage: (message: any) => Promise<any>;
  reSendMessage: (failedMessage: any) => Promise<any>;
  deleteMessageById: (messageId: string) => Promise<any>;
  deleteMessage: (message: any) => Promise<any>;
  addReaction: (messageId: string, key: string, score: number, reason: string, enforceUnique: boolean) => Promise<{ message: any, reaction: any }>
  deleteReaction: (messageId: string, key: string) => Promise<{ message: any, reaction: any }>
  createMessageBuilder: () => any;
  createAttachmentBuilder: (url: string, type: string) => any;
}

export interface IMessage {
  id: string;
  tid?: string;
  body: string;
  user: IUser;
  createdAt: Date | number;
  updatedAt?: Date | number;
  type: string;
  deliveryStatus: string;
  selfMarkers: string[];
  incoming: boolean;
  metadata: any;
  state: string;
  selfReactions: IReaction[] | [];
  lastReactions: IReaction[] | [];
  reactionScores: { [key: string]: number } | null;
  attachments: IAttachment[] | [];
  mentionedUsers: IUser[];
  requestedMentionUserIds: string[] | null;
  parent?: IMessage | null;
  parentId?: string;
  repliedInThread?: boolean;
  replyCount?: number;
  transient: boolean;
  silent: boolean;
}

export interface IReaction {
  key: string;
  score: number;
  reason: string;
  updatedAt: Date;
  messageId: number;
  user: IUser
}

export interface IAttachment {
  id?: string
  attachmentId?: string,
  createdAt: Date,
  url: any,
  attachmentUrl: string,
  type: string,
  name: string,
  data: any,
  fileSize: number
  title?: string
  metadata?: any
  user: IUser
}

export interface IMedia extends IAttachment{
  user: IUser
  updatedAt: Date;
}

export interface ICustomChannelItemProps {
  channel: IChannel,
  setActiveChannel: (channel: IChannel) => void;
}

export interface IMarker {
  messageIds: string[];
  user: IUser;
  name: string;
  createAt: Date
}

export interface IRole {
  name: string
  permissions?: string[]
  priority?: number
}

export interface IMember extends IUser{
  role: string
}

export interface IAddMember {
  id: string
  role: string
}

export interface IContact{
  id: string;
  firstName?: string;
  lastName?: string;
  metadata?: string;
  keys: any[];
  user: IUser;
}


export interface IContactsMap {
  [key: string]: IContact
}

export type MuteTime = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 24
