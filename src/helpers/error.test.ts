import { createAttachmentUnavailableError, isResendableError, SDKErrorTypeEnum } from './error'

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
