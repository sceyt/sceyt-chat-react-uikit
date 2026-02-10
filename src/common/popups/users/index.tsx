import React, { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import { useSelector, useDispatch } from 'store/hooks'

import {
  Popup,
  PopupName,
  CloseIcon,
  StyledSearchSvg,
  ClearTypedText,
  Button,
  PopupFooter,
  PopupBody,
  SubTitle
} from '../../../UIHelper'
import { ReactComponent as CrossIcon } from '../../../assets/svg/cross.svg'
import { DEFAULT_CHANNEL_TYPE, LOADING_STATE, USER_PRESENCE_STATUS, THEME } from '../../../helpers/constants'
import Avatar from '../../../components/Avatar'
import { addMembersAC, setUserBlockedForInviteAC } from '../../../store/member/actions'
import { UserStatus } from '../../../components/Channel'
import { THEME_COLORS } from '../../../UIHelper/constants'
import { IAddMember, IChannel, IContact, IUser } from '../../../types'
import { getContactsAC, getUsersAC, loadMoreUsersAC } from '../../../store/user/actions'
import {
  contactListSelector,
  contactsMapSelector,
  usersListSelector,
  usersLoadingStateSelector,
  usersMapSelector
} from '../../../store/user/selector'
import { createChannelAC } from '../../../store/channel/actions'
import CustomCheckbox from '../../customCheckbox'
import { userLastActiveDateFormat } from '../../../helpers'
import { makeUsername } from '../../../helpers/message'
import { getShowOnlyContactUsers } from '../../../helpers/contacts'
import { useDidUpdate, useColor, useUpdatedUser } from '../../../hooks'
import {
  getChannelTypesMemberDisplayTextMap,
  getDefaultRolesByChannelTypesMap,
  getUseInviteLink
} from '../../../helpers/channelHalper'
import { themeSelector } from '../../../store/theme/selector'
import PopupContainer from '../popupContainer'
import { getClient } from '../../client'
import log from 'loglevel'
import AddMembersListItemInviteLink from '../inviteLink/AddMembersListItemInviteLink'
import UserBlockedPopup from '../UserBlockedPopup'
import { userBlockedForInviteSelector } from 'store/member/selector'

interface ISelectedUserData {
  id: string
  displayName?: string
  avatarUrl?: string
  role: string
}

interface IProps {
  channel?: IChannel
  toggleCreatePopup: () => void
  actionType: 'addMembers' | 'createChat' | 'selectUsers'
  // eslint-disable-next-line no-unused-vars
  getSelectedUsers?: (members: IAddMember[], action: 'create' | 'back') => void
  memberIds?: string[]
  selectIsRequired?: boolean
  // setPagination?: (state: boolean) => void
  creatChannelSelectedMembers?: any[]
  popupWidth?: string
  popupHeight?: string
  handleOpenInviteModal?: () => void
}

const UserItem = ({ user, memberDisplayName }: { user: IUser; memberDisplayName: string }) => {
  const { [THEME_COLORS.TEXT_PRIMARY]: textPrimary, [THEME_COLORS.TEXT_SECONDARY]: textSecondary } = useColor()
  const userUpdated = useUpdatedUser(user)

  return (
    <UserNamePresence>
      <MemberName color={textPrimary}>{memberDisplayName}</MemberName>
      <SubTitle color={textSecondary}>
        {userUpdated.presence && userUpdated.presence.state === USER_PRESENCE_STATUS.ONLINE
          ? 'Online'
          : userUpdated.presence &&
            userUpdated.presence.lastActiveAt &&
            userLastActiveDateFormat(userUpdated.presence.lastActiveAt)}
      </SubTitle>
    </UserNamePresence>
  )
}

const UsersPopup = ({
  channel,
  toggleCreatePopup,
  actionType,
  getSelectedUsers,
  memberIds,
  creatChannelSelectedMembers,
  popupHeight,
  selectIsRequired,
  popupWidth,
  handleOpenInviteModal
}: IProps) => {
  const {
    [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.SURFACE_1]: surface1Background,
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.ICON_INACTIVE]: iconInactive,
    [THEME_COLORS.BACKGROUND_HOVERED]: backgroundHovered,
    [THEME_COLORS.BACKGROUND]: background,
    [THEME_COLORS.BORDER]: border,
    [THEME_COLORS.TEXT_FOOTNOTE]: textFootnote,
    [THEME_COLORS.SURFACE_1]: surface1,
    [THEME_COLORS.TEXT_ON_PRIMARY]: textOnPrimary,
    [THEME_COLORS.SURFACE_2]: surface2
  } = useColor()

  const dispatch = useDispatch()
  const ChatClient = getClient()
  const { user: selfUser } = ChatClient
  // const showContactInfo = getShowContactInfo()
  // const roles = useSelector(rolesSelector).map((role) => role.name)
  const contactList = useSelector(contactListSelector)
  const contactsMap = useSelector(contactsMapSelector)
  const usersList = useSelector(usersListSelector)
  const theme = useSelector(themeSelector)
  const getFromContacts = getShowOnlyContactUsers()
  // const roles: any = []
  // const users = useSelector(usersSelector)
  const usersLoadingState = useSelector(usersLoadingStateSelector)
  const selectedMembersCont = useRef<any>('')
  const userBlockedForInvite = useSelector(userBlockedForInviteSelector)
  const [userSearchValue, setUserSearchValue] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<ISelectedUserData[]>(creatChannelSelectedMembers || [])
  const [usersContHeight, setUsersContHeight] = useState(0)
  const [filteredUsers, setFilteredUsers] = useState<IUser[]>([])
  const memberDisplayText = getChannelTypesMemberDisplayTextMap()
  const channelTypeRoleMap = getDefaultRolesByChannelTypesMap()
  const [isScrolling, setIsScrolling] = useState<boolean>(false)
  const [isSelectedMembersScrolling, setIsSelectedMembersScrolling] = useState<boolean>(false)
  const usersMap = useSelector(usersMapSelector)
  const popupTitleText =
    channel &&
    (memberDisplayText && memberDisplayText[channel.type]
      ? `Add ${memberDisplayText[channel.type]}s`
      : channel.type === DEFAULT_CHANNEL_TYPE.BROADCAST || channel.type === DEFAULT_CHANNEL_TYPE.PUBLIC
        ? 'Subscribers'
        : 'Members')
  /* const handleGetUsers = (option) => {
    dispatch(
      getUsers({
        query: userSearchValue,
        filter: option || searchIn,
        limit: 15
      })
    )
  }
  useEffect(() => {
    dispatch(getRoles())
  }, [channel]) */

  const handleMembersListScroll = (event: any) => {
    if (!userSearchValue && event.target.scrollHeight - event.target.scrollTop <= event.target.offsetHeight + 300) {
      if (!getFromContacts && usersLoadingState === LOADING_STATE.LOADED) {
        dispatch(loadMoreUsersAC(20))
      }
    }
  }

  const handleTypeSearchUser = (event: any) => {
    setUserSearchValue(event.currentTarget.value)
  }

  /* const handlePopupChangeToCreateChannel = () => {
    setUserSearchValue('')
    setPopupForAddMember(true)
    if (setPagination) {
      setPagination(true)
    }
  } */

  const handleUserSelect = (isSelected: boolean, contact: { id: string; displayName: string; avatarUrl?: string }) => {
    const newSelectedMembers = [...selectedMembers]
    if (isSelected) {
      const role = channel
        ? channelTypeRoleMap && channelTypeRoleMap[channel.type]
          ? channelTypeRoleMap[channel.type]
          : channel.type === DEFAULT_CHANNEL_TYPE.BROADCAST || channel.type === DEFAULT_CHANNEL_TYPE.PUBLIC
            ? 'subscriber'
            : 'participant'
        : 'participant'
      newSelectedMembers.push({
        id: contact.id,
        displayName: contact.displayName,
        avatarUrl: contact.avatarUrl,
        role
      })
    } else {
      const itemToDeleteIndex = newSelectedMembers.findIndex((member) => member.id === contact.id)
      if (itemToDeleteIndex >= 0) {
        newSelectedMembers.splice(itemToDeleteIndex, 1)
      }
    }
    setUserSearchValue('')
    setSelectedMembers(newSelectedMembers)
  }

  const removeMember = (member: ISelectedUserData) => {
    const newSelectedMembers = [...selectedMembers]

    const itemToDeleteIndex = newSelectedMembers.findIndex((m) => m.id === member.id)
    if (itemToDeleteIndex >= 0) {
      newSelectedMembers.splice(itemToDeleteIndex, 1)
    }
    setSelectedMembers(newSelectedMembers)
  }

  const handleCreateChannel = (selectedUser?: IUser) => {
    if (actionType === 'createChat' && selectedUser) {
      const channelData = {
        metadata: '',
        label: '',
        type: DEFAULT_CHANNEL_TYPE.DIRECT,
        members: [
          {
            ...selectedUser,
            role: 'owner'
          }
        ]
      }
      dispatch(createChannelAC(channelData))
    } else {
      const selectedMembersList: IAddMember[] = selectedMembers.map((member) => ({
        id: member.id,
        role: member.role
      }))
      if (actionType === 'selectUsers' && getSelectedUsers) {
        getSelectedUsers(selectedMembersList, 'create')
      } else {
        log.info('call add members ... ', selectedMembersList)
        dispatch(addMembersAC(channel!.id, selectedMembersList))
      }
    }
    toggleCreatePopup()
  }

  const handleAddMember = (user: IUser) => {
    handleCreateChannel(user)
  }

  const handleGoBack = () => {
    if (getSelectedUsers) {
      getSelectedUsers(selectedMembers, 'back')
    }
    // handleClosePopup()
  }
  const handleClosePopup = () => {
    toggleCreatePopup()
  }

  useEffect(() => {
    if (getFromContacts) {
      if (!userSearchValue) {
        const userList = contactList.map((cont: IContact & { blocked?: boolean }) => ({
          ...cont.user,
          blocked: !!usersMap?.[cont.id]?.blocked
        }))
        if (actionType === 'createChat') {
          userList.unshift(selfUser)
        }
        setFilteredUsers(userList)
      }
    } else {
      const userList = [...usersList]
      if (actionType === 'createChat') {
        userList.unshift(selfUser)
      }
      setFilteredUsers(userList)
    }
  }, [contactList, usersList, usersMap])

  useDidUpdate(() => {
    if (getFromContacts) {
      if (userSearchValue) {
        const filteredContacts = contactList.filter((contact: IContact) => {
          return (
            (contact.firstName && contact.firstName.toLowerCase().includes(userSearchValue.toLowerCase())) ||
            (contact.lastName && contact.lastName.toLowerCase().includes(userSearchValue.toLowerCase())) ||
            contact.id.toLowerCase().includes(userSearchValue.toLowerCase())
            // (contact.keys.length && contact.keys.find((key) =>
            // key.toLowerCase().includes(userSearchValue.toLowerCase())))
          )
        })
        if (
          actionType === 'createChat' &&
          ((selfUser.firstName && selfUser.firstName.toLowerCase().includes(userSearchValue.toLowerCase())) ||
            (selfUser.lastName && selfUser.lastName.toLowerCase().includes(userSearchValue.toLowerCase())) ||
            selfUser.id.toLowerCase().includes(userSearchValue.toLowerCase()))
        ) {
          filteredContacts.unshift({ user: selfUser })
        }
        setFilteredUsers(
          filteredContacts.map((cont: IContact) => ({ ...cont.user, blocked: !!usersMap?.[cont.id]?.blocked }))
        )
      } else {
        const userList = contactList.map((cont: IContact) => ({
          ...cont.user,
          blocked: !!usersMap?.[cont.id]?.blocked
        }))
        if (actionType === 'createChat') {
          userList.unshift(selfUser)
        }
        setFilteredUsers(userList)
      }
    } else {
      dispatch(getUsersAC({ query: userSearchValue, filter: 'all', limit: 50 }))
    }
  }, [userSearchValue, usersMap])

  useEffect(() => {
    if (selectedMembersCont.current) {
      setUsersContHeight(selectedMembersCont.current.offsetHeight)
    } else {
      setUsersContHeight(0)
    }
  }, [selectedMembers])

  useEffect(() => {
    if (getFromContacts) {
      dispatch(getContactsAC())
    } else {
      dispatch(getUsersAC({ query: userSearchValue, filter: 'all', limit: 50 }))
    }
  }, [])

  return (
    <PopupContainer>
      <Popup
        // isLoading={usersLoadingState}
        maxHeight={popupHeight || '721px'}
        width={popupWidth || '433px'}
        maxWidth={popupWidth || '433px'}
        height={popupHeight}
        padding='0'
        display='flex'
        backgroundColor={background}
      >
        <PopupBody paddingH='12px' paddingV='24px' withFooter={actionType !== 'createChat'}>
          <CloseIcon color={textSecondary} onClick={handleClosePopup} />

          <PopupName color={textPrimary} padding='0 12px'>
            {actionType === 'createChat' ? 'Create a new chat' : popupTitleText}
          </PopupName>
          <SearchUserCont className='p-relative'>
            <StyledSearchSvg color={iconInactive} />
            <SearchUsersInput
              height='40px'
              onChange={handleTypeSearchUser}
              value={userSearchValue}
              placeholder='Search for users'
              type='text'
              widthBorder={theme !== THEME.DARK}
              backgroundColor={surface1}
              color={textPrimary}
              placeholderColor={textFootnote}
              borderColor={border}
            />
            {userSearchValue && <ClearTypedText color={textPrimary} onClick={() => setUserSearchValue('')} />}
          </SearchUserCont>
          {actionType !== 'createChat' && selectedMembers.length !== 0 && (
            <SelectedMembersContainer
              ref={selectedMembersCont}
              thumbColor={surface2}
              className={isSelectedMembersScrolling ? 'show-scrollbar' : ''}
              onMouseEnter={() => setIsSelectedMembersScrolling(true)}
              onMouseLeave={() => setIsSelectedMembersScrolling(false)}
            >
              {selectedMembers.map((member) => {
                return (
                  <SelectedMemberBubble backgroundColor={surface1} key={`selected-${member.id}`}>
                    <Avatar
                      image={member.avatarUrl}
                      name={member.displayName || member.id}
                      size={28}
                      textSize={12}
                      setDefaultAvatar
                      border={'0.5px solid rgba(0, 0, 0, 0.1)'}
                    />
                    <SelectedMemberName color={textPrimary}>{member.displayName}</SelectedMemberName>
                    <StyledSubtractSvg onClick={() => removeMember(member)} />
                  </SelectedMemberBubble>
                )
              })}
            </SelectedMembersContainer>
          )}

          {/* <MembersContainer > */}
          <MembersContainer
            className={isScrolling ? 'show-scrollbar' : ''}
            isAdd={actionType !== 'createChat'}
            selectedMembersHeight={usersContHeight}
            onScroll={handleMembersListScroll}
            onMouseEnter={() => setIsScrolling(true)}
            onMouseLeave={() => setIsScrolling(false)}
            thumbColor={surface2}
          >
            {actionType === 'addMembers' && getUseInviteLink() && (
              <AddMembersListItemInviteLink onClick={handleOpenInviteModal} />
            )}
            {filteredUsers.map((user: IUser) => {
              if (actionType === 'addMembers' && memberIds && memberIds.includes(user.id)) {
                return null
              }
              const isSelected = selectedMembers.findIndex((member) => member.id === user.id) >= 0
              const memberDisplayName =
                selfUser.id === user.id
                  ? 'Me'
                  : makeUsername(contactsMap[user.id], user, selfUser.id !== user.id && getFromContacts)

              return (
                <ListRow
                  hoverBackground={backgroundHovered}
                  key={user.id}
                  onClick={() => {
                    if (user?.blocked) {
                      dispatch(setUserBlockedForInviteAC(true, [user.id]))
                      return
                    }
                    actionType === 'createChat' && handleAddMember(user)
                    handleUserSelect(!isSelected, {
                      id: user.id,
                      displayName: memberDisplayName,
                      avatarUrl: user.avatarUrl
                    })
                  }}
                  disabled={user?.blocked}
                >
                  <Avatar
                    image={user.avatarUrl}
                    name={user.firstName || user.id}
                    size={40}
                    textSize={16}
                    setDefaultAvatar
                  />
                  <UserItem user={user} memberDisplayName={memberDisplayName} />
                  {/* {isAdd && isSelected && (
                    <DropDown
                      withIcon
                      iconColor={colors.gray4}
                      isSelect
                      trigger={
                        <StyledDropdown>{selectedMembers.find((member) => member.id === user.id).role}</StyledDropdown>
                      }
                    >
                      <RolesDropdown>
                        {roles.map((roleName: string) => {
                          if (popupForAddMember && roleName === 'owner') {
                            return null
                          }
                          return (
                            <DropdownOptionLi
                              key={roleName}
                              hoverBackground={customColors.selectedChannelBackground}
                              onClick={() => setUserRole(user.id, roleName)}
                            >
                              {roleName}
                            </DropdownOptionLi>
                          )
                        })}
                      </RolesDropdown>
                    </DropDown>
                  )} */}

                  {actionType !== 'createChat' && (
                    <CustomCheckbox
                      index={user.id}
                      state={isSelected}
                      backgroundColor={'transparent'}
                      checkedBackgroundColor={accentColor}
                      borderColor={iconInactive}
                      onClick={(e) => {
                        e.stopPropagation()
                      }}
                      size='18px'
                      disabled={user?.blocked}
                    />
                  )}
                </ListRow>
              )
            })}
          </MembersContainer>
        </PopupBody>

        {actionType !== 'createChat' && (
          <PopupFooter backgroundColor={surface1Background} marginTop='auto'>
            {actionType === 'selectUsers' ? (
              <Button type='button' color={textPrimary} backgroundColor='transparent' onClick={handleGoBack}>
                Back
              </Button>
            ) : (
              <Button type='button' color={textPrimary} backgroundColor='transparent' onClick={toggleCreatePopup}>
                Cancel
              </Button>
            )}
            <Button
              type='button'
              color={textOnPrimary}
              backgroundColor={accentColor}
              borderRadius='8px'
              disabled={selectIsRequired && selectedMembers.length === 0}
              onClick={() => handleCreateChannel()}
            >
              {actionType === 'selectUsers' ? 'Create' : 'Add'}
            </Button>
          </PopupFooter>
        )}
      </Popup>
      {userBlockedForInvite.show && (
        <UserBlockedPopup
          userIds={userBlockedForInvite.userIds}
          selectUsers={(userIds) => {
            for (const userId of userIds) {
              const user = filteredUsers.find((user) => user.id === userId)
              if (!user) {
                continue
              }
              const memberDisplayName =
                selfUser.id === userId
                  ? 'Me'
                  : makeUsername(contactsMap[userId], user, selfUser.id !== userId && getFromContacts)
              if (user) {
                actionType === 'createChat' && handleAddMember(user)
                handleUserSelect(true, {
                  id: user.id,
                  displayName: memberDisplayName,
                  avatarUrl: user.avatarUrl
                })
              }
            }
          }}
        />
      )}
    </PopupContainer>
  )
}

