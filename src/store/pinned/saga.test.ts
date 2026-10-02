import { runSaga } from 'redux-saga'
import { destroyChannelsMap, setChannelInMap, setActiveChannelId } from '../../helpers/channelHalper'
import { makeChannel, makeMessage, resetMessageListFixtureIds } from '../../testUtils/messageFixtures'
import { CONNECTION_STATUS } from '../user/constants'
import {
  pinMessageAC,
  unpinMessageAC,
  applyPinnedMessagesEventAC,
  resendPendingPinMutationsAC,
  removePendingPinMutationAC
} from './actions'
import { sendTextMessageAC } from '../message/actions'
import { __pinnedSagaTestables } from './saga'
import { PendingPinMutation, PinnedMessageRecord, clearPinnedMessages } from './reducers'
import { setClient } from '../../common/client'

// Mock persistence helpers
const mockPersistPinMutation = jest.fn(async () => undefined)
const mockPersistPinnedMessages = jest.fn(async () => undefined)
const mockRemovePersistedPinMutation = jest.fn(async () => undefined)
const mockRemovePersistedPinsForChannel = jest.fn(async () => undefined)
const mockRestorePinnedMessages = jest.fn(async () => null)
const mockRestorePinnedMutations = jest.fn(async () => [])

jest.mock('../../helpers/messagesIdb', () => ({
  persistPinMutation: (...args: any[]) => mockPersistPinMutation(...args),
  persistPinnedMessages: (...args: any[]) => mockPersistPinnedMessages(...args),
  removePersistedPinMutation: (...args: any[]) => mockRemovePersistedPinMutation(...args),
  removePersistedPinsForChannel: (...args: any[]) => mockRemovePersistedPinsForChannel(...args),
  restorePinnedMessages: (...args: any[]) => mockRestorePinnedMessages(...args),
  restorePinnedMutations: (...args: any[]) => mockRestorePinnedMutations(...args)
}))

const mockSetNotification = jest.fn()
jest.mock('../../helpers/notifications', () => ({
  setNotification: (...args: any[]) => mockSetNotification(...args)
}))

jest.mock('../../helpers/pinnedMessage', () => ({
  getPinnedMessagePreview: jest.fn((message) => message?.body || '')
}))

jest.mock('../../helpers/messagesHalper', () => ({
  checkChannelExistsOnMessagesMap: jest.fn(() => false),
  updateMessageOnMap: jest.fn()
}))

const PIN_TYPE_SHARED = 0
const PIN_TYPE_PRIVATE = 1

const mockStoreState: any = {
  UserReducer: {
    connectionStatus: CONNECTION_STATUS.CONNECTED
  },
  PinnedReducer: {
    byChannel: {},
    cursors: {},
    loaded: {},
    pendingMutations: {}
  },
  MessageReducer: {
    pinnedMessagesListOpen: false
  }
}

const mockStore = {
  getState: jest.fn(() => mockStoreState)
}

jest.mock('store', () => ({
  __esModule: true,
  get default() {
    return mockStore
  }
}))

const runPinnedSaga = async (saga: (...args: any[]) => Generator, ...args: any[]) => {
  const dispatched: any[] = []
  await runSaga(
    {
      dispatch: (action) => dispatched.push(action),
      getState: () => mockStoreState
    },
    saga,
    ...args
  ).toPromise()
  return dispatched
}

const makePinnedMessageRecord = (
  message: any,
  pinType = PIN_TYPE_SHARED,
  overrides: Partial<PinnedMessageRecord> = {}
): PinnedMessageRecord => ({
  id: message.id || message.tid,
  pinType,
  message,
  ...overrides
})

const createMockChannel = (id: string, overrides: any = {}) => {
  const baseChannel = makeChannel({ id, ...overrides })
  return {
    ...baseChannel,
    pinMessage: overrides.pinMessage || jest.fn(async () => ({ pins: [], changed: false })),
    unpinMessage: overrides.unpinMessage || jest.fn(async () => ({ pins: [] })),
    createPinnedMessageListQueryBuilder: overrides.createPinnedMessageListQueryBuilder
  }
}

