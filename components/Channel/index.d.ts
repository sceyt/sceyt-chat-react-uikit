import React from 'react';
import { IChannel, IContact } from '../../types';
interface IChannelProps {
    channel: IChannel;
    avatar?: boolean;
    notificationsIsMutedIcon?: JSX.Element;
    notificationsIsMutedIconColor?: string;
    contactsMap: {
        [key: string]: IContact;
    };
}
declare const Channel: React.FC<IChannelProps>;
export default Channel;
export interface UnreadCountProps {
    readonly isMuted: boolean;
    readonly backgroundColor?: string;
    width?: string;
    height?: string;
    textColor?: string;
    fontSize?: string;
}
export declare const Container: import("styled-components").StyledComponent<"div", any, any, never>;
export declare const ChannelInfo: import("styled-components").StyledComponent<"div", any, {
    avatar?: boolean | undefined;
    isMuted?: boolean | undefined;
    statusWidth: number;
}, never>;
export declare const MutedIcon: import("styled-components").StyledComponent<"span", any, {}, never>;
export declare const LastMessage: import("styled-components").StyledComponent<"div", any, {
    markedAsUnread?: boolean | undefined;
    unreadMentions?: boolean | undefined;
}, never>;
export declare const AvatarWrapper: import("styled-components").StyledComponent<"div", any, {}, never>;
export declare const UserStatus: import("styled-components").StyledComponent<"span", any, {
    backgroundColor?: string | undefined;
}, never>;
export declare const LastMessageAuthor: import("styled-components").StyledComponent<"div", any, any, never>;
export declare const Points: import("styled-components").StyledComponent<"span", any, {}, never>;
export declare const LastMessageText: import("styled-components").StyledComponent<"span", any, {
    withAttachments?: boolean | undefined;
    noBody?: boolean | undefined;
    deletedMessage?: boolean | undefined;
}, never>;
export declare const ChannelStatus: import("styled-components").StyledComponent<"div", any, {}, never>;
export declare const LastMessageDate: import("styled-components").StyledComponent<"span", any, {}, never>;
export declare const DeliveryIconCont: import("styled-components").StyledComponent<"span", any, {}, never>;
export declare const UnreadMentionIconWrapper: import("styled-components").StyledComponent<"span", any, {
    iconColor?: string | undefined;
    rightMargin?: boolean | undefined;
}, never>;
export declare const TypingIndicator: import("styled-components").StyledComponent<"span", any, {}, never>;
export declare const UnreadInfo: import("styled-components").StyledComponent<"span", any, {}, never>;
