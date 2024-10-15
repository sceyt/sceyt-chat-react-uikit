import React, { useState } from 'react'
import { useDispatch } from 'react-redux'
import styled from 'styled-components'
import { colors, THEME_COLOR_NAMES } from '../../../../UIHelper/constants'
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
    [THEME_COLOR_NAMES.TEXT_PRIMARY]: textPrimary,
    [THEME_COLOR_NAMES.BORDER]: borderColor,
    [THEME_COLOR_NAMES.SECTION_BACKGROUND]: sectionBackground,
    [THEME_COLOR_NAMES.SURFACE_1]: surface1Background,
    [THEME_COLOR_NAMES.TEXT_FOOTNOTE]: textFootnote,
    [THEME_COLOR_NAMES.ERROR]: errorColor
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
    <Container>
      <EditAvatarCont>
        <Avatar name={user.firstName || user.id} size={144} image={user.avatarUrl} setDefaultAvatar />
      </EditAvatarCont>

      <EditProfileBody>
        <Label color={textPrimary}>Firstname</Label>
        <CustomInput
          type='text'
          color={textPrimary}
          errorColor={errorColor}
          placeholderColor={textFootnote}
          borderColor={borderColor}
          backgroundColor={sectionBackground}
          value={firstName}
          onChange={handleTypeFirstName}
          placeholder='Firstname'
        />

        <Label color={textPrimary}>Lastname</Label>
        <CustomInput
          type='text'
          color={textPrimary}
          errorColor={errorColor}
          borderColor={borderColor}
          placeholderColor={textFootnote}
          backgroundColor={sectionBackground}
          value={lastName}
          onChange={handleTypeLastName}
          placeholder='Lastname'
        />

        {/* <Label>About</Label> */}
        {/* <CustomInput type='text' value={presenceStatus} onChange={handlePresenceStatus} placeholder='About' /> */}
      </EditProfileBody>

      <PopupFooter backgroundColor={surface1Background}>
        <Button onClick={handleCloseEditProfile} backgroundColor={colors.gray0} color={textPrimary} borderRadius='8px'>
          Cancel
        </Button>
        <Button
          onClick={handleEditProfile}
          color={colors.white}
          backgroundColor={colors.primary}
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

const Container = styled.div`
  position: absolute;
  width: 100%;
  height: 100%;
  top: 64px;
  left: 0;
  background-color: ${colors.white};
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
