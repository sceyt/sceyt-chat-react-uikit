export const activeChannelMembersSelector = (store: any) => store.MembersReducer.activeChannelMembers
export const rolesSelector = (store: any) => store.MembersReducer.roles
export const getRolesFailSelector = (store: any) => store.MembersReducer.getRolesFail
export const rolesMapSelector = (store: any) => store.MembersReducer.rolesMap
export const membersLoadingStateSelector = (store: any) => store.MembersReducer.membersLoadingState
export const membersHasNextSelector = (store: any) => store.MembersReducer.membersHasNext
export const restrictedSelector = (store: any) => store.MembersReducer.restricted
export const openInviteModalSelector = (store: any) => store.MembersReducer.openInviteModal
