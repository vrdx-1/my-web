'use client'

import React from 'react'
import { PageSpinner } from '@/components/LoadingSpinner'

const PULL_THRESHOLD = 70

interface PullToRefreshIndicatorProps {
  pullDistance: number
  isRefreshing: boolean
}

/**
 * แสดงเหนือ feed เมื่อดึงลงเพื่อรีเฟรช (หรือกำลังรีเฟรช)
 */
export const PullToRefreshIndicator = React.memo<PullToRefreshIndicatorProps>(({ pullDistance, isRefreshing }) => {
  const visible = pullDistance > 0 || isRefreshing
  if (!visible) return null

  const ready = pullDistance >= PULL_THRESHOLD
  const height = Math.min(56, Math.max(0, pullDistance) * 0.56)

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
        boxShadow: height > 0 ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
        transform: `translateY(${isRefreshing ? 0 : -56 + height}px)`,
        transition: isRefreshing ? 'none' : 'transform 0.1s ease-out',
        pointerEvents: 'none',
      }}
    >
      {isRefreshing ? (
        <PageSpinner />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 24,
              height: 24,
              border: '2px solid #e0e0e0',
              borderTopColor: ready ? '#111' : '#e0e0e0',
              borderRadius: '50%',
              transform: `rotate(${Math.min(pullDistance * 4, 360)}deg)`,
              transition: 'border-color 0.15s ease',
            }}
          />
        </div>
      )}
    </div>
  )
})
PullToRefreshIndicator.displayName = 'PullToRefreshIndicator'
