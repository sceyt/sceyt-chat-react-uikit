import {
  cancelUpload,
  isUploadNotStarted,
  isUploadPausedBeforeStart,
  markUploadNotStarted,
  pauseUpload,
  resetAttachmentUploadsForTests,
  resumeUpload,
  uploadAttachment
} from './attachmentUploadCoordinator'
import { fileTransfer } from './sceytChatUIKitFileTransfer'
import {
  FileTransferCallback,
  FileTransferResult,
  FileTransferProvider,
  FileUploadRequest
} from '../types/fileTransfer/types'

// A transport whose calls the test ends by hand.
const manualTransport = (overrides: Partial<FileTransferProvider> = {}) => {
  const calls: { request: FileUploadRequest; callback: FileTransferCallback; finish: (result: any) => void }[] = []
  const transport = {
    upload: jest.fn(
      (request: FileUploadRequest, callback: FileTransferCallback) =>
        new Promise<any>((resolve) => {
          calls.push({ request, callback, finish: resolve })
          // An aborted request settles, as transports do.
          request.signal.addEventListener('abort', () => resolve(FileTransferResult.failure(new Error('aborted'))))
        })
    ),
    download: jest.fn(),
    cancel: jest.fn(),
    ...overrides
  }
  fileTransfer.provider = transport
  return { transport, calls }
}

// Lets the promise callbacks queued so far run.
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve()
}
const attachment = (tid: string): any => ({ tid, name: `${tid}.txt`, type: 'file', size: 5 })
const source = () => ({ file: new Blob(['hello']), fileName: 'a.txt', mimeType: 'text/plain' })

const track = (promise: Promise<any>) => {
  const state: { value?: any; error?: any; settled: boolean } = { settled: false }
  promise.then(
    (value) => Object.assign(state, { value, settled: true }),
    (error) => Object.assign(state, { error, settled: true })
  )
  return state
}

