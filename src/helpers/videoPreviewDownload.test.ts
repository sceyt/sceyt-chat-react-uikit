import { getAttachmentUrlFromCache, setAttachmentToCache } from './attachmentsCache'
import { registerBlobUrl } from './attachmentBlobUrls'
import { withAttachmentEncryption } from './attachmentEncryption'
import { downloadVideoThumb } from './videoPreview'
import { fileTransfer } from '../fileTransfer/sceytChatUIKitFileTransfer'
import { FileDownloadRequest, FileTransferResult } from '../types/fileTransfer/types'
import {
  fakeEncrypted,
  fakeEncryptionInfo,
  installFakeFilesClient,
  readBlobText
} from '../testUtils/fakeAttachmentFiles'

jest.mock('./attachmentsCache', () => ({
  getAttachmentUrlFromCache: jest.fn(),
  getAttachmentURLWithVersion: (url: string) => `${url}_1_0_2`,
  setAttachmentToCache: jest.fn()
}))
jest.mock('./attachmentBlobUrls', () => ({ registerBlobUrl: jest.fn() }))

const mockGetAttachmentUrlFromCache = getAttachmentUrlFromCache as jest.Mock
const mockSetAttachmentToCache = setAttachmentToCache as jest.Mock
const mockRegisterBlobUrl = registerBlobUrl as jest.Mock
// The parent supplies the message identity; preview downloads carry their own file metadata.
const video = { url: 'https://cdn/clip.mp4', messageId: 'message-id', metadata: '{}' } as any

/** Sets a custom transport (fileTransfer.provider) that returns `result`. */
const useTransport = (result: FileTransferResult<Blob>) => {
  const transport = {
    upload: jest.fn(),
    download: jest.fn(async (_request: FileDownloadRequest) => result),
    cancel: jest.fn()
  }
  fileTransfer.provider = transport
  return transport
}

