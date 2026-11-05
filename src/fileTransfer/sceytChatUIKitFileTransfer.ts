import { ChatSdkFileEncryption } from './encryption/chatSdkFileEncryption'
import { FileEncryption } from './encryption/types'
import { FileTransferTransport } from './types'
import { DefaultFileTransferTransport } from './defaults/defaultFileTransferTransport'

/** The `fileTransfer` prop of SceytChat: every field is optional and falls back to its default. */
export interface IFileTransfer {
  /** Encrypt new uploads (default false). Encrypted downloads follow the attachment metadata. */
  encryptUploads?: boolean
  /** Encrypts and decrypts files; default: the chat client's (`ChatSdkFileEncryption`). */
  encryption?: FileEncryption
  /** Uploads and downloads files; default: the chat client's (`DefaultFileTransferTransport`). */
  transport?: FileTransferTransport
}

/**
 * How attachment files are transferred: the web counterpart of the Android UIKit's
 * `SceytChatUIKit.fileTransfer`. Set it with the `fileTransfer` prop of SceytChat; a custom
 * transport reads `encryption` from it to encrypt uploads and decrypt downloads.
 * Do not replace the transport while transfers are running.
 */
export class SceytChatUIKitFileTransfer {
  /** Opts in to encrypting new uploads. Encrypted downloads follow the attachment metadata. */
  encryptUploads = false
  /** The encryption module transports encrypt and decrypt with. */
  encryption: FileEncryption = new ChatSdkFileEncryption()
  private configuredTransport?: FileTransferTransport

  /** Uploads and downloads files; default: the chat client (`DefaultFileTransferTransport`). */
  get transport(): FileTransferTransport {
    if (!this.configuredTransport) this.configuredTransport = new DefaultFileTransferTransport()
    return this.configuredTransport
  }

  set transport(transport: FileTransferTransport) {
    this.configuredTransport = transport
  }

  /** Whether the app set a transport of its own. */
  get hasCustomTransport(): boolean {
    return !!this.configuredTransport && !(this.configuredTransport instanceof DefaultFileTransferTransport)
  }

  /** Applies `settings`; a field left out goes back to its default. */
  configure(settings: IFileTransfer = {}) {
    this.encryptUploads = !!settings.encryptUploads
    this.encryption = settings.encryption || new ChatSdkFileEncryption()
    this.configuredTransport = settings.transport
  }
}

/** The file transfer the UIKit uses. */
export const fileTransfer = new SceytChatUIKitFileTransfer()
