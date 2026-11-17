import React from 'react'
import { fireEvent } from '@testing-library/react'
import { calculateLinkPreviewImageSize, OGMetadata } from './index'
import { attachmentTypes } from '../../../helpers/constants'
import { createMessageListStore, renderWithSceytProvider } from '../../../testUtils/messageListHarness'

// A link preview's image is shown and sized as on the mobile apps (Android's
// BaseLinkMessageViewHolder and calculateScaleWidthHeight): shown whenever its size is
// known, small (52px, whole) when narrower than 200px, otherwise a box as wide as the
// preview whose height keeps the image's shape within a third of the width and 1.2 times it.

describe('calculateLinkPreviewImageSize', () => {
  it.each([
    ['a square image', 500, 500, { width: 300, height: 300 }],
    ['a landscape image', 1200, 630, { width: 300, height: 157 }],
    ['a wide banner (raised to a third of the width)', 1200, 200, { width: 300, height: 100 }],
    ['a narrow portrait image (20% taller box)', 600, 800, { width: 270, height: 360 }],
    ['a near-square portrait image', 900, 1000, { width: 270, height: 300 }],
    ['a very tall image (raised to a third of the width)', 100, 1000, { width: 100, height: 360 }],
    ['an image of unknown shape', 0, 0, { width: 300, height: 300 }]
  ])('sizes %s like the mobile apps', (_, width, height, expected) => {
    expect(calculateLinkPreviewImageSize(300, width, height)).toEqual(expected)
  })
})

const IMAGE = 'https://site.example/og.png'
const FAVICON = 'https://site.example/favicon.ico'

const renderPreview = (size?: { szw: number; szh: number }) =>
  renderWithSceytProvider(
    <OGMetadata
      attachments={[
        {
          id: 'link-attachment-1',
          messageId: '9007199254741001',
          type: attachmentTypes.link,
          url: 'https://site.example/post',
          name: 'A post',
          metadata: JSON.stringify({ dsc: 'About the post', iur: IMAGE, tur: FAVICON, ...size })
        } as any
      ]}
      state='unmodified'
      incoming
      maxWidth={400}
    />,
    { store: createMessageListStore() }
  )

// The big image and the height of its box, or null when there is no big image.
const bigImage = () => {
  const image = document.querySelector('img[alt="OG image"]') as HTMLImageElement | null
  return image ? { src: image.getAttribute('src'), boxHeight: getComputedStyle(image.parentElement!).height } : null
}
const smallImage = () => {
  const image = Array.from(document.querySelectorAll('img')).find(
    (element) => element.getAttribute('src') === IMAGE && element.getAttribute('alt') === ''
  )
  return image ? getComputedStyle(image).objectFit : null
}

describe('link preview image size, as on the mobile apps', () => {
  it('shows a wide banner big, in a box a third of the width tall', () => {
    renderPreview({ szw: 1200, szh: 300 })

    expect(bigImage()).toEqual({ src: IMAGE, boxHeight: '133px' })
  })

  it('shows an image at least 200px wide big, however short it is', () => {
    renderPreview({ szw: 400, szh: 150 })

    expect(bigImage()).toEqual({ src: IMAGE, boxHeight: '150px' })
  })

  it('shows a narrow portrait image in a box 1.2 times the width tall, not cut at 240px', () => {
    renderPreview({ szw: 600, szh: 800 })

    expect(bigImage()).toEqual({ src: IMAGE, boxHeight: '480px' })
  })

  it('shows an image narrower than 200px small and whole', () => {
    renderPreview({ szw: 180, szh: 180 })

    expect(bigImage()).toBeNull()
    expect(smallImage()).toBe('contain')
  })

  it('measures an image whose size was not saved, then shows it', () => {
    renderPreview()
    expect(bigImage()).toBeNull()

    const probe = Array.from(document.querySelectorAll('img')).find((element) => element.hidden)!
    Object.defineProperty(probe, 'naturalWidth', { value: 1200 })
    Object.defineProperty(probe, 'naturalHeight', { value: 630 })
    fireEvent.load(probe)

    expect(bigImage()).toEqual({ src: IMAGE, boxHeight: '210px' })
  })
})
