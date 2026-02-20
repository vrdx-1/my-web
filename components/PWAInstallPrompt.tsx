'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'pwa-install-dismissed';
const LABEL = 'ຕິດຕັ້ງແອັບ';

const HINT_IOS_LINES = [
  '1. ຄິກປຸ່ມແຊຂອງ Safari',
  '2. ເພີ່ມໄປທີ່ໜ້າຫຼັກ',
  '3. ເພີ່ມ',
];
const HINT_ANDROID = 'ໃຊ້ເມນູ Chrome (⋮) → ຕິດຕັ້ງແອັບ';

function InstallIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function PWAInstallPrompt() {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin') ?? false;

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (isAdmin) return;

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

    if (!standalone && !dismissed) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => {
        window.removeEventListener('beforeinstallprompt', onBeforeInstall);
        clearTimeout(timer);
      };
    }

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, [isAdmin]);

  const handleInstall = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setVisible(false);
      setDeferredPrompt(null);
      return;
    }
    setShowHint((h) => !h);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowHint(false);
    setVisible(false);
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
  }, []);

  const hintText = isIOS ? null : HINT_ANDROID;

  if (isAdmin || !visible) return null;

  return (
    <div
      role="banner"
      style={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        right: 16,
        maxWidth: 400,
        margin: '0 auto',
        background: '#3b82f6',
        color: '#fff',
        borderRadius: 16,
        padding: 0,
        boxShadow: '0 4px 24px rgba(59,130,246,0.4), 0 0 0 1px rgba(255,255,255,0.2)',
        zIndex: 9998,
        fontFamily: 'inherit',
        overflow: 'hidden',
        animation: 'pwaInstallSlideUp 0.35s ease-out',
      }}
    >
      <style>{`
        @keyframes pwaInstallSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 14px 18px' }}>
        <button
          type="button"
          onClick={handleInstall}
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'rgba(255,255,255,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
          }}
          aria-label={LABEL}
        >
          <InstallIcon />
        </button>
        <button
          type="button"
          onClick={handleInstall}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            color: '#fff',
            padding: '6px 0',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 20,
            textAlign: 'left',
            letterSpacing: '0.01em',
          }}
        >
          {LABEL}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="ปิด"
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'rgba(255,255,255,0.25)',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <CloseIcon />
        </button>
      </div>

      {showHint && (
        <div
          style={{
            padding: '12px 18px 16px',
            borderTop: '1px solid rgba(255,255,255,0.3)',
            background: 'rgba(0,0,0,0.1)',
          }}
        >
          {isIOS ? (
            <div
              style={{
                margin: 0,
                fontSize: 13,
                color: '#fff',
                lineHeight: 1.7,
                letterSpacing: '0.01em',
              }}
            >
              {HINT_IOS_LINES.map((line, i) => (
                <div key={i} style={{ marginBottom: i < HINT_IOS_LINES.length - 1 ? 8 : 0 }}>
                  {line}
                </div>
              ))}
            </div>
          ) : (
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: '#fff',
                lineHeight: 1.5,
                letterSpacing: '0.01em',
              }}
            >
              {hintText}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
