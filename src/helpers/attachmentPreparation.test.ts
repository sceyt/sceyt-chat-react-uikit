import {
  beginVideoPreparation,
  clearVideoPreparation,
  completeVideoPreparation,
  failVideoPreparation,
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
})
