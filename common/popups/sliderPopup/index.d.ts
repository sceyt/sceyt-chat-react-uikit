/// <reference types="react" />
import { IMedia } from '../../../types';
interface IProps {
    channelId: string;
    setIsSliderOpen: (state: any) => void;
    mediaFiles?: IMedia[];
    currentMediaFile: IMedia;
}
declare const SliderPopup: ({ channelId, setIsSliderOpen, mediaFiles, currentMediaFile }: IProps) => JSX.Element;
export default SliderPopup;
