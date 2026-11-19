import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { clearLinkPreviewImageStates, OGMetadata } from './index'
import { attachmentTypes } from '../../../helpers/constants'
import { createMessageListStore, renderWithSceytProvider } from '../../../testUtils/messageListHarness'

// Some sites refuse to serve their images to other sites (Cross-Origin-Resource-Policy:
// same-origin), so the browser cannot load a link preview's image or favicon. The preview
// is then shown as text (title and description), never with a broken image.

const IMAGE = 'https://site.example/blog/post/og.png'
const FAVICON = 'https://site.example/favicon.svg'
// A thumbhash, as the apps save it with the link (tmb).
const THUMB = 'AAiCA4AAAAAAAAAAAAAAAAAAAAAAAAA='

const linkAttachment = (meta: Record<string, unknown>) =>
  ({
    id: 'link-attachment-1',
    messageId: '9007199254741001',
    type: attachmentTypes.link,
    url: 'https://site.example/blog/post/',
    name: 'How the team does code review',
    metadata: JSON.stringify({
      dsc: 'How do you review code at the volume agents produce it?',
      iur: IMAGE,
      tur: FAVICON,
      szw: 1200,
      szh: 630,
      ...meta
    })
  }) as any

const renderPreview = (meta: Record<string, unknown> = {}) =>
  renderWithSceytProvider(<OGMetadata attachments={[linkAttachment(meta)]} state='unmodified' incoming />, {
    store: createMessageListStore()
  })

// The images shown (an image only checked, hidden, is not shown).
const images = () =>
  Array.from(document.querySelectorAll('img'))
    .filter((img) => !img.hidden)
    .map((img) => img.getAttribute('src') || '')
const imageWith = (src: string) => {
  const img = Array.from(document.querySelectorAll('img')).find((element) => element.getAttribute('src') === src)
  if (!img) throw new Error(`no <img> with ${src}; shown: ${JSON.stringify(images())}`)
  return img
}
const failToLoad = (src: string) => fireEvent.error(imageWith(src))
const load = (src: string) => fireEvent.load(imageWith(src))

beforeEach(() => {
  clearLinkPreviewImageStates()
})

describe('link preview whose image the browser cannot load', () => {
  it.each([
    ['with', { tmb: THUMB }],
    ['without', {}]
  ])('shows a text-only preview, no broken image, when the image and the favicon fail (%s a thumbnail)', (_, meta) => {
    renderPreview(meta)

    failToLoad(IMAGE)
    failToLoad(FAVICON)

    expect(images()).toEqual([])
    expect(screen.getByText('How the team does code review')).toBeInTheDocument()
  })

  it('falls back to the favicon when only the image fails', () => {
    renderPreview()

    load(FAVICON)
    failToLoad(IMAGE)

    expect(images()).toEqual([FAVICON])
  })

  it('goes straight to text when the image fails: no empty favicon box is shown and then removed', () => {
    renderPreview()

    failToLoad(IMAGE)
    // The favicon is still being checked: the preview shows no box for it yet.
    expect(images()).toEqual([])
    failToLoad(FAVICON)

    expect(images()).toEqual([])
    expect(screen.getByText('How the team does code review')).toBeInTheDocument()
  })

  it('shows the favicon once it loads, after the image failed', () => {
    renderPreview()

    failToLoad(IMAGE)
    load(FAVICON)

    expect(images()).toEqual([FAVICON])
  })

  it('shows a preview whose image failed as text from the start when shown again, so it does not blink', () => {
    const first = renderPreview()
    failToLoad(IMAGE)
    failToLoad(FAVICON)
    first.unmount()

    renderPreview()

    // Not an image box that is then removed: no image is even requested.
    expect(document.querySelectorAll('img')).toHaveLength(0)
    expect(screen.getByText('How the team does code review')).toBeInTheDocument()
  })

  it('tries the image again when it is shown again after failing while offline', () => {
    const onLine = jest.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false)
    const first = renderPreview()
    failToLoad(IMAGE)
    first.unmount()
    onLine.mockRestore()

    renderPreview()

    expect(images()).toEqual([IMAGE])
  })

  it('shows the image when it loads', () => {
    renderPreview({ tmb: THUMB })

    expect(images()).toEqual([IMAGE])
  })
})
