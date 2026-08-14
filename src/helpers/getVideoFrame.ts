import { setAttachmentToCache } from './attachmentsCache'
import { binaryToBase64, calculateSize, resizeImageWithPica } from './resizeImage'
import { rgbaToThumbHash } from './thumbhash'
import {
  inspectVideoBlob,
  isFirefox,
  isQuickTimeContainer,
  NATIVE_VIDEO_TYPES,
  VideoContainerInfo
} from './videoContainer'
import { remuxToMp4 } from './videoConversion'
import log from 'loglevel'

export interface VideoFirstFrameResult {
  frameBlobUrl: string
  blob: Blob
  width: number
  height: number
  duration: number
}

export interface VideoThumbnailFrame {
  thumb: string
  width: number
  height: number
  duration: number
  blob: Blob
  frameBlobUrl: string
}

interface VideoFrameExtractionOptions {
  applyDevicePixelRatio?: boolean
  preserveAspectRatio?: boolean
  maxOutputBytes?: number
  fallbackMaxDimension?: number
}

// 1280px keeps video previews sharp enough for modern high-density displays
// while still being far smaller than the original video frame.
export const VIDEO_PREVIEW_MAX_DIMENSION = 1280
export const VIDEO_PREVIEW_FALLBACK_MAX_DIMENSION = 960
export const VIDEO_PREVIEW_JPEG_QUALITY = 0.85
export const VIDEO_PREVIEW_MIN_JPEG_QUALITY = 0.65
export const VIDEO_PREVIEW_MAX_BYTES = 500 * 1024

export interface DownloadProgress {
  loaded: number
  total: number
}

/** Reads a fetch response while reporting byte progress when streaming is available. */
export const readResponseBlobWithProgress = async (
  response: Response,
  onProgress?: (progress: DownloadProgress) => void,
  fallbackTotal: number = 0
): Promise<Blob> => {
  const contentLength = Number(response.headers?.get?.('content-length'))
  const total = Number.isFinite(contentLength) && contentLength > 0 ? contentLength : fallbackTotal
  const reportProgress = (loaded: number) => {
    onProgress?.({ loaded, total: total || loaded })
  }

  if (!response.body || typeof response.body.getReader !== 'function') {
    const blob = await response.blob()
    reportProgress(blob.size)
    return blob
  }

  const reader = response.body.getReader()
  const chunks: BlobPart[] = []
  let loaded = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      chunks.push(value)
      loaded += value.byteLength
      reportProgress(loaded)
    }
  }

  return new Blob(chunks, { type: response.headers?.get?.('content-type') || '' })
}

// Callers pass maxWidth/maxHeight as CSS render sizes. Scaling by
// devicePixelRatio (capped to avoid oversized payloads on 3x+ screens) gives
// the output enough native pixels to stay sharp on Retina/HiDPI displays —
// `quality` alone can't fix this, it only controls compression artifacts.
export const scaleForDevicePixelRatio = (value?: number, cap: number = 2): number | undefined => {
  if (!value) {
    return value
  }
  const dpr = Math.min(window.devicePixelRatio || 1, cap)
  return value * dpr
}

// Return a blob whose declared type a video element can trust in all browsers,
// along with what the bytes revealed about the container.
const normalizeVideoBlob = async (blob: Blob): Promise<{ safeBlob: Blob; info: VideoContainerInfo }> => {
  // Always inspect the bytes — even a "clean" declared type like video/mp4 can
  // hide a QuickTime container that some browsers cannot demux.
  const info = await inspectVideoBlob(blob)
  const baseType = (blob.type || '').split(';')[0].trim().toLowerCase()
  if (NATIVE_VIDEO_TYPES.has(baseType)) {
    // Strip invalid params like "; charset=utf-8" that S3 can attach.
    return { safeBlob: baseType === blob.type ? blob : new Blob([blob], { type: baseType }), info }
  }
  const relabeledType = info.mimeType || 'video/mp4'
  return { safeBlob: new Blob([blob], { type: relabeledType }), info }
}

