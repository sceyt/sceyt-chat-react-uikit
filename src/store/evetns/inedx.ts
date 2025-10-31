import { call, put, select, take } from 'redux-saga/effects'
import { eventChannel } from 'redux-saga'
import { getClient } from '../../common/client'
import { IAttachment, IChannel, IMarker, IMember, IMessage, IReaction, IUser } from '../../types'
import { CHANNEL_EVENT_TYPES } from '../channel/constants'
import {
  addChannelToAllChannels,
  checkChannelExists,
  deleteChannelFromAllChannels,
  getActiveChannelId,
  getChannelFromAllChannels,
  getChannelFromMap,
  getChannelGroupName,
  getChannelTypesFilter,
  getLastChannelFromMap,
  handleNewMessages,
  removeChannelFromMap,
  setChannelInMap,
  updateChannelLastMessageOnAllChannels,
  updateChannelOnAllChannels
} from '../../helpers/channelHalper'
import {
  addChannelAC,
  markMessagesAsDeliveredAC,
  removeChannelAC,
  setActiveChannelAC,
  setAddedToChannelAC,
  setChannelToAddAC,
  setChannelToHideAC,
  setChannelToRemoveAC,
  setChannelToUnHideAC,
  switchChannelActionAC,
  switchRecordingIndicatorAC,
  switchTypingIndicatorAC,
  updateChannelDataAC,
  updateChannelLastMessageAC,
  updateChannelLastMessageStatusAC,
  updateSearchedChannelDataAC
} from '../channel/actions'
import {
  addMessageAC,
  addReactionToMessageAC,
  clearMessagesAC,
  deleteReactionFromMessageAC,
  scrollToNewMessageAC,
  updateMessageAC,
  updateMessagesMarkersAC,
  updateMessagesStatusAC
} from '../message/actions'
import { CONNECTION_EVENT_TYPES, CONNECTION_STATUS } from '../user/constants'
import { getContactsAC, setConnectionStatusAC } from '../user/actions'
import {
  addAllMessages,
  addMessageToMap,
  addReactionOnAllMessages,
  addReactionToMessageOnMap,
  checkChannelExistsOnMessagesMap,
  getHasNextCached,
  getMessageFromPendingMessagesMap,
  getMessagesFromMap,
  MESSAGE_LOAD_DIRECTION,
  removeAllMessages,
  removeMessagesFromMap,
  removePendingMessageFromMap,
  removeReactionOnAllMessages,
  removeReactionToMessageOnMap,
  updateMarkersOnAllMessages,
  updateMessageOnAllMessages,
  updateMessageOnMap,
  updateMessageStatusOnMap,
  updatePendingMessageOnMap
} from '../../helpers/messagesHalper'
import { getShowNotifications, setNotification } from '../../helpers/notifications'
import { addMembersToListAC, getRolesAC, removeMemberFromListAC, updateMembersAC } from '../member/actions'
import { browserTabIsActiveSelector, contactsMapSelector } from '../user/selector'
import { getShowOnlyContactUsers } from '../../helpers/contacts'
import { attachmentTypes, MESSAGE_DELIVERY_STATUS } from '../../helpers/constants'
import { MessageTextFormat } from '../../messageUtils'
import { isJSON } from '../../helpers/message'
import log from 'loglevel'
import store from 'store'
import { updateActiveChannelMembersAdd, updateActiveChannelMembersRemove } from '../member/helpers'

