export const hasSendableTextOrPoll = (messageText: string, isPoll: boolean) => Boolean(messageText.trim() || isPoll)
