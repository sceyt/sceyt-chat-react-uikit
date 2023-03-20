import React, { useState } from 'react'
import styled from 'styled-components'
import DropDown from '../../../common/dropdown'
import { DropdownOptionLi, DropdownOptionsUl } from '../../../UIHelper'
import { colors } from '../../../UIHelper/constants'
import { ReactComponent as CreateChannelIcon } from '../../../assets/svg/createChannel.svg'
import { ReactComponent as CreateGrouplIcon } from '../../../assets/svg/createGroup.svg'
import { ReactComponent as CreateChatIcon } from '../../../assets/svg/createChat.svg'
import { ReactComponent as AddChannelIcon } from '../../../assets/svg/addChat.svg'
import UsersPopup from '../../../common/popups/users'
import CreateChannel from '../../../common/popups/createChannel'

interface IChannelListProps {
  showSearch?: boolean
  uriPrefixOnCreateChannel?: string
  createChannelIcon?: JSX.Element
  createChannelIconHoverBackground?: string
}

const CreateChannelButton: React.FC<IChannelListProps> = ({
  showSearch,
  uriPrefixOnCreateChannel,
  createChannelIcon,
  createChannelIconHoverBackground
}) => {
  // const dispatch = useDispatch()
  const [showAddMemberPopup, setShowAddMemberPopup] = useState(false)
  const [showCreateChannel, setShowCreateChannel] = useState('')

  const handleOpenCreateChannel = (channelType: string) => {
    if (channelType === 'direct') {
      // dispatch(setChannelEditModeAC(true))
      setShowAddMemberPopup(true)
    } else {
      setShowCreateChannel(channelType)
    }
  }
  return (
    <React.Fragment>
      <DropDown
        forceClose={showAddMemberPopup || !!showCreateChannel}
        position='center'
        trigger={
          <CreateDropdownButton hoverBackground={createChannelIconHoverBackground} leftAuto={!showSearch}>
            <IconWrapper />
            {createChannelIcon || <AddChannelIcon />}
          </CreateDropdownButton>
        }
      >
        <DropdownOptionsUl>
          <DropdownOptionLi
            key={1}
            textColor={colors.gray6}
            hoverBackground={colors.gray5}
            onClick={() => handleOpenCreateChannel('public')}
            iconWidth='20px'
          >
            <CreateChannelIcon />
            New channel
          </DropdownOptionLi>
          <DropdownOptionLi
            key={2}
            textColor={colors.gray6}
            hoverBackground={colors.gray5}
            onClick={() => handleOpenCreateChannel('private')}
            iconWidth='20px'
          >
            <CreateGrouplIcon />
            New group
          </DropdownOptionLi>
          <DropdownOptionLi
            key={3}
            textColor={colors.gray6}
            hoverBackground={colors.gray5}
            onClick={() => handleOpenCreateChannel('direct')}
            iconWidth='20px'
          >
            <CreateChatIcon />
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
          handleClose={() => setShowCreateChannel('')}
          channelType={showCreateChannel}
          uriPrefixOnCreateChannel={uriPrefixOnCreateChannel}
        />
      )}
    </React.Fragment>
  )
}

export default CreateChannelButton

const IconWrapper = styled.span`
  position: absolute;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  opacity: 0.2;
`
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
  &:hover {
    & ${IconWrapper} {
      background-color: ${(props) => props.iconColor || colors.primary};
    }
  }
  & > svg {
    color: ${(props) => props.iconColor || colors.primary};
  }
`
