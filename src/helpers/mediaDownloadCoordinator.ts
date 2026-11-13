import { IAttachment } from '../types'
import { isUnopenableAttachmentError } from './attachmentEncryption'
import { attachmentTransferRouter } from '../fileTransfer/attachmentTransferRouter'
import { FileEncryptionInfo } from '../fileTransfer/encryption/types'
import { TransferExecutor } from '../fileTransfer/transferExecutor'
import { getAttachmentURLWithVersion, getAttachmentUrlFromCache, setAttachmentToCache } from './attachmentsCache'
import { registerBlobUrl } from './attachmentBlobUrls'
import { ensurePlayableVideoBlob } from './videoConversion'
import {
  createConnectionLostDownloadError,
  isNetworkOffline,
  showFileTransferFailedPopup
} from './fileTransferFailedPopup'

export type MediaDownloadKind = 'original-image' | 'original-video' | 'video-thumbnail' | 'voice' | 'file'

export interface MediaDownloadRequest {
  key: string
  /** The attachment the file belongs to: the transport gets it. */
  attachment: IAttachment
  url: string
  cacheKey: string
  cacheKeys?: string[]
  kind: MediaDownloadKind
  messageType?: string | null
  size?: number
  skipCacheLookup?: boolean
  /** What opens the file when it is encrypted: the download is decrypted before it is cached or shown. */
  encryption?: FileEncryptionInfo
  /** Type of the decrypted file (encrypted objects are stored as application/octet-stream). */
  contentType?: string
  /** The user asked to try again: a file that could not be opened before is downloaded again. */
  retry?: boolean
  /**
   * The user started it (a tap): a failure shows the "Download failed" popup, and with the
   * browser offline it fails at once. A download started by itself only shows as failed.
   */
  showsFailure?: boolean
}

export interface MediaDownloadSnapshot {
  state: 'idle' | 'loading' | 'completed' | 'failed' | 'cancelled'
  loaded: number
  total: number
  progress: number
}

export interface MediaDownloadResult {
  blob: Blob
  objectUrl: string
}

interface MediaDownloadJob {
  version: number
  snapshot: MediaDownloadSnapshot
  promise: Promise<MediaDownloadResult>
  transfer?: TransferExecutor<Blob>
  cacheKeys: Set<string>
  cancelled?: boolean
  // A request of the user's joined it: its failure shows the popup.
  showsFailure?: boolean
}

const idleSnapshot: MediaDownloadSnapshot = { state: 'idle', loaded: 0, total: 0, progress: 0 }
const jobs = new Map<string, MediaDownloadJob>()
const snapshots = new Map<string, MediaDownloadSnapshot>()
const listeners = new Map<string, Set<() => void>>()
const jobVersions = new Map<string, number>()
// Files that downloaded but could not be opened (decryption failed): the same
// bytes and key fail every time, so a remount or reconnect does not download
// them again. Only a retry the user asks for does.
const unopenable = new Map<string, { fileKey?: string; error: unknown }>()

const notify = (key: string) => {
  listeners.get(key)?.forEach((listener) => listener())
}

const setSnapshot = (key: string, snapshot: MediaDownloadSnapshot) => {
  snapshots.set(key, snapshot)
  const job = jobs.get(key)
  if (job) job.snapshot = snapshot
  notify(key)
}

const setJobSnapshot = (key: string, job: MediaDownloadJob, snapshot: MediaDownloadSnapshot) => {
  // An older cancelled request can finish after a retry has already started.
  // Its late progress/failure must not replace the retry's current state.
  if (jobVersions.get(key) !== job.version) return
  setSnapshot(key, snapshot)
}

