import { put, call, takeLatest, takeEvery } from 'redux-saga/effects'
import {
  setMembersLoadingStateAC,
  setActionIsRestrictedAC,
  removeMemberFromListAC,
  updateMembersAC,
  addMembersToListAC,
  setMembersToListAC,
  getRolesFailAC,
  getRolesSuccessAC,
  setMembersHasNextAC
} from './actions'
import {
  getChannelFromMap,
  getDisableFrowardMentionsCount,
  getCustomLoadMembersFunctions,
  query,
  updateChannelOnAllChannels,
  getChannelFromAllChannels
} from '../../helpers/channelHalper'
import { DEFAULT_CHANNEL_TYPE, LOADING_STATE } from '../../helpers/constants'

import {
  GET_MEMBERS,
  LOAD_MORE_MEMBERS,
  KICK_MEMBER,
  BLOCK_MEMBER,
  CHANGE_MEMBER_ROLE,
  ADD_MEMBERS,
  REPORT_MEMBER,
  GET_ROLES
} from './constants'
import { updateChannelDataAC } from '../channel/actions'
import { IAction, IChannel, IMember } from '../../types'
import { getClient } from '../../common/client'
import { sendTextMessageAC } from '../message/actions'
import { CONNECTION_STATUS } from '../user/constants'
import log from 'loglevel'
import { updateActiveChannelMembersAdd, updateActiveChannelMembersRemove } from './helpers'
import store from 'store'

function* getMembers(action: IAction): any {
  const { payload } = action
  const { channelId } = payload
  try {
    yield put(setMembersHasNextAC(true, channelId))
    if (!channelId || store.getState().MembersReducer.channelsMembersHasNextMap[channelId] === false) {
      return
    }

    const SceytChatClient = getClient()
    const membersQueryBuilder = new (SceytChatClient.MemberListQueryBuilder as any)(channelId)
    membersQueryBuilder.all().byAffiliationOrder().orderKeyByUsername().limit(50)

    const membersQuery = yield call(membersQueryBuilder.build)

    if (!query.channelMembersQuery) {
      query.channelMembersQuery = { [channelId]: membersQuery }
    } else {
      query.channelMembersQuery[channelId] = membersQuery
    }
    yield put(setMembersLoadingStateAC(LOADING_STATE.LOADING, channelId))
    const customLoadMembersFunctions = getCustomLoadMembersFunctions()
    const getMembers = customLoadMembersFunctions?.getMembers
    let channel: IChannel = getChannelFromMap(channelId)
    if (!channel) {
      channel = getChannelFromAllChannels(channelId) as IChannel
      if (channel) {
        channel = yield call(SceytChatClient.getChannel, channelId)
      }
    }
    const { members, hasNext } = getMembers ? yield call(getMembers, channel) : yield call(membersQuery.loadNextPage)
    yield put(setMembersToListAC(members, channelId))
    yield put(setMembersHasNextAC(hasNext, channelId))
    const updateChannelData = yield call(updateActiveChannelMembersAdd, members) || {}
    yield put(updateChannelDataAC(channelId, updateChannelData))
  } catch (e) {
    log.error('ERROR in get members - ', e.message)
    if (e.code !== 10008) {
      // yield put(setErrorNotification(e.message))
    }
  } finally {
    yield put(setMembersLoadingStateAC(LOADING_STATE.LOADED, channelId))
  }
}

