import { setClient } from '../../common/client'
import { ChatSdkEncryptionSession, ChatSdkFileEncryption } from './chatSdkFileEncryption'

const id = new Uint8Array(16).fill(7)
const header = new Uint8Array(72).fill(8)
const installSdk = (plainSize = 5) => {
  const readers: any[] = []
  const uploads: any[] = []
  const view = jest.fn(async (source: any) => {
    const reader = {
      source,
      size: plainSize,
      read: jest.fn(async (_o: number, n: number) => new Uint8Array(n)),
      close: jest.fn()
    }
    readers.push(reader)
    return reader
  })
  const cipher = { attachmentKey: 'opaque-sdk-key', header, newDecryptingRandomAccessStream: view }
  const makeUpload = (file: Blob) => {
    const upload = {
      cipher,
      plaintextSize: file.size,
      ciphertextSize: file.size + 88,
      sourceId: 'header-hash',
      checkpoint: jest.fn(() => ({ cipher, data: '{"v":1}' })),
      readCiphertextRange: jest.fn(async (_o: number, n: number) => new Uint8Array(n)),
      close: jest.fn()
    }
    uploads.push(upload)
    return upload
  }
  const sdk = {
    newAttachmentId: jest.fn(() => id),
    prepareUpload: jest.fn(async (file: Blob, _id: Uint8Array) => makeUpload(file)),
    restoreUpload: jest.fn(async (file: Blob, _checkpoint: any) => makeUpload(file))
  }
  const attachmentCipher = {
    restore: jest.fn(async (key: string, _header: Uint8Array) => {
      if (key !== cipher.attachmentKey) throw Object.assign(new Error('invalid key'), { type: 'InvalidEncryption' })
      return cipher
    })
  }
  setClient({ FileEncryption: sdk, AttachmentCipher: attachmentCipher })
  return { sdk, attachmentCipher, cipher, view, uploads, readers }
}

