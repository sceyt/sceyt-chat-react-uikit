import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import Actions from './index'
import { DEFAULT_CHANNEL_TYPE, USER_STATE } from '../../../helpers/constants'
import { CONNECTION_STATUS } from '../../../store/user/constants'
import {
  createMessageListStore,
  makeChannel,
  makeUser,
  resetMessageListFixtureIds,
  renderWithSceytProvider
} from '../../../testUtils/messageListHarness'
import { makeMember } from '../../../testUtils/messageFixtures'
import { IRole } from '../../../types'
import { itFailing } from '../../../testUtils/itFailing'
import {
  leaveChannelAC,
  deleteChannelAC,
  blockChannelAC,
  clearHistoryAC,
  deleteAllMessagesAC,
  pinChannelAC,
  unpinChannelAC,
  markChannelAsReadAC,
  markChannelAsUnReadAC,
  turnOnNotificationsAC,
  setMessageRetentionPeriodAC
} from '../../../store/channel/actions'
import { blockUserAC, unblockUserAC } from '../../../store/user/actions'

// Mock hooks
jest.mock('../../../hooks', () => ({
  useColor: () => {
    const { THEME_COLORS } = require('../../../UIHelper/constants')
    return {
      [THEME_COLORS.ACCENT]: '#00aa88',
      [THEME_COLORS.TEXT_PRIMARY]: '#111111',
      [THEME_COLORS.TEXT_SECONDARY]: '#666666',
      [THEME_COLORS.ICON_PRIMARY]: '#333333',
      [THEME_COLORS.SURFACE_1]: '#f0f0f0',
      [THEME_COLORS.WARNING]: '#ff0000',
      [THEME_COLORS.BACKGROUND]: '#ffffff',
      [THEME_COLORS.TEXT_ON_PRIMARY]: '#ffffff'
    }
  },
  useDidUpdate: () => {},
  useEventListener: () => {},
  useStateComplex: (initialState: any) => [initialState, jest.fn()],
  useOnScreen: () => true,
  useUpdatedUser: (user: any) => user,
  useProgressiveMediaSource: (src: string) => src
}))

// Mock the client
jest.mock('../../../common/client', () => ({
  getClient: () => ({ user: { id: 'current-user' } })
}))

// Mock channel helpers
jest.mock('../../../helpers/channelHalper', () => ({
  getDisappearingSettings: () => ({ show: true }),
  getChannelTypesMemberDisplayTextMap: () => ({}),
  getDefaultRolesByChannelTypesMap: () => ({})
}))

// Mock userHelper
jest.mock('../../../helpers/userHelper', () => ({
  hideUserPresence: () => false
}))

// Mock helpers/index
jest.mock('../../../helpers', () => ({
  formatDisappearingMessageTime: (ms: number) => (ms ? `${ms / 1000}s` : 'Off')
}))

// Mock log
jest.mock('loglevel', () => ({
  info: jest.fn()
}))

// Mock Avatar
jest.mock('../../Avatar', () => ({
  __esModule: true,
  default: () => <div data-testid='avatar'>Avatar</div>
}))

// Mock GroupsInCommonPopup
jest.mock('common/popups/groupsInCommonPopup/indext', () => ({
  __esModule: true,
  default: ({ togglePopup }: { togglePopup: () => void }) => (
    <div data-testid='groups-in-common-popup'>
      <button onClick={togglePopup}>Close</button>
    </div>
  )
}))

// Mock DisappearingMessagesPopup
jest.mock('../../../common/popups/disappearingMessages', () => ({
  __esModule: true,
  default: ({
    togglePopup,
    handleSetTimer
  }: {
    togglePopup: () => void
    handleSetTimer: (timer: number | null) => void
  }) => (
    <div data-testid='disappearing-messages-popup'>
      <button onClick={() => handleSetTimer(3600)}>Set 1 hour</button>
      <button onClick={togglePopup}>Cancel</button>
    </div>
  )
}))

