import React from 'react'
import { act, fireEvent, screen } from '@testing-library/react'
import Message from './index'
import {
  createMessageListStore,
  makeChannel,
  makeMessage,
  renderWithSceytProvider,
  resetMessageListFixtureIds,
  setElementRect
} from '../../testUtils/messageListHarness'

// The message action bar opens above the hovered message, or below it when there is no
// room above. "Room" is measured from the top of the message list (#scrollableDiv), so a
// pinned-messages banner or a taller header above the list cannot cover the bar.

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

jest.mock('../Avatar', () => ({ __esModule: true, default: () => null }))
jest.mock('./MessageSelection', () => ({ __esModule: true, default: () => null }))
jest.mock('./MessageStatusAndTime', () => ({ __esModule: true, default: () => null }))
jest.mock('./MessagePopups', () => ({ __esModule: true, default: () => null }))

// A custom message item, as an app renders one: it shows where the bar would open.
const ReportingMessageItem = ({ messageActionsShow, messageActionsBelow, handleMouseEnter }: any) => (
  <div data-testid='bubble' onMouseEnter={handleMouseEnter}>
    {messageActionsShow && <div data-testid='action-bar'>{messageActionsBelow ? 'below' : 'above'}</div>}
  </div>
)

// `list` and `message` are their tops in px from the top of the window.
const hoverAndOpenActions = ({
  list,
  message: messageTop,
  insideList = true
}: {
  list: number
  message: number
  insideList?: boolean
}) => {
  const channelId = 'channel-actions-placement'
  const message = makeMessage({ id: '1700', channelId, body: 'hovered message', incoming: true })
  const channel = makeChannel({ id: channelId, lastMessage: message })
  const store = createMessageListStore({
    ChannelReducer: { activeChannel: channel },
    MessageReducer: { unreadScrollTo: false }
  })
  const row = (
    <Message
      message={message}
      channel={channel}
      stopScrolling={() => undefined}
      handleScrollToRepliedMessage={() => undefined}
      prevMessage={undefined as any}
      nextMessage={undefined as any}
      isThreadMessage={false}
      CustomMessageItem={ReportingMessageItem}
    />
  )
  const { container } = renderWithSceytProvider(insideList ? <div id='scrollableDiv'>{row}</div> : row, { store })
  const listElement = container.querySelector('#scrollableDiv')
  if (listElement) setElementRect(listElement, { top: list, height: 600, width: 400 })
  setElementRect(container.querySelector('.message_item')!, { top: messageTop, height: 40, width: 400 })

  fireEvent.mouseEnter(screen.getByTestId('bubble'))
  act(() => {
    jest.advanceTimersByTime(500)
  })
  return screen.getByTestId('action-bar').textContent
}

describe('message action bar placement', () => {
  beforeEach(() => {
    resetMessageListFixtureIds()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('opens below the top message of the list when a pinned banner pushes the list down', () => {
    // A 64px header and a 52px pinned banner: the list starts at 116px.
    expect(hoverAndOpenActions({ list: 116, message: 120 })).toBe('below')
  })

  it('opens below the top message of the list without a pinned banner', () => {
    expect(hoverAndOpenActions({ list: 64, message: 70 })).toBe('below')
  })

  it('opens above a message with room for the bar above it in the list', () => {
    expect(hoverAndOpenActions({ list: 116, message: 300 })).toBe('above')
  })

  it('outside a message list, opens below a message near the top of the window', () => {
    expect(hoverAndOpenActions({ list: 0, message: 80, insideList: false })).toBe('below')
  })

  it('outside a message list, opens above a message far from the top of the window', () => {
    expect(hoverAndOpenActions({ list: 0, message: 300, insideList: false })).toBe('above')
  })
})