export default UsersPopup

/* const CreateNewChannel = styled.div`
  display: flex;
  align-items: center;
  margin-top: 16px;
  color: ${colors.cobalt1};
  cursor: pointer;

  > svg {
    margin-right: 12px;
  }
` */

const List = styled.div<{ isAdd: boolean }>`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow-y: scroll;
  overflow-x: hidden;
  margin-top: 12px;
  min-height: 150px;
  box-sizing: border-box;
`

const MembersContainer = styled(List)<{
  isAdd: boolean
  selectedMembersHeight: number
  thumbColor: string
}>`
  display: flex;
  flex-direction: column;
  position: relative;
  max-height: ${(props) => `calc(100% - (${(props.isAdd ? 67 : 70) + props.selectedMembersHeight}px))`};
  overflow-y: auto;
  padding-right: 16px;

  &::-webkit-scrollbar {
    width: 8px;
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: transparent;
  }

  &.show-scrollbar::-webkit-scrollbar-thumb {
    background: ${(props) => props.thumbColor};
    border-radius: 4px;
  }
  &.show-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
`

const SearchUserCont = styled.div`
  position: relative;
  margin: 24px 12px 0;

  ${ClearTypedText} {
    top: 10px;
    right: 11px;
  }
`
/*
const SelectMember = styled.input`
  cursor: pointer;
` */

