import React, { useEffect } from 'react'
import { Provider } from 'react-redux'
import log from 'loglevel'
import store from '../../store'
import SceytChat from '../SceytChat'
import { IAttachment, IChannel, IContact, ICustomAvatarColors, IMember, IMessage, IUser } from '../../types'
import { SceytReduxContext } from 'store/context'
import { IAttachmentEncryption, IFileEncryption } from '../../helpers/attachmentEncryption'

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
   * plaintext, never the encrypted bytes. `encryption` is the `encryptionInfo`
   * of the file the uploader encrypted and stored (`options.fileEncryption`):
   * required when the upload was asked to `encrypt`, or the message is not sent.
   * An `encryption` that `options.fileEncryption` did not make for this upload
   * (made up, or of a file sent before) is refused too.
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
   * `encryptAttachments` is on: store the file encrypted. Encrypt the file as it
   * will be stored (e.g. after resizing an image) with
   * `fileEncryption.prepareEncryption(file)`, send its `readAll()` or the byte
   * ranges of its parts (`read(offset, length)`, planned from `ciphertextSize`)
   * with its `contentType`, and pass its `encryptionInfo` to `success()`.
   */
  encrypt: boolean
  /** Encrypts files to upload (when `encrypt`) and opens downloaded ones, with the chat client. */
  fileEncryption: IFileEncryption
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
   * downloaded bytes with `fileEncryption.prepareDecryption(bytes, encryption, type)`
   * and return its `readAll()` (decrypted and verified, with its real type).
   */
  encryption?: IAttachmentEncryption
  /** The file's real type, or '' when unknown. */
  type: string
  /** Opens encrypted files, with the chat client. */
  fileEncryption: IFileEncryption
}

export interface ICustomUploader {
  /**
   * True: the uploader encrypts and opens files itself, with the
   * `fileEncryption` its options give: `upload` stores the file encrypted when
   * its options say `encrypt` and reports the file's `encryption`, and
   * `download` gets `{ encryption, type }` and returns the opened file.
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

/**
 * How attachment files are uploaded, downloaded and encrypted (the
 * `fileTransfer` prop). Every field is optional and falls back to its default.
 */
export interface IFileTransfer {
  /** Encrypt new uploads (default false). Encrypted downloads follow the attachment metadata. */
  encryptUploads?: boolean
  /** Encrypts and decrypts files; default: the chat client's (sceyt-chat). */
  encryption?: IFileEncryption
  /**
   * Uploads and downloads files; default: the chat client's, one request per
   * file to the chat server (`defaultFileTransferTransport`).
   */
  transport?: ICustomUploader
}

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
  /** File transfer settings; they take the place of `CustomUploader` and `encryptAttachments` when set. */
  fileTransfer?: IFileTransfer
  /**
   * @deprecated Use `fileTransfer={{ transport }}`; this prop goes in the next major version.
   * The app's transport; `fileTransfer.transport` takes its place when set.
   */
  CustomUploader?: ICustomUploader
  /**
   * @deprecated Use `fileTransfer={{ encryptUploads }}`; this prop goes in the next major version.
   * Encrypt attachment files before upload (the attachment id and key are kept in
   * each attachment's metadata); `fileTransfer.encryptUploads` takes its place when set.
   * Works with the default transport, or with a transport that sets `preparesFiles`
   * (it encrypts with the `fileEncryption` it is given); needs a sceyt-chat version
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
  fileTransfer,
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
        fileTransfer={fileTransfer}
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
