import React from 'react'
// @ts-ignore
import SceytChatClient from 'sceyt-chat'
import { Provider } from 'react-redux'
import store from '../../store'
import { ICustomAvatarColors } from '../Channel/types'
import SceytChat from '../SceytChat'
import { IAttachment } from '../../types'
export interface IProgress {
  loaded: number
  total: number
}

export interface IUploadTask {
  updateLocalFileLocation: (newPath: String) => void
  progress: (progress: IProgress) => void
  failure: (error: Error) => void
  success: (uri: string) => void
  cancel: () => void
  stop: () => void
  resume: () => void
}

export interface ICustomUploader {
  upload: (attachment: IAttachment, uploadTask: IUploadTask) => void
  download: (attachment: IAttachment, progressCallback?: (progress: any) => void) => Promise<string>
}

export interface IChatClientProps {
  client: SceytChatClient
  avatarColors?: ICustomAvatarColors
  showContactInfoOnUserList?: boolean
  sendAttachmentsAsSeparateMessages?: boolean
  children?: JSX.Element | JSX.Element[]
  logoSrc?: string
  CustomUploader?: ICustomUploader
}

const SceytChatContainer = ({
  client,
  avatarColors,
  children,
  showContactInfoOnUserList,
  sendAttachmentsAsSeparateMessages,
  logoSrc,
  CustomUploader
}: IChatClientProps) => {
  return (
    <Provider store={store}>
      <SceytChat
        client={client}
        avatarColors={avatarColors}
        children={children}
        showContactInfoOnUserList={showContactInfoOnUserList}
        logoSrc={logoSrc}
        CustomUploader={CustomUploader}
        sendAttachmentsAsSeparateMessages={sendAttachmentsAsSeparateMessages}
      />
    </Provider>
  )
}

export default SceytChatContainer
