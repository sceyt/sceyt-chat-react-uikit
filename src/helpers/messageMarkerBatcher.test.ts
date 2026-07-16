import { createMessageMarkerBatcher, DEFAULT_MARKER_BATCH_DEBOUNCE_MS } from './messageMarkerBatcher'

describe('createMessageMarkerBatcher', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('batches read markers for the same channel into one debounced flush', () => {
    const onFlushRead = jest.fn()
    const onFlushDelivered = jest.fn()
    const batcher = createMessageMarkerBatcher({
      onFlushRead,
      onFlushDelivered
    })

    batcher.enqueueRead('channel-1', '101')
    batcher.enqueueRead('channel-1', '102')

    jest.advanceTimersByTime(DEFAULT_MARKER_BATCH_DEBOUNCE_MS - 1)
    expect(onFlushRead).not.toHaveBeenCalled()

    jest.advanceTimersByTime(1)

    expect(onFlushRead).toHaveBeenCalledTimes(1)
    expect(onFlushRead).toHaveBeenCalledWith('channel-1', ['101', '102'])
    expect(onFlushDelivered).not.toHaveBeenCalled()
  })

  it('dedupes repeated ids and keeps channels separated', () => {
    const onFlushRead = jest.fn()
    const onFlushDelivered = jest.fn()
    const batcher = createMessageMarkerBatcher({
      onFlushRead,
      onFlushDelivered
    })

    batcher.enqueueRead('channel-1', '201')
    batcher.enqueueRead('channel-1', '201')
    batcher.enqueueRead('channel-2', '301')
    batcher.enqueueDelivered('channel-1', '202')

    jest.advanceTimersByTime(DEFAULT_MARKER_BATCH_DEBOUNCE_MS)

    expect(onFlushRead).toHaveBeenCalledTimes(2)
    expect(onFlushRead.mock.calls).toEqual(
      expect.arrayContaining([
        ['channel-1', ['201']],
        ['channel-2', ['301']]
      ])
    )
    expect(onFlushDelivered).toHaveBeenCalledTimes(1)
    expect(onFlushDelivered).toHaveBeenCalledWith('channel-1', ['202'])
  })

  it('flushes pending ids immediately when flushAll is called', () => {
    const onFlushRead = jest.fn()
    const onFlushDelivered = jest.fn()
    const batcher = createMessageMarkerBatcher({
      onFlushRead,
      onFlushDelivered
    })

    batcher.enqueueDelivered('channel-1', '401')
    batcher.enqueueRead('channel-1', '402')
    batcher.flushAll()

    expect(onFlushDelivered).toHaveBeenCalledWith('channel-1', ['401'])
    expect(onFlushRead).toHaveBeenCalledWith('channel-1', ['402'])

    jest.advanceTimersByTime(DEFAULT_MARKER_BATCH_DEBOUNCE_MS)
    expect(onFlushDelivered).toHaveBeenCalledTimes(1)
    expect(onFlushRead).toHaveBeenCalledTimes(1)
  })

  it('flushes delivered markers before read markers within one channel flush', () => {
    const flushOrder: string[] = []
    const batcher = createMessageMarkerBatcher({
      onFlushRead: () => flushOrder.push('read'),
      onFlushDelivered: () => flushOrder.push('delivered')
    })

    batcher.enqueueRead('channel-1', '501')
    batcher.enqueueDelivered('channel-1', '501')

    jest.advanceTimersByTime(DEFAULT_MARKER_BATCH_DEBOUNCE_MS)

    expect(flushOrder).toEqual(['delivered', 'read'])
  })

  it('restarts the debounce window on every new enqueue instead of flushing at the original deadline', () => {
    const onFlushRead = jest.fn()
    const batcher = createMessageMarkerBatcher({
      onFlushRead,
      onFlushDelivered: jest.fn()
    })

    batcher.enqueueRead('channel-1', '601')
    jest.advanceTimersByTime(DEFAULT_MARKER_BATCH_DEBOUNCE_MS - 100)

    batcher.enqueueRead('channel-1', '602')
    jest.advanceTimersByTime(100)
    // the original deadline passed, but the second enqueue restarted the timer
    expect(onFlushRead).not.toHaveBeenCalled()

    jest.advanceTimersByTime(DEFAULT_MARKER_BATCH_DEBOUNCE_MS - 100)
    expect(onFlushRead).toHaveBeenCalledTimes(1)
    expect(onFlushRead).toHaveBeenCalledWith('channel-1', ['601', '602'])
  })

  it('drops queued markers without flushing when clearAll is called', () => {
    const onFlushRead = jest.fn()
    const onFlushDelivered = jest.fn()
    const batcher = createMessageMarkerBatcher({
      onFlushRead,
      onFlushDelivered
    })

    batcher.enqueueRead('channel-1', '701')
    batcher.enqueueDelivered('channel-2', '702')
    batcher.clearAll()

    jest.advanceTimersByTime(DEFAULT_MARKER_BATCH_DEBOUNCE_MS * 2)

    expect(onFlushRead).not.toHaveBeenCalled()
    expect(onFlushDelivered).not.toHaveBeenCalled()
  })

  it('ignores enqueues with a missing channel id or message id', () => {
    const onFlushRead = jest.fn()
    const onFlushDelivered = jest.fn()
    const batcher = createMessageMarkerBatcher({
      onFlushRead,
      onFlushDelivered
    })

    batcher.enqueueRead('', '801')
    batcher.enqueueRead('channel-1', undefined)
    batcher.enqueueDelivered('', '802')
    batcher.enqueueDelivered('channel-1', '')

    jest.advanceTimersByTime(DEFAULT_MARKER_BATCH_DEBOUNCE_MS * 2)

    expect(onFlushRead).not.toHaveBeenCalled()
    expect(onFlushDelivered).not.toHaveBeenCalled()
  })

  it('flushes only the requested channel with flushChannel and keeps other channels queued', () => {
    const onFlushRead = jest.fn()
    const batcher = createMessageMarkerBatcher({
      onFlushRead,
      onFlushDelivered: jest.fn()
    })

    batcher.enqueueRead('channel-1', '901')
    batcher.enqueueRead('channel-2', '902')

    batcher.flushChannel('channel-1')

    expect(onFlushRead).toHaveBeenCalledTimes(1)
    expect(onFlushRead).toHaveBeenCalledWith('channel-1', ['901'])

    jest.advanceTimersByTime(DEFAULT_MARKER_BATCH_DEBOUNCE_MS)
    expect(onFlushRead).toHaveBeenCalledTimes(2)
    expect(onFlushRead).toHaveBeenLastCalledWith('channel-2', ['902'])
  })
})
