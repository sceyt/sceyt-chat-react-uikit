import log from 'loglevel'
import { IAttachment } from '../types'
import { isConnectionLost } from '../helpers/sendAttachments'
import { attachmentTransferRouter, IUploadSource } from './attachmentTransferRouter'
import { TransferExecutor } from './transferExecutor'
import { FileUploadResult } from '../types/fileTransfer/types'

// Schedules attachment uploads through the router, as the Android UIKit's
// AttachmentUploadCoordinator does: a pause asks the transport to pause natively and
// otherwise stops the attempt; a resume continues the paused transport call or starts a
// new attempt with the same operation id. A stopped attempt's failure is ignored (the
// upload waits for resume); a file it stored still counts.

interface Attempt {
  executor: TransferExecutor<FileUploadResult>
  /** Stopped by a pause or a cancel: its result is not the upload's. */
  stopped: boolean
  /** Paused by the transport itself: `resume` continues the same call. */
  nativePaused: boolean
}

interface Upload {
  attachment: IAttachment
  source: IUploadSource
  paused: boolean
  attempt?: Attempt
  // The highest progress shown: a new attempt reports from 0 again, so it is shown once it passes it.
  shownPercent: number
  // eslint-disable-next-line no-unused-vars
  onProgress: (percent: number) => void
  // eslint-disable-next-line no-unused-vars
  resolve: (result: FileUploadResult) => void
  // eslint-disable-next-line no-unused-vars
  reject: (error: Error) => void
  /** What its senders wait for: a second call for the attachment joins it. */
  promise?: Promise<FileUploadResult>
}

const uploads = new Map<string, Upload>()
// Uploads that show a stop control before they start (a video while its preview
// is uploaded): a pause pressed meanwhile is kept here and applied when it starts.
const notStartedUploads = new Map<string, { paused: boolean }>()

const start = (upload: Upload) => {
  const executor = attachmentTransferRouter.upload(upload.attachment, upload.source)
  const attempt: Attempt = { executor, stopped: false, nativePaused: false }
  upload.attempt = attempt
  const current = () => upload.attempt === attempt && !attempt.stopped
  executor
    .execute({
      onProgress: (percent) => {
        // Bytes reported while the connection is lost went into it: not shown, nor held.
        if (!current() || upload.paused || percent < upload.shownPercent || isConnectionLost()) return
        upload.shownPercent = percent
        upload.onProgress(percent)
      }
    })
    .then(
      (result) => result,
      (error) => ({ type: 'failure' as const, error: error instanceof Error ? error : new Error(String(error)) })
    )
    .then((result) => {
      // A stopped attempt that stored the file still counts; its failure is the stop's.
      const stoppedSuccess = upload.attempt === attempt && result.type === 'success'
      if (!current() && !stoppedSuccess) return
      if (uploads.get(upload.attachment.tid!) !== upload) return
      upload.attempt = undefined
      uploads.delete(upload.attachment.tid!)
      if (result.type === 'success') upload.resolve(result.result)
      else upload.reject(result.error)
    })
}

const stopAttempt = (upload: Upload) => {
  const attempt = upload.attempt
  if (!attempt || attempt.stopped) return
  attempt.stopped = true
  attempt.executor.stop()
}

export const markUploadNotStarted = (attachmentTid: string) => {
  notStartedUploads.set(attachmentTid, { paused: false })
}

export const isUploadNotStarted = (attachmentTid: string) => notStartedUploads.has(attachmentTid)

export const isUploadPausedBeforeStart = (attachmentTid: string) => !!notStartedUploads.get(attachmentTid)?.paused

/**
 * Uploads one attachment's file with `fileTransfer.provider`. `onProgress` gets the percent
 * sent. It settles once the file is stored or the upload fails; a cancelled upload rejects
 * with an AbortError. One writer per attachment: a call while its upload runs joins it (the
 * same result and progress), so a resuming provider never has two uploads of one file.
 */
export const uploadAttachment = (
  attachment: IAttachment,
  source: IUploadSource,
  // eslint-disable-next-line no-unused-vars
  onProgress: (percent: number) => void
): Promise<FileUploadResult> => {
  const tid = attachment.tid!
  const running = uploads.get(tid)
  if (running?.promise) {
    const shown = running.onProgress
    running.onProgress = (percent) => {
      shown(percent)
      onProgress(percent)
    }
    return running.promise
  }
  let upload!: Upload
  const uploaded = new Promise<FileUploadResult>((resolve, reject) => {
    upload = {
      attachment,
      source,
      paused: isUploadPausedBeforeStart(tid),
      shownPercent: 0,
      onProgress,
      resolve,
      reject
    }
  })
  upload.promise = uploaded
  notStartedUploads.delete(tid)
  uploads.set(tid, upload)
  // A pause pressed before the start: nothing is sent until resume.
  if (!upload.paused) start(upload)
  // An upload cancelled after its sender stopped waiting (a deleted message) is not an unhandled error.
  uploaded.catch(() => undefined)
  return uploaded
}

/** Pauses an upload: `true` when it is paused. */
export const pauseUpload = (attachmentTid: string) => {
  const upload = uploads.get(attachmentTid)
  if (upload) {
    if (upload.paused) return true
    upload.paused = true
    const attempt = upload.attempt
    if (attempt && !attempt.stopped) {
      if (attempt.executor.pause()) attempt.nativePaused = true
      else stopAttempt(upload)
    }
    return true
  }
  if (notStartedUploads.has(attachmentTid)) {
    notStartedUploads.set(attachmentTid, { paused: true })
    return true
  }
  log.info('Unknown uploading task')
  return false
}

/** Resumes a paused upload: `true` when it goes on. */
export const resumeUpload = (attachmentTid: string) => {
  const upload = uploads.get(attachmentTid)
  if (upload) {
    if (!upload.paused) return true
    upload.paused = false
    const attempt = upload.attempt
    if (attempt && !attempt.stopped && attempt.nativePaused) {
      if (attempt.executor.resume()) {
        attempt.nativePaused = false
        return true
      }
      stopAttempt(upload)
    }
    if (!upload.attempt || upload.attempt.stopped) start(upload)
    return true
  }
  if (notStartedUploads.has(attachmentTid)) {
    notStartedUploads.set(attachmentTid, { paused: false })
    return true
  }
  log.info('Unknown uploading task')
  return false
}

/**
 * Abandons an upload: the transport may clean up its backend state, and the upload rejects
 * with an AbortError, so its sender moves on (its message is gone).
 */
export const cancelUpload = (attachmentTid: string) => {
  notStartedUploads.delete(attachmentTid)
  const upload = uploads.get(attachmentTid)
  if (!upload) return
  uploads.delete(attachmentTid)
  if (upload.attempt) {
    upload.attempt.stopped = true
    upload.attempt.executor.discard()
  }
  upload.reject(Object.assign(new Error('The upload was cancelled'), { name: 'AbortError' }))
}

export const resetAttachmentUploadsForTests = () => {
  uploads.clear()
  notStartedUploads.clear()
}
