import { setClient } from '../common/client'
import {
  attachmentDecryption,
  getAttachmentEncryption,
  getTypeFromFileName,
  getVideoThumbEncryption,
  prepareDownloadFile,
  videoThumbDecryption,
  withAttachmentEncryption,
  withVideoThumbEncryption
} from './attachmentEncryption'

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
