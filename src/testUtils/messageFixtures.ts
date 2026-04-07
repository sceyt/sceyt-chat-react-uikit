import { DEFAULT_CHANNEL_TYPE, MESSAGE_DELIVERY_STATUS, MESSAGE_STATUS } from '../helpers/constants'
import { IChannel, IMessage, IMember, IUser } from '../types'

let userSequence = 1
let channelSequence = 1
let messageSequence = 1
const TEST_TIME_ORIGIN = new Date('2026-04-01T12:00:00.000Z').getTime()

const makeMember = (user: IUser, role = 'owner'): IMember => ({
  ...user,
  role
})

export const resetMessageListFixtureIds = () => {
  userSequence = 1
  channelSequence = 1
  messageSequence = 1
}

export const makeUser = (overrides: Partial<IUser> = {}): IUser => {
  const nextUserId = overrides.id || `user-${userSequence++}`
  return {
    id: nextUserId,
    firstName: overrides.firstName || `User ${nextUserId}`,
    lastName: overrides.lastName || 'Test',
    state: overrides.state || 'active',
    avatarUrl: overrides.avatarUrl,
    avatar: overrides.avatar,
    blocked: overrides.blocked,
    presence: overrides.presence
  }
}

export const makeMessage = (overrides: Partial<IMessage> = {}): IMessage => {
  const nextIndex = messageSequence++
  const createdAt = overrides.createdAt || new Date(TEST_TIME_ORIGIN + nextIndex * 60_000 + (overrides.id ? 0 : 500))
  const id = overrides.id !== undefined ? overrides.id : String(nextIndex)
  const fallbackUser = overrides.incoming ? makeUser({ id: 'remote-user' }) : makeUser({ id: 'current-user' })

  return {
    id,
    tid: overrides.tid,
    body: overrides.body || `message-${nextIndex}`,
    user: overrides.user || fallbackUser,
    channelId: overrides.channelId || 'channel-1',
    createdAt,
    updatedAt: overrides.updatedAt,
    type: overrides.type || 'text',
    deliveryStatus: overrides.deliveryStatus || MESSAGE_DELIVERY_STATUS.SENT,
    markerTotals: overrides.markerTotals || [],
    userMarkers: overrides.userMarkers || [],
    incoming: overrides.incoming ?? false,
    metadata: overrides.metadata || '',
    state: overrides.state || MESSAGE_STATUS.UNMODIFIED,
    userReactions: overrides.userReactions || [],
    reactionTotals: overrides.reactionTotals || [],
    attachments: overrides.attachments || [],
    mentionedUsers: overrides.mentionedUsers || [],
    requestedMentionUserIds: overrides.requestedMentionUserIds || null,
    parentMessage: overrides.parentMessage || null,
    bodyAttributes: overrides.bodyAttributes || [],
    parentId: overrides.parentId,
    repliedInThread: overrides.repliedInThread,
    replyCount: overrides.replyCount,
    transient: overrides.transient ?? false,
    silent: overrides.silent ?? false,
    forwardingDetails: overrides.forwardingDetails,
    pollDetails: overrides.pollDetails,
    viewOnce: overrides.viewOnce
  }
}

export const makePendingMessage = (overrides: Partial<IMessage> = {}): IMessage => {
  const pendingIndex = messageSequence
  return makeMessage({
    id: '',
    tid: overrides.tid || `tid-${pendingIndex}`,
    deliveryStatus: MESSAGE_DELIVERY_STATUS.PENDING,
    ...overrides,
    createdAt: overrides.createdAt || new Date(TEST_TIME_ORIGIN + pendingIndex * 60_000)
  })
}

