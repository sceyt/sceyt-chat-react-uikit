import { RefObject, useEffect, useRef, useState } from 'react'
import usePresenceSubscription from '../usePresenceSubscription'
import { observePresenceRow } from '../useIsOnScreen'

export default function useOnScreenUserIds(ref: RefObject<Element>, rowIds: string[], enabled = true) {
  const [visibleIds, setVisibleIds] = useState<string[]>([])
  const activeIds = useRef(new Set<string>())
  const observed = useRef(new Map<Element, { id: string; stop: () => void }>())
  const leaveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const idsKey = Array.from(new Set(rowIds.filter(Boolean))).join('\u0000')
  usePresenceSubscription(visibleIds, { enabled })

  const publish = () => setVisibleIds(Array.from(activeIds.current))
  const clearLeaveTimer = (id: string) => {
    const timer = leaveTimers.current.get(id)
    if (timer) clearTimeout(timer)
    leaveTimers.current.delete(id)
  }

  useEffect(() => {
    const elements = enabled && ref.current ? Array.from(ref.current.querySelectorAll('[data-presence-user-id]')) : []
    const currentElements = new Set(elements)
    observed.current.forEach(({ id, stop }, element) => {
      if (!currentElements.has(element)) {
        stop()
        observed.current.delete(element)
        clearLeaveTimer(id)
        if (activeIds.current.delete(id)) publish()
      }
    })

    elements.forEach((element) => {
      if (observed.current.has(element)) return
      const id = (element as HTMLElement).dataset.presenceUserId
      if (!id) return
      const stop = observePresenceRow(element, (onScreen) => {
        clearLeaveTimer(id)
        if (onScreen) {
          if (!activeIds.current.has(id)) {
            activeIds.current.add(id)
            publish()
          }
        } else {
          leaveTimers.current.set(
            id,
            setTimeout(() => {
              leaveTimers.current.delete(id)
              if (activeIds.current.delete(id)) publish()
            }, 2000)
          )
        }
      })
      observed.current.set(element, { id, stop })
    })
  }, [ref, idsKey, enabled])

  useEffect(
    () => () => {
      observed.current.forEach(({ stop }) => stop())
      observed.current.clear()
      leaveTimers.current.forEach((timer) => clearTimeout(timer))
      leaveTimers.current.clear()
      activeIds.current.clear()
    },
    []
  )
}
