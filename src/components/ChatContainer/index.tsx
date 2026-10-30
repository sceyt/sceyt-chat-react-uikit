import React, { useEffect } from 'react'
import { Provider } from 'react-redux'
import log from 'loglevel'
import store from '../../store'
import SceytChat from '../SceytChat'
import { IAttachment, IChannel, IContact, ICustomAvatarColors, IMember, IMessage, IUser } from '../../types'
import { SceytReduxContext } from 'store/context'
import { IAttachmentDownloadFile, IAttachmentUploadFile } from '../../helpers/attachmentEncryption'

import {
  InviteLinkOptions,
  setBaseUrlForInviteMembers,
  setInviteLinkOptions,
  setUseInviteLink,
  setDisappearingSettings,
  setCustomLoadMembersFunctions,
  setShowOwnMessageForward
} from '../../helpers/channelHalper'
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
  /**
   * `blob` is the uploaded file as the user's device shows it (e.g. after the
   * uploader resized an image). With `encryptAttachments` it must be the
   * plaintext, never the encrypted bytes.
   */
  // eslint-disable-next-line no-unused-vars
  success: ({ uri, blob }: { uri: string; blob: Blob }) => void
  cancel: () => void
  stop: () => void
  resume: () => void
}

/** The 4th `upload()` argument of a custom uploader that sets `supportsEncryption`. */
export interface ICustomUploaderUploadFiles {
  /**
   * Prepares the file to store; call it with the file as it will be stored
   * (e.g. after resizing an image) and send what it returns: `getPart(n)` as
   * multipart parts, or `getAll()`, with its `contentType`. It is encrypted
   * when `encryptAttachments` is on. The message describes the last file
   * prepared, so prepare once per upload.
   *
   * `url` is the URL the file will be stored at, exactly as `success({ uri })`
   * will give it: pick it before preparing the file. An encrypted file is
   * bound to it and opens only for it, so the upload fails when `success`
   * gives another one.
   */
  // eslint-disable-next-line no-unused-vars
  prepareFile: (file: Blob, options: { url: string }) => Promise<IAttachmentUploadFile>
}

/** The 6th `download()` argument of a custom uploader that sets `supportsEncryption`. */
export interface ICustomUploaderDownloadFile {
  /**
   * The attachment's stored file: pass the downloaded bytes to `file.open()`
   * and return its result, which is the file to show (decrypted when it is
   * encrypted, with its real type).
   */
  file: IAttachmentDownloadFile
}

