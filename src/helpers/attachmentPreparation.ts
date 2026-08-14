export type VideoPreparation = {
  file: File
  metadata?: any
  videoPreviewBlob?: Blob
  status: 'loading' | 'ready' | 'failed'
}

type PreparationEntry = VideoPreparation & {
  promise: Promise<VideoPreparation>
  resolve: (value: VideoPreparation) => void
}

const preparations = new Map<string, PreparationEntry>()

export const beginVideoPreparation = (tid: string, file: File) => {
  let resolvePreparation!: (value: VideoPreparation) => void
  const promise = new Promise<VideoPreparation>((resolve) => {
    resolvePreparation = resolve
  })
  preparations.set(tid, { file, status: 'loading', promise, resolve: resolvePreparation })
}

export const completeVideoPreparation = (tid: string, preparation: Omit<VideoPreparation, 'status'>) => {
  const entry = preparations.get(tid)
  if (!entry || entry.status !== 'loading') return
  const completed: VideoPreparation = { ...preparation, status: 'ready' }
  preparations.set(tid, { ...entry, ...completed })
  entry.resolve(completed)
}

export const failVideoPreparation = (tid: string) => {
  const entry = preparations.get(tid)
  if (!entry || entry.status !== 'loading') return
  const failed: VideoPreparation = { file: entry.file, status: 'failed' }
  preparations.set(tid, { ...entry, ...failed })
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

export const clearVideoPreparation = (tid: string) => {
  preparations.delete(tid)
}
