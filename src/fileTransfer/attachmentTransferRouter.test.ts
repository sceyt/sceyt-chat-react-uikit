import { attachmentTransferRouter, downloadOperationId, uploadOperationId } from './attachmentTransferRouter'
import { FileEncryptionInfo } from './encryption/types'
import { fileTransfer } from './sceytChatUIKitFileTransfer'
import { FileTransferResult, FileTransferProvider, FileUploadType } from '../types/fileTransfer/types'

const ALG = 'tink-aes256-gcm-hkdf-64k+commit-v1'
const KEYS = 'AYCBgoOEhYaHiImKi4yNjo8'
const info: FileEncryptionInfo = { algorithm: ALG, attachmentId: 'file-id', key: 'file-key', encodedKeys: KEYS }
const attachment: any = { tid: 'tid-1', type: 'file', name: 'a.txt' }
const callback = { onProgress: jest.fn() }

const transportReturning = (upload: any, download: any = FileTransferResult.success(new Blob(['x']))) =>
  ({
    upload: jest.fn(async () => upload),
    download: jest.fn(async () => download),
    cancel: jest.fn()
  }) as FileTransferProvider & { upload: jest.Mock; download: jest.Mock }

const source = () => ({ file: new Blob(['hello']), fileName: 'a.txt', mimeType: 'text/plain' })

