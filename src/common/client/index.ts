import { cleanupOldMonthsMetadata } from '../../services/indexedDB/metadataService'

let SceytChatClient: any = {}
export const setClient = (client: any) => {
  SceytChatClient = client
  cleanupOldMonthsMetadata()
}

export const getClient = () => SceytChatClient
