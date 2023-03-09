import { IAction, IContact, IRole, IUser } from '../../types';
export interface IUserStore {
    connectionStatus: string;
    contactList: IContact[];
    usersList: IUser[];
    usersLoadingState: number | null;
    rolesMap: {
        [key: string]: IRole;
    };
    contactsMap: {
        [key: string]: IContact;
    };
    user: IUser;
    browserTabIsActive: boolean;
}
declare const _default: (state: IUserStore | undefined, { type, payload }: IAction) => IUserStore;
export default _default;