describe('attachmentTransferRouter', () => {
  const defaults = { provider: fileTransfer.provider, encryptUploads: fileTransfer.encryptUploads }

  afterEach(() => {
    fileTransfer.provider = defaults.provider
    fileTransfer.encryptUploads = defaults.encryptUploads
  })

  it('operation ids are stable per attachment', () => {
    expect(uploadOperationId('tid-1')).toBe('upload:tid-1')
    expect(downloadOperationId('id-1')).toBe('download:id-1')
  })

  describe('upload', () => {
    it("builds a plain request for the selected transport, with the attachment and the attempt's signal", async () => {
      const transport = transportReturning(FileTransferResult.success({ url: 'https://cdn.example/a' }))
      fileTransfer.provider = transport
      const file = source()

      const executor = attachmentTransferRouter.upload(attachment, { ...file, isSharedUpload: true })
      const result = await executor.execute(callback)

      expect(result).toEqual({ type: 'success', result: { url: 'https://cdn.example/a' } })
      const [request, given] = transport.upload.mock.calls[0]
      expect(request).toMatchObject({
        operationId: 'upload:tid-1',
        fileName: 'a.txt',
        mimeType: 'text/plain',
        type: FileUploadType.PLAIN,
        context: { attachment, isSharedUpload: true }
      })
      expect(request.sourceFile).toBe(file.file)
      expect(request.signal).toBe(executor.signal)
      expect(given).toBe(callback)
    })

    it('with encryptUploads on, the request is encrypted and its encryption info comes back', async () => {
      fileTransfer.encryptUploads = true
      const transport = transportReturning(
        FileTransferResult.success({ url: 'https://cdn.example/a', encryptionInfo: info })
      )
      fileTransfer.provider = transport

      const result = await attachmentTransferRouter.upload(attachment, source()).execute(callback)

      expect(transport.upload.mock.calls[0][0].type).toBe(FileUploadType.ENCRYPTED)
      expect(result).toEqual({ type: 'success', result: { url: 'https://cdn.example/a', encryptionInfo: info } })
    })

    it('an encrypted upload without encryption info is a failure: nobody could open the file', async () => {
      fileTransfer.encryptUploads = true
      fileTransfer.provider = transportReturning(FileTransferResult.success({ url: 'https://cdn.example/a' }))

      const result = await attachmentTransferRouter.upload(attachment, source()).execute(callback)

      expect(result).toMatchObject({ type: 'failure', error: { message: expect.stringContaining('no encryption') } })
    })

    it('an encrypted upload whose encryption has no keys string for enc is a failure', async () => {
      fileTransfer.encryptUploads = true
      const { encodedKeys, ...withoutKeys } = info
      expect(encodedKeys).toBe(KEYS)
      fileTransfer.provider = transportReturning(
        FileTransferResult.success({ url: 'https://cdn.example/a', encryptionInfo: withoutKeys })
      )

      const result = await attachmentTransferRouter.upload(attachment, source()).execute(callback)

      expect(result).toMatchObject({ type: 'failure', error: { message: expect.stringContaining('no encryption') } })
    })

    it('an upload without a URL is a failure', async () => {
      fileTransfer.provider = transportReturning(FileTransferResult.success({ url: '' }))

      const result = await attachmentTransferRouter.upload(attachment, source()).execute(callback)

      expect(result).toMatchObject({ type: 'failure', error: { message: 'The upload returned no URL' } })
    })

    it('the transport selected for the attempt keeps it after the transport changes', async () => {
      const first = transportReturning(FileTransferResult.success({ url: 'https://cdn.example/a' }))
      fileTransfer.provider = first
      const executor = attachmentTransferRouter.upload(attachment, source())
      fileTransfer.provider = transportReturning(FileTransferResult.success({ url: 'https://cdn.example/b' }))

      await executor.execute(callback)
      executor.discard()

      expect(first.upload).toHaveBeenCalledTimes(1)
      expect(first.cancel).toHaveBeenCalledWith('upload:tid-1')
    })
  })

  describe('download', () => {
    it("an encrypted download carries its encryption info and the attachment's size", async () => {
      const transport = transportReturning(undefined)
      fileTransfer.provider = transport

      const executor = attachmentTransferRouter.download(attachment, {
        url: 'https://cdn.example/a',
        mimeType: 'image/png',
        encryptionInfo: info,
        plaintextSize: 5
      })
      await executor.execute(callback)

      expect(transport.download.mock.calls[0][0]).toMatchObject({
        operationId: 'download:tid-1',
        url: 'https://cdn.example/a',
        mimeType: 'image/png',
        encryptionInfo: info,
        plaintextSize: 5,
        context: { attachment, isSharedUpload: false }
      })
      expect(transport.download.mock.calls[0][0].signal).toBe(executor.signal)
    })

    it('a download named by its transfer key is its own operation', async () => {
      const transport = transportReturning(undefined)
      fileTransfer.provider = transport

      await attachmentTransferRouter
        .download(attachment, { url: 'https://cdn.example/thumb' }, 'video-thumbnail:https://cdn.example/thumb')
        .execute(callback)

      expect(transport.download.mock.calls[0][0].operationId).toBe('download:video-thumbnail:https://cdn.example/thumb')
    })

    it.each([
      ['the SDK gives it as a string', '5', 5],
      ['it is a number', 5, 5],
      ["it is unknown (the SDK's '0')", '0', undefined],
      ['it is not a whole number', '5.5', undefined],
      ['it is missing', undefined, undefined]
    ])("an encrypted download's trusted size is a byte count when %s", async (_case, size, expected) => {
      const transport = transportReturning(undefined)
      fileTransfer.provider = transport

      await attachmentTransferRouter
        .download(attachment, { url: 'https://cdn.example/a', encryptionInfo: info, plaintextSize: size })
        .execute(callback)

      expect(transport.download.mock.calls[0][0].plaintextSize).toBe(expected)
    })

    it('a plain download has no encryption fields', async () => {
      const transport = transportReturning(undefined)
      fileTransfer.provider = transport

      await attachmentTransferRouter.download({ id: 'id-1' }, { url: 'https://cdn.example/a' } as any).execute(callback)

      const request = transport.download.mock.calls[0][0]
      expect(request.operationId).toBe('download:id-1')
      expect('encryptionInfo' in request).toBe(false)
      expect('plaintextSize' in request).toBe(false)
    })
  })
})
