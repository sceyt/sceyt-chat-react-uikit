// import { calculateSize } from './resizeImage'

import { binaryToBase64, calculateSize, createImageThumbnail } from './resizeImage'
import { rgbaToThumbHash } from './thumbhash'

export async function getFrame(
  videoSrc: any,
  time?: number
): Promise<{ thumb: string; width: number; height: number }> {
  const video = document.createElement('video')
  video.src = videoSrc
  return new Promise((resolve, reject) => {
    if (videoSrc) {
      const b = setInterval(() => {
        if (video.readyState >= 3) {
          if (time) {
            video.currentTime = time
          }
          // const [newWidth, newHeight] = calculateSize(video.videoWidth, video.videoHeight, 200, 100)
          const [newWidth, newHeight] = calculateSize(video.videoWidth, video.videoHeight, 50, 50)
          const canvas = document.createElement('canvas')
          canvas.width = newWidth
          canvas.height = newHeight

          // @ts-ignore
          const ctx = canvas.getContext('2d')
          video.currentTime = 10
          // @ts-ignore
          ctx.drawImage(video, 0, 0, newWidth, newHeight)
          // @ts-ignore
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const binaryThumbHash = rgbaToThumbHash(pixels.width, pixels.height, pixels.data)
          const thumb = binaryToBase64(binaryThumbHash)
          console.log('generated thumb hash ... ', thumb)

          clearInterval(b)
          resolve({ thumb, width: video.videoWidth, height: video.videoHeight })
        }
      }, 500)
    } else {
      reject(new Error('src not found'))
    }
  })
}

export async function getFrame2(videoSrc: any, time: number) {
  const video = document.createElement('video')
  video.src = videoSrc
  console.log('video.. ', video)
  return new Promise((resolve) => {
    // if (videoSrc) {
    const b = setInterval(async () => {
      console.log('video.readyState. . ', video.readyState)
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
        console.log('canvas.toDataURL() new version .... ', canvas.toDataURL())
        const thumb = await createImageThumbnail(null, canvas.toDataURL(), 200, 100)
        console.log('thumb new version .... ', thumb)
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

  console.log('canvas.toDataURL()  3 ... ', canvas.toDataURL())
  const thumb = await createImageThumbnail(null, canvas.toDataURL())
  console.log('thumb ---- ', thumb) */
  /* const image = new Image()
  image.onload = async function () {
    const thumb = await createImageThumbnail(image)
    console.log('thumb ---- ', thumb)
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
    console.log('thumb ---- ', thumb)
  }
  image.src = canvas.toDataURL() */
}
