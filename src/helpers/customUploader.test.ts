import {
  cancelDownloadRequest,
  cancelUpload,
  customUpload,
  getAttachmentDownloader,
  isUploadNotStarted,
  isUploadPausedBeforeStart,
  markUploadNotStarted,
  pauseUpload,
  resumeUpload,
  setCustomUploader
} from './customUploader'
import { setEncryptAttachments } from './attachmentEncryption'
import { setClient } from '../common/client'
import { fakeEncrypted, installFakeFilesClient, readBlobText } from '../testUtils/fakeAttachmentFiles'

describe('a pause pressed before an upload starts', () => {
  let tasks: any[]
  let stopped: string[]

  // An uploader that, like the app's, installs its own stop() when upload() is called.
  const startUploader = () => {
    setCustomUploader({
      upload: (attachment: any, uploadTask: any) => {
        tasks.push(uploadTask)
        uploadTask.stop = () => {
          stopped.push(attachment.tid)
          return true
        }
        uploadTask.resume = () => true
      },
      download: jest.fn()
    })
  }
  const upload = (tid: string) => customUpload({ tid, name: 'clip.mp4' } as any, () => undefined, 'text')

  beforeEach(() => {
    tasks = []
    stopped = []
    startUploader()
  })

  it('is kept and stops the upload as soon as it starts', () => {
    markUploadNotStarted('video-1')

    expect(pauseUpload('video-1')).toBe(true)
    expect(isUploadPausedBeforeStart('video-1')).toBe(true)
    upload('video-1')

    expect(stopped).toEqual(['video-1'])
    expect(isUploadNotStarted('video-1')).toBe(false)
  })

  it('followed by a resume before the start, lets the upload start normally', () => {
    markUploadNotStarted('video-2')

    pauseUpload('video-2')
    expect(resumeUpload('video-2')).toBe(true)
    upload('video-2')

    expect(stopped).toEqual([])
    expect(tasks).toHaveLength(1)
  })

  it('is forgotten when the upload is cancelled first', () => {
    markUploadNotStarted('video-3')
    pauseUpload('video-3')

    cancelUpload('video-3')

    expect(isUploadNotStarted('video-3')).toBe(false)
    expect(pauseUpload('video-3')).toBe(false)
  })

  it('does nothing for an upload that is neither running nor about to start', () => {
    expect(pauseUpload('unknown')).toBe(false)
    expect(resumeUpload('unknown')).toBe(false)
  })

  it('once the upload runs, pause and resume reach it', () => {
    upload('file-1')

    expect(pauseUpload('file-1')).toBe(true)
    expect(resumeUpload('file-1')).toBe(true)
    expect(stopped).toEqual(['file-1'])
  })
})

