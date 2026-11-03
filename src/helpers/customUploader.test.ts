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
  sdkUpload,
  setCustomUploader
} from './customUploader'
import { setEncryptAttachments } from './attachmentEncryption'
import { getClient, setClient } from '../common/client'
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

  const useUploader = (preparesFiles?: boolean) => {
    setCustomUploader({
      preparesFiles,
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

  it('when it is off, the uploader is asked not to encrypt and no key is returned', async () => {
    setEncryptAttachments(false)
    useUploader()
    const source = file()
    const result = customUpload({ tid: 'plain', name: 'photo.png', data: source } as any, () => undefined, 'text')

    expect(calls).toHaveLength(1)
    // Files are compared by identity: a failing diff of a File crashes the jest worker.
    expect(calls[0].attachment.data === source).toBe(true)
    expect(calls[0].args).toEqual(['text', { encrypt: false }])
    calls[0].task.success({ uri: 'https://cdn/plain', blob: source })
    const { uri, blob, ...rest } = await result
    expect(uri).toBe('https://cdn/plain')
    expect(blob === source).toBe(true)
    expect(rest).toEqual({})
  })

  it('without a custom uploader, nothing is uploaded', async () => {
    setCustomUploader(undefined)

    await expect(
      customUpload({ tid: 'no-uploader', name: 'photo.png', data: file() } as any, () => undefined, 'text')
    ).rejects.toThrow('No Custom uploader')
  })

  it('an uploader without preparesFiles would store the file unencrypted, so nothing is sent', async () => {
    useUploader()
    markUploadNotStarted('simple')
    const source = file()
    const result = customUpload(
      { tid: 'simple', name: 'photo.png', data: source, url: source } as any,
      () => undefined,
      'text'
    )

    await expect(result).rejects.toThrow('preparesFiles')
    expect(calls).toHaveLength(0)
    expect(isUploadNotStarted('simple')).toBe(false)
  })

  // What an uploader with preparesFiles does (like Waafi's): it may resize the
  // file, prepares it with the chat client as its options say, stores it and
  // reports the prepared file's encryption.
  const storePrepared = async (call: { task: any; args: any[] }, file: Blob, uri: string) => {
    const prepared = await getClient().prepareUpload(file, { encrypt: call.args[1].encrypt })
    const stored = await prepared.getAll()
    call.task.success({ uri, blob: file, encryption: prepared.encryption })
    return { prepared, stored }
  }

  it('an uploader with preparesFiles is asked to encrypt, stores the file it prepares, and its key goes to the message', async () => {
    useUploader(true)
    const source = file()
    const result = customUpload({ tid: 'streaming', name: 'photo.png', data: source } as any, () => undefined, 'text')

    // It starts at once, with the plaintext file to resize.
    expect(calls).toHaveLength(1)
    expect(calls[0].attachment.data === source).toBe(true)
    expect(calls[0].args).toEqual(['text', { encrypt: true }])
    const resized = new Blob(['resized'], { type: 'image/png' })
    const { prepared, stored } = await storePrepared(calls[0], resized, 'https://cdn/streaming')

    expect(prepared.contentType).toBe('application/octet-stream')
    expect(await readBlobText(stored)).toBe('enc(key-1@id-1):resized')
    const uploaded = await result
    expect(uploaded.uri).toBe('https://cdn/streaming')
    expect(uploaded.blob === resized).toBe(true)
    expect(uploaded.encryption).toEqual({
      v: 1,
      alg: 'tink-aes256-gcm-hkdf-64k+commit-v1',
      attachmentId: 'id-1',
      key: 'key-1'
    })
  })

  it('with encryption off, an uploader with preparesFiles stores the file unencrypted', async () => {
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

  it('an encryption the uploader reports goes to the message even with encryption off: the file opens only with it', async () => {
    setEncryptAttachments(false)
    useUploader(true)
    const result = customUpload(
      { tid: 'encrypted-anyway', name: 'photo.png', data: file() } as any,
      () => undefined,
      'text'
    )

    const encryption = { v: 1, alg: 'tink-aes256-gcm-hkdf-64k+commit-v1', attachmentId: 'id-9', key: 'key-9' }
    calls[0].task.success({ uri: 'https://cdn/encrypted-anyway', blob: file(), encryption })

    expect((await result).encryption).toEqual(encryption)
  })

  it('with encryption off and an older SDK, an uploader with preparesFiles uploads as usual', async () => {
    setEncryptAttachments(false)
    setClient({})
    useUploader(true)
    customUpload({ tid: 'old-sdk', name: 'photo.png', data: file() } as any, () => undefined, 'text')

    expect(calls[0].args).toEqual(['text', { encrypt: false }])
  })

  it('every file is encrypted with its own key', async () => {
    useUploader(true)
    const first = customUpload({ tid: 'first', name: 'a.png', data: file() } as any, () => undefined, 'text')
    const second = customUpload({ tid: 'second', name: 'b.png', data: file() } as any, () => undefined, 'text')
    await Promise.all(calls.map((call, i) => storePrepared(call, file(), `https://cdn/${i}`)))

    expect([(await first).encryption!.key, (await second).encryption!.key].sort()).toEqual(['key-1', 'key-2'])
  })

  it('a file stored without reporting its encryption is not sent: it may be plaintext', async () => {
    useUploader(true)
    const result = customUpload({ tid: 'unprepared', name: 'photo.png', data: file() } as any, () => undefined, 'text')

    calls[0].task.success({ uri: 'https://cdn/unprepared', blob: file() })

    await expect(result).rejects.toThrow('without reporting its encryption')
  })

  it('an uploader with preparesFiles and an SDK that cannot prepare files fails before anything is sent', async () => {
    useUploader(true)
    setClient({})
    const result = customUpload({ tid: 'no-prepare', name: 'photo.png', data: file() } as any, () => undefined, 'text')

    await expect(result).rejects.toThrow('client.prepareUpload')
    expect(calls).toHaveLength(0)
  })
})

describe('encryptAttachments: downloading', () => {
  const encryption = { v: 1, alg: 'tink-aes256-gcm-hkdf-64k+commit-v1', attachmentId: 'id-7', key: 'key-7' }
  // The attachment the downloaded file belongs to; the uploader gets it whole.
  const photo = { id: 'a1', messageId: 'm1', url: 'https://cdn/p', name: 'photo.png', metadata: '{}' } as any
  const originalFetch = global.fetch
  const originalCreateObjectURL = URL.createObjectURL

  beforeEach(() => {
    installFakeFilesClient()
  })

  afterEach(() => {
    global.fetch = originalFetch
    URL.createObjectURL = originalCreateObjectURL
  })

  it('an unencrypted file is downloaded by the uploader, given the whole attachment and which file to download', () => {
    const request = Promise.resolve({ Body: new Blob(['picture']) })
    const download = jest.fn(() => request)
    setCustomUploader({ upload: jest.fn(), download, cancelRequest: jest.fn() })

    const returned = getAttachmentDownloader(photo, 'file', undefined, 'image/png')!(
      'https://cdn/p',
      true,
      jest.fn(),
      'text'
    )

    // Its own request comes back, so its cancelRequest finds it.
    expect(returned === request).toBe(true)
    const args: any[] = download.mock.calls[0]
    expect(args[0] === photo).toBe(true)
    expect(args.slice(1)).toEqual([
      true,
      expect.any(Function),
      'text',
      { kind: 'file', url: 'https://cdn/p', type: 'image/png' }
    ])
  })

  it('a video preview is downloaded as the video attachment thumbnail, from its own URL', () => {
    const download = jest.fn(() => new Promise(() => undefined))
    setCustomUploader({ upload: jest.fn(), download, cancelRequest: jest.fn() })
    const video = { ...photo, url: 'https://cdn/clip.mp4', name: 'clip.mp4' }

    getAttachmentDownloader(video, 'thumbnail', undefined, 'image/jpeg')!(
      'https://cdn/clip-preview.jpg',
      true,
      jest.fn()
    )

    const args: any[] = download.mock.calls[0]
    expect(args[0] === video).toBe(true)
    expect(args[4]).toEqual({ kind: 'thumbnail', url: 'https://cdn/clip-preview.jpg', type: 'image/jpeg' })
  })

  it('with an older SDK, an uploader with preparesFiles gets no encryption: the uikit does not open files', () => {
    const download = jest.fn(() => new Promise(() => undefined))
    setClient({})
    setCustomUploader({ preparesFiles: true, upload: jest.fn(), download, cancelRequest: jest.fn() })

    getAttachmentDownloader(photo, 'file', undefined, 'image/png')!('https://cdn/p', true, jest.fn(), 'text')

    expect((download.mock.calls[0] as any[])[4]).toEqual({ kind: 'file', url: 'https://cdn/p', type: 'image/png' })
  })

  it('without a custom uploader there is no downloader', () => {
    setCustomUploader(undefined)
    expect(getAttachmentDownloader(photo, 'file', encryption, 'image/png')).toBeUndefined()
  })

  it('decrypts a { Body } result and keeps its other fields', async () => {
    const download = jest.fn(async () => ({ Body: fakeEncrypted('key-7', 'picture'), ETag: 'e1' }))
    setCustomUploader({ upload: jest.fn(), download, cancelRequest: jest.fn() })

    const result = await getAttachmentDownloader(photo, 'file', encryption, 'image/png')!(
      'https://cdn/p',
      true,
      jest.fn(),
      'text'
    )

    expect(download).toHaveBeenCalledWith(photo, true, expect.any(Function), 'text', {
      kind: 'file',
      url: 'https://cdn/p',
      type: 'image/png'
    })
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

    const result = await getAttachmentDownloader(photo, 'file', encryption, 'audio/mpeg')!(
      'https://cdn/v',
      true,
      jest.fn(),
      'text'
    )

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

    const result = await getAttachmentDownloader(photo, 'file', encryption, 'application/pdf')!(
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
    ['an encrypted', encryption, 'enc(key-7@id-7):picture'],
    ['an unencrypted', undefined, 'picture']
  ])(
    'an uploader with preparesFiles is given the encryption of %s file and opens it itself',
    async (_name, enc, storedText) => {
      // Like Waafi's: it downloads the stored bytes and opens them with the chat client.
      const download = jest.fn(async (...args: any[]) => ({
        Body: await getClient()
          .prepareDownload({ metadata: args[4].encryption ? { enc: args[4].encryption } : {}, type: args[4].type })
          .open(new Blob([storedText], { type: 'application/octet-stream' }))
      }))
      setCustomUploader({ preparesFiles: true, upload: jest.fn(), download, cancelRequest: jest.fn() })

      const result = await getAttachmentDownloader(photo, 'file', enc, 'image/png')!(
        'https://cdn/p',
        true,
        jest.fn(),
        'text'
      )

      const args: any[] = download.mock.calls[0]
      expect(args[0] === photo).toBe(true)
      expect(args.slice(1, 4)).toEqual([true, expect.any(Function), 'text'])
      expect(args[4]).toEqual({ kind: 'file', url: 'https://cdn/p', encryption: enc, type: 'image/png' })
      expect(result.Body.type).toBe('image/png')
      expect(await readBlobText(result.Body)).toBe('picture')
    }
  )

  it('an uploader with preparesFiles gets its own request back, so it can cancel it', () => {
    const request = new Promise(() => undefined)
    const cancelRequest = jest.fn()
    setCustomUploader({ preparesFiles: true, upload: jest.fn(), download: () => request, cancelRequest })

    const returned = getAttachmentDownloader(photo, 'file', encryption, 'video/mp4')!(
      'https://cdn/v',
      true,
      jest.fn(),
      'text'
    )
    cancelDownloadRequest(returned)

    expect(returned === request).toBe(true)
    expect(cancelRequest.mock.calls[0][0] === request).toBe(true)
  })

  it('cancelling a download the uikit decrypts cancels the uploader own request', () => {
    const request = new Promise(() => undefined)
    const cancelRequest = jest.fn()
    setCustomUploader({ upload: jest.fn(), download: () => request, cancelRequest })

    cancelDownloadRequest(
      getAttachmentDownloader(photo, 'file', encryption, 'video/mp4')!('https://cdn/v', true, jest.fn(), 'text')
    )

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

  it.each([
    ['with preparesFiles', true],
    ['without preparesFiles', false]
  ])('metadata that cannot be opened rejects without downloading, %s', async (_name, preparesFiles) => {
    const download = jest.fn()
    setCustomUploader({ preparesFiles, upload: jest.fn(), download, cancelRequest: jest.fn() })
    setClient({
      prepareUpload: jest.fn(),
      prepareDownload: () => {
        throw Object.assign(new Error('bad enc'), { type: 'InvalidAttachmentEncryption' })
      }
    })

    await expect(
      getAttachmentDownloader(photo, 'file', encryption, 'image/png')!('https://cdn/p', true, jest.fn(), 'text')
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
      getAttachmentDownloader(photo, 'file', encryption, 'image/png')!('https://cdn/p', true, jest.fn(), 'text')
    ).rejects.toMatchObject({
      type: 'AttachmentDecryptionFailed'
    })
  })

  it('a file encrypted with another attachment id is refused', async () => {
    setCustomUploader({
      upload: jest.fn(),
      download: async () => ({ Body: fakeEncrypted('key-7', 'x') }),
      cancelRequest: jest.fn()
    })

    await expect(
      getAttachmentDownloader(photo, 'file', { ...encryption, attachmentId: 'another-id' }, 'image/png')!(
        'https://cdn/p',
        true,
        jest.fn(),
        'text'
      )
    ).rejects.toMatchObject({ type: 'AttachmentDecryptionFailed' })
  })
})

describe('sdkUpload: one attachment uploaded with client.upload', () => {
  interface ISdkUpload {
    file: Blob
    options: any
    finish: (result: any) => void
    fail: (error: any) => void
  }
  let uploads: ISdkUpload[]

  // A client whose upload() waits until the test finishes it, and rejects with
  // an AbortError when its signal aborts, as the SDK does.
  beforeEach(() => {
    uploads = []
    setClient({
      upload: (file: Blob, options: any) =>
        new Promise((resolve, reject) => {
          uploads.push({ file, options, finish: resolve, fail: reject })
          options.signal.addEventListener('abort', () =>
            reject(Object.assign(new Error('cancelled'), { name: 'AbortError' }))
          )
        })
    })
  })
  afterEach(() => {
    setEncryptAttachments(false)
    setClient({})
  })

  const fileOf = (text: string) => new File([text], 'report.txt', { type: 'text/plain' })
  const attachment = (tid: string, file: Blob = fileOf('hello')) => ({ tid, name: 'report.txt', url: file }) as any
  const settled = (promise: Promise<any>) => {
    const state = { value: 'pending' as string }
    promise.then(
      () => (state.value = 'resolved'),
      () => (state.value = 'rejected')
    )
    return state
  }
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

  it('uploads the file and gives back its URL and the file as the user sees it', async () => {
    const file = fileOf('hello')

    const uploading = sdkUpload(attachment('sdk-1', file), () => undefined)
    expect(uploads).toHaveLength(1)
    expect(uploads[0].file === file).toBe(true)
    expect(uploads[0].options.encrypt).toBe(false)
    uploads[0].finish({ url: 'https://cdn.example/1', size: 5 })

    const uploaded = await uploading
    expect(uploaded.uri).toBe('https://cdn.example/1')
    expect(uploaded.blob === file).toBe(true)
  })

  it('with encryptAttachments, asks the SDK to encrypt and gives back the encryption for the metadata', async () => {
    setEncryptAttachments(true)
    const file = fileOf('secret')
    const encryption = { v: 1, alg: 'x', attachmentId: 'id', key: 'k' }

    const uploading = sdkUpload(attachment('sdk-2', file), () => undefined)
    expect(uploads[0].options.encrypt).toBe(true)
    uploads[0].finish({ url: 'https://cdn.example/2', size: 6, encryption })

    const uploaded = await uploading
    expect(uploaded.blob === file).toBe(true)
    expect(uploaded.encryption).toEqual(encryption)
  })

  it('each attachment is its own upload: stopping one leaves the others going', async () => {
    const first = sdkUpload(attachment('sdk-3a'), () => undefined)
    const second = sdkUpload(attachment('sdk-3b'), () => undefined)

    expect(pauseUpload('sdk-3a')).toBe(true)
    expect(uploads[0].options.signal.aborted).toBe(true)
    expect(uploads[1].options.signal.aborted).toBe(false)
    uploads[1].finish({ url: 'https://cdn.example/3b', size: 5 })

    await expect(second).resolves.toMatchObject({ uri: 'https://cdn.example/3b' })
    await flush()
    expect(settled(first).value).toBe('pending')
  })

  it('a stopped upload waits for resume, then sends the file again and finishes', async () => {
    const uploading = sdkUpload(attachment('sdk-4'), () => undefined)
    const state = settled(uploading)

    pauseUpload('sdk-4')
    await flush()
    expect(state.value).toBe('pending')
    expect(uploads).toHaveLength(1)

    expect(resumeUpload('sdk-4')).toBe(true)
    expect(uploads).toHaveLength(2)
    expect(uploads[1].options.signal.aborted).toBe(false)
    uploads[1].finish({ url: 'https://cdn.example/4', size: 5 })

    await expect(uploading).resolves.toMatchObject({ uri: 'https://cdn.example/4' })
  })

  it('resume while it is still sending sends nothing more', () => {
    sdkUpload(attachment('sdk-5'), () => undefined)

    resumeUpload('sdk-5')

    expect(uploads).toHaveLength(1)
  })

  it('the progress never goes back: after a resume it waits until the new upload passes it', () => {
    const shown: number[] = []
    sdkUpload(attachment('sdk-6'), ({ loaded }) => shown.push(loaded))

    uploads[0].options.progress(300, 1000)
    pauseUpload('sdk-6')
    uploads[0].options.progress(400, 1000)
    resumeUpload('sdk-6')
    uploads[1].options.progress(100, 1000)
    uploads[1].options.progress(300, 1000)
    uploads[1].options.progress(700, 1000)

    expect(shown).toEqual([300, 300, 700])
  })

  it('a pause pressed before the upload starts sends nothing until resume', () => {
    markUploadNotStarted('sdk-7')
    pauseUpload('sdk-7')

    sdkUpload(attachment('sdk-7'), () => undefined)
    expect(uploads).toHaveLength(0)
    expect(isUploadNotStarted('sdk-7')).toBe(false)

    resumeUpload('sdk-7')
    expect(uploads).toHaveLength(1)
  })

  it('a cancelled upload stops its request and never settles, as with a custom uploader: its message is gone', async () => {
    const uploading = sdkUpload(attachment('sdk-8'), () => undefined)
    const state = settled(uploading)

    cancelUpload('sdk-8')
    await flush()

    expect(uploads[0].options.signal.aborted).toBe(true)
    expect(state.value).toBe('pending')
    expect(resumeUpload('sdk-8')).toBe(false)
  })

  it('a failed upload rejects with the SDK error, and its stop and resume controls are gone', async () => {
    const uploading = sdkUpload(attachment('sdk-9'), () => undefined)
    const error = Object.assign(new Error('storage is down'), { code: 1500 })
    uploads[0].fail(error)

    await expect(uploading).rejects.toBe(error)
    expect(pauseUpload('sdk-9')).toBe(false)
  })

  it('an upload that finishes as it is stopped still counts: the file is stored', async () => {
    const uploading = sdkUpload(attachment('sdk-10'), () => undefined)
    uploads[0].finish({ url: 'https://cdn.example/10', size: 5 })
    pauseUpload('sdk-10')

    await expect(uploading).resolves.toMatchObject({ uri: 'https://cdn.example/10' })
  })

  it('fails before sending with an SDK that has no client.upload', async () => {
    setClient({ uploadFile: jest.fn() })

    await expect(sdkUpload(attachment('sdk-11'), () => undefined)).rejects.toThrow(/client\.upload/)
  })

  it('fails before sending when the attachment has no file', async () => {
    await expect(sdkUpload({ tid: 'sdk-12', url: 'https://x' } as any, () => undefined)).rejects.toThrow(/unavailable/)
    expect(uploads).toEqual([])
  })

  it('uploads the attachment data when its url is not a file', async () => {
    const file = fileOf('from data')

    sdkUpload({ tid: 'sdk-13', url: 'blob:x', data: file } as any, () => undefined)

    expect(uploads[0].file === file).toBe(true)
  })
})
