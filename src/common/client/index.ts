let SceytChatClient: any = {}
export const setClient = (client: any) => {
  SceytChatClient = client
}

export const getClient = () => SceytChatClient
