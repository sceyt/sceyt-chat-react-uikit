import { setClient } from '../common/client'
import {
  attachmentDecryption,
  canPrepareAttachmentFiles,
  getAttachmentEncryption,
  getTypeFromFileName,
  getVideoThumbEncryption,
  prepareDownloadFile,
  prepareUploadFile,
  videoThumbDecryption,
  withAttachmentEncryption,
  withVideoThumbEncryption
} from './attachmentEncryption'

const videoKey = { id: 'video-id', v: 1, k: 'video-key' }
const previewKey = { id: 'preview-id', v: 1, k: 'preview-key' }

describe('attachment encryption metadata', () => {
  it('reads the file key from metadata stored as a JSON string', () => {
    expect(getAttachmentEncryption(JSON.stringify({ szw: 10, enc: videoKey }))).toEqual(videoKey)
  })

  it.each([
    ['no metadata', undefined],
    ['metadata without enc', '{"szw":10}'],
    ['metadata that is not JSON', 'not json'],
    [
      'only the preview key, before the video is uploaded',
      JSON.stringify({ enc: { v: 1, thumb: { id: 'a', k: 'a' } } })
    ]
  ])('finds no file key in %s', (_name, metadata) => {
    expect(getAttachmentEncryption(metadata)).toBeUndefined()
  })

  it('a video keeps its preview key when its own key is added after upload', () => {
    const withPreview = withVideoThumbEncryption('{"szw":1280,"video_thumb":"https://cdn/p.jpg"}', previewKey)
    const metadata = JSON.parse(withAttachmentEncryption(withPreview, videoKey))

    expect(metadata).toEqual({
      szw: 1280,
      video_thumb: 'https://cdn/p.jpg',
      enc: { ...videoKey, thumb: { id: 'preview-id', k: 'preview-key' } }
    })
    expect(getAttachmentEncryption(metadata)).toEqual(metadata.enc)
    expect(getVideoThumbEncryption(metadata)).toEqual(previewKey)
  })

  it('a resent video replaces the preview key of the earlier attempt', () => {
    const first = withVideoThumbEncryption('{}', previewKey)
    const again = withVideoThumbEncryption(first, { id: 'new-preview-id', v: 1, k: 'new-preview-key' })
    expect(getVideoThumbEncryption(again)).toEqual({ id: 'new-preview-id', v: 1, k: 'new-preview-key' })
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
      encryption: expect.objectContaining({ k: 'video-key' }),
      contentType: 'video/mp4'
    })
    expect(videoThumbDecryption(metadata)).toEqual({ encryption: previewKey, contentType: 'image/jpeg' })
    expect(attachmentDecryption({ metadata: '{}', name: 'a.txt' })).toEqual({ encryption: undefined, contentType: '' })
  })

  it('with an SDK that cannot prepare files, preparing one fails with a clear error', async () => {
    setClient({})
    expect(canPrepareAttachmentFiles()).toBe(false)
    await expect(prepareUploadFile(new Blob(['x']), true)).rejects.toThrow('client.prepareUpload')
    expect(() => prepareDownloadFile(undefined)).toThrow('client.prepareDownload')
  })

  it('asks the SDK for an encrypted upload file, and a download file with the unique id and key', async () => {
    const prepareUpload = jest.fn(async () => 'upload-file')
    const prepareDownload = jest.fn(() => 'download-file')
    setClient({ prepareUpload, prepareDownload })
    const blob = new Blob(['x'])

    expect(canPrepareAttachmentFiles()).toBe(true)
    expect(await prepareUploadFile(blob, true)).toBe('upload-file')
    expect((prepareUpload.mock.calls[0] as any[])[1]).toEqual({ encrypt: true })
    await prepareUploadFile(blob, false)
    expect((prepareUpload.mock.calls[1] as any[])[1]).toEqual({ encrypt: false })
    expect(prepareDownloadFile(videoKey, 'video/mp4')).toBe('download-file')
    expect(prepareDownload).toHaveBeenLastCalledWith({ metadata: { enc: videoKey }, type: 'video/mp4' })
    prepareDownloadFile(undefined)
    expect(prepareDownload).toHaveBeenLastCalledWith({ metadata: {}, type: '' })
  })
})
