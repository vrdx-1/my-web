'use client'

import { useState, useEffect } from 'react';

/**
 * Hook สำหรับจัดการ registration success popup
 * ตรวจสอบ flag จาก localStorage และแสดง popup
 */
export function useRegistrationSuccess() {
  const [showRegistrationSuccess, setShowRegistrationSuccess] = useState(false);

  useEffect(() => {
    const showRegistrationSuccessFlag = localStorage.getItem('show_registration_success');
    if (showRegistrationSuccessFlag === 'true') {
      setShowRegistrationSuccess(true);
      localStorage.removeItem('show_registration_success');
    }
  }, []);

  return { showRegistrationSuccess, setShowRegistrationSuccess };
}
