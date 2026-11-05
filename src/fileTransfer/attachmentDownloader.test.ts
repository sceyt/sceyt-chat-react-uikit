import { cancelDownloadRequest, getAttachmentDownloader } from './attachmentDownloader'
import { fileTransfer } from './sceytChatUIKitFileTransfer'
import { FileDownloadRequest, FileTransferCallback, FileTransferResult } from './types'
import { fakeEncryptionInfo } from '../testUtils/fakeAttachmentFiles'

const attachment: any = { id: 'id-1', tid: 'tid-1', name: 'photo.png', size: 200 }

const transportDownloading = (download: (request: FileDownloadRequest, callback: FileTransferCallback) => any) => {
  const transport = { upload: jest.fn(), download: jest.fn(download), cancel: jest.fn() }
  fileTransfer.transport = transport
  return transport
}

describe('getAttachmentDownloader', () => {
  afterEach(() => fileTransfer.configure())

  it("downloads through the transport and resolves with { Body, ContentType }; progress is in the file's bytes", async () => {
    const file = new Blob(['picture'], { type: 'image/png' })
    const transport = transportDownloading(async (_request, callback) => {
      callback.onProgress(50)
      return FileTransferResult.success(file)
    })
    const progress = jest.fn()

    const result = await getAttachmentDownloader(attachment, undefined, 'image/png')(
      'https://cdn.example/a',
      true,
      progress
    )

    expect(result).toEqual({ Body: file, ContentType: 'image/png' })
    expect(transport.download.mock.calls[0][0]).toMatchObject({ url: 'https://cdn.example/a', mimeType: 'image/png' })
    expect(progress).toHaveBeenCalledWith({ loaded: 100, total: 200 })
  })

  it("an encrypted file is asked for with its encryption info and the attachment's size", async () => {
    const transport = transportDownloading(async () => FileTransferResult.success(new Blob(['x'])))

    await getAttachmentDownloader(attachment, fakeEncryptionInfo('key-1'), 'image/png')(
      'https://cdn.example/a',
      true,
      jest.fn()
    )

    expect(transport.download.mock.calls[0][0]).toMatchObject({
      encryptionInfo: fakeEncryptionInfo('key-1'),
      plaintextSize: 200
    })
  })

  it('a failed download rejects with the transport error', async () => {
    const gone = new Error('404')
    transportDownloading(async () => FileTransferResult.failure(gone))

    await expect(getAttachmentDownloader(attachment)('https://cdn.example/a', true, jest.fn())).rejects.toBe(gone)
  })

  it('cancelling a request aborts it and lets the transport clean up', () => {
    let signal: AbortSignal | undefined
    const transport = transportDownloading((request) => {
      signal = request.signal
      return new Promise(() => undefined)
    })

    const request = getAttachmentDownloader(attachment)('https://cdn.example/a', true, jest.fn())
    cancelDownloadRequest(request)

    expect(signal!.aborted).toBe(true)
    expect(transport.cancel).toHaveBeenCalledWith('download:tid-1')
  })
})