describe('pinned saga PIN operation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetMessageListFixtureIds()
    destroyChannelsMap()
    __pinnedSagaTestables.clearServerPinRefreshes()
    mockStoreState.UserReducer.connectionStatus = CONNECTION_STATUS.CONNECTED
    mockStoreState.PinnedReducer = {
      byChannel: {},
      cursors: {},
      loaded: {},
      pendingMutations: {}
    }
    setClient({ user: { id: 'current-user' } } as any)
    mockRestorePinnedMutations.mockResolvedValue([])
  })

  afterEach(() => {
    destroyChannelsMap()
  })

  it('dispatches upsertPinnedMessages and updates message pin state on successful pin', async () => {
    const message = makeMessage({ id: '101', channelId: 'ch-pin-success', body: 'test message' })
    const pin = makePinnedMessageRecord(message, PIN_TYPE_SHARED)
    const pinMessageMock = jest.fn(async () => ({ pins: [pin], changed: true }))
    const channel = createMockChannel('ch-pin-success', { pinMessage: pinMessageMock })
    setChannelInMap(channel as any)
    setActiveChannelId('ch-pin-success')

    const dispatched = await runPinnedSaga(
      __pinnedSagaTestables.pinMessage,
      pinMessageAC('ch-pin-success', message, PIN_TYPE_SHARED)
    )

    expect(pinMessageMock).toHaveBeenCalledWith(message, PIN_TYPE_SHARED)
    expect(dispatched).toContainEqual(
      expect.objectContaining({
        type: 'pinnedMessages/upsertPinnedMessages',
        payload: expect.objectContaining({ channelId: 'ch-pin-success' })
      })
    )
    expect(mockRemovePersistedPinMutation).toHaveBeenCalled()
  })

  it('queues the mutation when the SDK call fails', async () => {
    const message = makeMessage({ id: '102', channelId: 'ch-pin-fail', body: 'failed pin' })
    const pinMessageMock = jest.fn(async () => {
      throw new Error('Network error')
    })
    const channel = createMockChannel('ch-pin-fail', { pinMessage: pinMessageMock })
    setChannelInMap(channel as any)

    const dispatched = await runPinnedSaga(
      __pinnedSagaTestables.pinMessage,
      pinMessageAC('ch-pin-fail', message, PIN_TYPE_SHARED)
    )

    expect(dispatched).toContainEqual(
      expect.objectContaining({
        type: 'pinnedMessages/setPendingPinMutation',
        payload: expect.objectContaining({
          mutation: expect.objectContaining({
            channelId: 'ch-pin-fail',
            operation: 'PIN',
            messageId: '102'
          })
        })
      })
    )
    expect(mockPersistPinMutation).toHaveBeenCalled()
  })

  it('sends a system message when pinning a shared message', async () => {
    const message = makeMessage({ id: '103', channelId: 'ch-pin-system', body: 'shared pin' })
    const pin = makePinnedMessageRecord(message, PIN_TYPE_SHARED)
    const pinMessageMock = jest.fn(async () => ({ pins: [pin], changed: true }))
    const channel = createMockChannel('ch-pin-system', { pinMessage: pinMessageMock })
    setChannelInMap(channel as any)

    const dispatched = await runPinnedSaga(
      __pinnedSagaTestables.pinMessage,
      pinMessageAC('ch-pin-system', message, PIN_TYPE_SHARED)
    )

    expect(dispatched).toContainEqual(
      expect.objectContaining({
        type: 'SEND_TEXT_MESSAGE',
        payload: expect.objectContaining({
          channelId: 'ch-pin-system',
          message: expect.objectContaining({
            type: 'system',
            body: 'PM'
          })
        })
      })
    )
  })
})

