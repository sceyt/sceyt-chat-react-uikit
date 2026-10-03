import {
  makeChannel,
  makeUser,
  makeMember,
  makeMessage,
  resetMessageListFixtureIds
} from '../../testUtils/messageFixtures'
import { MESSAGE_DELIVERY_STATUS } from '../constants'
import {
  setChannelInMap,
  getChannelFromMap,
  removeChannelFromMap,
  setChannelsInMap,
  getLastChannelFromMap,
  updateChannelMemberInAllChannels,
  getPendingLastMessages,
  destroyChannelsMap,
  checkChannelExists,
  setActiveChannelId,
  getActiveChannelId,
  // Pending channel read helpers
  setPendingChannelRead,
  getPendingChannelRead,
  getPendingChannelReads,
  removePendingChannelRead,
  // Pending delete channel helpers
  setPendingDeleteChannel,
  getPendingDeleteChannel,
  getPendingDeleteChannels,
  removePendingDeleteChannel,
  // All-channels list helpers
  addChannelsToAllChannels,
  addChannelToAllChannels,
  getAllChannels,
  getChannelFromAllChannels,
  getChannelFromAllChannelsMap,
  deleteChannelFromAllChannels,
  updateChannelLastMessageOnAllChannels,
  updateChannelOnAllChannels,
  // Sorting
  sortChannelByLastMessage
} from './index'

