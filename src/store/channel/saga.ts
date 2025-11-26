import { put, takeLatest, call, takeEvery } from 'redux-saga/effects'
import { v4 as uuidv4 } from 'uuid'
import {
  addChannelAC,
  addChannelsAC,
  addChannelsForForwardAC,
  channelHasNextAC,
  removeChannelAC,
  removeChannelCachesAC,
  setActiveChannelAC,
  setChannelInviteKeysAC,
  setChannelsAC,
  setChannelsForForwardAC,
  setChannelsLoadingStateAC,
  setChannelToAddAC,
  setChannelToRemoveAC,
  setCloseSearchChannelsAC,
  setSearchedChannelsAC,
  setSearchedChannelsForForwardAC,
  switchChannelActionAC,
  updateChannelDataAC,
  updateSearchedChannelDataAC,
  updateUserStatusOnChannelAC,
  setJoinableChannelAC
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
  PIN_CHANNEL,
  UNPIN_CHANNEL,
  REMOVE_CHANNEL_CACHES,
  SEARCH_CHANNELS,
  SEARCH_CHANNELS_FOR_FORWARD,
  SEND_TYPING,
  SWITCH_CHANNEL,
  TURN_OFF_NOTIFICATION,
  TURN_ON_NOTIFICATION,
  UPDATE_CHANNEL,
  WATCH_FOR_EVENTS,
  SEND_RECORDING,
  GET_CHANNEL_MENTIONS,
  MARK_VOICE_MESSAGE_AS_PLAYED,
  CREATE_CHANNEL_INVITE_KEY,
  GET_CHANNEL_INVITE_KEYS,
  REGENERATE_CHANNEL_INVITE_KEY,
  UPDATE_CHANNEL_INVITE_KEY,
  GET_CHANNEL_BY_INVITE_KEY,
  JOIN_TO_CHANNEL_WITH_INVITE_KEY,
  SET_MESSAGE_RETENTION_PERIOD
} from './constants'
import {
  destroyChannelsMap,
  setChannelsInMap,
  query,
  getActiveChannelId,
  getChannelFromMap,
  setActiveChannelId,
  removeChannelFromMap,
  getLastChannelFromMap,
  checkChannelExists,
  setChannelInMap,
  addChannelsToAllChannels,
  getAllChannels,
  getChannelFromAllChannels,
  updateChannelOnAllChannels,
  deleteChannelFromAllChannels,
  getChannelGroupName,
  getAutoSelectFitsChannel,
  getChannelTypesFilter,
  addChannelToAllChannels,
  getOnUpdateChannel
} from '../../helpers/channelHalper'
import { DEFAULT_CHANNEL_TYPE, LOADING_STATE, MESSAGE_DELIVERY_STATUS } from '../../helpers/constants'
import { IAction, IChannel, IContact, IMember, IMessage } from '../../types'
import { getClient } from '../../common/client'
import {
  clearMessagesAC,
  clearSelectedMessagesAC,
  sendTextMessageAC,
  setUnreadScrollToAC,
  // clearMessagesAC,
  updateMessageAC
} from '../message/actions'
import watchForEvents from '../evetns/inedx'
import { CHECK_USER_STATUS, CONNECTION_STATUS } from '../user/constants'
import {
  removeAllMessages,
  removeMessagesFromMap,
  updateMessageOnAllMessages,
  updateMessageOnMap
} from '../../helpers/messagesHalper'
import { updateMembersPresenceAC } from '../member/actions'
import { updateUserStatusOnMapAC } from '../user/actions'
import { isJSON, makeUsername } from '../../helpers/message'
import { getShowOnlyContactUsers } from '../../helpers/contacts'
import { updateUserOnMap, usersMap } from '../../helpers/userHelper'
import log from 'loglevel'
import { queryDirection } from 'store/message/constants'
import store from 'store'

function* createChannel(action: IAction): any {
  try {
    const { payload } = action
    const { channelData, dontCreateIfNotExists, callback } = payload
    const SceytChatClient = getClient()
    const createChannelData = { ...channelData }
    if (createChannelData.avatarFile) {
      const fileToUpload = {
        data: createChannelData.avatarFile,
        progress: (progressPercent: number) => {
          log.info('upload percent - ', progressPercent)
        }
      }
      createChannelData.avatarUrl = yield call(SceytChatClient.uploadFile, fileToUpload)
    }
    let isSelfChannel = false
    if (channelData.type === DEFAULT_CHANNEL_TYPE.DIRECT && channelData.members[0].id === SceytChatClient.user.id) {
      isSelfChannel = true
      createChannelData.metadata = { s: 1 }
    }
    delete createChannelData.avatarFile
    let channelIsExistOnAllChannels = false
    let createdChannel: IChannel
    if (channelData.type === DEFAULT_CHANNEL_TYPE.DIRECT && dontCreateIfNotExists) {
      const allChannels = getAllChannels()
      const memberId = channelData.members[0].id
      allChannels.forEach((channel: IChannel) => {
        if (channel.type === DEFAULT_CHANNEL_TYPE.DIRECT) {
          if (isSelfChannel) {
            if (channel.members?.length === 1 && channel.members[0].id === memberId) {
              channelIsExistOnAllChannels = true
            }
          } else {
            const directChannelUser = channel.members.find((member) => member.id === memberId)
            if (directChannelUser) {
              channelIsExistOnAllChannels = true
            }
          }
        }
      })
      if (channelIsExistOnAllChannels) {
        createdChannel = yield call(SceytChatClient.Channel.create, createChannelData)
      } else {
        createdChannel = {
          ...channelData,
          isMockChannel: true,
          avatarUrl: '',
          createdAt: new Date(Date.now()),
          hidden: false,
          id: uuidv4(),
          lastMessage: null,
          memberCount: 2,
          metadata: '',
          newMentionCount: 0,
          newMessageCount: 0,
          newReactedMessageCount: 0,
          muted: false,
          subject: '',
          userRole: 'owner'
        }
      }
    } else {
      createdChannel = yield call(SceytChatClient.Channel.create, createChannelData)
    }
    let checkChannelExist = false
    if (createdChannel.type === DEFAULT_CHANNEL_TYPE.DIRECT) {
      checkChannelExist = yield call(checkChannelExists, createdChannel.id)
    }
    createdChannel.metadata = isJSON(createdChannel.metadata)
      ? JSON.parse(createdChannel.metadata)
      : createdChannel.metadata
    if (!checkChannelExist) {
      yield call(setChannelInMap, createdChannel)
      if (createdChannel.type !== DEFAULT_CHANNEL_TYPE.DIRECT) {
        const messageToSend: any = {
          // metadata: mentionedUsersPositions,
          body:
            createdChannel.type === DEFAULT_CHANNEL_TYPE.BROADCAST ||
            createdChannel.type === DEFAULT_CHANNEL_TYPE.PUBLIC
              ? 'CC'
              : 'CG',
          mentionedUsers: [],
          attachments: [],
          type: 'system'
        }
        yield put(sendTextMessageAC(messageToSend, createdChannel.id, CONNECTION_STATUS.CONNECTED))
      }
      // yield put(addChannelAC(JSON.parse(JSON.stringify(createdChannel))))
      if (!dontCreateIfNotExists || channelIsExistOnAllChannels) {
        yield put(setChannelToAddAC(JSON.parse(JSON.stringify(createdChannel))))
      }
    }
    yield put(
      switchChannelActionAC(
        JSON.parse(JSON.stringify({ ...createdChannel, isLinkedChannel: dontCreateIfNotExists })),
        !callback
      )
    )
    if (dontCreateIfNotExists) {
      if (!channelIsExistOnAllChannels) {
        addChannelToAllChannels(createdChannel)
      }
    } else {
      const allChannels = getAllChannels()
      const memberId = channelData.members[0].id
      allChannels.forEach((channel: IChannel) => {
        if (channel.type === DEFAULT_CHANNEL_TYPE.DIRECT) {
          if (isSelfChannel) {
            const meta = isJSON(channel.metadata) ? JSON.parse(channel.metadata) : channel.metadata
            if (meta?.s) {
              channelIsExistOnAllChannels = true
            }
          } else {
            const directChannelUser = channel.members.find((member) => member.id === memberId)
            if (directChannelUser) {
              channelIsExistOnAllChannels = true
            }
          }
        }
      })
      if (!channelIsExistOnAllChannels) {
        addChannelToAllChannels(createdChannel)
      }
    }
    if (callback) {
      callback(createdChannel)
    } else {
      yield call(setActiveChannelId, createdChannel.id)
    }
  } catch (e) {
    log.error(e, 'Error on create channel')
    // yield put(setErrorNotification(e.message))
  }
}

