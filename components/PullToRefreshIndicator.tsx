'use client'

import React from 'react'
import { PageSpinner } from '@/components/LoadingSpinner'

interface PullToRefreshIndicatorProps {
  pullDistance: number
  isRefreshing: boolean
  /** px ที่ header ถูก translate ลง (ให้ indicator อยู่ใต้ header ตลอด) */
  pullHeaderOffset?: number
}

/**
 * แสดงด้านบนสุด (เหนือ Header) เมื่อดึงลงเพื่อรีเฟรช — spinner สไลด์ลงมาจากด้านบนสุด
 */
export const PullToRefreshIndicator = React.memo<PullToRefreshIndicatorProps>(({ pullDistance, isRefreshing, pullHeaderOffset = 0 }) => {
  const visible = pullDistance > 0 || isRefreshing
  if (!visible) return null

  const height = Math.min(56, Math.max(0, pullDistance) * 0.56)

  // สไลด์ลงมาจากด้านบนสุด: เริ่มต้นอยู่เหนือ viewport (translateY(-56)) แล้วเลื่อนลงมา (translateY 0)
  const translateY = isRefreshing ? 0 : -56 + height

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={isRefreshing ? 'ກຳລັງໂຫຼດໃໝ່' : ''}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        background: '#fff',
        zIndex: 999,
        boxShadow: isRefreshing || height > 0 ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
        transform: `translateY(${translateY}px)`,
        transition: isRefreshing ? 'transform 0.2s ease-out' : 'transform 0.1s ease-out',
        pointerEvents: 'none',
      }}
    >
      <PageSpinner />
    </div>
  )
})
PullToRefreshIndicator.displayName = 'PullToRefreshIndicator'
