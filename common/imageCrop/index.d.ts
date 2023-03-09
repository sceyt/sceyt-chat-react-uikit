/// <reference types="react" />
interface IProps {
    image: any;
    onAccept: (file: File) => void;
    handleClosePopup: (cropped?: boolean) => void;
}
declare const ImageCrop: ({ image, onAccept, handleClosePopup }: IProps) => JSX.Element;
export default ImageCrop;