function* getChannels(action: IAction): any {
  log.info('[getChannels] start get channels')
  try {
    const { payload } = action
    const { params } = payload
    log.info('[getChannels] input params:', JSON.stringify(params))
    const SceytChatClient = getClient()
    const connectionStatus = store.getState().UserReducer.connectionStatus
    log.info('[getChannels] connection status:', connectionStatus)
    if (connectionStatus !== CONNECTION_STATUS.CONNECTED) {
      log.warn('[getChannels] connection not ready, aborting. Status:', connectionStatus)
      return
    }
    yield put(setChannelsLoadingStateAC(LOADING_STATE.LOADING))
    const channelQueryBuilder = new (SceytChatClient.ChannelListQueryBuilder as any)()
    const channelTypesFilter = getChannelTypesFilter()
    log.info('[getChannels] channelTypesFilter:', JSON.stringify(channelTypesFilter))
    let types: string[] = []
    if (channelTypesFilter?.length) {
      types = channelTypesFilter
    }
    if (params?.filter?.channelType) {
      types.push(params.filter.channelType)
    }
    log.info('[getChannels] final types array:', JSON.stringify(types))
    if (types?.length) {
      channelQueryBuilder.types(types)
    }
    if (params.memberCount) {
      log.info('[getChannels] setting memberCount filter:', params?.memberCount)
      channelQueryBuilder.memberCount(params.memberCount)
    }
    channelQueryBuilder.order('lastMessage')
    const limit = params.limit || 50
    log.info('[getChannels] query limit:', limit)
    channelQueryBuilder.limit(limit)
    const channelQuery = yield call(channelQueryBuilder.build)
    log.info('[getChannels] query built successfully')
    const channelsData = yield call(channelQuery.loadNextPage)
    const channelList = channelsData.channels
    log.info(
      '[getChannels] channelsData received:',
      JSON.stringify({
        channelsCount: channelList?.length || 0,
        hasNext: channelsData.hasNext
      })
    )
    yield put(channelHasNextAC(channelsData.hasNext))
    const channelId = yield call(getActiveChannelId)
    log.info('[getChannels] active channelId:', channelId)
    let activeChannel = channelId ? yield call(getChannelFromMap, channelId) : null
    log.info('[getChannels] activeChannel from map:', activeChannel ? activeChannel?.id : 'null')
    yield call(destroyChannelsMap)
    log.info('[getChannels] channels map destroyed')

    let { channels: mappedChannels, channelsForUpdateLastReactionMessage } = yield call(setChannelsInMap, channelList)
    log.info(
      '[getChannels] setChannelsInMap result:',
      JSON.stringify({
        mappedChannelsCount: mappedChannels?.length || 0,
        channelsForUpdateLastReactionMessageCount: channelsForUpdateLastReactionMessage?.length || 0
      })
    )
    log.info('channelsForUpdateLastReactionMessage', channelsForUpdateLastReactionMessage?.length)
    if (channelsForUpdateLastReactionMessage?.length) {
      log.info(
        '[getChannels] processing channels for reaction message update:',
        channelsForUpdateLastReactionMessage?.length
      )
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
                  log.info('[getChannels] successfully fetched reaction message for channel:', channel?.id)
                  resolve(true)
                })
                .catch((e) => {
                  log.error(e, 'Error on getMessagesById for channel:', channel?.id)
                  resolve(true)
                })
            })
          })
        )
      })
      log.info(
        '[getChannels] reaction messages fetched:',
        channelMessageMap ? Object.keys(channelMessageMap)?.length : 0
      )
      mappedChannels = mappedChannels.map((channel: IChannel) => {
        if (channelMessageMap[channel.id]) {
          channel.lastReactedMessage = channelMessageMap[channel.id]
        }
        return channel
      })
      log.info('[getChannels] mappedChannels updated with reaction messages, final count:', mappedChannels?.length || 0)
    }
    log.info('[getChannels] setting channels in state, count:', mappedChannels?.length || 0)
    yield put(setChannelsAC(mappedChannels))
    if (!channelId) {
      ;[activeChannel] = channelList
      log.info('[getChannels] no active channelId, setting first channel as active:', activeChannel?.id)
    }
    query.channelQuery = channelQuery
    if (activeChannel && getAutoSelectFitsChannel()) {
      log.info('[getChannels] auto-selecting channel:', activeChannel?.id)
      yield put(switchChannelActionAC(JSON.parse(JSON.stringify(activeChannel))))
    }
    yield put(setChannelsLoadingStateAC(LOADING_STATE.LOADED))
    const hiddenList = store.getState().ChannelReducer.hideChannelList
    log.info('[getChannels] hiddenList state:', hiddenList)
    if (!hiddenList) {
      log.info('[getChannels] starting all channels query (hiddenList is false)')
      const allChannelsQueryBuilder = new (SceytChatClient.ChannelListQueryBuilder as any)()
      allChannelsQueryBuilder.order('lastMessage')
      if (channelTypesFilter?.length) {
        allChannelsQueryBuilder.types(channelTypesFilter)
        log.info('[getChannels] allChannelsQuery types:', JSON.stringify(channelTypesFilter))
      }
      if (params?.memberCount) {
        allChannelsQueryBuilder.memberCount(params.memberCount)
        log.info('[getChannels] allChannelsQuery memberCount:', params?.memberCount)
      }
      allChannelsQueryBuilder.limit(50)
      const allChannelsQuery = yield call(allChannelsQueryBuilder.build)
      log.info('[getChannels] allChannelsQuery built')
      let hasNext = true
      let totalAllChannelsAdded = 0
      for (let i = 0; i <= 4; i++) {
        if (hasNext) {
          try {
            const connectionStatus = store.getState().UserReducer.connectionStatus
            if (connectionStatus !== CONNECTION_STATUS.CONNECTED) {
              log.warn('[getChannels] connection not ready, aborting. Status:', connectionStatus)
              break
            }
            log.info('[getChannels] loading all channels page:', i + 1)
            const allChannelsData = yield call(allChannelsQuery.loadNextPage)
            hasNext = allChannelsData.hasNext
            const allChannelList = allChannelsData.channels
            log.info(
              '[getChannels] all channels page',
              i + 1,
              'loaded:',
              JSON.stringify({
                channelsCount: allChannelList?.length || 0,
                hasNext
              })
            )
            addChannelsToAllChannels(allChannelList)
            totalAllChannelsAdded += allChannelList?.length || 0
            log.info('[getChannels] total all channels added so far:', totalAllChannelsAdded)
          } catch (e) {
            log.error(e, 'Error on get all channels page:', i + 1)
            break
          }
        } else {
          log.info('[getChannels] no more pages available, stopping at iteration:', i)
        }
      }
      log.info('[getChannels] all channels query completed, total channels added:', totalAllChannelsAdded)
    } else {
      log.info('[getChannels] skipping all channels query (hiddenList is true)')
    }
    log.info('[getChannels] completed successfully. Final mapped channels count:', mappedChannels?.length || 0)
  } catch (e) {
    log.error('[getChannels] error occurred:', JSON.stringify(e), 'Error on get channels')
    log.error('[getChannels] error details:', {
      message: e.message,
      code: e.code,
      stack: e.stack
    })
    if (e.code !== 10008) {
      // yield put(setErrorNotification(e.message));
    }
  }
}

