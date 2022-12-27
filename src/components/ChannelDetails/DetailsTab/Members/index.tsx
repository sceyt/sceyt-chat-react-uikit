import styled from 'styled-components'
import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { ReactComponent as AddMemberIcon } from '../../../../assets/svg/addMember.svg'
import { ReactComponent as MoreIcon } from '../../../../assets/svg/more_vert.svg'
import { ReactComponent as DefaultAvatar } from '../../../../assets/svg/devaultAvatar40.svg'
import { DropdownOptionLi, DropdownOptionsUl, SubTitle } from '../../../../UIHelper'
import { blockMemberAC, getMembersAC, kickMemberAC, loadMoreMembersAC } from '../../../../store/member/actions'
import { activeChannelMembersSelector, membersLoadingStateSelector } from '../../../../store/member/selector'
import Avatar from '../../../Avatar'
import { LOADING_STATE, PRESENCE_STATUS } from '../../../../helpers/constants'
import DropDown from '../../../../common/dropdown'
import { colors, customColors } from '../../../../UIHelper/constants'
import { IChannel, IContact, IContactsMap, IMember } from '../../../../types'
import { UserStatus } from '../../../Channel'
import DeletePopup from '../../../../common/popups/delete'
import ChangeMemberRole from './change-member-role'
import { getClient } from '../../../../common/client'
import { makeUserName, userLastActiveDateFormat } from '../../../../helpers'
import UsersPopup from '../../../../common/popups/users'
import { getContactsAC } from '../../../../store/user/actions'
import { contactsMapSelector } from '../../../../store/user/selector'

interface IProps {
  channel: IChannel
  chekActionPermission: (permission: string) => boolean
}

