import { addRemoteReceipt, hasRemoteReceipt, mergeRemoteReceipts } from './remoteReceiptProvenance'
import { MESSAGE_DELIVERY_STATUS } from './constants'
import { makeMessage, makeUser } from '../testUtils/messageFixtures'

const message = makeMessage({ id: '9007199254741001', channelId: 'receipt-index' })
const marker = (id: string, name = MESSAGE_DELIVERY_STATUS.READ) => ({ name, user: makeUser({ id }) })

it('keeps distinct readers with the same hash separate', () => {
  // These two complete receipt keys have the same 32-bit FNV-1a hash.
  const first = marker('collision-reader-e6a650ffe30cd1d3')
  const second = marker('collision-reader-31468b85c559497e')
  const one = addRemoteReceipt(undefined, message, first)!
  const both = addRemoteReceipt(one, message, second)!
  expect(hasRemoteReceipt(one, message, second)).toBe(false)
  expect(hasRemoteReceipt(both, message, first)).toBe(true)
  expect(hasRemoteReceipt(both, message, second)).toBe(true)
  expect(hasRemoteReceipt(both, message, marker('unrelated-reader'))).toBe(false)
  expect(addRemoteReceipt(both, message, first)).toBe(both)
  expect(addRemoteReceipt(both, message, second)).toBe(both)
})

it('accepts frozen provenance without mutating it, including different names for the same reader', () => {
  const read = marker('reader')
  const one = addRemoteReceipt(undefined, message, read)!
  Object.freeze(one.receipts)
  Object.freeze(one)
  const delivered = marker('reader', MESSAGE_DELIVERY_STATUS.DELIVERED)
  const both = addRemoteReceipt(one, message, delivered)!
  expect(hasRemoteReceipt(one, message, delivered)).toBe(false)
  expect(hasRemoteReceipt(both, message, delivered)).toBe(true)
  expect(hasRemoteReceipt(both, message, read)).toBe(true)
})

it('ignores unidentifiable receipts instead of allocating tracking state', () => {
  const one = addRemoteReceipt(undefined, message, marker('reader'))!
  for (const incomplete of [undefined, {}, { name: MESSAGE_DELIVERY_STATUS.READ }, { user: makeUser() }]) {
    expect(addRemoteReceipt(undefined, message, incomplete)).toBeUndefined()
    expect(addRemoteReceipt(one, message, incomplete)).toBe(one)
    expect(hasRemoteReceipt(one, message, incomplete)).toBe(false)
  }
})

it('isolates pending temporary identities and resets provenance when the message identity changes', () => {
  const pending = { ...message, id: '', tid: 'local-a' }
  const receipt = marker('reader')
  const one = addRemoteReceipt(undefined, pending, receipt)!
  const another = { ...pending, tid: 'local-b' }
  expect(hasRemoteReceipt(one, another, receipt)).toBe(false)
  const next = addRemoteReceipt(one, another, marker('other-reader'))!
  expect(hasRemoteReceipt(next, another, receipt)).toBe(false)
  expect(hasRemoteReceipt(next, another, marker('other-reader'))).toBe(true)
  expect(hasRemoteReceipt(one, pending, receipt)).toBe(true)
})

it('merges the readers of two copies of the same message without mutating either', () => {
  const readers = Array.from({ length: 40 }, (_, index) => marker(`reader-${index}`))
  const left = readers.slice(0, 25).reduce((state, receipt) => addRemoteReceipt(state, message, receipt), undefined)!
  const right = readers.slice(15).reduce((state, receipt) => addRemoteReceipt(state, message, receipt), undefined)!
  Object.freeze(left)
  Object.freeze(right)
  const merged = mergeRemoteReceipts(left, right)!
  for (const receipt of readers) expect(hasRemoteReceipt(merged, message, receipt)).toBe(true)
  expect(hasRemoteReceipt(left, message, readers[39])).toBe(false)
  expect(hasRemoteReceipt(right, message, readers[0])).toBe(false)
  // Nothing new to add returns the same record.
  expect(mergeRemoteReceipts(merged, left)).toBe(merged)
  expect(mergeRemoteReceipts(undefined, left)).toBe(left)
  expect(mergeRemoteReceipts(left, undefined)).toBe(left)
})

it('does not merge readers recorded for a different message', () => {
  const other = makeMessage({ id: '9007199254741002', channelId: 'receipt-index' })
  const mine = addRemoteReceipt(undefined, message, marker('reader'))!
  const theirs = addRemoteReceipt(undefined, other, marker('someone-else'))!
  expect(mergeRemoteReceipts(mine, theirs)).toBe(mine)
})
