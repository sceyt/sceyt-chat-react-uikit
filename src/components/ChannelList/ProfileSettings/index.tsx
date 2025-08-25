import React, { useState } from 'react'
import { useSelector } from 'store/hooks'
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
import { THEME_COLORS } from '../../../UIHelper/constants'
import { DropdownOptionLi, DropdownOptionsUl, SectionHeader } from '../../../UIHelper'
// Components
import Avatar from '../../Avatar'
import EditProfile from './EditProfile'
import { useColor } from '../../../hooks'

interface IChannelTabsProps {
  handleCloseProfile: () => void
}

const settingsPages = {
  profile: 'Profile',
  notifications: 'Notifications',
  about: 'About'
}

const ProfileSettings = ({ handleCloseProfile }: IChannelTabsProps) => {
  const {
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.WARNING]: warningColor,
    [THEME_COLORS.BACKGROUND_HOVERED]: backgroundHovered,
    [THEME_COLORS.BACKGROUND]: background,
    [THEME_COLORS.BORDER]: borderColor,
    [THEME_COLORS.ICON_INACTIVE]: iconInactive
  } = useColor()

  const [editProfileIsOpen, setEditProfileIsOpen] = useState(false)
  const [activeSettingPage, setActiveSettingPage] = useState('')
  const user = useSelector(userSelector)

  const handleOpenEditProfile = () => {
    setActiveSettingPage(editProfileIsOpen ? '' : settingsPages.profile)
    setEditProfileIsOpen(!editProfileIsOpen)
  }
  return (
    <Container backgroundColor={background} borderColor={borderColor}>
      <SettingsHeader borderColor={borderColor}>
        <ArrowLeftWrapper
          onClick={activeSettingPage === settingsPages.profile ? handleOpenEditProfile : handleCloseProfile}
          color={textPrimary}
        >
          <ArrowLeft />
        </ArrowLeftWrapper>
        <SectionHeader color={textPrimary}>
          {activeSettingPage === settingsPages.profile ? 'Edit profile' : 'Settings'}
        </SectionHeader>
      </SettingsHeader>

      <ProfileInfo>
        <Avatar name={user.firstName || user.id} size={144} image={user.avatarUrl} setDefaultAvatar />
        <Username color={textPrimary}>{`${user.firstName} ${user.lastName}`}</Username>
        <UserNumber color={textSecondary}>{`+${user.id}`}</UserNumber>
      </ProfileInfo>

      <DropdownOptionsUl>
        <DropdownOptionLi
          hoverBackground={backgroundHovered}
          iconWidth='20px'
          textColor={textPrimary}
          iconColor={iconInactive}
          margin='0 0 24px'
          onClick={handleOpenEditProfile}
        >
          <DefaultAvatar /> Profile
        </DropdownOptionLi>
        <DropdownOptionLi
          hoverBackground={backgroundHovered}
          iconWidth='20px'
          textColor={textPrimary}
          iconColor={iconInactive}
          margin='0 0 24px'
        >
          <NotificationsIcon /> Notifications
        </DropdownOptionLi>
        <DropdownOptionLi
          hoverBackground={backgroundHovered}
          iconWidth='20px'
          textColor={textPrimary}
          iconColor={iconInactive}
          margin='0 0 24px'
        >
          <LockIcon /> About
        </DropdownOptionLi>
        <DropdownOptionLi
          hoverBackground={backgroundHovered}
          iconWidth='20px'
          textColor={warningColor}
          iconColor={warningColor}
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

const Container = styled.div<{ backgroundColor: string; borderColor: string }>`
  position: absolute;
  height: 100%;
  width: 100%;
  background-color: ${(props) => props.backgroundColor};
  border-right: 1px solid ${(props) => props.borderColor};
`

const SettingsHeader = styled.div<{ borderColor: string }>`
  display: flex;
  align-items: center;
  padding: 16px;
  height: 64px;
  border-bottom: 1px solid ${(props) => props.borderColor};
  box-sizing: border-box;
`

const ArrowLeftWrapper = styled.span<{ color: string }>`
  display: flex;
  cursor: pointer;
  margin-right: 12px;
  svg {
    path {
      fill: ${(props) => props.color};
    }
  }
`

const ProfileInfo = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 20px 0 24px;
`

const Username = styled.h3<{ color: string }>`
  margin: 16px 0 0;
  font-weight: 500;
  font-size: 15px;
  line-height: 18px;
  letter-spacing: -0.2px;
  color: ${(props) => props.color};
`

const UserNumber = styled.h4<{ color: string }>`
  margin: 0;
  font-weight: 400;
  font-size: 13px;
  line-height: 16px;
  letter-spacing: -0.078px;
  color: ${(props) => props.color};
`
