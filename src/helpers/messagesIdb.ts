import log from 'loglevel'

// IndexedDB store for drafts and pinned messages. Messages themselves are not
// stored here: the message cache lives in memory only (see messagesHalper).
// Every operation degrades to a no-op when IndexedDB is unavailable.

const DB_NAME = 'sceyt-uikit-messages'
// The version stays 3 (same schema as before), so a tab still running an
// older build can't block an upgrade.
const DB_VERSION = 3
// Message caches stored by earlier builds. The store is kept in the schema for
// those builds, but this build never reads it and empties it on open.
const LEGACY_CHANNELS_STORE = 'channels'
const DRAFTS_STORE = 'drafts'
const META_STORE = 'meta'
const PINS_STORE = 'pins'
const PIN_MUTATIONS_STORE = 'pinMutations'
const USER_META_KEY = 'userId'

export type PersistedDraft = {
  channelId: string
  draft: any
  savedAt: number
}

export type PersistedPinnedMessages = {
  channelId: string
  pins: any[]
  nextToken?: string
  savedAt: number
}

export type PersistedPinMutation = {
  id: string
  channelId: string
  operation: 'PIN' | 'UNPIN'
  messageId: string
  message?: any
  pinType?: number
  queuedAt: number
}

let dbPromise: Promise<IDBDatabase | null> | null = null

// Empties the message caches stored by earlier builds (never read any more).
const clearLegacyMessageCaches = (db: IDBDatabase) => {
  try {
    if (db.objectStoreNames.contains(LEGACY_CHANNELS_STORE)) {
      db.transaction(LEGACY_CHANNELS_STORE, 'readwrite').objectStore(LEGACY_CHANNELS_STORE).clear()
    }
  } catch (e) {
    log.info('messagesIdb: failed to clear legacy message caches', e)
  }
}

const openDb = (): Promise<IDBDatabase | null> => {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null)
  }
  if (dbPromise) {
    return dbPromise
  }
  // A failed or blocked open must not be cached: reset so a later call retries
  // (e.g. after another tab releases an old-version connection).
  const fail = (resolve: (db: IDBDatabase | null) => void) => {
    dbPromise = null
    resolve(null)
  }
  dbPromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(LEGACY_CHANNELS_STORE)) {
          const store = db.createObjectStore(LEGACY_CHANNELS_STORE, { keyPath: 'channelId' })
          store.createIndex('savedAt', 'savedAt')
        }
        if (!db.objectStoreNames.contains(DRAFTS_STORE)) {
          db.createObjectStore(DRAFTS_STORE, { keyPath: 'channelId' })
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE)
        }
        if (!db.objectStoreNames.contains(PINS_STORE)) {
          const store = db.createObjectStore(PINS_STORE, { keyPath: 'channelId' })
          store.createIndex('savedAt', 'savedAt')
        }
        if (!db.objectStoreNames.contains(PIN_MUTATIONS_STORE)) {
          const store = db.createObjectStore(PIN_MUTATIONS_STORE, { keyPath: 'id' })
          store.createIndex('channelId', 'channelId')
        }
      }
      request.onsuccess = () => {
        const db = request.result
        // Let a future upgrade from another tab go through instead of being blocked by this tab.
        db.onversionchange = () => {
          db.close()
          dbPromise = null
        }
        clearLegacyMessageCaches(db)
        resolve(db)
      }
      request.onerror = () => {
        log.info('messagesIdb: failed to open database', request.error)
        fail(resolve)
      }
      request.onblocked = () => fail(resolve)
    } catch (e) {
      log.info('messagesIdb: indexedDB unavailable', e)
      fail(resolve)
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

export const persistPinnedMessages = async (channelId: string, pins: any[], nextToken?: string): Promise<void> => {
  if (!channelId) return
  const db = await openDb()
  if (!db) return
  try {
    db.transaction(PINS_STORE, 'readwrite')
      .objectStore(PINS_STORE)
      .put({
        channelId,
        pins: toStructuredCloneSafeValue(pins),
        nextToken,
        savedAt: Date.now()
      } as PersistedPinnedMessages)
  } catch (e) {
    log.info('messagesIdb: failed to persist pins', e)
  }
}

export const restorePinnedMessages = async (channelId: string): Promise<PersistedPinnedMessages | null> => {
  if (!channelId) return null
  const db = await openDb()
  if (!db) return null
  try {
    return (
      (await requestToPromise<PersistedPinnedMessages | undefined>(
        db.transaction(PINS_STORE, 'readonly').objectStore(PINS_STORE).get(channelId)
      )) || null
    )
  } catch (e) {
    log.info('messagesIdb: failed to restore pins', e)
    return null
  }
}

export const removePersistedPinsForChannel = async (channelId: string): Promise<void> => {
  if (!channelId) return
  const db = await openDb()
  if (!db) return
  try {
    db.transaction(PINS_STORE, 'readwrite').objectStore(PINS_STORE).delete(channelId)

    const mutations = await requestToPromise<PersistedPinMutation[]>(
      db
        .transaction(PIN_MUTATIONS_STORE, 'readonly')
        .objectStore(PIN_MUTATIONS_STORE)
        .index('channelId')
        .getAll(channelId)
    )
    if (!mutations.length) return

    const mutationsStore = db.transaction(PIN_MUTATIONS_STORE, 'readwrite').objectStore(PIN_MUTATIONS_STORE)
    mutations.forEach((mutation) => mutationsStore.delete(mutation.id))
  } catch (e) {
    log.info('messagesIdb: failed to remove channel pins', e)
  }
}

export const persistPinMutation = async (mutation: PersistedPinMutation): Promise<void> => {
  const db = await openDb()
  if (!db) return
  try {
    db.transaction(PIN_MUTATIONS_STORE, 'readwrite').objectStore(PIN_MUTATIONS_STORE).put(mutation)
  } catch (e) {
    log.info('messagesIdb: failed to persist pin mutation', e)
  }
}

export const removePersistedPinMutation = async (id: string): Promise<void> => {
  const db = await openDb()
  if (!db || !id) return
  try {
    db.transaction(PIN_MUTATIONS_STORE, 'readwrite').objectStore(PIN_MUTATIONS_STORE).delete(id)
  } catch (_) {
    // A retry on next reconnect is safe.
  }
}

export const restorePinnedMutations = async (): Promise<PersistedPinMutation[]> => {
  const db = await openDb()
  if (!db) return []
  try {
    return await requestToPromise<PersistedPinMutation[]>(
      db.transaction(PIN_MUTATIONS_STORE, 'readonly').objectStore(PIN_MUTATIONS_STORE).getAll()
    )
  } catch (e) {
    log.info('messagesIdb: failed to restore pin mutations', e)
    return []
  }
}

export const clearPersistedPins = async (): Promise<void> => {
  const db = await openDb()
  if (!db) return
  try {
    const tx = db.transaction([PINS_STORE, PIN_MUTATIONS_STORE], 'readwrite')
    tx.objectStore(PINS_STORE).clear()
    tx.objectStore(PIN_MUTATIONS_STORE).clear()
  } catch (_) {
    // ignore
  }
}

// Wipes drafts and pins when a different user connects (multi-account safety).
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
      await clearPersistedDrafts()
      await clearPersistedPins()
      db.transaction(META_STORE, 'readwrite').objectStore(META_STORE).put(userId, USER_META_KEY)
    }
  } catch (e) {
    log.info('messagesIdb: init failed', e)
  }
}
