'use client'

import { useEffect, useMemo, useState } from 'react';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { LAO_FONT } from '@/utils/constants';

type DailyRow = {
  click_date: string;
  count: number;
};

type AccountRow = {
  targetProfileId: string;
  username: string;
  isSubAccount: boolean;
  parentAdminId: string | null;
  parentAdminUsername: string | null;
  totalClicks: number;
  uniquePeople: number;
  userClicks: number;
  guestClicks: number;
};

type Summary = {
  todayCount: number;
  monthTotal: number;
  selectedDateTotal: number;
  selectedDateUniquePeople: number;
  daysWithData: number;
  accountsWithClicks: number;
};

function getTodayBangkokDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  if (!year || !month || !day) {
    return new Date().toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

export default function AdminWhatsAppClicksPage() {
  const today = useMemo(() => getTodayBangkokDate(), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dailyRows, setDailyRows] = useState<DailyRow[]>([]);
  const [accountRows, setAccountRows] = useState<AccountRow[]>([]);
  const [summary, setSummary] = useState<Summary>({
    todayCount: 0,
    monthTotal: 0,
    selectedDateTotal: 0,
    selectedDateUniquePeople: 0,
    daysWithData: 0,
    accountsWithClicks: 0,
  });

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/admin/whatsapp-clicks?date=${encodeURIComponent(selectedDate)}`, {
          credentials: 'include',
        });

        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload?.error || 'Failed to load WhatsApp click stats');
        }

        const payload = await res.json();
        if (cancelled) return;

        setDailyRows(Array.isArray(payload?.dailyRows) ? payload.dailyRows : []);
        setAccountRows(Array.isArray(payload?.accountRows) ? payload.accountRows : []);
        setSummary({
          todayCount: Number(payload?.summary?.todayCount || 0),
          monthTotal: Number(payload?.summary?.monthTotal || 0),
          selectedDateTotal: Number(payload?.summary?.selectedDateTotal || 0),
          selectedDateUniquePeople: Number(payload?.summary?.selectedDateUniquePeople || 0),
          daysWithData: Number(payload?.summary?.daysWithData || 0),
          accountsWithClicks: Number(payload?.summary?.accountsWithClicks || 0),
        });
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Unknown error');
        setDailyRows([]);
        setAccountRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  return (
    <main style={{ maxWidth: '1100px', margin: '0 auto', background: '#ffffff', minHeight: '100vh', fontFamily: LAO_FONT, paddingBottom: '40px' }}>
      <div style={{ padding: '20px 20px 16px' }}>
        <p style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          WhatsApp Click Analytics
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          <div style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', borderRadius: '16px', padding: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Today</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{loading ? '...' : summary.todayCount.toLocaleString()}</div>
          </div>

          <div style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', borderRadius: '16px', padding: '16px', border: '1px solid #93c5fd', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: 600, marginBottom: '4px' }}>Selected Day</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#1e3a8a' }}>{loading ? '...' : summary.selectedDateTotal.toLocaleString()}</div>
          </div>

          <div style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', borderRadius: '16px', padding: '16px', border: '1px solid #bbf7d0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '12px', color: '#15803d', fontWeight: 600, marginBottom: '4px' }}>Unique People</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#14532d' }}>{loading ? '...' : summary.selectedDateUniquePeople.toLocaleString()}</div>
          </div>

          <div style={{ background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)', borderRadius: '16px', padding: '16px', border: '1px solid #fed7aa', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '12px', color: '#c2410c', fontWeight: 600, marginBottom: '4px' }}>Month Total</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#9a3412' }}>{loading ? '...' : summary.monthTotal.toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label htmlFor="selected-date" style={{ fontSize: '14px', color: '#334155', fontWeight: 600 }}>Select date</label>
          <input
            id="selected-date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              padding: '8px 10px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              fontSize: '14px',
              color: '#0f172a',
              background: '#fff',
            }}
          />
        </div>

        <div style={{ fontSize: '13px', color: '#475569', fontWeight: 600 }}>
          Data days in month: {loading ? '...' : summary.daysWithData.toLocaleString()} | Accounts with clicks: {loading ? '...' : summary.accountsWithClicks.toLocaleString()}
        </div>
      </div>

      {error && !loading ? (
        <div style={{ margin: '0 20px 12px', padding: '12px 14px', border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', borderRadius: '10px', fontSize: '14px' }}>
          {error}
        </div>
      ) : null}

      {loading ? (
        <div style={{ padding: '24px 20px' }}>
          <LoadingSpinner />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', gap: '16px', padding: '0 20px' }}>
          <section style={{ border: '1px solid #e2e8f0', borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
              Daily clicks (month of {formatDisplayDate(selectedDate)})
            </div>
            <div style={{ maxHeight: '540px', overflowY: 'auto' }}>
              {dailyRows.map((row) => {
                const isActive = row.click_date === selectedDate;
                return (
                  <button
                    key={row.click_date}
                    type="button"
                    onClick={() => setSelectedDate(row.click_date)}
                    style={{
                      width: '100%',
                      border: 'none',
                      borderBottom: '1px solid #f1f5f9',
                      background: isActive ? '#eff6ff' : '#fff',
                      color: '#0f172a',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 12px',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: isActive ? 700 : 500 }}>{formatDisplayDate(row.click_date)}</span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: row.count > 0 ? '#1d4ed8' : '#94a3b8' }}>{row.count.toLocaleString()}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section style={{ border: '1px solid #e2e8f0', borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
              Accounts contacted on {formatDisplayDate(selectedDate)}
            </div>

            {accountRows.length === 0 ? (
              <div style={{ padding: '20px', color: '#64748b', fontSize: '14px' }}>
                No WhatsApp clicks on this day.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>Account</th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>Type</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: '12px', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>Total Clicks</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: '12px', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>Unique People</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: '12px', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>User</th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: '12px', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>Guest</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountRows.map((row) => {
                      const accountType = row.isSubAccount
                        ? `Sub account${row.parentAdminUsername ? ` (${row.parentAdminUsername})` : ''}`
                        : 'Main account';

                      return (
                        <tr key={row.targetProfileId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 12px', fontSize: '13px', color: '#0f172a', fontWeight: 600 }}>{row.username}</td>
                          <td style={{ padding: '10px 12px', fontSize: '13px', color: '#475569' }}>{accountType}</td>
                          <td style={{ padding: '10px 12px', fontSize: '13px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{row.totalClicks.toLocaleString()}</td>
                          <td style={{ padding: '10px 12px', fontSize: '13px', textAlign: 'right', fontWeight: 700, color: '#1d4ed8' }}>{row.uniquePeople.toLocaleString()}</td>
                          <td style={{ padding: '10px 12px', fontSize: '13px', textAlign: 'right', color: '#14532d' }}>{row.userClicks.toLocaleString()}</td>
                          <td style={{ padding: '10px 12px', fontSize: '13px', textAlign: 'right', color: '#9a3412' }}>{row.guestClicks.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