describe('channelHalper', () => {
  beforeEach(() => {
    destroyChannelsMap()
    resetMessageListFixtureIds()
  })

  afterEach(() => {
    destroyChannelsMap()
  })

  describe('setChannelInMap / getChannelFromMap', () => {
    it('stores a channel and retrieves it by id', () => {
      const channel = makeChannel({ id: 'channel-1' })
      setChannelInMap(channel)

      const retrieved = getChannelFromMap('channel-1')
      expect(retrieved).toBeDefined()
      expect(retrieved.id).toBe('channel-1')
    })

    it('stores a copy, not a reference', () => {
      const channel = makeChannel({ id: 'channel-2' })
      setChannelInMap(channel)

      const retrieved = getChannelFromMap('channel-2')
      expect(retrieved).not.toBe(channel)
      expect(retrieved.id).toBe(channel.id)
    })

    it('overwrites existing channel with same id', () => {
      const channel1 = makeChannel({ id: 'channel-1', subject: 'First' })
      const channel2 = makeChannel({ id: 'channel-1', subject: 'Second' })

      setChannelInMap(channel1)
      setChannelInMap(channel2)

      const retrieved = getChannelFromMap('channel-1')
      expect(retrieved.subject).toBe('Second')
    })

    it('returns undefined for unknown channel id', () => {
      const result = getChannelFromMap('non-existent')
      expect(result).toBeUndefined()
    })
  })

  describe('removeChannelFromMap', () => {
    it('removes a channel from the map', () => {
      const channel = makeChannel({ id: 'channel-to-remove' })
      setChannelInMap(channel)

      expect(getChannelFromMap('channel-to-remove')).toBeDefined()

      removeChannelFromMap('channel-to-remove')

      expect(getChannelFromMap('channel-to-remove')).toBeUndefined()
    })

    it('does not throw when removing non-existent channel', () => {
      expect(() => removeChannelFromMap('non-existent')).not.toThrow()
    })

    it('also removes from allChannelsMap and pendingChannelReadMap', () => {
      const channel = makeChannel({ id: 'channel-with-read' })
      setChannelInMap(channel)
      setPendingChannelRead({ channelId: 'channel-with-read', messageIds: ['msg-1'] })

      expect(getPendingChannelRead('channel-with-read')).toBeDefined()

      removeChannelFromMap('channel-with-read')

      expect(getChannelFromAllChannelsMap('channel-with-read')).toBeUndefined()
      expect(getPendingChannelRead('channel-with-read')).toBeUndefined()
    })
  })

  describe('checkChannelExists', () => {
    it('returns true for existing channel', () => {
      const channel = makeChannel({ id: 'existing-channel' })
      setChannelInMap(channel)

      expect(checkChannelExists('existing-channel')).toBe(true)
    })

    it('returns false for non-existing channel', () => {
      expect(checkChannelExists('non-existent')).toBe(false)
    })
  })

  describe('setChannelsInMap', () => {
    it('stores multiple channels at once', () => {
      const channels = [makeChannel({ id: 'ch-1' }), makeChannel({ id: 'ch-2' }), makeChannel({ id: 'ch-3' })]

      setChannelsInMap(channels)

      expect(getChannelFromMap('ch-1')).toBeDefined()
      expect(getChannelFromMap('ch-2')).toBeDefined()
      expect(getChannelFromMap('ch-3')).toBeDefined()
    })

    it('parses JSON metadata', () => {
      const channel = makeChannel({ id: 'ch-meta', metadata: '{"key": "value"}' })

      const result = setChannelsInMap([channel])

      expect(result.channels[0].metadata).toEqual({ key: 'value' })
    })

    it('keeps non-JSON metadata as-is', () => {
      const channel = makeChannel({ id: 'ch-meta-plain', metadata: 'plain-string' })

      const result = setChannelsInMap([channel])

      expect(result.channels[0].metadata).toBe('plain-string')
    })

    it('returns channels needing lastReactedMessage update', () => {
      // @ts-expect-error - minimal reaction mock for testing
      const reactions = [{ id: '200' }]
      const channel = makeChannel({
        id: 'ch-reaction',
        lastMessage: makeMessage({ id: '100' }),
        newReactions: reactions
      })

      const result = setChannelsInMap([channel])

      expect(result.channelsForUpdateLastReactionMessage).toHaveLength(1)
      expect(result.channelsForUpdateLastReactionMessage[0].id).toBe('ch-reaction')
    })

    it('does not flag channel if lastMessage >= newReactions', () => {
      // @ts-expect-error - minimal reaction mock for testing
      const reactions = [{ id: '200' }]
      const channel = makeChannel({
        id: 'ch-no-reaction',
        lastMessage: makeMessage({ id: '300' }),
        newReactions: reactions
      })

      const result = setChannelsInMap([channel])

      expect(result.channelsForUpdateLastReactionMessage).toHaveLength(0)
    })
  })

  describe('getLastChannelFromMap', () => {
    it('returns the first channel from the map when deletePending is false', () => {
      const channel1 = makeChannel({ id: 'first-channel' })
      const channel2 = makeChannel({ id: 'second-channel' })

      setChannelInMap(channel1)
      setChannelInMap(channel2)

      const result = getLastChannelFromMap(false)
      // Object.values returns in insertion order
      expect(result?.id).toBe('first-channel')
    })

    it('returns undefined when map is empty', () => {
      const result = getLastChannelFromMap()
      expect(result).toBeUndefined()
    })

    it('skips channels with pending delete when deletePending is true', () => {
      const channel1 = makeChannel({ id: 'pending-delete-channel' })
      const channel2 = makeChannel({ id: 'normal-channel' })

      setChannelInMap(channel1)
      setChannelInMap(channel2)
      setPendingDeleteChannel(channel1)

      const result = getLastChannelFromMap(true)
      expect(result?.id).toBe('normal-channel')
    })

    it('returns undefined when all channels are pending delete', () => {
      const channel1 = makeChannel({ id: 'delete-1' })
      const channel2 = makeChannel({ id: 'delete-2' })

      setChannelInMap(channel1)
      setChannelInMap(channel2)
      setPendingDeleteChannel(channel1)
      setPendingDeleteChannel(channel2)

      const result = getLastChannelFromMap(true)
      expect(result).toBeUndefined()
    })

    it('returns first channel without checking pending when deletePending is false', () => {
      const channel1 = makeChannel({ id: 'pending-but-ignored' })
      const channel2 = makeChannel({ id: 'second' })

      setChannelInMap(channel1)
      setChannelInMap(channel2)
      setPendingDeleteChannel(channel1)

      const result = getLastChannelFromMap(false)
      expect(result?.id).toBe('pending-but-ignored')
    })
  })

  describe('getPendingLastMessages', () => {
    it('returns empty object when no channels have pending messages', () => {
      const channel = makeChannel({
        id: 'ch-1',
        lastMessage: makeMessage({ id: '123' })
      })
      setChannelInMap(channel)

      const result = getPendingLastMessages()
      expect(Object.keys(result)).toHaveLength(0)
    })

    it('returns channels with pending (no id) last messages', () => {
      const pendingMessage = makeMessage({ id: '', tid: 'tid-1' })
      const channel = makeChannel({
        id: 'ch-pending',
        lastMessage: pendingMessage
      })
      setChannelInMap(channel)

      const result = getPendingLastMessages()
      expect(result['ch-pending']).toBeDefined()
      expect(result['ch-pending'].tid).toBe('tid-1')
    })

    it('returns multiple pending messages from different channels', () => {
      const channel1 = makeChannel({
        id: 'ch-1',
        lastMessage: makeMessage({ id: '', tid: 'tid-1' })
      })
      const channel2 = makeChannel({
        id: 'ch-2',
        lastMessage: makeMessage({ id: '', tid: 'tid-2' })
      })
      const channel3 = makeChannel({
        id: 'ch-3',
        lastMessage: makeMessage({ id: '123' }) // Has ID, not pending
      })

      setChannelInMap(channel1)
      setChannelInMap(channel2)
      setChannelInMap(channel3)

      const result = getPendingLastMessages()
      expect(Object.keys(result)).toHaveLength(2)
      expect(result['ch-1']).toBeDefined()
      expect(result['ch-2']).toBeDefined()
      expect(result['ch-3']).toBeUndefined()
    })
  })

  describe('destroyChannelsMap', () => {
    it('clears all channel maps and related state', () => {
      const channel = makeChannel({ id: 'ch-1' })
      setChannelInMap(channel)
      addChannelToAllChannels(channel)
      setPendingDeleteChannel(channel)
      setPendingChannelRead({ channelId: 'ch-1', messageIds: ['msg-1'] })

      destroyChannelsMap()

      expect(getChannelFromMap('ch-1')).toBeUndefined()
      expect(getAllChannels()).toHaveLength(0)
      expect(getPendingDeleteChannel('ch-1')).toBeUndefined()
      expect(getPendingChannelRead('ch-1')).toBeUndefined()
    })

    it('can be called multiple times safely', () => {
      destroyChannelsMap()
      destroyChannelsMap()
      expect(getAllChannels()).toHaveLength(0)
    })
  })

  describe('activeChannelId', () => {
    it('sets and gets active channel id', () => {
      setActiveChannelId('active-channel')
      expect(getActiveChannelId()).toBe('active-channel')
    })

    it('overwrites previous active channel id', () => {
      setActiveChannelId('first')
      setActiveChannelId('second')
      expect(getActiveChannelId()).toBe('second')
    })
  })

  describe('updateChannelMemberInAllChannels', () => {
    it('updates member across all maps when member exists', () => {
      const user = makeUser({ id: 'user-1', firstName: 'John' })
      const member = makeMember(user, 'member')
      const channel = makeChannel({ id: 'ch-1', members: [member] })

      setChannelInMap(channel)
      addChannelToAllChannels(channel)

      const updatedUser = makeUser({ id: 'user-1', firstName: 'Jane', blocked: true })
      updateChannelMemberInAllChannels([updatedUser])

      // Check channelsMap
      const updatedChannelFromMap = getChannelFromMap('ch-1')
      expect(updatedChannelFromMap.members[0].firstName).toBe('Jane')
      expect(updatedChannelFromMap.members[0].blocked).toBe(true)

      // Check allChannels
      const allCh = getAllChannels()
      expect(allCh[0].members[0].firstName).toBe('Jane')
    })

    it('updates member in multiple channels at once', () => {
      const user = makeUser({ id: 'shared-user', firstName: 'Shared' })
      const member = makeMember(user, 'member')

      const channel1 = makeChannel({ id: 'ch-1', members: [member] })
      const channel2 = makeChannel({ id: 'ch-2', members: [member] })
      const channel3 = makeChannel({
        id: 'ch-3',
        members: [makeMember(makeUser({ id: 'other-user' }), 'member')]
      })

      setChannelInMap(channel1)
      setChannelInMap(channel2)
      setChannelInMap(channel3)
      addChannelToAllChannels(channel1)
      addChannelToAllChannels(channel2)
      addChannelToAllChannels(channel3)

      const updatedUser = makeUser({ id: 'shared-user', firstName: 'Updated' })
      updateChannelMemberInAllChannels([updatedUser])

      expect(getChannelFromMap('ch-1').members[0].firstName).toBe('Updated')
      expect(getChannelFromMap('ch-2').members[0].firstName).toBe('Updated')
      expect(getChannelFromMap('ch-3').members[0].firstName).toBe('User other-user')
    })

    it('does nothing when member is not found in any channel', () => {
      const user = makeUser({ id: 'existing-user', firstName: 'Original' })
      const member = makeMember(user, 'member')
      const channel = makeChannel({ id: 'ch-1', members: [member] })

      setChannelInMap(channel)

      const nonExistentUser = makeUser({ id: 'non-existent-user', firstName: 'Nobody' })
      updateChannelMemberInAllChannels([nonExistentUser])

      expect(getChannelFromMap('ch-1').members[0].firstName).toBe('Original')
    })

    it('handles channels with no members gracefully', () => {
      const channel = makeChannel({ id: 'ch-no-members', members: [] })
      setChannelInMap(channel)

      const user = makeUser({ id: 'some-user' })

      // Should not throw
      expect(() => updateChannelMemberInAllChannels([user])).not.toThrow()
    })

    it('updates multiple members at once', () => {
      const user1 = makeUser({ id: 'user-1', firstName: 'User1' })
      const user2 = makeUser({ id: 'user-2', firstName: 'User2' })
      const channel = makeChannel({
        id: 'ch-multi',
        members: [makeMember(user1, 'member'), makeMember(user2, 'admin')]
      })

      setChannelInMap(channel)
      addChannelToAllChannels(channel)

      const updated1 = makeUser({ id: 'user-1', firstName: 'Updated1' })
      const updated2 = makeUser({ id: 'user-2', firstName: 'Updated2' })
      updateChannelMemberInAllChannels([updated1, updated2])

      const result = getChannelFromMap('ch-multi')
      expect(result.members[0].firstName).toBe('Updated1')
      expect(result.members[1].firstName).toBe('Updated2')
    })
  })

  describe('pending channel read helpers', () => {
    describe('setPendingChannelRead', () => {
      it('creates a new pending read entry', () => {
        const result = setPendingChannelRead({
          channelId: 'ch-1',
          messageIds: ['msg-1', 'msg-2']
        })

        expect(result).not.toBeNull()
        expect(result?.channelId).toBe('ch-1')
        expect(result?.messageIds).toEqual(['msg-1', 'msg-2'])
        expect(result?.readAll).toBe(false)
        expect(result?.queuedAt).toBeDefined()
      })

      it('returns null for empty channelId', () => {
        const result = setPendingChannelRead({ channelId: '' })
        expect(result).toBeNull()
      })

      it('merges messageIds with existing entry', () => {
        setPendingChannelRead({ channelId: 'ch-1', messageIds: ['msg-1'] })
        const result = setPendingChannelRead({ channelId: 'ch-1', messageIds: ['msg-2', 'msg-3'] })

        expect(result?.messageIds).toEqual(['msg-1', 'msg-2', 'msg-3'])
      })

      it('deduplicates messageIds', () => {
        setPendingChannelRead({ channelId: 'ch-1', messageIds: ['msg-1', 'msg-2'] })
        const result = setPendingChannelRead({ channelId: 'ch-1', messageIds: ['msg-2', 'msg-3'] })

        expect(result?.messageIds).toEqual(['msg-1', 'msg-2', 'msg-3'])
      })

      it('sets readAll and clears messageIds when readAll is true', () => {
        setPendingChannelRead({ channelId: 'ch-1', messageIds: ['msg-1', 'msg-2'] })
        const result = setPendingChannelRead({ channelId: 'ch-1', readAll: true })

        expect(result?.readAll).toBe(true)
        expect(result?.messageIds).toEqual([])
      })

      it('keeps readAll true once set', () => {
        setPendingChannelRead({ channelId: 'ch-1', readAll: true })
        const result = setPendingChannelRead({ channelId: 'ch-1', messageIds: ['msg-1'] })

        expect(result?.readAll).toBe(true)
        expect(result?.messageIds).toEqual([])
      })

      it('filters out falsy messageIds', () => {
        const result = setPendingChannelRead({
          channelId: 'ch-1',
          messageIds: ['msg-1', '', 'msg-2']
        })

        expect(result?.messageIds).toEqual(['msg-1', 'msg-2'])
      })
    })

    describe('getPendingChannelRead', () => {
      it('returns the pending read for a channel', () => {
        setPendingChannelRead({ channelId: 'ch-1', messageIds: ['msg-1'] })

        const result = getPendingChannelRead('ch-1')
        expect(result?.channelId).toBe('ch-1')
        expect(result?.messageIds).toEqual(['msg-1'])
      })

      it('returns undefined for unknown channel', () => {
        const result = getPendingChannelRead('non-existent')
        expect(result).toBeUndefined()
      })
    })

    describe('getPendingChannelReads', () => {
      it('returns all pending reads', () => {
        setPendingChannelRead({ channelId: 'ch-1', messageIds: ['msg-1'] })
        setPendingChannelRead({ channelId: 'ch-2', messageIds: ['msg-2'] })

        const results = getPendingChannelReads()
        expect(results).toHaveLength(2)
        expect(results.map((r) => r.channelId).sort()).toEqual(['ch-1', 'ch-2'])
      })

      it('returns empty array when no pending reads', () => {
        const results = getPendingChannelReads()
        expect(results).toEqual([])
      })
    })

    describe('removePendingChannelRead', () => {
      it('removes a pending read entry', () => {
        setPendingChannelRead({ channelId: 'ch-1', messageIds: ['msg-1'] })
        expect(getPendingChannelRead('ch-1')).toBeDefined()

        removePendingChannelRead('ch-1')
        expect(getPendingChannelRead('ch-1')).toBeUndefined()
      })

      it('does not throw for non-existent channel', () => {
        expect(() => removePendingChannelRead('non-existent')).not.toThrow()
      })
    })
  })

  describe('pending delete channel helpers', () => {
    describe('setPendingDeleteChannel / getPendingDeleteChannel', () => {
      it('stores and retrieves a pending delete channel', () => {
        const channel = makeChannel({ id: 'delete-me' })
        setPendingDeleteChannel(channel)

        const result = getPendingDeleteChannel('delete-me')
        expect(result).toBeDefined()
        expect(result.id).toBe('delete-me')
      })

      it('returns undefined for unknown channel', () => {
        const result = getPendingDeleteChannel('non-existent')
        expect(result).toBeUndefined()
      })
    })

    describe('getPendingDeleteChannels', () => {
      it('returns all pending delete channels', () => {
        const channel1 = makeChannel({ id: 'delete-1' })
        const channel2 = makeChannel({ id: 'delete-2' })

        setPendingDeleteChannel(channel1)
        setPendingDeleteChannel(channel2)

        const results = getPendingDeleteChannels()
        expect(results).toHaveLength(2)
      })

      it('returns empty array when none pending', () => {
        const results = getPendingDeleteChannels()
        expect(results).toEqual([])
      })
    })

    describe('removePendingDeleteChannel', () => {
      it('removes a pending delete channel', () => {
        const channel = makeChannel({ id: 'delete-me' })
        setPendingDeleteChannel(channel)

        removePendingDeleteChannel('delete-me')

        expect(getPendingDeleteChannel('delete-me')).toBeUndefined()
      })
    })
  })

  describe('all-channels list helpers', () => {
    describe('addChannelToAllChannels / getAllChannels', () => {
      it('adds a single channel to the list', () => {
        const channel = makeChannel({ id: 'ch-1' })
        addChannelToAllChannels(channel)

        const all = getAllChannels()
        expect(all).toHaveLength(1)
        expect(all[0].id).toBe('ch-1')
      })

      it('appends channels in order', () => {
        addChannelToAllChannels(makeChannel({ id: 'ch-1' }))
        addChannelToAllChannels(makeChannel({ id: 'ch-2' }))

        const all = getAllChannels()
        expect(all).toHaveLength(2)
        expect(all[0].id).toBe('ch-1')
        expect(all[1].id).toBe('ch-2')
      })
    })

    describe('addChannelsToAllChannels', () => {
      it('adds multiple channels at once', () => {
        const channels = [makeChannel({ id: 'ch-1' }), makeChannel({ id: 'ch-2' })]
        addChannelsToAllChannels(channels)

        const all = getAllChannels()
        expect(all).toHaveLength(2)
      })

      it('appends to existing channels', () => {
        addChannelToAllChannels(makeChannel({ id: 'existing' }))
        addChannelsToAllChannels([makeChannel({ id: 'new-1' }), makeChannel({ id: 'new-2' })])

        const all = getAllChannels()
        expect(all).toHaveLength(3)
      })
    })

    describe('getChannelFromAllChannels', () => {
      it('finds a channel by id', () => {
        addChannelToAllChannels(makeChannel({ id: 'ch-1' }))
        addChannelToAllChannels(makeChannel({ id: 'ch-2' }))

        const result = getChannelFromAllChannels('ch-2')
        expect(result?.id).toBe('ch-2')
      })

      it('returns undefined for unknown id', () => {
        const result = getChannelFromAllChannels('non-existent')
        expect(result).toBeUndefined()
      })
    })

    describe('getChannelFromAllChannelsMap', () => {
      it('finds a channel by id from the map', () => {
        const channel = makeChannel({ id: 'ch-map' })
        setChannelInMap(channel) // This also adds to allChannelsMap

        const result = getChannelFromAllChannelsMap('ch-map')
        expect(result?.id).toBe('ch-map')
      })

      it('returns undefined for unknown id', () => {
        const result = getChannelFromAllChannelsMap('non-existent')
        expect(result).toBeUndefined()
      })
    })

    describe('deleteChannelFromAllChannels', () => {
      it('removes a channel from the list', () => {
        addChannelToAllChannels(makeChannel({ id: 'ch-1' }))
        addChannelToAllChannels(makeChannel({ id: 'ch-2' }))

        deleteChannelFromAllChannels('ch-1')

        const all = getAllChannels()
        expect(all).toHaveLength(1)
        expect(all[0].id).toBe('ch-2')
      })

      it('does not throw for unknown id', () => {
        expect(() => deleteChannelFromAllChannels('non-existent')).not.toThrow()
      })
    })

    describe('updateChannelLastMessageOnAllChannels', () => {
      it('updates lastMessage for edited message', () => {
        const originalMessage = makeMessage({ id: 'msg-1', body: 'Original' })
        const channel = makeChannel({ id: 'ch-1', lastMessage: originalMessage })
        addChannelToAllChannels(channel)
        setChannelInMap(channel)

        const editedMessage = makeMessage({ id: 'msg-1', body: 'Edited', state: 'Edited' })
        updateChannelLastMessageOnAllChannels('ch-1', editedMessage)

        const updated = getChannelFromMap('ch-1')
        expect(updated.lastMessage.body).toBe('Edited')
        expect(updated.lastMessage.state).toBe('Edited')
      })

      it('updates lastMessage for deleted message', () => {
        const originalMessage = makeMessage({ id: 'msg-1', body: 'Original' })
        const channel = makeChannel({ id: 'ch-1', lastMessage: originalMessage })
        addChannelToAllChannels(channel)
        setChannelInMap(channel)

        const deletedMessage = makeMessage({ id: 'msg-1', body: '', state: 'Deleted' })
        updateChannelLastMessageOnAllChannels('ch-1', deletedMessage)

        const updated = getChannelFromMap('ch-1')
        expect(updated.lastMessage.state).toBe('Deleted')
      })

      it('preserves READ delivery status on lastMessage update', () => {
        const originalMessage = makeMessage({
          id: 'msg-1',
          body: 'Original',
          deliveryStatus: MESSAGE_DELIVERY_STATUS.READ
        })
        const channel = makeChannel({ id: 'ch-1', lastMessage: originalMessage })
        addChannelToAllChannels(channel)
        setChannelInMap(channel)

        const newMessage = makeMessage({
          id: 'msg-1',
          body: 'New',
          deliveryStatus: MESSAGE_DELIVERY_STATUS.SENT
        })
        updateChannelLastMessageOnAllChannels('ch-1', newMessage)

        const updated = getChannelFromMap('ch-1')
        expect(updated.lastMessage.deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.READ)
      })

      it('moves channel to top of list for new message', () => {
        const ch1 = makeChannel({ id: 'ch-1', lastMessage: makeMessage({ id: 'msg-1' }) })
        const ch2 = makeChannel({ id: 'ch-2', lastMessage: makeMessage({ id: 'msg-2' }) })
        addChannelToAllChannels(ch1)
        addChannelToAllChannels(ch2)
        setChannelInMap(ch1)
        setChannelInMap(ch2)

        const newMessage = makeMessage({ id: 'msg-3', body: 'New' })
        updateChannelLastMessageOnAllChannels('ch-2', newMessage)

        const all = getAllChannels()
        expect(all[0].id).toBe('ch-2')
      })

      it('updates lastMessage for a channel that is in the map but not in the all-channels list', () => {
        const channel = makeChannel({ id: 'ch-search', lastMessage: makeMessage({ id: 'msg-old' }) })
        setChannelInMap(channel)
        deleteChannelFromAllChannels('ch-search')
        expect(getChannelFromAllChannels('ch-search')).toBeUndefined()

        const newMessage = makeMessage({ id: 'msg-new', body: 'Fresh' })
        updateChannelLastMessageOnAllChannels('ch-search', newMessage)

        expect(getChannelFromMap('ch-search').lastMessage.id).toBe('msg-new')
        expect(getChannelFromAllChannelsMap('ch-search').lastMessage.id).toBe('msg-new')
      })

      it('preserves READ status in the map even when the channel is not in the all-channels list', () => {
        const channel = makeChannel({
          id: 'ch-search-read',
          lastMessage: makeMessage({ id: 'msg-1', deliveryStatus: MESSAGE_DELIVERY_STATUS.READ })
        })
        setChannelInMap(channel)
        deleteChannelFromAllChannels('ch-search-read')

        updateChannelLastMessageOnAllChannels(
          'ch-search-read',
          makeMessage({ id: 'msg-1', deliveryStatus: MESSAGE_DELIVERY_STATUS.SENT })
        )

        expect(getChannelFromMap('ch-search-read').lastMessage.deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.READ)
      })

      it('keeps the all-channels list, channel map and all-channels map in sync', () => {
        const channel = makeChannel({
          id: 'ch-sync',
          lastMessage: makeMessage({ id: 'msg-1', deliveryStatus: MESSAGE_DELIVERY_STATUS.READ })
        })
        addChannelToAllChannels(channel)
        setChannelInMap(channel)

        updateChannelLastMessageOnAllChannels(
          'ch-sync',
          makeMessage({ id: 'msg-1', deliveryStatus: MESSAGE_DELIVERY_STATUS.SENT })
        )

        expect(getChannelFromAllChannels('ch-sync')?.lastMessage.deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.READ)
        expect(getChannelFromMap('ch-sync').lastMessage.deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.READ)
        expect(getChannelFromAllChannelsMap('ch-sync').lastMessage.deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.READ)
      })
    })

    describe('updateChannelOnAllChannels', () => {
      it('updates channel properties', () => {
        const channel = makeChannel({ id: 'ch-1', subject: 'Original' })
        addChannelToAllChannels(channel)
        setChannelInMap(channel)

        updateChannelOnAllChannels('ch-1', { subject: 'Updated', muted: true })

        const all = getAllChannels()
        expect(all[0].subject).toBe('Updated')
        expect(all[0].muted).toBe(true)

        const fromMap = getChannelFromMap('ch-1')
        expect(fromMap.subject).toBe('Updated')
      })

      it('updates lastMessage when messageUpdateData is provided', () => {
        const lastMessage = makeMessage({ id: 'msg-1', body: 'Original' })
        const channel = makeChannel({ id: 'ch-1', lastMessage })
        addChannelToAllChannels(channel)
        setChannelInMap(channel)

        updateChannelOnAllChannels('ch-1', {}, { id: 'msg-1', body: 'Updated' })

        const all = getAllChannels()
        expect(all[0].lastMessage.body).toBe('Updated')
      })

      it('preserves READ status when updating lastMessage', () => {
        const lastMessage = makeMessage({
          id: 'msg-1',
          body: 'Original',
          deliveryStatus: MESSAGE_DELIVERY_STATUS.READ
        })
        const channel = makeChannel({ id: 'ch-1', lastMessage })
        addChannelToAllChannels(channel)
        setChannelInMap(channel)

        updateChannelOnAllChannels('ch-1', {}, { id: 'msg-1', deliveryStatus: MESSAGE_DELIVERY_STATUS.SENT })

        const all = getAllChannels()
        expect(all[0].lastMessage.deliveryStatus).toBe(MESSAGE_DELIVERY_STATUS.READ)
      })

      it('does nothing for unknown channel', () => {
        updateChannelOnAllChannels('non-existent', { subject: 'Test' })
        // Should not throw
        expect(getChannelFromMap('non-existent')).toBeUndefined()
      })
    })
  })

  describe('sortChannelByLastMessage', () => {
    it('sorts pinned channels before unpinned', () => {
      const pinnedChannel = makeChannel({
        id: 'pinned',
        pinnedAt: new Date('2026-01-01'),
        lastMessage: makeMessage({ createdAt: new Date('2025-01-01') })
      })
      const unpinnedChannel = makeChannel({
        id: 'unpinned',
        pinnedAt: null,
        lastMessage: makeMessage({ createdAt: new Date('2026-06-01') })
      })

      const sorted = sortChannelByLastMessage([unpinnedChannel, pinnedChannel])

      expect(sorted[0].id).toBe('pinned')
      expect(sorted[1].id).toBe('unpinned')
    })

    it('sorts multiple pinned channels by pinnedAt descending', () => {
      const pinned1 = makeChannel({
        id: 'pinned-early',
        pinnedAt: new Date('2026-01-01')
      })
      const pinned2 = makeChannel({
        id: 'pinned-late',
        pinnedAt: new Date('2026-06-01')
      })

      const sorted = sortChannelByLastMessage([pinned1, pinned2])

      expect(sorted[0].id).toBe('pinned-late')
      expect(sorted[1].id).toBe('pinned-early')
    })

    it('sorts unpinned channels by lastMessage.createdAt descending', () => {
      const older = makeChannel({
        id: 'older',
        lastMessage: makeMessage({ createdAt: new Date('2026-01-01') })
      })
      const newer = makeChannel({
        id: 'newer',
        lastMessage: makeMessage({ createdAt: new Date('2026-06-01') })
      })

      const sorted = sortChannelByLastMessage([older, newer])

      expect(sorted[0].id).toBe('newer')
      expect(sorted[1].id).toBe('older')
    })

    it('falls back to createdAt when no lastMessage', () => {
      // @ts-expect-error - testing edge case with no lastMessage
      const older = makeChannel({
        id: 'older',
        createdAt: new Date('2026-01-01'),
        lastMessage: undefined
      })
      // @ts-expect-error - testing edge case with no lastMessage
      const newer = makeChannel({
        id: 'newer',
        createdAt: new Date('2026-06-01'),
        lastMessage: undefined
      })

      const sorted = sortChannelByLastMessage([older, newer])

      expect(sorted[0].id).toBe('newer')
      expect(sorted[1].id).toBe('older')
    })
  })
})
