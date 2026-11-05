import {
  cancelMediaDownload,
  getMediaDownloadSnapshot,
  requestMediaDownload,
  resetMediaDownloadCoordinatorForTests,
  subscribeToMediaDownload
} from './mediaDownloadCoordinator'
import { setClient } from '../common/client'
import { getAttachmentUrlFromCache, setAttachmentToCache } from './attachmentsCache'
import { fileTransfer } from '../fileTransfer/sceytChatUIKitFileTransfer'
import { FileDownloadRequest, FileTransferCallback, FileTransferResult } from '../fileTransfer/types'
import {
  fakeEncrypted,
  fakeEncryptionInfo,
  installFakeFilesClient,
  readBlobText
} from '../testUtils/fakeAttachmentFiles'

jest.mock('./attachmentsCache', () => ({
  getAttachmentUrlFromCache: jest.fn().mockResolvedValue(false),
  getAttachmentURLWithVersion: (key: string) => `${key}_v1`,
  setAttachmentToCache: jest.fn().mockResolvedValue(undefined)
}))

jest.mock('./attachmentBlobUrls', () => ({
  registerBlobUrl: jest.fn()
}))

jest.mock('./videoConversion', () => ({
  ensurePlayableVideoBlob: async (blob: Blob) => blob
}))

type TransportDownload = (
  // eslint-disable-next-line no-unused-vars
  request: FileDownloadRequest,
  // eslint-disable-next-line no-unused-vars
  callback: FileTransferCallback
) => Promise<FileTransferResult<Blob>>

/** Sets a custom transport (fileTransfer.transport) whose download is `download`. */
const useTransport = (download: TransportDownload = async () => FileTransferResult.success(new Blob(['media']))) => {
  const transport = { upload: jest.fn(), download: jest.fn(download), cancel: jest.fn() }
  fileTransfer.transport = transport
  return transport
}

/** A transport download that runs until the test finishes it, reporting progress on demand. */
const usePendingTransport = () => {
  let finish: (result: FileTransferResult<Blob>) => void = () => undefined
  let onProgress: (percent: number) => void = () => undefined
  const transport = useTransport(
    (_request, callback) =>
      new Promise((resolve) => {
        onProgress = callback.onProgress
        finish = resolve
      })
  )
  return {
    transport,
    // eslint-disable-next-line no-unused-vars
    finish: (result: FileTransferResult<Blob>) => finish(result),
    // eslint-disable-next-line no-unused-vars
    progress: (percent: number) => onProgress(percent)
  }
}

const abortError = () => {
  const error = new Error('cancelled')
  error.name = 'AbortError'
  return error
}

/** Settles as the transport contract says: an aborted request ends as interrupted. */
const untilAborted = (request: FileDownloadRequest, error: Error = abortError()) =>
  new Promise<FileTransferResult<Blob>>((resolve) => {
    request.signal.addEventListener('abort', () => resolve(FileTransferResult.interrupted(error)))
  })

const attachmentOf = (url: string, extra: Record<string, unknown> = {}) => ({ url, ...extra }) as any

