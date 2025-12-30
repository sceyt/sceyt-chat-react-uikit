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
export const convertMp3ToAac = async (file: File, messageId: string): Promise<File> => {
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

    // Clean up any existing files first to avoid conflicts
    try {
      await ffmpeg.deleteFile(`${messageId}_input.mp3`)
    } catch (e) {
      // File doesn't exist, that's fine
    }
    try {
      await ffmpeg.deleteFile(`${messageId}_output.m4a`)
    } catch (e) {
      // File doesn't exist, that's fine
    }

    // Write input file to FFmpeg's virtual filesystem
    const inputData = await fetchFile(file)
    await ffmpeg.writeFile(`${messageId}_input.mp3`, inputData)

    // Convert MP3 to AAC (m4a) with Safari-compatible settings
    await ffmpeg.exec([
      '-i',
      `${messageId}_input.mp3`,
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      `${messageId}_output.m4a`
    ])

    // Read the converted file
    const data = await ffmpeg.readFile(`${messageId}_output.m4a`)

    // Clean up virtual filesystem
    try {
      await ffmpeg.deleteFile(`${messageId}_input.mp3`)
    } catch (e) {
      // Ignore cleanup errors
    }
    try {
      await ffmpeg.deleteFile(`${messageId}_output.m4a`)
    } catch (e) {
      // Ignore cleanup errors
    }

    // Create a new File object with the converted data
    // FileData from FFmpeg can be Uint8Array, ArrayBuffer, or string
    // Convert to Uint8Array for consistent handling
    let dataArray: Uint8Array
    if (data instanceof Uint8Array) {
      dataArray = data
    } else if (typeof data === 'string') {
      // If it's a string (base64), convert to Uint8Array
      const binaryString = atob(data)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      dataArray = bytes
    } else {
      // Assume ArrayBuffer or ArrayBufferLike
      dataArray = new Uint8Array(data as unknown as ArrayBufferLike)
    }
    // Create ArrayBuffer from Uint8Array to avoid SharedArrayBuffer issues
    const arrayBuffer = dataArray.buffer.slice(
      dataArray.byteOffset,
      dataArray.byteOffset + dataArray.byteLength
    ) as ArrayBuffer
    const blob = new Blob([arrayBuffer], { type: 'audio/mp4' })
    const convertedFile = new File([blob], `${messageId}_${file.name.replace('.mp3', '.m4a')}`, {
      type: 'audio/mp4',
      lastModified: file.lastModified
    })

    return convertedFile
  } catch (error) {
    log.error('Failed to convert MP3 to AAC:', error)
    throw error
  }
}

/**
 * Converts audio file to Safari-compatible format if needed
 * For Safari: converts MP3 to AAC (m4a)
 * For other browsers: returns original file
 * @param file - The audio file to potentially convert
 * @returns Promise resolving to the file (converted if Safari, original otherwise)
 */
export const convertAudioForSafari = async (file: File, messageId: string): Promise<File> => {
  // Only convert if it's Safari and the file is MP3
  if (isSafari() && file.type === 'audio/mpeg' && file.name.endsWith('.mp3')) {
    try {
      return await convertMp3ToAac(file, messageId)
    } catch (error) {
      log.warn('Audio conversion failed, using original file:', error)
      // Fallback to original file if conversion fails
      return file
    }
  }

  // Return original file for non-Safari browsers or non-MP3 files
  return file
}
