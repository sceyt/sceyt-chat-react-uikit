import { ChatSdkFileEncryption } from './encryption/chatSdkFileEncryption'
import { FileEncryption } from './encryption/types'
import { FileTransferProvider } from '../types/fileTransfer/types'
import { DefaultFileTransferProvider } from './defaults/defaultFileTransferProvider'

/** The `fileTransfer` prop of SceytChat: every field is optional and falls back to its default. */
export interface IFileTransfer {
  /** Encrypt new uploads (default false). Encrypted downloads follow the attachment metadata. */
  encryptUploads?: boolean
  /** Encrypts and decrypts files; default: the chat client's (`ChatSdkFileEncryption`). */
  encryption?: FileEncryption
  /** Uploads and downloads files; default: the chat client's (`DefaultFileTransferProvider`). */
  provider?: FileTransferProvider
}

/**
 * How attachment files are transferred: the web counterpart of the Android UIKit's
 * `SceytChatUIKit.fileTransfer`. Set it with the `fileTransfer` prop of SceytChat; a custom
 * provider reads `encryption` from it to encrypt uploads and decrypt downloads.
 * Do not replace the provider while transfers are running.
 */
export class SceytChatUIKitFileTransfer {
  /** Opts in to encrypting new uploads. Encrypted downloads follow the attachment metadata. */
  encryptUploads = false
  /** The encryption module providers encrypt and decrypt with. */
  encryption: FileEncryption = new ChatSdkFileEncryption()
  private configuredProvider?: FileTransferProvider

  /** Uploads and downloads files; default: the chat client (`DefaultFileTransferProvider`). */
  get provider(): FileTransferProvider {
    if (!this.configuredProvider) this.configuredProvider = new DefaultFileTransferProvider()
    return this.configuredProvider
  }

  set provider(provider: FileTransferProvider) {
    this.configuredProvider = provider
  }

  /** Whether the app set a provider of its own. */
  get hasCustomProvider(): boolean {
    return !!this.configuredProvider && !(this.configuredProvider instanceof DefaultFileTransferProvider)
  }

  /** Applies `settings`; a field left out goes back to its default. */
  configure(settings: IFileTransfer = {}) {
    this.encryptUploads = !!settings.encryptUploads
    this.encryption = settings.encryption || new ChatSdkFileEncryption()
    this.configuredProvider = settings.provider
  }
}

/** The file transfer the UIKit uses. */
export const fileTransfer = new SceytChatUIKitFileTransfer()
