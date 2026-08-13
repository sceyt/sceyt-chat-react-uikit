import { attachmentTypes } from './constants'
import { mergePreparedAttachmentPatches, waitForImageAttachmentPreparation } from './attachmentSendPreparation'

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
    const waitForPreparation = waitForImageAttachmentPreparation(attachments, preparations).then(() => {
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

  it('does not wait for video preparation before sending', async () => {
    const preparations = new Map<string, Promise<void>>([['video-1', new Promise<void>(() => undefined)]])

    await expect(
      waitForImageAttachmentPreparation([{ tid: 'video-1', type: attachmentTypes.video }], preparations)
    ).resolves.toBeUndefined()
  })
})
