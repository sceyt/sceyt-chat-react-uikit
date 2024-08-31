import React, {useEffect, useState, useContext} from 'react';
import {SceytContext} from "../sceytContext";
import {IChannel, IUser} from "sceyt-chat-react-uikit/types";
import {Avatar} from "sceyt-chat-react-uikit";

function ChannelCustomList({
                             channels,
                             searchedChannels,
                             loadMoreChannels,
                             setSelectedChannel,
                             selectedChannel,
                             searchValue,
                             activeChannelIsChanged,
                           }:
                             {
                               channels: IChannel[],
                               searchedChannels: { chats_groups: [], channels: [], contacts: [] },
                               loadMoreChannels: (count?: number) => void,
                               setSelectedChannel?: (channel: IChannel) => void,
                               activeChannelIsChanged?: (channel: IChannel) => void,
                               selectedChannel?: IChannel,
                               searchValue: string
                             }) {

  const [channelListWithGroups, setChannelListWithGroups] = useState<any>([]);
  const [user, setUser] = useState<IUser>();
  const sceytContext = useContext(SceytContext);

  const handleScroll = (e: any) => {
    if (e.target.scrollTop >= (e.target.scrollHeight - e.target.offsetHeight) - 200) {
      loadMoreChannels();
    }
  };
  const makeUserName = (user: IUser) => {
    return user.firstName ? `${user.firstName} ${user.lastName}` : user.id
  };

  const handleCreateChannelsGroupList = () => {
    const channelsGroupList: any[] = []
    const channelGroupMap: { group: any[], direct: any[] } = {group: [], direct: []}
    const groups: any[] = []
    const directs: any[] = []
    channels.forEach(channel => {
      const channelGroupType = channel.type === 'direct' ? 'direct' : 'group'
      if (channelGroupType === 'direct') {
        directs.push(channel)
      } else {
        groups.push(channel)
      }
    })
    channelGroupMap.group = groups;
    channelGroupMap.direct = directs;

    Object.keys(channelGroupMap).forEach((key: any) => {
      const groupName = key === 'direct' ? 'DIRECT MESSAGES' : 'CHANNELS'
      // @ts-ignore
      channelsGroupList.push({groupName, channelList: channelGroupMap[key]})
    })
    setChannelListWithGroups(channelsGroupList)
  }

  const handleChangeActiveChannel = (channel: IChannel) => {
    if (setSelectedChannel) {
      setSelectedChannel(channel)
    }
    if (activeChannelIsChanged) {
      setTimeout(() => {
        activeChannelIsChanged(channel)
      }, 200)
    }
  }

  useEffect(() => {
    if (sceytContext && sceytContext.client) {
      setUser(sceytContext.client.user)
    }
  }, [sceytContext]);

  useEffect(() => {
    if (channels) {
      handleCreateChannelsGroupList()
    }
  }, [channels]);
  useEffect(() => {
    if (!searchValue) {
      handleCreateChannelsGroupList()
    }
  }, [searchValue]);

  useEffect(() => {
    if (searchedChannels && searchValue) {
      const channelsGroupList = []
      const directChannels: any[] = []
      const groupChannels: any[] = []
      for (let key in searchedChannels) {
        // @ts-ignore
        if (searchedChannels[key].length) {
          // @ts-ignore
          searchedChannels[key].forEach((channel: IChannel) => {
            if (channel.type === 'direct') {
              directChannels.push(channel)
            } else {
              groupChannels.push(channel)
            }
          })
        }
      }
      channelsGroupList.push({
        groupName: 'CHANNELS', channelList: groupChannels.sort(
          (a, b) =>
            (a.lastMessage ? a.lastMessage.createdAt : a.createdAt) -
            (b.lastMessage ? b.lastMessage.createdAt : b.createdAt)
        )
          .reverse()
      })
      channelsGroupList.push({
        groupName: 'DIRECT MESSAGES', channelList: directChannels
      })
      setChannelListWithGroups(channelsGroupList)
    }
  }, [searchedChannels])
  return (
    <div className={`channels_custom_list  ${sceytContext.theme}`} onScroll={handleScroll}>
      {channelListWithGroups.map((channelGroup: any) => (
        <div key={channelGroup.groupName}>
          {channelGroup.channelList && channelGroup.channelList.length && (
            <h3 className='channels_group_name'>{channelGroup.groupName}</h3>)}
          {channelGroup.channelList && channelGroup.channelList.map((channel: IChannel) => {
            const isDirectChannel = channel.type === 'direct'
            const directChannelUser = isDirectChannel && channel.members.find((member) => member.id !== (user || {}).id)
            // const directChannelUser = isDirectChannel && channel.members[0]
            return (
              <div key={channel.id} onClick={() => handleChangeActiveChannel(channel)}
                   className={`custom_channel_item ${selectedChannel && selectedChannel.id === channel.id && 'active'}`}>
                {channel.type === 'direct' &&
                  <Avatar name={(directChannelUser || {}).id || ''} size={32}
                          image={(directChannelUser || {}).avatarUrl}
                          setDefaultAvatar/>}
                <h4 className={`channel_name ${isDirectChannel ? 'withAvatar' : ''}`}>
                  {isDirectChannel && directChannelUser ? makeUserName(directChannelUser) : `# ${channel.subject}`}
                </h4>
                {!!(channel.newMessageCount && channel.newMessageCount > 0) && (
                  <span className='channel_unread_count'>
                                        {channel.newMessageCount < 100 ? channel.newMessageCount : '+99'}
                                    </span>
                )}
              </div>)
          })}
        </div>
      ))}
    </div>
  );
}

export default ChannelCustomList;
