import ChannelReducer, {
  setChannels,
  setSearchedChannels,
  setSearchedChannelsForForward,
  setCloseSearchChannels,
  setChannelsForForward,
  addChannel,
  addChannels,
  addChannelsForForward,
  removeChannel,
  setChannelToAdd,
  setAddedToChannel,
  setChannelToRemove,
  setChannelToHide,
  setChannelToUnhide,
  setChannelsLoadingState,
  setChannelsHasNext,
  setActiveChannel,
  updateChannelData,
  updateChannelsMembers,
  updateSearchedChannelData,
  updateChannelLastMessage,
  updateChannelLastMessageStatus,
  setChannelInfoOpenClose,
  setMessageSearchOpenClose,
  toggleEditChannel,
  switchTypingIndicator,
  switchRecordingIndicator,
  setIsDragging,
  setDraggedAttachments,
  setChannelListWidth,
  setHideChannelList,
  setDraftIsRemoved,
  setChannelInviteKeys,
  setJoinableChannel,
  setChannelInviteKeyAvailable,
  setMutualChannels,
  setMutualChannelsHasNext,
  setMutualChannelsLoadingState,
  IChannelState,
  getChannels
} from './reducers'
import { updateMessage } from '../message/reducers'
import { DEFAULT_CHANNEL_TYPE, LOADING_STATE, MESSAGE_DELIVERY_STATUS, MESSAGE_STATUS } from '../../helpers/constants'
import { makeChannel, makeMessage, makeUser, resetMessageListFixtureIds } from '../../testUtils/messageFixtures'
import { IChannel, IMessage } from '../../types'
import { setClient } from '../../common/client'

// Mock getClient for tests that need it
const mockClient = {
  user: { id: 'current-user' }
}

beforeEach(() => {
  resetMessageListFixtureIds()
  setClient(mockClient as any)
})

// Helper to get initial state
const getInitialState = (): IChannelState => ChannelReducer(undefined, { type: '@@INIT' } as any)

// Helper to create channel with specific timestamp for ordering tests
const makeChannelWithTime = (id: string, timestamp: Date, overrides: Partial<IChannel> = {}): IChannel => {
  return makeChannel({
    id,
    createdAt: timestamp,
    lastMessage: makeMessage({
      id: `${id}-last-msg`,
      channelId: id,
      createdAt: timestamp
    }),
    ...overrides
  })
}

describe('channel reducer - setChannels', () => {
  it('sets channels and sorts by lastMessage date (newest first)', () => {
    const oldChannel = makeChannelWithTime('old', new Date('2026-04-01T10:00:00Z'))
    const newChannel = makeChannelWithTime('new', new Date('2026-04-01T12:00:00Z'))
    const midChannel = makeChannelWithTime('mid', new Date('2026-04-01T11:00:00Z'))

    const state = ChannelReducer(getInitialState(), setChannels({ channels: [oldChannel, newChannel, midChannel] }))

    expect(state.channels.map((c) => c.id)).toEqual(['new', 'mid', 'old'])
  })

  it('pinned channels appear before unpinned channels', () => {
    const unpinned1 = makeChannelWithTime('unpinned-1', new Date('2026-04-01T12:00:00Z'))
    const unpinned2 = makeChannelWithTime('unpinned-2', new Date('2026-04-01T11:00:00Z'))
    const pinned = makeChannelWithTime('pinned', new Date('2026-04-01T10:00:00Z'), {
      pinnedAt: new Date('2026-04-01T09:00:00Z')
    })

    const state = ChannelReducer(getInitialState(), setChannels({ channels: [unpinned1, unpinned2, pinned] }))

    // Pinned should be first even though it has oldest lastMessage
    expect(state.channels.map((c) => c.id)).toEqual(['pinned', 'unpinned-1', 'unpinned-2'])
  })

  it('multiple pinned channels are sorted by pinnedAt (most recent pin first)', () => {
    const pinned1 = makeChannelWithTime('pinned-1', new Date('2026-04-01T12:00:00Z'), {
      pinnedAt: new Date('2026-04-01T08:00:00Z')
    })
    const pinned2 = makeChannelWithTime('pinned-2', new Date('2026-04-01T10:00:00Z'), {
      pinnedAt: new Date('2026-04-01T10:00:00Z')
    })
    const unpinned = makeChannelWithTime('unpinned', new Date('2026-04-01T11:00:00Z'))

    const state = ChannelReducer(getInitialState(), setChannels({ channels: [pinned1, unpinned, pinned2] }))

    // pinned-2 has more recent pinnedAt, so it comes first
    expect(state.channels.map((c) => c.id)).toEqual(['pinned-2', 'pinned-1', 'unpinned'])
  })

  it('updates activeChannel if it exists in the new channels list', () => {
    const channel1 = makeChannel({ id: 'ch-1' })
    const channel2 = makeChannel({ id: 'ch-2', subject: 'Updated Subject' })

    let state = ChannelReducer(getInitialState(), setChannels({ channels: [channel1] }))
    state = ChannelReducer(state, setActiveChannel({ channel: channel1 }))

    // Now update channels with modified channel1
    const updatedChannel1 = { ...channel1, subject: 'New Subject' }
    state = ChannelReducer(state, setChannels({ channels: [updatedChannel1, channel2] }))

    expect((state.activeChannel as IChannel).subject).toBe('New Subject')
  })
})

