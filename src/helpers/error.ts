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
  const errorType = fromValue(value)
  return errorType?.isResendable ?? true
}
