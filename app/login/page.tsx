'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { safeParseJSON } from '@/utils/storageUtils';
import { LAO_FONT } from '@/utils/constants';
import { REGISTER_PATH } from '@/utils/authRoutes';
import { useOtpResendCountdown } from '@/hooks/useOtpResendCountdown';
import { OtpInputs, AuthOAuthButtons } from '@/components/auth';
import { sendOtpToEmail, verifyOtpEmail } from '@/utils/authOtp';
import { ButtonSpinner } from '@/components/LoadingSpinner';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';

type SavedAccount = { email: string; last_used_at: string };

const SAVED_ACCOUNTS_KEY = 'saved_login_accounts';
const MAX_SAVED = 5;

function saveSavedAccount(email: string): SavedAccount[] {
  const trimmed = email.trim();
  const existing = safeParseJSON<SavedAccount[]>(SAVED_ACCOUNTS_KEY, []);
  const updated = [{ email: trimmed, last_used_at: new Date().toISOString() }, ...existing.filter((a) => a.email !== trimmed)].slice(0, MAX_SAVED);
  if (typeof window !== 'undefined') localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(updated));
  return updated;
}

const CONFIRM_OVERLAY = {
  position: 'fixed' as const,
  inset: 0,
  background: 'rgba(0,0,0,0.4)',
  zIndex: 2500,
  display: 'flex' as const,
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
};

const CONFIRM_BOX = {
  background: '#ffffff',
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  padding: 20,
  maxWidth: '320px',
  width: '100%',
  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
};

