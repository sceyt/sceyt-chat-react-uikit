import { sanitizeMessageForPersist } from './messagesIdb'
import { makeMessage } from '../testUtils/messageFixtures'

describe('sanitizeMessageForPersist', () => {
  it('removes SDK helper functions before writing a message to IndexedDB', () => {
    const message: any = makeMessage({
      requestedMentionUserIds: (() => ['user-1']) as any,
      metadata: { resolveMention: () => ['user-1'] }
    })

    const sanitized = sanitizeMessageForPersist(message)

    expect(sanitized).not.toBe(message)
    expect(sanitized.requestedMentionUserIds).toBeUndefined()
    expect((sanitized.metadata as any).resolveMention).toBeUndefined()
    expect(() => structuredClone(sanitized)).not.toThrow()
  })

  it('keeps valid mention ids while sanitizing attachments', () => {
    const message = makeMessage({
      requestedMentionUserIds: ['user-1'],
      attachments: [{ attachmentUrl: 'blob:session-file', data: new Blob(['file']) } as any]
    })

    const sanitized = sanitizeMessageForPersist(message)

    expect(sanitized.requestedMentionUserIds).toEqual(['user-1'])
    expect(sanitized.attachments[0]).toEqual({ attachmentUrl: undefined })
  })
})
