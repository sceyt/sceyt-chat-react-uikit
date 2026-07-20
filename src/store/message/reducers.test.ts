import MessageReducer, {
  addMessage,
  addMessages,
  setMessages,
  updateMessage,
  updateMessagesStatus,
  updateMessageAttachment,
  removeAttachmentUpdatedEntries,
  uploadAttachmentCompilation,
  removeAttachmentUploadingState,
  setMessageMarkers,
  removeChannelMarkers,
  setOGMetadata,
  OG_METADATA_MAX
} from './reducers'
import { addReactionToMessageAC, deleteReactionFromMessageAC } from './actions'
import {
  addMessageToMap,
  clearMessagesMap,
  getMessagesFromMap,
  getAllPendingFromMap,
  getPendingMessagesFromMap,
  MESSAGE_LOAD_DIRECTION,
  updateMessageOnMap,
  updateMessageDeliveryStatusAndMarkers,
  updateMessageStatusOnMap
} from '../../helpers/messagesHalper'
import { makeMessage, makePendingMessage, makeUser, resetMessageListFixtureIds } from '../../testUtils/messageFixtures'
import { MESSAGE_DELIVERY_STATUS, MESSAGE_STATUS } from '../../helpers/constants'

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

  it('updates reply parent snapshots when the source message is edited', () => {
    const channelId = 'channel-reply-edit-reducer'
    const sourceMessage = makeMessage({
      id: '4001',
      channelId,
      body: 'before-edit'
    })
    const replyMessage = makeMessage({
      id: '4002',
      channelId,
      body: 'reply-message',
      parentMessage: sourceMessage
    })

    const initialState = MessageReducer(undefined, setMessages({ messages: [sourceMessage, replyMessage] }))
    const nextState = MessageReducer(
      initialState,
      updateMessage({
        messageId: sourceMessage.id,
        params: {
          body: 'after-edit',
          updatedAt: new Date('2026-04-01T12:20:00.000Z')
        }
      })
    )

    expect(nextState.activeChannelMessages[1].parentMessage).toEqual(
      expect.objectContaining({
        id: sourceMessage.id,
        body: 'after-edit'
      })
    )
  })

  it('updates reply parent snapshots when the source message is deleted', () => {
    const channelId = 'channel-reply-delete-reducer'
    const sourceMessage = makeMessage({
      id: '4011',
      channelId,
      body: 'before-delete',
      attachments: [{ id: 'att-1' } as any]
    })
    const replyMessage = makeMessage({
      id: '4012',
      channelId,
      body: 'reply-message',
      parentMessage: sourceMessage
    })

    const initialState = MessageReducer(undefined, setMessages({ messages: [sourceMessage, replyMessage] }))
    const nextState = MessageReducer(
      initialState,
      updateMessage({
        messageId: sourceMessage.id,
        params: {
          id: sourceMessage.id,
          state: MESSAGE_STATUS.DELETE,
          body: '',
          attachments: []
        }
      })
    )

    expect(nextState.activeChannelMessages[1].parentMessage).toEqual(
      expect.objectContaining({
        id: sourceMessage.id,
        state: MESSAGE_STATUS.DELETE,
        body: '',
        attachments: []
      })
    )
  })

  it('propagates reply parent snapshot updates in the message cache for edit and delete', () => {
    const channelId = 'channel-reply-map'
    const sourceMessage = makeMessage({
      id: '4021',
      channelId,
      body: 'cache-before-edit',
      attachments: [{ id: 'att-2' } as any]
    })
    const replyMessage = makeMessage({
      id: '4022',
      channelId,
      body: 'reply-message',
      parentMessage: sourceMessage
    })

    addMessageToMap(channelId, sourceMessage)
    addMessageToMap(channelId, replyMessage)

    updateMessageOnMap(channelId, {
      messageId: sourceMessage.id,
      params: {
        body: 'cache-after-edit',
        updatedAt: new Date('2026-04-01T12:22:00.000Z')
      }
    })

    expect(getMessagesFromMap(channelId)[replyMessage.id].parentMessage).toEqual(
      expect.objectContaining({
        id: sourceMessage.id,
        body: 'cache-after-edit'
      })
    )

    updateMessageOnMap(channelId, {
      messageId: sourceMessage.id,
      params: {
        id: sourceMessage.id,
        state: MESSAGE_STATUS.DELETE,
        body: '',
        attachments: []
      }
    })

    expect(getMessagesFromMap(channelId)[replyMessage.id].parentMessage).toEqual(
      expect.objectContaining({
        id: sourceMessage.id,
        state: MESSAGE_STATUS.DELETE,
        body: '',
        attachments: []
      })
    )
  })

  it('adds self reactions even when the active message has no hydrated userReactions array yet', () => {
    const channelId = 'channel-reaction-add'
    const currentUser = makeUser({ id: 'current-user' })
    const message = {
      ...makeMessage({ id: '5001', channelId, user: currentUser }),
      userReactions: undefined as any
    }
    const reaction = {
      id: 'reaction-1',
      key: 'fire',
      score: 1,
      reason: '',
      createdAt: new Date('2026-04-01T12:30:00.000Z'),
      messageId: message.id,
      user: currentUser
    }

    const initialState = MessageReducer(undefined, setMessages({ messages: [message as any] }))
    const nextState = MessageReducer(initialState, addReactionToMessageAC(message as any, reaction as any, true))

    expect(nextState.activeChannelMessages[0].userReactions).toEqual([reaction])
    expect(nextState.activeChannelMessages[0].reactionTotals).toEqual(message.reactionTotals)
  })

  it('removes self reactions safely when the active message has no hydrated userReactions array yet', () => {
    const channelId = 'channel-reaction-delete'
    const currentUser = makeUser({ id: 'current-user' })
    const message = {
      ...makeMessage({ id: '5002', channelId, user: currentUser }),
      userReactions: undefined as any
    }
    const reaction = {
      id: 'reaction-2',
      key: 'smile',
      score: 1,
      reason: '',
      createdAt: new Date('2026-04-01T12:31:00.000Z'),
      messageId: message.id,
      user: currentUser
    }

    const initialState = MessageReducer(undefined, setMessages({ messages: [message as any] }))
    const nextState = MessageReducer(initialState, deleteReactionFromMessageAC(message as any, reaction as any, true))

    expect(nextState.activeChannelMessages[0].userReactions).toEqual([])
    expect(nextState.activeChannelMessages[0].reactionTotals).toEqual(message.reactionTotals)
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

describe('message marker status updates', () => {
  beforeEach(() => {
    resetMessageListFixtureIds()
    clearMessagesMap()
  })

  afterEach(() => {
    clearMessagesMap()
  })

  it('adds own markers to userMarkers without updating markerTotals', () => {
    const markerUser = { id: 'current-user' } as any
    const message = makeMessage({
      id: '100',
      deliveryStatus: MESSAGE_DELIVERY_STATUS.SENT,
      userMarkers: [],
      markerTotals: []
    })

    const updatedMessage = updateMessageDeliveryStatusAndMarkers(
      message,
      {
        deliveryStatus: MESSAGE_DELIVERY_STATUS.DELIVERED,
        marker: {
          messageIds: [message.id],
          user: markerUser,
          name: MESSAGE_DELIVERY_STATUS.DELIVERED,
          createdAt: new Date('2026-04-01T12:30:00.000Z')
        }
      },
      true
    )

    expect(updatedMessage.deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.DELIVERED)
    expect(updatedMessage.userMarkers).toEqual([
      expect.objectContaining({
        name: MESSAGE_DELIVERY_STATUS.DELIVERED,
        messageId: message.id,
        user: markerUser
      })
    ])
    expect(updatedMessage.markerTotals).toBeUndefined()
  })

  it('adds other-user markers to markerTotals without updating userMarkers', () => {
    const message = makeMessage({
      id: '101',
      deliveryStatus: MESSAGE_DELIVERY_STATUS.SENT,
      userMarkers: [],
      markerTotals: []
    })

    const updatedMessage = updateMessageDeliveryStatusAndMarkers(
      message,
      {
        deliveryStatus: MESSAGE_DELIVERY_STATUS.READ,
        marker: {
          messageIds: [message.id],
          user: { id: 'remote-user' },
          name: MESSAGE_DELIVERY_STATUS.READ,
          createdAt: new Date('2026-04-01T12:31:00.000Z')
        }
      },
      false
    )

    expect(updatedMessage.deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.READ)
    expect(updatedMessage.markerTotals).toEqual([{ name: MESSAGE_DELIVERY_STATUS.READ, count: 1 }])
    expect(updatedMessage.userMarkers).toBeUndefined()
  })

  it('does not downgrade deliveryStatus while still merging marker collections', () => {
    const message = makeMessage({
      id: '102',
      deliveryStatus: MESSAGE_DELIVERY_STATUS.READ,
      userMarkers: [],
      markerTotals: []
    })

    const updatedMessage = updateMessageDeliveryStatusAndMarkers(
      message,
      {
        deliveryStatus: MESSAGE_DELIVERY_STATUS.DELIVERED,
        marker: {
          messageIds: [message.id],
          user: { id: 'remote-user' },
          name: MESSAGE_DELIVERY_STATUS.DELIVERED,
          createdAt: new Date('2026-04-01T12:32:00.000Z')
        }
      },
      false
    )

    expect(updatedMessage.deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.READ)
    expect(updatedMessage.markerTotals).toEqual([{ name: MESSAGE_DELIVERY_STATUS.DELIVERED, count: 1 }])
  })

  it('does not duplicate same-status own markers', () => {
    const existingMarker = {
      name: MESSAGE_DELIVERY_STATUS.READ,
      messageId: '103',
      user: { id: 'current-user' },
      createdAt: new Date('2026-04-01T12:33:00.000Z')
    } as any
    const message = makeMessage({
      id: '103',
      deliveryStatus: MESSAGE_DELIVERY_STATUS.READ,
      userMarkers: [existingMarker],
      markerTotals: []
    })

    const updatedMessage = updateMessageDeliveryStatusAndMarkers(
      message,
      {
        deliveryStatus: MESSAGE_DELIVERY_STATUS.READ,
        marker: {
          messageIds: [message.id],
          user: { id: 'current-user' },
          name: MESSAGE_DELIVERY_STATUS.READ,
          createdAt: new Date('2026-04-01T12:34:00.000Z')
        }
      },
      true
    )

    expect(updatedMessage.userMarkers).toEqual([existingMarker])
  })

  it('updates active messages and cached messages with the same own-vs-other marker logic', () => {
    const channelId = 'marker-cache-channel'
    const activeOwnMessage = makeMessage({
      id: '110',
      channelId,
      deliveryStatus: MESSAGE_DELIVERY_STATUS.SENT,
      userMarkers: [],
      markerTotals: []
    })
    const cachedRemoteMessage = makeMessage({
      id: '111',
      channelId,
      deliveryStatus: MESSAGE_DELIVERY_STATUS.SENT,
      userMarkers: [],
      markerTotals: []
    })
    const ownMarker = {
      messageIds: [activeOwnMessage.id],
      user: { id: 'current-user' },
      name: MESSAGE_DELIVERY_STATUS.DELIVERED,
      createdAt: new Date('2026-04-01T12:35:00.000Z')
    } as any
    const remoteMarker = {
      messageIds: [cachedRemoteMessage.id],
      user: { id: 'remote-user' },
      name: MESSAGE_DELIVERY_STATUS.READ,
      createdAt: new Date('2026-04-01T12:36:00.000Z')
    } as any

    const initialState = MessageReducer(undefined, setMessages({ messages: [activeOwnMessage] }))
    const nextState = MessageReducer(
      initialState,
      updateMessagesStatus({
        name: MESSAGE_DELIVERY_STATUS.DELIVERED,
        markersMap: { [activeOwnMessage.id]: true as any },
        isOwnMarker: true,
        marker: ownMarker
      })
    )

    addMessageToMap(channelId, cachedRemoteMessage)
    updateMessageStatusOnMap(
      channelId,
      {
        name: MESSAGE_DELIVERY_STATUS.READ,
        markersMap: { [cachedRemoteMessage.id]: true },
        marker: remoteMarker
      },
      false
    )

    expect(nextState.activeChannelMessages[0].userMarkers).toEqual([
      expect.objectContaining({ name: MESSAGE_DELIVERY_STATUS.DELIVERED, messageId: activeOwnMessage.id })
    ])
    expect(nextState.activeChannelMessages[0].markerTotals).toEqual([])
    expect(getMessagesFromMap(channelId)[cachedRemoteMessage.id].markerTotals).toEqual([
      { name: MESSAGE_DELIVERY_STATUS.READ, count: 1 }
    ])
    expect(getMessagesFromMap(channelId)[cachedRemoteMessage.id].userMarkers).toEqual([])
  })
})

describe('memory-bounded maps', () => {
  const initialState = MessageReducer(undefined, { type: '@@INIT' })

  it('removeAttachmentUpdatedEntries deletes only the given (already versioned) keys', () => {
    let state = MessageReducer(initialState, updateMessageAttachment({ url: 'url-a_v1', attachmentUrl: 'blob:a' }))
    state = MessageReducer(state, updateMessageAttachment({ url: 'url-b_v1', attachmentUrl: 'blob:b' }))
    state = MessageReducer(state, removeAttachmentUpdatedEntries({ keys: ['url-a_v1', 'missing-key'] }))
    expect(state.attachmentUpdatedMap).toEqual({ 'url-b_v1': 'blob:b' })
  })

  it('removeAttachmentUploadingState deletes a single upload state entry', () => {
    let state = MessageReducer(
      initialState,
      uploadAttachmentCompilation({ attachmentUploadingState: 'success', attachmentId: 'tid-1' })
    )
    state = MessageReducer(
      state,
      uploadAttachmentCompilation({ attachmentUploadingState: 'fail', attachmentId: 'tid-2' })
    )
    state = MessageReducer(state, removeAttachmentUploadingState({ attachmentId: 'tid-1' }))
    expect(state.attachmentsUploadingState).toEqual({ 'tid-2': 'fail' })
  })

  it('removeChannelMarkers drops all markers of one channel', () => {
    let state = MessageReducer(
      initialState,
      setMessageMarkers({
        channelId: 'channel-1',
        messageId: 'message-1',
        messageMarkers: { displayed: [] },
        deliveryStatuses: ['displayed']
      })
    )
    state = MessageReducer(
      state,
      setMessageMarkers({
        channelId: 'channel-2',
        messageId: 'message-2',
        messageMarkers: { displayed: [] },
        deliveryStatuses: ['displayed']
      })
    )
    state = MessageReducer(state, removeChannelMarkers({ channelId: 'channel-1' }))
    expect(state.messageMarkers['channel-1']).toBeUndefined()
    expect(state.messageMarkers['channel-2']).toBeDefined()
  })

  it('setOGMetadata caps the map with FIFO eviction', () => {
    let state = initialState
    for (let i = 0; i < OG_METADATA_MAX; i++) {
      state = MessageReducer(state, setOGMetadata({ url: `https://example.com/${i}`, metadata: null }))
    }
    expect(Object.keys(state.oGMetadata || {})).toHaveLength(OG_METADATA_MAX)
    state = MessageReducer(state, setOGMetadata({ url: 'https://example.com/overflow', metadata: null }))
    const keys = Object.keys(state.oGMetadata || {})
    expect(keys).toHaveLength(OG_METADATA_MAX)
    expect(keys).not.toContain('https://example.com/0')
    expect(keys).toContain('https://example.com/overflow')
  })

  it('updating an existing oGMetadata key does not evict others', () => {
    let state = initialState
    for (let i = 0; i < OG_METADATA_MAX; i++) {
      state = MessageReducer(state, setOGMetadata({ url: `https://example.com/${i}`, metadata: null }))
    }
    state = MessageReducer(state, setOGMetadata({ url: 'https://example.com/0', metadata: null }))
    expect(Object.keys(state.oGMetadata || {})).toHaveLength(OG_METADATA_MAX)
    expect(Object.keys(state.oGMetadata || {})).toContain('https://example.com/1')
  })
})
