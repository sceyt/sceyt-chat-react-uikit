import { useRef, useLayoutEffect } from 'react'

const useEventListener = (eventName: string, handler: any, element = global, options: any = {}) => {
  const savedHandler: any = useRef()
  const { capture, passive, once } = options

  useLayoutEffect(() => {
    savedHandler.current = handler
  }, [handler])

  useLayoutEffect(() => {
    const isSupported = element && element.addEventListener
    if (!isSupported) {
      return
    }

    const eventListener = (event: any) => savedHandler.current(event)
    const opts = { capture, passive, once }
    element.addEventListener(eventName, eventListener, opts)
    // TODO arrow function expected no return value
    // eslint-disable-next-line consistent-return
    return () => element.removeEventListener(eventName, eventListener, opts)
  }, [eventName, element, capture, passive, once])
}

export default useEventListener
