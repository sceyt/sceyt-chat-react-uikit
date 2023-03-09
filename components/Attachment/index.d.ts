/// <reference types="react" />
import { IAttachment } from '../../types';
interface AttachmentPops {
    attachment: IAttachment;
    isPrevious?: boolean;
    isRepliedMessage?: boolean;
    isDetailsView?: boolean;
    removeSelected?: (attachmentUrl: string) => void;
    setVideoIsReadyToSend?: (attachmentId: string) => void;
    handleMediaItemClick?: (attachment: IAttachment) => void;
    attachments?: IAttachment[];
    borderRadius?: string;
    backgroundColor: string;
    selectedFileAttachmentsBoxBorder?: string;
    selectedFileAttachmentsTitleColor?: string;
    selectedFileAttachmentsSizeColor?: string;
    selectedFileAttachmentsIcon?: JSX.Element;
    fileNameMaxLength?: number;
    imageMinWidth?: string;
    closeMessageActions?: (state: boolean) => void;
}
declare const Attachment: ({ attachment, isPrevious, removeSelected, isRepliedMessage, borderRadius, handleMediaItemClick, setVideoIsReadyToSend, selectedFileAttachmentsIcon, backgroundColor, selectedFileAttachmentsBoxBorder, selectedFileAttachmentsTitleColor, selectedFileAttachmentsSizeColor, isDetailsView, fileNameMaxLength, imageMinWidth, closeMessageActions }: AttachmentPops) => JSX.Element;
export default Attachment;
export declare const AttachmentFile: import("styled-components").StyledComponent<"div", any, {
    isPrevious?: boolean | undefined;
    isRepliedMessage?: boolean | undefined;
    isUploading?: boolean | undefined;
    borderRadius?: string | undefined;
    background?: string | undefined;
    border?: string | undefined;
}, never>;
export declare const AttachmentImg: import("styled-components").StyledComponent<"img", any, {
    absolute?: boolean | undefined;
    borderRadius?: string | undefined;
    ref?: any;
    withBorder?: boolean | undefined;
    isPrevious?: boolean | undefined;
    isRepliedMessage?: boolean | undefined;
    fitTheContainer?: boolean | undefined;
    backgroundColor: string;
    imageMinWidth?: string | undefined;
}, never>;
