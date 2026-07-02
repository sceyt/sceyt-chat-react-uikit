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

// Temporary diagnostic logging for the Firefox first-frame issue.
// All lines are prefixed so they can be grepped and stripped later.
const dbg = (...args: any[]) => console.log('[VIDEO_FIRST_FRAME]', ...args)

// Return a blob whose declared type a video element can trust in all browsers,
// along with what the bytes revealed about the container.
const normalizeVideoBlob = async (blob: Blob): Promise<{ safeBlob: Blob; info: VideoContainerInfo }> => {
  // Always inspect the bytes — even a "clean" declared type like video/mp4 can
  // hide a QuickTime container that some browsers cannot demux.
  const info = await inspectVideoBlob(blob)
  const baseType = (blob.type || '').split(';')[0].trim().toLowerCase()
  if (NATIVE_VIDEO_TYPES.has(baseType)) {
    // Strip invalid params like "; charset=utf-8" that S3 can attach.
    dbg('normalize: declared type is native:', JSON.stringify(blob.type), '→', JSON.stringify(baseType))
    return { safeBlob: baseType === blob.type ? blob : new Blob([blob], { type: baseType }), info }
  }
  const relabeledType = info.mimeType || 'video/mp4'
  dbg('normalize: declared', JSON.stringify(blob.type), '→ relabeled to', JSON.stringify(relabeledType))
  return { safeBlob: new Blob([blob], { type: relabeledType }), info }
}

const FRAME_LOAD_TIMEOUT_MS = 8000

const READY_STATES = ['HAVE_NOTHING', 'HAVE_METADATA', 'HAVE_CURRENT_DATA', 'HAVE_FUTURE_DATA', 'HAVE_ENOUGH_DATA']
const NETWORK_STATES = ['NETWORK_EMPTY', 'NETWORK_IDLE', 'NETWORK_LOADING', 'NETWORK_NO_SOURCE']

const describeVideoState = (video: HTMLVideoElement) => {
  let buffered = 'none'
  try {
    const ranges: string[] = []
    for (let i = 0; i < video.buffered.length; i++) {
      ranges.push(`${video.buffered.start(i).toFixed(2)}-${video.buffered.end(i).toFixed(2)}`)
    }
    buffered = ranges.join(',') || 'empty'
  } catch (e) {
    buffered = 'unavailable'
  }
  return (
    `readyState=${READY_STATES[video.readyState] || video.readyState} ` +
    `networkState=${NETWORK_STATES[video.networkState] || video.networkState} ` +
    `currentTime=${video.currentTime} duration=${video.duration} ` +
    `videoWidth=${video.videoWidth} videoHeight=${video.videoHeight} ` +
    `buffered=[${buffered}] error=${video.error ? `${video.error.code}:${video.error.message}` : 'null'}`
  )
}

