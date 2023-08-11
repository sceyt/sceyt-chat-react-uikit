import { put, takeLatest, call, takeEvery } from 'redux-saga/effects'
import {
  // addChannelAC,
  addChannelsAC,
  addChannelsForForwardAC,
  channelHasNextAC,
  getChannelsAC,
  removeChannelAC,
  removeChannelCachesAC,
  setActiveChannelAC,
  setChannelsAC,
  setChannelsFroForwardAC,
  setChannelsLoadingStateAC,
  setChannelToAddAC,
  setSearchedChannelsAC,
  switchChannelActionAC,
  updateChannelDataAC,
  updateChannelLastMessageAC,
  updateUserStatusOnChannelAC
} from './actions'
import {
  BLOCK_CHANNEL,
  CLEAR_HISTORY,
  CREATE_CHANNEL,
  DELETE_ALL_MESSAGES,
  DELETE_CHANNEL,
  GET_CHANNELS,
  GET_CHANNELS_FOR_FORWARD,
  JOIN_TO_CHANNEL,
  LEAVE_CHANNEL,
  LOAD_MORE_CHANNEL,
  LOAD_MORE_CHANNELS_FOR_FORWARD,
  MARK_CHANNEL_AS_READ,
  MARK_CHANNEL_AS_UNREAD,
  MARK_MESSAGES_AS_DELIVERED,
  MARK_MESSAGES_AS_READ,
  REMOVE_CHANNEL_CACHES,
  SEARCH_CHANNELS,
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
  setChannelInMap,
  addChannelsToAllChannels,
  getAllChannels,
  getChannelFromAllChannels,
  updateChannelOnAllChannels
} from '../../helpers/channelHalper'
import { CHANNEL_TYPE, LOADING_STATE, MESSAGE_DELIVERY_STATUS } from '../../helpers/constants'
import { IAction, IChannel, IMember, IMessage } from '../../types'
import { getClient } from '../../common/client'
import {
  clearMessagesAC,
  sendTextMessageAC,
  // clearMessagesAC,
  updateMessageAC
} from '../message/actions'
import watchForEvents from '../evetns/inedx'
import { CHECK_USER_STATUS, CONNECTION_STATUS } from '../user/constants'
import { removeAllMessages, removeMessagesFromMap } from '../../helpers/messagesHalper'
import { updateMembersPresenceAC } from '../member/actions'
import { updateUserStatusOnMapAC } from '../user/actions'
import { makeUsername } from '../../helpers/message'
import { getShowOnlyContactUsers } from '../../helpers/contacts'
import { updateUserOnMap, usersMap } from '../../helpers/userHelper'

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
      createChannelData.avatarUrl = yield call(SceytChatClient.uploadFile, fileToUpload)
    }
    delete createChannelData.avatarFile
    const createdChannel = yield call(SceytChatClient.Channel.create, createChannelData)
    let checkChannelExist = false
    if (createdChannel.type === CHANNEL_TYPE.DIRECT) {
      checkChannelExist = yield call(checkChannelExists, createdChannel.id)
    }
    if (!checkChannelExist) {
      yield call(setChannelInMap, createdChannel)
      if (createdChannel.type !== CHANNEL_TYPE.DIRECT) {
        const messageToSend: any = {
          // metadata: mentionedMembersPositions,
          body:
            createdChannel.type === CHANNEL_TYPE.BROADCAST || createdChannel.type === CHANNEL_TYPE.PUBLIC ? 'CC' : 'CG',
          mentionedMembers: [],
          attachments: [],
          type: 'system'
        }
        yield put(sendTextMessageAC(messageToSend, createdChannel.id, CONNECTION_STATUS.CONNECTED))
      }
      // yield put(addChannelAC(JSON.parse(JSON.stringify(createdChannel))))
      yield put(setChannelToAddAC(JSON.parse(JSON.stringify(createdChannel))))
    }
    yield put(switchChannelActionAC(JSON.parse(JSON.stringify(createdChannel))))
    addChannelsToAllChannels(createdChannel)
    yield call(setActiveChannelId, createdChannel.id)
  } catch (e) {
    console.log(e, 'Error on create channel')
    // yield put(setErrorNotification(e.message))
  }
}

