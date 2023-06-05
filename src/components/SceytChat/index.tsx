import React, { Children, useEffect, useState } from 'react'
// @ts-ignore
import SceytChatClient from 'sceyt-chat'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import { setClient } from '../../common/client'
import { destroyChannelsMap, setActiveChannelId } from '../../helpers/channelHalper'
import { destroySession, setIsDraggingAC, setTabIsActiveAC, watchForEventsAC } from '../../store/channel/actions'
import { setAvatarColor } from '../../UIHelper/avatarColors'
import { ChatContainer } from './styled'
import { browserTabIsActiveAC, setConnectionStatusAC, setUserAC } from '../../store/user/actions'
import { setShowOnlyContactUsers } from '../../helpers/contacts'
import { setContactsMap, setNotificationLogoSrc, setShowNotifications } from '../../helpers/notifications'
import { IContactsMap } from '../../types'
import { contactsMapSelector } from '../../store/user/selector'
import { setCustomUploader, setSendAttachmentsAsSeparateMessages } from '../../helpers/customUploader'
import { IChatClientProps } from '../ChatContainer'
import { colors } from '../../UIHelper/constants'
import { channelListWidthSelector, isDraggingSelector } from '../../store/channel/selector'
import { setHideUserPresence } from '../../helpers/userHelper'
import { clearMessagesMap, removeAllMessages } from '../../helpers/messagesHalper'

const SceytChat = ({
  client,
  avatarColors,
  children,
  showOnlyContactUsers,
  logoSrc,
  CustomUploader,
  sendAttachmentsAsSeparateMessages,
  customColors,
  hideUserPresence,
  showNotifications
}: IChatClientProps) => {
  const dispatch = useDispatch()
  const contactsMap: IContactsMap = useSelector(contactsMapSelector)
  const childrenArr = Children.toArray(children)
  const draggingSelector = useSelector(isDraggingSelector, shallowEqual)
  const channelsListWidth = useSelector(channelListWidthSelector, shallowEqual)
  const OtherChildren = childrenArr.filter(({ type }: any) => type.name !== 'SceytChatHeader')
  // const channels = useSelector(channelsSelector)
  const SceytChatHeader = childrenArr.find(({ type }: any) => type.name === 'SceytChatHeader')
  const [SceytChatClient, setSceytChatClient] = useState<null | SceytChatClient>(null)
  const [tabIsActive, setTabIsActive] = useState(true)
  let hidden: any = null
  let visibilityChange: any = null
  if (typeof document.hidden !== 'undefined') {
    hidden = 'hidden'
    visibilityChange = 'visibilitychange'
  } else if (typeof document.msHidden !== 'undefined') {
    hidden = 'msHidden'
    visibilityChange = 'msvisibilitychange'
  } else if (typeof document.webkitHidden !== 'undefined') {
    hidden = 'webkitHidden'
    visibilityChange = 'webkitvisibilitychange'
  }
  const handleDropFile = (e: any) => {
    e.preventDefault()
    e.stopPropagation()
    dispatch(setIsDraggingAC(false))
  }
  const handleDragOver = (e: any) => {
    e.preventDefault()
    if (!draggingSelector) {
      dispatch(setIsDraggingAC(true))
    }
  }

  const handleVisibilityChange = () => {
    if (document[hidden]) {
      setTabIsActive(false)
      dispatch(browserTabIsActiveAC(false))
    } else {
      setTabIsActive(true)
      dispatch(browserTabIsActiveAC(true))
    }
  }
  useEffect(() => {
    if (client) {
      setClient(client)
      setSceytChatClient(client)
      dispatch(setUserAC(client.user))
      /* if (userDisplayNameFromContacts) {
        dispatch(getContactsAC())
      } */

      dispatch(watchForEventsAC())
      dispatch(setConnectionStatusAC(client.connectionState))
    } else {
      clearMessagesMap()
      removeAllMessages()
      setActiveChannelId('')
      destroyChannelsMap()
      dispatch(destroySession())
    }

    window.onblur = () => {
      setTabIsActive(false)
    }
    window.onfocus = () => {
      setTabIsActive(true)
    }
  }, [client])
  useEffect(() => {
    if (CustomUploader) {
      setCustomUploader(CustomUploader)
      /* const up = new CustomUploader()

      up.getFile('empy').then((file: any) => {
        console.log('my file url ,,, ', file)
        setVideoBlob(file)
      }) */
    }
    if (customColors) {
      if (customColors.primaryColor) {
        colors.primary = customColors.primaryColor
      }
      if (customColors.primaryLight) {
        colors.primaryLight = customColors.primaryLight
      }
      if (customColors.textColor1) {
        colors.gray6 = customColors.textColor1
      }
      if (customColors.textColor2) {
        colors.gray8 = customColors.textColor2
      }
      if (customColors.textColor3) {
        colors.gray9 = customColors.textColor3
      }
      if (customColors.defaultAvatarBackground) {
        colors.defaultAvatarBackground = customColors.defaultAvatarBackground
      }
      if (customColors.deletedUserAvatarBackground) {
        colors.deleteUserIconBackground = customColors.deletedUserAvatarBackground
      }
    }
    if (sendAttachmentsAsSeparateMessages) {
      setSendAttachmentsAsSeparateMessages(sendAttachmentsAsSeparateMessages)
    }

    if (logoSrc) {
      setNotificationLogoSrc(logoSrc)
    }
    setShowNotifications(showNotifications)
    if (avatarColors) {
      setAvatarColor(avatarColors)
    }
    if (showOnlyContactUsers) {
      setShowOnlyContactUsers(showOnlyContactUsers)
    }
    if (showNotifications) {
      try {
        if (window.Notification && Notification.permission === 'default') {
          // Notification.requestPermission().then(console.log).catch(console.error)
          Promise.resolve(Notification.requestPermission()).then(function (permission) {
            console.log('permission:', permission)
          })
        }
      } catch (e) {
        console.error('safari Notification request permission', e)
      }
      window.sceytTabNotifications = null
      window.sceytTabUrl = window.location.href
    }

    document.addEventListener(visibilityChange, handleVisibilityChange, false)
    return () => {
      document.removeEventListener(visibilityChange, handleVisibilityChange)
    }
  }, [customColors])

  useEffect(() => {
    dispatch(setTabIsActiveAC(tabIsActive))
    if (tabIsActive && showNotifications) {
      if (window.sceytTabNotifications) {
        window.sceytTabNotifications.close()
      }
    }
  }, [tabIsActive])
  useEffect(() => {
    if (hideUserPresence) {
      setHideUserPresence(hideUserPresence)
    }
    if (contactsMap) {
      setContactsMap(contactsMap)
    }
  }, [contactsMap])
  return (
    <React.Fragment>
      {SceytChatClient ? (
        <React.Fragment>
          {SceytChatHeader}
          <ChatContainer
            onDrop={handleDropFile}
            onDragOver={handleDragOver}
            className='sceyt-chat-container'
            withHeader={SceytChatHeader}
            withChannelsList={channelsListWidth && channelsListWidth > 0}
          >
            {OtherChildren}
          </ChatContainer>
        </React.Fragment>
      ) : (
        ''
      )}
    </React.Fragment>
  )
}

export default SceytChat
