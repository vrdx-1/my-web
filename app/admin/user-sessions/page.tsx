'use client'

import { useState, useEffect, useMemo } from 'react';
import { createAdminSupabaseClient } from '@/utils/adminSupabaseClient';
import { applyDateFilter } from '@/utils/dateFilter';
import { TimeFilter } from '@/components/admin/TimeFilter';
import { StatCard } from '@/components/admin/StatCard';
import { LAO_FONT } from '@/utils/constants';
import { LoadingSpinner } from '@/components/LoadingSpinner';

type DateFilterType = 'D' | 'W' | 'M' | 'Y' | 'A';

type SessionRow = {
  id: string;
  user_id: string | null;
  visitor_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
};

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds < 0) return '—';
  if (seconds < 60) return `${seconds} ວິ`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m} ນາທີ ${s} ວິ`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h} ຊົ່ວໂມງ ${mm} ນາທີ`;
}

type PersonRow = {
  id: string;
  sessionCount: number;
  totalSeconds: number;
  avgSeconds: number;
  firstAt: string;
  lastAt: string;
};

function maskId(id: string, maxShow = 12) {
  if (id.length <= maxShow) return id;
  return '…' + id.slice(-10);
}

function PersonTable({
  title,
  loading,
  persons,
  idLabel,
}: {
  title: string;
  loading: boolean;
  persons: PersonRow[];
  idLabel: string;
}) {
  const PAGE_SIZE = 15;
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(persons.length / PAGE_SIZE));
  useEffect(() => setPage(0), [persons.length]);
  const pageList = useMemo(
    () => persons.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [persons, page]
  );

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: '12px',
        border: '1px solid #f0f0f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '2px solid #e5e7eb',
          fontSize: '16px',
          fontWeight: '600',
          color: '#1a1a1a',
        }}
      >
        {title}
      </div>
      <div style={{ padding: '16px 20px', overflowX: 'auto' }}>
        {loading ? (
          <LoadingSpinner />
        ) : pageList.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '14px' }}>ຍັງບໍ່ມີຂໍ້ມູນ</p>
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '640px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '8px 6px', color: '#6b7280', fontWeight: '600', width: '44px' }}>ລຳດັບ</th>
                  <th style={{ textAlign: 'left', padding: '8px 6px', color: '#6b7280', fontWeight: '600' }}>{idLabel}</th>
                  <th style={{ textAlign: 'right', padding: '8px 6px', color: '#6b7280', fontWeight: '600', width: '72px' }}>ຈຳນວນຄັ້ງ</th>
                  <th style={{ textAlign: 'right', padding: '8px 6px', color: '#6b7280', fontWeight: '600', width: '88px' }}>ເວລາລວມ</th>
                  <th style={{ textAlign: 'right', padding: '8px 6px', color: '#6b7280', fontWeight: '600', width: '88px' }}>ເວລາສະເລ່ຍ</th>
                  <th style={{ textAlign: 'left', padding: '8px 6px', color: '#6b7280', fontWeight: '600' }}>ຄັ້ງທຳອິດ</th>
                  <th style={{ textAlign: 'left', padding: '8px 6px', color: '#6b7280', fontWeight: '600' }}>ຄັ້ງລ່າສຸດ</th>
                </tr>
              </thead>
              <tbody>
                {pageList.map((p, idx) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px 6px', color: '#374151' }}>{page * PAGE_SIZE + idx + 1}</td>
                    <td style={{ padding: '8px 6px', color: '#374151', fontFamily: 'monospace', fontSize: '12px' }}>{maskId(p.id)}</td>
                    <td style={{ textAlign: 'right', padding: '8px 6px', fontWeight: '600' }}>{p.sessionCount.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', padding: '8px 6px' }}>{formatDuration(p.totalSeconds)}</td>
                    <td style={{ textAlign: 'right', padding: '8px 6px' }}>{formatDuration(Math.round(p.avgSeconds))}</td>
                    <td style={{ padding: '8px 6px', color: '#374151', whiteSpace: 'nowrap' }}>
                      {new Date(p.firstAt).toLocaleString('lo-LA', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td style={{ padding: '8px 6px', color: '#374151', whiteSpace: 'nowrap' }}>
                      {new Date(p.lastAt).toLocaleString('lo-LA', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    background: page === 0 ? '#f3f4f6' : '#fff',
                    cursor: page === 0 ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                  }}
                >
                  ກ່ອນໜ້າ
                </button>
                <span style={{ fontSize: '13px', color: '#6b7280' }}>ໜ້າ {page + 1} / {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    background: page >= totalPages - 1 ? '#f3f4f6' : '#fff',
                    cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                  }}
                >
                  ຖັດໄປ
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SessionPanel({
  title,
  loading,
  sessions,
}: {
  title: string;
  loading: boolean;
  sessions: SessionRow[];
}) {
  const completed = useMemo(
    () => sessions.filter((s) => s.duration_seconds != null),
    [sessions]
  );
  const totalSessions = sessions.length;
  const totalWithDuration = completed.length;
  const totalSeconds = useMemo(
    () => completed.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0),
    [completed]
  );
  const avgSeconds = totalWithDuration > 0 ? totalSeconds / totalWithDuration : 0;

  const PAGE_SIZE = 10;
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(sessions.length / PAGE_SIZE));
  useEffect(() => setPage(0), [sessions.length]);
  const pageList = useMemo(
    () => sessions.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [sessions, page]
  );

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        background: '#fff',
        borderRadius: '12px',
        border: '1px solid #f0f0f0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '2px solid #e5e7eb',
          fontSize: '16px',
          fontWeight: '600',
          color: '#1a1a1a',
        }}
      >
        {title}
      </div>
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <StatCard
          label="ຈຳນວນຄັ້ງທີ່ເຂົ້າຊົມ (Sessions)"
          value={loading ? '...' : `${totalSessions.toLocaleString()} ຄັ້ງ`}
        />
        <StatCard
          label="ເວລາໃຊ້ງານສະເລ່ຍ (Average duration)"
          value={loading ? '...' : formatDuration(Math.round(avgSeconds))}
        />
        {totalWithDuration > 0 && (
          <div style={{ fontSize: '13px', color: '#6b7280' }}>
            ຄິດจาก {totalWithDuration.toLocaleString()} session ທີ່ບັນທຶກເວລາປິດ (ລວມ {formatDuration(totalSeconds)})
          </div>
        )}
      </div>
      <div
        style={{
          flex: 1,
          padding: '0 20px 16px',
          overflow: 'auto',
          borderTop: '1px solid #f3f4f6',
        }}
      >
        <div
          style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '8px',
            paddingTop: '12px',
          }}
        >
          ລາຍລະອຽດແຕ່ລະຄັ້ງ (ເວລາເຂົ້າ → ເວລາໃຊ້)
        </div>
        {loading ? (
          <LoadingSpinner />
        ) : pageList.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '14px' }}>ຍັງບໍ່ມີຂໍ້ມູນ</p>
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '8px 6px', color: '#6b7280', fontWeight: '600' }}>
                    ເລີ່ມ
                  </th>
                  <th style={{ textAlign: 'left', padding: '8px 6px', color: '#6b7280', fontWeight: '600' }}>
                    ສິ້ນສຸດ
                  </th>
                  <th style={{ textAlign: 'right', padding: '8px 6px', color: '#6b7280', fontWeight: '600' }}>
                    ໃຊ້ເວລາ
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageList.map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px 6px', color: '#374151', whiteSpace: 'nowrap' }}>
                      {new Date(s.started_at).toLocaleString('lo-LA', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td style={{ padding: '8px 6px', color: '#374151', whiteSpace: 'nowrap' }}>
                      {s.ended_at
                        ? new Date(s.ended_at).toLocaleString('lo-LA', { dateStyle: 'short', timeStyle: 'short' })
                        : '—'}
                    </td>
                    <td style={{ textAlign: 'right', padding: '8px 6px', fontWeight: '500' }}>
                      {formatDuration(s.duration_seconds)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginTop: '12px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    background: page === 0 ? '#f3f4f6' : '#fff',
                    cursor: page === 0 ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                  }}
                >
                  ກ່ອນໜ້າ
                </button>
                <span style={{ fontSize: '13px', color: '#6b7280' }}>
                  ໜ້າ {page + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    background: page >= totalPages - 1 ? '#f3f4f6' : '#fff',
                    cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                  }}
                >
                  ຖັດໄປ
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function AdminUserSessionsPage() {
  const [filter, setFilter] = useState<DateFilterType>('A');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<SessionRow[]>([]);

  const supabase = createAdminSupabaseClient();

  useEffect(() => {
    fetchSessions();
  }, [filter]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('user_sessions')
        .select('id, user_id, visitor_id, started_at, ended_at, duration_seconds')
        .order('started_at', { ascending: false });

      query = applyDateFilter(query, filter, 'started_at');
      const { data, error } = await query;

      if (error) throw error;
      setRows((data as SessionRow[]) || []);
    } catch (err) {
      console.error('Fetch user_sessions error:', err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const registeredSessions = useMemo(
    () => rows.filter((r) => r.user_id != null),
    [rows]
  );
  const guestSessions = useMemo(
    () => rows.filter((r) => r.user_id == null),
    [rows]
  );

  const registeredPersons = useMemo(() => {
    const byUser: Record<string, { count: number; totalSec: number; first: string; last: string }> = {};
    registeredSessions.forEach((s) => {
      const uid = s.user_id!;
      if (!byUser[uid]) byUser[uid] = { count: 0, totalSec: 0, first: s.started_at, last: s.started_at };
      const r = byUser[uid];
      r.count += 1;
      if (s.duration_seconds != null) r.totalSec += s.duration_seconds;
      if (s.started_at < r.first) r.first = s.started_at;
      if (s.started_at > r.last) r.last = s.started_at;
    });
    return Object.entries(byUser)
      .map(([id, v]) => ({
        id,
        sessionCount: v.count,
        totalSeconds: v.totalSec,
        avgSeconds: v.count > 0 ? v.totalSec / v.count : 0,
        firstAt: v.first,
        lastAt: v.last,
      }))
      .sort((a, b) => b.sessionCount - a.sessionCount || b.lastAt.localeCompare(a.lastAt));
  }, [registeredSessions]);

  const guestPersons = useMemo(() => {
    const byVisitor: Record<string, { count: number; totalSec: number; first: string; last: string }> = {};
    guestSessions.forEach((s) => {
      const vid = s.visitor_id;
      if (!byVisitor[vid]) byVisitor[vid] = { count: 0, totalSec: 0, first: s.started_at, last: s.started_at };
      const r = byVisitor[vid];
      r.count += 1;
      if (s.duration_seconds != null) r.totalSec += s.duration_seconds;
      if (s.started_at < r.first) r.first = s.started_at;
      if (s.started_at > r.last) r.last = s.started_at;
    });
    return Object.entries(byVisitor)
      .map(([id, v]) => ({
        id,
        sessionCount: v.count,
        totalSeconds: v.totalSec,
        avgSeconds: v.count > 0 ? v.totalSec / v.count : 0,
        firstAt: v.first,
        lastAt: v.last,
      }))
      .sort((a, b) => b.sessionCount - a.sessionCount || b.lastAt.localeCompare(a.lastAt));
  }, [guestSessions]);

  const containerStyle = {
    maxWidth: '1100px',
    margin: '0 auto',
    background: '#f8f9fa',
    minHeight: '100vh',
    paddingBottom: '50px',
    fontFamily: LAO_FONT,
  };

  return (
    <main style={containerStyle}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '30px 20px',
          position: 'sticky',
          top: 0,
          background: '#f8f9fa',
          zIndex: 10,
        }}
      >
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a1a1a' }}>
          User Sessions
        </h1>
        <TimeFilter filter={filter} onFilterChange={setFilter} />
      </div>

      <div style={{ padding: '0 20px 8px' }}>
        <p
          style={{
            fontSize: '13px',
            color: '#6b7280',
            marginBottom: '16px',
            lineHeight: 1.4,
          }}
        >
          ສະຖິຕິ session ຜູ້ໃຊ້: ຈຳນວນຄັ້ງທີ່ເຂົ້າຊົມ ເວລາໃຊ້ແຕ່ລະຄັ້ງ ແລະ ເວລາໃຊ້ງານສະເລ່ຍ. ແບ່ງຕາມຜູ້ໃຊ້ລົງທະບຽນ ແລະ ແຂກ.
        </p>
      </div>

      {/* Header สองฝั่ง: Registered User | Guest User */}
      <div
        style={{
          display: 'flex',
          gap: '20px',
          padding: '0 20px 16px',
          alignItems: 'stretch',
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            flex: 1,
            minWidth: '280px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '14px 20px',
            background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
            border: '1px solid #93c5fd',
            borderRadius: '12px',
            fontSize: '18px',
            fontWeight: '700',
            color: '#1e40af',
          }}
        >
          Registered User
        </div>
        <div
          style={{
            flex: 1,
            minWidth: '280px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '14px 20px',
            background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
            border: '1px solid #86efac',
            borderRadius: '12px',
            fontSize: '18px',
            fontWeight: '700',
            color: '#166534',
          }}
        >
          Guest User
        </div>
      </div>

      {/* สองคอลัมน์: เนื้อหา Registered | Guest */}
      <div
        style={{
          display: 'flex',
          gap: '20px',
          padding: '0 20px',
          flexWrap: 'wrap',
        }}
      >
        <SessionPanel
          title="Registered User"
          loading={loading}
          sessions={registeredSessions}
        />
        <SessionPanel
          title="Guest User"
          loading={loading}
          sessions={guestSessions}
        />
      </div>

      {/* ตารางรายบุคคล */}
      <div style={{ padding: '24px 20px 16px' }}>
        <h2
          style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#1a1a1a',
            marginBottom: '16px',
            paddingBottom: '8px',
            borderBottom: '2px solid #e5e7eb',
          }}
        >
          ຕາຕະລາງລາຍບຸກຄົນ (ແຕ່ລະຄົນເຂົ້າຊົມກີ່ຄັ້ງ ເວລາລວມ ເວລາສະເລ່ຍ)
        </h2>
        <div
          style={{
            display: 'flex',
            gap: '20px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: '320px' }}>
            <PersonTable
              title="Registered User — รายบุคคล"
              loading={loading}
              persons={registeredPersons}
              idLabel="User ID"
            />
          </div>
          <div style={{ flex: 1, minWidth: '320px' }}>
            <PersonTable
              title="Guest User — รายบุคคล"
              loading={loading}
              persons={guestPersons}
              idLabel="Visitor ID"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
