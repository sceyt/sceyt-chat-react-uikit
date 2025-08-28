import { createSelectorHook, createDispatchHook, createStoreHook } from 'react-redux'
import { SceytReduxContext } from './context'

export const useSelector = createSelectorHook(SceytReduxContext)
export const useDispatch = createDispatchHook(SceytReduxContext)
export const useStore = createStoreHook(SceytReduxContext)
