// import { calculateSize } from './resizeImage'

import { binaryToBase64, calculateSize, createImageThumbnail } from './resizeImage'
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

export async function getFrame2(videoSrc: any, time: number) {
  const video = document.createElement('video')
  video.src = videoSrc
  log.info('video.. ', video)
  return new Promise((resolve) => {
    // if (videoSrc) {
    const b = setInterval(async () => {
      log.info('video.readyState. . ', video.readyState)
      if (video.readyState >= 3) {
        if (time) {
          video.currentTime = time
        }
        // const [newWidth, newHeight] = calculateSize(video.videoWidth, video.videoHeight, 200, 100)
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        // @ts-ignore
        const ctx = canvas.getContext('2d')
        if (time) {
          video.currentTime = time
        }
        // @ts-ignore
        ctx.drawImage(video, 0, 0)
        // @ts-ignore
        log.info('canvas.toDataURL() new version .... ', canvas.toDataURL())
        const thumb = await createImageThumbnail(null, canvas.toDataURL(), 200, 100)
        log.info('thumb new version .... ', thumb)
        clearInterval(b)
        resolve({ thumb, width: video.videoWidth, height: video.videoHeight })
      }
    }, 500)
    // } else {
    //   reject(new Error('src not found'))
    // }
  })
  /* const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  // @ts-ignore
  const ctx = canvas.getContext('2d')
  if (time) {
    video.currentTime = time
  }
  // @ts-ignore
  ctx.drawImage(video, 0, 0)
  // @ts-ignore

  log.info('canvas.toDataURL()  3 ... ', canvas.toDataURL())
  const thumb = await createImageThumbnail(null, canvas.toDataURL())
  log.info('thumb ---- ', thumb) */
  /* const image = new Image()
  image.onload = async function () {
    const thumb = await createImageThumbnail(image)
    log.info('thumb ---- ', thumb)
  }
  image.src = canvas.toDataURL() */
}

export async function getFrame3(video: any, time: number) {
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  // @ts-ignore
  const ctx = canvas.getContext('2d')
  if (time) {
    video.currentTime = time
  }
  // @ts-ignore
  ctx.drawImage(video, 0, 0)
  // @ts-ignore

  return await createImageThumbnail(null, canvas.toDataURL(), 10, 10)
  /* const image = new Image()
  image.onload = async function () {
    const thumb = await createImageThumbnail(image)
    log.info('thumb ---- ', thumb)
  }
  image.src = canvas.toDataURL() */
}
