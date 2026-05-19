'use client';

import React, { useState, useMemo } from 'react';
import { useSessionAndProfile } from '@/hooks/useSessionAndProfile';
import { PageHeader } from '@/components/PageHeader';
import { SubAccountsList } from '@/components/admin/SubAccountsList';
import { SubAccountPostsView } from '@/components/admin/SubAccountPostsView';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface SelectedSubAccount {
  id: string;
  username?: string | null;
}

export default function AdminSubAccountsPage() {
  const { session, sessionReady } = useSessionAndProfile();
  const [selectedSubAccount, setSelectedSubAccount] = useState<SelectedSubAccount | null>(null);

  const isReady = useMemo(() => sessionReady && session, [sessionReady, session]);

  if (!isReady) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <LoadingSpinner />
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <p>ກະລຸນາເຂົ້າສູ່ລະບົບ</p>
      </div>
    );
  }

  return (
    <main style={{ background: '#f5f6f7', minHeight: '100vh', paddingBottom: '80px' }}>
      {selectedSubAccount ? (
        <SubAccountPostsView
          subAccountId={selectedSubAccount.id}
          subAccountUsername={selectedSubAccount.username || 'Unknown'}
          onBack={() => setSelectedSubAccount(null)}
          session={session}
        />
      ) : (
        <SubAccountsList
          onSelectSubAccount={(subAccount) =>
            setSelectedSubAccount({
              id: subAccount.id,
              username: subAccount.username,
            })
          }
          session={session}
        />
      )}
    </main>
  );
}
