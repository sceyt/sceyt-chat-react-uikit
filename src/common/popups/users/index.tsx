import React, { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import { useDispatch, useSelector } from 'react-redux'
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
/* import {
  rolesSelector,
  usersLoadingStateSelector,
  usersSelector
} from '../../../../../../store/channel/selector' */
import { ReactComponent as CrossIcon } from '../../../assets/svg/cross.svg'
// import { ReactComponent as CreateChannelIcon } from '../../../../../assets/svg/add.svg'
import { CHANNEL_TYPE, LOADING_STATE, USER_PRESENCE_STATUS, THEME } from '../../../helpers/constants'
import Avatar from '../../../components/Avatar'
/* import {
  createChannel,
  getRoles,
  getUsers,
  loadMoreUsers
} from '../../../../../../store/channel/actions' */
import { addMembersAC } from '../../../store/member/actions'
import { UserStatus } from '../../../components/Channel'
import { colors } from '../../../UIHelper/constants'
import { IAddMember, IChannel, IContact, IUser } from '../../../types'
import { getContactsAC, getUsersAC, loadMoreUsersAC } from '../../../store/user/actions'
import {
  contactListSelector,
  contactsMapSelector,
  usersListSelector,
  usersLoadingStateSelector
} from '../../../store/user/selector'
import { createChannelAC } from '../../../store/channel/actions'
import CustomCheckbox from '../../customCheckbox'
import { userLastActiveDateFormat } from '../../../helpers'
import { makeUsername } from '../../../helpers/message'
import { getShowOnlyContactUsers } from '../../../helpers/contacts'
import { useDidUpdate } from '../../../hooks'
import { getChannelTypesMemberDisplayTextMap, getDefaultRolesByChannelTypesMap } from '../../../helpers/channelHalper'
import { themeSelector } from '../../../store/theme/selector'
import PopupContainer from '../popupContainer'
import { getClient } from '../../client'

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
  popupWidth
}: IProps) => {
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

  const [userSearchValue, setUserSearchValue] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<ISelectedUserData[]>(creatChannelSelectedMembers || [])
  const [usersContHeight, setUsersContHeight] = useState(0)
  const [filteredUsers, setFilteredUsers] = useState<IUser[]>([])
  const memberDisplayText = getChannelTypesMemberDisplayTextMap()
  const channelTypeRoleMap = getDefaultRolesByChannelTypesMap()

  const popupTitleText =
    channel &&
    (memberDisplayText && memberDisplayText[channel.type]
      ? `Add ${memberDisplayText[channel.type]}s`
      : channel.type === CHANNEL_TYPE.BROADCAST || channel.type === CHANNEL_TYPE.PUBLIC
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

  const handleUserSelect = (event: any, contact: { id: string; displayName: string; avatarUrl?: string }) => {
    const newSelectedMembers = [...selectedMembers]
    if (event.target.checked) {
      const role = channel
        ? channelTypeRoleMap && channelTypeRoleMap[channel.type]
          ? channelTypeRoleMap[channel.type]
          : channel.type === CHANNEL_TYPE.BROADCAST || channel.type === CHANNEL_TYPE.PUBLIC
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

  /* const setUserRole = (username: string, roleName: string) => {
    if (username && roleName) {
      const newSelectedMembers = selectedMembers.map((member) => {
        if (member.id === username) {
          return {
            ...member,
            role: roleName
          }
        }
        if (member.role.name === (roleName === 'owner')) {
          return {
            ...member,
            role: 'participant'
          }
        }
        return member
      })
      setSelectedMembers(newSelectedMembers)
    }
  } */

  const handleCreateChannel = (selectedUser?: IUser) => {
    if (actionType === 'createChat' && selectedUser) {
      const channelData = {
        metadata: '',
        label: '',
        type: CHANNEL_TYPE.DIRECT,
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
        console.log('call add members ... ', selectedMembersList)
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
        const userList = contactList.map((cont: IContact) => cont.user)
        if (actionType === 'createChat') {
          userList.unshift(selfUser)
        }
        setFilteredUsers(userList)
      }
    } else {
      const userList = usersList
      if (actionType === 'createChat') {
        userList.unshift(selfUser)
      }
      setFilteredUsers(userList)
    }
  }, [contactList, usersList])

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
        setFilteredUsers(filteredContacts.map((cont: IContact) => cont.user))
      } else {
        const userList = contactList.map((cont: IContact) => cont.user)
        if (actionType === 'createChat') {
          userList.unshift(selfUser)
        }
        setFilteredUsers(userList)
      }
    } else {
      dispatch(getUsersAC({ query: userSearchValue, filter: 'all', limit: 50 }))
    }
  }, [userSearchValue])

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
    <PopupContainer theme={theme}>
      <Popup
        // isLoading={usersLoadingState}
        maxHeight={popupHeight || '721px'}
        width={popupWidth || '433px'}
        maxWidth={popupWidth || '433px'}
        height={popupHeight}
        padding='0'
        display='flex'
        backgroundColor={theme === THEME.DARK ? colors.dark : colors.white}
        boxShadow={theme === THEME.DARK ? '0px 0px 30px rgba(255,255,255,0.1)' : ''}
      >
        <PopupBody paddingH='12px' paddingV='24px' withFooter={actionType !== 'createChat'}>
          <CloseIcon color={colors.textColor2} onClick={handleClosePopup} />

          <PopupName padding='0 12px'>{actionType === 'createChat' ? 'Creat a new chat' : popupTitleText}</PopupName>
          <SearchUserCont className='p-relative'>
            <StyledSearchSvg />
            <SearchUsersInput
              height='40px'
              onChange={handleTypeSearchUser}
              value={userSearchValue}
              placeholder='Search for users'
              type='text'
              widthBorder={theme !== THEME.DARK}
              backgroundColor={colors.backgroundColor}
              color={colors.textColor1}
            />
            {userSearchValue && <ClearTypedText color={colors.textColor1} onClick={() => setUserSearchValue('')} />}
          </SearchUserCont>
          {actionType !== 'createChat' && selectedMembers.length !== 0 && (
            <SelectedMembersContainer ref={selectedMembersCont}>
              {selectedMembers.map((member) => {
                return (
                  <SelectedMemberBubble backgroundColor={colors.backgroundColor} key={`selected-${member.id}`}>
                    <Avatar
                      image={member.avatarUrl}
                      name={member.displayName || member.id}
                      size={28}
                      textSize={12}
                      setDefaultAvatar
                      border={'0.5px solid rgba(0, 0, 0, 0.1)'}
                    />
                    <SelectedMemberName color={colors.textColor1}>{member.displayName}</SelectedMemberName>
                    <StyledSubtractSvg onClick={() => removeMember(member)} />
                  </SelectedMemberBubble>
                )
              })}
            </SelectedMembersContainer>
          )}

          {/* <MembersContainer > */}
          <MembersContainer
            isAdd={actionType !== 'createChat'}
            selectedMembersHeight={usersContHeight}
            onScroll={handleMembersListScroll}
          >
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
                  isAdd={actionType !== 'createChat'}
                  hoverBackground={colors.hoverBackgroundColor}
                  key={user.id}
                  onClick={() => actionType === 'createChat' && handleAddMember(user)}
                >
                  <Avatar
                    image={user.avatarUrl}
                    name={user.firstName || user.id}
                    size={40}
                    textSize={16}
                    setDefaultAvatar
                  />

                  <UserNamePresence>
                    <MemberName color={colors.textColor1}>{memberDisplayName}</MemberName>
                    <SubTitle>
                      {user.presence && user.presence.state === USER_PRESENCE_STATUS.ONLINE
                        ? 'Online'
                        : user.presence &&
                          user.presence.lastActiveAt &&
                          userLastActiveDateFormat(user.presence.lastActiveAt)}
                    </SubTitle>
                  </UserNamePresence>
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
                      backgroundColor={theme === THEME.DARK ? colors.backgroundColor : colors.white}
                      checkedBackgroundColor={colors.primary}
                      onChange={(e) =>
                        handleUserSelect(e, { id: user.id, displayName: memberDisplayName, avatarUrl: user.avatarUrl })
                      }
                      size='18px'
                    />
                    /* <SelectMember
                        name='member-username'
                        type='checkbox'
                        checked={isSelected}
                        onChange={(e) => handleUserSelect(e, { id: contact.user.id, displayName: memberDisplayName })}
                      /> */
                  )}
                </ListRow>
              )
            })}
          </MembersContainer>
          {/* </MembersContainer> */}
        </PopupBody>

        {actionType !== 'createChat' && (
          <PopupFooter backgroundColor={colors.backgroundColor} marginTop='auto'>
            {actionType === 'selectUsers' ? (
              <Button type='button' color={colors.textColor1} backgroundColor='transparent' onClick={handleGoBack}>
                Back
              </Button>
            ) : (
              <Button type='button' color={colors.textColor1} backgroundColor='transparent' onClick={toggleCreatePopup}>
                Cancel
              </Button>
            )}
            <Button
              type='button'
              color={colors.white}
              backgroundColor={colors.primary}
              borderRadius='8px'
              disabled={selectIsRequired && selectedMembers.length === 0}
              onClick={() => handleCreateChannel()}
            >
              {actionType === 'selectUsers' ? 'Create' : 'Add'}
            </Button>
          </PopupFooter>
        )}
      </Popup>
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
}>`
  display: flex;
  flex-direction: column;
  //margin-top: 24px;
  position: relative;
  max-height: ${(props) => `calc(100% - (${(props.isAdd ? 67 : 70) + props.selectedMembersHeight}px))`};
  overflow-y: auto;

  //width: calc(100% + 16px);
  padding-right: 16px;

  /* width */
  &::-webkit-scrollbar {
    width: 8px;
  }

  /* Track */
  &::-webkit-scrollbar-track {
    background: transparent;
  }

  /* Handle */
  &::-webkit-scrollbar-thumb {
    background: #b6b6b6;
    border-radius: 4px;
  }

  /* Handle on hover */
  &::-webkit-scrollbar-thumb:hover {
    background: #555;
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

const SearchUsersInput = styled.input<{ widthBorder?: boolean; backgroundColor?: string; color?: string }>`
  height: 40px;
  width: 100%;
  font-size: 14px;
  border: ${(props) => (props.widthBorder ? `1px solid ${colors.gray1}` : 'none')};
  box-sizing: border-box;
  border-radius: 8px;
  padding-left: 36px;
  color: ${(props) => props.color || colors.textColor1};
  background-color: ${(props) => props.backgroundColor || colors.backgroundColor};

  &::placeholder {
    color: ${colors.textColor2};
    font-size: 14px;
    opacity: 1;
  }

  &:focus {
    outline: none;
  }
`

const ListRow = styled.div<{ isAdd: boolean; hoverBackground?: string }>`
  display: flex;
  justify-content: space-between;
  flex-direction: row;
  align-items: center;
  padding: 7px 12px;
  cursor: ${(props) => !props.isAdd && 'pointer'};
  border-radius: 6px;
  transition: all 0.2s;

  &:hover {
    background-color: ${(props) => !props.isAdd && (props.hoverBackground || colors.gray0)};
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
  color: ${(props) => props.color || colors.textColor1};
  margin: 0;
  max-width: calc(100% - 10px);
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
`

const SelectedMembersContainer = styled.div`
  display: flex;
  justify-content: flex-start;
  flex-wrap: wrap;
  width: 100%;
  max-height: 85px;
  overflow-x: hidden;
  padding: 2px 12px 0;
  box-sizing: border-box;
  //flex: 0 0 auto;
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
  color: ${(props) => props.color || colors.textColor1};
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
