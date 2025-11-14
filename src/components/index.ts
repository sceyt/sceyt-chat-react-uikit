import SceytChat, { SceytChatUIKitTheme, ThemeMode, IChatClientProps } from './ChatContainer'
import ChannelList from './ChannelList'
import Channel from './Channel'
import Chat from './Chat'
import ChatHeader from './ChatHeader'
import MessageList from './Messages'
import SendMessage from './SendMessageInput'
import ChannelDetails from './ChannelDetailsContainer'
import MessagesScrollToBottomButton from './MessagesScrollToBottomButton'
import MessagesScrollToUnreadMentionsButton from './MessagesScrollToUnreadMentionsButton'
import CreateChannel from './../common/popups/createChannel'
import ChannelSearch from './ChannelList/ChannelSearch'
import Avatar from './Avatar'
import Attachment from './Attachment'
import EmojisPopup from './Emojis'
import FrequentlyEmojis from './Emojis/frequentlyEmojis'
import DropDown from '../common/dropdown'
import { THEME_COLORS } from '../UIHelper/constants'
import { OGMetadata } from './Message/OGMetadata'
import PollMessage from './Message/PollMessage'
import {
  createOrGetDirectChannel,
  switchChannelActiveChannel,
  handleSendMessage,
  handleGetMessage
} from 'helpers/methods'
import { MESSAGE_TYPE } from 'types/enum'

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
  MessagesScrollToUnreadMentionsButton,
  CreateChannel,
  ChannelSearch,
  Avatar,
  DropDown,
  Attachment,
  PollMessage,
  OGMetadata,
  EmojisPopup,
  FrequentlyEmojis,
  SceytChatUIKitTheme,
  ThemeMode,
  IChatClientProps,
  THEME_COLORS,
  MESSAGE_TYPE,
  handleSendMessage,
  handleGetMessage,
  createOrGetDirectChannel,
  switchChannelActiveChannel
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
