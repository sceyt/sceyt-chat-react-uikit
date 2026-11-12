import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { navigateToMessage } from '../../helpers/messageListNavigator'
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

    expect(screen.queryByLabelText('Go to message in conversation')).not.toBeInTheDocument()
  })

  it('shows the navigation button when selection mode is inactive', () => {
    renderPinnedList(false)

    // getByRole checks computed styles, which jsdom 16 cannot evaluate for this
    // row's :focus-within selector. Keep the accessible name and native role checked.
    const navigationButton = screen.getByLabelText('Go to message in conversation')
    expect(navigationButton).toBeInTheDocument()
    expect(navigationButton.tagName).toBe('BUTTON')
    expect(navigationButton).toHaveAttribute('type', 'button')
  })

  it('navigates to the pinned message when its navigation button is clicked', () => {
    renderPinnedList(false)

    fireEvent.click(screen.getByLabelText('Go to message in conversation'))

    expect(navigateToMessage).toHaveBeenCalledWith('message-1')
  })
})
