import React from 'react'
import { render, screen } from '@testing-library/react'
import RepliedMessage from './index'
import { makeMessage, resetMessageListFixtureIds } from '../../../testUtils/messageFixtures'
import { MESSAGE_STATUS } from '../../../helpers/constants'

jest.mock('../../../hooks', () => {
  const { THEME_COLORS } = require('../../../UIHelper/constants')

  return {
    useColor: () => ({
      [THEME_COLORS.ACCENT]: '#00aa88',
      [THEME_COLORS.TEXT_PRIMARY]: '#111111',
      [THEME_COLORS.TEXT_SECONDARY]: '#777777',
      [THEME_COLORS.OUTGOING_MESSAGE_BACKGROUND_X]: '#dcf8c6',
      [THEME_COLORS.INCOMING_MESSAGE_BACKGROUND_X]: '#f1f1f1',
      [THEME_COLORS.LINK_COLOR]: '#0057ff'
    })
  }
})

jest.mock('../../../common/client', () => ({
  getClient: () => ({
    user: { id: 'current-user' }
  })
}))

jest.mock('../../Attachment', () => ({
  __esModule: true,
  default: () => null
}))

describe('RepliedMessage', () => {
  beforeEach(() => {
    resetMessageListFixtureIds()
  })

  it('rerenders the reply preview when only the parent message snapshot changes', () => {
    const parentMessage = makeMessage({
      id: '5001',
      channelId: 'channel-replied-preview',
      body: 'before-edit'
    })
    const replyMessage = makeMessage({
      id: '5002',
      channelId: 'channel-replied-preview',
      body: 'reply-message',
      parentMessage
    })

    const { rerender } = render(
      <RepliedMessage message={replyMessage} handleScrollToRepliedMessage={() => undefined} contactsMap={{}} />
    )

    expect(screen.getByText('before-edit')).toBeInTheDocument()

    rerender(
      <RepliedMessage
        message={{
          ...replyMessage,
          parentMessage: {
            ...parentMessage,
            body: 'after-edit',
            updatedAt: new Date('2026-04-03T12:00:00.000Z')
          }
        }}
        handleScrollToRepliedMessage={() => undefined}
        contactsMap={{}}
      />
    )

    expect(screen.getByText('after-edit')).toBeInTheDocument()
    expect(screen.queryByText('before-edit')).not.toBeInTheDocument()

    rerender(
      <RepliedMessage
        message={{
          ...replyMessage,
          parentMessage: {
            ...parentMessage,
            state: MESSAGE_STATUS.DELETE,
            body: '',
            attachments: [],
            updatedAt: new Date('2026-04-03T12:01:00.000Z')
          }
        }}
        handleScrollToRepliedMessage={() => undefined}
        contactsMap={{}}
      />
    )

    expect(screen.getByText('Message was deleted.')).toBeInTheDocument()
    expect(screen.queryByText('after-edit')).not.toBeInTheDocument()
  })
})
