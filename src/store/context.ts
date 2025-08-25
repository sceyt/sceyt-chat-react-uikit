import React from 'react'
import type { ReactReduxContextValue } from 'react-redux'

export const SceytReduxContext = React.createContext<ReactReduxContextValue<any, any> | null>(null)
