/**
 * Re-render contract for the memoized <Message>.
 *
 * Message is wrapped in React.memo with a hand-written comparator that only
 * looks at a subset of props. These tests pin down which prop changes reach
 * the screen. Tests marked itFailing document props the comparator currently
 * ignores (known bug: theme, label and handler changes don't re-render
 * already-rendered messages). When the comparator is fixed they will fail
 * with "Bug fixed - convert to a normal test" — switch them to `it` then.
 */
import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import Message from './index'
import { DEFAULT_CHANNEL_TYPE } from '../../helpers/constants'
import { itFailing } from '../../testUtils/itFailing'
import {
  createMessageListStore,
  makeChannel,
  makeMessage,
  makeUser,
  renderWithSceytProvider,
  resetMessageListFixtureIds
} from '../../testUtils/messageListHarness'

jest.mock('hooks', () => {
  const { THEME_COLORS } = require('../../UIHelper/constants')

  return {
    useDidUpdate: () => undefined,
    useOnScreen: () => true,
    useColor: () => ({
      [THEME_COLORS.ACCENT]: '#00aa88',
      [THEME_COLORS.BACKGROUND_SECTIONS]: '#ffffff',
      [THEME_COLORS.TEXT_PRIMARY]: '#111111',
      [THEME_COLORS.OUTGOING_MESSAGE_BACKGROUND]: '#dcf8c6',
      [THEME_COLORS.INCOMING_MESSAGE_BACKGROUND]: '#f1f1f1',
      [THEME_COLORS.TEXT_ON_PRIMARY]: '#ffffff',
      [THEME_COLORS.BORDER]: '#dddddd'
    })
  }
})

jest.mock('../Avatar', () => ({
  __esModule: true,
  default: () => <div data-testid='avatar' />
}))

// MessageBody is replaced with a probe that exposes the props we care about.
jest.mock('./MessageBody', () => ({
  __esModule: true,
  default: (props: any) => (
    <div
      data-testid='message-body'
      data-incoming-background={props.incomingMessageStyles?.background || ''}
      data-edit-tooltip={props.editIconTooltipText || ''}
    >
      <span data-testid='message-text'>{props.message.body}</span>
      <button type='button' data-testid='reply-click' onClick={() => props.handleScrollToRepliedMessage('reply-id')}>
        reply
      </button>
    </div>
  )
}))

jest.mock('./MessageSelection', () => ({ __esModule: true, default: () => null }))
jest.mock('./MessageReactions', () => ({ __esModule: true, default: () => null }))
jest.mock('./MessageStatusAndTime', () => ({ __esModule: true, default: () => null }))
jest.mock('./MessagePopups', () => ({ __esModule: true, default: () => null }))

describe('Message re-render contract', () => {
  const channelId = 'channel-rerender'
  const user = makeUser({ id: 'remote-user-rerender', firstName: 'Remote' })

  const setup = (overrides: Record<string, any> = {}) => {
    resetMessageListFixtureIds()
    const message = makeMessage({ id: '9001', channelId, body: 'original body', incoming: true, user })
    const channel = makeChannel({ id: channelId, type: DEFAULT_CHANNEL_TYPE.GROUP, lastMessage: message })
    const store = createMessageListStore({ ChannelReducer: { activeChannel: channel } })

    const baseProps: any = {
      message,
      channel,
      stopScrolling: () => undefined,
      handleScrollToRepliedMessage: () => undefined,
      prevMessage: undefined,
      nextMessage: undefined,
      isUnreadMessage: false,
      unreadMessageId: '',
      isThreadMessage: false,
      ...overrides
    }

    const utils = renderWithSceytProvider(<Message {...baseProps} />, { store })
    const rerenderWith = (changes: Record<string, any>) => utils.rerender(<Message {...baseProps} {...changes} />)

    return { ...utils, baseProps, rerenderWith }
  }

  it('re-renders when the message body changes', () => {
    const { baseProps, rerenderWith } = setup()

    rerenderWith({ message: { ...baseProps.message, body: 'edited body' } })

    expect(screen.getByTestId('message-text')).toHaveTextContent('edited body')
  })

  it('re-renders when the connection status changes', () => {
    const { rerenderWith } = setup({ connectionStatus: 'Connecting' })

    // connectionStatus is in the comparator, so a later theme change rides along with it.
    rerenderWith({ connectionStatus: 'Connected', incomingMessageStyles: { background: '#000000' } })

    expect(screen.getByTestId('message-body')).toHaveAttribute('data-incoming-background', '#000000')
  })

  itFailing('re-renders when a theme style prop changes (incomingMessageStyles)', () => {
    setup({ incomingMessageStyles: { background: '#ffffff' } }).rerenderWith({
      incomingMessageStyles: { background: '#000000' }
    })

    expect(screen.getByTestId('message-body')).toHaveAttribute('data-incoming-background', '#000000')
  })

  itFailing('re-renders when a label prop changes (editIconTooltipText)', () => {
    setup({ editIconTooltipText: 'Edit' }).rerenderWith({ editIconTooltipText: 'Խմբագրել' })

    expect(screen.getByTestId('message-body')).toHaveAttribute('data-edit-tooltip', 'Խմբագրել')
  })

  itFailing('uses the latest handler prop (handleScrollToRepliedMessage)', () => {
    const first = jest.fn()
    const second = jest.fn()

    setup({ handleScrollToRepliedMessage: first }).rerenderWith({ handleScrollToRepliedMessage: second })
    fireEvent.click(screen.getByTestId('reply-click'))

    expect(second).toHaveBeenCalledWith('reply-id')
    expect(first).not.toHaveBeenCalled()
  })
})
