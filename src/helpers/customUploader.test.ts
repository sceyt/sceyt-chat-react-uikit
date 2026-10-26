import {
  cancelUpload,
  customUpload,
  isUploadNotStarted,
  isUploadPausedBeforeStart,
  markUploadNotStarted,
  pauseUpload,
  resumeUpload,
  setCustomUploader
} from './customUploader'

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
