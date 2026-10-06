import {
  trimMessageBodyWithAttributes,
  bodyAttributesToHTML,
  typingTextFormat,
  makeUsername,
  isJSON,
  combineMessageAttributes,
  bytesToSize,
  getFileExtension,
  getAttachmentType,
  setMessageTypeByAttachment,
  lastMessageDateFormat,
  getDuplicateMentionsFromMeta,
  compareMessageBodyAttributes,
  isMessageUnsupported,
  canBeViewOnce,
  checkIsTypeKeyPressed,
  handleVoteDetails,
  deleteVoteFromPollDetails
} from './message'
import { IBodyAttribute, IMessage, IPollVote, IUser } from '../types'
import { attachmentTypes, MESSAGE_STATUS } from './constants'
import { MESSAGE_TYPE } from '../types/enum'

const bold = (offset, length) => ({ type: 'bold', metadata: '', offset, length }) as IBodyAttribute
const italic = (offset, length) => ({ type: 'italic', metadata: '', offset, length }) as IBodyAttribute
const underline = (offset, length) =>
  ({
    type: 'underline',
    metadata: '',
    offset,
    length
  }) as IBodyAttribute
const strikethrough = (offset, length) =>
  ({
    type: 'strikethrough',
    metadata: '',
    offset,
    length
  }) as IBodyAttribute
const monospace = (offset, length) =>
  ({
    type: 'monospace',
    metadata: '',
    offset,
    length
  }) as IBodyAttribute
const mention = (offset, length, userId) =>
  ({
    type: 'mention',
    metadata: userId,
    offset,
    length
  }) as IBodyAttribute

describe('trimMessageBodyWithAttributes', () => {
  it('shifts attribute offsets when leading whitespace is trimmed (paste from Notes)', () => {
    const { body, bodyAttributes } = trimMessageBodyWithAttributes('\nHello', [bold(1, 5)])
    expect(body).toBe('Hello')
    expect(bodyAttributes).toEqual([bold(0, 5)])
  })

  it('keeps attributes unchanged when there is no surrounding whitespace', () => {
    const { body, bodyAttributes } = trimMessageBodyWithAttributes('Hello world', [bold(0, 5)])
    expect(body).toBe('Hello world')
    expect(bodyAttributes).toEqual([bold(0, 5)])
  })

  it('shifts and clips an attribute covering the whole text including surrounding whitespace', () => {
    const { body, bodyAttributes } = trimMessageBodyWithAttributes('  Hello  ', [bold(0, 9)])
    expect(body).toBe('Hello')
    expect(bodyAttributes).toEqual([bold(0, 5)])
  })

  it('clips an attribute running into trimmed trailing whitespace', () => {
    const { body, bodyAttributes } = trimMessageBodyWithAttributes('Hello \n', [bold(0, 7)])
    expect(body).toBe('Hello')
    expect(bodyAttributes).toEqual([bold(0, 5)])
  })

  it('drops attributes located entirely inside trimmed whitespace', () => {
    const { body, bodyAttributes } = trimMessageBodyWithAttributes('  Hello  ', [bold(0, 2), bold(7, 2)])
    expect(body).toBe('Hello')
    expect(bodyAttributes).toEqual([])
  })

  it('shifts mention attributes the same way and preserves metadata', () => {
    const mentionAttr: IBodyAttribute = { type: 'mention', metadata: 'user-1', offset: 3, length: 6 }
    const { body, bodyAttributes } = trimMessageBodyWithAttributes(' \nhi @user1', [mentionAttr])
    expect(body).toBe('hi @user1')
    expect(bodyAttributes).toEqual([{ type: 'mention', metadata: 'user-1', offset: 1, length: 6 }])
  })

  it('returns empty attributes for empty or missing input', () => {
    expect(trimMessageBodyWithAttributes('  ', [bold(0, 1)])).toEqual({ body: '', bodyAttributes: [] })
    expect(trimMessageBodyWithAttributes('Hello', undefined as unknown as IBodyAttribute[])).toEqual({
      body: 'Hello',
      bodyAttributes: []
    })
  })
})

