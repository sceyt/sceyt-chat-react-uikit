export const activeChannelMembersMapSelector = (store: any) => store.MembersReducer.channelsMembersMap
export const rolesSelector = (store: any) => store.MembersReducer.roles
export const getRolesFailSelector = (store: any) => store.MembersReducer.getRolesFail
export const rolesMapSelector = (store: any) => store.MembersReducer.rolesMap
export const channelsMembersLoadingStateSelector = (store: any) => store.MembersReducer.channelsMembersLoadingState
export const channelsMembersHasNextMapSelector = (store: any) => store.MembersReducer.channelsMembersHasNextMap
export const restrictedSelector = (store: any) => store.MembersReducer.restricted
export const openInviteModalSelector = (store: any) => store.MembersReducer.openInviteModal
