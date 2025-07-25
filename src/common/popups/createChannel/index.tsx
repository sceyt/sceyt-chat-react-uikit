import React, { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import { useDispatch, useSelector } from 'react-redux'
import {
  Popup,
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
import { useStateComplex, useColor } from '../../../hooks'
import ImageCrop from '../../../common/imageCrop'
import Avatar from '../../../components/Avatar'
import { DEFAULT_CHANNEL_TYPE } from '../../../helpers/constants'
import { createChannelAC } from '../../../store/channel/actions'
import UsersPopup from '../users'
import { IAddMember } from '../../../types'
import { THEME_COLORS } from '../../../UIHelper/constants'
import { resizeImage } from '../../../helpers/resizeImage'
import { AvatarWrapper } from '../../../components/Channel'
import { getDefaultRolesByChannelTypesMap } from '../../../helpers/channelHalper'
import { themeSelector } from '../../../store/theme/selector'
import PopupContainer from '../popupContainer'

interface ICreateChannelPopup {
  handleClose: () => void
  channelType: string
  uriPrefixOnCreateChannel?: string
  uploadPhotoIcon?: JSX.Element
  channelTypeRequiredFieldsMap?: {
    [key: string]: { subject?: boolean; description?: boolean; uri?: boolean; members?: boolean }
  }
  showSubject?: boolean
  showDescription?: boolean
  showUri?: boolean
  showUploadAvatar?: boolean
  withoutConfig?: boolean
}

export default function CreateChannel({
  handleClose,
  channelType,
  uriPrefixOnCreateChannel,
  channelTypeRequiredFieldsMap,
  uploadPhotoIcon,
  showSubject = true,
  showDescription = true,
  showUri = true,
  showUploadAvatar = true,
  withoutConfig
}: ICreateChannelPopup) {
  const {
    [THEME_COLORS.ACCENT]: accentColor,
    [THEME_COLORS.TEXT_PRIMARY]: textPrimary,
    [THEME_COLORS.SURFACE_1]: surface1,
    [THEME_COLORS.TEXT_SECONDARY]: textSecondary,
    [THEME_COLORS.BORDER]: borderColor,
    [THEME_COLORS.TEXT_FOOTNOTE]: textFootnote,
    [THEME_COLORS.WARNING]: warningColor,
    [THEME_COLORS.TEXT_ON_PRIMARY]: textOnPrimary,
    [THEME_COLORS.BACKGROUND]: background
  } = useColor()

  const dispatch = useDispatch()
  const uriRegexp = /^[A-Za-z0-9]*$/
  const fileUploader = useRef<any>(null)
  const uriPrefixRef = useRef<any>(null)
  const theme = useSelector(themeSelector)
  const [usersPopupVisible, setUsersPopupVisible] = useState(false)
  const [createGroupChannelPopupVisible, setCreateGroupChannelPopupVisible] = useState(true)
  const [selectedMembers, setSelectedMembers] = useState<IAddMember[]>([])
  const [subjectValue, setSubjectValue] = useState('')
  const [URIValue, setURIValue] = useState('')
  const [wrongUri, setWrongUri] = useState('')
  const [nextButtonDisable, setNextButtonDisable] = useState(true)
  const [uriPrefixWidth, setUriPrefixWidth] = useState<any>('')
  const [metadataValue, setMetadataValue] = useState('')
  const [cropPopup, setCropPopup] = useState(false)
  const [newAvatar, setNewAvatar] = useStateComplex({
    src: {},
    url: '' // channelDetails.avatar
  })
  const channelTypeRoleMap = getDefaultRolesByChannelTypesMap()
  // const [pagination, setPagination] = useState(false)
  const createGroupChannel = channelType === DEFAULT_CHANNEL_TYPE.GROUP || channelType === DEFAULT_CHANNEL_TYPE.PRIVATE
  const requiredFields = channelTypeRequiredFieldsMap && channelTypeRequiredFieldsMap[channelType]
  const toggleCreatePopup = () => {
    setUsersPopupVisible(!usersPopupVisible)
    handleClose()
  }

  const handleAddMembersForCreateChannel = (members: IAddMember[], action: 'create' | 'back') => {
    setSelectedMembers(members)
    setCreateGroupChannelPopupVisible(true)
    if (action === 'create') {
      handleCreateChannel(members)
    } else {
      setUsersPopupVisible(!usersPopupVisible)
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
    if (requiredFields) {
      if (
        !(
          (requiredFields.subject && !subjectValue) ||
          (requiredFields.description && !metadataValue) ||
          (requiredFields.uri && !URIValue)
        )
      ) {
        setUsersPopupVisible(true)
        setCreateGroupChannelPopupVisible(false)
      }
    } else {
      setUsersPopupVisible(true)
      setCreateGroupChannelPopupVisible(false)
    }
  }

  const handleCreateChannel = (members: IAddMember[]) => {
    const createChannelParams = {
      subject: subjectValue,
      metadata: { d: metadataValue },
      uri: URIValue,
      members,
      type: channelType,
      avatarFile: newAvatar.src.file
    }
    let membersToAdd = members
    if (channelTypeRoleMap) {
      membersToAdd = members.map((mem) => ({ ...mem, role: channelTypeRoleMap[channelType] }))
    } else {
      if (!createGroupChannel) {
        membersToAdd = members.map((mem) => ({ ...mem, role: 'subscriber' }))
      }
    }

    if (requiredFields) {
      if (requiredFields.members && members.length > 0) {
        dispatch(createChannelAC({ ...createChannelParams, members: membersToAdd }))
        toggleCreateGroupChannelPopup()
      } else if (!requiredFields.members) {
        dispatch(createChannelAC({ ...createChannelParams, members: membersToAdd }))
        toggleCreateGroupChannelPopup()
      }
    } else {
      dispatch(createChannelAC({ ...createChannelParams, members: membersToAdd }))
      toggleCreateGroupChannelPopup()
    }

    /* if (createGroupChannel && members.length > 0) {
      log.info('data for create group ,,,... ', createChannelParams)
      dispatch(createChannelAC(createChannelParams))
      toggleCreateGroupChannelPopup()
    } else if (!createGroupChannel) {
      // const subscribers = members.map((mem) => ({ ...mem, role: 'subscriber' }))
      log.info('data for create channel ... ', createChannelParams)
      // dispatch(createChannelAC({ ...createChannelParams, members: subscribers }))
      dispatch(createChannelAC(createChannelParams))
      toggleCreateGroupChannelPopup()
    } */
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
    setUriPrefixWidth(uriPrefixRef.current && uriPrefixRef.current.getBoundingClientRect().width + 15)
    /* const body = document.querySelector('body')
    if (body) {
      body.style.overflow = 'hidden'
    }

    return () => {
      if (body) {
        body.style.overflow = 'auto'
      }
    } */
  }, [])
  useEffect(() => {
    if (requiredFields) {
      if (
        (requiredFields.subject && !subjectValue) ||
        (requiredFields.description && !metadataValue) ||
        (requiredFields.uri && !URIValue)
      ) {
        setNextButtonDisable(true)
      } else {
        setNextButtonDisable(false)
      }
    } else {
      setNextButtonDisable(false)
    }
  }, [subjectValue, createGroupChannel, URIValue])
  return (
    <React.Fragment>
      {withoutConfig ? (
        <UsersPopup popupHeight='540px' popupWidth='520px' toggleCreatePopup={handleClose} actionType='createChat' />
      ) : (
        <React.Fragment>
          {usersPopupVisible && (
            <UsersPopup
              toggleCreatePopup={toggleCreatePopup}
              getSelectedUsers={handleAddMembersForCreateChannel}
              creatChannelSelectedMembers={selectedMembers}
              actionType='selectUsers'
              selectIsRequired={
                channelTypeRequiredFieldsMap &&
                channelTypeRequiredFieldsMap[channelType] &&
                channelTypeRequiredFieldsMap[channelType].members
              }
              channel={{ type: channelType } as any}
              popupHeight='540px'
              popupWidth='520px'
            />
          )}

          {createGroupChannelPopupVisible && (
            <PopupContainer>
              <Popup backgroundColor={background} maxHeight='600px' width='520px' maxWidth='520px' padding='0'>
                <PopupBody paddingH='24px' paddingV='24px'>
                  <CloseIcon color={textPrimary} onClick={toggleCreateGroupChannelPopup} />

                  <PopupName color={textPrimary} marginBottom='20px'>
                    Create {createGroupChannel ? 'Group' : 'Channel'}
                  </PopupName>
                  {!createGroupChannel && (
                    <CrateChannelTitle color={textPrimary}>
                      Create a Channel to post your content to a large audience.
                    </CrateChannelTitle>
                  )}

                  {showUploadAvatar && (
                    <UploadChannelAvatar>
                      {newAvatar.url ? (
                        <AvatarWrapper>
                          <Avatar image={newAvatar.url} size={90} name={subjectValue} />
                          <RemoveSelectedAvatar color={warningColor} onClick={() => setNewAvatar({ src: {}, url: '' })}>
                            Remove
                          </RemoveSelectedAvatar>
                        </AvatarWrapper>
                      ) : (
                        <UploadAvatarLabel iconColor={accentColor} backgroundColor={surface1} htmlFor='uploadImage'>
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
                  )}
                  {showSubject && (
                    <React.Fragment>
                      <Label color={textSecondary}> {createGroupChannel ? 'Group' : 'Channel'} name</Label>
                      <CustomInput
                        type='text'
                        value={subjectValue}
                        onChange={handleTypeSubject}
                        placeholder={`Enter ${createGroupChannel ? 'group' : 'channel'} name`}
                        theme={theme}
                        color={textPrimary}
                        errorColor={warningColor}
                        placeholderColor={textFootnote}
                        backgroundColor={background}
                        borderColor={borderColor}
                        disabledColor={surface1}
                      />
                    </React.Fragment>
                  )}

                  {showDescription && (
                    <React.Fragment>
                      <Label color={textSecondary}>Description</Label>
                      <CustomInput
                        type='text'
                        value={metadataValue}
                        onChange={handleTypeMetadata}
                        placeholder={`Enter ${createGroupChannel ? 'group' : 'channel'} description`}
                        theme={theme}
                        color={textPrimary}
                        errorColor={warningColor}
                        placeholderColor={textFootnote}
                        backgroundColor={background}
                        borderColor={borderColor}
                        disabledColor={surface1}
                      />
                    </React.Fragment>
                  )}
                  {showUri && (
                    <React.Fragment>
                      <Label color={textSecondary}>URL</Label>
                      <UriInputWrapper uriPrefixWidth={uriPrefixWidth}>
                        {uriPrefixOnCreateChannel && (
                          <UriPrefix ref={uriPrefixRef} color={textPrimary}>
                            {uriPrefixOnCreateChannel}
                          </UriPrefix>
                        )}
                        <CustomInput
                          type='text'
                          value={URIValue}
                          onChange={handleTypeURI}
                          onBlur={checkURIRegexp}
                          placeholder='chan12'
                          error={!!wrongUri}
                          theme={theme}
                          color={textPrimary}
                          errorColor={warningColor}
                          placeholderColor={textFootnote}
                          backgroundColor={background}
                          borderColor={borderColor}
                          disabledColor={surface1}
                        />
                        {!!wrongUri && (
                          <InputErrorMessage color={warningColor}>
                            {wrongUri === 'short'
                              ? 'The name should be 5-50 characters long'
                              : 'The name is invalid. Please provide na name from the allowed range of characters'}
                          </InputErrorMessage>
                        )}
                      </UriInputWrapper>
                      <ChannelUriDescription color={textSecondary}>
                        Give a URL to your channel so you can share it with others inviting them to join. Choose a name
                        from the allowed range: a-z, 0-9, and _(underscores) between 5-50 characters.
                      </ChannelUriDescription>
                    </React.Fragment>
                  )}
                </PopupBody>
                <PopupFooter backgroundColor={surface1}>
                  <Button type='button' color={textPrimary} backgroundColor='transparent' onClick={() => handleClose()}>
                    Cancel
                  </Button>
                  {/*  <button type='button' className='button gray' onClick={handleClose}>
                Cancel
              </button> */}
                  <Button
                    type='button'
                    backgroundColor={accentColor}
                    color={textOnPrimary}
                    borderRadius='8px'
                    onClick={() => GoToAddMember()}
                    disabled={nextButtonDisable}
                  >
                    Next
                  </Button>
                  {/* <button
                type='button'
                className='button blue filled'
                disabled={!subjectValue ? !subjectValue : !createGroupChannel && !URIValue}
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
        </React.Fragment>
      )}
    </React.Fragment>
  )
}

const CrateChannelTitle = styled.p<{ color: string }>`
  font-size: 15px;
  font-weight: 400;
  line-height: 150%;
  margin: 0 0 20px;
  color: ${(props) => props.color};
`
const UploadAvatarLabel = styled.label<{ backgroundColor: string; iconColor?: string }>`
  display: flex;
  width: 90px;
  height: 90px;
  align-items: center;
  justify-content: center;
  background-color: ${(props) => props.backgroundColor};
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

const FileUploaderInput = styled.input`
  display: none;
`
const RemoveSelectedAvatar = styled.span<{ color: string }>`
  display: inline-block;
  margin-left: 16px;
  cursor: pointer;
  font-weight: 400;
  font-size: 15px;
  line-height: 20px;
  color: ${(props) => props.color};
`
const ChannelUriDescription = styled.p<{ color: string }>`
  margin-bottom: 8px;
  font-weight: 400;
  font-size: 13px;
  line-height: 16px;
  letter-spacing: -0.078px;
  color: ${(props) => props.color};
`

const UriInputWrapper = styled.div<{ uriPrefixWidth?: number }>`
  position: relative;

  & > input {
    padding-left: ${(props) => props.uriPrefixWidth && `${props.uriPrefixWidth}px`};
  }
`
const UriPrefix = styled.span<{ color: string }>`
  position: absolute;
  left: 15px;
  top: 11px;
  font-style: normal;
  font-weight: normal;
  font-size: 15px;
  color: ${(props) => props.color};
`
