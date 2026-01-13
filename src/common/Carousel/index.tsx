import React, { useState, useEffect, useRef, useCallback, ReactNode } from 'react'
import styled from 'styled-components'

export interface RenderArrowProps {
  type: 'PREV' | 'NEXT'
  onClick: () => void
  isEdge: boolean
}

export interface CarouselProps {
  children: ReactNode
  className?: string
  initialActiveIndex?: number
  onNextStart?: () => void
  onPrevStart?: () => void
  onChange?: (currentIndex: number) => void
  renderArrow?: (props: RenderArrowProps) => ReactNode
  pagination?: boolean
  isRTL?: boolean
  skipTransition?: boolean
}

const Carousel: React.FC<CarouselProps> = ({
  children,
  className = '',
  initialActiveIndex = 0,
  onNextStart,
  onPrevStart,
  onChange,
  renderArrow,
  pagination = false,
  isRTL = false,
  skipTransition = false
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialActiveIndex)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const startXRef = useRef<number>(0)
  const currentXRef = useRef<number>(0)
  const isDraggingRef = useRef<boolean>(false)
  const offsetRef = useRef<number>(0)
  const isInternalNavigationRef = useRef<boolean>(false)
  const lastInitialIndexRef = useRef<number>(initialActiveIndex)
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const currentIndexRef = useRef<number>(initialActiveIndex)

  // Reset internal navigation flag when component remounts (key changes)
  useEffect(() => {
    isInternalNavigationRef.current = false
    setCurrentIndex(initialActiveIndex)
    currentIndexRef.current = initialActiveIndex
    lastInitialIndexRef.current = initialActiveIndex
  }, [initialActiveIndex])

  // Use React.Children.map directly to preserve keys from children
  // This ensures stable keys when items are prepended/appended
  const items = React.Children.toArray(children)
  const totalItems = items.length

  // Update current index when initialActiveIndex changes externally (but not from internal navigation)
  useEffect(() => {
    // Only update if initialActiveIndex changed externally (not from our own navigation)
    if (
      !isInternalNavigationRef.current &&
      initialActiveIndex >= 0 &&
      initialActiveIndex < totalItems &&
      initialActiveIndex !== currentIndex &&
      lastInitialIndexRef.current !== initialActiveIndex
    ) {
      // If skipTransition is true, update without transition
      if (skipTransition) {
        setIsTransitioning(false)
      }
      setCurrentIndex(initialActiveIndex)
      currentIndexRef.current = initialActiveIndex
      lastInitialIndexRef.current = initialActiveIndex
    }
  }, [initialActiveIndex, totalItems, currentIndex, skipTransition])

  // Keep ref in sync with state
  useEffect(() => {
    currentIndexRef.current = currentIndex
  }, [currentIndex])

  // Notify parent of index change (only when changed internally, not from external prop)
  useEffect(() => {
    if (onChange && currentIndex >= 0 && currentIndex < totalItems) {
      // Only call onChange if this was an internal navigation
      if (isInternalNavigationRef.current) {
        onChange(currentIndex)
        // Don't reset flag - keep it true during rapid clicks for smooth sliding
        // The flag will be reset when transition completes (handled in goToNext/goToPrev)
      }
    }
  }, [currentIndex, onChange, totalItems])

  const goToIndex = useCallback(
    (newIndex: number, skipTransition = false) => {
      // Strict bounds checking - never allow out of bounds
      if (newIndex < 0 || newIndex >= totalItems) {
        // Force to valid index
        newIndex = Math.max(0, Math.min(newIndex, totalItems - 1))
      }

      // Don't block navigation during transitions - allow rapid clicks
      // The transition will smoothly move to the new target

      // Mark as internal navigation
      isInternalNavigationRef.current = true

      if (skipTransition) {
        setIsTransitioning(false)
      } else {
        setIsTransitioning(true)
      }

      setCurrentIndex(newIndex)
      currentIndexRef.current = newIndex

      // Clear any pending transition timeout
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current)
      }

      // Reset transition state after animation
      if (!skipTransition) {
        transitionTimeoutRef.current = setTimeout(() => {
          setIsTransitioning(false)
          transitionTimeoutRef.current = null
        }, 400) // Match the transition duration
      }
    },
    [totalItems]
  )

  const goToNext = useCallback(() => {
    // Check edge condition first using ref to get latest value
    const currentIdx = currentIndexRef.current
    const nextIndex = currentIdx + 1

    // Early return if already at last item - don't set any transition state
    if (nextIndex >= totalItems) {
      return
    }

    // Mark as internal navigation and set transitioning state
    isInternalNavigationRef.current = true
    setIsTransitioning(true)

    // Clear any pending transition timeout
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current)
    }

    // Update index
    setCurrentIndex(nextIndex)
    currentIndexRef.current = nextIndex

    // Reset transition state and internal navigation flag after animation
    transitionTimeoutRef.current = setTimeout(() => {
      setIsTransitioning(false)
      isInternalNavigationRef.current = false
      transitionTimeoutRef.current = null
    }, 400)

    if (onNextStart) {
      onNextStart()
    }
  }, [totalItems, onNextStart])

  const goToPrev = useCallback(() => {
    // Check edge condition first using ref to get latest value
    const currentIdx = currentIndexRef.current
    const prevIndexValue = currentIdx - 1

    // Early return if already at first item - don't set any transition state
    if (prevIndexValue < 0) {
      return
    }

    // Mark as internal navigation and set transitioning state
    isInternalNavigationRef.current = true
    setIsTransitioning(true)

    // Clear any pending transition timeout
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current)
    }

    // Update index
    setCurrentIndex(prevIndexValue)
    currentIndexRef.current = prevIndexValue

    // Reset transition state and internal navigation flag after animation
    transitionTimeoutRef.current = setTimeout(() => {
      setIsTransitioning(false)
      isInternalNavigationRef.current = false
      transitionTimeoutRef.current = null
    }, 400)

    if (onPrevStart) {
      onPrevStart()
    }
  }, [onPrevStart])

  // Touch/Mouse handlers
  const handleStart = useCallback((clientX: number) => {
    // Allow starting drag even during transitions for better responsiveness
    isDraggingRef.current = true
    startXRef.current = clientX
    currentXRef.current = clientX
    offsetRef.current = 0
    setIsTransitioning(false)
    // Clear any pending transition timeout when user starts dragging
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current)
      transitionTimeoutRef.current = null
    }
  }, [])

  const handleMove = useCallback(
    (clientX: number) => {
      if (!isDraggingRef.current || isTransitioning) return

      const deltaX = clientX - startXRef.current
      currentXRef.current = clientX

      // Constrain deltaX to prevent dragging beyond edges
      let constrainedDeltaX = deltaX

      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth
        const wrapperWidth = containerWidth * totalItems
        const itemWidthPx = wrapperWidth / totalItems

        // Apply resistance when dragging beyond edges
        if (deltaX > 0 && currentIndex === 0) {
          // Dragging right at first item - apply resistance
          constrainedDeltaX = deltaX * 0.3
        } else if (deltaX < 0 && currentIndex === totalItems - 1) {
          // Dragging left at last item - apply resistance
          constrainedDeltaX = deltaX * 0.3
        }

        offsetRef.current = constrainedDeltaX

        const translateXPx = -currentIndex * itemWidthPx + constrainedDeltaX
        const translateXPercent = (translateXPx / wrapperWidth) * 100
        containerRef.current.style.transform = `translateX(${translateXPercent}%)`
        containerRef.current.style.transition = 'none'
      }
    },
    [currentIndex, isTransitioning, totalItems]
  )

  const handleEnd = useCallback(() => {
    if (!isDraggingRef.current) return

    isDraggingRef.current = false
    const threshold = 0.3 // 30% of item width to trigger slide change
    const absOffset = Math.abs(offsetRef.current)

    if (containerRef.current) {
      containerRef.current.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
    }

    // Always snap back if at edges, regardless of swipe distance
    const isAtFirstItem = currentIndex === 0
    const isAtLastItem = currentIndex === totalItems - 1

    if (absOffset > 0 && containerRef.current) {
      const containerWidth = containerRef.current.offsetWidth
      const itemWidth = containerWidth / totalItems
      const percentage = absOffset / itemWidth

      // Only allow navigation if we're not at the edges and swipe is significant
      if (percentage > threshold) {
        if (offsetRef.current > 0) {
          // Swiped right - go to previous
          if (!isAtFirstItem) {
            goToPrev()
          } else {
            // At first item, snap back
            goToIndex(currentIndex, true)
          }
        } else {
          // Swiped left - go to next
          if (!isAtLastItem) {
            goToNext()
          } else {
            // At last item, snap back
            goToIndex(currentIndex, true)
          }
        }
      } else {
        // Didn't swipe enough, snap back to current
        goToIndex(currentIndex, true)
      }
    } else {
      // No offset, stay at current
      goToIndex(currentIndex, true)
    }

    offsetRef.current = 0
  }, [currentIndex, totalItems, goToNext, goToPrev, goToIndex])

  // Touch events
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      handleStart(e.touches[0].clientX)
    },
    [handleStart]
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDraggingRef.current) return
      e.preventDefault()
      handleMove(e.touches[0].clientX)
    },
    [handleMove]
  )

  const handleTouchEnd = useCallback(() => {
    handleEnd()
  }, [handleEnd])

  // Mouse events
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return // Only left mouse button
      e.preventDefault()
      handleStart(e.clientX)
    },
    [handleStart]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDraggingRef.current) return
      handleMove(e.clientX)
    },
    [handleMove]
  )

  const handleMouseUp = useCallback(() => {
    handleEnd()
  }, [handleEnd])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && !isRTL) {
        goToPrev()
      } else if (e.key === 'ArrowRight' && !isRTL) {
        goToNext()
      } else if (e.key === 'ArrowLeft' && isRTL) {
        goToNext()
      } else if (e.key === 'ArrowRight' && isRTL) {
        goToPrev()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [goToNext, goToPrev, isRTL])

  // Update transform on index change with smooth animation
  useEffect(() => {
    if (containerRef.current && !isDraggingRef.current && totalItems > 0) {
      // Translate by the percentage of the wrapper width (which is totalItems * 100%)
      // Each item is 100/totalItems % of the wrapper
      const translateX = (-currentIndex * 100) / totalItems

      // Always ensure transition is set for user navigation to show sliding effect
      if (skipTransition) {
        // Instant update (no transition) for list changes
        containerRef.current.style.transition = 'none'
      } else if (isInternalNavigationRef.current) {
        // Always use smooth transition for user-initiated navigation (swipe, click, keyboard)
        // This ensures rapid clicks show smooth sliding effect
        containerRef.current.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
      } else {
        // No transition for other programmatic updates
        containerRef.current.style.transition = 'none'
      }

      // Apply transform after setting transition
      containerRef.current.style.transform = `translateX(${translateX}%)`
    }
  }, [currentIndex, isTransitioning, totalItems, skipTransition])

  // Initialize transform on mount/remount (instant if skipTransition, otherwise smooth)
  const isFirstRenderRef = useRef(true)
  useEffect(() => {
    if (containerRef.current && totalItems > 0) {
      const translateX = (-currentIndex * 100) / totalItems
      containerRef.current.style.transform = `translateX(${translateX}%)`
      // Always use no transition on mount/remount if skipTransition is true
      if (skipTransition) {
        containerRef.current.style.transition = 'none'
        isFirstRenderRef.current = false
      } else if (isFirstRenderRef.current) {
        // First render - no transition
        containerRef.current.style.transition = 'none'
        isFirstRenderRef.current = false
      }
      // For subsequent updates, transition is handled in the other useEffect
    }
  }, [currentIndex, totalItems, skipTransition])

  const isPrevDisabled = currentIndex === 0
  const isNextDisabled = currentIndex === totalItems - 1

  return (
    <CarouselContainer className={className}>
      <CarouselWrapper
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          width: `${totalItems * 100}%`
        }}
      >
        {React.Children.map(items, (child, index) => {
          // Preserve the original key from the child if it exists, otherwise use index
          const childKey = React.isValidElement(child) && child.key ? child.key : index
          return (
            <CarouselItem key={childKey} style={{ width: totalItems > 0 ? `${100 / totalItems}%` : '100%' }}>
              {child}
            </CarouselItem>
          )
        })}
      </CarouselWrapper>

      {renderArrow && (
        <React.Fragment>
          {renderArrow({
            type: 'PREV',
            onClick: goToPrev,
            isEdge: isPrevDisabled
          })}
          {renderArrow({
            type: 'NEXT',
            onClick: goToNext,
            isEdge: isNextDisabled
          })}
        </React.Fragment>
      )}

      {pagination && totalItems > 1 && (
        <Pagination>
          {items.map((_, index) => (
            <PaginationDot key={index} active={index === currentIndex} onClick={() => goToIndex(index)} />
          ))}
        </Pagination>
      )}
    </CarouselContainer>
  )
}

export default Carousel

const CarouselContainer = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  touch-action: pan-y;
`

const CarouselWrapper = styled.div`
  display: flex;
  height: 100%;
  will-change: transform;
  user-select: none;
  backface-visibility: hidden;
  perspective: 1000px;
  /* Default transition for smooth animations - can be overridden inline */
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
`

const CarouselItem = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
`

const Pagination = styled.div`
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
  z-index: 10;
`

const PaginationDot = styled.button<{ active: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: none;
  background-color: ${(props) => (props.active ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.4)')};
  cursor: pointer;
  padding: 0;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: rgba(255, 255, 255, 0.7);
  }
`
