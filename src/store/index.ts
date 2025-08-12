import createSagaMiddleware from 'redux-saga'
import { configureStore } from '@reduxjs/toolkit'
import ChannelReducer from './channel/reducers'
import MessageReducer from './message/reducers'
import MembersReducer from './member/reducers'
import UserReducer from './user/reducers'
import ThemeReducer from './theme/reducers'
import rootSaga from './saga'
// Import Redux v5 compatibility polyfills

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

export default store
