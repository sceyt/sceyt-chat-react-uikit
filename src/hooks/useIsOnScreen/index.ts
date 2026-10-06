import { RefObject, useEffect, useState } from 'react'

type VisibilityCallback = (visible: boolean) => void
const callbacks = new Map<Element, Set<VisibilityCallback>>()
let observer: IntersectionObserver | null = null

const getObserver = () => {
  if (typeof IntersectionObserver === 'undefined') return null
  if (!observer) {
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        callbacks.get(entry.target)?.forEach((callback) => callback(entry.isIntersecting))
      })
    })
  }
  return observer
}

export const observePresenceRow = (element: Element, callback: VisibilityCallback) => {
  const sharedObserver = getObserver()
  if (!sharedObserver) {
    // eslint-disable-next-line n/no-callback-literal
    callback(true)
    return () => undefined
  }
  let listeners = callbacks.get(element)
  if (!listeners) {
    listeners = new Set()
    callbacks.set(element, listeners)
    sharedObserver.observe(element)
  }
  listeners.add(callback)
  return () => {
    listeners?.delete(callback)
    if (!listeners?.size) {
      callbacks.delete(element)
      sharedObserver.unobserve(element)
      if (!callbacks.size) {
        sharedObserver.disconnect()
        observer = null
      }
    }
  }
}

export default function useIsOnScreen(ref: RefObject<Element>, enabled = true): boolean {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!enabled || !ref.current) {
      setVisible(false)
      return
    }
    let leaveTimer: ReturnType<typeof setTimeout> | null = null
    const unobserve = observePresenceRow(ref.current, (onScreen) => {
      if (leaveTimer) clearTimeout(leaveTimer)
      leaveTimer = onScreen ? null : setTimeout(() => setVisible(false), 2000)
      if (onScreen) setVisible(true)
    })
    return () => {
      if (leaveTimer) clearTimeout(leaveTimer)
      unobserve()
    }
  }, [ref, enabled])
  return enabled && visible
}
