describe('attachment cache key validation', () => {
  const cachesDescriptor = Object.getOwnPropertyDescriptor(window, 'caches')

  afterEach(() => {
    jest.resetModules()
    if (cachesDescriptor) {
      Object.defineProperty(window, 'caches', cachesDescriptor)
    } else {
      delete (window as any).caches
    }
  })

  it('skips a transient non-string attachment URL instead of creating a broken cache cleanup promise', async () => {
    const open = jest.fn()
    Object.defineProperty(window, 'caches', {
      configurable: true,
      value: { open, match: jest.fn() }
    })

    let attachmentsCache: typeof import('./attachmentsCache')
    jest.isolateModules(() => {
      attachmentsCache = require('./attachmentsCache')
    })

    await expect(
      attachmentsCache!.setAttachmentToCache(true as any, new Response(new Blob(['frame'])))
    ).resolves.toBeUndefined()
    await expect(attachmentsCache!.removeAttachmentFromCache(true as any)).resolves.toBeUndefined()
    await expect(attachmentsCache!.getAttachmentUrlFromCache(true as any)).resolves.toBe(false)

    expect(open).not.toHaveBeenCalled()
  })
})
