import { TransferExecutor } from './transferExecutor'
import { FileTransferResult, FileTransferProvider } from '../types/fileTransfer/types'

const transportWith = (overrides: Partial<FileTransferProvider> = {}): FileTransferProvider => ({
  upload: jest.fn(),
  download: jest.fn(),
  pause: jest.fn(() => true),
  resume: jest.fn(() => true),
  cancel: jest.fn(),
  ...overrides
})

// A transport call the test ends by hand.
const pending = () => {
  let finish: (result: FileTransferResult<string>) => void = () => {}
  const result = new Promise<FileTransferResult<string>>((resolve) => {
    finish = resolve
  })
  return { result, finish }
}

describe('TransferExecutor', () => {
  it("runs the attempt with the caller's callback and returns its result", async () => {
    const callback = { onProgress: jest.fn() }
    const run = jest.fn(async (execution: TransferExecutor<string>) =>
      execution.executeTransport(async () => FileTransferResult.success('done'))
    )
    const executor = new TransferExecutor('upload:tid-1', transportWith(), run)

    expect(await executor.execute(callback)).toEqual({ type: 'success', result: 'done' })
    expect(run).toHaveBeenCalledWith(executor, callback)
  })

  it('pause and resume reach the transport only while its call runs', async () => {
    const transport = transportWith()
    const call = pending()
    const executor = new TransferExecutor<string>('upload:tid-1', transport, (execution) =>
      execution.executeTransport(() => call.result)
    )

    expect(executor.pause()).toBe(false)
    const running = executor.execute({ onProgress: jest.fn() })
    expect(executor.pause()).toBe(true)
    expect(executor.resume()).toBe(true)
    expect(transport.pause).toHaveBeenCalledWith('upload:tid-1')
    expect(transport.resume).toHaveBeenCalledWith('upload:tid-1')

    call.finish(FileTransferResult.success('done'))
    await running
    expect(executor.pause()).toBe(false)
    expect(transport.pause).toHaveBeenCalledTimes(1)
  })

  it('a transport without native pause is not paused', async () => {
    const call = pending()
    const executor = new TransferExecutor<string>(
      'upload:tid-1',
      transportWith({ pause: undefined, resume: undefined }),
      (execution) => execution.executeTransport(() => call.result)
    )

    const running = executor.execute({ onProgress: jest.fn() })
    expect(executor.pause()).toBe(false)
    expect(executor.resume()).toBe(false)
    call.finish(FileTransferResult.success('done'))
    await running
  })

  it('stop aborts the signal and keeps the transport state', () => {
    const transport = transportWith()
    const executor = new TransferExecutor<string>('upload:tid-1', transport, jest.fn())

    executor.stop()

    expect(executor.signal.aborted).toBe(true)
    expect(transport.cancel).not.toHaveBeenCalled()
  })

  it('discard aborts the signal and cancels the operation once', () => {
    const transport = transportWith()
    const executor = new TransferExecutor<string>('upload:tid-1', transport, jest.fn())

    executor.discard()
    executor.discard()

    expect(executor.signal.aborted).toBe(true)
    expect(transport.cancel).toHaveBeenCalledTimes(1)
    expect(transport.cancel).toHaveBeenCalledWith('upload:tid-1')
  })

  it('a stopped attempt does not call the transport and is interrupted', async () => {
    const block = jest.fn()
    const executor = new TransferExecutor<string>('upload:tid-1', transportWith(), (execution) =>
      execution.executeTransport(block)
    )

    executor.stop()
    const result = await executor.execute({ onProgress: jest.fn() })

    expect(result.type).toBe('interrupted')
    expect(block).not.toHaveBeenCalled()
  })
})
