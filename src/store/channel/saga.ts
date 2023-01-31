import { put, takeLatest, call, takeEvery } from 'redux-saga/effects'
import {
  addChannelAC,
  addChannelsAC,
  channelHasNextAC,
  getChannelsAC,
  removeChannelAC,
  removeChannelCachesAC,
  setActiveChannelAC,
  setChannelsAC,
  setChannelsFroForwardAC,
  setChannelsLoadingStateAC,
  switchChannelActionAC,
  updateChannelDataAC,
  updateChannelLastMessageAC,
  updateUserStatusOnChannelAC
} from './actions'
import {
  BLOCK_CHANNEL,
  CHECK_USER_STATUS,
  CLEAR_HISTORY,
  CREATE_CHANNEL,
  DELETE_ALL_MESSAGES,
  DELETE_CHANNEL,
  GET_CHANNELS,
  GET_CHANNELS_FOR_FORWARD,
  JOIN_TO_CHANNEL,
  LEAVE_CHANNEL,
  LOAD_MORE_CHANNEL,
  MARK_CHANNEL_AS_READ,
  MARK_CHANNEL_AS_UNREAD,
  MARK_MESSAGES_AS_DELIVERED,
  MARK_MESSAGES_AS_READ,
  REMOVE_CHANNEL_CACHES,
  SEND_TYPING,
  SWITCH_CHANNEL,
  TURN_OFF_NOTIFICATION,
  TURN_ON_NOTIFICATION,
  UPDATE_CHANNEL,
  WATCH_FOR_EVENTS
} from './constants'
import {
  destroyChannelsMap,
  setChannelsInMap,
  query,
  getActiveChannelId,
  getChannelFromMap,
  setActiveChannelId,
  setUnreadScrollTo,
  removeChannelFromMap,
  getLastChannelFromMap,
  checkChannelExists,
  setChannelInMap
} from '../../helpers/channelHalper'
import { CHANNEL_TYPE, LOADING_STATE, MESSAGE_DELIVERY_STATUS } from '../../helpers/constants'
import { IAction, IChannel, IUser } from '../../types'
import { getClient } from '../../common/client'
import {
  clearMessagesAC,
  sendTextMessageAC,
  // clearMessagesAC,
  updateMessageAC
} from '../message/actions'
import watchForEvents from '../evetns/inedx'
import { CONNECTION_STATUS } from '../user/constants'
import { removeAllMessages, removeMessagesFromMap } from '../../helpers/messagesHalper'

function* createChannel(action: IAction): any {
  try {
    const { payload } = action
    const { channelData } = payload
    const SceytChatClient = getClient()
    const createChannelData = { ...channelData }
    if (createChannelData.avatarFile) {
      const fileToUpload = {
        data: createChannelData.avatarFile,
        progress: (progressPercent: number) => {
          console.log('upload percent - ', progressPercent)
        }
      }
      createChannelData.avatarUrl = yield call(SceytChatClient.chatClient.uploadFile, fileToUpload)
      delete createChannelData.avatarFile
    }
    const createdChannel = yield call(
      SceytChatClient.chatClient[`${channelData.type}Channel`].create,
      createChannelData
    )
    let checkChannelExist = false
    if (createdChannel.type === CHANNEL_TYPE.DIRECT) {
      checkChannelExist = yield call(checkChannelExists, createdChannel.id)
    }
    if (!checkChannelExist) {
      yield call(setChannelInMap, createdChannel)
      if (createdChannel.type !== CHANNEL_TYPE.DIRECT) {
        const messageToSend: any = {
          // metadata: mentionedMembersPositions,
          body: createdChannel.type === CHANNEL_TYPE.PUBLIC ? 'CC' : 'CG',
          mentionedMembers: [],
          attachments: [],
          type: 'system'
        }
        yield put(sendTextMessageAC(messageToSend, createdChannel.id, CONNECTION_STATUS.CONNECTED))
      }
      yield put(addChannelAC(JSON.parse(JSON.stringify(createdChannel))))
    }
    yield put(switchChannelActionAC(JSON.parse(JSON.stringify(createdChannel))))

    yield call(setActiveChannelId, createdChannel.id)
  } catch (e) {
    console.log(e, 'Error on create channel')
    // yield put(setErrorNotification(e.message))
  }
}

