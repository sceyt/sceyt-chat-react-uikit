import { IMarker, IMessage } from '../types'

type MessageIdentity = Pick<IMessage, 'channelId' | 'id' | 'tid'>
type ReceiptNode = { key: string } | { children: Record<number, ReceiptNode> } | { collisions: string[] }

export type RemoteReceiptState = {
  readonly channelId: string
  readonly messageId: string
  readonly receipts: ReceiptNode
}

const receiptKey = (marker?: Partial<IMarker>) =>
  marker?.name && marker.user?.id ? JSON.stringify([marker.name, marker.user.id]) : undefined
const matchesMessage = (state: RemoteReceiptState, message: MessageIdentity) =>
  state.channelId === message.channelId && state.messageId === (message.id || message.tid || '')
const hashKey = (key: string) => {
  let hash = 2166136261
  for (let index = 0; index < key.length; index++) hash = Math.imul(hash ^ key.charCodeAt(index), 16777619)
  return hash >>> 0
}
const slot = (hash: number, depth: number) => (hash >>> (depth * 4)) & 15

// A persistent 16-way hash trie: at most eight small branches are copied when
// adding a reader. Helpers never mutate existing nodes; hash collisions retain
// keys. Node types also accept Immer drafts in the Redux event index.
const insert = (node: ReceiptNode | undefined, key: string, hash: number, depth = 0): ReceiptNode => {
  if (!node) return { key }
  if ('key' in node) {
    if (node.key === key) return node
    if (depth === 8) return { collisions: [node.key, key] }
    const oldSlot = slot(hashKey(node.key), depth)
    const newSlot = slot(hash, depth)
    return {
      children:
        oldSlot === newSlot
          ? { [newSlot]: insert(node, key, hash, depth + 1) }
          : { [oldSlot]: node, [newSlot]: { key } }
    }
  }
  if ('collisions' in node) {
    return node.collisions.includes(key) ? node : { collisions: [...node.collisions, key] }
  }
  const index = slot(hash, depth)
  const child = insert(node.children[index], key, hash, depth + 1)
  return child === node.children[index] ? node : { children: { ...node.children, [index]: child } }
}

export const hasRemoteReceipt = (
  state: RemoteReceiptState | null | undefined,
  message: MessageIdentity,
  marker?: Partial<IMarker>
) => {
  const key = receiptKey(marker)
  if (!state || !key || !matchesMessage(state, message)) return false
  const hash = hashKey(key)
  let node: ReceiptNode | undefined = state.receipts
  let depth = 0
  while (node) {
    if ('key' in node) return node.key === key
    if ('collisions' in node) return node.collisions.includes(key)
    node = node.children[slot(hash, depth++)]
  }
  return false
}

export const addRemoteReceipt = (
  state: RemoteReceiptState | undefined,
  message: MessageIdentity,
  marker?: Partial<IMarker>
): RemoteReceiptState | undefined => {
  const key = receiptKey(marker)
  if (!key) return state
  const previous = state && matchesMessage(state, message) ? state.receipts : undefined
  const receipts = insert(previous, key, hashKey(key))
  return receipts === previous
    ? state
    : { channelId: message.channelId, messageId: message.id || message.tid || '', receipts }
}
