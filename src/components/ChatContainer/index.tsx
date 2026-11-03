import React, { useEffect } from 'react'
import { Provider } from 'react-redux'
import log from 'loglevel'
import store from '../../store'
import SceytChat from '../SceytChat'
import { IAttachment, IChannel, IContact, ICustomAvatarColors, IMember, IMessage, IUser } from '../../types'
import { SceytReduxContext } from 'store/context'
import { IAttachmentEncryption } from '../../helpers/attachmentEncryption'

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
  updateLocalFileLocation?: (newPath: string) => void
  // eslint-disable-next-line no-unused-vars
  progress: (progress: IProgress) => void
  // eslint-disable-next-line no-unused-vars
  failure: (error: Error) => void
  /**
   * `blob` is the uploaded file as the user's device shows it (e.g. after the
   * uploader resized an image), or null when the uploader gave it with
   * `updateLocalFileLocation`. With `encryptAttachments` it must be the
   * plaintext, never the encrypted bytes. `encryption` is the `encryption` of
   * the file the uploader prepared and stored (client.prepareUpload): required
   * when the upload was asked to `encrypt`, or the message is not sent.
   */
  // eslint-disable-next-line no-unused-vars
  success: ({ uri, blob, encryption }: { uri: string; blob: Blob | null; encryption?: IAttachmentEncryption }) => void
  cancel: () => void
  stop: () => void
  resume: () => void
}

/** The 4th `upload()` argument. */
export interface ICustomUploaderUploadOptions {
  /**
   * `encryptAttachments` is on: store the file encrypted. Prepare the file as it
   * will be stored (e.g. after resizing an image) with the chat client's
   * `prepareUpload(file, { encrypt: true })`, send its `getAll()` or the byte
   * ranges the upload server gives (`getRange`, or `getPart(n)` for 5 MiB parts)
   * with its `contentType`, and pass its `encryption` to `success()`.
   */
  encrypt: boolean
}

/** The 6th `download()` argument: which file of the attachment to download, and how to open it. */
export interface ICustomUploaderDownloadOptions {
  /** `file`: the attachment's own file; `thumbnail`: the preview image of a video attachment. */
  kind: 'file' | 'thumbnail'
  /** The URL to download: the attachment's `url`, or for a thumbnail its `video_thumb`. */
  url: string
  /**
   * For an uploader with `preparesFiles`, when the file is encrypted: its `enc`
   * (a thumbnail's own key, from the attachment's `enc.renditions`). Open the
   * downloaded bytes with the chat client's
   * `prepareDownload({ metadata: { enc: encryption }, type })` and return the
   * file it gives (decrypted, with its real type).
   */
  encryption?: IAttachmentEncryption
  /** The file's real type, or '' when unknown. */
  type: string
}

export interface ICustomUploader {
  /**
   * True: the uploader prepares and opens files with the chat client
   * (`prepareUpload` / `prepareDownload`, which do any encryption): `upload`
   * stores the file encrypted when its options say `encrypt` and reports the
   * file's `encryption`, and `download` gets `{ encryption, type }` and returns
   * the opened file.
   *
   * `encryptAttachments` needs it when there is a CustomUploader. Without it,
   * an upload with `encryptAttachments` on fails before anything is sent, and
   * `download` returns the stored bytes, which the UIKit opens.
   */
  preparesFiles?: boolean
  upload: (
    // eslint-disable-next-line no-unused-vars
    attachment: IAttachment,
    // eslint-disable-next-line no-unused-vars
    uploadTask: IUploadTask,
    // eslint-disable-next-line no-unused-vars
    messageType: string | null | undefined,
    // eslint-disable-next-line no-unused-vars
    options: ICustomUploaderUploadOptions
  ) => void
  /**
   * Downloads a file of `attachment`: the one `options` names (`options.url`).
   * `attachment.messageId` is the ID of a message the attachment appears in,
   * supplied by the client. Treat it as a hint, not proof of access:
   * - Media previews (images, videos, voice, video thumbnails) are shared and
   *   cached by URL. When several messages use the same file (e.g. forwards),
   *   only the first request's ID is sent, and its failure is shared too.
   * - A file already in the browser's attachment cache is served without
   *   calling `download`; that cache is per origin, not per user.
   * - It may be empty (`''`) or missing for messages that are not confirmed yet.
   * The backend must verify that the caller can read the message and that
   * `options.url` legitimately belongs to it (e.g. traced to its original upload),
   * before serving the file.
   */
  // eslint-disable-next-line no-unused-vars
  download: (
    attachment: IAttachment,
    download: boolean,
    progressCallback: (progress: any) => void,
    messageType: string | null | undefined,
    options: ICustomUploaderDownloadOptions
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
   * (the attachment id and key are kept in each attachment's metadata). Works with
   * the SDK's own upload, which sends the whole encrypted file, or with a
   * CustomUploader that sets `preparesFiles`; needs a sceyt-chat version
   * with client.prepareUpload.
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