describe('pinned saga UNPIN operation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetMessageListFixtureIds()
    destroyChannelsMap()
    __pinnedSagaTestables.clearServerPinRefreshes()
    mockStoreState.UserReducer.connectionStatus = CONNECTION_STATUS.CONNECTED
    mockStoreState.PinnedReducer = {
      byChannel: {},
      cursors: {},
      loaded: {},
      pendingMutations: {}
    }
    mockRestorePinnedMutations.mockResolvedValue([])
  })

  afterEach(() => {
    destroyChannelsMap()
  })

  it('dispatches removePinnedMessages on successful unpin', async () => {
    const message = makeMessage({ id: '201', channelId: 'ch-unpin-success', body: 'test unpin' })
    const pin = makePinnedMessageRecord(message, PIN_TYPE_SHARED)
    const unpinMessageMock = jest.fn(async () => ({ pins: [pin] }))
    const channel = createMockChannel('ch-unpin-success', { unpinMessage: unpinMessageMock })
    setChannelInMap(channel as any)

    const dispatched = await runPinnedSaga(__pinnedSagaTestables.unpinMessage, unpinMessageAC('ch-unpin-success', pin))

    expect(unpinMessageMock).toHaveBeenCalledWith('201', PIN_TYPE_SHARED)
    expect(dispatched).toContainEqual(
      expect.objectContaining({
        type: 'pinnedMessages/removePinnedMessages',
        payload: expect.objectContaining({
          channelId: 'ch-unpin-success',
          messageIds: ['201']
        })
      })
    )
  })

  it('queues the mutation when the SDK call fails', async () => {
    const message = makeMessage({ id: '202', channelId: 'ch-unpin-fail', body: 'failed unpin' })
    const pin = makePinnedMessageRecord(message, PIN_TYPE_SHARED)
    const unpinMessageMock = jest.fn(async () => {
      throw new Error('Network error')
    })
    const channel = createMockChannel('ch-unpin-fail', { unpinMessage: unpinMessageMock })
    setChannelInMap(channel as any)

    const dispatched = await runPinnedSaga(__pinnedSagaTestables.unpinMessage, unpinMessageAC('ch-unpin-fail', pin))

    expect(dispatched).toContainEqual(
      expect.objectContaining({
        type: 'pinnedMessages/setPendingPinMutation',
        payload: expect.objectContaining({
          mutation: expect.objectContaining({
            channelId: 'ch-unpin-fail',
            operation: 'UNPIN',
            messageId: '202'
          })
        })
      })
    )
    expect(mockPersistPinMutation).toHaveBeenCalled()
  })
})