function* loadMoreMembers(action: IAction): any {
  const { payload } = action
  const { limit, channelId } = payload
  try {
    const { channelMembersQuery } = query
    const membersQuery = channelMembersQuery?.[channelId]

    if (limit && membersQuery) {
      membersQuery.limit = limit
    }

    yield put(setMembersLoadingStateAC(LOADING_STATE.LOADING, channelId))
    const customLoadMembersFunctions = getCustomLoadMembersFunctions()
    const loadMoreMembers = customLoadMembersFunctions?.loadMoreMembers
    let channel: IChannel = getChannelFromMap(channelId)
    if (!channel) {
      channel = getChannelFromAllChannels(channelId) as IChannel
      if (channel) {
        const SceytChatClient = getClient()
        channel = yield call(SceytChatClient.getChannel, channelId)
      }
    }
    const { members, hasNext } = loadMoreMembers
      ? yield call(loadMoreMembers, channel, limit)
      : yield call(membersQuery.loadNextPage)
    yield put(addMembersToListAC(members, channelId))
    yield put(setMembersHasNextAC(hasNext, channelId))
    const updateChannelData = yield call(updateActiveChannelMembersAdd, members) || {}
    yield put(updateChannelDataAC(channelId, updateChannelData))
  } catch (e) {
    if (e.code !== 10008) {
      // yield put(setErrorNotification(e.message))
    }
  } finally {
    yield put(setMembersLoadingStateAC(LOADING_STATE.LOADED, channelId))
  }
}

function* addMembers(action: IAction): any {
  try {
    const { payload } = action
    const { members, channelId } = payload
    // Get channel from the stored map in our side to call methods on it
    const channel = yield call(getChannelFromMap, channelId)

    if (channel) {
      const membersToAdd = members.map((mem: IMember) => {
        const memberBuilder = channel.createMemberBuilder(mem.id)
        return memberBuilder.setRole(mem.role).create()
      })

      const addedMembers = yield call(channel.addMembers, membersToAdd)
      const whoDoesNotAdded = members.filter(
        (mem: IMember) => !addedMembers.some((addedMem: IMember) => addedMem.id === mem.id)
      )
      if (whoDoesNotAdded.length) {
        yield put(setActionIsRestrictedAC(true, true, whoDoesNotAdded))
      }
      if (channel.type === DEFAULT_CHANNEL_TYPE.GROUP || channel.type === DEFAULT_CHANNEL_TYPE.PRIVATE) {
        const membersIds: string[] = []
        addedMembers.forEach((mem: IMember) => {
          membersIds.push(mem.id)
        })
        if (membersIds.length) {
          const messageToSend: any = {
            metadata: { m: membersIds },
            body: 'AM',
            mentionedUsers: getDisableFrowardMentionsCount() ? [] : addedMembers,
            attachments: [],
            type: 'system'
          }
          yield put(sendTextMessageAC(messageToSend, channelId, CONNECTION_STATUS.CONNECTED))
        }
      }
      const customLoadMembersFunctions = getCustomLoadMembersFunctions()
      const addMembersEvent = customLoadMembersFunctions?.addMembersEvent
      let membersList = []
      if (addMembersEvent) {
        membersList = yield call(
          addMembersEvent,
          channelId,
          addedMembers,
          store.getState().MembersReducer.channelsMembersMap[channelId] || []
        )
        yield put(setMembersToListAC(membersList, channelId))
      } else {
        yield put(addMembersToListAC(addedMembers, channelId))
      }
      updateChannelOnAllChannels(channel.id, { memberCount: channel.memberCount + addedMembers.length })

      const updateChannelData = addMembersEvent
        ? { members: membersList }
        : yield call(updateActiveChannelMembersAdd, addedMembers) || {}
      yield put(
        updateChannelDataAC(channel.id, {
          memberCount: channel.memberCount + addedMembers.length,
          ...updateChannelData
        })
      )
    }
  } catch (e) {
    log.error('error on add members... ', e)
    // yield put(setErrorNotification(e.message))
  }
}