const makeObjectUrl = async (
  request: MediaDownloadRequest,
  sourceBlob: Blob,
  cacheKeys: Set<string>
): Promise<MediaDownloadResult> => {
  const blob = request.kind === 'original-video' ? await ensurePlayableVideoBlob(sourceBlob) : sourceBlob
  // Cache Storage is an optimization. A quota or browser-cache failure must
  // not prevent an already downloaded attachment from being displayed.
  await Promise.all(
    Array.from(cacheKeys).map((cacheKey) =>
      Promise.resolve(
        setAttachmentToCache(
          cacheKey,
          new Response(blob, { headers: { 'Content-Type': blob.type || 'application/octet-stream' } })
        )
      ).catch(() => undefined)
    )
  )
  const cachedObjectUrl = await getAttachmentUrlFromCache(request.cacheKey).catch(() => false)
  if (typeof cachedObjectUrl === 'string') {
    return { blob, objectUrl: cachedObjectUrl }
  }
  const objectUrl = URL.createObjectURL(blob)
  cacheKeys.forEach((cacheKey) => registerBlobUrl(getAttachmentURLWithVersion(cacheKey), objectUrl))
  return { blob, objectUrl }
}

const download = async (request: MediaDownloadRequest, job: MediaDownloadJob): Promise<MediaDownloadResult> => {
  // Message attachment size is the authoritative server-side file size; a file of
  // unknown size (a video's preview image) is counted out of 100.
  const total = Number(request.size) || 100
  // The transport (fileTransfer.provider); an encrypted file comes back from it
  // decrypted, checked against the attachment's size (a preview image has none).
  // One transport operation per job: a video and its preview are separate ones.
  const transfer = attachmentTransferRouter.download(
    request.attachment,
    {
      url: request.url,
      mimeType: request.contentType,
      encryptionInfo: request.encryption,
      plaintextSize: request.kind === 'video-thumbnail' ? undefined : request.attachment.size,
      messageType: request.messageType
    },
    request.key
  )
  job.transfer = transfer
  const result = await transfer.execute({
    onProgress: (percent) => {
      // A cancelled transfer that is still running must not turn the shared state back to loading.
      if (job.cancelled) return
      setJobSnapshot(request.key, job, {
        state: 'loading',
        loaded: (total * percent) / 100,
        total,
        progress: Math.max(0, Math.min(100, percent))
      })
    }
  })
  if (result.type !== 'success') throw result.error
  return makeObjectUrl(request, result.result, job.cacheKeys)
}

const getCachedMediaResult = async (cacheKey: string): Promise<MediaDownloadResult | undefined> => {
  const objectUrl = await getAttachmentUrlFromCache(cacheKey).catch(() => false)
  if (typeof objectUrl !== 'string') return undefined

  // Cache Storage gives us a shared blob URL. Reading that URL is local to the
  // browser; it does not issue another attachment/network download.
  const response = await fetch(objectUrl)
  if (!response.ok) return undefined
  return { blob: await response.blob(), objectUrl }
}

const throwIfCancelled = (job: MediaDownloadJob) => {
  if (!job.cancelled) return

  const error = new Error('Media download cancelled')
  error.name = 'AbortError'
  throw error
}

