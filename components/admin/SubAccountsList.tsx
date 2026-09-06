'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Avatar } from '@/components/Avatar';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';

interface SubAccount {
  id: string;
  username?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  role?: string | null;
  is_sub_account?: boolean | null;
  parent_admin_id?: string | null;
  whatsapp_number_source?: string | null;
  updated_at?: string | null;
}

interface SubAccountsListProps {
  onSelectSubAccount: (subAccount: SubAccount) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  session?: any;
}

export const SubAccountsList = React.memo<SubAccountsListProps>(({
  onSelectSubAccount,
  session,
}) => {
  const [subAccounts, setSubAccounts] = useState<SubAccount[]>([]);
  const [serverTotal, setServerTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<SubAccount | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchSubAccounts();
  }, []);

  const fetchSubAccounts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/sub-accounts', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error('ບໍ່ສາມາດໂຫຼດ Sub-Account ໄດ້');
      }
      const data = await res.json();
      setServerTotal(typeof data?.meta?.total_sub_accounts === 'number' ? data.meta.total_sub_accounts : null);
      setSubAccounts(Array.isArray(data.subAccounts) ? data.subAccounts : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ມີຂໍ້ຜິດພາດເກີດຂື້ນ');
      setServerTotal(null);
      setSubAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const filteredSubAccounts = React.useMemo(() => {
    if (!searchQuery.trim()) return subAccounts;
    const query = searchQuery.toLowerCase();
    return subAccounts.filter(
      (account) =>
        account.username?.toLowerCase().includes(query) ||
        account.phone?.includes(query)
    );
  }, [subAccounts, searchQuery]);

  const openDeleteModal = useCallback((e: React.MouseEvent, subAccount: SubAccount) => {
    e.stopPropagation();
    setDeleteTarget(subAccount);
    setConfirmText('');
    setDeleteError('');
  }, []);

  const closeDeleteModal = useCallback(() => {
    if (deleting) return;
    setDeleteTarget(null);
    setConfirmText('');
    setDeleteError('');
  }, [deleting]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const expectedUsername = (deleteTarget.username || '').trim();
    if (confirmText.trim() !== expectedUsername) {
      setDeleteError('ຊື່ Username ບໍ່ກົງກັນ ກະລຸນາພິມໃຫ້ຖືກຕ້ອງ');
      return;
    }

    setDeleting(true);
    setDeleteError('');
    try {
      const res = await fetch('/api/admin/sub-accounts', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subAccountId: deleteTarget.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'ລຶບບໍ່ສຳເລັດ');
      }

      setSubAccounts((prev) => prev.filter((acc) => acc.id !== deleteTarget.id));
      setServerTotal((prev) => (typeof prev === 'number' ? Math.max(0, prev - 1) : prev));
      setSuccessMessage(`ລຶບ "${expectedUsername}" ສຳເລັດແລ້ວ`);
      setDeleteTarget(null);
      setConfirmText('');
      window.setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'ມີຂໍ້ຜິດພາດເກີດຂື້ນ');
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, confirmText]);

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      {/* Header */}
      <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111111', marginBottom: '24px' }}>
        🏢 Sub-Account Management
      </h2>
      <div style={{ fontSize: '13px', color: '#4a4d52', marginTop: '-14px', marginBottom: '16px' }}>
        ຈຳນວນບັນຊີທັງໝົດ: {subAccounts.length}{serverTotal !== null ? ` (API: ${serverTotal})` : ''}
      </div>

      {/* Success Message */}
      {successMessage && (
        <div
          style={{
            padding: '12px 16px',
            background: '#e6f4ea',
            color: '#1e7e34',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '14px',
          }}
        >
          ✅ {successMessage}
        </div>
      )}

      {/* Search Box */}
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ຊອກຫາ Username ຫຼື Phone..."
          style={{
            width: '100%',
            padding: '12px 16px',
            border: '1px solid #d0d7de',
            borderRadius: '8px',
            fontSize: '14px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Error Message */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            background: '#fce8e6',
            color: '#d93025',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '14px',
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 20px' }}>
          <LoadingSpinner />
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredSubAccounts.length === 0 && (
        <EmptyState
          message={searchQuery ? 'ບໍ່ພົບ Sub-Account ກົງກັບ "' + searchQuery + '"' : 'ບໍ່ມີ Sub-Account, ສ້າງ Sub-Account ໃຫມ່ໄປໃນ Profile Settings'}
        />

      )}

      {/* Sub-Accounts List */}
      {!loading && filteredSubAccounts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredSubAccounts.map((subAccount) => (
            <div
              key={subAccount.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '16px',
                background: '#fff',
                border: '1px solid #d0d7de',
                borderRadius: '8px',
                transition: 'all 0.2s',
              }}
            >
              <button
                onClick={() => onSelectSubAccount(subAccount)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  flex: 1,
                  minWidth: 0,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  padding: 0,
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: '#e4e6eb',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  <Avatar avatarUrl={subAccount.avatar_url} size={48} session={session} />
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '600', fontSize: '15px', color: '#111111', marginBottom: '4px' }}>
                    {subAccount.username || 'Unknown'}
                  </div>
                  <div style={{ fontSize: '13px', color: '#4a4d52' }}>
                    {subAccount.phone ? `☎️ ${subAccount.phone}` : 'ບໍ່ມີເບີໂທລະສັບ'}
                  </div>
                </div>

                {/* Arrow */}
                <div style={{ fontSize: '20px', color: '#4a4d52' }}>→</div>
              </button>

              {/* Delete button */}
              <button
                onClick={(e) => openDeleteModal(e, subAccount)}
                title="ລຶບ Sub-Account"
                style={{
                  flexShrink: 0,
                  width: '38px',
                  height: '38px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#fce8e6',
                  color: '#d93025',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                }}
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={closeDeleteModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '420px',
              width: '100%',
              boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
            }}
          >
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#d93025', marginBottom: '12px' }}>
              ⚠️ ຢືນຢັນການລຶບ Sub-Account
            </h3>
            <p style={{ fontSize: '14px', color: '#4a4d52', marginBottom: '8px' }}>
              ການລຶບ &quot;<strong>{deleteTarget.username || 'Unknown'}</strong>&quot; ຈະລຶບໂພສທັງໝົດ, ຮູບພາບ,
              ແລະ ຂໍ້ມູນທີ່ກ່ຽວຂ້ອງທັງໝົດຂອງບັນຊີນີ້ຢ່າງຖາວອນ ບໍ່ສາມາດກູ້ຄືນໄດ້
            </p>
            <p style={{ fontSize: '14px', color: '#111111', marginBottom: '8px' }}>
              ພິມ <strong>{deleteTarget.username || ''}</strong> ເພື່ອຢືນຢັນ:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={deleteTarget.username || ''}
              autoFocus
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid #d0d7de',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
                marginBottom: '12px',
              }}
            />

            {deleteError && (
              <div
                style={{
                  padding: '10px 14px',
                  background: '#fce8e6',
                  color: '#d93025',
                  borderRadius: '8px',
                  marginBottom: '12px',
                  fontSize: '13px',
                }}
              >
                ⚠️ {deleteError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={closeDeleteModal}
                disabled={deleting}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: '1px solid #d0d7de',
                  background: '#fff',
                  color: '#111111',
                  fontSize: '14px',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.6 : 1,
                }}
              >
                ຍົກເລີກ
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting || confirmText.trim() !== (deleteTarget.username || '').trim()}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#d93025',
                  color: '#fff',
                  fontSize: '14px',
                  cursor:
                    deleting || confirmText.trim() !== (deleteTarget.username || '').trim()
                      ? 'not-allowed'
                      : 'pointer',
                  opacity:
                    deleting || confirmText.trim() !== (deleteTarget.username || '').trim() ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {deleting && <LoadingSpinner />}

                {deleting ? 'ກຳລັງລຶບ...' : 'ລຶບຖາວອນ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

SubAccountsList.displayName = 'SubAccountsList';
