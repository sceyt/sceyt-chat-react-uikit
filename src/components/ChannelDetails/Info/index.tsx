import styled from 'styled-components'
import React, { useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import { ReactComponent as EditIcon } from '../../../assets/svg/edit.svg'
// import { ReactComponent as CameraIcon } from '../../../assets/lib/svg/camera.svg'
import { ReactComponent as CheckIcon } from '../../../assets/svg/check.svg'
import { SectionHeader } from '../../../UIHelper'
// import DropDown from '../../../../Common/dropdown'
// import Avatar from '../../Avatar'
// import { useStateComplex } from '../../../../hooks'
// import ImageCrop from '../../../../../Common/image-crop'
import {
  // setErrorNotification,
  updateChannelDataAC
} from '../../../store/channel/actions'
import { CHANNEL_TYPE } from '../../../helpers/constants'
// import DeletePopup from '../../../../../Common/Popups/delete'
import { colors } from '../../../UIHelper/constants'
import { IChannel, IMember } from '../../../types'
import { getClient } from '../../../common/client'
// import { IChannel } from "../../../../types";

const Container = styled.div`
  position: absolute;
  bottom: 0;
  width: calc(100% - 32px);
  display: flex;
  align-items: center;
  padding: 12px 16px;
  z-index: 9;
  h3 {
    font-size: 15px;
    line-height: 18px;
    font-weight: 500;
    text-overflow: ellipsis;
    width: 100%;
    color: ${colors.white};
    overflow: hidden;
    white-space: nowrap;
  }
`
const ChannelSubject = styled.div`
  width: calc(100% - 40px);
`
const ChannelMembers = styled.span`
  font-size: 13px;
  line-height: 16px;
  letter-spacing: -0.078px;
  color: rgba(255, 255, 255, 0.6);
`
/*

const AvatarCont = styled.div`
  position: relative;
  margin-right: 8px;

  .dropdown-body {
    bottom: -100px;
    right: 0;
  }
`

const EditAvatarIcon = styled.span`
  position: absolute;
  top: -5px;
  right: -5px;
  width: 30px;
  height: 30px;
  cursor: pointer;
  background: #ffffff;
  box-shadow: 0 4px 4px rgba(6, 10, 38, 0.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
`
*/

const EditSubject = styled.span`
  margin-left: 8px;
  cursor: pointer;
  color: #ffffff;
`

const SubjectEditMode = styled.div`
  width: 100%;
  border-bottom: 2px solid ${colors.primary};
`

const SubjectInput = styled.input`
  width: calc(100% - 25px);
  outline: none !important;
  font-size: 16px;
  font-weight: 500;
  padding: 7px 7px 6px 0;
  border: none;
`

const UpdateSubject = styled.span`
  cursor: pointer;
  padding: 2px;
`

interface IProps {
  channel: IChannel
  handleToggleEditMode: () => void
}

const Info = ({ channel, handleToggleEditMode }: IProps) => {
  // const fileUploader = useRef<any>(null)
  const updateSubject = useRef<any>(null)
  const dispatch = useDispatch()
  // const [cropPopup, setCropPopup] = useState(false)
  const [activeSubjectEditMode, setActiveSubjectEditMode] = useState(false)
  // const [deleteAvatarPopupOpen, setDeleteAvatarPopupOpen] = useState(false)
  /* const [newAvatar, setNewAvatar] = useStateComplex({
    src: {},
    url: '' // channelDetails.avatar
  }) */

  const isDirectChannel = channel.type === CHANNEL_TYPE.DIRECT

  /* const onOpenFileUploader = () => {
    fileUploader.current.click()
  } */

  /* function handleSelectImage(image: File) {
    setNewAvatar({
      name: image.name,
      url: URL.createObjectURL(image)
    })
    setCropPopup(true)
  } */
  const handleUpdateChannel = (data: any) => {
    dispatch(updateChannelDataAC(channel.id, data))
  }

  /* function handleImageCrop(image: File) {
    setNewAvatar({
      src: {
        file: image
      },
      url: URL.createObjectURL(image)
    })
    handleUpdateChannel({ avatar: image })
  } */

  /* const handleFileUpload = () => {
    const file = fileUploader.current.files[0]
    if (file.size < 1000000) {
      handleSelectImage(file)
    } else {
      /!* dispatch(
        setErrorNotification(
          'The file is too large. Allowed Maximum size is 1m'
        )
      ) *!/
    }
  } */

  /* const handleRemoveAvatar = () => {
    handleUpdateChannel({ avatarUrl: '' })
  } */
  const handleUpdateSubject = () => {
    if (updateSubject.current && updateSubject.current.value !== channel.subject) {
      handleUpdateChannel({ subject: updateSubject.current.value })
    }
    setActiveSubjectEditMode(false)
  }

  /*
  const handleToggleDeleteAvatarPopup = () => {
    setDeleteAvatarPopupOpen(!deleteAvatarPopupOpen)
  }
*/

  return (
    <React.Fragment>
      <Container>
        {/* <AvatarCont>
          {!isDirectChannel && channel.myRole && (
            <DropDown
              position='top'
              trigger={
                <EditAvatarIcon>
                  <CameraIcon />
                </EditAvatarIcon>
              }
            >
              <DropdownOptionsUl>
                <DropdownOptionLi key={1} onClick={() => onOpenFileUploader()}>
                  <UploadFileLabel>Upload Avatar</UploadFileLabel>
                  <UploadFile
                    ref={fileUploader}
                    // onChange={handleFileUpload}
                    type='file'
                  />
                </DropdownOptionLi>
                <DropdownOptionLi
                  key={2}
                  onClick={handleToggleDeleteAvatarPopup}
                >
                  Remove Avatar
                </DropdownOptionLi>
              </DropdownOptionsUl>
            </DropDown>
          )}
          <Avatar
            size={64}
            image={
              channel.avatarUrl ||
              (isDirectChannel ? directChannelUser.avatarUrl : '')
            }
            name={
              isDirectChannel ? directChannelUser.id : channel.subject || channel.id
            }
            textSize={18}
          />
        </AvatarCont> */}
        {!activeSubjectEditMode && (
          <React.Fragment>
            <ChannelSubject>
              <SectionHeader>
                {isDirectChannel
                  ? channel.peer.firstName
                    ? `${channel.peer.firstName} ${channel.peer.lastName}`
                    : channel.peer.id
                  : channel.subject}
              </SectionHeader>
              <ChannelMembers>{channel.memberCount} members</ChannelMembers>
            </ChannelSubject>
            {!isDirectChannel && channel.role && (
              <EditSubject onClick={() => handleToggleEditMode()}>
                <EditIcon />
              </EditSubject>
            )}
          </React.Fragment>
        )}
        {activeSubjectEditMode && (
          <SubjectEditMode>
            <SubjectInput type='text' defaultValue={channel.subject} ref={updateSubject} />
            <UpdateSubject onClick={handleUpdateSubject}>
              <CheckIcon />
            </UpdateSubject>
          </SubjectEditMode>
        )}
      </Container>

      {/* {cropPopup && (
        <ImageCrop
          image={newAvatar}
          onAccept={handleImageCrop}
          handleClosePopup={() => setCropPopup(false)}
        />
      )} */}

      {/* {deleteAvatarPopupOpen && (
        <DeletePopup
          deleteFunction={handleRemoveAvatar}
          togglePopup={handleToggleDeleteAvatarPopup}
          title='Remove avatar?'
          description='Are you sure you want to remove your avatar?'
          buttonText='Remove'
        />
      )} */}
    </React.Fragment>
  )
}

export default Info