describe('pinned saga offline queue (P0-3)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetMessageListFixtureIds()
    destroyChannelsMap()
    __pinnedSagaTestables.clearServerPinRefreshes()
    mockStoreState.UserReducer.connectionStatus = CONNECTION_STATUS.CONNECTED
    mockStoreState.PinnedReducer = {
      byChannel: {},
      cursors: {},
      loaded: {},
      pendingMutations: {}
    }
    mockRestorePinnedMutations.mockResolvedValue([])
  })

  afterEach(() => {
    destroyChannelsMap()
  })

  it('pin while offline is queued then sent on reconnect', async () => {
    const message = makeMessage({ id: '301', channelId: 'ch-offline-pin', body: 'offline pin' })
    const pin = makePinnedMessageRecord(message, PIN_TYPE_SHARED)
    const pinMessageMock = jest
      .fn()
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValueOnce({ pins: [pin], changed: true })

    const channel = createMockChannel('ch-offline-pin', {
      pinMessage: pinMessageMock,
      createPinnedMessageListQueryBuilder: undefined
    })
    setChannelInMap(channel as any)

    // PIN while "offline" (SDK call fails)
    await runPinnedSaga(__pinnedSagaTestables.pinMessage, pinMessageAC('ch-offline-pin', message, PIN_TYPE_SHARED))

    expect(mockPersistPinMutation).toHaveBeenCalled()
    const queuedMutation = mockPersistPinMutation.mock.calls[0][0] as PendingPinMutation
    expect(queuedMutation.operation).toBe('PIN')
    expect(queuedMutation.messageId).toBe('301')

    // Simulate reconnect: mutation is now in pendingMutations
    mockStoreState.PinnedReducer.pendingMutations = { [queuedMutation.id]: queuedMutation }

    const replayDispatched = await runPinnedSaga(
      __pinnedSagaTestables.resendPendingPinMutations,
      resendPendingPinMutationsAC()
    )

    expect(pinMessageMock).toHaveBeenCalledTimes(2)
    expect(replayDispatched).toContainEqual(
      expect.objectContaining({
        type: 'pinnedMessages/removePendingPinMutation',
        payload: { id: queuedMutation.id }
      })
    )
    expect(mockRemovePersistedPinMutation).toHaveBeenCalledWith(queuedMutation.id)
  })

  it('pin then unpin before reconnect cancels out: nothing is sent on reconnect', async () => {
    const message = makeMessage({ id: '302', channelId: 'ch-no-op', body: 'no-op message' })
    const pin = makePinnedMessageRecord(message, PIN_TYPE_SHARED)

    const pinMessageMock = jest.fn().mockRejectedValue(new Error('Offline'))
    const unpinMessageMock = jest.fn().mockRejectedValue(new Error('Offline'))
    const channel = createMockChannel('ch-no-op', {
      pinMessage: pinMessageMock,
      unpinMessage: unpinMessageMock,
      createPinnedMessageListQueryBuilder: undefined
    })
    setChannelInMap(channel as any)

    // PIN while offline -> queued
    await runPinnedSaga(__pinnedSagaTestables.pinMessage, pinMessageAC('ch-no-op', message, PIN_TYPE_SHARED))
    expect(mockPersistPinMutation).toHaveBeenCalledTimes(1)
    const pinMutation = mockPersistPinMutation.mock.calls[0][0] as PendingPinMutation
    mockStoreState.PinnedReducer.pendingMutations = { [pinMutation.id]: pinMutation }

    // UNPIN of the same message while still offline -> removes the queued PIN instead of queueing
    const dispatched = await runPinnedSaga(__pinnedSagaTestables.unpinMessage, unpinMessageAC('ch-no-op', pin))
    expect(mockPersistPinMutation).toHaveBeenCalledTimes(1)
    expect(mockRemovePersistedPinMutation).toHaveBeenCalledWith(pinMutation.id)
    expect(dispatched).toContainEqual(removePendingPinMutationAC(pinMutation.id))
    mockStoreState.PinnedReducer.pendingMutations = {}

    // Reconnect: no pin, no unpin, no "pinned a message" system message
    pinMessageMock.mockClear()
    unpinMessageMock.mockClear()
    const resent = await runPinnedSaga(__pinnedSagaTestables.resendPendingPinMutations, resendPendingPinMutationsAC())
    expect(pinMessageMock).not.toHaveBeenCalled()
    expect(unpinMessageMock).not.toHaveBeenCalled()
    expect(resent.some((a) => a.type === sendTextMessageAC({} as any, '', '').type)).toBe(false)
  })

  it('cancels against a mutation persisted before a reload (IndexedDB only)', async () => {
    const message = makeMessage({ id: '303', channelId: 'ch-reload', body: 'reloaded' })
    const pin = makePinnedMessageRecord(message, PIN_TYPE_SHARED)
    setChannelInMap(
      createMockChannel('ch-reload', {
        unpinMessage: jest.fn().mockRejectedValue(new Error('Offline')),
        createPinnedMessageListQueryBuilder: undefined
      }) as any
    )
    const persistedPin: PendingPinMutation = {
      id: 'persisted-pin',
      channelId: 'ch-reload',
      operation: 'PIN',
      messageId: '303',
      pinType: PIN_TYPE_SHARED,
      queuedAt: Date.now()
    }
    mockRestorePinnedMutations.mockResolvedValue([persistedPin] as any)

    await runPinnedSaga(__pinnedSagaTestables.unpinMessage, unpinMessageAC('ch-reload', pin))

    expect(mockRemovePersistedPinMutation).toHaveBeenCalledWith('persisted-pin')
    expect(mockPersistPinMutation).not.toHaveBeenCalled()
  })

  it('does not cancel mutations for a different message or pin scope', async () => {
    const message = makeMessage({ id: '304', channelId: 'ch-scope', body: 'scoped' })
    setChannelInMap(
      createMockChannel('ch-scope', {
        unpinMessage: jest.fn().mockRejectedValue(new Error('Offline')),
        createPinnedMessageListQueryBuilder: undefined
      }) as any
    )
    mockStoreState.PinnedReducer.pendingMutations = {
      other: {
        id: 'other',
        channelId: 'ch-scope',
        operation: 'PIN',
        messageId: '999',
        pinType: PIN_TYPE_SHARED,
        queuedAt: 1
      },
      priv: {
        id: 'priv',
        channelId: 'ch-scope',
        operation: 'PIN',
        messageId: '304',
        pinType: PIN_TYPE_PRIVATE,
        queuedAt: 1
      }
    }

    await runPinnedSaga(
      __pinnedSagaTestables.unpinMessage,
      unpinMessageAC('ch-scope', makePinnedMessageRecord(message, PIN_TYPE_SHARED))
    )

    expect(mockRemovePersistedPinMutation).not.toHaveBeenCalled()
    expect(mockPersistPinMutation).toHaveBeenCalledTimes(1)
    expect((mockPersistPinMutation.mock.calls[0][0] as PendingPinMutation).operation).toBe('UNPIN')
  })

  it('uses persisted mutations from IndexedDB when reconnecting', async () => {
    const persistedMutation: PendingPinMutation = {
      id: 'persisted-mut-1',
      channelId: 'ch-persisted',
      operation: 'PIN',
      messageId: '303',
      pinType: PIN_TYPE_SHARED,
      queuedAt: Date.now()
    }
    mockRestorePinnedMutations.mockResolvedValueOnce([persistedMutation])

    const message = makeMessage({ id: '303', channelId: 'ch-persisted', body: 'persisted' })
    const pin = makePinnedMessageRecord(message, PIN_TYPE_SHARED)
    const pinMessageMock = jest.fn(async () => ({ pins: [pin], changed: true }))

    const channel = createMockChannel('ch-persisted', {
      pinMessage: pinMessageMock,
      createPinnedMessageListQueryBuilder: undefined
    })
    setChannelInMap(channel as any)

    await runPinnedSaga(__pinnedSagaTestables.resendPendingPinMutations, resendPendingPinMutationsAC())

    expect(mockRestorePinnedMutations).toHaveBeenCalled()
    expect(pinMessageMock).toHaveBeenCalledWith('303', PIN_TYPE_SHARED)
  })

  it('leaves the mutation queued when executePin fails on replay', async () => {
    const mutation: PendingPinMutation = {
      id: 'retry-mut-1',
      channelId: 'ch-retry-fail',
      operation: 'PIN',
      messageId: '304',
      pinType: PIN_TYPE_SHARED,
      queuedAt: Date.now()
    }
    mockStoreState.PinnedReducer.pendingMutations = { [mutation.id]: mutation }

    const pinMessageMock = jest.fn(async () => {
      throw new Error('Still failing')
    })
    const channel = createMockChannel('ch-retry-fail', {
      pinMessage: pinMessageMock,
      createPinnedMessageListQueryBuilder: undefined
    })
    setChannelInMap(channel as any)

    const dispatched = await runPinnedSaga(
      __pinnedSagaTestables.resendPendingPinMutations,
      resendPendingPinMutationsAC()
    )

    // The mutation should NOT be removed from pending since it still failed
    expect(dispatched).not.toContainEqual(
      expect.objectContaining({
        type: 'pinnedMessages/removePendingPinMutation',
        payload: { id: mutation.id }
      })
    )
    expect(mockRemovePersistedPinMutation).not.toHaveBeenCalledWith(mutation.id)
  })
})