describe('bodyAttributesToHTML', () => {
  describe('plain body escaping', () => {
    it('HTML-escapes script tags', () => {
      const result = bodyAttributesToHTML('<script>alert("xss")</script>', [])
      expect(result).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
      expect(result).not.toContain('<script>')
    })

    it('HTML-escapes ampersands', () => {
      expect(bodyAttributesToHTML('a & b', [])).toBe('a &amp; b')
    })

    it('HTML-escapes quotes', () => {
      expect(bodyAttributesToHTML('say "hello"', [])).toBe('say &quot;hello&quot;')
    })

    it('HTML-escapes greater than', () => {
      expect(bodyAttributesToHTML('a > b', [])).toBe('a &gt; b')
    })

    it('returns empty string for empty body', () => {
      expect(bodyAttributesToHTML('', [])).toBe('')
    })

    it('returns escaped body when no attributes', () => {
      expect(bodyAttributesToHTML('Hello <World>', undefined)).toBe('Hello &lt;World&gt;')
    })
  })

  describe('format tags', () => {
    it('wraps bold text in <b> tags', () => {
      expect(bodyAttributesToHTML('hello', [bold(0, 5)])).toBe('<b>hello</b>')
    })

    it('wraps italic text in <i> tags', () => {
      expect(bodyAttributesToHTML('hello', [italic(0, 5)])).toBe('<i>hello</i>')
    })

    it('wraps underline text in <u> tags', () => {
      expect(bodyAttributesToHTML('hello', [underline(0, 5)])).toBe('<u>hello</u>')
    })

    it('wraps strikethrough text in <s> tags', () => {
      expect(bodyAttributesToHTML('hello', [strikethrough(0, 5)])).toBe('<s>hello</s>')
    })

    it('wraps monospace text in <code> tags', () => {
      expect(bodyAttributesToHTML('hello', [monospace(0, 5)])).toBe('<code>hello</code>')
    })
  })

  describe('combined formats', () => {
    it('nests bold and italic correctly', () => {
      const attrs = [bold(0, 5), italic(0, 5)]
      const result = bodyAttributesToHTML('hello', attrs)
      expect(result).toBe('<b><i>hello</i></b>')
    })

    it('handles overlapping ranges', () => {
      // "hello world" with bold on "hello" and italic on "lo wor"
      const attrs = [bold(0, 5), italic(3, 5)]
      const result = bodyAttributesToHTML('hello world', attrs)
      // hel (bold only) + lo (bold+italic) + " wor" (italic only) + ld (plain)
      expect(result).toContain('<b>')
      expect(result).toContain('<i>')
    })

    it('handles all formats combined (bold italic strikethrough underline monospace)', () => {
      const attrs = [bold(0, 5), italic(0, 5), strikethrough(0, 5), underline(0, 5), monospace(0, 5)]
      const result = bodyAttributesToHTML('hello', attrs)
      expect(result).toContain('<b>')
      expect(result).toContain('<i>')
      expect(result).toContain('<s>')
      expect(result).toContain('<u>')
      expect(result).toContain('<code>')
    })
  })

  describe('mentions', () => {
    it('renders mention with data-mention attribute and @Name', () => {
      const users: IUser[] = [{ id: 'user-1', firstName: 'John', lastName: 'Doe' } as IUser]
      const result = bodyAttributesToHTML('Hi @John Doe', [mention(3, 9, 'user-1')], users)
      expect(result).toContain('data-mention="user-1"')
      expect(result).toContain('@John Doe')
    })

    it('uses contact name when getFromContacts is true', () => {
      const users: IUser[] = [{ id: 'user-1', firstName: 'John', lastName: 'Doe' } as IUser]
      const contacts = { 'user-1': { id: 'user-1', firstName: 'Contact', lastName: 'Name' } }
      const result = bodyAttributesToHTML('Hi @name', [mention(3, 5, 'user-1')], users, contacts as any, true)
      expect(result).toContain('@Contact Name')
    })

    it('falls back to body text for unknown user', () => {
      const result = bodyAttributesToHTML('Hi @unknown', [mention(3, 8, 'unknown-id')], [])
      expect(result).toContain('data-mention="unknown-id"')
      expect(result).toContain('@unknown')
    })

    it('escapes userId in data-mention', () => {
      const users: IUser[] = [{ id: 'user"<>&', firstName: 'Test', lastName: 'User' } as IUser]
      const result = bodyAttributesToHTML('Hi @Test', [mention(3, 5, 'user"<>&')], users)
      expect(result).toContain('data-mention="user&quot;&lt;&gt;&amp;"')
    })

    it('escapes display name in mention', () => {
      const users: IUser[] = [{ id: 'user-1', firstName: '<script>', lastName: 'User' } as IUser]
      const result = bodyAttributesToHTML('Hi @name', [mention(3, 5, 'user-1')], users)
      expect(result).toContain('&lt;script&gt;')
      expect(result).not.toContain('<script>')
    })
  })

  describe('edge cases', () => {
    it('handles attribute offset past end of body', () => {
      expect(() => bodyAttributesToHTML('hi', [bold(10, 5)])).not.toThrow()
    })

    it('handles attribute length past end of body', () => {
      const result = bodyAttributesToHTML('hi', [bold(0, 100)])
      expect(result).toBe('<b>hi</b>')
    })

    // Regression: a zero-length mention used to never advance the render loop
    // (infinite loop that froze the tab on "Copy message"). If this test hangs,
    // that bug is back.
    it('ignores a zero-length mention instead of looping forever', () => {
      expect(bodyAttributesToHTML('hello', [mention(2, 0, 'user-1')])).toBe('hello')
    })

    it('ignores negative-length and out-of-range attributes', () => {
      expect(bodyAttributesToHTML('hello', [mention(1, -3, 'user-1'), bold(10, 2)])).toBe('hello')
    })

    it('clamps a negative offset to the start of the body', () => {
      expect(bodyAttributesToHTML('hello', [bold(-2, 4)])).toBe('<b>he</b>llo')
    })
  })
})

