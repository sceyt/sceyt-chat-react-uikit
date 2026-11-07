import { deletePendingAttachment } from '../helpers/messagesHalper'
import { fileTransfer } from './sceytChatUIKitFileTransfer'
import { FileTransferProvider, FileUploadType } from '../types/fileTransfer/types'
import { prepareAttachmentUpload } from './uploadPreparer'

const metadata = { szw: 640, szh: 480, tmb: 'thumb' }
const attachmentWith = (tid: string, withMetadata: unknown = JSON.stringify(metadata)): any => ({
  tid,
  name: 'photo.jpg',
  type: 'image',
  metadata: withMetadata
})
const photo = new File(['pixels'], 'photo.jpg', { type: 'image/jpeg' })
const entries = { 'app.enc': 'keys-1' }

const configureProvider = (prepareUpload: NonNullable<FileTransferProvider['prepareUpload']>) => {
  const provider = { upload: jest.fn(), download: jest.fn(), cancel: jest.fn(), prepareUpload: jest.fn(prepareUpload) }
  fileTransfer.configure({ provider })
  return provider
}

describe("prepareAttachmentUpload (the provider's prepareUpload)", () => {
  afterEach(() => {
    fileTransfer.configure()
    ;['tid-1', 'tid-2'].forEach((tid) => deletePendingAttachment(tid))
  })

  it('without prepareUpload, the metadata is as it was', async () => {
    const attachment = attachmentWith('tid-1')

    expect(await prepareAttachmentUpload(attachment, photo)).toBe(attachment.metadata)
  })

  it("is given the attachment's file and metadata; its entries are merged in at the top level, the rest kept", async () => {
    const provider = configureProvider(async () => entries)

    const prepared = await prepareAttachmentUpload(attachmentWith('tid-1'), photo)

    const [request] = provider.prepareUpload.mock.calls[0]
    expect(request).toMatchObject({
      operationId: 'upload:tid-1',
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      metadata
    })
    expect(request.sourceFile).toBe(photo)
    expect(request.type).toBe(FileUploadType.PLAIN)
    expect(JSON.parse(prepared as string)).toEqual({ ...metadata, ...entries })
  })

  it('with encryptUploads, the request asks for an encrypted upload', async () => {
    const provider = configureProvider(async () => entries)
    fileTransfer.encryptUploads = true

    await prepareAttachmentUpload(attachmentWith('tid-1'), photo)

    expect(provider.prepareUpload.mock.calls[0][0].type).toBe(FileUploadType.ENCRYPTED)
  })

  it('a returned key overwrites the one there; keys not returned are kept', async () => {
    configureProvider(async () => ({ 'app.enc': 'keys-2', szw: '1' }))

    const prepared = await prepareAttachmentUpload(
      attachmentWith('tid-1', JSON.stringify({ ...metadata, 'app.enc': 'keys-1', other: 'x' })),
      photo
    )

    expect(JSON.parse(prepared as string)).toEqual({ ...metadata, szw: '1', 'app.enc': 'keys-2', other: 'x' })
  })

  it("null or undefined changes nothing: the provider's entry is there already", async () => {
    const attachment = attachmentWith('tid-1', JSON.stringify({ ...metadata, 'app.enc': 'keys-1' }))
    for (const nothing of [null, undefined]) {
      const provider = configureProvider(async () => nothing)

      expect(await prepareAttachmentUpload(attachment, photo)).toBe(attachment.metadata)
      expect(provider.prepareUpload.mock.calls[0][0].metadata).toEqual({ ...metadata, 'app.enc': 'keys-1' })
    }
  })

  it('every later attempt (a retry, a resend) is called again, with what was returned before in its metadata', async () => {
    const provider = configureProvider(async ({ metadata: current }) =>
      current && current['app.enc'] ? null : entries
    )

    // A resend whose attachment lost the merged metadata still gets the entries back.
    await prepareAttachmentUpload(attachmentWith('tid-1'), photo)
    const again = await prepareAttachmentUpload(attachmentWith('tid-1'), photo)

    expect(provider.prepareUpload).toHaveBeenCalledTimes(2)
    expect(provider.prepareUpload.mock.calls[1][0].metadata).toEqual({ ...metadata, ...entries })
    expect(JSON.parse(again as string)).toEqual({ ...metadata, ...entries })
  })

  it('metadata given as an object is read, and missing or malformed metadata is an empty one', async () => {
    const provider = configureProvider(async () => entries)

    await prepareAttachmentUpload(attachmentWith('tid-1', { ...metadata }), photo)
    await prepareAttachmentUpload(attachmentWith('tid-2', 'not json'), photo)

    expect(provider.prepareUpload.mock.calls[0][0].metadata).toEqual(metadata)
    expect(provider.prepareUpload.mock.calls[1][0].metadata).toEqual({})
  })

  it('each attachment has its own entries', async () => {
    let n = 0
    configureProvider(async () => ({ 'app.enc': `keys-${++n}` }))

    const first = await prepareAttachmentUpload(attachmentWith('tid-1'), photo)
    const second = await prepareAttachmentUpload(attachmentWith('tid-2'), photo)

    expect(JSON.parse(first as string)['app.enc']).toBe('keys-1')
    expect(JSON.parse(second as string)['app.enc']).toBe('keys-2')
  })

  it('prepares a Blob without a file name or MIME type using the attachment name', async () => {
    const provider = configureProvider(async () => entries)
    const attachment = { ...attachmentWith('tid-1'), name: 'fallback.txt' }

    await prepareAttachmentUpload(attachment, new Blob(['content']))

    expect(provider.prepareUpload.mock.calls[0][0]).toMatchObject({ fileName: 'fallback.txt', mimeType: null })
  })

  it('prepares an attachment without a tid or name and does not save pending entries', async () => {
    const provider = configureProvider(async () => entries)
    const attachment = { ...attachmentWith('tid-1'), tid: undefined, name: undefined }

    const prepared = await prepareAttachmentUpload(attachment, new Blob(['content']))

    expect(provider.prepareUpload.mock.calls[0][0]).toMatchObject({ operationId: 'upload:', fileName: 'file' })
    expect(JSON.parse(prepared as string)).toEqual({ ...metadata, ...entries })
  })

  it('a failed preparation rejects, so nothing is uploaded unprepared', async () => {
    configureProvider(async () => {
      throw new Error('no upload slot')
    })

    await expect(prepareAttachmentUpload(attachmentWith('tid-1'), photo)).rejects.toThrow('no upload slot')
  })

  it.each([
    ['a list', ['keys']],
    ['a string', 'keys'],
    ['a value that is not a string', { 'app.enc': 5 }],
    ['a nested object', { 'app.enc': { aid: 'id-1' } }]
  ])('entries that are not string keys with string values (%s) are refused', async (_case, value) => {
    configureProvider(async () => value as any)

    await expect(prepareAttachmentUpload(attachmentWith('tid-1'), photo)).rejects.toThrow(
      'string keys with string values'
    )
  })
})