describe('ChatSdkFileEncryption native cipher adapter', () => {
  const file = new File(['hello'], 'clip.mp4')
  afterEach(() => setClient({}))

  it('passes a server-issued raw ID without encoding or replacing it', async () => {
    const { sdk } = installSdk()
    const session = await new ChatSdkFileEncryption().prepareEncryption(file, id)
    expect(sdk.prepareUpload).toHaveBeenCalledWith(file, id)
    expect(sdk.newAttachmentId).not.toHaveBeenCalled()
    expect(session.encryptionInfo).toEqual({ encodedKeys: 'opaque-sdk-key' })
  })
  it('uses the SDK raw ID generator when the host has no ID', async () => {
    const { sdk, uploads } = installSdk()
    const session = await new ChatSdkFileEncryption().prepareEncryption(file)
    expect(sdk.newAttachmentId).toHaveBeenCalledTimes(1)
    expect(sdk.prepareUpload).toHaveBeenCalledWith(file, id)
    expect(session).toBeInstanceOf(ChatSdkEncryptionSession)
    expect((session as ChatSdkEncryptionSession).upload).toBe(uploads[0])
    expect(session.sourceId).toBe('header-hash')
    expect(session.plaintextSize).toBe(5)
    expect(session.ciphertextSize).toBe(93)
    expect(await session.read(0, 2)).toHaveLength(2)
  })
  it('saves the key and header privately and restores the SDK cipher before its upload', async () => {
    const { sdk, attachmentCipher, cipher } = installSdk()
    const encryption = new ChatSdkFileEncryption()
    const checkpoint = JSON.parse(JSON.stringify((await encryption.prepareEncryption(file)).checkpoint()))
    expect(checkpoint).toEqual({
      encryptionInfo: { encodedKeys: 'opaque-sdk-key' },
      header: Array.from(header),
      plaintextSize: 5,
      data: '{"v":1}'
    })
    const restored = await encryption.restoreEncryption(file, checkpoint)
    expect(attachmentCipher.restore).toHaveBeenCalledWith('opaque-sdk-key', header)
    expect(sdk.restoreUpload).toHaveBeenCalledWith(file, { cipher, data: '{"v":1}' })
    expect(restored.encryptionInfo).toEqual(checkpoint.encryptionInfo)
  })
  it('does not replace a failed restore with a new key', async () => {
    const { sdk } = installSdk()
    sdk.restoreUpload.mockRejectedValueOnce(Object.assign(new Error('changed'), { type: 'FileChanged' }))
    await expect(
      new ChatSdkFileEncryption().restoreEncryption(file, {
        encryptionInfo: { encodedKeys: 'opaque-sdk-key' },
        plaintextSize: 5,
        header: Array.from(header),
        data: '{}'
      })
    ).rejects.toMatchObject({ type: 'FileChanged' })
    expect(sdk.prepareUpload).not.toHaveBeenCalled()
  })
  it('closes an encryption session once and rejects later operations', async () => {
    const { uploads } = installSdk()
    const session = await new ChatSdkFileEncryption().prepareEncryption(file)
    session.close()
    session.close()
    expect(uploads[0].close).toHaveBeenCalledTimes(1)
    await expect(session.read(0, 1)).rejects.toThrow('closed')
    expect(() => session.checkpoint()).toThrow('closed')
  })
  it('plans storage size for the unchanged fixed algorithm', () => {
    const encryption = new ChatSdkFileEncryption()
    expect(encryption.ciphertextSize(0)).toBe(88)
    expect(encryption.ciphertextSize(10000000)).toBe(10002520)
  })
  it.each([-1, 0.5, Number.MAX_SAFE_INTEGER + 1])('rejects an invalid storage planning size %s', (size) => {
    expect(() => new ChatSdkFileEncryption().ciphertextSize(size)).toThrow(
      expect.objectContaining({ type: 'InvalidArgument' })
    )
  })
  it('restores from stored header bytes and opens the SDK verified view', async () => {
    const { attachmentCipher, view, readers } = installSdk()
    const stored = new Blob([header, new Uint8Array(21)])
    const session = await new ChatSdkFileEncryption().prepareDecryption(stored, { encodedKeys: 'opaque-sdk-key' }, 5)
    expect(attachmentCipher.restore).toHaveBeenCalledWith('opaque-sdk-key', header)
    expect(view).toHaveBeenCalledTimes(1)
    const source = readers[0].source
    expect(source.size).toBe(93)
    expect(await source.read(72, 2)).toEqual(new Uint8Array(2))
    expect(session.plaintextSize).toBe(5)
    await session.read(0, 3)
    expect(readers[0].read).toHaveBeenCalledWith(0, 3)
    session.close()
    session.close()
    expect(readers[0].close).toHaveBeenCalledTimes(1)
    await expect(session.read(0, 1)).rejects.toThrow('closed')
  })
  it('takes the size from the SDK view when the attachment has none', async () => {
    installSdk(123)
    const session = await new ChatSdkFileEncryption().prepareDecryption(
      new Blob([header]),
      { encodedKeys: 'opaque-sdk-key' },
      undefined
    )
    expect(session.plaintextSize).toBe(123)
  })
  it('rejects a trusted-size mismatch and closes the verified view', async () => {
    const { readers } = installSdk(5)
    await expect(
      new ChatSdkFileEncryption().prepareDecryption(new Blob([header]), { encodedKeys: 'opaque-sdk-key' }, 6)
    ).rejects.toMatchObject({ type: 'Authentication' })
    expect(readers[0].close).toHaveBeenCalledTimes(1)
  })
  it('rejects invalid keys before opening a view', async () => {
    const { view } = installSdk()
    await expect(
      new ChatSdkFileEncryption().prepareDecryption(new Blob([header]), { encodedKeys: 'bad' }, undefined)
    ).rejects.toMatchObject({ type: 'InvalidEncryption' })
    expect(view).not.toHaveBeenCalled()
  })
  it('propagates eager view authentication failure before returning a session', async () => {
    const { view } = installSdk()
    view.mockRejectedValueOnce(Object.assign(new Error('empty tag'), { type: 'Authentication' }))
    await expect(
      new ChatSdkFileEncryption().prepareDecryption(new Blob([header]), { encodedKeys: 'opaque-sdk-key' }, undefined)
    ).rejects.toMatchObject({ type: 'Authentication' })
  })
  it('fails clearly without SDK encryption support', async () => {
    setClient({})
    await expect(new ChatSdkFileEncryption().prepareEncryption(file)).rejects.toThrow('client.FileEncryption')
  })
})
