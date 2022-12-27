import React, { useRef, useState } from 'react';
import styled from 'styled-components';
import PropTypes from 'prop-types';
import { useDispatch } from 'react-redux';
import {
  ButtonBlock,
  Popup,
  PopupContainer,
  PopupName,
  CloseIcon,
  Label,
  CustomInput, UploadAvatarButton, UploadAvatarHandler,
} from '../../../../UIHelper';
import { ReactComponent as UploadImageIcon } from '../../../../assets/svg/uploadImage.svg';
import { ReactComponent as DeleteUpload } from '../../../../assets/svg/deleteUpload.svg';
import { useStateComplex } from '../../../../hooks';
import ImageCrop from '../../../../Common/image-crop';
import Avatar from '../../../../Common/Avatar';
import { updateUser } from '../../../../store/user/actions';
import { setErrorNotification } from '../../../../store/channel/actions';

export default function EditProfile({ toggleEditPopup, user }) {
  const dispatch = useDispatch();

  const fileUploader = useRef(null);
  const [firstNameValue, setFirstNameValue] = useState(user.firstName);
  const [lastNameValue, setLastNameValue] = useState(user.lastName);
  const [cropPopup, setCropPopup] = useState(false);
  const [newAvatar, setNewAvatar] = useStateComplex({
    src: {},
    url: user.avatarUrl, // channelDetails.avatar
  });

  const handleTypeFirstName = (e) => {
    setFirstNameValue(e.currentTarget.value);
  };

  const handleTypeLastName = (e) => {
    setLastNameValue(e.currentTarget.value);
  };

  const handleRemoveUpload = () => {
    setNewAvatar({
      url: '',
    });
  };

  function handleSelectImage(image) {
    setNewAvatar({
      url: URL.createObjectURL(image),
      name: image.name,
    });
    setCropPopup(true);
  }

  const handleFileUpload = () => {
    const file = fileUploader.current.files[0];
    if (file.size < 1000000) {
      handleSelectImage(file);
    } else {
      dispatch(setErrorNotification('The file is too large. Allowed Maximum size is 1m'));
    }
  };

  function handleImageCrop(image) {
    setNewAvatar({
      src: {
        file: image,
      },
      url: URL.createObjectURL(image),
    });
  }

  const handleOpenFileUploader = () => {
    fileUploader.current.click();
  };

  const handleUpdateProfile = () => {
    const fieldsToUpdate = {
      firstName: firstNameValue,
      lastName: lastNameValue,
      avatarUrl: newAvatar.url,
    };
    if (newAvatar.src.file) {
      fieldsToUpdate.avatarFile = newAvatar.src.file;
    }

    dispatch(updateUser(fieldsToUpdate));
    toggleEditPopup();
  };

  return (
    <PopupContainer>
      <Popup
        maxHeight="482px"
        width="433px"
        maxWidth="433px"
        height="calc(100vh - 50px)"
        padding="22px 24px 8px"
      >
        <CloseIcon onClick={toggleEditPopup} />

        <PopupName>Edit Profile</PopupName>

        <EditProfileContainer>
          <Label>Username </Label>
          <CustomInput type="text" value={user.id} disabled />

          <Label>First name </Label>
          <CustomInput
            type="text"
            value={firstNameValue}
            onChange={handleTypeFirstName}
            placeholder="Enter Firstname"
          />

          <Label>Last name </Label>
          <CustomInput
            type="text"
            value={lastNameValue}
            onChange={handleTypeLastName}
            placeholder="Enter Lastname"
          />

          <Label>Avatar</Label>
          <UploadChannelAvatar>
            {newAvatar.url
              ? (
                <AvatarBadge>
                  <RemoveUploadIcon onClick={handleRemoveUpload} />
                  <Avatar avatarColor={user.id} avatar={newAvatar.url} size={68} avatarName={firstNameValue || user.id} textSize="16px" />
                </AvatarBadge>
              )
              : <UploadImageIcon />}

            <UploadAvatarHandler>
              Format: JPEG, PNG ( max size 1MB )
              <UploadAvatarButton onClick={handleOpenFileUploader}>Upload Photo</UploadAvatarButton>
              <FileUploaderInput
                ref={fileUploader}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
              />
            </UploadAvatarHandler>
          </UploadChannelAvatar>
        </EditProfileContainer>

        <PopupButtons height="72px" marginTop="0" paddingRight="24px">
          <button type="button" className="button gray" onClick={toggleEditPopup}>Cancel</button>
          <button type="button" className="button blue filled" onClick={handleUpdateProfile}>Save</button>
        </PopupButtons>
      </Popup>

      {cropPopup
            && (
            <ImageCrop
              image={newAvatar}
              onAccept={handleImageCrop}
              handleClosePopup={() => setCropPopup(false)}
            />
            )}
    </PopupContainer>
  );
}

EditProfile.propTypes = {
  channel: PropTypes.shape({
    name: PropTypes.string,
    subject: PropTypes.string,
  }),
  toggleEditPopup: PropTypes.func,
  user: PropTypes.objectOf(PropTypes.any).isRequired,
};

EditProfile.defaultProps = {
  channel: null,
  toggleEditPopup: null,
};

const AvatarBadge = styled.div`
  position: relative;
`;

const RemoveUploadIcon = styled(DeleteUpload)`
  position: absolute;
  right: -2px;
  top: -2px;
  cursor: pointer;
`;

const EditProfileContainer = styled.div`
    height: 100%;
    overflow-y: auto;
    margin-right: -25px;
    padding-right: 25px;
`;

const UploadChannelAvatar = styled.div`
  display: flex;
  align-items: center;
`;

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
`;

const FileUploaderInput = styled.input`
  display: none;
`;
