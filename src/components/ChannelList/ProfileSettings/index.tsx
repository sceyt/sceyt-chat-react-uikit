import React, { useState } from 'react'
import { useSelector } from 'react-redux'
import styled from 'styled-components'
// Store
import { userSelector } from '../../../store/user/selector'
// Assets
import { ReactComponent as ArrowLeft } from '../../../assets/svg/arrowLeft.svg'
import { ReactComponent as DefaultAvatar } from '../../../assets/svg/avatar.svg'
import { ReactComponent as NotificationsIcon } from '../../../assets/svg/notifications.svg'
import { ReactComponent as LockIcon } from '../../../assets/svg/lock.svg'
import { ReactComponent as LogoutIcon } from '../../../assets/svg/leave.svg'
// Helpers
import { colors } from '../../../UIHelper/constants'
import { DropdownOptionLi, DropdownOptionsUl, SectionHeader } from '../../../UIHelper'
// Components
import Avatar from '../../Avatar'
import EditProfile from './EditProfile'

interface IChannelTabsProps {
  handleCloseProfile: () => void
}

const settingsPages = {
  profile: 'Profile',
  notifications: 'Notifications',
  about: 'About'
}

const ProfileSettings = ({ handleCloseProfile }: IChannelTabsProps) => {
  const [editProfileIsOpen, setEditProfileIsOpen] = useState(false)
  const [activeSettingPage, setActiveSettingPage] = useState('')
  const user = useSelector(userSelector)

  const handleOpenEditProfile = () => {
    setActiveSettingPage(editProfileIsOpen ? '' : settingsPages.profile)
    setEditProfileIsOpen(!editProfileIsOpen)
  }
  return (
    <Container>
      <SettingsHeader>
        <ArrowLeftWrapper
          onClick={activeSettingPage === settingsPages.profile ? handleOpenEditProfile : handleCloseProfile}
        >
          <ArrowLeft />
        </ArrowLeftWrapper>
        <SectionHeader>{activeSettingPage === settingsPages.profile ? 'Edit profile' : 'Settings'}</SectionHeader>
      </SettingsHeader>

      <ProfileInfo>
        <Avatar name={user.firstName || user.id} size={144} image={user.avatarUrl} setDefaultAvatar />
        <Username>{`${user.firstName} ${user.lastName}`}</Username>
        <UserNumber>{`+${user.id}`}</UserNumber>
      </ProfileInfo>

      <DropdownOptionsUl>
        <DropdownOptionLi
          hoverBackground='none'
          iconWidth='20px'
          textColor={colors.textColor1}
          iconColor={colors.textColor2}
          margin='0 0 24px'
          onClick={handleOpenEditProfile}
        >
          <DefaultAvatar /> Profile
        </DropdownOptionLi>
        <DropdownOptionLi
          hoverBackground='none'
          iconWidth='20px'
          textColor={colors.textColor1}
          iconColor={colors.textColor2}
          margin='0 0 24px'
        >
          <NotificationsIcon /> Notifications
        </DropdownOptionLi>
        <DropdownOptionLi
          hoverBackground='none'
          iconWidth='20px'
          textColor={colors.textColor1}
          iconColor={colors.textColor2}
          margin='0 0 24px'
        >
          <LockIcon /> About
        </DropdownOptionLi>
        <DropdownOptionLi
          hoverBackground='none'
          iconWidth='20px'
          textColor={colors.red1}
          iconColor={colors.red1}
          margin='0 0 24px'
        >
          <LogoutIcon /> Log Out
        </DropdownOptionLi>
      </DropdownOptionsUl>

      {editProfileIsOpen && <EditProfile user={user} handleCloseEditProfile={handleOpenEditProfile} />}
    </Container>
  )
}

export default ProfileSettings

const Container = styled.div`
  position: absolute;
  height: 100%;
  width: 100%;
  background-color: ${colors.white};
  border-right: 1px solid ${colors.gray1};
`

const SettingsHeader = styled.div`
  display: flex;
  align-items: center;
  padding: 16px;
  height: 64px;
  border-bottom: 1px solid ${colors.gray1};
  box-sizing: border-box;
`

const ArrowLeftWrapper = styled.span`
  display: flex;
  cursor: pointer;
  margin-right: 12px;
`

const ProfileInfo = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 20px 0 24px;
`

const Username = styled.h3`
  margin: 16px 0 0;
  font-weight: 500;
  font-size: 15px;
  line-height: 18px;
  letter-spacing: -0.2px;
  color: ${colors.textColor1};
`

const UserNumber = styled.h4`
  margin: 0;
  font-weight: 400;
  font-size: 13px;
  line-height: 16px;
  letter-spacing: -0.078px;
  color: ${colors.textColor2};
`
