/**
 * A small in-memory stand-in for the chat server, used by integration tests.
 *
 * It implements the parts of the SDK client the message and channel sagas use
 * to load history (MessageListQueryBuilder) and the chat list
 * (ChannelListQueryBuilder), and records every request so tests can assert
 * what was (or was not) fetched.
 */
import { IChannel, IMessage } from '../types'
import { MESSAGE_DELIVERY_STATUS, MESSAGE_STATUS } from '../helpers/constants'
import { makeChannel, makeMessage, makeUser } from './messageFixtures'

export type FakeServerRequest = {
  channelId: string
  method: 'loadPrevious' | 'loadNext' | 'loadNearMessageId' | 'loadNextMessageId' | 'loadPreviousMessageId'
  messageId?: string
  limit: number
  /** Whether the app was online when it sent the request (see `isAppOnline`). */
  sentOnline?: boolean
  sentAt?: number
  respondedAt?: number
}

export type FakeServerHooks = {
  /** Runs before a history response resolves (the request is "in flight"). */
  beforeResponse?: (request: FakeServerRequest) => void | Promise<void>
  /** Makes the request fail (e.g. the network is gone). */
  shouldFail?: (request: FakeServerRequest) => boolean
}

const byId = (left: IMessage, right: IMessage) => {
  const a = BigInt(left.id)
  const b = BigInt(right.id)
  return a < b ? -1 : a > b ? 1 : 0
}

export class FakeMessageServer {
  histories: Record<string, IMessage[]> = {}
  channels: Record<string, IChannel> = {}
  requests: FakeServerRequest[] = []
  hooks: FakeServerHooks = {}
  /** Tells the server whether the app is online, so requests sent offline can be detected. */
  isAppOnline: () => boolean = () => true

  /** Next id for a message sent through the SDK (sendMessage). */
  nextSentId = 900000

  /** Creates a chat with messages `firstId`..`firstId+count-1`. */
  addChat(channelId: string, firstId: number, count: number, extra: Partial<IChannel> = {}) {
    this.histories[channelId] = []
    this.appendMessages(channelId, firstId, count)
    this.channels[channelId] = this.withSdkMethods(
      makeChannel({
        id: channelId,
        lastMessage: this.lastMessage(channelId) || undefined,
        ...extra
      })
    )
    return this.channels[channelId]
  }

  /** Replaces a server message (e.g. edited or deleted) and keeps the chat's lastMessage in sync. */
  private replaceMessage(channelId: string, updated: IMessage) {
    this.histories[channelId] = (this.histories[channelId] || []).map((message) =>
      message.id === updated.id ? updated : message
    )
    const channel = this.channels[channelId]
    if (channel?.lastMessage?.id === updated.id) {
      this.channels[channelId] = { ...channel, lastMessage: updated }
    }
    if ((channel as any)?.lastReactedMessage?.id === updated.id) {
      this.channels[channelId] = {
        ...this.channels[channelId],
        ...(updated.state === MESSAGE_STATUS.DELETE
          ? { lastReactedMessage: null, newReactions: [] }
          : { lastReactedMessage: updated })
      } as any
    }
  }

  /** The remote user reacts to a message (as the chat list reports it afterwards). */
  react(channelId: string, messageId: string, key = '👍') {
    const message = (this.histories[channelId] || []).find((item) => item.id === messageId)!
    const reaction = { id: `reaction-${messageId}`, key, score: 1, user: makeUser({ id: 'remote-user' }) }
    const reacted = { ...message, reactionTotals: [{ key, score: 1, count: 1 }], userReactions: [] } as any
    this.replaceMessage(channelId, reacted)
    this.channels[channelId] = {
      ...this.channels[channelId],
      lastReactedMessage: reacted,
      newReactions: [reaction],
      newReactedMessageCount: 1
    } as any
    return { message: reacted, reaction }
  }

