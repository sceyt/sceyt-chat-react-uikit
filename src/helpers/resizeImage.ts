import { IAttachmentMeta } from './messagesHalper'
import { thumbHashToDataURL, rgbaToThumbHash } from './thumbhash'
import log from 'loglevel'
import Pica from 'pica'

const MAX_WIDTH = 1280
const MAX_HEIGHT = 1080
const MIME_TYPE = 'image/jpeg'
const QUALITY = 0.9
const THUMBNAIL_MAX_WIDTH = 6
const THUMBNAIL_MAX_HEIGHT = 6
const THUMBNAIL_MIME_TYPE = 'image/jpeg'
const THUMBNAIL_QUALITY = 0.7

export function resizeImage(
  file: any,
  maxWidth?: number,
  maxHeight?: number,
  quality?: number
): Promise<{ file: File; blob: Blob | null; newWidth: number; newHeight: number }> {
  return new Promise((resolve) => {
    // const resizedFiles: any[] = []
    // files.forEach((file: File, index) => {
    const blobURL = URL.createObjectURL(file)
    const img = new Image()
    img.src = blobURL
    img.onerror = function () {
      URL.revokeObjectURL(this.src)
      // Handle the failure properly
      log.info('Cannot load image')
    }
    img.onload = function () {
      // @ts-ignore
      URL.revokeObjectURL(this.src)
      const [newWidth, newHeight] = calculateSize(img.width, img.height, maxWidth || MAX_WIDTH, maxHeight || MAX_HEIGHT)
      const canvas = document.createElement('canvas')
      canvas.width = newWidth
      canvas.height = newHeight
      const ctx = canvas.getContext('2d')
      // @ts-ignore
      ctx.drawImage(img, 0, 0, newWidth, newHeight)
      if (ctx) {
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
      }
      canvas.toBlob(
        (blob) => {
          // Handle the compressed image. es. upload or save in local state
          // displayInfo('Original file', file)
          // displayInfo('Compressed file', blob)
          // resizedFiles.push({ file, blob })

          // if (index === files.length - 1) {
          resolve({ file, blob, newWidth, newHeight })
          // }
        },
        MIME_TYPE,
        quality || QUALITY
      )
      // document.getElementById('root').append(canvas)
    }
    // })
  })
}
export function getFileSize(url: string) {
  const file = new File([url], '')
  return file.size
}
export function createFileImageThumbnail(file: any) {
  return new Promise((resolve) => {
    // const resizedFiles: any[] = []
    // files.forEach((file: File, index) => {
    const blobURL = URL.createObjectURL(file)
    const img = new Image()
    img.src = blobURL
    img.onerror = function () {
      URL.revokeObjectURL(this.src)
      // Handle the failure properly
      log.info('Cannot load image')
    }
    img.onload = function () {
      // @ts-ignore
      URL.revokeObjectURL(this.src)
      const [newWidth, newHeight] = calculateSize(img.width, img.height, 50, 50)
      const canvas = document.createElement('canvas')
      canvas.width = newWidth
      canvas.height = newHeight
      const ctx = canvas.getContext('2d')
      // @ts-ignore
      ctx.drawImage(img, 0, 0, newWidth, newHeight)

      const base64String = canvas.toDataURL(THUMBNAIL_MIME_TYPE, THUMBNAIL_QUALITY)
      resolve(base64String)
      // document.getElementById('root').append(canvas)
    }
    // })
  })
}
/* function runThumbHash(w: any, h: any, rgba: any) {
  const hash = rgbaToThumbHash(w, h, rgba)
  const img = new Image()
  img.src = thumbHashToDataURL(hash)
  return { hash, img }
} */
/* function runBlurHash(w, h, rgba, nx, ny) {
  const hash = BlurHash.encode(rgba, w, h, nx, ny)
  const size = Math.max(w, h)
  const thumb_w = Math.round(32 * w / size)
  const thumb_h = Math.round(32 * h / size)
  const thumb_rgba = BlurHash.decode(hash, thumb_w, thumb_h)
  const img = new Image
  img.src = ThumbHash.rgbaToDataURL(thumb_w, thumb_h, thumb_rgba)
  return { hash, img }
} */
// If you want to use base64 instead of binary...
export const binaryToBase64 = (binary: any) => btoa(String.fromCharCode(...binary))

export const base64ToBinary = (base64: any) => {
  try {
    // Validate that the input is a valid base64 string
    if (typeof base64 !== 'string' || !base64) {
      throw new Error('Invalid base64 input')
    }

    // Check if the string contains only valid base64 characters
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/
    if (!base64Regex.test(base64)) {
      throw new Error('Invalid base64 characters')
    }

    return new Uint8Array(
      atob(base64)
        .split('')
        .map((x) => x.charCodeAt(0))
    )
  } catch (error) {
    log.warn('Invalid base64 string provided to base64ToBinary:', base64, error)
    // Return an empty Uint8Array as fallback
    return new Uint8Array(0)
  }
}

const binaryThumbHashToDataURL = (binaryThumbHash: Uint8Array) => thumbHashToDataURL(binaryThumbHash)

export const base64ToDataURL = (base64: any) => {
  try {
    const thumbHashFromBase64 = base64ToBinary(base64)

    // If we got an empty array, return a fallback
    if (thumbHashFromBase64.length === 0) {
      return ''
    }

    return binaryThumbHashToDataURL(thumbHashFromBase64)
  } catch (error) {
    log.warn('Error converting base64 to data URL:', error)
    return ''
  }
}

