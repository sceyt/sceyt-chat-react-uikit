import log from 'loglevel'

// Temporary diagnostic logging for the Firefox first-frame issue.
// All lines are prefixed so they can be grepped and stripped later.
const dbg = (...args: any[]) => console.log('[VIDEO_FIRST_FRAME]', ...args)

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ')

// MIME types every supported browser can demux natively from a blob: URL.
// Firefox does NOT content-sniff blob: URLs — it trusts the declared type,
// so anything outside this set (video/quicktime, application/octet-stream,
// empty type, "…; charset=utf-8" params) must be relabeled before playback.
// Chrome sniffs the bytes and forgives a wrong label, which is why these
// sources "work in Chrome but not Firefox".
export const NATIVE_VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/ogg'])

// Find which of the given fourcc byte sequences appear in the buffer.
const findFourccs = (bytes: Uint8Array, fourccs: string[]): string[] => {
  const found: string[] = []
  for (const cc of fourccs) {
    const c0 = cc.charCodeAt(0)
    const c1 = cc.charCodeAt(1)
    const c2 = cc.charCodeAt(2)
    const c3 = cc.charCodeAt(3)
    for (let i = 0; i <= bytes.length - 4; i++) {
      if (bytes[i] === c0 && bytes[i + 1] === c1 && bytes[i + 2] === c2 && bytes[i + 3] === c3) {
        found.push(cc)
        break
      }
    }
  }
  return found
}

// Video sample-entry fourccs that identify the codec inside an ISO-BMFF file.
const VIDEO_CODEC_FOURCCS = ['avc1', 'avc3', 'hvc1', 'hev1', 'av01', 'vp09', 'mp4v', 'apcn', 'apch', 'ap4h']

export interface VideoContainerInfo {
  mimeType: string | null
  isoBrand: string | null
  codecs: string[]
}

// A QuickTime-branded ISO file — Firefox's mp4 demuxer cannot parse these
// regardless of the declared MIME type.
export const isQuickTimeContainer = (info: VideoContainerInfo) => info.isoBrand === 'qt  '

// Inspect the container format and codec from the file bytes. The moov box
// (which holds the codec sample entries) lives at the start OR the end of the
// file, so scan a chunk from both.
export const inspectVideoBlob = async (blob: Blob): Promise<VideoContainerInfo> => {
  const info: VideoContainerInfo = { mimeType: null, isoBrand: null, codecs: [] }
  try {
    const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer())
    dbg('sniff: first bytes =', toHex(head))
    // ISO base media (mp4/mov/3gp/m4v): 'ftyp' at offset 4.
    if (head.length >= 8 && head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70) {
      info.mimeType = 'video/mp4'
      info.isoBrand = String.fromCharCode(head[8] || 0, head[9] || 0, head[10] || 0, head[11] || 0)
      const scanSize = 512 * 1024
      const headChunk = new Uint8Array(await blob.slice(0, Math.min(scanSize, blob.size)).arrayBuffer())
      info.codecs = findFourccs(headChunk, VIDEO_CODEC_FOURCCS)
      if (!info.codecs.length && blob.size > scanSize) {
        const tailChunk = new Uint8Array(await blob.slice(Math.max(0, blob.size - scanSize)).arrayBuffer())
        info.codecs = findFourccs(tailChunk, VIDEO_CODEC_FOURCCS)
      }
      dbg(
        'sniff: ISO-BMFF, major brand =',
        JSON.stringify(info.isoBrand),
        'codecs =',
        info.codecs.join(',') || 'none-found'
      )
      return info
    }
    // EBML header (webm/mkv)
    if (head.length >= 4 && head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) {
      dbg('sniff: EBML (webm/mkv) detected')
      info.mimeType = 'video/webm'
      return info
    }
    // 'OggS'
    if (head.length >= 4 && head[0] === 0x4f && head[1] === 0x67 && head[2] === 0x67 && head[3] === 0x53) {
      dbg('sniff: Ogg detected')
      info.mimeType = 'video/ogg'
      return info
    }
    dbg('sniff: unknown container')
    return info
  } catch (error) {
    log.error('Failed to sniff video container:', error)
    return info
  }
}

export const isFirefox = () => typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent)
