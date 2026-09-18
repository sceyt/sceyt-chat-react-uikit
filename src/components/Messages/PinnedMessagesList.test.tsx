import React from 'react'
import { render, screen } from '@testing-library/react'
import PinnedMessagesList from './PinnedMessagesList'

const mockPins = [
  {
    id: 'pin-1',
    message: {
      id: 'message-1',
      body: 'Pinned message',
      incoming: true,
      attachments: []
    }
  }
]

jest.mock('../../store/hooks', () => ({
  useDispatch: () => jest.fn(),
  useSelector: (selector: (state: unknown) => unknown) => selector({})
}))

jest.mock('../../store/pinned/selector', () => ({
  pinnedMessagesSelector: () => () => mockPins,
  pinnedMessagesCursorSelector: () => () => null
}))

jest.mock('../../hooks', () => ({
  useColor: () => ({ background: '#fff', textSecondary: '#777', surface2: '#ddd', backgroundSections: '#f5f5f5' })
}))

jest.mock('../../helpers/messageListNavigator', () => ({ navigateToMessage: jest.fn() }))

const ScrollContainer = React.forwardRef<HTMLDivElement, any>(({ children, ...props }, ref) => (
  <div ref={ref} {...props}>
    {children}
  </div>
))
ScrollContainer.displayName = 'ScrollContainer'

const MessagesContainer = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>

const renderPinnedList = (isSelectionActive: boolean) =>
  render(
    <PinnedMessagesList
      selectionIsActive={isSelectionActive}
      channelId='channel-1'
      onClose={() => undefined}
      renderMessage={({ message }: any) => <div className='messageContent'>{message.body}</div>}
      ScrollContainer={ScrollContainer}
      MessagesContainer={MessagesContainer}
    />
  )

describe('PinnedMessagesList', () => {
  it('hides the navigation button while one or more pinned messages are selected', () => {
    renderPinnedList(true)

    expect(screen.queryByRole('button', { name: 'Go to message in conversation' })).not.toBeInTheDocument()
  })

  it('shows the navigation button when selection mode is inactive', () => {
    renderPinnedList(false)

    expect(screen.getByRole('button', { name: 'Go to message in conversation' })).toBeInTheDocument()
  })
})