const FRAME_LOAD_TIMEOUT_MS = 8000

export const calculateVideoPreviewFrameSize = (width: number, height: number, maxDimension: number) => {
  const scale = Math.min(1, maxDimension / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  }
}

const canvasToJpegBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> =>
  new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))

const encodeFrameForPreview = async (
  canvas: HTMLCanvasElement,
  quality: number,
  maxOutputBytes?: number,
  fallbackMaxDimension?: number
): Promise<Blob | null> => {
  let encoded = await canvasToJpegBlob(canvas, quality)
  if (!encoded || !maxOutputBytes || encoded.size <= maxOutputBytes) return encoded

  for (const retryQuality of [
    Math.max(VIDEO_PREVIEW_MIN_JPEG_QUALITY, quality - 0.1),
    VIDEO_PREVIEW_MIN_JPEG_QUALITY
  ]) {
    encoded = await canvasToJpegBlob(canvas, retryQuality)
    if (!encoded || encoded.size <= maxOutputBytes) return encoded
  }

  const maxDimension = fallbackMaxDimension || VIDEO_PREVIEW_FALLBACK_MAX_DIMENSION
  if (Math.max(canvas.width, canvas.height) <= maxDimension) return encoded

  const size = calculateVideoPreviewFrameSize(canvas.width, canvas.height, maxDimension)
  const smallerCanvas = document.createElement('canvas')
  smallerCanvas.width = size.width
  smallerCanvas.height = size.height
  const smallerContext = smallerCanvas.getContext('2d')
  if (!smallerContext) return encoded
  smallerContext.drawImage(canvas, 0, 0, smallerCanvas.width, smallerCanvas.height)

  for (const retryQuality of [
    Math.max(VIDEO_PREVIEW_MIN_JPEG_QUALITY, quality - 0.1),
    VIDEO_PREVIEW_MIN_JPEG_QUALITY
  ]) {
    encoded = await canvasToJpegBlob(smallerCanvas, retryQuality)
    if (!encoded || encoded.size <= maxOutputBytes) return encoded
  }

  return encoded
}

