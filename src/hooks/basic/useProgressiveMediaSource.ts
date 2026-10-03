import { useEffect, useMemo, useRef, useState } from 'react'

const CROSS_FADE_DURATION = 180
const MAX_REMEMBERED_SOURCES = 500
const loadedSources = new Set<string>()
const loadedSourceOrder: string[] = []

const rememberLoadedSource = (source: string) => {
  if (loadedSources.has(source)) return

  loadedSources.add(source)
  loadedSourceOrder.push(source)
  if (loadedSourceOrder.length > MAX_REMEMBERED_SOURCES) {
    const oldestSource = loadedSourceOrder.shift()
    if (oldestSource) loadedSources.delete(oldestSource)
  }
}

/**
 * Keeps the currently visible media source on screen until the preferred
 * replacement has loaded. This prevents thumbnail-to-full-media swaps from
 * briefly rendering an empty attachment.
 */
const useProgressiveMediaSource = (preferredSource?: string, fallbackSource?: string) => {
  const [displayedSource, setDisplayedSource] = useState<string | undefined>(() =>
    preferredSource && loadedSources.has(preferredSource) ? preferredSource : fallbackSource
  )
  const [previousSource, setPreviousSource] = useState<string | undefined>()
  const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>()

  const clearFadeTimeout = () => {
    if (fadeTimeoutRef.current) {
      clearTimeout(fadeTimeoutRef.current)
      fadeTimeoutRef.current = undefined
    }
  }

  useEffect(() => {
    // When there is no preferred source, the metadata thumbnail is the best
    // available display. Clear only when neither source exists, so callers can
    // render a stable skeleton.
    if (!preferredSource) {
      clearFadeTimeout()
      setPreviousSource(undefined)
      setDisplayedSource(fallbackSource)
    } else if (loadedSources.has(preferredSource) && preferredSource !== displayedSource) {
      // This source has already been decoded once in this session. Show it
      // immediately rather than replaying a thumbnail transition every time a
      // message row remounts or scrolls back into view.
      clearFadeTimeout()
      setPreviousSource(undefined)
      setDisplayedSource(preferredSource)
    }
  }, [preferredSource, fallbackSource])

  useEffect(
    () => () => {
      clearFadeTimeout()
    },
    []
  )

  const pendingSource = useMemo(
    () => (preferredSource && preferredSource !== displayedSource ? preferredSource : undefined),
    [preferredSource, displayedSource]
  )

  const markPreferredSourceLoaded = () => {
    if (preferredSource && preferredSource !== displayedSource) {
      const wasPreviouslyLoaded = loadedSources.has(preferredSource)
      rememberLoadedSource(preferredSource)
      clearFadeTimeout()
      setPreviousSource(wasPreviouslyLoaded ? undefined : displayedSource)
      setDisplayedSource(preferredSource)
      if (!wasPreviouslyLoaded && displayedSource) {
        fadeTimeoutRef.current = setTimeout(() => {
          setPreviousSource(undefined)
          fadeTimeoutRef.current = undefined
        }, CROSS_FADE_DURATION)
      }
    }
  }

  return { displayedSource, previousSource, pendingSource, markPreferredSourceLoaded }
}

export default useProgressiveMediaSource
