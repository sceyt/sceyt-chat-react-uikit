import { getDraftMentionSegments } from './draftMentions'

describe('getDraftMentionSegments', () => {
  it('keeps the mentioned user while restoring a serialized identifier', () => {
    const mentionedUser = { id: '+15551234567', firstName: 'Jane', lastName: 'Doe' }

    expect(
      getDraftMentionSegments(
        'Hello @+15551234567!',
        [{ type: 'mention', offset: 6, length: 13, metadata: mentionedUser.id }],
        [mentionedUser]
      )
    ).toEqual([
      { text: 'Hello ' },
      { text: '@+15551234567', mentionId: mentionedUser.id, mentionedUser },
      { text: '!' }
    ])
  })
})