  /** Adds the SDK channel methods the sagas call (send, edit, delete), backed by this server. */
  withSdkMethods(channel: IChannel): IChannel {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const server = this
    const channelId = channel.id
    const sdk: any = {
      createMessageBuilder: () => {
        const fields: any = { body: '', metadata: '', attachments: [], mentionUserIds: [] }
        const builder: any = {}
        const chain = (key: string) => (value: any) => {
          fields[key] = value
          return builder
        }
        ;[
          'setBody',
          'setBodyAttributes',
          'setAttachments',
          'setMentionUserIds',
          'setType',
          'setDisplayCount',
          'setSilent',
          'setMetadata',
          'setPollDetails',
          'setParentMessageId',
          'setReplyInThread',
          'setDisableMentionsCount',
          'setViewOnce'
        ].forEach((method) => {
          builder[method] = chain(method.replace(/^set/, '').replace(/^./, (c) => c.toLowerCase()))
        })
        builder.create = () => ({
          tid: `tid-${server.nextSentId}-${Math.random().toString(36).slice(2, 8)}`,
          id: '',
          body: fields.body,
          bodyAttributes: fields.bodyAttributes || [],
          metadata: fields.metadata || '',
          attachments: [],
          mentionedUsers: [],
          user: makeUser({ id: 'current-user' }),
          createdAt: new Date(),
          deliveryStatus: MESSAGE_DELIVERY_STATUS.PENDING,
          state: MESSAGE_STATUS.UNMODIFIED,
          incoming: false,
          type: fields.type || 'text',
          channelId
        })
        return builder
      },
      sendMessage: async (message: any) => {
        const id = String(server.nextSentId++)
        const confirmed = makeMessage({
          id,
          tid: message.tid,
          channelId,
          body: message.body,
          incoming: false,
          deliveryStatus: MESSAGE_DELIVERY_STATUS.SENT,
          metadata: message.metadata || ''
        })
        server.histories[channelId] = [...(server.histories[channelId] || []), confirmed].sort(byId)
        server.channels[channelId] = { ...server.channels[channelId], lastMessage: confirmed }
        return { ...confirmed }
      },
      editMessage: async (message: any) => {
        const current = (server.histories[channelId] || []).find((item) => item.id === message.id)!
        const edited = { ...current, body: message.body, state: MESSAGE_STATUS.EDIT, updatedAt: new Date() }
        server.replaceMessage(channelId, edited)
        return { ...edited }
      },
      deleteMessageById: async (messageId: string) => {
        const current = (server.histories[channelId] || []).find((item) => item.id === messageId)!
        const deleted = {
          ...current,
          body: '',
          state: MESSAGE_STATUS.DELETE,
          type: 'deleted',
          attachments: [],
          reactionTotals: [],
          updatedAt: new Date()
        }
        server.replaceMessage(channelId, deleted)
        return { ...deleted }
      }
    }
    return Object.assign(channel, sdk)
  }

  /** Messages that arrive on the server (e.g. while the user is offline). */
  appendMessages(channelId: string, firstId: number, count: number, incoming = true) {
    const added = Array.from({ length: count }, (_, index) => {
      const id = String(firstId + index)
      return makeMessage({ id, channelId, body: `${channelId}-${id}`, incoming })
    })
    this.histories[channelId] = [...(this.histories[channelId] || []), ...added].sort(byId)
    if (this.channels[channelId]) {
      this.channels[channelId] = {
        ...this.channels[channelId],
        lastMessage: this.lastMessage(channelId)!,
        newMessageCount: (this.channels[channelId].newMessageCount || 0) + (incoming ? count : 0)
      }
    }
    return added
  }

  clearHistory(channelId: string) {
    this.histories[channelId] = []
  }

  lastMessage(channelId: string) {
    return (this.histories[channelId] || []).at(-1) || null
  }

  requestsFor(channelId: string) {
    return this.requests.filter((request) => request.channelId === channelId)
  }

