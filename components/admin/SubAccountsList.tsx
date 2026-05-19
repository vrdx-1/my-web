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

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      {/* Header */}
      <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111111', marginBottom: '24px' }}>
        🏢 Sub-Account Management
      </h2>
      <div style={{ fontSize: '13px', color: '#4a4d52', marginTop: '-14px', marginBottom: '16px' }}>
        ຈຳນວນບັນຊີທັງໝົດ: {subAccounts.length}{serverTotal !== null ? ` (API: ${serverTotal})` : ''}
      </div>

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
          title={searchQuery ? 'ບໍ່ພົບຜົນ' : 'ບໍ່ມີ Sub-Account'}
          description={searchQuery ? 'ບໍ່ມີ Sub-Account ກົງກັບ "' + searchQuery + '"' : 'ສ້າງ Sub-Account ໃຫມ່ໄປໃນ Profile Settings'}
        />
      )}

      {/* Sub-Accounts List */}
      {!loading && filteredSubAccounts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredSubAccounts.map((subAccount) => (
            <button
              key={subAccount.id}
              onClick={() => onSelectSubAccount(subAccount)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '16px',
                background: '#fff',
                border: '1px solid #d0d7de',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = '#f5f6f7';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = '#fff';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
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
          ))}
        </div>
      )}
    </div>
  );
});

SubAccountsList.displayName = 'SubAccountsList';