describe('pinned saga applyPinnedMessagesEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetMessageListFixtureIds()
    destroyChannelsMap()
    __pinnedSagaTestables.clearServerPinRefreshes()
    mockStoreState.UserReducer.connectionStatus = CONNECTION_STATUS.CONNECTED
    mockStoreState.PinnedReducer = {
      byChannel: {},
      cursors: {},
      loaded: {},
      pendingMutations: {}
    }
    setClient({ user: { id: 'current-user' } } as any)
    mockRestorePinnedMutations.mockResolvedValue([])
  })

  afterEach(() => {
    destroyChannelsMap()
  })

  it('upserts pins when operation is 0 (PIN)', async () => {
    const message = makeMessage({ id: '401', channelId: 'ch-event-pin', body: 'event pin' })
    const pin = makePinnedMessageRecord(message, PIN_TYPE_SHARED)

    const channel = createMockChannel('ch-event-pin', {
      createPinnedMessageListQueryBuilder: undefined
    })
    setChannelInMap(channel as any)

    const event = {
      operation: 0, // PIN
      pins: [pin],
      scope: PIN_TYPE_SHARED,
      actor: { id: 'remote-user' }
    }

    const dispatched = await runPinnedSaga(
      __pinnedSagaTestables.applyPinnedMessagesEvent,
      applyPinnedMessagesEventAC(channel, event)
    )

    expect(dispatched).toContainEqual(
      expect.objectContaining({
        type: 'pinnedMessages/upsertPinnedMessages',
        payload: expect.objectContaining({ channelId: 'ch-event-pin' })
      })
    )
  })

  it('removes pins when operation is 1 (UNPIN)', async () => {
    const message = makeMessage({ id: '402', channelId: 'ch-event-unpin', body: 'event unpin' })
    const pin = makePinnedMessageRecord(message, PIN_TYPE_SHARED)

    const channel = createMockChannel('ch-event-unpin', {
      createPinnedMessageListQueryBuilder: undefined
    })
    setChannelInMap(channel as any)

    const event = {
      operation: 1, // UNPIN
      pins: [pin],
      scope: PIN_TYPE_SHARED,
      actor: { id: 'remote-user' }
    }

    const dispatched = await runPinnedSaga(
      __pinnedSagaTestables.applyPinnedMessagesEvent,
      applyPinnedMessagesEventAC(channel, event)
    )

    expect(dispatched).toContainEqual(
      expect.objectContaining({
        type: 'pinnedMessages/removePinnedMessages',
        payload: expect.objectContaining({
          channelId: 'ch-event-unpin',
          pinIds: ['402']
        })
      })
    )
  })

  it('shows notification for shared pin from another user when channel is not active', async () => {
    const message = makeMessage({ id: '403', channelId: 'ch-event-notify', body: 'notification test' })
    const pin = makePinnedMessageRecord(message, PIN_TYPE_SHARED)

    const channel = createMockChannel('ch-event-notify', {
      createPinnedMessageListQueryBuilder: undefined
    })
    setChannelInMap(channel as any)
    setActiveChannelId('different-channel')

    // Mock Notification API
    const originalNotification = global.Notification
    ;(global as any).Notification = { permission: 'granted' }

    const event = {
      operation: 0, // PIN
      pins: [pin],
      scope: PIN_TYPE_SHARED,
      changed: true,
      actor: { id: 'remote-user', firstName: 'Alice' }
    }

    await runPinnedSaga(__pinnedSagaTestables.applyPinnedMessagesEvent, applyPinnedMessagesEventAC(channel, event))

    expect(mockSetNotification).toHaveBeenCalledWith(expect.stringContaining('@Alice pinned'), event.actor, channel)

    global.Notification = originalNotification
  })

  it('does not show notification for own pin', async () => {
    const message = makeMessage({ id: '404', channelId: 'ch-event-no-notify', body: 'own pin' })
    const pin = makePinnedMessageRecord(message, PIN_TYPE_SHARED)

    const channel = createMockChannel('ch-event-no-notify', {
      createPinnedMessageListQueryBuilder: undefined
    })
    setChannelInMap(channel as any)
    setActiveChannelId('different-channel')

    const originalNotification = global.Notification
    ;(global as any).Notification = { permission: 'granted' }

    const event = {
      operation: 0,
      pins: [pin],
      scope: PIN_TYPE_SHARED,
      changed: true,
      actor: { id: 'current-user' } // Same as client user
    }

    await runPinnedSaga(__pinnedSagaTestables.applyPinnedMessagesEvent, applyPinnedMessagesEventAC(channel, event))

    expect(mockSetNotification).not.toHaveBeenCalled()

    global.Notification = originalNotification
  })

  it('does not show notification for private pin', async () => {
    const message = makeMessage({ id: '405', channelId: 'ch-event-private', body: 'private pin' })
    const pin = makePinnedMessageRecord(message, PIN_TYPE_PRIVATE)

    const channel = createMockChannel('ch-event-private', {
      createPinnedMessageListQueryBuilder: undefined
    })
    setChannelInMap(channel as any)
    setActiveChannelId('different-channel')

    const originalNotification = global.Notification
    ;(global as any).Notification = { permission: 'granted' }

    const event = {
      operation: 0,
      pins: [pin],
      scope: PIN_TYPE_PRIVATE, // Private, not shared
      changed: true,
      actor: { id: 'remote-user' }
    }

    await runPinnedSaga(__pinnedSagaTestables.applyPinnedMessagesEvent, applyPinnedMessagesEventAC(channel, event))

    expect(mockSetNotification).not.toHaveBeenCalled()

    global.Notification = originalNotification
  })
})

