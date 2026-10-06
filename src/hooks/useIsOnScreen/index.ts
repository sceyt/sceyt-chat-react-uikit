import { RefObject, useEffect, useState } from 'react'

// A row counts as on screen only after it stays visible this long, so fast scrolling does not subscribe it.
export const PRESENCE_ENTER_DELAY = 300
// A row stays subscribed this long after it leaves the screen.
export const PRESENCE_LEAVE_GRACE = 2000

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
    let enterTimer: ReturnType<typeof setTimeout> | null = null
    let leaveTimer: ReturnType<typeof setTimeout> | null = null
    let shown = false
    const unobserve = observePresenceRow(ref.current, (onScreen) => {
      if (onScreen) {
        if (leaveTimer) clearTimeout(leaveTimer)
        leaveTimer = null
        if (shown || enterTimer) return
        enterTimer = setTimeout(() => {
          enterTimer = null
          shown = true
          setVisible(true)
        }, PRESENCE_ENTER_DELAY)
      } else {
        if (enterTimer) clearTimeout(enterTimer)
        enterTimer = null
        if (!shown || leaveTimer) return
        leaveTimer = setTimeout(() => {
          leaveTimer = null
          shown = false
          setVisible(false)
        }, PRESENCE_LEAVE_GRACE)
      }
    })
    return () => {
      if (enterTimer) clearTimeout(enterTimer)
      if (leaveTimer) clearTimeout(leaveTimer)
      unobserve()
    }
  }, [ref, enabled])
  return enabled && visible
}
