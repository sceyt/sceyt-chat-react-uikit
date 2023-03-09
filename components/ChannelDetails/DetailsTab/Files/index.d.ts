/// <reference types="react" />
interface IProps {
    channelId: string;
    filePreviewIcon?: JSX.Element;
    filePreviewHoverIcon?: JSX.Element;
    filePreviewTitleColor?: string;
    filePreviewSizeColor?: string;
    filePreviewHoverBackgroundColor?: string;
    filePreviewDownloadIcon?: JSX.Element;
}
declare const Files: ({ channelId, filePreviewIcon, filePreviewHoverIcon, filePreviewTitleColor, filePreviewSizeColor, filePreviewHoverBackgroundColor, filePreviewDownloadIcon }: IProps) => JSX.Element;
export default Files;