function* getChannels(action: IAction): any {
  try {
    const { payload } = action
    const { params, isJoinChannel } = payload
    const SceytChatClient = getClient()
    yield put(setChannelsLoadingStateAC(LOADING_STATE.LOADING))
    const { search: searchBy } = params
    if (searchBy) {
      const directChannelQueryBuilder = new (SceytChatClient.chatClient.ChannelListQueryBuilder as any)()
      directChannelQueryBuilder.direct()
      directChannelQueryBuilder.userContains(searchBy)
      directChannelQueryBuilder.sortByLastMessage()
      directChannelQueryBuilder.limit(10)
      const directChannelQuery = yield call(directChannelQueryBuilder.build)
      const directChannelsData = yield call(directChannelQuery.loadNextPage)
      // getting other channels
      const groupChannelQueryBuilder = new (SceytChatClient.chatClient.ChannelListQueryBuilder as any)()
      groupChannelQueryBuilder.subjectContains(searchBy)
      groupChannelQueryBuilder.sortByLastMessage()
      groupChannelQueryBuilder.limit(20)
      const groupChannelQuery = yield call(groupChannelQueryBuilder.build)
      const groupChannelsData = yield call(groupChannelQuery.loadNextPage)
      // set all channels
      const allChannels: IChannel[] = directChannelsData.channels.concat(groupChannelsData.channels)
      yield call(destroyChannelsMap)
      const mappedChannels = yield call(setChannelsInMap, allChannels)
      yield put(setChannelsAC(mappedChannels))
    } else {
      const channelQueryBuilder = new (SceytChatClient.chatClient.ChannelListQueryBuilder as any)()
      if (params.filter && params.filter.channelType) {
        console.log('params.filter.channelType ... ', params.filter.channelType)
        if (params.filter.channelType.toLowerCase() === 'direct') {
          channelQueryBuilder.direct()
        } else if (params.filter.channelType.toLowerCase() === 'public') {
          channelQueryBuilder.public()
        } else if (params.filter.channelType.toLowerCase() === 'private') {
          channelQueryBuilder.private()
        } else {
          throw new Error('Bad filter type')
        }
      }
      channelQueryBuilder.sortByLastMessage()
      channelQueryBuilder.limit(params.limit || 20)
      const channelQuery = yield call(channelQueryBuilder.build)
      const channelsData = yield call(channelQuery.loadNextPage)
      yield put(channelHasNextAC(channelsData.hasNext))
      const channelId = yield call(getActiveChannelId)
      let activeChannel = isJoinChannel ? yield call(getChannelFromMap, channelId) : null
      yield call(destroyChannelsMap)
      const mappedChannels = yield call(setChannelsInMap, channelsData.channels)
      yield put(setChannelsAC(mappedChannels))

      if (!isJoinChannel) {
        ;[activeChannel] = channelsData.channels
      }
      query.channelQuery = channelQuery
      if (activeChannel) {
        yield put(switchChannelActionAC(JSON.parse(JSON.stringify(activeChannel))))
      }
    }

    yield put(setChannelsLoadingStateAC(LOADING_STATE.LOADED))
  } catch (e) {
    console.log(e, 'Error on get channels')
    if (e.code !== 10008) {
      // yield put(setErrorNotification(e.message));
    }
  }
}

function* getChannelsForForward(action: IAction): any {
  try {
    const { payload } = action
    const { searchValue } = payload
    console.log('searchValue. . ', searchValue)
    const SceytChatClient = getClient()
    yield put(setChannelsLoadingStateAC(LOADING_STATE.LOADING, true))

    const channelQueryBuilder = new (SceytChatClient.chatClient.ChannelListQueryBuilder as any)()

    channelQueryBuilder.sortByLastMessage()
    channelQueryBuilder.limit(20)
    const channelQuery = yield call(channelQueryBuilder.build)
    const channelsData = yield call(channelQuery.loadNextPage)
    console.log('channels data ... ', channelsData)
    yield put(channelHasNextAC(channelsData.hasNext, true))
    const mappedChannels = JSON.parse(JSON.stringify(channelsData.channels))
    yield put(setChannelsFroForwardAC(mappedChannels))
    query.channelQueryForward = channelQuery

    yield put(setChannelsLoadingStateAC(LOADING_STATE.LOADED, true))
  } catch (e) {
    console.log(e, 'Error on get for forward channels')
    if (e.code !== 10008) {
      // yield put(setErrorNotification(e.message));
    }
  }
}

