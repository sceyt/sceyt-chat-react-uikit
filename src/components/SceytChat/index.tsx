import React, { useEffect, useState } from 'react'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import styled from 'styled-components'
// Store
import { destroySession, setIsDraggingAC, setTabIsActiveAC, watchForEventsAC } from '../../store/channel/actions'
import { channelListWidthSelector, isDraggingSelector } from '../../store/channel/selector'
import { contactsMapSelector } from '../../store/user/selector'
import { getRolesAC } from '../../store/member/actions'
import { getRolesFailSelector } from '../../store/member/selector'
// Hooks
import { useDidUpdate, useColor } from '../../hooks'
// Helpers
import {
  destroyChannelsMap,
  setActiveChannelId,
  setAutoSelectFitsChannel,
  setChannelTypesFilter,
  setChannelTypesMemberDisplayTextMap,
  setDefaultRolesByChannelTypesMap,
  setHandleNewMessages,
  setOpenChatOnUserInteraction
} from '../../helpers/channelHalper'
import { setClient } from '../../common/client'
import { setAvatarColor } from '../../UIHelper/avatarColors'
import { browserTabIsActiveAC, getContactsAC, setConnectionStatusAC, setUserAC } from '../../store/user/actions'
import { setShowOnlyContactUsers } from '../../helpers/contacts'
import { setContactsMap, setNotificationLogoSrc, setShowNotifications } from '../../helpers/notifications'
import { IContactsMap } from '../../types'
import { setCustomUploader, setSendAttachmentsAsSeparateMessages } from '../../helpers/customUploader'
import { IChatClientProps, ThemeColor } from '../ChatContainer'
import { colors, defaultTheme, THEME_COLORS } from '../../UIHelper/constants'
import { setHideUserPresence } from '../../helpers/userHelper'
import { clearMessagesMap, removeAllMessages } from '../../helpers/messagesHalper'
import { setTheme, setThemeAC } from '../../store/theme/actions'
import { SceytChatUIKitTheme, ThemeMode } from '../../components'
import { moderateColor } from '../../UIHelper/moderateColor'
import log from 'loglevel'