describe('pinned saga clearChannelPinnedMessages', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetMessageListFixtureIds()
    destroyChannelsMap()
    __pinnedSagaTestables.clearServerPinRefreshes()
  })

  afterEach(() => {
    destroyChannelsMap()
  })

  it('removes persisted pins for the channel', async () => {
    await runPinnedSaga(
      __pinnedSagaTestables.clearChannelPinnedMessages,
      clearPinnedMessages({ channelId: 'ch-clear' })
    )

    expect(mockRemovePersistedPinsForChannel).toHaveBeenCalledWith('ch-clear')
  })
})

describe('pinned saga loadPinnedMessages', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetMessageListFixtureIds()
    destroyChannelsMap()
    __pinnedSagaTestables.clearServerPinRefreshes()
    mockStoreState.PinnedReducer = {
      byChannel: {},
      cursors: {},
      loaded: {},
      pendingMutations: {}
    }
    mockRestorePinnedMutations.mockResolvedValue([])
  })

  afterEach(() => {
    destroyChannelsMap()
  })

  it('restores cached pins when restoreCache is true and cache exists', async () => {
    const cachedPins = [makePinnedMessageRecord(makeMessage({ id: '501' }), PIN_TYPE_SHARED)]
    mockRestorePinnedMessages.mockResolvedValueOnce({ pins: cachedPins, nextToken: 'token-1' })

    const channel = createMockChannel('ch-cache', {
      createPinnedMessageListQueryBuilder: undefined
    })
    setChannelInMap(channel as any)

    const dispatched = await runPinnedSaga(__pinnedSagaTestables.loadPinnedMessages, {
      payload: { channelId: 'ch-cache', restoreCache: true }
    })

    expect(mockRestorePinnedMessages).toHaveBeenCalledWith('ch-cache')
    expect(dispatched).toContainEqual(
      expect.objectContaining({
        type: 'pinnedMessages/setPinnedMessages',
        payload: expect.objectContaining({
          channelId: 'ch-cache',
          pins: cachedPins,
          nextToken: 'token-1'
        })
      })
    )
  })

  it('fetches pins from server when channel has query builder', async () => {
    const message = makeMessage({ id: '502', channelId: 'ch-fetch' })
    const serverPins = [{ id: '502', pinType: PIN_TYPE_SHARED, message }]
    const query = {
      loadNext: jest.fn(async () => ({ pins: serverPins })),
      nextToken: undefined
    }
    const builder = {
      limit: jest.fn().mockReturnThis(),
      byDescendingOrder: jest.fn().mockReturnThis(),
      setNextToken: jest.fn().mockReturnThis(),
      build: jest.fn(async () => query)
    }

    const channel = createMockChannel('ch-fetch', {
      createPinnedMessageListQueryBuilder: jest.fn(() => builder)
    })
    setChannelInMap(channel as any)

    const dispatched = await runPinnedSaga(__pinnedSagaTestables.loadPinnedMessages, {
      payload: { channelId: 'ch-fetch', restoreCache: false, limit: 20 }
    })

    expect(builder.limit).toHaveBeenCalledWith(20)
    expect(query.loadNext).toHaveBeenCalled()
    expect(dispatched).toContainEqual(
      expect.objectContaining({
        type: 'pinnedMessages/setPinnedMessages',
        payload: expect.objectContaining({ channelId: 'ch-fetch' })
      })
    )
  })

  it('handles server error gracefully, keeping cached pins visible', async () => {
    const builder = {
      limit: jest.fn().mockReturnThis(),
      byDescendingOrder: jest.fn().mockReturnThis(),
      build: jest.fn(async () => {
        throw new Error('Server error')
      })
    }

    const channel = createMockChannel('ch-error', {
      createPinnedMessageListQueryBuilder: jest.fn(() => builder)
    })
    setChannelInMap(channel as any)

    // Should not throw
    const dispatched = await runPinnedSaga(__pinnedSagaTestables.loadPinnedMessages, {
      payload: { channelId: 'ch-error', restoreCache: false }
    })

    // No setPinnedMessages should be dispatched on error
    expect(dispatched.filter((a) => a.type === 'pinnedMessages/setPinnedMessages')).toHaveLength(0)
  })
})