function* channelsLoadMore(action: IAction): any {
  try {
    const { payload } = action
    const { limit } = payload
    const { channelQuery } = query
    if (limit) {
      channelQuery.limit(limit)
    }
    yield put(setChannelsLoadingStateAC(LOADING_STATE.LOADING))
    const channelsData = yield call(channelQuery.loadNextPage)
    yield put(channelHasNextAC(channelsData.hasNext))
    const mappedChannels = yield call(setChannelsInMap, channelsData.channels)
    yield put(addChannelsAC(mappedChannels))
    yield put(setChannelsLoadingStateAC(LOADING_STATE.LOADED))
  } catch (error) {
    console.log(error, 'Error in load more channels')
    /* if (error.code !== 10008) {
      yield put(setErrorNotification(error.message));
    } */
  }
}

function* markMessagesRead(action: IAction): any {
  const { payload } = action
  const { channelId, messageIds } = payload
  const channel = yield call(getChannelFromMap, channelId)
  // const activeChannelId = yield call(getActiveChannelId)
  if (channel) {
    const markedMessageIds = yield call(channel.markMessagesAsRead, messageIds)
    // use updateChannelDataAC already changes unreadMessageCount no need in setChannelUnreadCount
    // yield put(setChannelUnreadCount(0, channel.id));
    yield put(
      updateChannelDataAC(channel.id, {
        markedAsUnread: channel.markedAsUnread,
        lastReadMessageId: channel.lastReadMessageId,
        unreadMessageCount: channel.unreadMessageCount
      })
    )
    for (const messageId of markedMessageIds) {
      yield put(
        updateMessageAC(messageId, {
          deliveryStatus: MESSAGE_DELIVERY_STATUS.READ,
          selfMarkers: [MESSAGE_DELIVERY_STATUS.READ]
        })
      )
    }

    /* if (channelId === activeChannelId) {
      yield put(
        updateChannelDataAC(channel.id, {
          markedAsUnread: channel.markedAsUnread,
          lastReadMessageId: channel.lastReadMessageId,
          unreadMessageCount: channel.unreadMessageCount
        })
      )
    } else {
      yield put(
        updateChannelDataAC(channel.id, {
          markedAsUnread: channel.markedAsUnread,
          lastReadMessageId: channel.lastReadMessageId
        })
      )
    } */
  }
}

function* markMessagesDelivered(action: IAction): any {
  const { payload } = action
  const { channelId, messageIds } = payload
  const channel = yield call(getChannelFromMap, channelId)

  if (channel) {
    yield call(channel.markMessagesAsDelivered, messageIds)
  }
}

function* switchChannel(action: IAction) {
  try {
    const { payload } = action
    const { channel } = payload
    yield call(setUnreadScrollTo, true)
    yield call(setActiveChannelId, channel && channel.id)
    yield put(setActiveChannelAC({ ...channel }))
    // yield put(switchTypingIndicatorAC(false))
    // yield put(setMessageForThreadReply(undefined));
    // yield put(deleteThreadReplyMessagesAC());
    if (channel) {
      // yield put(getMessagesAC(channel))
    }
  } catch (e) {
    console.log('error in switch channel')
    // yield put(setErrorNotification(e.message));
  }
}

function* notificationsTurnOff(action: IAction): any {
  const {
    payload: { expireTime }
  } = action
  const activeChannelId = yield call(getActiveChannelId)
  const channel = yield call(getChannelFromMap, activeChannelId)

  try {
    const updatedChannel = yield call(channel.mute, expireTime)
    yield put(
      updateChannelDataAC(updatedChannel.id, {
        muted: updatedChannel.muted,
        muteExpireDate: updatedChannel.muteExpireDate
      })
    )
  } catch (e) {
    console.log('ERROR turn off notifications', e.message)
    // yield put(setErrorNotification(e.message))
  }
}

function* notificationsTurnOn(): any {
  const activeChannelId = yield call(getActiveChannelId)
  const channel = yield call(getChannelFromMap, activeChannelId)

  try {
    const updatedChannel = yield call(channel.unmute)
    yield put(
      updateChannelDataAC(updatedChannel.id, {
        muted: updatedChannel.muted,
        muteExpireDate: updatedChannel.muteExpireDate
      })
    )
  } catch (e) {
    console.log('ERROR turn on notifications: ', e.message)
    // yield put(setErrorNotification(e.message))
  }
}

function* markChannelAsRead(action: IAction): any {
  try {
    const { channelId } = action.payload
    const channel = yield call(getChannelFromMap, channelId)
    const updatedChannel = yield call(channel.markAsRead)
    yield put(updateChannelDataAC(channel.id, { ...updatedChannel }))
  } catch (error) {
    console.log(error, 'Error in set channel unread')
    // yield put(setErrorNotification(error.message));
  }
}