describe('typingTextFormat', () => {
  it('returns plain text without attributes', () => {
    expect(typingTextFormat({ text: 'hello', formatAttributes: [] })).toBe('hello')
  })

  it('wraps mentions in span tags', () => {
    const attrs = [{ start: 0, displayName: 'John', type: 'mention', end: 4 }]
    const result = typingTextFormat({ text: 'John hello', formatAttributes: attrs })
    expect(result).toContain('<span class=mention>John</span>')
  })

  it('handles multiline text', () => {
    const result = typingTextFormat({ text: 'hello\nworld', formatAttributes: [] })
    expect(result).toContain('<br/>')
  })
})

describe('makeUsername', () => {
  it('returns contact firstName when fromContact is true', () => {
    const contact = { id: 'c1', firstName: 'Contact', lastName: 'Name' }
    expect(makeUsername(contact as any, undefined, true)).toBe('Contact Name')
  })

  it('returns contact firstName only when getFirstNameOnly', () => {
    const contact = { id: 'c1', firstName: 'Contact Name', lastName: 'Last' }
    expect(makeUsername(contact as any, undefined, true, true)).toBe('Contact')
  })

  it('returns contact id when no firstName', () => {
    const contact = { id: 'c1', firstName: '' }
    expect(makeUsername(contact as any, undefined, true)).toBe('c1')
  })

  it('returns user firstName with ~ prefix when fromContact but no contact', () => {
    const user = { id: 'u1', firstName: 'User', lastName: 'Name' } as IUser
    expect(makeUsername(undefined, user, true)).toBe('~User Name')
  })

  it('returns user firstName without ~ when not fromContact', () => {
    const user = { id: 'u1', firstName: 'User', lastName: 'Name' } as IUser
    expect(makeUsername(undefined, user, false)).toBe('User Name')
  })

  it('returns user id when no firstName', () => {
    const user = { id: 'u1', firstName: '' } as IUser
    expect(makeUsername(undefined, user)).toBe('u1')
  })

  it('returns "Deleted user" when no contact or user', () => {
    expect(makeUsername(undefined, undefined)).toBe('Deleted user')
  })
})

