'use client'

import { useState, useCallback, useEffect, useRef } from 'react'

const PULL_THRESHOLD = 70
const PULL_MAX = 100
const PULL_DAMPEN = 0.4
const SCROLL_TOP_THRESHOLD = 8

/**
 * Pull-to-refresh when scroll is at top (e.g. home feed).
 * Listens to document touch events; only activates when window.scrollY <= SCROLL_TOP_THRESHOLD.
 */
export function usePullToRefresh(onRefresh: () => void, disabled: boolean) {
  const [pullDistance, setPullDistance] = useState(0)
  const startYRef = useRef(0)
  const pullingRef = useRef(false)
  const pullDistanceRef = useRef(0)
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh
  pullDistanceRef.current = pullDistance

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled) return
    if (window.scrollY > SCROLL_TOP_THRESHOLD) return
    startYRef.current = e.touches[0].clientY
    pullingRef.current = true
  }, [disabled])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!pullingRef.current || disabled) return
    if (window.scrollY > SCROLL_TOP_THRESHOLD) {
      pullingRef.current = false
      setPullDistance(0)
      return
    }
    const currentY = e.touches[0].clientY
    const delta = currentY - startYRef.current
    if (delta <= 0) return
    e.preventDefault()
    const damped = Math.min(delta * PULL_DAMPEN, PULL_MAX)
    pullDistanceRef.current = damped
    setPullDistance(damped)
  }, [disabled])

  const handleTouchEnd = useCallback(() => {
    if (!pullingRef.current) return
    const current = pullDistanceRef.current
    pullingRef.current = false
    setPullDistance(0)
    if (current >= PULL_THRESHOLD) {
      onRefreshRef.current()
    }
  }, [])

  useEffect(() => {
    const doc = document
    doc.addEventListener('touchstart', handleTouchStart, { passive: true })
    doc.addEventListener('touchmove', handleTouchMove, { passive: false })
    doc.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      doc.removeEventListener('touchstart', handleTouchStart)
      doc.removeEventListener('touchmove', handleTouchMove)
      doc.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  return { pullDistance, isPulling: pullDistance > 0 }
}
