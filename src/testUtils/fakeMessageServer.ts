/**
 * A small in-memory stand-in for the chat server, used by integration tests.
 *
 * It implements the parts of the SDK client the message and channel sagas use
 * to load history (MessageListQueryBuilder) and the chat list
 * (ChannelListQueryBuilder), and records every request so tests can assert
 * what was (or was not) fetched.
 */
import { IChannel, IMessage } from '../types'
import { makeChannel, makeMessage } from './messageFixtures'

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

  /** Creates a chat with messages `firstId`..`firstId+count-1`. */
  addChat(channelId: string, firstId: number, count: number, extra: Partial<IChannel> = {}) {
    this.histories[channelId] = []
    this.appendMessages(channelId, firstId, count)
    this.channels[channelId] = makeChannel({
      id: channelId,
      lastMessage: this.lastMessage(channelId) || undefined,
      ...extra
    })
    return this.channels[channelId]
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