describe('channel reducer - addChannel', () => {
  it('adds a new channel and sorts the list', () => {
    const existing = makeChannelWithTime('existing', new Date('2026-04-01T10:00:00Z'))
    const newChannel = makeChannelWithTime('new', new Date('2026-04-01T12:00:00Z'))

    let state = ChannelReducer(getInitialState(), setChannels({ channels: [existing] }))
    state = ChannelReducer(state, addChannel({ channel: newChannel }))

    expect(state.channels.map((c) => c.id)).toEqual(['new', 'existing'])
  })

  it('does not add duplicate channel', () => {
    const channel = makeChannel({ id: 'ch-1' })

    let state = ChannelReducer(getInitialState(), setChannels({ channels: [channel] }))
    state = ChannelReducer(state, addChannel({ channel }))

    expect(state.channels.length).toBe(1)
  })
})

describe('channel reducer - addChannels', () => {
  it('adds multiple new channels without duplicates', () => {
    const existing = makeChannel({ id: 'existing' })
    const new1 = makeChannel({ id: 'new-1' })
    const new2 = makeChannel({ id: 'new-2' })

    let state = ChannelReducer(getInitialState(), setChannels({ channels: [existing] }))
    state = ChannelReducer(state, addChannels({ channels: [existing, new1, new2] }))

    expect(state.channels.length).toBe(3)
    expect(state.channels.map((c) => c.id)).toContain('new-1')
    expect(state.channels.map((c) => c.id)).toContain('new-2')
  })
})

describe('channel reducer - removeChannel', () => {
  it('removes a channel by id', () => {
    const channel1 = makeChannel({ id: 'ch-1' })
    const channel2 = makeChannel({ id: 'ch-2' })

    let state = ChannelReducer(getInitialState(), setChannels({ channels: [channel1, channel2] }))
    state = ChannelReducer(state, removeChannel({ channelId: 'ch-1' }))

    expect(state.channels.length).toBe(1)
    expect(state.channels[0].id).toBe('ch-2')
  })

  it('does nothing if channel does not exist', () => {
    const channel = makeChannel({ id: 'ch-1' })

    let state = ChannelReducer(getInitialState(), setChannels({ channels: [channel] }))
    state = ChannelReducer(state, removeChannel({ channelId: 'non-existent' }))

    expect(state.channels.length).toBe(1)
  })
})

describe('channel reducer - updateChannelData', () => {
  it('updates channel data without moving position when moveUp is false', () => {
    const channel1 = makeChannelWithTime('ch-1', new Date('2026-04-01T12:00:00Z'))
    const channel2 = makeChannelWithTime('ch-2', new Date('2026-04-01T10:00:00Z'))

    let state = ChannelReducer(getInitialState(), setChannels({ channels: [channel1, channel2] }))
    state = ChannelReducer(state, updateChannelData({ channelId: 'ch-2', config: { subject: 'Updated' } }))

    // Order should remain the same
    expect(state.channels.map((c) => c.id)).toEqual(['ch-1', 'ch-2'])
    expect(state.channels[1].subject).toBe('Updated')
  })

  it('moves channel to top and sorts when moveUp is true', () => {
    const channel1 = makeChannelWithTime('ch-1', new Date('2026-04-01T12:00:00Z'))
    const channel2 = makeChannelWithTime('ch-2', new Date('2026-04-01T10:00:00Z'))
    const newestMessage = makeMessage({
      id: 'newest',
      channelId: 'ch-2',
      createdAt: new Date('2026-04-01T14:00:00Z')
    })

    let state = ChannelReducer(getInitialState(), setChannels({ channels: [channel1, channel2] }))
    state = ChannelReducer(
      state,
      updateChannelData({
        channelId: 'ch-2',
        config: { lastMessage: newestMessage },
        moveUp: true
      })
    )

    // ch-2 should now be first due to newer lastMessage
    expect(state.channels.map((c) => c.id)).toEqual(['ch-2', 'ch-1'])
  })

  it('sorts channels when sort option is true', () => {
    const channel1 = makeChannelWithTime('ch-1', new Date('2026-04-01T12:00:00Z'))
    const channel2 = makeChannelWithTime('ch-2', new Date('2026-04-01T10:00:00Z'))

    let state = ChannelReducer(getInitialState(), setChannels({ channels: [channel1, channel2] }))

    // Update ch-2 with a newer message and sort
    const newerMessage = makeMessage({
      id: 'newer',
      channelId: 'ch-2',
      createdAt: new Date('2026-04-01T14:00:00Z')
    })
    state = ChannelReducer(
      state,
      updateChannelData({
        channelId: 'ch-2',
        config: { lastMessage: newerMessage },
        sort: true
      })
    )

    expect(state.channels.map((c) => c.id)).toEqual(['ch-2', 'ch-1'])
  })

  it('updates activeChannel if it matches the updated channel', () => {
    const channel = makeChannel({ id: 'ch-1', subject: 'Original' })

    let state = ChannelReducer(getInitialState(), setChannels({ channels: [channel] }))
    state = ChannelReducer(state, setActiveChannel({ channel }))
    state = ChannelReducer(state, updateChannelData({ channelId: 'ch-1', config: { subject: 'Updated' } }))

    expect((state.activeChannel as IChannel).subject).toBe('Updated')
  })

  it('updates unread and mention counts', () => {
    const channel = makeChannel({ id: 'ch-1', newMessageCount: 0, newMentionCount: 0 })

    let state = ChannelReducer(getInitialState(), setChannels({ channels: [channel] }))
    state = ChannelReducer(
      state,
      updateChannelData({
        channelId: 'ch-1',
        config: { newMessageCount: 5, newMentionCount: 2, unread: true }
      })
    )

    expect(state.channels[0].newMessageCount).toBe(5)
    expect(state.channels[0].newMentionCount).toBe(2)
    expect(state.channels[0].unread).toBe(true)
  })

  it('adds new channel when add option is true and channel does not exist', () => {
    const existingChannel = makeChannel({ id: 'existing' })
    const newChannelConfig = { id: 'new', subject: 'New Channel' }

    let state = ChannelReducer(getInitialState(), setChannels({ channels: [existingChannel] }))
    state = ChannelReducer(
      state,
      updateChannelData({
        channelId: 'new',
        config: newChannelConfig,
        moveUp: true,
        add: true
      })
    )

    expect(state.channels.length).toBe(2)
    expect(state.channels.find((c) => c.id === 'new')).toBeDefined()
  })
})

