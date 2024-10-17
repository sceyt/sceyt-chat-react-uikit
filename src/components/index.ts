import SceytChat, { SceytChatUIKitTheme, ThemeMode } from './ChatContainer'
import ChannelList from './ChannelList'
import Channel from './Channel'
import Chat from './Chat'
import ChatHeader from './ChatHeader'
import MessageList from './Messages'
import SendMessage from './SendMessageInput'
import ChannelDetails from './ChannelDetailsContainer'
import MessagesScrollToBottomButton from './MessagesScrollToBottomButton'
import CreateChannel from './../common/popups/createChannel'
import ChannelSearch from './ChannelList/ChannelSearch'
import Avatar from './Avatar'
import Attachment from './Attachment'
import EmojisPopup from './Emojis'
import FrequentlyEmojis from './Emojis/frequentlyEmojis'
import DropDown from '../common/dropdown'
import { THEME_COLORS } from '../UIHelper/constants'

export {
  SceytChat,
  ChannelList,
  Channel,
  Chat,
  ChatHeader,
  MessageList,
  SendMessage,
  ChannelDetails,
  MessagesScrollToBottomButton,
  CreateChannel,
  ChannelSearch,
  Avatar,
  DropDown,
  Attachment,
  EmojisPopup,
  FrequentlyEmojis,
  SceytChatUIKitTheme,
  ThemeMode,
  THEME_COLORS
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