const SearchUsersInput = styled.input<{
  widthBorder?: boolean
  backgroundColor?: string
  color: string
  placeholderColor: string
  borderColor: string
}>`
  height: 40px;
  width: 100%;
  font-size: 14px;
  border: ${(props) => (props.widthBorder ? `1px solid ${props.borderColor}` : 'none')};
  box-sizing: border-box;
  border-radius: 8px;
  padding-left: 36px;
  color: ${(props) => props.color};
  background-color: ${(props) => props.backgroundColor};

  &::placeholder {
    color: ${(props) => props.placeholderColor};
    font-size: 14px;
    opacity: 1;
  }

  &:focus {
    outline: none;
  }
`

const ListRow = styled.div<{ hoverBackground: string; disabled?: boolean }>`
  display: flex;
  justify-content: space-between;
  flex-direction: row;
  align-items: center;
  padding: 7px 12px;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
  opacity: ${(props) => (props.disabled ? 0.5 : 1)};
  &:hover {
    background-color: ${(props) => props.hoverBackground};
  }

  & ${UserStatus} {
    width: 10px;
    height: 10px;
  }
`

const UserNamePresence = styled.div`
  width: 100%;
  max-width: calc(100% - 70px);
  margin: 0 auto 0 8px;
  line-height: 10px;
`

