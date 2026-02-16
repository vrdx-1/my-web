'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ProfileContent } from '@/components/ProfileContent';
import { useBackHandler } from '@/components/BackHandlerContext';
import { REGISTER_PATH } from '@/utils/authRoutes';

const SLIDE_DURATION_MS = 300;
const TRANSITION = 'transform 0.3s ease-out';

interface ProfileOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileOverlay({ isOpen, onClose }: ProfileOverlayProps) {
  const router = useRouter();
  const { addBackStep } = useBackHandler();
  const [phase, setPhase] = useState<'entering' | 'entered' | 'exiting'>('entering');
  const [transitionActive, setTransitionActive] = useState(false);
  const isExitingRef = useRef(false);

  const requestClose = useCallback(() => {
    if (isExitingRef.current) return;
    isExitingRef.current = true;
    setTransitionActive(true);
    setPhase('exiting');
    const t = setTimeout(() => {
      onClose();
      isExitingRef.current = false;
    }, SLIDE_DURATION_MS);
    return () => clearTimeout(t);
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    setPhase('entering');
    setTransitionActive(false);
    const rafId = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTransitionActive(true);
        setPhase('entered');
      });
    });
    return () => cancelAnimationFrame(rafId);
  }, [isOpen]);

  useEffect(() => {
    if (phase !== 'entered' || !transitionActive) return;
    const t = setTimeout(() => setTransitionActive(false), 350);
    return () => clearTimeout(t);
  }, [phase, transitionActive]);

  useEffect(() => {
    if (!isOpen) return;
    const remove = addBackStep(requestClose);
    return remove;
  }, [isOpen, addBackStep, requestClose]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    document.body.style.scrollbarWidth = 'none';
    document.body.style.msOverflowStyle = 'none';
    return () => {
      document.body.style.overflow = '';
      document.body.style.scrollbarWidth = '';
      document.body.style.msOverflowStyle = '';
    };
  }, [isOpen]);

  const handleNotLoggedIn = useCallback(() => {
    onClose();
    router.replace(REGISTER_PATH);
  }, [onClose, router]);

  if (!isOpen) return null;

  const translateX = phase === 'entering' ? '100%' : phase === 'exiting' ? '100%' : '0';
  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: '#fff',
    zIndex: 1500,
    transform: `translateX(${translateX})`,
    transition: transitionActive ? TRANSITION : 'none',
    overflow: 'auto',
  };

  return (
    <div style={overlayStyle}>
      <ProfileContent onBack={requestClose} onNotLoggedIn={handleNotLoggedIn} />
    </div>
  );
}
