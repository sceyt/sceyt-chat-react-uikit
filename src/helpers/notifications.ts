import { IAttachment, IChannel, IContactsMap, IUser } from '../types'
import { makeUsername } from './message'
import { getShowOnlyContactUsers } from './contacts'
import store from '../store'
import { SWITCH_CHANNEL } from '../store/channel/constants'
import { attachmentTypes, DEFAULT_CHANNEL_TYPE } from './constants'

let contactsMap: IContactsMap = {}
let logoSrc: string = ''
let showNotifications: boolean | undefined = true
let notificationPermission: NotificationPermission = 'default'

// Check if browser supports notifications
const isNotificationSupported = (): boolean => {
  return 'Notification' in window
}

// Request notification permission
export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!isNotificationSupported()) {
    console.warn('Notifications are not supported in this browser')
    return 'denied'
  }

  try {
    // Let the browser handle the permission request natively
    const permission = await Notification.requestPermission()
    notificationPermission = permission
    return permission
  } catch (error) {
    console.error('Error requesting notification permission:', error)
    notificationPermission = 'denied'
    return 'denied'
  }
}

// Create a custom notification for Safari fallback
const createCustomNotification = (title: string, body: string) => {
  // Create a custom notification element
  const notificationElement = document.createElement('div')
  notificationElement.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    max-width: 300px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    animation: slideIn 0.3s ease-out;
  `

  // Add animation styles
  const style = document.createElement('style')
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `
  document.head.appendChild(style)

  // Create notification content
  const titleElement = document.createElement('div')
  titleElement.style.cssText = 'font-weight: bold; margin-bottom: 8px; color: #333;'
  titleElement.textContent = title

  const bodyElement = document.createElement('div')
  bodyElement.style.cssText = 'color: #666; font-size: 14px; line-height: 1.4;'
  bodyElement.textContent = body

  const closeButton = document.createElement('button')
  closeButton.textContent = '×'
  closeButton.style.cssText = `
    position: absolute;
    top: 8px;
    right: 8px;
    background: none;
    border: none;
    font-size: 18px;
    cursor: pointer;
    color: #999;
    padding: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  `

  notificationElement.appendChild(titleElement)
  notificationElement.appendChild(bodyElement)
  notificationElement.appendChild(closeButton)

  // Add click handler
  notificationElement.addEventListener('click', (event) => {
    if (event.target !== closeButton) {
      window.focus()
      store.dispatch({
        type: SWITCH_CHANNEL,
        payload: { channel: null } // Will be set by the caller
      })
    }
  })

  // Add close functionality
  const closeNotification = () => {
    notificationElement.style.animation = 'slideOut 0.3s ease-in'
    setTimeout(() => {
      if (notificationElement.parentNode) {
        notificationElement.parentNode.removeChild(notificationElement)
      }
    }, 300)
  }

  closeButton.addEventListener('click', closeNotification)

  // Auto-close after 5 seconds
  setTimeout(closeNotification, 5000)

  // Add to page
  document.body.appendChild(notificationElement)

  return {
    close: closeNotification,
    onclick: (handler: () => void) => {
      notificationElement.addEventListener('click', handler)
    }
  }
}

export const setNotification = (
  body: string,
  user: IUser,
  channel: IChannel,
  reaction?: string,
  attachment?: IAttachment
) => {
  if (!showNotifications) return

  const getFromContacts = getShowOnlyContactUsers()
  let attachmentType
  if (attachment) {
    const attType = attachment.type
    attachmentType =
      attType === attachmentTypes.voice
        ? 'Voice'
        : attType === attachmentTypes.image
          ? 'Photo'
          : attType === attachmentTypes.video
            ? 'Video'
            : 'File'
  }

  const isDirectChannel = channel.type === DEFAULT_CHANNEL_TYPE.DIRECT
  const title =
    (isDirectChannel ? makeUsername(contactsMap[user.id], user, getFromContacts) : channel.subject) || 'New Message'

  let notificationBody = ''
  if (reaction) {
    notificationBody = `${
      channel.type !== DEFAULT_CHANNEL_TYPE.DIRECT
        ? makeUsername(contactsMap[user.id], user, getFromContacts) + ': '
        : ''
    } reacted ${reaction} to "${attachmentType || ''}${attachmentType && body ? ': ' : ''}${body}"`
  } else {
    notificationBody = isDirectChannel
      ? `${attachmentType || ''}${attachmentType && body ? ': ' : ''}${body}`
      : `${makeUsername(contactsMap[user.id], user, getFromContacts)}\n${attachmentType || ''}${
          attachmentType && body ? ': ' : ''
        }${body}`
  }

  let notification: any

  // Check if we have permission and browser support
  if (isNotificationSupported()) {
    if (notificationPermission === 'granted') {
      try {
        // Use native notification API
        notification = new Notification(title, {
          body: notificationBody,
          icon: logoSrc || '',
          tag: 'sceyt-notification', // Group notifications
          requireInteraction: false
        })

        notification.onclick = (event: any) => {
          event.preventDefault()
          window.focus()
          store.dispatch({
            type: SWITCH_CHANNEL,
            payload: { channel }
          })
          notification.close()
        }

        // Auto-close after 5 seconds
        setTimeout(() => {
          if (notification) {
            notification.close()
          }
        }, 5000)
      } catch (error) {
        console.error('Error creating native notification:', error)
        // Fallback to custom notification
        notification = createCustomNotification(title, notificationBody)
      }
    } else if (notificationPermission === 'default') {
      // Request permission and show custom notification for now
      requestPermissionOnUserInteraction()
      notification = createCustomNotification(title, notificationBody)
    } else {
      // Permission denied, use custom notification
      notification = createCustomNotification(title, notificationBody)
    }
  } else {
    // Browser doesn't support notifications, use custom notification
    notification = createCustomNotification(title, notificationBody)
  }

  // Store reference for cleanup
  if (window.sceytTabNotifications) {
    try {
      window.sceytTabNotifications.close()
    } catch (error) {
      console.warn('Error closing previous notification:', error)
    }
  }
  window.sceytTabNotifications = notification
}

export const setNotificationLogoSrc = (src: string) => {
  logoSrc = src
}

export const setContactsMap = (contacts: IContactsMap) => {
  contactsMap = contacts
}

export const setShowNotifications = (show?: boolean) => {
  showNotifications = show
}

export const getShowNotifications = () => showNotifications

// Initialize notification permission on load
export const initializeNotifications = async () => {
  if (isNotificationSupported()) {
    notificationPermission = Notification.permission
    if (notificationPermission === 'default') {
      // Don't auto-request permission, wait for user interaction
      console.log('Notification permission not yet requested')
    }
  }
}

// Call this when user interacts with the app (e.g., clicks a button)
export const requestPermissionOnUserInteraction = async () => {
  if (notificationPermission === 'default') {
    await requestNotificationPermission()
  }
}
