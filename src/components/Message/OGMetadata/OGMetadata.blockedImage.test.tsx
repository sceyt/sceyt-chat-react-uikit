import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { OGMetadata } from './index'
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

const images = () => Array.from(document.querySelectorAll('img')).map((img) => img.getAttribute('src') || '')
const failToLoad = (src: string) => {
  const img = Array.from(document.querySelectorAll('img')).find((element) => element.getAttribute('src') === src)
  if (!img) throw new Error(`no <img> with ${src}; shown: ${JSON.stringify(images())}`)
  fireEvent.error(img)
}

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

    failToLoad(IMAGE)

    expect(images()).toEqual([FAVICON])
  })

  it('shows the image when it loads', () => {
    renderPreview({ tmb: THUMB })

    expect(images()).toEqual([IMAGE])
  })
})
