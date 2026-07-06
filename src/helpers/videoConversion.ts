// Type-only import — erased at compile time, so the ffmpeg UMD bundle is NOT
// evaluated at module load; the runtime import stays dynamic inside remuxToMp4.
import type { FFmpeg } from '@ffmpeg/ffmpeg'
import log from 'loglevel'
import { inspectVideoBlob, isFirefox, isQuickTimeContainer } from './videoContainer'

const dbg = (...args: any[]) => console.log('[VIDEO_FIRST_FRAME]', ...args)

// ffmpeg.wasm keeps the input and output files in its in-memory filesystem, so
// a remux transiently costs ~2x the file size on top of the wasm heap. Cap the
// size to stay well clear of the 2GB wasm32 memory limit.
const REMUX_MAX_BYTES = 200 * 1024 * 1024

let remuxCounter = 0

/**
 * Rewrite a video's container to standard MP4 without re-encoding
 * (`-c copy`): fast, lossless, and makes QuickTime .mov files (H.264/AAC)
 * playable in Firefox, whose demuxer rejects the QuickTime container.
 *
 * @returns the remuxed blob, or null if the remux is not possible/fails
 */
export const remuxToMp4 = async (blob: Blob): Promise<Blob | null> => {
  if (blob.size > REMUX_MAX_BYTES) {
    dbg('remux: skipped, file too large:', blob.size)
    log.warn('remuxToMp4: file too large to remux in browser:', blob.size)
    return null
  }
  const id = `${Date.now()}_${remuxCounter++}`
  const inputName = `remux_${id}_in.mov`
  const outputName = `remux_${id}_out.mp4`
  let ffmpeg: FFmpeg | null = null
  let endFFmpegOpRef: (() => void) | null = null
  try {
    // Lazy-load ffmpeg only when a remux is actually needed — the UMD bundle
    // cannot be evaluated outside a real browser (e.g. jsdom tests) and is
    // heavy to parse at startup.
    const [{ initFFmpeg, beginFFmpegOp, endFFmpegOp }, { fetchFile }] = await Promise.all([
      import('./audioConversion'),
      import('@ffmpeg/util')
    ])
    beginFFmpegOp()
    endFFmpegOpRef = endFFmpegOp
    ffmpeg = await initFFmpeg()

    await ffmpeg.writeFile(inputName, await fetchFile(blob))
    await ffmpeg.exec(['-i', inputName, '-c', 'copy', '-movflags', '+faststart', outputName])
    const data = await ffmpeg.readFile(outputName)

    let bytes: Uint8Array
    if (data instanceof Uint8Array) {
      bytes = data
    } else if (typeof data === 'string') {
      const binaryString = atob(data)
      bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
    } else {
      bytes = new Uint8Array(data as unknown as ArrayBufferLike)
    }

    if (!bytes.length) {
      dbg('remux: ffmpeg produced empty output')
      return null
    }
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    return new Blob([arrayBuffer], { type: 'video/mp4' })
  } catch (error) {
    dbg('remux: FAILED', error)
    log.error('remuxToMp4: remux failed:', error)
    return null
  } finally {
    if (ffmpeg) {
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
    }
    if (endFFmpegOpRef) {
      endFFmpegOpRef()
    }
  }
}

/**
 * Upload-time normalization: if the picked video file is a QuickTime container
 * (.mov), remux it to standard MP4 so every recipient — including Firefox —
 * can play it and render thumbnails. Runs in every browser because the
 * limitation is on the RECEIVER's side. Returns the original file when no
 * remux is needed or when it fails.
 */
export const remuxVideoFileForUpload = async (file: File): Promise<File> => {
  try {
    const info = await inspectVideoBlob(file)
    if (!isQuickTimeContainer(info)) {
      return file
    }
    const remuxed = await remuxToMp4(file)
    if (!remuxed) {
      log.warn('remuxVideoFileForUpload: remux failed, uploading original file')
      return file
    }
    const newName = /\.(mov|qt)$/i.test(file.name) ? file.name.replace(/\.(mov|qt)$/i, '.mp4') : `${file.name}.mp4`
    return new File([remuxed], newName, { type: 'video/mp4', lastModified: file.lastModified })
  } catch (error) {
    log.error('remuxVideoFileForUpload failed, uploading original file:', error)
    return file
  }
}

/**
 * Display-time normalization for already-uploaded files: in Firefox, remux
 * downloaded QuickTime blobs to MP4 so both playback and frame extraction
 * work. Other browsers demux QuickTime natively, so the blob is returned
 * unchanged there. Always returns a usable blob (the original on failure).
 */
export const ensurePlayableVideoBlob = async (blob: Blob): Promise<Blob> => {
  try {
    if (!isFirefox()) {
      return blob
    }
    const info = await inspectVideoBlob(blob)
    if (!isQuickTimeContainer(info)) {
      return blob
    }
    const remuxed = await remuxToMp4(blob)
    return remuxed || blob
  } catch (error) {
    log.error('ensurePlayableVideoBlob failed, using original blob:', error)
    return blob
  }
}
