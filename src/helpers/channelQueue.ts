/**
 * Channel Queue Manager
 * Manages queues of API calls per channel ID to ensure sequential execution
 * within each channel while allowing parallel execution across different channels
 * Works with redux-saga generators
 */

import log from 'loglevel'

type QueueTask = () => Promise<any> | any

interface QueuedTask {
  task: QueueTask
  resolve: (value: any) => void
  reject: (error: any) => void
  functionName?: string
  queuedAt?: number
}

interface ChannelQueue {
  channelId: string
  queue: QueuedTask[]
  processing: boolean
}

const channelQueues: Map<string, ChannelQueue> = new Map()

/**
 * Get or create a queue for a specific channel
 */
function getChannelQueue(channelId: string): ChannelQueue {
  if (!channelQueues.has(channelId)) {
    channelQueues.set(channelId, {
      channelId,
      queue: [],
      processing: false
    })
  }
  return channelQueues.get(channelId)!
}

/**
 * Process the next task in the queue for a specific channel
 * Each task waits for the previous one to complete before executing
 */
async function processQueue(channelId: string): Promise<void> {
  const queue = getChannelQueue(channelId)

  if (queue.processing || queue.queue.length === 0) {
    return
  }

  queue.processing = true
  log.info(`[ChannelQueue] Starting to process queue for channel: ${channelId}, queue length: ${queue.queue.length}`)

  while (queue.queue.length > 0) {
    const queuedTask = queue.queue.shift()!
    const { task, resolve, reject, functionName, queuedAt } = queuedTask
    const waitTime = queuedAt ? Date.now() - queuedAt : 0
    const functionInfo = functionName || 'unknown'

    log.info(
      `[ChannelQueue] Executing request for channel: ${channelId}, function: ${functionInfo}, queue position: ${
        queue.queue.length + 1
      }, waited: ${waitTime}ms`
    )

    const startTime = Date.now()

    try {
      // Execute the task and wait for it to complete
      // This ensures each call waits for the previous one's response
      const result = task()

      // Always await the result to ensure the previous call is fully complete
      // before moving to the next one
      if (result && typeof result.then === 'function') {
        // It's a promise - wait for it to resolve/reject
        const value = await result
        const duration = Date.now() - startTime
        log.info(
          `${new Date().toISOString()} [ChannelQueue] Request completed for channel: ${channelId}, 
          function: ${functionInfo}, duration: ${duration}ms, remaining: ${queue.queue.length}`
        )
        resolve(value)
      } else {
        // For non-promise results, resolve immediately
        const duration = Date.now() - startTime
        log.info(
          `${new Date().toISOString()} [ChannelQueue] Request completed (sync) for channel: ${channelId}, 
          function: ${functionInfo}, duration: ${duration}ms, remaining: ${queue.queue.length}`
        )
        resolve(result)
      }
    } catch (error) {
      const duration = Date.now() - startTime
      log.error(
        `${new Date().toISOString()} [ChannelQueue] Request failed for channel: ${channelId}, 
        function: ${functionInfo}, duration: ${duration}ms, error:`,
        error
      )
      reject(error)
    }
    // The await above ensures the previous call is fully complete
    // before we process the next task in the queue
  }

  queue.processing = false
  log.info(`${new Date().toISOString()} [ChannelQueue] Finished processing queue for channel: ${channelId}`)
}

/**
 * Add a task to the channel queue
 * @param channelId - The channel ID to queue the task for
 * @param task - The task function to execute
 * @param functionName - Optional function name for logging
 * @returns A promise that resolves when the task completes
 */
export function queueChannelRequest<T>(channelId: string, task: QueueTask, functionName?: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const queue = getChannelQueue(channelId)
    const queuedTask: QueuedTask = {
      task,
      resolve,
      reject,
      functionName,
      queuedAt: Date.now()
    }
    queue.queue.push(queuedTask)
    log.info(
      `${new Date().toISOString()} [ChannelQueue] Request queued for channel: ${channelId}, 
      function: ${functionName || 'unknown'}, queue length: ${queue.queue.length}, processing: ${queue.processing}`
    )
    processQueue(channelId)
  })
}

/**
 * Wrapper function for queued channel API calls
 * Use this with redux-saga's call effect: yield call(queuedChannelCall, channelId, fn, ...args)
 *
 * Example:
 *   const result = yield call(queuedChannelCall, channel.id, channel.sendMessage, messageToSend)
 */
export function queuedChannelCall<T extends (...args: any[]) => any>(
  channelId: string,
  fn: T,
  ...args: Parameters<T>
): Promise<ReturnType<T>> {
  // Extract function name for logging
  const functionName = fn.name || (fn as any).displayName || 'anonymous'
  const functionInfo = `${functionName}(${args.length} args)`

  return queueChannelRequest(
    channelId,
    async () => {
      // Execute the function and ensure we return a promise
      // This ensures the queue waits for the actual API response
      const result = fn(...args)

      // If the function returns a promise, await it to ensure completion
      // Otherwise wrap it in a promise
      if (result && typeof result.then === 'function') {
        // Wait for the promise to fully resolve before returning
        return await result
      }
      return result
    },
    functionInfo
  )
}

/**
 * Clear the queue for a specific channel
 */
export function clearChannelQueue(channelId: string): void {
  const queue = channelQueues.get(channelId)
  if (queue) {
    queue.queue.forEach(({ reject }) => {
      reject(new Error('Queue cleared'))
    })
    queue.queue = []
    queue.processing = false
  }
}

/**
 * Clear all channel queues
 */
export function clearAllQueues(): void {
  channelQueues.forEach((queue) => {
    queue.queue.forEach(({ reject }) => {
      reject(new Error('All queues cleared'))
    })
    queue.queue = []
    queue.processing = false
  })
  channelQueues.clear()
}
