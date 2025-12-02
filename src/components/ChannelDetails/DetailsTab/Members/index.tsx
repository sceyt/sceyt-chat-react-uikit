import styled from 'styled-components'
import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'store/hooks'
// Store
import { blockMemberAC, changeMemberRoleAC, getMembersAC, kickMemberAC } from '../../../../store/member/actions'
import { activeChannelMembersSelector } from '../../../../store/member/selector'
import { getContactsAC } from '../../../../store/user/actions'
import { contactsMapSelector } from '../../../../store/user/selector'
import { createChannelAC } from '../../../../store/channel/actions'
// Assets
import { ReactComponent as AddMemberIcon } from '../../../../assets/svg/addMember.svg'
import { ReactComponent as MoreIcon } from '../../../../assets/svg/more_vert.svg'
// Helpers
import { userLastActiveDateFormat } from '../../../../helpers'
import {
  getChannelTypesMemberDisplayTextMap,
  getDefaultRolesByChannelTypesMap,
  getOpenChatOnUserInteraction
} from '../../../../helpers/channelHalper'
import { makeUsername } from '../../../../helpers/message'
import { DEFAULT_CHANNEL_TYPE, USER_PRESENCE_STATUS } from '../../../../helpers/constants'
import { IChannel, IContact, IContactsMap, IMember } from '../../../../types'
import { UserStatus } from '../../../Channel'
import { BoltText, DropdownOptionLi, DropdownOptionsUl, SubTitle } from '../../../../UIHelper'
import { getClient } from '../../../../common/client'
import { THEME_COLORS } from '../../../../UIHelper/constants'
import { getShowOnlyContactUsers } from '../../../../helpers/contacts'
// Components
import ConfirmPopup from '../../../../common/popups/delete'
import ChangeMemberRole from './change-member-role'
import Avatar from '../../../Avatar'
import DropDown from '../../../../common/dropdown'
import UsersPopup from '../../../../common/popups/users'
import InviteLinkModal from '../../../../common/popups/inviteLink/InviteLinkModal'
import { useColor } from '../../../../hooks'

interface IProps {
  channel: IChannel
  theme: string
  // eslint-disable-next-line no-unused-vars
  checkActionPermission: (permission: string) => boolean
  showChangeMemberRole?: boolean
  showMakeMemberAdmin?: boolean
  showKickMember?: boolean
  showKickAndBlockMember?: boolean
  hoverBackgroundColor?: string
  addMemberFontSize?: string
  addMemberIcon?: JSX.Element
  memberNameFontSize?: string
  memberAvatarSize?: number
  memberPresenceFontSize?: string
  QRCodeIcon?: JSX.Element
}