const SceytChat = ({
  client,
  theme,
  themeMode,
  avatarColors,
  children,
  showOnlyContactUsers,
  logoSrc,
  CustomUploader,
  handleNewMessages,
  sendAttachmentsAsSeparateMessages = true,
  membersDisplayTextByChannelTypesMap,
  channelTypeFilter,
  defaultRolesByChannelTypesMap,
  hideUserPresence,
  showNotifications,
  openChatOnUserInteraction = true,
  autoSelectFirstChannel = false
}: IChatClientProps) => {
  const { [THEME_COLORS.BACKGROUND]: backgroundColor } = useColor()
  const dispatch = useDispatch()
  const contactsMap: IContactsMap = useSelector(contactsMapSelector)
  const draggingSelector = useSelector(isDraggingSelector, shallowEqual)
  const channelsListWidth = useSelector(channelListWidthSelector, shallowEqual)
  const getRolesFail = useSelector(getRolesFailSelector, shallowEqual)
  const [SceytChatClient, setSceytChatClient] = useState<any>(null)
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
  const handleFocusChange = (focus: boolean) => {
    if (focus) {
      setTabIsActive(true)
      dispatch(browserTabIsActiveAC(true))
    } else {
      setTabIsActive(false)
      dispatch(browserTabIsActiveAC(false))
    }
  }

  const generateBubbleColors = (themeColors: { [key: string]: ThemeColor }) => {
    colors.outgoingMessageBackgroundDark = moderateColor(themeColors[THEME_COLORS.ACCENT].dark || '', 0.85, true)
    colors.outgoingMessageBackgroundLight = moderateColor(themeColors[THEME_COLORS.ACCENT].light, 0.85)
    colors.outgoingMessageBackgroundXLight = moderateColor(themeColors[THEME_COLORS.ACCENT].light, 0.75)
    colors.outgoingMessageBackgroundXDark = moderateColor(themeColors[THEME_COLORS.ACCENT].dark || '', 0.75, true)
  }

  useEffect(() => {
    log.info('client is changed.... ', client)
    if (client) {
      setClient(client)
      setSceytChatClient(client)
      dispatch(setUserAC(client.user))
      /* if (userDisplayNameFromContacts) {
        dispatch(getContactsAC())
      } */

      dispatch(watchForEventsAC())
      dispatch(setConnectionStatusAC(client.connectionState))
      if (showOnlyContactUsers) {
        dispatch(getContactsAC())
      }
      dispatch(getRolesAC())
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

  const handleChangedTheme = (theme: SceytChatUIKitTheme) => {
    const updatedColors = { ...defaultTheme.colors }
    for (const key in theme.colors) {
      if (theme.colors.hasOwnProperty(key)) {
        updatedColors[key] = {
          ...defaultTheme.colors[key],
          ...theme.colors[key]
        } as any
      }
      if (key === THEME_COLORS.WARNING) {
        colors.errorBlur = moderateColor(updatedColors[key].light, 0.2)
      }
    }

    const updatedTheme = { ...defaultTheme, colors: updatedColors }

    generateBubbleColors(updatedColors)

    dispatch(setTheme(updatedTheme))
  }

  const handleChangedThemeMode = (themeMode: ThemeMode) => {
    if (themeMode) {
      dispatch(setThemeAC(themeMode))
    }
  }

  useEffect(() => {
    if (CustomUploader) {
      setCustomUploader(CustomUploader)
    }
    if (membersDisplayTextByChannelTypesMap) {
      setChannelTypesMemberDisplayTextMap(membersDisplayTextByChannelTypesMap)
    }
    if (defaultRolesByChannelTypesMap) {
      setDefaultRolesByChannelTypesMap(defaultRolesByChannelTypesMap)
    }
    if (handleNewMessages) {
      setHandleNewMessages(handleNewMessages)
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
    if (channelTypeFilter) {
      setChannelTypesFilter(channelTypeFilter)
    }
    if (showNotifications) {
      try {
        if (window.Notification && Notification.permission === 'default') {
          // Notification.requestPermission().then(log.log).catch(log.error)
          Promise.resolve(Notification.requestPermission()).then(function (permission) {
            log.info('permission:', permission)
          })
        }
      } catch (e) {
        log.error('safari Notification request permission', e)
      }
      window.sceytTabNotifications = null
      window.sceytTabUrl = window.location.href

      window.addEventListener('focus', () => handleFocusChange(true))
      window.addEventListener('blur', () => handleFocusChange(false))
    }

    document.addEventListener(visibilityChange, handleVisibilityChange, false)
    return () => {
      window.removeEventListener('focus', () => handleFocusChange(true))
      window.removeEventListener('blur', () => handleFocusChange(false))
      document.removeEventListener(visibilityChange, handleVisibilityChange)
      clearMessagesMap()
      removeAllMessages()
      setActiveChannelId('')
      destroyChannelsMap()
      dispatch(destroySession())
    }
  }, [])
  useEffect(() => {
    dispatch(setTabIsActiveAC(tabIsActive))
    if (tabIsActive && showNotifications) {
      if (window.sceytTabNotifications) {
        window.sceytTabNotifications.close()
      }
    }
  }, [tabIsActive])

  useEffect(() => {
    if (theme) {
      handleChangedTheme(theme)
    } else {
      generateBubbleColors(defaultTheme.colors)
      dispatch(setTheme(defaultTheme))
    }
  }, [theme])

  useEffect(() => {
    if (themeMode) {
      handleChangedThemeMode(themeMode)
    }
  }, [themeMode])

  useEffect(() => {
    setAutoSelectFitsChannel(autoSelectFirstChannel)
  }, [autoSelectFirstChannel])

  useEffect(() => {
    setOpenChatOnUserInteraction(openChatOnUserInteraction)
  }, [openChatOnUserInteraction])

  useDidUpdate(() => {
    if (getRolesFail) {
      log.info('getRolesFail ... ', getRolesFail)
    }
    if (getRolesFail && getRolesFail.attempts <= 5) {
      setTimeout(() => {
        dispatch(getRolesAC(getRolesFail.timeout, getRolesFail.attempts))
      }, getRolesFail.timeout)
    }
  }, [getRolesFail])
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
        <ChatContainer
          onDrop={handleDropFile}
          onDragOver={handleDragOver}
          withChannelsList={channelsListWidth && channelsListWidth > 0}
          backgroundColor={backgroundColor}
          id='sceyt_chat_container'
        >
          {children}
        </ChatContainer>
      ) : (
        ''
      )}
    </React.Fragment>
  )
}

export default SceytChat

export const Container = styled.div`
  display: flex;
  height: 100vh;
`

const ChatContainer = styled.div<{ withChannelsList: boolean; backgroundColor?: string }>`
  display: flex;
  height: 100%;
  max-height: 100vh;
  min-width: ${(props) => props.withChannelsList && '1200px'};
  background-color: ${(props) => props.backgroundColor || colors.white};
`
