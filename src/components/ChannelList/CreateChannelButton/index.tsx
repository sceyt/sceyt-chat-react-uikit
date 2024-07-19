import React, { useState } from 'react'
import styled from 'styled-components'
// Helpers
import { DropdownOptionLi, DropdownOptionsUl } from '../../../UIHelper'
import { colors, THEME_COLOR_NAMES } from '../../../UIHelper/constants'
// Assets
import { ReactComponent as CreateChannelIcon } from '../../../assets/svg/createChannel.svg'
import { ReactComponent as CreateGrouplIcon } from '../../../assets/svg/createGroup.svg'
import { ReactComponent as CreateChatIcon } from '../../../assets/svg/createChat.svg'
import { ReactComponent as AddChannelIcon } from '../../../assets/svg/addChat.svg'
// Components
import UsersPopup from '../../../common/popups/users'
import CreateChannel from '../../../common/popups/createChannel'
import DropDown from '../../../common/dropdown'
import { CHANNEL_TYPE } from '../../../helpers/constants'
import { useColor } from '../../../hooks'

interface IChannelListProps {
  showSearch?: boolean
  theme?: string
  uriPrefixOnCreateChannel?: string
  createChannelIcon?: JSX.Element
  newChannelIcon?: JSX.Element
  newGroupIcon?: JSX.Element
  newChatIcon?: JSX.Element
  uploadPhotoIcon?: JSX.Element
}

const CreateChannelButton: React.FC<IChannelListProps> = ({
  showSearch,
  theme,
  uriPrefixOnCreateChannel,
  createChannelIcon,
  newChannelIcon,
  newGroupIcon,
  newChatIcon,
  uploadPhotoIcon
}) => {
  // const dispatch = useDispatch()
  const [showAddMemberPopup, setShowAddMemberPopup] = useState(false)
  const [showCreateChannel, setShowCreateChannel] = useState(false)
  const [creatingChannelType, setCreatingChannelType] = useState<string>('group')
  const accentColor = useColor(THEME_COLOR_NAMES.ACCENT)
  const outgoingColor = useColor(THEME_COLOR_NAMES.OUTGOING)
  const handleOpenCreateChannel = (channelType: string) => {
    setCreatingChannelType(channelType)
    if (channelType === 'direct') {
      // dispatch(setChannelEditModeAC(true))
      setShowAddMemberPopup(true)
    } else {
      setShowCreateChannel(true)
    }
  }

  return (
    <React.Fragment>
      <DropDown
        forceClose={showAddMemberPopup || !!showCreateChannel}
        position='center'
        theme={theme}
        zIndex='300'
        trigger={
          <CreateDropdownButton hoverBackground={outgoingColor} leftAuto={!showSearch} iconColor={accentColor}>
            {createChannelIcon || <AddChannelIcon />} 
          </CreateDropdownButton>
        }
      >
        <DropdownOptionsUl>
          <DropdownOptionLi
            key={1}
            textColor={colors.textColor1}
            hoverBackground={colors.hoverBackgroundColor}
            onClick={() => handleOpenCreateChannel('broadcast')}
            iconWidth='20px'
          >
            {newChannelIcon || <CreateChannelIcon />}
            New channel
          </DropdownOptionLi>
          <DropdownOptionLi
            key={2}
            textColor={colors.textColor1}
            hoverBackground={colors.hoverBackgroundColor}
            onClick={() => handleOpenCreateChannel('group')}
            iconWidth='20px'
          >
            {newGroupIcon || <CreateGrouplIcon />}
            New group
          </DropdownOptionLi>
          <DropdownOptionLi
            key={3}
            textColor={colors.textColor1}
            hoverBackground={colors.hoverBackgroundColor}
            onClick={() => handleOpenCreateChannel('direct')}
            iconWidth='20px'
          >
            {newChatIcon || <CreateChatIcon />}
            New chat
          </DropdownOptionLi>
        </DropdownOptionsUl>
      </DropDown>

      {showAddMemberPopup && (
        <UsersPopup
          popupHeight='540px'
          popupWidth='520px'
          toggleCreatePopup={() => setShowAddMemberPopup(false)}
          actionType='createChat'
        />
      )}
      {showCreateChannel && (
        <CreateChannel
          handleClose={() => setShowCreateChannel(false)}
          channelType={creatingChannelType}
          uriPrefixOnCreateChannel={uriPrefixOnCreateChannel}
          uploadPhotoIcon={uploadPhotoIcon}
          showUri={creatingChannelType !== CHANNEL_TYPE.GROUP}
        />
      )}
    </React.Fragment>
  )
}

export default CreateChannelButton

const CreateDropdownButton = styled.div<{ leftAuto: boolean; hoverBackground?: string; iconColor?: string }>`
  //margin-left: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
  line-height: 55px;
  margin-left: ${(props) => (props.leftAuto ? 'auto' : '12px')};
  width: 40px;
  height: 40px;
  border-radius: 50%;
  transition: all 0.2s;
  &:hover {
    background-color: ${(props) => props.hoverBackground || colors.primaryLight};
  }
  & > svg {
    color: ${(props) => props.iconColor || colors.primary};
  }
`
