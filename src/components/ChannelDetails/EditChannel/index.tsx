import styled from 'styled-components'
import React, { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
// Store
import { updateChannelAC } from '../../../store/channel/actions'
import { channelEditModeSelector } from '../../../store/channel/selector'
// Hooks
import { useDidUpdate, useStateComplex, useColor } from '../../../hooks'
// Assets
import { ReactComponent as CameraIcon } from '../../../assets/svg/cameraIcon.svg'
import { ReactComponent as PictureIcon } from '../../../assets/svg/picture.svg'
import { ReactComponent as DeleteIcon } from '../../../assets/svg/deleteChannel.svg'
// Helpers
import { resizeImage } from '../../../helpers/resizeImage'
import { getUploadImageIcon } from '../../../helpers/channelHalper'
import {
  Button,
  ButtonBlock,
  CustomInput,
  DropdownOptionLi,
  DropdownOptionsUl,
  InputErrorMessage,
  Label,
  UploadFile,
  UploadFileLabel
} from '../../../UIHelper'
import { getClient } from '../../../common/client'
import { DEFAULT_CHANNEL_TYPE, THEME } from '../../../helpers/constants'
import { colors, THEME_COLORS } from '../../../UIHelper/constants'
import { IChannel, IMember } from '../../../types'
// Components
import DropDown from '../../../common/dropdown'
import Avatar from '../../Avatar'
import ImageCrop from '../../../common/imageCrop'
import ConfirmPopup from '../../../common/popups/delete'

const Container = styled.div<{ active: boolean; heightOffset: any; backgroundColor?: string }>`
  ${(props) => (props.active ? 'display: block' : 'display: none')};
  height: ${(props) => `calc(100vh - ${props.heightOffset ? props.heightOffset + 48 : 48}px)`};
  position: absolute;
  padding: 24px 16px;
  background-color: ${(props) => props.backgroundColor || colors.white};
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
  theme?: string
  // eslint-disable-next-line no-unused-vars
  handleToggleEditMode: (state: boolean) => void
  editChannelSaveButtonBackgroundColor?: string
  editChannelSaveButtonTextColor?: string
  editChannelCancelButtonBackgroundColor?: string
  editChannelCancelButtonTextColor?: string
}

const EditChannel = ({
  channel,
  theme,
  handleToggleEditMode,
  editChannelSaveButtonBackgroundColor,
  editChannelSaveButtonTextColor,
  editChannelCancelButtonBackgroundColor,
  editChannelCancelButtonTextColor
}: IProps) => {
  const {
    [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.SECTION_BACKGROUND]: sectionBackground,
    [THEME_COLORS.BORDER]: borderColor,
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.TEXT_FOOTNOTE]: textFootnote,
    [THEME_COLORS.WARNING]: errorColor,
    [THEME_COLORS.HOVER_BACKGROUND]: hoverBackground
  } = useColor()

  const ChatClient = getClient()
  const { user } = ChatClient
  const dispatch = useDispatch()
  const isEditMode = useSelector(channelEditModeSelector)
  const [cropPopup, setCropPopup] = useState(false)
  const [deleteAvatarPopupOpen, setDeleteAvatarPopupOpen] = useState(false)
  const [selectedImageUrl, setSelectedImageUrl] = useState('')
  const [newSubject, setNewSubject] = useState(channel.subject)
  const [subjectIsWrong, setSubjectIsWrong] = useState(false)
  const [newDescription, setNewDescription] = useState(channel.metadata && channel.metadata.d)
  const [descriptionIsWrong, setDescriptionIsWrong] = useState(false)
  const [offsetTop, setOffsetTop] = useState(null)
  const [newAvatar, setNewAvatar] = useStateComplex({
    src: {},
    url: channel.avatarUrl // channelDetails.avatar
  })

  const editContainer = useRef<any>(null)
  const fileUploader = useRef<any>(null)
  const isDirectChannel = channel.type === DEFAULT_CHANNEL_TYPE.DIRECT
  const directChannelUser = isDirectChannel && channel.members.find((member: IMember) => member.id !== user.id)

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
      if (!newSubject || newSubject.length < 1 || newSubject.length > 250) {
        setSubjectIsWrong(true)
      } else if (newDescription && newDescription?.length > 2000) {
        setDescriptionIsWrong(true)
      } else {
        handleUpdateChannel({
          ...(newSubject !== channel.subject && { subject: newSubject }),
          ...{
            metadata: {
              ...(channel?.metadata || {}),
              ...(newDescription !== channel.metadata.d ? { d: newDescription } : {})
            }
          },
          ...(newAvatar.url !== channel.avatarUrl && { avatar: newAvatar.src.file })
        })
      }
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
    if (!newSubject || newSubject.length < 1 || newSubject.length > 250) {
      setSubjectIsWrong(true)
    } else {
      setSubjectIsWrong(false)
    }
  }, [newSubject])
  useEffect(() => {
    if (newDescription && newDescription.length > 2000) {
      setDescriptionIsWrong(true)
    } else {
      setDescriptionIsWrong(false)
    }
  }, [newDescription])
  useEffect(() => {
    setOffsetTop(editContainer && editContainer.current && editContainer.current.offsetTop)
  }, [])
  return (
    <React.Fragment>
      <Container
        ref={editContainer}
        heightOffset={offsetTop}
        active={isEditMode}
        backgroundColor={theme === THEME.DARK ? colors.dark : colors.white}
      >
        <AvatarCont>
          <DropDownWrapper>
            {!isDirectChannel && channel.userRole && (
              <DropDown
                theme={theme}
                position='center'
                iconColor={colors.white}
                trigger={getUploadImageIcon() || <CameraIcon />}
              >
                <DropdownOptionsUl>
                  <DropdownOptionLi
                    key={1}
                    textColor={textPrimary}
                    hoverBackground={hoverBackground}
                    onClick={() => onOpenFileUploader()}
                    iconWidth='20px'
                  >
                    <PictureIcon />
                    <UploadFileLabel>Upload image</UploadFileLabel>
                    <UploadFile ref={fileUploader} accept='.png,.jpeg,.jpg' onChange={handleFileUpload} type='file' />
                  </DropdownOptionLi>
                  {newAvatar.url && (
                    <DropdownOptionLi
                      key={2}
                      hoverBackground={hoverBackground}
                      textColor={errorColor}
                      onClick={handleToggleDeleteAvatarPopup}
                      iconWidth='20px'
                    >
                      <DeleteIcon />
                      Delete
                    </DropdownOptionLi>
                  )}
                </DropdownOptionsUl>
              </DropDown>
            )}
          </DropDownWrapper>
          <Avatar
            size={120}
            image={newAvatar.url || (isDirectChannel && directChannelUser ? directChannelUser.avatarUrl : '')}
            name={isDirectChannel && directChannelUser ? directChannelUser.id : channel.subject || channel.id}
            textSize={55}
          />
        </AvatarCont>

        <Label color={textPrimary}> Name </Label>
        <CustomInput
          error={subjectIsWrong}
          theme={theme}
          color={textPrimary}
          borderColor={borderColor}
          errorColor={errorColor}
          placeholderColor={textFootnote}
          backgroundColor={sectionBackground}
          placeholder='Channel Subject'
          value={newSubject}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSubject(e.target.value)}
        />
        {subjectIsWrong && (
          <InputErrorMessage color={errorColor}>
            Channel name must be a minimum of 1 and a maximum of 250 symbols.
          </InputErrorMessage>
        )}

        <Label color={textPrimary}> Description </Label>
        <CustomInput
          error={descriptionIsWrong}
          theme={theme}
          color={textPrimary}
          errorColor={errorColor}
          borderColor={borderColor}
          backgroundColor={sectionBackground}
          placeholderColor={textFootnote}
          placeholder='Channel description'
          value={newDescription}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewDescription(e.target.value)}
        />
        {descriptionIsWrong && (
          <InputErrorMessage color={errorColor}>Channel description must be maximum of 2000 symbols.</InputErrorMessage>
        )}

        <EditChannelFooter>
          <Button
            type='button'
            borderRadius='8px'
            color={editChannelCancelButtonTextColor || textPrimary}
            backgroundColor={editChannelCancelButtonBackgroundColor || sectionBackground}
            onClick={() => handleToggleEditMode(false)}
          >
            Cancel
          </Button>
          <Button
            disabled={subjectIsWrong || descriptionIsWrong}
            borderRadius='8px'
            color={editChannelSaveButtonTextColor || colors.white}
            backgroundColor={editChannelSaveButtonBackgroundColor || accentColor}
            onClick={handleSave}
          >
            Save
          </Button>
        </EditChannelFooter>
      </Container>

      {cropPopup && (
        <ImageCrop
          theme={theme}
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