function* getChannels(action: IAction): any {
  try {
    const { payload } = action
    const { params } = payload
    const SceytChatClient = getClient()
    yield put(setChannelsLoadingStateAC(LOADING_STATE.LOADING))
    const channelQueryBuilder = new (SceytChatClient.ChannelListQueryBuilder as any)()
    if (params.filter && params.filter.channelType) {
      channelQueryBuilder.type(params.filter.channelType)
    }
    channelQueryBuilder.sortByLastMessage()
    channelQueryBuilder.limit(params.limit || 50)
    const channelQuery = yield call(channelQueryBuilder.build)
    const channelsData = yield call(channelQuery.loadNextPage)
    // console.log('channelsData. . . . . .', channelsData)
    yield put(channelHasNextAC(channelsData.hasNext))
    const channelId = yield call(getActiveChannelId)
    let activeChannel = channelId ? yield call(getChannelFromMap, channelId) : null
    yield call(destroyChannelsMap)
    let { channels: mappedChannels, channelsForUpdateLastReactionMessage } = yield call(
      setChannelsInMap,
      channelsData.channels
    )
    // console.log('channelsForUpdateLastReactionMessage . . .. ', channelsForUpdateLastReactionMessage)
    if (channelsForUpdateLastReactionMessage.length) {
      const channelMessageMap: { [key: string]: IMessage } = {}
      yield call(async () => {
        return await Promise.all(
          channelsForUpdateLastReactionMessage.map(async (channel: IChannel) => {
            return new Promise((resolve) => {
              // yield put(updateAttachmentUploadingStateAC(UPLOAD_STATE.UPLOADING, att.attachment))
              channel
                .getMessagesById([channel.newReactions![0].messageId])
                .then((messages) => {
                  channelMessageMap[channel.id] = messages[0]
                  resolve(true)
                })
                .catch((e) => {
                  console.log(e, 'Error on getMessagesById')
                  resolve(true)
                })
            })
          })
        )
      })
      mappedChannels = mappedChannels.map((channel: IChannel) => {
        if (channelMessageMap[channel.id]) {
          channel.lastReactedMessage = channelMessageMap[channel.id]
        }
        return channel
      })
    }
    /* if (!('indexedDB' in window)) {
        console.log("This browser doesn't support IndexedDB")
      } else {
        console.log('should open db with name ... . ', DB_NAME)
        const openRequest = indexedDB.open(DB_NAME, 1)
        openRequest.onupgradeneeded = function (event) {
          // срабатывает, если на клиенте нет базы данных
          // ...выполнить инициализацию...
          // версия существующей базы данных меньше 2 (или база данных не существует)
          const db = openRequest.result
          console.log('onupgradeneeded --  db. . . . ', db)
          console.log('onupgradeneeded ---  event.oldVersion. . . . ', event.oldVersion)
          if (!db.objectStoreNames.contains(DB_STORE_NAMES.CHANNELS)) {
            const objectStore = db.createObjectStore(DB_STORE_NAMES.CHANNELS, { keyPath: 'id' })
            // Create the 'channels' object store with the appropriate keyPath
            objectStore.transaction.oncomplete = () => {
              const channelObjectStore = db
                .transaction(DB_STORE_NAMES.CHANNELS, 'readwrite')
                .objectStore(DB_STORE_NAMES.CHANNELS)
              mappedChannels.forEach((channel: IChannel) => {
                const request = channelObjectStore.put(channel)
                request.onsuccess = function () {
                  console.log('channel added to db.. ', request.result)
                }

                request.onerror = function () {
                  console.log('Error on put channel to db .. ', request.error)
                }
              })
            }
            // если хранилище "books" не существует
          } else {
            console.log('channels object is exist ... ')
            const transaction = db.transaction(DB_STORE_NAMES.CHANNELS, 'readwrite')
            const channelsStore = transaction.objectStore(DB_STORE_NAMES.CHANNELS)

            mappedChannels.forEach((channel: IChannel) => {
              const request = channelsStore.put(channel)
              request.onsuccess = function () {
                console.log('channel added to db.. ', request.result)
              }

              request.onerror = function () {
                console.log('Error on put channel to db .. ', request.error)
              }
            })
          }
        }

        openRequest.onerror = function () {
          console.error('Error', openRequest.error)
        }

        openRequest.onsuccess = function () {
          const db = openRequest.result

          console.log('db  open is success.... .. ', db)
          db.onversionchange = function () {
            db.close()
            alert('The database is out of date, please reload the page.')
          }
          console.log(
            'db.objectStoreNames.contains(DB_STORE_NAMES.CHANNELS). ..  ',
            db.objectStoreNames.contains(DB_STORE_NAMES.CHANNELS)
          )
        }
        openRequest.onblocked = function () {
          // это событие не должно срабатывать, если мы правильно обрабатываем onversionchange
          // это означает, что есть ещё одно открытое соединение с той же базой данных
          // и он не был закрыт после того, как для него сработал db.onversionchange
        }
        console.log('openRequest.  . . .', openRequest)
      } */
    yield put(setChannelsAC(mappedChannels))
    if (!channelId) {
      ;[activeChannel] = channelsData.channels
    }
    query.channelQuery = channelQuery
    if (activeChannel) {
      yield put(switchChannelActionAC(JSON.parse(JSON.stringify(activeChannel))))
    }
    yield put(setChannelsLoadingStateAC(LOADING_STATE.LOADED))

    const allChannelsQueryBuilder = new (SceytChatClient.ChannelListQueryBuilder as any)()
    allChannelsQueryBuilder.sortByLastMessage()
    allChannelsQueryBuilder.limit(50)
    const allChannelsQuery = yield call(allChannelsQueryBuilder.build)
    let hasNext = true
    for (let i = 0; i <= 4; i++) {
      if (hasNext) {
        try {
          const allChannelsData = yield call(allChannelsQuery.loadNextPage)
          hasNext = allChannelsData.hasNext
          addChannelsToAllChannels(allChannelsData.channels)
        } catch (e) {
          console.log(e, 'Error on get all channels')
        }
      }
    }
  } catch (e) {
    console.log(e, 'Error on get channels')
    if (e.code !== 10008) {
      // yield put(setErrorNotification(e.message));
    }
  }
}

