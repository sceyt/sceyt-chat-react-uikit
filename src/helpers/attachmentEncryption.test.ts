import { setClient } from '../common/client'
import {
  attachmentDecryption,
  fileEncryption,
  getAttachmentEncryption,
  getTypeFromFileName,
  getVideoThumbEncryption,
  prepareDownloadFile,
  videoThumbDecryption,
  withAttachmentEncryption,
  withVideoThumbEncryption
} from './attachmentEncryption'
import { fakeEncrypted, installFakeFilesClient, readBlobText } from '../testUtils/fakeAttachmentFiles'

const ALG = 'tink-aes256-gcm-hkdf-64k+commit-v1'
const videoKey = { v: 1 as const, alg: ALG, attachmentId: 'video-id', key: 'video-key' }
const previewKey = { v: 1 as const, alg: ALG, attachmentId: 'preview-id', key: 'preview-key' }

describe('attachment encryption metadata', () => {
  it('reads the file key from metadata stored as a JSON string', () => {
    expect(getAttachmentEncryption(JSON.stringify({ szw: 10, enc: videoKey }))).toEqual(videoKey)
  })

  it.each([
    ['no metadata', undefined],
    ['metadata without enc', '{"szw":10}'],
    ['metadata that is not JSON', 'not json'],
    [
      'only the preview, before the video is uploaded',
      JSON.stringify({ enc: { v: 1, alg: ALG, renditions: [{ role: 'thumbnail', attachmentId: 'a', key: 'a' }] } })
    ]
  ])('finds no file key in %s', (_name, metadata) => {
    expect(getAttachmentEncryption(metadata)).toBeUndefined()
  })

  it('a video keeps its preview, a thumbnail rendition, when its own key is added after upload', () => {
    const withPreview = withVideoThumbEncryption('{"szw":1280,"video_thumb":"https://cdn/p.jpg"}', previewKey)
    const metadata = JSON.parse(withAttachmentEncryption(withPreview, videoKey))

    expect(metadata).toEqual({
      szw: 1280,
      video_thumb: 'https://cdn/p.jpg',
      enc: {
        v: 1,
        alg: ALG,
        attachmentId: 'video-id',
        key: 'video-key',
        renditions: [{ role: 'thumbnail', attachmentId: 'preview-id', key: 'preview-key' }]
      }
    })
    expect(getAttachmentEncryption(metadata)).toEqual(metadata.enc)
    expect(getVideoThumbEncryption(metadata)).toEqual(previewKey)
  })

  it('a resent video replaces the preview of the earlier attempt', () => {
    const first = withVideoThumbEncryption('{}', previewKey)
    const newPreview = { ...previewKey, attachmentId: 'new-preview-id', key: 'new-preview-key' }
    const again = withVideoThumbEncryption(first, newPreview)
    expect(getVideoThumbEncryption(again)).toEqual(newPreview)
    expect(JSON.parse(again).enc.renditions).toHaveLength(1)
  })

  it('an unencrypted video has no preview key', () => {
    expect(getVideoThumbEncryption('{"video_thumb":"https://cdn/p.jpg"}')).toBeUndefined()
  })

  it.each([
    ['photo.JPG', 'image/jpeg'],
    ['clip.mp4', 'video/mp4'],
    ['clip.mov', 'video/quicktime'],
    ['voice.mp3', 'audio/mpeg'],
    ['report.pdf', 'application/pdf'],
    ['archive.zip', ''],
    ['mp4', ''],
    [undefined, '']
  ])('the decrypted type of "%s" is "%s"', (name, type) => {
    expect(getTypeFromFileName(name)).toBe(type)
  })

  it('describes what the download coordinator needs to decrypt a file and a video preview', () => {
    const metadata = withAttachmentEncryption(withVideoThumbEncryption('{}', previewKey), videoKey)
    expect(attachmentDecryption({ metadata, name: 'clip.mp4' })).toEqual({
      encryption: expect.objectContaining({ key: 'video-key' }),
      contentType: 'video/mp4'
    })
    expect(videoThumbDecryption(metadata)).toEqual({ encryption: previewKey, contentType: 'image/jpeg' })
    expect(attachmentDecryption({ metadata: '{}', name: 'a.txt' })).toEqual({ encryption: undefined, contentType: '' })
  })

  it('with an SDK that cannot prepare files, preparing one fails with a clear error', async () => {
    setClient({})
    expect(() => prepareDownloadFile(videoKey, 'video/mp4')).toThrow('client.prepareDownload')
    expect(() => prepareDownloadFile(undefined)).toThrow('client.prepareDownload')
  })

  it('asks the SDK for a download file with the attachment id and key', () => {
    const prepareDownload = jest.fn(() => 'download-file')
    setClient({ prepareUpload: jest.fn(), prepareDownload })

    expect(prepareDownloadFile(videoKey, 'video/mp4')).toBe('download-file')
    expect(prepareDownload).toHaveBeenLastCalledWith({ metadata: { enc: videoKey }, type: 'video/mp4' })
    prepareDownloadFile(undefined)
    expect(prepareDownload).toHaveBeenLastCalledWith({ metadata: {}, type: '' })
  })
})