// Core extractor: works on a ready-to-use src URL. The caller owns object-URL
// lifetime; this function only manages the temporary <video> element.
const extractFrameFromUrl = (
  srcUrl: string,
  maxWidth?: number,
  maxHeight?: number,
  quality: number = 1,
  options: VideoFrameExtractionOptions = {}
): Promise<VideoFirstFrameResult | null> => {
  return new Promise((resolve) => {
    try {
      const video = document.createElement('video')
      video.preload = 'auto'
      video.muted = true
      video.setAttribute('playsinline', 'true')

      if (!srcUrl.startsWith('blob:') && !srcUrl.startsWith('data:')) {
        video.crossOrigin = 'anonymous'
      }

      // Attach in-viewport but imperceptible. Chrome/Safari only refuse
      // display:none, but Firefox can suspend loading/decoding for elements it
      // considers invisible (visibility:hidden or fully off-viewport), which
      // leaves the load stuck at HAVE_NOTHING. opacity:0 + 2x2px in the corner
      // keeps the element "visible" to the media pipeline in all browsers.
      video.style.position = 'fixed'
      video.style.bottom = '0'
      video.style.left = '0'
      video.style.width = '2px'
      video.style.height = '2px'
      video.style.opacity = '0'
      video.style.pointerEvents = 'none'
      video.style.zIndex = '-1'
      document.body.appendChild(video)

      let settled = false

      const finishOnce = (result: VideoFirstFrameResult | null) => {
        if (settled) return
        settled = true
        clearTimeout(stallTimer)
        if (video.parentNode) {
          video.parentNode.removeChild(video)
        }
        resolve(result)
      }

      // Hard safety net: if nothing happens within N seconds (bad CORS,
      // unsupported codec, range-request issues, revoked blob, etc.), fail
      // gracefully instead of hanging the caller's promise forever.
      const stallTimer = setTimeout(() => {
        log.warn('getVideoFirstFrame: timed out waiting for video to load')
        finishOnce(null)
      }, FRAME_LOAD_TIMEOUT_MS)

      const extractFrame = () => {
        try {
          if (video.videoWidth === 0 || video.videoHeight === 0) {
            finishOnce(null)
            return
          }
          const width = video.videoWidth
          const height = video.videoHeight
          const duration = Number.isFinite(video.duration) ? video.duration : 0
          const boundedFrame =
            options.preserveAspectRatio && maxWidth && maxHeight
              ? calculateVideoPreviewFrameSize(width, height, Math.min(maxWidth, maxHeight))
              : null
          const canvasWidth = boundedFrame?.width || maxWidth || width / 2
          const canvasHeight = boundedFrame?.height || maxHeight || height / 2
          const canvas = document.createElement('canvas')
          canvas.width = canvasWidth
          canvas.height = canvasHeight
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            finishOnce(null)
            return
          }

          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

          encodeFrameForPreview(canvas, quality, options.maxOutputBytes, options.fallbackMaxDimension)
            .then((blob) => {
              if (!blob) {
                finishOnce(null)
                return
              }
              const frameBlobUrl = URL.createObjectURL(blob)
              finishOnce({ frameBlobUrl, blob, width, height, duration })
            })
            .catch(() => finishOnce(null))
        } catch (error) {
          log.error('Error extracting video frame:', error)
          finishOnce(null)
        }
      }

      video.onloadedmetadata = () => {
        video.currentTime = 0.01

        // Safari fix: 'seeked' fires when the seek is done at the network/buffer
        // level, but the frame may not be committed to the rendering surface yet —
        // drawImage would capture a black canvas. play() + waiting for timeupdate
        // forces the decoding pipeline to actually render a frame.
        // play() without user gesture is permitted when muted + playsinline are set.
        video.onseeked = () => {
          video.onseeked = null
          const capture = () => requestAnimationFrame(extractFrame)

          video
            .play()
            .then(() => {
              let done = false
              const finish = () => {
                if (done) return
                done = true
                video.removeEventListener('timeupdate', finish)
                video.removeEventListener('ended', finish)
                video.pause()
                capture()
              }
              video.addEventListener('timeupdate', finish)
              video.addEventListener('ended', finish)
              setTimeout(finish, 500)
            })
            .catch(() => {
              capture()
            })
        }
      }

      video.onerror = () => {
        log.warn('getVideoFirstFrame: video failed to load', video.error)
        finishOnce(null)
      }
      video.onabort = () => {
        finishOnce(null)
      }

      video.src = srcUrl
    } catch (error) {
      log.error('Error in extractFrameFromUrl:', error)
      resolve(null)
    }
  })
}

// data: URLs hold the whole file as a base64 string (~1.4x memory), so only
// use this as a last-resort fallback and only for reasonably sized videos.
const DATA_URL_MAX_BYTES = 64 * 1024 * 1024

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })

