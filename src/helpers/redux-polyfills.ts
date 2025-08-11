/**
 * Redux v5 compatibility polyfills
 * These utilities were removed from Redux v5 but are still needed by some packages
 */

// Polyfill for isAction utility that was removed in Redux v5
function isAction(action: any): action is { type: string } {
  return typeof action === 'object' && action !== null && typeof action.type === 'string'
}

// Polyfill for isPlainObject utility that was removed in Redux v5
function isPlainObject(obj: any): obj is object {
  if (typeof obj !== 'object' || obj === null) return false

  let proto = obj
  while (Object.getPrototypeOf(proto) !== null) {
    proto = Object.getPrototypeOf(proto)
  }

  return Object.getPrototypeOf(obj) === proto || Object.getPrototypeOf(obj) === null
}

// Patch the Redux module to add the missing exports
try {
  const redux = require('redux')
  if (!redux.isAction) {
    redux.isAction = isAction
  }
  if (!redux.isPlainObject) {
    redux.isPlainObject = isPlainObject
  }
} catch (error) {
  console.warn('Could not patch Redux module:', error)
}

export { isAction, isPlainObject }
