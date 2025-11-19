export const channelsSelector = (store: any) => store.ChannelReducer.channels
export const searchedChannelsSelector = (store: any) => store.ChannelReducer.searchedChannels
export const searchedChannelsForForwardSelector = (store: any) => store.ChannelReducer.searchedChannelsForForward
export const closeSearchChannelSelector = (store: any) => store.ChannelReducer.closeSearchChannel
export const channelsForForwardSelector = (store: any) => store.ChannelReducer.channelsForForward
export const deletedChannelSelector = (store: any) => store.ChannelReducer.deletedChannel
export const addedChannelSelector = (store: any) => store.ChannelReducer.addedChannel
export const addedToChannelSelector = (store: any) => store.ChannelReducer.addedToChannel
export const hiddenChannelSelector = (store: any) => store.ChannelReducer.hiddenChannel
export const visibleChannelSelector = (store: any) => store.ChannelReducer.visibleChannel
export const activeChannelSelector = (store: any) => store.ChannelReducer.activeChannel
export const channelsLoadingState = (store: any) => store.ChannelReducer.channelsLoadingState
export const channelsLoadingStateForForwardSelector = (store: any) =>
  store.ChannelReducer.channelsForForwardLoadingState
export const channelsHasNextSelector = (store: any) => store.ChannelReducer.channelsHasNext
export const channelsForForwardHasNextSelector = (store: any) => store.ChannelReducer.channelsForForwardHasNext
export const searchValueSelector = (store: any) => store.ChannelReducer.searchValue
export const channelInfoIsOpenSelector = (store: any) => store.ChannelReducer.channelInfoIsOpen
export const channelEditModeSelector = (store: any) => store.ChannelReducer.channelEditMode
export const typingOrRecordingIndicatorArraySelector = (channelId: string) => (store: any) =>
  store.ChannelReducer.typingOrRecordingIndicator[channelId]

export const channelListWidthSelector = (store: any) => store.ChannelReducer.channelListWidth
export const channelListHiddenSelector = (store: any) => store.ChannelReducer.hideChannelList
export const isDraggingSelector = (store: any) => store.ChannelReducer.isDragging
export const draggedAttachmentsSelector = (store: any) => store.ChannelReducer.draggedAttachments
export const tabIsActiveSelector = (store: any) => store.ChannelReducer.tabIsActive
export const channelMessageDraftIsRemovedSelector = (store: any) => store.ChannelReducer.draftIsRemoved
export const channelInviteKeysSelector = (store: any) => store.ChannelReducer.channelInviteKeys
export const joinableChannelSelector = (store: any) => store.ChannelReducer.joinableChannel
