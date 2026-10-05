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

  describe('sanitizeMessageForPersist', () => {
    it('removes SDK helper functions before writing a message to IndexedDB', () => {
      const message: any = makeMessage({
        requestedMentionUserIds: (() => ['user-1']) as any,
        metadata: { resolveMention: () => ['user-1'] }
      })

      const sanitized = messagesIdb.sanitizeMessageForPersist(message)

      expect(sanitized).not.toBe(message)
      expect(sanitized.requestedMentionUserIds).toBeUndefined()
      expect((sanitized.metadata as any).resolveMention).toBeUndefined()
      expect(() => structuredClone(sanitized)).not.toThrow()
    })

    it('keeps valid mention ids while sanitizing attachments', () => {
      const message = makeMessage({
        requestedMentionUserIds: ['user-1'],
        attachments: [{ attachmentUrl: 'blob:session-file', data: new Blob(['file']) } as any]
      })

      const sanitized = messagesIdb.sanitizeMessageForPersist(message)

      expect(sanitized.requestedMentionUserIds).toEqual(['user-1'])
      expect(sanitized.attachments[0]).toEqual({ attachmentUrl: undefined })
    })

    it('removes blob: URLs from attachmentUrl', () => {
      const message = makeMessage({
        attachments: [
          { attachmentUrl: 'blob:http://localhost/abc123', name: 'file.pdf' } as any,
          { attachmentUrl: 'https://cdn.example.com/file.pdf', name: 'remote.pdf' } as any
        ]
      })

      const sanitized = messagesIdb.sanitizeMessageForPersist(message)

      expect(sanitized.attachments[0].attachmentUrl).toBeUndefined()
      expect(sanitized.attachments[0].name).toBe('file.pdf')
      expect(sanitized.attachments[1].attachmentUrl).toBe('https://cdn.example.com/file.pdf')
    })

    it('removes File/Blob data from attachments', () => {
      const message = makeMessage({
        attachments: [{ data: new File(['content'], 'test.txt'), name: 'test.txt' } as any]
      })

      const sanitized = messagesIdb.sanitizeMessageForPersist(message)

      expect(sanitized.attachments[0].data).toBeUndefined()
      expect(sanitized.attachments[0].name).toBe('test.txt')
    })

    it('strips functions from nested objects', () => {
      const message = makeMessage({
        metadata: {
          nested: {
            callback: () => 'test',
            value: 42
          }
        }
      })

      const sanitized = messagesIdb.sanitizeMessageForPersist(message)

      expect((sanitized.metadata as any).nested.callback).toBeUndefined()
      expect((sanitized.metadata as any).nested.value).toBe(42)
    })

    it('handles null attachments', () => {
      const message = makeMessage({ attachments: [] })

      const sanitized = messagesIdb.sanitizeMessageForPersist(message)

      expect(sanitized.attachments).toEqual([])
    })
  })

  describe('persistChannelMessages / restoreChannelMessages', () => {
    it('round-trips messages and segments', async () => {
      const messages = [makeMessage({ id: '1', body: 'hello' }), makeMessage({ id: '2', body: 'world' })]
      const segments = [{ startId: '1', endId: '2' }]

      await messagesIdb.persistChannelMessages('ch-1', messages, segments)
      await flushWrites()

      const restored = await messagesIdb.restoreChannelMessages('ch-1')

      expect(restored).not.toBeNull()
      expect(restored!.channelId).toBe('ch-1')
      expect(restored!.messages).toHaveLength(2)
      expect(restored!.messages[0].body).toBe('hello')
      expect(restored!.messages[1].body).toBe('world')
      expect(restored!.segments).toEqual(segments)
      expect(restored!.savedAt).toBeGreaterThan(0)
    })

    it('is a no-op for empty channelId', async () => {
      await messagesIdb.persistChannelMessages('', [makeMessage()], [])
      await flushWrites()

      const restored = await messagesIdb.restoreChannelMessages('')
      expect(restored).toBeNull()
    })

    it('is a no-op for empty messages array', async () => {
      await messagesIdb.persistChannelMessages('ch-empty', [], [])
      await flushWrites()

      const restored = await messagesIdb.restoreChannelMessages('ch-empty')
      expect(restored).toBeNull()
    })

    it('returns null for unknown channel', async () => {
      const restored = await messagesIdb.restoreChannelMessages('unknown-channel')
      expect(restored).toBeNull()
    })

    it('sanitizes messages on write', async () => {
      const messageWithBlob = makeMessage({
        id: '1',
        attachments: [{ attachmentUrl: 'blob:http://localhost/123', data: new Blob(['test']) } as any]
      })

      await messagesIdb.persistChannelMessages('ch-sanitize', [messageWithBlob], [])
      await flushWrites()

      const restored = await messagesIdb.restoreChannelMessages('ch-sanitize')

      expect(restored!.messages[0].attachments[0].attachmentUrl).toBeUndefined()
      expect(restored!.messages[0].attachments[0].data).toBeUndefined()
    })

    it('overwrites previous channel data', async () => {
      const messages1 = [makeMessage({ id: '1', body: 'first' })]
      const messages2 = [makeMessage({ id: '2', body: 'second' })]

      await messagesIdb.persistChannelMessages('ch-overwrite', messages1, [])
      await flushWrites()
      await messagesIdb.persistChannelMessages('ch-overwrite', messages2, [])
      await flushWrites()

      const restored = await messagesIdb.restoreChannelMessages('ch-overwrite')

      expect(restored!.messages).toHaveLength(1)
      expect(restored!.messages[0].body).toBe('second')
    })
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
      await messagesIdb.persistChannelMessages('ch-1', [makeMessage({ id: '1' })], [])
      await messagesIdb.persistDraft('ch-1', { text: 'draft' })
      await messagesIdb.persistPinnedMessages('ch-1', [{ id: 'pin-1' }])
      await flushWrites()

      // Re-init with same user
      await messagesIdb.initMessagesIdbForUser('user-1')
      await flushWrites()

      // Data should still exist
      const messages = await messagesIdb.restoreChannelMessages('ch-1')
      const drafts = await messagesIdb.restoreDrafts()
      const pins = await messagesIdb.restorePinnedMessages('ch-1')

      expect(messages).not.toBeNull()
      expect(drafts).toHaveLength(1)
      expect(pins).not.toBeNull()
    })

    it('different user -> channels, drafts and pins all wiped', async () => {
      // Init with user-1 and persist data
      await messagesIdb.initMessagesIdbForUser('user-1')
      await flushWrites()

      await messagesIdb.persistChannelMessages('ch-1', [makeMessage({ id: '1' })], [])
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
      const messages = await messagesIdb.restoreChannelMessages('ch-1')
      const drafts = await messagesIdb.restoreDrafts()
      const pins = await messagesIdb.restorePinnedMessages('ch-1')
      const mutations = await messagesIdb.restorePinnedMutations()

      expect(messages).toBeNull()
      expect(drafts).toHaveLength(0)
      expect(pins).toBeNull()
      expect(mutations).toHaveLength(0)
    })

    it('entries older than IDB_MAX_AGE_MS are pruned', async () => {
      const realDateNow = Date.now
      const baseTime = 1700000000000

      // Init and persist data at baseTime
      Date.now = () => baseTime
      await messagesIdb.initMessagesIdbForUser('user-1')
      await flushWrites()

      await messagesIdb.persistChannelMessages('ch-old', [makeMessage({ id: '1' })], [])
      await flushWrites()

      // Persist newer data at baseTime + 1 day
      Date.now = () => baseTime + 24 * 60 * 60 * 1000
      await messagesIdb.persistChannelMessages('ch-new', [makeMessage({ id: '2' })], [])
      await flushWrites()

      // Re-init at baseTime + MAX_AGE + 1 day (old channel should be pruned)
      Date.now = () => baseTime + messagesIdb.IDB_MAX_AGE_MS + 24 * 60 * 60 * 1000
      await messagesIdb.initMessagesIdbForUser('user-1')
      await flushWrites()

      Date.now = realDateNow

      // Old channel should be pruned, new channel should remain
      const oldChannel = await messagesIdb.restoreChannelMessages('ch-old')
      const newChannel = await messagesIdb.restoreChannelMessages('ch-new')

      expect(oldChannel).toBeNull()
      expect(newChannel).not.toBeNull()
    })

    it('more than IDB_MAX_STORED_CHANNELS -> oldest removed first', async () => {
      const realDateNow = Date.now
      let currentTime = 1700000000000

      Date.now = () => currentTime

      await messagesIdb.initMessagesIdbForUser('user-1')
      await flushWrites()

      // Persist MAX + 5 channels with increasing timestamps
      for (let i = 0; i < messagesIdb.IDB_MAX_STORED_CHANNELS + 5; i++) {
        currentTime += 1000 // Increment time for each channel
        await messagesIdb.persistChannelMessages(`ch-${i}`, [makeMessage({ id: `${i}` })], [])
        await flushWrites()
      }

      // Re-init to trigger pruning
      currentTime += 1000
      await messagesIdb.initMessagesIdbForUser('user-1')
      await flushWrites()

      Date.now = realDateNow

      // First 5 channels (oldest) should be pruned
      for (let i = 0; i < 5; i++) {
        const restored = await messagesIdb.restoreChannelMessages(`ch-${i}`)
        expect(restored).toBeNull()
      }

      // Rest should remain
      for (let i = 5; i < messagesIdb.IDB_MAX_STORED_CHANNELS + 5; i++) {
        const restored = await messagesIdb.restoreChannelMessages(`ch-${i}`)
        expect(restored).not.toBeNull()
      }
    })

    it('is a no-op for empty userId', async () => {
      await messagesIdb.initMessagesIdbForUser('user-1')
      await flushWrites()
      await messagesIdb.persistChannelMessages('ch-1', [makeMessage({ id: '1' })], [])
      await flushWrites()

      await messagesIdb.initMessagesIdbForUser('')
      await flushWrites()

      // Data should still exist (empty userId is no-op)
      const messages = await messagesIdb.restoreChannelMessages('ch-1')
      expect(messages).not.toBeNull()
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

    it('persistChannelMessages resolves without throwing', async () => {
      await expect(messagesIdb.persistChannelMessages('ch-1', [makeMessage()], [])).resolves.toBeUndefined()
    })

    it('restoreChannelMessages returns null', async () => {
      const result = await messagesIdb.restoreChannelMessages('ch-1')
      expect(result).toBeNull()
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
      await expect(messagesIdb.persistChannelMessages('ch-1', [makeMessage()], [])).resolves.toBeUndefined()
      await expect(messagesIdb.restoreChannelMessages('ch-1')).resolves.toBeNull()
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

      await expect(messagesIdb.restoreChannelMessages('ch-1')).resolves.toBeNull()
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
      await expect(messagesIdb.restoreChannelMessages('ch-1')).resolves.toBeNull()

      // The underlying problem goes away: a working IndexedDB is available again
      global.indexedDB = new IDBFactory()

      // Same module instance must retry and be able to write and read back
      const message = makeMessage({ id: 'retry-1', channelId: 'ch-1', body: 'after retry' })
      await messagesIdb.persistChannelMessages('ch-1', [message], [{ startId: 'retry-1', endId: 'retry-1' }])
      await new Promise((resolve) => setTimeout(resolve, 0))

      const restored = await messagesIdb.restoreChannelMessages('ch-1')
      expect(restored).not.toBeNull()
      expect(restored?.messages.map((m: any) => m.id)).toEqual(['retry-1'])
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

  describe('removePersistedChannel / clearPersistedChannels', () => {
    it('removePersistedChannel removes a single channel', async () => {
      await messagesIdb.persistChannelMessages('ch-remove', [makeMessage({ id: '1' })], [])
      await messagesIdb.persistChannelMessages('ch-keep', [makeMessage({ id: '2' })], [])
      await flushWrites()

      await messagesIdb.removePersistedChannel('ch-remove')
      await flushWrites()

      const removed = await messagesIdb.restoreChannelMessages('ch-remove')
      const kept = await messagesIdb.restoreChannelMessages('ch-keep')

      expect(removed).toBeNull()
      expect(kept).not.toBeNull()
    })

    it('clearPersistedChannels removes all channels', async () => {
      await messagesIdb.persistChannelMessages('ch-1', [makeMessage({ id: '1' })], [])
      await messagesIdb.persistChannelMessages('ch-2', [makeMessage({ id: '2' })], [])
      await flushWrites()

      await messagesIdb.clearPersistedChannels()
      await flushWrites()

      const ch1 = await messagesIdb.restoreChannelMessages('ch-1')
      const ch2 = await messagesIdb.restoreChannelMessages('ch-2')

      expect(ch1).toBeNull()
      expect(ch2).toBeNull()
    })
  })
})
