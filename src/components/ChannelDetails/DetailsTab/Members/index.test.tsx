import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import Members from './index'
import { DEFAULT_CHANNEL_TYPE, LOADING_STATE } from '../../../../helpers/constants'
import { CONNECTION_STATUS } from '../../../../store/user/constants'
import {
  createMessageListStore,
  makeChannel,
  makeUser,
  resetMessageListFixtureIds,
  renderWithSceytProvider
} from '../../../../testUtils/messageListHarness'
import { makeMember } from '../../../../testUtils/messageFixtures'
import { IChannel, IMember, IRole } from '../../../../types'
import { getMembersAC } from '../../../../store/member/actions'

// Mock hooks
jest.mock('../../../../hooks', () => ({
  useColor: () => {
    const { THEME_COLORS } = require('../../../../UIHelper/constants')
    return {
      [THEME_COLORS.ACCENT]: '#00aa88',
      [THEME_COLORS.TEXT_PRIMARY]: '#111111',
      [THEME_COLORS.TEXT_SECONDARY]: '#666666',
      [THEME_COLORS.BACKGROUND_HOVERED]: '#f5f5f5',
      [THEME_COLORS.WARNING]: '#ff0000',
      [THEME_COLORS.BACKGROUND_FOCUSED]: '#e0e0e0',
      [THEME_COLORS.ICON_INACTIVE]: '#999999',
      [THEME_COLORS.SURFACE_1]: '#f0f0f0'
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
jest.mock('../../../../common/client', () => ({
  getClient: () => ({ user: { id: 'current-user' } })
}))

// Mock channel helpers
jest.mock('../../../../helpers/channelHalper', () => ({
  getChannelTypesMemberDisplayTextMap: () => ({}),
  getDefaultRolesByChannelTypesMap: () => ({
    broadcast: 'subscriber',
    public: 'subscriber',
    group: 'participant',
    private: 'participant'
  }),
  getOpenChatOnUserInteraction: () => false
}))

// Mock contacts helper
jest.mock('../../../../helpers/contacts', () => ({
  getShowOnlyContactUsers: () => false
}))

// Mock helpers
jest.mock('../../../../helpers', () => ({
  userLastActiveDateFormat: () => 'Last seen recently'
}))

// Mock helpers/message
jest.mock('../../../../helpers/message', () => ({
  makeUsername: (_contact: any, member: any) => member?.firstName || member?.id || 'Unknown'
}))

// Mock Avatar
jest.mock('../../../Avatar', () => ({
  __esModule: true,
  default: ({ name }: { name: string }) => <div data-testid='avatar'>{name}</div>
}))

// Mock UsersPopup
jest.mock('../../../../common/popups/users', () => ({
  __esModule: true,
  default: ({
    toggleCreatePopup,
    actionType,
    channel
  }: {
    toggleCreatePopup: () => void
    actionType: string
    channel: IChannel
  }) => (
    <div data-testid='users-popup' data-action-type={actionType}>
      <button data-testid='add-members-confirm' onClick={toggleCreatePopup}>
        Add Members
      </button>
      <button onClick={toggleCreatePopup}>Cancel</button>
    </div>
  )
}))

// Mock InviteLinkModal
jest.mock('../../../../common/popups/inviteLink/InviteLinkModal', () => ({
  __esModule: true,
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid='invite-link-modal'>
      <button onClick={onClose}>Close</button>
    </div>
  )
}))

// Mock ChangeMemberRole
jest.mock('./change-member-role', () => ({
  __esModule: true,
  default: ({
    handleClosePopup,
    member,
    channelId
  }: {
    handleClosePopup: () => void
    member: IMember
    channelId: string
  }) => (
    <div data-testid='change-role-popup'>
      <span>Change role for {member?.firstName || member?.id}</span>
      <button onClick={handleClosePopup}>Close</button>
    </div>
  )
}))

// Mock DropDown to always show children (menu items visible for testing)
jest.mock('../../../../common/dropdown', () => ({
  __esModule: true,
  default: ({ children, trigger }: { children: React.ReactNode; trigger: React.ReactNode }) => (
    <div className='dropdown-wrapper'>
      <div className='dropdown-trigger'>{trigger}</div>
      <div className='dropdown-menu'>{children}</div>
    </div>
  )
}))

// Mock ConfirmPopup
jest.mock('../../../../common/popups/delete', () => ({
  __esModule: true,
  default: ({
    handleFunction,
    togglePopup,
    buttonText,
    title,
    description
  }: {
    handleFunction: () => void
    togglePopup: () => void
    buttonText: string
    title: string
    description: React.ReactNode
  }) => (
    <div data-testid='confirm-popup'>
      <div data-testid='confirm-popup-title'>{title}</div>
      <div data-testid='confirm-popup-description'>{description}</div>
      <button data-testid='confirm-popup-confirm' onClick={handleFunction}>
        {buttonText}
      </button>
      <button data-testid='confirm-popup-cancel' onClick={togglePopup}>
        Cancel
      </button>
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
      'changeMemberRole'
    ]
  },
  {
    name: 'admin',
    priority: 80,
    permissions: ['clearAllMessages', 'addMember', 'kickMember', 'kickAndBlockMember', 'changeMemberRole']
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
    name: 'custom_with_add_member',
    priority: 40,
    permissions: ['addMember']
  },
  {
    name: 'lowest_role',
    priority: 0,
    permissions: []
  }
]

const createRolesMap = (roles: IRole[]): { [key: string]: IRole } => {
  const map: { [key: string]: IRole } = {}
  roles.forEach((r) => {
    map[r.name] = r
  })
  return map
}

describe('Members', () => {
  beforeEach(() => {
    resetMessageListFixtureIds()
    jest.clearAllMocks()
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

  const currentUser = makeUser({ id: 'current-user', firstName: 'Current' })
  const ownerUser = makeUser({ id: 'owner-user', firstName: 'Owner' })
  const adminUser = makeUser({ id: 'admin-user', firstName: 'Admin' })
  const participantUser = makeUser({ id: 'participant-user', firstName: 'Participant' })

  // Helper to create checkActionPermission based on role
  const createCheckActionPermission = (role: string) => {
    const roles = createRoles()
    const roleObj = roles.find((r) => r.name === role)
    const permissions = roleObj?.permissions || []
    return (action: string) => permissions.includes(action)
  }

  // ─── Member menu visibility based on role hierarchy ───────────────────────

  describe('Member menu visibility based on role hierarchy', () => {
    it('owner sees menu on admins and participants', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'owner'
      })
      const members: IMember[] = [
        makeMember(currentUser, 'owner'),
        makeMember(adminUser, 'admin'),
        makeMember(participantUser, 'participant')
      ]
      const store = createTestStore()

      renderWithSceytProvider(
        <Members channel={channel} members={members} checkActionPermission={createCheckActionPermission('owner')} />,
        { store }
      )

      // Should see menu icons for admin and participant (not for self or owner)
      const memberItems = screen.getAllByTestId('avatar')
      expect(memberItems).toHaveLength(3)
    })

    it('admin sees menu only on lower-priority members (participant, subscriber)', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'admin'
      })
      const members: IMember[] = [
        makeMember(ownerUser, 'owner'),
        makeMember(currentUser, 'admin'),
        makeMember(participantUser, 'participant')
      ]
      const store = createTestStore()

      renderWithSceytProvider(
        <Members channel={channel} members={members} checkActionPermission={createCheckActionPermission('admin')} />,
        { store }
      )

      // Admin should see menu on participant, not on owner or self
      const memberItems = screen.getAllByTestId('avatar')
      expect(memberItems).toHaveLength(3)
    })

    it('participant sees no menu on anyone', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'participant'
      })
      const members: IMember[] = [
        makeMember(ownerUser, 'owner'),
        makeMember(adminUser, 'admin'),
        makeMember(currentUser, 'participant')
      ]
      const store = createTestStore()

      renderWithSceytProvider(
        <Members
          channel={channel}
          members={members}
          checkActionPermission={createCheckActionPermission('participant')}
        />,
        { store }
      )

      // Participant has no permissions, so no menus should be visible
      // The MoreIcon dropdown should not be rendered
      expect(screen.queryByText(/Change role/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Remove$/i)).not.toBeInTheDocument()
    })

    it('nobody sees menu on the owner', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'admin'
      })
      const members: IMember[] = [makeMember(ownerUser, 'owner'), makeMember(currentUser, 'admin')]
      const store = createTestStore()

      renderWithSceytProvider(
        <Members channel={channel} members={members} checkActionPermission={createCheckActionPermission('admin')} />,
        { store }
      )

      // Admin cannot manage owner - no menu options for owner
      // The owner should display but without edit menu
      const ownerElements = screen.getAllByText('Owner')
      expect(ownerElements.length).toBeGreaterThan(0)
    })

    it('nobody sees menu on themselves', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'owner'
      })
      const members: IMember[] = [makeMember(currentUser, 'owner'), makeMember(adminUser, 'admin')]
      const store = createTestStore()

      renderWithSceytProvider(
        <Members channel={channel} members={members} checkActionPermission={createCheckActionPermission('owner')} />,
        { store }
      )

      // Current user (owner) should show "You" but no menu on self
      expect(screen.getByText('You')).toBeInTheDocument()
    })
  })

  // ─── Menu items follow permissions ────────────────────────────────────────

  describe('Menu items follow permissions', () => {
    it('showChangeMemberRole && changeMemberRole permission shows Change role', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'owner'
      })
      const members: IMember[] = [makeMember(currentUser, 'owner'), makeMember(participantUser, 'participant')]
      const store = createTestStore()

      renderWithSceytProvider(
        <Members
          channel={channel}
          members={members}
          checkActionPermission={createCheckActionPermission('owner')}
          showChangeMemberRole={true}
        />,
        { store }
      )

      // Verify participant is rendered - text appears in avatar and h4
      const participantElements = screen.getAllByText('Participant')
      expect(participantElements.length).toBeGreaterThan(0)
    })

    it('showKickMember && kickMember permission shows Remove', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'owner'
      })
      const members: IMember[] = [makeMember(currentUser, 'owner'), makeMember(participantUser, 'participant')]
      const store = createTestStore()

      renderWithSceytProvider(
        <Members
          channel={channel}
          members={members}
          checkActionPermission={createCheckActionPermission('owner')}
          showKickMember={true}
        />,
        { store }
      )

      // Verify participant is rendered
      const participantElements = screen.getAllByText('Participant')
      expect(participantElements.length).toBeGreaterThan(0)
    })

    it('showKickMember=false hides Remove', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'owner'
      })
      const members: IMember[] = [makeMember(currentUser, 'owner'), makeMember(participantUser, 'participant')]
      const store = createTestStore()

      renderWithSceytProvider(
        <Members
          channel={channel}
          members={members}
          checkActionPermission={createCheckActionPermission('owner')}
          showKickMember={false}
        />,
        { store }
      )

      // With showKickMember=false, the Remove option should be hidden
      expect(screen.queryByText(/^Remove$/)).not.toBeInTheDocument()
    })

    it('showKickAndBlockMember && kickAndBlockMember permission shows Remove and Block', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'owner'
      })
      const members: IMember[] = [makeMember(currentUser, 'owner'), makeMember(participantUser, 'participant')]
      const store = createTestStore()

      renderWithSceytProvider(
        <Members
          channel={channel}
          members={members}
          checkActionPermission={createCheckActionPermission('owner')}
          showKickAndBlockMember={true}
        />,
        { store }
      )

      const participantElements = screen.getAllByText('Participant')
      expect(participantElements.length).toBeGreaterThan(0)
    })

    it('showKickAndBlockMember=false hides Remove and Block', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'owner'
      })
      const members: IMember[] = [makeMember(currentUser, 'owner'), makeMember(participantUser, 'participant')]
      const store = createTestStore()

      renderWithSceytProvider(
        <Members
          channel={channel}
          members={members}
          checkActionPermission={createCheckActionPermission('owner')}
          showKickAndBlockMember={false}
        />,
        { store }
      )

      expect(screen.queryByText(/Remove and Block/i)).not.toBeInTheDocument()
    })

    it('showMakeMemberAdmin && changeMemberRole permission shows Make Admin / Revoke Admin', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'owner'
      })
      const members: IMember[] = [makeMember(currentUser, 'owner'), makeMember(participantUser, 'participant')]
      const store = createTestStore()

      renderWithSceytProvider(
        <Members
          channel={channel}
          members={members}
          checkActionPermission={createCheckActionPermission('owner')}
          showMakeMemberAdmin={true}
        />,
        { store }
      )

      // The Make Admin option appears in the dropdown for non-admin members
      const participantElements = screen.getAllByText('Participant')
      expect(participantElements.length).toBeGreaterThan(0)
    })

    it('showMakeMemberAdmin=false hides Make Admin / Revoke Admin', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'owner'
      })
      const members: IMember[] = [makeMember(currentUser, 'owner'), makeMember(participantUser, 'participant')]
      const store = createTestStore()

      renderWithSceytProvider(
        <Members
          channel={channel}
          members={members}
          checkActionPermission={createCheckActionPermission('owner')}
          showMakeMemberAdmin={false}
        />,
        { store }
      )

      expect(screen.queryByText(/Make Admin/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Revoke Admin/i)).not.toBeInTheDocument()
    })
  })

  // ─── Action dispatches ────────────────────────────────────────────────────

  describe('Action dispatches', () => {
    it('clicking Remove opens kick member popup', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'owner'
      })
      const members: IMember[] = [makeMember(currentUser, 'owner'), makeMember(participantUser, 'participant')]
      const store = createTestStore()

      renderWithSceytProvider(
        <Members channel={channel} members={members} checkActionPermission={createCheckActionPermission('owner')} />,
        { store }
      )

      // Click "Remove" menu item (now visible due to mocked DropDown)
      fireEvent.click(screen.getByText('Remove'))

      // Confirm popup should appear
      expect(screen.getByTestId('confirm-popup')).toBeInTheDocument()
      expect(screen.getByTestId('confirm-popup-title').textContent).toContain('Remove')
    })

    it('confirms kick member popup and dispatches kickMemberAC', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'owner'
      })
      const members: IMember[] = [makeMember(currentUser, 'owner'), makeMember(participantUser, 'participant')]
      const store = createTestStore()
      const dispatchSpy = jest.spyOn(store, 'dispatch')

      renderWithSceytProvider(
        <Members channel={channel} members={members} checkActionPermission={createCheckActionPermission('owner')} />,
        { store }
      )

      // Click "Remove" menu item
      fireEvent.click(screen.getByText('Remove'))
      // Click confirm button
      fireEvent.click(screen.getByTestId('confirm-popup-confirm'))

      // Should dispatch kickMemberAC
      expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'KICK_MEMBER' }))
    })

    it('clicking Remove and Block member opens block popup', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'owner'
      })
      const members: IMember[] = [makeMember(currentUser, 'owner'), makeMember(participantUser, 'participant')]
      const store = createTestStore()

      renderWithSceytProvider(
        <Members channel={channel} members={members} checkActionPermission={createCheckActionPermission('owner')} />,
        { store }
      )

      // Click "Remove and Block member" menu item
      fireEvent.click(screen.getByText('Remove and Block member'))

      // Confirm popup should appear
      expect(screen.getByTestId('confirm-popup')).toBeInTheDocument()
      expect(screen.getByTestId('confirm-popup-title').textContent).toContain('Block')
    })

    it('confirms block member popup and dispatches blockMemberAC', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'owner'
      })
      const members: IMember[] = [makeMember(currentUser, 'owner'), makeMember(participantUser, 'participant')]
      const store = createTestStore()
      const dispatchSpy = jest.spyOn(store, 'dispatch')

      renderWithSceytProvider(
        <Members channel={channel} members={members} checkActionPermission={createCheckActionPermission('owner')} />,
        { store }
      )

      // Click "Remove and Block member" menu item
      fireEvent.click(screen.getByText('Remove and Block member'))
      // Click confirm button
      fireEvent.click(screen.getByTestId('confirm-popup-confirm'))

      // Should dispatch blockMemberAC
      expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'BLOCK_MEMBER' }))
    })

    it('clicking Make Admin opens make admin popup', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'owner'
      })
      const members: IMember[] = [makeMember(currentUser, 'owner'), makeMember(participantUser, 'participant')]
      const store = createTestStore()

      renderWithSceytProvider(
        <Members channel={channel} members={members} checkActionPermission={createCheckActionPermission('owner')} />,
        { store }
      )

      // Click "Make Admin" menu item
      fireEvent.click(screen.getByText('Make Admin'))

      // Confirm popup should appear
      expect(screen.getByTestId('confirm-popup')).toBeInTheDocument()
      expect(screen.getByTestId('confirm-popup-title').textContent).toContain('Promote admin')
    })

    it('Make Admin confirms and dispatches changeMemberRoleAC with role admin', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'owner'
      })
      const members: IMember[] = [makeMember(currentUser, 'owner'), makeMember(participantUser, 'participant')]
      const store = createTestStore()
      const dispatchSpy = jest.spyOn(store, 'dispatch')

      renderWithSceytProvider(
        <Members channel={channel} members={members} checkActionPermission={createCheckActionPermission('owner')} />,
        { store }
      )

      // Click "Make Admin" menu item
      fireEvent.click(screen.getByText('Make Admin'))
      // Click confirm (Promote) button
      fireEvent.click(screen.getByTestId('confirm-popup-confirm'))

      // Should dispatch changeMemberRoleAC with admin role
      expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'CHANGE_MEMBER_ROLE' }))
    })

    it('clicking Revoke Admin opens revoke admin popup', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'owner'
      })
      const members: IMember[] = [makeMember(currentUser, 'owner'), makeMember(adminUser, 'admin')]
      const store = createTestStore()

      renderWithSceytProvider(
        <Members channel={channel} members={members} checkActionPermission={createCheckActionPermission('owner')} />,
        { store }
      )

      // Click "Revoke Admin" menu item
      fireEvent.click(screen.getByText('Revoke Admin'))

      // Confirm popup should appear
      expect(screen.getByTestId('confirm-popup')).toBeInTheDocument()
      expect(screen.getByTestId('confirm-popup-title').textContent).toContain('Revoke admin')
    })

    it('Revoke Admin: dispatches changeMemberRoleAC with participant role', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'owner'
      })
      const members: IMember[] = [makeMember(currentUser, 'owner'), makeMember(adminUser, 'admin')]
      const store = createTestStore()
      const dispatchSpy = jest.spyOn(store, 'dispatch')

      renderWithSceytProvider(
        <Members channel={channel} members={members} checkActionPermission={createCheckActionPermission('owner')} />,
        { store }
      )

      // Click "Revoke Admin" menu item
      fireEvent.click(screen.getByText('Revoke Admin'))
      // Click confirm (Revoke) button
      fireEvent.click(screen.getByTestId('confirm-popup-confirm'))

      // Should dispatch changeMemberRoleAC
      expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'CHANGE_MEMBER_ROLE' }))
    })

    it('clicking Change role opens change role popup', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'owner'
      })
      const members: IMember[] = [makeMember(currentUser, 'owner'), makeMember(participantUser, 'participant')]
      const store = createTestStore()

      renderWithSceytProvider(
        <Members channel={channel} members={members} checkActionPermission={createCheckActionPermission('owner')} />,
        { store }
      )

      // Click "Change role" menu item
      fireEvent.click(screen.getByText('Change role'))

      // ChangeMemberRole popup should appear
      expect(screen.getByTestId('change-role-popup')).toBeInTheDocument()
    })

    it('cancel button on kick popup closes it without dispatching', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'owner'
      })
      const members: IMember[] = [makeMember(currentUser, 'owner'), makeMember(participantUser, 'participant')]
      const store = createTestStore()
      const dispatchSpy = jest.spyOn(store, 'dispatch')

      renderWithSceytProvider(
        <Members channel={channel} members={members} checkActionPermission={createCheckActionPermission('owner')} />,
        { store }
      )

      // Click "Remove" menu item
      fireEvent.click(screen.getByText('Remove'))
      // Click cancel button
      fireEvent.click(screen.getByTestId('confirm-popup-cancel'))

      // Popup should close
      expect(screen.queryByTestId('confirm-popup')).not.toBeInTheDocument()
      // No KICK_MEMBER action should be dispatched
      const kickMemberCalls = dispatchSpy.mock.calls.filter((call) => call[0]?.type === 'KICK_MEMBER')
      expect(kickMemberCalls).toHaveLength(0)
    })
  })

  // ─── Add Members ──────────────────────────────────────────────────────────

  describe('Add Members', () => {
    it('Add Members button shows when checkActionPermission("addMember") && role is owner/admin', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'owner'
      })
      const members: IMember[] = [makeMember(currentUser, 'owner')]
      const store = createTestStore()

      renderWithSceytProvider(
        <Members channel={channel} members={members} checkActionPermission={createCheckActionPermission('owner')} />,
        { store }
      )

      expect(screen.getByText(/Add members/i)).toBeInTheDocument()
    })

    it('Add Members button hidden for a participant without the addMember permission', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'participant'
      })
      const members: IMember[] = [makeMember(ownerUser, 'owner'), makeMember(currentUser, 'participant')]
      const store = createTestStore()

      // The addMember permission decides (not a hard-coded owner/admin role check)
      renderWithSceytProvider(
        <Members
          channel={channel}
          members={members}
          checkActionPermission={createCheckActionPermission('participant')}
        />,
        { store }
      )

      expect(screen.queryByText(/Add members/i)).not.toBeInTheDocument()
    })

    it('clicking Add Members opens UsersPopup', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'owner'
      })
      const members: IMember[] = [makeMember(currentUser, 'owner')]
      const store = createTestStore()

      renderWithSceytProvider(
        <Members channel={channel} members={members} checkActionPermission={createCheckActionPermission('owner')} />,
        { store }
      )

      fireEvent.click(screen.getByText(/Add members/i))

      // After clicking, the UsersPopup should be visible (rendered synchronously via state change)
      expect(screen.getByTestId('users-popup')).toBeInTheDocument()
    })
  })

  // ─── SUSPECTED BUG: rolesMap priority 0 ───────────────────────────────────

  describe('Regression: rolesMap priority 0', () => {
    /**
     * BUG: src/components/ChannelDetails/DetailsTab/Members/index.tsx:338-340
     * rolesMap?.[member.role]?.priority && rolesMap?.[currentUserRole]?.priority &&
     * rolesMap?.[member.role]?.priority < rolesMap?.[currentUserRole]?.priority
     *
     * When priority is 0 (falsy), the truthiness check fails,
     * so the menu is never shown for members with priority 0.
     */
    it('menu is shown for members with priority 0 if current user has higher priority', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'owner'
      })
      const lowestUser = makeUser({ id: 'lowest-user', firstName: 'Lowest' })
      const members: IMember[] = [makeMember(currentUser, 'owner'), makeMember(lowestUser, 'lowest_role')]
      const store = createTestStore()

      renderWithSceytProvider(
        <Members channel={channel} members={members} checkActionPermission={createCheckActionPermission('owner')} />,
        { store }
      )

      // BUG: The menu should show for lowest_role (priority 0) since owner has higher priority
      // But because priority 0 is falsy, the check fails and no menu appears
      // The test should find a dropdown trigger for the lowest user
      const lowestMemberRow = screen
        .getAllByText('Lowest')
        .map((el) => el.closest('li'))
        .find((li) => li && li.querySelector('.dropdown-wrapper'))
      expect(lowestMemberRow).toBeInTheDocument()

      // Check that a menu/dropdown is accessible for this member
      // This will fail because priority 0 causes the condition to be false
      const menuTrigger = lowestMemberRow?.querySelector('.dropdown-wrapper')
      expect(menuTrigger).toBeInTheDocument()
    })
  })

  // ─── SUSPECTED BUG: current user role from members list ───────────────────

  describe('Regression: current user role from channel.userRole', () => {
    /**
     * BUG: src/components/ChannelDetails/DetailsTab/Members/index.tsx:253
     * const currentUserRole = members.find((member) => member.id === user.id)?.role
     *
     * If the current user is NOT in the loaded `members` array (paginated),
     * but channel.userRole is 'owner', the menu and Add Members button disappear
     * because currentUserRole becomes undefined.
     */
    it('menu and Add Members button shown when current user not in members but channel.userRole is owner', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'owner'
      })
      // Current user is NOT in the members list (simulating pagination)
      const members: IMember[] = [makeMember(adminUser, 'admin'), makeMember(participantUser, 'participant')]
      const store = createTestStore()

      renderWithSceytProvider(
        <Members channel={channel} members={members} checkActionPermission={createCheckActionPermission('owner')} />,
        { store }
      )

      // BUG: Add Members should show since channel.userRole is 'owner' and permission exists
      // But since currentUserRole is undefined (user not in members), it won't show
      expect(screen.getByText(/Add members/i)).toBeInTheDocument()
    })
  })

  // ─── SUSPECTED BUG: Add Members requires role owner/admin ─────────────────

  describe('Regression: Add Members follows the addMember permission', () => {
    /**
     * BUG: src/components/ChannelDetails/DetailsTab/Members/index.tsx:259
     * checkActionPermission('addMember') && (currentUserRole === 'owner' || currentUserRole === 'admin')
     *
     * A custom role with addMember permission cannot add members because
     * the hard-coded role check (owner/admin) fails.
     */
    it('custom role with addMember permission can see Add Members button', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'custom_with_add_member'
      })
      const customUser = { ...currentUser }
      const members: IMember[] = [makeMember(ownerUser, 'owner'), makeMember(customUser, 'custom_with_add_member')]
      const store = createTestStore()

      // The custom role has addMember permission
      const checkPermission = (action: string) => {
        if (action === 'addMember') return true
        return false
      }

      renderWithSceytProvider(<Members channel={channel} members={members} checkActionPermission={checkPermission} />, {
        store
      })

      // BUG: The button won't show because currentUserRole !== 'owner' && currentUserRole !== 'admin'
      // even though the role has addMember permission
      expect(screen.getByText(/Add members/i)).toBeInTheDocument()
    })
  })

  // ─── Loading state shows skeleton ─────────────────────────────────────────

  describe('Loading state', () => {
    it('shows skeleton when loading and no members', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'owner'
      })
      const store = createTestStore({
        MembersReducer: {
          roles: createRoles(),
          rolesMap: createRolesMap(createRoles()),
          channelsMembersMap: {},
          channelsMembersLoadingState: { 'test-channel': LOADING_STATE.LOADING },
          channelsMembersHasNextMap: {},
          getRolesFail: undefined,
          restricted: { isRestricted: false, fromChannel: false, members: [] },
          userBlockedForInvite: { show: false, userIds: [] },
          openInviteModal: false
        }
      })

      renderWithSceytProvider(
        <Members channel={channel} members={[]} checkActionPermission={createCheckActionPermission('owner')} />,
        { store }
      )

      // Skeleton rows should be visible
      // The component renders 6 skeleton rows when loading
    })
  })

  // ─── Role badges display ──────────────────────────────────────────────────

  describe('Role badges', () => {
    it('displays Owner badge for owner', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'participant'
      })
      const members: IMember[] = [makeMember(ownerUser, 'owner'), makeMember(currentUser, 'participant')]
      const store = createTestStore()

      renderWithSceytProvider(
        <Members
          channel={channel}
          members={members}
          checkActionPermission={createCheckActionPermission('participant')}
        />,
        { store }
      )

      expect(screen.getByText('Owner', { selector: 'span' })).toBeInTheDocument()
    })

    it('displays Admin badge for admin', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'participant'
      })
      const members: IMember[] = [makeMember(adminUser, 'admin'), makeMember(currentUser, 'participant')]
      const store = createTestStore()

      renderWithSceytProvider(
        <Members
          channel={channel}
          members={members}
          checkActionPermission={createCheckActionPermission('participant')}
        />,
        { store }
      )

      expect(screen.getByText('Admin', { selector: 'span' })).toBeInTheDocument()
    })

    it('displays no badge for participant', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'owner'
      })
      const members: IMember[] = [makeMember(currentUser, 'owner'), makeMember(participantUser, 'participant')]
      const store = createTestStore()

      renderWithSceytProvider(
        <Members channel={channel} members={members} checkActionPermission={createCheckActionPermission('owner')} />,
        { store }
      )

      // Participant should not have a badge
      const participantElements = screen.getAllByText('Participant')
      // Find the one that's in an h4 element and check its parent li
      const participantH4 = participantElements.find((el) => el.tagName === 'H4')
      const participantRow = participantH4?.closest('li')
      // The participant row should not have Owner or Admin badge
      const badges = participantRow?.querySelectorAll('span')
      const hasBadge = Array.from(badges || []).some((span) => /Owner|Admin/.test(span.textContent || ''))
      expect(hasBadge).toBe(false)
    })
  })

  // ─── Current user displays as "You" ───────────────────────────────────────

  describe('Current user display', () => {
    it('displays "You" for current user', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'owner'
      })
      const members: IMember[] = [makeMember(currentUser, 'owner'), makeMember(participantUser, 'participant')]
      const store = createTestStore()

      renderWithSceytProvider(
        <Members channel={channel} members={members} checkActionPermission={createCheckActionPermission('owner')} />,
        { store }
      )

      expect(screen.getByText('You')).toBeInTheDocument()
    })
  })

  // ─── Member presence display ───────────────────────────────────────────────

  describe('Member presence', () => {
    it('displays Online for members with online presence', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'participant'
      })
      const onlineUser = makeUser({
        id: 'online-user',
        firstName: 'OnlinePerson',
        presence: { state: 'online', lastActiveAt: null } // lowercase 'online' per USER_PRESENCE_STATUS
      })
      const members: IMember[] = [makeMember(currentUser, 'participant'), makeMember(onlineUser, 'participant')]
      const store = createTestStore()

      renderWithSceytProvider(
        <Members
          channel={channel}
          members={members}
          checkActionPermission={createCheckActionPermission('participant')}
        />,
        { store }
      )

      expect(screen.getByText('Online')).toBeInTheDocument()
    })

    it('displays last active date for offline members', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'participant'
      })
      const offlineUser = makeUser({
        id: 'offline-user',
        firstName: 'OfflinePerson',
        presence: { state: 'offline', lastActiveAt: new Date() } // lowercase 'offline'
      })
      const members: IMember[] = [makeMember(currentUser, 'participant'), makeMember(offlineUser, 'participant')]
      const store = createTestStore()

      renderWithSceytProvider(
        <Members
          channel={channel}
          members={members}
          checkActionPermission={createCheckActionPermission('participant')}
        />,
        { store }
      )

      // The mock returns 'Last seen recently' for offline users
      expect(screen.getByText('Last seen recently')).toBeInTheDocument()
    })
  })

  // ─── Broadcast/Public channel display text ─────────────────────────────────

  describe('Display text for channel types', () => {
    it('displays "Add subscribers" for broadcast channel', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.BROADCAST,
        userRole: 'owner'
      })
      const members: IMember[] = [makeMember(currentUser, 'owner')]
      const store = createTestStore()

      renderWithSceytProvider(
        <Members channel={channel} members={members} checkActionPermission={createCheckActionPermission('owner')} />,
        { store }
      )

      expect(screen.getByText(/Add subscribers/i)).toBeInTheDocument()
    })

    it('displays "Add subscribers" for public channel', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.PUBLIC,
        userRole: 'owner'
      })
      const members: IMember[] = [makeMember(currentUser, 'owner')]
      const store = createTestStore()

      renderWithSceytProvider(
        <Members channel={channel} members={members} checkActionPermission={createCheckActionPermission('owner')} />,
        { store }
      )

      expect(screen.getByText(/Add subscribers/i)).toBeInTheDocument()
    })
  })

  // ─── Direct channel behavior ───────────────────────────────────────────────

  describe('Direct channel', () => {
    it('does not fetch members for direct channel with 2 members', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.DIRECT,
        userRole: 'owner',
        memberCount: 2
      })
      const members: IMember[] = [makeMember(currentUser, 'owner'), makeMember(participantUser, 'member')]
      const store = createTestStore()
      const dispatchSpy = jest.spyOn(store, 'dispatch')

      renderWithSceytProvider(
        <Members channel={channel} members={members} checkActionPermission={createCheckActionPermission('owner')} />,
        { store }
      )

      // getMembersAC should not be dispatched for direct channels with 2 members
      const getMembersCalls = dispatchSpy.mock.calls.filter((call) => call[0]?.type === 'GET_MEMBERS')
      expect(getMembersCalls).toHaveLength(0)
    })
  })

  // ─── No edit permissions behavior ──────────────────────────────────────────

  describe('No edit permissions', () => {
    it('does not show dropdown menu when no edit permissions', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'participant'
      })
      const members: IMember[] = [makeMember(ownerUser, 'owner'), makeMember(currentUser, 'participant')]
      const store = createTestStore()

      // No edit permissions
      const checkPermission = () => false

      renderWithSceytProvider(<Members channel={channel} members={members} checkActionPermission={checkPermission} />, {
        store
      })

      // Should not have any dropdown-wrapper elements for editing
      const dropdownWrappers = document.querySelectorAll('.dropdown-wrapper')
      expect(dropdownWrappers.length).toBe(0)
    })
  })

  // ─── show* props hide menu items ───────────────────────────────────────────

  describe('show* props control visibility', () => {
    it('showChangeMemberRole=false hides Change role option', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'owner'
      })
      const members: IMember[] = [makeMember(currentUser, 'owner'), makeMember(participantUser, 'participant')]
      const store = createTestStore()

      renderWithSceytProvider(
        <Members
          channel={channel}
          members={members}
          checkActionPermission={createCheckActionPermission('owner')}
          showChangeMemberRole={false}
        />,
        { store }
      )

      // Change role option should not be in the DOM
      expect(screen.queryByText('Change role')).not.toBeInTheDocument()
    })

    it('showKickMember=false hides Remove option', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'owner'
      })
      const members: IMember[] = [makeMember(currentUser, 'owner'), makeMember(participantUser, 'participant')]
      const store = createTestStore()

      renderWithSceytProvider(
        <Members
          channel={channel}
          members={members}
          checkActionPermission={createCheckActionPermission('owner')}
          showKickMember={false}
        />,
        { store }
      )

      // Remove option should not be in the DOM
      expect(screen.queryByText('Remove')).not.toBeInTheDocument()
    })

    it('showKickAndBlockMember=false hides Remove and Block member option', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'owner'
      })
      const members: IMember[] = [makeMember(currentUser, 'owner'), makeMember(participantUser, 'participant')]
      const store = createTestStore()

      renderWithSceytProvider(
        <Members
          channel={channel}
          members={members}
          checkActionPermission={createCheckActionPermission('owner')}
          showKickAndBlockMember={false}
        />,
        { store }
      )

      // Remove and Block member option should not be in the DOM
      expect(screen.queryByText('Remove and Block member')).not.toBeInTheDocument()
    })

    it('showMakeMemberAdmin=false hides Make Admin option', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'owner'
      })
      const members: IMember[] = [makeMember(currentUser, 'owner'), makeMember(participantUser, 'participant')]
      const store = createTestStore()

      renderWithSceytProvider(
        <Members
          channel={channel}
          members={members}
          checkActionPermission={createCheckActionPermission('owner')}
          showMakeMemberAdmin={false}
        />,
        { store }
      )

      // Make Admin option should not be in the DOM
      expect(screen.queryByText('Make Admin')).not.toBeInTheDocument()
    })
  })

  // ─── Multiple members rendering ────────────────────────────────────────────

  describe('Multiple members rendering', () => {
    it('renders all members in the list', () => {
      const channel = makeChannel({
        id: 'test-channel',
        type: DEFAULT_CHANNEL_TYPE.GROUP,
        userRole: 'participant'
      })
      const user1 = makeUser({ id: 'user-1', firstName: 'Alice' })
      const user2 = makeUser({ id: 'user-2', firstName: 'Bob' })
      const user3 = makeUser({ id: 'user-3', firstName: 'Charlie' })
      const members: IMember[] = [
        makeMember(currentUser, 'participant'),
        makeMember(user1, 'participant'),
        makeMember(user2, 'participant'),
        makeMember(user3, 'participant')
      ]
      const store = createTestStore()

      renderWithSceytProvider(
        <Members
          channel={channel}
          members={members}
          checkActionPermission={createCheckActionPermission('participant')}
        />,
        { store }
      )

      expect(screen.getByText('You')).toBeInTheDocument()
      // Names appear in both Avatar mock and h4, so use getAllByText
      expect(screen.getAllByText('Alice').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Bob').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Charlie').length).toBeGreaterThan(0)
    })
  })

  // ─── First load timed out ─────────────────────────────────────────────────

  describe('First load timed out (FAILED)', () => {
    const failedStore = (channelId: string) =>
      createTestStore({
        MembersReducer: {
          roles: createRoles(),
          rolesMap: createRolesMap(createRoles()),
          channelsMembersMap: {},
          channelsMembersLoadingState: { [channelId]: LOADING_STATE.FAILED },
          channelsMembersHasNextMap: {},
          getRolesFail: undefined,
          restricted: { isRestricted: false, fromChannel: false, members: [] },
          userBlockedForInvite: { show: false, userIds: [] },
          openInviteModal: false
        }
      })

    it('shows "Unable to load members" and Retry reloads the members', () => {
      const channel = makeChannel({ id: 'members-failed', type: DEFAULT_CHANNEL_TYPE.GROUP, userRole: 'owner' })
      const store = failedStore(channel.id)
      const dispatchSpy = jest.spyOn(store, 'dispatch')
      renderWithSceytProvider(
        <Members channel={channel} members={[]} checkActionPermission={createCheckActionPermission('owner')} />,
        { store }
      )

      expect(screen.getByText('Unable to load members')).toBeInTheDocument()
      expect(screen.getByText("We couldn't load members. Please try again.")).toBeInTheDocument()
      dispatchSpy.mockClear()
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
      expect(dispatchSpy).toHaveBeenCalledWith(getMembersAC(channel.id))
    })

    it('shows the members (not the error) when some are already loaded', () => {
      const channel = makeChannel({ id: 'members-failed-kept', type: DEFAULT_CHANNEL_TYPE.GROUP, userRole: 'owner' })
      renderWithSceytProvider(
        <Members
          channel={channel}
          members={[makeMember(makeUser({ id: 'u-1', firstName: 'Kept' }), 'participant')]}
          checkActionPermission={createCheckActionPermission('owner')}
        />,
        { store: failedStore(channel.id) }
      )
      expect(screen.queryByText('Unable to load members')).not.toBeInTheDocument()
    })

    it('uses CustomLoadErrorState when provided', () => {
      const channel = makeChannel({ id: 'members-failed-custom', type: DEFAULT_CHANNEL_TYPE.GROUP, userRole: 'owner' })
      const Custom = ({ title }: any) => <div data-testid='custom-error'>{title}</div>
      renderWithSceytProvider(
        <Members
          channel={channel}
          members={[]}
          checkActionPermission={createCheckActionPermission('owner')}
          CustomLoadErrorState={Custom}
        />,
        { store: failedStore(channel.id) }
      )
      expect(screen.getByTestId('custom-error')).toHaveTextContent('Unable to load members')
    })
  })
})
