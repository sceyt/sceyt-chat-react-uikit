import { runSaga } from 'redux-saga'
import { destroyChannelsMap, setChannelInMap, query } from '../../helpers/channelHalper'
import { makeChannel, makeUser, makeMember } from '../../testUtils/messageFixtures'
import { setClient } from '../../common/client'
import { __memberSagaTestables } from './saga'
import { CONNECTION_STATUS } from '../user/constants'
import { LOADING_STATE, DEFAULT_CHANNEL_TYPE } from '../../helpers/constants'
import {
  getMembersAC,
  loadMoreMembersAC,
  addMembersAC,
  kickMemberAC,
  blockMemberAC,
  changeMemberRoleAC,
  reportUserAC,
  getRolesAC
} from './actions'

function createMockStoreState(overrides: any) {
  const opts = overrides || {}
  return {
    UserReducer: {
      connectionStatus: CONNECTION_STATUS.CONNECTED,
      ...(opts.UserReducer || {})
    },
    ChannelReducer: {
      channels: [],
      channelsLoadingState: null,
      activeChannel: opts.activeChannel || {},
      ...(opts.ChannelReducer || {})
    },
    MembersReducer: {
      channelsMembersMap: {},
      channelsMembersHasNextMap: {},
      ...(opts.MembersReducer || {})
    }
  }
}

let mockStoreState: any = createMockStoreState({})

const mockStore = {
  getState: jest.fn(() => mockStoreState)
}

jest.mock('store', () => ({
  __esModule: true,
  get default() {
    return mockStore
  }
}))

jest.mock('../evetns/inedx', () => ({
  __esModule: true,
  default: jest.fn()
}))

// Mock loglevel to suppress error logs in tests
jest.mock('loglevel', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn()
}))

// Mock channel helper to track updates
const mockUpdateChannelOnAllChannels = jest.fn()
jest.mock('../../helpers/channelHalper', () => {
  const actual = jest.requireActual('../../helpers/channelHalper')
  return {
    ...actual,
    updateChannelOnAllChannels: (...args: any[]) => mockUpdateChannelOnAllChannels(...args),
    getCustomLoadMembersFunctions: jest.fn(() => null),
    getDisableFrowardMentionsCount: jest.fn(() => false)
  }
})

const runMemberSaga = async (saga: (...args: any[]) => Generator, ...args: any[]) => {
  const dispatched: any[] = []
  await runSaga(
    {
      dispatch: (action) => dispatched.push(action),
      getState: () => mockStoreState
    },
    saga,
    ...args
  ).toPromise()
  return dispatched
}

