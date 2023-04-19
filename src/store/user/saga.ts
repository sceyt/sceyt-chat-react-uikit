import { call, put, takeLatest } from 'redux-saga/effects'
import { getClient } from '../../common/client'
import {
  BLOCK_USERS,
  GET_CONTACTS,
  GET_ROLES,
  GET_USERS,
  LOAD_MORE_USERS,
  UNBLOCK_USERS,
  UPDATE_PROFILE
} from './constants'
import { LOADING_STATE } from '../../helpers/constants'
import {
  addUsersAC,
  setContactsAC,
  setContactsLoadingStateAC,
  setRolesAC,
  setUsersAC,
  setUsersLoadingStateAC,
  updateUserProfileAC
} from './actions'
import { IAction } from '../../types'
import { getActiveChannelId, getChannelFromMap, query } from '../../helpers/channelHalper'
import { updateChannelDataAC } from '../channel/actions'

function* getContacts(): any {
  try {
    const SceytChatClient = getClient()
    const contactsData = yield call(SceytChatClient.getAllContacts)
    yield put(setContactsAC(JSON.parse(JSON.stringify(contactsData))))
    yield put(setContactsLoadingStateAC(LOADING_STATE.LOADED))
  } catch (e) {
    console.log('ERROR in get contacts - :', e.message)
    if (e.code !== 10008) {
      // yield put(setErrorNotification(e.message))
    }
  }
}
function* getRoles(): any {
  try {
    const SceytChatClient = getClient()
    const roles = yield call(SceytChatClient.getRoles)
    yield put(setRolesAC(roles))
  } catch (e) {
    console.log('ERROR in get roles - ', e.message)
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
    const blockedUsers = yield call(SceytChatClient.blockUsers, userIds)

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
    const unblockedUsers = yield call(SceytChatClient.unblockUsers, userIds)
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

function* updateProfile(action: IAction): any {
  try {
    const { payload } = action
    const { user, firstName, lastName, avatarUrl, metadata, avatarFile, presence } = payload
    const updateUserProfileData: any = {}

    const SceytChatClient = getClient()
    if (avatarFile) {
      const fileToUpload = {
        data: avatarFile,
        progress: (progressPercent: number) => {
          console.log('upload percent - ', progressPercent)
        }
      }
      updateUserProfileData.avatarUrl = yield call(SceytChatClient.uploadFile, fileToUpload)
    } else if (avatarUrl && user.avatarUrl !== avatarUrl) {
      updateUserProfileData.avatarUrl = avatarUrl
    }

    if (firstName && user.firstName !== firstName) {
      updateUserProfileData.firstName = firstName
    }

    if (user.presence.status !== presence) {
    }

    if (lastName && user.lastName !== lastName) {
      updateUserProfileData.lastName = lastName
    }

    if (user.metadata !== metadata) {
      updateUserProfileData.metadata = metadata
    }

    const updatedUser = yield call(SceytChatClient.setProfile, updateUserProfileData)
    yield put(updateUserProfileAC({ ...updatedUser }))
  } catch (error) {
    console.log(error, 'Error on update user')
    // yield put(setErrorNotification(error.message))
  }
}

function* getUsers(action: IAction): any {
  try {
    const { payload } = action
    const { params } = payload
    const SceytChatClient = getClient()
    const usersQueryBuilder = new SceytChatClient.UserListQueryBuilder()

    if (params.query) {
      usersQueryBuilder.query(params.query)
    }

    if (params.limit) {
      usersQueryBuilder.limit(params.limit)
    }

    if (params.order === 'firstname') {
      usersQueryBuilder.orderByFirstname()
    }

    if (params.order === 'lastname') {
      usersQueryBuilder.orderByLastname()
    }

    if (params.order === 'username') {
      usersQueryBuilder.orderByUsername()
    }

    if (params.filter === 'all') {
      usersQueryBuilder.filterByAll()
    }

    if (params.filter === 'firstname') {
      usersQueryBuilder.filterByFirstname()
    }

    if (params.filter === 'lastname') {
      usersQueryBuilder.filterByLastname()
    }

    if (params.filter === 'username') {
      usersQueryBuilder.filterByUsername()
    }
    const usersQuery = yield call(usersQueryBuilder.build)

    query.usersQuery = usersQuery

    yield put(setUsersLoadingStateAC(LOADING_STATE.LOADING))
    const { users } = yield call(usersQuery.loadNextPage)

    yield put(setUsersAC(users))

    yield put(setUsersLoadingStateAC(LOADING_STATE.LOADED))
  } catch (e) {
    console.log('ERROR on get users', e.message)
    if (e.code !== 10008) {
      // yield put(setErrorNotification(e.message))
    }
  }
}

function* loadMoreUsers(action: IAction): any {
  try {
    const { payload } = action
    const { limit } = payload

    const { usersQuery } = query

    if (limit) {
      usersQuery.limit = limit
    }
    yield put(setUsersLoadingStateAC(LOADING_STATE.LOADING))
    const { users } = yield call(usersQuery.loadNextPage)

    yield put(addUsersAC(users))

    yield put(setUsersLoadingStateAC(LOADING_STATE.LOADED))
  } catch (e) {
    console.log('ERROR load more users', e.message)
    if (e.code !== 10008) {
      // yield put(setErrorNotification(e.message))
    }
  }
}

export default function* MembersSaga() {
  yield takeLatest(GET_CONTACTS, getContacts)
  yield takeLatest(GET_USERS, getUsers)
  yield takeLatest(LOAD_MORE_USERS, loadMoreUsers)
  yield takeLatest(GET_ROLES, getRoles)
  yield takeLatest(BLOCK_USERS, blockUser)
  yield takeLatest(UNBLOCK_USERS, unblockUser)
  yield takeLatest(UPDATE_PROFILE, updateProfile)
}
