/// <reference types="react" />
import { IAttachment } from '../../types';
interface IVideoPreviewProps {
    maxWidth?: string;
    maxHeight?: string;
    file: IAttachment;
    borderRadius?: string;
    isPreview?: boolean;
    isRepliedMessage?: boolean;
    backgroundColor: string;
    src: string;
    uploading?: boolean;
    isDetailsView?: boolean;
    setVideoIsReadyToSend?: (attachmentId: string) => void;
}
declare const VideoPreview: ({ maxWidth, maxHeight, src, file, borderRadius, isPreview, uploading, isRepliedMessage, backgroundColor, isDetailsView, setVideoIsReadyToSend }: IVideoPreviewProps) => JSX.Element;
export default VideoPreview;
export declare const AttachmentFile: import("styled-components").StyledComponent<"div", any, {
    isPrevious?: boolean | undefined;
    borderRadius?: string | undefined;
    background?: string | undefined;
    border?: string | undefined;
}, never>;
export declare const AttachmentImg: import("styled-components").StyledComponent<"img", any, {
    borderRadius?: string | undefined;
}, never>;
