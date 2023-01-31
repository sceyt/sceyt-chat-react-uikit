import React from 'react'
// @ts-ignore
import SceytChatClient from 'sceyt-chat'
import { Provider } from 'react-redux'
import store from '../../store'
import { ICustomAvatarColors } from '../Channel/types'
import SceytChat from '../SceytChat'
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
  upload: (file: File, uploadTask: IUploadTask) => void
  download: (uri: string, progressCallback?: (progress: any) => void) => Promise<string>
}

export interface IChatClientProps {
  client: SceytChatClient
  avatarColors?: ICustomAvatarColors
  userDisplayNameFromContacts?: boolean
  sendAttachmentsAsSeparateMessages?: boolean
  children?: JSX.Element | JSX.Element[]
  logoSrc?: string
  CustomUploader?: ICustomUploader
  customColors?: {
    primaryColor?: string
    textColor1?: string
    textColor2?: string
    textColor3?: string
    deletedUserAvatarBackground?: string
    defaultAvatarBackground?: string
  }
}

const SceytChatContainer = ({
  client,
  avatarColors,
  children,
  userDisplayNameFromContacts,
  sendAttachmentsAsSeparateMessages,
  logoSrc,
  CustomUploader,
  customColors
}: IChatClientProps) => {
  return (
    <Provider store={store}>
      <SceytChat
        client={client}
        avatarColors={avatarColors}
        children={children}
        userDisplayNameFromContacts={userDisplayNameFromContacts}
        logoSrc={logoSrc}
        CustomUploader={CustomUploader}
        sendAttachmentsAsSeparateMessages={sendAttachmentsAsSeparateMessages}
        customColors={customColors}
      />
    </Provider>
  )
}

export default SceytChatContainer
