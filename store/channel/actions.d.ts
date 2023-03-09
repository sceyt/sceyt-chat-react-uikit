import { ChannelQueryParams } from '../../components/Channel/types';
import { IChannel, ICreateChannel, IMessage, IUser } from '../../types';
export declare function createChannelAC(channelData: ICreateChannel): {
    type: string;
    payload: {
        channelData: ICreateChannel;
    };
};
export declare function getChannelsAC(params: ChannelQueryParams, isJoinChannel?: boolean): {
    type: string;
    payload: {
        params: ChannelQueryParams;
        isJoinChannel: boolean | undefined;
    };
};
export declare function loadMoreChannels(limit?: number): {
    type: string;
    payload: {
        limit: number | undefined;
    };
};
export declare function getChannelsForForwardAC(searchValue?: string): {
    type: string;
    payload: {
        searchValue: string | undefined;
    };
};
export declare function loadMoreChannelsForForward(limit?: number): {
    type: string;
    payload: {
        limit: number | undefined;
    };
};
export declare function addChannelAC(channel: IChannel): {
    type: string;
    payload: {
        channel: IChannel;
    };
};
export declare function addChannelsAC(channels: IChannel[]): {
    type: string;
    payload: {
        channels: IChannel[];
    };
};
export declare function addChannelsForForwardAC(channels: IChannel[]): {
    type: string;
    payload: {
        channels: IChannel[];
    };
};
export declare function deleteChannelAC(channelId: string): {
    type: string;
    payload: {
        channelId: string;
    };
};
export declare function blockChannelAC(channelId: string): {
    type: string;
    payload: {
        channelId: string;
    };
};
export declare function removeChannelAC(channelId: string): {
    type: string;
    payload: {
        channelId: string;
    };
};
export declare function removeChannelCachesAC(channelId: string): {
    type: string;
    payload: {
        channelId: string;
    };
};
export declare function setChannelToAddAC(channel: IChannel | null): {
    type: string;
    payload: {
        channel: IChannel | null;
    };
};
export declare function setAddedToChannelAC(channel: IChannel | null): {
    type: string;
    payload: {
        channel: IChannel | null;
    };
};
export declare function setChannelToRemoveAC(channel: IChannel | null): {
    type: string;
    payload: {
        channel: IChannel | null;
    };
};
export declare function setChannelToHideAC(channel: IChannel | null): {
    type: string;
    payload: {
        channel: IChannel | null;
    };
};
export declare function setChannelToUnHideAC(channel: IChannel | null): {
    type: string;
    payload: {
        channel: IChannel | null;
    };
};
export declare function setChannelsAC(channels: IChannel[]): {
    type: string;
    payload: {
        channels: IChannel[];
    };
};
export declare function setChannelsFroForwardAC(channels: IChannel[]): {
    type: string;
    payload: {
        channels: IChannel[];
    };
};
export declare function setChannelsLoadingStateAC(state: number, forForward?: boolean): {
    type: string;
    payload: {
        state: number;
        forForward: boolean | undefined;
    };
};
export declare function channelHasNextAC(hasNext: boolean, forForward?: boolean): {
    type: string;
    payload: {
        hasNext: boolean;
        forForward: boolean | undefined;
    };
};
export declare function setActiveChannelAC(channel: IChannel): {
    type: string;
    payload: {
        channel: IChannel;
    };
};
export declare function switchChannelActionAC(channel: IChannel): {
    type: string;
    payload: {
        channel: IChannel;
    };
};
export declare function updateChannelAC(channelId: string, config: any): {
    type: string;
    payload: {
        channelId: string;
        config: any;
    };
};
export declare function updateChannelDataAC(channelId: string, config: any): {
    type: string;
    payload: {
        channelId: string;
        config: any;
    };
};
export declare function updateChannelLastMessageAC(message: IMessage | {}, channel: IChannel): {
    type: string;
    payload: {
        message: {} | IMessage;
        channel: IChannel;
    };
};
export declare function updateChannelLastMessageStatusAC(message: IMessage, channel: IChannel): {
    type: string;
    payload: {
        message: IMessage;
        channel: IChannel;
    };
};
export declare function markMessagesAsReadAC(channelId: string, messageIds: string[]): {
    type: string;
    payload: {
        channelId: string;
        messageIds: string[];
    };
};
export declare function markMessagesAsDeliveredAC(channelId: string, messageIds: string[]): {
    type: string;
    payload: {
        channelId: string;
        messageIds: string[];
    };
};
export declare function sendTypingAC(state: boolean): {
    type: string;
    payload: {
        state: boolean;
    };
};
export declare function switchTypingIndicatorAC(typingState: boolean, channelId: string, from?: IUser): {
    type: string;
    payload: {
        typingState: boolean;
        from: IUser | undefined;
        channelId: string;
    };
};
export declare function turnOffNotificationsAC(expireTime?: number): {
    type: string;
    payload: {
        expireTime: number | undefined;
    };
};
export declare function turnOnNotificationsAC(): {
    type: string;
};
export declare function markChannelAsReadAC(channelId: string): {
    type: string;
    payload: {
        channelId: string;
    };
};
export declare function markChannelAsUnReadAC(channelId: string): {
    type: string;
    payload: {
        channelId: string;
    };
};
export declare function switchChannelInfoAC(open: boolean): {
    type: string;
    payload: {
        open: boolean;
    };
};
export declare function leaveChannelAC(channelId: string): {
    type: string;
    payload: {
        channelId: string;
    };
};
export declare function toggleEditChannelAC(state: boolean): {
    type: string;
    payload: {
        state: boolean;
    };
};
export declare function checkUserStatusAC(usersMap: {
    [key: string]: string;
}): {
    type: string;
    payload: {
        usersMap: {
            [key: string]: string;
        };
    };
};
export declare function updateUserStatusOnChannelAC(usersMap: {
    [key: string]: IUser;
}): {
    type: string;
    payload: {
        usersMap: {
            [key: string]: IUser;
        };
    };
};
export declare function setChannelListWithAC(width: number): {
    type: string;
    payload: {
        width: number;
    };
};
export declare function clearHistoryAC(channelId: string): {
    type: string;
    payload: {
        channelId: string;
    };
};
export declare function deleteAllMessagesAC(channelId: string): {
    type: string;
    payload: {
        channelId: string;
    };
};
export declare function joinChannelAC(channelId: string): {
    type: string;
    payload: {
        channelId: string;
    };
};
export declare function setIsDraggingAC(isDragging: boolean): {
    type: string;
    payload: {
        isDragging: boolean;
    };
};
export declare function setDraggedAttachments(attachments: File[], type: string): {
    type: string;
    payload: {
        attachments: File[];
        type: string;
    };
};
export declare function watchForEventsAC(): {
    type: string;
};
export declare function destroySession(): {
    type: string;
};
