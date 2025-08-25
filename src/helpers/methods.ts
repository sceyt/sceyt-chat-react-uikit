import { createChannelAC, switchChannelActionAC } from 'store/channel/actions'
import store from '../store'
import { DEFAULT_CHANNEL_TYPE } from './constants'
import { IChannel, IMessage } from 'types'
import { getMessageAC, sendTextMessageAC } from 'store/message/actions'

export const createOrGetDirectChannel = async (user?: any, callback?: (channel: IChannel) => void) => {
  if (user) {
    store.dispatch(
      createChannelAC(
        {
          metadata: '',
          type: DEFAULT_CHANNEL_TYPE.DIRECT,
          members: [
            {
              ...user,
              role: 'owner'
            }
          ]
        },
        true,
        callback
      )
    )
  }
}

export const switchChannelActiveChannel = async (channel: IChannel) => {
  store.dispatch(switchChannelActionAC(channel, true))
}

export const handleSendMessage = (message: IMessage, channelId: string, connectionState: string) => {
  return store.dispatch(sendTextMessageAC(message, channelId, connectionState))
}

export const handleGetMessage = (channelId: string, messageId: string) => {
  return store.dispatch(getMessageAC(channelId, messageId))
}