const Members = ({ channel, chekActionPermission }: IProps) => {
  const [selectedMember, setSelectedMember] = useState<IMember | null>(null)
  const [kickMemberPopupOpen, setKickMemberPopupOpen] = useState(false)
  const [blockMemberPopupOpen, setBlockMemberPopupOpen] = useState(false)
  const [changeMemberRolePopup, setChangeMemberRolePopup] = useState(false)
  const [addMemberPopupOpen, setAddMemberPopupOpen] = useState(false)
  const [closeMenu, setCloseMenu] = useState(false)
  const members: IMember[] = useSelector(activeChannelMembersSelector) || []
  const contactsMap: IContactsMap = useSelector(contactsMapSelector) || {}
  const membersLoading = useSelector(membersLoadingStateSelector) || {}
  const user = getClient().chatClient.user
  const dispatch = useDispatch()
  const noMemberEditPermissions =
    !chekActionPermission('changeMemberRole') &&
    !chekActionPermission('kickAndBlockMember') &&
    !chekActionPermission('kickMember')

  const handleMembersListScroll = (event: any) => {
    // setCloseMenu(true)
    if (event.target.scrollTop >= event.target.scrollHeight - event.target.offsetHeight - 100) {
      if (membersLoading === LOADING_STATE.LOADED) {
        dispatch(loadMoreMembersAC(15))
      }
    }
  }

  const watchDropdownState = (state: boolean) => {
    if (state) {
      setCloseMenu(!state)
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

  const handleKickMember = () => {
    selectedMember && dispatch(kickMemberAC(channel.id, selectedMember.id))
  }

  const handleBlockMember = () => {
    selectedMember && dispatch(blockMemberAC(channel.id, selectedMember.id))
  }
  const handleAddMemberPopup = () => {
    setAddMemberPopupOpen(!addMemberPopupOpen)
  }

  useEffect(() => {
    dispatch(getContactsAC())
    dispatch(getMembersAC(channel.id))
  }, [channel])
  return (
    <Container>
      <ActionsMenu>
        <MembersList onScroll={handleMembersListScroll}>
          {chekActionPermission('addMember') && (
            <MemberItem key={1} onClick={handleAddMemberPopup}>
              <AddMemberIcon />
              Add member
            </MemberItem>
          )}

          {!!members.length &&
            members.map((member) => (
              <MemberItem key={member.id} hoverBackground={customColors.selectedChannelBackground}>
                <Avatar
                  name={member.firstName || member.id}
                  image={member.avatarUrl}
                  size={40}
                  textSize={14}
                  setDefaultAvatar
                  defaultAvatarIcon={<DefaultAvatar />}
                />
                <MemberNamePresence>
                  <MemberName>
                    {makeUserName(
                      member.id === user.id ? (member as unknown as IContact) : contactsMap[member.id],
                      member
                    )}
                    <span>{member.role === 'owner' ? ` (${member.role})` : ''}</span>
                    <span>{member.id === user.id ? ' (you)' : ''}</span>
                  </MemberName>
                  <SubTitle>
                    {member.presence && member.presence.state === PRESENCE_STATUS.ONLINE
                      ? 'Online'
                      : member.presence &&
                        member.presence.lastActiveAt &&
                        userLastActiveDateFormat(member.presence.lastActiveAt)}
                  </SubTitle>
                </MemberNamePresence>
                {!noMemberEditPermissions && (
                  <DropDown
                    isSelect
                    forceClose={closeMenu}
                    watchToggleState={watchDropdownState}
                    trigger={
                      <EditMemberIcon>
                        <MoreIcon />
                      </EditMemberIcon>
                    }
                  >
                    <DropdownOptionsUl>
                      {chekActionPermission('changeMemberRole') && (
                        <DropdownOptionLi
                          onClick={() => {
                            setSelectedMember(member)
                            toggleChangeRolePopup()
                          }}
                          key={1}
                          hoverBackground={customColors.selectedChannelBackground}
                        >
                          Change role
                        </DropdownOptionLi>
                      )}
                      {chekActionPermission('kickMember') && (
                        <DropdownOptionLi
                          onClick={() => {
                            setSelectedMember(member)
                            toggleKickMemberPopup()
                          }}
                          textColor={colors.red1}
                          key={2}
                          hoverBackground={customColors.selectedChannelBackground}
                        >
                          Kick member
                        </DropdownOptionLi>
                      )}
                      {chekActionPermission('kickAndBlockMember') && (
                        <DropdownOptionLi
                          textColor={colors.red1}
                          key={3}
                          hoverBackground={customColors.selectedChannelBackground}
                          onClick={() => {
                            setSelectedMember(member)
                            toggleBlockMemberPopup()
                          }}
                        >
                          Kick and Block member
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
        <DeletePopup
          deleteFunction={handleKickMember}
          togglePopup={toggleKickMemberPopup}
          buttonText='Kick'
          description=''
          title={`Kick member - ${
            selectedMember && (selectedMember.firstName || selectedMember.lastName || selectedMember.id)
          }`}
        />
      )}
      {blockMemberPopupOpen && (
        <DeletePopup
          deleteFunction={handleBlockMember}
          togglePopup={toggleBlockMemberPopup}
          buttonText='Block'
          description=''
          title={`Block and kick member - ${
            selectedMember && (selectedMember.firstName || selectedMember.lastName || selectedMember.id)
          }`}
        />
      )}
      {changeMemberRolePopup && (
        <ChangeMemberRole channelId={channel.id} member={selectedMember!} handleClosePopup={toggleChangeRolePopup} />
      )}
      {addMemberPopupOpen && (
        <UsersPopup
          popupHeight='540px'
          popupWidth='520px'
          actionType='addMembers'
          channel={channel}
          selectIsRequired
          toggleCreatePopup={handleAddMemberPopup}
        />
      )}
    </Container>
  )
}

export default Members

const Container = styled.div``

const ActionsMenu = styled.div`
  position: relative;
  transition: all 0.2s;
`

const MemberNamePresence = styled.div`
  margin-left: 12px;
  max-width: calc(100% - 64px);
`

const MemberName = styled.h4`
  margin: 0;
  width: 100%;
  font-weight: 400;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  color: ${colors.gray6};

  & > span {
    color: ${colors.gray9};
  }
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
const MemberItem = styled.li<{ hoverBackground?: string }>`
  display: flex;
  align-items: center;
  font-size: 15px;
  padding: 6px 16px;
  transition: all 0.2s;

  &:first-child {
    color: #17191c;
    cursor: pointer;
    background-color: #fff;

    > svg {
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
