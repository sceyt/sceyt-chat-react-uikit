import styled from 'styled-components'
import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { ReactComponent as AddMemberIcon } from '../../../../assets/svg/addMember.svg'
import { ReactComponent as MoreIcon } from '../../../../assets/svg/more_vert.svg'
import { BoltText, DropdownOptionLi, DropdownOptionsUl, SubTitle } from '../../../../UIHelper'
import {
  blockMemberAC,
  changeMemberRoleAC,
  getMembersAC,
  kickMemberAC,
  loadMoreMembersAC
} from '../../../../store/member/actions'
import { activeChannelMembersSelector, membersLoadingStateSelector } from '../../../../store/member/selector'
import Avatar from '../../../Avatar'
import { CHANNEL_TYPE, LOADING_STATE, PRESENCE_STATUS, THEME } from '../../../../helpers/constants'
import DropDown from '../../../../common/dropdown'
import { colors } from '../../../../UIHelper/constants'
import { IChannel, IContact, IContactsMap, IMember } from '../../../../types'
import { UserStatus } from '../../../Channel'
import ConfirmPopup from '../../../../common/popups/delete'
import ChangeMemberRole from './change-member-role'
import { getClient } from '../../../../common/client'
import { userLastActiveDateFormat } from '../../../../helpers'
import { makeUsername } from '../../../../helpers/message'
import UsersPopup from '../../../../common/popups/users'
import { getContactsAC } from '../../../../store/user/actions'
import { contactsMapSelector } from '../../../../store/user/selector'
import { getShowOnlyContactUsers } from '../../../../helpers/contacts'
import {
  getChannelTypesMemberDisplayTextMap,
  getDefaultRolesByChannelTypesMap
} from '../../../../helpers/channelHalper'

interface IProps {
  channel: IChannel
  theme: string
  checkActionPermission: (permission: string) => boolean
  showChangeMemberRole?: boolean
  showMakeMemberAdmin?: boolean
  showKickMember?: boolean
  showKickAndBlockMember?: boolean
}