describe('encryptAttachments: uploading', () => {
  let calls: { attachment: any; task: any; args: any[] }[]
  const file = () => new File(['hello'], 'photo.png', { type: 'image/png' })

  const useUploader = (supportsEncryption?: boolean) => {
    setCustomUploader({
      supportsEncryption,
      upload: (attachment: any, task: any, ...rest: any[]) => {
        calls.push({ attachment, task, args: rest })
        task.stop = () => true
      },
      download: jest.fn()
    })
  }
  beforeEach(() => {
    calls = []
    installFakeFilesClient()
    setEncryptAttachments(true)
  })

  afterEach(() => setEncryptAttachments(false))

  it('when it is off, the uploader gets the file as before and no key is returned', async () => {
    setEncryptAttachments(false)
    useUploader()
    const source = file()
    const result = customUpload({ tid: 'plain', name: 'photo.png', data: source } as any, () => undefined, 'text')

    expect(calls).toHaveLength(1)
    // Files are compared by identity: a failing diff of a File crashes the jest worker.
    expect(calls[0].attachment.data === source).toBe(true)
    expect(calls[0].args).toEqual(['text'])
    calls[0].task.success({ uri: 'https://cdn/plain', blob: source })
    const { uri, blob, ...rest } = await result
    expect(uri).toBe('https://cdn/plain')
    expect(blob === source).toBe(true)
    expect(rest).toEqual({})
  })

  it('an uploader without supportsEncryption would store the file unencrypted, so nothing is sent', async () => {
    useUploader()
    markUploadNotStarted('simple')
    const source = file()
    const result = customUpload(
      { tid: 'simple', name: 'photo.png', data: source, url: source } as any,
      () => undefined,
      'text'
    )

    await expect(result).rejects.toThrow('supportsEncryption')
    expect(calls).toHaveLength(0)
    expect(isUploadNotStarted('simple')).toBe(false)
  })

  // What an uploader with supportsEncryption does (like Waafi's): it may
  // resize the file, then prepares it and stores what prepareFile returns.
  const storePrepared = async (call: { task: any; args: any[] }, file: Blob, uri: string) => {
    const prepared = await call.args[1].prepareFile(file)
    const stored = await prepared.getAll()
    call.task.success({ uri, blob: file })
    return { prepared, stored }
  }

  it('an uploader with supportsEncryption prepares and stores its own file, and its key goes to the message', async () => {
    useUploader(true)
    const source = file()
    const result = customUpload({ tid: 'streaming', name: 'photo.png', data: source } as any, () => undefined, 'text')

    // It starts at once, with the plaintext file to resize.
    expect(calls).toHaveLength(1)
    expect(calls[0].attachment.data === source).toBe(true)
    expect(calls[0].args[0]).toBe('text')
    const resized = new Blob(['resized'], { type: 'image/png' })
    const { prepared, stored } = await storePrepared(calls[0], resized, 'https://cdn/streaming')

    expect(prepared.contentType).toBe('application/octet-stream')
    expect(await readBlobText(stored)).toBe('enc(key-1@id-1):resized')
    const uploaded = await result
    expect(uploaded.uri).toBe('https://cdn/streaming')
    expect(uploaded.blob === resized).toBe(true)
    expect(uploaded.encryption).toEqual({ id: 'id-1', v: 1, k: 'key-1' })
  })

  it('a prepared file may be stored at any URL: it is bound to its unique id, not to where it is stored', async () => {
    useUploader(true)
    const result = customUpload({ tid: 'anywhere', name: 'photo.png', data: file() } as any, () => undefined, 'text')

    await calls[0].args[1].prepareFile(file())
    calls[0].task.success({ uri: 'https://cdn/picked-after-preparing', blob: file() })

    expect(await result).toMatchObject({ uri: 'https://cdn/picked-after-preparing', encryption: { id: 'id-1' } })
  })

  it('with encryption off, an uploader with supportsEncryption prepares the file the same way, unencrypted', async () => {
    setEncryptAttachments(false)
    useUploader(true)
    const source = file()
    const result = customUpload(
      { tid: 'plain-streaming', name: 'photo.png', data: source } as any,
      () => undefined,
      'text'
    )

    const { prepared, stored } = await storePrepared(calls[0], source, 'https://cdn/plain')

    expect(prepared.contentType).toBe('image/png')
    expect(stored === source).toBe(true)
    expect((await result).encryption).toBeUndefined()
  })

  it('with encryption off and an older SDK, an uploader with supportsEncryption is called as before', async () => {
    setEncryptAttachments(false)
    setClient({})
    useUploader(true)
    customUpload({ tid: 'old-sdk', name: 'photo.png', data: file() } as any, () => undefined, 'text')

    expect(calls[0].args).toEqual(['text'])
  })

  it('the message describes the last file prepared', async () => {
    useUploader(true)
    const result = customUpload(
      { tid: 'prepared-twice', name: 'photo.png', data: file() } as any,
      () => undefined,
      'text'
    )

    await calls[0].args[1].prepareFile(file())
    await storePrepared(calls[0], file(), 'https://cdn/second')

    expect((await result).encryption).toEqual(expect.objectContaining({ k: 'key-2' }))
  })

  it('every file is encrypted with its own key', async () => {
    useUploader(true)
    const first = customUpload({ tid: 'first', name: 'a.png', data: file() } as any, () => undefined, 'text')
    const second = customUpload({ tid: 'second', name: 'b.png', data: file() } as any, () => undefined, 'text')
    await Promise.all(calls.map((call, i) => storePrepared(call, file(), `https://cdn/${i}`)))

    expect([(await first).encryption!.k, (await second).encryption!.k].sort()).toEqual(['key-1', 'key-2'])
  })

  it('a file stored without prepareFile is not sent: it may be plaintext', async () => {
    useUploader(true)
    const result = customUpload({ tid: 'unprepared', name: 'photo.png', data: file() } as any, () => undefined, 'text')

    calls[0].task.success({ uri: 'https://cdn/unprepared', blob: file() })

    await expect(result).rejects.toThrow('not prepared with prepareFile')
  })

  it('an uploader with supportsEncryption and an SDK that cannot prepare files fails before anything is sent', async () => {
    useUploader(true)
    setClient({})
    const result = customUpload({ tid: 'no-prepare', name: 'photo.png', data: file() } as any, () => undefined, 'text')

    await expect(result).rejects.toThrow('client.prepareUpload')
    expect(calls).toHaveLength(0)
  })
})

