import React from 'react'
// @ts-ignore
import SceytChatClient from 'sceyt-chat'
import { Provider } from 'react-redux'
import store from '../../store'
import { ICustomAvatarColors } from '../Channel/types'
import SceytChat from '../SceytChat'
import { IAttachment, IChannel, IMessage, IUser } from '../../types'
export interface IProgress {
  loaded: number
  total: number
}

export interface IUploadTask {
  updateLocalFileLocation?: (newPath: String) => void
  progress: (progress: IProgress) => void
  failure: (error: Error) => void
  success: (uri: string) => void
  cancel: () => void
  stop: () => void
  resume: () => void
}

export interface ICustomUploader {
  upload: (attachment: IAttachment, uploadTask: IUploadTask) => void
  download: (uri: string, progressCallback?: (progress: any) => void) => Promise<string>
}

export interface IChatClientProps {
  client: SceytChatClient
  theme?: 'dark' | 'light'
  avatarColors?: ICustomAvatarColors
  hideUserPresence?: (user: IUser) => boolean
  handleNewMessages?: (message: IMessage, channel: IChannel) => IMessage | null
  showOnlyContactUsers?: boolean
  sendAttachmentsAsSeparateMessages?: boolean
  showNotifications?: boolean
  children?: JSX.Element | JSX.Element[]
  logoSrc?: string
  CustomUploader?: ICustomUploader
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
}

const SceytChatContainer = ({
  client,
  theme,
  avatarColors,
  children,
  showOnlyContactUsers,
  handleNewMessages,
  sendAttachmentsAsSeparateMessages,
  membersDisplayTextByChannelTypesMap,
  defaultRolesByChannelTypesMap,
  logoSrc,
  CustomUploader,
  customColors,
  showNotifications = true,
  hideUserPresence
}: IChatClientProps) => {
  return (
    <Provider store={store}>
      <SceytChat
        client={client}
        theme={theme}
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
      />
    </Provider>
  )
}

export default SceytChatContainer