// Core extractor: works on a ready-to-use src URL. The caller owns object-URL
// lifetime; this function only manages the temporary <video> element.
const extractFrameFromUrl = (
  srcUrl: string,
  maxWidth?: number,
  maxHeight?: number,
  quality: number = 0.8
): Promise<VideoFirstFrameResult | null> => {
  return new Promise((resolve) => {
    try {
      dbg('extract: start, src =', srcUrl.slice(0, 100))
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
        dbg('extract: finished,', result ? 'SUCCESS' : 'NULL')
        resolve(result)
      }

      // Hard safety net: if nothing happens within N seconds (bad CORS,
      // unsupported codec, range-request issues, revoked blob, etc.), fail
      // gracefully instead of hanging the caller's promise forever.
      const stallTimer = setTimeout(() => {
        dbg('extract: TIMEOUT —', describeVideoState(video))
        log.warn('getVideoFirstFrame: timed out waiting for video to load')
        finishOnce(null)
      }, FRAME_LOAD_TIMEOUT_MS)

      const extractFrame = () => {
        try {
          dbg('extract: extractFrame,', describeVideoState(video))
          if (video.videoWidth === 0 || video.videoHeight === 0) {
            finishOnce(null)
            return
          }
          const width = video.videoWidth
          const height = video.videoHeight
          const duration = Number.isFinite(video.duration) ? video.duration : 0
          const canvasWidth = maxWidth || width / 2
          const canvasHeight = maxHeight || height / 2
          const canvas = document.createElement('canvas')
          canvas.width = canvasWidth
          canvas.height = canvasHeight
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            finishOnce(null)
            return
          }

          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                dbg('extract: canvas.toBlob returned null')
                finishOnce(null)
                return
              }
              const frameBlobUrl = URL.createObjectURL(blob)
              finishOnce({ frameBlobUrl, blob, width, height, duration })
            },
            'image/jpeg',
            quality
          )
        } catch (error) {
          dbg('extract: extractFrame threw', error)
          log.error('Error extracting video frame:', error)
          finishOnce(null)
        }
      }

      // Diagnostic-only listeners (no behavior)
      video.addEventListener('loadstart', () => dbg('event: loadstart,', describeVideoState(video)))
      video.addEventListener('loadeddata', () => dbg('event: loadeddata,', describeVideoState(video)))
      video.addEventListener('canplay', () => dbg('event: canplay,', describeVideoState(video)))
      video.addEventListener('canplaythrough', () => dbg('event: canplaythrough'))
      video.addEventListener('seeking', () => dbg('event: seeking, currentTime =', video.currentTime))
      video.addEventListener('stalled', () => dbg('event: stalled,', describeVideoState(video)))
      video.addEventListener('suspend', () => dbg('event: suspend,', describeVideoState(video)))
      video.addEventListener('waiting', () => dbg('event: waiting,', describeVideoState(video)))
      video.addEventListener('emptied', () => dbg('event: emptied,', describeVideoState(video)))

      video.onloadedmetadata = () => {
        dbg('event: loadedmetadata,', describeVideoState(video))
        video.currentTime = 0.01

        // Safari fix: 'seeked' fires when the seek is done at the network/buffer
        // level, but the frame may not be committed to the rendering surface yet —
        // drawImage would capture a black canvas. play() + waiting for timeupdate
        // forces the decoding pipeline to actually render a frame.
        // play() without user gesture is permitted when muted + playsinline are set.
        video.onseeked = () => {
          dbg('event: seeked,', describeVideoState(video))
          video.onseeked = null
          const capture = () => requestAnimationFrame(extractFrame)

          video
            .play()
            .then(() => {
              dbg('play(): resolved')
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
            .catch((err) => {
              dbg('play(): rejected —', err?.name, err?.message)
              capture()
            })
        }
      }

      video.onerror = () => {
        dbg('event: error,', describeVideoState(video))
        log.warn('getVideoFirstFrame: video failed to load', video.error)
        finishOnce(null)
      }
      video.onabort = () => {
        dbg('event: abort,', describeVideoState(video))
        finishOnce(null)
      }

      video.src = srcUrl
      dbg('extract: src assigned,', describeVideoState(video))
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
  quality: number = 0.8,
  allowRemux: boolean = true
): Promise<VideoFirstFrameResult | null> => {
  const { safeBlob, info } = await normalizeVideoBlob(blob)

  // Firefox's mp4 demuxer cannot parse QuickTime-branded containers ('qt  '
  // major brand) regardless of the MIME label — the load silently hangs at
  // HAVE_NOTHING with no error event. Skip the doomed load attempts (2 × 8s of
  // waiting) and rewrite the container to standard MP4 instead (stream copy,
  // no re-encoding).
  if (isQuickTimeContainer(info) && isFirefox()) {
    if (!allowRemux) {
      dbg('skip: remuxed output is still a QuickTime container — giving up')
      return null
    }
    dbg(
      'skip: QuickTime (qt brand) container — Firefox cannot demux this, remuxing. codecs =',
      info.codecs.join(',') || '?'
    )
    const remuxed = await remuxToMp4(safeBlob)
    if (!remuxed) {
      log.warn('getVideoFirstFrame: QuickTime container is not supported by Firefox and remux failed')
      return null
    }
    return extractFrameFromBlob(remuxed, maxWidth, maxHeight, quality, false)
  }

  const url = URL.createObjectURL(safeBlob)
  try {
    const result = await extractFrameFromUrl(url, maxWidth, maxHeight, quality)
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
    dbg('fallback: blob too large for data URL fallback, size =', safeBlob.size)
    return null
  }
  try {
    dbg('fallback: retrying via data URL, size =', safeBlob.size)
    const dataUrl = await blobToDataUrl(safeBlob)
    return await extractFrameFromUrl(dataUrl, maxWidth, maxHeight, quality)
  } catch (error) {
    dbg('fallback: data URL conversion failed', error)
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
 * @param quality - JPEG quality 0-1 (default: 0.8)
 * @returns Promise resolving to the frame blob/url plus video dimensions and duration, or null
 */
export async function getVideoFirstFrame(
  videoSrc: string | Blob,
  maxWidth?: number,
  maxHeight?: number,
  quality: number = 0.8
): Promise<VideoFirstFrameResult | null> {
  try {
    if (videoSrc instanceof Blob) {
      dbg('source: Blob, type =', JSON.stringify(videoSrc.type), 'size =', videoSrc.size)
      return await extractFrameFromBlob(videoSrc, maxWidth, maxHeight, quality)
    }

    // A blob: URL string carries a locked-in MIME type we cannot see or fix.
    // Re-fetch it (in-memory, cheap) so the bytes can be sniffed and relabeled.
    if (videoSrc.startsWith('blob:')) {
      dbg('source: blob URL string —', videoSrc.slice(0, 100))
      try {
        const blob = await (await fetch(videoSrc)).blob()
        dbg('source: blob URL re-fetched, type =', JSON.stringify(blob.type), 'size =', blob.size)
        return await extractFrameFromBlob(blob, maxWidth, maxHeight, quality)
      } catch (error) {
        dbg('source: blob URL re-fetch FAILED, falling back to direct', error)
        log.warn('getVideoFirstFrame: failed to re-fetch blob url, trying directly', error)
        return await extractFrameFromUrl(videoSrc, maxWidth, maxHeight, quality)
      }
    }

    // Remote URL: try direct playback first (streams, no full download).
    dbg('source: remote URL —', videoSrc.slice(0, 150))
    const direct = await extractFrameFromUrl(videoSrc, maxWidth, maxHeight, quality)
    if (direct) {
      return direct
    }

    // Direct load failed (often a wrong Content-Type from the server that
    // Firefox rejects). Download the bytes and retry with a corrected type.
    dbg('source: direct remote load failed, retrying via fetch + relabel')
    try {
      const response = await fetch(videoSrc)
      const blob = await response.blob()
      dbg(
        'source: remote fetched, Content-Type =',
        JSON.stringify(response.headers.get('content-type')),
        'blob type =',
        JSON.stringify(blob.type),
        'size =',
        blob.size
      )
      return await extractFrameFromBlob(blob, maxWidth, maxHeight, quality)
    } catch (error) {
      dbg('source: remote fetch retry FAILED', error)
      log.error('getVideoFirstFrame: fetch retry failed:', error)
      return null
    }
  } catch (error) {
    log.error('Error in getVideoFirstFrame:', error)
    return null
  }
}

export async function getFrame(
  videoSrc: any,
  _time?: number
): Promise<{ thumb: string; width: number; height: number; duration: number }> {
  if (!videoSrc) {
    throw new Error('src not found')
  }

  // getVideoFirstFrame handles MIME normalization, Safari seek quirks and
  // timeouts — no separate metadata-only video element that can hang forever.
  const frameResult = await getVideoFirstFrame(videoSrc)
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
      URL.revokeObjectURL(frameBlobUrl)
      resolve({ thumb, width: origWidth, height: origHeight, duration })
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
  quality?: number
): Promise<string> => {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      return ''
    }
    const blob = await response.blob()
    // Only compress if it's an image
    if (blob.type.startsWith('image/')) {
      // Convert blob to File for resizeImageWithPica function
      const file = new File([blob], 'image.jpeg', { type: blob.type })

      // Compress the image with Pica (high-quality resizing)
      const { blob: compressedBlob } = await resizeImageWithPica(
        file,
        maxWidth || 1280,
        maxHeight || 1080,
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
