/**
 * Event harness for testing the watchForEvents saga with real event flow.
 *
 * This harness:
 * - Mocks getClient() to capture ChannelListener and ConnectionListener instances
 * - Starts the real watchForEvents saga
 * - Exposes emit() to trigger callbacks on the captured listeners
 * - Returns dispatched actions for assertions
 */
import { runSaga, RunSagaOptions, Task } from 'redux-saga'
import { setClient } from '../common/client'
import watchForEvents from '../store/evetns/inedx'

type ListenerCallback = (...args: any[]) => void

interface CapturedChannelListener {
  onCreated?: ListenerCallback
  onMemberJoined?: ListenerCallback
  onMemberLeft?: ListenerCallback
  onBlocked?: ListenerCallback
  onUnblocked?: ListenerCallback
  onMembersAdded?: ListenerCallback
  onMembersKicked?: ListenerCallback
  onUpdated?: ListenerCallback
  onMessage?: ListenerCallback
  onDeleted?: ListenerCallback
  onMessageEdited?: ListenerCallback
  onMessageDeleted?: ListenerCallback
  onPinnedMessagesChanged?: ListenerCallback
  onReactionAdded?: ListenerCallback
  onReactionDeleted?: ListenerCallback
  onReceivedMessageListMarker?: ListenerCallback
  onTotalUnreadCountUpdated?: ListenerCallback
  onHidden?: ListenerCallback
  onMuted?: ListenerCallback
  onUnmuted?: ListenerCallback
  onPined?: ListenerCallback
  onUnpined?: ListenerCallback
  onShown?: ListenerCallback
  onMarkedAsUnread?: ListenerCallback
  onMarkedAsRead?: ListenerCallback
  onHistoryCleared?: ListenerCallback
  onDeletedAllMessages?: ListenerCallback
  onMembersRoleChanged?: ListenerCallback
  onOwnerChanged?: ListenerCallback
  onMembersBlocked?: ListenerCallback
  onMembersUnblocked?: ListenerCallback
  onChannelFrozen?: ListenerCallback
  onChannelUnfrozen?: ListenerCallback
  onReceivedChannelEvent?: ListenerCallback
  onPollAdded?: ListenerCallback
  onPollRetracted?: ListenerCallback
  onPollDeleted?: ListenerCallback
  onPollClosed?: ListenerCallback
}

interface CapturedConnectionListener {
  onConnectionStateChanged?: ListenerCallback
  onTokenWillExpire?: ListenerCallback
  onTokenExpired?: ListenerCallback
}

export interface EventHarness {
  dispatched: any[]
  task: Task
  channelListener: CapturedChannelListener
  connectionListener: CapturedConnectionListener
  emit: (callbackName: string, ...args: any[]) => Promise<void>
  cancel: () => void
  flushMicrotasks: () => Promise<void>
}

export interface EventHarnessOptions {
  storeState?: any
  channelTypesFilter?: string[]
}

const defaultStoreState = {
  MessageReducer: {
    pendingPollActions: {},
    messagesHasNext: false,
    visibleMessagesMap: {},
    activeChannelMessages: [],
    pollVotesHasMore: {}
  },
  UserReducer: {
    browserTabIsActive: true
  },
  ChannelReducer: {
    channels: []
  },
  MembersReducer: {
    channelsMembersMap: {}
  },
  ThemeReducer: {
    theme: 'light',
    newTheme: {
      colors: {
        accent: { light: '#3B82F6' },
        textSecondary: { light: '#6B7280' }
      }
    }
  }
}

/**
 * Creates an event harness for testing the watchForEvents saga.
 *
 * Usage:
 * ```ts
 * let harness: EventHarness
 *
 * beforeEach(() => {
 *   harness = createEventHarness()
 * })
 *
 * afterEach(() => {
 *   harness.cancel()
 * })
 *
 * it('handles MESSAGE event', async () => {
 *   await harness.emit('onMessage', channel, message)
 *   expect(harness.dispatched).toContainEqual(...)
 * })
 * ```
 */
export function createEventHarness(options: EventHarnessOptions = {}): EventHarness {
  const dispatched: any[] = []
  const storeState = { ...defaultStoreState, ...options.storeState }

  // Captured listener instances
  let channelListener: CapturedChannelListener = {}
  let connectionListener: CapturedConnectionListener = {}

  // Create fake client with capturable listeners
  const fakeClient = {
    user: { id: 'current-user' },
    Channel: { create: jest.fn() },
    ChannelListener: class {
      constructor() {
        // Store reference to this instance so we can call callbacks
        channelListener = this as any
      }
    },
    ConnectionListener: class {
      constructor() {
        connectionListener = this as any
      }
    },
    addChannelListener: jest.fn((name: string, listener: any) => {
      channelListener = listener
    }),
    addConnectionListener: jest.fn((name: string, listener: any) => {
      connectionListener = listener
    }),
    removeChannelListener: jest.fn(),
    removeConnectionListener: jest.fn()
  }

  // Set the fake client
  setClient(fakeClient)

  // Mock store.getState()
  const mockStore = require('store') as {
    getState: () => any
    dispatch: jest.Mock
  }
  mockStore.getState = jest.fn(() => storeState)
  if (!mockStore.dispatch) {
    mockStore.dispatch = jest.fn()
  }
  mockStore.dispatch.mockClear()

  // Saga options
  const sagaOptions: RunSagaOptions<any, any> = {
    getState: () => storeState,
    dispatch: (action: any) => {
      dispatched.push(action)
    }
  }

  // Start the saga
  const task = runSaga(sagaOptions, watchForEvents)

  // Utility to flush microtasks
  const flushMicrotasks = async () => {
    await new Promise((resolve) => setTimeout(resolve, 10))
  }

  // Emit function to trigger listener callbacks
  const emit = async (callbackName: string, ...args: any[]) => {
    // Determine which listener to use
    const callback = (channelListener as any)[callbackName] || (connectionListener as any)[callbackName]

    if (!callback) {
      throw new Error(
        `Callback "${callbackName}" not found on channelListener or connectionListener. ` +
          `Available channel callbacks: ${Object.keys(channelListener).join(', ')}. ` +
          `Available connection callbacks: ${Object.keys(connectionListener).join(', ')}`
      )
    }

    // Call the callback
    callback(...args)

    // Flush microtasks to let the saga process the event
    await flushMicrotasks()
  }

  // Cancel function
  const cancel = () => {
    task.cancel()
  }

  return {
    dispatched,
    task,
    channelListener,
    connectionListener,
    emit,
    cancel,
    flushMicrotasks
  }
}

/**
 * Helper to clear dispatched actions between tests within the same harness
 */
export function clearDispatched(harness: EventHarness) {
  harness.dispatched.length = 0
}
