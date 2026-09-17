import React from 'react'
import { act, fireEvent, screen, within } from '@testing-library/react'
import ReactionsPopup from './index'
import { createMessageListStore, renderWithSceytProvider } from '../../../testUtils/messageListHarness'
import { setReactionsListAC } from '../../../store/message/actions'
import { setClient } from '../../client'
import { GET_REACTIONS } from '../../../store/message/constants'

jest.mock('../../../hooks', () => ({
  useColor: () => ({
    accent: '#00a884',
    textPrimary: '#101828',
    textSecondary: '#667085',
    backgroundSections: '#ffffff',
    textOnPrimary: '#ffffff',
    surface1: '#f2f4f7',
    backgroundHovered: '#f9fafb'
  }),
  useEventListener: () => undefined
}))

jest.mock('../../../components', () => ({
  Avatar: ({ name }: { name: string }) => <div data-testid='avatar'>{name}</div>
}))

const messageId = 'message-with-reactions'
const currentUser = { id: 'current-user', firstName: 'Current', lastName: 'User' }
const otherUser = { id: 'other-user', firstName: 'Ada', lastName: 'Lovelace' }

const thumbsUpReaction = {
  id: 'thumbs-up-reaction',
  key: '👍',
  messageId,
  score: 1,
  user: otherUser
}

const heartReaction = {
  id: 'heart-reaction',
  key: '❤️',
  messageId,
  score: 1,
  user: currentUser
}

const renderPopup = (reactionTotals: any[]) => {
  const store = createMessageListStore({
    MessageReducer: {
      reactionsList: [thumbsUpReaction, heartReaction],
      reactionsHasNext: false
    }
  })
  const dispatchSpy = jest.spyOn(store, 'dispatch')
  const handleAddDeleteEmoji = jest.fn()

  const result = renderWithSceytProvider(
    <ReactionsPopup
      messageId={messageId}
      handleAddDeleteEmoji={handleAddDeleteEmoji}
      handleReactionsPopupClose={jest.fn()}
      bottomPosition={0}
      horizontalPositions={{ left: 0, right: 0 }}
      anchorTop={0}
      anchorBottom={0}
      reactionTotals={reactionTotals}
      openUserProfile={jest.fn()}
    />,
    { store }
  )

  return { ...result, dispatchSpy, handleAddDeleteEmoji }
}

describe('ReactionsPopup', () => {
  beforeEach(() => {
    setClient({ user: currentUser })
  })

  it('returns to All and refreshes the listed values after unreacting the active reaction', async () => {
    const initialReactionTotals = [
      { key: '👍', count: 1, score: 1 },
      { key: '❤️', count: 1, score: 1 }
    ]
    const { rerender, store, dispatchSpy, handleAddDeleteEmoji } = renderPopup(initialReactionTotals)

    const heartTab = screen
      .getAllByText((_, element) => element?.textContent === '❤️1')
      .find((element) => element.tagName === 'DIV')
    fireEvent.click(heartTab!)
    fireEvent.click(screen.getByText('Current User'))
    expect(handleAddDeleteEmoji).toHaveBeenCalledWith('❤️')

    rerender(
      <ReactionsPopup
        messageId={messageId}
        handleAddDeleteEmoji={handleAddDeleteEmoji}
        handleReactionsPopupClose={jest.fn()}
        bottomPosition={0}
        horizontalPositions={{ left: 0, right: 0 }}
        anchorTop={0}
        anchorBottom={0}
        reactionTotals={[{ key: '👍', count: 1, score: 1 }]}
        openUserProfile={jest.fn()}
      />
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByText('All 1')).toBeInTheDocument()
    expect(screen.queryAllByText((_, element) => element?.textContent === '❤️1')).toHaveLength(0)
    expect(dispatchSpy).toHaveBeenCalledWith({
      type: GET_REACTIONS,
      payload: { messageId, key: undefined, limit: undefined }
    })

    act(() => {
      store.dispatch(setReactionsListAC([thumbsUpReaction as any], false))
    })
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(within(screen.getByRole('list')).getByText('👍')).toBeInTheDocument()
    expect(screen.queryByText('Current User')).not.toBeInTheDocument()
  })

  it('refreshes the open list when a live reaction event changes the totals', async () => {
    const initialReactionTotals = [{ key: '👍', count: 1, score: 1 }]
    const { rerender, store, dispatchSpy } = renderPopup(initialReactionTotals)
    dispatchSpy.mockClear()

    rerender(
      <ReactionsPopup
        messageId={messageId}
        handleAddDeleteEmoji={jest.fn()}
        handleReactionsPopupClose={jest.fn()}
        bottomPosition={0}
        horizontalPositions={{ left: 0, right: 0 }}
        anchorTop={0}
        anchorBottom={0}
        reactionTotals={[{ key: '👍', count: 2, score: 1 }]}
        openUserProfile={jest.fn()}
      />
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(dispatchSpy).toHaveBeenCalledWith({
      type: GET_REACTIONS,
      payload: { messageId, key: undefined, limit: undefined }
    })

    act(() => {
      store.dispatch(
        setReactionsListAC(
          [
            thumbsUpReaction as any,
            {
              ...thumbsUpReaction,
              id: 'new-live-reaction',
              user: { id: 'grace-user', firstName: 'Grace', lastName: 'Hopper' }
            }
          ],
          false
        )
      )
    })

    expect(screen.getByText('Grace Hopper')).toBeInTheDocument()
  })
})
