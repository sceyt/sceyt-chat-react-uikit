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
})