describe('mediaDownloadCoordinator', () => {
  const originalCreateObjectURL = URL.createObjectURL
  const originalFetch = global.fetch
  const mockGetAttachmentUrlFromCache = getAttachmentUrlFromCache as jest.Mock

  const flushCoordinator = async () => {
    // Starting a transfer includes the asynchronous Cache Storage lookup.
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockGetAttachmentUrlFromCache.mockResolvedValue(false)
    resetMediaDownloadCoordinatorForTests()
    fileTransfer.configure()
    // Without a custom transport the default one downloads with the SDK (client.download), over the test's fetch.
    installFakeFilesClient()
    URL.createObjectURL = jest.fn(() => 'blob:shared-media')
  })

  afterEach(() => {
    fileTransfer.configure()
    global.fetch = originalFetch
    URL.createObjectURL = originalCreateObjectURL
  })

  it('joins identical requests, shares progress, and writes every requested cache alias', async () => {
    const { transport, finish, progress } = usePendingTransport()

    const first = requestMediaDownload({
      key: 'original-video:https://cdn/video.mp4',
      attachment: attachmentOf('https://cdn/video.mp4'),
      url: 'https://cdn/video.mp4',
      cacheKey: 'https://cdn/video.mp4_original_video_url',
      kind: 'original-video'
    })
    const second = requestMediaDownload({
      key: 'original-video:https://cdn/video.mp4',
      attachment: attachmentOf('https://cdn/video.mp4'),
      url: 'https://cdn/video.mp4',
      cacheKey: 'https://cdn/video.mp4',
      kind: 'original-video'
    })

    await flushCoordinator()
    expect(transport.download).toHaveBeenCalledTimes(1)
    progress(25)
    // A file of unknown size is counted out of 100.
    expect(getMediaDownloadSnapshot('original-video:https://cdn/video.mp4')).toMatchObject({
      state: 'loading',
      loaded: 25,
      total: 100,
      progress: 25
    })

    finish(FileTransferResult.success(new Blob(['video'], { type: 'video/mp4' })))
    await expect(first).resolves.toMatchObject({ objectUrl: 'blob:shared-media' })
    await expect(second).resolves.toMatchObject({ objectUrl: 'blob:shared-media' })

    expect(setAttachmentToCache).toHaveBeenCalledTimes(2)
    expect(getMediaDownloadSnapshot('original-video:https://cdn/video.mp4')).toMatchObject({
      state: 'completed',
      progress: 100
    })
  })

  it('without a custom transport, the default transport downloads and opens the file, and it is cached and shown once', async () => {
    const download = jest.fn(async () => fakeEncrypted('key-3', 'opened video'))
    setClient({ ...installFakeFilesClient(), download })
    global.fetch = jest.fn() as any

    const { blob } = await requestMediaDownload({
      key: 'original-video:https://cdn/clip.mp4',
      attachment: attachmentOf('https://cdn/clip.mp4', { size: 'opened video'.length }),
      url: 'https://cdn/clip.mp4',
      cacheKey: 'https://cdn/clip.mp4_original_video_url',
      kind: 'original-video',
      encryption: fakeEncryptionInfo('key-3'),
      contentType: 'video/mp4'
    })

    expect(download).toHaveBeenCalledTimes(1)
    // The client downloads the stored (encrypted) bytes untyped; the UIKit's encryption opens them.
    expect(download).toHaveBeenCalledWith('https://cdn/clip.mp4', expect.objectContaining({ type: '' }))
    // Downloaded by the client only: not downloaded again with a plain request.
    expect(global.fetch).not.toHaveBeenCalled()
    expect(await readBlobText(blob)).toBe('opened video')
    expect(blob.type).toBe('video/mp4')
    expect(setAttachmentToCache).toHaveBeenCalledWith('https://cdn/clip.mp4_original_video_url', expect.any(Response))
  })

  it('gives the transport a download request for the attachment URL, with its signal', async () => {
    const transport = useTransport(async () => FileTransferResult.success(new Blob(['image'], { type: 'image/jpeg' })))
    const attachment = attachmentOf('https://cdn/image.jpg', { name: 'image.jpg' })

    await requestMediaDownload({
      key: 'original-image:https://cdn/image.jpg',
      attachment,
      url: 'https://cdn/image.jpg',
      cacheKey: 'https://cdn/image.jpg',
      kind: 'original-image'
    })

    const [request] = transport.download.mock.calls[0]
    expect(request).toMatchObject({
      operationId: 'download:original-image:https://cdn/image.jpg',
      url: 'https://cdn/image.jpg'
    })
    expect(request.context).toMatchObject({ attachment })
    expect(request.signal).toBeInstanceOf(AbortSignal)
    // A plain file: nothing to decrypt.
    expect(request.encryptionInfo).toBeUndefined()
    expect(request.plaintextSize).toBeUndefined()
  })

  it('gives the transport the attachment, which carries its message id', async () => {
    const transport = useTransport()
    const attachment = attachmentOf('https://cdn/image.jpg', { messageId: '9223372036854775807' })

    await requestMediaDownload({
      key: 'original-image:https://cdn/image.jpg',
      attachment,
      url: 'https://cdn/image.jpg',
      cacheKey: 'https://cdn/image.jpg',
      kind: 'original-image',
      messageType: 'text'
    })

    expect((transport.download.mock.calls[0][0].context as any).attachment.messageId).toBe('9223372036854775807')
  })

  it('asks the transport for a video preview with its video as the attachment', async () => {
    const transport = useTransport(async () =>
      FileTransferResult.success(new Blob(['preview'], { type: 'image/jpeg' }))
    )
    const video = attachmentOf('https://cdn/clip.mp4', { messageId: '9223372036854775807', size: 5000 })

    await requestMediaDownload({
      key: 'video-thumbnail:https://cdn/clip-preview.jpg',
      attachment: video,
      url: 'https://cdn/clip-preview.jpg',
      cacheKey: 'https://cdn/clip-preview.jpg',
      kind: 'video-thumbnail',
      encryption: fakeEncryptionInfo('key-2'),
      contentType: 'image/jpeg'
    })

    const [request] = transport.download.mock.calls[0]
    expect((request.context as any).attachment === video).toBe(true)
    expect(request).toMatchObject({
      url: 'https://cdn/clip-preview.jpg',
      mimeType: 'image/jpeg',
      encryptionInfo: fakeEncryptionInfo('key-2')
    })
    // The video's size is not the preview's: the preview is sized from its encrypted bytes.
    expect(request.plaintextSize).toBeUndefined()
  })

  it('shares one download between two messages using the same file, sent with the first message ID', async () => {
    const transport = useTransport(async () => FileTransferResult.success(new Blob(['image'], { type: 'image/jpeg' })))
    const request = {
      key: 'original-image:https://cdn/shared.jpg',
      url: 'https://cdn/shared.jpg',
      cacheKey: 'https://cdn/shared.jpg',
      kind: 'original-image' as const
    }

    await Promise.all([
      requestMediaDownload({ ...request, attachment: attachmentOf(request.url, { messageId: '9223372036854775807' }) }),
      requestMediaDownload({ ...request, attachment: attachmentOf(request.url, { messageId: '9223372036854775808' }) })
    ])

    // Forwarded messages point at the same file; the backend authorizes either ID.
    expect(transport.download).toHaveBeenCalledTimes(1)
    expect((transport.download.mock.calls[0][0].context as any).attachment.messageId).toBe('9223372036854775807')
  })

  it('reuses a completed browser-cache blob without invoking the transport', async () => {
    const transport = useTransport()
    mockGetAttachmentUrlFromCache.mockResolvedValue('blob:cached-video')
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['cached-video'], { type: 'video/mp4' })
    }) as any

    await expect(
      requestMediaDownload({
        key: 'original-video:https://cdn/cached.mp4',
        attachment: attachmentOf('https://cdn/cached.mp4'),
        url: 'https://cdn/cached.mp4',
        cacheKey: 'https://cdn/cached.mp4_original_video_url',
        kind: 'original-video',
        size: 100
      })
    ).resolves.toMatchObject({ objectUrl: 'blob:cached-video' })

    expect(mockGetAttachmentUrlFromCache).toHaveBeenCalledWith('https://cdn/cached.mp4_original_video_url')
    expect(global.fetch).toHaveBeenCalledWith('blob:cached-video')
    expect(transport.download).not.toHaveBeenCalled()
  })

  it.each([
    ['original-image', 'original-image:https://cdn/image.jpg'],
    ['original-video', 'original-video:https://cdn/video.mp4'],
    ['video-thumbnail', 'video-thumbnail:https://cdn/video-thumb.jpg'],
    ['voice', 'voice:https://cdn/voice.ogg'],
    ['file', 'file:https://cdn/file.pdf']
  ] as const)('reuses a cached %s without invoking the transport', async (kind, key) => {
    const url = key.slice(key.indexOf(':') + 1)
    const cacheKey = `${url}_${kind}`
    const transport = useTransport()
    mockGetAttachmentUrlFromCache.mockResolvedValue('blob:cached-media')
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['cached-media'])
    }) as any

    await expect(
      requestMediaDownload({ key, attachment: attachmentOf(url), url, cacheKey, kind })
    ).resolves.toMatchObject({ objectUrl: 'blob:cached-media' })

    expect(mockGetAttachmentUrlFromCache).toHaveBeenCalledWith(cacheKey)
    expect(transport.download).not.toHaveBeenCalled()
  })

  it('keeps an explicit cancellation when it happens during the cache lookup', async () => {
    let resolveCacheLookup: ((value: string | false) => void) | undefined
    mockGetAttachmentUrlFromCache.mockImplementation(
      () =>
        new Promise<string | false>((resolve) => {
          resolveCacheLookup = resolve
        })
    )
    const transport = useTransport()
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['cached-video'], { type: 'video/mp4' })
    }) as any

    const request = requestMediaDownload({
      key: 'original-video:https://cdn/cached.mp4',
      attachment: attachmentOf('https://cdn/cached.mp4'),
      url: 'https://cdn/cached.mp4',
      cacheKey: 'https://cdn/cached.mp4_original_video_url',
      kind: 'original-video'
    })
    await flushCoordinator()
    cancelMediaDownload('original-video:https://cdn/cached.mp4')
    resolveCacheLookup!('blob:cached-video')

    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
    expect(transport.download).not.toHaveBeenCalled()
    expect(getMediaDownloadSnapshot('original-video:https://cdn/cached.mp4')).toMatchObject({ state: 'cancelled' })
  })

  it('keeps preview and original video downloads as separate jobs and transport operations', async () => {
    const transport = useTransport()
    const video = attachmentOf('https://cdn/video.mp4')

    await Promise.all([
      requestMediaDownload({
        key: 'video-thumbnail:https://cdn/thumb.jpg',
        attachment: video,
        url: 'https://cdn/thumb.jpg',
        cacheKey: 'https://cdn/thumb.jpg',
        kind: 'video-thumbnail'
      }),
      requestMediaDownload({
        key: 'original-video:https://cdn/video.mp4',
        attachment: video,
        url: 'https://cdn/video.mp4',
        cacheKey: 'https://cdn/video.mp4_original_video_url',
        kind: 'original-video'
      })
    ])

    expect(transport.download).toHaveBeenCalledTimes(2)
    // Cancelling one must not reach the other in a transport that tracks operations by id.
    expect(transport.download.mock.calls.map(([request]: any) => request.operationId)).toEqual([
      'download:video-thumbnail:https://cdn/thumb.jpg',
      'download:original-video:https://cdn/video.mp4'
    ])
  })

  it('counts transport progress in bytes of the attachment size', async () => {
    const { finish, progress } = usePendingTransport()

    const request = requestMediaDownload({
      key: 'original-video:906070149054857222',
      attachment: attachmentOf('906070149054857222', { size: 99_306_732 }),
      url: '906070149054857222',
      cacheKey: '906070149054857222_original_video_url',
      kind: 'original-video',
      size: 99_306_732
    })
    await flushCoordinator()
    progress(40)

    const snapshot = getMediaDownloadSnapshot('original-video:906070149054857222')
    expect(snapshot.loaded).toBeCloseTo(99_306_732 * 0.4)
    expect(snapshot.total).toBe(99_306_732)
    expect(snapshot.progress).toBe(40)

    finish(FileTransferResult.success(new Blob(['video'], { type: 'video/mp4' })))
    await request
  })

  it('cancels a shared native request once for every subscriber', async () => {
    global.fetch = jest.fn(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => reject(abortError()))
        })
    ) as any
    const request = {
      key: 'voice:https://cdn/voice.ogg',
      attachment: attachmentOf('https://cdn/voice.ogg'),
      url: 'https://cdn/voice.ogg',
      cacheKey: 'https://cdn/voice.ogg',
      kind: 'voice' as const
    }

    const first = requestMediaDownload(request)
    const second = requestMediaDownload(request)

    await flushCoordinator()
    cancelMediaDownload('voice:https://cdn/voice.ogg')
    await expect(first).rejects.toMatchObject({ name: 'AbortError' })
    await expect(second).rejects.toMatchObject({ name: 'AbortError' })
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(getMediaDownloadSnapshot('voice:https://cdn/voice.ogg')).toMatchObject({ state: 'cancelled' })
  })

  it('delegates an explicit shared cancellation to the transport once', async () => {
    const transport = useTransport((request) => untilAborted(request))
    const request = {
      key: 'file:https://cdn/file.pdf',
      attachment: attachmentOf('https://cdn/file.pdf', { id: 'file-id' }),
      url: 'https://cdn/file.pdf',
      cacheKey: 'https://cdn/file.pdf',
      kind: 'file' as const
    }
    const first = requestMediaDownload(request)
    const second = requestMediaDownload(request)
    await flushCoordinator()

    cancelMediaDownload(request.key)
    cancelMediaDownload(request.key)

    await expect(first).rejects.toMatchObject({ name: 'AbortError' })
    await expect(second).rejects.toMatchObject({ name: 'AbortError' })
    expect(transport.download).toHaveBeenCalledTimes(1)
    expect(transport.download.mock.calls[0][0].signal.aborted).toBe(true)
    expect(transport.cancel).toHaveBeenCalledTimes(1)
    expect(transport.cancel).toHaveBeenCalledWith('download:file:https://cdn/file.pdf')
  })

  it('keeps the Download state when a transport reports DOWNLOAD_CANCELLED as a normal Error', async () => {
    const transport = useTransport(async (request) => {
      await untilAborted(request)
      return FileTransferResult.failure(new Error('DOWNLOAD_CANCELLED'))
    })
    const key = 'original-video:https://cdn/custom-cancelled.mp4'
    const download = requestMediaDownload({
      key,
      attachment: attachmentOf('https://cdn/custom-cancelled.mp4'),
      url: 'https://cdn/custom-cancelled.mp4',
      cacheKey: 'https://cdn/custom-cancelled.mp4_original_video_url',
      kind: 'original-video'
    })
    await flushCoordinator()

    cancelMediaDownload(key)

    await expect(download).rejects.toThrow('DOWNLOAD_CANCELLED')
    expect(transport.cancel).toHaveBeenCalledTimes(1)
    expect(getMediaDownloadSnapshot(key)).toMatchObject({ state: 'cancelled' })
  })

  it('cancels before the transport starts', async () => {
    const transport = useTransport()

    const request = requestMediaDownload({
      key: 'file:https://cdn/file.pdf',
      attachment: attachmentOf('https://cdn/file.pdf'),
      url: 'https://cdn/file.pdf',
      cacheKey: 'https://cdn/file.pdf',
      kind: 'file'
    })
    cancelMediaDownload('file:https://cdn/file.pdf')

    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
    expect(transport.download).not.toHaveBeenCalled()
  })

  it('allows an immediate retry while a cancelled transport download is still settling', async () => {
    let finishFirst: (result: FileTransferResult<Blob>) => void = () => undefined
    const transport = useTransport()
    transport.download
      .mockImplementationOnce(
        () =>
          new Promise<FileTransferResult<Blob>>((resolve) => {
            finishFirst = resolve
          })
      )
      .mockImplementationOnce(async () =>
        FileTransferResult.success(new Blob(['retried video'], { type: 'video/mp4' }))
      )
    const request = {
      key: 'original-video:https://cdn/retry.mp4',
      attachment: attachmentOf('https://cdn/retry.mp4'),
      url: 'https://cdn/retry.mp4',
      cacheKey: 'https://cdn/retry.mp4_original_video_url',
      kind: 'original-video' as const
    }

    const first = requestMediaDownload(request)
    await flushCoordinator()
    cancelMediaDownload(request.key)

    const retry = requestMediaDownload(request)
    await flushCoordinator()
    expect(transport.download).toHaveBeenCalledTimes(2)

    finishFirst(FileTransferResult.interrupted(abortError()))

    await expect(first).rejects.toMatchObject({ name: 'AbortError' })
    await expect(retry).resolves.toMatchObject({ objectUrl: 'blob:shared-media' })
    expect(getMediaDownloadSnapshot(request.key)).toMatchObject({ state: 'completed' })
  })

  it('falls back to downloading after a cache read failure and retries after a failed transfer', async () => {
    mockGetAttachmentUrlFromCache.mockRejectedValue(new Error('Cache unavailable'))
    const transport = useTransport()
    transport.download
      .mockImplementationOnce(async () => FileTransferResult.failure(new Error('Network unavailable')))
      .mockImplementationOnce(async () => FileTransferResult.success(new Blob(['file'])))

    const request = {
      key: 'file:https://cdn/file.pdf',
      attachment: attachmentOf('https://cdn/file.pdf'),
      url: 'https://cdn/file.pdf',
      cacheKey: 'https://cdn/file.pdf',
      kind: 'file' as const
    }
    await expect(requestMediaDownload(request)).rejects.toThrow('Network unavailable')
    expect(getMediaDownloadSnapshot(request.key)).toMatchObject({ state: 'failed' })

    await expect(requestMediaDownload(request)).resolves.toMatchObject({ objectUrl: 'blob:shared-media' })
    expect(transport.download).toHaveBeenCalledTimes(2)
    expect(getMediaDownloadSnapshot(request.key)).toMatchObject({ state: 'completed' })
  })

  it('continues an active transfer after its last subscriber unsubscribes', async () => {
    const { finish } = usePendingTransport()
    const key = 'original-video:https://cdn/video.mp4'
    const unsubscribe = subscribeToMediaDownload(key, jest.fn())
    const request = requestMediaDownload({
      key,
      attachment: attachmentOf('https://cdn/video.mp4'),
      url: 'https://cdn/video.mp4',
      cacheKey: 'https://cdn/video.mp4_original_video_url',
      kind: 'original-video'
    })
    await flushCoordinator()
    unsubscribe()
    finish(FileTransferResult.success(new Blob(['video'])))

    await expect(request).resolves.toMatchObject({ objectUrl: 'blob:shared-media' })
    expect(getMediaDownloadSnapshot(key)).toMatchObject({ state: 'completed' })
  })

  describe('an encrypted attachment', () => {
    const request = {
      key: 'original-image:https://cdn/photo',
      // The attachment size is the plaintext's: 'pixels'.
      attachment: attachmentOf('https://cdn/photo', { id: 'photo-id', size: 6 }),
      url: 'https://cdn/photo',
      cacheKey: 'https://cdn/photo',
      kind: 'original-image' as const,
      encryption: fakeEncryptionInfo('key-3'),
      contentType: 'image/png'
    }
    const storedFile = (blob: Blob) =>
      jest.fn().mockResolvedValue({ ok: true, blob: async () => blob }) as unknown as typeof fetch

    it('is given to the transport with what opens it and its trusted size', async () => {
      const transport = useTransport(async () =>
        FileTransferResult.success(new Blob(['pixels'], { type: 'image/png' }))
      )

      const { blob } = await requestMediaDownload(request)

      expect(transport.download.mock.calls[0][0]).toMatchObject({
        operationId: 'download:original-image:https://cdn/photo',
        encryptionInfo: fakeEncryptionInfo('key-3'),
        plaintextSize: 6,
        mimeType: 'image/png'
      })
      expect(await readBlobText(blob)).toBe('pixels')
      expect(setAttachmentToCache).toHaveBeenCalledWith('https://cdn/photo', expect.anything())
    })

    it('is decrypted before it is cached and shown when the default transport downloads it', async () => {
      global.fetch = storedFile(fakeEncrypted('key-3', 'pixels'))

      const { blob } = await requestMediaDownload(request)

      expect(global.fetch).toHaveBeenCalledWith('https://cdn/photo', expect.anything())
      expect(blob.type).toBe('image/png')
      expect(await readBlobText(blob)).toBe('pixels')
      expect(setAttachmentToCache).toHaveBeenCalledWith('https://cdn/photo', expect.anything())
    })

    it('that fails to decrypt is reported as failed, not shown', async () => {
      global.fetch = storedFile(fakeEncrypted('another-key', 'pixels'))

      await expect(requestMediaDownload(request)).rejects.toMatchObject({ type: 'Authentication' })
      expect(getMediaDownloadSnapshot(request.key)).toMatchObject({ state: 'failed' })
      expect(setAttachmentToCache).not.toHaveBeenCalled()
    })

    it('that fails to decrypt is not downloaded again when it is shown again', async () => {
      global.fetch = storedFile(fakeEncrypted('another-key', 'pixels'))
      await expect(requestMediaDownload(request)).rejects.toMatchObject({ type: 'Authentication' })

      await expect(requestMediaDownload(request)).rejects.toMatchObject({ type: 'Authentication' })

      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(getMediaDownloadSnapshot(request.key)).toMatchObject({ state: 'failed' })
    })

    it('whose encryption metadata is not valid is not downloaded again when it is shown again', async () => {
      global.fetch = storedFile(fakeEncrypted('key-3', 'pixels'))
      const invalid = { ...request, encryption: { ...fakeEncryptionInfo('key-3'), attachmentId: '' } }
      await expect(requestMediaDownload(invalid)).rejects.toMatchObject({ type: 'InvalidEncryption' })

      await expect(requestMediaDownload(invalid)).rejects.toMatchObject({ type: 'InvalidEncryption' })

      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(getMediaDownloadSnapshot(request.key)).toMatchObject({ state: 'failed' })
    })

    it('that failed to decrypt is downloaded again when the user retries', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({ ok: true, blob: async () => fakeEncrypted('another-key', 'pixels') })
        .mockResolvedValueOnce({ ok: true, blob: async () => fakeEncrypted('key-3', 'pixels') }) as any
      await expect(requestMediaDownload(request)).rejects.toMatchObject({ type: 'Authentication' })

      const { blob } = await requestMediaDownload({ ...request, retry: true })

      expect(global.fetch).toHaveBeenCalledTimes(2)
      expect(await readBlobText(blob)).toBe('pixels')
      expect(getMediaDownloadSnapshot(request.key)).toMatchObject({ state: 'completed' })
    })

    it('that failed to decrypt is downloaded again when its key changes', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({ ok: true, blob: async () => fakeEncrypted('another-key', 'pixels') })
        .mockResolvedValueOnce({ ok: true, blob: async () => fakeEncrypted('key-4', 'pixels') }) as any
      await expect(requestMediaDownload(request)).rejects.toMatchObject({ type: 'Authentication' })

      const { blob } = await requestMediaDownload({ ...request, encryption: fakeEncryptionInfo('key-4') })

      expect(global.fetch).toHaveBeenCalledTimes(2)
      expect(await readBlobText(blob)).toBe('pixels')
    })

    it('is cancelled at the transport', async () => {
      const transport = useTransport((downloadRequest) => untilAborted(downloadRequest))
      const download = requestMediaDownload(request)
      await flushCoordinator()

      cancelMediaDownload(request.key)

      await expect(download).rejects.toMatchObject({ name: 'AbortError' })
      expect(transport.cancel).toHaveBeenCalledWith('download:original-image:https://cdn/photo')
      expect(getMediaDownloadSnapshot(request.key)).toMatchObject({ state: 'cancelled' })
    })
  })

  it('a cancelled download that keeps running does not show as loading again', async () => {
    const { progress } = usePendingTransport()
    const key = 'original-video:https://cdn/still-running.mp4'
    requestMediaDownload({
      key,
      attachment: attachmentOf('https://cdn/still-running.mp4', { size: 1000 }),
      url: 'https://cdn/still-running.mp4',
      cacheKey: 'https://cdn/still-running.mp4_original_video_url',
      kind: 'original-video',
      size: 1000
    }).catch(() => undefined)
    await flushCoordinator()
    progress(30)
    expect(getMediaDownloadSnapshot(key)).toMatchObject({ state: 'loading', loaded: 300 })

    cancelMediaDownload(key)
    progress(60)

    expect(getMediaDownloadSnapshot(key)).toMatchObject({ state: 'cancelled' })
  })
})
