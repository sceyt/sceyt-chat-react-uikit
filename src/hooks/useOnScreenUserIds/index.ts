import { RefObject, useEffect, useRef, useState } from 'react'
import usePresenceSubscription from '../usePresenceSubscription'
import { observePresenceRow, PRESENCE_ENTER_DELAY, PRESENCE_LEAVE_GRACE } from '../useIsOnScreen'

type ObservedRow = {
  id: string
  stop: () => void
  enterTimer: ReturnType<typeof setTimeout> | null
  visible: boolean
}

export default function useOnScreenUserIds(ref: RefObject<Element>, rowIds: string[], enabled = true) {
  const [visibleIds, setVisibleIds] = useState<string[]>([])
  const activeIds = useRef(new Set<string>())
  const observed = useRef(new Map<Element, ObservedRow>())
  // Rows currently visible per user ID; several rows can show the same user.
  const visibleCounts = useRef(new Map<string, number>())
  const removeTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const idsKey = Array.from(new Set(rowIds.filter(Boolean))).join('\u0000')
  usePresenceSubscription(visibleIds, { enabled })

  const publish = () => setVisibleIds(Array.from(activeIds.current))

  const showRow = (id: string) => {
    visibleCounts.current.set(id, (visibleCounts.current.get(id) || 0) + 1)
    const timer = removeTimers.current.get(id)
    if (timer) clearTimeout(timer)
    removeTimers.current.delete(id)
    if (!activeIds.current.has(id)) {
      activeIds.current.add(id)
      publish()
    }
  }

  const hideRow = (id: string) => {
    const count = (visibleCounts.current.get(id) || 0) - 1
    if (count > 0) {
      visibleCounts.current.set(id, count)
      return
    }
    visibleCounts.current.delete(id)
    if (removeTimers.current.has(id)) return
    removeTimers.current.set(
      id,
      setTimeout(() => {
        removeTimers.current.delete(id)
        if (!visibleCounts.current.get(id) && activeIds.current.delete(id)) publish()
      }, PRESENCE_LEAVE_GRACE)
    )
  }

  const releaseRow = (row: ObservedRow) => {
    if (row.enterTimer) clearTimeout(row.enterTimer)
    row.enterTimer = null
    if (row.visible) {
      row.visible = false
      hideRow(row.id)
    }
  }

  useEffect(() => {
    const elements = enabled && ref.current ? Array.from(ref.current.querySelectorAll('[data-presence-user-id]')) : []
    const currentElements = new Set(elements)
    observed.current.forEach((row, element) => {
      if (!currentElements.has(element)) {
        row.stop()
        observed.current.delete(element)
        releaseRow(row)
      }
    })

    elements.forEach((element) => {
      if (observed.current.has(element)) return
      const id = (element as HTMLElement).dataset.presenceUserId
      if (!id) return
      const row: ObservedRow = { id, stop: () => undefined, enterTimer: null, visible: false }
      observed.current.set(element, row)
      row.stop = observePresenceRow(element, (onScreen) => {
        if (!onScreen) {
          releaseRow(row)
          return
        }
        if (row.visible || row.enterTimer) return
        row.enterTimer = setTimeout(() => {
          row.enterTimer = null
          row.visible = true
          showRow(id)
        }, PRESENCE_ENTER_DELAY)
      })
    })
  }, [ref, idsKey, enabled])

  useEffect(
    () => () => {
      observed.current.forEach((row) => {
        row.stop()
        if (row.enterTimer) clearTimeout(row.enterTimer)
      })
      observed.current.clear()
      removeTimers.current.forEach((timer) => clearTimeout(timer))
      removeTimers.current.clear()
      visibleCounts.current.clear()
      activeIds.current.clear()
    },
    []
  )
}
