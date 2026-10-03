import {
  bytesToSize,
  formatLargeText,
  formatAudioVideoTime,
  formatChannelDetailsDate,
  userLastActiveDateFormat,
  checkArraysEqual,
  systemMessageUserName,
  getEmojisCategoryTitle,
  formatDisappearingMessageTime,
  hashString,
  detectOS,
  detectBrowser,
  calculateRenderedImageWidth
} from './index'

describe('bytesToSize (index.tsx)', () => {
  it.each([
    [0, '0 Bytes'],
    [1, '1 B'],
    [999, '999 B'],
    [1000, '1 KB'],
    [1500, '1.5 KB'],
    [1e6, '1 MB'],
    [1e9, '1 GB']
  ])('bytesToSize(%d) = %s', (input, expected) => {
    expect(bytesToSize(input)).toBe(expected)
  })

  // Values that used to produce "Infinity undefined" / "NaN undefined"
  it.each([
    [0.5, '0.5 B'],
    [-1, '0 Bytes'],
    [NaN, '0 Bytes'],
    [Infinity, '0 Bytes']
  ])('bytesToSize(%p) returns %p (no broken unit)', (bytes, expected) => {
    expect(bytesToSize(bytes as number)).toBe(expected)
  })

  it('caps the unit at YB for huge values', () => {
    expect(bytesToSize(1e30)).toMatch(/ YB$/)
  })

  it('uses decimals=1 by default (inconsistency with message.tsx which uses 2)', () => {
    // index.tsx defaults to decimals=1
    expect(bytesToSize(1234)).toBe('1.2 KB')
    // Note: message.tsx bytesToSize defaults to decimals=2, would return '1.23 KB'
  })

  it('respects custom decimal places', () => {
    expect(bytesToSize(1234, 0)).toBe('1 KB')
    expect(bytesToSize(1234, 2)).toBe('1.23 KB')
    expect(bytesToSize(1234, 3)).toBe('1.234 KB')
  })
})

describe('formatLargeText', () => {
  it('returns text unchanged if shorter than maxLength', () => {
    expect(formatLargeText('hello', 10)).toBe('hello')
  })

  it('returns text unchanged if equal to maxLength', () => {
    expect(formatLargeText('hello', 5)).toBe('hello')
  })

  it('truncates text with ellipsis if longer than maxLength', () => {
    const result = formatLargeText('hello world this is long', 10)
    expect(result).toContain('...')
    expect(result.length).toBeLessThanOrEqual(13) // maxLength + 3 for "..."
  })

  it('handles odd maxLength', () => {
    const result = formatLargeText('hello world this is long', 9)
    expect(result).toContain('...')
  })
})

describe('formatAudioVideoTime', () => {
  it.each([
    [0, '0:00'],
    [5, '0:05'],
    [59, '0:59'],
    [60, '1:00'],
    [61, '1:01'],
    [125, '2:05'],
    [3600, '60:00'],
    [3661, '61:01']
  ])('formatAudioVideoTime(%d) = %s', (input, expected) => {
    expect(formatAudioVideoTime(input)).toBe(expected)
  })
})

describe('formatChannelDetailsDate', () => {
  it('formats valid date', () => {
    const date = new Date('2026-09-25T22:00:00')
    expect(formatChannelDetailsDate(date)).toBe('25.09.26, 22:00')
  })

  it('formats timestamp', () => {
    const timestamp = new Date('2026-09-25T22:00:00').getTime()
    expect(formatChannelDetailsDate(timestamp)).toBe('25.09.26, 22:00')
  })

  it('formats date string', () => {
    expect(formatChannelDetailsDate('2026-09-25T22:00:00')).toBe('25.09.26, 22:00')
  })

  it('returns empty string for falsy input', () => {
    expect(formatChannelDetailsDate(null)).toBe('')
    expect(formatChannelDetailsDate(undefined)).toBe('')
    expect(formatChannelDetailsDate('')).toBe('')
  })

  it('returns empty string for invalid date', () => {
    expect(formatChannelDetailsDate('not-a-date')).toBe('')
  })
})