function* searchChannels(action: IAction): any {
  try {
    const { payload } = action
    const { params, contactsMap } = payload
    const SceytChatClient = getClient()
    const getFromContacts = getShowOnlyContactUsers()
    yield put(setChannelsLoadingStateAC(LOADING_STATE.LOADING))
    const { search: searchBy } = params
    if (searchBy) {
      const allChannels = getAllChannels()
      const groupChannels: IChannel[] = []
      const directChannels: IChannel[] = []
      const lowerCaseSearchBy = searchBy.toLowerCase()
      allChannels.forEach((channel: IChannel) => {
        if (channel.type === CHANNEL_TYPE.DIRECT) {
          const directChannelUser = channel.members.find((member) => member.id !== SceytChatClient.user.id)
          const userName = makeUsername(
            directChannelUser && contactsMap[directChannelUser.id],
            directChannelUser,
            getFromContacts
          ).toLowerCase()
          if (userName.includes(lowerCaseSearchBy)) {
            // directChannels.push(JSON.parse(JSON.stringify(channel)))
            directChannels.push(channel)
          }
        } else {
          if (channel.subject && channel.subject.toLowerCase().includes(lowerCaseSearchBy)) {
            // groupChannels.push(JSON.parse(JSON.stringify(channel)))
            groupChannels.push(channel)
          }
        }
      })
      yield put(
        setSearchedChannelsAC({
          groups: JSON.parse(JSON.stringify(groupChannels)),
          directs: JSON.parse(JSON.stringify(directChannels))
        })
      )
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
    const SceytChatClient = getClient()
    yield put(setChannelsLoadingStateAC(LOADING_STATE.LOADING, true))

    if (searchValue) {
      const directChannelQueryBuilder = new (SceytChatClient.ChannelListQueryBuilder as any)()
      directChannelQueryBuilder.type(CHANNEL_TYPE.DIRECT)
      directChannelQueryBuilder.userContains(searchValue)
      directChannelQueryBuilder.sortByLastMessage()
      directChannelQueryBuilder.limit(10)
      const directChannelQuery = yield call(directChannelQueryBuilder.build)
      const directChannelsData = yield call(directChannelQuery.loadNextPage)
      const directChannelsToAdd = directChannelsData.channels.filter((channel: IChannel) =>
        channel.members.find((member) => member.id && member.id !== SceytChatClient.user.id)
      )
      // getting other channels
      const groupChannelQueryBuilder = new (SceytChatClient.ChannelListQueryBuilder as any)()
      groupChannelQueryBuilder.subjectContains(searchValue)
      groupChannelQueryBuilder.sortByLastMessage()
      groupChannelQueryBuilder.limit(20)
      const groupChannelQuery = yield call(groupChannelQueryBuilder.build)
      const groupChannelsData = yield call(groupChannelQuery.loadNextPage)
      const groupChannelsToAdd = groupChannelsData.channels.filter((channel: IChannel) =>
        channel.type === CHANNEL_TYPE.BROADCAST ? channel.userRole === 'admin' || channel.userRole === 'owner' : true
      )
      // set all channels
      const allChannels: IChannel[] = directChannelsToAdd.concat(groupChannelsToAdd)
      const { channels: mappedChannels } = yield call(setChannelsInMap, allChannels)
      yield put(setChannelsFroForwardAC(mappedChannels))
      yield put(channelHasNextAC(false, true))
    } else {
      const channelQueryBuilder = new (SceytChatClient.ChannelListQueryBuilder as any)()
      channelQueryBuilder.sortByLastMessage()
      channelQueryBuilder.limit(20)
      const channelQuery = yield call(channelQueryBuilder.build)
      const channelsData = yield call(channelQuery.loadNextPage)
      yield put(channelHasNextAC(channelsData.hasNext, true))
      const channelsToAdd = channelsData.channels.filter((channel: IChannel) =>
        channel.type === CHANNEL_TYPE.BROADCAST
          ? channel.userRole === 'admin' || channel.userRole === 'owner'
          : channel.type === CHANNEL_TYPE.DIRECT
          ? channel.members.find((member) => member.id && member.id !== SceytChatClient.user.id)
          : true
      )
      const { channels: mappedChannels } = yield call(setChannelsInMap, channelsToAdd)
      yield put(setChannelsFroForwardAC(mappedChannels))
      query.channelQueryForward = channelQuery
    }
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
      channelQuery.limit = limit
    }
    yield put(setChannelsLoadingStateAC(LOADING_STATE.LOADING))
    const channelsData = yield call(channelQuery.loadNextPage)
    yield put(channelHasNextAC(channelsData.hasNext))
    let { channels: mappedChannels, channelsForUpdateLastReactionMessage } = yield call(
      setChannelsInMap,
      channelsData.channels
    )

    if (channelsForUpdateLastReactionMessage.length) {
      const channelMessageMap: { [key: string]: IMessage } = {}
      yield call(async () => {
        return await Promise.all(
          channelsForUpdateLastReactionMessage.map(async (channel: IChannel) => {
            return new Promise((resolve) => {
              // yield put(updateAttachmentUploadingStateAC(UPLOAD_STATE.UPLOADING, att.attachment))
              channel
                .getMessagesById([channel.newReactions![0].messageId])
                .then((messages) => {
                  channelMessageMap[channel.id] = messages[0]
                  resolve(true)
                })
                .catch((e) => {
                  console.log(e, 'Error on getMessagesById')
                  resolve(true)
                })
            })
          })
        )
      })
      mappedChannels = mappedChannels.map((channel: IChannel) => {
        if (channelMessageMap[channel.id]) {
          channel.lastReactedMessage = channelMessageMap[channel.id]
        }
        return channel
      })
    }
    yield put(addChannelsAC(mappedChannels))
    yield put(setChannelsLoadingStateAC(LOADING_STATE.LOADED))
  } catch (error) {
    console.log(error, 'Error in load more channels')
    /* if (error.code !== 10008) {
      yield put(setErrorNotification(error.message));
    } */
  }
}