describe('isJSON', () => {
  // isJSON returns truthy (the parsed result) for valid JSON, falsy for invalid
  it.each([
    ['{"key": "value"}', true],
    ['[1, 2, 3]', true],
    ['"string"', true],
    ['123', true],
    ['true', true]
  ])('isJSON(%s) returns truthy', (input) => {
    expect(isJSON(input)).toBeTruthy()
  })

  it('returns falsy for "null" JSON (parsed null is falsy)', () => {
    // isJSON returns JSON.parse(str) && !!str, so null && !!str = null
    expect(isJSON('null')).toBeFalsy()
  })

  it.each([['not json'], ['{invalid}'], [''], [null], [undefined]])('returns falsy for invalid input: %s', (input) => {
    expect(isJSON(input)).toBeFalsy()
  })
})

describe('combineMessageAttributes', () => {
  it('combines attributes at same offset', () => {
    const attrs = [bold(0, 5), italic(0, 5)]
    const result = combineMessageAttributes(attrs)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('bold italic')
    expect(result[0].offset).toBe(0)
  })

  it('keeps separate offsets separate', () => {
    const attrs = [bold(0, 5), italic(5, 5)]
    const result = combineMessageAttributes(attrs)
    expect(result).toHaveLength(2)
  })

  it('sorts by offset', () => {
    const attrs = [bold(5, 5), italic(0, 5)]
    const result = combineMessageAttributes(attrs)
    expect(result[0].offset).toBe(0)
    expect(result[1].offset).toBe(5)
  })
})

describe('bytesToSize (message.tsx)', () => {
  it('uses decimals=2 by default', () => {
    // message.tsx bytesToSize defaults to 2 decimal places
    expect(bytesToSize(1234)).toBe('1.23 KB')
  })

  it.each([
    [0, '0 Bytes'],
    [1, '1 B'],
    [1000, '1 KB'],
    [1500, '1.5 KB'],
    [1e6, '1 MB']
  ])('bytesToSize(%d) = %s', (input, expected) => {
    expect(bytesToSize(input)).toBe(expected)
  })

  // Sizes can arrive from the server as numeric strings
  it.each([
    ['30697', '30.7 KB'],
    ['0', '0 Bytes'],
    ['abc', '0 Bytes'],
    ['', '0 Bytes']
  ])('accepts a numeric string: bytesToSize(%p) = %p', (bytes, expected) => {
    expect(bytesToSize(bytes)).toBe(expected)
  })
})

describe('getFileExtension', () => {
  it.each([
    ['file.txt', 'txt'],
    ['file.name.pdf', 'pdf'],
    ['FILE.JPG', 'JPG'],
    ['noextension', ''],
    ['.hidden', 'hidden'],
    ['', '']
  ])('getFileExtension(%s) = %s', (input, expected) => {
    expect(getFileExtension(input)).toBe(expected)
  })
})

describe('getAttachmentType', () => {
  it.each([
    ['photo.jpg', attachmentTypes.image],
    ['photo.jpeg', attachmentTypes.image],
    ['photo.png', attachmentTypes.image],
    ['photo.gif', attachmentTypes.image],
    ['photo.tiff', attachmentTypes.image],
    ['video.mp4', attachmentTypes.video],
    ['video.mov', attachmentTypes.video],
    ['video.avi', attachmentTypes.video],
    ['audio.mp3', attachmentTypes.audio],
    ['audio.wav', attachmentTypes.audio],
    ['document.pdf', attachmentTypes.file],
    ['unknown', attachmentTypes.file]
  ])('getAttachmentType(%s) = %s', (input, expected) => {
    expect(getAttachmentType(input)).toBe(expected)
  })
})

