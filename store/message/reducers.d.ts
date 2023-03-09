import { IAction, IMarker, IMessage } from '../../types';
export interface IMessageStore {
    messagesLoadingState: number | null;
    messagesHasNext: boolean;
    messagesHasPrev: boolean;
    threadMessagesHasNext: boolean;
    threadMessagesHasPrev: boolean;
    activeChannelMessages: any[];
    pendingMessages: {
        [key: string]: IMessage[];
    };
    activeChannelNewMessage: IMessage | null;
    activeTabAttachments: any[];
    attachmentsForPopup: any[];
    attachmentHasNext: boolean;
    attachmentForPopupHasNext: boolean;
    messageToEdit: IMessage | null;
    messageForReply?: IMessage | null;
    activeChannelMessageUpdated: {
        messageId: string;
        params: IMessage;
    } | null;
    activeChannelNewMarkers: {
        name: string;
        markersMap: {
            [key: string]: IMarker;
        };
    };
    scrollToNewMessage: {};
    showScrollToNewMessageButton: boolean;
    sendMessageInputHeight: number;
    attachmentsUploadingState: {
        [key: string]: any;
    };
    scrollToMessage: string | null;
}
declare const _default: (state?: IMessageStore, { type, payload }?: IAction) => IMessageStore;
export default _default;
