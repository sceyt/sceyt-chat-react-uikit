import {
  getVideoAttachmentCacheKeys,
  getVideoThumb,
  parseAttachmentMetadata,
  shouldExtractVideoFirstFrame,
  withVideoThumb
} from './videoPreview'

describe('video thumbnail metadata', () => {
  it('preserves video metadata when adding a remote video_thumb URL', () => {
    expect(withVideoThumb('{"tmb":"thumb","szw":1280,"szh":720,"dur":12}', 'https://cdn/thumb.jpg')).toBe(
      '{"tmb":"thumb","szw":1280,"szh":720,"dur":12,"video_thumb":"https://cdn/thumb.jpg"}'
    )
  })

  it('reads video_thumb from both serialized and object metadata', () => {
    expect(getVideoThumb('{"video_thumb":"https://cdn/string.jpg"}')).toBe('https://cdn/string.jpg')
    expect(getVideoThumb({ video_thumb: 'https://cdn/object.jpg' })).toBe('https://cdn/object.jpg')
  })

  it('prefers a valid video_thumb and safely falls back when it is malformed', () => {
    expect(getVideoThumb('{"video_thumb":"https://cdn/new.jpg","previewImage":"https://cdn/old.jpg"}')).toBe(
      'https://cdn/new.jpg'
    )
    expect(getVideoThumb('{"video_thumb":123,"previewImage":" https://cdn/old.jpg "}')).toBe('https://cdn/old.jpg')
    expect(getVideoThumb('{"video_thumb":"   ","previewImage":false}')).toBeUndefined()
  })

  it('keeps legacy previewImage metadata compatible while new sends use video_thumb', () => {
    expect(getVideoThumb('{"previewImage":"https://cdn/legacy.jpg"}')).toBe('https://cdn/legacy.jpg')
    expect(withVideoThumb('{"previewImage":"https://cdn/legacy.jpg"}', 'https://cdn/new.jpg')).toBe(
      '{"video_thumb":"https://cdn/new.jpg"}'
    )
    expect(getVideoThumb('{"tmb":"thumb"}')).toBeUndefined()
    expect(parseAttachmentMetadata('not-json')).toEqual({})
    expect(shouldExtractVideoFirstFrame('{"tmb":"thumb"}')).toBe(true)
    expect(shouldExtractVideoFirstFrame('{"video_thumb":"https://cdn/thumb.jpg"}')).toBe(false)
    expect(shouldExtractVideoFirstFrame('{"previewImage":"https://cdn/legacy.jpg"}')).toBe(false)
  })

  it('keeps the thumbnail and playable video in separate browser-cache entries', () => {
    expect(
      getVideoAttachmentCacheKeys('https://cdn/video.mp4', '{"video_thumb":"https://cdn/video-thumb.jpg"}')
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