function* searchChannels(action: IAction): any {
  try {
    const { payload } = action
    const { params, contactsMap } = payload
    log.info('search channel payload: ', payload)
    const SceytChatClient = getClient()
    const getFromContacts = getShowOnlyContactUsers()
    yield put(setChannelsLoadingStateAC(LOADING_STATE.LOADING))
    const { search: searchBy } = params
    if (searchBy) {
      const channelQueryBuilder = new (SceytChatClient.ChannelListQueryBuilder as any)()
      const channelTypesFilter = getChannelTypesFilter()
      let types: string[] = []
      if (channelTypesFilter?.length) {
        types = channelTypesFilter
      }
      if (params?.filter?.channelType) {
        types.push(params.filter.channelType)
      }
      if (types?.length) {
        channelQueryBuilder.types(types)
      }
      if (params?.memberCount) {
        channelQueryBuilder.memberCount(params.memberCount)
      }
      const allChannels = getAllChannels()
      let publicChannels: IChannel[] = []
      let chatsGroups: IChannel[] = []
      const contactsList: IContact[] = []
      const contactsWithChannelsMap: { [key: string]: boolean } = {}
      const lowerCaseSearchBy = searchBy.toLowerCase()
      // const publicChannelsMap: { [key: string]: boolean } = {}
      const handleChannels = (channels: IChannel[]) => {
        channels.forEach((channel: IChannel) => {
          if (channel.type === DEFAULT_CHANNEL_TYPE.DIRECT) {
            channel.metadata = isJSON(channel.metadata) ? JSON.parse(channel.metadata) : channel.metadata
            const isSelfChannel =
              channel.memberCount === 1 &&
              channel.members.length > 0 &&
              channel.members[0].id === SceytChatClient.user.id
            const directChannelUser = isSelfChannel
              ? SceytChatClient.user
              : channel.members.find((member) => member.id !== SceytChatClient.user.id)
            if (directChannelUser && contactsMap[directChannelUser.id]) {
              contactsWithChannelsMap[directChannelUser.id] = true
            }
            const userName = makeUsername(
              directChannelUser && contactsMap[directChannelUser.id],
              directChannelUser,
              getFromContacts
            ).toLowerCase()
            if (
              userName.includes(lowerCaseSearchBy) ||
              (isSelfChannel && 'me'.includes(lowerCaseSearchBy)) ||
              (isSelfChannel && 'you'.includes(lowerCaseSearchBy))
            ) {
              // directChannels.push(JSON.parse(JSON.stringify(channel)))
              chatsGroups.push(channel)
            }
          } else {
            if (channel.subject && channel.subject.toLowerCase().includes(lowerCaseSearchBy)) {
              if (channel.type === DEFAULT_CHANNEL_TYPE.PUBLIC || channel.type === DEFAULT_CHANNEL_TYPE.BROADCAST) {
                // publicChannelsMap[channel.id] = true
                publicChannels.push(channel)
              } else {
                chatsGroups.push(channel)
              }
              // groupChannels.push(JSON.parse(JSON.stringify(channel)))
            }
          }
        })
      }
      const channelsMap: { [key: string]: IChannel } = {}
      for (const channel of allChannels) {
        channelsMap[channel.id] = channel
      }
      handleChannels(allChannels)
      if (getFromContacts) {
        Object.values(contactsMap).forEach((contact: IContact) => {
          if (!contactsWithChannelsMap[contact.id]) {
            const userName = makeUsername(contact, undefined, true).toLowerCase()
            if (userName.includes(lowerCaseSearchBy)) {
              contactsList.push(contact)
            }
          }
        })
      }
      yield put(
        setSearchedChannelsAC({
          chats_groups: JSON.parse(JSON.stringify(chatsGroups)),
          channels: JSON.parse(JSON.stringify(publicChannels)),
          contacts: JSON.parse(JSON.stringify(contactsList))
        })
      )
      yield put(setChannelsLoadingStateAC(LOADING_STATE.LOADED))
      channelQueryBuilder.query(lowerCaseSearchBy)
      channelQueryBuilder.limit(params.limit || 50)
      channelQueryBuilder.order('lastMessage')
      channelQueryBuilder.filterKey(['subject'])
      channelQueryBuilder.searchOperator('contains')
      const channelQuery = yield call(channelQueryBuilder.build)
      const channelsData = yield call(channelQuery.loadNextPage)
      for (const channel of channelsData.channels) {
        channelsMap[channel.id] = channel
      }
      chatsGroups = []
      publicChannels = []
      handleChannels(Object.values(channelsMap))
      /* const channelsToAdd = channelsData.channels.filter((channel: IChannel) => {
        return (
          (channel.type === CHANNEL_TYPE.PUBLIC || channel.type === CHANNEL_TYPE.BROADCAST) &&
          !publicChannelsMap[channel.id]
        )
      }) */
      const channelsToAdd = channelsData.channels.filter(
        (channel: IChannel) =>
          channel.type === DEFAULT_CHANNEL_TYPE.PUBLIC || channel.type === DEFAULT_CHANNEL_TYPE.BROADCAST
      )
      yield put(
        setSearchedChannelsAC({
          chats_groups: JSON.parse(JSON.stringify(chatsGroups)),
          channels: JSON.parse(JSON.stringify(channelsToAdd)),
          contacts: JSON.parse(JSON.stringify(contactsList))
        })
      )
      /* yield put(
        setSearchedChannelsAC({
          groups: JSON.parse(
            JSON.stringify(
              [...channelsData.channels, ...groupChannels]
                .sort(
                  (a, b) =>
                    (a.lastMessage ? a.lastMessage.createdAt : a.createdAt) -
                    (b.lastMessage ? b.lastMessage.createdAt : b.createdAt)
                )
                .reverse()
            )
          ),
          // groups: JSON.parse(JSON.stringify(groupChannels)),
          directs: JSON.parse(JSON.stringify(directChannels))
        })
      ) */
    }
  } catch (e) {
    log.error(e, 'Error on get channels')
    if (e.code !== 10008) {
      // yield put(setErrorNotification(e.message));
    }
  }
}

