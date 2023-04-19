import { put, call, takeLatest } from 'redux-saga/effects'
import {
  setMembersLoadingStateAC,
  removeMemberFromListAC,
  updateMembersAC,
  addMembersToListAC,
  getRolesSuccess,
  setMembersToListAC
} from './actions'
import { getChannelFromMap, query } from '../../helpers/channelHalper'
import { CHANNEL_TYPE, LOADING_STATE } from '../../helpers/constants'

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
import { IAction, IMember } from '../../types'
import { getClient } from '../../common/client'
import { sendTextMessageAC } from '../message/actions'
import { CONNECTION_STATUS } from '../user/constants'

function* getMembers(action: IAction): any {
  try {
    const { payload } = action
    const { channelId } = payload
    const SceytChatClient = getClient()
    const membersQueryBuilder = new (SceytChatClient.MemberListQueryBuilder as any)(channelId)
    membersQueryBuilder.all().byAffiliationOrder().orderKeyByUsername().limit(50)

    const membersQuery = yield call(membersQueryBuilder.build)

    query.membersQuery = membersQuery
    yield put(setMembersLoadingStateAC(LOADING_STATE.LOADING))
    const { members } = yield call(membersQuery.loadNextPage)
    yield put(setMembersToListAC(members))
    yield put(setMembersLoadingStateAC(LOADING_STATE.LOADED))
  } catch (e) {
    console.log('ERROR in get member - ', e.message)
    if (e.code !== 10008) {
      // yield put(setErrorNotification(e.message))
    }
  }
}

function* loadMoreMembers(action: IAction) {
  try {
    const { payload } = action
    const { limit } = payload

    const { membersQuery } = query

    if (limit && membersQuery) {
      membersQuery.limit = limit
    }

    yield put(setMembersLoadingStateAC(LOADING_STATE.LOADING))
    const { members } = yield call((membersQuery as any).loadNextPage)

    yield put(addMembersToListAC(members))
    yield put(setMembersLoadingStateAC(LOADING_STATE.LOADED))
  } catch (e) {
    if (e.code !== 10008) {
      // yield put(setErrorNotification(e.message))
    }
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
      if (channel.type === CHANNEL_TYPE.PRIVATE) {
        const membersIds: string[] = []
        addedMembers.forEach((mem: IMember) => {
          membersIds.push(mem.id)
        })
        const messageToSend: any = {
          metadata: { m: membersIds },
          body: 'AM',
          mentionedMembers: [],
          attachments: [],
          type: 'system'
        }
        yield put(sendTextMessageAC(messageToSend, channelId, CONNECTION_STATUS.CONNECTED))
      }
      yield put(addMembersToListAC(addedMembers))
      yield put(updateChannelDataAC(channel.id, { memberCount: channel.memberCount }))
    }
  } catch (e) {
    console.log('error on add members... ', e)
    // yield put(setErrorNotification(e.message))
  }
}

function* kickMemberFromChannel(action: IAction): any {
  try {
    const { payload } = action
    const { memberId, channelId } = payload

    const channel = yield call(getChannelFromMap, channelId)

    const removedMembers = yield call(channel.kickMembers, [memberId])
    if (channel.type === CHANNEL_TYPE.PRIVATE) {
      const membersIds: string[] = []
      removedMembers.forEach((mem: IMember) => {
        membersIds.push(mem.id)
      })
      const messageToSend: any = {
        metadata: { m: membersIds },
        body: 'RM',
        mentionedMembers: [],
        attachments: [],
        type: 'system'
      }
      yield put(sendTextMessageAC(messageToSend, channelId, CONNECTION_STATUS.CONNECTED))
    }
    yield put(removeMemberFromListAC(removedMembers))
    yield put(updateChannelDataAC(channel.id, { memberCount: channel.memberCount }))
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
    yield put(removeMemberFromListAC(removedMembers))
    yield put(updateChannelDataAC(channel.id, { memberCount: channel.memberCount }))
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
    yield put(updateMembersAC(updatedMembers))
  } catch (e) {
    console.log('error in change member role')
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
    console.log('ERROR report user', e.message)
    // yield put(setErrorNotification(e.message))
  }
}

function* getRoles(): any {
  try {
    const SceytChatClient = getClient()
    const roles = yield call(SceytChatClient.getRoles)
    yield put(getRolesSuccess(roles))
  } catch (e) {
    console.log('error in get roles')
    // yield put(setErrorNotification(e.message));
  }
}

export default function* MembersSaga() {
  yield takeLatest(GET_MEMBERS, getMembers)
  yield takeLatest(LOAD_MORE_MEMBERS, loadMoreMembers)
  yield takeLatest(ADD_MEMBERS, addMembers)
  yield takeLatest(KICK_MEMBER, kickMemberFromChannel)
  yield takeLatest(BLOCK_MEMBER, blockMember)
  yield takeLatest(REPORT_MEMBER, reportMember)
  yield takeLatest(CHANGE_MEMBER_ROLE, changeMemberRole)
  yield takeLatest(GET_ROLES, getRoles)
}
