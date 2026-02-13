import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import log from 'loglevel'

let ffmpegInstance: FFmpeg | null = null
let isFFmpegLoading = false
let ffmpegLoadPromise: Promise<void> | null = null

/**
 * Detects if the current browser is Safari
 * Uses the accurate detection method that excludes Chrome (which also includes "Safari" in user agent)
 */
export const isSafari = (): boolean => {
  if (typeof window === 'undefined' || !window.navigator) {
    return false
  }
  const userAgent = window.navigator.userAgent
  return /^((?!chrome|android).)*safari/i.test(userAgent)
}

/**
 * Initializes FFmpeg instance (lazy loading)
 */
const initFFmpeg = async (): Promise<FFmpeg> => {
  if (ffmpegInstance) {
    return ffmpegInstance
  }

  if (isFFmpegLoading && ffmpegLoadPromise) {
    return ffmpegLoadPromise.then(() => {
      if (!ffmpegInstance) {
        throw new Error('FFmpeg failed to initialize')
      }
      return ffmpegInstance
    })
  }

  isFFmpegLoading = true
  ffmpegLoadPromise = (async () => {
    try {
      const ffmpeg = new FFmpeg()
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'

      // Load FFmpeg core
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
      })

      ffmpegInstance = ffmpeg
      isFFmpegLoading = false
    } catch (error) {
      isFFmpegLoading = false
      ffmpegLoadPromise = null
      ffmpegInstance = null
      log.error('Failed to load FFmpeg:', error)
      throw error
    }
  })()

  await ffmpegLoadPromise
  if (!ffmpegInstance) {
    throw new Error('FFmpeg instance is null after initialization')
  }
  return ffmpegInstance
}

/**
 * Converts MP3 file to AAC (m4a) format for Safari compatibility
 * @param file - The MP3 file to convert
 * @returns Promise resolving to converted File object (m4a format)
 */
/**
 * Gets the file extension based on MIME type
 */
const getExtensionForType = (mimeType: string): string => {
  const typeMap: Record<string, string> = {
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/opus': 'opus',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/mp4': 'm4a',
    'audio/aac': 'aac'
  }
  // Handle types with codecs like "audio/webm;codecs=opus"
  const baseType = mimeType.split(';')[0].trim().toLowerCase()
  return typeMap[baseType] || 'bin'
}

export const convertToAac = async (file: File, messageId: string): Promise<File> => {
  try {
    // Validate file size (limit to 50MB to avoid memory issues)
    const maxSize = 50 * 1024 * 1024 // 50MB
    if (file.size > maxSize) {
      throw new Error(`File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (50MB)`)
    }

    if (file.size === 0) {
      throw new Error('File is empty')
    }

    const ffmpeg = await initFFmpeg()

    // Determine input extension from file type so FFmpeg can detect the format
    const inputExt = getExtensionForType(file.type)
    const inputName = `${messageId}_input.${inputExt}`
    const outputName = `${messageId}_output.m4a`

    // Clean up any existing files first to avoid conflicts
    try {
      await ffmpeg.deleteFile(inputName)
    } catch (e) {
      // File doesn't exist, that's fine
    }
    try {
      await ffmpeg.deleteFile(outputName)
    } catch (e) {
      // File doesn't exist, that's fine
    }

    // Write input file to FFmpeg's virtual filesystem
    const inputData = await fetchFile(file)
    await ffmpeg.writeFile(inputName, inputData)

    // Convert to AAC (m4a) with Safari-compatible settings
    await ffmpeg.exec(['-i', inputName, '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', outputName])

    // Read the converted file
    const data = await ffmpeg.readFile(outputName)

    // Clean up virtual filesystem
    try {
      await ffmpeg.deleteFile(inputName)
    } catch (e) {
      // Ignore cleanup errors
    }
    try {
      await ffmpeg.deleteFile(outputName)
    } catch (e) {
      // Ignore cleanup errors
    }

    // Create a new File object with the converted data
    let dataArray: Uint8Array
    if (data instanceof Uint8Array) {
      dataArray = data
    } else if (typeof data === 'string') {
      const binaryString = atob(data)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      dataArray = bytes
    } else {
      dataArray = new Uint8Array(data as unknown as ArrayBufferLike)
    }
    const arrayBuffer = dataArray.buffer.slice(
      dataArray.byteOffset,
      dataArray.byteOffset + dataArray.byteLength
    ) as ArrayBuffer
    const blob = new Blob([arrayBuffer], { type: 'audio/mp4' })
    const convertedFile = new File([blob], `${messageId}_converted.m4a`, {
      type: 'audio/mp4',
      lastModified: file.lastModified
    })

    return convertedFile
  } catch (error) {
    log.error('Failed to convert audio to AAC:', error)
    throw error
  }
}

// Keep old name for backwards compatibility
export const convertMp3ToAac = convertToAac

// Safari-supported audio MIME types (no conversion needed)
const SAFARI_SUPPORTED_TYPES = new Set([
  'audio/mp4',
  'audio/aac',
  'audio/x-m4a',
  'audio/wav',
  'audio/x-wav',
  'audio/aiff'
])

/**
 * Converts audio file to Safari-compatible format if needed
 * For Safari: converts unsupported formats (webm, ogg, opus, mp3) to AAC (m4a)
 * For other browsers: returns original file
 * @param file - The audio file to potentially convert
 * @returns Promise resolving to the file (converted if Safari, original otherwise)
 */
export const convertAudioForSafari = async (file: File, messageId: string): Promise<File> => {
  if (!isSafari()) {
    return file
  }

  // Check if the format is already Safari-compatible
  const baseType = file.type.split(';')[0].trim().toLowerCase()
  if (SAFARI_SUPPORTED_TYPES.has(baseType)) {
    return file
  }

  // Convert unsupported format to AAC
  try {
    return await convertToAac(file, messageId)
  } catch (error) {
    log.warn('Audio conversion failed, using original file:', error)
    return file
  }
}
