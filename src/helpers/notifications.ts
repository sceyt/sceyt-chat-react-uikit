import { IAttachment, IChannel, IContactsMap, IUser } from '../types'
import { makeUsername } from './message'
import { getShowOnlyContactUsers } from './contacts'
import store from '../store'
import { SWITCH_CHANNEL } from '../store/channel/constants'
import { attachmentTypes, DEFAULT_CHANNEL_TYPE } from './constants'

let contactsMap: IContactsMap = {}
let logoSrc = ''
let showNotifications: boolean | undefined = true
/* let windowObjectReference: any = null // global variable
let previousURL: any /!* global variable that will store the
                    url currently in the secondary window *!/
function openRequestedSingleTab(url: any) {
  log.info('previousURL ... ', previousURL)
  log.info('url ... ', url)
  if (windowObjectReference === null || windowObjectReference.closed) {
    log.info('case 1')
    windowObjectReference = window.open(url, 'SingleSecondaryWindowName')
  } else if (previousURL !== url) {
    log.info('case 2')
    windowObjectReference = window.open(url, 'SingleSecondaryWindowName')
    /!* if the resource to load is different,
       then we load it in the already opened secondary window and then
       we bring such window back on top/in front of its parent window. *!/
    windowObjectReference.focus()
  } else {
    log.info('case 3')
    windowObjectReference.focus()
  }
  log.info('case 4')
  log.info('set prev url .. ', url)
  previousURL = url
  return false
  /!* explanation: we store the current url in order to compare url
     in the event of another call of this function. *!/
} */
export const setNotification = (
  body: string,
  user: IUser,
  channel: IChannel,
  reaction?: string,
  attachment?: IAttachment
) => {
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
  let notification: any
  if (showNotifications) {
    if (reaction) {
      notification = new Notification(
        `${isDirectChannel ? makeUsername(contactsMap[user.id], user, getFromContacts) : channel.subject}`,
        {
          body: `${
            channel.type !== DEFAULT_CHANNEL_TYPE.DIRECT
              ? makeUsername(contactsMap[user.id], user, getFromContacts) + ': '
              : ''
          } reacted ${reaction} to "${attachmentType || ''}${attachmentType && body ? ': ' : ''}${body}"`,
          icon: logoSrc
          // silent: false
        }
      )
    } else {
      notification = new Notification(
        `${isDirectChannel ? makeUsername(contactsMap[user.id], user, getFromContacts) : channel.subject}`,
        {
          body: isDirectChannel
            ? `${attachmentType || ''}${attachmentType && body ? ': ' : ''}${body}`
            : `${makeUsername(contactsMap[user.id], user, getFromContacts)}\n${attachmentType || ''}${
                attachmentType && body ? ': ' : ''
              }${body}`,
          icon: logoSrc
          // silent: false
          // silent: false
        }
      )
    }
    // windowObjectReference = window.sceytTabUrl
    notification.onclick = (event: any) => {
      event.preventDefault() // prevent the browser from focusing the Notification's tab
      window.focus()
      store.dispatch({
        type: SWITCH_CHANNEL,
        payload: {
          channel
        }
      })
      notification.close()
    }
    if (window.sceytTabNotifications) {
      window.sceytTabNotifications.close()
    }
    window.sceytTabNotifications = notification
  }
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
