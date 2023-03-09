/// <reference types="react" />
import { IAddMember, IChannel } from '../../../types';
interface IProps {
    channel?: IChannel;
    toggleCreatePopup: () => void;
    actionType: 'addMembers' | 'createChat' | 'selectUsers';
    getSelectedUsers?: (members: IAddMember[], action: 'create' | 'back') => void;
    memberIds?: string[];
    selectIsRequired?: boolean;
    creatChannelSelectedMembers?: any[];
    popupWidth?: string;
    popupHeight?: string;
}
declare const UsersPopup: ({ channel, toggleCreatePopup, actionType, getSelectedUsers, memberIds, creatChannelSelectedMembers, popupHeight, selectIsRequired, popupWidth }: IProps) => JSX.Element;
export default UsersPopup;