describe('setMessageTypeByAttachment', () => {
  it.each([
    [attachmentTypes.image, 'media'],
    [attachmentTypes.video, 'media'],
    [attachmentTypes.audio, 'file'],
    [attachmentTypes.file, 'file'],
    ['unknown', 'file']
  ])('setMessageTypeByAttachment(%s) = %s', (input, expected) => {
    expect(setMessageTypeByAttachment(input)).toBe(expected)
  })
})

describe('lastMessageDateFormat', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('shows time only for today', () => {
    jest.setSystemTime(new Date('2026-10-03T18:00:00'))
    const date = new Date('2026-10-03T10:30:00')
    expect(lastMessageDateFormat(date)).toBe('10:30')
  })

  it('shows day name for this week (yesterday)', () => {
    jest.setSystemTime(new Date('2026-10-03T12:00:00')) // Saturday
    const date = new Date('2026-10-02T15:30:00') // Friday
    expect(lastMessageDateFormat(date)).toBe('Friday')
  })

  it('shows full date for older dates', () => {
    jest.setSystemTime(new Date('2026-10-03T12:00:00'))
    const date = new Date('2026-08-15T10:00:00')
    expect(lastMessageDateFormat(date)).toBe('15.08.26')
  })

  it('accepts timestamp', () => {
    jest.setSystemTime(new Date('2026-10-03T18:00:00'))
    const timestamp = new Date('2026-10-03T10:30:00').getTime()
    expect(lastMessageDateFormat(timestamp)).toBe('10:30')
  })
})

describe('getDuplicateMentionsFromMeta', () => {
  it('finds matching mentions', () => {
    const metas = [{ id: 'user-1' }, { id: 'user-2' }]
    const users = [
      { id: 'user-1', firstName: 'John' },
      { id: 'user-3', firstName: 'Jane' }
    ]
    const result = getDuplicateMentionsFromMeta(metas, users)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('user-1')
  })

  it('returns empty for no matches', () => {
    const metas = [{ id: 'user-1' }]
    const users = [{ id: 'user-2', firstName: 'Jane' }]
    expect(getDuplicateMentionsFromMeta(metas, users)).toHaveLength(0)
  })
})

describe('compareMessageBodyAttributes', () => {
  it('returns true for identical attributes', () => {
    const attrs1 = [bold(0, 5), italic(5, 5)]
    const attrs2 = [bold(0, 5), italic(5, 5)]
    expect(compareMessageBodyAttributes(attrs1, attrs2)).toBe(true)
  })

  it('returns false for different attributes', () => {
    const attrs1 = [bold(0, 5)]
    const attrs2 = [italic(0, 5)]
    expect(compareMessageBodyAttributes(attrs1, attrs2)).toBe(false)
  })

  it('returns true for empty arrays', () => {
    expect(compareMessageBodyAttributes([], [])).toBe(true)
  })
})

describe('isMessageUnsupported', () => {
  it('returns false for text message', () => {
    const message = { type: MESSAGE_TYPE.TEXT } as IMessage
    expect(isMessageUnsupported(message)).toBe(false)
  })

  it('returns false for media message', () => {
    const message = { type: MESSAGE_TYPE.MEDIA } as IMessage
    expect(isMessageUnsupported(message)).toBe(false)
  })

  it('returns false for deleted message', () => {
    const message = { type: MESSAGE_TYPE.DELETED, state: MESSAGE_STATUS.DELETE } as IMessage
    expect(isMessageUnsupported(message)).toBe(false)
  })

  it('returns true for unknown type', () => {
    const message = { type: 'unknown' } as unknown as IMessage
    expect(isMessageUnsupported(message)).toBe(true)
  })

  it('returns true for viewOnce message with wrong type', () => {
    const message = { type: MESSAGE_TYPE.TEXT, viewOnce: true } as IMessage
    expect(isMessageUnsupported(message)).toBe(true)
  })

  it('returns false for proper viewOnce message', () => {
    const message = { type: MESSAGE_TYPE.VIEW_ONCE, viewOnce: true } as IMessage
    expect(isMessageUnsupported(message)).toBe(false)
  })
})