function* markChannelAsUnRead(action: IAction): any {
  try {
    const { channelId } = action.payload
    const channel = yield call(getChannelFromMap, channelId)

    const updatedChannel = yield call(channel.markAsUnRead)
    console.log(' channel -- ', channel)
    console.log('updated channel -- ', updatedChannel)
    yield put(updateChannelDataAC(channel.id, { ...updatedChannel }))
  } catch (error) {
    console.log(error, 'Error in set channel unread')
    // yield put(setErrorNotification(error.message));
  }
}

function* removeChannelCaches(action: IAction): any {
  const { payload } = action
  const { channelId } = payload
  const activeChannelId = yield call(getActiveChannelId)
  removeChannelFromMap(channelId)
  removeMessagesFromMap(channelId)
  if (activeChannelId === channelId) {
    const activeChannel = yield call(getLastChannelFromMap)
    if (activeChannel) {
      yield put(switchChannelActionAC(JSON.parse(JSON.stringify(activeChannel))))
    }
  }
}

function* leaveChannel(action: IAction): any {
  try {
    const { payload } = action
    const { channelId } = payload

    const channel = yield call(getChannelFromMap, channelId)
    if (channel) {
      yield call(channel.leave)
      yield put(removeChannelAC(channelId))

      if (channel.type === CHANNEL_TYPE.PRIVATE) {
        const messageToSend: any = {
          body: 'LG',
          mentionedMembers: [],
          attachments: [],
          type: 'system'
        }
        yield put(sendTextMessageAC(messageToSend, channelId, CONNECTION_STATUS.CONNECTED))
      }
      yield put(removeChannelCachesAC(channelId))
    }
  } catch (e) {
    console.log('ERROR in leave channel - ', e.message)
    // yield put(setErrorNotification(e.message));
  }
}

function* deleteChannel(action: IAction): any {
  try {
    const { payload } = action
    const { channelId } = payload

    const channel = yield call(getChannelFromMap, channelId)
    if (channel) {
      yield call(channel.delete)

      yield put(removeChannelAC(channelId))

      yield put(removeChannelCachesAC(channelId))
    }
  } catch (e) {
    console.log('ERROR in delete channel')
    // yield put(setErrorNotification(e.message));
  }
}

function* blockChannel(action: IAction): any {
  try {
    const { payload } = action
    const { channelId } = payload

    const channel = yield call(getChannelFromMap, channelId)
    if (channel) {
      yield call(channel.block)
      yield put(removeChannelAC(channelId))

      yield put(removeChannelCachesAC(channelId))
    }
  } catch (e) {
    console.log('ERROR in block channel - ', e.message)
    // yield put(setErrorNotification(e.message));
  }
}

function* updateChannel(action: IAction): any {
  try {
    const { payload } = action
    const { channelId, config } = payload
    const SceytChatClient = getClient()
    const channel = yield call(getChannelFromMap, channelId)
    const paramsToUpdate = {
      uri: channel.uri,
      subject: channel.subject,
      label: channel.label,
      metadata: channel.metadata,
      avatarUrl: channel.avatarUrl
    }
    if (config.avatar) {
      const fileToUpload = {
        data: config.avatar,
        progress: (progressPercent: number) => {
          console.log('upload percent - ', progressPercent)
        }
      }
      paramsToUpdate.avatarUrl = yield call(SceytChatClient.chatClient.uploadFile as any, fileToUpload)
    }
    if (config.subject) {
      paramsToUpdate.subject = config.subject
    }
    if (config.metadata) {
      paramsToUpdate.metadata = JSON.stringify(config.metadata)
    }
    if (config.avatarUrl === '') {
      paramsToUpdate.avatarUrl = ''
    }
    const { subject, avatarUrl, label, metadata } = yield call(channel.update, paramsToUpdate)
    yield put(updateChannelDataAC(channelId, { subject, avatarUrl, label, metadata }))
  } catch (e) {
    console.log('ERROR in update channel', e.message)
    // yield put(setErrorNotification(e.message))
  }
}

function* checkUsersStatus(action: IAction): any {
  try {
    const { payload } = action
    const { usersMap } = payload
    const SceytChatClient = getClient()
    const usersForUpdate = Object.keys(usersMap)
    const updatedUsers = yield call(SceytChatClient.chatClient.getUsers as any, usersForUpdate)
    const usersToUpdateMap: { [key: string]: IUser } = {}
    let update: boolean = false
    updatedUsers.forEach((updatedUser: IUser) => {
      if (
        updatedUser.presence &&
        (updatedUser.presence.state !== usersMap[updatedUser.id].state ||
          updatedUser.presence.lastActiveAt !== usersMap[updatedUser.id].lastActiveAt)
      ) {
        usersToUpdateMap[updatedUser.id] = updatedUser
        update = true
      }
    })
    if (update) {
      yield put(updateUserStatusOnChannelAC(usersToUpdateMap))
    }
  } catch (e) {
    console.log('ERROR in check user status : ', e.message)
    // yield put(setErrorNotification(e.message))
  }
}

