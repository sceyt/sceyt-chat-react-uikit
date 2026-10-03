import { getCustomDownloader, getCustomUploader } from './customUploader'
import { readResponseBlobWithProgress } from './getVideoFrame'
import { getAttachmentURLWithVersion, getAttachmentUrlFromCache, setAttachmentToCache } from './attachmentsCache'
import { registerBlobUrl } from './attachmentBlobUrls'
import { ensurePlayableVideoBlob } from './videoConversion'

export type MediaDownloadKind = 'original-image' | 'original-video' | 'video-thumbnail' | 'voice' | 'file'

export interface MediaDownloadRequest {
  key: string
  url: string
  cacheKey: string
  cacheKeys?: string[]
  kind: MediaDownloadKind
  messageType?: string | null
  size?: number
  downloader?: (
    url: string,
    download: boolean,
    progress: (progress: any) => void,
    messageType?: string | null
  ) => Promise<any>
  customDownload?: boolean
  skipCacheLookup?: boolean
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
  abortController?: AbortController
  customRequest?: Promise<any>
  cacheKeys: Set<string>
  cancelled?: boolean
}

const idleSnapshot: MediaDownloadSnapshot = { state: 'idle', loaded: 0, total: 0, progress: 0 }
const jobs = new Map<string, MediaDownloadJob>()
const snapshots = new Map<string, MediaDownloadSnapshot>()
const listeners = new Map<string, Set<() => void>>()
const jobVersions = new Map<string, number>()

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

const normalizeProgress = (progress: any, fallbackTotal: number = 0) => {
  const loaded = progress?.loaded ?? progress?.uploaded ?? 0
  const reportedTotal = progress?.total ?? 0
  // Message attachment size is the authoritative server-side file size. Some
  // custom downloaders report an intermediate/proxy response length instead,
  // which made large files appear much smaller in the UI.
  const total = Math.max(reportedTotal || 0, fallbackTotal || 0)
  const fraction = total > 0 ? loaded / total : progress?.progress || 0
  return {
    loaded,
    total,
    progress: Math.max(0, Math.min(100, fraction * 100))
  }
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
  const reportProgress = (progress: any) => {
    // URL-returning custom downloaders may first emit a synthetic 1 B / 1 B
    // completion while resolving the actual media URL. Do not surface that
    // transport marker as attachment progress; the following media request
    // reports the real bytes.
    const rawLoaded = progress?.loaded ?? progress?.uploaded ?? 0
    const rawTotal = progress?.total ?? 0
    if (rawLoaded <= 1 && rawTotal <= 1) {
      return
    }
    const normalized = normalizeProgress(progress, request.size)
    setJobSnapshot(request.key, job, { state: 'loading', ...normalized })
  }
  const customDownloader = request.downloader || getCustomDownloader()

  if (customDownloader) {
    // Shared media needs a Blob to cache and to publish one reusable object
    // URL. Custom uploader implementations (including WAAFI's AWS uploader)
    // use `download: true` for that full-download path; `false` only returns
    // a short-lived URL which the coordinator would have to fetch again.
    const requestBlob = request.customDownload ?? true
    const customRequest = customDownloader(request.url, requestBlob, reportProgress, request.messageType)
    job.customRequest = customRequest
    const result = await customRequest
    const body = result?.Body || result
    if (body instanceof Blob) {
      reportProgress({ loaded: body.size, total: body.size })
      return makeObjectUrl(request, body, job.cacheKeys)
    }
    if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
      const blob = new Blob([body], { type: 'application/octet-stream' })
      reportProgress({ loaded: blob.size, total: blob.size })
      return makeObjectUrl(request, blob, job.cacheKeys)
    }
    if (typeof body !== 'string') {
      throw new Error('Media downloader returned an unsupported result')
    }

    // Some custom downloaders return a local/remote URL rather than a Blob.
    // Fetch it once here so all subscribers still share the same blob result.
    job.abortController = new AbortController()
    const response = await fetch(body, { signal: job.abortController.signal })
    if (!response.ok) {
      throw new Error(`Unable to read downloaded media (${response.status})`)
    }
    const blob = await readResponseBlobWithProgress(response, reportProgress, request.size || 0)
    return makeObjectUrl(request, blob, job.cacheKeys)
  }

  job.abortController = new AbortController()
  const response = await fetch(request.url, { signal: job.abortController.signal })
  if (!response.ok) {
    const label = request.kind === 'video-thumbnail' ? 'Unable to download video preview' : 'Unable to download media'
    throw new Error(`${label} (${response.status})`)
  }
  const blob = await readResponseBlobWithProgress(response, reportProgress, request.size || 0)
  return makeObjectUrl(request, blob, job.cacheKeys)
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
    active.cacheKeys.add(request.cacheKey)
    request.cacheKeys?.forEach((cacheKey) => active.cacheKeys.add(cacheKey))
    return active.promise
  }

  const job: MediaDownloadJob = {
    version: (jobVersions.get(request.key) || 0) + 1,
    snapshot: { state: 'loading', loaded: 0, total: request.size || 0, progress: 0 },
    promise: undefined as any,
    cacheKeys: new Set([request.cacheKey, ...(request.cacheKeys || [])])
  }
  jobVersions.set(request.key, job.version)
  jobs.set(request.key, job)
  setJobSnapshot(request.key, job, job.snapshot)

  const promise = Promise.resolve()
    .then(async () => {
      throwIfCancelled(job)
      const cachedResult = request.skipCacheLookup
        ? undefined
        : await getCachedMediaResult(request.cacheKey).catch(() => undefined)
      throwIfCancelled(job)
      if (cachedResult) return cachedResult
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
      // Custom downloaders do not consistently preserve AbortError. WAAFI's
      // AWS downloader, for example, reports Error('DOWNLOAD_CANCELLED')
      // after its AbortController fires. The local cancellation intent is the
      // authoritative signal, so its UI state must remain cancelled.
      const cancelled = job.cancelled || error?.name === 'AbortError'
      setJobSnapshot(request.key, job, {
        state: cancelled ? 'cancelled' : 'failed',
        loaded: 0,
        total: 0,
        progress: 0
      })
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
  if (job.abortController) job.abortController.abort()
  if (job.customRequest) getCustomUploader()?.cancelRequest(job.customRequest)
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
}
