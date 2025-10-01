import createSagaMiddleware from 'redux-saga'
import { configureStore } from '@reduxjs/toolkit'
import { enableMapSet } from 'immer'
import ChannelReducer from './channel/reducers'
import MessageReducer from './message/reducers'
import MembersReducer from './member/reducers'
import UserReducer from './user/reducers'
import ThemeReducer from './theme/reducers'
import rootSaga from './saga'
// Enable Immer support for Map/Set structures used in state
enableMapSet()

const sagaMiddleware = createSagaMiddleware()
const store = configureStore({
  reducer: {
    ChannelReducer,
    MessageReducer,
    MembersReducer,
    ThemeReducer,
    UserReducer
  },
  // middleware: [...getDefaultMiddleware({ thunk: false, serializableCheck: false }), sagaMiddleware],
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      thunk: false,
      serializableCheck: false
    }).concat(sagaMiddleware),
  devTools: process.env.NODE_ENV !== 'production'
})

sagaMiddleware.run(rootSaga)

export type SceytChatState = ReturnType<typeof store.getState>
export type SceytChatDispatch = typeof store.dispatch

export default store
