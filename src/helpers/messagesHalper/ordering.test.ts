import {
  compareMessageIds,
  compareMessagesForList,
  getClosestConfirmedMessageId,
  messagesShareReference,
  shouldReplaceLastMessage
} from './index'
import { makeMessage, makePendingMessage } from '../../testUtils/messageFixtures'

// Message IDs are 64-bit snowflakes serialized as strings. They exceed
// Number.MAX_SAFE_INTEGER, so ordering must never fall back to Number() or
// lexical comparison.
const BIG_A = '7290000000000000001'
const BIG_B = '7290000000000000002'

describe('compareMessageIds', () => {
  it('orders ids beyond MAX_SAFE_INTEGER without precision loss', () => {
    expect(Number(BIG_A)).toBe(Number(BIG_B)) // the trap this guards against
    expect(compareMessageIds(BIG_A, BIG_B)).toBe(-1)
    expect(compareMessageIds(BIG_B, BIG_A)).toBe(1)
    expect(compareMessageIds(BIG_A, BIG_A)).toBe(0)
  })

  it('orders numerically, not lexically', () => {
    expect(compareMessageIds('9', '10')).toBe(-1)
  })

  it('treats missing ids as lowest', () => {
    expect(compareMessageIds(undefined, undefined)).toBe(0)
    expect(compareMessageIds(null, '1')).toBe(-1)
    expect(compareMessageIds('1', '')).toBe(1)
  })
})

describe('compareMessagesForList', () => {
  it('sorts confirmed messages by id regardless of createdAt', () => {
    const later = makeMessage({ id: BIG_B, createdAt: new Date('2026-01-01') })
    const earlier = makeMessage({ id: BIG_A, createdAt: new Date('2026-06-01') })
    expect([later, earlier].sort(compareMessagesForList).map((m) => m.id)).toEqual([BIG_A, BIG_B])
  })
})

describe('messagesShareReference', () => {
  it('matches a pending message to its confirmed copy by tid', () => {
    expect(messagesShareReference({ tid: 't-1' }, { id: '5', tid: 't-1' })).toBe(true)
  })

  it('does not match unrelated messages or empty refs', () => {
    expect(messagesShareReference({ tid: 't-1' }, { id: '5', tid: 't-2' })).toBe(false)
    expect(messagesShareReference({}, {})).toBe(false)
    expect(messagesShareReference(null, { id: '1' })).toBe(false)
  })
})

describe('shouldReplaceLastMessage', () => {
  it('never replaces with an unconfirmed message', () => {
    expect(shouldReplaceLastMessage(null, makePendingMessage({ tid: 't-1' }))).toBe(false)
  })

  it('replaces an empty last message', () => {
    expect(shouldReplaceLastMessage(undefined, makeMessage({ id: '1' }))).toBe(true)
  })

  it('replaces a pending last message only with its own confirmation', () => {
    const pending = makePendingMessage({ tid: 't-1' })
    expect(shouldReplaceLastMessage(pending, makeMessage({ id: '9', tid: 't-1' }))).toBe(true)
    expect(shouldReplaceLastMessage(pending, makeMessage({ id: '9', tid: 't-other' }))).toBe(false)
  })

  it('does not regress to an older message (out-of-order event delivery)', () => {
    const current = makeMessage({ id: BIG_B })
    expect(shouldReplaceLastMessage(current, makeMessage({ id: BIG_A }))).toBe(false)
    expect(shouldReplaceLastMessage(current, makeMessage({ id: BIG_B }))).toBe(true)
  })

  it('allows replacing the current last message when it is the edited source', () => {
    const current = makeMessage({ id: BIG_B })
    expect(shouldReplaceLastMessage(current, makeMessage({ id: BIG_A }), current)).toBe(true)
  })
})

describe('getClosestConfirmedMessageId', () => {
  const list = [
    makeMessage({ id: '1' }),
    makePendingMessage({ tid: 'p-1' }),
    makePendingMessage({ tid: 'p-2' }),
    makeMessage({ id: '4' })
  ]

  it('returns empty string for an empty list', () => {
    expect(getClosestConfirmedMessageId([], 0)).toBe('')
  })

  it('respects the preferred direction when skipping pending messages', () => {
    expect(getClosestConfirmedMessageId(list, 1, 'previous')).toBe('1')
    expect(getClosestConfirmedMessageId(list, 2, 'next')).toBe('4')
  })

  it('clamps out-of-range indexes', () => {
    expect(getClosestConfirmedMessageId(list, 99)).toBe('4')
    expect(getClosestConfirmedMessageId(list, -5)).toBe('1')
  })
})
