/**
 * A reply that arrives for a message the current user already
 * deleted "for me" must show its parent as deleted right away.
 *
 * The SDK MESSAGE event carries the server's shared parentMessage snapshot,
 * which does not know about the current user's delete-for-me. The local state
 * (Redux activeChannelMessages and the messagesMap cache) does know the parent
 * is deleted; the incoming reply must not bring the deleted attachment back.
 */
import { runSaga } from 'redux-saga'
import { setClient } from '../../common/client'
import {
  addChannelToAllChannels,
  destroyChannelsMap,
  setActiveChannelId,
  setChannelInMap
} from '../../helpers/channelHalper'
import { addMessageToMap, clearActiveSegment, clearMessagesMap, getMessagesFromMap } from '../../helpers/messagesHalper'
import { DEFAULT_CHANNEL_TYPE, MESSAGE_STATUS, attachmentTypes } from '../../helpers/constants'
import { MESSAGE_TYPE } from '../../types/enum'
import { IAttachment, IMessage } from '../../types'
import { makeChannel, makeMessage, makeUser, resetMessageListFixtureIds } from '../../testUtils/messageFixtures'
import { addMessagesAC } from '../message/actions'
import { __eventsTestables } from './inedx'

jest.mock('../../helpers/messageListNavigator', () => ({
  navigateToLatest: () => undefined
}))

const channelId = 'channel-reply-to-deleted-for-me'
// 64-bit ids above Number.MAX_SAFE_INTEGER, as the server sends them.
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

describe('incoming reply to a message deleted for me', () => {
  const mockStore = require('store') as { getState: () => any; dispatch: jest.Mock }

  let originalFileMessage: IMessage
  let deletedForMeFileMessage: IMessage
  let storeState: any

  beforeEach(() => {
    resetMessageListFixtureIds()
    clearMessagesMap()
    clearActiveSegment()
    destroyChannelsMap()
    setActiveChannelId('')
    setClient({ user: { id: userA.id }, Channel: { create: () => undefined } })

    // 1) A sent a file to the group.
    originalFileMessage = {
      ...makeMessage({
        id: fileMessageId,
        channelId,
        user: userA,
        type: 'file',
        attachments: [fileAttachment]
      }),
      body: ''
    }
    // 2) A deleted it "for me": local state holds the deleted snapshot.
    deletedForMeFileMessage = {
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
    setActiveChannelId(channelId)
    setChannelInMap(channel)
    addChannelToAllChannels(channel)
    addMessageToMap(channelId, deletedForMeFileMessage)

    storeState = {
      MessageReducer: {
        pendingPollActions: {},
        messagesHasNext: false,
        visibleMessagesMap: {},
        activeChannelMessages: [deletedForMeFileMessage]
      },
      UserReducer: { browserTabIsActive: true },
      ChannelReducer: { channels: [channel] },
      ThemeReducer: { theme: 'light', newTheme: { colors: {} } }
    }
    mockStore.getState = () => storeState
  })

  afterEach(() => {
    clearMessagesMap()
    clearActiveSegment()
    destroyChannelsMap()
    setActiveChannelId('')
  })

  const receiveReplyFromB = async () => {
    // 3) B replies to the original attachment. The event's parentMessage is
    // the shared server snapshot: still the undeleted file message.
    const replyFromB = makeMessage({
      id: replyMessageId,
      channelId,
      user: userB,
      incoming: true,
      body: 'reply to your file',
      parentMessage: { ...originalFileMessage, attachments: [{ ...fileAttachment }] }
    })
    const channelFromEvent = makeChannel({
      id: channelId,
      type: DEFAULT_CHANNEL_TYPE.GROUP,
      lastMessage: replyFromB,
      newMessageCount: 1
    })

    const dispatched: any[] = []
    await runSaga(
      {
        getState: () => storeState,
        dispatch: (action: any) => {
          dispatched.push(action)
        }
      },
      __eventsTestables.handleChannelMessageEvent,
      { channel: channelFromEvent, message: replyFromB },
      { user: { id: userA.id } }
    ).toPromise()

    return { dispatched, replyFromB }
  }

  it('shows the parent of a new reply as deleted in the open chat when the parent was deleted for me', async () => {
    const { dispatched } = await receiveReplyFromB()

    const addedReply: IMessage | undefined = dispatched
      .filter((action) => action.type === addMessagesAC([], 'next').type)
      .flatMap((action) => action.payload.messages as IMessage[])
      .find((message) => message.id === replyMessageId)

    expect(addedReply).toBeDefined()
    expect(addedReply!.parentMessage).toEqual(
      expect.objectContaining({
        id: fileMessageId,
        state: MESSAGE_STATUS.DELETE,
        attachments: []
      })
    )
  })

  it('caches a new reply with its parent deleted when the parent was deleted for me', async () => {
    await receiveReplyFromB()

    const cachedReply = getMessagesFromMap(channelId)[replyMessageId]

    expect(cachedReply).toBeDefined()
    expect(cachedReply.parentMessage).toEqual(
      expect.objectContaining({
        id: fileMessageId,
        state: MESSAGE_STATUS.DELETE,
        attachments: []
      })
    )
  })

  it('keeps the parent from the event when the local copy is not deleted', async () => {
    addMessageToMap(channelId, originalFileMessage)
    storeState.MessageReducer.activeChannelMessages = [originalFileMessage]

    await receiveReplyFromB()

    const cachedReply = getMessagesFromMap(channelId)[replyMessageId]
    expect(cachedReply.parentMessage).toEqual(
      expect.objectContaining({ id: fileMessageId, state: originalFileMessage.state })
    )
    expect(cachedReply.parentMessage!.attachments.map((attachment) => attachment.name)).toEqual([fileName])
  })
})
