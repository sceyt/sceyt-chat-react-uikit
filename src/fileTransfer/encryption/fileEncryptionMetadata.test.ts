import { FileEncryptionMetadata } from './fileEncryptionMetadata'

const ALG = 'tink-aes256-gcm-hkdf-64k+commit-v1'

describe('FileEncryptionMetadata', () => {
  it('keeps the algorithm, binding ids, independent rendition keys and the media fields', () => {
    const thumbnail = { role: 'thumbnail', attachmentId: 'thumb-id', key: 'thumb-key' }
    const envelope = FileEncryptionMetadata.fromEncryptionInfo(
      { algorithm: ALG, attachmentId: 'file-id', key: 'file-key' },
      [thumbnail]
    )

    const written = FileEncryptionMetadata.write('{"tmb":"blur","szw":1280,"szh":203}', envelope)

    expect(JSON.parse(written)).toEqual({
      tmb: 'blur',
      szw: 1280,
      szh: 203,
      enc: { v: 1, alg: ALG, attachmentId: 'file-id', key: 'file-key', renditions: [thumbnail] }
    })
    const read = FileEncryptionMetadata.read(written)!
    expect(read.toEncryptionInfo()).toEqual({ algorithm: ALG, attachmentId: 'file-id', key: 'file-key' })
    expect(read.renditions).toEqual([thumbnail])
    expect(FileEncryptionMetadata.isEncrypted(written)).toBe(true)
  })

  it('malformed metadata does not escape the parser', () => {
    for (const metadata of [undefined, '', 'not json', '[1]', '{}', '{"szw":1}']) {
      expect(FileEncryptionMetadata.read(metadata)).toBeUndefined()
      expect(FileEncryptionMetadata.isEncrypted(metadata)).toBe(false)
    }
    // A malformed `enc` is still encrypted: shown as unavailable, never as plain.
    for (const enc of [null, 'x', {}, { alg: ALG, key: 'k' }]) {
      const metadata = JSON.stringify({ enc })
      expect(FileEncryptionMetadata.read(metadata)).toBeUndefined()
      expect(FileEncryptionMetadata.isEncrypted(metadata)).toBe(true)
    }
  })

  it('removes `enc` and keeps the other keys', () => {
    const written = FileEncryptionMetadata.write(
      '{"szw":1}',
      FileEncryptionMetadata.fromEncryptionInfo({ algorithm: ALG, attachmentId: 'a', key: 'k' })
    )

    expect(FileEncryptionMetadata.remove(written)).toBe('{"szw":1}')
    expect(FileEncryptionMetadata.remove('{"szw":1}')).toBe('{"szw":1}')
    expect(FileEncryptionMetadata.remove(JSON.stringify({ enc: { alg: ALG } }))).toBeUndefined()
  })

  it('key-bearing models leave the key out of their diagnostic string', () => {
    const envelope = FileEncryptionMetadata.fromEncryptionInfo({ algorithm: ALG, attachmentId: 'a', key: 'secret-key' })

    expect(String(envelope)).not.toContain('secret-key')
    expect(String(envelope)).toContain('attachmentId=a')
  })
})
