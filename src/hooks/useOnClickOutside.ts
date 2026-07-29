import { useEffect } from 'react'
import type { RefObject } from 'react'

/**
 * Calls `handler` on a pointer press outside `ref`.
 *
 * Listens on `pointerdown` rather than `click` so the callback runs before
 * focus moves, and in the capture phase so a stopped-propagation click inside
 * unrelated UI cannot suppress it.
 */
export function useOnClickOutside(
  ref: RefObject<HTMLElement | null>,
  handler: () => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && !ref.current?.contains(target)) handler()
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [ref, handler, enabled])
}
