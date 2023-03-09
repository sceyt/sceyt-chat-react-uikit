import React, { FC } from 'react';
import { IChannel } from '../../types';
interface IChannelGroup {
    groupName: string;
    channelList: IChannel[];
}
interface IChannelListProps {
    List?: FC<{
        channels: IChannel[];
        loadMoreChannels: (count?: number) => void;
        searchValue?: string;
        handleSetChannelListWithGroups?: (channelListGroups: IChannelGroup[]) => void;
        children?: React.ReactNode;
    }>;
    ListItem?: FC<any>;
    getActiveChannel?: (channel: IChannel) => void;
    Profile?: JSX.Element;
    filter?: {
        channelType: 'Public' | 'Private' | 'Direct';
    };
    limit?: number;
    sort?: 'byLastMessage' | 'byCreationDate';
    avatar?: boolean;
    showSearch?: boolean;
    searchOption?: 'custom' | 'default';
    forceUpdateChannelList?: () => void;
    showCreateChannelIcon?: boolean;
    uriPrefixOnCreateChannel?: string;
    notificationsIsMutedIcon?: JSX.Element;
    notificationsIsMutedIconColor?: string;
    createChannelIcon?: JSX.Element;
    createChannelIconHoverBackground?: string;
    selectedChannelBackground?: string;
    selectedChannelLeftBorder?: string;
    onChannelDeleted?: (setChannels: (channels: IChannel[]) => void, channel: IChannel) => void;
    onChannelCreated?: (setChannels: (channels: IChannel[]) => void, channel: IChannel) => void;
    onChannelHidden?: (setChannels: (channels: IChannel[]) => void, channel: IChannel) => void;
    onChannelVisible?: (setChannels: (channels: IChannel[]) => void, channel: IChannel) => void;
    onAddedToChannel?: (setChannels: (channels: IChannel[]) => void, channel: IChannel) => void;
}
declare const ChannelList: React.FC<IChannelListProps>;
export default ChannelList;
