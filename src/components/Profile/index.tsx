import React from 'react'
import styled from 'styled-components'
// import { useDispatch, useSelector } from 'react-redux'
// import { ReactComponent as ProfileLogo } from '../../../assets/lib/svg/profile.svg'
// import { ReactComponent as LeftIcon } from '../../../assets/lib/svg/leave.svg'
// import EditProfile from './EditProfile'
// import { colors } from '../../../UIHelper/constants'

function Profile() {
  // const user = useSelector(userSelector) || {};
  // const dispatch = useDispatch()
  // const [dropdownIsOpen, setDropdownIsOpen] = useState(false)
  // const [editProfilePopupVisible, setEditProfilePopupVisible] = useState(false)

  /* const watchDropdownState = (state) => {
    setDropdownIsOpen(state);
  }; */
  /*
  const toggleEditProfilePopup = () => {
    setEditProfilePopupVisible(!editProfilePopupVisible)
  }

  const handleLogout = () => {
    // dispatch(logout());
  } */

  return (
    <Container>
      {/* <DropDown
        isSelect
        withIcon
        height="44px"
        watchToggleState={watchDropdownState}
        trigger={(
          <UserInfo isOpen={dropdownIsOpen}>
            <UserName>{`${user.firstName} ${user.lastName && `${user.lastName[0]}.`}`}</UserName>
            {user.id && <Avatar avatarColor={user.id} size={32} avatar={user.avatarUrl} avatarName={user.firstName ||
             user.id} textSize="13px" />}
          </UserInfo>
                  )}
      >
        <DropdownOptionsUl>
          <ProfileDropDownHeader
            key={0}
          >
            <UserInfoDropdown>
              <Avatar avatarColor={user.id} size={48} avatar={user.avatarUrl} avatarName={user.firstName || user.id}
               textSize="16px" />
              <UserName>{`${user.firstName} ${user.lastName && `${user.lastName[0]}.`}`}</UserName>
            </UserInfoDropdown>
          </ProfileDropDownHeader>
          <DropdownOptionLi
            key={1}
            onClick={() => toggleEditProfilePopup()}
          >
            <ProfileLogo />
            {' '}
            View ProfileSettings
          </DropdownOptionLi>
          <DropdownOptionLi
            key={2}
            onClick={() => handleLogout()}
          >
            <LeftIcon />
            {' '}
            Sign out
          </DropdownOptionLi>
        </DropdownOptionsUl>
      </DropDown> */}

      {/* {editProfilePopupVisible
                && <EditProfile toggleEditPopup={toggleEditProfilePopup} user={user} />} */}
    </Container>
  )
}

const Container = styled.div``
/*

const UserInfo = styled.div<any>`
  display: flex;
  align-items: center;
  height: 100%;
  transition: all 0.2s;
  padding: 3px 35px 3px 6px;
  box-sizing: border-box;

  ${(props) =>
    props.isOpen &&
    `
    background-color: ${colors.blue4};
  `};
  &:hover {
    background-color: ${colors.blue4};
  }
`
const UserName = styled.span`
  font-style: normal;
  font-weight: normal;
  font-size: 15px;
  line-height: 20px;
  text-align: right;
  margin-right: 12px;
  color: #ffffff;
`

const UserInfoDropdown = styled.div`
  display: flex;
  align-items: center;
  height: 100%;

  ${UserName} {
    font-weight: 500;
    font-size: 16px;
    color: ${colors.blue6};
    margin-left: 12px;
  }
`

const ProfileDropDownHeader = styled(DropdownOptionLi)`
  padding-top: 13px;
  padding-bottom: 13px;
  margin-bottom: 11px;
  border-bottom: 1px solid #DFE0EB;
  pointer-events: none;
`; */

export default Profile
