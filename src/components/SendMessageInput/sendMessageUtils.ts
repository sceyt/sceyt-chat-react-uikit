export const hasSendableTextOrPoll = (messageText: string, isPoll: boolean) => Boolean(messageText.trim() || isPoll)

export const DEFAULT_MEDIA_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'mp4', 'mov', 'avi', 'wmv', 'flv', 'webm', 'jfif']

const DEFAULT_MEDIA_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/jfif',
  'image/pjpeg',
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/avi',
  'video/x-ms-wmv',
  'video/x-flv',
  'video/webm'
])

export const isDefaultSupportedMediaMimeType = (mimeType: string) =>
  DEFAULT_MEDIA_MIME_TYPES.has(mimeType.toLowerCase())

type MediaAttachmentValidationOptions = {
  allowedExtensions?: string[]
  sizeLimitKb?: number
  invalidTypeMessage?: string
  sizeLimitMessage?: string
}

export const getMediaAttachmentValidationError = (
  file: Pick<File, 'name' | 'size'>,
  { allowedExtensions, sizeLimitKb, invalidTypeMessage, sizeLimitMessage }: MediaAttachmentValidationOptions
): string | null => {
  if (sizeLimitKb && file.size / 1024 > sizeLimitKb) {
    return sizeLimitMessage ?? `File size exceeds the limit of ${sizeLimitKb} KB.`
  }

  const supportedExtensions = (allowedExtensions?.length ? allowedExtensions : DEFAULT_MEDIA_EXTENSIONS).map(
    (extension) => extension.replace(/^\./, '').toLowerCase()
  )
  const extension = file.name.split('.').pop()?.toLowerCase()

  if (!extension || !supportedExtensions.includes(extension)) {
    return invalidTypeMessage ?? `Invalid file type. Allowed extensions are: ${supportedExtensions.join(', ')}.`
  }

  return null
}
