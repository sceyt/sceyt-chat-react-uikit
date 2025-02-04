import React, {useContext, useEffect, useState} from 'react'
import {SceytContext} from "../sceytContext";
import {CreateChannel, DropDown} from "sceyt-chat-react-uikit";
import newChannelButtonIcon from '../assets/svg/newChannelButtonIcon.svg';
import createChannelIcon from '../assets/svg/createChannel.svg';
import createGroupIcon from '../assets/svg/createGroup.svg';
import createChatIcon from '../assets/svg/createChat.svg';
import darkModeIcon from "../assets/svg/darkModeIcon.svg";

function CreateChannelButton() {

  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [creatingChannelType, setCreatingChannelType] = useState('');
  // const [dropDownOpened, setDropDownOpened] = useState(false);
  const [theme, setTheme] = useState('');
  const sceytContext = useContext(SceytContext);

  const handleOpenCreateChannel = (channelType: string) => {
    setCreatingChannelType(channelType)
    setShowCreateChannel(true)
  };

  /* const watchToggleState = (state) => {
       log.info('dropDownOpened - - - -- ', state)
       // setDropDownOpened(state)
   };*/

  useEffect(() => {
    if (sceytContext && sceytContext.theme) {
      setTheme(sceytContext.theme)
    }
  }, [sceytContext]);


  return (<div>
    <DropDown
      forceClose={showCreateChannel}
      position='center'
      theme={theme}
      // watchToggleState={watchToggleState}
      trigger={
        <div className='custom_create_channel'>
          <img src={newChannelButtonIcon} alt="new channel"/>
        </div>
      }
    >
      <ul className='custom_ul'>
        <li
          className={`custom_li messenger_create_channel_item ${theme}`}
          key={1}
          onClick={() => handleOpenCreateChannel('broadcast')}
        >
          <img src={createChannelIcon} alt="create channel"/>
          New channel
        </li>
        <li
          className={`custom_li messenger_create_channel_item ${theme}`}
          key={2}
          onClick={() => handleOpenCreateChannel('group')}
        >
          <img src={createGroupIcon} alt="create group"/>

          New group
        </li>
        <li
          className={`custom_li messenger_create_channel_item ${theme}`}
          key={3}
          onClick={() => handleOpenCreateChannel('direct')}
        >
          <img src={createChatIcon} alt="create chat"/>
          New chat
        </li>
      </ul>
    </DropDown>

    {showCreateChannel && (
      <CreateChannel
        handleClose={() => setShowCreateChannel(false)}
        channelType={creatingChannelType}
        uriPrefixOnCreateChannel='waafi.com/'
        withoutConfig={creatingChannelType === 'direct'}
        channelTypeRequiredFieldsMap={{public: {uri: true, subject: true}, private: {subject: true, members: true}}}
        showUri={creatingChannelType === 'public'}
      />
    )}
  </div>);
}

export default CreateChannelButton