describe('fileEncryption: what a custom uploader encrypts and opens files with', () => {
  const photo = () => new File(['a picture'], 'photo.png', { type: 'image/png' })
  // The test files are ASCII text.
  const text = (bytes: Uint8Array) => String.fromCharCode(...Array.from(bytes))

  beforeEach(() => {
    installFakeFilesClient()
  })

  it('encrypts a file with a new key and attachment id each time, and describes what it stores', async () => {
    const first = await fileEncryption.prepareEncryption(photo())
    const second = await fileEncryption.prepareEncryption(photo())

    expect(first.encryptionInfo).toEqual({ v: 1, alg: ALG, attachmentId: 'id-1', key: 'key-1' })
    expect(second.encryptionInfo.key).toBe('key-2')
    expect(first.plaintextSize).toBe('a picture'.length)
    expect(first.ciphertextSize).toBe('enc(key-1@id-1):a picture'.length)
    expect(first.contentType).toBe('application/octet-stream')
  })

  it('reads exactly the stored bytes asked for; parts read in any order make the whole stored file', async () => {
    const session = await fileEncryption.prepareEncryption(photo())
    const whole = await readBlobText(await session.readAll())

    const parts = await Promise.all([
      session.read(10, 10),
      session.read(0, 10),
      session.read(20, session.ciphertextSize - 20)
    ])

    expect(parts.map((part) => part.length)).toEqual([10, 10, session.ciphertextSize - 20])
    expect(text(parts[1]) + text(parts[0]) + text(parts[2])).toBe(whole)
  })

  it('gives the same bytes for the same range again, so a failed part is sent as it was', async () => {
    const session = await fileEncryption.prepareEncryption(photo())

    expect(text(await session.read(3, 12))).toBe(text(await session.read(3, 12)))
  })

  it('reads nothing at the end of the file', async () => {
    const session = await fileEncryption.prepareEncryption(photo())

    expect(await session.read(session.ciphertextSize, 0)).toHaveLength(0)
  })

  it.each([
    ['a negative offset', -1, 1],
    ['a negative length', 0, -1],
    ['past the end', 1, Number.MAX_SAFE_INTEGER],
    ['a fractional offset', 0.5, 1]
  ])('refuses a range with %s', async (_case, offset, length) => {
    const session = await fileEncryption.prepareEncryption(photo())

    await expect(session.read(offset, length)).rejects.toThrow(RangeError)
  })

  it('fails when the chat client does not encrypt the file (an older sceyt-chat)', async () => {
    setClient({
      prepareUpload: async (file: Blob) => ({ size: file.size, contentType: file.type }),
      prepareDownload: jest.fn()
    })

    await expect(fileEncryption.prepareEncryption(photo())).rejects.toThrow('without encrypting it')
  })

  it('fails with a clear error when the chat client cannot prepare files', async () => {
    setClient({})

    await expect(fileEncryption.prepareEncryption(photo())).rejects.toThrow('client.prepareUpload')
  })

  it('opens a downloaded encrypted file with its encryption info: decrypted, with its real type', async () => {
    const session = await fileEncryption.prepareDecryption(
      fakeEncrypted('key-7', 'a picture'),
      {
        v: 1,
        alg: ALG,
        attachmentId: 'id-7',
        key: 'key-7'
      },
      'image/png'
    )
    const opened = await session.readAll()

    expect(opened.type).toBe('image/png')
    expect(await readBlobText(opened)).toBe('a picture')
  })

  it('opens what it encrypted', async () => {
    const encrypted = await fileEncryption.prepareEncryption(photo())
    const opened = await (
      await fileEncryption.prepareDecryption(await encrypted.readAll(), encrypted.encryptionInfo, 'image/png')
    ).readAll()

    expect(await readBlobText(opened)).toBe('a picture')
  })

  it('does not open a file encrypted with another key', async () => {
    const session = await fileEncryption.prepareDecryption(fakeEncrypted('key-7', 'a picture'), {
      v: 1,
      alg: ALG,
      attachmentId: 'id-8',
      key: 'key-8'
    })

    await expect(session.readAll()).rejects.toMatchObject({ type: 'AttachmentDecryptionFailed' })
  })

  it('needs the encryption info to open a file: without it, nothing is opened as plaintext', async () => {
    await expect(fileEncryption.prepareDecryption(fakeEncrypted('key-7', 'x'), undefined as any)).rejects.toThrow(
      'needs its encryption info'
    )
  })
})
