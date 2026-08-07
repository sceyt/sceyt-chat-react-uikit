import { getReplyLinkPreviewImage, shouldShowLinkPreviewErrorFallback } from './replyPreview'

describe('link reply previews', () => {
  it('uses the link icon fallback after a preview image request fails', () => {
    expect(shouldShowLinkPreviewErrorFallback('https://example.com/preview.jpg', true)).toBe(true)
  })

  it('does not treat a favicon as a reply preview image', () => {
    expect(
      getReplyLinkPreviewImage([{ type: 'link', metadata: JSON.stringify({ tur: 'https://example.com/favicon.ico' }) }])
    ).toBeNull()
  })

  it('keeps a valid preview image visible until it fails to load', () => {
    expect(shouldShowLinkPreviewErrorFallback('https://example.com/preview.jpg', false)).toBe(false)
  })
})
