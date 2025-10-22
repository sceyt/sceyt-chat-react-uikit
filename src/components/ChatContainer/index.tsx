import React, { useEffect } from 'react'
import { Provider } from 'react-redux'
import log from 'loglevel'
import store from '../../store'
import SceytChat from '../SceytChat'
import { IAttachment, IChannel, ICustomAvatarColors, IMessage, IUser, IMember } from '../../types'
import { SceytReduxContext } from 'store/context'
import JoinGroupPopup from 'components/JoinGroupPopup'

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
  upload: (attachment: IAttachment, uploadTask: IUploadTask, messageType: string | null | undefined) => void
  // eslint-disable-next-line no-unused-vars
  download: (
    uri: string,
    download: boolean,
    progressCallback: (progress: any) => void,
    messageType: string | null | undefined
  ) => Promise<any>
  // eslint-disable-next-line no-unused-vars
  cancelRequest: (requestPromise: any) => void
}

export type ThemeColors =
  | 'accent'
  | 'avatarBrand1'
  | 'avatarBrand2'
  | 'avatarBrand3'
  | 'avatarBrand4'
  | 'textPrimary'
  | 'textSecondary'
  | 'textFootnote'
  | 'textOnPrimary'
  | 'border'
  | 'iconInactive'
  | 'iconPrimary'
  | 'background'
  | 'backgroundSections'
  | 'backgroundFocused'
  | 'backgroundHovered'
  | 'overlayBackground'
  | 'overlayBackground2'
  | 'surface1'
  | 'surface2'
  | 'surfaceX'
  | 'warning'
  | 'attention'
  | 'onlineStatus'
  | 'success'
  | 'outgoingMessageBackground'
  | 'outgoingMessageBackgroundX'
  | 'incomingMessageBackground'
  | 'incomingMessageBackgroundX'
  | 'linkColor'
  | 'highlightedBackground'

export interface ThemeColor {
  light: string
  dark?: string
  [key: string]: string | undefined
}

export interface SceytChatUIKitTheme {
  colors: Partial<Record<ThemeColors, ThemeColor>>
}

export type ThemeMode = 'light' | 'dark' | string

export interface IChatClientProps {
  client: any
  theme?: SceytChatUIKitTheme
  themeMode?: ThemeMode
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
  openChatOnUserInteraction?: boolean
  logLevel?: 'silent' | 'trace' | 'debug' | 'info' | 'warn' | 'error'
  memberCount?: number
  disableFrowardMentionsCount?: boolean
  chatMinWidth?: string
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
  showNotifications = true,
  hideUserPresence,
  openChatOnUserInteraction,
  autoSelectFirstChannel,
  logLevel = 'silent',
  memberCount,
  disableFrowardMentionsCount,
  chatMinWidth
}: IChatClientProps) => {
  useEffect(() => {
    log.setLevel(logLevel)
  }, [])

  return (
    <Provider store={store} context={SceytReduxContext}>
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
        showNotifications={showNotifications}
        hideUserPresence={hideUserPresence}
        openChatOnUserInteraction={openChatOnUserInteraction}
        autoSelectFirstChannel={autoSelectFirstChannel}
        channelTypeFilter={channelTypeFilter}
        memberCount={memberCount}
        disableFrowardMentionsCount={disableFrowardMentionsCount}
        chatMinWidth={chatMinWidth}
      />
      <JoinGroupPopup
        onClose={() => {}}
        onJoin={() => {}}
        channelName={'channel'}
        members={
          [
            {
              id: '37494163175',
              firstName: 'KarenTestTwo',
              lastName: 'Ch',
              avatarUrl: '',
              metadata: {
                ge: '0',
                last_name: 'Ch',
                bulsho_user_data: '{"bd":270199998000,"pr":true}',
                first_name: 'KarenTestTwo'
              },
              username: '',
              state: 'active',
              presence: {
                state: 'online',
                status: 'Hey there! I am using WAAFI',
                lastActiveAt: '2025-10-21T13:19:24.551Z'
              },
              blocked: false,
              role: 'owner'
            },
            {
              id: '37494163174',
              firstName: 'KarenKarenKaren',
              lastName: 'Ch',
              avatarUrl: '',
              metadata: {
                bulsho_user_data: '{"bd":905341188000,"pr":true}',
                first_name: 'KarenKarenKaren',
                ge: '0',
                last_name: 'Ch'
              },
              username: '',
              state: 'active',
              presence: {
                state: 'online',
                status: 'Hey there! I am using WAAFI',
                lastActiveAt: '2025-10-21T13:09:10.919Z'
              },
              blocked: false,
              role: 'participant'
            },
            {
              id: '37494163173',
              firstName: 'Karen',
              lastName: 'Chilingaryan Chilingaryan',
              avatarUrl:
                // eslint-disable-next-line max-len
                'https://uk-london-south-api-2-staging.waafi.com/user/api/v1/files/vd8l6eom9y/3e853b11c6d18bfa35a945e7c6eaff0197ccfc8aa79dc62ef94ec5e72acb053d2115159d9b46c39cc879e622be84/Icon.png',
              metadata: {
                first_name: 'KarenKarenkaren',
                ge: '0',
                last_name: 'Chilingaryan Chilingaryan',
                bulsho_user_data: '{"bd":648310451000,"pr":true}'
              },
              username: '',
              state: 'active',
              presence: {
                state: 'offline',
                status: 'Hey there! I am using WAAFI',
                lastActiveAt: '2025-10-20T12:27:55.881Z'
              },
              blocked: false,
              role: 'participant'
            }
          ] as unknown as IMember[]
        }
      />
    </Provider>
  )
}

export default SceytChatContainer
