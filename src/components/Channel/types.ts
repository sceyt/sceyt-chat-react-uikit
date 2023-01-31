export interface ICustomColors {
  selectedChannelBackground?: string,
  selectedChannelLeftBorder?: string,
}

export type ICustomAvatarColors = [string, string, string, string, string, string]

export interface ChannelQueryParams {
  filter?: { channelType: 'Public' | 'Private' | 'Direct' },
  limit?: number,
  sort?: 'byLastMessage' | 'byCreationDate',
  search: string,
  /* search?: {
    /!*directChannel?: {
      user: 'beginsWith' | 'equals' | 'contains',
      label: 'labelEquals'
    },
    publicChannel?: {
      subject: 'subjectBeginsWith' | 'subjectEquals' | 'subjectContains',
      uri: 'beginsWith' | 'equals' | 'contains',
      label: 'equals',
    },
    privateChannel?: {
      subject: 'subjectBeginsWith' | 'subjectEquals' | 'subjectContains',
      label: 'equals',
    },*!/
    text: ''
  }, */
}
