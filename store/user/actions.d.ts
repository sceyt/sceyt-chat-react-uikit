import { IContact, IRole, IUser } from '../../types';
export declare function setConnectionStatusAC(status: string): {
    type: string;
    payload: {
        status: string;
    };
};
export declare function getUsersAC(params: any): {
    type: string;
    payload: {
        params: any;
    };
};
export declare function loadMoreUsersAC(limit: number): {
    type: string;
    payload: {
        limit: number;
    };
};
export declare function setUsersLoadingStateAC(state: number): {
    type: string;
    payload: {
        state: number;
    };
};
export declare function setUsersAC(users: IUser[]): {
    type: string;
    payload: {
        users: IUser[];
    };
};
export declare function addUsersAC(users: IUser[]): {
    type: string;
    payload: {
        users: IUser[];
    };
};
export declare function getContactsAC(): {
    type: string;
    payload: {};
};
export declare function setContactsAC(contacts: IContact[]): {
    type: string;
    payload: {
        contacts: IContact[];
    };
};
export declare function getRolesAC(): {
    type: string;
    payload: {};
};
export declare function setRolesAC(roles: IRole[]): {
    type: string;
    payload: {
        roles: IRole[];
    };
};
export declare function blockUserAC(userIds: string[]): {
    type: string;
    payload: {
        userIds: string[];
    };
};
export declare function unblockUserAC(userIds: string[]): {
    type: string;
    payload: {
        userIds: string[];
    };
};
export declare function setContactsLoadingStateAC(status: number): {
    type: string;
    payload: {
        status: number;
    };
};
export declare function setUserAC(user: IUser): {
    type: string;
    payload: {
        user: IUser;
    };
};
export declare function updateUserProfileAC(profile: any): {
    type: string;
    payload: {
        profile: any;
    };
};
export declare function browserTabIsActiveAC(state: boolean): {
    type: string;
    payload: {
        state: boolean;
    };
};
export declare function updateProfileAC(user: IUser, firstName?: string, lastName?: string, avatarUrl?: string, metadata?: string, avatarFile?: File, presence?: string): {
    type: string;
    payload: {
        user: IUser;
        firstName: string | undefined;
        lastName: string | undefined;
        avatarUrl: string | undefined;
        metadata: string | undefined;
        avatarFile: File | undefined;
        presence: string | undefined;
    };
};
