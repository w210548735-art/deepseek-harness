import { useEffect, useRef, useState } from 'react'

/**
 * Options for {@link useAnimatedNumber}.
 */
export interface UseAnimatedNumberOptions {
  /**
   * Animation duration in milliseconds.
   * @default 400
   */
  duration?: number
  /**
   * Disable animation and render the target value immediately.
   * @default false
   */
  disabled?: boolean
}

/**
 * Animate a numeric value toward its latest target using requestAnimationFrame.
 *
 * The hook is intentionally small and pure: it owns no formatting, locale, or
 * DOM concerns. It automatically respects `prefers-reduced-motion: reduce` by
 * rendering the final value immediately.
 *
 * @param value - the target number to display.
 * @param options - duration and optional animation disable.
 * @returns the currently displayed numeric value.
 */
export function useAnimatedNumber(
  value: number,
  { duration = 400, disabled = false }: UseAnimatedNumberOptions = {},
): number {
  const [display, setDisplay] = useState(value)
  const displayRef = useRef(value)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    const reduceMotion = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (disabled || reduceMotion) {
      displayRef.current = value
      setDisplay(value)
      return
    }

    const from = displayRef.current
    if (from === value) return

    const start = performance.now()
    const tick = (now: number): void => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      const next = from + (value - from) * eased
      displayRef.current = next
      setDisplay(next)
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick)
      } else {
        displayRef.current = value
      }
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
      // displayRef already holds the last rendered value, so the next effect
      // starts from where the previous animation stopped instead of the target.
    }
  }, [value, duration, disabled])

  return display
}
