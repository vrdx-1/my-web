'use client'

import { useEffect, useState } from 'react';
import { TermsModal } from '@/components/modals/TermsModal';

const STORAGE_KEY = 'global_terms_accepted_v1';

export function GlobalTermsConsent() {
  const [show, setShow] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'true') {
        // ผู้ใช้เคยยอมรับแล้ว ไม่ต้องแสดงอีก
        setShow(false);
      } else {
        // ผู้ใช้ใหม่หรือยังไม่เคยยอมรับ แสดงป๊อบอัพครั้งแรก
        setShow(true);
      }
    } catch {
      // ถ้า localStorage ใช้งานไม่ได้ ให้ไม่บังคับ popup เพื่อไม่ให้กระทบ UX อื่น
      setShow(false);
    }
  }, []);

  if (!show) return null;

  return (
    <TermsModal
      show={show}
      acceptedTerms={accepted}
      onClose={() => {
        // ปิดชั่วคราวโดยไม่เซ็ต accepted; ถ้ากลับมาใหม่และยังไม่ accepted จะขึ้นอีกครั้ง
        setShow(false);
      }}
      onAcceptChange={(val) => setAccepted(val)}
      onContinue={() => {
        if (!accepted) return;
        try {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(STORAGE_KEY, 'true');
          }
        } catch {
          // ถ้าเซฟไม่ได้ก็แค่ปิด popup ไม่ต้องทำอะไรเพิ่ม
        }
        setShow(false);
      }}
    />
  );
}