describe('channel reducer - pin/unpin ordering', () => {
  it('pinning a channel moves it to the top of the list', () => {
    const channel1 = makeChannelWithTime('ch-1', new Date('2026-04-01T12:00:00Z'))
    const channel2 = makeChannelWithTime('ch-2', new Date('2026-04-01T10:00:00Z'))

    let state = ChannelReducer(getInitialState(), setChannels({ channels: [channel1, channel2] }))

    // Pin channel2
    state = ChannelReducer(
      state,
      updateChannelData({
        channelId: 'ch-2',
        config: { pinnedAt: new Date('2026-04-01T14:00:00Z') },
        sort: true
      })
    )

    // ch-2 should now be first
    expect(state.channels.map((c) => c.id)).toEqual(['ch-2', 'ch-1'])
  })

  it('unpinning a channel moves it back based on lastMessage time', () => {
    const pinnedChannel = makeChannelWithTime('pinned', new Date('2026-04-01T08:00:00Z'), {
      pinnedAt: new Date('2026-04-01T14:00:00Z')
    })
    const unpinnedChannel = makeChannelWithTime('unpinned', new Date('2026-04-01T12:00:00Z'))

    let state = ChannelReducer(getInitialState(), setChannels({ channels: [pinnedChannel, unpinnedChannel] }))
    expect(state.channels.map((c) => c.id)).toEqual(['pinned', 'unpinned'])

    // Unpin the pinned channel
    state = ChannelReducer(
      state,
      updateChannelData({
        channelId: 'pinned',
        config: { pinnedAt: null },
        sort: true
      })
    )

    // unpinned has newer lastMessage, so it should be first now
    expect(state.channels.map((c) => c.id)).toEqual(['unpinned', 'pinned'])
  })
})

describe('channel reducer - hide/unhide', () => {
  it('setChannelToHide sets hiddenChannel', () => {
    const channel = makeChannel({ id: 'ch-1' })

    const state = ChannelReducer(getInitialState(), setChannelToHide({ channel }))

    expect(state.hiddenChannel).toEqual(channel)
  })

  it('setChannelToHide with null clears hiddenChannel', () => {
    const channel = makeChannel({ id: 'ch-1' })

    let state = ChannelReducer(getInitialState(), setChannelToHide({ channel }))
    state = ChannelReducer(state, setChannelToHide({ channel: null }))

    expect(state.hiddenChannel).toBeNull()
  })

  it('setChannelToUnhide sets visibleChannel', () => {
    const channel = makeChannel({ id: 'ch-1' })

    const state = ChannelReducer(getInitialState(), setChannelToUnhide({ channel }))

    expect(state.visibleChannel).toEqual(channel)
  })
})

