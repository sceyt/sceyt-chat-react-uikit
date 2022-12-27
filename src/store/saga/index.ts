import { all } from 'redux-saga/effects'
import ChannelsSaga from '../channel/saga'
import MessagesSaga from '../message/saga'
import MembersSaga from '../member/saga'
import UsersSaga from '../user/saga'

export default function* rootSaga() {
  yield all([ChannelsSaga(), MessagesSaga(), MembersSaga(), UsersSaga()])
}