const Members = ({
  channel,
  theme,
  checkActionPermission,
  showChangeMemberRole = true,
  showMakeMemberAdmin = true,
  showKickMember = true,
  showKickAndBlockMember = true,
  hoverBackgroundColor,
  addMemberFontSize,
  addMemberIcon,
  memberNameFontSize,
  memberAvatarSize,
  memberPresenceFontSize,
  QRCodeIcon
}: IProps) => {
  const {
    [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.BACKGROUND_HOVERED]: backgroundHovered,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.WARNING]: errorColor,
    [THEME_COLORS.BACKGROUND_FOCUSED]: backgroundFocused,
    [THEME_COLORS.ICON_INACTIVE]: iconInactive,
    [THEME_COLORS.SURFACE_1]: surface1
  } = useColor()

  const dispatch = useDispatch()
  const getFromContacts = getShowOnlyContactUsers()
  const [selectedMember, setSelectedMember] = useState<IMember | null>(null)
  const [kickMemberPopupOpen, setKickMemberPopupOpen] = useState(false)
  const [blockMemberPopupOpen, setBlockMemberPopupOpen] = useState(false)
  const [changeMemberRolePopup, setChangeMemberRolePopup] = useState(false)
  const [makeAdminPopup, setMakeAdminPopup] = useState(false)
  const [revokeAdminPopup, setRevokeAdminPopup] = useState(false)
  const [addMemberPopupOpen, setAddMemberPopupOpen] = useState(false)
  const [openInviteModal, setOpenInviteModal] = useState(false)
  const [closeMenu, setCloseMenu] = useState<string | undefined>()
  const members: IMember[] = useSelector(activeChannelMembersSelector) || []
  const contactsMap: IContactsMap = useSelector(contactsMapSelector) || {}
  const user = getClient().user
  const memberDisplayText = getChannelTypesMemberDisplayTextMap()
  const channelTypeRoleMap = getDefaultRolesByChannelTypesMap()
  const displayMemberText =
    memberDisplayText && memberDisplayText[channel.type]
      ? `${memberDisplayText[channel.type]}s`
      : channel.type === DEFAULT_CHANNEL_TYPE.BROADCAST || channel.type === DEFAULT_CHANNEL_TYPE.PUBLIC
        ? 'subscribers'
        : 'members'
  const noMemberEditPermissions =
    !checkActionPermission('changeMemberRole') &&
    !checkActionPermission('kickAndBlockMember') &&
    !checkActionPermission('kickMember')

  const watchDropdownState = (state: boolean, memberId: string) => {
    if (state) {
      setCloseMenu(memberId)
    }
  }

  const toggleKickMemberPopup = (e?: Event) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }
    if (kickMemberPopupOpen) {
      setSelectedMember(null)
    }
    setKickMemberPopupOpen(!kickMemberPopupOpen)
  }

  const toggleBlockMemberPopup = (e?: Event) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }
    if (blockMemberPopupOpen) {
      setSelectedMember(null)
    }
    setBlockMemberPopupOpen(!blockMemberPopupOpen)
  }

  const toggleChangeRolePopup = (e?: Event) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }
    if (changeMemberRolePopup) {
      setSelectedMember(null)
    }
    setChangeMemberRolePopup(!changeMemberRolePopup)
  }

  const toggleMakeAdminPopup = (e?: Event, revoke?: boolean) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }
    if (revoke) {
      if (revokeAdminPopup) {
        setSelectedMember(null)
      }
      setRevokeAdminPopup(!revokeAdminPopup)
    } else {
      if (makeAdminPopup) {
        setSelectedMember(null)
      }
      setMakeAdminPopup(!makeAdminPopup)
    }
  }

  const handleKickMember = () => {
    selectedMember && dispatch(kickMemberAC(channel.id, selectedMember.id))
  }

  const handleBlockMember = () => {
    selectedMember && dispatch(blockMemberAC(channel.id, selectedMember.id))
  }

  const handleMakeAdmin = () => {
    if (selectedMember) {
      const updateMember: IMember = {
        ...selectedMember,
        role: 'admin'
      }

      dispatch(changeMemberRoleAC(channel.id, [updateMember]))
    }
  }

  const handleRevokeAdmin = () => {
    if (selectedMember) {
      const role =
        channelTypeRoleMap && channelTypeRoleMap[channel.type]
          ? channelTypeRoleMap[channel.type]
          : channel.type === DEFAULT_CHANNEL_TYPE.BROADCAST || channel.type === DEFAULT_CHANNEL_TYPE.PUBLIC
            ? 'subscriber'
            : 'participant'
      const updateMember: IMember = {
        ...selectedMember,
        role
      }

      dispatch(changeMemberRoleAC(channel.id, [updateMember]))
    }
  }

  const handleAddMemberPopup = () => {
    setAddMemberPopupOpen(!addMemberPopupOpen)
  }
  const handleCreateChat = (user?: any) => {
    if (getOpenChatOnUserInteraction() && user) {
      dispatch(
        createChannelAC(
          {
            metadata: '',
            type: DEFAULT_CHANNEL_TYPE.DIRECT,
            members: [
              {
                ...user,
                role: 'owner'
              }
            ]
          },
          true
        )
      )
    }
  }

  const handleOpenInviteModal = () => {
    setOpenInviteModal(true)
    setAddMemberPopupOpen(false)
  }

  useEffect(() => {
    if (getFromContacts) {
      dispatch(getContactsAC())
    }
    if (channel?.id) {
      dispatch(getMembersAC(channel.id))
    }
  }, [channel?.id])

  const currentUserRole = members.find((member) => member.id === user.id)?.role

  return (
    <Container theme={theme}>
      <ActionsMenu>
        <MembersList>
          {checkActionPermission('addMember') && (currentUserRole === 'owner' || currentUserRole === 'admin') && (
            <MemberItem
              key={1}
              onClick={handleAddMemberPopup}
              color={textPrimary}
              hoverBackground={hoverBackgroundColor || backgroundHovered}
              addMemberIconColor={accentColor}
              fontSize={addMemberFontSize}
              addMemberBackground={surface1}
            >
              {addMemberIcon || <AddMemberIcon />}
              {`Add ${displayMemberText}`}
            </MemberItem>
          )}

          {!!members.length &&
            members.map((member, index) => (
              <MemberItem
                addMemberIconColor={iconInactive}
                key={member.id + index}
                color={textPrimary}
                hoverBackground={hoverBackgroundColor || backgroundHovered}
                onClick={() => handleCreateChat(member)}
                fontSize={memberNameFontSize}
              >
                <Avatar
                  name={member.firstName || member.id}
                  image={member.avatarUrl}
                  size={memberAvatarSize || 40}
                  textSize={14}
                  setDefaultAvatar
                />
                <MemberNamePresence>
                  <MemberNameWrapper>
                    <MemberName color={textPrimary}>
                      {member.id === user.id
                        ? 'You'
                        : makeUsername(
                            member.id === user.id ? (member as unknown as IContact) : contactsMap[member.id],
                            member,
                            getFromContacts
                          )}
                    </MemberName>
                    {member.role === 'owner' ? (
                      <RoleBadge color={accentColor} backgroundColor={backgroundFocused}>
                        Owner
                      </RoleBadge>
                    ) : member.role === 'admin' ? (
                      <RoleBadge color={accentColor} backgroundColor={backgroundFocused}>
                        Admin
                      </RoleBadge>
                    ) : (
                      ''
                    )}
                  </MemberNameWrapper>

                  <SubTitle color={textSecondary} margin='1px 0 0' fontSize={memberPresenceFontSize}>
                    {member.presence && member.presence.state === USER_PRESENCE_STATUS.ONLINE
                      ? 'Online'
                      : member.presence &&
                        member.presence.lastActiveAt &&
                        userLastActiveDateFormat(member.presence.lastActiveAt)}
                  </SubTitle>
                </MemberNamePresence>
                {!noMemberEditPermissions && member.role !== 'owner' && member.id !== user.id && (
                  <DropDown
                    theme={theme}
                    isSelect
                    forceClose={!!(closeMenu && closeMenu !== member.id)}
                    watchToggleState={(state) => watchDropdownState(state, member.id)}
                    trigger={
                      <EditMemberIcon color={iconInactive}>
                        <MoreIcon color={iconInactive} />
                      </EditMemberIcon>
                    }
                  >
                    <DropdownOptionsUl>
                      {showChangeMemberRole && checkActionPermission('changeMemberRole') && (
                        <DropdownOptionLi
                          textColor={textPrimary}
                          onClick={(e: any) => {
                            setSelectedMember(member)
                            toggleChangeRolePopup(e)
                            setCloseMenu('1')
                          }}
                          key={1}
                          hoverBackground={backgroundHovered}
                        >
                          Change role
                        </DropdownOptionLi>
                      )}
                      {showMakeMemberAdmin && checkActionPermission('changeMemberRole') && member.role !== 'owner' && (
                        <DropdownOptionLi
                          onClick={(e: any) => {
                            setSelectedMember(member)
                            toggleMakeAdminPopup(e, member.role === 'admin')
                            setCloseMenu('1')
                          }}
                          textColor={member.role === 'admin' ? errorColor : ''}
                          key={2}
                          hoverBackground={backgroundHovered}
                        >
                          {member.role === 'admin' ? 'Revoke Admin' : 'Make Admin'}
                        </DropdownOptionLi>
                      )}
                      {showKickMember && checkActionPermission('kickMember') && member.role !== 'owner' && (
                        <DropdownOptionLi
                          onClick={(e: any) => {
                            setSelectedMember(member)
                            toggleKickMemberPopup(e)
                            setCloseMenu('1')
                          }}
                          textColor={errorColor}
                          key={3}
                          hoverBackground={backgroundHovered}
                        >
                          Remove
                        </DropdownOptionLi>
                      )}
                      {showKickAndBlockMember && checkActionPermission('kickAndBlockMember') && (
                        <DropdownOptionLi
                          textColor={errorColor}
                          key={4}
                          hoverBackground={backgroundHovered}
                          onClick={(e: any) => {
                            setSelectedMember(member)
                            toggleBlockMemberPopup(e)
                            setCloseMenu('1')
                          }}
                        >
                          Remove and Block member
                        </DropdownOptionLi>
                      )}
                    </DropdownOptionsUl>
                  </DropDown>
                )}
              </MemberItem>
            ))}
        </MembersList>
      </ActionsMenu>

      {kickMemberPopupOpen && (
        <ConfirmPopup
          theme={theme}
          handleFunction={handleKickMember}
          togglePopup={toggleKickMemberPopup}
          buttonText='Remove'
          title={
            channel.type === DEFAULT_CHANNEL_TYPE.GROUP || channel.type === DEFAULT_CHANNEL_TYPE.PRIVATE
              ? 'Remove member'
              : 'Remove subscriber'
          }
          description={
            <span>
              Are you sure to remove
              {!!selectedMember && (
                <BoltText> {makeUsername(contactsMap[selectedMember.id], selectedMember, getFromContacts)} </BoltText>
              )}
              from this{' '}
              {channel.type === DEFAULT_CHANNEL_TYPE.BROADCAST || channel.type === DEFAULT_CHANNEL_TYPE.PUBLIC
                ? 'channel'
                : 'group'}
              ?
            </span>
          }
        />
      )}
      {blockMemberPopupOpen && (
        <ConfirmPopup
          theme={theme}
          handleFunction={handleBlockMember}
          togglePopup={toggleBlockMemberPopup}
          buttonText='Block'
          description={`Block and remove member - ${
            selectedMember && (selectedMember.firstName || selectedMember.lastName || selectedMember.id)
          }`}
          title='Block and remove user'
        />
      )}
      {makeAdminPopup && (
        <ConfirmPopup
          theme={theme}
          handleFunction={handleMakeAdmin}
          togglePopup={() => toggleMakeAdminPopup(undefined, false)}
          buttonText='Promote'
          buttonBackground={accentColor}
          title='Promote admin'
          description={
            <span>
              Are you sure you want to promote
              {selectedMember && (
                <BoltText> {makeUsername(contactsMap[selectedMember.id], selectedMember, getFromContacts)} </BoltText>
              )}
              to <BoltText>Admin?</BoltText>
            </span>
          }
        />
      )}
      {revokeAdminPopup && (
        <ConfirmPopup
          handleFunction={handleRevokeAdmin}
          togglePopup={() => toggleMakeAdminPopup(undefined, true)}
          buttonText='Revoke'
          title='Revoke admin'
          theme={theme}
          description={
            <span>
              Are you sure you want to revoke
              <BoltText> “Admin” </BoltText>
              rights from user:
              {selectedMember && (
                <BoltText> {makeUsername(contactsMap[selectedMember.id], selectedMember, getFromContacts)} </BoltText>
              )}
              ?
            </span>
          }
        />
      )}
      {changeMemberRolePopup && (
        <ChangeMemberRole
          theme={theme}
          channelId={channel.id}
          member={selectedMember!}
          handleClosePopup={toggleChangeRolePopup}
        />
      )}
      {addMemberPopupOpen && (
        <UsersPopup
          popupHeight='540px'
          popupWidth='520px'
          actionType='addMembers'
          channel={channel}
          selectIsRequired
          memberIds={members.map((mem) => mem.id)}
          toggleCreatePopup={handleAddMemberPopup}
          handleOpenInviteModal={handleOpenInviteModal}
        />
      )}
      {openInviteModal && (
        <InviteLinkModal
          onClose={() => setOpenInviteModal(false)}
          SVGOrPNGLogoIcon={QRCodeIcon}
          channelId={channel.id}
        />
      )}
    </Container>
  )
}

