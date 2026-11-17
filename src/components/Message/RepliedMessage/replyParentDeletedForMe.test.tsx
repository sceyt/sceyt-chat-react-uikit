/**
 * After the current user deletes a group attachment "for me", a new
 * reply from another member to that attachment must render its quoted parent as
 * "Message was deleted." immediately, without the attachment preview, the same
 * as it does after reopening the chat.
 *
 * The reply goes through the real MESSAGE event handler into a real Redux store,
 * and the stored reply is rendered with RepliedMessage.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { runSaga } from 'redux-saga'
import RepliedMessage from './index'
import { setClient } from '../../../common/client'
import {
  addChannelToAllChannels,
  destroyChannelsMap,
  setActiveChannelId,
  setChannelInMap
} from '../../../helpers/channelHalper'
import { addMessageToMap, clearActiveSegment, clearMessagesMap } from '../../../helpers/messagesHalper'
import { DEFAULT_CHANNEL_TYPE, MESSAGE_STATUS, attachmentTypes } from '../../../helpers/constants'
import { MESSAGE_TYPE } from '../../../types/enum'
import { IAttachment, IMessage } from '../../../types'
import { __eventsTestables } from '../../../store/evetns/inedx'
import {
  createMessageListStore,
  makeChannel,
  makeMessage,
  makeUser,
  resetMessageListFixtureIds
} from '../../../testUtils/messageListHarness'

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

// The quoted attachment preview (blurred thumbnail) is stood in for by its file name.
jest.mock('../../Attachment', () => ({
  __esModule: true,
  default: (props: any) => <span data-testid='replied-attachment'>{props.attachment.name}</span>
}))

jest.mock('../../../helpers/messageListNavigator', () => ({
  navigateToLatest: () => undefined
}))

const channelId = 'channel-replied-deleted-for-me'
const fileMessageId = '9007199254740993'
const replyMessageId = '9007199254740995'
const fileName = 'quarterly-report.pdf'

const userA = makeUser({ id: 'current-user', firstName: 'Alice' })
const userB = makeUser({ id: 'member-b', firstName: 'Bob' })

const fileAttachment = {
  id: 'attachment-1',
  messageId: fileMessageId,
  type: attachmentTypes.file,
  name: fileName,
  url: 'https://cdn.example.test/quarterly-report.pdf',
  size: 2048,
  metadata: { tmb: 'blurred-thumbnail' }
} as unknown as IAttachment

describe('reply preview for a parent deleted for me', () => {
  const mockStore = require('store') as { getState: () => any; dispatch: jest.Mock }

  beforeEach(() => {
    resetMessageListFixtureIds()
    clearMessagesMap()
    clearActiveSegment()
    destroyChannelsMap()
    setActiveChannelId('')
    setClient({ user: { id: userA.id }, Channel: { create: () => undefined } })
  })

  afterEach(() => {
    clearMessagesMap()
    clearActiveSegment()
    destroyChannelsMap()
    setActiveChannelId('')
  })

  it('shows "Message was deleted." and no attachment in a new reply to an attachment deleted for me', async () => {
    const originalFileMessage: IMessage = {
      ...makeMessage({ id: fileMessageId, channelId, user: userA, type: 'file', attachments: [fileAttachment] }),
      body: ''
    }
    const deletedForMeFileMessage: IMessage = {
      ...originalFileMessage,
      state: MESSAGE_STATUS.DELETE,
      type: MESSAGE_TYPE.DELETED,
      body: '',
      attachments: [],
      updatedAt: new Date('2026-04-01T12:30:00.000Z')
    }
    const channel = makeChannel({
      id: channelId,
      type: DEFAULT_CHANNEL_TYPE.GROUP,
      lastMessage: deletedForMeFileMessage,
      members: [
        { ...userA, role: 'owner' },
        { ...userB, role: 'member' }
      ]
    })

    // A has the group open and has already deleted the file "for me".
    const store = createMessageListStore({
      ChannelReducer: { channels: [channel], activeChannel: channel },
      MessageReducer: { activeChannelMessages: [deletedForMeFileMessage], messagesHasNext: false }
    })
    mockStore.getState = () => store.getState()
    setActiveChannelId(channelId)
    setChannelInMap(channel)
    addChannelToAllChannels(channel)
    addMessageToMap(channelId, deletedForMeFileMessage)

    // B replies to the original file; the event carries the undeleted server snapshot.
    const replyFromB = makeMessage({
      id: replyMessageId,
      channelId,
      user: userB,
      incoming: true,
      body: 'reply to your file',
      parentMessage: { ...originalFileMessage, attachments: [{ ...fileAttachment }] }
    })
    await runSaga(
      { getState: () => store.getState(), dispatch: (action: any) => store.dispatch(action) },
      __eventsTestables.handleChannelMessageEvent,
      {
        channel: makeChannel({ id: channelId, type: DEFAULT_CHANNEL_TYPE.GROUP, lastMessage: replyFromB }),
        message: replyFromB
      },
      { user: { id: userA.id } }
    ).toPromise()

    const storedReply = (store.getState().MessageReducer.activeChannelMessages as IMessage[]).find(
      (message) => message.id === replyMessageId
    )
    expect(storedReply).toBeDefined()

    render(<RepliedMessage message={storedReply!} handleScrollToRepliedMessage={() => undefined} contactsMap={{}} />)

    expect(screen.getByText('Message was deleted.')).toBeInTheDocument()
    expect(screen.queryByText(fileName)).not.toBeInTheDocument()
    expect(screen.queryByText('File')).not.toBeInTheDocument()
  })
})
