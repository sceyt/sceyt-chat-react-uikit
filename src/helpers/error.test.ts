import {
  createAttachmentUnavailableError,
  isResendableError,
  isRetryableLoadError,
  REQUEST_TIMEOUT_ERROR_CODE,
  SERVICE_UNAVAILABLE_ERROR_CODE,
  UNKNOWN_ERROR_CODE,
  SDKErrorTypeEnum
} from './error'

describe('isResendableError', () => {
  it('treats unknown/absent error types as resendable (network errors carry no type)', () => {
    expect(isResendableError(undefined)).toBe(true)
    expect(isResendableError(null)).toBe(true)
    expect(isResendableError('')).toBe(true)
    expect(isResendableError('SomeUnknownType')).toBe(true)
  })

  it('keeps SDK classifications', () => {
    expect(isResendableError(SDKErrorTypeEnum.BadRequest.value)).toBe(false)
    expect(isResendableError(SDKErrorTypeEnum.InternalError.value)).toBe(true)
  })

  it('classifies AttachmentUnavailable as non-resendable', () => {
    expect(isResendableError(SDKErrorTypeEnum.AttachmentUnavailable.value)).toBe(false)
  })
})

describe('createAttachmentUnavailableError', () => {
  it('creates an Error carrying the AttachmentUnavailable type', () => {
    const error = createAttachmentUnavailableError('file is gone')
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('file is gone')
    expect((error as Error & { type?: string }).type).toBe('AttachmentUnavailable')
    expect(isResendableError((error as Error & { type?: string }).type)).toBe(false)
  })
})

describe('isRetryableLoadError', () => {
  it('uses the SDK clientErrors codes', () => {
    expect(UNKNOWN_ERROR_CODE).toBe(9900)
    expect(REQUEST_TIMEOUT_ERROR_CODE).toBe(9902)
    expect(SERVICE_UNAVAILABLE_ERROR_CODE).toBe(503)
  })

  it.each([
    ['unknown error 9900', { code: 9900 }],
    ['request timeout 9902', { code: 9902, message: 'Request timeout' }],
    ['service unavailable 503', { code: 503 }],
    ['server internal error', { type: 'InternalError', message: 'Internal error' }],
    ['an Error carrying a retryable code', Object.assign(new Error('Request timeout'), { code: 9902 })]
  ])('is true for %s', (_label, error) => {
    expect(isRetryableLoadError(error)).toBe(true)
  })

  it.each([
    ['invalid initialization 9901', { code: 9901 }],
    ['connection required 9903', { code: 9903 }],
    ['network error 9904', { code: 9904 }],
    ['query in progress 9908', { code: 9908 }],
    ['too large message 1203', { code: 1203 }],
    ['a non-retryable server type', { type: 'BadRequest' }],
    ['code as a string', { code: '9902' }],
    ['a plain Error', new Error('Request timeout')],
    ['undefined', undefined],
    ['null', null],
    ['a string', 'timeout']
  ])('is false for %s', (_label, error) => {
    expect(isRetryableLoadError(error)).toBe(false)
  })
})