export default Members

const Container = styled.div<{ theme?: string }>``

const ActionsMenu = styled.div`
  position: relative;
  transition: all 0.2s;
`

const MemberNamePresence = styled.div`
  margin-left: 12px;
  max-width: calc(100% - 84px);

  & > ${SubTitle} {
    display: block;
  }
`

const MemberNameWrapper = styled.div`
  display: flex;
  align-items: center;
`

const MemberName = styled.h4<{ color: string }>`
  margin: 0;
  font-weight: 400;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  color: ${(props) => props.color};
`

const EditMemberIcon = styled.span<{ color: string }>`
  margin-left: auto;
  cursor: pointer;
  padding: 15px;
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s;

  & svg {
    color: ${(props) => props.color};
  }
`

const MembersList = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  transition: all 0.2s;
`
const MemberItem = styled.li<{
  color: string
  hoverBackground?: string
  addMemberIconColor: string
  addMemberBackground?: string
  fontSize?: string
}>`
  display: flex;
  align-items: center;
  font-size: ${(props) => props.fontSize || '15px'};
  font-weight: 500;
  padding: 6px 16px;
  transition: all 0.2s;
  color: ${(props) => props.color};
  cursor: pointer;

  & > svg {
    rect {
      fill: transparent;
    }
  }

  &:first-child {
    cursor: pointer;

    > svg {
      color: ${(props) => props.addMemberIconColor};
      margin-right: 12px;
      & > rect {
        fill: ${(props) => props.addMemberBackground || 'transparent'} !important;
      }
    }
  }

  &:hover {
    background-color: ${(props) => props.hoverBackground};
  }

  &:hover ${EditMemberIcon} {
    opacity: 1;
    visibility: visible;
  }

  & .dropdown-wrapper {
    margin-left: auto;
  }

  & ${UserStatus} {
    width: 12px;
    height: 12px;
    right: -1px;
    bottom: -1px;
  }
`

const RoleBadge = styled.span<{ color: string; backgroundColor: string }>`
  position: relative;
  padding: 2px 8px;
  border-radius: 12px;
  margin-left: 4px;
  font-weight: 500;
  font-size: 12px;
  line-height: 16px;
  color: ${(props) => props.color};

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    border-radius: 12px;
    width: 100%;
    height: 100%;
    background-color: ${(props) => props.backgroundColor};
    opacity: 0.1;
  }
`
