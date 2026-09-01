import {
  getMediaAttachmentValidationError,
  hasSendableTextOrPoll,
  isDefaultSupportedMediaMimeType
} from './sendMessageUtils'

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

describe('isDefaultSupportedMediaMimeType', () => {
  it.each([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/jfif',
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-ms-wmv',
    'video/x-flv',
    'video/webm'
  ])('classifies %s as supported drag-and-drop media', (mimeType) => {
    expect(isDefaultSupportedMediaMimeType(mimeType)).toBe(true)
  })

  it.each(['image/svg+xml', 'image/webp', 'application/pdf', 'text/plain', ''])(
    'does not classify %s as media',
    (mimeType) => {
      expect(isDefaultSupportedMediaMimeType(mimeType)).toBe(false)
    }
  )
})

describe('getMediaAttachmentValidationError', () => {
  it('rejects SVG when sent as media with the default Choose Media extensions', () => {
    expect(getMediaAttachmentValidationError({ name: 'vector.svg', size: 1024 }, {})).toContain('Invalid file type')
  })

  it('accepts a supported image extension', () => {
    expect(getMediaAttachmentValidationError({ name: 'photo.PNG', size: 1024 }, {})).toBeNull()
  })

  it.each(['jpg', 'jpeg', 'png', 'gif', 'mp4', 'mov', 'avi', 'wmv', 'flv', 'webm', 'jfif'])(
    'accepts the default .%s media extension',
    (extension) => {
      expect(getMediaAttachmentValidationError({ name: `media.${extension}`, size: 1024 }, {})).toBeNull()
    }
  )

  it('rejects media that exceeds the configured size limit', () => {
    expect(
      getMediaAttachmentValidationError(
        { name: 'large.mp4', size: 2 * 1024 },
        { sizeLimitKb: 1, sizeLimitMessage: 'Media is too large' }
      )
    ).toBe('Media is too large')
  })

  it('uses custom media extensions for all upload sources', () => {
    expect(
      getMediaAttachmentValidationError(
        { name: 'animation.svg', size: 1024 },
        { allowedExtensions: ['svg'], invalidTypeMessage: 'Unsupported media' }
      )
    ).toBeNull()
  })

  it('enforces a custom allowlist case-insensitively', () => {
    expect(
      getMediaAttachmentValidationError(
        { name: 'photo.JPG', size: 1024 },
        { allowedExtensions: ['.png'], invalidTypeMessage: 'Unsupported media' }
      )
    ).toBe('Unsupported media')
  })
})