const extractFrameFromBlob = async (
  blob: Blob,
  maxWidth?: number,
  maxHeight?: number,
  quality: number = 1,
  allowRemux: boolean = true,
  options: VideoFrameExtractionOptions = {}
): Promise<VideoFirstFrameResult | null> => {
  const { safeBlob, info } = await normalizeVideoBlob(blob)

  // Firefox's mp4 demuxer cannot parse QuickTime-branded containers ('qt  '
  // major brand) regardless of the MIME label — the load silently hangs at
  // HAVE_NOTHING with no error event. Skip the doomed load attempts (2 × 8s of
  // waiting) and rewrite the container to standard MP4 instead (stream copy,
  // no re-encoding).
  if (isQuickTimeContainer(info) && isFirefox()) {
    if (!allowRemux) {
      return null
    }
    const remuxed = await remuxToMp4(safeBlob)
    if (!remuxed) {
      log.warn('getVideoFirstFrame: QuickTime container is not supported by Firefox and remux failed')
      return null
    }
    return extractFrameFromBlob(remuxed, maxWidth, maxHeight, quality, false, options)
  }

  const url = URL.createObjectURL(safeBlob)
  try {
    const result = await extractFrameFromUrl(url, maxWidth, maxHeight, quality, options)
    if (result) {
      return result
    }
  } finally {
    URL.revokeObjectURL(url)
  }

  // Firefox can stall a media load from a blob: URL without ever delivering a
  // byte or firing an error (loadstart → stalled → HAVE_NOTHING forever). A
  // data: URL is decoded inline by the media stack — no blob channel involved.
  if (safeBlob.size > DATA_URL_MAX_BYTES) {
    return null
  }
  try {
    const dataUrl = await blobToDataUrl(safeBlob)
    return await extractFrameFromUrl(dataUrl, maxWidth, maxHeight, quality, options)
  } catch (error) {
    log.error('getVideoFirstFrame: data URL fallback failed:', error)
    return null
  }
}

/**
 * Extract the first frame from a video as a blob URL.
 * Handles browser differences around MIME types: Firefox refuses blob sources
 * whose declared type it cannot demux (video/quicktime, octet-stream, charset
 * params), so blob sources are normalized via magic-byte sniffing, blob: URL
 * strings are re-fetched to recover the underlying bytes, and remote URLs get
 * a fetch-and-relabel retry when direct playback fails.
 *
 * @param videoSrc - Video source (URL string or Blob)
 * @param maxWidth - Maximum width for the extracted frame (default: original width / 2)
 * @param maxHeight - Maximum height for the extracted frame (default: original height / 2)
 * @param quality - JPEG quality 0-1 (default: 1)
 * @returns Promise resolving to the frame blob/url plus video dimensions and duration, or null
 */
export async function getVideoFirstFrame(
  videoSrc: string | Blob,
  maxWidth?: number,
  maxHeight?: number,
  quality: number = 1,
  options: VideoFrameExtractionOptions = {}
): Promise<VideoFirstFrameResult | null> {
  try {
    const scaledMaxWidth = options.applyDevicePixelRatio === false ? maxWidth : scaleForDevicePixelRatio(maxWidth)
    const scaledMaxHeight = options.applyDevicePixelRatio === false ? maxHeight : scaleForDevicePixelRatio(maxHeight)

    if (videoSrc instanceof Blob) {
      return await extractFrameFromBlob(videoSrc, scaledMaxWidth, scaledMaxHeight, quality, true, options)
    }

    // A blob: URL string carries a locked-in MIME type we cannot see or fix.
    // Re-fetch it (in-memory, cheap) so the bytes can be sniffed and relabeled.
    if (videoSrc.startsWith('blob:')) {
      try {
        const blob = await (await fetch(videoSrc)).blob()
        return await extractFrameFromBlob(blob, scaledMaxWidth, scaledMaxHeight, quality, true, options)
      } catch (error) {
        log.warn('getVideoFirstFrame: failed to re-fetch blob url, trying directly', error)
        return await extractFrameFromUrl(videoSrc, scaledMaxWidth, scaledMaxHeight, quality, options)
      }
    }

    // Remote URL: try direct playback first (streams, no full download).
    const direct = await extractFrameFromUrl(videoSrc, scaledMaxWidth, scaledMaxHeight, quality, options)
    if (direct) {
      return direct
    }

    // Direct load failed (often a wrong Content-Type from the server that
    // Firefox rejects). Download the bytes and retry with a corrected type.
    try {
      const response = await fetch(videoSrc)
      const blob = await response.blob()
      return await extractFrameFromBlob(blob, scaledMaxWidth, scaledMaxHeight, quality, true, options)
    } catch (error) {
      log.error('getVideoFirstFrame: fetch retry failed:', error)
      return null
    }
  } catch (error) {
    log.error('Error in getVideoFirstFrame:', error)
    return null
  }
}

