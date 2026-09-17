import React, { useState } from 'react'
import { fireEvent, screen } from '@testing-library/react'
import MessageReactions from './index'
import { createMessageListStore, renderWithSceytProvider } from '../../../testUtils/messageListHarness'
import { setClient } from '../../../common/client'
import { IMessage } from '../../../types'

jest.mock('../../../hooks', () => ({
  ...jest.requireActual('../../../hooks'),
  useColor: () => ({
    accent: '#00a884',
    textPrimary: '#101828',
    textSecondary: '#667085',
    backgroundSections: '#ffffff',
    textOnPrimary: '#ffffff',
    surface1: '#f2f4f7',
    backgroundHovered: '#f9fafb'
  })
}))

const message = {
  id: 'reaction-popup-message',
  reactionTotals: [{ key: '👍', count: 1, score: 1 }],
  userReactions: []
} as unknown as IMessage

const ReactionDetails = () => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <MessageReactions
      message={message}
      reactionsCount={1}
      reactionsPopupOpen={isOpen}
      reactionsPopupPosition={0}
      reactionsPopupHorizontalPosition={{ left: 0, right: 0 }}
      reactionsAnchorTop={0}
      reactionsAnchorBottom={0}
      rtlDirection={false}
      backgroundSections='#ffffff'
      textPrimary='#101828'
      onToggleReactionsPopup={() => setIsOpen((current) => !current)}
      onReactionAddDelete={jest.fn()}
      onOpenUserProfile={jest.fn()}
    />
  )
}

describe('MessageReactions popup', () => {
  beforeEach(() => {
    setClient({ user: { id: 'current-user' } })
  })

  it('keeps the details list open when a message has one reaction', () => {
    const store = createMessageListStore({
      MessageReducer: {
        reactionsList: [
          {
            id: 'reaction-1',
            key: '👍',
            score: 1,
            messageId: message.id,
            user: { id: 'other-user', firstName: 'Ada', lastName: 'Lovelace' }
          }
        ]
      }
    })

    renderWithSceytProvider(<ReactionDetails />, { store })

    fireEvent.click(screen.getByText('👍'))

    expect(screen.getByText('All 1')).toBeInTheDocument()
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
  })
})