function* channelsForForwardLoadMore(action: IAction): any {
  try {
    const { payload } = action
    const { limit } = payload
    const SceytChatClient = getClient()
    const { channelQueryForward } = query
    if (limit) {
      channelQueryForward.limit = limit
    }
    yield put(setChannelsLoadingStateAC(LOADING_STATE.LOADING))
    const channelsData = yield call(channelQueryForward.loadNextPage)
    yield put(channelHasNextAC(channelsData.hasNext, true))
    const channelsToAdd = channelsData.channels.filter((channel: IChannel) =>
      channel.type === CHANNEL_TYPE.BROADCAST
        ? channel.userRole === 'admin' || channel.userRole === 'owner'
        : channel.type === CHANNEL_TYPE.DIRECT
        ? channel.members.find((member) => member.id && member.id !== SceytChatClient.user.id)
        : true
    )
    const { channels: mappedChannels } = yield call(setChannelsInMap, channelsToAdd)
    yield put(addChannelsForForwardAC(mappedChannels))
    yield put(setChannelsLoadingStateAC(LOADING_STATE.LOADED))
  } catch (error) {
    console.log(error, 'Error in load more channels for forward')
    /* if (error.code !== 10008) {
      yield put(setErrorNotification(error.message));
    } */
  }
}

function* markMessagesRead(action: IAction): any {
  const { payload } = action
  const { channelId, messageIds } = payload
  let channel = yield call(getChannelFromMap, channelId)
  if (!channel) {
    channel = getChannelFromAllChannels(channelId)
    setChannelInMap(channel)
  }
  // const activeChannelId = yield call(getActiveChannelId)
  if (channel) {
    const messageListMarker = yield call(channel.markMessagesAsDisplayed, messageIds)
    // use updateChannelDataAC already changes unreadMessageCount no need in setChannelUnreadCount
    // yield put(setChannelUnreadCount(0, channel.id));
    yield put(
      updateChannelDataAC(channel.id, {
        unread: channel.unread,
        lastReadMessageId: channel.lastDisplayedMsgId,
        unreadMessageCount: channel.newMessageCount
      })
    )
    for (const messageId of messageListMarker.messageIds) {
      yield put(
        updateMessageAC(messageId, {
          deliveryStatus: MESSAGE_DELIVERY_STATUS.READ,
          userMarkers: [
            {
              user: messageListMarker.user,
              createdAt: messageListMarker.createAt,
              messageId,
              name: MESSAGE_DELIVERY_STATUS.READ
            }
          ]
        })
      )
    }

    /* if (channelId === activeChannelId) {
      yield put(
        updateChannelDataAC(channel.id, {
          markedAsUnread: channel.unread,
          lastReadMessageId: channel.lastDisplayedMsgId,
          unreadMessageCount: channel.newMessageCount
        })
      )
    } else {
      yield put(
        updateChannelDataAC(channel.id, {
          markedAsUnread: channel.unread,
          lastReadMessageId: channel.lastDisplayedMsgId
        })
      )
    } */
  }
}

