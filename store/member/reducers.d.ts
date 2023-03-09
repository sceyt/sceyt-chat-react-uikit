import { IAction, IMember, IRole } from '../../types';
export interface IMembersStore {
    membersLoadingState: boolean;
    membersHasNext: boolean;
    roles: IRole[] | [];
    activeChannelMembers: IMember[] | [];
}
declare const _default: (state: IMembersStore | undefined, { type, payload }: IAction) => IMembersStore;
export default _default;