describe('channel reducer - updateChannelLastMessage', () => {
  it('updates lastMessage and reorders channel to top', () => {
    const channel1 = makeChannelWithTime('ch-1', new Date('2026-04-01T12:00:00Z'))
    const channel2 = makeChannelWithTime('ch-2', new Date('2026-04-01T10:00:00Z'))
    const newMessage = makeMessage({
      id: 'new-msg',
      channelId: 'ch-2',
      createdAt: new Date('2026-04-01T14:00:00Z')
    })

    let state = ChannelReducer(getInitialState(), setChannels({ channels: [channel1, channel2] }))
    state = ChannelReducer(state, updateChannelLastMessage({ channel: channel2, message: newMessage }))

    expect(state.channels.map((c) => c.id)).toEqual(['ch-2', 'ch-1'])
    expect(state.channels[0].lastMessage.id).toBe('new-msg')
  })

  it('updates deleted lastMessage in place without reordering', () => {
    const lastMsg = makeMessage({ id: 'last-msg', channelId: 'ch-1', body: 'Hello' })
    const channel = makeChannel({ id: 'ch-1', lastMessage: lastMsg })
    const deletedMsg: IMessage = {
      ...lastMsg,
      state: MESSAGE_STATUS.DELETE,
      body: ''
    }

    let state = ChannelReducer(getInitialState(), setChannels({ channels: [channel] }))
    state = ChannelReducer(state, updateChannelLastMessage({ channel, message: deletedMsg }))

    expect(state.channels[0].lastMessage.state).toBe(MESSAGE_STATUS.DELETE)
    expect(state.channels[0].lastMessage.body).toBe('')
  })

  it('updates edited lastMessage in place', () => {
    const lastMsg = makeMessage({ id: 'last-msg', channelId: 'ch-1', body: 'Hello' })
    const channel = makeChannel({ id: 'ch-1', lastMessage: lastMsg })
    const editedMsg: IMessage = {
      ...lastMsg,
      state: MESSAGE_STATUS.EDIT,
      body: 'Hello edited'
    }

    let state = ChannelReducer(getInitialState(), setChannels({ channels: [channel] }))
    state = ChannelReducer(state, updateChannelLastMessage({ channel, message: editedMsg }))

    expect(state.channels[0].lastMessage.state).toBe(MESSAGE_STATUS.EDIT)
    expect(state.channels[0].lastMessage.body).toBe('Hello edited')
  })

  it('updates activeChannel when its lastMessage changes', () => {
    const lastMsg = makeMessage({ id: 'last-msg', channelId: 'ch-1', body: 'Hello' })
    const channel = makeChannel({ id: 'ch-1', lastMessage: lastMsg })
    const newMessage = makeMessage({
      id: 'new-msg',
      channelId: 'ch-1',
      body: 'New message',
      createdAt: new Date('2026-04-01T14:00:00Z')
    })

    let state = ChannelReducer(getInitialState(), setChannels({ channels: [channel] }))
    state = ChannelReducer(state, setActiveChannel({ channel }))
    state = ChannelReducer(state, updateChannelLastMessage({ channel, message: newMessage }))

    expect((state.activeChannel as IChannel).lastMessage.id).toBe('new-msg')
  })
})

describe('channel reducer - updateChannelLastMessageStatus', () => {
  it('updates delivery status of last message', () => {
    const lastMsg = makeMessage({
      id: 'last-msg',
      channelId: 'ch-1',
      deliveryStatus: MESSAGE_DELIVERY_STATUS.SENT
    })
    const channel = makeChannel({ id: 'ch-1', lastMessage: lastMsg })
    const updatedMsg: IMessage = {
      ...lastMsg,
      deliveryStatus: MESSAGE_DELIVERY_STATUS.READ,
      userMarkers: [{ name: 'displayed', count: 1 }] as any,
      markerTotals: [{ name: 'displayed', count: 1 }] as any
    }

    let state = ChannelReducer(getInitialState(), setChannels({ channels: [channel] }))
    state = ChannelReducer(state, updateChannelLastMessageStatus({ channel, message: updatedMsg }))

    expect(state.channels[0].lastMessage.deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.READ)
  })
})

describe('channel reducer - searched channels sync', () => {
  it('setSearchedChannels sets searched channels', () => {
    const chatsGroups = [makeChannel({ id: 'chat-1' })]
    const channels = [makeChannel({ id: 'public-1' })]
    const contacts = [{ id: 'contact-1', firstName: 'John' }] as any

    const state = ChannelReducer(
      getInitialState(),
      setSearchedChannels({
        searchedChannels: { chats_groups: chatsGroups, channels, contacts }
      })
    )

    expect(state.searchedChannels.chats_groups.length).toBe(1)
    expect(state.searchedChannels.channels.length).toBe(1)
    expect(state.searchedChannels.contacts.length).toBe(1)
  })

  it('updateSearchedChannelData updates a specific searched channel', () => {
    const channel = makeChannel({ id: 'chat-1', subject: 'Original' })

    let state = ChannelReducer(
      getInitialState(),
      setSearchedChannels({
        searchedChannels: { chats_groups: [channel], channels: [], contacts: [] }
      })
    )

    state = ChannelReducer(
      state,
      updateSearchedChannelData({
        channelId: 'chat-1',
        groupName: 'chats_groups',
        updateData: { subject: 'Updated', newMessageCount: 3 }
      })
    )

    expect(state.searchedChannels.chats_groups[0].subject).toBe('Updated')
    expect(state.searchedChannels.chats_groups[0].newMessageCount).toBe(3)
  })

  it('updateMessage syncs parent snapshots across searchedChannels', () => {
    const parentMessage = makeMessage({ id: 'parent-msg', body: 'Original body' })
    const lastMessage = makeMessage({
      id: 'reply-msg',
      parentMessage,
      parentId: parentMessage.id
    })
    const channel = makeChannel({ id: 'ch-1', lastMessage })

    let state = ChannelReducer(
      getInitialState(),
      setSearchedChannels({
        searchedChannels: { chats_groups: [channel], channels: [], contacts: [] }
      })
    )

    state = ChannelReducer(
      state,
      updateMessage({
        messageId: 'parent-msg',
        params: { state: MESSAGE_STATUS.DELETE, body: '' } as any
      })
    )

    expect(state.searchedChannels.chats_groups[0].lastMessage.parentMessage?.state).toBe(MESSAGE_STATUS.DELETE)
  })
})

