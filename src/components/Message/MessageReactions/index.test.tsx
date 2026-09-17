import React, { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import MessageReactions from './index'
import { IMessage } from '../../../types'

jest.mock('common/popups/reactions', () => ({
  __esModule: true,
  default: ({ messageId }: { messageId: string }) => <div data-testid='reactions-popup'>{messageId}</div>
}))

const messageWithTemporaryId = {
  id: undefined,
  tid: 'pinned-message-tid',
  reactionTotals: [{ key: '👍', count: 1, score: 1 }]
} as unknown as IMessage

const PinnedMessageReactions = () => {
  const [open, setOpen] = useState(false)

  return (
    <MessageReactions
      message={messageWithTemporaryId}
      reactionsCount={1}
      reactionsPopupOpen={open}
      reactionsPopupPosition={0}
      reactionsPopupHorizontalPosition={{ left: 0, right: 0 }}
      reactionsAnchorTop={0}
      reactionsAnchorBottom={0}
      rtlDirection={false}
      backgroundSections='#fff'
      textPrimary='#111'
      popupZIndex={30}
      onToggleReactionsPopup={() => setOpen((current) => !current)}
      onReactionAddDelete={() => undefined}
      onOpenUserProfile={() => undefined}
    />
  )
}

describe('MessageReactions', () => {
  it('opens the reactions popup for a pinned message represented by a temporary id', () => {
    render(<PinnedMessageReactions />)

    fireEvent.click(screen.getByText('👍'))

    expect(screen.getByTestId('reactions-popup')).toHaveTextContent('pinned-message-tid')
  })
})
