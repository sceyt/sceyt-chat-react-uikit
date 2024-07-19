import { combineReducers } from 'redux'
import ChannelReducer from './channel/reducers'
import MessageReducer from './message/reducers'
import MembersReducer from './member/reducers'
import UserReducer from './user/reducers'
import ThemeReducer from './theme/reducers'

export default combineReducers({
  ChannelReducer,
  MessageReducer,
  MembersReducer,
  ThemeReducer,
  UserReducer,
})
