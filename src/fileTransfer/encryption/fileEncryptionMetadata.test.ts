import { FileEncryptionMetadata } from './fileEncryptionMetadata'

const ALG = 'tink-aes256-gcm-hkdf-64k+commit-v1'

describe('FileEncryptionMetadata', () => {
  it('keeps the algorithm, the binding id, the key and the media fields', () => {
    const envelope = FileEncryptionMetadata.fromEncryptionInfo({
      algorithm: ALG,
      attachmentId: 'file-id',
      key: 'file-key'
    })

    const written = FileEncryptionMetadata.write('{"tmb":"blur","szw":1280,"szh":203}', envelope)

    // Stored as aid and k.
    expect(JSON.parse(written)).toEqual({
      tmb: 'blur',
      szw: 1280,
      szh: 203,
      enc: { v: 1, alg: ALG, aid: 'file-id', k: 'file-key' }
    })
    const read = FileEncryptionMetadata.read(written)!
    expect(read.toEncryptionInfo()).toEqual({ algorithm: ALG, attachmentId: 'file-id', key: 'file-key' })
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

  it("stores the encryption's salt and nonce prefix as salt and np, and gives them back", () => {
    const info = { algorithm: ALG, attachmentId: 'file-id', key: 'file-key', salt: 'c2FsdA', noncePrefix: 'bnA' }

    const written = FileEncryptionMetadata.write('{}', FileEncryptionMetadata.fromEncryptionInfo(info))

    expect(JSON.parse(written).enc).toEqual({
      v: 1,
      alg: ALG,
      aid: 'file-id',
      k: 'file-key',
      salt: 'c2FsdA',
      np: 'bnA'
    })
    expect(FileEncryptionMetadata.read(written)!.toEncryptionInfo()).toEqual(info)
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

  describe("an app's encryption params", () => {
    const info = { algorithm: 'my-aes-gcm', attachmentId: 'a', key: 'k', params: { iv: 'aXY', keyVersion: '3' } }

    it('are stored in enc and come back with the encryption info', () => {
      const metadata = FileEncryptionMetadata.write({ szw: 10 }, FileEncryptionMetadata.fromEncryptionInfo(info))

      expect(JSON.parse(metadata).enc).toEqual({
        v: 1,
        alg: 'my-aes-gcm',
        aid: 'a',
        k: 'k',
        params: { iv: 'aXY', keyVersion: '3' }
      })
      expect(FileEncryptionMetadata.read(metadata)!.toEncryptionInfo()).toEqual(info)
    })

    it('are left out when there are none', () => {
      const metadata = FileEncryptionMetadata.write(
        '{}',
        FileEncryptionMetadata.fromEncryptionInfo({ ...info, params: undefined })
      )

      expect('params' in JSON.parse(metadata).enc).toBe(false)
      expect('params' in FileEncryptionMetadata.read(metadata)!.toEncryptionInfo()).toBe(false)
    })

    it.each([
      ['not an object', 'iv=aXY'],
      ['a list', ['aXY']],
      ['a value that is not a string', { iv: 'aXY', keyVersion: 3 }]
    ])('malformed params (%s) are dropped, the rest of enc is kept', (_case, params) => {
      const metadata = JSON.stringify({
        enc: {
          v: 1,
          alg: 'my-aes-gcm',
          aid: 'a',
          k: 'k',
          params
        }
      })

      const read = FileEncryptionMetadata.read(metadata)!

      expect(read.toEncryptionInfo()).toEqual({ algorithm: 'my-aes-gcm', attachmentId: 'a', key: 'k' })
    })
  })
})
