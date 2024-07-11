import React from 'react'
import { Provider } from 'react-redux'
import store from '../../store'
import SceytChat from '../SceytChat'
import { IAttachment, IChannel, ICustomAvatarColors, IMessage, IUser } from '../../types'
export interface IProgress {
  loaded: number
  total: number
}

export interface IUploadTask {
  // eslint-disable-next-line no-unused-vars
  updateLocalFileLocation?: (newPath: String) => void
  // eslint-disable-next-line no-unused-vars
  progress: (progress: IProgress) => void
  // eslint-disable-next-line no-unused-vars
  failure: (error: Error) => void
  // eslint-disable-next-line no-unused-vars
  success: (uri: string) => void
  cancel: () => void
  stop: () => void
  resume: () => void
}

export interface ICustomUploader {
  // eslint-disable-next-line no-unused-vars
  upload: (attachment: IAttachment, uploadTask: IUploadTask) => void
  // eslint-disable-next-line no-unused-vars
  download: (uri: string, download: boolean, progressCallback?: (progress: any) => void) => Promise<any>
  // eslint-disable-next-line no-unused-vars
  cancelRequest: (requestPromise: any) => void
}

interface IThemeColor {
  light: string
  dark?: string
  [key: string]: string | undefined
}

export interface ISceytChatUIKitThemeType {
  colors: {
    accent: IThemeColor
    background: IThemeColor
  }
}

export interface IThemeMode {
  mode: 'light' | 'dark' | string
}

export interface IChatClientProps {
  client: any
  theme?: ISceytChatUIKitThemeType
  themeMode?: IThemeMode
  autoSelectFirstChannel?: boolean
  avatarColors?: ICustomAvatarColors
  // eslint-disable-next-line no-unused-vars
  hideUserPresence?: (user: IUser) => boolean
  // eslint-disable-next-line no-unused-vars
  handleNewMessages?: (message: IMessage, channel: IChannel) => IMessage | null
  showOnlyContactUsers?: boolean
  sendAttachmentsAsSeparateMessages?: boolean
  showNotifications?: boolean
  children?: JSX.Element | JSX.Element[]
  logoSrc?: string
  CustomUploader?: ICustomUploader
  channelTypeFilter?: string[]
  membersDisplayTextByChannelTypesMap?: {
    [key: string]: string
  }
  defaultRolesByChannelTypesMap?: {
    [key: string]: string
  }
  customColors?: {
    primaryColor?: string
    primaryLight?: string
    textColor1?: string
    textColor2?: string
    textColor3?: string
    deletedUserAvatarBackground?: string
    defaultAvatarBackground?: string
  }
  openChatOnUserInteraction?: boolean
}

const SceytChatContainer = ({
  client,
  theme,
  themeMode,
  avatarColors,
  children,
  showOnlyContactUsers,
  handleNewMessages,
  sendAttachmentsAsSeparateMessages,
  membersDisplayTextByChannelTypesMap,
  defaultRolesByChannelTypesMap,
  channelTypeFilter,
  logoSrc,
  CustomUploader,
  customColors,
  showNotifications = true,
  hideUserPresence,
  openChatOnUserInteraction,
  autoSelectFirstChannel
}: IChatClientProps) => {
  return (
    <Provider store={store}>
      <SceytChat
        client={client}
        theme={theme}
        themeMode={themeMode}
        avatarColors={avatarColors}
        children={children}
        showOnlyContactUsers={showOnlyContactUsers}
        logoSrc={logoSrc}
        CustomUploader={CustomUploader}
        handleNewMessages={handleNewMessages}
        sendAttachmentsAsSeparateMessages={sendAttachmentsAsSeparateMessages}
        membersDisplayTextByChannelTypesMap={membersDisplayTextByChannelTypesMap}
        defaultRolesByChannelTypesMap={defaultRolesByChannelTypesMap}
        customColors={customColors}
        showNotifications={showNotifications}
        hideUserPresence={hideUserPresence}
        openChatOnUserInteraction={openChatOnUserInteraction}
        autoSelectFirstChannel={autoSelectFirstChannel}
        channelTypeFilter={channelTypeFilter}
      />
    </Provider>
  )
}

export default SceytChatContainer
