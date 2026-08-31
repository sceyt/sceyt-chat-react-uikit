import { hasSendableTextOrPoll } from './sendMessageUtils'

describe('hasSendableTextOrPoll', () => {
  it('allows a poll to send when the compose editor is empty', () => {
    expect(hasSendableTextOrPoll('', true)).toBe(true)
  })

  it('allows a normal text message to send', () => {
    expect(hasSendableTextOrPoll('Hello', false)).toBe(true)
  })

  it('rejects an empty non-poll message', () => {
    expect(hasSendableTextOrPoll('   ', false)).toBe(false)
  })
})
