/// <reference types="react" />
import SceytChatClient from 'sceyt-chat';
import { ICustomAvatarColors } from '../Channel/types';
import { IAttachment, IUser } from '../../types';
export interface IProgress {
    loaded: number;
    total: number;
}
export interface IUploadTask {
    updateLocalFileLocation?: (newPath: String) => void;
    progress: (progress: IProgress) => void;
    failure: (error: Error) => void;
    success: (uri: string) => void;
    cancel: () => void;
    stop: () => void;
    resume: () => void;
}
export interface ICustomUploader {
    upload: (attachment: IAttachment, uploadTask: IUploadTask) => void;
    download: (uri: string, progressCallback?: (progress: any) => void) => Promise<string>;
}
export interface IChatClientProps {
    client: SceytChatClient;
    avatarColors?: ICustomAvatarColors;
    hideUserPresence?: (user: IUser) => boolean;
    showOnlyContactUsers?: boolean;
    sendAttachmentsAsSeparateMessages?: boolean;
    children?: JSX.Element | JSX.Element[];
    logoSrc?: string;
    CustomUploader?: ICustomUploader;
    customColors?: {
        primaryColor?: string;
        textColor1?: string;
        textColor2?: string;
        textColor3?: string;
        deletedUserAvatarBackground?: string;
        defaultAvatarBackground?: string;
    };
}
declare const SceytChatContainer: ({ client, avatarColors, children, showOnlyContactUsers, sendAttachmentsAsSeparateMessages, logoSrc, CustomUploader, customColors, hideUserPresence }: IChatClientProps) => JSX.Element;
export default SceytChatContainer;
