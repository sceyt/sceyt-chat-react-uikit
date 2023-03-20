import React, { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import { useDispatch, useSelector } from 'react-redux'
import {
  Popup,
  PopupContainer,
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
import { CHANNEL_TYPE, LOADING_STATE, PRESENCE_STATUS } from '../../../helpers/constants'
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
import { makeUserName, userLastActiveDateFormat } from '../../../helpers'
import { getShowOnlyContactUsers } from '../../../helpers/contacts'
import { useDidUpdate } from '../../../hooks'

interface ISelectedUserData {
  id: string
  displayName?: string
  role: string
}

interface IProps {
  channel?: IChannel
  toggleCreatePopup: () => void
  actionType: 'addMembers' | 'createChat' | 'selectUsers'
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
  // const showContactInfo = getShowContactInfo()
  // const roles = useSelector(rolesSelector).map((role) => role.name)
  const contactList = useSelector(contactListSelector)
  const contactsMap = useSelector(contactsMapSelector)
  const usersList = useSelector(usersListSelector)
  const getFromContacts = getShowOnlyContactUsers()
  // const roles: any = []
  // const users = useSelector(usersSelector)
  const usersLoadingState = useSelector(usersLoadingStateSelector)
  const selectedMembersCont = useRef<any>('')

  const [userSearchValue, setUserSearchValue] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<ISelectedUserData[]>(creatChannelSelectedMembers || [])
  const [usersContHeight, setUsersContHeight] = useState(0)
  const [filteredUsers, setFilteredUsers] = useState([])
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
    if (event.target.scrollHeight - event.target.scrollTop <= event.target.offsetHeight + 300) {
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

  const handleUserSelect = (event: any, contact: { id: string; displayName: string }) => {
    const newSelectedMembers = [...selectedMembers]
    if (event.target.checked) {
      newSelectedMembers.push({
        id: contact.id,
        displayName: contact.displayName,
        role: channel?.type === CHANNEL_TYPE.PUBLIC ? 'subscriber' : 'participant'
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
    if (actionType === 'createChat') {
      const channelData = {
        metadata: '',
        label: '',
        type: CHANNEL_TYPE.DIRECT,
        userId: selectedUser && selectedUser.id
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
    handleClosePopup()
  }
  const handleClosePopup = () => {
    toggleCreatePopup()
  }

  useEffect(() => {
    if (getFromContacts) {
      if (!userSearchValue) {
        setFilteredUsers(contactList.map((cont: IContact) => cont.user))
      }
    } else {
      setFilteredUsers(usersList)
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
        setFilteredUsers(filteredContacts.map((cont: IContact) => cont.user))
      } else {
        setFilteredUsers(contactList.map((cont: IContact) => cont.user))
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
    <PopupContainer>
      <Popup
        // isLoading={usersLoadingState}
        maxHeight={popupHeight || '721px'}
        width={popupWidth || '433px'}
        maxWidth={popupWidth || '433px'}
        height={popupHeight}
        padding='0'
        display='flex'
      >
        <PopupBody padding={24} withFooter={actionType !== 'createChat'}>
          <CloseIcon onClick={handleClosePopup} />

          <PopupName>
            {actionType === 'createChat'
              ? 'Creat a new chat'
              : channel?.type === CHANNEL_TYPE.PUBLIC
              ? 'Add subscribers'
              : 'Add members'}
          </PopupName>
          <SearchUserCont className='p-relative'>
            <StyledSearchSvg />
            <SearchUsersInput
              height='40px'
              onChange={handleTypeSearchUser}
              value={userSearchValue}
              placeholder='Search for users'
              type='text'
            />
            {userSearchValue && <ClearTypedText onClick={() => setUserSearchValue('')} />}
          </SearchUserCont>
          {actionType !== 'createChat' && selectedMembers.length !== 0 && (
            <SelectedMembersContainer ref={selectedMembersCont}>
              {selectedMembers.map((member) => {
                return (
                  <SelectedMemberBuble key={`selected-${member.id}`}>
                    <SelectedMemberName>{member.displayName}</SelectedMemberName>
                    <StyledSubtractSvg onClick={() => removeMember(member)} />
                  </SelectedMemberBuble>
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
              const memberDisplayName = makeUserName(contactsMap[user.id], user, getFromContacts)
              return (
                <ListRow
                  isAdd={actionType !== 'createChat'}
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
                    <MemberName>{memberDisplayName}</MemberName>
                    <SubTitle>
                      {user.presence && user.presence.state === PRESENCE_STATUS.ONLINE
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
                      onChange={(e) => handleUserSelect(e, { id: user.id, displayName: memberDisplayName })}
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
          <PopupFooter backgroundColor={colors.gray5} marginTop='auto'>
            {actionType === 'selectUsers' ? (
              <Button type='button' color={colors.gray6} backgroundColor='transparent' onClick={handleGoBack}>
                Back
              </Button>
            ) : (
              <Button type='button' color={colors.gray6} backgroundColor='transparent' onClick={toggleCreatePopup}>
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
  max-height: ${(props) => `calc(100% - (${(props.isAdd ? 75 : 70) + props.selectedMembersHeight}px))`};
  overflow-y: auto;

  width: calc(100% + 16px);
  padding-right: 16px;
`

const SearchUserCont = styled.div`
  position: relative;
  width: 100%;
  margin-top: 24px;

  ${ClearTypedText} {
    top: 10px;
    right: 11px;
  }
`
/*
const SelectMember = styled.input`
  cursor: pointer;
` */

const SearchUsersInput = styled.input`
  height: 40px;
  width: 100%;
  font-size: 14px;
  background: #ffffff;
  border: 1px solid rgb(225, 226, 229);
  box-sizing: border-box;
  border-radius: 8px;
  padding-left: 36px;
  &::placeholder {
    color: ${colors.gray4};
    font-size: 14px;
    opacity: 1;
  }
  &:focus {
    outline: none;
  }
`

const ListRow = styled.div<{ isAdd: boolean }>`
  display: flex;
  justify-content: space-between;
  flex-direction: row;
  align-items: center;
  min-height: 40px;
  padding: 7px 0;
  cursor: ${(props) => !props.isAdd && 'pointer'};
  transition: all 0.2s;

  &:hover {
    background-color: ${(props) => !props.isAdd && colors.gray0};
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

const MemberName = styled.h4`
  font-style: normal;
  font-weight: normal;
  font-size: 15px;
  line-height: 16px;
  color: ${colors.blue6};
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
  padding-top: 2px;
  box-sizing: border-box;
  //flex: 0 0 auto;
`

const SelectedMemberBuble = styled.div`
  display: flex;
  justify-content: space-between;
  background: ${colors.gray5};
  border-radius: 16px;
  align-items: center;
  padding: 4px 10px;
  height: 26px;
  margin: 8px 8px 0 0;
  box-sizing: border-box;
`

const SelectedMemberName = styled.span`
  font-style: normal;
  font-weight: 500;
  font-size: 14px;
  line-height: 16px;
  color: ${colors.blue6};
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
