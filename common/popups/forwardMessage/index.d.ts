/// <reference types="react" />
interface IProps {
    title: string;
    buttonText: string;
    togglePopup: () => void;
    handleForward: (channelIds: string[]) => void;
    loading?: boolean;
}
declare function ForwardMessagePopup({ title, buttonText, togglePopup, handleForward, loading }: IProps): JSX.Element;
export default ForwardMessagePopup;
