/// <reference types="react" />
interface IProps {
    link: string;
    linkPreviewIcon?: JSX.Element;
    linkPreviewHoverIcon?: JSX.Element;
    linkPreviewTitleColor?: string;
    linkPreviewColor?: string;
    linkPreviewHoverBackgroundColor?: string;
}
declare const LinkItem: ({ link, linkPreviewIcon, linkPreviewHoverIcon, linkPreviewColor, linkPreviewHoverBackgroundColor }: IProps) => JSX.Element;
export default LinkItem;