describe('userLastActiveDateFormat', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('shows "minutes ago" for recent activity', () => {
    jest.setSystemTime(new Date('2026-10-03T12:30:00'))
    const date = new Date('2026-10-03T12:25:00')
    expect(userLastActiveDateFormat(date)).toBe('Last seen 5  minutes ago')
  })

  it('shows "1 minute ago" for activity 0-1 minutes ago', () => {
    jest.setSystemTime(new Date('2026-10-03T12:30:00'))
    const date = new Date('2026-10-03T12:30:00')
    expect(userLastActiveDateFormat(date)).toBe('Last seen 1  minute ago')
  })

  it('shows time only for today', () => {
    jest.setSystemTime(new Date('2026-10-03T18:00:00'))
    const date = new Date('2026-10-03T10:30:00')
    expect(userLastActiveDateFormat(date)).toBe('Last seen 10:30')
  })

  it('shows "Yesterday" for yesterday', () => {
    jest.setSystemTime(new Date('2026-10-03T12:00:00'))
    const date = new Date('2026-10-02T15:30:00')
    expect(userLastActiveDateFormat(date)).toBe('Last seen Yesterday at 15:30')
  })

  it('shows day name for this week', () => {
    jest.setSystemTime(new Date('2026-10-03T12:00:00')) // Saturday
    const date = new Date('2026-09-28T14:00:00') // Monday
    const result = userLastActiveDateFormat(date)
    expect(result).toMatch(/Last seen \w+ at \d{2}:\d{2}/)
  })

  it('shows full date for older dates', () => {
    jest.setSystemTime(new Date('2026-10-03T12:00:00'))
    const date = new Date('2026-08-15T10:00:00')
    expect(userLastActiveDateFormat(date)).toBe('Last seen 15.08.26')
  })
})

describe('checkArraysEqual', () => {
  it('returns true for identical arrays', () => {
    expect(checkArraysEqual([1, 2, 3], [1, 2, 3])).toBe(true)
  })

  it('returns true for same reference', () => {
    const arr = [1, 2, 3]
    expect(checkArraysEqual(arr, arr)).toBe(true)
  })

  it('returns false for different lengths', () => {
    expect(checkArraysEqual([1, 2], [1, 2, 3])).toBe(false)
  })

  it('returns false for different values', () => {
    expect(checkArraysEqual([1, 2, 3], [1, 2, 4])).toBe(false)
  })

  it('returns false for falsy second argument', () => {
    expect(checkArraysEqual([1, 2], null)).toBe(false)
    expect(checkArraysEqual([1, 2], undefined)).toBe(false)
  })

  it('returns true for empty arrays', () => {
    expect(checkArraysEqual([], [])).toBe(true)
  })
})

describe('systemMessageUserName', () => {
  it('returns contact firstName if available', () => {
    const contact = { id: 'user-1', firstName: 'John Doe' }
    expect(systemMessageUserName('user-1', contact)).toBe('John')
  })

  it('returns contact id if no firstName', () => {
    const contact = { id: 'user-1', firstName: '' }
    expect(systemMessageUserName('user-1', contact)).toBe('user-1')
  })

  it('returns user firstName with ~ prefix from mentionedUsers', () => {
    const users = [{ id: 'user-1', firstName: 'Jane Smith' }]
    expect(systemMessageUserName('user-1', undefined, users as any)).toBe('~Jane')
  })

  it('returns userId if no contact and not in mentionedUsers', () => {
    expect(systemMessageUserName('user-1', undefined, [])).toBe('user-1')
  })

  it('returns "Deleted user" for empty userId', () => {
    expect(systemMessageUserName('', undefined, [])).toBe('Deleted user')
  })
})

describe('getEmojisCategoryTitle', () => {
  it.each([
    ['People', 'Smileys & People'],
    ['Animals', 'Animals & Nature'],
    ['Food', 'Food & Drink'],
    ['Travel', 'Travel & Places'],
    ['Objects', 'Objects'],
    ['Symbols', 'Symbols'],
    ['Flags', 'Flags'],
    ['Unknown', '']
  ])('getEmojisCategoryTitle(%s) = %s', (key, expected) => {
    expect(getEmojisCategoryTitle(key)).toBe(expected)
  })
})

describe('formatDisappearingMessageTime', () => {
  it('returns "Off" for falsy input', () => {
    expect(formatDisappearingMessageTime(0)).toBe('Off')
    expect(formatDisappearingMessageTime(null)).toBe('Off')
    expect(formatDisappearingMessageTime(undefined)).toBe('Off')
  })

  it('formats seconds', () => {
    expect(formatDisappearingMessageTime(30 * 1000)).toBe('30 seconds')
    expect(formatDisappearingMessageTime(1 * 1000)).toBe('1 second')
  })

  it('formats minutes', () => {
    expect(formatDisappearingMessageTime(5 * 60 * 1000)).toBe('5 minutes')
    expect(formatDisappearingMessageTime(1 * 60 * 1000)).toBe('1 minute')
  })

  it('formats hours', () => {
    expect(formatDisappearingMessageTime(2 * 60 * 60 * 1000)).toBe('2 hours')
    expect(formatDisappearingMessageTime(1 * 60 * 60 * 1000)).toBe('1 hour')
  })

  it('formats days', () => {
    expect(formatDisappearingMessageTime(3 * 24 * 60 * 60 * 1000)).toBe('3 days')
    expect(formatDisappearingMessageTime(1 * 24 * 60 * 60 * 1000)).toBe('1 day')
  })

  it('formats weeks', () => {
    expect(formatDisappearingMessageTime(2 * 7 * 24 * 60 * 60 * 1000)).toBe('2 weeks')
    expect(formatDisappearingMessageTime(1 * 7 * 24 * 60 * 60 * 1000)).toBe('1 week')
  })

  it('formats combined time units with abbreviations', () => {
    // 1 day 2 hours 30 minutes
    const ms = (24 + 2) * 60 * 60 * 1000 + 30 * 60 * 1000
    const result = formatDisappearingMessageTime(ms)
    expect(result).toContain('d')
    expect(result).toContain('h')
    expect(result).toContain('m')
  })
})

