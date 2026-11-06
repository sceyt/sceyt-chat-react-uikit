/** Parameters recipients need to decrypt one file. Contains the file key: do not log it. */
export interface FileEncryptionInfo {
  algorithm: string
  attachmentId: string
  key: string
  /**
   * What else an app's encryption method needs to decrypt the file (e.g. an IV or a key
   * version), as strings. Stored in the attachment's `enc` as it is; the chat SDK's has none.
   */
  params?: Record<string, string>
  /** The stored header's salt and nonce prefix (base64url), when the encryption gives them: not secret. */
  salt?: string
  noncePrefix?: string
}

/** Private recovery state for one encryption session. Contains key material: do not log it. */
export interface FileEncryptionCheckpoint {
  encryptionInfo: FileEncryptionInfo
  plaintextSize: number
  data: string
}

/** One encrypted file, generated on demand without a complete ciphertext copy. */
export interface FileEncryptionSession {
  readonly sourceId: string
  readonly plaintextSize: number
  readonly ciphertextSize: number
  readonly encryptionInfo: FileEncryptionInfo
  /** The stored header's salt and nonce prefix (base64url), when the encryption gives them: not secret. */
  readonly salt?: string
  readonly noncePrefix?: string
  /** The exact ciphertext range, including overhead. Repeated reads return identical bytes. */
  // eslint-disable-next-line no-unused-vars
  read: (offset: number, length: number) => Promise<Uint8Array>
  /** Save after reads and before submitting bytes. */
  checkpoint: () => FileEncryptionCheckpoint
  /** Releases resources without aborting an upload or deleting its saved state. */
  close: () => void
}

/** Verified plaintext from a completed encrypted file. */
export interface FileDecryptionSession {
  readonly sourceId: string
  readonly plaintextSize: number
  /** Exactly `length` authenticated plaintext bytes, or rejects. */
  // eslint-disable-next-line no-unused-vars
  read: (offset: number, length: number) => Promise<Uint8Array>
  close: () => void
}

/** Cryptography used by transports; implementations own neither networking nor persistence. */
export interface FileEncryption {
  /**
   * Encrypts `file` with a new key. `attachmentId` is the id the file is bound to when a
   * server issued one (16 bytes, base64url); without it the encryption makes one.
   */
  // eslint-disable-next-line no-unused-vars
  prepareEncryption: (file: Blob, attachmentId?: string) => Promise<FileEncryptionSession>
  /** The encrypted size of a `plaintextSize`-byte file, before it is encrypted (e.g. to plan upload parts). */
  // eslint-disable-next-line no-unused-vars
  ciphertextSize?: (plaintextSize: number) => number
  /** Restores the same key and encrypted bytes from a privately stored checkpoint. */
  // eslint-disable-next-line no-unused-vars
  restoreEncryption: (file: Blob, checkpoint: FileEncryptionCheckpoint) => Promise<FileEncryptionSession>
  /**
   * Prepares verified plaintext reading from a completed encrypted file. Performs no networking.
   * `plaintextSize` is the attachment's trusted size; it is undefined for a file whose message
   * carries none (a video's preview), which is then sized from the encrypted file.
   */
  prepareDecryption: (
    // eslint-disable-next-line no-unused-vars
    encryptedFile: Blob,
    // eslint-disable-next-line no-unused-vars
    encryptionInfo: FileEncryptionInfo,
    // eslint-disable-next-line no-unused-vars
    plaintextSize: number | undefined
  ) => Promise<FileDecryptionSession>
}