  private async respond(request: FakeServerRequest, pick: (history: IMessage[]) => IMessage[]) {
    request.sentOnline = this.isAppOnline()
    request.sentAt = Date.now()
    this.requests.push(request)
    if (this.hooks.beforeResponse) {
      await this.hooks.beforeResponse(request)
    }
    request.respondedAt = Date.now()
    if (this.hooks.shouldFail && this.hooks.shouldFail(request)) {
      throw new Error('network lost')
    }
    const history = this.histories[request.channelId] || []
    return pick(history).map((message) => ({ ...message }))
  }

  /** The SDK client shape the sagas use. */
  client() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const server = this
    class MessageListQueryBuilder {
      channelId: string
      private size = 30
      private isReverse = false

      constructor(channelId: string) {
        this.channelId = channelId
      }

      limit(size: number) {
        this.size = size
        return this
      }

      reverse(value: boolean) {
        this.isReverse = value
        return this
      }

      build = async () => {
        const channelId = this.channelId
        let oldestReturned: string | null = null
        let newestReturned: string | null = null
        const query: any = {
          limit: this.size,
          reverse: this.isReverse,
          hasNext: false,
          hasPrevious: false,
          loading: false
        }
        const track = (messages: IMessage[], history: IMessage[]) => {
          if (messages.length) {
            oldestReturned = messages[0].id
            newestReturned = messages[messages.length - 1].id
          }
          query.hasPrevious =
            !!oldestReturned && history.some((message) => BigInt(message.id) < BigInt(oldestReturned!))
          query.hasNext = !!newestReturned && history.some((message) => BigInt(message.id) > BigInt(newestReturned!))
          return { messages, hasNext: query.hasNext, hasPrevious: query.hasPrevious }
        }
        const before = (history: IMessage[], id: string | null) =>
          (id ? history.filter((message) => BigInt(message.id) < BigInt(id)) : history).slice(-query.limit)
        const after = (history: IMessage[], id: string | null) =>
          (id ? history.filter((message) => BigInt(message.id) > BigInt(id)) : history).slice(0, query.limit)
        const load = async (method: FakeServerRequest['method'], messageId: string | undefined, pick: any) => {
          const messages = await server.respond({ channelId, method, messageId, limit: query.limit }, pick)
          return track(messages, server.histories[channelId] || [])
        }
        query.loadPrevious = () =>
          load('loadPrevious', undefined, (history: IMessage[]) => before(history, oldestReturned))
        query.loadNext = () => load('loadNext', undefined, (history: IMessage[]) => after(history, newestReturned))
        query.loadPreviousMessageId = (messageId: string) =>
          load('loadPreviousMessageId', messageId, (history: IMessage[]) => before(history, messageId))
        query.loadNextMessageId = (messageId: string) =>
          load('loadNextMessageId', messageId, (history: IMessage[]) => after(history, messageId))
        query.loadNearMessageId = (messageId: string) =>
          load('loadNearMessageId', messageId, (history: IMessage[]) => {
            const half = Math.floor(query.limit / 2)
            const older = history.filter((message) => BigInt(message.id) <= BigInt(messageId)).slice(-half - 1)
            const newer = history.filter((message) => BigInt(message.id) > BigInt(messageId)).slice(0, half)
            return [...older, ...newer]
          })
        return query
      }
    }

    class ChannelListQueryBuilder {
      types() {
        return this
      }

      memberCount() {
        return this
      }

      order() {
        return this
      }

      limit() {
        return this
      }

      build = async () => ({
        hasNext: false,
        loadNextPage: async () => ({
          channels: Object.values(server.channels).map((channel) => ({ ...channel })),
          hasNext: false
        })
      })
    }

    return {
      user: { id: 'current-user' },
      connectionState: 'Connected',
      MessageListQueryBuilder,
      ChannelListQueryBuilder,
      getChannel: async (channelId: string) => server.channels[channelId] || null
    }
  }
}
