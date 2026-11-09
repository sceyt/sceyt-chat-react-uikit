import {
  getVideoAttachmentCacheKeys,
  getVideoThumb,
  parseAttachmentMetadata,
  shouldExtractVideoFirstFrame,
  withVideoPreviews,
  withVideoThumb
} from './videoPreview'

describe('video thumbnail metadata', () => {
  it('preserves video metadata when adding a remote pvw URL', () => {
    expect(withVideoThumb('{"tmb":"thumb","szw":1280,"szh":720,"dur":12}', 'https://cdn/thumb.jpg')).toBe(
      '{"tmb":"thumb","szw":1280,"szh":720,"dur":12,"pvw":"https://cdn/thumb.jpg"}'
    )
  })

  it('reads pvw from both serialized and object metadata', () => {
    expect(getVideoThumb('{"pvw":"https://cdn/string.jpg"}')).toBe('https://cdn/string.jpg')
    expect(getVideoThumb({ pvw: 'https://cdn/object.jpg' })).toBe('https://cdn/object.jpg')
  })

  it('prefers a valid pvw and safely falls back when it is malformed', () => {
    expect(getVideoThumb('{"pvw":"https://cdn/new.jpg","previewImage":"https://cdn/old.jpg"}')).toBe(
      'https://cdn/new.jpg'
    )
    expect(getVideoThumb('{"pvw":123,"previewImage":" https://cdn/old.jpg "}')).toBe('https://cdn/old.jpg')
    expect(getVideoThumb('{"pvw":"   ","previewImage":false}')).toBeUndefined()
  })

  it('keeps legacy previewImage metadata compatible while new sends use pvw', () => {
    expect(getVideoThumb('{"previewImage":"https://cdn/legacy.jpg"}')).toBe('https://cdn/legacy.jpg')
    expect(withVideoThumb('{"previewImage":"https://cdn/legacy.jpg"}', 'https://cdn/new.jpg')).toBe(
      '{"pvw":"https://cdn/new.jpg"}'
    )
    expect(getVideoThumb('{"tmb":"thumb"}')).toBeUndefined()
    expect(parseAttachmentMetadata('not-json')).toEqual({})
    expect(shouldExtractVideoFirstFrame('{"tmb":"thumb"}')).toBe(true)
    expect(shouldExtractVideoFirstFrame('{"pvw":"https://cdn/thumb.jpg"}')).toBe(false)
    expect(shouldExtractVideoFirstFrame('{"previewImage":"https://cdn/legacy.jpg"}')).toBe(false)
  })

  it('keeps the thumbnail and playable video in separate browser-cache entries', () => {
    expect(
      getVideoAttachmentCacheKeys('https://cdn/video.mp4', '{"pvw":"https://cdn/video-thumb.jpg"}')
    ).toEqual({
      videoThumb: 'https://cdn/video-thumb.jpg',
      originalVideo: 'https://cdn/video.mp4_original_video_url'
    })
  })

  it('still gives old video messages an original-video cache key without inventing a thumbnail', () => {
    expect(getVideoAttachmentCacheKeys('https://cdn/old-video.mp4', '{"tmb":"inline-thumb"}')).toEqual({
      videoThumb: undefined,
      originalVideo: 'https://cdn/old-video.mp4_original_video_url'
    })
  })
})

describe('withVideoPreviews: preview attachments are shown on their videos', () => {
  const video = (id: string, previewUrl?: string) =>
    ({
      id,
      type: 'video',
      url: `${id}.mp4`,
      metadata: JSON.stringify({ szw: 10, ...(previewUrl ? { pvw: previewUrl } : {}) })
    }) as any
  const preview = (id: string) => ({ id, type: 'preview', url: `https://cdn/${id}` }) as any
  const image = (id: string) => ({ id, type: 'image', url: `${id}.png`, metadata: '{}' }) as any

  it('hides the previews; each video gets the preview its pvw names, whatever the order', () => {
    const first = preview('p1')
    const second = preview('p2')

    // The server may return the previews in another order than they were sent.
    const shown = withVideoPreviews([
      second,
      video('v1', 'https://cdn/p1'),
      image('i1'),
      first,
      video('v2', 'https://cdn/p2')
    ])

    expect(shown.map((attachment) => attachment.id)).toEqual(['v1', 'i1', 'v2'])
    expect(shown[0].videoPreviewAttachment).toBe(first)
    expect(shown[2].videoPreviewAttachment).toBe(second)
    expect(getVideoThumb(shown[0].metadata)).toBe('https://cdn/p1')
    expect(shouldExtractVideoFirstFrame(shown[2].metadata)).toBe(false)
  })

  it('a message without previews is returned as it is', () => {
    const attachments = [video('v1'), image('i1')]

    expect(withVideoPreviews(attachments)).toBe(attachments)
  })

  it('a video whose pvw names no preview attachment (a plain preview) is shown as it is', () => {
    const plain = video('v1', 'https://cdn/plain-preview')

    const shown = withVideoPreviews([plain, preview('p1')])

    expect(shown).toEqual([plain])
  })

  it('a video without pvw gets no preview, even when the message has one', () => {
    const shown = withVideoPreviews([video('v1'), preview('p1')])

    expect(shown[0].videoPreviewAttachment).toBeUndefined()
  })
})