describe('channel reducer - typing/recording indicators', () => {
  it('switchTypingIndicator sets typing state for a user in a channel', () => {
    const user = makeUser({ id: 'user-1' })

    const state = ChannelReducer(
      getInitialState(),
      switchTypingIndicator({ typingState: true, channelId: 'ch-1', from: user })
    )

    expect(state.typingOrRecordingIndicator['ch-1']['user-1'].typingState).toBe(true)
    expect(state.typingOrRecordingIndicator['ch-1']['user-1'].from).toEqual(user)
  })

  it('switchTypingIndicator can clear typing state', () => {
    const user = makeUser({ id: 'user-1' })

    let state = ChannelReducer(
      getInitialState(),
      switchTypingIndicator({ typingState: true, channelId: 'ch-1', from: user })
    )
    state = ChannelReducer(state, switchTypingIndicator({ typingState: false, channelId: 'ch-1', from: user }))

    expect(state.typingOrRecordingIndicator['ch-1']['user-1'].typingState).toBe(false)
  })

  it('switchRecordingIndicator sets recording state', () => {
    const user = makeUser({ id: 'user-1' })

    const state = ChannelReducer(
      getInitialState(),
      switchRecordingIndicator({ recordingState: true, channelId: 'ch-1', from: user })
    )

    expect(state.typingOrRecordingIndicator['ch-1']['user-1'].recordingState).toBe(true)
  })
})

describe('channel reducer - loading states', () => {
  it('setChannelsLoadingState sets loading state', () => {
    const state = ChannelReducer(getInitialState(), setChannelsLoadingState({ state: LOADING_STATE.LOADING }))

    expect(state.channelsLoadingState).toBe(LOADING_STATE.LOADING)
  })

  it('setChannelsLoadingState with forForward sets forForward loading state', () => {
    const state = ChannelReducer(
      getInitialState(),
      setChannelsLoadingState({ state: LOADING_STATE.LOADING, forForward: true })
    )

    expect(state.channelsForForwardLoadingState).toBe(LOADING_STATE.LOADING)
  })

  it('setChannelsHasNext sets hasNext flag', () => {
    const state = ChannelReducer(getInitialState(), setChannelsHasNext({ hasNext: false }))

    expect(state.channelsHasNext).toBe(false)
  })

  it('setChannelsHasNext with forForward sets forForward hasNext flag', () => {
    const state = ChannelReducer(getInitialState(), setChannelsHasNext({ hasNext: false, forForward: true }))

    expect(state.channelsForForwardHasNext).toBe(false)
  })
})

describe('channel reducer - active channel', () => {
  it('setActiveChannel sets the active channel', () => {
    const channel = makeChannel({ id: 'ch-1' })

    const state = ChannelReducer(getInitialState(), setActiveChannel({ channel }))

    expect((state.activeChannel as IChannel).id).toBe('ch-1')
    expect(state.messageSearchIsOpen).toBe(false)
  })

  it('setActiveChannel with empty object clears active channel', () => {
    const channel = makeChannel({ id: 'ch-1' })

    let state = ChannelReducer(getInitialState(), setActiveChannel({ channel }))
    state = ChannelReducer(state, setActiveChannel({ channel: {} }))

    expect(Object.keys(state.activeChannel).length).toBe(0)
  })
})

describe('channel reducer - notification channels', () => {
  it('setChannelToAdd sets addedChannel', () => {
    const channel = makeChannel({ id: 'ch-1' })

    const state = ChannelReducer(getInitialState(), setChannelToAdd({ channel }))

    expect(state.addedChannel).toEqual(channel)
  })

  it('setAddedToChannel sets addedToChannel', () => {
    const channel = makeChannel({ id: 'ch-1' })

    const state = ChannelReducer(getInitialState(), setAddedToChannel({ channel }))

    expect(state.addedToChannel).toEqual(channel)
  })

  it('setChannelToRemove sets deletedChannel', () => {
    const channel = makeChannel({ id: 'ch-1' })

    const state = ChannelReducer(getInitialState(), setChannelToRemove({ channel }))

    expect(state.deletedChannel).toEqual(channel)
  })
})

