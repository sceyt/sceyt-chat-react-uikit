import React, { Children, useEffect, useState } from 'react'
// @ts-ignore
import SceytChatClient from 'sceyt-chat'
import { useDispatch, useSelector } from 'react-redux'
import { setClient } from '../../common/client'
import { destroyChannelsMap } from '../../helpers/channelHalper'
import { destroySession, watchForEventsAC } from '../../store/channel/actions'
import { setAvatarColor } from '../../UIHelper/avatarColors'
import { ChatContainer } from './styled'
import { getContactsAC, setConnectionStatusAC } from '../../store/user/actions'
import { setShowContactInfo } from '../../helpers/contacts'
import { setContactsMap, setNotificationLogoSrc } from '../../helpers/notifications'
import { IContactsMap } from '../../types'
import { contactsMapSelector } from '../../store/user/selector'
import { setCustomUploader, setSendAttachmentsAsSeparateMessages } from '../../helpers/customUploader'
import { IChatClientProps } from '../ChatContainer'

const SceytChat = ({
  client,
  avatarColors,
  children,
  showContactInfoOnUserList,
  logoSrc,
  CustomUploader,
  sendAttachmentsAsSeparateMessages
}: IChatClientProps) => {
  const dispatch = useDispatch()
  const contactsMap: IContactsMap = useSelector(contactsMapSelector)
  const childrenArr = Children.toArray(children)
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
  const handleVisibilityChange = () => {
    if (document[hidden]) {
      setTabIsActive(false)
    } else {
      setTabIsActive(true)
    }
  }
  useEffect(() => {
    if (client) {
      setClient(client)
      setSceytChatClient(client)
      dispatch(getContactsAC())
      dispatch(watchForEventsAC())
      dispatch(setConnectionStatusAC(client.chatClient.connectStatus))
    } else {
      destroyChannelsMap()
      dispatch(destroySession())
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

    if (sendAttachmentsAsSeparateMessages) {
      setSendAttachmentsAsSeparateMessages(sendAttachmentsAsSeparateMessages)
    }

    if (logoSrc) {
      setNotificationLogoSrc(logoSrc)
    }
    if (avatarColors) {
      setAvatarColor(avatarColors)
    }
    if (showContactInfoOnUserList) {
      setShowContactInfo(showContactInfoOnUserList)
    }
    try {
      if (window.Notification && Notification.permission === 'default') {
        Notification.requestPermission().then(console.log).catch(console.error)
      }
    } catch (e) {
      console.error('safari Notification request permission', e)
    }
    window.sceytTabNotifications = null
    window.sceytTabUrl = window.location.href

    document.addEventListener(visibilityChange, handleVisibilityChange, false)
    return () => {
      document.removeEventListener(visibilityChange, handleVisibilityChange)
    }
  }, [])

  useEffect(() => {
    if (tabIsActive) {
      console.log('tab is active')
      if (window.sceytTabNotifications) {
        window.sceytTabNotifications.close()
      }
    }
  }, [tabIsActive])
  useEffect(() => {
    if (contactsMap) {
      setContactsMap(contactsMap)
    }
  }, [contactsMap])
  return (
    <React.Fragment>
      {SceytChatClient ? (
        <React.Fragment>
          {SceytChatHeader}
          <ChatContainer className='sceyt-chat-container' withHeader={SceytChatHeader}>
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
