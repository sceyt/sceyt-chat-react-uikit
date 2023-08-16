import SceytChat from './ChatContainer'
import ChannelList from './ChannelList'
import Chat from './Chat'
import ChatHeader from './ChatHeader'
import MessageList from './Messages'
import SendMessage from './SendMessageInput'
import ChannelDetails from './ChannelDetailsContainer'
import MessagesScrollToBottomButton from './MessagesScrollToBottomButton'
import CreateChannel from './../common/popups/createChannel'
import ChannelSearch from './ChannelList/ChannelSearch'
import Avatar from './Avatar'
import DropDown from '../common/dropdown'

export {
  SceytChat,
  ChannelList,
  Chat,
  ChatHeader,
  MessageList,
  SendMessage,
  ChannelDetails,
  MessagesScrollToBottomButton,
  CreateChannel,
  ChannelSearch,
  Avatar,
  DropDown
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
