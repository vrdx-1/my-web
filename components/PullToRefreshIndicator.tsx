'use client'

import React from 'react'
import { SpinnerRing } from '@/components/LoadingSpinner'

/** ความสูงส่วนหัว (โลโก้ + แท็บ) ใช้จัด spinner ใต้ header — ต้องตรงกับ spacer ใน MainTabLayoutClient */
export const PULL_REFRESH_HEADER_HEIGHT = 118

interface PullToRefreshIndicatorProps {
  pullDistance: number
  isRefreshing: boolean
  /** px ที่ header ถูก translate ลง (ให้ indicator อยู่ใต้ header ตลอด) */
  pullHeaderOffset?: number
  /** ความสูงส่วนหัว (px) — spinner จะโผล่ในช่องใต้ header */
  headerHeight?: number
}

/**
 * แสดงในช่องใต้ Header เมื่อดึงลงเพื่อรีเฟรช — spinner ไหลลงมาจากใต้ header แล้วหมุนอยู่ตรงนั้น (แบบ X)
 */
export const PullToRefreshIndicator = React.memo<PullToRefreshIndicatorProps>(({ pullDistance, isRefreshing, pullHeaderOffset = 0, headerHeight = PULL_REFRESH_HEADER_HEIGHT }) => {
  const visible = pullDistance > 0 || isRefreshing
  if (!visible) return null

  const containerHeight = 40
  const height = Math.min(containerHeight, Math.max(0, pullDistance) * 0.4)

  // สปินเนอร์ไหลลงมาจากใต้ header: เริ่มต้นซ่อนอยู่ด้านบน (translateY(-40)) แล้วเลื่อนลงมา (translateY 0)
  const translateY = isRefreshing ? 0 : -containerHeight + height

  // ตอนกำลัง refresh ให้ช่องสูงเต็มจากใต้ header ถึงล่างจอ แล้วจัด spinner อยู่ตรงกลางแนวตั้ง
  const useFullHeight = isRefreshing
  const containerHeightStyle = useFullHeight ? `calc(100vh - ${headerHeight}px)` : containerHeight

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={isRefreshing ? 'ກຳລັງໂຫຼດໃໝ່' : ''}
      style={{
        position: 'fixed',
        top: headerHeight,
        left: 0,
        right: 0,
        height: containerHeightStyle,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        background: '#fff',
        color: '#333333',
        zIndex: 499,
        boxShadow: isRefreshing || height > 0 ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
        transform: `translateY(${translateY}px)`,
        transition: isRefreshing ? 'transform 0.2s ease-out' : 'transform 0.1s ease-out',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
        }}
      >
        <SpinnerRing />
      </div>
    </div>
  )
})
PullToRefreshIndicator.displayName = 'PullToRefreshIndicator'
