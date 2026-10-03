import React from 'react'
import { render, screen } from '@testing-library/react'
import PinnedMessagesBanner from './PinnedMessagesBanner'

let mockPins: any[] = []

jest.mock('../../store/hooks', () => ({
  useDispatch: () => jest.fn(),
  useSelector: (selector: (state: unknown) => unknown) => selector({})
}))

jest.mock('../../store/pinned/selector', () => ({
  pinnedMessagesSelector: () => () => mockPins,
  pinnedMessagesCursorSelector: () => () => null
}))

jest.mock('../../store/user/selector', () => ({ contactsMapSelector: () => ({}) }))
jest.mock('../../hooks', () => ({
  useColor: () => ({
    surface1: '#fff',
    textPrimary: '#111',
    iconPrimary: '#222',
    accent: '#0a8',
    background: '#eee'
  })
}))
jest.mock('../../helpers/contacts', () => ({ getShowOnlyContactUsers: () => false }))
jest.mock('../../helpers/messageListNavigator', () => ({ navigateToMessage: jest.fn() }))
jest.mock('../Attachment', () => ({
  __esModule: true,
  default: () => null,
  AttachmentImg: () => null,
  AttachmentImgCont: () => null,
  FileThumbnail: () => null,
  FileThumbnailSkeleton: () => null
}))

describe('PinnedMessagesBanner', () => {
  beforeEach(() => {
    mockPins = [
      {
        id: 'pin-contact',
        message: { id: 'contact-message', type: 'contact_sharing', body: 'Raw contact name', attachments: [] }
      }
    ]
  })

  it('uses an app-provided preview for an app-specific pinned message type', () => {
    render(
      <PinnedMessagesBanner
        channelId='channel-1'
        renderPinnedMessagePreview={(message) =>
          message.type === 'contact_sharing' ? <span data-testid='contact-preview'>Contact message</span> : null
        }
      />
    )

    expect(screen.getByTestId('contact-preview')).toHaveTextContent('Contact message')
    expect(screen.queryByText('Raw contact name')).not.toBeInTheDocument()
  })

  it('keeps the deleted-message fallback instead of rendering custom content', () => {
    mockPins[0].message.state = 'deleted'

    render(
      <PinnedMessagesBanner
        channelId='channel-1'
        renderPinnedMessagePreview={() => <span data-testid='contact-preview'>Contact message</span>}
      />
    )

    expect(screen.queryByTestId('contact-preview')).not.toBeInTheDocument()
    expect(screen.getByText('Deleted Message')).toBeInTheDocument()
  })

  it('uses File instead of the file name for an attachment-only pinned message', () => {
    mockPins[0].message = {
      id: 'file-message',
      body: '',
      attachments: [{ type: 'file', name: 'contract.pdf' }]
    }

    render(<PinnedMessagesBanner channelId='channel-1' />)

    expect(screen.getByText('File')).toBeInTheDocument()
    expect(screen.queryByText('contract.pdf')).not.toBeInTheDocument()
  })
})
