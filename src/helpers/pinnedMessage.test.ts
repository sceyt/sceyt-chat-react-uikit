import { getPinnedMessagePreview } from './pinnedMessage'
import { setClient } from '../common/client'

describe('getPinnedMessagePreview', () => {
  beforeEach(() => {
    setClient({ user: { id: 'current-user' } } as any)
  })

  it('uses a mentioned user display name instead of the raw mention token', () => {
    const mentionedUser = { id: '37400123456', firstName: 'Jane', lastName: 'Doe' }
    const message = {
      body: 'Please ask @37400123456',
      bodyAttributes: [
        {
          type: 'mention',
          offset: 11,
          length: 12,
          metadata: mentionedUser.id
        }
      ],
      mentionedUsers: [mentionedUser]
    }

    expect(getPinnedMessagePreview(message)).toBe('Please ask @Jane Doe')
  })
})
