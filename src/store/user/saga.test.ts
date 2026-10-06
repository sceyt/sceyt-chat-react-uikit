import { runSaga } from 'redux-saga'
import { destroyChannelsMap, setChannelInMap, query, setActiveChannelId } from '../../helpers/channelHalper'
import { makeChannel, makeUser, makeMember } from '../../testUtils/messageFixtures'
import { setClient } from '../../common/client'
import { __userSagaTestables } from './saga'
import { CONNECTION_STATUS } from './constants'
import { LOADING_STATE, DEFAULT_CHANNEL_TYPE } from '../../helpers/constants'
import { getUsersAC, loadMoreUsersAC, blockUserAC, unblockUserAC, updateProfileAC } from './actions'

function createMockStoreState(overrides: any) {
  const opts = overrides || {}
  return {
    UserReducer: {
      connectionStatus: CONNECTION_STATUS.CONNECTED,
      user: makeUser({ id: 'current-user' }),
      users: [],
      contacts: [],
      usersLoadingState: null,
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

// Mock channel helper functions
const mockUpdateChannelOnAllChannels = jest.fn()
const mockUpdateChannelMemberInAllChannels = jest.fn()
jest.mock('../../helpers/channelHalper', () => {
  const actual = jest.requireActual('../../helpers/channelHalper')
  return {
    ...actual,
    updateChannelOnAllChannels: (...args: any[]) => mockUpdateChannelOnAllChannels(...args),
    updateChannelMemberInAllChannels: (...args: any[]) => mockUpdateChannelMemberInAllChannels(...args)
  }
})

const runUserSaga = async (saga: (...args: any[]) => Generator, ...args: any[]) => {
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

describe('user saga', () => {
  let mockClient: any

  beforeEach(() => {
    jest.clearAllMocks()
    destroyChannelsMap()
    mockStoreState = createMockStoreState({})
    mockStore.getState.mockReturnValue(mockStoreState)
    query.usersQuery = undefined

    // Setup mock client
    mockClient = {
      user: { id: 'current-user' },
      connectionState: CONNECTION_STATUS.CONNECTED,
      getAllContacts: jest.fn(),
      blockUsers: jest.fn(),
      unblockUsers: jest.fn(),
      uploadFile: jest.fn(),
      setProfile: jest.fn(),
      UserListQueryBuilder: jest.fn().mockImplementation(() => ({
        query: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        orderByFirstname: jest.fn().mockReturnThis(),
        orderByLastname: jest.fn().mockReturnThis(),
        orderByUsername: jest.fn().mockReturnThis(),
        filterByAll: jest.fn().mockReturnThis(),
        filterByFirstname: jest.fn().mockReturnThis(),
        filterByLastname: jest.fn().mockReturnThis(),
        filterByUsername: jest.fn().mockReturnThis(),
        build: jest.fn().mockResolvedValue({
          loadNextPage: jest.fn().mockResolvedValue({ users: [] })
        })
      }))
    }
    setClient(mockClient)
  })

  afterEach(() => {
    destroyChannelsMap()
    query.usersQuery = undefined
  })

  describe('getUsers', () => {
    it('fetches users with query params and dispatches success actions', async () => {
      const mockUsers = [makeUser({ id: 'user-1', firstName: 'Alice' }), makeUser({ id: 'user-2', firstName: 'Bob' })]

      const mockUsersQuery = {
        loadNextPage: jest.fn().mockResolvedValue({ users: mockUsers })
      }

      mockClient.UserListQueryBuilder = jest.fn().mockImplementation(() => ({
        query: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        orderByFirstname: jest.fn().mockReturnThis(),
        filterByAll: jest.fn().mockReturnThis(),
        build: jest.fn().mockResolvedValue(mockUsersQuery)
      }))

      const dispatched = await runUserSaga(
        __userSagaTestables.getUsers,
        getUsersAC({ query: 'test', limit: 20, order: 'firstname', filter: 'all' })
      )

      // Should dispatch loading state (RTK: users/setUsersLoadingState)
      expect(dispatched).toContainEqual(
        expect.objectContaining({
          type: 'users/setUsersLoadingState',
          payload: { state: LOADING_STATE.LOADING }
        })
      )

      // Should dispatch setUsersAC (RTK: users/setUsers)
      expect(dispatched).toContainEqual(
        expect.objectContaining({
          type: 'users/setUsers',
          payload: { users: mockUsers }
        })
      )

      // Should dispatch loaded state
      expect(dispatched).toContainEqual(
        expect.objectContaining({
          type: 'users/setUsersLoadingState',
          payload: { state: LOADING_STATE.LOADED }
        })
      )
    })

    it('returns early when not connected', async () => {
      mockClient.connectionState = CONNECTION_STATUS.DISCONNECTED

      const dispatched = await runUserSaga(__userSagaTestables.getUsers, getUsersAC({ query: 'test' }))

      expect(dispatched).toHaveLength(0)
    })

    it('applies order=lastname correctly', async () => {
      const orderByLastname = jest.fn().mockReturnThis()
      mockClient.UserListQueryBuilder = jest.fn().mockImplementation(() => ({
        query: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        orderByLastname,
        filterByAll: jest.fn().mockReturnThis(),
        build: jest.fn().mockResolvedValue({
          loadNextPage: jest.fn().mockResolvedValue({ users: [] })
        })
      }))

      await runUserSaga(__userSagaTestables.getUsers, getUsersAC({ order: 'lastname', filter: 'all' }))

      expect(orderByLastname).toHaveBeenCalled()
    })

    it('applies order=username correctly', async () => {
      const orderByUsername = jest.fn().mockReturnThis()
      mockClient.UserListQueryBuilder = jest.fn().mockImplementation(() => ({
        query: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        orderByUsername,
        filterByAll: jest.fn().mockReturnThis(),
        build: jest.fn().mockResolvedValue({
          loadNextPage: jest.fn().mockResolvedValue({ users: [] })
        })
      }))

      await runUserSaga(__userSagaTestables.getUsers, getUsersAC({ order: 'username', filter: 'all' }))

      expect(orderByUsername).toHaveBeenCalled()
    })

    it('applies filter=firstname correctly', async () => {
      const filterByFirstname = jest.fn().mockReturnThis()
      mockClient.UserListQueryBuilder = jest.fn().mockImplementation(() => ({
        query: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        filterByFirstname,
        build: jest.fn().mockResolvedValue({
          loadNextPage: jest.fn().mockResolvedValue({ users: [] })
        })
      }))

      await runUserSaga(__userSagaTestables.getUsers, getUsersAC({ filter: 'firstname' }))

      expect(filterByFirstname).toHaveBeenCalled()
    })

    it('applies filter=lastname correctly', async () => {
      const filterByLastname = jest.fn().mockReturnThis()
      mockClient.UserListQueryBuilder = jest.fn().mockImplementation(() => ({
        query: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        filterByLastname,
        build: jest.fn().mockResolvedValue({
          loadNextPage: jest.fn().mockResolvedValue({ users: [] })
        })
      }))

      await runUserSaga(__userSagaTestables.getUsers, getUsersAC({ filter: 'lastname' }))

      expect(filterByLastname).toHaveBeenCalled()
    })

    it('applies filter=username correctly', async () => {
      const filterByUsername = jest.fn().mockReturnThis()
      mockClient.UserListQueryBuilder = jest.fn().mockImplementation(() => ({
        query: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        filterByUsername,
        build: jest.fn().mockResolvedValue({
          loadNextPage: jest.fn().mockResolvedValue({ users: [] })
        })
      }))

      await runUserSaga(__userSagaTestables.getUsers, getUsersAC({ filter: 'username' }))

      expect(filterByUsername).toHaveBeenCalled()
    })

    it('handles SDK error gracefully', async () => {
      const mockUsersQuery = {
        loadNextPage: jest.fn().mockRejectedValue({ code: 5000, message: 'Network error' })
      }

      mockClient.UserListQueryBuilder = jest.fn().mockImplementation(() => ({
        query: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        filterByAll: jest.fn().mockReturnThis(),
        build: jest.fn().mockResolvedValue(mockUsersQuery)
      }))

      // Should not throw
      const dispatched = await runUserSaga(__userSagaTestables.getUsers, getUsersAC({ filter: 'all' }))

      expect(dispatched).not.toContainEqual(
        expect.objectContaining({
          type: 'users/setUsers'
        })
      )
    })
  })

  describe('loadMoreUsers', () => {
    it('loads more users and appends to list', async () => {
      const mockUsers = [makeUser({ id: 'user-3' }), makeUser({ id: 'user-4' })]

      const mockUsersQuery = {
        loadNextPage: jest.fn().mockResolvedValue({ users: mockUsers }),
        limit: 20
      }

      query.usersQuery = mockUsersQuery

      const dispatched = await runUserSaga(__userSagaTestables.loadMoreUsers, loadMoreUsersAC(50))

      // Should update limit
      expect(mockUsersQuery.limit).toBe(50)

      // Should dispatch loading state
      expect(dispatched).toContainEqual(
        expect.objectContaining({
          type: 'users/setUsersLoadingState',
          payload: { state: LOADING_STATE.LOADING }
        })
      )

      // Should dispatch addUsersAC (RTK: users/addUsers)
      expect(dispatched).toContainEqual(
        expect.objectContaining({
          type: 'users/addUsers',
          payload: { users: mockUsers }
        })
      )

      // Should dispatch loaded state
      expect(dispatched).toContainEqual(
        expect.objectContaining({
          type: 'users/setUsersLoadingState',
          payload: { state: LOADING_STATE.LOADED }
        })
      )
    })

    it('handles SDK error gracefully', async () => {
      const mockUsersQuery = {
        loadNextPage: jest.fn().mockRejectedValue({ code: 5000, message: 'Network error' }),
        limit: 20
      }

      query.usersQuery = mockUsersQuery

      // Should not throw
      const dispatched = await runUserSaga(__userSagaTestables.loadMoreUsers, loadMoreUsersAC(50))

      expect(dispatched).not.toContainEqual(
        expect.objectContaining({
          type: 'users/addUsers'
        })
      )
    })
  })

  describe('blockUser', () => {
    it('blocks user and dispatches success actions', async () => {
      const userToBlock = makeUser({ id: 'blocked-user', blocked: true })
      mockClient.blockUsers = jest.fn().mockResolvedValue([userToBlock])

      const callback = jest.fn()

      const dispatched = await runUserSaga(__userSagaTestables.blockUser, blockUserAC(['blocked-user'], callback))

      expect(mockClient.blockUsers).toHaveBeenCalledWith(['blocked-user'])

      // Should dispatch updateUserStatusOnMapAC (RTK: users/updateUserMap)
      expect(dispatched).toContainEqual(
        expect.objectContaining({
          type: 'users/updateUserMap',
          payload: expect.objectContaining({
            usersMap: expect.objectContaining({
              'blocked-user': expect.objectContaining({ blocked: true })
            })
          })
        })
      )

      // Should dispatch updateMembersPresenceAC
      expect(dispatched).toContainEqual(
        expect.objectContaining({
          type: 'members/updateMembersPresence',
          payload: expect.objectContaining({
            usersMap: expect.objectContaining({
              'blocked-user': expect.objectContaining({ blocked: true })
            })
          })
        })
      )

      // Should call callback with blocked users
      expect(callback).toHaveBeenCalledWith([userToBlock])
    })

    it('updates direct channel members when blocking', async () => {
      const userToBlock = makeUser({ id: 'blocked-user', blocked: true })
      mockClient.blockUsers = jest.fn().mockResolvedValue([userToBlock])

      const directChannel = makeChannel({
        id: 'direct-channel',
        type: DEFAULT_CHANNEL_TYPE.DIRECT,
        members: [
          makeMember(makeUser({ id: 'current-user' }), 'owner'),
          makeMember(makeUser({ id: 'blocked-user' }), 'member')
        ]
      })
      setChannelInMap(directChannel)
      setActiveChannelId('direct-channel')

      const dispatched = await runUserSaga(__userSagaTestables.blockUser, blockUserAC(['blocked-user']))

      // Should dispatch updateChannelDataAC with updated members
      expect(dispatched).toContainEqual(
        expect.objectContaining({
          type: 'channels/updateChannelData',
          payload: expect.objectContaining({
            channelId: 'direct-channel'
          })
        })
      )
    })

    it('handles SDK error and calls callback with error', async () => {
      const error = new Error('Block failed')
      mockClient.blockUsers = jest.fn().mockRejectedValue(error)

      const callback = jest.fn()

      // Should not throw
      const dispatched = await runUserSaga(__userSagaTestables.blockUser, blockUserAC(['blocked-user'], callback))

      // Should call callback with null and error
      expect(callback).toHaveBeenCalledWith(null, error)

      // Should not dispatch success actions
      expect(dispatched).not.toContainEqual(
        expect.objectContaining({
          type: 'users/updateUserMap'
        })
      )
    })
  })

  describe('unblockUser', () => {
    it('unblocks user and dispatches success actions', async () => {
      const userToUnblock = makeUser({ id: 'unblocked-user', blocked: false })
      mockClient.unblockUsers = jest.fn().mockResolvedValue([userToUnblock])

      const callback = jest.fn()

      const dispatched = await runUserSaga(__userSagaTestables.unblockUser, unblockUserAC(['unblocked-user'], callback))

      expect(mockClient.unblockUsers).toHaveBeenCalledWith(['unblocked-user'])

      // Should dispatch updateUserStatusOnMapAC
      expect(dispatched).toContainEqual(
        expect.objectContaining({
          type: 'users/updateUserMap',
          payload: expect.objectContaining({
            usersMap: expect.objectContaining({
              'unblocked-user': expect.objectContaining({ blocked: false })
            })
          })
        })
      )

      // Should dispatch updateMembersPresenceAC
      expect(dispatched).toContainEqual(
        expect.objectContaining({
          type: 'members/updateMembersPresence',
          payload: expect.objectContaining({
            usersMap: expect.objectContaining({
              'unblocked-user': expect.objectContaining({ blocked: false })
            })
          })
        })
      )

      // Should call callback with unblocked users
      expect(callback).toHaveBeenCalledWith([userToUnblock])
    })

    it('updates direct channel members when unblocking', async () => {
      const userToUnblock = makeUser({ id: 'unblocked-user', blocked: false })
      mockClient.unblockUsers = jest.fn().mockResolvedValue([userToUnblock])

      const directChannel = makeChannel({
        id: 'direct-channel',
        type: DEFAULT_CHANNEL_TYPE.DIRECT,
        members: [
          makeMember(makeUser({ id: 'current-user' }), 'owner'),
          makeMember(makeUser({ id: 'unblocked-user', blocked: true }), 'member')
        ]
      })
      setChannelInMap(directChannel)
      setActiveChannelId('direct-channel')

      const dispatched = await runUserSaga(__userSagaTestables.unblockUser, unblockUserAC(['unblocked-user']))

      // Should dispatch updateChannelDataAC with updated members
      expect(dispatched).toContainEqual(
        expect.objectContaining({
          type: 'channels/updateChannelData',
          payload: expect.objectContaining({
            channelId: 'direct-channel'
          })
        })
      )
    })

    it('handles SDK error and calls callback with error', async () => {
      const error = new Error('Unblock failed')
      mockClient.unblockUsers = jest.fn().mockRejectedValue(error)

      const callback = jest.fn()

      // Should not throw
      const dispatched = await runUserSaga(__userSagaTestables.unblockUser, unblockUserAC(['unblocked-user'], callback))

      // Should call callback with null and error
      expect(callback).toHaveBeenCalledWith(null, error)

      // Should not dispatch success actions
      expect(dispatched).not.toContainEqual(
        expect.objectContaining({
          type: 'users/updateUserMap'
        })
      )
    })
  })

  describe('updateProfile', () => {
    it('updates profile with firstName and lastName changes', async () => {
      const currentUser = makeUser({ id: 'current-user', firstName: 'Old', lastName: 'Name' })
      const updatedUser = makeUser({ id: 'current-user', firstName: 'New', lastName: 'Name' })
      mockClient.setProfile = jest.fn().mockResolvedValue(updatedUser)

      const dispatched = await runUserSaga(
        __userSagaTestables.updateProfile,
        updateProfileAC(currentUser, 'New', 'Name')
      )

      expect(mockClient.setProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'New'
        })
      )

      // Should dispatch updateUserProfileAC (RTK: users/updateUserProfile)
      expect(dispatched).toContainEqual(
        expect.objectContaining({
          type: 'users/updateUserProfile',
          payload: expect.objectContaining({
            profile: expect.objectContaining({
              firstName: 'New'
            })
          })
        })
      )
    })

    it('updates profile with avatarUrl change', async () => {
      const currentUser = makeUser({ id: 'current-user', avatarUrl: 'old-avatar.jpg' })
      const updatedUser = makeUser({ id: 'current-user', avatarUrl: 'new-avatar.jpg' })
      mockClient.setProfile = jest.fn().mockResolvedValue(updatedUser)

      const dispatched = await runUserSaga(
        __userSagaTestables.updateProfile,
        updateProfileAC(currentUser, undefined, undefined, 'new-avatar.jpg')
      )

      expect(mockClient.setProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          avatarUrl: 'new-avatar.jpg'
        })
      )

      expect(dispatched).toContainEqual(
        expect.objectContaining({
          type: 'users/updateUserProfile'
        })
      )
    })

    it('uploads avatar file and updates profile', async () => {
      const currentUser = makeUser({ id: 'current-user' })
      const updatedUser = makeUser({ id: 'current-user', avatarUrl: 'uploaded-avatar.jpg' })
      const mockFile = new File(['test'], 'avatar.png', { type: 'image/png' })

      mockClient.uploadFile = jest.fn().mockResolvedValue('uploaded-avatar.jpg')
      mockClient.setProfile = jest.fn().mockResolvedValue(updatedUser)

      const dispatched = await runUserSaga(
        __userSagaTestables.updateProfile,
        updateProfileAC(currentUser, undefined, undefined, undefined, undefined, mockFile)
      )

      expect(mockClient.uploadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          data: mockFile
        })
      )

      expect(mockClient.setProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          avatarUrl: 'uploaded-avatar.jpg'
        })
      )

      expect(dispatched).toContainEqual(
        expect.objectContaining({
          type: 'users/updateUserProfile'
        })
      )
    })

    it('updates profile with metadata change', async () => {
      const currentUser = makeUser({ id: 'current-user' })
      ;(currentUser as any).metadata = 'old-metadata'
      const updatedUser = makeUser({ id: 'current-user' })

      mockClient.setProfile = jest.fn().mockResolvedValue(updatedUser)

      const dispatched = await runUserSaga(
        __userSagaTestables.updateProfile,
        updateProfileAC(currentUser, undefined, undefined, undefined, 'new-metadata')
      )

      expect(mockClient.setProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: 'new-metadata'
        })
      )

      expect(dispatched).toContainEqual(
        expect.objectContaining({
          type: 'users/updateUserProfile'
        })
      )
    })

    it('does not update fields that have not changed', async () => {
      const currentUser = makeUser({ id: 'current-user', firstName: 'Same', lastName: 'Name' })
      const updatedUser = makeUser({ id: 'current-user', firstName: 'Same', lastName: 'Name' })
      mockClient.setProfile = jest.fn().mockResolvedValue(updatedUser)

      await runUserSaga(__userSagaTestables.updateProfile, updateProfileAC(currentUser, 'Same', 'Name'))

      // Should not include unchanged fields
      expect(mockClient.setProfile).toHaveBeenCalledWith({})
    })

    it('handles SDK error gracefully', async () => {
      const currentUser = makeUser({ id: 'current-user', firstName: 'Old' })
      mockClient.setProfile = jest.fn().mockRejectedValue(new Error('Update failed'))

      // Should not throw
      const dispatched = await runUserSaga(__userSagaTestables.updateProfile, updateProfileAC(currentUser, 'New'))

      // Should not dispatch success actions
      expect(dispatched).not.toContainEqual(
        expect.objectContaining({
          type: 'users/updateUserProfile'
        })
      )
    })
  })
})
