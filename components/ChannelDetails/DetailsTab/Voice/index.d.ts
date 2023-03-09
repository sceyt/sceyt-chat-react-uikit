/// <reference types="react" />
interface IProps {
    channelId: string;
    linkPreviewIcon?: JSX.Element;
    linkPreviewHoverIcon?: JSX.Element;
    linkPreviewTitleColor?: string;
    linkPreviewColor?: string;
    linkPreviewHoverBackgroundColor?: string;
}
declare const Links: ({ channelId, linkPreviewIcon, linkPreviewHoverIcon, linkPreviewTitleColor, linkPreviewColor, linkPreviewHoverBackgroundColor }: IProps) => JSX.Element;
export default Links;
