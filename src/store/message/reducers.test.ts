import MessageReducer, { addMessage, addMessages, setMessages, updateMessage } from './reducers'
import {
  addMessageToMap,
  clearMessagesMap,
  getAllPendingFromMap,
  getPendingMessagesFromMap,
  MESSAGE_LOAD_DIRECTION
} from '../../helpers/messagesHalper'
import { makeMessage, makePendingMessage, resetMessageListFixtureIds } from '../../testUtils/messageFixtures'

describe('message pending ordering', () => {
  beforeEach(() => {
    resetMessageListFixtureIds()
    clearMessagesMap()
  })

  afterEach(() => {
    clearMessagesMap()
  })

  it('sorts pending messages from the map by createdAt ascending', () => {
    const channelId = 'channel-map'
    const pendingLater = makePendingMessage({
      channelId,
      body: 'pending-later',
      createdAt: new Date('2026-04-01T12:05:00.000Z')
    })
    const pendingEarlier = makePendingMessage({
      channelId,
      body: 'pending-earlier',
      createdAt: new Date('2026-04-01T12:01:00.000Z')
    })

    addMessageToMap(channelId, pendingLater)
    addMessageToMap(channelId, pendingEarlier)

    expect(getPendingMessagesFromMap(channelId).map((message) => message.body)).toEqual([
      'pending-earlier',
      'pending-later'
    ])
  })

  it('preserves per-channel pending ordering in getAllPendingFromMap', () => {
    const firstChannelPendingLater = makePendingMessage({
      channelId: 'channel-1',
      body: 'channel-1-later',
      createdAt: new Date('2026-04-01T12:05:00.000Z')
    })
    const firstChannelPendingEarlier = makePendingMessage({
      channelId: 'channel-1',
      body: 'channel-1-earlier',
      createdAt: new Date('2026-04-01T12:02:00.000Z')
    })
    const secondChannelPending = makePendingMessage({
      channelId: 'channel-2',
      body: 'channel-2-pending',
      createdAt: new Date('2026-04-01T12:03:00.000Z')
    })

    addMessageToMap('channel-1', firstChannelPendingLater)
    addMessageToMap('channel-1', firstChannelPendingEarlier)
    addMessageToMap('channel-2', secondChannelPending)

    const pendingMap = getAllPendingFromMap()

    expect(pendingMap['channel-1'].map((message) => message.body)).toEqual(['channel-1-earlier', 'channel-1-later'])
    expect(pendingMap['channel-2'].map((message) => message.body)).toEqual(['channel-2-pending'])
  })

  it('keeps pending messages at the tail after setMessages', () => {
    const confirmedOlder = makeMessage({
      id: '10',
      channelId: 'channel-reducer',
      body: 'confirmed-older'
    })
    const confirmedNewer = makeMessage({
      id: '11',
      channelId: 'channel-reducer',
      body: 'confirmed-newer'
    })
    const pendingLater = makePendingMessage({
      channelId: 'channel-reducer',
      body: 'pending-later',
      createdAt: new Date('2026-04-01T12:05:00.000Z')
    })
    const pendingEarlier = makePendingMessage({
      channelId: 'channel-reducer',
      body: 'pending-earlier',
      createdAt: new Date('2026-04-01T12:01:00.000Z')
    })

    const state = MessageReducer(
      undefined,
      setMessages({ messages: [pendingLater, confirmedNewer, pendingEarlier, confirmedOlder] })
    )

    expect(state.activeChannelMessages.map((message) => message.body)).toEqual([
      'confirmed-older',
      'confirmed-newer',
      'pending-earlier',
      'pending-later'
    ])
  })

  it('keeps pending messages at the tail after addMessages and addMessage', () => {
    const confirmedNewest = makeMessage({
      id: '22',
      channelId: 'channel-tail',
      body: 'confirmed-newest'
    })
    const confirmedMiddle = makeMessage({
      id: '21',
      channelId: 'channel-tail',
      body: 'confirmed-middle'
    })
    const pendingLater = makePendingMessage({
      channelId: 'channel-tail',
      body: 'pending-later',
      createdAt: new Date('2026-04-01T12:10:00.000Z')
    })
    const pendingEarlier = makePendingMessage({
      channelId: 'channel-tail',
      body: 'pending-earlier',
      createdAt: new Date('2026-04-01T12:07:00.000Z')
    })
    const olderPage = [
      makeMessage({ id: '19', channelId: 'channel-tail', body: 'confirmed-oldest' }),
      makeMessage({ id: '20', channelId: 'channel-tail', body: 'confirmed-older' })
    ]

    const initialState = MessageReducer(
      undefined,
      setMessages({ messages: [confirmedNewest, pendingLater, confirmedMiddle, pendingEarlier] })
    )

    const withOlderPage = MessageReducer(
      initialState,
      addMessages({ messages: olderPage, direction: MESSAGE_LOAD_DIRECTION.PREV })
    )

    const finalState = MessageReducer(
      withOlderPage,
      addMessage({
        message: makePendingMessage({
          channelId: 'channel-tail',
          body: 'pending-middle',
          createdAt: new Date('2026-04-01T12:08:00.000Z')
        })
      })
    )

    expect(finalState.activeChannelMessages.map((message) => message.body)).toEqual([
      'confirmed-oldest',
      'confirmed-older',
      'confirmed-middle',
      'confirmed-newest',
      'pending-earlier',
      'pending-middle',
      'pending-later'
    ])
  })

  it('keeps pending ordering deterministic after updateMessage', () => {
    const confirmed = makeMessage({
      id: '31',
      channelId: 'channel-update',
      body: 'confirmed'
    })
    const pendingLater = makePendingMessage({
      channelId: 'channel-update',
      body: 'pending-later',
      createdAt: new Date('2026-04-01T12:10:00.000Z')
    })
    const pendingEarlier = makePendingMessage({
      channelId: 'channel-update',
      body: 'pending-earlier',
      createdAt: new Date('2026-04-01T12:02:00.000Z')
    })

    const initialState = MessageReducer(undefined, setMessages({ messages: [confirmed, pendingLater, pendingEarlier] }))

    const nextState = MessageReducer(
      initialState,
      updateMessage({
        messageId: pendingLater.tid!,
        params: {
          body: 'pending-later-updated',
          createdAt: pendingLater.createdAt
        }
      })
    )

    expect(nextState.activeChannelMessages.map((message) => message.body)).toEqual([
      'confirmed',
      'pending-earlier',
      'pending-later-updated'
    ])
  })

  it('keeps pending messages at the tail after paginating to older and newer pages around them', () => {
    const channelId = 'channel-window-pagination'
    const confirmedMiddle = makeMessage({
      id: '110',
      channelId,
      body: 'confirmed-middle'
    })
    const confirmedNewestVisible = makeMessage({
      id: '111',
      channelId,
      body: 'confirmed-newest-visible'
    })
    const pendingEarlier = makePendingMessage({
      channelId,
      body: 'pending-earlier',
      createdAt: new Date('2026-04-01T12:11:00.000Z')
    })
    const pendingLater = makePendingMessage({
      channelId,
      body: 'pending-later',
      createdAt: new Date('2026-04-01T12:13:00.000Z')
    })

    const initialState = MessageReducer(
      undefined,
      setMessages({
        messages: [confirmedNewestVisible, pendingLater, confirmedMiddle, pendingEarlier]
      })
    )

    const afterOlderPages = MessageReducer(
      MessageReducer(
        initialState,
        addMessages({
          messages: [
            makeMessage({ id: '108', channelId, body: 'confirmed-oldest' }),
            makeMessage({ id: '109', channelId, body: 'confirmed-older' })
          ],
          direction: MESSAGE_LOAD_DIRECTION.PREV
        })
      ),
      addMessages({
        messages: [makeMessage({ id: '107', channelId, body: 'confirmed-oldest-2' })],
        direction: MESSAGE_LOAD_DIRECTION.PREV
      })
    )

    const finalState = MessageReducer(
      afterOlderPages,
      addMessages({
        messages: [
          makeMessage({ id: '112', channelId, body: 'confirmed-next-1' }),
          makeMessage({ id: '113', channelId, body: 'confirmed-next-2' })
        ],
        direction: MESSAGE_LOAD_DIRECTION.NEXT
      })
    )

    expect(finalState.activeChannelMessages.map((message) => message.body)).toEqual([
      'confirmed-oldest-2',
      'confirmed-oldest',
      'confirmed-older',
      'confirmed-middle',
      'confirmed-newest-visible',
      'confirmed-next-1',
      'confirmed-next-2',
      'pending-earlier',
      'pending-later'
    ])
  })

  it('drops pending messages from a deep history window when latest confirmed is trimmed out', () => {
    const channelId = 'channel-deep-history'
    const confirmedLatest = makeMessage({
      id: '1000',
      channelId,
      body: 'confirmed-latest'
    })
    const pendingTail = makePendingMessage({
      channelId,
      body: 'pending-tail',
      createdAt: new Date('2026-04-01T12:20:00.000Z')
    })

    const initialState = MessageReducer(
      undefined,
      setMessages({
        messages: [confirmedLatest, pendingTail]
      })
    )

    const deepHistoryState = MessageReducer(
      MessageReducer(
        initialState,
        addMessages({
          messages: Array.from({ length: 40 }, (_, index) =>
            makeMessage({
              id: String(960 + index),
              channelId,
              body: `history-page-1-${index}`
            })
          ),
          direction: MESSAGE_LOAD_DIRECTION.PREV
        })
      ),
      addMessages({
        messages: Array.from({ length: 40 }, (_, index) =>
          makeMessage({
            id: String(920 + index),
            channelId,
            body: `history-page-2-${index}`
          })
        ),
        direction: MESSAGE_LOAD_DIRECTION.PREV
      })
    )

    expect(deepHistoryState.activeChannelMessages.some((message) => message.body === 'pending-tail')).toBe(false)
  })
})
