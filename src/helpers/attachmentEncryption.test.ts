import {
  attachmentDecryption,
  getAttachmentEncryption,
  getTypeFromFileName,
  getVideoThumbEncryption,
  isUnopenableAttachmentError,
  videoThumbDecryption,
  withAttachmentEncryption
} from './attachmentEncryption'
import { fakeEncryption, fakeEncryptionInfo } from '../testUtils/fakeAttachmentFiles'

describe('attachment encryption metadata', () => {
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

  it("a video keeps its preview's key as its thumbnail rendition", () => {
    const metadata = withAttachmentEncryption(
      JSON.stringify({ video_thumb: 'https://cdn.example/preview' }),
      fakeEncryptionInfo('key-2'),
      fakeEncryptionInfo('key-1')
    )

    expect(JSON.parse(metadata).enc.renditions).toEqual([{ role: 'thumbnail', attachmentId: 'id-1', key: 'key-1' }])
    expect(getAttachmentEncryption(metadata)).toEqual(fakeEncryptionInfo('key-2'))
    expect(getVideoThumbEncryption(metadata)).toEqual(fakeEncryptionInfo('key-1'))
  })

  it('a resent video replaces the preview key of the earlier attempt', () => {
    const first = withAttachmentEncryption('{}', fakeEncryptionInfo('key-2'), fakeEncryptionInfo('key-1'))

    const resent = withAttachmentEncryption(first, fakeEncryptionInfo('key-4'), fakeEncryptionInfo('key-3'))

    expect(JSON.parse(resent).enc.renditions).toEqual([{ role: 'thumbnail', attachmentId: 'id-3', key: 'key-3' }])
  })

  it('an unencrypted video, or one whose preview is not encrypted, has no preview key', () => {
    expect(getVideoThumbEncryption(JSON.stringify({ video_thumb: 'https://cdn.example/preview' }))).toBeUndefined()
    expect(getVideoThumbEncryption(withAttachmentEncryption('{}', fakeEncryptionInfo('key-1')))).toBeUndefined()
  })

  it('describes what the download coordinator needs to decrypt a file and a video preview', () => {
    const metadata = withAttachmentEncryption('{}', fakeEncryptionInfo('key-2'), fakeEncryptionInfo('key-1'))

    expect(attachmentDecryption({ metadata, name: 'clip.mp4' })).toEqual({
      encryption: fakeEncryptionInfo('key-2'),
      contentType: 'video/mp4'
    })
    expect(videoThumbDecryption(metadata)).toEqual({
      encryption: fakeEncryptionInfo('key-1'),
      contentType: 'image/jpeg'
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