describe('member saga', () => {
  let mockClient: any

  beforeEach(() => {
    jest.clearAllMocks()
    destroyChannelsMap()
    mockStoreState = createMockStoreState({})
    mockStore.getState.mockReturnValue(mockStoreState)
    query.channelMembersQuery = undefined

    // Setup mock client
    mockClient = {
      user: { id: 'current-user' },
      MemberListQueryBuilder: jest.fn().mockImplementation(() => ({
        all: jest.fn().mockReturnThis(),
        byAffiliationOrder: jest.fn().mockReturnThis(),
        orderKeyByUsername: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        build: jest.fn().mockResolvedValue({
          loadNextPage: jest.fn().mockResolvedValue({ members: [], hasNext: false })
        })
      })),
      getChannel: jest.fn(),
      userReport: jest.fn(),
      getRoles: jest.fn()
    }
    setClient(mockClient)
  })

  afterEach(() => {
    destroyChannelsMap()
    query.channelMembersQuery = undefined
  })

  describe('getMembers', () => {
    it('fetches members and dispatches setMembersToListAC on success', async () => {
      const member1 = makeMember(makeUser({ id: 'user-1' }), 'owner')
      const member2 = makeMember(makeUser({ id: 'user-2' }), 'member')
      const mockMembers = [member1, member2]

      const mockMembersQuery = {
        loadNextPage: jest.fn().mockResolvedValue({ members: mockMembers, hasNext: true })
      }

      mockClient.MemberListQueryBuilder = jest.fn().mockImplementation(() => ({
        all: jest.fn().mockReturnThis(),
        byAffiliationOrder: jest.fn().mockReturnThis(),
        orderKeyByUsername: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        build: jest.fn().mockResolvedValue(mockMembersQuery)
      }))

      const channel = makeChannel({ id: 'channel-1', members: [] })
      setChannelInMap(channel)

      const dispatched = await runMemberSaga(__memberSagaTestables.getMembers, getMembersAC('channel-1'))

      // Should dispatch setMembersHasNextAC(true) first
      expect(dispatched).toContainEqual(
        expect.objectContaining({
          type: 'members/setMembersHasNext',
          payload: { hasNext: true, channelId: 'channel-1' }
        })
      )

      // Should dispatch loading state
      expect(dispatched).toContainEqual(
        expect.objectContaining({
          type: 'members/setMembersLoadingState',
          payload: { loadingState: LOADING_STATE.LOADING, channelId: 'channel-1' }
        })
      )

      // Should dispatch members to list
      expect(dispatched).toContainEqual(
        expect.objectContaining({
          type: 'members/setMembersToList',
          payload: { members: mockMembers, channelId: 'channel-1' }
        })
      )

      // Should dispatch hasNext
      expect(dispatched).toContainEqual(
        expect.objectContaining({
          type: 'members/setMembersHasNext',
          payload: { hasNext: true, channelId: 'channel-1' }
        })
      )

      // Should dispatch loaded state
      expect(dispatched).toContainEqual(
        expect.objectContaining({
          type: 'members/setMembersLoadingState',
          payload: { loadingState: LOADING_STATE.LOADED, channelId: 'channel-1' }
        })
      )
    })

    it('returns early if channelId is undefined', async () => {
      const dispatched = await runMemberSaga(__memberSagaTestables.getMembers, {
        type: 'GET_MEMBERS',
        payload: { channelId: undefined }
      })

      // Should dispatch setMembersHasNextAC(true) then LOADED in finally block
      expect(dispatched).toHaveLength(2)
      expect(dispatched[0]).toMatchObject({
        type: 'members/setMembersHasNext',
        payload: { hasNext: true }
      })
      expect(dispatched[1]).toMatchObject({
        type: 'members/setMembersLoadingState',
        payload: { loadingState: LOADING_STATE.LOADED }
      })
    })

    it('returns early if hasNextMap is false for channel', async () => {
      const newState = createMockStoreState({
        MembersReducer: {
          channelsMembersMap: {},
          channelsMembersHasNextMap: { 'channel-1': false }
        }
      })
      mockStoreState = newState
      mockStore.getState.mockReturnValue(newState)

      const dispatched = await runMemberSaga(__memberSagaTestables.getMembers, getMembersAC('channel-1'))

      // Should dispatch setMembersHasNextAC(true) then LOADED in finally block
      expect(dispatched).toHaveLength(2)
      expect(dispatched[0].type).toBe('members/setMembersHasNext')
      expect(dispatched[1].type).toBe('members/setMembersLoadingState')
    })

    it('sets FAILED when the first members request times out', async () => {
      const mockMembersQuery = {
        loadNextPage: jest.fn().mockRejectedValue({ code: 9902, message: 'Request timeout' })
      }
      mockClient.MemberListQueryBuilder = jest.fn().mockImplementation(() => ({
        all: jest.fn().mockReturnThis(),
        byAffiliationOrder: jest.fn().mockReturnThis(),
        orderKeyByUsername: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        build: jest.fn().mockResolvedValue(mockMembersQuery)
      }))
      setChannelInMap(makeChannel({ id: 'channel-timeout', members: [] }))

      const dispatched = await runMemberSaga(__memberSagaTestables.getMembers, getMembersAC('channel-timeout'))

      const states = dispatched
        .filter((a) => a.type === 'members/setMembersLoadingState')
        .map((a) => a.payload.loadingState)
      expect(states).toEqual([LOADING_STATE.LOADING, LOADING_STATE.FAILED])
    })

    it('handles SDK error gracefully without crashing', async () => {
      const mockMembersQuery = {
        loadNextPage: jest.fn().mockRejectedValue({ code: 5000, message: 'Network error' })
      }

      mockClient.MemberListQueryBuilder = jest.fn().mockImplementation(() => ({
        all: jest.fn().mockReturnThis(),
        byAffiliationOrder: jest.fn().mockReturnThis(),
        orderKeyByUsername: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        build: jest.fn().mockResolvedValue(mockMembersQuery)
      }))

      const channel = makeChannel({ id: 'channel-error', members: [] })
      setChannelInMap(channel)

      const dispatched = await runMemberSaga(__memberSagaTestables.getMembers, getMembersAC('channel-error'))

      // Should still dispatch loaded state in finally block
      expect(dispatched).toContainEqual(
        expect.objectContaining({
          type: 'members/setMembersLoadingState',
          payload: { loadingState: LOADING_STATE.LOADED, channelId: 'channel-error' }
        })
      )

      // Should not dispatch members
      expect(dispatched).not.toContainEqual(
        expect.objectContaining({
          type: 'members/setMembersToList'
        })
      )
    })
  })

  describe('loadMoreMembers', () => {
    it('loads more members and appends to list', async () => {
      const member1 = makeMember(makeUser({ id: 'user-3' }), 'member')
      const member2 = makeMember(makeUser({ id: 'user-4' }), 'member')

      const mockMembersQuery = {
        loadNextPage: jest.fn().mockResolvedValue({ members: [member1, member2], hasNext: false }),
        limit: 50
      }

      query.channelMembersQuery = { 'channel-1': mockMembersQuery }

      const channel = makeChannel({ id: 'channel-1' })
      setChannelInMap(channel)

      const dispatched = await runMemberSaga(__memberSagaTestables.loadMoreMembers, loadMoreMembersAC(50, 'channel-1'))

      // Should dispatch loading state
      expect(dispatched).toContainEqual(
        expect.objectContaining({
          type: 'members/setMembersLoadingState',
          payload: { loadingState: LOADING_STATE.LOADING, channelId: 'channel-1' }
        })
      )

      // Should dispatch addMembersToListAC
      expect(dispatched).toContainEqual(
        expect.objectContaining({
          type: 'members/addMembersToList',
          payload: { members: [member1, member2], channelId: 'channel-1' }
        })
      )

      // Should dispatch hasNext = false
      expect(dispatched).toContainEqual(
        expect.objectContaining({
          type: 'members/setMembersHasNext',
          payload: { hasNext: false, channelId: 'channel-1' }
        })
      )
    })

    it('updates limit if provided', async () => {
      const mockMembersQuery = {
        loadNextPage: jest.fn().mockResolvedValue({ members: [], hasNext: false }),
        limit: 50
      }

      query.channelMembersQuery = { 'channel-1': mockMembersQuery }

      const channel = makeChannel({ id: 'channel-1' })
      setChannelInMap(channel)

      await runMemberSaga(__memberSagaTestables.loadMoreMembers, loadMoreMembersAC(100, 'channel-1'))

      expect(mockMembersQuery.limit).toBe(100)
    })

    it('handles SDK error gracefully', async () => {
      const mockMembersQuery = {
        loadNextPage: jest.fn().mockRejectedValue({ code: 5000, message: 'Network error' }),
        limit: 50
      }

      query.channelMembersQuery = { 'channel-1': mockMembersQuery }

      const channel = makeChannel({ id: 'channel-1' })
      setChannelInMap(channel)

      const dispatched = await runMemberSaga(__memberSagaTestables.loadMoreMembers, loadMoreMembersAC(50, 'channel-1'))

      // Should dispatch loaded state in finally block
      expect(dispatched).toContainEqual(
        expect.objectContaining({
          type: 'members/setMembersLoadingState',
          payload: { loadingState: LOADING_STATE.LOADED, channelId: 'channel-1' }
        })
      )

      // Should not dispatch members
      expect(dispatched).not.toContainEqual(
        expect.objectContaining({
          type: 'members/addMembersToList'
        })
      )
    })
  })

  describe('addMembers', () => {
    it('adds members to channel and dispatches success actions', async () => {
      const memberToAdd = makeMember(makeUser({ id: 'new-user' }), 'member')

      const mockMemberBuilder = {
        setRole: jest.fn().mockReturnThis(),
        create: jest.fn().mockReturnValue(memberToAdd)
      }

      const channel = makeChannel({
        id: 'channel-1',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        memberCount: 2,
        createMemberBuilder: jest.fn(() => mockMemberBuilder),
        addMembers: jest.fn().mockResolvedValue([memberToAdd])
      })
      setChannelInMap(channel)

      const dispatched = await runMemberSaga(
        __memberSagaTestables.addMembers,
        addMembersAC('channel-1', [{ id: 'new-user', role: 'member' }])
      )

      // Should call channel.addMembers
      expect(channel.addMembers).toHaveBeenCalled()

      // Should dispatch addMembersToListAC
      expect(dispatched).toContainEqual(
        expect.objectContaining({
          type: 'members/addMembersToList',
          payload: { members: [memberToAdd], channelId: 'channel-1' }
        })
      )

      // Should dispatch updateChannelDataAC with new memberCount
      expect(dispatched).toContainEqual(
        expect.objectContaining({
          type: 'channels/updateChannelData',
          payload: expect.objectContaining({
            channelId: 'channel-1',
            config: expect.objectContaining({
              memberCount: 3
            })
          })
        })
      )
    })

    it('dispatches system message for group channels', async () => {
      const memberToAdd = makeMember(makeUser({ id: 'new-user' }), 'member')

      const mockMemberBuilder = {
        setRole: jest.fn().mockReturnThis(),
        create: jest.fn().mockReturnValue(memberToAdd)
      }

      const channel = makeChannel({
        id: 'channel-1',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        memberCount: 2,
        createMemberBuilder: jest.fn(() => mockMemberBuilder),
        addMembers: jest.fn().mockResolvedValue([memberToAdd])
      })
      setChannelInMap(channel)

      const dispatched = await runMemberSaga(
        __memberSagaTestables.addMembers,
        addMembersAC('channel-1', [{ id: 'new-user', role: 'member' }])
      )

      // Should dispatch sendTextMessageAC with system message
      expect(dispatched).toContainEqual(
        expect.objectContaining({
          type: 'SEND_TEXT_MESSAGE',
          payload: expect.objectContaining({
            message: expect.objectContaining({
              body: 'AM',
              type: 'system'
            })
          })
        })
      )
    })

    it('handles restricted action when some members cannot be added', async () => {
      const memberToAdd = makeMember(makeUser({ id: 'new-user' }), 'member')
      const restrictedMember = { id: 'restricted-user', role: 'member' }

      const mockMemberBuilder = {
        setRole: jest.fn().mockReturnThis(),
        create: jest.fn().mockReturnValue(memberToAdd)
      }

      const channel = makeChannel({
        id: 'channel-1',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        memberCount: 2,
        createMemberBuilder: jest.fn(() => mockMemberBuilder),
        addMembers: jest.fn().mockResolvedValue([memberToAdd]) // Only one added, not both
      })
      setChannelInMap(channel)

      const dispatched = await runMemberSaga(
        __memberSagaTestables.addMembers,
        addMembersAC('channel-1', [{ id: 'new-user', role: 'member' }, restrictedMember])
      )

      // Should dispatch setActionIsRestrictedAC for restricted user
      expect(dispatched).toContainEqual(
        expect.objectContaining({
          type: 'members/setActionIsRestricted',
          payload: expect.objectContaining({
            isRestricted: true,
            fromChannel: true
          })
        })
      )
    })

    it('handles SDK error gracefully', async () => {
      const mockMemberBuilder = {
        setRole: jest.fn().mockReturnThis(),
        create: jest.fn().mockReturnValue({})
      }

      const channel = makeChannel({
        id: 'channel-1',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        createMemberBuilder: jest.fn(() => mockMemberBuilder),
        addMembers: jest.fn().mockRejectedValue(new Error('SDK error'))
      })
      setChannelInMap(channel)

      // Should not throw
      const dispatched = await runMemberSaga(
        __memberSagaTestables.addMembers,
        addMembersAC('channel-1', [{ id: 'new-user', role: 'member' }])
      )

      // Should not dispatch success actions
      expect(dispatched).not.toContainEqual(
        expect.objectContaining({
          type: 'members/addMembersToList'
        })
      )
    })

    it('does nothing if channel is not found', async () => {
      const dispatched = await runMemberSaga(
        __memberSagaTestables.addMembers,
        addMembersAC('non-existent-channel', [{ id: 'new-user', role: 'member' }])
      )

      expect(dispatched).toHaveLength(0)
    })
  })

  describe('kickMemberFromChannel', () => {
    it('kicks member and dispatches success actions', async () => {
      const memberToKick = makeMember(makeUser({ id: 'kicked-user' }), 'member')

      const channel = makeChannel({
        id: 'channel-1',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        memberCount: 3,
        kickMembers: jest.fn().mockResolvedValue([memberToKick])
      })
      setChannelInMap(channel)

      const dispatched = await runMemberSaga(
        __memberSagaTestables.kickMemberFromChannel,
        kickMemberAC('channel-1', 'kicked-user')
      )

      // Should call channel.kickMembers
      expect(channel.kickMembers).toHaveBeenCalledWith(['kicked-user'])

      // Should dispatch removeMemberFromListAC
      expect(dispatched).toContainEqual(
        expect.objectContaining({
          type: 'members/removeMemberFromList',
          payload: { members: [memberToKick], channelId: 'channel-1' }
        })
      )

      // Should update channel member count
      expect(mockUpdateChannelOnAllChannels).toHaveBeenCalledWith('channel-1', { memberCount: 2 })

      // Should dispatch updateChannelDataAC
      expect(dispatched).toContainEqual(
        expect.objectContaining({
          type: 'channels/updateChannelData',
          payload: expect.objectContaining({
            channelId: 'channel-1',
            config: expect.objectContaining({
              memberCount: 2
            })
          })
        })
      )
    })

    it('dispatches system message for group channels', async () => {
      const memberToKick = makeMember(makeUser({ id: 'kicked-user' }), 'member')

      const channel = makeChannel({
        id: 'channel-1',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        memberCount: 3,
        kickMembers: jest.fn().mockResolvedValue([memberToKick])
      })
      setChannelInMap(channel)

      const dispatched = await runMemberSaga(
        __memberSagaTestables.kickMemberFromChannel,
        kickMemberAC('channel-1', 'kicked-user')
      )

      // Should dispatch sendTextMessageAC with system message
      expect(dispatched).toContainEqual(
        expect.objectContaining({
          type: 'SEND_TEXT_MESSAGE',
          payload: expect.objectContaining({
            message: expect.objectContaining({
              body: 'RM',
              type: 'system'
            })
          })
        })
      )
    })

    it('handles SDK error gracefully', async () => {
      const channel = makeChannel({
        id: 'channel-1',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        memberCount: 3,
        kickMembers: jest.fn().mockRejectedValue(new Error('SDK error'))
      })
      setChannelInMap(channel)

      // Should not throw
      const dispatched = await runMemberSaga(
        __memberSagaTestables.kickMemberFromChannel,
        kickMemberAC('channel-1', 'kicked-user')
      )

      // Should not dispatch success actions
      expect(dispatched).not.toContainEqual(
        expect.objectContaining({
          type: 'members/removeMemberFromList'
        })
      )

      // Should not update channel
      expect(mockUpdateChannelOnAllChannels).not.toHaveBeenCalled()
    })
  })

  describe('blockMember', () => {
    it('blocks member and dispatches success actions', async () => {
      const memberToBlock = makeMember(makeUser({ id: 'blocked-user' }), 'member')

      const channel = makeChannel({
        id: 'channel-1',
        memberCount: 3,
        blockMembers: jest.fn().mockResolvedValue([memberToBlock])
      })
      setChannelInMap(channel)

      const dispatched = await runMemberSaga(
        __memberSagaTestables.blockMember,
        blockMemberAC('channel-1', 'blocked-user')
      )

      // Should call channel.blockMembers
      expect(channel.blockMembers).toHaveBeenCalledWith(['blocked-user'])

      // Should dispatch removeMemberFromListAC
      expect(dispatched).toContainEqual(
        expect.objectContaining({
          type: 'members/removeMemberFromList',
          payload: { members: [memberToBlock], channelId: 'channel-1' }
        })
      )

      // Should update channel member count
      expect(mockUpdateChannelOnAllChannels).toHaveBeenCalledWith('channel-1', { memberCount: 2 })
    })

    it('handles SDK error gracefully', async () => {
      const channel = makeChannel({
        id: 'channel-1',
        memberCount: 3,
        blockMembers: jest.fn().mockRejectedValue(new Error('SDK error'))
      })
      setChannelInMap(channel)

      // Should not throw
      const dispatched = await runMemberSaga(
        __memberSagaTestables.blockMember,
        blockMemberAC('channel-1', 'blocked-user')
      )

      // Should not dispatch success actions
      expect(dispatched).not.toContainEqual(
        expect.objectContaining({
          type: 'members/removeMemberFromList'
        })
      )

      // Should not update channel
      expect(mockUpdateChannelOnAllChannels).not.toHaveBeenCalled()
    })
  })

  describe('changeMemberRole', () => {
    it('changes member role and dispatches success actions', async () => {
      const memberWithNewRole = makeMember(makeUser({ id: 'user-1' }), 'admin')

      const channel = makeChannel({
        id: 'channel-1',
        changeMembersRole: jest.fn().mockResolvedValue([memberWithNewRole])
      })
      setChannelInMap(channel)

      const dispatched = await runMemberSaga(
        __memberSagaTestables.changeMemberRole,
        changeMemberRoleAC('channel-1', [memberWithNewRole])
      )

      // Should call channel.changeMembersRole
      expect(channel.changeMembersRole).toHaveBeenCalledWith([memberWithNewRole])

      // Should dispatch updateMembersAC
      expect(dispatched).toContainEqual(
        expect.objectContaining({
          type: 'members/updateMembers',
          payload: { members: [memberWithNewRole], channelId: 'channel-1' }
        })
      )
    })

    it('handles SDK error gracefully', async () => {
      const memberWithNewRole = makeMember(makeUser({ id: 'user-1' }), 'admin')

      const channel = makeChannel({
        id: 'channel-1',
        changeMembersRole: jest.fn().mockRejectedValue(new Error('SDK error'))
      })
      setChannelInMap(channel)

      // Should not throw
      const dispatched = await runMemberSaga(
        __memberSagaTestables.changeMemberRole,
        changeMemberRoleAC('channel-1', [memberWithNewRole])
      )

      // Should not dispatch success actions
      expect(dispatched).not.toContainEqual(
        expect.objectContaining({
          type: 'members/updateMembers'
        })
      )
    })
  })

  describe('reportMember', () => {
    it('reports user successfully', async () => {
      mockClient.userReport = jest.fn().mockResolvedValue(undefined)

      const reportData = {
        reportReason: 'spam',
        userId: 'user-to-report',
        messageIds: ['msg-1', 'msg-2'],
        reportDescription: 'Sending spam messages'
      }

      // Should not throw
      await runMemberSaga(__memberSagaTestables.reportMember, reportUserAC(reportData))

      expect(mockClient.userReport).toHaveBeenCalledWith(
        'spam',
        'user-to-report',
        ['msg-1', 'msg-2'],
        'Sending spam messages'
      )
    })

    it('handles SDK error gracefully', async () => {
      mockClient.userReport = jest.fn().mockRejectedValue(new Error('SDK error'))

      const reportData = {
        reportReason: 'spam',
        userId: 'user-to-report',
        messageIds: ['msg-1'],
        reportDescription: 'Spam'
      }

      // Should not throw
      const dispatched = await runMemberSaga(__memberSagaTestables.reportMember, reportUserAC(reportData))

      // No actions dispatched on error (just logged)
      expect(dispatched).toHaveLength(0)
    })
  })

  describe('getRoles', () => {
    it('fetches roles and dispatches success actions', async () => {
      const mockRoles = [
        { name: 'owner', priority: 1 },
        { name: 'admin', priority: 2 },
        { name: 'member', priority: 3 }
      ]
      mockClient.getRoles = jest.fn().mockResolvedValue(mockRoles)

      const dispatched = await runMemberSaga(__memberSagaTestables.getRoles, getRolesAC())

      expect(mockClient.getRoles).toHaveBeenCalled()

      // Should dispatch getRolesSuccessAC
      expect(dispatched).toContainEqual(
        expect.objectContaining({
          type: 'members/getRolesSuccess',
          payload: { roles: mockRoles }
        })
      )

      // Should dispatch getRolesFailAC (to clear fail state)
      expect(dispatched).toContainEqual(
        expect.objectContaining({
          type: 'members/getRolesFail',
          payload: {}
        })
      )
    })

    it('returns early if not connected', async () => {
      const disconnectedState = createMockStoreState({
        UserReducer: {
          connectionStatus: CONNECTION_STATUS.DISCONNECTED
        }
      })
      mockStoreState = disconnectedState
      mockStore.getState.mockReturnValue(disconnectedState)

      const dispatched = await runMemberSaga(__memberSagaTestables.getRoles, getRolesAC())

      expect(mockClient.getRoles).not.toHaveBeenCalled()
      expect(dispatched).toHaveLength(0)
    })

    it('handles SDK error and schedules retry', async () => {
      mockClient.getRoles = jest.fn().mockRejectedValue(new Error('SDK error'))

      const dispatched = await runMemberSaga(__memberSagaTestables.getRoles, getRolesAC(0, 0))

      // Should dispatch getRolesFailAC with retry timeout
      expect(dispatched).toContainEqual(
        expect.objectContaining({
          type: 'members/getRolesFail',
          payload: { timeout: 300, attempts: 1 }
        })
      )
    })

    it('increments retry timeout and attempts on subsequent failures', async () => {
      mockClient.getRoles = jest.fn().mockRejectedValue(new Error('SDK error'))

      const dispatched = await runMemberSaga(__memberSagaTestables.getRoles, getRolesAC(300, 1))

      // Should dispatch getRolesFailAC with incremented values
      expect(dispatched).toContainEqual(
        expect.objectContaining({
          type: 'members/getRolesFail',
          payload: { timeout: 600, attempts: 2 }
        })
      )
    })
  })
})
