'use client'

import React from 'react'
import { SpinnerRing } from '@/components/LoadingSpinner'

/** ความสูงส่วนหัว (โลโก้ + แท็บ) ใช้จัด spinner ใต้ header — ต้องตรงกับ spacer ใน MainTabLayoutClient (HOME_FIXED_BLOCK_HEIGHT = 104) */
export const PULL_REFRESH_HEADER_HEIGHT = 104

/** ความสูงช่อง spinner ตอนกำลัง refresh — ฟีดจะโยโย้ลงเท่านี้ให้สปินเนอร์หมุนตรงนี้ */
export const PULL_REFRESH_ZONE_HEIGHT = 56

interface PullToRefreshIndicatorProps {
  pullDistance: number
  isRefreshing: boolean
  /** px ที่ header ถูก translate ลง (ให้ indicator อยู่ใต้ header ตลอด) */
  pullHeaderOffset?: number
  /** ความสูงส่วนหัว (px) — spinner จะโผล่ในช่องใต้ header */
  headerHeight?: number
}

/** ขนาด spinner (px) — ใช้จัดตำแหน่งให้อยู่กึ่งกลาง zone */
const SPINNER_SIZE = 40

/**
 * แสดงเฉพาะ loading spinner ใต้ Header เมื่อดึงลงเพื่อรีเฟรช (แบบ pull-to-refresh ของบราวเซอร์ — ไม่มีกล่องสี่เหลี่ยม)
 */
export const PullToRefreshIndicator = React.memo<PullToRefreshIndicatorProps>(({ pullDistance, isRefreshing, pullHeaderOffset = 0, headerHeight = PULL_REFRESH_HEADER_HEIGHT }) => {
  const visible = pullDistance > 0 || isRefreshing
  if (!visible) return null

  // สปินเนอร์ลงมาพร้อมจังหวะดึง — อยู่กึ่งกลาง zone ที่ถูกดึง (เหมือนเว็บใหญ่ระดับโลก)
  const zoneHeight = isRefreshing ? PULL_REFRESH_ZONE_HEIGHT : Math.max(pullDistance, SPINNER_SIZE)
  const topOffset = headerHeight + Math.max(0, (zoneHeight - SPINNER_SIZE) / 2)
  const translateY = 0

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={isRefreshing ? 'ກຳລັງໂຫຼດໃໝ່' : ''}
      style={{
        position: 'fixed',
        top: topOffset,
        left: '50%',
        width: SPINNER_SIZE,
        height: SPINNER_SIZE,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#333333',
        zIndex: 499,
        transform: `translate(-50%, ${translateY}px)`,
        transition: isRefreshing ? 'transform 0.2s ease-out' : 'transform 0.1s ease-out',
        pointerEvents: 'none',
      }}
    >
      <SpinnerRing />
    </div>
  )
})
PullToRefreshIndicator.displayName = 'PullToRefreshIndicator'
