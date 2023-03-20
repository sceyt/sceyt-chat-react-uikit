import SceytChat from './ChatContainer'
import ChannelList from './ChannelList'
import Chat from './Chat'
import ChatHeader from './ChatHeader'
import MessageList from './Messages'
import SendMessage from './SendMessageInput'
import ChannelDetails from './ChannelDetailsContainer'
import SceytChatHeader from './SceytChatHeader'
import MessagesScrollToBottomButton from './MessagesScrollToBottomButton'
import Avatar from './Avatar'

export {
  SceytChat,
  ChannelList,
  Chat,
  ChatHeader,
  MessageList,
  SendMessage,
  ChannelDetails,
  SceytChatHeader,
  MessagesScrollToBottomButton,
  Avatar
}

declare global {
  interface Window {
    sceytTabNotifications: any
    sceytTabUrl: any
  }
  interface Document {
    msHidden: any
    webkitHidden: any
  }
}
