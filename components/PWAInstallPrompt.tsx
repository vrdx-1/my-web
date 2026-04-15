'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'pwa-install-dismissed';
const LABEL = 'ຕິດຕັ້ງແອັບ';
const APP_NAME = 'Jutpai';
const APP_ICON = '/icons/icon-192x192.png';

const HINT_IOS_LINES = [
  '1. ຄິກປຸ່ມແຊຂອງ Safari (Share)',
  '2. ເພີ່ມໄປທີ່ໜ້າຫຼັກ (Add to Home Screen)',
  '3. ເພີ່ມ (Add)',
];
const HINT_ANDROID = 'ໃຊ້ເມນູ Chrome (⋮) → ຕິດຕັ້ງແອັບ';

export function PWAInstallPrompt() {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin') ?? false;

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (isAdmin) return;

    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as unknown as { standalone?: boolean }).standalone === true;

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

  if (isAdmin || !visible) return null;

  return (
    <div
      role="banner"
      style={{
        position: 'fixed',
        bottom: 'calc(72px + env(safe-area-inset-bottom, 0px) + 8px)',
        left: 12,
        right: 12,
        maxWidth: 480,
        margin: '0 auto',
        background: '#fff',
        borderRadius: 18,
        boxShadow: '0 4px 32px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.08)',
        zIndex: 9998,
        fontFamily: 'inherit',
        overflow: 'hidden',
        animation: 'pwaInstallSlideUp 0.35s cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      <style>{`
        @keyframes pwaInstallSlideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
        {/* Close button */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="ປິດ"
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            border: '1.5px solid #e5e7eb',
            background: '#f3f4f6',
            color: '#6b7280',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            padding: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* App icon */}
        <Image
          src={APP_ICON}
          alt={APP_NAME}
          width={44}
          height={44}
          style={{ borderRadius: 12, flexShrink: 0, objectFit: 'cover' }}
        />

        {/* App info */}
        <div style={{ flex: 1, minWidth: 0, height: 44, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
          <div style={{ fontWeight: 700, fontSize: 20, color: '#111827', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>
            {APP_NAME}
          </div>
        </div>

        {/* Install button */}
        <button
          type="button"
          onClick={handleInstall}
          style={{
            flexShrink: 0,
            background: '#1877f2',
            color: '#fff',
            border: 'none',
            borderRadius: 999,
            padding: '9px 20px',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
            letterSpacing: '0.01em',
            whiteSpace: 'nowrap',
          }}
          aria-label={LABEL}
        >
          {LABEL}
        </button>
      </div>

      {showHint && (
        <div
          style={{
            padding: '10px 16px 14px',
            borderTop: '1px solid #f3f4f6',
            background: '#fafafa',
          }}
        >
          {isIOS ? (
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>
              {HINT_IOS_LINES.map((line, i) => (
                <div key={i} style={{ marginBottom: i < HINT_IOS_LINES.length - 1 ? 4 : 0 }}>
                  {line}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.5 }}>
              {HINT_ANDROID}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
