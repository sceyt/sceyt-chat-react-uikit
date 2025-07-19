import React, { useState } from 'react'
import { useDispatch } from 'react-redux'
import styled from 'styled-components'
import { THEME_COLORS } from '../../../../UIHelper/constants'
import { Button, CustomInput, Label, PopupFooter } from '../../../../UIHelper'
import { IUser } from '../../../../types'
import { updateProfileAC } from '../../../../store/user/actions'
import Avatar from '../../../Avatar'
import { useColor } from '../../../../hooks'

interface IProps {
  user: IUser
  handleCloseEditProfile: () => void
}

// eslint-disable-next-line no-empty-pattern
const EditProfile = ({ handleCloseEditProfile, user }: IProps) => {
  const {
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.BORDER]: borderColor,
    [THEME_COLORS.TEXT_FOOTNOTE]: textFootnote,
    [THEME_COLORS.WARNING]: warningColor,
    [THEME_COLORS.TEXT_ON_PRIMARY]: textOnPrimary,
    [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.BACKGROUND]: background,
    [THEME_COLORS.SURFACE_1]: surface1
  } = useColor()

  const dispatch = useDispatch()
  const [firstName, setFirstName] = useState(user.firstName)
  const [lastName, setLastName] = useState(user.lastName)
  // const [presenceStatus, setPresenceStatus] = useState(user.presence?.status)
  /*  const handleEditProfile = () => {

  } */
  const handleTypeFirstName = (e: any) => {
    setFirstName(e.target.value)
  }

  const handleTypeLastName = (e: any) => {
    setLastName(e.target.value)
  }

  /* const handlePresenceStatus = (e: any) => {
    setPresenceStatus(e.target.value)
  }
*/
  const handleEditProfile = () => {
    dispatch(updateProfileAC(user, firstName, lastName, '', '', undefined))
    handleCloseEditProfile()
  }

  return (
    <Container backgroundColor={background}>
      <EditAvatarCont>
        <Avatar name={user.firstName || user.id} size={144} image={user.avatarUrl} setDefaultAvatar />
      </EditAvatarCont>

      <EditProfileBody>
        <Label color={textSecondary}>Firstname</Label>
        <CustomInput
          type='text'
          color={textPrimary}
          errorColor={warningColor}
          placeholderColor={textFootnote}
          borderColor={borderColor}
          backgroundColor={background}
          value={firstName}
          onChange={handleTypeFirstName}
          placeholder='Firstname'
          disabledColor={surface1}
        />

        <Label color={textPrimary}>Lastname</Label>
        <CustomInput
          type='text'
          color={textPrimary}
          errorColor={warningColor}
          borderColor={borderColor}
          placeholderColor={textFootnote}
          backgroundColor={background}
          value={lastName}
          onChange={handleTypeLastName}
          placeholder='Lastname'
          disabledColor={surface1}
        />

        {/* <Label>About</Label> */}
        {/* <CustomInput type='text' value={presenceStatus} onChange={handlePresenceStatus} placeholder='About' /> */}
      </EditProfileBody>

      <PopupFooter>
        <Button onClick={handleCloseEditProfile} backgroundColor={'transparent'} color={textPrimary} borderRadius='8px'>
          Cancel
        </Button>
        <Button
          onClick={handleEditProfile}
          color={textOnPrimary}
          backgroundColor={accentColor}
          borderRadius='8px'
          margin='0 0 0 12px'
        >
          Save
        </Button>
      </PopupFooter>
    </Container>
  )
}

export default EditProfile

const Container = styled.div<{ backgroundColor: string }>`
  position: absolute;
  width: 100%;
  height: 100%;
  top: 64px;
  left: 0;
  background-color: ${(props) => props.backgroundColor};
`

const EditAvatarCont = styled.div`
  display: flex;
  justify-content: center;
  margin: 20px 0 24px;
`

const EditProfileBody = styled.div`
  padding: 0 16px;
  margin-bottom: 16px;
`
