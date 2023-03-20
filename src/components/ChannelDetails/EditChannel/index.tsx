import styled from 'styled-components'
import React, { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { ReactComponent as CameraIcon } from '../../../assets/svg/camera.svg'
import { ReactComponent as PictureIcon } from '../../../assets/svg/picture.svg'
import { ReactComponent as DeleteIcon } from '../../../assets/svg/deleteChannel.svg'
import {
  Button,
  ButtonBlock,
  CustomInput,
  DropdownOptionLi,
  DropdownOptionsUl,
  Label,
  UploadFile,
  UploadFileLabel
} from '../../../UIHelper'
import DropDown from '../../../common/dropdown'
import Avatar from '../../Avatar'
import { updateChannelAC } from '../../../store/channel/actions'
import { CHANNEL_TYPE } from '../../../helpers/constants'
import { IChannel } from '../../../types'
import { useDidUpdate, useStateComplex } from '../../../hooks'
import ConfirmPopup from '../../../common/popups/delete'
import ImageCrop from '../../../common/imageCrop'
import { channelEditModeSelector } from '../../../store/channel/selector'
import { colors, customColors } from '../../../UIHelper/constants'
import { resizeImage } from '../../../helpers/resizeImage'

const Container = styled.div<{ active: boolean; heightOffset: any }>`
  ${(props) => (props.active ? 'display: block' : 'display: none')};
  height: ${(props) => `calc(100vh - ${props.heightOffset ? props.heightOffset + 48 : 48}px)`};
  position: absolute;
  padding: 24px 16px;
  background-color: #fff;
  z-index: 25;
`

const AvatarCont = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  margin-bottom: 4px;

  &::after {
    content: '';
    position: absolute;
    width: 120px;
    height: 120px;
    border-radius: 50%;
    background-color: rgba(0, 0, 0, 0.4);
  }
  .dropdown-body {
    top: inherit;
    right: inherit;
    bottom: -90px;
  }
`

const DropDownWrapper = styled.div`
  position: absolute;
  z-index: 4;
  width: 40px;
  height: 40px;
`

const EditChannelFooter = styled(ButtonBlock)`
  margin-top: 24px;

  & > button {
    margin-left: 12px;
  }
`

interface IProps {
  channel: IChannel
  handleToggleEditMode: (state: boolean) => void
  editChannelSaveButtonBackgroundColor?: string
  editChannelSaveButtonTextColor?: string
  editChannelCancelButtonBackgroundColor?: string
  editChannelCancelButtonTextColor?: string
}

const EditChannel = ({
  channel,
  handleToggleEditMode,
  editChannelSaveButtonBackgroundColor,
  editChannelSaveButtonTextColor,
  editChannelCancelButtonBackgroundColor,
  editChannelCancelButtonTextColor
}: IProps) => {
  const dispatch = useDispatch()
  const isEditMode = useSelector(channelEditModeSelector)
  const [cropPopup, setCropPopup] = useState(false)
  const [deleteAvatarPopupOpen, setDeleteAvatarPopupOpen] = useState(false)
  const [selectedImageUrl, setSelectedImageUrl] = useState('')
  const [newSubject, setNewSubject] = useState(channel.subject)
  const [newDescription, setNewDescription] = useState(channel.metadata && channel.metadata.d)
  const [offsetTop, setOffsetTop] = useState(null)
  const [newAvatar, setNewAvatar] = useStateComplex({
    src: {},
    url: channel.avatarUrl // channelDetails.avatar
  })

  const editContainer = useRef<any>(null)
  const fileUploader = useRef<any>(null)
  const isDirectChannel = channel.type === CHANNEL_TYPE.DIRECT

  const onOpenFileUploader = () => {
    fileUploader.current.click()
  }

  function handleSelectImage(image: File) {
    setNewAvatar({
      name: image.name
    })
    setSelectedImageUrl(URL.createObjectURL(image))
    setCropPopup(true)
  }
  const handleUpdateChannel = (data: any) => {
    dispatch(updateChannelAC(channel.id, data))
  }

  const handleImageCrop = async (image: File) => {
    const { blob } = await resizeImage(image, undefined, undefined, 0.9)
    const file = new File([blob!], image.name)
    setNewAvatar({
      src: {
        file
      },
      url: URL.createObjectURL(file)
    })
    // handleUpdateChannel({ avatar: image })
  }

  const handleFileUpload = () => {
    const file = fileUploader.current.files[0]
    // if (file.size < 1000000) {
    handleSelectImage(file)
    // } else {
    /* dispatch(
        setErrorNotification(
          'The file is too large. Allowed Maximum size is 1m'
        )
      ) */
    // }
  }

  const handleRemoveAvatar = () => {
    setNewAvatar({
      src: {},
      url: ''
    })
    handleUpdateChannel({ avatarUrl: '' })
  }

  const handleToggleDeleteAvatarPopup = () => {
    setDeleteAvatarPopupOpen(!deleteAvatarPopupOpen)
  }

  const handleSave = () => {
    if (
      newSubject !== channel.subject ||
      newDescription !== (channel.metadata.d || channel.metadata) ||
      newAvatar.url !== channel.avatarUrl
    ) {
      handleUpdateChannel({
        ...(newSubject !== channel.subject && { subject: newSubject }),
        ...(newDescription !== (channel.metadata.d || channel.metadata) && { metadata: { d: newDescription } }),
        ...(newAvatar.url !== channel.avatarUrl && { avatar: newAvatar.src.file })
      })
    }
  }

  useDidUpdate(() => {
    handleToggleEditMode(false)
    setSelectedImageUrl('')
    setNewSubject(channel.subject)
    setNewDescription(channel.metadata.d || channel.metadata)
    setNewAvatar({
      src: {},
      url: channel.avatarUrl // channelDetails.avatar
    })
  }, [channel])

  useEffect(() => {
    setOffsetTop(editContainer && editContainer.current && editContainer.current.offsetTop)
  }, [])
  return (
    <React.Fragment>
      <Container ref={editContainer} heightOffset={offsetTop} active={isEditMode}>
        <AvatarCont>
          <DropDownWrapper>
            {!isDirectChannel && channel.role && (
              <DropDown position='center' trigger={<CameraIcon />}>
                <DropdownOptionsUl>
                  <DropdownOptionLi
                    key={1}
                    hoverBackground={customColors.selectedChannelBackground}
                    onClick={() => onOpenFileUploader()}
                    iconWidth='20px'
                  >
                    <PictureIcon />
                    <UploadFileLabel>Upload Avatar</UploadFileLabel>
                    <UploadFile ref={fileUploader} accept='.png,.jpeg,.jpg' onChange={handleFileUpload} type='file' />
                  </DropdownOptionLi>
                  {newAvatar.url && (
                    <DropdownOptionLi
                      key={2}
                      hoverBackground={customColors.selectedChannelBackground}
                      textColor={colors.red1}
                      onClick={handleToggleDeleteAvatarPopup}
                      iconWidth='20px'
                    >
                      <DeleteIcon />
                      Remove Avatar
                    </DropdownOptionLi>
                  )}
                </DropdownOptionsUl>
              </DropDown>
            )}
          </DropDownWrapper>
          <Avatar
            size={120}
            image={newAvatar.url || (isDirectChannel ? channel.peer.avatarUrl : '')}
            name={isDirectChannel ? channel.peer.id : channel.subject || channel.id}
            textSize={70}
          />
        </AvatarCont>

        <Label> Name </Label>
        <CustomInput placeholder='Channel Subject' value={newSubject} onChange={(e) => setNewSubject(e.target.value)} />

        <Label> Description </Label>
        <CustomInput
          placeholder='Channel description'
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
        />

        <EditChannelFooter>
          <Button
            type='button'
            borderRadius='8px'
            color={editChannelCancelButtonTextColor || colors.gray6}
            backgroundColor={editChannelCancelButtonBackgroundColor || colors.gray5}
            onClick={() => handleToggleEditMode(false)}
          >
            Cancel
          </Button>
          <Button
            borderRadius='8px'
            color={editChannelSaveButtonTextColor}
            backgroundColor={editChannelSaveButtonBackgroundColor || colors.primary}
            onClick={handleSave}
          >
            Save
          </Button>
        </EditChannelFooter>
      </Container>

      {cropPopup && (
        <ImageCrop
          image={{ name: newAvatar.name, url: selectedImageUrl }}
          onAccept={handleImageCrop}
          handleClosePopup={() => setCropPopup(false)}
        />
      )}

      {deleteAvatarPopupOpen && (
        <ConfirmPopup
          handleFunction={handleRemoveAvatar}
          togglePopup={handleToggleDeleteAvatarPopup}
          title='Remove avatar?'
          description='Are you sure you want to remove your avatar?'
          buttonText='Remove'
        />
      )}
    </React.Fragment>
  )
}

export default EditChannel