export const makeChannel = (overrides: Partial<IChannel> = {}): IChannel => {
  const nextChannelId = overrides.id || `channel-${channelSequence++}`
  const currentUser = makeUser({ id: 'current-user' })
  const otherUser = makeUser({ id: 'remote-user' })
  const lastMessage =
    overrides.lastMessage ||
    makeMessage({
      id: '9000',
      body: 'latest-message',
      channelId: nextChannelId,
      user: currentUser
    })

  const members = overrides.members || [makeMember(currentUser), makeMember(otherUser, 'member')]

  const channel = {
    id: nextChannelId,
    uri: overrides.uri,
    parentId: overrides.parentId,
    type: overrides.type || DEFAULT_CHANNEL_TYPE.DIRECT,
    subject: overrides.subject,
    avatarUrl: overrides.avatarUrl,
    metadata: overrides.metadata || '',
    createdAt: overrides.createdAt || new Date(TEST_TIME_ORIGIN),
    updatedAt: overrides.updatedAt || new Date(TEST_TIME_ORIGIN),
    messagesClearedAt: overrides.messagesClearedAt || null,
    memberCount: overrides.memberCount ?? members.length,
    messageCount: overrides.messageCount ?? (overrides.messages?.length || 0),
    createdBy: overrides.createdBy || currentUser,
    userRole: overrides.userRole || 'owner',
    unread: overrides.unread ?? false,
    newMessageCount: overrides.newMessageCount ?? 0,
    newMentionCount: overrides.newMentionCount ?? 0,
    newReactedMessageCount: overrides.newReactedMessageCount ?? 0,
    hidden: overrides.hidden ?? false,
    archived: overrides.archived ?? false,
    muted: overrides.muted ?? false,
    mutedTill: overrides.mutedTill || null,
    pinnedAt: overrides.pinnedAt || null,
    lastReceivedMsgId: overrides.lastReceivedMsgId || lastMessage.id || '',
    lastDisplayedMessageId: overrides.lastDisplayedMessageId || '',
    messageRetentionPeriod: overrides.messageRetentionPeriod,
    isMockChannel: overrides.isMockChannel,
    isLinkedChannel: overrides.isLinkedChannel ?? false,
    backToLinkedChannel: overrides.backToLinkedChannel ?? false,
    linkedFrom: overrides.linkedFrom,
    lastMessage,
    messages: overrides.messages || [],
    members,
    newReactions: overrides.newReactions || [],
    lastReactedMessage: overrides.lastReactedMessage,
    mentionsIds: overrides.mentionsIds || [],
    delete: overrides.delete || jest.fn(async () => undefined),
    deleteAllMessages: overrides.deleteAllMessages || jest.fn(async () => undefined),
    hide: overrides.hide || jest.fn(async () => true),
    unhide: overrides.unhide || jest.fn(async () => true),
    markAsUnRead: overrides.markAsUnRead || jest.fn(async () => channel),
    pin: overrides.pin || jest.fn(async () => channel),
    unpin: overrides.unpin || jest.fn(async () => channel),
    mute: overrides.mute || jest.fn(async () => channel),
    unmute: overrides.unmute || jest.fn(async () => channel),
    markMessagesAsReceived: overrides.markMessagesAsReceived || jest.fn(async () => undefined),
    markMessagesAsDisplayed: overrides.markMessagesAsDisplayed || jest.fn(async () => undefined),
    startTyping: overrides.startTyping || jest.fn(),
    stopTyping: overrides.stopTyping || jest.fn(),
    sendMessage: overrides.sendMessage || jest.fn(async () => undefined),
    editMessage: overrides.editMessage || jest.fn(async () => undefined),
    reSendMessage: overrides.reSendMessage || jest.fn(async () => undefined),
    deleteMessageById: overrides.deleteMessageById || jest.fn(async () => undefined),
    deleteMessage: overrides.deleteMessage || jest.fn(async () => undefined),
    addReaction: overrides.addReaction || jest.fn(async () => ({ message: lastMessage, reaction: null })),
    deleteReaction: overrides.deleteReaction || jest.fn(async () => ({ message: lastMessage, reaction: null })),
    createMessageBuilder: overrides.createMessageBuilder || jest.fn(() => ({})),
    createAttachmentBuilder: overrides.createAttachmentBuilder || jest.fn(() => ({})),
    createThread: overrides.createThread || jest.fn(() => channel),
    getMessagesById: overrides.getMessagesById || jest.fn(async () => [])
  } as IChannel

  return channel
}