function* getChannelsForForward(): any {
  try {
    const SceytChatClient = getClient()
    yield put(setChannelsLoadingStateAC(LOADING_STATE.LOADING, true))

    const channelQueryBuilder = new (SceytChatClient.ChannelListQueryBuilder as any)()
    const channelTypesFilter = getChannelTypesFilter()
    channelQueryBuilder.order('lastMessage')
    if (channelTypesFilter?.length) {
      channelQueryBuilder.types(channelTypesFilter)
    }
    channelQueryBuilder.limit(20)
    const channelQuery = yield call(channelQueryBuilder.build)
    const channelsData = yield call(channelQuery.loadNextPage)
    yield put(channelHasNextAC(channelsData.hasNext, true))
    const channelsToAdd = channelsData.channels.filter((channel: IChannel) => {
      channel.metadata = isJSON(channel.metadata) ? JSON.parse(channel.metadata) : channel.metadata
      const isSelfChannel =
        channel.memberCount === 1 && channel.members.length > 0 && channel.members[0].id === SceytChatClient.user.id
      return channel.type === DEFAULT_CHANNEL_TYPE.BROADCAST || channel.type === DEFAULT_CHANNEL_TYPE.PUBLIC
        ? channel.userRole === 'admin' || channel.userRole === 'owner'
        : channel.type === DEFAULT_CHANNEL_TYPE.DIRECT
          ? isSelfChannel || channel.members.find((member) => member.id && member.id !== SceytChatClient.user.id)
          : true
    })
    const { channels: mappedChannels } = yield call(setChannelsInMap, channelsToAdd)
    yield put(setChannelsForForwardAC(mappedChannels))
    query.channelQueryForward = channelQuery
    yield put(setChannelsLoadingStateAC(LOADING_STATE.LOADED, true))
  } catch (e) {
    log.error(e, 'Error on get for forward channels')
    if (e.code !== 10008) {
      // yield put(setErrorNotification(e.message));
    }
  }
}

function* searchChannelsForForward(action: IAction): any {
  try {
    const { payload } = action
    const { params, contactsMap } = payload
    const SceytChatClient = getClient()
    const getFromContacts = getShowOnlyContactUsers()
    yield put(setChannelsLoadingStateAC(LOADING_STATE.LOADING, true))
    const { search: searchBy } = params
    if (searchBy) {
      const channelQueryBuilder = new (SceytChatClient.ChannelListQueryBuilder as any)()
      const channelTypesFilter = getChannelTypesFilter()
      let types: string[] = []
      if (channelTypesFilter?.length) {
        types = channelTypesFilter
      }
      if (params?.filter?.channelType) {
        types.push(params.filter.channelType)
      }
      if (types?.length) {
        channelQueryBuilder.types(types)
      }

      const allChannels = getAllChannels()
      let publicChannels: IChannel[] = []
      let chatsGroups: IChannel[] = []
      const contactsList: IContact[] = []
      const contactsWithChannelsMap: { [key: string]: boolean } = {}
      const lowerCaseSearchBy = searchBy.toLowerCase()
      const handleChannels = (channels: IChannel[]) => {
        channels.forEach((channel: IChannel) => {
          if (channel.type === DEFAULT_CHANNEL_TYPE.DIRECT) {
            channel.metadata = isJSON(channel.metadata) ? JSON.parse(channel.metadata) : channel.metadata
            const isSelfChannel =
              channel.memberCount === 1 &&
              channel.members.length > 0 &&
              channel.members[0].id === SceytChatClient.user.id
            const directChannelUser = isSelfChannel
              ? SceytChatClient.user
              : channel.members.find((member) => member.id !== SceytChatClient.user.id)
            if (directChannelUser && contactsMap[directChannelUser.id]) {
              contactsWithChannelsMap[directChannelUser.id] = true
            }
            const userName = makeUsername(
              directChannelUser && contactsMap[directChannelUser.id],
              directChannelUser,
              getFromContacts
            ).toLowerCase()
            if (
              userName.includes(lowerCaseSearchBy) ||
              (isSelfChannel && 'me'.includes(lowerCaseSearchBy)) ||
              (isSelfChannel && 'you'.includes(lowerCaseSearchBy))
            ) {
              // directChannels.push(JSON.parse(JSON.stringify(channel)))
              chatsGroups.push(channel)
            }
          } else {
            if (channel.subject && channel.subject.toLowerCase().includes(lowerCaseSearchBy)) {
              if (channel.type === DEFAULT_CHANNEL_TYPE.PUBLIC || channel.type === DEFAULT_CHANNEL_TYPE.BROADCAST) {
                publicChannels.push(channel)
              } else {
                chatsGroups.push(channel)
              }
              // groupChannels.push(JSON.parse(JSON.stringify(channel)))
            }
          }
        })
      }
      const channelsMap: { [key: string]: IChannel } = {}
      for (const channel of allChannels) {
        channelsMap[channel.id] = channel
      }
      handleChannels(allChannels)
      if (getFromContacts) {
        Object.values(contactsMap).forEach((contact: IContact) => {
          if (!contactsWithChannelsMap[contact.id]) {
            const userName = makeUsername(contact, undefined, true).toLowerCase()
            if (userName.includes(lowerCaseSearchBy)) {
              contactsList.push(contact)
            }
          }
        })
      }
      yield put(
        setSearchedChannelsForForwardAC({
          chats_groups: JSON.parse(JSON.stringify(chatsGroups)),
          channels: JSON.parse(JSON.stringify(publicChannels)),
          contacts: JSON.parse(JSON.stringify(contactsList))
        })
      )
      yield put(setChannelsLoadingStateAC(LOADING_STATE.LOADED, true))
      channelQueryBuilder.query(lowerCaseSearchBy)
      channelQueryBuilder.limit(params.limit || 50)
      channelQueryBuilder.order('lastMessage')
      channelQueryBuilder.filterKey(['subject'])
      channelQueryBuilder.searchOperator('contains')
      const channelQuery = yield call(channelQueryBuilder.build)
      const channelsData = yield call(channelQuery.loadNextPage)
      for (const channel of channelsData.channels) {
        channelsMap[channel.id] = channel
      }
      chatsGroups = []
      publicChannels = []
      handleChannels(Object.values(channelsMap))
      const channelsToAdd = channelsData.channels.filter(
        (channel: IChannel) =>
          channel.type === DEFAULT_CHANNEL_TYPE.PUBLIC || channel.type === DEFAULT_CHANNEL_TYPE.BROADCAST
      )
      yield put(
        setSearchedChannelsForForwardAC({
          chats_groups: JSON.parse(JSON.stringify(chatsGroups)),
          channels: JSON.parse(JSON.stringify(channelsToAdd)),
          contacts: JSON.parse(JSON.stringify(contactsList))
        })
      )
      /* yield put(
        setSearchedChannelsAC({
          groups: JSON.parse(
            JSON.stringify(
              [...channelsData.channels, ...groupChannels]
                .sort(
                  (a, b) =>
                    (a.lastMessage ? a.lastMessage.createdAt : a.createdAt) -
                    (b.lastMessage ? b.lastMessage.createdAt : b.createdAt)
                )
                .reverse()
            )
          ),
          // groups: JSON.parse(JSON.stringify(groupChannels)),
          directs: JSON.parse(JSON.stringify(directChannels))
        })
      ) */
    }
  } catch (e) {
    log.error(e, 'Error on get channels')
    if (e.code !== 10008) {
      // yield put(setErrorNotification(e.message));
    }
  }
}

