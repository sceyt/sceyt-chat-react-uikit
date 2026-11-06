import { deletePendingAttachment } from '../helpers/messagesHalper'
import { fileTransfer } from './sceytChatUIKitFileTransfer'
import { getUploadExt, prepareAttachmentUpload, UploadPreparer } from './uploadPreparer'

const NAMESPACE = 'app.enc'
const metadata = { szw: 640, szh: 480, tmb: 'thumb' }
const attachmentWith = (tid: string, withMetadata: unknown = JSON.stringify(metadata)): any => ({
  tid,
  name: 'photo.jpg',
  type: 'image',
  metadata: withMetadata
})
const photo = new File(['pixels'], 'photo.jpg', { type: 'image/jpeg' })
const entry = { aid: 'id-1', k: 'key', salt: 's', np: 'n', ps: 6 }

const usePreparer = (prepare: UploadPreparer['prepare']) => {
  const preparer = { namespace: NAMESPACE, prepare: jest.fn(prepare) }
  fileTransfer.configure({
    transport: { upload: jest.fn(), download: jest.fn(), cancel: jest.fn(), uploadPreparer: preparer }
  })
  return preparer
}

describe('prepareAttachmentUpload', () => {
  afterEach(() => {
    fileTransfer.configure()
    ;['tid-1', 'tid-2'].forEach((tid) => deletePendingAttachment(tid))
  })

  it('without an uploadPreparer, the metadata is as it was', async () => {
    const attachment = attachmentWith('tid-1')

    expect(await prepareAttachmentUpload(attachment, photo)).toBe(attachment.metadata)
  })

  it("the first attempt gets no existing entry; the app's entry is saved to metadata.ext[namespace], the rest kept", async () => {
    const preparer = usePreparer(async () => entry)
    const attachment = attachmentWith('tid-1')

    const prepared = await prepareAttachmentUpload(attachment, photo)

    expect(preparer.prepare).toHaveBeenCalledWith({ attachment, file: photo })
    expect(JSON.parse(prepared as string)).toEqual({ ...metadata, ext: { [NAMESPACE]: entry } })
    expect(getUploadExt(prepared, NAMESPACE)).toEqual(entry)
  })

  it('every later attempt (a retry, a resend) is called again, with the saved entry as existing', async () => {
    const preparer = usePreparer(async ({ existing }) => existing || entry)

    await prepareAttachmentUpload(attachmentWith('tid-1'), photo)
    const again = await prepareAttachmentUpload(attachmentWith('tid-1'), photo)

    expect(preparer.prepare).toHaveBeenCalledTimes(2)
    expect(preparer.prepare.mock.calls[1][0].existing).toEqual(entry)
    expect(getUploadExt(again, NAMESPACE)).toEqual(entry)
  })

  it("an entry already in the attachment's metadata is the existing one", async () => {
    const preparer = usePreparer(async () => undefined)
    const attachment = attachmentWith('tid-1', JSON.stringify({ ...metadata, ext: { [NAMESPACE]: entry } }))

    const prepared = await prepareAttachmentUpload(attachment, photo)

    expect(preparer.prepare.mock.calls[0][0].existing).toEqual(entry)
    // Undefined keeps the existing entry.
    expect(getUploadExt(prepared, NAMESPACE)).toEqual(entry)
  })

  it("other apps' entries under ext, and the metadata as an object, are kept", async () => {
    usePreparer(async () => entry)
    const attachment = attachmentWith('tid-1', { ...metadata, ext: { other: { a: 1 } } })

    const prepared = await prepareAttachmentUpload(attachment, photo)

    expect(JSON.parse(prepared as string).ext).toEqual({ other: { a: 1 }, [NAMESPACE]: entry })
  })

  it('a malformed ext is replaced by one holding the entry', async () => {
    usePreparer(async () => entry)

    const prepared = await prepareAttachmentUpload(
      attachmentWith('tid-1', JSON.stringify({ ...metadata, ext: 'broken' })),
      photo
    )

    expect(JSON.parse(prepared as string).ext).toEqual({ [NAMESPACE]: entry })
  })

  it('an attachment without a tid is prepared with no existing entry, every time', async () => {
    const preparer = usePreparer(async () => entry)
    const attachment = { ...attachmentWith('tid-1'), tid: undefined }

    await prepareAttachmentUpload(attachment, photo)
    const prepared = await prepareAttachmentUpload(attachment, photo)

    expect(preparer.prepare.mock.calls.map(([call]) => call.existing)).toEqual([undefined, undefined])
    expect(getUploadExt(prepared, NAMESPACE)).toEqual(entry)
  })

  it('each attachment has its own entry', async () => {
    const preparer = usePreparer(async ({ attachment, existing }) => existing || { aid: attachment.tid })

    await prepareAttachmentUpload(attachmentWith('tid-1'), photo)
    await prepareAttachmentUpload(attachmentWith('tid-2'), photo)

    expect(preparer.prepare.mock.calls[1][0].existing).toBeUndefined()
  })

  it('a failed preparation rejects, and the next attempt is called with what was saved before it', async () => {
    let calls = 0
    const preparer = usePreparer(async ({ existing }) => {
      calls += 1
      if (calls === 2) throw new Error('the slot call failed')
      return existing || entry
    })

    await prepareAttachmentUpload(attachmentWith('tid-1'), photo)
    await expect(prepareAttachmentUpload(attachmentWith('tid-1'), photo)).rejects.toThrow('the slot call failed')
    await prepareAttachmentUpload(attachmentWith('tid-1'), photo)

    expect(preparer.prepare.mock.calls[2][0].existing).toEqual(entry)
  })

  it.each([
    ['a list', ['aid']],
    ['a number', 5],
    ['an empty string', '']
  ])(
    'an entry that is not a string or an object (%s) is refused, so nothing is uploaded with it',
    async (_case, value) => {
      usePreparer(async () => value as any)

      await expect(prepareAttachmentUpload(attachmentWith('tid-1'), photo)).rejects.toThrow('not a string or an object')
    }
  )

  it("an entry may be a string (the SDK's keys string): it is saved and given back as existing", async () => {
    const preparer = usePreparer(async ({ existing }) => existing || 'AYCBgoOEhYaHiImKi4yNjo8')

    const prepared = await prepareAttachmentUpload(attachmentWith('tid-1'), photo)
    await prepareAttachmentUpload({ ...attachmentWith('tid-1'), metadata: prepared }, photo)

    expect(getUploadExt(prepared, NAMESPACE)).toBe('AYCBgoOEhYaHiImKi4yNjo8')
    expect(preparer.prepare.mock.calls[1][0].existing).toBe('AYCBgoOEhYaHiImKi4yNjo8')
  })

  it('an entry that cannot be stored as JSON fails before the upload', async () => {
    const circular: any = { aid: 'id-1' }
    circular.self = circular
    usePreparer(async () => circular)

    await expect(prepareAttachmentUpload(attachmentWith('tid-1'), photo)).rejects.toThrow()
  })
})
