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
      "http://172.16.1.139:5601/app/discover#/?_g=(filters:!(),refreshInterval:(pause:!t,value:60000),time:(from:now-1h,to:now))&_a=(columns:!(),dataSource:(dataViewId:'0f5cf92b-9fad-47b9-8649-3005f3e44436',type:dataView),filters:!(),interval:auto,query:(language:kuery,query:''),sort:!(!('@timestamp',desc)))"

    const result = extractUrlMatches(kibanaUrl)
    expect(result).toHaveLength(1)
    expect(result![0].url).toBe(kibanaUrl)
    expect(result![0].text).toBe(kibanaUrl)
  })

  it('returns full Kibana URL even when surrounded by text', () => {
    const kibanaUrl =
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
      "http://172.16.1.139:5601/app/discover#/?_g=(filters:!(),refreshInterval:(pause:!t,value:60000),time:(from:now-1h,to:now))&_a=(columns:!(),dataSource:(dataViewId:'0f5cf92b-9fad-47b9-8649-3005f3e44436',type:dataView),filters:!(),interval:auto,query:(language:kuery,query:''),sort:!(!('@timestamp',desc)))"
    const truncatedByLinkify =
      'http://172.16.1.139:5601/app/discover#/?_g=(filters:!(),refreshInterval:(pause:!t,value:60000),time:(from:now-1h,to:now))'

    const result = extractUrlMatches(fullUrl)
    expect(result).toHaveLength(1)
    expect(result![0].url.length).toBeGreaterThan(truncatedByLinkify.length)
    expect(result![0].url).toBe(fullUrl)
  })
})