export const requestMediaDownload = (request: MediaDownloadRequest): Promise<MediaDownloadResult> => {
  const active = jobs.get(request.key)
  if (active) {
    if (request.showsFailure) active.showsFailure = true
    active.cacheKeys.add(request.cacheKey)
    request.cacheKeys?.forEach((cacheKey) => active.cacheKeys.add(cacheKey))
    return active.promise
  }

  const failure = unopenable.get(request.key)
  if (failure && failure.fileKey === request.encryption?.encodedKeys && !request.retry) {
    if (getMediaDownloadSnapshot(request.key).state !== 'failed') {
      setSnapshot(request.key, { state: 'failed', loaded: 0, total: 0, progress: 0 })
    }
    if (request.showsFailure) showFileTransferFailedPopup('download')
    return Promise.reject(failure.error)
  }
  unopenable.delete(request.key)

  const job: MediaDownloadJob = {
    version: (jobVersions.get(request.key) || 0) + 1,
    snapshot: { state: 'loading', loaded: 0, total: request.size || 0, progress: 0 },
    promise: undefined as any,
    cacheKeys: new Set([request.cacheKey, ...(request.cacheKeys || [])]),
    showsFailure: request.showsFailure
  }
  jobVersions.set(request.key, job.version)
  jobs.set(request.key, job)
  // A cached file is not downloaded, so it never shows as loading: e.g. a video's
  // tiles remounting (switching chats) would flash the download progress. A new
  // try after a cancel or a failure shows it at once.
  const previousState = getMediaDownloadSnapshot(request.key).state
  const showsLoadingAtOnce = request.skipCacheLookup || previousState === 'cancelled' || previousState === 'failed'
  if (showsLoadingAtOnce) setJobSnapshot(request.key, job, job.snapshot)

  const promise = Promise.resolve()
    .then(async () => {
      throwIfCancelled(job)
      const cachedResult = request.skipCacheLookup
        ? undefined
        : await getCachedMediaResult(request.cacheKey).catch(() => undefined)
      throwIfCancelled(job)
      if (cachedResult) return cachedResult
      // A tap with the browser offline is not tried: the download would wait or fail later.
      if (request.showsFailure && isNetworkOffline()) throw createConnectionLostDownloadError()
      if (!showsLoadingAtOnce) setJobSnapshot(request.key, job, job.snapshot)
      return download(request, job)
    })
    .then((result) => {
      // A downloader may resolve after its request was cancelled (notably
      // custom downloader implementations without AbortController support).
      // Never let that late completion replace the visible cancelled state.
      throwIfCancelled(job)
      setJobSnapshot(request.key, job, {
        state: 'completed',
        loaded: result.blob.size,
        total: result.blob.size,
        progress: 100
      })
      return result
    })
    .catch((error) => {
      // Custom downloaders do not consistently preserve AbortError. An app's
      // AWS downloader, for example, reports Error('DOWNLOAD_CANCELLED')
      // after its AbortController fires. The local cancellation intent is the
      // authoritative signal, so its UI state must remain cancelled.
      const cancelled = job.cancelled || error?.name === 'AbortError'
      if (!cancelled && isUnopenableAttachmentError(error)) {
        unopenable.set(request.key, { fileKey: request.encryption?.encodedKeys, error })
      }
      setJobSnapshot(request.key, job, {
        state: cancelled ? 'cancelled' : 'failed',
        loaded: 0,
        total: 0,
        progress: 0
      })
      if (!cancelled && job.showsFailure) showFileTransferFailedPopup('download')
      throw error
    })
    .finally(() => {
      // A cancelled key can be retried immediately. Do not remove that newer
      // job when the old, cancelled promise settles later.
      if (jobs.get(request.key) === job) {
        jobs.delete(request.key)
      }
    })

  job.promise = promise
  return promise
}

export const cancelMediaDownload = (key: string) => {
  const job = jobs.get(key)
  if (!job) return

  job.cancelled = true
  // Update every chat/media-tab/slider subscriber synchronously so the
  // cancel control becomes a Download icon immediately. Releasing the key
  // here allows that icon to start a brand-new transfer without waiting for a
  // slow native or custom downloader to reject.
  jobs.delete(key)
  setSnapshot(key, { state: 'cancelled', loaded: 0, total: 0, progress: 0 })
  job.transfer?.discard()
}

export const getMediaDownloadSnapshot = (key?: string): MediaDownloadSnapshot =>
  (key && snapshots.get(key)) || idleSnapshot

export const subscribeToMediaDownload = (key: string, listener: () => void) => {
  const keyListeners = listeners.get(key) || new Set<() => void>()
  keyListeners.add(listener)
  listeners.set(key, keyListeners)
  return () => {
    keyListeners.delete(listener)
    if (!keyListeners.size) listeners.delete(key)
  }
}

export const resetMediaDownloadCoordinatorForTests = () => {
  jobs.clear()
  snapshots.clear()
  listeners.clear()
  jobVersions.clear()
  unopenable.clear()
}
