import { IMessage, IReaction } from '../../types';
export declare const MESSAGES_MAX_LENGTH = 60;
export declare const LOAD_MAX_MESSAGE_COUNT = 20;
export declare const MESSAGE_LOAD_DIRECTION: {
    PREV: string;
    NEXT: string;
};
export declare type IAttachmentMeta = {
    thumbnail?: string;
    imageWidth?: number;
    imageHeight?: number;
    duration?: number;
};
declare type pendingMessagesMap = {
    [key: string]: IMessage[];
};
declare const pendingMessagesMap: pendingMessagesMap;
export declare const setAllMessages: (messages: IMessage[]) => void;
export declare const addAllMessages: (messages: IMessage[], direction: string) => void;
export declare const updateMessageOnAllMessages: (messageId: string, updatedParams: any) => void;
export declare const removeMessageFromAllMessages: (messageId: string) => void;
export declare const updateMarkersOnAllMessages: (markersMap: any, name: string) => void;
export declare const getAllMessages: () => IMessage[];
export declare const removeAllMessages: () => void;
export declare const setHasPrevCached: (state: boolean) => void;
export declare const getHasPrevCached: () => boolean;
export declare const setHasNextCached: (state: boolean) => boolean;
export declare const getHasNextCached: () => boolean;
export declare const getFromAllMessagesByMessageId: (messageId: string, direction: string, getWithLastMessage?: boolean | undefined) => IMessage[];
export declare function setMessagesToMap(channelId: string, messages: IMessage[]): void;
export declare function addMessageToMap(channelId: string, message: IMessage): void;
export declare function addMessagesToMap(channelId: string, messages: IMessage[], direction: 'next' | 'prev'): void;
export declare function updateMessageOnMap(channelId: string, updatedMessage: {
    messageId: string;
    params: any;
}): void;
export declare function addReactionToMessageOnMap(channelId: string, message: IMessage, reaction: IReaction, isSelf: boolean): void;
export declare function updateMessageStatusOnMap(channelId: string, newMarkers: {
    name: string;
    markersMap: any;
}): void;
export declare function getMessagesFromMap(channelId: string): IMessage[];
export declare function removeMessagesFromMap(channelId: string): void;
export declare function removeMessageFromMap(channelId: string, messageId: string): void;
export declare function clearMessagesMap(): void;
export declare function checkChannelExistsOnMessagesMap(channelId: string): boolean;
export declare function destroyChannelsMap(): void;
export declare const messagesDiff: (message: IMessage, updatedMessage: IMessage) => boolean;
export declare const setVideoThumb: (attachmentId: string, thumb: IAttachmentMeta) => void;
export declare const getVideoThumb: (attachmentId: string) => IAttachmentMeta;
export declare const deleteVideoThumb: (attachmentId: string) => void;
export declare const setPendingAttachment: (attachmentId: string, file: File) => void;
export declare const getPendingAttachment: (attachmentId: string) => File;
export declare const deletePendingAttachment: (attachmentId: string) => boolean;
export declare const getPendingMessages: (channelId: string) => IMessage[];
export declare const getPendingMessagesMap: () => pendingMessagesMap;
export {};
