import { extractUrlMatches } from './index'

describe('extractUrlMatches', () => {
  // ─── no URL ───────────────────────────────────────────────────────────────

  it('returns null when text has no URL', () => {
    expect(extractUrlMatches('hello world')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(extractUrlMatches('')).toBeNull()
  })

  // ─── simple protocol URLs ─────────────────────────────────────────────────

  it('returns a simple https URL as a single match', () => {
    const result = extractUrlMatches('check out https://example.com today')
    expect(result).toHaveLength(1)
    expect(result![0]).toEqual({ text: 'https://example.com', url: 'https://example.com' })
  })

  it('returns a simple http URL without upgrading (explicit protocol)', () => {
    const result = extractUrlMatches('visit http://example.com please')
    expect(result).toHaveLength(1)
    expect(result![0]).toEqual({ text: 'http://example.com', url: 'http://example.com' })
  })

  it('returns a URL with path and query params in full', () => {
    const result = extractUrlMatches('https://example.com/path?foo=bar&baz=qux')
    expect(result).toHaveLength(1)
    expect(result![0].url).toBe('https://example.com/path?foo=bar&baz=qux')
  })

  // ─── complex fragments (the Kibana / rison bug) ───────────────────────────

  it('returns the full Kibana rison URL without truncation', () => {
    const kibanaUrl =
      // eslint-disable-next-line max-len
      "http://172.16.1.139:5601/app/discover#/?_g=(filters:!(),refreshInterval:(pause:!t,value:60000),time:(from:now-1h,to:now))&_a=(columns:!(),dataSource:(dataViewId:'0f5cf92b-9fad-47b9-8649-3005f3e44436',type:dataView),filters:!(),interval:auto,query:(language:kuery,query:''),sort:!(!('@timestamp',desc)))"

    const result = extractUrlMatches(kibanaUrl)
    expect(result).toHaveLength(1)
    expect(result![0].url).toBe(kibanaUrl)
    expect(result![0].text).toBe(kibanaUrl)
  })

  it('returns full Kibana URL even when surrounded by text', () => {
    const kibanaUrl =
      // eslint-disable-next-line max-len
      "http://172.16.1.139:5601/app/discover#/?_g=(filters:!(),refreshInterval:(pause:!t,value:60000),time:(from:now-1h,to:now))&_a=(columns:!(),dataSource:(dataViewId:'abc',type:dataView),filters:!(),interval:auto,query:(language:kuery,query:''),sort:!(!('@timestamp',desc)))"
    const text = `see logs here ${kibanaUrl} and let me know`

    const result = extractUrlMatches(text)
    expect(result).toHaveLength(1)
    expect(result![0].url).toBe(kibanaUrl)
  })

  it('does not truncate at the first balanced closing paren', () => {
    // linkify-it would stop at "to:now)" — regex must go further
    const url = 'https://example.com/path?q=(a:!(1),b:!(2))'
    const result = extractUrlMatches(url)
    expect(result).toHaveLength(1)
    expect(result![0].url).toBe(url)
  })

  it('handles URLs with exclamation marks in fragments', () => {
    const url = 'https://example.com/page#section!important'
    const result = extractUrlMatches(url)
    expect(result).toHaveLength(1)
    expect(result![0].url).toBe(url)
  })

  it('handles URLs with single quotes in fragments', () => {
    const url = "https://example.com/search?q=(name:'John')"
    const result = extractUrlMatches(url)
    expect(result).toHaveLength(1)
    expect(result![0].url).toBe(url)
  })

  // ─── bare-domain fallback ─────────────────────────────────────────────────

  it('detects bare-domain URLs via linkify fallback and upgrades to https', () => {
    const result = extractUrlMatches('visit example.com for more')
    expect(result).toHaveLength(1)
    expect(result![0].text).toBe('example.com')
    expect(result![0].url).toBe('https://example.com')
  })

  it('does not duplicate a bare domain that linkify normalises to http', () => {
    // schema '' means linkify added http:// internally — should be upgraded to https://
    const result = extractUrlMatches('go to google.com')
    expect(result).toHaveLength(1)
    expect(result![0].url).toMatch(/^https:\/\//)
  })

  // ─── multiple URLs ────────────────────────────────────────────────────────

  it('returns multiple protocol URLs in document order', () => {
    const text = 'first https://alpha.com then https://beta.com/path?x=1'
    const result = extractUrlMatches(text)
    expect(result).toHaveLength(2)
    expect(result![0].url).toBe('https://alpha.com')
    expect(result![1].url).toBe('https://beta.com/path?x=1')
  })

  it('returns both a protocol URL and a bare-domain URL in order', () => {
    const text = 'see https://example.com and also google.com'
    const result = extractUrlMatches(text)
    expect(result).toHaveLength(2)
    expect(result![0].url).toBe('https://example.com')
    expect(result![1].text).toBe('google.com')
  })

  // ─── linkify-it regression: old behaviour would truncate ─────────────────

  it('captures more of the URL than linkify-it alone would', () => {
    // linkify-it stops after "to:now)" — the result must be longer
    const fullUrl =
      // eslint-disable-next-line max-len
      "http://172.16.1.139:5601/app/discover#/?_g=(filters:!(),refreshInterval:(pause:!t,value:60000),time:(from:now-1h,to:now))&_a=(columns:!(),dataSource:(dataViewId:'0f5cf92b-9fad-47b9-8649-3005f3e44436',type:dataView),filters:!(),interval:auto,query:(language:kuery,query:''),sort:!(!('@timestamp',desc)))"
    const truncatedByLinkify =
      'http://172.16.1.139:5601/app/discover#/?_g=(filters:!(),refreshInterval:(pause:!t,value:60000),time:(from:now-1h,to:now))'

    const result = extractUrlMatches(fullUrl)
    expect(result).toHaveLength(1)
    expect(result![0].url.length).toBeGreaterThan(truncatedByLinkify.length)
    expect(result![0].url).toBe(fullUrl)
  })

  // ─── security: only http(s) and bare domains become links ──────────────────

  it('does NOT match javascript: URLs (XSS prevention)', () => {
    const result = extractUrlMatches('click javascript:alert(1) for fun')
    expect(result).toBeNull()
  })

  it('does NOT match data: URLs', () => {
    const result = extractUrlMatches('see data:text/html,<script>alert(1)</script>')
    expect(result).toBeNull()
  })

  it('does NOT match ftp:// URLs', () => {
    const result = extractUrlMatches('download from ftp://files.example.com/file.zip')
    expect(result).toBeNull()
  })

  it('does NOT match file:// URLs', () => {
    const result = extractUrlMatches('open file:///etc/passwd')
    expect(result).toBeNull()
  })

  it('does NOT match mailto: URLs', () => {
    const result = extractUrlMatches('email mailto:user@example.com')
    expect(result).toBeNull()
  })

  it('does NOT match plain email addresses', () => {
    const result = extractUrlMatches('contact user@example.com for help')
    expect(result).toBeNull()
  })

  // ─── duplicate URLs ─────────────────────────────────────────────────────────

  it('returns the same URL twice when it appears twice in text, in correct order', () => {
    const text = 'first https://example.com then again https://example.com'
    const result = extractUrlMatches(text)
    expect(result).toHaveLength(2)
    expect(result![0].url).toBe('https://example.com')
    expect(result![1].url).toBe('https://example.com')
  })

  // ─── special URL formats ────────────────────────────────────────────────────

  it('matches localhost with http:// protocol', () => {
    // Note: bare localhost:3000 is NOT detected because linkify-it requires a valid TLD
    // Only the protocol version works
    const result = extractUrlMatches('running on http://localhost:3000')
    expect(result).toHaveLength(1)
    expect(result![0].url).toBe('http://localhost:3000')
  })

  it('matches IP address with port', () => {
    const result = extractUrlMatches('api at http://192.168.1.1:8080/api')
    expect(result).toHaveLength(1)
    expect(result![0].url).toBe('http://192.168.1.1:8080/api')
  })

  it('matches URL with #fragment', () => {
    const result = extractUrlMatches('see https://docs.example.com/page#section-2')
    expect(result).toHaveLength(1)
    expect(result![0].url).toBe('https://docs.example.com/page#section-2')
  })

  it('matches unicode/IDN domain via linkify', () => {
    // IDN domains like münchen.de are handled by linkify-it
    const result = extractUrlMatches('visit münchen.de for info')
    expect(result).toHaveLength(1)
    expect(result![0].text).toBe('münchen.de')
  })

  // ─── trailing punctuation ──────────────────────────────────────────────────
  // BUG: The regex /https?:\/\/\S+/g captures trailing punctuation as part of the URL.
  // These tests document the CURRENT (buggy) behavior.

  it.each([
    [
      'a balanced paren at the end',
      'https://en.wikipedia.org/wiki/Foo_(bar)',
      'https://en.wikipedia.org/wiki/Foo_(bar)'
    ],
    [
      'a balanced paren followed by a period',
      'see https://en.wikipedia.org/wiki/Foo_(bar).',
      'https://en.wikipedia.org/wiki/Foo_(bar)'
    ],
    ['a URL inside parens with a balanced paren', '(https://x.com/a_(b))', 'https://x.com/a_(b)'],
    ['an exclamation and question mark after the URL', 'look https://example.com/page?!', 'https://example.com/page'],
    ['a closing bracket without an opener', '[https://example.com]', 'https://example.com'],
    ['a query string ending in a letter', 'https://example.com/?q=1&b=x.', 'https://example.com/?q=1&b=x']
  ])('trims trailing punctuation correctly with %s', (_label, text, expected) => {
    const result = extractUrlMatches(text)
    expect(result).toHaveLength(1)
    expect(result![0].url).toBe(expected)
    expect(result![0].text).toBe(expected)
  })

  it('keeps the closing parens of a Kibana URL that ends a sentence', () => {
    const url = "https://k.example/app#/?_a=(query:(language:kuery,query:''),sort:!(!('@timestamp',desc)))"
    const result = extractUrlMatches(`logs: ${url}.`)
    expect(result![0].url).toBe(url)
  })

  it('does not capture a trailing period: "see https://example.com."', () => {
    const result = extractUrlMatches('see https://example.com.')
    expect(result).toHaveLength(1)
    // Expected: URL should be 'https://example.com' (no trailing period)
    expect(result![0].url).toBe('https://example.com')
    expect(result![0].text).toBe('https://example.com')
  })

  it('does not capture a trailing comma: "https://example.com, and more"', () => {
    const result = extractUrlMatches('https://example.com, and more')
    expect(result).toHaveLength(1)
    // Expected: URL should be 'https://example.com' (no trailing comma)
    expect(result![0].url).toBe('https://example.com')
  })

  it('does not capture surrounding parens: "(https://example.com)"', () => {
    const result = extractUrlMatches('(https://example.com)')
    expect(result).toHaveLength(1)
    // Expected: URL should be 'https://example.com' (no surrounding parens)
    expect(result![0].url).toBe('https://example.com')
  })

  it('does not capture surrounding double quotes: \'"https://example.com"\'', () => {
    const result = extractUrlMatches('"https://example.com"')
    expect(result).toHaveLength(1)
    // Expected: URL should be 'https://example.com' (no surrounding quotes)
    expect(result![0].url).toBe('https://example.com')
  })

  // NOTE: The Kibana tests DEPEND on capturing chars after balanced parens,
  // but normal prose punctuation should be stripped. The regex cannot distinguish
  // both cases reliably without smarter heuristics.
})
