import { attachmentTypes } from './constants'
import {
  getOutgoingAttachmentType,
  mergePreparedAttachmentPatches,
  waitForMediaAttachmentPreparation
} from './attachmentSendPreparation'

describe('attachment send preparation', () => {
  it('waits for an image metadata patch before building the send attachment', async () => {
    let finishPreparation!: () => void
    const preparations = new Map<string, Promise<void>>()
    const patches = new Map<string, any>()
    const attachments = [{ tid: 'image-1', type: attachmentTypes.image, metadata: '{}' }]

    preparations.set(
      'image-1',
      new Promise<void>((resolve) => {
        finishPreparation = () => {
          patches.set('image-1', { metadata: '{"szw":1280,"szh":720}' })
          resolve()
        }
      })
    )

    let resolved = false
    const waitForPreparation = waitForMediaAttachmentPreparation(attachments, preparations).then(() => {
      resolved = true
    })

    await Promise.resolve()
    expect(resolved).toBe(false)

    finishPreparation()
    await waitForPreparation

    expect(mergePreparedAttachmentPatches(attachments, patches)).toEqual([
      expect.objectContaining({ metadata: '{"szw":1280,"szh":720}' })
    ])
  })

  it('waits for video preparation before sending', async () => {
    let finishPreparation!: () => void
    const preparations = new Map<string, Promise<void>>()
    preparations.set(
      'video-1',
      new Promise<void>((resolve) => {
        finishPreparation = resolve
      })
    )

    let resolved = false
    const waitForPreparation = waitForMediaAttachmentPreparation(
      [{ tid: 'video-1', type: attachmentTypes.video }],
      preparations
    ).then(() => {
      resolved = true
    })

    await Promise.resolve()
    expect(resolved).toBe(false)

    finishPreparation()
    await expect(waitForPreparation).resolves.toBeUndefined()
  })

  it('waits for a generic-picker video before sending it as a file', async () => {
    let finishPreparation!: () => void
    const preparations = new Map<string, Promise<void>>()
    preparations.set(
      'video-1',
      new Promise<void>((resolve) => {
        finishPreparation = resolve
      })
    )

    let resolved = false
    const waitForPreparation = waitForMediaAttachmentPreparation(
      [
        {
          tid: 'video-1',
          type: attachmentTypes.file,
          data: new File(['video'], 'recording.mov', { type: 'video/quicktime' })
        }
      ],
      preparations
    ).then(() => {
      resolved = true
    })

    await Promise.resolve()
    expect(resolved).toBe(false)

    finishPreparation()
    await expect(waitForPreparation).resolves.toBeUndefined()
  })

  it('keeps a generic file-picker video as a file', () => {
    expect(
      getOutgoingAttachmentType({
        type: attachmentTypes.file,
        data: new File(['video'], 'recording.mov', { type: 'video/quicktime' })
      })
    ).toBe(attachmentTypes.file)
  })

  it('keeps non-video generic files as files', () => {
    expect(
      getOutgoingAttachmentType({
        type: attachmentTypes.file,
        data: new File(['document'], 'notes.pdf', { type: 'application/pdf' })
      })
    ).toBe(attachmentTypes.file)
  })
})