function* sendTyping(action: IAction): any {
  const {
    payload: { state }
  } = action
  const activeChannelId = yield call(getActiveChannelId)
  const channel = yield call(getChannelFromMap, activeChannelId)

  if (channel) {
    if (state) {
      yield call(channel.startTyping)
    } else {
      yield call(channel.stopTyping)
    }
  }
}

function* clearHistory(action: IAction): any {
  try {
    const { payload } = action
    const { channelId } = payload

    const channel = yield call(getChannelFromMap, channelId)
    const activeChannelId = yield call(getActiveChannelId)
    if (channel) {
      yield call(channel.deleteAllMessages, true)
      yield put(clearMessagesAC())
      removeMessagesFromMap(channelId)
      if (channelId === activeChannelId) {
        removeAllMessages()
      }
      yield put(updateChannelLastMessageAC({}, channel))
    }
  } catch (e) {
    console.log('ERROR in clear history')
    // yield put(setErrorNotification(e.message))
  }
}

function* deleteAllMessages(action: IAction): any {
  try {
    const { payload } = action
    const { channelId } = payload

    const channel = yield call(getChannelFromMap, channelId)
    const activeChannelId = yield call(getActiveChannelId)
    if (channel) {
      yield call(channel.deleteAllMessages)
      removeMessagesFromMap(channelId)
      if (channelId === activeChannelId) {
        yield put(clearMessagesAC())
        removeAllMessages()
      }
      yield put(updateChannelLastMessageAC({}, channel))
    }
  } catch (e) {
    console.log('ERROR in clear history')
    // yield put(setErrorNotification(e.message))
  }
}

function* joinChannel(action: IAction): any {
  try {
    const { payload } = action
    const { channelId } = payload

    const channel = yield call(getChannelFromMap, channelId)
    yield call(channel.join)
    yield put(getChannelsAC({ search: '' }))
    // yield put(switchChannelAction({ ...JSON.parse(JSON.stringify(channel)), myRole: updatedChannel.myRole }));
  } catch (error) {
    console.log(error, 'Error in join to channel')
    // yield put(setErrorNotification(error.message))
  }
}

function* watchForChannelEvents() {
  yield call(watchForEvents)
}

export default function* ChannelsSaga() {
  yield takeLatest(CREATE_CHANNEL, createChannel)
  yield takeLatest(GET_CHANNELS, getChannels)
  yield takeLatest(GET_CHANNELS_FOR_FORWARD, getChannelsForForward)
  yield takeLatest(LOAD_MORE_CHANNEL, channelsLoadMore)
  yield takeEvery(SWITCH_CHANNEL, switchChannel)
  yield takeLatest(LEAVE_CHANNEL, leaveChannel)
  yield takeLatest(DELETE_CHANNEL, deleteChannel)
  yield takeLatest(BLOCK_CHANNEL, blockChannel)
  yield takeLatest(UPDATE_CHANNEL, updateChannel)
  yield takeEvery(MARK_MESSAGES_AS_READ, markMessagesRead)
  yield takeLatest(MARK_MESSAGES_AS_DELIVERED, markMessagesDelivered)
  yield takeLatest(WATCH_FOR_EVENTS, watchForChannelEvents)
  yield takeLatest(TURN_OFF_NOTIFICATION, notificationsTurnOff)
  yield takeLatest(TURN_ON_NOTIFICATION, notificationsTurnOn)
  yield takeLatest(MARK_CHANNEL_AS_READ, markChannelAsRead)
  yield takeLatest(MARK_CHANNEL_AS_UNREAD, markChannelAsUnRead)
  yield takeLatest(CHECK_USER_STATUS, checkUsersStatus)
  yield takeLatest(SEND_TYPING, sendTyping)
  yield takeLatest(CLEAR_HISTORY, clearHistory)
  yield takeLatest(JOIN_TO_CHANNEL, joinChannel)
  yield takeLatest(DELETE_ALL_MESSAGES, deleteAllMessages)
  yield takeLatest(REMOVE_CHANNEL_CACHES, removeChannelCaches)
}
