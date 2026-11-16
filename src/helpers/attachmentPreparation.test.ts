import {
  beginVideoPreparation,
  clearVideoPreparation,
  completeAttachmentPreview,
  completeVideoPreparation,
  failVideoPreparation,
  waitForAttachmentPreview,
  waitForVideoPreparation
} from './attachmentPreparation'

const makeFile = (name: string) => new File(['video'], name, { type: 'video/mp4' })

describe('video attachment preparation', () => {
  afterEach(() => {
    clearVideoPreparation('ready')
    clearVideoPreparation('failed')
    clearVideoPreparation('timeout')
  })

  it('returns completed metadata before upload begins', async () => {
    const file = makeFile('recording.mp4')
    const videoPreviewBlob = new Blob(['preview'], { type: 'image/jpeg' })
    beginVideoPreparation('ready', file)
    completeVideoPreparation('ready', {
      file,
      metadata: { tmb: 'thumb', szw: 100, szh: 50, dur: 3 },
      videoPreviewBlob
    })

    const prepared = await waitForVideoPreparation('ready')
    expect(prepared?.file).toBe(file)
    expect(prepared?.metadata).toEqual({ tmb: 'thumb', szw: 100, szh: 50, dur: 3 })
    expect(prepared?.videoPreviewBlob).toBe(videoPreviewBlob)
    expect(prepared?.status).toBe('ready')
  })

  it('falls back to the original file after preparation fails', async () => {
    const file = makeFile('unsupported.mov')
    beginVideoPreparation('failed', file)
    failVideoPreparation('failed')

    const prepared = await waitForVideoPreparation('failed')
    expect(prepared?.file).toBe(file)
    expect(prepared?.status).toBe('failed')
  })

  it('returns the original file when preparation exceeds the timeout', async () => {
    const file = makeFile('slow.mov')
    beginVideoPreparation('timeout', file)

    const prepared = await waitForVideoPreparation('timeout', 1)
    expect(prepared?.file).toBe(file)
    expect(prepared?.status).toBe('failed')
  })

  it('unblocks an in-flight waiter when the attachment is removed', async () => {
    const file = makeFile('removed.mp4')
    beginVideoPreparation('removed', file)

    const waiting = waitForVideoPreparation('removed')
    clearVideoPreparation('removed')

    await expect(waiting).resolves.toEqual(expect.objectContaining({ file, status: 'failed' }))
  })
})

describe('attachment preview', () => {
  const file = new File(['movie'], 'clip.mov', { type: 'video/quicktime' })
  const converted = new File(['converted'], 'clip.mp4', { type: 'video/mp4' })
  const previewBlob = new Blob(['frame'], { type: 'image/jpeg' })

  it('is ready before the file: a video still being converted already has its thumbnail', async () => {
    beginVideoPreparation('converting', file)
    let fileReady = false
    const preparation = waitForVideoPreparation('converting').then((prepared) => {
      fileReady = true
      return prepared
    })

    completeAttachmentPreview('converting', { metadata: { tmb: 'thumb' }, videoPreviewBlob: previewBlob })
    const preview = await waitForAttachmentPreview('converting', 1000)

    expect(preview?.metadata).toEqual({ tmb: 'thumb' })
    expect(preview?.videoPreviewBlob === previewBlob).toBe(true)
    expect(fileReady).toBe(false)

    completeVideoPreparation('converting', { file: converted, metadata: { tmb: 'thumb' } })
    expect((await preparation).file === converted).toBe(true)
    clearVideoPreparation('converting')
  })

  it('without a separate preview (an image), comes from the finished preparation', async () => {
    beginVideoPreparation('image', file)
    const waiting = waitForAttachmentPreview('image')
    completeVideoPreparation('image', { file, metadata: { szw: 10 } })
    expect((await waiting)?.metadata).toEqual({ szw: 10 })
    clearVideoPreparation('image')
  })

  it('only the first preview counts', async () => {
    beginVideoPreparation('twice', file)
    completeAttachmentPreview('twice', { metadata: { tmb: 'first' } })
    completeAttachmentPreview('twice', { metadata: { tmb: 'second' } })
    expect((await waitForAttachmentPreview('twice'))?.metadata).toEqual({ tmb: 'first' })
    clearVideoPreparation('twice')
  })

  it('is kept after the preparation finishes', async () => {
    beginVideoPreparation('done', file)
    completeAttachmentPreview('done', { metadata: { tmb: 'early' } })
    completeVideoPreparation('done', { file: converted, metadata: { tmb: 'early' } })
    expect((await waitForAttachmentPreview('done'))?.metadata).toEqual({ tmb: 'early' })
    // A late preview call for a finished preparation changes nothing.
    completeAttachmentPreview('done', { metadata: { tmb: 'late' } })
    expect((await waitForAttachmentPreview('done'))?.metadata).toEqual({ tmb: 'early' })
    clearVideoPreparation('done')
  })

  it.each([
    ['failed', (tid: string) => failVideoPreparation(tid)],
    ['removed', (tid: string) => clearVideoPreparation(tid)]
  ])('is none when the preparation %s', async (name, end) => {
    beginVideoPreparation(name, file)
    const waiting = waitForAttachmentPreview(name)
    end(name)
    expect(await waiting).toBeNull()
    clearVideoPreparation(name)
  })

  it('is none after the timeout, and for an attachment with no preparation', async () => {
    beginVideoPreparation('slow', file)
    expect(await waitForAttachmentPreview('slow', 1)).toBeNull()
    expect(await waitForAttachmentPreview('unknown', 1)).toBeNull()
    clearVideoPreparation('slow')
  })
})
