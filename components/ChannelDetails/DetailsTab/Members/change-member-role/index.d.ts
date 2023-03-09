/// <reference types="react" />
import { IMember } from '../../../../../types';
interface IProps {
    channelId: string;
    member: IMember;
    handleClosePopup: () => void;
}
declare const ChangeMemberRole: ({ channelId, member, handleClosePopup }: IProps) => JSX.Element;
export default ChangeMemberRole;