const MemberName = styled.h4<{ color?: string }>`
  font-style: normal;
  font-size: 15px;
  font-weight: 500;
  line-height: 16px;
  color: ${(props) => props.color};
  margin: 0;
  max-width: calc(100% - 10px);
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
`

const SelectedMembersContainer = styled.div<{ thumbColor: string }>`
  display: flex;
  justify-content: flex-start;
  flex-wrap: wrap;
  width: 100%;
  max-height: 85px;
  overflow-x: hidden;
  padding: 2px 12px 0;
  box-sizing: border-box;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 8px;
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: transparent;
  }

  &.show-scrollbar::-webkit-scrollbar-thumb {
    background: ${(props) => props.thumbColor};
    border-radius: 4px;
  }
  &.show-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
`

const SelectedMemberBubble = styled.div<{ backgroundColor: string }>`
  display: flex;
  justify-content: space-between;
  background: ${(props) => props.backgroundColor};
  border-radius: 16px;
  align-items: center;
  padding: 4px 10px 4px 0;
  height: 28px;
  margin: 8px 8px 0 0;
  box-sizing: border-box;
`

const SelectedMemberName = styled.span`
  font-style: normal;
  font-weight: 500;
  font-size: 14px;
  line-height: 16px;
  margin-left: 8px;
  color: ${(props) => props.color};
`

const StyledSubtractSvg = styled(CrossIcon)`
  cursor: pointer;
  margin-left: 4px;
  transform: translate(2px, 0);
`
/*

const StyledDropdown = styled.span`
  margin-left: auto;
  margin-right: 30px;
`

const RolesDropdown = styled(DropdownOptionsUl)`
  max-width: 200px;

  ${DropdownOptionLi} {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    box-sizing: border-box;
  }
`
*/