function* channelsLoadMore(action: IAction): any {
  log.info('[channelsLoadMore] start load more channels')
  try {
    const { payload } = action
    const { limit } = payload
    log.info('[channelsLoadMore] input payload:', JSON.stringify({ limit }))
    const { channelQuery } = query
    log.info('[channelsLoadMore] channelQuery exists:', !!channelQuery)
    if (!channelQuery) {
      log.error('[channelsLoadMore] channelQuery is null or undefined, cannot load more')
      return
    }
    if (limit) {
      log.info('[channelsLoadMore] setting query limit to:', limit)
      channelQuery.limit = limit
    } else {
      log.info('[channelsLoadMore] no limit provided, using existing query limit')
    }
    yield put(setChannelsLoadingStateAC(LOADING_STATE.LOADING))
    log.info('[channelsLoadMore] loading next page...')
    const channelsData = yield call(channelQuery.loadNextPage)
    const channelList = channelsData.channels
    log.info(
      '[channelsLoadMore] channelsData received:',
      JSON.stringify({
        channelsCount: channelList?.length || 0,
        hasNext: channelsData.hasNext
      })
    )
    yield put(channelHasNextAC(channelsData.hasNext))
    log.info('[channelsLoadMore] hasNext set to:', channelsData.hasNext)
    let { channels: mappedChannels, channelsForUpdateLastReactionMessage } = yield call(
      setChannelsInMap,
      channelsData.channels
    )
    log.info(
      '[channelsLoadMore] setChannelsInMap result:',
      JSON.stringify({
        mappedChannelsCount: mappedChannels?.length || 0,
        channelsForUpdateLastReactionMessageCount: channelsForUpdateLastReactionMessage?.length || 0
      })
    )

    if (channelsForUpdateLastReactionMessage?.length) {
      log.info(
        '[channelsLoadMore] processing channels for reaction message update:',
        channelsForUpdateLastReactionMessage?.length
      )
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
                  log.info('[channelsLoadMore] successfully fetched reaction message for channel:', channel?.id)
                  resolve(true)
                })
                .catch((e) => {
                  log.error(e, 'Error on getMessagesById for channel:', channel?.id)
                  resolve(true)
                })
            })
          })
        )
      })
      log.info(
        '[channelsLoadMore] reaction messages fetched:',
        channelMessageMap ? Object.keys(channelMessageMap)?.length : 0
      )
      mappedChannels = mappedChannels.map((channel: IChannel) => {
        if (channelMessageMap[channel.id]) {
          channel.lastReactedMessage = channelMessageMap[channel.id]
        }
        return channel
      })
      log.info(
        '[channelsLoadMore] mappedChannels updated with reaction messages, final count:',
        mappedChannels?.length || 0
      )
    } else {
      log.info('[channelsLoadMore] no channels need reaction message update')
    }
    log.info('[channelsLoadMore] adding channels to state, count:', mappedChannels?.length || 0)
    yield put(addChannelsAC(mappedChannels))
    yield put(setChannelsLoadingStateAC(LOADING_STATE.LOADED))
    log.info('[channelsLoadMore] completed successfully. Total channels added:', mappedChannels?.length || 0)
  } catch (error) {
    log.error('[channelsLoadMore] error occurred:', error)
    log.error(
      '[channelsLoadMore] error details:',
      JSON.stringify({
        message: error?.message,
        code: error?.code,
        stack: error?.stack
      })
    )
    /* if (error.code !== 10008) {
      yield put(setErrorNotification(error.message));
    } */
  }
}

function* getChannelMentions(action: IAction): any {
  try {
    const { payload } = action
    const { channelId } = payload
    const SceytChatClient = getClient()
    const mentionsQueryBuilder = new (SceytChatClient.MentionsListQueryBuilder as any)()
    mentionsQueryBuilder.setChannelId(channelId)
    mentionsQueryBuilder.limit(10)
    mentionsQueryBuilder.setDirection(queryDirection.NEXT)
    const mentionsQuery = yield call(mentionsQueryBuilder.build)
    const mentions = yield call(mentionsQuery.loadNext)
    yield put(updateChannelDataAC(channelId, { mentionsIds: mentions.mentions }))
  } catch (error) {
    log.error(error, 'Error in get channel mentions')
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
    yield put(setChannelsLoadingStateAC(LOADING_STATE.LOADING, true))
    const channelsData = yield call(channelQueryForward.loadNextPage)
    yield put(channelHasNextAC(channelsData.hasNext, true))
    const channelsToAdd = channelsData.channels.filter((channel: IChannel) =>
      channel.type === DEFAULT_CHANNEL_TYPE.BROADCAST || channel.type === DEFAULT_CHANNEL_TYPE.PUBLIC
        ? channel.userRole === 'admin' || channel.userRole === 'owner'
        : channel.type === DEFAULT_CHANNEL_TYPE.DIRECT
          ? channel.members.find((member) => member.id && member.id !== SceytChatClient.user.id)
          : true
    )
    const { channels: mappedChannels } = yield call(setChannelsInMap, channelsToAdd)
    yield put(addChannelsForForwardAC(mappedChannels))
    yield put(setChannelsLoadingStateAC(LOADING_STATE.LOADED, true))
  } catch (error) {
    log.error(error, 'Error in load more channels for forward')
    /* if (error.code !== 10008) {
      yield put(setErrorNotification(error.message));
    } */
  }
}

function* markMessagesRead(action: IAction): any {
  const { payload } = action
  const { channelId, messageIds } = payload
  let channel = yield call(getChannelFromMap, channelId)
  try {
    if (!channel) {
      channel = getChannelFromAllChannels(channelId)
      if (channel) {
        setChannelInMap(channel)
      }
    }
    // const activeChannelId = yield call(getActiveChannelId)
    if (channel) {
      const messageListMarker = yield call(channel.markMessagesAsDisplayed, messageIds)
      // use updateChannelDataAC already changes unreadMessageCount no need in setChannelUnreadCount
      // yield put(setChannelUnreadCount(0, channel.id));
      yield put(
        updateChannelDataAC(channel.id, {
          lastReadMessageId: channel.lastDisplayedMessageId
        })
      )
      updateChannelOnAllChannels(channel.id, {
        lastReadMessageId: channel.lastDisplayedMessageId
      })
      for (const messageId of messageListMarker.messageIds) {
        const updateParams = {
          deliveryStatus: MESSAGE_DELIVERY_STATUS.READ,
          userMarkers: [
            {
              user: messageListMarker.user,
              createdAt: messageListMarker.createdAt,
              messageId,
              name: MESSAGE_DELIVERY_STATUS.READ
            }
          ]
        }
        yield put(updateMessageAC(messageId, updateParams))
        updateMessageOnMap(channel.id, { messageId, params: updateParams })
        updateMessageOnAllMessages(messageId, updateParams)
      }
    }
  } catch (e) {
    log.error(e, 'Error on mark messages read')
  }
}

function* markVoiceMessageAsPlayed(action: IAction): any {
  const { payload } = action
  const { channelId, messageIds } = payload
  try {
    let channel = yield call(getChannelFromMap, channelId)
    if (!channel) {
      channel = getChannelFromAllChannels(channelId)
      if (channel) {
        setChannelInMap(channel)
      }
    }

    if (channel) {
      yield call(channel.markVoiceMessagesAsPlayed, messageIds)
    }
  } catch (e) {
    log.error(e, 'Error on mark voice messages read')
  }
}

function* markMessagesDelivered(action: IAction): any {
  const { payload } = action
  const { channelId, messageIds } = payload
  try {
    let channel = yield call(getChannelFromMap, channelId)
    if (!channel) {
      channel = getChannelFromAllChannels(channelId)
      if (channel) {
        setChannelInMap(channel)
      }
    }

    if (channel) {
      log.info('send delivered marker ', messageIds)
      yield call(channel.markMessagesAsReceived, messageIds)
    }
  } catch (e) {
    log.error(e, 'Error on mark messages delivered')
  }
}