describe('channel reducer - UI state', () => {
  it('setChannelInfoOpenClose toggles channel info panel', () => {
    let state = ChannelReducer(getInitialState(), setChannelInfoOpenClose({ open: true }))
    expect(state.channelInfoIsOpen).toBe(true)

    state = ChannelReducer(state, setChannelInfoOpenClose({ open: false }))
    expect(state.channelInfoIsOpen).toBe(false)
  })

  it('setMessageSearchOpenClose toggles message search panel', () => {
    let state = ChannelReducer(getInitialState(), setMessageSearchOpenClose({ open: true }))
    expect(state.messageSearchIsOpen).toBe(true)

    state = ChannelReducer(state, setMessageSearchOpenClose({ open: false }))
    expect(state.messageSearchIsOpen).toBe(false)
  })

  it('toggleEditChannel sets channel edit mode', () => {
    let state = ChannelReducer(getInitialState(), toggleEditChannel({ state: true }))
    expect(state.channelEditMode).toBe(true)

    state = ChannelReducer(state, toggleEditChannel({ state: false }))
    expect(state.channelEditMode).toBe(false)
  })

  it('setChannelListWidth sets width', () => {
    const state = ChannelReducer(getInitialState(), setChannelListWidth({ width: 300 }))

    expect(state.channelListWidth).toBe(300)
  })

  it('setHideChannelList hides/shows channel list', () => {
    let state = ChannelReducer(getInitialState(), setHideChannelList({ hide: true }))
    expect(state.hideChannelList).toBe(true)

    state = ChannelReducer(state, setHideChannelList({ hide: false }))
    expect(state.hideChannelList).toBe(false)
  })
})

describe('channel reducer - drag and drop', () => {
  it('setIsDragging sets dragging state', () => {
    let state = ChannelReducer(getInitialState(), setIsDragging({ isDragging: true }))
    expect(state.isDragging).toBe(true)

    state = ChannelReducer(state, setIsDragging({ isDragging: false }))
    expect(state.isDragging).toBe(false)
  })

  it('setDraggedAttachments sets attachments', () => {
    const attachments = [
      { data: 'data1', name: 'file1.txt', type: 'text/plain' },
      { data: 'data2', name: 'file2.jpg', type: 'image/jpeg' }
    ]

    const state = ChannelReducer(getInitialState(), setDraggedAttachments({ attachments, type: 'file' }))

    expect(state.draggedAttachments.length).toBe(2)
    expect(state.draggedAttachments[0].attachmentType).toBe('file')
  })

  it('setDraggedAttachments with empty array clears attachments', () => {
    const attachments = [{ data: 'data1', name: 'file1.txt', type: 'text/plain' }]

    let state = ChannelReducer(getInitialState(), setDraggedAttachments({ attachments, type: 'file' }))
    state = ChannelReducer(state, setDraggedAttachments({ attachments: [], type: 'file' }))

    expect(state.draggedAttachments.length).toBe(0)
  })
})

describe('channel reducer - drafts', () => {
  it('setDraftIsRemoved sets the channel id', () => {
    const state = ChannelReducer(getInitialState(), setDraftIsRemoved({ channelId: 'ch-1' }))

    expect(state.draftIsRemoved).toBe('ch-1')
  })
})

describe('channel reducer - invite keys', () => {
  it('setChannelInviteKeys sets invite keys for a channel', () => {
    const inviteKeys = [{ key: 'abc123', maxUses: 10, expiresAt: Date.now() + 86400000, accessPriorHistory: true }]

    const state = ChannelReducer(getInitialState(), setChannelInviteKeys({ channelId: 'ch-1', inviteKeys }))

    expect(state.channelInviteKeys['ch-1']).toEqual(inviteKeys)
  })

  it('setJoinableChannel sets joinable channel', () => {
    const channel = makeChannel({ id: 'join-ch' })

    const state = ChannelReducer(getInitialState(), setJoinableChannel({ channel }))

    expect(state.joinableChannel).toEqual(channel)
  })

  it('setChannelInviteKeyAvailable sets availability', () => {
    let state = ChannelReducer(getInitialState(), setChannelInviteKeyAvailable({ available: false }))
    expect(state.channelInviteKeyAvailable).toBe(false)

    state = ChannelReducer(state, setChannelInviteKeyAvailable({ available: true }))
    expect(state.channelInviteKeyAvailable).toBe(true)
  })
})

describe('channel reducer - mutual channels', () => {
  it('setMutualChannels appends channels', () => {
    const channels1 = [makeChannel({ id: 'mutual-1' })]
    const channels2 = [makeChannel({ id: 'mutual-2' })]

    let state = ChannelReducer(getInitialState(), setMutualChannels({ channels: channels1 }))
    state = ChannelReducer(state, setMutualChannels({ channels: channels2 }))

    expect(state.mutualChannels.length).toBe(2)
  })

  it('setMutualChannels with empty array clears the list', () => {
    const channels = [makeChannel({ id: 'mutual-1' })]

    let state = ChannelReducer(getInitialState(), setMutualChannels({ channels }))
    state = ChannelReducer(state, setMutualChannels({ channels: [] }))

    expect(state.mutualChannels.length).toBe(0)
  })

  it('setMutualChannelsHasNext sets hasNext', () => {
    const state = ChannelReducer(getInitialState(), setMutualChannelsHasNext({ hasNext: true }))

    expect(state.mutualChannelsHasNext).toBe(true)
  })

  it('setMutualChannelsLoadingState sets loading state', () => {
    const state = ChannelReducer(getInitialState(), setMutualChannelsLoadingState({ state: LOADING_STATE.LOADING }))

    expect(state.mutualChannelsLoadingState).toBe(LOADING_STATE.LOADING)
  })
})

