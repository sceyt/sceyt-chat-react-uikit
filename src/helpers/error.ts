export interface SDKErrorType {
  readonly value: string
  readonly isResendable: boolean
}

export const SDKErrorTypeEnum = {
  BadRequest: {
    value: 'BadRequest',
    isResendable: false
  } as SDKErrorType,
  BadParam: {
    value: 'BadParam',
    isResendable: false
  } as SDKErrorType,
  NotFound: {
    value: 'NotFound',
    isResendable: false
  } as SDKErrorType,
  NotAllowed: {
    value: 'NotAllowed',
    isResendable: false
  } as SDKErrorType,
  TooLargeRequest: {
    value: 'TooLargeRequest',
    isResendable: false
  } as SDKErrorType,
  InternalError: {
    value: 'InternalError',
    isResendable: true
  } as SDKErrorType,
  TooManyRequests: {
    value: 'TooManyRequests',
    isResendable: true
  } as SDKErrorType,
  Authentication: {
    value: 'Authentication',
    isResendable: true
  } as SDKErrorType,
  // Client-side error: the attachment's source File/Blob is no longer available
  // (e.g. after a page reload), so resending can never succeed.
  AttachmentUnavailable: {
    value: 'AttachmentUnavailable',
    isResendable: false
  } as SDKErrorType
} as const

/**
 * Get SDK error type from string value
 * @param value - The error type string value
 * @returns The SDKErrorType if found, null otherwise
 */
export const fromValue = (value: string | null | undefined): SDKErrorType | null => {
  if (!value) return null

  const entries = Object.values(SDKErrorTypeEnum)
  return entries.find((entry) => entry.value === value) || null
}

/**
 * Check if an error type is resendable
 * @param value - The error type string value
 * @returns true if the error type is resendable, false otherwise
 */
export const isResendableError = (value: string | null | undefined): boolean => {
  if (!value) {
    return true
  }
  const errorType = fromValue(value)
  return errorType?.isResendable ?? true
}

/**
 * Create an error for attachments whose source File/Blob is gone.
 * Carries type: 'AttachmentUnavailable' so isResendableError classifies it
 * as non-resendable and the message is not retried on every reconnect.
 * @param message - The error message
 * @returns The error with the AttachmentUnavailable type
 */
export const createAttachmentUnavailableError = (message: string): Error => {
  const error: Error & { type?: string } = new Error(message)
  error.type = SDKErrorTypeEnum.AttachmentUnavailable.value
  return error
}
