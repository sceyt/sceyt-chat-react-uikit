import { findMentionsInText } from './mentions'

const anna = { pattern: '@Anna Smith', member: 'anna' }
const annaS = { pattern: '@Anna', member: 'anna-s' }

const found = (text: string, candidates = [anna, annaS]) =>
  findMentionsInText(text, candidates).map(({ start, member }) => ({ start, member }))

describe('findMentionsInText', () => {
  it('finds a mention followed by punctuation', () => {
    expect(found('@Anna Smith! hi')).toEqual([{ start: 0, member: 'anna' }])
  })

  it('takes the longest name where names overlap', () => {
    expect(found('hi @Anna Smith')).toEqual([{ start: 3, member: 'anna' }])
  })

  it('does not take the start of a longer name for a mention', () => {
    expect(found('@Annabel', [annaS])).toEqual([])
    expect(found('@Anna Smithson', [anna])).toEqual([])
  })

  it('needs whitespace or the start of the text before a mention', () => {
    expect(found('mail@Anna Smith')).toEqual([])
    expect(found('hi\n@Anna, hello')).toEqual([{ start: 3, member: 'anna-s' }])
  })
})
