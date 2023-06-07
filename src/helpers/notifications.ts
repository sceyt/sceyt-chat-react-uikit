import { IChannel, IContactsMap, IUser } from '../types'
import { makeUsername } from './message'
import { getShowOnlyContactUsers } from './contacts'
import store from '../store'
import { SWITCH_CHANNEL } from '../store/channel/constants'
import { CHANNEL_TYPE } from './constants'

let contactsMap = {}
let logoSrc = ''
let showNotifications: boolean | undefined = true
/* let windowObjectReference: any = null // global variable
let previousURL: any /!* global variable that will store the
                    url currently in the secondary window *!/
function openRequestedSingleTab(url: any) {
  console.log('previousURL ... ', previousURL)
  console.log('url ... ', url)
  if (windowObjectReference === null || windowObjectReference.closed) {
    console.log('case 1')
    windowObjectReference = window.open(url, 'SingleSecondaryWindowName')
  } else if (previousURL !== url) {
    console.log('case 2')
    windowObjectReference = window.open(url, 'SingleSecondaryWindowName')
    /!* if the resource to load is different,
       then we load it in the already opened secondary window and then
       we bring such window back on top/in front of its parent window. *!/
    windowObjectReference.focus()
  } else {
    console.log('case 3')
    windowObjectReference.focus()
  }
  console.log('case 4')
  console.log('set prev url .. ', url)
  previousURL = url
  return false
  /!* explanation: we store the current url in order to compare url
     in the event of another call of this function. *!/
} */
export const setNotification = (body: string, user: IUser, channel: IChannel, reaction?: string) => {
  const getFromContacts = getShowOnlyContactUsers()

  /* chrome.runtime.onMessage.addListener(function (msg, sender) {
    const options = {
      type: 'basic',
      title: msg.title,
      message: 'Price: ' + msg.price + '\nFinished ',
      iconUrl: 'icon.png'
    }

    chrome.notifications.create(options, function (notifId) {
      linkMap[notifId] = msg.link
    })
  }) */

  let notification: any
  if (showNotifications) {
    if (reaction) {
      notification = new Notification(
        `${
          channel.peer && channel.peer.id
            ? makeUsername(contactsMap[channel.peer.id], channel.peer, getFromContacts)
            : channel.subject
        }`,
        {
          body: `${
            channel.type !== CHANNEL_TYPE.DIRECT ? makeUsername(contactsMap[user.id], user, getFromContacts) + ': ' : ''
          } reacted ${reaction} to "${body}"`,
          icon: logoSrc
          // silent: false
        }
      )
    } else {
      notification = new Notification(`New Message from ${makeUsername(contactsMap[user.id], user, getFromContacts)}`, {
        body,
        icon: logoSrc
        // silent: false
      })
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
