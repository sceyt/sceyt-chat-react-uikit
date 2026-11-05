import { setClient } from '../../common/client'
import { ChatSdkEncryptionSession, ChatSdkFileEncryption } from './chatSdkFileEncryption'

const ALG = 'tink-aes256-gcm-hkdf-64k+commit-v1'

// A stand-in for the SDK's FileEncryption (sceyt-chat): it records what it is given.
// The SDK's own tests check the cryptography.
const installSdk = () => {
  const uploads: any[] = []
  const readers: any[] = []
  const makeUpload = (file: Blob, uniqueId: string, key = 'key-1', data = '{"v":1}') => {
    const upload = {
      file,
      ciphertextSize: file.size + 88,
      plaintextSize: file.size,
      sourceId: `source-${uniqueId}`,
      encryptionInfo: { format: ALG, data: { uniqueId, key, plainSize: file.size } },
      checkpoint: jest.fn(() => ({ encryptionInfo: upload.encryptionInfo, data })),
      readCiphertextRange: jest.fn(async (offset: number, length: number) => new Uint8Array(length).fill(offset % 256)),
      close: jest.fn()
    }
    uploads.push(upload)
    return upload
  }
  const sdk = {
    newUniqueId: jest.fn(() => 'gIGCg4SFhoeIiYqLjI2Ojw'),
    prepareUpload: jest.fn(async (file: Blob, uniqueId: string) => makeUpload(file, uniqueId)),
    restoreUpload: jest.fn(async (file: Blob, checkpoint: any) =>
      makeUpload(file, checkpoint.encryptionInfo.data.uniqueId, checkpoint.encryptionInfo.data.key, checkpoint.data)
    ),
    openDownload: jest.fn(async (source: any, info: any) => {
      const reader = {
        source,
        info,
        plaintextSize: info.data.plainSize,
        read: jest.fn(async (offset: number, length: number) => new Uint8Array(length)),
        close: jest.fn()
      }
      readers.push(reader)
      return reader
    })
  }
  setClient({ FileEncryption: sdk })
  return { sdk, uploads, readers }
}

describe('ChatSdkFileEncryption', () => {
  const file = new File(['hello world'], 'clip.mp4', { type: 'video/mp4' })
  afterEach(() => setClient({}))

  it('a prepared session has a new attachment id from the SDK, kept in its info and checkpoint', async () => {
    const { sdk, uploads } = installSdk()

    const session = await new ChatSdkFileEncryption().prepareEncryption(file)

    expect(sdk.prepareUpload).toHaveBeenCalledWith(file, 'gIGCg4SFhoeIiYqLjI2Ojw')
    expect(session).toBeInstanceOf(ChatSdkEncryptionSession)
    expect((session as ChatSdkEncryptionSession).upload).toBe(uploads[0])
    expect(session.encryptionInfo).toEqual({ algorithm: ALG, attachmentId: 'gIGCg4SFhoeIiYqLjI2Ojw', key: 'key-1' })
    expect(session.sourceId).toBe('source-gIGCg4SFhoeIiYqLjI2Ojw')
    expect(session.plaintextSize).toBe(file.size)
    expect(session.ciphertextSize).toBe(file.size + 88)
    expect(session.checkpoint()).toEqual({
      encryptionInfo: session.encryptionInfo,
      plaintextSize: file.size,
      data: '{"v":1}'
    })
    expect(await session.read(3, 4)).toEqual(new Uint8Array(4).fill(3))
    expect(uploads[0].readCiphertextRange).toHaveBeenCalledWith(3, 4)
  })

  it('a checkpoint kept as JSON restores the same SDK session', async () => {
    const { sdk } = installSdk()
    const encryption = new ChatSdkFileEncryption()
    const saved = JSON.parse(JSON.stringify((await encryption.prepareEncryption(file)).checkpoint()))

    const restored = await encryption.restoreEncryption(file, saved)

    expect(sdk.restoreUpload).toHaveBeenCalledWith(file, {
      encryptionInfo: { format: ALG, data: { uniqueId: 'gIGCg4SFhoeIiYqLjI2Ojw', key: 'key-1', plainSize: file.size } },
      data: '{"v":1}'
    })
    expect(restored.encryptionInfo).toEqual(saved.encryptionInfo)
  })

  it('a restore failure does not silently make a new key', async () => {
    const { sdk } = installSdk()
    sdk.restoreUpload.mockRejectedValueOnce(Object.assign(new Error('changed'), { type: 'FileChanged' }))
    const checkpoint = {
      encryptionInfo: { algorithm: ALG, attachmentId: 'a', key: 'k' },
      plaintextSize: file.size,
      data: '{}'
    }

    await expect(new ChatSdkFileEncryption().restoreEncryption(file, checkpoint)).rejects.toMatchObject({
      type: 'FileChanged'
    })
    expect(sdk.prepareUpload).not.toHaveBeenCalled()
  })

  it('a closed session closes the SDK upload once and reads no more', async () => {
    const { uploads } = installSdk()
    const session = await new ChatSdkFileEncryption().prepareEncryption(file)

    session.close()
    session.close()

    expect(uploads[0].close).toHaveBeenCalledTimes(1)
    await expect(session.read(0, 1)).rejects.toThrow('closed')
    expect(() => session.checkpoint()).toThrow('closed')
  })

  it("decryption gives the SDK the attachment's own size and reads ranges of the encrypted file", async () => {
    const { sdk, readers } = installSdk()
    const encrypted = new Blob([new Uint8Array([1, 2, 3, 4, 5, 6])])
    const info = { algorithm: ALG, attachmentId: 'file-id', key: 'file-key' }

    const session = await new ChatSdkFileEncryption().prepareDecryption(encrypted, info, 1234)

    expect(sdk.openDownload).toHaveBeenCalledWith(expect.anything(), {
      format: ALG,
      data: { uniqueId: 'file-id', key: 'file-key', plainSize: 1234 }
    })
    const source = readers[0].source
    expect(source.ciphertextSize).toBe(6)
    expect(Array.from(await source.read(2, 3))).toEqual([3, 4, 5])
    expect(session.plaintextSize).toBe(1234)
    expect(session.sourceId).toBe('file-id:6')
    await session.read(0, 10)
    expect(readers[0].read).toHaveBeenCalledWith(0, 10)
    session.close()
    session.close()
    expect(readers[0].close).toHaveBeenCalledTimes(1)
    await expect(session.read(0, 1)).rejects.toThrow('closed')
  })

  it('a file that does not verify fails at decryption, before any plaintext', async () => {
    const { sdk } = installSdk()
    sdk.openDownload.mockRejectedValueOnce(Object.assign(new Error('commitment'), { type: 'Authentication' }))

    await expect(
      new ChatSdkFileEncryption().prepareDecryption(new Blob(['x']), { algorithm: ALG, attachmentId: 'a', key: 'k' }, 1)
    ).rejects.toMatchObject({ type: 'Authentication' })
  })

  it('without the SDK file encryption on the client, it fails with a clear error', async () => {
    setClient({})

    await expect(new ChatSdkFileEncryption().prepareEncryption(file)).rejects.toThrow('client.FileEncryption')
  })
})
