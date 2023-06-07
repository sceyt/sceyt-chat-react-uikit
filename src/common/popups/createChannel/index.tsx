import React, { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import { useDispatch } from 'react-redux'
import {
  Popup,
  PopupContainer,
  PopupName,
  CloseIcon,
  CustomInput,
  Label,
  PopupFooter,
  Button,
  PopupBody,
  InputErrorMessage
} from '../../../UIHelper'
import { ReactComponent as UploadImageIcon } from '../../../assets/svg/cameraIcon.svg'
import { useStateComplex } from '../../../hooks'
import ImageCrop from '../../../common/imageCrop'
import Avatar from '../../../components/Avatar'
import { CHANNEL_TYPE } from '../../../helpers/constants'
import { createChannelAC } from '../../../store/channel/actions'
import UsersPopup from '../users'
import { IAddMember } from '../../../types'
import { colors } from '../../../UIHelper/constants'
import { resizeImage } from '../../../helpers/resizeImage'
import { AvatarWrapper } from '../../../components/Channel'

interface ICreateChannelPopup {
  handleClose: () => void
  channelType: string
  uriPrefixOnCreateChannel?: string
  uploadPhotoIcon?: JSX.Element
}

export default function CreateChannel({
  handleClose,
  channelType,
  uriPrefixOnCreateChannel,
  uploadPhotoIcon
}: ICreateChannelPopup) {
  const dispatch = useDispatch()
  const uriRegexp = /^[A-Za-z0-9]*$/
  const fileUploader = useRef<any>(null)
  const uriPrefixRef = useRef<any>(null)
  const [usersPopupVisible, setUsersPopupVisible] = useState(false)
  const [createGroupChannelPopupVisible, setCreateGroupChannelPopupVisible] = useState(true)
  const [selectedMembers, setSelectedMembers] = useState<IAddMember[]>([])
  const [subjectValue, setSubjectValue] = useState('')
  const [URIValue, setURIValue] = useState('')
  const [wrongUri, setWrongUri] = useState('')
  const [uriPrefixWidth, setUriPrefixWidth] = useState<any>('')
  const [metadataValue, setMetadataValue] = useState('')
  const [cropPopup, setCropPopup] = useState(false)
  const [newAvatar, setNewAvatar] = useStateComplex({
    src: {},
    url: '' // channelDetails.avatar
  })
  // const [pagination, setPagination] = useState(false)
  const createPrivateChannel = channelType === CHANNEL_TYPE.PRIVATE
  const toggleCreatePopup = () => {
    setUsersPopupVisible(!usersPopupVisible)
  }

  const handleAddMembersForCreateChannel = (members: IAddMember[], action: 'create' | 'back') => {
    setSelectedMembers(members)
    setCreateGroupChannelPopupVisible(true)
    if (action === 'create') {
      handleCreateChannel(members)
    }
  }

  const toggleCreateGroupChannelPopup = () => {
    if (createGroupChannelPopupVisible) {
      setSubjectValue('')
      setURIValue('')
      setMetadataValue('')
      setSelectedMembers([])
      setCropPopup(false)
      setNewAvatar({
        src: {},
        url: '' // channelDetails.avatar
      })
      // setPagination(false)
    }
    handleClose()
    setCreateGroupChannelPopupVisible(!createGroupChannelPopupVisible)
  }

  const GoToAddMember = () => {
    if (subjectValue && (createPrivateChannel || (URIValue && uriRegexp.test(URIValue)))) {
      setUsersPopupVisible(true)
      // setPagination(true)
      setCreateGroupChannelPopupVisible(false)
    }
  }

  const handleCreateChannel = (members: IAddMember[]) => {
    const createChannelParams = {
      subject: subjectValue,
      metadata: { d: metadataValue },
      uri: URIValue,
      members,
      type: channelType === 'private' ? CHANNEL_TYPE.PRIVATE : CHANNEL_TYPE.PUBLIC,
      avatarFile: newAvatar.src.file
    }
    if (createPrivateChannel && members.length > 0) {
      dispatch(createChannelAC(createChannelParams))
      toggleCreateGroupChannelPopup()
    } else if (!createPrivateChannel) {
      const subscribers = members.map((mem) => ({ ...mem, role: 'subscriber' }))
      dispatch(createChannelAC({ ...createChannelParams, members: subscribers }))
      toggleCreateGroupChannelPopup()
    }
  }

  const handleTypeSubject = (e: any) => {
    setSubjectValue(e.currentTarget.value)
  }

  const handleTypeURI = (e: any) => {
    checkURIRegexp(e)
    setURIValue(e.currentTarget.value)
  }

  const checkURIRegexp = (e: any) => {
    if (uriRegexp.test(e.currentTarget.value)) {
      if (e.currentTarget.value.length >= 5 && e.currentTarget.value.length <= 50) {
        setWrongUri('')
      } else {
        setWrongUri('short')
      }
    } else {
      setWrongUri('dontMatch')
    }
  }

  const handleTypeMetadata = (e: any) => {
    setMetadataValue(e.currentTarget.value)
  }

  const handleSelectImage = () => {
    const image: File = fileUploader.current.files[0]
    resizeImage(image).then((resizedFile: any) => {
      // resizedFiles.forEach((file: any, index: number) => {
      setNewAvatar({
        url: URL.createObjectURL(resizedFile.blob),
        name: image.name
      })

      setCropPopup(true)
      // })
    })

    /* setNewAvatar({
      url: URL.createObjectURL(image),
      name: image.name
    }) */
  }

  const handleImageCrop = (image: File) => {
    setNewAvatar({
      src: {
        file: image
      },
      url: URL.createObjectURL(image)
    })
    fileUploader.current.value = null
  }
  const handleCloseCropPopup = (cropped?: boolean) => {
    if (!cropped) {
      setNewAvatar({
        src: {},
        url: ''
      })
    }
    fileUploader.current.value = null
    setCropPopup(false)
  }

  /* const handleOpenFileUploader = () => {
    if (fileUploader) {
      fileUploader.current.click()
    }
  } */
  useEffect(() => {
    console.log('uriPrefixRef.width. . ', uriPrefixRef.current && uriPrefixRef.current.getBoundingClientRect().width)
    setUriPrefixWidth(uriPrefixRef.current && uriPrefixRef.current.getBoundingClientRect().width + 15)
  }, [])
  return (
    <Container>
      {usersPopupVisible && (
        <UsersPopup
          toggleCreatePopup={toggleCreatePopup}
          getSelectedUsers={handleAddMembersForCreateChannel}
          creatChannelSelectedMembers={selectedMembers}
          actionType='selectUsers'
          selectIsRequired={createPrivateChannel}
          popupHeight='540px'
          popupWidth='520px'
        />
      )}

      {createGroupChannelPopupVisible && (
        <PopupContainer>
          <Popup maxHeight='600px' width='520px' maxWidth='520px' padding='0'>
            <PopupBody padding={24}>
              <CloseIcon onClick={toggleCreateGroupChannelPopup} />

              <PopupName marginBottom='20px'>Create {createPrivateChannel ? 'Group' : 'Channel'}</PopupName>
              {!createPrivateChannel && (
                <CrateChannelTitle>Create a Channel to post your content to a large audience.</CrateChannelTitle>
              )}

              <UploadChannelAvatar>
                {newAvatar.url ? (
                  <AvatarWrapper>
                    <Avatar image={newAvatar.url} size={90} name={subjectValue} />
                    <RemoveSelectedAvatar onClick={() => setNewAvatar({ src: {}, url: '' })}>
                      Remove
                    </RemoveSelectedAvatar>
                  </AvatarWrapper>
                ) : (
                  <UploadAvatarLabel
                    iconColor={colors.primary}
                    backgroundColor={colors.primaryLight}
                    htmlFor='uploadImage'
                  >
                    {uploadPhotoIcon || <UploadImageIcon />}
                  </UploadAvatarLabel>
                )}
                <FileUploaderInput
                  ref={fileUploader}
                  type='file'
                  accept='.png,.jpeg,.jpg'
                  id='uploadImage'
                  onChange={handleSelectImage}
                />
              </UploadChannelAvatar>
              <Label> {createPrivateChannel ? 'Group' : 'Channel'} name</Label>
              <CustomInput
                type='text'
                value={subjectValue}
                onChange={handleTypeSubject}
                placeholder={`Enter ${createPrivateChannel ? 'group' : 'channel'} name`}
              />

              <Label>Description</Label>
              <CustomInput
                type='text'
                value={metadataValue}
                onChange={handleTypeMetadata}
                placeholder={`Enter ${createPrivateChannel ? 'group' : 'channel'} description`}
              />
              {!createPrivateChannel && (
                <React.Fragment>
                  <Label>URL</Label>
                  <UriInputWrapper uriPrefixWidth={uriPrefixWidth}>
                    {uriPrefixOnCreateChannel && <UriPrefix ref={uriPrefixRef}>{uriPrefixOnCreateChannel}</UriPrefix>}
                    <CustomInput
                      type='text'
                      value={URIValue}
                      onChange={handleTypeURI}
                      onBlur={checkURIRegexp}
                      placeholder='chan12'
                      error={!!wrongUri}
                    />
                    {!!wrongUri && (
                      <InputErrorMessage>
                        {wrongUri === 'short'
                          ? 'The name should be 5-50 characters long'
                          : 'The name is invalid. Please provide na name from the allowed range of characters'}
                      </InputErrorMessage>
                    )}
                  </UriInputWrapper>
                  <ChannelUriDescription>
                    Give a URL to your channel so you can share it with others inviting them to join. Choose a name from
                    the allowed range: a-z, 0-9, and _(underscores) between 5-50 characters.
                  </ChannelUriDescription>
                </React.Fragment>
              )}
            </PopupBody>
            <PopupFooter backgroundColor={colors.gray5}>
              <Button type='button' color={colors.gray6} backgroundColor='transparent' onClick={() => handleClose()}>
                Cancel
              </Button>
              {/*  <button type='button' className='button gray' onClick={handleClose}>
                Cancel
              </button> */}
              <Button
                type='button'
                backgroundColor={colors.primary}
                borderRadius='8px'
                onClick={() => GoToAddMember()}
                disabled={!subjectValue || (!createPrivateChannel && (!URIValue || !!wrongUri))}
              >
                Next
              </Button>
              {/* <button
                type='button'
                className='button blue filled'
                disabled={!subjectValue ? !subjectValue : !createPrivateChannel && !URIValue}
                onClick={GoToAddMember}
              >
                Next
              </button> */}
            </PopupFooter>
          </Popup>

          {cropPopup && (
            <ImageCrop
              image={newAvatar}
              onAccept={handleImageCrop}
              handleClosePopup={(cropped?: boolean) => handleCloseCropPopup(cropped)}
            />
          )}
        </PopupContainer>
      )}
    </Container>
  )
}

const Container = styled.div``
const CrateChannelTitle = styled.h3`
  font-size: 15px;
  font-weight: 400;
  line-height: 150%;
  margin: 0 0 20px;
  color: ${colors.gray8};
`
const UploadAvatarLabel = styled.label<{ backgroundColor?: string; iconColor?: string }>`
  display: flex;
  width: 90px;
  height: 90px;
  align-items: center;
  justify-content: center;
  background-color: ${(props) => props.backgroundColor || colors.gray5};
  border-radius: 50%;
  cursor: pointer;

  & > svg {
    color: ${(props) => props.iconColor};
  }
`

export const URILabel = styled.label`
  display: inline-block;
  font-weight: 500;
  font-size: 14px;
  line-height: 15px;
  margin-top: 18px;
  margin-bottom: 5px;
`

const UploadChannelAvatar = styled.div`
  display: flex;
  align-items: center;
`

// const UploadAvatarButton = styled.button`
//   display: block;
//   height: 32px;
//   margin-top: 8px;
//   border: none;
//   color: #fff;
//   font-weight: 500;
//   font-size: 14px;
//   background: ${colors.blue10};
//   border-radius: 4px;
//   outline: none !important;
//   cursor: pointer;
// `;

const FileUploaderInput = styled.input`
  display: none;
`
const RemoveSelectedAvatar = styled.span`
  display: inline-block;
  margin-left: 16px;
  cursor: pointer;
  font-weight: 400;
  font-size: 15px;
  line-height: 20px;
  color: ${colors.red1};
`
const ChannelUriDescription = styled.p`
  margin-bottom: 8px;
  font-weight: 400;
  font-size: 13px;
  line-height: 16px;
  letter-spacing: -0.078px;
  color: ${colors.gray9};
`

const UriInputWrapper = styled.div<{ uriPrefixWidth?: number }>`
  position: relative;

  & > input {
    padding-left: ${(props) => props.uriPrefixWidth && `${props.uriPrefixWidth}px`};
  }
`
const UriPrefix = styled.span`
  position: absolute;
  left: 15px;
  top: 11px;
  font-style: normal;
  font-weight: normal;
  font-size: 15px;
`
