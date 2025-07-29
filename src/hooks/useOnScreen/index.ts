import { useEffect, useState, useRef } from 'react'

export default function useOnScreen(ref: any, rootElement?: HTMLElement | null) {
  const [isIntersecting, setIntersecting] = useState(false)

  useEffect(() => {
    if (!ref?.current) return

    const observer = new IntersectionObserver(([entry]) => setIntersecting(entry.isIntersecting), {
      root: rootElement || null, // Use the provided root element or default to viewport
      rootMargin: '0px',
      threshold: 0.1 // Trigger when 10% of the element is visible
    })

    observer.observe(ref.current)

    // Remove the observer as soon as the component is unmounted
    return () => {
      observer.disconnect()
    }
  }, [ref, rootElement])

  return isIntersecting
}

// New hook specifically for checking if element is visible in scrollableDiv
export function useOnScreenInScrollableDiv(ref: any) {
  const [isVisible, setIsVisible] = useState(false)
  const scrollableDivRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    // Get the scrollableDiv element
    scrollableDivRef.current = document.getElementById('scrollableDiv')

    if (!ref?.current || !scrollableDivRef.current) return

    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), {
      root: scrollableDivRef.current, // Use scrollableDiv as the root
      rootMargin: '0px',
      threshold: 0.1 // Trigger when 10% of the element is visible
    })

    observer.observe(ref.current)

    return () => {
      observer.disconnect()
    }
  }, [ref])

  return isVisible
}

// Alternative hook that gives more detailed visibility information
export function useElementVisibilityInContainer(ref: any, containerId: string = 'scrollableDiv') {
  const [visibility, setVisibility] = useState({
    isVisible: false,
    isFullyVisible: false,
    visibilityPercentage: 0
  })

  useEffect(() => {
    const container = document.getElementById(containerId)
    if (!ref?.current || !container) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isVisible = entry.isIntersecting
        const isFullyVisible = entry.intersectionRatio === 1
        const visibilityPercentage = Math.round(entry.intersectionRatio * 100)

        setVisibility({
          isVisible,
          isFullyVisible,
          visibilityPercentage
        })
      },
      {
        root: container,
        rootMargin: '0px',
        threshold: [0, 0.25, 0.5, 0.75, 1] // Multiple thresholds for more detailed info
      }
    )

    observer.observe(ref.current)

    return () => {
      observer.disconnect()
    }
  }, [ref, containerId])

  return visibility
}
