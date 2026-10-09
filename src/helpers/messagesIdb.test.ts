import { IDBFactory } from 'fake-indexeddb'
import { makeMessage } from '../testUtils/messageFixtures'

// Helper to wait for IDB write transactions to settle
const flushWrites = () => new Promise((resolve) => setTimeout(resolve, 0))

// Each test gets a fresh IDB and a fresh module
let messagesIdb: typeof import('./messagesIdb')

describe('messagesIdb', () => {
  beforeEach(() => {
    // Fresh IDB instance for each test
    global.indexedDB = new IDBFactory()
    // Fresh module to reset dbPromise
    jest.resetModules()
    messagesIdb = require('./messagesIdb')
  })

  describe('drafts', () => {
    it('persist/restore round-trip', async () => {
      const draft = { text: 'hello', mentions: ['user-1'] }

      await messagesIdb.persistDraft('ch-draft', draft)
      await flushWrites()

      const restored = await messagesIdb.restoreDrafts()

      expect(restored).toHaveLength(1)
      expect(restored[0].channelId).toBe('ch-draft')
      expect(restored[0].draft.text).toBe('hello')
      expect(restored[0].draft.mentions).toEqual(['user-1'])
    })

    it('strips editorState from draft (not structured-cloneable)', async () => {
      const draft = { text: 'hello', editorState: { internal: 'state' } }

      await messagesIdb.persistDraft('ch-editor', draft)
      await flushWrites()

      const restored = await messagesIdb.restoreDrafts()

      expect(restored[0].draft.text).toBe('hello')
      expect(restored[0].draft.editorState).toBeUndefined()
    })

    it('drafts for different channels stay isolated', async () => {
      await messagesIdb.persistDraft('ch-1', { text: 'draft 1' })
      await messagesIdb.persistDraft('ch-2', { text: 'draft 2' })
      await messagesIdb.persistDraft('ch-3', { text: 'draft 3' })
      await flushWrites()

      await messagesIdb.removePersistedDraft('ch-2')
      await flushWrites()

      const restored = await messagesIdb.restoreDrafts()

      expect(restored).toHaveLength(2)
      expect(restored.map((d) => d.channelId).sort()).toEqual(['ch-1', 'ch-3'])
    })

    it('removePersistedDraft removes single draft', async () => {
      await messagesIdb.persistDraft('ch-remove', { text: 'remove me' })
      await flushWrites()

      await messagesIdb.removePersistedDraft('ch-remove')
      await flushWrites()

      const restored = await messagesIdb.restoreDrafts()
      expect(restored).toHaveLength(0)
    })

    it('clearPersistedDrafts removes all drafts', async () => {
      await messagesIdb.persistDraft('ch-1', { text: 'draft 1' })
      await messagesIdb.persistDraft('ch-2', { text: 'draft 2' })
      await flushWrites()

      await messagesIdb.clearPersistedDrafts()
      await flushWrites()

      const restored = await messagesIdb.restoreDrafts()
      expect(restored).toHaveLength(0)
    })

    it('persistDraft is a no-op for empty channelId', async () => {
      await messagesIdb.persistDraft('', { text: 'ignored' })
      await flushWrites()

      const restored = await messagesIdb.restoreDrafts()
      expect(restored).toHaveLength(0)
    })

    it('removePersistedDraft is a no-op for empty channelId', async () => {
      await messagesIdb.persistDraft('ch-keep', { text: 'keep me' })
      await flushWrites()

      await messagesIdb.removePersistedDraft('')
      await flushWrites()

      const restored = await messagesIdb.restoreDrafts()
      expect(restored).toHaveLength(1)
    })
  })

  describe('pins', () => {
    it('persistPinnedMessages / restorePinnedMessages with nextToken', async () => {
      const pins = [{ id: 'pin-1', message: makeMessage({ id: '1' }) }]

      await messagesIdb.persistPinnedMessages('ch-pins', pins, 'next-token-123')
      await flushWrites()

      const restored = await messagesIdb.restorePinnedMessages('ch-pins')

      expect(restored).not.toBeNull()
      expect(restored!.channelId).toBe('ch-pins')
      expect(restored!.pins).toHaveLength(1)
      expect(restored!.nextToken).toBe('next-token-123')
      expect(restored!.savedAt).toBeGreaterThan(0)
    })

    it('restorePinnedMessages returns null for unknown channel', async () => {
      const restored = await messagesIdb.restorePinnedMessages('unknown')
      expect(restored).toBeNull()
    })

    it('restorePinnedMessages returns null for empty channelId', async () => {
      const restored = await messagesIdb.restorePinnedMessages('')
      expect(restored).toBeNull()
    })

    it('persistPinnedMessages is a no-op for empty channelId', async () => {
      await messagesIdb.persistPinnedMessages('', [{ id: 'pin-1' }])
      await flushWrites()

      // Restore should return null since nothing was saved
      const restored = await messagesIdb.restorePinnedMessages('')
      expect(restored).toBeNull()
    })

    it('removePersistedPinsForChannel removes pins AND pin mutations for that channel', async () => {
      // Persist pins
      await messagesIdb.persistPinnedMessages('ch-remove', [{ id: 'pin-1' }])
      await messagesIdb.persistPinnedMessages('ch-keep', [{ id: 'pin-2' }])
      await flushWrites()

      // Persist mutations
      await messagesIdb.persistPinMutation({
        id: 'mut-1',
        channelId: 'ch-remove',
        operation: 'PIN',
        messageId: 'msg-1',
        queuedAt: Date.now()
      })
      await messagesIdb.persistPinMutation({
        id: 'mut-2',
        channelId: 'ch-keep',
        operation: 'PIN',
        messageId: 'msg-2',
        queuedAt: Date.now()
      })
      await flushWrites()

      // Remove pins for ch-remove
      await messagesIdb.removePersistedPinsForChannel('ch-remove')
      await flushWrites()

      // ch-remove pins and mutations should be gone
      const removedPins = await messagesIdb.restorePinnedMessages('ch-remove')
      expect(removedPins).toBeNull()

      const mutations = await messagesIdb.restorePinnedMutations()
      expect(mutations).toHaveLength(1)
      expect(mutations[0].channelId).toBe('ch-keep')

      // ch-keep pins should still exist
      const keptPins = await messagesIdb.restorePinnedMessages('ch-keep')
      expect(keptPins).not.toBeNull()
    })

    it('removePersistedPinsForChannel is a no-op for empty channelId', async () => {
      await messagesIdb.persistPinnedMessages('ch-keep', [{ id: 'pin-1' }])
      await flushWrites()

      await messagesIdb.removePersistedPinsForChannel('')
      await flushWrites()

      const restored = await messagesIdb.restorePinnedMessages('ch-keep')
      expect(restored).not.toBeNull()
    })
  })

  describe('pin mutations', () => {
    it('persistPinMutation / restorePinnedMutations round-trip', async () => {
      const mutation = {
        id: 'mut-1',
        channelId: 'ch-1',
        operation: 'PIN' as const,
        messageId: 'msg-1',
        message: makeMessage({ id: 'msg-1' }),
        pinType: 1,
        queuedAt: Date.now()
      }

      await messagesIdb.persistPinMutation(mutation)
      await flushWrites()

      const restored = await messagesIdb.restorePinnedMutations()

      expect(restored).toHaveLength(1)
      expect(restored[0].id).toBe('mut-1')
      expect(restored[0].channelId).toBe('ch-1')
      expect(restored[0].operation).toBe('PIN')
      expect(restored[0].messageId).toBe('msg-1')
    })

    it('removePersistedPinMutation removes single mutation', async () => {
      await messagesIdb.persistPinMutation({
        id: 'mut-remove',
        channelId: 'ch-1',
        operation: 'UNPIN',
        messageId: 'msg-1',
        queuedAt: Date.now()
      })
      await messagesIdb.persistPinMutation({
        id: 'mut-keep',
        channelId: 'ch-1',
        operation: 'PIN',
        messageId: 'msg-2',
        queuedAt: Date.now()
      })
      await flushWrites()

      await messagesIdb.removePersistedPinMutation('mut-remove')
      await flushWrites()

      const restored = await messagesIdb.restorePinnedMutations()
      expect(restored).toHaveLength(1)
      expect(restored[0].id).toBe('mut-keep')
    })

    it('removePersistedPinMutation is a no-op for empty id', async () => {
      await messagesIdb.persistPinMutation({
        id: 'mut-keep',
        channelId: 'ch-1',
        operation: 'PIN',
        messageId: 'msg-1',
        queuedAt: Date.now()
      })
      await flushWrites()

      await messagesIdb.removePersistedPinMutation('')
      await flushWrites()

      const restored = await messagesIdb.restorePinnedMutations()
      expect(restored).toHaveLength(1)
    })

    it('clearPersistedPins clears both pins and mutations', async () => {
      await messagesIdb.persistPinnedMessages('ch-1', [{ id: 'pin-1' }])
      await messagesIdb.persistPinMutation({
        id: 'mut-1',
        channelId: 'ch-1',
        operation: 'PIN',
        messageId: 'msg-1',
        queuedAt: Date.now()
      })
      await flushWrites()

      await messagesIdb.clearPersistedPins()
      await flushWrites()

      const pins = await messagesIdb.restorePinnedMessages('ch-1')
      const mutations = await messagesIdb.restorePinnedMutations()

      expect(pins).toBeNull()
      expect(mutations).toHaveLength(0)
    })
  })

  describe('initMessagesIdbForUser', () => {
    it('same user -> data kept', async () => {
      // First init with user-1
      await messagesIdb.initMessagesIdbForUser('user-1')
      await flushWrites()

      // Persist some data
      await messagesIdb.persistDraft('ch-1', { text: 'draft' })
      await messagesIdb.persistPinnedMessages('ch-1', [{ id: 'pin-1' }])
      await flushWrites()

      // Re-init with same user
      await messagesIdb.initMessagesIdbForUser('user-1')
      await flushWrites()

      // Data should still exist
      const drafts = await messagesIdb.restoreDrafts()
      const pins = await messagesIdb.restorePinnedMessages('ch-1')

      expect(drafts).toHaveLength(1)
      expect(pins).not.toBeNull()
    })

    it('different user -> drafts and pins all wiped', async () => {
      // Init with user-1 and persist data
      await messagesIdb.initMessagesIdbForUser('user-1')
      await flushWrites()

      await messagesIdb.persistDraft('ch-1', { text: 'draft' })
      await messagesIdb.persistPinnedMessages('ch-1', [{ id: 'pin-1' }])
      await messagesIdb.persistPinMutation({
        id: 'mut-1',
        channelId: 'ch-1',
        operation: 'PIN',
        messageId: 'msg-1',
        queuedAt: Date.now()
      })
      await flushWrites()

      // Switch to user-2
      await messagesIdb.initMessagesIdbForUser('user-2')
      await flushWrites()

      // All data should be wiped
      const drafts = await messagesIdb.restoreDrafts()
      const pins = await messagesIdb.restorePinnedMessages('ch-1')
      const mutations = await messagesIdb.restorePinnedMutations()

      expect(drafts).toHaveLength(0)
      expect(pins).toBeNull()
      expect(mutations).toHaveLength(0)
    })

    it('is a no-op for empty userId', async () => {
      await messagesIdb.initMessagesIdbForUser('user-1')
      await flushWrites()
      await messagesIdb.persistDraft('ch-1', { text: 'draft' })
      await flushWrites()

      await messagesIdb.initMessagesIdbForUser('')
      await flushWrites()

      // Data should still exist (empty userId is no-op)
      const drafts = await messagesIdb.restoreDrafts()
      expect(drafts).toHaveLength(1)
    })
  })

  describe('indexedDB undefined', () => {
    beforeEach(() => {
      // Remove indexedDB from global
      // @ts-expect-error - testing edge case
      delete global.indexedDB
      jest.resetModules()
      messagesIdb = require('./messagesIdb')
    })

    it('persistDraft resolves without throwing', async () => {
      await expect(messagesIdb.persistDraft('ch-1', { text: 'draft' })).resolves.toBeUndefined()
    })

    it('restoreDrafts returns empty array', async () => {
      const result = await messagesIdb.restoreDrafts()
      expect(result).toEqual([])
    })

    it('removePersistedDraft resolves without throwing', async () => {
      await expect(messagesIdb.removePersistedDraft('ch-1')).resolves.toBeUndefined()
    })

    it('clearPersistedDrafts resolves without throwing', async () => {
      await expect(messagesIdb.clearPersistedDrafts()).resolves.toBeUndefined()
    })

    it('persistPinnedMessages resolves without throwing', async () => {
      await expect(messagesIdb.persistPinnedMessages('ch-1', [])).resolves.toBeUndefined()
    })

    it('restorePinnedMessages returns null', async () => {
      const result = await messagesIdb.restorePinnedMessages('ch-1')
      expect(result).toBeNull()
    })

    it('removePersistedPinsForChannel resolves without throwing', async () => {
      await expect(messagesIdb.removePersistedPinsForChannel('ch-1')).resolves.toBeUndefined()
    })

    it('persistPinMutation resolves without throwing', async () => {
      await expect(
        messagesIdb.persistPinMutation({
          id: 'mut-1',
          channelId: 'ch-1',
          operation: 'PIN',
          messageId: 'msg-1',
          queuedAt: Date.now()
        })
      ).resolves.toBeUndefined()
    })

    it('restorePinnedMutations returns empty array', async () => {
      const result = await messagesIdb.restorePinnedMutations()
      expect(result).toEqual([])
    })

    it('removePersistedPinMutation resolves without throwing', async () => {
      await expect(messagesIdb.removePersistedPinMutation('mut-1')).resolves.toBeUndefined()
    })

    it('clearPersistedPins resolves without throwing', async () => {
      await expect(messagesIdb.clearPersistedPins()).resolves.toBeUndefined()
    })

    it('initMessagesIdbForUser resolves without throwing', async () => {
      await expect(messagesIdb.initMessagesIdbForUser('user-1')).resolves.toBeUndefined()
    })
  })

  describe('indexedDB.open fails or is blocked', () => {
    it('functions resolve safely when open fails', async () => {
      // Create a mock IDB that fails on open
      const mockIndexedDB = {
        open: jest.fn().mockImplementation(() => {
          const request = {
            result: null,
            error: new Error('QuotaExceededError'),
            onupgradeneeded: null as any,
            onsuccess: null as any,
            onerror: null as any,
            onblocked: null as any
          }
          // Simulate async error
          setTimeout(() => {
            if (request.onerror) request.onerror()
          }, 0)
          return request
        })
      }
      // @ts-expect-error - mock
      global.indexedDB = mockIndexedDB
      jest.resetModules()
      messagesIdb = require('./messagesIdb')

      // All functions should resolve safely
      await expect(messagesIdb.persistDraft('ch-1', {})).resolves.toBeUndefined()
      await expect(messagesIdb.restoreDrafts()).resolves.toEqual([])
    })

    it('functions resolve safely when open is blocked', async () => {
      // Create a mock IDB that is blocked
      const mockIndexedDB = {
        open: jest.fn().mockImplementation(() => {
          const request = {
            result: null,
            error: null,
            onupgradeneeded: null as any,
            onsuccess: null as any,
            onerror: null as any,
            onblocked: null as any
          }
          // Simulate blocked
          setTimeout(() => {
            if (request.onblocked) request.onblocked()
          }, 0)
          return request
        })
      }
      // @ts-expect-error - mock
      global.indexedDB = mockIndexedDB
      jest.resetModules()
      messagesIdb = require('./messagesIdb')

      await expect(messagesIdb.restoreDrafts()).resolves.toEqual([])
    })

    it('retries opening the DB on a later call after an initial open failure', async () => {
      const failingIndexedDB = {
        open: jest.fn().mockImplementation(() => {
          const request: any = { result: null, error: new Error('QuotaExceededError') }
          setTimeout(() => request.onerror && request.onerror(), 0)
          return request
        })
      }
      // @ts-expect-error - mock
      global.indexedDB = failingIndexedDB
      jest.resetModules()
      messagesIdb = require('./messagesIdb')

      // First call: open fails, resolves safely
      await expect(messagesIdb.restoreDrafts()).resolves.toEqual([])

      // The underlying problem goes away: a working IndexedDB is available again
      global.indexedDB = new IDBFactory()

      // Same module instance must retry and be able to write and read back
      await messagesIdb.persistDraft('ch-1', { text: 'after retry' })
      await new Promise((resolve) => setTimeout(resolve, 0))

      const drafts = await messagesIdb.restoreDrafts()
      expect(drafts.map((d: any) => d.channelId)).toEqual(['ch-1'])
      expect(failingIndexedDB.open).toHaveBeenCalledTimes(1)
    })

    it('retries after a blocked open', async () => {
      const blockedIndexedDB = {
        open: jest.fn().mockImplementation(() => {
          const request: any = { result: null }
          setTimeout(() => request.onblocked && request.onblocked(), 0)
          return request
        })
      }
      // @ts-expect-error - mock
      global.indexedDB = blockedIndexedDB
      jest.resetModules()
      messagesIdb = require('./messagesIdb')

      await expect(messagesIdb.restoreDrafts()).resolves.toEqual([])

      global.indexedDB = new IDBFactory()
      await messagesIdb.persistDraft('ch-1', { text: 'hello' })
      await new Promise((resolve) => setTimeout(resolve, 0))

      const drafts = await messagesIdb.restoreDrafts()
      expect(drafts.map((d: any) => d.channelId)).toEqual(['ch-1'])
    })
  })

  describe('messages are not stored in IndexedDB', () => {
    it('does not export message cache persistence', () => {
      expect((messagesIdb as any).persistChannelMessages).toBeUndefined()
      expect((messagesIdb as any).restoreChannelMessages).toBeUndefined()
    })

    // Creates the database the way the earlier build did (version 3) with a
    // stored message cache and a draft. Returns the open connection.
    const openAsEarlierBuild = () =>
      new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('sceyt-uikit-messages', 3)
        request.onupgradeneeded = () => {
          const db = request.result
          db.createObjectStore('channels', { keyPath: 'channelId' }).createIndex('savedAt', 'savedAt')
          db.createObjectStore('drafts', { keyPath: 'channelId' })
          db.createObjectStore('meta')
          db.createObjectStore('pins', { keyPath: 'channelId' }).createIndex('savedAt', 'savedAt')
          db.createObjectStore('pinMutations', { keyPath: 'id' }).createIndex('channelId', 'channelId')
        }
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction(['channels', 'drafts'], 'readwrite')
          tx.objectStore('channels').put({ channelId: 'ch-1', messages: [makeMessage({ id: '1' })], segments: [] })
          tx.objectStore('drafts').put({ channelId: 'ch-1', draft: { text: 'kept' }, savedAt: 1 })
          tx.oncomplete = () => resolve(db)
        }
        request.onerror = () => reject(request.error)
      })

    const readRaw = () =>
      new Promise<{ version: number; stores: string[]; channelRecords: number }>((resolve) => {
        const request = indexedDB.open('sceyt-uikit-messages')
        request.onsuccess = () => {
          const db = request.result
          const stores = Array.from(db.objectStoreNames)
          const count = db.transaction('channels', 'readonly').objectStore('channels').count()
          count.onsuccess = () => {
            resolve({ version: db.version, stores, channelRecords: count.result })
            db.close()
          }
        }
      })

    it('keeps version 3 and the same stores, empties message caches stored by earlier builds and keeps drafts', async () => {
      const earlier = await openAsEarlierBuild()
      earlier.close()

      const drafts = await messagesIdb.restoreDrafts()
      await flushWrites()

      expect(drafts.map((d: any) => d.draft.text)).toEqual(['kept'])
      const raw = await readRaw()
      expect(raw.version).toBe(3)
      expect(raw.stores.sort()).toEqual(['channels', 'drafts', 'meta', 'pinMutations', 'pins'])
      expect(raw.channelRecords).toBe(0)
    })

    it('a tab still running the earlier build (database open) does not block drafts and pins', async () => {
      const earlierTab = await openAsEarlierBuild()

      await messagesIdb.persistDraft('ch-2', { text: 'saved while the old tab is open' })
      await messagesIdb.persistPinnedMessages('ch-2', [{ id: 'pin-1' }])
      await flushWrites()

      expect((await messagesIdb.restoreDrafts()).map((d: any) => d.channelId).sort()).toEqual(['ch-1', 'ch-2'])
      expect(await messagesIdb.restorePinnedMessages('ch-2')).not.toBeNull()
      earlierTab.close()
    })

    it('a fresh install creates the same schema as the earlier build', async () => {
      await messagesIdb.restoreDrafts()

      const raw = await readRaw()
      expect(raw.version).toBe(3)
      expect(raw.stores.sort()).toEqual(['channels', 'drafts', 'meta', 'pinMutations', 'pins'])
    })

    it('closes its connection when another tab upgrades, so that upgrade is not blocked', async () => {
      await messagesIdb.persistDraft('ch-1', { text: 'draft' })
      await flushWrites()

      const upgraded = await new Promise<string>((resolve) => {
        const request = indexedDB.open('sceyt-uikit-messages', 4)
        request.onblocked = () => resolve('blocked')
        request.onsuccess = () => {
          request.result.close()
          resolve('upgraded')
        }
        request.onerror = () => resolve('error')
      })

      expect(upgraded).toBe('upgraded')
    })
  })
})
