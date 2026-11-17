import React from 'react'
import { OGMetadata } from './index'
import { attachmentTypes } from '../../../helpers/constants'
import { createMessageListStore, renderWithSceytProvider } from '../../../testUtils/messageListHarness'

// A link preview whose saved metadata points its image or favicon at a local-network host
// (sent earlier, or by another app) is shown without them: loading them from the page makes
// the browser ask the user for local network access.

const linkAttachment = (meta: Record<string, string>) =>
  ({
    id: 'link-attachment-1',
    messageId: '9007199254741001',
    type: attachmentTypes.link,
    url: 'http://172.16.1.227:3000/d/dashboard',
    name: 'dashboard',
    metadata: JSON.stringify({ ttl: 'Grafana', dsc: 'Calls dashboard', ...meta })
  }) as any

const renderPreview = (meta: Record<string, string>) =>
  renderWithSceytProvider(<OGMetadata attachments={[linkAttachment(meta)]} state='unmodified' incoming />, {
    store: createMessageListStore()
  })

describe('link preview images on the local network', () => {
  it('does not load a favicon on a local-network host', () => {
    // A preview with neither an image nor a favicon is not shown; the link stays in the text.
    renderPreview({ tur: 'http://172.16.1.227:3000/public/img/fav32.png' })

    expect(document.querySelector('img[src^="http://172.16.1.227"]')).toBeNull()
  })

  it('does not load an image on a local-network host', () => {
    renderPreview({ iur: 'http://192.168.1.10/og.png', szw: '1200', szh: '630' })

    expect(document.querySelector('img[src^="http://192.168.1.10"]')).toBeNull()
  })

  it('still shows a public favicon', () => {
    renderPreview({ tur: 'https://example.com/favicon.ico' })

    expect(document.querySelector('img[src="https://example.com/favicon.ico"]')).not.toBeNull()
  })
})
