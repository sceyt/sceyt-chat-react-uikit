/// <reference types="react" />
import { IChannel } from '../../../types';
interface IProps {
    channel: IChannel;
    handleToggleEditMode: () => void;
}
declare const Info: ({ channel, handleToggleEditMode }: IProps) => JSX.Element;
export default Info;
