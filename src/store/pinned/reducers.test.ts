import PinnedReducer, { removePinnedMessages, setPinnedMessages, upsertPinnedMessages } from './reducers'

const pin = (id: string, messageId: string, pinType = 0) => ({
  id,
  pinType,
  message: { id: messageId, body: `message ${messageId}` }
})

describe('pinned message state', () => {
  it('deduplicates a request response and its realtime broadcast by pin id', () => {
    let state = PinnedReducer(undefined, setPinnedMessages({ channelId: 'c1', pins: [pin('p1', 'm1')] }))
    state = PinnedReducer(state, upsertPinnedMessages({ channelId: 'c1', pins: [pin('p1', 'm1')] }))

    expect(state.byChannel.c1).toHaveLength(1)
  })

  it('places a newly pinned message at the beginning of the descending list', () => {
    let state = PinnedReducer(
      undefined,
      setPinnedMessages({ channelId: 'c1', pins: [pin('older', 'm1'), pin('newer', 'm2')] })
    )
    state = PinnedReducer(state, upsertPinnedMessages({ channelId: 'c1', pins: [pin('latest', 'm3')] }))

    expect(state.byChannel.c1.map((item) => item.id)).toEqual(['latest', 'older', 'newer'])
  })

  it('removes every matching pin as soon as its source message is deleted', () => {
    let state = PinnedReducer(
      undefined,
      setPinnedMessages({
        channelId: 'c1',
        pins: [pin('personal', 'm1', 1), pin('all', 'm1', 2), pin('other', 'm2', 2)]
      })
    )
    state = PinnedReducer(state, removePinnedMessages({ channelId: 'c1', messageIds: ['m1'] }))

    expect(state.byChannel.c1.map((item) => item.id)).toEqual(['other'])
  })

  it('appends cursor pages without limiting the number of pins in a channel', () => {
    let state = PinnedReducer(
      undefined,
      setPinnedMessages({ channelId: 'c1', pins: [pin('p1', 'm1')], nextToken: '2' })
    )
    state = PinnedReducer(state, setPinnedMessages({ channelId: 'c1', pins: [pin('p2', 'm2')], append: true }))

    expect(state.byChannel.c1.map((item) => item.id)).toEqual(['p1', 'p2'])
  })
})