function* switchChannel(action: IAction): any {
  try {
    const { payload } = action
    const { channel, updateActiveChannel } = payload
    let channelToSwitch = channel
    if (!channel?.id && updateActiveChannel) {
      yield call(setActiveChannelId, '')
      yield put(setActiveChannelAC({}))
      return
    }
    const existingChannel = checkChannelExists(channel.id)
    if (!existingChannel) {
      const addChannel = getChannelFromAllChannels(channel.id)
      if (addChannel) {
        setChannelInMap(addChannel)
        yield put(addChannelAC(JSON.parse(JSON.stringify(addChannel))))
        channelToSwitch = { ...channelToSwitch, ...addChannel }
      } else {
        const SceytChatClient = getClient()
        const fetchedChannel = yield call(SceytChatClient.getChannel, channel.id)
        addChannelToAllChannels(fetchedChannel)
        setChannelInMap(fetchedChannel)
        yield put(addChannelAC(JSON.parse(JSON.stringify(fetchedChannel))))
        channelToSwitch = { ...channelToSwitch, ...fetchedChannel }
      }
    } else {
      const channelFromMap = getChannelFromMap(channel.id)
      channelToSwitch = { ...channelToSwitch, ...channelFromMap }
    }
    if (updateActiveChannel) {
      const currentActiveChannel = getChannelFromMap(getActiveChannelId())
      yield put(setUnreadScrollToAC(true))
      yield call(setActiveChannelId, channel && channel.id)
      if (channel.isLinkedChannel) {
        channelToSwitch.linkedFrom = currentActiveChannel
      }
      yield put(setActiveChannelAC({ ...channelToSwitch }))
    }
    // yield put(switchTypingIndicatorAC(false))
    // yield put(setMessageForThreadReply(undefined));
    // yield put(deleteThreadReplyMessagesAC());
    if (channel) {
      // yield put(getMessagesAC(channel))
    }
  } catch (e) {
    log.error('error in switch channel', e)
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
    updateChannelOnAllChannels(channel.id, {
      muted: updatedChannel.muted,
      mutedTill: updatedChannel.mutedTill
    })
    yield put(
      updateChannelDataAC(updatedChannel.id, {
        muted: updatedChannel.muted,
        mutedTill: updatedChannel.mutedTill
      })
    )
  } catch (e) {
    log.error('ERROR turn off notifications', e.message)
    // yield put(setErrorNotification(e.message))
  }
}

function* notificationsTurnOn(): any {
  const activeChannelId = yield call(getActiveChannelId)
  const channel = yield call(getChannelFromMap, activeChannelId)

  try {
    const updatedChannel = yield call(channel.unmute)
    updateChannelOnAllChannels(channel.id, {
      muted: updatedChannel.muted,
      mutedTill: updatedChannel.mutedTill
    })
    yield put(
      updateChannelDataAC(updatedChannel.id, {
        muted: updatedChannel.muted,
        mutedTill: updatedChannel.mutedTill
      })
    )
  } catch (e) {
    log.error('ERROR turn on notifications: ', e.message)
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
    // const updatedChannel = yield call(channel.markAsRead)
    yield call(channel.markAsRead)
    const updateData = {
      unread: false,
      newMessageCount: 0,
      newMentionCount: 0
    }
    updateChannelOnAllChannels(channel.id, updateData)
    yield put(updateChannelDataAC(channel.id, updateData))
  } catch (error) {
    log.error(error, 'Error in set channel unread')
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

    yield call(channel.markAsUnRead)
    // const updatedChannel = yield call(channel.markAsUnRead)
    updateChannelOnAllChannels(channel.id, { unread: true })
    yield put(updateChannelDataAC(channel.id, { unread: true }))
  } catch (error) {
    log.error(error, 'Error in set channel unread')
    // yield put(setErrorNotification(error.message));
  }
}

function* pinChannel(action: IAction): any {
  try {
    const { channelId } = action.payload
    let channel = yield call(getChannelFromMap, channelId)
    if (!channel) {
      channel = getChannelFromAllChannels(channelId)
    }
    const updatedChannel = yield call(channel.pin)
    updateChannelOnAllChannels(channel.id, { pinnedAt: updatedChannel.pinnedAt })
    yield put(updateChannelDataAC(updatedChannel.id, { pinnedAt: updatedChannel.pinnedAt }, true))
  } catch (error) {
    log.error(error, 'Error in pinChannel')
  }
}

function* unpinChannel(action: IAction): any {
  try {
    const { channelId } = action.payload
    let channel = yield call(getChannelFromMap, channelId)
    if (!channel) {
      channel = getChannelFromAllChannels(channelId)
    }

    const updatedChannel = yield call(channel.unpin)
    updateChannelOnAllChannels(channel.id, { pinnedAt: updatedChannel.pinnedAt })
    yield put(updateChannelDataAC(updatedChannel.id, { pinnedAt: updatedChannel.pinnedAt }, false, true))
  } catch (error) {
    log.error(error, 'Error in unpinChannel')
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
      if (channel.type === DEFAULT_CHANNEL_TYPE.GROUP || channel.type === DEFAULT_CHANNEL_TYPE.PRIVATE) {
        const messageBuilder = channel.createMessageBuilder()
        messageBuilder.setBody('LG').setType('system').setDisplayCount(0).setSilent(true)
        const messageToSend = messageBuilder.create()

        if (CONNECTION_STATUS.CONNECTED) {
          log.info('send message for left')
          yield call(channel.sendMessage, messageToSend)
        }
        // yield put(sendTextMessageAC(messageToSend, channelId, CONNECTION_STATUS.CONNECTED))
      }
      log.info('leave')
      yield call(channel.leave)
      yield put(removeChannelAC(channelId))
      deleteChannelFromAllChannels(channelId)

      yield put(removeChannelCachesAC(channelId))
    }
  } catch (e) {
    log.error('ERROR in leave channel - ', e.message)
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
      yield put(setChannelToRemoveAC(channel))

      yield put(removeChannelAC(channelId))

      yield put(removeChannelCachesAC(channelId))
    }
  } catch (e) {
    log.error('ERROR in delete channel', e)
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
    log.error('ERROR in block channel - ', e.message)
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
          log.info('upload percent - ', progressPercent)
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

    yield put(
      updateChannelDataAC(channelId, {
        subject,
        avatarUrl,
        metadata: isJSON(metadata) ? JSON.parse(metadata) : metadata
      })
    )
    updateChannelOnAllChannels(channelId, {
      subject,
      avatarUrl,
      metadata: isJSON(metadata) ? JSON.parse(metadata) : metadata
    })
    const onUpdateChannel = getOnUpdateChannel()
    if (onUpdateChannel) {
      const fields = []
      if (channel?.subject !== subject) {
        fields.push('subject')
      }
      if (channel?.avatarUrl !== avatarUrl) {
        fields.push('avatarUrl')
      }
      if (JSON.stringify(channel?.metadata) !== metadata) {
        fields.push('metadata')
      }
      const updatedChannel = yield call(getChannelFromMap, channelId)
      onUpdateChannel(updatedChannel, fields)
    }
  } catch (e) {
    log.error('ERROR in update channel', e.message)
    // yield put(setErrorNotification(e.message))
  }
}