describe('canBeViewOnce', () => {
  it('returns false if viewOnce is false', () => {
    const message = { viewOnce: false, attachments: [{ type: attachmentTypes.image }] } as IMessage
    expect(canBeViewOnce(message)).toBe(false)
  })

  it('returns false if no attachments', () => {
    const message = { viewOnce: true, attachments: [] } as IMessage
    expect(canBeViewOnce(message)).toBe(false)
  })

  it('returns false if more than one attachment', () => {
    const message = {
      viewOnce: true,
      attachments: [{ type: attachmentTypes.image }, { type: attachmentTypes.image }]
    } as IMessage
    expect(canBeViewOnce(message)).toBe(false)
  })

  it('returns true for image attachment', () => {
    const message = { viewOnce: true, attachments: [{ type: attachmentTypes.image }] } as IMessage
    expect(canBeViewOnce(message)).toBe(true)
  })

  it('returns true for video attachment', () => {
    const message = { viewOnce: true, attachments: [{ type: attachmentTypes.video }] } as IMessage
    expect(canBeViewOnce(message)).toBe(true)
  })

  it('returns true for voice attachment', () => {
    const message = { viewOnce: true, attachments: [{ type: attachmentTypes.voice }] } as IMessage
    expect(canBeViewOnce(message)).toBe(true)
  })

  it('returns false for file attachment', () => {
    const message = { viewOnce: true, attachments: [{ type: attachmentTypes.file }] } as IMessage
    expect(canBeViewOnce(message)).toBe(false)
  })
})

describe('checkIsTypeKeyPressed', () => {
  it.each([
    ['KeyA', true],
    ['Digit1', true],
    ['Enter', false],
    ['Backspace', false],
    ['ArrowLeft', false],
    ['Shift', false],
    ['Control', false],
    ['Alt', false],
    ['Tab', false],
    ['Escape', false],
    ['F1', false],
    ['Space', false],
    [undefined, true]
  ])('checkIsTypeKeyPressed(%s) = %s', (code, expected) => {
    expect(checkIsTypeKeyPressed(code)).toBe(expected)
  })
})

