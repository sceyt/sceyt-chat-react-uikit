// import { calculateSize } from './resizeImage'

import { setAttachmentToCache } from './attachmentsCache'
import { binaryToBase64, calculateSize, resizeImageWithPica } from './resizeImage'
import { rgbaToThumbHash } from './thumbhash'
import log from 'loglevel'

export async function getFrame(
  videoSrc: any,
  _time?: number
): Promise<{ thumb: string; width: number; height: number; duration: number }> {
  return new Promise((resolve, reject) => {
    if (!videoSrc) {
      reject(new Error('src not found'))
      return
    }

    // Phase 1: read metadata (dimensions + duration) only — no seeking needed
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.setAttribute('playsinline', 'true')
    video.src = videoSrc

    video.onloadedmetadata = async () => {
      const origWidth = video.videoWidth
      const origHeight = video.videoHeight
      const duration = Number(video.duration?.toFixed(0))
      const [newWidth, newHeight] = calculateSize(origWidth, origHeight, 100, 100)

      try {
        // Phase 2: use getVideoFirstFrame which handles Safari seek quirks reliably
        const frameResult = await getVideoFirstFrame(videoSrc, newWidth, newHeight)
        if (!frameResult) {
          reject(new Error('Failed to extract video frame'))
          return
        }

        // Phase 3: draw the JPEG blob onto a canvas to produce thumbhash pixel data
        const img = document.createElement('img')
        img.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = newWidth
          canvas.height = newHeight
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            URL.revokeObjectURL(frameResult.frameBlobUrl)
            reject(new Error('Failed to get canvas context'))
            return
          }
          ctx.drawImage(img, 0, 0, newWidth, newHeight)
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const binaryThumbHash = rgbaToThumbHash(pixels.width, pixels.height, pixels.data)
          const thumb = binaryToBase64(binaryThumbHash)
          URL.revokeObjectURL(frameResult.frameBlobUrl)
          resolve({ thumb, width: origWidth, height: origHeight, duration })
        }
        img.onerror = () => {
          URL.revokeObjectURL(frameResult.frameBlobUrl)
          reject(new Error('Failed to load frame image'))
        }
        img.src = frameResult.frameBlobUrl
      } catch (err) {
        reject(err)
      }
    }

    video.onerror = () => {
      reject(new Error('Failed to load video'))
    }
  })
}

/**
 * Extract the first frame from a video as a blob URL
 * Uses metadata preload to minimize data download
 *
 * @param videoSrc - Video source (URL string or Blob)
 * @param maxWidth - Maximum width for the extracted frame (default: original width / 2)
 * @param maxHeight - Maximum height for the extracted frame (default: original height / 2)
 * @param quality - JPEG quality 0-1 (default: 0.8)
 * @returns Promise resolving to blob URL string, or null if extraction fails
 */
export async function getVideoFirstFrame(
  videoSrc: string | Blob,
  maxWidth?: number,
  maxHeight?: number,
  quality: number = 0.8
): Promise<{ frameBlobUrl: string; blob: Blob } | null> {
  return new Promise((resolve) => {
    try {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.muted = true
      video.setAttribute('playsinline', 'true')

      // Set video source
      if (videoSrc instanceof Blob) {
        video.src = URL.createObjectURL(videoSrc)
      } else {
        video.src = videoSrc
      }

      let videoUrlCreated = false

      const cleanup = () => {
        if (videoUrlCreated && videoSrc instanceof Blob) {
          URL.revokeObjectURL(video.src)
        }
      }

      const extractFrame = () => {
        try {
          // Check if video has dimensions
          if (video.videoWidth === 0 || video.videoHeight === 0) {
            cleanup()
            resolve(null)
            return
          }

          // Calculate canvas dimensions
          const canvasWidth = maxWidth || video.videoWidth / 2
          const canvasHeight = maxHeight || video.videoHeight / 2

          const canvas = document.createElement('canvas')
          canvas.width = canvasWidth
          canvas.height = canvasHeight
          const ctx = canvas.getContext('2d')

          if (!ctx) {
            cleanup()
            resolve(null)
            return
          }

          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

          // Convert canvas to blob
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                cleanup()
                resolve(null)
                return
              }

              // Create blob URL for the frame
              const frameBlobUrl = URL.createObjectURL(blob)
              cleanup()
              resolve({ frameBlobUrl, blob })
            },
            'image/jpeg',
            quality
          )
        } catch (error) {
          log.error('Error extracting video frame:', error)
          cleanup()
          resolve(null)
        }
      }

      // Wait for metadata to load
      video.onloadedmetadata = () => {
        videoUrlCreated = true

        // Seek to first frame (0.1 seconds to ensure we get a decodable frame)
        video.currentTime = 0.01

        // Wait for seek to complete.
        // Safari fix: 'seeked' fires when the seek is done at the network/buffer level,
        // but AVFoundation hasn't decoded or committed the frame to the video element's
        // rendering surface yet — drawImage captures a black canvas.
        // Calling play() forces the decoding pipeline to actually render the frame.
        // After pause() the frame is committed and drawImage works correctly.
        // play() without user gesture is permitted when muted + playsinline are set.
        video.onseeked = () => {
          video.onseeked = null
          const capture = () => requestAnimationFrame(extractFrame)

          video
            .play()
            .then(() => {
              // Wait for timeupdate which fires when currentTime has actually advanced,
              // meaning at least one frame has been decoded and painted by Safari.
              // play() resolving only means playback can begin — not that a frame is rendered.
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
              // For very short videos that reach 'ended' before timeupdate fires
              video.addEventListener('ended', finish)
              // Safety fallback in case neither event fires (unsupported codec, etc.)
              setTimeout(finish, 500)
            })
            .catch(capture)
        }

        video.onerror = (error) => {
          log.error('Error seeking video for frame extraction', error)
          cleanup()
          resolve(null)
        }
      }

      video.onerror = () => {
        log.error('Error loading video metadata for frame extraction')
        cleanup()
        resolve(null)
      }
    } catch (error) {
      log.error('Error in getVideoFirstFrame:', error)
      resolve(null)
    }
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
    // Fallback to caching original
    try {
      const response = await fetch(url)
      setAttachmentToCache(cacheKey, response)
      return ''
    } catch (fetchError) {
      log.error('Error caching image:', fetchError)
      return ''
    }
  }
}