const Members = ({
  channel,
  theme,
  checkActionPermission,
  showChangeMemberRole = true,
  showMakeMemberAdmin = true,
  showKickMember = true,
  showKickAndBlockMember = true
}: IProps) => {
  const dispatch = useDispatch()
  const getFromContacts = getShowOnlyContactUsers()
  const [selectedMember, setSelectedMember] = useState<IMember | null>(null)
  const [kickMemberPopupOpen, setKickMemberPopupOpen] = useState(false)
  const [blockMemberPopupOpen, setBlockMemberPopupOpen] = useState(false)
  const [changeMemberRolePopup, setChangeMemberRolePopup] = useState(false)
  const [makeAdminPopup, setMakeAdminPopup] = useState(false)
  const [revokeAdminPopup, setRevokeAdminPopup] = useState(false)
  const [addMemberPopupOpen, setAddMemberPopupOpen] = useState(false)
  const [closeMenu, setCloseMenu] = useState<string | undefined>()
  const members: IMember[] = useSelector(activeChannelMembersSelector) || []
  const contactsMap: IContactsMap = useSelector(contactsMapSelector) || {}
  const membersLoading = useSelector(membersLoadingStateSelector) || {}
  const user = getClient().user
  const memberDisplayText = getChannelTypesMemberDisplayTextMap()
  const channelTypeRoleMap = getDefaultRolesByChannelTypesMap()
  const displayMemberText =
    memberDisplayText && memberDisplayText[channel.type]
      ? `${memberDisplayText[channel.type]}s`
      : channel.type === CHANNEL_TYPE.BROADCAST
      ? 'subscribers'
      : 'members'
  const noMemberEditPermissions =
    !checkActionPermission('changeMemberRole') &&
    !checkActionPermission('kickAndBlockMember') &&
    !checkActionPermission('kickMember')

  const handleMembersListScroll = (event: any) => {
    // setCloseMenu(true)
    if (event.target.scrollTop >= event.target.scrollHeight - event.target.offsetHeight - 100) {
      if (membersLoading === LOADING_STATE.LOADED) {
        dispatch(loadMoreMembersAC(15))
      }
    }
  }

  const watchDropdownState = (state: boolean, memberId: string) => {
    if (state) {
      setCloseMenu(memberId)
    }
  }

  const toggleKickMemberPopup = () => {
    if (kickMemberPopupOpen) {
      setSelectedMember(null)
    }
    setKickMemberPopupOpen(!kickMemberPopupOpen)
  }

  const toggleBlockMemberPopup = () => {
    if (blockMemberPopupOpen) {
      setSelectedMember(null)
    }
    setBlockMemberPopupOpen(!blockMemberPopupOpen)
  }

  const toggleChangeRolePopup = () => {
    if (changeMemberRolePopup) {
      setSelectedMember(null)
    }
    setChangeMemberRolePopup(!changeMemberRolePopup)
  }

  const toggleMakeAdminPopup = (revoke: boolean) => {
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
          : channel.type === CHANNEL_TYPE.BROADCAST
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

  useEffect(() => {
    if (getFromContacts) {
      dispatch(getContactsAC())
    }
    dispatch(getMembersAC(channel.id))
  }, [channel])
  return (
    <Container theme={theme}>
      <ActionsMenu>
        <MembersList onScroll={handleMembersListScroll}>
          {checkActionPermission('addMember') && (
            <MemberItem
              key={1}
              onClick={handleAddMemberPopup}
              color={colors.textColor1}
              hoverBackground={theme === THEME.DARK ? colors.hoverBackgroundColor : colors.primaryLight}
              addMemberIconColor={colors.primary}
            >
              <AddMemberIcon />
              {`Add ${displayMemberText}`}
            </MemberItem>
          )}

          {!!members.length &&
            members.map((member, index) => (
              <MemberItem
                key={member.id + index}
                color={colors.textColor1}
                hoverBackground={colors.hoverBackgroundColor}
              >
                <Avatar
                  name={member.firstName || member.id}
                  image={member.avatarUrl}
                  size={40}
                  textSize={14}
                  setDefaultAvatar
                />
                <MemberNamePresence>
                  <MemberNameWrapper>
                    <MemberName>
                      {member.id === user.id
                        ? 'You'
                        : makeUsername(
                            member.id === user.id ? (member as unknown as IContact) : contactsMap[member.id],
                            member,
                            getFromContacts
                          )}
                    </MemberName>
                    {member.role === 'owner' ? (
                      <RoleBadge color={colors.primary}>Owner</RoleBadge>
                    ) : member.role === 'admin' ? (
                      <RoleBadge color={colors.purple}>Admin</RoleBadge>
                    ) : (
                      ''
                    )}
                  </MemberNameWrapper>

                  <SubTitle margin='1px 0 0'>
                    {member.presence && member.presence.state === PRESENCE_STATUS.ONLINE
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
                      <EditMemberIcon>
                        <MoreIcon />
                      </EditMemberIcon>
                    }
                  >
                    <DropdownOptionsUl>
                      {showChangeMemberRole && checkActionPermission('changeMemberRole') && (
                        <DropdownOptionLi
                          onClick={() => {
                            setSelectedMember(member)
                            toggleChangeRolePopup()
                          }}
                          key={1}
                          hoverBackground={colors.hoverBackgroundColor}
                        >
                          Change role
                        </DropdownOptionLi>
                      )}
                      {showMakeMemberAdmin && checkActionPermission('changeMemberRole') && member.role !== 'owner' && (
                        <DropdownOptionLi
                          onClick={() => {
                            setSelectedMember(member)
                            toggleMakeAdminPopup(member.role === 'admin')
                          }}
                          textColor={member.role === 'admin' ? colors.red1 : ''}
                          key={2}
                          hoverBackground={colors.hoverBackgroundColor}
                        >
                          {member.role === 'admin' ? 'Revoke Admin' : 'Make Admin'}
                        </DropdownOptionLi>
                      )}
                      {showKickMember && checkActionPermission('kickMember') && member.role !== 'owner' && (
                        <DropdownOptionLi
                          onClick={() => {
                            setSelectedMember(member)
                            toggleKickMemberPopup()
                          }}
                          textColor={colors.red1}
                          key={3}
                          hoverBackground={colors.hoverBackgroundColor}
                        >
                          Remove
                        </DropdownOptionLi>
                      )}
                      {showKickAndBlockMember && checkActionPermission('kickAndBlockMember') && (
                        <DropdownOptionLi
                          textColor={colors.red1}
                          key={4}
                          hoverBackground={colors.hoverBackgroundColor}
                          onClick={() => {
                            setSelectedMember(member)
                            toggleBlockMemberPopup()
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
          title={channel.type === CHANNEL_TYPE.GROUP ? 'Remove member' : 'Remove subscriber'}
          description={
            <span>
              Are you sure to remove
              {!!selectedMember && (
                <BoltText> {makeUsername(contactsMap[selectedMember.id], selectedMember, getFromContacts)} </BoltText>
              )}
              from this{' '}
              {channel.type === CHANNEL_TYPE.BROADCAST || channel.type === CHANNEL_TYPE.PUBLIC ? 'channel' : 'group'}?
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
          togglePopup={() => toggleMakeAdminPopup(false)}
          buttonText='Promote'
          buttonBackground={colors.primary}
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
          togglePopup={() => toggleMakeAdminPopup(true)}
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
  max-width: calc(100% - 54px);

  & > ${SubTitle} {
    display: block;
  }
`

const MemberNameWrapper = styled.div`
  display: flex;
  align-items: center;
`

const MemberName = styled.h4`
  margin: 0;
  font-weight: 400;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
`

const EditMemberIcon = styled.span`
  margin-left: auto;
  cursor: pointer;
  padding: 2px;
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s;
`

const MembersList = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  transition: all 0.2s;
`
const MemberItem = styled.li<{
  color?: string
  hoverBackground?: string
  addMemberIconColor?: string
  addMemberBackground?: string
}>`
  display: flex;
  align-items: center;
  font-size: 15px;
  font-weight: 500;
  padding: 6px 16px;
  transition: all 0.2s;
  color: ${(props) => props.color || colors.textColor1};

  &:first-child {
    cursor: pointer;

    > svg {
      color: ${(props) => props.addMemberIconColor || colors.primary};
      margin-right: 12px;
    }
  }

  &:hover {
    background-color: ${(props) => props.hoverBackground || colors.gray0};
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

const RoleBadge = styled.span<{ color?: string }>`
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
    background-color: ${(props) => props.color || colors.primary};
    opacity: 0.1;
  }
`