function* checkUsersStatus(/* action: IAction */): any {
  try {
    // const { payload } = action
    // const { usersMap } = payload
    const SceytChatClient = getClient()
    const usersForUpdate = Object.keys(usersMap)
    const updatedUsers = yield call(SceytChatClient.getUsers as any, usersForUpdate)
    const usersToUpdateMap: { [key: string]: IMember } = {}
    let update: boolean = false
    updatedUsers.forEach((updatedUser: IMember) => {
      if (
        updatedUser.presence &&
        (updatedUser.presence.state !== usersMap[updatedUser.id]?.presence?.state ||
          updatedUser.presence.status !== usersMap[updatedUser.id]?.presence?.status ||
          (updatedUser.presence.lastActiveAt &&
            new Date(updatedUser.presence.lastActiveAt).getTime() !==
              new Date(usersMap[updatedUser.id]?.presence?.lastActiveAt || 0).getTime()) ||
          updatedUser.avatarUrl !== usersMap[updatedUser.id]?.avatarUrl ||
          updatedUser.firstName !== usersMap[updatedUser.id]?.firstName ||
          updatedUser.lastName !== usersMap[updatedUser.id]?.lastName)
      ) {
        updateUserOnMap(updatedUser)
        usersToUpdateMap[updatedUser.id] = updatedUser
        update = true
      }
    })
    if (update) {
      const updateData = JSON.parse(JSON.stringify(usersToUpdateMap))
      yield put(updateMembersPresenceAC(updateData))
      yield put(updateUserStatusOnMapAC(updateData))
      yield put(updateUserStatusOnChannelAC(updateData))
    }
  } catch (e) {
    log.error('ERROR in check user status : ', e.message)
    // yield put(setErrorNotification(e.message))
  }
}

function* sendTyping(action: IAction): any {
  const {
    payload: { state }
  } = action
  const activeChannelId = yield call(getActiveChannelId)
  const channel = yield call(getChannelFromMap, activeChannelId)

  try {
    if (channel) {
      if (state) {
        yield call(channel.startTyping)
      } else {
        yield call(channel.stopTyping)
      }
    }
  } catch (e) {
    log.error('ERROR in send typing', e)
  }
}

function* sendRecording(action: IAction): any {
  const {
    payload: { state, channelId }
  } = action
  const channel = yield call(getChannelFromMap, channelId)

  try {
    if (channel) {
      if (state) {
        yield call(channel.startRecording)
      } else {
        yield call(channel.stopRecording)
      }
    }
  } catch (e) {
    log.error('ERROR in send recording', e)
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
      yield put(clearSelectedMessagesAC())
      yield put(updateChannelDataAC(channel.id, { lastMessage: null, newMessageCount: 0, newMentionCount: 0 }))
      updateChannelOnAllChannels(channel.id, { lastMessage: null, newMessageCount: 0, newMentionCount: 0 })
      const groupName = getChannelGroupName(channel)
      yield put(
        updateSearchedChannelDataAC(
          channel.id,
          { lastMessage: null, newMessageCount: 0, newMentionCount: 0 },
          groupName
        )
      )
    }
  } catch (e) {
    log.error('ERROR in clear history', e)
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
      yield put(clearSelectedMessagesAC())
      yield put(updateChannelDataAC(channel.id, { lastMessage: null, newMessageCount: 0, newMentionCount: 0 }))
      updateChannelOnAllChannels(channel.id, { lastMessage: null, newMessageCount: 0, newMentionCount: 0 })
      const groupName = getChannelGroupName(channel)
      yield put(
        updateSearchedChannelDataAC(
          channel.id,
          { lastMessage: null, newMessageCount: 0, newMentionCount: 0 },
          groupName
        )
      )
    }
  } catch (e) {
    log.error('ERROR in clear history', e)
    // yield put(setErrorNotification(e.message))
  }
}

function* joinChannel(action: IAction): any {
  try {
    const { payload } = action
    const { channelId } = payload

    const SceytChatClient = getClient()
    let channel = yield call(getChannelFromMap, channelId)
    if (!channel) {
      channel = getChannelFromAllChannels(channelId)
    }
    if (!channel) {
      channel = yield call(SceytChatClient.getChannel, channelId)
    }
    const joinedChannel: IChannel = yield call(channel.join)
    yield put(setCloseSearchChannelsAC(true))

    yield put(setChannelToAddAC(JSON.parse(JSON.stringify(joinedChannel))))
    yield put(switchChannelActionAC(JSON.parse(JSON.stringify(joinedChannel))))
    addChannelToAllChannels(joinedChannel)
    yield call(setActiveChannelId, joinedChannel.id)
    // yield put(switchChannelAction({ ...JSON.parse(JSON.stringify(channel)), myRole: updatedChannel.myRole }));
  } catch (error) {
    log.error(error, 'Error in join to channel')
    // yield put(setErrorNotification(error.message))
  }
}

function* watchForChannelEvents() {
  yield call(watchForEvents)
}

function* createChannelInviteKey(action: IAction): any {
  try {
    const { payload } = action
    const { channelId } = payload
    const SceytChatClient = getClient()
    let channel = yield call(getChannelFromMap, channelId)
    if (!channel) {
      channel = getChannelFromAllChannels(channelId)
    }
    if (channel) {
      const inviteKey = yield call(SceytChatClient.createInviteKey, {
        maxUses: 0,
        expiresAt: 0,
        accessPriorHistory: true
      })
      yield put(setChannelInviteKeysAC(channelId, [inviteKey]))
    }
  } catch (e) {
    log.error('ERROR in create channel invite key', e)
  }
}

function* getChannelInviteKeys(action: IAction): any {
  try {
    const { payload } = action
    const { channelId } = payload
    let channel = yield call(getChannelFromMap, channelId)
    if (!channel) {
      channel = getChannelFromAllChannels(channelId)
    }
    if (channel) {
      const inviteKeys = yield call(channel.getInviteKeys)
      yield put(setChannelInviteKeysAC(channelId, inviteKeys))
    }
  } catch (e) {
    log.error('ERROR in get channel invite keys', e)
  }
}

function* regenerateChannelInviteKey(action: IAction): any {
  try {
    const { payload } = action
    const { channelId, key } = payload
    let channel = yield call(getChannelFromMap, channelId)
    if (!channel) {
      channel = getChannelFromAllChannels(channelId)
    }
    if (channel) {
      const inviteKey = yield call(channel.regenerateInviteKey, {
        key,
        channelId
      })
      yield put(setChannelInviteKeysAC(channelId, [inviteKey]))
    }
  } catch (e) {
    log.error('ERROR in regenerate channel invite key', e)
  }
}

function* updateChannelInviteKey(action: IAction): any {
  let channelInviteKeys: any[] = []
  let channelId: string = ''
  try {
    const { payload } = action
    const { channelId: payloadChannelId, key, accessPriorHistory, expiresAt, maxUses } = payload
    channelId = payloadChannelId
    let channel = yield call(getChannelFromMap, channelId)
    if (!channel) {
      channel = getChannelFromAllChannels(channelId)
    }
    channelInviteKeys = store.getState().ChannelReducer.channelInviteKeys[channelId]
    const copiedChannelInviteKeys = JSON.parse(JSON.stringify(channelInviteKeys))
    if (copiedChannelInviteKeys) {
      copiedChannelInviteKeys.forEach((inviteKey: any) => {
        if (inviteKey.key === key) {
          inviteKey.accessPriorHistory = accessPriorHistory
          inviteKey.expiresAt = expiresAt
          inviteKey.maxUses = maxUses
        }
      })
      yield put(setChannelInviteKeysAC(channelId, copiedChannelInviteKeys))
    }

    if (channel) {
      yield call(channel.updateInviteKey, {
        key,
        channelId,
        maxUses,
        expiresAt,
        accessPriorHistory
      })
    }
  } catch (e) {
    log.error('ERROR in update channel invite key', e)
    yield put(setChannelInviteKeysAC(channelId, channelInviteKeys))
  }
}