describe('attachment uploads', () => {
  afterEach(() => {
    resetAttachmentUploadsForTests()
    fileTransfer.configure()
  })

  it('an upload goes to the transport with its operation id and resolves with the stored file', async () => {
    const { calls } = manualTransport()

    const upload = track(uploadAttachment(attachment('tid-1'), source(), jest.fn()))
    await flush()
    calls[0].finish(FileTransferResult.success({ url: 'https://cdn.example/a' }))
    await flush()

    expect(calls[0].request.operationId).toBe('upload:tid-1')
    expect(upload.value).toEqual({ url: 'https://cdn.example/a' })
  })

  it('a second upload of an attachment while it runs joins it: one transport upload, the same result and progress', async () => {
    const { transport, calls } = manualTransport()
    const firstProgress = jest.fn()
    const secondProgress = jest.fn()

    const first = track(uploadAttachment(attachment('tid-1'), source(), firstProgress))
    await flush()
    const second = track(uploadAttachment(attachment('tid-1'), source(), secondProgress))
    await flush()
    calls[0].callback.onProgress(40)
    calls[0].finish(FileTransferResult.success({ url: 'https://cdn.example/a' }))
    await flush()

    expect(transport.upload).toHaveBeenCalledTimes(1)
    expect(first.value).toEqual({ url: 'https://cdn.example/a' })
    expect(second.value).toEqual({ url: 'https://cdn.example/a' })
    expect(firstProgress).toHaveBeenCalledWith(40)
    expect(secondProgress).toHaveBeenCalledWith(40)
  })

  it('after an upload settles, the next one for the attachment is a new upload', async () => {
    const { transport, calls } = manualTransport()

    const first = track(uploadAttachment(attachment('tid-1'), source(), jest.fn()))
    await flush()
    calls[0].finish(FileTransferResult.failure(new Error('refused')))
    await flush()
    uploadAttachment(attachment('tid-1'), source(), jest.fn())
    await flush()

    expect(first.error).toEqual(new Error('refused'))
    expect(transport.upload).toHaveBeenCalledTimes(2)
  })

  it('a failed upload rejects with the transport error, and its controls are gone', async () => {
    const { calls } = manualTransport()
    const refused = new Error('too large')

    const upload = track(uploadAttachment(attachment('tid-1'), source(), jest.fn()))
    await flush()
    calls[0].finish(FileTransferResult.failure(refused))
    await flush()

    expect(upload.error).toBe(refused)
    expect(pauseUpload('tid-1')).toBe(false)
  })

  it('each attachment is its own upload: pausing one leaves the others going', async () => {
    const { calls } = manualTransport()

    track(uploadAttachment(attachment('tid-1'), source(), jest.fn()))
    track(uploadAttachment(attachment('tid-2'), source(), jest.fn()))
    await flush()
    pauseUpload('tid-1')

    expect(calls[0].request.signal.aborted).toBe(true)
    expect(calls[1].request.signal.aborted).toBe(false)
  })

  describe('without native pause', () => {
    it('a paused upload stops its attempt and waits for resume, then sends the file again and finishes', async () => {
      const { calls } = manualTransport()

      const upload = track(uploadAttachment(attachment('tid-1'), source(), jest.fn()))
      await flush()
      expect(pauseUpload('tid-1')).toBe(true)
      await flush()

      expect(calls[0].request.signal.aborted).toBe(true)
      // The stopped attempt's failure is the stop's, not the upload's.
      expect(upload.settled).toBe(false)

      expect(resumeUpload('tid-1')).toBe(true)
      await flush()
      expect(calls).toHaveLength(2)
      expect(calls[1].request.operationId).toBe('upload:tid-1')
      calls[1].finish(FileTransferResult.success({ url: 'https://cdn.example/a' }))
      await flush()
      expect(upload.value).toEqual({ url: 'https://cdn.example/a' })
    })

    it('resume while it is still sending sends nothing more', async () => {
      const { calls } = manualTransport()

      track(uploadAttachment(attachment('tid-1'), source(), jest.fn()))
      await flush()
      resumeUpload('tid-1')
      await flush()

      expect(calls).toHaveLength(1)
    })

    it('an upload that finishes as it is stopped still counts: the file is stored', async () => {
      const finished = FileTransferResult.success({ url: 'https://cdn.example/a' })
      // A transport that stored the file before it saw the abort.
      fileTransfer.provider = { upload: jest.fn(async () => finished), download: jest.fn(), cancel: jest.fn() }

      const upload = uploadAttachment(attachment('tid-1'), source(), jest.fn())
      pauseUpload('tid-1')

      await expect(upload).resolves.toEqual({ url: 'https://cdn.example/a' })
    })

    it('the progress never goes back: after a resume it waits until the new attempt passes it', async () => {
      const { calls } = manualTransport()
      const progress: number[] = []

      track(uploadAttachment(attachment('tid-1'), source(), (percent) => progress.push(percent)))
      await flush()
      calls[0].callback.onProgress(40)
      pauseUpload('tid-1')
      calls[0].callback.onProgress(60)
      resumeUpload('tid-1')
      await flush()
      calls[1].callback.onProgress(10)
      calls[1].callback.onProgress(50)

      expect(progress).toEqual([40, 50])
    })
  })

  it('progress reported while the connection is lost is not shown, nor holds back later progress', async () => {
    const { calls } = manualTransport()
    const progress: number[] = []
    const onLine = jest.spyOn(window.navigator, 'onLine', 'get')

    track(uploadAttachment(attachment('tid-1'), source(), (percent) => progress.push(percent)))
    await flush()
    calls[0].callback.onProgress(10)
    onLine.mockReturnValue(false)
    calls[0].callback.onProgress(100)
    onLine.mockReturnValue(true)
    calls[0].callback.onProgress(20)
    onLine.mockRestore()

    expect(progress).toEqual([10, 20])
  })

  describe('with native pause', () => {
    it('pause and resume go to the transport, and the same call goes on', async () => {
      const pause = jest.fn(() => true)
      const resume = jest.fn(() => true)
      const { calls } = manualTransport({ pause, resume })

      const upload = track(uploadAttachment(attachment('tid-1'), source(), jest.fn()))
      await flush()
      pauseUpload('tid-1')
      resumeUpload('tid-1')
      await flush()
      calls[0].finish(FileTransferResult.success({ url: 'https://cdn.example/a' }))
      await flush()

      expect(pause).toHaveBeenCalledWith('upload:tid-1')
      expect(resume).toHaveBeenCalledWith('upload:tid-1')
      expect(calls).toHaveLength(1)
      expect(calls[0].request.signal.aborted).toBe(false)
      expect(upload.value).toEqual({ url: 'https://cdn.example/a' })
    })

    it('a transport that cannot resume the call gets a new attempt', async () => {
      const { calls } = manualTransport({ pause: jest.fn(() => true), resume: jest.fn(() => false) })

      track(uploadAttachment(attachment('tid-1'), source(), jest.fn()))
      await flush()
      pauseUpload('tid-1')
      resumeUpload('tid-1')
      await flush()

      expect(calls[0].request.signal.aborted).toBe(true)
      expect(calls).toHaveLength(2)
    })
  })

  describe('a pause pressed before an upload starts (a video while its preview uploads)', () => {
    it('is kept and nothing is sent until resume', async () => {
      const { calls } = manualTransport()
      markUploadNotStarted('tid-1')

      expect(pauseUpload('tid-1')).toBe(true)
      expect(isUploadPausedBeforeStart('tid-1')).toBe(true)
      track(uploadAttachment(attachment('tid-1'), source(), jest.fn()))
      await flush()
      expect(calls).toHaveLength(0)
      expect(isUploadNotStarted('tid-1')).toBe(false)

      resumeUpload('tid-1')
      await flush()
      expect(calls).toHaveLength(1)
    })

    it('followed by a resume before the start, lets the upload start normally', async () => {
      const { calls } = manualTransport()
      markUploadNotStarted('tid-1')

      pauseUpload('tid-1')
      resumeUpload('tid-1')
      track(uploadAttachment(attachment('tid-1'), source(), jest.fn()))
      await flush()

      expect(calls).toHaveLength(1)
    })

    it('is forgotten when the upload is cancelled first', () => {
      markUploadNotStarted('tid-1')
      pauseUpload('tid-1')

      cancelUpload('tid-1')

      expect(isUploadNotStarted('tid-1')).toBe(false)
      expect(isUploadPausedBeforeStart('tid-1')).toBe(false)
    })
  })

  it('does nothing for an upload that is neither running nor about to start', () => {
    expect(pauseUpload('unknown')).toBe(false)
    expect(resumeUpload('unknown')).toBe(false)
  })

  it('a cancelled upload stops its request, lets the transport clean up, and rejects so its sender moves on', async () => {
    const { transport, calls } = manualTransport()

    const upload = track(uploadAttachment(attachment('tid-1'), source(), jest.fn()))
    await flush()
    cancelUpload('tid-1')
    await flush()

    expect(calls[0].request.signal.aborted).toBe(true)
    expect(transport.cancel).toHaveBeenCalledWith('upload:tid-1')
    expect(upload.error).toMatchObject({ name: 'AbortError' })
  })

  it('a paused upload that is cancelled lets the transport clean up its stopped attempt', async () => {
    const { transport } = manualTransport()

    track(uploadAttachment(attachment('tid-1'), source(), jest.fn()))
    await flush()
    pauseUpload('tid-1')
    cancelUpload('tid-1')

    expect(transport.cancel).toHaveBeenCalledWith('upload:tid-1')
  })
})