function* markMessagesDelivered(action: IAction): any {
  const { payload } = action
  const { channelId, messageIds } = payload
  try {
    let channel = yield call(getChannelFromMap, channelId)
    if (!channel) {
      channel = getChannelFromAllChannels(channelId)
      setChannelInMap(channel)
    }

    if (channel) {
      yield call(channel.markMessagesAsReceived, messageIds)
    }
  } catch (e) {
    console.log(e, 'Error on mark messages delivered')
  }
}

function* switchChannel(action: IAction) {
  try {
    const { payload } = action
    const { channel } = payload
    const existingChannel = checkChannelExists(channel.id)
    if (!existingChannel) {
      const addChannel = getChannelFromAllChannels(channel.id)
      if (addChannel) {
        setChannelInMap(addChannel)
      }
    }
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
        mutedTill: updatedChannel.mutedTill
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
        mutedTill: updatedChannel.mutedTill
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
    let channel = yield call(getChannelFromMap, channelId)
    if (!channel) {
      channel = getChannelFromAllChannels(channelId)
    }
    const updatedChannel = yield call(channel.markAsRead)
    updateChannelOnAllChannels(channel.id, { ...updatedChannel })
    yield put(updateChannelDataAC(channel.id, { ...updatedChannel }))
  } catch (error) {
    console.log(error, 'Error in set channel unread')
    // yield put(setErrorNotification(error.message));
  }
}