/** Generates the compact JPEG uploaded as attachment metadata.video_thumb. */
export const getVideoPreviewFrame = (videoSrc: string | Blob) =>
  getVideoFirstFrame(videoSrc, VIDEO_PREVIEW_MAX_DIMENSION, VIDEO_PREVIEW_MAX_DIMENSION, VIDEO_PREVIEW_JPEG_QUALITY, {
    applyDevicePixelRatio: false,
    preserveAspectRatio: true,
    maxOutputBytes: VIDEO_PREVIEW_MAX_BYTES,
    fallbackMaxDimension: VIDEO_PREVIEW_FALLBACK_MAX_DIMENSION
  })

export async function getFrame(videoSrc: any, _time?: number): Promise<VideoThumbnailFrame> {
  if (!videoSrc) {
    throw new Error('src not found')
  }

  // getVideoFirstFrame handles MIME normalization, Safari seek quirks and
  // timeouts — no separate metadata-only video element that can hang forever.
  const frameResult = await getVideoPreviewFrame(videoSrc)
  if (!frameResult) {
    throw new Error('Failed to extract video frame')
  }

  const { frameBlobUrl, width: origWidth, height: origHeight } = frameResult
  const duration = Number(frameResult.duration.toFixed(0))
  const [newWidth, newHeight] = calculateSize(origWidth, origHeight, 100, 100)

  return new Promise((resolve, reject) => {
    const img = document.createElement('img')
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = newWidth
      canvas.height = newHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(frameBlobUrl)
        reject(new Error('Failed to get canvas context'))
        return
      }
      ctx.drawImage(img, 0, 0, newWidth, newHeight)
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const binaryThumbHash = rgbaToThumbHash(pixels.width, pixels.height, pixels.data)
      const thumb = binaryToBase64(binaryThumbHash)
      resolve({ thumb, width: origWidth, height: origHeight, duration, blob: frameResult.blob, frameBlobUrl })
    }
    img.onerror = () => {
      URL.revokeObjectURL(frameBlobUrl)
      reject(new Error('Failed to load frame image'))
    }
    img.src = frameBlobUrl
  })
}

// Compress image before caching using Pica for high-quality resizing
export const compressAndCacheImage = async (
  url: string,
  cacheKey: string,
  maxWidth?: number,
  maxHeight?: number,
  quality?: number,
  onProgress?: (progress: DownloadProgress) => void,
  fallbackTotal?: number
): Promise<string> => {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      return ''
    }
    const blob = await readResponseBlobWithProgress(response, onProgress, fallbackTotal)
    // Only compress if it's an image
    if (blob.type.startsWith('image/')) {
      // Convert blob to File for resizeImageWithPica function
      const file = new File([blob], 'image.jpeg', { type: blob.type })

      // Compress the image with Pica (high-quality resizing)
      const { blob: compressedBlob } = await resizeImageWithPica(
        file,
        scaleForDevicePixelRatio(maxWidth || 1280)!,
        scaleForDevicePixelRatio(maxHeight || 1080)!,
        quality || 1
      )
      const returningUrl = compressedBlob ? URL.createObjectURL(compressedBlob) : ''

      if (compressedBlob) {
        // Create Response from compressed blob
        const compressedResponse = new Response(compressedBlob, {
          headers: {
            'Content-Type': compressedBlob.type || blob.type
          }
        })
        setAttachmentToCache(cacheKey, compressedResponse)
        return returningUrl
      }
    }

    // If not an image or compression failed, cache original
    setAttachmentToCache(cacheKey, response)
    return ''
  } catch (error) {
    log.error('Error compressing and caching image:', error)
    return ''
  }
}
