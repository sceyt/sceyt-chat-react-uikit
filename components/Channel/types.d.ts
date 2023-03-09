export interface IChannelsCustomColors {
    selectedChannelBackground?: string;
    selectedChannelLeftBorder?: string;
}
export declare type ICustomAvatarColors = [string, string, string, string, string, string];
export interface ChannelQueryParams {
    filter?: {
        channelType: 'Public' | 'Private' | 'Direct';
    };
    limit?: number;
    sort?: 'byLastMessage' | 'byCreationDate';
    search: string;
}
