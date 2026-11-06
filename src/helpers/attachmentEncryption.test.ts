import {
  attachmentDecryption,
  getAttachmentEncryption,
  getTypeFromFileName,
  isUnopenableAttachmentError,
  withAttachmentEncryption
} from './attachmentEncryption'
import { setClient } from '../common/client'
import { fakeEncryption, fakeEncryptionInfo, installFakeFilesClient } from '../testUtils/fakeAttachmentFiles'

describe('attachment encryption metadata', () => {
  // The chat SDK reads the keys string in enc.
  beforeEach(() => {
    installFakeFilesClient()
  })

  afterEach(() => {
    setClient(undefined as any)
  })

  it('reads the file key from metadata stored as a JSON string', () => {
    const metadata = JSON.stringify({ szw: 10, enc: fakeEncryption('key-1') })

    expect(getAttachmentEncryption(metadata)).toEqual(fakeEncryptionInfo('key-1'))
    expect(getAttachmentEncryption({ enc: fakeEncryption('key-1') })).toEqual(fakeEncryptionInfo('key-1'))
  })

  it('an unencrypted file, or metadata that is not JSON, has no key', () => {
    expect(getAttachmentEncryption(JSON.stringify({ szw: 10 }))).toBeUndefined()
    expect(getAttachmentEncryption('not json')).toBeUndefined()
    expect(getAttachmentEncryption(undefined)).toBeUndefined()
  })

  it("writes the uploaded file's enc and keeps the other metadata", () => {
    const metadata = JSON.parse(withAttachmentEncryption(JSON.stringify({ szw: 10 }), fakeEncryptionInfo('key-1')))

    expect(metadata).toEqual({ szw: 10, enc: fakeEncryption('key-1') })
  })

  it('a resent file replaces the enc of the earlier attempt', () => {
    const first = withAttachmentEncryption('{"szw":1}', fakeEncryptionInfo('key-1'))

    const resent = withAttachmentEncryption(first, fakeEncryptionInfo('key-3'))

    expect(JSON.parse(resent)).toEqual({ szw: 1, enc: fakeEncryption('key-3') })
  })

  it('describes what the download coordinator needs to decrypt a file', () => {
    const metadata = withAttachmentEncryption('{}', fakeEncryptionInfo('key-2'))

    expect(attachmentDecryption({ metadata, name: 'clip.mp4' })).toEqual({
      encryption: fakeEncryptionInfo('key-2'),
      contentType: 'video/mp4'
    })
    expect(attachmentDecryption(null)).toEqual({ encryption: undefined, contentType: '' })
  })

  it('the real type of a decrypted file comes from its name', () => {
    expect(getTypeFromFileName('photo.JPG')).toBe('image/jpeg')
    expect(getTypeFromFileName('notes')).toBe('')
    expect(getTypeFromFileName('archive.xyz')).toBe('')
  })

  it("a file that failed decryption or has invalid enc can't be opened by downloading it again", () => {
    expect(isUnopenableAttachmentError({ type: 'Authentication' })).toBe(true)
    expect(isUnopenableAttachmentError({ type: 'InvalidEncryption' })).toBe(true)
    expect(isUnopenableAttachmentError({ type: 'DownloadFailed' })).toBe(false)
    expect(isUnopenableAttachmentError(undefined)).toBe(false)
  })
})
