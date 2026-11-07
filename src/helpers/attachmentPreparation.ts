/**
 * Local work which must finish before an attachment can be rendered as an
 * optimistic media message.  The registry started as video-only, but images
 * also create their preview metadata asynchronously; treating both the same
 * prevents a pending row from winning the race against its thumbnail.
 */
export type AttachmentPreparation = {
  file: File
  metadata?: any
  videoPreviewBlob?: Blob
  status: 'loading' | 'ready' | 'failed'
}

// Kept as an alias for existing video call sites and downstream consumers.
export type VideoPreparation = AttachmentPreparation

/**
 * What the pending message row needs to show the attachment (its thumbnail and
 * size metadata). It can be ready well before the file to upload is, e.g. while a
 * QuickTime video is still being converted to MP4.
 */
export type AttachmentPreview = {
  metadata: any
  videoPreviewBlob?: Blob
}

type PreparationEntry = VideoPreparation & {
  promise: Promise<VideoPreparation>
  resolve: (value: VideoPreparation) => void
  previewPromise: Promise<AttachmentPreview | null>
  resolvePreview: (value: AttachmentPreview | null) => void
}

const preparations = new Map<string, PreparationEntry>()

export const beginVideoPreparation = (tid: string, file: File) => {
  let resolvePreparation!: (value: VideoPreparation) => void
  const promise = new Promise<VideoPreparation>((resolve) => {
    resolvePreparation = resolve
  })
  let resolvePreview!: (value: AttachmentPreview | null) => void
  const previewPromise = new Promise<AttachmentPreview | null>((resolve) => {
    resolvePreview = resolve
  })
  preparations.set(tid, {
    file,
    status: 'loading',
    promise,
    resolve: resolvePreparation,
    previewPromise,
    resolvePreview
  })
}

/**
 * The preview is ready; the file to upload may still be on its way. Only the
 * first preview counts (also over one a finished preparation already gave).
 */
export const completeAttachmentPreview = (tid: string, preview: AttachmentPreview) => {
  preparations.get(tid)?.resolvePreview(preview)
}

export const completeVideoPreparation = (tid: string, preparation: Omit<VideoPreparation, 'status'>) => {
  const entry = preparations.get(tid)
  if (!entry || entry.status !== 'loading') return
  const completed: VideoPreparation = { ...preparation, status: 'ready' }
  preparations.set(tid, { ...entry, ...completed })
  // A preparation without a separate preview step (an image) makes its preview ready now.
  entry.resolvePreview({ metadata: preparation.metadata, videoPreviewBlob: preparation.videoPreviewBlob })
  entry.resolve(completed)
}

export const failVideoPreparation = (tid: string) => {
  const entry = preparations.get(tid)
  if (!entry || entry.status !== 'loading') return
  const failed: VideoPreparation = { file: entry.file, status: 'failed' }
  preparations.set(tid, { ...entry, ...failed })
  entry.resolvePreview(null)
  entry.resolve(failed)
}

export const waitForVideoPreparation = async (tid: string, timeoutMs?: number): Promise<VideoPreparation | null> => {
  const entry = preparations.get(tid)
  if (!entry) return null
  if (entry.status !== 'loading') return entry
  if (timeoutMs === undefined) return await entry.promise

  return await new Promise<VideoPreparation>((resolve) => {
    const timeout = setTimeout(() => resolve({ file: entry.file, status: 'failed' }), timeoutMs)
    entry.promise.then((prepared) => {
      clearTimeout(timeout)
      resolve(prepared)
    })
  })
}

/**
 * The preview of an attachment being prepared: its own preview, or the metadata
 * of the finished preparation. Null when there is no preparation, when it failed
 * or was removed, or after `timeoutMs` (then the row shows without it).
 */
export const waitForAttachmentPreview = async (tid: string, timeoutMs?: number): Promise<AttachmentPreview | null> => {
  const entry = preparations.get(tid)
  if (!entry) return null
  if (timeoutMs === undefined) return await entry.previewPromise

  return await new Promise<AttachmentPreview | null>((resolve) => {
    const timeout = setTimeout(() => resolve(null), timeoutMs)
    entry.previewPromise.then((preview) => {
      clearTimeout(timeout)
      resolve(preview)
    })
  })
}

export const clearVideoPreparation = (tid: string) => {
  const entry = preparations.get(tid)
  // A send saga may already be awaiting this entry when the user removes the
  // pending attachment. Resolve that waiter with the original file instead of
  // leaving it blocked until its fallback timeout.
  if (entry?.status === 'loading') {
    entry.resolvePreview(null)
    entry.resolve({ file: entry.file, status: 'failed' })
  }
  preparations.delete(tid)
}

export const beginAttachmentPreparation = beginVideoPreparation
export const completeAttachmentPreparation = completeVideoPreparation
export const failAttachmentPreparation = failVideoPreparation
export const waitForAttachmentPreparation = waitForVideoPreparation
export const clearAttachmentPreparation = clearVideoPreparation