export default function* watchForEvents(): any {
  const SceytChatClient = getClient()
  const channelListener = new (SceytChatClient.ChannelListener as any)()
  const connectionListener = new (SceytChatClient.ConnectionListener as any)()
  const usersTimeout: { [key: string]: any } = {}
  const chan = eventChannel((emitter) => {
    const shouldSkip = (channel: IChannel) => {
      const channelTypesFilter = getChannelTypesFilter()
      return !(
        !channelTypesFilter ||
        !channelTypesFilter?.length ||
        channelTypesFilter?.find((type) => channel.type === type)
      )
    }

    channelListener.onCreated = (createdChannel: IChannel) => {
      if (shouldSkip(createdChannel)) return
      emitter({
        type: CHANNEL_EVENT_TYPES.CREATE,
        args: {
          createdChannel
        }
      })
    }
    channelListener.onMemberJoined = (channel: IChannel, joinedMember: IUser) => {
      if (shouldSkip(channel)) return
      emitter({
        type: CHANNEL_EVENT_TYPES.JOIN,
        args: {
          channel,
          joinedMember
        }
      })
    }
    channelListener.onMemberLeft = (channel: IChannel, member: IUser) => {
      if (shouldSkip(channel)) return
      emitter({
        type: CHANNEL_EVENT_TYPES.LEAVE,
        args: {
          channel,
          member
        }
      })
    }
    channelListener.onBlocked = (channel: IChannel) => {
      if (shouldSkip(channel)) return
      emitter({
        type: CHANNEL_EVENT_TYPES.BLOCK,
        args: {
          channel
        }
      })
    }
    channelListener.onUnblocked = (channel: IChannel) => {
      if (shouldSkip(channel)) return
      emitter({
        type: CHANNEL_EVENT_TYPES.UNBLOCK,
        args: {
          channel
        }
      })
    }
    channelListener.onMembersAdded = ({ channel, addedMembers }: { channel: IChannel; addedMembers: IUser[] }) => {
      if (shouldSkip(channel)) return
      emitter({
        type: CHANNEL_EVENT_TYPES.ADD_MEMBERS,
        args: {
          channel,
          addedMembers
        }
      })
    }
    channelListener.onMembersKicked = ({ channel, removedMembers }: { channel: IChannel; removedMembers: IUser[] }) => {
      if (shouldSkip(channel)) return
      emitter({
        type: CHANNEL_EVENT_TYPES.KICK_MEMBERS,
        args: {
          channel,
          removedMembers
        }
      })
    }
    channelListener.onUpdated = (updatedChannel: IChannel) => {
      if (shouldSkip(updatedChannel)) return
      emitter({
        type: CHANNEL_EVENT_TYPES.UPDATE_CHANNEL,
        args: {
          updatedChannel
        }
      })
    }
    channelListener.onMessage = (channel: IChannel, message: IMessage) => {
      if (shouldSkip(channel)) return
      emitter({
        type: CHANNEL_EVENT_TYPES.MESSAGE,
        args: {
          channel,
          message
        }
      })
    }
    channelListener.onDeleted = (channelId: string) =>
      emitter({
        type: CHANNEL_EVENT_TYPES.DELETE,
        args: {
          channelId
        }
      })
    channelListener.onMessageEdited = (channel: IChannel, user: IUser, message: IMessage) => {
      if (shouldSkip(channel)) return
      emitter({
        type: CHANNEL_EVENT_TYPES.EDIT_MESSAGE,
        args: {
          channel,
          user,
          message
        }
      })
    }
    channelListener.onMessageDeleted = (channel: IChannel, user: IUser, deletedMessage: IMessage) => {
      if (shouldSkip(channel)) return
      emitter({
        type: CHANNEL_EVENT_TYPES.DELETE_MESSAGE,
        args: {
          channel,
          user,
          deletedMessage
        }
      })
    }
    channelListener.onReactionAdded = (channel: IChannel, user: IUser, message: IMessage, reaction: IReaction) => {
      if (shouldSkip(channel)) return
      emitter({
        type: CHANNEL_EVENT_TYPES.REACTION_ADDED,
        args: {
          channel,
          user,
          message,
          reaction
        }
      })
    }
    channelListener.onPollAdded = (channel: IChannel, message: IMessage, user: IUser) => {
      if (shouldSkip(channel)) return
      emitter({
        type: CHANNEL_EVENT_TYPES.POLL_ADDED,
        args: {
          channel,
          message,
          user
        }
      })
    }
    channelListener.onPollRetracted = (channel: IChannel, message: IMessage, user: IUser) => {
      if (shouldSkip(channel)) return
      emitter({
        type: CHANNEL_EVENT_TYPES.POLL_RETRACTED,
        args: {
          channel,
          message,
          user
        }
      })
    }
    channelListener.onPollDeleted = (channel: IChannel, message: IMessage, user: IUser) => {
      if (shouldSkip(channel)) return
      emitter({
        type: CHANNEL_EVENT_TYPES.POLL_DELETED,
        args: {
          channel,
          message,
          user
        }
      })
    }
    channelListener.onPollClosed = (channel: IChannel, message: IMessage, user: IUser) => {
      if (shouldSkip(channel)) return
      emitter({
        type: CHANNEL_EVENT_TYPES.POLL_CLOSED,
        args: {
          channel,
          message,
          user
        }
      })
    }
    channelListener.onReactionDeleted = (channel: IChannel, user: IUser, message: IMessage, reaction: IReaction) => {
      if (shouldSkip(channel)) return
      emitter({
        type: CHANNEL_EVENT_TYPES.REACTION_DELETED,
        args: {
          channel,
          user,
          message,
          reaction
        }
      })
    }
    channelListener.onReceivedMessageListMarker = (channelId: string, markerList: IMarker[]) =>
      emitter({
        type: CHANNEL_EVENT_TYPES.MESSAGE_MARKERS_RECEIVED,
        args: {
          channelId,
          markerList
        }
      })
    channelListener.onTotalUnreadCountUpdated = (
      unreadChannels: number,
      totalUnread: number,
      channel: IChannel,
      channelUnreadCount: number,
      channelUnreadMentions: number,
      channelUnreadReactions: number
    ) => {
      if (channel && shouldSkip(channel)) return
      emitter({
        type: CHANNEL_EVENT_TYPES.UNREAD_MESSAGES_INFO,
        args: {
          unreadChannels,
          totalUnread,
          channel,
          channelUnreadCount,
          channelUnreadMentions,
          channelUnreadReactions
        }
      })
    }
    channelListener.onHidden = (channel: IChannel) => {
      if (shouldSkip(channel)) return
      emitter({
        type: CHANNEL_EVENT_TYPES.HIDE,
        args: {
          channel
        }
      })
    }
    channelListener.onMuted = (channel: IChannel) => {
      if (shouldSkip(channel)) return
      emitter({
        type: CHANNEL_EVENT_TYPES.MUTE,
        args: {
          channel
        }
      })
    }
    channelListener.onUnmuted = (channel: IChannel) => {
      if (shouldSkip(channel)) return
      emitter({
        type: CHANNEL_EVENT_TYPES.UNMUTE,
        args: {
          channel
        }
      })
    }
    channelListener.onPined = (channel: IChannel) => {
      if (shouldSkip(channel)) return
      emitter({
        type: CHANNEL_EVENT_TYPES.PINED,
        args: {
          channel
        }
      })
    }
    channelListener.onUnpined = (channel: IChannel) => {
      if (shouldSkip(channel)) return
      emitter({
        type: CHANNEL_EVENT_TYPES.UNPINED,
        args: {
          channel
        }
      })
    }
    channelListener.onShown = (channel: IChannel) => {
      if (shouldSkip(channel)) return
      emitter({
        type: CHANNEL_EVENT_TYPES.UNHIDE,
        args: {
          channel
        }
      })
    }
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
    channelListener.onMarkedAsUnread = (channel: IChannel) => {
      if (shouldSkip(channel)) return
      emitter({
        type: CHANNEL_EVENT_TYPES.CHANNEL_MARKED_AS_UNREAD,
        args: {
          channel
        }
      })
    }
    channelListener.onMarkedAsRead = (channel: IChannel) => {
      if (shouldSkip(channel)) return
      emitter({
        type: CHANNEL_EVENT_TYPES.CHANNEL_MARKED_AS_READ,
        args: {
          channel
        }
      })
    }
    channelListener.onHistoryCleared = (channel: IChannel) => {
      if (shouldSkip(channel)) return
      emitter({
        type: CHANNEL_EVENT_TYPES.CLEAR_HISTORY,
        args: {
          channel
        }
      })
    }
    channelListener.onDeletedAllMessages = (channel: IChannel) => {
      if (shouldSkip(channel)) return
      emitter({
        type: CHANNEL_EVENT_TYPES.CLEAR_HISTORY,
        args: {
          channel
        }
      })
    }
    channelListener.onMembersRoleChanged = (channel: IChannel, members: IUser[]) => {
      if (shouldSkip(channel)) return
      emitter({
        type: CHANNEL_EVENT_TYPES.CHANGE_ROLE,
        args: {
          channel,
          members
        }
      })
    }
    channelListener.onOwnerChanged = (channel: IChannel, newOwner: IUser, oldOwner: IUser) => {
      if (shouldSkip(channel)) return
      emitter({
        type: CHANNEL_EVENT_TYPES.CHANGE_OWNER,
        args: {
          channel,
          newOwner,
          oldOwner
        }
      })
    }
    channelListener.onMembersBlocked = (channel: IChannel, removedMembers: IUser[]) => {
      if (shouldSkip(channel)) return
      emitter({
        type: CHANNEL_EVENT_TYPES.MEMBER_BLOCKED,
        args: {
          channel,
          removedMembers
        }
      })
    }
    channelListener.onMembersUnblocked = (channel: IChannel, unblockedMembers: IUser[]) => {
      if (shouldSkip(channel)) return
      emitter({
        type: CHANNEL_EVENT_TYPES.MEMBER_UNBLOCKED,
        args: {
          channel,
          unblockedMembers
        }
      })
    }
    channelListener.onChannelFrozen = (channel: IChannel) => {
      if (shouldSkip(channel)) return
      emitter({
        type: CHANNEL_EVENT_TYPES.FROZEN,
        args: {
          channel
        }
      })
    }
    channelListener.onChannelUnfrozen = (channel: IChannel) => {
      if (shouldSkip(channel)) return
      emitter({
        type: CHANNEL_EVENT_TYPES.UNFROZEN,
        args: {
          channel
        }
      })
    }
    channelListener.onReceivedChannelEvent = (channelId: string, from: IUser, name: string) =>
      emitter({
        type: CHANNEL_EVENT_TYPES.CHANNEL_EVENT,
        args: {
          channelId,
          from,
          name
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
        log.info('CHANNEL_EVENT_CREATE ... ', createdChannel)
        const channelFilterTypes = getChannelTypesFilter()
        if (channelFilterTypes?.length ? channelFilterTypes.includes(createdChannel.type) : true) {
          const getFromContacts = getShowOnlyContactUsers()
          const channelExists = checkChannelExists(createdChannel.id)
          if (!channelExists) {
            if (getFromContacts) {
              yield put(getContactsAC())
            }
            yield call(setChannelInMap, createdChannel)
            yield put(setChannelToAddAC(JSON.parse(JSON.stringify(createdChannel))))
          }
          const chan = getChannelFromAllChannels(createdChannel.id)
          if (!chan) {
            addChannelToAllChannels(createdChannel)
          }
        }
        break
      }
      case CHANNEL_EVENT_TYPES.JOIN: {
        // const { channel, joinedMember } = args
        const { channel } = args
        log.info('channel JOIN ... . ', channel)
        const activeChannelId = yield call(getActiveChannelId)
        if (activeChannelId === channel.id) {
          // yield put(addMembersToListAC([joinedMember]));
        }
        const chan = getChannelFromAllChannels(channel.id)
        if (!chan) {
          addChannelToAllChannels(channel)
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
        const { channel, member } = args

        log.info('channel LEAVE ... ', channel, member)
        const channelExists = checkChannelExists(channel.id)
        const activeChannelId = yield call(getActiveChannelId)

        if (member.id === SceytChatClient.user.id) {
          yield put(removeChannelAC(channel.id))
          removeChannelFromMap(channel.id)
          deleteChannelFromAllChannels(channel.id)
        } else {
          const groupName = getChannelGroupName(channel)
          if (channelExists) {
            let updateChannelData = {}
            if (activeChannelId === channel.id) {
              yield put(removeMemberFromListAC([member]))
              updateChannelData = yield call(updateActiveChannelMembersRemove, [member]) || {}
            }

            yield put(
              updateChannelDataAC(channel.id, {
                memberCount: channel.memberCount,
                muted: channel.muted,
                mutedTill: channel.mutedTill,
                ...updateChannelData
              })
            )
          }
          yield put(
            updateSearchedChannelDataAC(
              channel.id,
              { memberCount: channel.memberCount, muted: channel.muted, mutedTill: channel.mutedTill },
              groupName
            )
          )
          updateChannelOnAllChannels(channel.id, {
            memberCount: channel.memberCount,
            muted: channel.muted,
            mutedTill: channel.mutedTill
          })
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
        log.info('channel BLOCK ... ')
        const { channel } = args
        const channelExists = checkChannelExists(channel.id)
        if (channelExists) {
          yield put(removeChannelAC(channel.id))
        }
        break
      }
      case CHANNEL_EVENT_TYPES.UNBLOCK: {
        log.info('channel UNBLOCK ... ')
        break
      }
      case CHANNEL_EVENT_TYPES.KICK_MEMBERS: {
        const { channel, removedMembers } = args
        log.info('channel KICK_MEMBERS ... ', removedMembers)
        const activeChannelId = yield call(getActiveChannelId)

        const channelExists = checkChannelExists(channel.id)
        if (channelExists) {
          if (removedMembers.find((mem: IMember) => mem.id === SceytChatClient.user.id)) {
            removeChannelFromMap(channel.id)
            yield put(removeChannelAC(channel.id))
            const activeChannel = yield call(getLastChannelFromMap)
            if (activeChannel) {
              yield put(switchChannelActionAC(JSON.parse(JSON.stringify(activeChannel))))
            }
          } else {
            let updateChannelData = {}
            if (activeChannelId === channel.id) {
              yield put(removeMemberFromListAC(removedMembers))
              updateChannelData = yield call(updateActiveChannelMembersRemove, removedMembers) || {}
            }

            const groupName = getChannelGroupName(channel)
            yield put(
              updateSearchedChannelDataAC(
                channel.id,
                { memberCount: channel.memberCount, muted: channel.muted, mutedTill: channel.mutedTill },
                groupName
              )
            )
            yield put(
              updateChannelDataAC(channel.id, {
                memberCount: channel.memberCount,
                muted: channel.muted,
                mutedTill: channel.mutedTill,
                ...updateChannelData
              })
            )
          }
        }

        updateChannelOnAllChannels(channel.id, {
          memberCount: channel.memberCount,
          muted: channel.muted,
          mutedTill: channel.mutedTill
        })
        break
      }
      case CHANNEL_EVENT_TYPES.ADD_MEMBERS: {
        // const { channel, addedMembers } = args
        const { channel, addedMembers } = args
        log.info('channel ADD_MEMBERS ... ', addedMembers)
        const activeChannelId = yield call(getActiveChannelId)
        const channelExists = checkChannelExists(channel.id)
        if (channelExists) {
          let updateChannelData = {}
          if (activeChannelId === channel.id) {
            yield put(addMembersToListAC(addedMembers))
            updateChannelData = yield call(updateActiveChannelMembersAdd, addedMembers) || {}
          }
          yield put(
            updateChannelDataAC(channel.id, {
              memberCount: channel.memberCount,
              muted: channel.muted,
              mutedTill: channel.mutedTill,
              ...updateChannelData
            })
          )
        } else {
          yield call(setChannelInMap, channel)
          yield put(setAddedToChannelAC(JSON.parse(JSON.stringify(channel))))
        }

        const groupName = getChannelGroupName(channel)
        yield put(
          updateSearchedChannelDataAC(
            channel.id,
            { memberCount: channel.memberCount, muted: channel.muted, mutedTill: channel.mutedTill },
            groupName
          )
        )
        updateChannelOnAllChannels(channel.id, {
          memberCount: channel.memberCount,
          muted: channel.muted,
          mutedTill: channel.mutedTill
        })
        break
      }
      case CHANNEL_EVENT_TYPES.UPDATE_CHANNEL: {
        log.info('channel UPDATE_CHANNEL ... ')
        const { updatedChannel } = args
        const channelExists = checkChannelExists(updatedChannel.id)
        const { subject, avatarUrl, muted, mutedTill, metadata } = updatedChannel
        if (channelExists) {
          yield put(
            updateChannelDataAC(updatedChannel.id, {
              subject,
              avatarUrl,
              muted,
              mutedTill
            })
          )

          const activeChannelId = yield call(getActiveChannelId)
          if (activeChannelId === updatedChannel.id) {
            yield put(
              setActiveChannelAC({ ...updatedChannel, metadata: isJSON(metadata) ? JSON.parse(metadata) : metadata })
            )
          }
        }

        const groupName = getChannelGroupName(updatedChannel)
        yield put(updateSearchedChannelDataAC(updatedChannel.id, { subject, avatarUrl, muted, mutedTill }, groupName))
        updateChannelOnAllChannels(updatedChannel.id, {
          subject,
          avatarUrl,
          muted,
          mutedTill,
          metadata: isJSON(metadata) ? JSON.parse(metadata) : metadata
        })
        break
      }
      case CHANNEL_EVENT_TYPES.MESSAGE: {
        const { channel, message } = args
        log.info('channel MESSAGE ... id : ', message.id, ', channel.id: ', channel.id)
        const messageToHandle = handleNewMessages ? handleNewMessages(message, channel) : message
        const channelFilterTypes = getChannelTypesFilter()
        if (
          messageToHandle &&
          channel &&
          (channelFilterTypes?.length ? channelFilterTypes.includes(channel.type) : true)
        ) {
          channel.metadata = isJSON(channel.metadata) ? JSON.parse(channel.metadata) : channel.metadata
          const activeChannelId = yield call(getActiveChannelId)
          const channelExists = checkChannelExists(channel.id)
          const channelForAdd = JSON.parse(JSON.stringify(channel))

          yield put(addChannelAC(channelForAdd))
          if (!channelExists) {
            yield call(setChannelInMap, channel)
          } else if (!message.repliedInThread) {
            yield put(updateChannelLastMessageAC(message, channelForAdd))
          }

          if (channel.id === activeChannelId) {
            if (!getHasNextCached()) {
              yield put(addMessageAC(message))
            }
            addAllMessages([message], MESSAGE_LOAD_DIRECTION.NEXT)
            // addAllMessages([message], MESSAGE_LOAD_DIRECTION.NEXT)
            // }
            if (message.user.id !== SceytChatClient.user.id) {
              // yield put(markMessagesAsReadAC(channel.id, [message.id]))
            }
            const hasNextMessage = store.getState().MessageReducer.messagesHasNext
            if (!getHasNextCached() && !hasNextMessage) {
              yield put(scrollToNewMessageAC(true, false, true))
            }
          }

          if (getMessagesFromMap(channel.id) && getMessagesFromMap(channel.id).length) {
            addMessageToMap(channel.id, message)
          }
          yield put(
            updateChannelDataAC(channel.id, {
              messageCount: channelForAdd.messageCount,
              unread: channelForAdd.unread,
              newMessageCount: channelForAdd.newMessageCount,
              newMentionCount: channelForAdd.newMentionCount,
              newReactedMessageCount: channelForAdd.newReactedMessageCount,
              lastReceivedMsgId: channelForAdd.lastReceivedMsgId,
              lastDisplayedMessageId: channelForAdd.lastDisplayedMessageId,
              messageRetentionPeriod: channelForAdd.messageRetentionPeriod,
              lastMessage: channelForAdd.lastMessage,
              messages: channelForAdd.messages,
              newReactions: channelForAdd.newReactions,
              userMessageReactions: [],
              lastReactedMessage: null
            })
          )
          const groupName = getChannelGroupName(channel)
          yield put(
            updateSearchedChannelDataAC(
              channel.id,
              {
                messageCount: channelForAdd.messageCount,
                unread: channelForAdd.unread,
                newMessageCount: channelForAdd.newMessageCount,
                newMentionCount: channelForAdd.newMentionCount,
                newReactedMessageCount: channelForAdd.newReactedMessageCount,
                lastReceivedMsgId: channelForAdd.lastReceivedMsgId,
                lastDisplayedMessageId: channelForAdd.lastDisplayedMessageId,
                messageRetentionPeriod: channelForAdd.messageRetentionPeriod,
                lastMessage: channelForAdd.lastMessage,
                messages: channelForAdd.messages,
                newReactions: channelForAdd.newReactions,
                userMessageReactions: [],
                lastReactedMessage: null
              },
              groupName
            )
          )
          const showNotifications = getShowNotifications()
          if (showNotifications && !message.silent && message.user.id !== SceytChatClient.user.id && !channel.muted) {
            if (Notification.permission === 'granted') {
              const tabIsActive = yield select(browserTabIsActiveSelector)
              if (document.visibilityState !== 'visible' || !tabIsActive || channel.id !== activeChannelId) {
                const contactsMap = yield select(contactsMapSelector)
                const getFromContacts = getShowOnlyContactUsers()
                const state = store.getState()
                const theme = state.ThemeReducer.theme || 'light'
                const accentColor = state.ThemeReducer.newTheme?.colors?.accent?.[theme] || '#3B82F6'
                const textSecondary = state.ThemeReducer.newTheme?.colors?.textSecondary?.[theme] || '#6B7280'
                const messageBody = MessageTextFormat({
                  text: message.body,
                  message,
                  contactsMap,
                  getFromContacts,
                  isLastMessage: false,
                  asSampleText: true,
                  accentColor,
                  textSecondary
                })
                setNotification(
                  messageBody,
                  message.user,
                  channel,
                  undefined,
                  message.attachments && message.attachments.length
                    ? message.attachments.find((att: IAttachment) => att.type !== attachmentTypes.link)
                    : undefined
                )
              }
            }
          }
          if (message.repliedInThread && message.parentMessage.id) {
            yield put(markMessagesAsDeliveredAC(message.parentMessage.id, [message.id]))
          } else {
            yield put(markMessagesAsDeliveredAC(channel.id, [message.id]))
          }

          updateChannelOnAllChannels(channel.id, {
            messageCount: channelForAdd.messageCount,
            unread: channelForAdd.unread,
            newMessageCount: channelForAdd.newMessageCount,
            newMentionCount: channelForAdd.newMentionCount,
            newReactedMessageCount: channelForAdd.newReactedMessageCount,
            lastReceivedMsgId: channelForAdd.lastReceivedMsgId,
            lastDisplayedMessageId: channelForAdd.lastDisplayedMessageId,
            messageRetentionPeriod: channelForAdd.messageRetentionPeriod,
            lastMessage: channelForAdd.lastMessage,
            messages: channelForAdd.messages,
            newReactions: channelForAdd.newReactions,
            lastReactedMessage: channel.lastReactedMessage,
            userMessageReactions: channel.userMessageReactions
          })
          updateChannelLastMessageOnAllChannels(channel.id, channel.lastMessage)
        }
        break
      }
      case CHANNEL_EVENT_TYPES.MESSAGE_MARKERS_RECEIVED: {
        const { channelId, markerList } = args
        const channel = yield call(getChannelFromMap, channelId)
        log.info('channel MESSAGE_MARKERS_RECEIVED ... channel: ', channel, 'markers list: ', markerList)

        if (channel) {
          const activeChannelId = yield call(getActiveChannelId)
          let updateLastMessage = false
          const markersMap: any = {}
          const activeChannelMessages = getMessagesFromMap(activeChannelId)
          markerList.messageIds.forEach((messageId: string) => {
            if (activeChannelMessages?.find((message: IMessage) => message.id === messageId)) {
              removePendingMessageFromMap(activeChannelId, messageId)
            } else {
              const isPendingMessage = getMessageFromPendingMessagesMap(activeChannelId, messageId)
              if (isPendingMessage) {
                updatePendingMessageOnMap(activeChannelId, messageId, { deliveryStatus: markerList.name })
              }
            }
            markersMap[messageId] = true
            if (channel) {
              if (
                channel.lastMessage &&
                messageId === channel.lastMessage.id &&
                channel.lastMessage.deliveryStatus !== MESSAGE_DELIVERY_STATUS.READ
              ) {
                updateLastMessage = true
              }
            }
            updateChannelOnAllChannels(channelId, {}, { id: messageId, deliveryStatus: markerList.name })
          })
          if (updateLastMessage) {
            const lastMessage = {
              ...channel.lastMessage,
              deliveryStatus: markerList.name
            }

            updateChannelLastMessageOnAllChannels(channel.id, lastMessage)
            yield put(updateChannelLastMessageStatusAC(lastMessage, channel))
          }

          if (activeChannelId === channelId) {
            yield put(updateMessagesStatusAC(markerList.name, markersMap))
            updateMarkersOnAllMessages(markersMap, markerList.name)
          }

          updateMessageStatusOnMap(channel.id, { name: markerList.name, markersMap })
          yield put(updateMessagesMarkersAC(channelId, markerList.name, markerList))
        }

        break
      }
      case CHANNEL_EVENT_TYPES.DELETE: {
        const { channelId } = args
        log.info('channel DELETE ... ')
        const channel = getChannelFromMap(channelId)
        yield put(setChannelToRemoveAC(channel))
        deleteChannelFromAllChannels(channelId)
        break
      }
      case CHANNEL_EVENT_TYPES.DELETE_MESSAGE: {
        const { channel, /* user, */ deletedMessage } = args
        const activeChannelId = getActiveChannelId()
        log.info('channel DELETE_MESSAGE ... ')
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
              newMessageCount: channel.newMessageCount,
              muted: channel.muted,
              mutedTill: channel.mutedTill
            })
          )
          if (channel.lastMessage.id === deletedMessage.id) {
            yield put(updateChannelLastMessageAC(deletedMessage, channel))
          }
        }
        updateChannelOnAllChannels(
          channel.id,
          {
            newMessageCount: channel.newMessageCount,
            muted: channel.muted,
            mutedTill: channel.mutedTill
          },
          deletedMessage
        )
        break
      }
      case CHANNEL_EVENT_TYPES.EDIT_MESSAGE: {
        const { channel, /* user, */ message } = args
        const activeChannelId = getActiveChannelId()
        const channelExists = checkChannelExists(channel.id)
        if (channel.id === activeChannelId) {
          yield put(
            updateMessageAC(message.id, {
              body: message.body,
              state: message.state,
              attachments: message.attachments,
              bodyAttributes: message.bodyAttributes,
              mentionedUsers: message.mentionedUsers,
              updatedAt: message.updatedAt
            })
          )
          updateMessageOnAllMessages(message.id, {
            body: message.body,
            state: message.state,
            attachments: message.attachments,
            bodyAttributes: message.bodyAttributes,
            mentionedUsers: message.mentionedUsers,
            updatedAt: message.updatedAt
          })
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
        updateChannelOnAllChannels(channel.id, {}, message)
        break
      }
      case CHANNEL_EVENT_TYPES.REACTION_ADDED: {
        const { channel, user, message, reaction } = args
        const isSelf = user.id === SceytChatClient.user.id
        const activeChannelId = getActiveChannelId()

        if (channel.id === activeChannelId) {
          yield put(addReactionToMessageAC(message, reaction, isSelf))
          addReactionOnAllMessages(message, reaction, true)
        }
        if (message.user.id === SceytChatClient.user.id) {
          if (!isSelf && Notification.permission === 'granted') {
            if (document.visibilityState !== 'visible' || channel.id !== activeChannelId) {
              const contactsMap = yield select(contactsMapSelector)
              const getFromContacts = getShowOnlyContactUsers()
              const state = store.getState()
              const theme = state.ThemeReducer.theme || 'light'
              const accentColor = state.ThemeReducer.newTheme?.colors?.accent?.[theme] || '#3B82F6'
              const textSecondary = state.ThemeReducer.newTheme?.colors?.textSecondary?.[theme] || '#6B7280'
              const messageBody = MessageTextFormat({
                text: message.body,
                message,
                contactsMap,
                getFromContacts,
                isLastMessage: false,
                asSampleText: true,
                accentColor,
                textSecondary
              })
              setNotification(
                messageBody,
                reaction.user,
                channel,
                reaction.key,
                message.attachments && message.attachments.length
                  ? message.attachments.find((att: IAttachment) => att.type !== attachmentTypes.link)
                  : undefined
              )
            }
          }

          if (channel.newReactions && channel.newReactions.length) {
            const channelUpdateParams = {
              userMessageReactions: channel.newReactions,
              lastReactedMessage: message,
              newReactions: channel.newReactions,
              muted: channel.muted,
              mutedTill: channel.mutedTill
            }
            yield put(updateChannelDataAC(channel.id, channelUpdateParams))
          }
          updateChannelOnAllChannels(channel.id, {
            userMessageReactions: channel.newReactions,
            lastReactedMessage: message,
            newReactions: channel.newReactions,
            muted: channel.muted,
            mutedTill: channel.mutedTill
          })
        }

        if (checkChannelExistsOnMessagesMap(channel.id)) {
          addReactionToMessageOnMap(channel.id, message, reaction, true)
        }
        break
      }
      case CHANNEL_EVENT_TYPES.POLL_ADDED: {
        const { channel, message } = args
        const pollDetails = message?.pollDetails || {}
        const activeChannelId = getActiveChannelId()
        const addedVotes = pollDetails?.votes || []
        updateMessageOnMap(channel.id, {
          messageId: message.id,
          params: {},
        }, { votes: addedVotes, votesPerOption: pollDetails.votesPerOption })
        if (channel.id === activeChannelId) {
          updateMessageOnAllMessages(message.id, {}, { votes: addedVotes, votesPerOption: pollDetails.votesPerOption || {} })
          yield put(updateMessageAC(message.id, {}, undefined, { votes: addedVotes, votesPerOption: pollDetails.votesPerOption || {} }))
          break
        }
      }
      case CHANNEL_EVENT_TYPES.POLL_DELETED: {
        const { channel, message } = args
        const pollDetails = message?.pollDetails || {}
        const activeChannelId = getActiveChannelId()
        const deletedVotes = pollDetails?.votes || []
        updateMessageOnMap(channel.id, {
          messageId: message.id,
          params: {},
        }, { deletedVotes, votesPerOption: pollDetails.votesPerOption })
        if (channel.id === activeChannelId) {
          updateMessageOnAllMessages(message.id, {}, { deletedVotes, votesPerOption: pollDetails.votesPerOption || {} })
          yield put(updateMessageAC(message.id, {}, undefined, { deletedVotes, votesPerOption: pollDetails.votesPerOption || {} }))
          break
        }
        break
      }
      case CHANNEL_EVENT_TYPES.POLL_RETRACTED: {
        const { channel, message } = args
        const pollDetails = message?.pollDetails || {}
        const activeChannelId = getActiveChannelId()
        const retractedVotes = pollDetails?.votes || []
        updateMessageOnMap(channel.id, {
          messageId: message.id,
          params: {},
        }, { deletedVotes: retractedVotes, votesPerOption: pollDetails.votesPerOption })
        if (channel.id === activeChannelId) {
          updateMessageOnAllMessages(message.id, {}, { deletedVotes: retractedVotes, votesPerOption: pollDetails.votesPerOption || {} })
          yield put(updateMessageAC(message.id, {}, undefined, { deletedVotes: retractedVotes, votesPerOption: pollDetails.votesPerOption || {} }))
          break
        }
        break
      }
      case CHANNEL_EVENT_TYPES.POLL_CLOSED: {
        const { channel, message } = args
        const activeChannelId = getActiveChannelId()
        updateMessageOnMap(channel.id, {
          messageId: message.id,
          params: {},
        }, { closed: true })

        if (channel.id === activeChannelId) {
          updateMessageOnAllMessages(message.id, {}, { closed: true })
          yield put(updateMessageAC(message.id, {}, undefined, { closed: true }))
          break
        }
        break
      }
      case CHANNEL_EVENT_TYPES.REACTION_DELETED: {
        const { channel, user, message, reaction } = args
        log.info('channel REACTION_DELETED ... ', channel)
        const channelFromMap = getChannelFromMap(channel.id)
        const isSelf = user.id === SceytChatClient.user.id
        const activeChannelId = getActiveChannelId()

        if (channel.id === activeChannelId) {
          yield put(deleteReactionFromMessageAC(message, reaction, isSelf))
          removeReactionOnAllMessages(message, reaction, true)
        }
        const channelUpdateParams = JSON.parse(JSON.stringify(channel))
        if (
          channelFromMap &&
          channelFromMap.lastReactedMessage &&
          channelFromMap.lastReactedMessage.id === message.id
        ) {
          channelUpdateParams.lastReactedMessage = null
        }
        yield put(updateChannelDataAC(channel.id, channelUpdateParams))
        updateChannelOnAllChannels(channel.id, channelUpdateParams)
        /* if (!(channel.newReactions && channel.newReactions.length)) {
          const channelUpdateParams = {
            userMessageReactions: [],
            lastReactedMessage: null
          }
          yield put(updateChannelDataAC(channel.id, channelUpdateParams))
          updateChannelOnAllChannels(channel.id, channelUpdateParams)
        } */
        if (checkChannelExistsOnMessagesMap(channel.id)) {
          removeReactionToMessageOnMap(channel.id, message, reaction, true)
        }
        break
      }

      case CHANNEL_EVENT_TYPES.UNREAD_MESSAGES_INFO: {
        const { channel } = args
        // const { channel, channelUnreadCount } = args
        // log.info('channel UNREAD_MESSAGES_INFO .unreadChannels', unreadChannels)
        // log.info('channel UNREAD_MESSAGES_INFO .totalUnread', totalUnread)
        // log.info('channel UNREAD_MESSAGES_INFO .channelUnreadCount', channelUnreadCount, 'channel: ', channel)
        // yield put(setChannelUnreadCount(0, channel.id));
        if (channel) {
          const updatedChannel = JSON.parse(JSON.stringify(channel))
          yield put(
            updateChannelDataAC(channel.id, {
              lastMessage: channel.lastMessage,
              newMessageCount: channel.newMessageCount,
              newMentionCount: channel.newMentionCount,
              unread: channel.unread,
              newReactedMessageCount: channel.newReactedMessageCount,
              newReactions: channel.newReactions,
              lastReactedMessage: channel.lastReactedMessage,
              lastReceivedMsgId: channel.lastReceivedMsgId,
              lastDisplayedMessageId: channel.lastDisplayedMessageId,
              messageRetentionPeriod: channel.messageRetentionPeriod
            })
          )
          updateChannelOnAllChannels(channel.id, updatedChannel)
        }
        break
      }

      case CHANNEL_EVENT_TYPES.CLEAR_HISTORY: {
        const { channel } = args
        log.info('CLEAR_HISTORY: ', channel)
        const activeChannelId = yield call(getActiveChannelId)
        const channelExist = yield call(checkChannelExists, channel.id)
        if (channel.id === activeChannelId) {
          yield put(clearMessagesAC())
          removeAllMessages()
        }
        removeMessagesFromMap(channel.id)
        if (channelExist) {
          yield put(
            updateChannelDataAC(channel.id, {
              lastMessage: null,
              newMessageCount: 0,
              newMentionCount: 0,
              muted: channel.muted,
              mutedTill: channel.mutedTill
            })
          )
        }
        updateChannelOnAllChannels(channel.id, {
          lastMessage: null,
          newMessageCount: 0,
          newMentionCount: 0,
          muted: channel.muted,
          mutedTill: channel.mutedTill
        })
        break
      }
      case CHANNEL_EVENT_TYPES.MUTE: {
        const { channel } = args
        log.info('channel MUTE ... ')

        yield put(
          updateChannelDataAC(channel.id, {
            muted: channel.muted,
            mutedTill: channel.mutedTill
          })
        )
        updateChannelOnAllChannels(channel.id, {
          muted: channel.muted,
          mutedTill: channel.mutedTill
        })
        break
      }
      case CHANNEL_EVENT_TYPES.UNMUTE: {
        const { channel } = args
        log.info('channel UNMUTE ... ')

        yield put(
          updateChannelDataAC(channel.id, {
            muted: channel.muted,
            mutedTill: channel.mutedTill
          })
        )
        updateChannelOnAllChannels(channel.id, {
          muted: channel.muted,
          mutedTill: channel.mutedTill
        })

        break
      }
      case CHANNEL_EVENT_TYPES.PINED: {
        const { channel } = args
        log.info('channel PINED ... ')

        yield put(
          updateChannelDataAC(
            channel.id,
            {
              pinnedAt: channel.pinnedAt
            },
            true
          )
        )
        updateChannelOnAllChannels(channel.id, {
          pinnedAt: channel.pinnedAt
        })
        break
      }
      case CHANNEL_EVENT_TYPES.UNPINED: {
        const { channel } = args
        log.info('channel UNPINED ... ')

        yield put(
          updateChannelDataAC(
            channel.id,
            {
              pinnedAt: channel.pinnedAt
            },
            false,
            true
          )
        )
        updateChannelOnAllChannels(channel.id, {
          pinnedAt: channel.pinnedAt
        })

        break
      }
      case CHANNEL_EVENT_TYPES.HIDE: {
        const { channel } = args
        log.info('channel HIDE ... ')
        yield put(setChannelToHideAC(channel))
        break
      }
      case CHANNEL_EVENT_TYPES.UNHIDE: {
        const { channel } = args
        log.info('channel UNHIDE ... ')
        yield put(setChannelToUnHideAC(channel))
        break
      }
      case CHANNEL_EVENT_TYPES.CHANNEL_MARKED_AS_UNREAD: {
        const { channel } = args
        // log.info('channel CHANNEL_MARKED_AS_UNREAD ... ', channel)
        yield put(
          updateChannelDataAC(channel.id, {
            unread: channel.unread,
            muted: channel.muted,
            mutedTill: channel.mutedTill
          })
        )
        const groupName = getChannelGroupName(channel)
        yield put(updateSearchedChannelDataAC(channel.id, { unread: channel.unread }, groupName))

        updateChannelOnAllChannels(channel.id, { unread: channel.unread })
        break
      }
      case CHANNEL_EVENT_TYPES.CHANNEL_MARKED_AS_READ: {
        const { channel } = args
        // log.info('channel CHANNEL_MARKED_AS_READ ... ', channel)
        yield put(
          updateChannelDataAC(channel.id, {
            unread: channel.unread,
            muted: channel.muted,
            mutedTill: channel.mutedTill
          })
        )
        const groupName = getChannelGroupName(channel)
        yield put(updateSearchedChannelDataAC(channel.id, { unread: channel.unread }, groupName))
        updateChannelOnAllChannels(channel.id, { unread: channel.unread })
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
        log.info('channel CHANGE_ROLE  channel ... ', channel)
        log.info('channel CHANGE_ROLE  member ... ', members)
        const activeChannelId = yield call(getActiveChannelId)
        if (channel.id === activeChannelId) {
          yield put(updateMembersAC(members))
        }
        for (let i = 0; i < members.length; i++) {
          if (members[i].id === SceytChatClient.user.id) {
            yield put(
              updateChannelDataAC(channel.id, {
                userRole: members[i].role,
                muted: channel.muted,
                mutedTill: channel.mutedTill
              })
            )
            updateChannelOnAllChannels(channel.id, {
              userRole: members[i].role,
              muted: channel.muted,
              mutedTill: channel.mutedTill
            })
          }
        }
        break
      }
      case CHANNEL_EVENT_TYPES.FROZEN: {
        const { channel } = args
        log.info('channel frozen  channel ... ', channel)
        break
      }
      case CHANNEL_EVENT_TYPES.UNFROZEN: {
        const { channel } = args
        log.info('channel unfrozen  channel ... ', channel)
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
        log.info('user TOKEN_WILL_EXPIRE ... ', expireTime)
        break
      } */

      case CHANNEL_EVENT_TYPES.CHANNEL_EVENT: {
        const { channelId, from, name } = args
        // const { user, channelId, name } = args
        log.info('channel event received >>>... . . . . . ', args)
        if (from.id === SceytChatClient.user.id) {
          break
        }
        if (name === 'start_typing') {
          if (!usersTimeout[channelId]) {
            usersTimeout[channelId] = {}
          }
          if (usersTimeout[channelId] && usersTimeout[channelId][from.id]) {
            clearTimeout(usersTimeout[channelId][from.id])
          }
          usersTimeout[channelId][from.id] = setTimeout(() => {
            channelListener.onReceivedChannelEvent(channelId, from, 'stop_typing')
          }, 5000)
          yield put(switchTypingIndicatorAC(true, channelId, from))
        } else if (name === 'stop_typing') {
          if (usersTimeout[channelId] && usersTimeout[channelId][from.id]) {
            clearTimeout(usersTimeout[channelId][from.id])
          }
          yield put(switchTypingIndicatorAC(false, channelId, from))
        } else if (name === 'start_recording') {
          if (!usersTimeout[channelId]) {
            usersTimeout[channelId] = {}
          }
          if (usersTimeout[channelId] && usersTimeout[channelId][from.id]) {
            clearTimeout(usersTimeout[channelId][from.id])
          }
          usersTimeout[channelId][from.id] = setTimeout(() => {
            channelListener.onReceivedChannelEvent(channelId, from, 'stop_recording')
          }, 5000)
          yield put(switchRecordingIndicatorAC(true, channelId, from))
        } else if (name === 'stop_recording') {
          if (usersTimeout[channelId] && usersTimeout[channelId][from.id]) {
            clearTimeout(usersTimeout[channelId][from.id])
          }
          yield put(switchRecordingIndicatorAC(false, channelId, from))
        }
        break
      }
      case CONNECTION_EVENT_TYPES.CONNECTION_STATUS_CHANGED: {
        const { status } = args
        log.info('connection status changed . . . . . ', status)
        yield put(setConnectionStatusAC(status))
        if (status === CONNECTION_STATUS.CONNECTED) {
          yield put(getRolesAC())
        }
        break
      }
      default:
        log.warn('UNHANDLED EVENT FROM REDUX-SAGA EVENT-CHANNEL')
    }
  }
}