const BTN_CONFIRM = {
  flex: 1,
  padding: '10px 16px',
  border: 'none',
  borderRadius: 8,
  fontSize: '15px',
  fontWeight: 'bold' as const,
  cursor: 'pointer' as const,
};

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [hideSavedAccounts, setHideSavedAccounts] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [resendTrigger, setResendTrigger] = useState(0);
  const [otpValue, setOtpValue] = useState('');
  const [confirmDeleteEmail, setConfirmDeleteEmail] = useState<string | null>(null);
  const resendSeconds = useOtpResendCountdown(otpSent, resendTrigger);
  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = safeParseJSON<SavedAccount[]>(SAVED_ACCOUNTS_KEY, []);
    setSavedAccounts(stored);
    if (stored.length === 0) {
      setShowForm(true);
      setHideSavedAccounts(false);
    }
  }, []);

  const handleSelectAccount = useCallback((acc: SavedAccount) => {
    setEmail(acc.email);
    setShowForm(true);
    setTimeout(() => emailInputRef.current?.focus(), 0);
  }, []);

  const handleRemoveAccount = useCallback((removeEmail: string) => {
    setSavedAccounts((prev) => {
      const next = prev.filter((a) => a.email !== removeEmail);
      if (typeof window !== 'undefined') localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const handleSendOtp = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !email.trim()) {
      if (!email.trim()) setOtpError('ກະລຸນາໃສ່ອີເມລ');
      return;
    }
    setLoading(true);
    setOtpError('');
    setOtpSent(false);
    const { error } = await sendOtpToEmail(email, false);
    if (error) setOtpError(error);
    else setOtpSent(true);
    setLoading(false);
  }, [email, loading]);

  const verifyOtpCode = useCallback(async (code: string) => {
    if (loading) return;
    if (!code.trim()) {
      setOtpError('ກະລຸນາໃສ່ OTP ທີ່ໄດ້ຮັບ');
      return;
    }
    setLoading(true);
    setOtpError('');
    try {
      const { data, error } = await verifyOtpEmail(email, code);
      if (error) {
        setOtpError(resendSeconds > 0 ? 'OTP ບໍ່ຖືກຕ້ອງ' : 'OTP ບໍ່ຖືກຕ້ອງ ຫຼື ໝົດອາຍຸແລ້ວ');
        setOtpValue('');
        setLoading(false);
        return;
      }
      if (!data?.user) {
        setOtpError('ບໍ່ສາມາດຢືນຢັນໄດ້');
        setOtpValue('');
        setLoading(false);
        return;
      }
      setSavedAccounts(saveSavedAccount(email));
      router.push('/');
    } catch {
      setOtpError('ບໍ່ສາມາດຢືນຢັນໄດ້');
      setOtpValue('');
    }
    setLoading(false);
  }, [email, loading, resendSeconds, router]);

  const handleVerifyOtp = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    verifyOtpCode(otpValue.trim());
  }, [otpValue, verifyOtpCode]);

  const handleResendOtp = useCallback(async () => {
    if (resendSeconds > 0 || loading) return;
    setLoading(true);
    setOtpError('');
    const { error } = await sendOtpToEmail(email, false);
    if (error) setOtpError(error);
    else {
      setOtpValue('');
      setResendTrigger((t) => t + 1);
    }
    setLoading(false);
  }, [email, loading, resendSeconds]);

  const handleOAuthLogin = useCallback(async (provider: 'facebook' | 'google') => {
    if (typeof window === 'undefined') return;
    try {
      await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/` },
      });
    } catch (err) {
      console.error('OAuth login error', err);
    }
  }, []);

  const handleAddOtherAccount = useCallback(() => {
    setShowForm(true);
    setHideSavedAccounts(true);
    setEmail('');
    setOtpError('');
    setOtpSent(false);
    setOtpValue('');
  }, []);

  const inputStyle = { width: '100%', padding: 15, borderRadius: '12px', border: '1px solid #ddd', background: '#f9f9f9', outline: 'none', fontSize: '16px', color: '#111111' };
  const submitBtnStyle = { width: '100%', padding: 15, background: '#1877f2', color: 'white', border: 'none', borderRadius: '12px', fontSize: '18px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', marginTop: '30px' };

  return (
    <main style={LAYOUT_CONSTANTS.MAIN_CONTAINER}>
      <div style={{ padding: '15px 15px 5px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'sticky', top: 0, background: '#ffffff', backgroundColor: '#ffffff', zIndex: 100 }}>
        <button
          type="button"
          onClick={() => router.push(REGISTER_PATH)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1c1e21', padding: 10, position: 'absolute', left: 15 }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1c1e21' }}>ເຂົ້າສູ່ລະບົບ</h1>
      </div>

      <div style={{ padding: 20 }}>
        <div style={{ textAlign: 'center', paddingTop: 10 }}>
          {!otpSent && !hideSavedAccounts && savedAccounts.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ borderRadius: '16px', background: '#f0f2f5', padding: '8px 0' }}>
                {savedAccounts.map((acc, index) => (
                  <div
                    key={acc.email}
                    onClick={() => handleSelectAccount(acc)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 14px',
                      cursor: 'pointer',
                      borderTop: index === 0 ? 'none' : '1px solid #e0e0e0',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '999px', background: '#d8dbe0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 600, color: '#4a4d52' }}>
                        {acc.email.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ fontSize: '15px', color: '#111111', maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.email}</div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteEmail(acc.email); }}
                      style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: '#8d8f94' }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                        <path d="M9 6V4h6v2" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!otpSent && showForm && (
            <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: 15, marginTop: savedAccounts.length > 0 ? 0 : 10 }}>
              <input
                ref={emailInputRef}
                type="email"
                placeholder="ອີເມລ"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                required
              />
              {otpError && <div style={{ fontSize: '14px', color: '#e0245e', textAlign: 'center' }}>{otpError}</div>}
              <button type="submit" disabled={loading} style={submitBtnStyle}>
                {loading ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><ButtonSpinner /></span> : 'ສົ່ງ OTP'}
              </button>
            </form>
          )}

          {otpSent && (
            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: 15, marginTop: 20 }}>
              <p style={{ fontSize: '14px', color: '#65676b', textAlign: 'center', marginBottom: 8 }}>ກະລຸນາໃສ່ OTP ທີ່ສົ່ງໄປຫາ {email}</p>
              <OtpInputs value={otpValue} onChange={setOtpValue} onComplete={verifyOtpCode} disabled={loading} />
              {otpError && <div style={{ fontSize: '14px', color: '#e0245e', textAlign: 'center' }}>{otpError}</div>}
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendSeconds > 0 || loading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: resendSeconds > 0 ? '#a0a0a0' : '#1877f2',
                  fontSize: '14px',
                  cursor: resendSeconds > 0 ? 'default' : 'pointer',
                  marginTop: 4,
                  alignSelf: 'center',
                }}
              >
                ສົ່ງ OTP ໃໝ່{resendSeconds > 0 ? ` (${resendSeconds})` : ''}
              </button>
            </form>
          )}

          {!otpSent && (
            <div style={{ marginTop: 30 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ flex: 1, height: 1, background: '#e0e0e0' }} />
                <span style={{ margin: '0 10px', fontSize: '13px', color: '#65676b' }}>ຫຼື</span>
                <div style={{ flex: 1, height: 1, background: '#e0e0e0' }} />
              </div>
              <AuthOAuthButtons
                redirectTo={typeof window !== 'undefined' ? `${window.location.origin}/` : '/'}
                onOAuth={handleOAuthLogin}
                facebookLabel="ເຂົ້າສູ່ລະບົບດ້ວຍ Facebook"
                googleLabel="ເຂົ້າສູ່ລະບົບດ້ວຍ Google"
              />
            </div>
          )}

          {!otpSent && !hideSavedAccounts && savedAccounts.length > 0 && (
            <button
              type="button"
              onClick={handleAddOtherAccount}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '999px',
                border: '1px solid #e0e0e0',
                background: '#f9f9f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: 'pointer',
                fontSize: '13px',
                color: '#111111',
                marginTop: 16,
                marginBottom: 18,
              }}
            >
              <span style={{ fontSize: '18px' }}>+</span>
              <span>ເຂົ້າບັນຊີອື່ນ</span>
            </button>
          )}
        </div>
      </div>

      {confirmDeleteEmail && (
        <div style={CONFIRM_OVERLAY}>
          <div style={CONFIRM_BOX} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#111111' }}>ທ່ານຕ້ອງການລົບບັນຊີນີ້ອອກບໍ</h3>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
              <button type="button" onClick={() => setConfirmDeleteEmail(null)} style={{ ...BTN_CONFIRM, background: '#e4e6eb', color: '#1c1e21' }}>ຍົກເລີກ</button>
              <button
                type="button"
                onClick={() => { handleRemoveAccount(confirmDeleteEmail); setConfirmDeleteEmail(null); }}
                style={{ ...BTN_CONFIRM, background: '#1877f2', color: '#fff' }}
              >
                ລົບ
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
