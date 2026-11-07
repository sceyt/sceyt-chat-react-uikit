import { FileTransferCallback, FileTransferResult, FileTransferProvider } from '../types/fileTransfer/types'

// The attempt: given the executor (its signal and provider controls) and the progress callback.
// eslint-disable-next-line no-unused-vars, no-use-before-define
type TransferRun<T> = (executor: TransferExecutor<T>, callback: FileTransferCallback) => Promise<FileTransferResult<T>>

/**
 * Executes one routed transfer attempt and keeps its controls bound to the provider it
 * selected. Its signal goes with the provider request: stopping or discarding aborts it.
 */
export class TransferExecutor<T> {
  readonly operationId: string
  private readonly provider: FileTransferProvider
  private readonly run: TransferRun<T>

  private readonly controller = new AbortController()
  private transferring = false
  private discarded = false

  constructor(operationId: string, provider: FileTransferProvider, run: TransferRun<T>) {
    this.operationId = operationId
    this.provider = provider
    this.run = run
  }

  /** Aborted when the attempt is stopped or discarded. */
  get signal(): AbortSignal {
    return this.controller.signal
  }

  execute(callback: FileTransferCallback): Promise<FileTransferResult<T>> {
    return this.run(this, callback)
  }

  /** Runs the provider call; pause and resume apply only while it runs. */
  async executeTransport<R>(block: () => Promise<FileTransferResult<R>>): Promise<FileTransferResult<R>> {
    if (this.signal.aborted) return FileTransferResult.interrupted(new Error('The transfer was stopped'))
    this.transferring = true
    try {
      return await block()
    } finally {
      this.transferring = false
    }
  }

  /** Pause: `true` when the provider keeps the operation for `resume`. */
  pause(): boolean {
    return this.transferring && !!this.provider.pause && this.provider.pause(this.operationId)
  }

  /** Resume: `true` when the same provider call continues. */
  resume(): boolean {
    return this.transferring && !!this.provider.resume && this.provider.resume(this.operationId)
  }

  /** Stops the attempt (pause fallback, a lost connection): the provider keeps its recovery state. */
  stop(): void {
    this.controller.abort()
  }

  /** Explicit abandonment: stops the attempt and lets the provider clean up its backend state. */
  discard(): void {
    if (this.discarded) return
    this.discarded = true
    this.controller.abort()
    this.provider.cancel(this.operationId)
  }
}