export interface ICustomUploader {
  /**
   * True: `upload` gets `{ prepareFile }` and sends the file it prepares, and
   * `download` gets `{ file }` and returns `file.open(downloadedBytes)`. The
   * SDK does any encryption, so the uploader's code is the same whether
   * `encryptAttachments` is on or not (with a sceyt-chat version that has
   * client.prepareUpload; with an older one these arguments are not passed).
   *
   * `encryptAttachments` needs it: an encrypted file is bound to its URL, so
   * the uploader picks the URL before the file is prepared. Without it, an
   * upload with `encryptAttachments` on fails before anything is sent.
   */
  supportsEncryption?: boolean
  upload: (
    // eslint-disable-next-line no-unused-vars
    attachment: IAttachment,
    // eslint-disable-next-line no-unused-vars
    uploadTask: IUploadTask,
    // eslint-disable-next-line no-unused-vars
    messageType: string | null | undefined,
    // eslint-disable-next-line no-unused-vars
    files?: ICustomUploaderUploadFiles
  ) => void
  /**
   * `messageId` is the ID of a message the attachment appears in, supplied by
   * the client. Treat it as a hint, not proof of access:
   * - Media previews (images, videos, voice, video thumbnails) are shared and
   *   cached by `uri`. When several messages use the same file (e.g. forwards),
   *   only the first request's ID is sent, and its failure is shared too.
   * - A file already in the browser's attachment cache is served without
   *   calling `download`; that cache is per origin, not per user.
   * - It may be empty (`''`) or missing for messages that are not confirmed yet.
   * The backend must verify that the caller can read the message and that
   * `uri` legitimately belongs to it (e.g. traced to its original upload),
   * before serving the file.
   */
  // eslint-disable-next-line no-unused-vars
  download: (
    uri: string,
    download: boolean,
    progressCallback: (progress: any) => void,
    messageType: string | null | undefined,
    messageId?: string | null,
    stored?: ICustomUploaderDownloadFile
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
  /**
   * Encrypt attachment files before upload and decrypt them after download
   * (the key is kept in each attachment's metadata). Needs a CustomUploader
   * with `supportsEncryption` and a sceyt-chat version with client.prepareUpload.
   */
  encryptAttachments?: boolean
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
  baseUrlForInviteMembers?: string
  useInviteLink?: boolean
  inviteLinkOptions?: InviteLinkOptions | null
  embeddedJoinGroupPopup?: boolean
  onUpdateChannel?: (channel: IChannel, updatedFields: string[]) => void
  disappearingSettings?: {
    show?: boolean
    customOptions?: {
      label: string
      seconds: number
    }[]
  } | null
  customLoadMembersFunctions?: {
    loadMoreMembers?: (channel: IChannel, limit?: number) => Promise<{ hasNext: boolean; members: IMember[] }>
    getMembers?: (channel: IChannel) => Promise<{ members: IMember[]; hasNext: boolean }>
    addMembersEvent?: (channelId: string, addedMembers: IMember[], members: IMember[]) => IMember[]
    joinMembersEvent?: (channelId: string, joinedMembers: IMember[], members: IMember[]) => IMember[]
    updateMembersEvent?: (channelId: string, updatedMembers: IMember[], members: IMember[]) => IMember[]
  } | null
  showOwnMessageForward?: boolean
  contacts?: IContact[] | null
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
  encryptAttachments,
  showNotifications = true,
  hideUserPresence,
  openChatOnUserInteraction,
  autoSelectFirstChannel,
  logLevel = 'silent',
  memberCount,
  disableFrowardMentionsCount,
  chatMinWidth,
  baseUrlForInviteMembers,
  useInviteLink = false,
  inviteLinkOptions = {
    ListItemInviteLink: {},
    JoinGroupPopup: {},
    InviteLinkModal: {},
    ResetLinkConfirmModal: {}
  },
  embeddedJoinGroupPopup = false,
  onUpdateChannel,
  disappearingSettings = null,
  customLoadMembersFunctions = null,
  showOwnMessageForward = true,
  contacts = null
}: IChatClientProps) => {
  useEffect(() => {
    log.setLevel(logLevel)
  }, [logLevel])

  useEffect(() => {
    if (baseUrlForInviteMembers) {
      setBaseUrlForInviteMembers(baseUrlForInviteMembers)
    }
  }, [baseUrlForInviteMembers])

  useEffect(() => {
    if (useInviteLink) {
      setUseInviteLink(useInviteLink)
    }
  }, [useInviteLink])

  useEffect(() => {
    if (inviteLinkOptions) {
      setInviteLinkOptions(inviteLinkOptions)
    }
  }, [inviteLinkOptions])

  useEffect(() => {
    if (disappearingSettings) {
      setDisappearingSettings(disappearingSettings)
    }
  }, [disappearingSettings])

  useEffect(() => {
    if (customLoadMembersFunctions) {
      setCustomLoadMembersFunctions(customLoadMembersFunctions)
    }
  }, [customLoadMembersFunctions])

  useEffect(() => {
    setShowOwnMessageForward(showOwnMessageForward)
  }, [showOwnMessageForward])

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
        encryptAttachments={encryptAttachments}
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
        embeddedJoinGroupPopup={embeddedJoinGroupPopup}
        onUpdateChannel={onUpdateChannel}
        contacts={contacts}
      />
    </Provider>
  )
}

export default SceytChatContainer
