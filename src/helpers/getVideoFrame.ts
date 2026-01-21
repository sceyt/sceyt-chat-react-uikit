// import { calculateSize } from './resizeImage'

import { setAttachmentToCache } from './attachmentsCache'
import { binaryToBase64, calculateSize, resizeImageWithPica } from './resizeImage'
import { rgbaToThumbHash } from './thumbhash'
import log from 'loglevel'

export async function getFrame(
  videoSrc: any,
  time?: number
): Promise<{ thumb: string; width: number; height: number; duration: number }> {
  const video = document.createElement('video')
  video.src = videoSrc
  video.crossOrigin = 'anonymous'
  video.preload = 'auto'
  video.muted = true
  return new Promise((resolve, reject) => {
    if (videoSrc) {
      video.onloadedmetadata = () => {
        // Set the time before drawing
        video.currentTime = time || 0

        video.onseeked = () => {
          const [newWidth, newHeight] = calculateSize(video.videoWidth, video.videoHeight, 100, 100)
          const canvas = document.createElement('canvas')
          canvas.width = newWidth
          canvas.height = newHeight

          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('Failed to get canvas context'))
            return
          }

          ctx.drawImage(video, 0, 0, newWidth, newHeight)
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const binaryThumbHash = rgbaToThumbHash(pixels.width, pixels.height, pixels.data)
          const thumb = binaryToBase64(binaryThumbHash)
          const duration = Number(video.duration?.toFixed(0))

          resolve({ thumb, width: video.videoWidth, height: video.videoHeight, duration })
        }

        video.onerror = () => {
          reject(new Error('Failed to seek video'))
        }
      }

      video.onerror = () => {
        reject(new Error('Failed to load video'))
      }
    } else {
      reject(new Error('src not found'))
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
      video.crossOrigin = 'anonymous'

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
        video.currentTime = 0.1

        // Wait for seek to complete
        video.onseeked = () => {
          extractFrame()
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
