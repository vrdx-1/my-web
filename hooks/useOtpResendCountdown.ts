'use client'

import { useState, useEffect } from 'react'

const INITIAL_SECONDS = 60

/**
 * นับเวลาถอยหลัง 60 วิ สำหรับปุ่ม "ສົ່ງ OTP ໃໝ່"
 * ใช้ร่วมกันทั้งหน้าลงทะเบียนและหน้าเข้าสู่ระบบ
 * @param otpSent เริ่มนับเมื่อเป็น true
 * @param resetTrigger เพิ่มค่าตอนกด "ສົ່ງ OTP ໃໝ່" สำเร็จ เพื่อรีเซ็ตเป็น 60 วิ
 */
export function useOtpResendCountdown(otpSent: boolean, resetTrigger = 0) {
  const [resendSeconds, setResendSeconds] = useState(INITIAL_SECONDS)

  useEffect(() => {
    if (!otpSent) return
    setResendSeconds(INITIAL_SECONDS)
    const timer = setInterval(() => {
      setResendSeconds((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [otpSent, resetTrigger])

  return resendSeconds
}
