import React from 'react'
import { render, screen } from '@testing-library/react'
import SystemMessage from './index'
import { MESSAGE_TYPE } from '../../../types/enum'

jest.mock('store/hooks', () => ({
  useDispatch: () => jest.fn(),
  useSelector: () => ({ scrollToBottom: false })
}))

jest.mock('../../../hooks', () => ({
  useColor: () => ({ textOnPrimary: '#fff', overlayBackground: '#222' }),
  useOnScreen: () => false
}))

jest.mock('common/client', () => ({ getClient: () => ({ user: { id: 'current-user' } }) }))
jest.mock('../../../helpers/contacts', () => ({ getShowOnlyContactUsers: () => false }))
jest.mock('helpers/messageListNavigator', () => ({ navigateToMessage: jest.fn() }))

describe('SystemMessage pinned preview', () => {
  const message: any = {
    id: 'pin-system-message',
    body: 'PM',
    type: MESSAGE_TYPE.SYSTEM,
    incoming: true,
    user: { id: 'other-user', firstName: 'Other', lastName: 'User' },
    parentMessage: { id: 'contact-message', type: 'contact_sharing', body: 'Raw contact name', attachments: [] }
  }

  it('uses an app-provided preview for a pinned system message', () => {
    render(
      <SystemMessage
        channel={{ id: 'channel-1' } as any}
        message={message}
        nextMessage={null as any}
        contactsMap={{}}
        renderPinnedMessagePreview={(parentMessage, context) =>
          parentMessage.type === 'contact_sharing' && context.placement === 'system' ? 'a contact' : null
        }
      />
    )

    expect(screen.getByRole('button')).toHaveTextContent('Other User pinned a contact.')
    expect(screen.queryByText('Raw contact name')).not.toBeInTheDocument()
  })

  it('does not replace the deleted-message label with app-specific content', () => {
    const deletedMessage = {
      ...message,
      parentMessage: { ...message.parentMessage, state: 'deleted' }
    }

    render(
      <SystemMessage
        channel={{ id: 'channel-1' } as any}
        message={deletedMessage}
        nextMessage={null as any}
        contactsMap={{}}
        renderPinnedMessagePreview={() => <span data-testid='contact-preview'>Contact message</span>}
      />
    )

    expect(screen.queryByTestId('contact-preview')).not.toBeInTheDocument()
    expect(screen.getByRole('button')).toHaveTextContent('Other User pinned Deleted message')
  })

  it.each([
    ['file', 'contract.pdf', 'File'],
    ['image', 'photo.jpg', 'Photo'],
    ['video', 'video.mp4', 'Video']
  ])('renders an unquoted %s label for an attachment-only pinned message', (type, name, label) => {
    const attachmentMessage = {
      ...message,
      parentMessage: { id: `${type}-message`, body: '', attachments: [{ type, name }] }
    }

    render(
      <SystemMessage
        channel={{ id: 'channel-1' } as any}
        message={attachmentMessage}
        nextMessage={null as any}
        contactsMap={{}}
      />
    )

    expect(screen.getByRole('button')).toHaveTextContent(`Other User pinned ${label}.`)
    expect(screen.getByRole('button')).not.toHaveTextContent(`"${label}"`)
  })
})
