import { FileEncryptionMetadata } from './fileEncryptionMetadata'
import { setClient } from '../../common/client'
import { fakeEncryption, fakeEncryptionInfo, installFakeFilesClient } from '../../testUtils/fakeAttachmentFiles'

describe('FileEncryptionMetadata', () => {
  beforeEach(() => {
    installFakeFilesClient()
  })

  afterEach(() => {
    setClient(undefined as any)
  })

  it("keeps enc as the SDK's keys string next to the media fields, and reads it back with the SDK", () => {
    const envelope = FileEncryptionMetadata.fromEncryptionInfo(fakeEncryptionInfo('key-1'))

    const written = FileEncryptionMetadata.write('{"tmb":"blur","szw":1280,"szh":203}', envelope)

    expect(JSON.parse(written)).toEqual({ tmb: 'blur', szw: 1280, szh: 203, 'sceyt.enc': fakeEncryption('key-1') })
    expect(FileEncryptionMetadata.read(written)!.toEncryptionInfo()).toEqual(fakeEncryptionInfo('key-1'))
    expect(FileEncryptionMetadata.isEncrypted(written)).toBe(true)
    // As JSON, the envelope is the keys string itself.
    expect(JSON.stringify({ 'sceyt.enc': envelope })).toBe(JSON.stringify({ 'sceyt.enc': fakeEncryption('key-1') }))
  })

  it('an encryption without a keys string cannot be kept in metadata', () => {
    const { encodedKeys, ...withoutKeys } = fakeEncryptionInfo('key-1')
    expect(encodedKeys).toBeTruthy()
    expect(() => FileEncryptionMetadata.fromEncryptionInfo(withoutKeys)).toThrow('encodedKeys')
  })

  it('malformed metadata does not escape the parser', () => {
    for (const metadata of [undefined, '', 'not json', '[1]', '{}', '{"szw":1}']) {
      expect(FileEncryptionMetadata.read(metadata)).toBeUndefined()
      expect(FileEncryptionMetadata.isEncrypted(metadata)).toBe(false)
    }
  })

  it('an enc the SDK cannot read (not a keys string, or the old object) has no encryption info, but is encrypted', () => {
    for (const enc of ['', 5, { v: 1, alg: 'tink-aes256-gcm-hkdf-64k+commit-v1', aid: 'id-1', k: 'key-1' }]) {
      const metadata = JSON.stringify({ 'sceyt.enc': enc })
      expect(FileEncryptionMetadata.read(metadata)).toBeUndefined()
      expect(FileEncryptionMetadata.isEncrypted(metadata)).toBe(true)
    }
  })

  it('carries the opaque key string even before a chat client is installed', () => {
    setClient(undefined as any)
    expect(FileEncryptionMetadata.read({ 'sceyt.enc': fakeEncryption('key-1') })!.encodedKeys).toBe(
      fakeEncryption('key-1')
    )
  })

  it('removes `enc` and keeps the other keys', () => {
    const metadata = JSON.stringify({ szw: 10, 'sceyt.enc': fakeEncryption('key-1') })
    expect(JSON.parse(FileEncryptionMetadata.remove(metadata)!)).toEqual({ szw: 10 })
    expect(FileEncryptionMetadata.remove(JSON.stringify({ 'sceyt.enc': fakeEncryption('key-1') }))).toBeUndefined()
    expect(FileEncryptionMetadata.remove('{"szw":1}')).toBe('{"szw":1}')
  })

  it('key-bearing models leave the key out of their diagnostic string', () => {
    const envelope = FileEncryptionMetadata.fromEncryptionInfo(fakeEncryptionInfo('key-1'))
    expect(String(envelope)).not.toContain('key-1')
    expect(String(envelope)).not.toContain(fakeEncryption('key-1'))
  })
})
