import { FileTransferCallback, FileTransferResult, FileTransferTransport } from './types'

// The attempt: given the executor (its signal and transport controls) and the progress callback.
// eslint-disable-next-line no-unused-vars, no-use-before-define
type TransferRun<T> = (executor: TransferExecutor<T>, callback: FileTransferCallback) => Promise<FileTransferResult<T>>

/**
 * Executes one routed transfer attempt and keeps its controls bound to the transport it
 * selected. Its signal goes with the transport request: stopping or discarding aborts it.
 */
export class TransferExecutor<T> {
  readonly operationId: string
  private readonly transport: FileTransferTransport
  private readonly run: TransferRun<T>

  private readonly controller = new AbortController()
  private transferring = false
  private discarded = false

  constructor(operationId: string, transport: FileTransferTransport, run: TransferRun<T>) {
    this.operationId = operationId
    this.transport = transport
    this.run = run
  }

  /** Aborted when the attempt is stopped or discarded. */
  get signal(): AbortSignal {
    return this.controller.signal
  }

  execute(callback: FileTransferCallback): Promise<FileTransferResult<T>> {
    return this.run(this, callback)
  }

  /** Runs the transport call; native pause and resume apply only while it runs. */
  async executeTransport<R>(block: () => Promise<FileTransferResult<R>>): Promise<FileTransferResult<R>> {
    if (this.signal.aborted) return FileTransferResult.interrupted(new Error('The transfer was stopped'))
    this.transferring = true
    try {
      return await block()
    } finally {
      this.transferring = false
    }
  }

  /** Native pause: `true` when the transport keeps the operation for `resume`. */
  pause(): boolean {
    return this.transferring && !!this.transport.pause && this.transport.pause(this.operationId)
  }

  /** Native resume: `true` when the same transport call continues. */
  resume(): boolean {
    return this.transferring && !!this.transport.resume && this.transport.resume(this.operationId)
  }

  /** Stops the attempt (pause fallback, a lost connection): the transport keeps its recovery state. */
  stop(): void {
    this.controller.abort()
  }

  /** Explicit abandonment: stops the attempt and lets the transport clean up its backend state. */
  discard(): void {
    if (this.discarded) return
    this.discarded = true
    this.controller.abort()
    this.transport.cancel(this.operationId)
  }
}