describe('channel reducer - channels for forward', () => {
  it('setChannelsForForward sets forward channels', () => {
    const channels = [makeChannel({ id: 'fwd-1' }), makeChannel({ id: 'fwd-2' })]

    const state = ChannelReducer(getInitialState(), setChannelsForForward({ channels }))

    expect(state.channelsForForward.length).toBe(2)
  })

  it('addChannelsForForward appends channels', () => {
    const channels1 = [makeChannel({ id: 'fwd-1' })]
    const channels2 = [makeChannel({ id: 'fwd-2' })]

    let state = ChannelReducer(getInitialState(), setChannelsForForward({ channels: channels1 }))
    state = ChannelReducer(state, addChannelsForForward({ channels: channels2 }))

    expect(state.channelsForForward.length).toBe(2)
  })

  it('setSearchedChannelsForForward sets searched forward channels', () => {
    const searchedChannels = {
      chats_groups: [makeChannel({ id: 'chat-1' })],
      channels: [],
      contacts: []
    }

    const state = ChannelReducer(getInitialState(), setSearchedChannelsForForward({ searchedChannels }))

    expect(state.searchedChannelsForForward.chats_groups.length).toBe(1)
  })
})

describe('channel reducer - search', () => {
  it('setCloseSearchChannels sets close flag', () => {
    let state = ChannelReducer(getInitialState(), setCloseSearchChannels({ close: true }))
    expect(state.closeSearchChannel).toBe(true)

    state = ChannelReducer(state, setCloseSearchChannels({ close: false }))
    expect(state.closeSearchChannel).toBe(false)
  })

  it('getChannels sets search value', () => {
    const state = ChannelReducer(getInitialState(), getChannels({ params: { search: 'test query' } }))

    expect(state.searchValue).toBe('test query')
  })
})

describe('channel reducer - extraReducers', () => {
  it('DESTROY_SESSION resets state but preserves channelListWidth', () => {
    const channel = makeChannel({ id: 'ch-1' })

    let state = ChannelReducer(getInitialState(), setChannels({ channels: [channel] }))
    state = ChannelReducer(state, setChannelListWidth({ width: 350 }))
    state = ChannelReducer(state, { type: 'DESTROY_SESSION' } as any)

    expect(state.channels.length).toBe(0)
    expect(state.channelListWidth).toBe(350)
  })

  it('updateMessage syncs parent snapshots in channels', () => {
    const parentMessage = makeMessage({ id: 'parent-msg', body: 'Original body' })
    const lastMessage = makeMessage({
      id: 'reply-msg',
      parentMessage,
      parentId: parentMessage.id
    })
    const channel = makeChannel({ id: 'ch-1', lastMessage })

    let state = ChannelReducer(getInitialState(), setChannels({ channels: [channel] }))
    state = ChannelReducer(
      state,
      updateMessage({
        messageId: 'parent-msg',
        params: { state: MESSAGE_STATUS.DELETE, body: '' } as any
      })
    )

    expect(state.channels[0].lastMessage.parentMessage?.state).toBe(MESSAGE_STATUS.DELETE)
  })

  it('updateMessage syncs parent snapshots in activeChannel', () => {
    const parentMessage = makeMessage({ id: 'parent-msg', body: 'Original' })
    const lastMessage = makeMessage({
      id: 'reply-msg',
      parentMessage,
      parentId: parentMessage.id
    })
    const channel = makeChannel({ id: 'ch-1', lastMessage })

    let state = ChannelReducer(getInitialState(), setChannels({ channels: [channel] }))
    state = ChannelReducer(state, setActiveChannel({ channel }))
    state = ChannelReducer(
      state,
      updateMessage({
        messageId: 'parent-msg',
        params: { state: MESSAGE_STATUS.EDIT, body: 'Edited' } as any
      })
    )

    expect((state.activeChannel as IChannel).lastMessage.parentMessage?.body).toBe('Edited')
  })

  it('updateMessage syncs parent snapshots in channelsForForward', () => {
    const parentMessage = makeMessage({ id: 'parent-msg', body: 'Original' })
    const lastMessage = makeMessage({
      id: 'reply-msg',
      parentMessage,
      parentId: parentMessage.id
    })
    const channel = makeChannel({ id: 'ch-1', lastMessage })

    let state = ChannelReducer(getInitialState(), setChannelsForForward({ channels: [channel] }))
    state = ChannelReducer(
      state,
      updateMessage({
        messageId: 'parent-msg',
        params: { state: MESSAGE_STATUS.DELETE, body: '' } as any
      })
    )

    expect(state.channelsForForward[0].lastMessage.parentMessage?.state).toBe(MESSAGE_STATUS.DELETE)
  })
})

