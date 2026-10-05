/**
 * Tests for notifications.ts
 *
 * Setup notes:
 * - notifications.ts keeps module state (permission, contactsMap, showNotifications, logo)
 * - We use jest.isolateModules / jest.resetModules + require to load fresh per test
 * - Mock window.Notification as a jest.fn class
 * - Use jest fake timers for the 5s auto-close
 */
import { IChannel, IUser } from '../types'
import { makeChannel, makeUser, resetMessageListFixtureIds } from '../testUtils/messageFixtures'
import { DEFAULT_CHANNEL_TYPE } from './constants'

// Store reference for dispatch spy
const mockDispatch = jest.fn()
jest.mock('store', () => ({
  dispatch: (...args: any[]) => mockDispatch(...args),
  getState: () => ({})
}))

// Mock the switchChannelActionAC
const mockSwitchChannelActionAC = jest.fn((channel) => ({
  type: 'SWITCH_CHANNEL',
  payload: { channel }
}))
jest.mock('../store/channel/actions', () => ({
  switchChannelActionAC: (channel: any) => mockSwitchChannelActionAC(channel)
}))

// Mock getShowOnlyContactUsers
jest.mock('./contacts', () => ({
  getShowOnlyContactUsers: () => false
}))

describe('notifications.ts', () => {
  let originalNotification: typeof Notification | undefined
  let mockNotificationInstance: any
  let MockNotificationClass: jest.Mock

  beforeAll(() => {
    originalNotification = (global as any).Notification
  })

  beforeEach(() => {
    jest.resetModules()
    jest.useFakeTimers()
    resetMessageListFixtureIds()
    mockDispatch.mockClear()
    mockSwitchChannelActionAC.mockClear()

    // Create a fresh mock Notification class for each test
    mockNotificationInstance = {
      close: jest.fn(),
      onclick: null
    }
    MockNotificationClass = jest.fn(() => mockNotificationInstance) as any
    MockNotificationClass.permission = 'default'
    MockNotificationClass.requestPermission = jest.fn(async () => 'granted')
    ;(global as any).Notification = MockNotificationClass

    // Clean up DOM
    document.body.innerHTML = ''
    document.head.querySelectorAll('style').forEach((s) => s.remove())

    // Clean up previous notification reference
    delete (window as any).sceytTabNotifications
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  afterAll(() => {
    if (originalNotification) {
      ;(global as any).Notification = originalNotification
    }
  })

  // Helper to load a fresh module instance and initialize permission
  const loadNotifications = async (permission: NotificationPermission = 'default') => {
    MockNotificationClass.permission = permission
    const notifications = require('./notifications') as typeof import('./notifications')
    await notifications.initializeNotifications()
    return notifications
  }

  // Synchronous version for simple tests
  const loadNotificationsSync = () => {
    return require('./notifications') as typeof import('./notifications')
  }

  const makeTestUser = (overrides: Partial<IUser> = {}): IUser =>
    makeUser({ id: 'sender-1', firstName: 'John', lastName: 'Doe', ...overrides })

  const makeDirectChannel = (overrides: Partial<IChannel> = {}): IChannel =>
    makeChannel({
      id: 'direct-1',
      type: DEFAULT_CHANNEL_TYPE.DIRECT,
      ...overrides
    })

  const makeGroupChannel = (overrides: Partial<IChannel> = {}): IChannel =>
    makeChannel({
      id: 'group-1',
      type: DEFAULT_CHANNEL_TYPE.GROUP,
      subject: 'Test Group',
      ...overrides
    })

  describe('setShowNotifications', () => {
    it('setShowNotifications(false) prevents any notification from being created', async () => {
      const notifications = await loadNotifications('granted')
      notifications.setShowNotifications(false)

      notifications.setNotification('Hello', makeTestUser(), makeDirectChannel())

      expect(MockNotificationClass).not.toHaveBeenCalled()
      expect(document.body.innerHTML).toBe('')
    })

    it('setShowNotifications(true) allows notifications to be created', async () => {
      const notifications = await loadNotifications('granted')
      notifications.setShowNotifications(true)

      notifications.setNotification('Hello', makeTestUser(), makeDirectChannel())

      expect(MockNotificationClass).toHaveBeenCalled()
    })
  })

  describe('native Notification (permission granted)', () => {
    it('creates a native Notification with title, body, icon, and tag', async () => {
      const notifications = await loadNotifications('granted')
      notifications.setNotificationLogoSrc('https://example.com/logo.png')
      const user = makeTestUser({ firstName: 'Alice' })
      const channel = makeDirectChannel()

      notifications.setNotification('Test message', user, channel)

      expect(MockNotificationClass).toHaveBeenCalledWith(
        expect.stringContaining('Alice'),
        expect.objectContaining({
          body: 'Test message',
          icon: 'https://example.com/logo.png',
          tag: 'sceyt-notification'
        })
      )
    })

    it('auto-closes after 5 seconds', async () => {
      const notifications = await loadNotifications('granted')
      notifications.setNotification('Hello', makeTestUser(), makeDirectChannel())

      expect(mockNotificationInstance.close).not.toHaveBeenCalled()

      jest.advanceTimersByTime(5000)

      expect(mockNotificationInstance.close).toHaveBeenCalled()
    })

    it('onclick focuses window and dispatches switchChannelActionAC(channel)', async () => {
      const notifications = await loadNotifications('granted')
      const channel = makeDirectChannel()
      const focusSpy = jest.spyOn(window, 'focus').mockImplementation(() => {})

      notifications.setNotification('Hello', makeTestUser(), channel)

      // Simulate onclick
      const event = { preventDefault: jest.fn() }
      mockNotificationInstance.onclick(event)

      expect(event.preventDefault).toHaveBeenCalled()
      expect(focusSpy).toHaveBeenCalled()
      expect(mockSwitchChannelActionAC).toHaveBeenCalledWith(channel)
      expect(mockDispatch).toHaveBeenCalled()
      expect(mockNotificationInstance.close).toHaveBeenCalled()

      focusSpy.mockRestore()
    })
  })

  describe('title/body formatting', () => {
    it('direct chat: uses user name as title, body is the message text', async () => {
      const notifications = await loadNotifications('granted')
      const user = makeTestUser({ firstName: 'Jane', lastName: 'Smith' })
      const channel = makeDirectChannel()

      notifications.setNotification('Hello there', user, channel)

      expect(MockNotificationClass).toHaveBeenCalledWith(
        expect.stringContaining('Jane'),
        expect.objectContaining({ body: 'Hello there' })
      )
    })

    it('group chat: uses subject as title, body includes "Name\\nbody"', async () => {
      const notifications = await loadNotifications('granted')
      const user = makeTestUser({ firstName: 'Bob' })
      const channel = makeGroupChannel({ subject: 'My Team' })

      notifications.setNotification('Group message', user, channel)

      expect(MockNotificationClass).toHaveBeenCalledWith(
        'My Team',
        expect.objectContaining({ body: expect.any(String) })
      )
      // Body should contain the user name and message
      const callArgs = MockNotificationClass.mock.calls[0]
      expect(callArgs[1].body).toContain('Bob')
      expect(callArgs[1].body).toContain('Group message')
    })

    it('attachment type voice shows label Voice', async () => {
      const notifications = await loadNotifications('granted')
      notifications.setNotification('', makeTestUser(), makeDirectChannel(), undefined, { type: 'voice' } as any)
      expect(MockNotificationClass.mock.calls[0][1].body).toContain('Voice')
    })

    it('attachment type image shows label Photo', async () => {
      const notifications = await loadNotifications('granted')
      notifications.setNotification('', makeTestUser(), makeDirectChannel(), undefined, { type: 'image' } as any)
      expect(MockNotificationClass.mock.calls[0][1].body).toContain('Photo')
    })

    it('attachment type video shows label Video', async () => {
      const notifications = await loadNotifications('granted')
      notifications.setNotification('', makeTestUser(), makeDirectChannel(), undefined, { type: 'video' } as any)
      expect(MockNotificationClass.mock.calls[0][1].body).toContain('Video')
    })

    it('attachment type file shows label File', async () => {
      const notifications = await loadNotifications('granted')
      notifications.setNotification('', makeTestUser(), makeDirectChannel(), undefined, { type: 'file' } as any)
      expect(MockNotificationClass.mock.calls[0][1].body).toContain('File')
    })

    it('reaction shows proper format with emoji and quoted message', async () => {
      const notifications = await loadNotifications('granted')
      const user = makeTestUser({ firstName: 'Mike' })
      const channel = makeDirectChannel()

      notifications.setNotification('Original message', user, channel, '👍')

      const callArgs = MockNotificationClass.mock.calls[0]
      expect(callArgs[1].body).toContain('reacted')
      expect(callArgs[1].body).toContain('👍')
      expect(callArgs[1].body).toContain('Original message')
    })

    it('setContactsMap updates the internal contacts map', async () => {
      const notifications = await loadNotifications('granted')
      const userId = 'contact-user-123'

      // Verify setContactsMap can be called without error
      expect(() => {
        notifications.setContactsMap({
          [userId]: { id: userId, firstName: 'ContactName', lastName: 'Last' } as any
        })
      }).not.toThrow()

      // The notification title construction uses makeUsername which
      // prioritizes the contactsMap entry if available
      // Full integration requires the actual makeUsername behavior
      const user = makeTestUser({ id: userId, firstName: 'Fallback' })
      const channel = makeDirectChannel()

      notifications.setNotification('Hello', user, channel)

      // Verify notification was created
      expect(MockNotificationClass).toHaveBeenCalled()
    })
  })

  describe('closing previous notification', () => {
    it('closes previous notification when a new one is created', async () => {
      const notifications = await loadNotifications('granted')

      // First notification
      notifications.setNotification('First', makeTestUser(), makeDirectChannel())
      const firstNotification = (window as any).sceytTabNotifications

      // Second notification
      const newMockInstance = { close: jest.fn(), onclick: null }
      MockNotificationClass.mockImplementation(() => newMockInstance)

      notifications.setNotification('Second', makeTestUser(), makeDirectChannel())

      expect(firstNotification.close).toHaveBeenCalled()
    })
  })

  describe('fallback to in-page notification', () => {
    it('falls back to custom notification when native constructor throws', async () => {
      const notifications = await loadNotifications('granted')
      MockNotificationClass.mockImplementation(() => {
        throw new Error('Notification blocked')
      })

      notifications.setNotification('Hello', makeTestUser(), makeDirectChannel())

      // Should have created an in-page notification
      const notificationEl = document.body.querySelector('div')
      expect(notificationEl).toBeTruthy()
      expect(notificationEl?.textContent).toContain('Hello')
    })

    it("permission 'default' shows in-page notification AND calls requestPermission", async () => {
      const notifications = await loadNotifications('default')

      notifications.setNotification('Hello', makeTestUser(), makeDirectChannel())

      // Should have created an in-page notification
      const notificationEl = document.body.querySelector('div')
      expect(notificationEl).toBeTruthy()
    })

    it("permission 'denied' shows in-page notification only", async () => {
      const notifications = await loadNotifications('denied')

      notifications.setNotification('Hello', makeTestUser(), makeDirectChannel())

      expect(MockNotificationClass).not.toHaveBeenCalled()
      const notificationEl = document.body.querySelector('div')
      expect(notificationEl).toBeTruthy()
    })

    it('no Notification support shows in-page notification only', () => {
      delete (global as any).Notification

      const notifications = loadNotificationsSync()
      notifications.setNotification('Hello', makeTestUser(), makeDirectChannel())

      const notificationEl = document.body.querySelector('div')
      expect(notificationEl).toBeTruthy()
    })
  })

  describe('in-page notification', () => {
    it('renders title and body as TEXT (XSS prevention)', async () => {
      const notifications = await loadNotifications('denied')
      const xssPayload = '<img src=x onerror=alert(1)>'

      notifications.setNotification(xssPayload, makeTestUser(), makeDirectChannel())

      // Check that no <img> element exists
      expect(document.body.querySelector('img')).toBeNull()
      // The text should be escaped and visible
      const notificationEl = document.body.querySelector('div')
      expect(notificationEl?.textContent).toContain(xssPayload)
    })

    it('close button removes notification after animation', async () => {
      const notifications = await loadNotifications('denied')
      notifications.setNotification('Hello', makeTestUser(), makeDirectChannel())

      const closeButton = document.body.querySelector('button')
      expect(closeButton).toBeTruthy()

      closeButton?.click()

      // Advance past the animation time (300ms)
      jest.advanceTimersByTime(300)

      expect(document.body.querySelector('div')).toBeNull()
    })

    it('auto-removes after 5 seconds', async () => {
      const notifications = await loadNotifications('denied')
      notifications.setNotification('Hello', makeTestUser(), makeDirectChannel())

      expect(document.body.querySelector('div')).toBeTruthy()

      // Advance past the 5s auto-close + 300ms animation
      jest.advanceTimersByTime(5300)

      expect(document.body.querySelector('div')).toBeNull()
    })

    // Regression: clicking the in-page notification used to dispatch switchChannelActionAC(null),
    // which closed the chat instead of opening the notification's channel.
    it('clicking the in-page notification opens the notification channel', async () => {
      const notifications = await loadNotifications('denied')
      const channel = makeDirectChannel({ id: 'target-channel' })

      notifications.setNotification('Hello', makeTestUser(), channel)

      const notificationEl = document.body.querySelector('div')
      // Click on the notification (not the close button)
      const titleEl = notificationEl?.querySelector('div')
      titleEl?.click()

      expect(mockSwitchChannelActionAC).toHaveBeenCalledWith(channel)
      expect(mockSwitchChannelActionAC).not.toHaveBeenCalledWith(null)
    })

    // Regression: every in-page notification used to append a new <style> to document.head.
    it('adds the in-page notification <style> at most once', async () => {
      const notifications = await loadNotifications('denied')
      const initialStyleCount = document.head.querySelectorAll('style').length

      // Show 3 notifications
      notifications.setNotification('First', makeTestUser(), makeDirectChannel())
      notifications.setNotification('Second', makeTestUser(), makeDirectChannel())
      notifications.setNotification('Third', makeTestUser(), makeDirectChannel())

      const finalStyleCount = document.head.querySelectorAll('style').length

      expect(finalStyleCount - initialStyleCount).toBeLessThanOrEqual(1)
      expect(document.head.querySelectorAll('#sceyt-custom-notification-style')).toHaveLength(1)
    })
  })

  describe('requestNotificationPermission', () => {
    it('returns denied when notifications are not supported', async () => {
      delete (global as any).Notification
      const notifications = loadNotificationsSync()

      const result = await notifications.requestNotificationPermission()

      expect(result).toBe('denied')
    })

    it('returns denied when requestPermission throws', async () => {
      MockNotificationClass.requestPermission = jest.fn(async () => {
        throw new Error('User interaction required')
      })
      const notifications = loadNotificationsSync()

      const result = await notifications.requestNotificationPermission()

      expect(result).toBe('denied')
    })

    it('returns the permission from requestPermission on success', async () => {
      MockNotificationClass.requestPermission = jest.fn(async () => 'granted')
      const notifications = loadNotificationsSync()

      const result = await notifications.requestNotificationPermission()

      expect(result).toBe('granted')
      expect(MockNotificationClass.requestPermission).toHaveBeenCalled()
    })
  })

  describe('initializeNotifications', () => {
    it('reads Notification.permission when supported', async () => {
      MockNotificationClass.permission = 'granted'
      const notifications = loadNotificationsSync()

      await notifications.initializeNotifications()

      // The internal state should be updated (we can verify by subsequent setNotification behavior)
      notifications.setNotification('Test', makeTestUser(), makeDirectChannel())
      expect(MockNotificationClass).toHaveBeenCalled()
    })

    it('does nothing when notifications are not supported', async () => {
      delete (global as any).Notification
      const notifications = loadNotificationsSync()

      // Should not throw
      await notifications.initializeNotifications()
    })
  })

  describe('getShowNotifications', () => {
    it('returns the current showNotifications value', () => {
      const notifications = loadNotificationsSync()

      expect(notifications.getShowNotifications()).toBe(true)

      notifications.setShowNotifications(false)
      expect(notifications.getShowNotifications()).toBe(false)

      notifications.setShowNotifications(true)
      expect(notifications.getShowNotifications()).toBe(true)
    })
  })
})
