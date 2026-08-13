import log from 'loglevel'
import { IMessage } from '../types'

// IndexedDB spill store for per-channel message caches evicted from the
// in-memory messagesMap (see messagesHalper). Keeping evicted channels on disk
// preserves the instant-reopen experience while bounding JS heap usage.
// Every operation degrades to a no-op when IndexedDB is unavailable.

const DB_NAME = 'sceyt-uikit-messages'
const DB_VERSION = 2
const CHANNELS_STORE = 'channels'
const DRAFTS_STORE = 'drafts'
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

export type PersistedDraft = {
  channelId: string
  draft: any
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
        if (!db.objectStoreNames.contains(DRAFTS_STORE)) {
          db.createObjectStore(DRAFTS_STORE, { keyPath: 'channelId' })
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

// Messages can contain SDK model instances. Besides Files and blob URLs, those
// instances may expose helper functions as own properties, which IndexedDB's
// structured clone algorithm rejects. Persist a plain data snapshot instead.
const toStructuredCloneSafeValue = (value: any, seen = new WeakSet<object>()): any => {
  if (value === null || typeof value !== 'object') {
    return typeof value === 'function' || typeof value === 'symbol' ? undefined : value
  }
  if (value instanceof Date) {
    return new Date(value.getTime())
  }
  if (seen.has(value)) {
    return undefined
  }
  seen.add(value)
  if (Array.isArray(value)) {
    return value.map((item) => toStructuredCloneSafeValue(item, seen))
  }
  return Object.keys(value).reduce<Record<string, any>>((snapshot, key) => {
    const safeValue = toStructuredCloneSafeValue(value[key], seen)
    if (safeValue !== undefined) {
      snapshot[key] = safeValue
    }
    return snapshot
  }, {})
}

// Files and blob: URLs must never be persisted — Files aren't valid after a
// reload and blob URLs are revoked with the session.
export const sanitizeMessageForPersist = (message: IMessage): IMessage => {
  const sanitizedMessage = toStructuredCloneSafeValue(message) as IMessage
  if (!sanitizedMessage?.attachments?.length) {
    return sanitizedMessage
  }
  return {
    ...sanitizedMessage,
    attachments: sanitizedMessage.attachments.map((attachment: any) => {
      const rest = { ...(attachment || {}) }
      delete rest.data
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

export const persistDraft = async (channelId: string, draft: any): Promise<void> => {
  const db = await openDb()
  if (!db || !channelId) return
  try {
    // Lexical EditorState is session-bound and not structured-cloneable. Text,
    // attributes and mentions are enough to rebuild the compose editor on reload.
    const persistedDraft = { ...(draft || {}) }
    delete persistedDraft.editorState
    db.transaction(DRAFTS_STORE, 'readwrite').objectStore(DRAFTS_STORE).put({
      channelId,
      draft: persistedDraft,
      savedAt: Date.now()
    })
  } catch (e) {
    log.info('messagesIdb: failed to persist draft', e)
  }
}

export const restoreDrafts = async (): Promise<PersistedDraft[]> => {
  const db = await openDb()
  if (!db) return []
  try {
    return await requestToPromise<PersistedDraft[]>(
      db.transaction(DRAFTS_STORE, 'readonly').objectStore(DRAFTS_STORE).getAll()
    )
  } catch (e) {
    log.info('messagesIdb: failed to restore drafts', e)
    return []
  }
}

export const removePersistedDraft = async (channelId: string): Promise<void> => {
  const db = await openDb()
  if (!db || !channelId) return
  try {
    db.transaction(DRAFTS_STORE, 'readwrite').objectStore(DRAFTS_STORE).delete(channelId)
  } catch (e) {
    log.info('messagesIdb: failed to remove draft', e)
  }
}

export const clearPersistedDrafts = async (): Promise<void> => {
  const db = await openDb()
  if (!db) return
  try {
    db.transaction(DRAFTS_STORE, 'readwrite').objectStore(DRAFTS_STORE).clear()
  } catch (e) {
    log.info('messagesIdb: failed to clear drafts', e)
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
      await clearPersistedDrafts()
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
