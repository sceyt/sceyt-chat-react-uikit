import createSagaMiddleware from 'redux-saga'
import { configureStore } from '@reduxjs/toolkit'
import reducers from './reducers'
import rootSaga from './saga'

const sagaMiddleware = createSagaMiddleware()
const store = configureStore({
  reducer: reducers,
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
