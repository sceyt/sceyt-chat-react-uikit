import { call, put, takeLatest } from 'redux-saga/effects'
import { getClient } from '../../common/client'
import { BLOCK_USERS, GET_CONTACTS, GET_USERS, LOAD_MORE_USERS, UNBLOCK_USERS, UPDATE_PROFILE } from './constants'
import { DEFAULT_CHANNEL_TYPE, LOADING_STATE } from '../../helpers/constants'
import {
  addUsersAC,
  setContactsAC,
  setContactsLoadingStateAC,
  setUsersAC,
  setUsersLoadingStateAC,
  updateUserProfileAC
} from './actions'
import { IAction, IMember } from '../../types'
import { getActiveChannelId, getChannelFromMap, query, updateChannelOnAllChannels } from '../../helpers/channelHalper'
import { updateChannelDataAC } from '../channel/actions'
import log from 'loglevel'

function* getContacts(): any {
  try {
    const SceytChatClient = getClient()
    const contactsData = yield call(SceytChatClient.getAllContacts)
    yield put(setContactsAC(JSON.parse(JSON.stringify(contactsData))))
    yield put(setContactsLoadingStateAC(LOADING_STATE.LOADED))
  } catch (e) {
    log.error('ERROR in get contacts - :', e.message)
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
    const isDirectChannel = activeChannel && activeChannel.type === DEFAULT_CHANNEL_TYPE.DIRECT
    const directChannelUser =
      isDirectChannel && activeChannel.members.find((member: IMember) => member.id !== SceytChatClient.user.id)
    if (directChannelUser && directChannelUser.id === blockedUsers[0].id) {
      yield put(
        updateChannelDataAC(activeChannelId, {
          members: activeChannel.members.map((member: IMember) => {
            if (member.id === blockedUsers[0].id) {
              return blockedUsers[0]
            } else {
              return member
            }
          })
        })
      )
      updateChannelOnAllChannels(activeChannelId, {
        members: activeChannel.members.map((member: IMember) => {
          if (member.id === blockedUsers[0].id) {
            return blockedUsers[0]
          } else {
            return member
          }
        })
      })
    }
  } catch (error) {
    log.error('error in block users', error.message)
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
    const isDirectChannel = activeChannel && activeChannel.type === DEFAULT_CHANNEL_TYPE.DIRECT
    const directChannelUser =
      isDirectChannel && activeChannel.members.find((member: IMember) => member.id !== SceytChatClient.user.id)
    if (directChannelUser && directChannelUser.id === unblockedUsers[0].id) {
      yield put(
        updateChannelDataAC(activeChannelId, {
          members: activeChannel.members.map((member: IMember) => {
            if (member.id === unblockedUsers[0].id) {
              return unblockedUsers[0]
            } else {
              return member
            }
          })
        })
      )
      updateChannelOnAllChannels(activeChannelId, {
        members: activeChannel.members.map((member: IMember) => {
          if (member.id === unblockedUsers[0].id) {
            return unblockedUsers[0]
          } else {
            return member
          }
        })
      })
    }
  } catch (error) {
    log.error('error in unblock users', error.message)
    // yield put(setErrorNotification(error.message))
  }
}

function* updateProfile(action: IAction): any {
  try {
    const { payload } = action
    const { user, firstName, lastName, avatarUrl, metadata, avatarFile } = payload
    const updateUserProfileData: any = {}

    const SceytChatClient = getClient()
    if (avatarFile) {
      const fileToUpload = {
        data: avatarFile,
        progress: (progressPercent: number) => {
          log.info('upload percent - ', progressPercent)
        }
      }
      updateUserProfileData.avatarUrl = yield call(SceytChatClient.uploadFile, fileToUpload)
    } else if (avatarUrl && user.avatarUrl !== avatarUrl) {
      updateUserProfileData.avatarUrl = avatarUrl
    }

    if (firstName && user.firstName !== firstName) {
      updateUserProfileData.firstName = firstName
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
    log.error(error, 'Error on update user')
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
    log.info('user query params ..... ', params)
    const usersQuery = yield call(usersQueryBuilder.build)

    query.usersQuery = usersQuery

    yield put(setUsersLoadingStateAC(LOADING_STATE.LOADING))

    const { users } = yield call(usersQuery.loadNextPage)

    yield put(setUsersAC(JSON.parse(JSON.stringify(users))))

    yield put(setUsersLoadingStateAC(LOADING_STATE.LOADED))
  } catch (e) {
    log.error('ERROR on get users', e.message)
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
    log.error('ERROR load more users', e.message)
    if (e.code !== 10008) {
      // yield put(setErrorNotification(e.message))
    }
  }
}

export default function* MembersSaga() {
  yield takeLatest(GET_CONTACTS, getContacts)
  yield takeLatest(GET_USERS, getUsers)
  yield takeLatest(LOAD_MORE_USERS, loadMoreUsers)
  yield takeLatest(BLOCK_USERS, blockUser)
  yield takeLatest(UNBLOCK_USERS, unblockUser)
  yield takeLatest(UPDATE_PROFILE, updateProfile)
}
