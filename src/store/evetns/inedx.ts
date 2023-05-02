import { call, put, select, take } from 'redux-saga/effects'
import { eventChannel } from 'redux-saga'
import { getClient } from '../../common/client'
import { IChannel, IMarker, IMessage, IReaction, IUser } from '../../types'
import { CHANNEL_EVENT_TYPES } from '../channel/constants'
import {
  checkChannelExists,
  getActiveChannelId,
  getChannelFromMap,
  getLastChannelFromMap,
  removeChannelFromMap,
  setChannelInMap
} from '../../helpers/channelHalper'
import {
  addChannelAC,
  markMessagesAsDeliveredAC,
  removeChannelAC,
  setAddedToChannelAC,
  setChannelToAddAC,
  setChannelToHideAC,
  setChannelToRemoveAC,
  setChannelToUnHideAC,
  switchChannelActionAC,
  switchTypingIndicatorAC,
  updateChannelDataAC,
  updateChannelLastMessageAC,
  updateChannelLastMessageStatusAC
} from '../channel/actions'
import {
  addMessageAC,
  addReactionToMessageAC,
  clearMessagesAC,
  deleteReactionFromMessageAC,
  updateMessageAC,
  updateMessagesStatusAC
} from '../message/actions'
import { CONNECTION_EVENT_TYPES } from '../user/constants'
import { getContactsAC, setConnectionStatusAC } from '../user/actions'
import {
  addAllMessages,
  // addAllMessages,
  addMessageToMap,
  addReactionOnAllMessages,
  addReactionToMessageOnMap,
  checkChannelExistsOnMessagesMap,
  getHasNextCached,
  getMessagesFromMap,
  MESSAGE_LOAD_DIRECTION,
  removeAllMessages,
  removeMessagesFromMap,
  removeReactionOnAllMessages,
  removeReactionToMessageOnMap,
  updateMarkersOnAllMessages,
  updateMessageOnAllMessages,
  // MESSAGE_LOAD_DIRECTION,
  updateMessageOnMap,
  updateMessageStatusOnMap
} from '../../helpers/messagesHalper'
import { setNotification } from '../../helpers/notifications'
import { addMembersToListAC, removeMemberFromListAC, updateMembersAC } from '../member/actions'
import { MessageTextFormat } from '../../helpers'
import { contactsMapSelector } from '../user/selector'
import { getShowOnlyContactUsers } from '../../helpers/contacts'