function* getChannelByInviteKey(action: IAction): any {
  try {
    const { payload } = action
    const { key } = payload
    const SceytChatClient = getClient()
    const channel = yield call(SceytChatClient.Channel.getChannelByInviteKey, key)
    if (channel && channel.length > 0 && !channel[0]?.role) {
      yield put(setJoinableChannelAC(JSON.parse(JSON.stringify(channel[0]))))
      window.history.pushState({}, '', window.location.pathname + '?join=' + key)
    } else if (channel && channel.length > 0 && channel[0]?.role) {
      yield put(switchChannelActionAC(JSON.parse(JSON.stringify(channel[0]))))
      window.history.pushState({}, '', window.location.pathname)
    }
  } catch (e) {
    log.error('ERROR in get channel by invite key', e)
  }
}

function* joinChannelWithInviteKey(action: IAction): any {
  try {
    const { payload } = action
    const { key } = payload
    const SceytChatClient = getClient()
    const user = SceytChatClient.user
    const channel = yield call(SceytChatClient.Channel.joinChannelByInviteKey, key)
    yield put(setJoinableChannelAC(null as unknown as IChannel))
    yield call(setChannelInMap, channel)
    const messageToSend: any = {
      // metadata: mentionedUsersPositions,
      body: 'JL',
      mentionedUsers: [user],
      attachments: [],
      type: 'system'
    }
    yield put(sendTextMessageAC(messageToSend, channel?.id, CONNECTION_STATUS.CONNECTED))
    yield put(switchChannelActionAC(JSON.parse(JSON.stringify(channel))))
    window.history.pushState({}, '', window.location.pathname)
  } catch (e) {
    log.error('ERROR in join channel with invite key', e)
  }
}

function* setMessageRetentionPeriod(action: IAction): any {
  try {
    const { payload } = action
    const { channelId, periodInSeconds } = payload
    let channel = yield call(getChannelFromMap, channelId)
    if (!channel) {
      channel = getChannelFromAllChannels(channelId)
    }

    if (channel) {
      const currentPeriod = channel.messageRetentionPeriod ?? null
      const currentPeriodNormalized = currentPeriod === null ? 0 : currentPeriod
      const newPeriodNormalized = periodInSeconds === null ? 0 : periodInSeconds

      if (currentPeriodNormalized === newPeriodNormalized) {
        yield call(channel.setMessageRetentionPeriod, periodInSeconds)
        yield put(
          updateChannelDataAC(channelId, {
            messageRetentionPeriod: periodInSeconds
          })
        )
        updateChannelOnAllChannels(channelId, {
          messageRetentionPeriod: periodInSeconds
        })
        return
      }

      const periodInMilliseconds = periodInSeconds !== null ? periodInSeconds * 1000 : null

      yield call(channel.setMessageRetentionPeriod, periodInSeconds)

      yield put(
        updateChannelDataAC(channelId, {
          messageRetentionPeriod: periodInSeconds
        })
      )
      updateChannelOnAllChannels(channelId, {
        messageRetentionPeriod: periodInSeconds
      })

      const autoDeletePeriod = periodInMilliseconds !== null ? periodInMilliseconds : 0

      const messageToSend: any = {
        metadata: { autoDeletePeriod },
        body: 'DM',
        mentionedUsers: [],
        attachments: [],
        type: 'system'
      }
      yield put(sendTextMessageAC(messageToSend, channelId, CONNECTION_STATUS.CONNECTED))
    }
  } catch (e) {
    log.error('ERROR in set message retention period', e)
    // yield put(setErrorNotification(e.message))
  }
}

export default function* ChannelsSaga() {
  yield takeLatest(CREATE_CHANNEL, createChannel)
  yield takeLatest(GET_CHANNELS, getChannels)
  yield takeLatest(SEARCH_CHANNELS, searchChannels)
  yield takeLatest(GET_CHANNELS_FOR_FORWARD, getChannelsForForward)
  yield takeLatest(SEARCH_CHANNELS_FOR_FORWARD, searchChannelsForForward)
  yield takeLatest(LOAD_MORE_CHANNEL, channelsLoadMore)
  yield takeLatest(LOAD_MORE_CHANNELS_FOR_FORWARD, channelsForForwardLoadMore)
  yield takeEvery(SWITCH_CHANNEL, switchChannel)
  yield takeLatest(LEAVE_CHANNEL, leaveChannel)
  yield takeLatest(DELETE_CHANNEL, deleteChannel)
  yield takeLatest(BLOCK_CHANNEL, blockChannel)
  yield takeLatest(UPDATE_CHANNEL, updateChannel)
  yield takeEvery(MARK_MESSAGES_AS_READ, markMessagesRead)
  yield takeLatest(MARK_MESSAGES_AS_DELIVERED, markMessagesDelivered)
  yield takeLatest(MARK_VOICE_MESSAGE_AS_PLAYED, markVoiceMessageAsPlayed)
  yield takeLatest(WATCH_FOR_EVENTS, watchForChannelEvents)
  yield takeLatest(TURN_OFF_NOTIFICATION, notificationsTurnOff)
  yield takeLatest(TURN_ON_NOTIFICATION, notificationsTurnOn)
  yield takeLatest(MARK_CHANNEL_AS_READ, markChannelAsRead)
  yield takeLatest(MARK_CHANNEL_AS_UNREAD, markChannelAsUnRead)
  yield takeLatest(CHECK_USER_STATUS, checkUsersStatus)
  yield takeLatest(SEND_TYPING, sendTyping)
  yield takeLatest(SEND_RECORDING, sendRecording)
  yield takeLatest(PIN_CHANNEL, pinChannel)
  yield takeLatest(UNPIN_CHANNEL, unpinChannel)
  yield takeLatest(CLEAR_HISTORY, clearHistory)
  yield takeLatest(JOIN_TO_CHANNEL, joinChannel)
  yield takeLatest(DELETE_ALL_MESSAGES, deleteAllMessages)
  yield takeLatest(REMOVE_CHANNEL_CACHES, removeChannelCaches)
  yield takeLatest(GET_CHANNEL_MENTIONS, getChannelMentions)
  yield takeLatest(CREATE_CHANNEL_INVITE_KEY, createChannelInviteKey)
  yield takeLatest(UPDATE_CHANNEL_INVITE_KEY, updateChannelInviteKey)
  yield takeLatest(REGENERATE_CHANNEL_INVITE_KEY, regenerateChannelInviteKey)
  // yield takeLatest(GET_CHANNEL_INVITE_KEY, getChannelInviteKey)
  yield takeLatest(GET_CHANNEL_INVITE_KEYS, getChannelInviteKeys)
  // yield takeLatest(REVOKE_CHANNEL_INVITE_KEY, revokeChannelInviteKey)
  // yield takeLatest(DELETE_REVOKED_CHANNEL_INVITE_KEY, deleteRevokedChannelInviteKey)
  // yield takeLatest(GET_REVOKED_CHANNEL_INVITE_KEYS, getRevokedChannelInviteKeys)
  yield takeLatest(GET_CHANNEL_BY_INVITE_KEY, getChannelByInviteKey)
  yield takeLatest(JOIN_TO_CHANNEL_WITH_INVITE_KEY, joinChannelWithInviteKey)
  yield takeLatest(SET_MESSAGE_RETENTION_PERIOD, setMessageRetentionPeriod)
}
