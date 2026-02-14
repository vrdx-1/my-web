'use client';

import React, { useEffect, useState, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'pwa-install-dismissed';
const LABEL = 'ຕິດຕັ້ງແອັບ';

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    const dismissed = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(DISMISS_KEY);
    if (standalone || dismissed) return;

    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(ios);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // แสดงปุ่มได้แม้ไม่มี beforeinstallprompt (เช่น iOS) ถ้าไม่ใช่ standalone
    if (!standalone && !dismissed) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => {
        window.removeEventListener('beforeinstallprompt', onBeforeInstall);
        clearTimeout(timer);
      };
    }

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const handleInstall = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setVisible(false);
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      role="banner"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#000',
        color: '#fff',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        boxShadow: '0 -2px 10px rgba(0,0,0,0.2)',
        zIndex: 9998,
        fontFamily: 'inherit',
        fontSize: '15px',
      }}
    >
      <button
        type="button"
        onClick={deferredPrompt ? handleInstall : undefined}
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          color: '#fff',
          padding: '8px 0',
          cursor: deferredPrompt ? 'pointer' : 'default',
          fontWeight: 600,
          textAlign: 'left',
        }}
      >
        {LABEL}
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="ปิด"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'rgba(255,255,255,0.8)',
          padding: '4px 8px',
          cursor: 'pointer',
          fontSize: '18px',
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}