function* kickMemberFromChannel(action: IAction): any {
  try {
    const { payload } = action
    const { memberId, channelId } = payload

    const channel = yield call(getChannelFromMap, channelId)

    const removedMembers = yield call(channel.kickMembers, [memberId])
    if (channel.type === DEFAULT_CHANNEL_TYPE.GROUP || channel.type === DEFAULT_CHANNEL_TYPE.PRIVATE) {
      const membersIds: string[] = []
      removedMembers.forEach((mem: IMember) => {
        membersIds.push(mem.id)
      })
      const messageToSend: any = {
        metadata: { m: membersIds },
        body: 'RM',
        mentionedUsers: removedMembers,
        attachments: [],
        type: 'system'
      }
      yield put(sendTextMessageAC(messageToSend, channelId, CONNECTION_STATUS.CONNECTED))
    }
    yield put(removeMemberFromListAC(removedMembers, channelId))
    updateChannelOnAllChannels(channel.id, { memberCount: channel.memberCount - removedMembers.length })

    const updateChannelData = yield call(updateActiveChannelMembersRemove, removedMembers) || {}
    yield put(
      updateChannelDataAC(channel.id, {
        memberCount: channel.memberCount - removedMembers.length,
        ...updateChannelData
      })
    )
  } catch (e) {
    // yield put(setErrorNotification(e.message))
  }
}

function* blockMember(action: IAction): any {
  try {
    const { payload } = action
    const { memberId, channelId } = payload

    const channel = yield call(getChannelFromMap, channelId)
    const removedMembers = yield call(channel.blockMembers, [memberId])
    yield put(removeMemberFromListAC(removedMembers, channelId))
    updateChannelOnAllChannels(channel.id, { memberCount: channel.memberCount - removedMembers.length })

    const updateChannelData = yield call(updateActiveChannelMembersRemove, removedMembers) || {}
    yield put(
      updateChannelDataAC(channel.id, {
        memberCount: channel.memberCount - removedMembers.length,
        ...updateChannelData
      })
    )
  } catch (e) {
    // yield put(setErrorNotification(e.message))
  }
}

function* changeMemberRole(action: IAction): any {
  try {
    const { payload } = action
    const { channelId, members } = payload

    const channel = yield call(getChannelFromMap, channelId)
    const updatedMembers = yield call(channel.changeMembersRole, members)
    const customLoadMembersFunctions = getCustomLoadMembersFunctions()
    const updateMembersEvent = customLoadMembersFunctions?.updateMembersEvent
    if (updateMembersEvent) {
      const membersList = yield call(
        updateMembersEvent,
        channelId,
        updatedMembers,
        store.getState().MembersReducer.channelsMembersMap[channelId] || []
      )
      yield put(setMembersToListAC(membersList, channelId))
    } else {
      yield put(updateMembersAC(updatedMembers, channelId))
    }
  } catch (e) {
    log.error('error in change member role', e)
    // yield put(setErrorNotification(e.message))
  }
}

function* reportMember(action: IAction): any {
  const {
    payload: { reportData }
  } = action
  const SceytChatClient = getClient()
  try {
    yield call(
      SceytChatClient.userReport,
      reportData.reportReason,
      reportData.userId,
      reportData.messageIds,
      reportData.reportDescription
    )
  } catch (e) {
    log.error('ERROR report user', e.message)
    // yield put(setErrorNotification(e.message))
  }
}

function* getRoles(action: IAction): any {
  const {
    payload: { timeout, attempts }
  } = action
  try {
    const SceytChatClient = getClient()
    if (store.getState().UserReducer.connectionStatus !== CONNECTION_STATUS.CONNECTED) {
      return
    }
    const roles = yield call(SceytChatClient.getRoles)
    yield put(getRolesSuccessAC(roles))
    yield put(getRolesFailAC())
  } catch (e) {
    log.error('ERROR get roles', e)
    yield put(getRolesFailAC((timeout || 0) + 300, (attempts || 0) + 1))
    // yield put(setErrorNotification(e.message));
  }
}

export default function* MembersSaga() {
  yield takeEvery(GET_MEMBERS, getMembers)
  yield takeEvery(LOAD_MORE_MEMBERS, loadMoreMembers)
  yield takeEvery(ADD_MEMBERS, addMembers)
  yield takeEvery(KICK_MEMBER, kickMemberFromChannel)
  yield takeEvery(BLOCK_MEMBER, blockMember)
  yield takeEvery(REPORT_MEMBER, reportMember)
  yield takeEvery(CHANGE_MEMBER_ROLE, changeMemberRole)
  yield takeLatest(GET_ROLES, getRoles)
}
