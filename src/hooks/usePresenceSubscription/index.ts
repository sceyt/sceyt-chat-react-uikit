import { useEffect, useRef } from 'react'
import { presenceRegistry } from '../../helpers/presence/registry'

export default function usePresenceSubscription(ids: string[], { enabled = true }: { enabled?: boolean } = {}) {
  const subscriptions = useRef(new Map<string, () => void>())
  const idsKey = Array.from(new Set(ids.filter(Boolean)))
    .sort()
    .join('\u0000')

  useEffect(() => {
    const desired = new Set(enabled ? idsKey.split('\u0000').filter(Boolean) : [])
    subscriptions.current.forEach((unsubscribe, id) => {
      if (!desired.has(id)) {
        unsubscribe()
        subscriptions.current.delete(id)
      }
    })
    desired.forEach((id) => {
      if (!subscriptions.current.has(id)) {
        subscriptions.current.set(id, presenceRegistry.subscribe([id]))
      }
    })
  }, [idsKey, enabled])

  useEffect(
    () => () => {
      subscriptions.current.forEach((unsubscribe) => unsubscribe())
      subscriptions.current.clear()
    },
    []
  )
}
