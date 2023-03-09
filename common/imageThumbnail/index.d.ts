/// <reference types="react" />
interface IProps {
    src: string;
    width: number;
    height: number;
    borderRadius?: string;
    isLoaded: boolean;
    isRepliedMessage?: boolean;
    fitTheContainer?: boolean;
}
declare const ImageThumbnail: ({ src, width, height, borderRadius, isLoaded, isRepliedMessage, fitTheContainer }: IProps) => JSX.Element;
export default ImageThumbnail;