// Helper to create role definitions
const createRoles = (): IRole[] => [
  {
    name: 'owner',
    priority: 100,
    permissions: [
      'deleteChannel',
      'clearAllMessages',
      'addMember',
      'kickMember',
      'kickAndBlockMember',
      'changeMemberRole',
      'setDisappearingMessages'
    ]
  },
  {
    name: 'admin',
    priority: 80,
    permissions: [
      'clearAllMessages',
      'addMember',
      'kickMember',
      'kickAndBlockMember',
      'changeMemberRole',
      'setDisappearingMessages'
    ]
  },
  {
    name: 'participant',
    priority: 50,
    permissions: []
  },
  {
    name: 'subscriber',
    priority: 30,
    permissions: []
  },
  {
    name: 'custom_with_dm',
    priority: 40,
    permissions: ['setDisappearingMessages']
  }
]

const createRolesMap = (roles: IRole[]): { [key: string]: IRole } => {
  const map: { [key: string]: IRole } = {}
  roles.forEach((r) => {
    map[r.name] = r
  })
  return map
}

describe('Actions', () => {
  beforeEach(() => {
    resetMessageListFixtureIds()
  })

  const createTestStore = (overrides: any = {}) => {
    const roles = createRoles()
    return createMessageListStore({
      UserReducer: {
        connectionStatus: CONNECTION_STATUS.CONNECTED,
        contactsMap: {}
      },
      MembersReducer: {
        roles,
        rolesMap: createRolesMap(roles),
        channelsMembersMap: {},
        channelsMembersLoadingState: {},
        channelsMembersHasNextMap: {},
        getRolesFail: undefined,
        restricted: { isRestricted: false, fromChannel: false, members: [] },
        userBlockedForInvite: { show: false, userIds: [] },
        openInviteModal: false
      },
      ...overrides
    })
  }

  const currentUser = makeUser({ id: 'current-user' })
  const otherUser = makeUser({ id: 'other-user', firstName: 'Other', lastName: 'User' })

  // ─── Role/Channel-Type Matrix ─────────────────────────────────────────────

  describe('Role/Channel-Type Matrix', () => {
    const channelTypes = [
      { type: DEFAULT_CHANNEL_TYPE.DIRECT, label: 'direct' },
      { type: DEFAULT_CHANNEL_TYPE.GROUP, label: 'group' },
      { type: DEFAULT_CHANNEL_TYPE.PRIVATE, label: 'private' },
      { type: DEFAULT_CHANNEL_TYPE.BROADCAST, label: 'broadcast' },
      { type: DEFAULT_CHANNEL_TYPE.PUBLIC, label: 'public' }
    ]

    it.each(channelTypes)('$label channel: Leave is shown for non-direct channels only', ({ type }) => {
      const channel = makeChannel({
        type,
        userRole: 'participant',
        members: [makeMember(currentUser, 'participant'), makeMember(otherUser, 'admin')]
      })
      const store = createTestStore()

      renderWithSceytProvider(<Actions channel={channel} toggleable={false} />, { store })

      if (type === DEFAULT_CHANNEL_TYPE.DIRECT) {
        expect(screen.queryAllByText(/Leave/i)).toHaveLength(0)
      } else {
        // "Leave group" and "Block and Leave group" both contain "Leave"
        expect(screen.getAllByText(/Leave/i).length).toBeGreaterThan(0)
      }
    })

    it.each([
      ['owner', true],
      ['admin', false],
      ['participant', false],
      ['subscriber', false]
    ])('%s sees "Delete channel/group": %s', (role, visible) => {
      const channel = makeChannel({
        type: DEFAULT_CHANNEL_TYPE.BROADCAST,
        userRole: role,
        members: [makeMember(currentUser, role)]
      })
      const store = createTestStore()

      renderWithSceytProvider(<Actions channel={channel} toggleable={false} />, { store })

      expect(!!screen.queryByText(/Delete channel/i)).toBe(visible)
    })

    it.each([
      ['owner', true],
      ['admin', true],
      ['participant', false],
      ['subscriber', false]
    ])('%s sees "Clear history" on broadcast channel (clearAllMessages permission): %s', (role, visible) => {
      const channel = makeChannel({
        type: DEFAULT_CHANNEL_TYPE.BROADCAST,
        userRole: role,
        members: [makeMember(currentUser, role)]
      })
      const store = createTestStore()

      renderWithSceytProvider(<Actions channel={channel} toggleable={false} />, { store })

      expect(!!screen.queryByText(/Clear history/i)).toBe(visible)
    })

    it('group channel shows Clear history for all roles (no permission needed)', () => {
      const channel = makeChannel({
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'participant',
        members: [makeMember(currentUser, 'participant')]
      })
      const store = createTestStore()

      renderWithSceytProvider(<Actions channel={channel} toggleable={false} />, { store })

      expect(screen.getByText(/Clear history/i)).toBeInTheDocument()
    })
  })

  // ─── show* props hide items ───────────────────────────────────────────────

  describe('show* props hide items', () => {
    it('showMuteUnmuteNotifications=false hides Mute/Unmute', () => {
      const channel = makeChannel({
        type: DEFAULT_CHANNEL_TYPE.DIRECT,
        members: [makeMember(currentUser, 'owner'), makeMember(otherUser, 'member')]
      })
      const store = createTestStore()

      renderWithSceytProvider(<Actions channel={channel} toggleable={false} showMuteUnmuteNotifications={false} />, {
        store
      })

      expect(screen.queryByText(/Mute notifications/i)).not.toBeInTheDocument()
    })

    it('showPinChannel=false hides Pin/Unpin', () => {
      const channel = makeChannel({
        type: DEFAULT_CHANNEL_TYPE.DIRECT,
        members: [makeMember(currentUser, 'owner'), makeMember(otherUser, 'member')]
      })
      const store = createTestStore()

      renderWithSceytProvider(<Actions channel={channel} toggleable={false} showPinChannel={false} />, { store })

      expect(screen.queryByText(/^Pin$/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/^Unpin$/i)).not.toBeInTheDocument()
    })

    it('showMarkAsReadUnread=false hides Mark as read/unread', () => {
      const channel = makeChannel({
        type: DEFAULT_CHANNEL_TYPE.DIRECT,
        members: [makeMember(currentUser, 'owner'), makeMember(otherUser, 'member')]
      })
      const store = createTestStore()

      renderWithSceytProvider(<Actions channel={channel} toggleable={false} showMarkAsReadUnread={false} />, { store })

      expect(screen.queryByText(/Mark as read/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Mark as unread/i)).not.toBeInTheDocument()
    })

    it('showLeaveChannel=false hides Leave group', () => {
      const channel = makeChannel({
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'participant',
        members: [makeMember(currentUser, 'participant')]
      })
      const store = createTestStore()

      renderWithSceytProvider(<Actions channel={channel} toggleable={false} showLeaveChannel={false} />, { store })

      // "Leave group" should be hidden, but "Block and Leave group" may still be visible
      const leaveItems = screen.queryAllByText(/Leave group/i)
      // Filter to find standalone "Leave group" (not "Block and Leave group")
      const standaloneLeave = leaveItems.filter((el) => !el.textContent?.includes('Block'))
      expect(standaloneLeave).toHaveLength(0)
    })

    it('showBlockUser=false hides Block user in direct chat', () => {
      const channel = makeChannel({
        type: DEFAULT_CHANNEL_TYPE.DIRECT,
        members: [makeMember(currentUser, 'owner'), makeMember(otherUser, 'member')]
      })
      const store = createTestStore()

      renderWithSceytProvider(<Actions channel={channel} toggleable={false} showBlockUser={false} />, { store })

      expect(screen.queryByText(/Block user/i)).not.toBeInTheDocument()
    })

    it('showBlockAndLeaveChannel=false hides Block and Leave in group', () => {
      const channel = makeChannel({
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'participant',
        members: [makeMember(currentUser, 'participant')]
      })
      const store = createTestStore()

      renderWithSceytProvider(<Actions channel={channel} toggleable={false} showBlockAndLeaveChannel={false} />, {
        store
      })

      expect(screen.queryByText(/Block and Leave/i)).not.toBeInTheDocument()
    })

    it('showClearHistory=false hides Clear history', () => {
      const channel = makeChannel({
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'participant',
        members: [makeMember(currentUser, 'participant')]
      })
      const store = createTestStore()

      renderWithSceytProvider(<Actions channel={channel} toggleable={false} showClearHistory={false} />, { store })

      expect(screen.queryByText(/Clear history/i)).not.toBeInTheDocument()
    })

    it('showDeleteChannel=false hides Delete channel', () => {
      const channel = makeChannel({
        type: DEFAULT_CHANNEL_TYPE.BROADCAST,
        userRole: 'owner',
        members: [makeMember(currentUser, 'owner')]
      })
      const store = createTestStore()

      renderWithSceytProvider(<Actions channel={channel} toggleable={false} showDeleteChannel={false} />, { store })

      expect(screen.queryByText(/Delete channel/i)).not.toBeInTheDocument()
    })

    it('showGroupsInCommon=true shows Groups in common for direct chat', () => {
      const channel = makeChannel({
        type: DEFAULT_CHANNEL_TYPE.DIRECT,
        members: [makeMember(currentUser, 'owner'), makeMember(otherUser, 'member')]
      })
      const store = createTestStore()

      renderWithSceytProvider(<Actions channel={channel} toggleable={false} showGroupsInCommon={true} />, { store })

      expect(screen.getByText(/Groups in common/i)).toBeInTheDocument()
    })
  })

  // ─── Mock channels hide items ─────────────────────────────────────────────

  describe('Mock channels', () => {
    it('isMockChannel hides most action items', () => {
      const channel = makeChannel({
        type: DEFAULT_CHANNEL_TYPE.DIRECT,
        isMockChannel: true,
        members: [makeMember(currentUser, 'owner'), makeMember(otherUser, 'member')]
      })
      const store = createTestStore()

      renderWithSceytProvider(<Actions channel={channel} toggleable={false} />, { store })

      expect(screen.queryByText(/Mute notifications/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/^Pin$/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Mark as read/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Mark as unread/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Clear history/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Delete/i)).not.toBeInTheDocument()
    })
  })

  // ─── Direct chat with DELETED user ────────────────────────────────────────

  describe('Direct chat with DELETED user', () => {
    it('hides mute/unmute, pin, mark as read/unread, block user when other member is DELETED', () => {
      const deletedUser = makeUser({ id: 'deleted-user', state: USER_STATE.DELETED })
      const channel = makeChannel({
        type: DEFAULT_CHANNEL_TYPE.DIRECT,
        members: [makeMember(currentUser, 'owner'), makeMember(deletedUser, 'member')]
      })
      const store = createTestStore()

      renderWithSceytProvider(<Actions channel={channel} toggleable={false} />, { store })

      expect(screen.queryByText(/Mute notifications/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/^Pin$/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Mark as/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Block user/i)).not.toBeInTheDocument()
    })
  })

  // ─── Self chat ────────────────────────────────────────────────────────────

  describe('Self chat', () => {
    it('hides Block user and Groups in common for self chat', () => {
      const channel = makeChannel({
        type: DEFAULT_CHANNEL_TYPE.DIRECT,
        memberCount: 1,
        members: [makeMember(currentUser, 'owner')]
      })
      const store = createTestStore()

      renderWithSceytProvider(<Actions channel={channel} toggleable={false} showGroupsInCommon={true} />, { store })

      expect(screen.queryByText(/Block user/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Groups in common/i)).not.toBeInTheDocument()
    })

    it('hides mute/unmute and mark as read/unread for self chat', () => {
      const channel = makeChannel({
        type: DEFAULT_CHANNEL_TYPE.DIRECT,
        memberCount: 1,
        members: [makeMember(currentUser, 'owner')]
      })
      const store = createTestStore()

      renderWithSceytProvider(<Actions channel={channel} toggleable={false} />, { store })

      expect(screen.queryByText(/Mute notifications/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Mark as/i)).not.toBeInTheDocument()
    })
  })

  // ─── Action dispatches (synchronous) ──────────────────────────────────────

  describe('Action dispatches', () => {
    it('clicking Leave group opens confirm popup', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'participant',
        members: [makeMember(currentUser, 'participant')]
      })
      const store = createTestStore()

      renderWithSceytProvider(<Actions channel={channel} toggleable={false} />, { store })

      // Click Leave group (not "Block and Leave group")
      const leaveItems = screen.getAllByText(/Leave group/i)
      fireEvent.click(leaveItems[0])

      // Popup should appear with Leave button
      expect(screen.getByRole('button', { name: /Leave/i })).toBeInTheDocument()
    })

    it('clicking Delete channel opens confirm popup', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.BROADCAST,
        userRole: 'owner',
        members: [makeMember(currentUser, 'owner')]
      })
      const store = createTestStore()

      renderWithSceytProvider(<Actions channel={channel} toggleable={false} />, { store })

      fireEvent.click(screen.getByText(/Delete channel/i))

      expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument()
    })

    it('clicking Block and Leave opens confirm popup', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'participant',
        members: [makeMember(currentUser, 'participant')]
      })
      const store = createTestStore()

      renderWithSceytProvider(<Actions channel={channel} toggleable={false} />, { store })

      fireEvent.click(screen.getByText(/Block and Leave group/i))

      expect(screen.getByRole('button', { name: /Block/i })).toBeInTheDocument()
    })

    it('clicking Block user opens confirm popup', () => {
      const channel = makeChannel({
        type: DEFAULT_CHANNEL_TYPE.DIRECT,
        members: [makeMember(currentUser, 'owner'), makeMember(otherUser, 'member')]
      })
      const store = createTestStore()

      renderWithSceytProvider(<Actions channel={channel} toggleable={false} />, { store })

      fireEvent.click(screen.getByText(/Block user/i))

      expect(screen.getByRole('button', { name: /Block/i })).toBeInTheDocument()
    })

    it('Unblock user (no popup): dispatches unblockUserAC immediately', () => {
      const blockedUser = { ...otherUser, blocked: true }
      const channel = makeChannel({
        type: DEFAULT_CHANNEL_TYPE.DIRECT,
        members: [makeMember(currentUser, 'owner'), { ...makeMember(blockedUser, 'member'), blocked: true }]
      })
      const store = createTestStore()
      const dispatchSpy = jest.spyOn(store, 'dispatch')

      renderWithSceytProvider(<Actions channel={channel} toggleable={false} />, { store })

      fireEvent.click(screen.getByText(/Unblock user/i))

      const unblockAction = dispatchSpy.mock.calls.find((call) => call[0]?.type === unblockUserAC(['other-user']).type)
      expect(unblockAction).toBeDefined()
    })

    it('clicking Clear history opens confirm popup', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'participant',
        members: [makeMember(currentUser, 'participant')]
      })
      const store = createTestStore()

      renderWithSceytProvider(<Actions channel={channel} toggleable={false} />, { store })

      fireEvent.click(screen.getByText(/Clear history/i))

      expect(screen.getByRole('button', { name: /Clear/i })).toBeInTheDocument()
    })

    it('Pin: dispatches pinChannelAC', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.DIRECT,
        pinnedAt: null,
        members: [makeMember(currentUser, 'owner'), makeMember(otherUser, 'member')]
      })
      const store = createTestStore()
      const dispatchSpy = jest.spyOn(store, 'dispatch')

      renderWithSceytProvider(<Actions channel={channel} toggleable={false} />, { store })

      fireEvent.click(screen.getByText(/^Pin$/i))

      expect(dispatchSpy).toHaveBeenCalledWith(pinChannelAC('test-channel'))
    })

    it('Unpin: dispatches unpinChannelAC', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.DIRECT,
        pinnedAt: new Date(),
        members: [makeMember(currentUser, 'owner'), makeMember(otherUser, 'member')]
      })
      const store = createTestStore()
      const dispatchSpy = jest.spyOn(store, 'dispatch')

      renderWithSceytProvider(<Actions channel={channel} toggleable={false} />, { store })

      fireEvent.click(screen.getByText(/^Unpin$/i))

      expect(dispatchSpy).toHaveBeenCalledWith(unpinChannelAC('test-channel'))
    })

    it('Mark as read: dispatches markChannelAsReadAC', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.DIRECT,
        unread: true,
        members: [makeMember(currentUser, 'owner'), makeMember(otherUser, 'member')]
      })
      const store = createTestStore()
      const dispatchSpy = jest.spyOn(store, 'dispatch')

      renderWithSceytProvider(<Actions channel={channel} toggleable={false} />, { store })

      fireEvent.click(screen.getByText(/Mark as read/i))

      expect(dispatchSpy).toHaveBeenCalledWith(markChannelAsReadAC('test-channel'))
    })

    it('Mark as unread: dispatches markChannelAsUnReadAC', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.DIRECT,
        unread: false,
        members: [makeMember(currentUser, 'owner'), makeMember(otherUser, 'member')]
      })
      const store = createTestStore()
      const dispatchSpy = jest.spyOn(store, 'dispatch')

      renderWithSceytProvider(<Actions channel={channel} toggleable={false} />, { store })

      fireEvent.click(screen.getByText(/Mark as unread/i))

      expect(dispatchSpy).toHaveBeenCalledWith(markChannelAsUnReadAC('test-channel'))
    })

    it('Unmute: dispatches turnOnNotificationsAC', () => {
      const channel = makeChannel({
        type: DEFAULT_CHANNEL_TYPE.DIRECT,
        muted: true,
        members: [makeMember(currentUser, 'owner'), makeMember(otherUser, 'member')]
      })
      const store = createTestStore()
      const dispatchSpy = jest.spyOn(store, 'dispatch')

      renderWithSceytProvider(<Actions channel={channel} toggleable={false} />, { store })

      fireEvent.click(screen.getByText(/Unmute notifications/i))

      expect(dispatchSpy).toHaveBeenCalledWith(turnOnNotificationsAC())
    })

    it('Disappearing messages: opens popup', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.DIRECT,
        members: [makeMember(currentUser, 'owner'), makeMember(otherUser, 'member')]
      })
      const store = createTestStore()

      renderWithSceytProvider(<Actions channel={channel} toggleable={false} />, { store })

      fireEvent.click(screen.getByText(/Disappearing messages/i))

      expect(screen.getByTestId('disappearing-messages-popup')).toBeInTheDocument()
    })

    it('Disappearing messages: setting timer dispatches setMessageRetentionPeriodAC', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.DIRECT,
        members: [makeMember(currentUser, 'owner'), makeMember(otherUser, 'member')]
      })
      const store = createTestStore()
      const dispatchSpy = jest.spyOn(store, 'dispatch')

      renderWithSceytProvider(<Actions channel={channel} toggleable={false} />, { store })

      fireEvent.click(screen.getByText(/Disappearing messages/i))
      fireEvent.click(screen.getByText(/Set 1 hour/i))

      const dmAction = dispatchSpy.mock.calls.find(
        (call) =>
          call[0]?.type === setMessageRetentionPeriodAC('test-channel', 3600000).type &&
          call[0]?.payload?.channelId === 'test-channel'
      )
      expect(dmAction).toBeDefined()
    })

    it('Confirm popup: confirming Leave dispatches leaveChannelAC', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'participant',
        members: [makeMember(currentUser, 'participant')]
      })
      const store = createTestStore()
      const dispatchSpy = jest.spyOn(store, 'dispatch')

      renderWithSceytProvider(<Actions channel={channel} toggleable={false} />, { store })

      // Click Leave group (not "Block and Leave group")
      const leaveItems = screen.getAllByText(/Leave group/i)
      fireEvent.click(leaveItems[0])
      fireEvent.click(screen.getByRole('button', { name: /Leave/i }))

      expect(dispatchSpy).toHaveBeenCalledWith(leaveChannelAC('test-channel'))
    })

    it('Confirm popup: confirming Delete dispatches deleteChannelAC', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.BROADCAST,
        userRole: 'owner',
        members: [makeMember(currentUser, 'owner')]
      })
      const store = createTestStore()
      const dispatchSpy = jest.spyOn(store, 'dispatch')

      renderWithSceytProvider(<Actions channel={channel} toggleable={false} />, { store })

      fireEvent.click(screen.getByText(/Delete channel/i))
      fireEvent.click(screen.getByRole('button', { name: /Delete/i }))

      expect(dispatchSpy).toHaveBeenCalledWith(deleteChannelAC('test-channel'))
    })

    it('Confirm popup: confirming Block and Leave dispatches blockChannelAC', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'participant',
        members: [makeMember(currentUser, 'participant')]
      })
      const store = createTestStore()
      const dispatchSpy = jest.spyOn(store, 'dispatch')

      renderWithSceytProvider(<Actions channel={channel} toggleable={false} />, { store })

      fireEvent.click(screen.getByText(/Block and Leave group/i))
      fireEvent.click(screen.getByRole('button', { name: /Block/i }))

      expect(dispatchSpy).toHaveBeenCalledWith(blockChannelAC('test-channel'))
    })

    it('Confirm popup: confirming Block user dispatches blockUserAC', () => {
      const channel = makeChannel({
        type: DEFAULT_CHANNEL_TYPE.DIRECT,
        members: [makeMember(currentUser, 'owner'), makeMember(otherUser, 'member')]
      })
      const store = createTestStore()
      const dispatchSpy = jest.spyOn(store, 'dispatch')

      renderWithSceytProvider(<Actions channel={channel} toggleable={false} />, { store })

      fireEvent.click(screen.getByText(/Block user/i))
      fireEvent.click(screen.getByRole('button', { name: /Block/i }))

      const blockAction = dispatchSpy.mock.calls.find(
        (call) => call[0]?.type === blockUserAC(['other-user']).type && call[0]?.payload?.userIds?.[0] === 'other-user'
      )
      expect(blockAction).toBeDefined()
    })

    it('Confirm popup: confirming Clear history dispatches clearHistoryAC', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'participant',
        members: [makeMember(currentUser, 'participant')]
      })
      const store = createTestStore()
      const dispatchSpy = jest.spyOn(store, 'dispatch')

      renderWithSceytProvider(<Actions channel={channel} toggleable={false} />, { store })

      fireEvent.click(screen.getByText(/Clear history/i))
      fireEvent.click(screen.getByRole('button', { name: /Clear/i }))

      expect(dispatchSpy).toHaveBeenCalledWith(clearHistoryAC('test-channel'))
    })

    it('Confirm popup: confirming Delete all messages dispatches deleteAllMessagesAC', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.BROADCAST,
        userRole: 'owner',
        members: [makeMember(currentUser, 'owner')]
      })
      const store = createTestStore()
      const dispatchSpy = jest.spyOn(store, 'dispatch')

      renderWithSceytProvider(<Actions channel={channel} toggleable={false} />, { store })

      // There are two "Clear history" items, one for deleteAllMessages
      const clearHistoryItems = screen.getAllByText(/Clear history/i)
      fireEvent.click(clearHistoryItems[0])
      fireEvent.click(screen.getByRole('button', { name: /Clear/i }))

      const deleteAllAction = dispatchSpy.mock.calls.find(
        (call) => call[0]?.type === deleteAllMessagesAC('test-channel').type
      )
      expect(deleteAllAction).toBeDefined()
    })

    it('Confirm popup: cancelling does not dispatch', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'participant',
        members: [makeMember(currentUser, 'participant')]
      })
      const store = createTestStore()
      const dispatchSpy = jest.spyOn(store, 'dispatch')

      renderWithSceytProvider(<Actions channel={channel} toggleable={false} />, { store })

      // Find the Leave group item (not Block and Leave)
      const leaveItems = screen.getAllByText(/Leave group/i)
      fireEvent.click(leaveItems[0])
      const initialDispatchCount = dispatchSpy.mock.calls.length

      fireEvent.click(screen.getByRole('button', { name: /Cancel/i }))

      // No new dispatches for leave action
      const leaveAction = dispatchSpy.mock.calls
        .slice(initialDispatchCount)
        .find((call) => call[0]?.type === leaveChannelAC('test-channel').type)
      expect(leaveAction).toBeUndefined()
    })
  })

  // ─── Leave while offline ──────────────────────────────────────────────────

  describe('Leave while offline', () => {
    it('shows offline popup and does not dispatch leaveChannelAC', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'participant',
        members: [makeMember(currentUser, 'participant')]
      })
      const store = createTestStore({
        UserReducer: {
          connectionStatus: CONNECTION_STATUS.DISCONNECTED,
          contactsMap: {}
        }
      })
      const dispatchSpy = jest.spyOn(store, 'dispatch')

      renderWithSceytProvider(<Actions channel={channel} toggleable={false} />, { store })

      // Find the Leave group item (not Block and Leave)
      const leaveItems = screen.getAllByText(/Leave group/i)
      fireEvent.click(leaveItems[0])

      // Click confirm button
      fireEvent.click(screen.getByRole('button', { name: /Leave/i }))

      // Should NOT dispatch leaveChannelAC when offline
      const leaveAction = dispatchSpy.mock.calls.find((call) => call[0]?.type === leaveChannelAC('test-channel').type)
      expect(leaveAction).toBeUndefined()
    })
  })

  // ─── SUSPECTED BUG: Report channel does nothing ───────────────────────────

  describe('SUSPECTED BUG: Report channel', () => {
    /**
     * BUG: src/components/ChannelDetails/Actions/index.tsx:770-774
     * The "Report group/channel" handler is commented out and only logs.
     * Clicking it does nothing - no popup opens.
     */
    itFailing('showReportChannel=true on a group -> clicking "Report group" opens a report popup', () => {
      const channel = makeChannel({
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'participant',
        members: [makeMember(currentUser, 'participant')]
      })
      const store = createTestStore()

      renderWithSceytProvider(<Actions channel={channel} toggleable={false} showReportChannel={true} />, { store })

      // The item should be visible
      const reportItem = screen.getByText(/Report group/i)
      expect(reportItem).toBeInTheDocument()

      fireEvent.click(reportItem)

      // BUG: No popup opens - the handler only logs
      expect(screen.getByText(/report/i, { selector: '[role="dialog"]' })).toBeInTheDocument()
    })
  })

  // ─── SUSPECTED BUG: Disappearing messages uses hard-coded role ────────────

  describe('SUSPECTED BUG: Disappearing messages permission', () => {
    /**
     * BUG: src/components/ChannelDetails/Actions/index.tsx:268
     * hasPermissiontoSetDM = channel.userRole === 'admin' || channel.userRole === 'owner'
     * This is a hard-coded role check, not a permission check.
     * A custom role with setDisappearingMessages permission should be allowed,
     * but it won't be because only 'admin' and 'owner' strings are checked.
     */
    itFailing('custom role with setDisappearingMessages permission should see Disappearing messages', () => {
      const channel = makeChannel({
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'custom_with_dm',
        members: [makeMember(currentUser, 'custom_with_dm')]
      })
      const store = createTestStore()

      renderWithSceytProvider(<Actions channel={channel} toggleable={false} />, { store })

      // BUG: Disappearing messages won't show because userRole !== 'owner' && userRole !== 'admin'
      // even though the role has setDisappearingMessages permission
      expect(screen.getByText(/Disappearing messages/i)).toBeInTheDocument()
    })
  })

  // ─── REPORT: Direct chat with deleted/missing member ──────────────────────

  describe('REPORT: Direct chat with deleted/missing other member', () => {
    /**
     * When the other member in a direct chat is deleted or missing,
     * "Block and Leave chat" visibility needs verification.
     * Currently, direct chats with otherMembers.length === 1 show Block user,
     * but what if otherMembers.length === 0 (member deleted/missing)?
     */
    it('direct chat where other member is missing shows Block and Leave chat', () => {
      // If the other member is completely missing (not in members array)
      const channel = makeChannel({
        type: DEFAULT_CHANNEL_TYPE.DIRECT,
        memberCount: 2,
        members: [makeMember(currentUser, 'owner')] // other member missing
      })
      const store = createTestStore()

      renderWithSceytProvider(<Actions channel={channel} toggleable={false} />, { store })

      // With only current user in members, otherMembers.length === 0
      // This falls into the else branch which shows Block and Leave chat
      // which may not be appropriate for a direct chat
      const blockAndLeave = screen.queryByText(/Block and Leave chat/i)
      // Document the current behavior:
      expect(blockAndLeave).toBeInTheDocument() // This shows - may be incorrect for direct chat
    })
  })
})