describe('hashString', () => {
  // jsdom lacks TextEncoder and crypto.subtle; Node provides both.
  const originalTextEncoder = (global as any).TextEncoder
  const originalCrypto = (global as any).crypto

  beforeAll(() => {
    ;(global as any).TextEncoder = require('util').TextEncoder
    Object.defineProperty(global, 'crypto', {
      configurable: true,
      value: require('crypto').webcrypto
    })
  })

  afterAll(() => {
    ;(global as any).TextEncoder = originalTextEncoder
    Object.defineProperty(global, 'crypto', { configurable: true, value: originalCrypto })
  })

  it('returns the SHA-256 hex digest', async () => {
    await expect(hashString('hello')).resolves.toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')
  })

  it('is stable for the same input and differs for different input', async () => {
    const a1 = await hashString('test')
    const a2 = await hashString('test')
    const b = await hashString('other')
    expect(a1).toBe(a2)
    expect(a1).not.toBe(b)
  })

  it('returns an empty string when crypto.subtle is unavailable', async () => {
    Object.defineProperty(global, 'crypto', { configurable: true, value: {} })
    await expect(hashString('hello')).resolves.toBe('')
    Object.defineProperty(global, 'crypto', { configurable: true, value: require('crypto').webcrypto })
  })
})

describe('detectOS', () => {
  const originalNavigator = global.navigator

  afterEach(() => {
    Object.defineProperty(global, 'navigator', { value: originalNavigator, writable: true })
  })

  it.each([
    [{ platform: 'MacIntel', userAgent: '' }, 'Mac OS'],
    [{ platform: 'Win32', userAgent: '' }, 'Windows'],
    [{ platform: 'iPhone', userAgent: '' }, 'iOS'],
    [{ platform: 'Linux', userAgent: 'Android' }, 'Android'],
    [{ platform: 'Linux', userAgent: '' }, 'Linux'],
    [{ platform: 'Unknown', userAgent: '' }, null]
  ])('detectOS with %o returns %s', (nav, expected) => {
    Object.defineProperty(window, 'navigator', {
      value: { platform: nav.platform, userAgent: nav.userAgent },
      writable: true
    })
    expect(detectOS()).toBe(expected)
  })
})

describe('detectBrowser', () => {
  const originalNavigator = global.navigator

  afterEach(() => {
    Object.defineProperty(global, 'navigator', { value: originalNavigator, writable: true })
  })

  it.each([
    ['Mozilla/5.0 Chrome/91.0', 'Chrome'],
    ['Mozilla/5.0 Firefox/89.0', 'Firefox'],
    ['Mozilla/5.0 Safari/14.1', 'Safari'],
    ['Mozilla/5.0 Edge/91.0', 'Edge'],
    ['Mozilla/5.0 OPR/77.0', 'Opera'],
    ['Mozilla/5.0 MSIE 11.0', 'Internet Explorer'],
    ['Mozilla/5.0 Trident/7.0', 'Internet Explorer'],
    ['Unknown Browser', '']
  ])('detectBrowser with userAgent %s returns %s', (userAgent, expected) => {
    Object.defineProperty(window, 'navigator', {
      value: { userAgent },
      writable: true
    })
    expect(detectBrowser()).toBe(expected)
  })
})

describe('calculateRenderedImageWidth', () => {
  it('respects max width for wide images', () => {
    const [width] = calculateRenderedImageWidth(800, 400)
    expect(width).toBeLessThanOrEqual(400)
  })

  it('respects max height for tall images', () => {
    const [, height] = calculateRenderedImageWidth(400, 800)
    expect(height).toBeLessThanOrEqual(400)
  })

  it('respects minimum dimensions', () => {
    const [width, height] = calculateRenderedImageWidth(50, 50)
    expect(width).toBeGreaterThanOrEqual(165)
    expect(height).toBeGreaterThanOrEqual(165)
  })

  it('maintains aspect ratio', () => {
    const originalRatio = 800 / 600
    const [width, height] = calculateRenderedImageWidth(800, 600)
    const newRatio = width / height
    // Allow for rounding differences
    expect(Math.abs(originalRatio - newRatio)).toBeLessThan(0.1)
  })

  it('uses custom max dimensions', () => {
    const [width, height] = calculateRenderedImageWidth(1000, 1000, 200, 200)
    expect(width).toBeLessThanOrEqual(200)
    // Note: The function adds +2 to height for padding, so 202 is expected
    expect(height).toBeLessThanOrEqual(202)
  })
})
