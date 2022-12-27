import { call, put, takeLatest } from 'redux-saga/effects'
import { getClient } from '../../common/client'
import { BLOCK_USERS, GET_CONTACTS, GET_ROLES, UNBLOCK_USERS } from './constants'
import { LOADING_STATE } from '../../helpers/constants'
import { setContactsAC, setContactsLoadingStateAC, setRolesAC } from './actions'
import { IAction } from '../../types'
import { getActiveChannelId, getChannelFromMap } from '../../helpers/channelHalper'
import { updateChannelDataAC } from '../channel/actions'

function* getContacts(): any {
  try {
    const SceytChatClient = getClient()
    const contactsData = yield call(SceytChatClient.chatClient.getAllContacts)
    yield put(setContactsAC(contactsData))
    yield put(setContactsLoadingStateAC(LOADING_STATE.LOADED))
  } catch (e) {
    console.log('ERROR in get contacts - ', e.message)
    if (e.code !== 10008) {
      // yield put(setErrorNotification(e.message))
    }
  }
}
function* getRoles(): any {
  try {
    const SceytChatClient = getClient()
    const roles = yield call(SceytChatClient.chatClient.getRoles)
    yield put(setRolesAC(roles))
  } catch (e) {
    console.log('ERROR in get contacts - ', e.message)
    if (e.code !== 10008) {
      // yield put(setErrorNotification(e.message))
    }
  }
}

function* blockUser(action: IAction): any {
  try {
    const SceytChatClient = getClient()
    const { payload } = action
    const { userIds } = payload
    const blockedUsers = yield call(SceytChatClient.chatClient.blockUsers, userIds)

    const activeChannelId = yield call(getActiveChannelId)
    const activeChannel = yield call(getChannelFromMap, activeChannelId)
    if (activeChannel.peer && activeChannel.peer.id === blockedUsers[0].id) {
      yield put(updateChannelDataAC(activeChannelId, { peer: blockedUsers[0] }))
    }
  } catch (error) {
    console.log('error in block users', error.message)
    // yield put(setErrorNotification(error.message))
  }
}

function* unblockUser(action: IAction): any {
  try {
    const SceytChatClient = getClient()
    const { payload } = action
    const { userIds } = payload
    const unblockedUsers = yield call(SceytChatClient.chatClient.unblockUsers, userIds)
    const activeChannelId = yield call(getActiveChannelId)
    const activeChannel = yield call(getChannelFromMap, activeChannelId)
    if (activeChannel.peer && activeChannel.peer.id === unblockedUsers[0].id) {
      yield put(updateChannelDataAC(activeChannelId, { peer: unblockedUsers[0] }))
    }
  } catch (error) {
    console.log('error in unblock users', error.message)
    // yield put(setErrorNotification(error.message))
  }
}

export default function* MembersSaga() {
  yield takeLatest(GET_CONTACTS, getContacts)
  yield takeLatest(GET_ROLES, getRoles)
  yield takeLatest(BLOCK_USERS, blockUser)
  yield takeLatest(UNBLOCK_USERS, unblockUser)
}