function* markChannelAsUnRead(action: IAction): any {
  try {
    const { channelId } = action.payload
    let channel = yield call(getChannelFromMap, channelId)
    if (!channel) {
      channel = getChannelFromAllChannels(channelId)
    }

    const updatedChannel = yield call(channel.markAsUnRead)
    updateChannelOnAllChannels(channel.id, { ...updatedChannel })
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

    let channel = yield call(getChannelFromMap, channelId)
    if (!channel) {
      channel = getChannelFromAllChannels(channelId)
    }
    if (channel) {
      if (channel.type === CHANNEL_TYPE.GROUP) {
        const messageBuilder = channel.createMessageBuilder()
        messageBuilder.setBody('LG').setType('system').setDisplayCount(0).setSilent(true)
        const messageToSend = messageBuilder.create()

        if (CONNECTION_STATUS.CONNECTED) {
          console.log('send message for left')
          yield call(channel.sendMessage, messageToSend)
        }
        // yield put(sendTextMessageAC(messageToSend, channelId, CONNECTION_STATUS.CONNECTED))
      }
      console.log('leave')
      yield call(channel.leave)
      yield put(removeChannelAC(channelId))

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

    let channel = yield call(getChannelFromMap, channelId)
    if (!channel) {
      channel = getChannelFromAllChannels(channelId)
    }
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

    let channel = yield call(getChannelFromMap, channelId)
    if (!channel) {
      channel = getChannelFromAllChannels(channelId)
    }
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
    let channel = yield call(getChannelFromMap, channelId)
    if (!channel) {
      channel = getChannelFromAllChannels(channelId)
    }
    const paramsToUpdate = {
      uri: channel.uri,
      subject: channel.subject,
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
      paramsToUpdate.avatarUrl = yield call(SceytChatClient.uploadFile as any, fileToUpload)
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
    const { subject, avatarUrl, metadata } = yield call(channel.update, paramsToUpdate)
    yield put(updateChannelDataAC(channelId, { subject, avatarUrl, metadata: JSON.parse(metadata) }))
  } catch (e) {
    console.log('ERROR in update channel', e.message)
    // yield put(setErrorNotification(e.message))
  }
}

function* checkUsersStatus(/* action: IAction */): any {
  try {
    // const { payload } = action
    // const { usersMap } = payload
    const SceytChatClient = getClient()
    const usersForUpdate = Object.keys(usersMap)
    const activeChannelId = getActiveChannelId()
    const activeChannel = getChannelFromMap(activeChannelId)
    let activeChannelUser: any
    if (activeChannel && activeChannel.type === CHANNEL_TYPE.DIRECT) {
      activeChannelUser = activeChannel.members.find((member) => member.id !== SceytChatClient.user.id)
    }
    const updatedUsers = yield call(SceytChatClient.getUsers as any, usersForUpdate)
    const usersToUpdateMap: { [key: string]: IMember } = {}
    let update: boolean = false
    updatedUsers.forEach((updatedUser: IMember) => {
      if (activeChannelUser && activeChannelUser.id === updatedUser.id) {
        console.log('active channel user is updated - ', updatedUser)
      }
      if (
        updatedUser.presence &&
        (updatedUser.presence.state !== usersMap[updatedUser.id].state ||
          (updatedUser.presence.lastActiveAt &&
            new Date(updatedUser.presence.lastActiveAt).getTime() !==
              new Date(usersMap[updatedUser.id].lastActiveAt).getTime()))
      ) {
        updateUserOnMap(updatedUser)
        usersToUpdateMap[updatedUser.id] = updatedUser
        update = true
      }
    })
    if (update) {
      console.log('update users presence - - --', usersToUpdateMap)
      yield put(updateMembersPresenceAC(Object.values(usersToUpdateMap)))
      yield put(updateUserStatusOnMapAC(usersToUpdateMap))
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

    let channel = yield call(getChannelFromMap, channelId)
    if (!channel) {
      channel = getChannelFromAllChannels(channelId)
    }
    const activeChannelId = yield call(getActiveChannelId)
    if (channel) {
      yield call(channel.deleteAllMessages)
      yield put(clearMessagesAC())
      removeMessagesFromMap(channelId)
      if (channelId === activeChannelId) {
        removeAllMessages()
      }
      yield put(updateChannelDataAC(channel.id, { lastMessage: null, unreadMessageCount: 0 }))
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

    let channel = yield call(getChannelFromMap, channelId)
    if (!channel) {
      channel = getChannelFromAllChannels(channelId)
    }
    const activeChannelId = yield call(getActiveChannelId)
    if (channel) {
      yield call(channel.deleteAllMessages, true)
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

    let channel = yield call(getChannelFromMap, channelId)
    if (!channel) {
      channel = getChannelFromAllChannels(channelId)
    }
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
  yield takeLatest(SEARCH_CHANNELS, searchChannels)
  yield takeLatest(GET_CHANNELS_FOR_FORWARD, getChannelsForForward)
  yield takeLatest(LOAD_MORE_CHANNEL, channelsLoadMore)
  yield takeLatest(LOAD_MORE_CHANNELS_FOR_FORWARD, channelsForForwardLoadMore)
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
