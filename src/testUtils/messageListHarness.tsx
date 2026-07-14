import React, { PropsWithChildren } from 'react'
import { combineReducers, configureStore, EnhancedStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import { render, RenderOptions } from '@testing-library/react'
import { SceytReduxContext } from '../store/context'
import ChannelReducer from '../store/channel/reducers'
import MembersReducer from '../store/member/reducers'
import MessageReducer from '../store/message/reducers'
import ThemeReducer from '../store/theme/reducers'
import UserReducer from '../store/user/reducers'
import { RectInput, ScrollMetrics } from 'setupTests'
export { makeChannel, makeMessage, makePendingMessage, makeUser, resetMessageListFixtureIds } from './messageFixtures'

const reducers = {
  ChannelReducer,
  MessageReducer,
  MembersReducer,
  ThemeReducer,
  UserReducer
}

const rootReducer = combineReducers(reducers)

export type MessageListTestState = ReturnType<typeof rootReducer>
export type MessageListTestStore = EnhancedStore<MessageListTestState>

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Map<any, any>
    ? T[K]
    : T[K] extends Date
      ? T[K]
      : T[K] extends Array<any>
        ? T[K]
        : T[K] extends object
          ? DeepPartial<T[K]>
          : T[K]
}

type RenderHarnessOptions = Omit<RenderOptions, 'queries'> & {
  preloadedState?: DeepPartial<MessageListTestState>
  store?: MessageListTestStore
}

type TestGlobalHelpers = typeof globalThis & {
  __setMockElementRect: (element: Element, rect: RectInput) => DOMRect
  __setMockScrollMetrics: (element: HTMLElement, metrics: ScrollMetrics) => void
  __setMockIntersection: (element: Element, isIntersecting: boolean) => void
  __flushAnimationFrames: () => void
  __getLastScrollIntoViewTarget: () => Element | null
}

const testGlobal = global as TestGlobalHelpers

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Object.prototype.toString.call(value) === '[object Object]'

const mergeDeep = <T,>(base: T, patch?: DeepPartial<T>): T => {
  if (!patch) {
    return base
  }

  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return patch as T
  }

  const result: Record<string, unknown> = { ...base }
  Object.keys(patch).forEach((key) => {
    const patchValue = patch[key as keyof typeof patch]
    if (patchValue === undefined) {
      return
    }

    const baseValue = result[key]
    if (patchValue instanceof Date || patchValue instanceof Map || Array.isArray(patchValue)) {
      result[key] = patchValue
      return
    }

    result[key] =
      isPlainObject(baseValue) && isPlainObject(patchValue)
        ? mergeDeep(baseValue, patchValue as DeepPartial<typeof baseValue>)
        : patchValue
  })

  return result as T
}

export const createMessageListStore = (preloadedState?: DeepPartial<MessageListTestState>) => {
  const initialState = rootReducer(undefined, { type: '@@TEST/INIT' })

  return configureStore({
    reducer: reducers,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        thunk: false,
        serializableCheck: false
      }),
    preloadedState: mergeDeep(initialState, preloadedState)
  })
}

export const renderWithSceytProvider = (ui: React.ReactElement, options: RenderHarnessOptions = {}) => {
  const { preloadedState, store = createMessageListStore(preloadedState), ...renderOptions } = options

  const Wrapper = ({ children }: PropsWithChildren<{}>) => (
    <Provider context={SceytReduxContext} store={store}>
      {children}
    </Provider>
  )

  return {
    store,
    ...render(ui, { wrapper: Wrapper, ...renderOptions })
  }
}

export const setElementRect = (element: Element, rect: RectInput) => testGlobal.__setMockElementRect(element, rect)

export const setScrollMetrics = (element: HTMLElement, metrics: ScrollMetrics) =>
  testGlobal.__setMockScrollMetrics(element, metrics)

export const setElementIntersecting = (element: Element, isIntersecting: boolean) =>
  testGlobal.__setMockIntersection(element, isIntersecting)

export const flushAnimationFrames = () => testGlobal.__flushAnimationFrames()

export const getLastScrollIntoViewTarget = () => testGlobal.__getLastScrollIntoViewTarget()
