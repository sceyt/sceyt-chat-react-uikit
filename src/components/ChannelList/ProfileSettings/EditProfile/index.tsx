import styled from 'styled-components'
import React, { useState } from 'react'
import { colors } from '../../../../UIHelper/constants'
import { Button, CustomInput, Label, PopupFooter } from '../../../../UIHelper'
import Avatar from '../../../Avatar'
import { IUser } from '../../../../types'
import { updateProfileAC } from '../../../../store/user/actions'
import { useDispatch } from 'react-redux'

interface IProps {
  user: IUser
  handleCloseEditProfile: () => void
}

// eslint-disable-next-line no-empty-pattern
const EditProfile = ({ handleCloseEditProfile, user }: IProps) => {
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
        <Label>Firstname</Label>
        <CustomInput type='text' value={firstName} onChange={handleTypeFirstName} placeholder='Firstname' />

        <Label>Lastname</Label>
        <CustomInput type='text' value={lastName} onChange={handleTypeLastName} placeholder='Lastname' />

        {/* <Label>About</Label> */}
        {/* <CustomInput type='text' value={presenceStatus} onChange={handlePresenceStatus} placeholder='About' /> */}
      </EditProfileBody>

      <PopupFooter>
        <Button onClick={handleCloseEditProfile} backgroundColor={colors.gray0} color={colors.gray6} borderRadius='8px'>
          Cancel
        </Button>
        <Button onClick={handleEditProfile} backgroundColor={colors.primary} borderRadius='8px' margin='0 0 0 12px'>
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