describe('downloadVideoThumb', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    mockGetAttachmentUrlFromCache.mockResolvedValueOnce(false).mockResolvedValueOnce('blob:preview')
    // Without a custom transport the SDK downloads (client.download), over the test's fetch.
    installFakeFilesClient()
  })

  afterEach(() => {
    fileTransfer.configure()
  })

  it('uses the configured transport and caches its preview blob', async () => {
    const preview = new Blob(['preview'], { type: 'image/jpeg' })
    const transport = useTransport(FileTransferResult.success(preview))

    await expect(downloadVideoThumb('https://cdn/preview.jpg', video, 'text')).resolves.toBe('blob:preview')

    const [request] = transport.download.mock.calls[0] as any[]
    expect(request).toMatchObject({ url: 'https://cdn/preview.jpg', mimeType: 'image/jpeg' })
    expect(request.context.attachment).toMatchObject({
      messageId: video.messageId,
      url: 'https://cdn/preview.jpg',
      type: 'preview',
      metadata: '{}',
      size: 0
    })
    expect(request.encryptionInfo).toBeUndefined()
    expect(mockSetAttachmentToCache).toHaveBeenCalledWith('https://cdn/preview.jpg', expect.any(Response))
  })

  it.each(['serialized', 'object'])(
    'a pvw without a preview attachment never inherits the video key (%s metadata)',
    async (format) => {
      const previewUrl = `https://cdn/ios-preview-${format}.jpg`
      const metadata = { pvw: previewUrl, 'waafi.enc': 'parent-video-key', 'sceyt.enc': 'parent-sdk-key' }
      const parent = {
        ...video,
        type: 'video',
        size: 4280459,
        metadata: format === 'serialized' ? JSON.stringify(metadata) : metadata
      }
      const preview = new Blob(['plain iOS preview'], { type: 'image/jpeg' })
      const transport = useTransport(FileTransferResult.success(preview))
      transport.download.mockImplementation(async (request) =>
        request.metadata?.['waafi.enc']
          ? FileTransferResult.failure(Object.assign(new Error('Key commitment mismatch'), { type: 'Authentication' }))
          : FileTransferResult.success(preview)
      )

      await expect(downloadVideoThumb(previewUrl, parent)).resolves.toBe('blob:preview')

      const [request] = transport.download.mock.calls[0] as any[]
      expect(request.metadata).toEqual({})
      expect(request.encryptionInfo).toBeUndefined()
      expect(request.plaintextSize).toBeUndefined()
      expect(request.context.attachment).toMatchObject({
        messageId: video.messageId,
        type: 'preview',
        url: previewUrl,
        size: 0,
        metadata: '{}'
      })
      expect(parent.metadata).toEqual(format === 'serialized' ? JSON.stringify(metadata) : metadata)
    }
  )

  it('a preview sent as a preview attachment of its own is downloaded as that attachment (its own key)', async () => {
    const transport = useTransport(FileTransferResult.success(new Blob(['preview'], { type: 'image/jpeg' })))
    const previewAttachment = {
      type: 'preview',
      url: 'https://cdn/clip-preview',
      metadata: JSON.stringify({ ext: { 'app.enc': { aid: 'preview-id' } } })
    } as any
    const shownVideo = { ...video, videoPreviewAttachment: previewAttachment }

    await downloadVideoThumb('https://cdn/clip-preview', shownVideo, 'text')

    const [request] = transport.download.mock.calls[0] as any[]
    expect(request.context.attachment === previewAttachment).toBe(true)
    expect(request).toMatchObject({ url: 'https://cdn/clip-preview', mimeType: 'image/jpeg' })
  })

  it('is downloaded by the SDK when no custom transport is configured', async () => {
    const preview = new Blob(['preview'], { type: 'image/jpeg' })
    const fetchMock = jest
      .spyOn(global, 'fetch' as any)
      .mockResolvedValue({ ok: true, blob: async () => preview } as any)

    await expect(downloadVideoThumb('https://cdn/preview.jpg', video)).resolves.toBe('blob:preview')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://cdn/preview.jpg',
      expect.objectContaining({ signal: expect.anything() })
    )
    fetchMock.mockRestore()
  })

  it("an encrypted preview attachment is opened with its own key and sized from its encrypted bytes, not the video's", async () => {
    // The preview is an attachment of its own with its own enc; the video points to it by URL.
    const previewAttachment = {
      type: 'preview',
      url: 'https://cdn/preview.jpg',
      metadata: withAttachmentEncryption('{}', fakeEncryptionInfo('key-2'))
    } as any
    const encryptedVideo = {
      ...video,
      size: 5000,
      metadata: withAttachmentEncryption('{"pvw":"https://cdn/preview.jpg"}', fakeEncryptionInfo('key-1')),
      videoPreviewAttachment: previewAttachment
    }
    const fetchMock = jest
      .spyOn(global, 'fetch' as any)
      .mockResolvedValue({ ok: true, blob: async () => fakeEncrypted('key-2', 'preview') } as any)

    await expect(downloadVideoThumb('https://cdn/preview.jpg', encryptedVideo)).resolves.toBe('blob:preview')

    const [, cached] = mockSetAttachmentToCache.mock.calls[0]
    const saved = await (cached as Response).blob()
    expect(saved.type).toBe('image/jpeg')
    expect(await readBlobText(saved)).toBe('preview')
    fetchMock.mockRestore()
  })

  it('does not cache a thumbnail the SDK could not download', async () => {
    const fetchMock = jest.spyOn(global, 'fetch' as any).mockResolvedValue({ ok: false, status: 403 } as any)

    await expect(downloadVideoThumb('https://cdn/denied.jpg', video)).rejects.toMatchObject({
      code: 403,
      type: 'DownloadFailed'
    })

    expect(mockSetAttachmentToCache).not.toHaveBeenCalled()
    fetchMock.mockRestore()
  })

  it('does not fall back to a direct request when the configured transport fails', async () => {
    const fetchMock = jest.spyOn(global, 'fetch' as any)
    useTransport(FileTransferResult.failure(new Error('preview download failed')))

    await expect(downloadVideoThumb('https://cdn/preview.jpg', video)).rejects.toThrow('preview download failed')

    expect(fetchMock).not.toHaveBeenCalled()
    fetchMock.mockRestore()
  })

  it('returns a cached preview without downloading it again', async () => {
    mockGetAttachmentUrlFromCache.mockReset().mockResolvedValue('blob:cached-preview')
    const transport = useTransport(FileTransferResult.success(new Blob(['preview'])))

    await expect(downloadVideoThumb('https://cdn/preview.jpg', video)).resolves.toBe('blob:cached-preview')

    expect(transport.download).not.toHaveBeenCalled()
    expect(mockSetAttachmentToCache).not.toHaveBeenCalled()
  })

  it('keeps a locally created object URL registered when Cache Storage is unavailable', async () => {
    mockGetAttachmentUrlFromCache.mockReset().mockResolvedValue(false)
    const originalCreateObjectURL = URL.createObjectURL
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: jest.fn().mockReturnValue('blob:local-preview')
    })
    useTransport(FileTransferResult.success(new Blob(['preview'])))

    await expect(downloadVideoThumb('https://cdn/preview.jpg', video)).resolves.toBe('blob:local-preview')

    expect(mockRegisterBlobUrl).toHaveBeenCalledWith('https://cdn/preview.jpg_1_0_2', 'blob:local-preview')
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectURL })
  })

  it('still returns a local thumbnail when Cache Storage rejects the downloaded preview', async () => {
    mockGetAttachmentUrlFromCache.mockReset().mockResolvedValue(false)
    mockSetAttachmentToCache.mockRejectedValue(new Error('cache unavailable'))
    const originalCreateObjectURL = URL.createObjectURL
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: jest.fn().mockReturnValue('blob:uncached-preview')
    })
    useTransport(FileTransferResult.success(new Blob(['preview'])))

    await expect(downloadVideoThumb('https://cdn/preview.jpg', video)).resolves.toBe('blob:uncached-preview')

    expect(mockRegisterBlobUrl).toHaveBeenCalledWith('https://cdn/preview.jpg_1_0_2', 'blob:uncached-preview')
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectURL })
  })
})
