import { useEffect, useLayoutEffect, useRef } from 'react'

const REORDER_DURATION = 240

const getAnimatedTranslateY = (element: HTMLElement) => {
  const transform = window.getComputedStyle(element).transform
  if (!transform || transform === 'none') return 0

  const matrix = transform.match(/^matrix(3d)?\((.+)\)$/)
  if (matrix) {
    const values = matrix[2].split(',').map(Number)
    return values[matrix[1] ? 13 : 5] || 0
  }

  return Number(transform.match(/translateY\((-?[\d.]+)px\)/)?.[1]) || 0
}

/**
 * Animate only layout moves caused by a change in channel order.
 * Rows must be direct children of the list, carry `data-channel-row-id`, and the
 * list must be their offset parent (positioned) so offsetTop shares the list's
 * scroll coordinates.
 */
export const useChannelReorderAnimation = (channels: { id: string }[]) => {
  const listRef = useRef<HTMLDivElement | null>(null)
  const previousList = useRef<HTMLDivElement | null>(null)
  const previousChannels = useRef<{ id: string }[] | null>(null)
  const previousPositions = useRef(new Map<string, number>())
  const previousOrder = useRef<string[]>([])
  const animations = useRef(new Map<string, Animation>())

  useLayoutEffect(() => {
    const list = listRef.current
    // ChannelList re-renders for many reasons unrelated to the order (typing,
    // hover, presence). Reading every row's offsetTop forces layout, so only
    // measure when the channels or the list element itself changed.
    if (list === previousList.current && channels === previousChannels.current) return
    const listChanged = list !== previousList.current
    previousList.current = list
    previousChannels.current = channels

    if (listChanged) {
      animations.current.forEach((animation) => animation.cancel())
      animations.current.clear()
      previousPositions.current.clear()
      previousOrder.current = []
    }
    if (!list) return

    const rows = Array.from(list.children).filter(
      (element): element is HTMLElement => element instanceof HTMLElement && !!element.dataset.channelRowId
    )
    const positions = new Map(rows.map((row) => [row.dataset.channelRowId as string, row.offsetTop]))
    const order = channels.map((channel) => channel.id)
    animations.current.forEach((animation, id) => {
      if (!positions.has(id)) {
        animation.cancel()
        animations.current.delete(id)
      }
    })
    const orderChanged =
      order.length !== previousOrder.current.length || order.some((id, index) => id !== previousOrder.current[index])
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    if (orderChanged && previousOrder.current.length && !prefersReducedMotion && list.clientHeight) {
      const viewportTop = list.scrollTop
      const viewportBottom = viewportTop + list.clientHeight

      rows.forEach((row) => {
        const id = row.dataset.channelRowId as string
        const oldTop = previousPositions.current.get(id)
        const newTop = positions.get(id) as number
        if (oldTop === undefined || (oldTop > viewportBottom && newTop > viewportBottom)) return
        if (oldTop + row.offsetHeight < viewportTop && newTop + row.offsetHeight < viewportTop) return

        const running = animations.current.get(id)
        const currentTranslation = running ? getAnimatedTranslateY(row) : 0
        running?.cancel()
        animations.current.delete(id)

        const delta = oldTop - newTop + currentTranslation
        if (Math.abs(delta) < 1 || !row.animate) return

        // A chat moving up passes over the rows it displaces; keep it on top
        // instead of sliding underneath them.
        const zIndex = delta > 0 ? 1 : 0
        const animation = row.animate(
          [
            { transform: `translateY(${delta}px)`, zIndex },
            { transform: 'translateY(0)', zIndex }
          ],
          {
            duration: REORDER_DURATION,
            easing: 'cubic-bezier(0.2, 0, 0, 1)'
          }
        )
        animations.current.set(id, animation)
        animation.onfinish = () => {
          if (animations.current.get(id) === animation) animations.current.delete(id)
        }
      })
    }

    previousPositions.current = positions
    previousOrder.current = order
  })

  useEffect(
    () => () => {
      animations.current.forEach((animation) => animation.cancel())
      animations.current.clear()
    },
    []
  )

  return listRef
}
