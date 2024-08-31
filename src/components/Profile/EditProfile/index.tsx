import React, { useRef, useState } from 'react'
import styled from 'styled-components'
import {
  ButtonBlock,
  Popup,
  PopupName,
  CloseIcon,
  Label,
  CustomInput,
  UploadAvatarButton,
  UploadAvatarHandler
} from '../../../UIHelper'
import { ReactComponent as UploadImageIcon } from '../../../../assets/svg/uploadImage.svg'
import { ReactComponent as DeleteUpload } from '../../../assets/svg/deleteUpload.svg'
import { useColor, useStateComplex } from '../../../hooks'
import ImageCrop from '../../../common/imageCrop'
import Avatar from '../../Avatar'
import PopupContainer from '../../../common/popups/popupContainer'
import { THEME_COLOR_NAMES } from '../../../UIHelper/constants'
// import { updateUser } from '../../../../store/user/actions';
// import { setErrorNotification } from '../../../../store/channel/actions';

export default function EditProfile({ toggleEditPopup, user }: any) {
  const textPrimary = useColor(THEME_COLOR_NAMES.TEXT_PRIMARY)
  // const dispatch = useDispatch()

  const fileUploader: any = useRef(null)
  const [firstNameValue, setFirstNameValue] = useState<string>(user.firstName)
  const [lastNameValue, setLastNameValue] = useState<string>(user.lastName)
  const [cropPopup, setCropPopup] = useState(false)
  const [newAvatar, setNewAvatar] = useStateComplex({
    src: {},
    url: user.avatarUrl // channelDetails.avatar
  })

  const handleTypeFirstName = (e: any) => {
    setFirstNameValue(e.currentTarget.value)
  }

  const handleTypeLastName = (e: any) => {
    setLastNameValue(e.currentTarget.value)
  }

  const handleRemoveUpload = () => {
    setNewAvatar({
      url: ''
    })
  }

  function handleSelectImage(image: File) {
    setNewAvatar({
      url: URL.createObjectURL(image),
      name: image.name
    })
    setCropPopup(true)
  }

  const handleFileUpload = () => {
    const file = fileUploader.current && fileUploader.current.files[0]
    if (file.size < 1000000) {
      handleSelectImage(file)
    } else {
      // dispatch(setErrorNotification('The file is too large. Allowed Maximum size is 1m'))
    }
  }

  function handleImageCrop(image: File) {
    setNewAvatar({
      src: {
        file: image
      },
      url: URL.createObjectURL(image)
    })
  }

  const handleOpenFileUploader = () => {
    fileUploader.current.click()
  }

  const handleUpdateProfile = () => {
    /* const fieldsToUpdate = {
      firstName: firstNameValue,
      lastName: lastNameValue,
      avatarUrl: newAvatar.url
    } */
    if (newAvatar.src.file) {
      // fieldsToUpdate.avatarFile = newAvatar.src.file
    }

    // dispatch(updateUser(fieldsToUpdate))
    toggleEditPopup()
  }

  return (
    <PopupContainer>
      <Popup maxHeight='482px' width='433px' maxWidth='433px' height='calc(100vh - 50px)' padding='22px 24px 8px'>
        <CloseIcon onClick={toggleEditPopup} />

        <PopupName color={textPrimary}>Edit Profile</PopupName>

        <EditProfileContainer>
          <Label color={textPrimary}>Username </Label>
          <CustomInput type='text' color={textPrimary} value={user.id} disabled />

          <Label color={textPrimary}>First name </Label>
          <CustomInput
            type='text'
            color={textPrimary}
            value={firstNameValue}
            onChange={handleTypeFirstName}
            placeholder='Enter Firstname'
          />

          <Label color={textPrimary}>Last name </Label>
          <CustomInput
            type='text'
            color={textPrimary}
            value={lastNameValue}
            onChange={handleTypeLastName}
            placeholder='Enter Lastname'
          />

          <Label color={textPrimary}>Avatar</Label>
          <UploadChannelAvatar>
            {newAvatar.url ? (
              <AvatarBadge>
                <RemoveUploadIcon onClick={handleRemoveUpload} />
                <Avatar image={newAvatar.url} size={68} name={firstNameValue || user.id} textSize={16} />
              </AvatarBadge>
            ) : (
              <UploadImageIcon />
            )}

            <UploadAvatarHandler color={textPrimary}>
              Format: JPEG, PNG ( max size 1MB )
              <UploadAvatarButton onClick={handleOpenFileUploader}>Upload Photo</UploadAvatarButton>
              <FileUploaderInput ref={fileUploader} type='file' accept='image/*' onChange={handleFileUpload} />
            </UploadAvatarHandler>
          </UploadChannelAvatar>
        </EditProfileContainer>

        <PopupButtons height='72px' marginTop='0' paddingRight='24px'>
          <button type='button' className='button gray' onClick={toggleEditPopup}>
            Cancel
          </button>
          <button type='button' className='button filled' onClick={handleUpdateProfile}>
            Save
          </button>
        </PopupButtons>
      </Popup>

      {cropPopup && (
        // eslint-disable-next-line react/jsx-no-bind
        <ImageCrop image={newAvatar} onAccept={handleImageCrop} handleClosePopup={() => setCropPopup(false)} />
      )}
    </PopupContainer>
  )
}

const AvatarBadge = styled.div`
  position: relative;
`

const RemoveUploadIcon = styled(DeleteUpload)`
  position: absolute;
  right: -2px;
  top: -2px;
  cursor: pointer;
`

const EditProfileContainer = styled.div`
  height: 100%;
  overflow-y: auto;
  margin-right: -25px;
  padding-right: 25px;
`

const UploadChannelAvatar = styled.div`
  display: flex;
  align-items: center;
`

// const UploadAvatarHandler = styled.div`
//   margin-left: 18px;
//   font-size: 13px;
// `;

const PopupButtons = styled(ButtonBlock)`
  z-index: 9;
  margin-top: auto;
  padding-right: 0;
  background-color: rgba(255, 255, 255, 0.97);
  margin-right: -4px;
  box-sizing: border-box;
`

const FileUploaderInput = styled.input`
  display: none;
`
