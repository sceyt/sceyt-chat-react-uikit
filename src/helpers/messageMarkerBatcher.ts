const DEFAULT_MARKER_BATCH_DEBOUNCE_MS = 500

type MarkerFlushHandler = (channelId: string, messageIds: string[]) => void

type ChannelQueue = {
  readIds: Set<string>
  deliveredIds: Set<string>
  timeoutId: ReturnType<typeof setTimeout> | null
}

type CreateMessageMarkerBatcherParams = {
  debounceMs?: number
  onFlushRead: MarkerFlushHandler
  onFlushDelivered: MarkerFlushHandler
}

const createChannelQueue = (): ChannelQueue => ({
  readIds: new Set<string>(),
  deliveredIds: new Set<string>(),
  timeoutId: null
})

export const createMessageMarkerBatcher = ({
  debounceMs = DEFAULT_MARKER_BATCH_DEBOUNCE_MS,
  onFlushRead,
  onFlushDelivered
}: CreateMessageMarkerBatcherParams) => {
  const channelQueues = new Map<string, ChannelQueue>()

  const getQueue = (channelId: string) => {
    let queue = channelQueues.get(channelId)
    if (!queue) {
      queue = createChannelQueue()
      channelQueues.set(channelId, queue)
    }
    return queue
  }

  const clearQueueTimer = (queue: ChannelQueue) => {
    if (queue.timeoutId !== null) {
      clearTimeout(queue.timeoutId)
      queue.timeoutId = null
    }
  }

  const flushChannel = (channelId: string) => {
    const queue = channelQueues.get(channelId)
    if (!queue) {
      return
    }

    clearQueueTimer(queue)

    if (queue.deliveredIds.size > 0) {
      onFlushDelivered(channelId, Array.from(queue.deliveredIds))
    }

    if (queue.readIds.size > 0) {
      onFlushRead(channelId, Array.from(queue.readIds))
    }

    channelQueues.delete(channelId)
  }

  const scheduleFlush = (channelId: string) => {
    const queue = getQueue(channelId)
    clearQueueTimer(queue)
    queue.timeoutId = setTimeout(() => {
      flushChannel(channelId)
    }, debounceMs)
  }

  const enqueueRead = (channelId: string, messageId?: string) => {
    if (!channelId || !messageId) {
      return
    }
    const queue = getQueue(channelId)
    queue.readIds.add(messageId)
    scheduleFlush(channelId)
  }

  const enqueueDelivered = (channelId: string, messageId?: string) => {
    if (!channelId || !messageId) {
      return
    }

    const queue = getQueue(channelId)
    queue.deliveredIds.add(messageId)
    scheduleFlush(channelId)
  }

  const flushAll = () => {
    Array.from(channelQueues.keys()).forEach(flushChannel)
  }

  const clearAll = () => {
    Array.from(channelQueues.values()).forEach(clearQueueTimer)
    channelQueues.clear()
  }

  return {
    enqueueRead,
    enqueueDelivered,
    flushChannel,
    flushAll,
    clearAll
  }
}

export { DEFAULT_MARKER_BATCH_DEBOUNCE_MS }
