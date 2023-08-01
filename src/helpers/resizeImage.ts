import { IAttachmentMeta } from './messagesHalper'
import * as ThumbHash from 'thumbhash'

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
      console.log('Cannot load image')
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
      console.log('Cannot load image')
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
export const base64ToBinary = (base64: any) =>
  new Uint8Array(
    atob(base64)
      .split('')
      .map((x) => x.charCodeAt(0))
  )
const binaryThumbHashToDataURL = (binaryThumbHash: Uint8Array) => ThumbHash.thumbHashToDataURL(binaryThumbHash)
export const base64ToToDataURL = (base64: any) => {
  const thumbHashFromBase64 = base64ToBinary(base64)
  return binaryThumbHashToDataURL(thumbHashFromBase64)
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
      console.log('Cannot load image')
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
      const binaryThumbHash = ThumbHash.rgbaToThumbHash(pixels.width, pixels.height, pixels.data)

      // ThumbHash to data URL
      // Simulate setting the placeholder first, then the full image loading later on

      // console.log('binaryThumbHash. . . . . . ', binaryThumbHash)
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

export function getImageSize(path?: any): Promise<any> {
  return new Promise((resolve) => {
    fetch(path).then(function (response) {
      response.blob().then((res) => {
        resolve(res.size)
      })
    })
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
