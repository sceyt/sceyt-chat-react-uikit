export const channelsSelector = (store: any) => store.ChannelReducer.channels
export const channelsForForwardSelector = (store: any) => store.ChannelReducer.channelsForForward
export const deletedChannelSelector = (store: any) => store.ChannelReducer.deletedChannel
export const addedChannelSelector = (store: any) => store.ChannelReducer.addedChannel
export const addedToChannelSelector = (store: any) => store.ChannelReducer.addedToChannel
export const hiddenChannelSelector = (store: any) => store.ChannelReducer.hiddenChannel
export const visibleChannelSelector = (store: any) => store.ChannelReducer.visibleChannel
export const activeChannelSelector = (store: any) => store.ChannelReducer.activeChannel
export const channelsLoadingState = (store: any) => store.ChannelReducer.channelsLoadingState
export const channelsHasNextSelector = (store: any) => store.ChannelReducer.channelsHasNext
export const channelsForForwardHasNextSelector = (store: any) => store.ChannelReducer.channelsForForwardHasNext
export const searchValueSelector = (store: any) => store.ChannelReducer.searchValue
export const channelInfoIsOpenSelector = (store: any) => store.ChannelReducer.channelInfoIsOpen
export const channelEditModeSelector = (store: any) => store.ChannelReducer.channelEditMode
export const typingIndicatorSelector = (channelId: string) => (store: any) =>
  store.ChannelReducer.typingIndicator[channelId]
export const channelListWidthSelector = (store: any) => store.ChannelReducer.channelListWidth
export const isDraggingSelector = (store: any) => store.ChannelReducer.isDragging
export const draggedAttachmentsSelector = (store: any) => store.ChannelReducer.draggedAttachments
