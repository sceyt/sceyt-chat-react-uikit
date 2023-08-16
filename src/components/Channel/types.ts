export interface IChannelsCustomColors {
  selectedChannelBackground?: string
}

export type ICustomAvatarColors = [string, string, string, string, string, string]

export interface ChannelQueryParams {
  filter?: { channelType?: string }
  limit?: number
  sort?: 'byLastMessage' | 'byCreationDate'
  search: string
}
