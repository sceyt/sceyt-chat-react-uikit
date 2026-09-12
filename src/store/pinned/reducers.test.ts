import PinnedReducer, {
  clearPinnedMessages,
  removePinnedMessages,
  setPendingPinMutation,
  setPinnedMessages,
  upsertPinnedMessages
} from './reducers'
import { updateMessage } from '../message/reducers'
import { MESSAGE_STATUS } from '../../helpers/constants'

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

  it('merges the newest server page into cached pins without dropping cached older pages', () => {
    let state = PinnedReducer(
      undefined,
      setPinnedMessages({ channelId: 'c1', pins: [pin('cached-new', 'm3'), pin('cached-old', 'm1')] })
    )
    state = PinnedReducer(
      state,
      setPinnedMessages({
        channelId: 'c1',
        pins: [pin('server-new', 'm4'), pin('cached-new', 'm3')],
        nextToken: 'cursor-2',
        merge: true
      })
    )

    expect(state.byChannel.c1.map((item) => item.id)).toEqual(['server-new', 'cached-new', 'cached-old'])
    expect(state.cursors.c1).toBe('cursor-2')
  })

  it('replaces cached pins when the server response has no next cursor', () => {
    let state = PinnedReducer(
      undefined,
      setPinnedMessages({ channelId: 'c1', pins: [pin('cached-stale', 'm1'), pin('cached-current', 'm2')] })
    )
    state = PinnedReducer(
      state,
      setPinnedMessages({ channelId: 'c1', pins: [pin('server-current', 'm3')], nextToken: undefined })
    )

    expect(state.byChannel.c1.map((item) => item.id)).toEqual(['server-current'])
    expect(state.cursors.c1).toBeUndefined()
  })

  it('updates a pinned source snapshot when the message is updated', () => {
    let state = PinnedReducer(undefined, setPinnedMessages({ channelId: 'c1', pins: [pin('p1', 'm1')] }))
    state = PinnedReducer(state, updateMessage({ messageId: 'm1', params: { body: 'Edited pinned text' } as any }))

    expect(state.byChannel.c1[0].message.body).toBe('Edited pinned text')
  })

  it('removes a pin immediately when its source message is deleted by an update event', () => {
    let state = PinnedReducer(undefined, setPinnedMessages({ channelId: 'c1', pins: [pin('p1', 'm1')] }))
    state = PinnedReducer(state, updateMessage({ messageId: 'm1', params: { state: MESSAGE_STATUS.DELETE } as any }))

    expect(state.byChannel.c1).toEqual([])
  })

  it('clears only the selected channel pins, cursors, and queued mutations', () => {
    let state = PinnedReducer(
      undefined,
      setPinnedMessages({ channelId: 'c1', pins: [pin('p1', 'm1')], nextToken: 'next' })
    )
    state = PinnedReducer(state, setPinnedMessages({ channelId: 'c2', pins: [pin('p2', 'm2')] }))
    state = PinnedReducer(
      state,
      setPendingPinMutation({
        mutation: { id: 'c1-mutation', channelId: 'c1', operation: 'PIN', messageId: 'm1', queuedAt: 1 }
      })
    )
    state = PinnedReducer(
      state,
      setPendingPinMutation({
        mutation: { id: 'c2-mutation', channelId: 'c2', operation: 'PIN', messageId: 'm2', queuedAt: 1 }
      })
    )

    state = PinnedReducer(state, clearPinnedMessages({ channelId: 'c1' }))

    expect(state.byChannel.c1).toBeUndefined()
    expect(state.cursors.c1).toBeUndefined()
    expect(state.pendingMutations['c1-mutation']).toBeUndefined()
    expect(state.byChannel.c2).toHaveLength(1)
    expect(state.pendingMutations['c2-mutation']).toBeDefined()
  })
})
