import { RefObject, useEffect, useRef } from 'react'

// A generic event handler type
type EventHandler<E extends Event> = (event: E) => void

export function useEventListener<E extends Event>(
  eventName: string,
  handler: EventHandler<E>,
  element?: RefObject<HTMLElement> | Window | Document,
  options?: boolean | AddEventListenerOptions
) {
  const savedHandler = useRef(handler)

  useEffect(() => {
    savedHandler.current = handler
  }, [handler])

  useEffect(() => {
    const targetElement =
      element && 'current' in element ? element.current : element ?? window
    if (!targetElement?.addEventListener) {
      return
    }

    const eventListener = (event: Event) => savedHandler.current(event as E)

    targetElement.addEventListener(eventName, eventListener, options)

    return () => {
      targetElement.removeEventListener(eventName, eventListener, options)
    }
  }, [eventName, element, options])
} 