describe('channel reducer - updateUserStatusOnChannel', () => {
  const { updateUserStatusOnChannel } = require('./reducers')

  it('updates user presence status in direct channels', () => {
    const currentUser = { ...makeUser({ id: 'current-user' }), role: 'owner' }
    const otherUser = { ...makeUser({ id: 'other-user' }), role: 'member' }
    const directChannel = makeChannel({
      id: 'direct-1',
      type: DEFAULT_CHANNEL_TYPE.DIRECT,
      members: [currentUser, otherUser]
    })

    let state = ChannelReducer(getInitialState(), setChannels({ channels: [directChannel] }))
    state = ChannelReducer(
      state,
      updateUserStatusOnChannel({
        usersMap: {
          'other-user': { ...otherUser, presence: { state: 'online', lastActiveAt: new Date() } } as any
        }
      })
    )

    const updatedMember = state.channels[0].members.find((m) => m.id === 'other-user')
    expect(updatedMember?.presence?.state).toBe('online')
  })

  it('updates activeChannel members if it is a direct channel', () => {
    const currentUser = { ...makeUser({ id: 'current-user' }), role: 'owner' }
    const otherUser = { ...makeUser({ id: 'other-user' }), role: 'member' }
    const directChannel = makeChannel({
      id: 'direct-1',
      type: DEFAULT_CHANNEL_TYPE.DIRECT,
      members: [currentUser, otherUser]
    })

    let state = ChannelReducer(getInitialState(), setChannels({ channels: [directChannel] }))
    state = ChannelReducer(state, setActiveChannel({ channel: directChannel }))
    state = ChannelReducer(
      state,
      updateUserStatusOnChannel({
        usersMap: {
          'other-user': { ...otherUser, presence: { state: 'online', lastActiveAt: new Date() } } as any
        }
      })
    )

    const activeMember = (state.activeChannel as IChannel).members.find((m) => m.id === 'other-user')
    expect(activeMember?.presence?.state).toBe('online')
  })

  it('does not update group channels (only direct)', () => {
    const currentUser = { ...makeUser({ id: 'current-user' }), role: 'owner' }
    const otherUser = { ...makeUser({ id: 'other-user' }), role: 'member' }
    const groupChannel = makeChannel({
      id: 'group-1',
      type: DEFAULT_CHANNEL_TYPE.GROUP,
      members: [currentUser, otherUser]
    })

    let state = ChannelReducer(getInitialState(), setChannels({ channels: [groupChannel] }))
    const originalMembers = state.channels[0].members
    state = ChannelReducer(
      state,
      updateUserStatusOnChannel({
        usersMap: {
          'other-user': { ...otherUser, presence: { state: 'online', lastActiveAt: new Date() } } as any
        }
      })
    )

    // Members should not have presence updated in group channels
    const updatedMember = state.channels[0].members.find((m) => m.id === 'other-user')
    expect(updatedMember?.presence).toBeUndefined()
    expect(state.channels[0].members).toEqual(originalMembers)
  })
})

describe('channel reducer - updateChannelsMembers', () => {
  it('updates member info across channels', () => {
    const member = { ...makeUser({ id: 'user-1', firstName: 'John' }), role: 'member' }
    const channel = makeChannel({
      id: 'ch-1',
      members: [member]
    })

    let state = ChannelReducer(getInitialState(), setChannels({ channels: [channel] }))
    state = ChannelReducer(
      state,
      updateChannelsMembers({
        members: [{ ...member, firstName: 'Johnny', presence: { state: 'online' } } as any]
      })
    )

    expect(state.channels[0].members[0].firstName).toBe('Johnny')
  })

  it('updates activeChannel members', () => {
    const currentUser = { ...makeUser({ id: 'current-user' }), role: 'owner' }
    const member = { ...makeUser({ id: 'user-1', firstName: 'John' }), role: 'member' }
    const channel = makeChannel({
      id: 'ch-1',
      members: [currentUser, member]
    })

    let state = ChannelReducer(getInitialState(), setChannels({ channels: [channel] }))
    state = ChannelReducer(state, setActiveChannel({ channel }))
    state = ChannelReducer(
      state,
      updateChannelsMembers({
        members: [{ ...member, firstName: 'Johnny' } as any]
      })
    )

    expect((state.activeChannel as IChannel).members.find((m) => m.id === 'user-1')?.firstName).toBe('Johnny')
  })
})

describe('channel last-message parent snapshots', () => {
  it('updates a PM last-message preview when its pinned source is deleted', () => {
    const channel: any = {
      id: 'channel-1',
      type: 'direct',
      lastMessage: {
        id: 'pin-system-message',
        body: 'PM',
        parentMessage: { id: 'pinned-source', body: 'Pinned text' }
      }
    }
    let state = ChannelReducer(undefined, setChannels({ channels: [channel] }))

    state = ChannelReducer(
      state,
      updateMessage({
        messageId: 'pinned-source',
        params: { state: MESSAGE_STATUS.DELETE, body: '' } as any
      })
    )

    expect(state.channels[0].lastMessage.parentMessage).toMatchObject({
      id: 'pinned-source',
      state: MESSAGE_STATUS.DELETE
    })
  })
})
