import log from 'loglevel'
import { IMessage } from '../types'

// IndexedDB spill store for per-channel message caches evicted from the
// in-memory messagesMap (see messagesHalper). Keeping evicted channels on disk
// preserves the instant-reopen experience while bounding JS heap usage.
// Every operation degrades to a no-op when IndexedDB is unavailable.

const DB_NAME = 'sceyt-uikit-messages'
const DB_VERSION = 1
const CHANNELS_STORE = 'channels'
const META_STORE = 'meta'
const USER_META_KEY = 'userId'
export const IDB_MAX_STORED_CHANNELS = 200
export const IDB_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

export type PersistedChannelCache = {
  channelId: string
  messages: IMessage[]
  segments: Array<{ startId: string; endId: string }>
  savedAt: number
}

let dbPromise: Promise<IDBDatabase | null> | null = null

const openDb = (): Promise<IDBDatabase | null> => {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null)
  }
  if (dbPromise) {
    return dbPromise
  }
  dbPromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(CHANNELS_STORE)) {
          const store = db.createObjectStore(CHANNELS_STORE, { keyPath: 'channelId' })
          store.createIndex('savedAt', 'savedAt')
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE)
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => {
        log.info('messagesIdb: failed to open database', request.error)
        resolve(null)
      }
      request.onblocked = () => resolve(null)
    } catch (e) {
      log.info('messagesIdb: indexedDB unavailable', e)
      resolve(null)
    }
  })
  return dbPromise
}

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

// Files and blob: URLs must never be persisted — Files aren't valid after a
// reload and blob URLs are revoked with the session.
const sanitizeMessageForPersist = (message: IMessage): IMessage => {
  if (!message?.attachments?.length) {
    return message
  }
  return {
    ...message,
    attachments: message.attachments.map((attachment: any) => {
      const { data, ...rest } = attachment || {}
      if (rest.attachmentUrl && String(rest.attachmentUrl).startsWith('blob:')) {
        rest.attachmentUrl = undefined
      }
      return rest
    })
  } as IMessage
}

export const persistChannelMessages = async (
  channelId: string,
  messages: IMessage[],
  segments: Array<{ startId: string; endId: string }>
): Promise<void> => {
  if (!channelId || !messages.length) {
    return
  }
  const db = await openDb()
  if (!db) {
    return
  }
  try {
    const record: PersistedChannelCache = {
      channelId,
      messages: messages.map(sanitizeMessageForPersist),
      segments,
      savedAt: Date.now()
    }
    const tx = db.transaction(CHANNELS_STORE, 'readwrite')
    tx.objectStore(CHANNELS_STORE).put(record)
  } catch (e) {
    log.info('messagesIdb: failed to persist channel cache', e)
  }
}

export const restoreChannelMessages = async (channelId: string): Promise<PersistedChannelCache | null> => {
  if (!channelId) {
    return null
  }
  const db = await openDb()
  if (!db) {
    return null
  }
  try {
    const tx = db.transaction(CHANNELS_STORE, 'readonly')
    const record = await requestToPromise<PersistedChannelCache | undefined>(
      tx.objectStore(CHANNELS_STORE).get(channelId)
    )
    return record || null
  } catch (e) {
    log.info('messagesIdb: failed to restore channel cache', e)
    return null
  }
}

export const removePersistedChannel = async (channelId: string): Promise<void> => {
  const db = await openDb()
  if (!db) {
    return
  }
  try {
    db.transaction(CHANNELS_STORE, 'readwrite').objectStore(CHANNELS_STORE).delete(channelId)
  } catch (e) {
    // ignore
  }
}

export const clearPersistedChannels = async (): Promise<void> => {
  const db = await openDb()
  if (!db) {
    return
  }
  try {
    db.transaction(CHANNELS_STORE, 'readwrite').objectStore(CHANNELS_STORE).clear()
  } catch (e) {
    // ignore
  }
}

// Wipes the spilled caches when a different user connects (multi-account
// safety) and prunes stale/overflowing entries.
export const initMessagesIdbForUser = async (userId: string): Promise<void> => {
  if (!userId) {
    return
  }
  const db = await openDb()
  if (!db) {
    return
  }
  try {
    const metaTx = db.transaction(META_STORE, 'readonly')
    const storedUserId = await requestToPromise<string | undefined>(metaTx.objectStore(META_STORE).get(USER_META_KEY))
    if (storedUserId !== userId) {
      await clearPersistedChannels()
      db.transaction(META_STORE, 'readwrite').objectStore(META_STORE).put(userId, USER_META_KEY)
      return
    }

    const tx = db.transaction(CHANNELS_STORE, 'readwrite')
    const store = tx.objectStore(CHANNELS_STORE)
    const index = store.index('savedAt')
    const keys = await requestToPromise<IDBValidKey[]>(index.getAllKeys())
    const now = Date.now()
    // getAllKeys on the savedAt index returns primary keys ordered by savedAt
    // (oldest first) — drop expired entries and anything over the cap.
    const savedAtValues = await requestToPromise<PersistedChannelCache[]>(index.getAll())
    const toDelete = new Set<IDBValidKey>()
    savedAtValues.forEach((record, i) => {
      if (now - record.savedAt > IDB_MAX_AGE_MS) {
        toDelete.add(keys[i])
      }
    })
    const remaining = keys.filter((key) => !toDelete.has(key))
    const overflow = remaining.length - IDB_MAX_STORED_CHANNELS
    for (let i = 0; i < overflow; i++) {
      toDelete.add(remaining[i])
    }
    toDelete.forEach((key) => store.delete(key))
  } catch (e) {
    log.info('messagesIdb: init/prune failed', e)
  }
}