export function createImageThumbnail(
  file: any,
  path?: string,
  maxWidth?: number,
  maxHeight?: number
): Promise<IAttachmentMeta> {
  return new Promise((resolve) => {
    // const resizedFiles: any[] = []
    // files.forEach((file: File, index) => {
    let blobURL: any
    if (file) {
      blobURL = URL.createObjectURL(file)
    }
    const img = new Image()
    img.src = blobURL || path || ''
    img.onerror = function () {
      URL.revokeObjectURL(this.src)
      // Handle the failure properly
      log.info('Cannot load image')
    }
    img.onload = function () {
      if (blobURL) {
        // @ts-ignore
        URL.revokeObjectURL(this.src)
      }
      const [newWidth, newHeight] = calculateSize(
        img.width,
        img.height,
        maxWidth || THUMBNAIL_MAX_WIDTH,
        maxHeight || THUMBNAIL_MAX_HEIGHT
      )
      const canvas = document.createElement('canvas')
      canvas.width = newWidth
      canvas.height = newHeight
      const ctx = canvas.getContext('2d')
      // @ts-ignore
      ctx.drawImage(img, 0, 0, newWidth, newHeight)

      // @ts-ignore
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const binaryThumbHash = rgbaToThumbHash(pixels.width, pixels.height, pixels.data)

      // ThumbHash to data URL
      // Simulate setting the placeholder first, then the full image loading later on

      // log.info('binaryThumbHash. . . . . . ', binaryThumbHash)
      const thumbHashToBase64 = binaryToBase64(binaryThumbHash)
      resolve({
        // thumbnail: base64String.replace('data:image/jpeg;base64,', ''),
        thumbnail: thumbHashToBase64,
        imageWidth: img.width,
        imageHeight: img.height
      })
      // document.getElementById('root').append(canvas)
    }
    // })
  })
}

export function calculateSize(width: number, height: number, maxWidth: number, maxHeight: number) {
  // calculate the width and height, constraining the proportions
  if (width > height) {
    if (width > maxWidth) {
      height = Math.round((height * maxWidth) / width)
      width = maxWidth
    }
  } else {
    if (height > maxHeight) {
      width = Math.round((width * maxHeight) / height)
      height = maxHeight
    }
  }
  if (height < 1) {
    height = 1
  }
  return [width, height]
}

// Initialize Pica instance
const pica = new Pica()

/**
 * High-quality image resizing using Pica with Lanczos resampling
 * Produces sharp, clean results especially for large downscaling
 *
 * @param file - The image file to resize
 * @param maxWidth - Maximum width (default: 1600)
 * @param maxHeight - Maximum height (default: 1600)
 * @param quality - Output quality 0-1 (default: 0.82)
 * @param type - Output MIME type (default: 'image/webp', falls back to original type if WebP not supported)
 * @returns Promise with resized file, blob, and dimensions
 */
export async function resizeImageWithPica(
  file: File | Blob,
  maxWidth: number = 1600,
  maxHeight: number = 1600,
  quality: number = 0.82,
  type?: string
): Promise<{ file: File; blob: Blob | null; newWidth: number; newHeight: number }> {
  try {
    const img = new Image()
    const url = URL.createObjectURL(file)

    // Load image
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Cannot load image'))
      }
      img.src = url
    })

    // Calculate new dimensions maintaining aspect ratio
    const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1)
    const newWidth = Math.round(img.width * scale)
    const newHeight = Math.round(img.height * scale)

    // If no resizing needed, return original
    if (scale >= 1) {
      URL.revokeObjectURL(url)
      let blob: Blob
      if (file instanceof File) {
        blob = file
      } else {
        blob = file
      }
      const resultFile = file instanceof File ? file : new File([blob], 'image', { type: blob.type })
      return {
        file: resultFile,
        blob,
        newWidth: img.width,
        newHeight: img.height
      }
    }

    // Create canvas for output
    const canvas = document.createElement('canvas')
    canvas.width = newWidth
    canvas.height = newHeight

    // Resize with Pica (high-quality Lanczos resampling)
    await pica.resize(img, canvas, {
      quality: 3, // max quality
      unsharpAmount: 80, // sharpen slightly
      unsharpRadius: 0.6,
      unsharpThreshold: 2
    })

    URL.revokeObjectURL(url)

    // Determine output type - prefer WebP but fallback to original type if not supported
    const originalType = file.type || 'image/jpeg'
    let outputType = type || 'image/webp'

    // Check WebP support, fallback to original type if not supported
    if (outputType === 'image/webp' && !canvas.toDataURL('image/webp').includes('webp')) {
      outputType = originalType.startsWith('image/') ? originalType : 'image/jpeg'
    }

    // Convert canvas to blob
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), outputType, quality)
    })

    const resultFile =
      blob != null
        ? new File([blob], file instanceof File ? file.name : 'image', { type: outputType })
        : file instanceof File
          ? file
          : new File([file], 'image', { type: originalType })

    return {
      file: resultFile,
      blob,
      newWidth,
      newHeight
    }
  } catch (error) {
    log.error('Error resizing image with Pica:', error)
    // Fallback to original file
    const blob: Blob = file instanceof File ? file : file
    const resultFile = file instanceof File ? file : new File([blob], 'image', { type: blob.type })
    return {
      file: resultFile,
      blob,
      newWidth: 0,
      newHeight: 0
    }
  }
}