describe('poll helpers', () => {
  const makeVote = (optionId: number, userId: string): IPollVote =>
    ({
      optionId,
      user: { id: userId }
    }) as IPollVote

  const makePollMessage = (overrides = {}): IMessage =>
    ({
      pollDetails: {
        allowMultipleVotes: false,
        closed: false,
        voteDetails: {
          votesPerOption: {},
          votes: [],
          ownVotes: []
        },
        ...overrides
      }
    }) as IMessage

  describe('deleteVoteFromPollDetails', () => {
    it('removes matching vote', () => {
      const votes = [makeVote(1, 'user-1'), makeVote(2, 'user-2')]
      const result = deleteVoteFromPollDetails(votes, makeVote(1, 'user-1'))
      expect(result).toHaveLength(1)
      expect(result[0].optionId).toBe(2)
    })

    it('keeps votes that do not match', () => {
      const votes = [makeVote(1, 'user-1'), makeVote(1, 'user-2')]
      const result = deleteVoteFromPollDetails(votes, makeVote(1, 'user-1'))
      expect(result).toHaveLength(1)
      expect(result[0].user.id).toBe('user-2')
    })
  })

  describe('handleVoteDetails', () => {
    it('returns undefined for missing voteDetails', () => {
      expect(handleVoteDetails(undefined, makePollMessage())).toBeUndefined()
    })

    it('returns undefined for missing message', () => {
      expect(handleVoteDetails({ type: 'add', vote: makeVote(1, 'user-1') }, undefined)).toBeUndefined()
    })

    it('handles close type', () => {
      const result = handleVoteDetails({ type: 'close' }, makePollMessage())
      expect(result?.closed).toBe(true)
    })

    it('handles add vote', () => {
      const message = makePollMessage()
      const result = handleVoteDetails({ type: 'add', vote: makeVote(1, 'user-1') }, message)
      expect(result?.voteDetails?.votes).toHaveLength(1)
      expect(result?.voteDetails?.votesPerOption[1]).toBe(1)
    })

    it('handles delete vote', () => {
      const message = makePollMessage({
        voteDetails: {
          votesPerOption: { 1: 1 },
          votes: [makeVote(1, 'user-1')],
          ownVotes: []
        }
      })
      const result = handleVoteDetails({ type: 'delete', vote: makeVote(1, 'user-1') }, message)
      expect(result?.voteDetails?.votes).toHaveLength(0)
      expect(result?.voteDetails?.votesPerOption[1]).toBe(0)
    })

    it('vote counts never go negative', () => {
      const message = makePollMessage({
        voteDetails: {
          votesPerOption: { 1: 0 },
          votes: [],
          ownVotes: []
        }
      })
      const result = handleVoteDetails({ type: 'delete', vote: makeVote(1, 'user-1') }, message)
      expect(result?.voteDetails?.votesPerOption[1]).toBe(0)
    })

    it('handles addOwn vote', () => {
      const message = makePollMessage()
      const result = handleVoteDetails({ type: 'addOwn', vote: makeVote(1, 'user-1') }, message)
      expect(result?.voteDetails?.ownVotes).toHaveLength(1)
      expect(result?.voteDetails?.votesPerOption[1]).toBe(1)
    })

    it('does not duplicate own vote', () => {
      const message = makePollMessage({
        voteDetails: {
          votesPerOption: { 1: 1 },
          votes: [],
          ownVotes: [makeVote(1, 'user-1')]
        }
      })
      const result = handleVoteDetails({ type: 'addOwn', vote: makeVote(1, 'user-1') }, message)
      expect(result?.voteDetails?.ownVotes).toHaveLength(1)
      expect(result?.voteDetails?.votesPerOption[1]).toBe(1)
    })

    it('handles deleteOwn vote', () => {
      const message = makePollMessage({
        voteDetails: {
          votesPerOption: { 1: 1 },
          votes: [],
          ownVotes: [makeVote(1, 'user-1')]
        }
      })
      const result = handleVoteDetails({ type: 'deleteOwn', vote: makeVote(1, 'user-1') }, message)
      expect(result?.voteDetails?.ownVotes).toHaveLength(0)
      expect(result?.voteDetails?.votesPerOption[1]).toBe(0)
    })

    it('multiple-choice allows multiple ownVotes', () => {
      const message = makePollMessage({
        allowMultipleVotes: true,
        voteDetails: {
          votesPerOption: { 1: 1 },
          votes: [],
          ownVotes: [makeVote(1, 'user-1')]
        }
      })
      const result = handleVoteDetails({ type: 'addOwn', vote: makeVote(2, 'user-1') }, message)
      expect(result?.voteDetails?.ownVotes).toHaveLength(2)
    })

    it('single-choice replaces ownVotes', () => {
      const message = makePollMessage({
        allowMultipleVotes: false,
        voteDetails: {
          votesPerOption: { 1: 1 },
          votes: [],
          ownVotes: [makeVote(1, 'user-1')]
        }
      })
      const result = handleVoteDetails({ type: 'addOwn', vote: makeVote(2, 'user-1') }, message)
      expect(result?.voteDetails?.ownVotes).toHaveLength(1)
      expect(result?.voteDetails?.ownVotes?.[0].optionId).toBe(2)
    })
  })
})