describe('encryptAttachments: downloading', () => {
  const encryption = { id: 'id-7', v: 1, k: 'key-7' }
  const originalFetch = global.fetch
  const originalCreateObjectURL = URL.createObjectURL

  beforeEach(() => {
    installFakeFilesClient()
  })

  afterEach(() => {
    global.fetch = originalFetch
    URL.createObjectURL = originalCreateObjectURL
  })

  it('an unencrypted file uses the uploader own downloader', () => {
    const download = jest.fn()
    setCustomUploader({ upload: jest.fn(), download, cancelRequest: jest.fn() })
    expect(getAttachmentDownloader(undefined, 'image/png')).toBe(download)
  })

  it('with an older SDK, an unencrypted file uses the downloader of an uploader with supportsEncryption as before', () => {
    const download = jest.fn()
    setClient({})
    setCustomUploader({ supportsEncryption: true, upload: jest.fn(), download, cancelRequest: jest.fn() })
    expect(getAttachmentDownloader(undefined, 'image/png')).toBe(download)
  })

  it('without a custom uploader there is no downloader', () => {
    setCustomUploader(undefined)
    expect(getAttachmentDownloader(encryption, 'image/png')).toBeUndefined()
  })

  it('decrypts a { Body } result and keeps its other fields', async () => {
    const download = jest.fn(async () => ({ Body: fakeEncrypted('key-7', 'picture'), ETag: 'e1' }))
    setCustomUploader({ upload: jest.fn(), download, cancelRequest: jest.fn() })

    const result = await getAttachmentDownloader(encryption, 'image/png')!(
      'https://cdn/p',
      true,
      jest.fn(),
      'text',
      'm1'
    )

    expect(download).toHaveBeenCalledWith('https://cdn/p', true, expect.any(Function), 'text', 'm1')
    expect(result.ETag).toBe('e1')
    expect(result.Body.type).toBe('image/png')
    expect(await readBlobText(result.Body)).toBe('picture')
  })

  it('decrypts a Blob result', async () => {
    setCustomUploader({
      upload: jest.fn(),
      download: async () => fakeEncrypted('key-7', 'voice'),
      cancelRequest: jest.fn()
    })

    const result = await getAttachmentDownloader(encryption, 'audio/mpeg')!('https://cdn/v', true, jest.fn(), 'text')

    expect(result.type).toBe('audio/mpeg')
    expect(await readBlobText(result)).toBe('voice')
  })

  it('fetches and decrypts a URL result, and returns a URL of the plaintext', async () => {
    setCustomUploader({ upload: jest.fn(), download: async () => 'https://signed/url', cancelRequest: jest.fn() })
    global.fetch = jest.fn(async () => ({
      ok: true,
      blob: async () => fakeEncrypted('key-7', 'document')
    })) as any
    let plaintext: Blob | undefined
    URL.createObjectURL = jest.fn((blob: Blob) => {
      plaintext = blob
      return 'blob:plaintext'
    })

    const result = await getAttachmentDownloader(encryption, 'application/pdf')!(
      'https://cdn/d',
      false,
      jest.fn(),
      'text'
    )

    expect(global.fetch).toHaveBeenCalledWith('https://signed/url')
    expect(result).toBe('blob:plaintext')
    expect(await readBlobText(plaintext!)).toBe('document')
  })

  it.each([
    ['an encrypted', encryption, 'enc(key-7@id-7):picture', true],
    ['an unencrypted', undefined, 'picture', false]
  ])(
    'an uploader with supportsEncryption is given %s stored file to open itself',
    async (_name, enc, storedText, isEncrypted) => {
      // Like Waafi's: it downloads the stored bytes, then returns file.open() of them.
      const download = jest.fn(async (...args: any[]) => ({
        Body: await args[5].file.open(new Blob([storedText], { type: 'application/octet-stream' }))
      }))
      setCustomUploader({ supportsEncryption: true, upload: jest.fn(), download, cancelRequest: jest.fn() })

      const result = await getAttachmentDownloader(enc, 'image/png')!('https://cdn/p', true, jest.fn(), 'text', 'm1')

      const args: any[] = download.mock.calls[0]
      expect(args.slice(0, 5)).toEqual(['https://cdn/p', true, expect.any(Function), 'text', 'm1'])
      expect(args[5].file.isEncrypted).toBe(isEncrypted)
      expect(args[5].file.type).toBe('image/png')
      expect(result.Body.type).toBe('image/png')
      expect(await readBlobText(result.Body)).toBe('picture')
    }
  )

  it('an uploader with supportsEncryption gets its own request back, so it can cancel it', () => {
    const request = new Promise(() => undefined)
    const cancelRequest = jest.fn()
    setCustomUploader({ supportsEncryption: true, upload: jest.fn(), download: () => request, cancelRequest })

    const returned = getAttachmentDownloader(encryption, 'video/mp4')!('https://cdn/v', true, jest.fn(), 'text', 'm1')
    cancelDownloadRequest(returned)

    expect(returned === request).toBe(true)
    expect(cancelRequest.mock.calls[0][0] === request).toBe(true)
  })

  it('cancelling a download the uikit decrypts cancels the uploader own request', () => {
    const request = new Promise(() => undefined)
    const cancelRequest = jest.fn()
    setCustomUploader({ upload: jest.fn(), download: () => request, cancelRequest })

    cancelDownloadRequest(getAttachmentDownloader(encryption, 'video/mp4')!('https://cdn/v', true, jest.fn(), 'text'))

    // The same promise object, not just an equal one: toHaveBeenCalledWith finds any two promises equal.
    expect(cancelRequest.mock.calls[0][0] === request).toBe(true)
  })

  it('a request from the uploader own downloader is cancelled as it is', () => {
    const request = Promise.resolve('https://signed/url')
    const cancelRequest = jest.fn()
    setCustomUploader({ upload: jest.fn(), download: jest.fn(), cancelRequest })

    cancelDownloadRequest(request)

    expect(cancelRequest.mock.calls[0][0] === request).toBe(true)
  })

  it('metadata that cannot be opened rejects without downloading', async () => {
    const download = jest.fn()
    setCustomUploader({ supportsEncryption: true, upload: jest.fn(), download, cancelRequest: jest.fn() })
    setClient({
      prepareUpload: jest.fn(),
      prepareDownload: () => {
        throw Object.assign(new Error('bad enc'), { type: 'InvalidAttachmentEncryption' })
      }
    })

    await expect(
      getAttachmentDownloader(encryption, 'image/png')!('https://cdn/p', true, jest.fn(), 'text')
    ).rejects.toMatchObject({ type: 'InvalidAttachmentEncryption' })
    expect(download).not.toHaveBeenCalled()
  })

  it('a file encrypted with another key is refused', async () => {
    setCustomUploader({
      upload: jest.fn(),
      download: async () => ({ Body: fakeEncrypted('other-key', 'x') }),
      cancelRequest: jest.fn()
    })

    await expect(
      getAttachmentDownloader(encryption, 'image/png')!('https://cdn/p', true, jest.fn(), 'text')
    ).rejects.toMatchObject({
      type: 'AttachmentDecryptionFailed'
    })
  })

  it('a file encrypted with another unique id is refused', async () => {
    setCustomUploader({
      upload: jest.fn(),
      download: async () => ({ Body: fakeEncrypted('key-7', 'x') }),
      cancelRequest: jest.fn()
    })

    await expect(
      getAttachmentDownloader({ ...encryption, id: 'another-id' }, 'image/png')!(
        'https://cdn/p',
        true,
        jest.fn(),
        'text'
      )
    ).rejects.toMatchObject({ type: 'AttachmentDecryptionFailed' })
  })
})
