/// <reference types="react" />
interface IProps {
    title: string;
    description: string | JSX.Element;
    buttonText: string;
    buttonTextColor?: string;
    buttonBackground?: string;
    togglePopup: () => void;
    handleFunction: (option?: any) => void;
    loading?: boolean;
    isDeleteMessage?: boolean;
    isIncomingMessage?: boolean;
    isDirectChannel?: boolean;
    allowDeleteIncoming?: boolean;
    myRole?: string;
}
declare function ConfirmPopup({ title, description, buttonText, buttonTextColor, buttonBackground, togglePopup, handleFunction, isDeleteMessage, isIncomingMessage, allowDeleteIncoming, isDirectChannel, myRole, loading }: IProps): JSX.Element;
export default ConfirmPopup;