export default function* watchForEvents(): any {
  const SceytChatClient = getClient()
  const channelListener = new (SceytChatClient.ChannelListener as any)()
  const connectionListener = new (SceytChatClient.ConnectionListener as any)()
  const typingUsersTimeout: { [key: string]: any } = {}
  const chan = eventChannel((emitter) => {
    channelListener.onCreated = (createdChannel: IChannel) => {
      emitter({
        type: CHANNEL_EVENT_TYPES.CREATE,
        args: {
          createdChannel
        }
      })
    }
    channelListener.onMemberJoined = (channel: IChannel, joinedMember: IUser) =>
      emitter({
        type: CHANNEL_EVENT_TYPES.JOIN,
        args: {
          channel,
          joinedMember
        }
      })
    channelListener.onMemberLeft = (channel: IChannel, member: IUser) =>
      emitter({
        type: CHANNEL_EVENT_TYPES.LEAVE,
        args: {
          channel,
          member
        }
      })
    channelListener.onBlocked = (channel: IChannel) =>
      emitter({
        type: CHANNEL_EVENT_TYPES.BLOCK,
        args: {
          channel
        }
      })
    channelListener.onUnblocked = (channel: IChannel) =>
      emitter({
        type: CHANNEL_EVENT_TYPES.UNBLOCK,
        args: {
          channel
        }
      })
    channelListener.onMembersAdded = ({ channel, addedMembers }: { channel: IChannel; addedMembers: IUser[] }) =>
      emitter({
        type: CHANNEL_EVENT_TYPES.ADD_MEMBERS,
        args: {
          channel,
          addedMembers
        }
      })
    channelListener.onMembersKicked = ({ channel, removedMembers }: { channel: IChannel; removedMembers: IUser[] }) =>
      emitter({
        type: CHANNEL_EVENT_TYPES.KICK_MEMBERS,
        args: {
          channel,
          removedMembers
        }
      })
    channelListener.onUpdated = (updatedChannel: IChannel) =>
      emitter({
        type: CHANNEL_EVENT_TYPES.UPDATE_CHANNEL,
        args: {
          updatedChannel
        }
      })
    channelListener.onMessage = (channel: IChannel, message: IMessage) =>
      emitter({
        type: CHANNEL_EVENT_TYPES.MESSAGE,
        args: {
          channel,
          message
        }
      })
    channelListener.onDeleted = (channelId: string) =>
      emitter({
        type: CHANNEL_EVENT_TYPES.DELETE,
        args: {
          channelId
        }
      })
    channelListener.onMessageEdited = (channel: IChannel, user: IUser, message: IMessage) =>
      emitter({
        type: CHANNEL_EVENT_TYPES.EDIT_MESSAGE,
        args: {
          channel,
          user,
          message
        }
      })
    channelListener.onMessageDeleted = (channel: IChannel, user: IUser, deletedMessage: IMessage) =>
      emitter({
        type: CHANNEL_EVENT_TYPES.DELETE_MESSAGE,
        args: {
          channel,
          user,
          deletedMessage
        }
      })
    channelListener.onReactionAdded = (channel: IChannel, user: IUser, message: IMessage, reaction: IReaction) =>
      emitter({
        type: CHANNEL_EVENT_TYPES.REACTION_ADDED,
        args: {
          channel,
          user,
          message,
          reaction
        }
      })
    channelListener.onReactionDeleted = (channel: IChannel, user: IUser, message: IMessage, reaction: IReaction) =>
      emitter({
        type: CHANNEL_EVENT_TYPES.REACTION_DELETED,
        args: {
          channel,
          user,
          message,
          reaction
        }
      })
    channelListener.onMemberStartedTyping = (channel: IChannel, from: IUser) =>
      emitter({
        type: CHANNEL_EVENT_TYPES.START_TYPING,
        args: {
          channel,
          from
        }
      })
    channelListener.onMemberStoppedTyping = (channel: IChannel, from: IUser) =>
      emitter({
        type: CHANNEL_EVENT_TYPES.STOP_TYPING,
        args: {
          channel,
          from
        }
      })
    channelListener.onReceivedMessageListMarker = (channelId: string, markerList: IMarker[]) =>
      emitter({
        type: CHANNEL_EVENT_TYPES.MESSAGE_MARKERS_RECEIVED,
        args: {
          channelId,
          markerList
        }
      })
    channelListener.onTotalUnreadCountUpdated = (
      channel: IChannel,
      unreadChannels: number,
      totalUnread: number,
      channelUnreadCount: number
    ) =>
      emitter({
        type: CHANNEL_EVENT_TYPES.UNREAD_MESSAGES_INFO,
        args: {
          channel,
          unreadChannels,
          totalUnread,
          channelUnreadCount
        }
      })
    channelListener.onHidden = (channel: IChannel) =>
      emitter({
        type: CHANNEL_EVENT_TYPES.HIDE,
        args: {
          channel
        }
      })
    channelListener.onMuted = (channel: IChannel) =>
      emitter({
        type: CHANNEL_EVENT_TYPES.MUTE,
        args: {
          channel
        }
      })
    channelListener.onUnmuted = (channel: IChannel) =>
      emitter({
        type: CHANNEL_EVENT_TYPES.UNMUTE,
        args: {
          channel
        }
      })
    channelListener.onShown = (channel: IChannel) =>
      emitter({
        type: CHANNEL_EVENT_TYPES.UNHIDE,
        args: {
          channel
        }
      })
    /* connectionListener.onTokenWillExpire = (expireTime: number) =>
      emitter({
        type: CONNECTION_EVENT_TYPES.TOKEN_WILL_EXPIRE,
        args: {
          expireTime
        }
      })
    connectionListener.onTokenExpired = (message: IMessage) =>
      emitter({
        type: CONNECTION_EVENT_TYPES.TOKEN_EXPIRED,
        args: {
          message
        }
      }) */
    connectionListener.onConnectionStateChanged = (status: string) =>
      emitter({
        type: CONNECTION_EVENT_TYPES.CONNECTION_STATUS_CHANGED,
        args: {
          status
        }
      })
    channelListener.onMarkedAsUnread = (channel: IChannel) =>
      emitter({
        type: CHANNEL_EVENT_TYPES.CHANNEL_MARKED_AS_UNREAD,
        args: {
          channel
        }
      })
    channelListener.onMarkedAsRead = (channel: IChannel) =>
      emitter({
        type: CHANNEL_EVENT_TYPES.CHANNEL_MARKED_AS_READ,
        args: {
          channel
        }
      })
    channelListener.onHistoryCleared = (channel: IChannel) =>
      emitter({
        type: CHANNEL_EVENT_TYPES.CLEAR_HISTORY,
        args: {
          channel
        }
      })
    channelListener.onDeletedAllMessages = (channel: IChannel) =>
      emitter({
        type: CHANNEL_EVENT_TYPES.CLEAR_HISTORY,
        args: {
          channel
        }
      })
    channelListener.onMembersRoleChanged = (channel: IChannel, members: IUser[]) =>
      emitter({
        type: CHANNEL_EVENT_TYPES.CHANGE_ROLE,
        args: {
          channel,
          members
        }
      })
    channelListener.onOwnerChanged = (channel: IChannel, newOwner: IUser, oldOwner: IUser) =>
      emitter({
        type: CHANNEL_EVENT_TYPES.CHANGE_OWNER,
        args: {
          channel,
          newOwner,
          oldOwner
        }
      })
    channelListener.onMembersBlocked = (channel: IChannel, removedMembers: IUser[]) =>
      emitter({
        type: CHANNEL_EVENT_TYPES.MEMBER_BLOCKED,
        args: {
          channel,
          removedMembers
        }
      })
    channelListener.onMembersUnblocked = (channel: IChannel, unblockedMembers: IUser[]) =>
      emitter({
        type: CHANNEL_EVENT_TYPES.MEMBER_UNBLOCKED,
        args: {
          channel,
          unblockedMembers
        }
      })
    SceytChatClient.addChannelListener('CHANNEL_EVENTS', channelListener)
    SceytChatClient.addConnectionListener('CONNECTION_EVENTS', connectionListener)

    return () => {
      SceytChatClient.removeChannelListener('CHANNEL_EVENTS')
      SceytChatClient.removeConnectionListener('CONNECTION_EVENTS')
    }
  })

  while (true) {
    const { type, args } = yield take(chan)
    switch (type) {
      case CHANNEL_EVENT_TYPES.CREATE: {
        const { createdChannel } = args
        console.log('CHANNEL_EVENT_CREATE ... ', createdChannel)
        const channelExists = checkChannelExists(createdChannel.id)
        if (!channelExists) {
          yield put(getContactsAC())
          yield call(setChannelInMap, createdChannel)
          yield put(setChannelToAddAC(JSON.parse(JSON.stringify(createdChannel))))
        }
        break
      }
      case CHANNEL_EVENT_TYPES.JOIN: {
        // const { channel, joinedMember } = args
        const { channel } = args
        console.log('channel JOIN ... ', channel)
        const activeChannelId = yield call(getActiveChannelId)
        if (activeChannelId === channel.id) {
          // yield put(addMembersToListAC([joinedMember]));
        }

        // TODO notification
        /* const not = {
          id: createId(),
          title: 'Member Joined',
          message: `${joinedMember.firstName || joinedMember.id} joined to ${channel.subject}`,
        };
        yield put(setNotification(not)); */
        break
      }
      case CHANNEL_EVENT_TYPES.LEAVE: {
        // const { channel, member } = args
        console.log('channel LEAVE ... ')
        const { channel, member } = args

        const channelExists = checkChannelExists(channel.id)
        const activeChannelId = yield call(getActiveChannelId)
        if (activeChannelId === channel.id) {
          yield put(removeMemberFromListAC([member]))
        }
        if (channelExists) {
          yield put(
            updateChannelDataAC(channel.id, {
              memberCount: channel.memberCount
            })
          )
        }
        // TODO notification
        /* const not = {
          id: createId(),
          title: 'Member Leave',
          message: `${member.firstName || member.id} left from ${channel.subject}`,
        };
        yield put(setNotification(not)); */
        break
      }
      case CHANNEL_EVENT_TYPES.BLOCK: {
        console.log('channel BLOCK ... ')
        const { channel } = args
        const channelExists = checkChannelExists(channel.id)
        if (channelExists) {
          yield put(removeChannelAC(channel.id))
        }
        break
      }
      case CHANNEL_EVENT_TYPES.UNBLOCK: {
        console.log('channel UNBLOCK ... ')
        break
      }
      case CHANNEL_EVENT_TYPES.KICK_MEMBERS: {
        const { channel, removedMembers } = args
        console.log('channel KICK_MEMBERS ... ', removedMembers)
        const activeChannelId = yield call(getActiveChannelId)

        const channelExists = checkChannelExists(channel.id)

        if (channelExists) {
          if (removedMembers[0].id === SceytChatClient.user.id) {
            yield call(removeChannelFromMap, channel.id)
            yield put(removeChannelAC(channel.id))
            const activeChannel = yield call(getLastChannelFromMap)
            if (activeChannel) {
              yield put(switchChannelActionAC(JSON.parse(JSON.stringify(activeChannel))))
            }
          } else {
            if (activeChannelId === channel.id) {
              yield put(removeMemberFromListAC(removedMembers))
            }
            yield put(
              updateChannelDataAC(channel.id, {
                memberCount: channel.memberCount
              })
            )
          }
        }

        break
      }
      case CHANNEL_EVENT_TYPES.ADD_MEMBERS: {
        // const { channel, addedMembers } = args
        const { channel, addedMembers } = args
        console.log('channel ADD_MEMBERS ... ')
        const activeChannelId = yield call(getActiveChannelId)
        const channelExists = checkChannelExists(channel.id)
        if (channelExists) {
          if (activeChannelId === channel.id) {
            yield put(addMembersToListAC(addedMembers))
          }
          yield put(
            updateChannelDataAC(channel.id, {
              memberCount: channel.memberCount
            })
          )
        } else {
          yield call(setChannelInMap, channel)
          yield put(setAddedToChannelAC(JSON.parse(JSON.stringify(channel))))
        }
        break
      }
      case CHANNEL_EVENT_TYPES.UPDATE_CHANNEL: {
        const { updatedChannel } = args
        const channelExists = checkChannelExists(updatedChannel.id)
        if (channelExists) {
          const { subject, avatarUrl } = updatedChannel
          yield put(updateChannelDataAC(updatedChannel.id, { subject, avatarUrl }))
        }
        break
      }
      case CHANNEL_EVENT_TYPES.MESSAGE: {
        const { channel, message } = args
        console.log('channel MESSAGE ... ', message, channel)
        const activeChannelId = yield call(getActiveChannelId)
        const channelExists = checkChannelExists(channel.id)
        const channelForAdd = JSON.parse(JSON.stringify(channel))
        yield put(addChannelAC(channelForAdd))
        if (!channelExists) {
          yield call(setChannelInMap, channel)
        } else if (!message.repliedInThread) {
          yield put(updateChannelLastMessageAC(message, channelForAdd))
          yield put(updateChannelDataAC(message, channelForAdd))
        }
        if (channel.id === activeChannelId) {
          // TODO message for thread reply
          /* if (message.repliedInThread) {
            // const messageForThreadReply = yield select(messageForThreadReplySelector);
            let parentMessage;
            if (!messageForThreadReply) {
              const messageQueryBuilder = new sceytClient.MessageListQueryBuilder(channel.id);
              messageQueryBuilder.limit(1);
              const messageQuery = yield call(messageQueryBuilder.build);
              const { messages } = yield call(messageQuery.loadNearMessageId, message.parent.id);
              [parentMessage] = messages;
              yield put(setMessageForThreadReply(parentMessage));
            } else {
              parentMessage = messageForThreadReply;
            }
            yield put(addThreadReplyMessage(message));
            yield put(updateMessageAC(message.parent.id, { replyCount: parentMessage.replyCount }));
            yield put(updateMessageForThreadReply({ replyCount: parentMessage.replyCount }));
          } else { */
          if (!getHasNextCached()) {
            yield put(addMessageAC(message))
          }
          addAllMessages([message], MESSAGE_LOAD_DIRECTION.NEXT)
          // addAllMessages([message], MESSAGE_LOAD_DIRECTION.NEXT)
          // }
          if (message.user.id !== SceytChatClient.user.id) {
            // yield put(markMessagesAsReadAC(channel.id, [message.id]))
          }
        }

        if (getMessagesFromMap(channel.id) && getMessagesFromMap(channel.id).length) {
          addMessageToMap(channel.id, message)
        }

        yield put(
          updateChannelDataAC(channel.id, { ...channelForAdd, userMessageReactions: [], lastReactedMessage: null })
        )
        console.log('channel MESSAGE ... ', message)
        if (!message.silent && message.user.id !== SceytChatClient.user.id && !channel.muted) {
          if (Notification.permission === 'granted') {
            if (document.visibilityState !== 'visible' || channel.id !== activeChannelId) {
              const contactsMap = yield select(contactsMapSelector)
              const getFromContacts = getShowOnlyContactUsers()
              const messageBody = MessageTextFormat({
                text: message.body,
                message,
                contactsMap,
                getFromContacts,
                isLastMessage: false,
                isNotification: true
              })
              console.log('messageBody. . . . ', messageBody)
              setNotification(messageBody, message.user, channel)
            }
          }
          if (message.repliedInThread && message.parent.id) {
            yield put(markMessagesAsDeliveredAC(message.parent.id, [message.id]))
          } else {
            yield put(markMessagesAsDeliveredAC(channel.id, [message.id]))
          }
        }
        // TODO browser notification
        /* const notificationStatus = yield call(Notification.requestPermission);
        if (notificationStatus === 'granted' && document.visibilityState !== 'visible') {
          const notification = new Notification(`New Message from ${message.user.firstName}`,
          { body: message.body, icon: logo, silent: false });
          // notification.onclick = (event) => {
          //   event.preventDefault(); // prevent the browser from focusing the Notification's tab
          //   window.open(window.sceytTabUrl, '_blank');
          //   notification.close();
          // };
          if (window.sceytTabNotifications) {
            window.sceytTabNotifications.close();
          }
          window.sceytTabNotifications = notification;
        } */
        break
      }
      case CHANNEL_EVENT_TYPES.MESSAGE_MARKERS_RECEIVED: {
        const { channelId, markerList } = args
        console.log('channel MESSAGE_MARKERS_RECEIVED ...', channelId, markerList)
        const channel = yield call(getChannelFromMap, channelId)
        if (channel) {
          const activeChannelId = yield call(getActiveChannelId)
          const lastMessage = {
            ...channel.lastMessage,
            deliveryStatus: markerList.name
          }
          let updateLastMessage = false
          markerList.messageIds.forEach((messageId: string) => {
            if (channel.lastMessage && messageId === channel.lastMessage.id) {
              updateLastMessage = true
            }
          })
          if (updateLastMessage) {
            yield put(updateChannelLastMessageStatusAC(lastMessage, JSON.parse(JSON.stringify(channel))))
          }

          const markersMap: any = {}
          markerList.messageIds.forEach((messageId: string) => (markersMap[messageId] = true))
          if (activeChannelId === channelId) {
            yield put(updateMessagesStatusAC(markerList.name, markersMap))
            updateMarkersOnAllMessages(markersMap, markerList.name)
          }

          updateMessageStatusOnMap(channel.id, { name: markerList.name, markersMap })
        }
        break
      }
      /* case CHANNEL_EVENT_TYPES.MESSAGE_AS_READ: {
        const { channel } = args;
        const channelExists = checkChannelExists(channel.id);
        const activeChannelId = yield call(getActiveChannelId);
        const lastMessage = { ...channel.lastMessage, deliveryStatus: MESSAGE_DELIVERY_STATUS.READ };

        if (activeChannelId === channel.id) {
          yield put(updateMessagesStatusAC(MESSAGE_DELIVERY_STATUS.READ));
        }
        if (channelExists) {
          yield put(updateChannelLastMessageStatus(lastMessage, channel));
          // use updateChannelDataAC instead

          // yield put(setChannelUnreadCount(channel.unreadMessageCount, channel.id));
          yield put(updateChannelDataAC(channel.id, { unreadMessageCount: channel.unreadMessageCount }));
        }
        break;
      } */
      case CHANNEL_EVENT_TYPES.START_TYPING: {
        const { channel, from } = args
        if (typingUsersTimeout[from.id]) {
          clearTimeout(typingUsersTimeout[from.id])
        }
        typingUsersTimeout[from.id] = setTimeout(() => {
          channelListener.onMemberStoppedTyping(channel, from)
        }, 4000)
        yield put(switchTypingIndicatorAC(true, channel.id, from))
        // }
        break
      }
      case CHANNEL_EVENT_TYPES.STOP_TYPING: {
        const { channel, from } = args
        if (typingUsersTimeout[from.id]) {
          clearTimeout(typingUsersTimeout[from.id])
        }
        yield put(switchTypingIndicatorAC(false, channel.id, from))
        break
      }
      case CHANNEL_EVENT_TYPES.DELETE: {
        const { channelId } = args
        console.log('channel DELETE ... ')
        const activeChannelId = yield call(getActiveChannelId)
        const channel = getChannelFromMap(channelId)

        if (channel) {
          yield put(removeChannelAC(channelId))
          yield call(removeChannelFromMap, channelId)
        }

        yield put(setChannelToRemoveAC(channel))
        if (activeChannelId === channelId) {
          const activeChannel = yield call(getLastChannelFromMap)
          yield put(switchChannelActionAC(JSON.parse(JSON.stringify(activeChannel))))
        }
        break
      }
      case CHANNEL_EVENT_TYPES.DELETE_MESSAGE: {
        const { channel, /* user, */ deletedMessage } = args
        const activeChannelId = getActiveChannelId()
        console.log('channel DELETE_MESSAGE ... ')
        const channelExists = checkChannelExists(channel.id)

        if (channel.id === activeChannelId) {
          updateMessageOnAllMessages(deletedMessage.id, deletedMessage)
          yield put(updateMessageAC(deletedMessage.id, deletedMessage))
        }
        updateMessageOnMap(channel.id, {
          messageId: deletedMessage.id,
          params: deletedMessage
        })
        if (channelExists) {
          yield put(
            updateChannelDataAC(channel.id, {
              unreadMessageCount: channel.unreadMessageCount
            })
          )
          if (channel.lastMessage.id === deletedMessage.id) {
            yield put(updateChannelLastMessageAC(deletedMessage, channel))
          }
        }
        break
      }
      case CHANNEL_EVENT_TYPES.EDIT_MESSAGE: {
        const { channel, /* user, */ message } = args
        console.log('channel EDIT_MESSAGE ... ')
        const activeChannelId = getActiveChannelId()
        const channelExists = checkChannelExists(channel.id)
        if (channel.id === activeChannelId) {
          yield put(
            updateMessageAC(message.id, {
              body: message.body,
              state: message.state,
              attachments: message.attachments
            })
          )
        }
        if (channelExists) {
          if (channel.lastMessage.id === message.id) {
            yield put(updateChannelLastMessageAC(message, channel))
          }
        }
        if (checkChannelExistsOnMessagesMap(channel.id)) {
          updateMessageOnMap(channel.id, {
            messageId: message.id,
            params: message
          })
        }
        break
      }
      case CHANNEL_EVENT_TYPES.REACTION_ADDED: {
        const { channel, user, message, reaction } = args
        console.log('channel REACTION_ADDED ... ', args)
        const isSelf = user.id === SceytChatClient.user.id
        const activeChannelId = getActiveChannelId()

        if (channel.id === activeChannelId) {
          yield put(addReactionToMessageAC(message, reaction, isSelf))
          addReactionOnAllMessages(message, reaction, true)
        }
        if (message.user.id === SceytChatClient.user.id) {
          if (!isSelf && Notification.permission === 'granted') {
            if (document.visibilityState !== 'visible' || channel.id !== activeChannelId) {
              setNotification(message.body, reaction.user, channel, reaction.key)
            }
          }

          if (channel.userMessageReactions && channel.userMessageReactions.length) {
            const channelUpdateParams = {
              userMessageReactions: channel.userMessageReactions,
              lastReactedMessage: message
            }
            yield put(updateChannelDataAC(channel.id, channelUpdateParams))
          }
        }

        if (checkChannelExistsOnMessagesMap(channel.id)) {
          addReactionToMessageOnMap(channel.id, message, reaction, true)
        }
        break
      }
      case CHANNEL_EVENT_TYPES.REACTION_DELETED: {
        const { channel, user, message, reaction } = args
        console.log('channel REACTION_DELETED ... ')
        const isSelf = user.id === SceytChatClient.user.id
        const activeChannelId = getActiveChannelId()

        if (channel.id === activeChannelId) {
          yield put(deleteReactionFromMessageAC(message, reaction, isSelf))
          removeReactionOnAllMessages(message, reaction, true)
        }
        if (!(channel.userMessageReactions && channel.userMessageReactions.length)) {
          const channelUpdateParams = {
            userMessageReactions: [],
            lastReactedMessage: null
          }
          yield put(updateChannelDataAC(channel.id, channelUpdateParams))
        }
        if (checkChannelExistsOnMessagesMap(channel.id)) {
          removeReactionToMessageOnMap(channel.id, message, reaction, true)
        }
        break
      }

      case CHANNEL_EVENT_TYPES.UNREAD_MESSAGES_INFO: {
        // const { channel, unreadChannels, totalUnread, channelUnreadCount } = args
        const { channel, channelUnreadCount } = args
        console.log('channel UNREAD_MESSAGES_INFO .', channelUnreadCount)

        // yield put(setChannelUnreadCount(0, channel.id));
        const updatedChannel = JSON.parse(JSON.stringify(channel))
        yield put(updateChannelDataAC(channel.id, updatedChannel))
        break
      }

      case CHANNEL_EVENT_TYPES.CLEAR_HISTORY: {
        const { channel } = args
        console.log('CLEAR_HISTORY: ', channel)
        const activeChannelId = yield call(getActiveChannelId)
        const channelExist = yield call(checkChannelExists, channel.id)
        if (channel.id === activeChannelId) {
          yield put(clearMessagesAC())
          removeAllMessages()
        }
        removeMessagesFromMap(channel.id)
        if (channelExist) {
          yield put(updateChannelDataAC(channel.id, { lastMessage: {}, unreadMessageCount: 0 }))
        }

        break
      }
      case CHANNEL_EVENT_TYPES.MUTE: {
        const { channel } = args
        console.log('channel MUTE ... ')

        yield put(
          updateChannelDataAC(channel.id, {
            muted: channel.muted,
            muteExpireDate: channel.muteExpireDate
          })
        )

        break
      }
      case CHANNEL_EVENT_TYPES.UNMUTE: {
        const { channel } = args
        console.log('channel UNMUTE ... ')

        yield put(
          updateChannelDataAC(channel.id, {
            muted: channel.muted,
            muteExpireDate: channel.muteExpireDate
          })
        )

        break
      }
      case CHANNEL_EVENT_TYPES.HIDE: {
        const { channel } = args
        console.log('channel HIDE ... ')
        yield put(setChannelToHideAC(channel))
        break
      }
      case CHANNEL_EVENT_TYPES.UNHIDE: {
        const { channel } = args
        console.log('channel UNHIDE ... ')
        yield put(setChannelToUnHideAC(channel))
        break
      }
      case CHANNEL_EVENT_TYPES.CHANNEL_MARKED_AS_UNREAD: {
        const { channel } = args
        // console.log('channel CHANNEL_MARKED_AS_UNREAD ... ', channel)
        yield put(updateChannelDataAC(channel.id, { markedAsUnread: channel.markedAsUnread }))
        break
      }
      case CHANNEL_EVENT_TYPES.CHANNEL_MARKED_AS_READ: {
        const { channel } = args
        // console.log('channel CHANNEL_MARKED_AS_READ ... ', channel)
        yield put(updateChannelDataAC(channel.id, { markedAsUnread: channel.markedAsUnread }))
        break
      }
      /*
      case CHANNEL_EVENT_TYPES.CHANGE_OWNER: {
          const { channel, newOwner, oldOwner } = args;
          antMessage.success(
              `in the ${
                  channel
                      ? channel.subject ||
                      (channel.pear && channel.pear.firstName) ||
                      (channel.pear && channel.pear.id) ||
                      channel.label
                      : channel.id
              } owner was changed from ${oldOwner.firstName ||
              oldOwner.id} to  ${newOwner.firstName ||
              newOwner.id} channel   was appointed owner`,
          );
          break;
      } */
      case CHANNEL_EVENT_TYPES.CHANGE_ROLE: {
        const { channel, members } = args
        console.log('channel CHANGE_ROLE  channel ... ', channel)
        console.log('channel CHANGE_ROLE  member ... ', members)
        const activeChannelId = yield call(getActiveChannelId)
        if (channel.id === activeChannelId) {
          yield put(updateMembersAC(members))
        }
        for (let i = 0; i < members.length; i++) {
          if (members[i].id === SceytChatClient.user.id) {
            yield put(updateChannelDataAC(channel.id, { role: members[i].role }))
          }
        }
        break
      }
      /* case CHANNEL_EVENT_TYPES.MEMBER_BLOCKED: {
                const { channel, removedMembers } = args;
                antMessage.success(
                    `${removedMembers[0].firstName ||
                    removedMembers[0].id} blocked from the ${
                        channel
                            ? channel.subject ||
                            (channel.pear && channel.pear.firstName) ||
                            (channel.pear && channel.pear.id) ||
                            channel.label
                            : channel.id
                    } channel`,
                );
                break;
            }
            case CHANNEL_EVENT_TYPES.MEMBER_UNBLOCKED: {
                const { channel, unblockedMembers } = args;
                antMessage.success(
                    `${unblockedMembers[0].firstName ||
                    unblockedMembers[0].id} unBlocked from the ${
                        channel
                            ? channel.subject ||
                            (channel.pear && channel.pear.firstName) ||
                            (channel.pear && channel.pear.id) ||
                            channel.label
                            : channel.id
                    } channel`,
                );
                break;
            } */
      /* case CONNECTION_EVENT_TYPES.TOKEN_WILL_EXPIRE: {
        const { expireTime } = args
        console.log('user TOKEN_WILL_EXPIRE ... ', expireTime)
        break
      } */
      case CONNECTION_EVENT_TYPES.CONNECTION_STATUS_CHANGED: {
        const { status } = args
        yield put(setConnectionStatusAC(status))
        break
      }
      default:
        console.warn('UNHANDLED EVENT FROM REDUX-SAGA EVENT-CHANNEL')
    }
  }
}