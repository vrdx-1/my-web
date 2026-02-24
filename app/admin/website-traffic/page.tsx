'use client'

import { useState, useEffect, useMemo } from 'react';
import { createAdminSupabaseClient } from '@/utils/adminSupabaseClient';
import { applyDateFilter } from '@/utils/dateFilter';
import { TimeFilter } from '@/components/admin/TimeFilter';
import { StatCard } from '@/components/admin/StatCard';
import { LAO_FONT } from '@/utils/constants';
import { LoadingSpinner } from '@/components/LoadingSpinner';

type DateFilterType = 'D' | 'W' | 'M' | 'Y' | 'A';

type VisitorLogRow = {
  visitor_id: string;
  is_first_visit: boolean;
  created_at: string;
};

export default function AdminWebsiteTrafficPage() {
  const [filter, setFilter] = useState<DateFilterType>('A');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<VisitorLogRow[]>([]);

  const supabase = createAdminSupabaseClient();

  useEffect(() => {
    fetchTraffic();
  }, [filter]);

  useEffect(() => {
    setPersonPage(0);
  }, [filter]);

  const fetchTraffic = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('visitor_logs')
        .select('visitor_id, is_first_visit, created_at')
        .order('created_at', { ascending: false });

      query = applyDateFilter(query, filter);
      const { data, error } = await query;

      if (error) throw error;
      setRows((data as VisitorLogRow[]) || []);
    } catch (err) {
      console.error('Fetch visitor_logs error:', err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const totalVisits = rows.length;
    const firstVisitRows = rows.filter((r) => r.is_first_visit === true);
    const returningRows = rows.filter((r) => r.is_first_visit === false);
    const newUsers = firstVisitRows.length;
    const newVisits = firstVisitRows.length;
    const oldVisits = returningRows.length;
    const oldUserIds = new Set(returningRows.map((r) => r.visitor_id));
    const oldUsers = oldUserIds.size;
    return {
      totalVisits,
      newUsers,
      newVisits,
      oldUsers,
      oldVisits,
    };
  }, [rows]);

  const visitsByDay = useMemo(() => {
    const byDay: Record<string, { total: number; new: number; returning: number }> = {};
    rows.forEach((r) => {
      const day = r.created_at.slice(0, 10);
      if (!byDay[day]) byDay[day] = { total: 0, new: 0, returning: 0 };
      byDay[day].total += 1;
      if (r.is_first_visit) byDay[day].new += 1;
      else byDay[day].returning += 1;
    });
    return Object.entries(byDay)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 14);
  }, [rows]);

  type PersonRow = {
    visitor_id: string;
    firstVisitAt: string;
    lastVisitAt: string;
    visitCount: number;
    isReturning: boolean;
  };

  const personList = useMemo(() => {
    const byPerson: Record<string, { first: string; last: string; count: number; hasReturn: boolean }> = {};
    rows.forEach((r) => {
      const id = r.visitor_id;
      if (!byPerson[id]) {
        byPerson[id] = { first: r.created_at, last: r.created_at, count: 0, hasReturn: false };
      }
      const rec = byPerson[id];
      rec.count += 1;
      if (r.created_at < rec.first) rec.first = r.created_at;
      if (r.created_at > rec.last) rec.last = r.created_at;
      if (!r.is_first_visit) rec.hasReturn = true;
    });
    return Object.entries(byPerson)
      .map(([visitor_id, v]): PersonRow => ({
        visitor_id,
        firstVisitAt: v.first,
        lastVisitAt: v.last,
        visitCount: v.count,
        isReturning: v.hasReturn,
      }))
      .sort((a, b) => b.visitCount - a.visitCount || b.lastVisitAt.localeCompare(a.lastVisitAt));
  }, [rows]);

  const PAGE_SIZE = 20;
  const [personPage, setPersonPage] = useState(0);
  const totalPersonPages = Math.max(1, Math.ceil(personList.length / PAGE_SIZE));
  const personPageList = useMemo(
    () => personList.slice(personPage * PAGE_SIZE, (personPage + 1) * PAGE_SIZE),
    [personList, personPage]
  );

  const maskId = (id: string) => {
    if (id.length <= 12) return id;
    return '…' + id.slice(-10);
  };

  const containerStyle = {
    maxWidth: '900px',
    margin: '0 auto',
    background: '#f8f9fa',
    minHeight: '100vh',
    paddingBottom: '50px',
    fontFamily: LAO_FONT,
  };

  const stackStyle = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    padding: '0 20px',
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
          Website Traffic
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
          ຈຳນວນຜູ້ເຂົ້າຊົມເວັບ ແລະ ຈຳນວນຄັ້ງທີ່ເຂົ້າຊົມ (ຄົນໃໝ່ = ເຂົ້າຄັ້ງທຳອິດ, ຄົນເກົ່າ = ກັບມາຊົມອີກ).
        </p>
      </div>

      <div style={stackStyle}>
        <StatCard
          label="ລວມທັງໝົດ (Total visits)"
          value={`${stats.totalVisits.toLocaleString()} ຄັ້ງ`}
          loading={loading}
        />

        <div
          style={{
            background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
            borderRadius: '12px',
            padding: '16px 24px',
            border: '1px solid #bbf7d0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          <div
            style={{
              fontSize: '13px',
              color: '#15803d',
              fontWeight: '600',
              marginBottom: '8px',
            }}
          >
            ຄົນໃໝ່ (First-time visitors)
          </div>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div>
              <span style={{ fontSize: '12px', color: '#166534' }}>ຈຳນວນຄົນ: </span>
              <span style={{ fontSize: '18px', fontWeight: '700', color: '#14532d' }}>
                {loading ? '...' : stats.newUsers.toLocaleString()}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '12px', color: '#166534' }}>ຈຳນວນຄັ້ງ: </span>
              <span style={{ fontSize: '18px', fontWeight: '700', color: '#14532d' }}>
                {loading ? '...' : stats.newVisits.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
            borderRadius: '12px',
            padding: '16px 24px',
            border: '1px solid #93c5fd',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          <div
            style={{
              fontSize: '13px',
              color: '#1d4ed8',
              fontWeight: '600',
              marginBottom: '8px',
            }}
          >
            ຄົນເກົ່າ (Returning visitors)
          </div>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div>
              <span style={{ fontSize: '12px', color: '#1e40af' }}>ຈຳນວນຄົນ: </span>
              <span style={{ fontSize: '18px', fontWeight: '700', color: '#1e3a8a' }}>
                {loading ? '...' : stats.oldUsers.toLocaleString()}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '12px', color: '#1e40af' }}>ຈຳນວນຄັ້ງ: </span>
              <span style={{ fontSize: '18px', fontWeight: '700', color: '#1e3a8a' }}>
                {loading ? '...' : stats.oldVisits.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div
          style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '16px 24px',
            border: '1px solid #f0f0f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          <div
            style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#1a1a1a',
              marginBottom: '12px',
              paddingBottom: '8px',
              borderBottom: '2px solid #e5e7eb',
            }}
          >
            ລາຍລະອຽດແຕ່ລະວັນ (ລ່າສຸດ 14 ວັນ)
          </div>
          {loading ? (
            <LoadingSpinner />
          ) : visitsByDay.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: '14px' }}>ຍັງບໍ່ມີຂໍ້ມູນ</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '10px 8px', color: '#6b7280', fontWeight: '600' }}>
                    ວັນທີ
                  </th>
                  <th style={{ textAlign: 'right', padding: '10px 8px', color: '#6b7280', fontWeight: '600' }}>
                    ລວມ
                  </th>
                  <th style={{ textAlign: 'right', padding: '10px 8px', color: '#15803d', fontWeight: '600' }}>
                    ໃໝ່
                  </th>
                  <th style={{ textAlign: 'right', padding: '10px 8px', color: '#1d4ed8', fontWeight: '600' }}>
                    ກັບມາ
                  </th>
                </tr>
              </thead>
              <tbody>
                {visitsByDay.map(([day, v]) => (
                  <tr key={day} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 8px', color: '#374151' }}>
                      {new Date(day + 'T12:00:00').toLocaleDateString('lo-LA', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td style={{ textAlign: 'right', padding: '10px 8px', fontWeight: '500' }}>
                      {v.total.toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'right', padding: '10px 8px', color: '#15803d' }}>
                      {v.new.toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'right', padding: '10px 8px', color: '#1d4ed8' }}>
                      {v.returning.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ตารางรายบุคคล */}
        <div
          style={{
            background: '#fff',
            borderRadius: '12px',
            padding: '16px 24px',
            border: '1px solid #f0f0f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            overflowX: 'auto',
          }}
        >
          <div
            style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#1a1a1a',
              marginBottom: '8px',
              paddingBottom: '8px',
              borderBottom: '2px solid #e5e7eb',
            }}
          >
            ຕາຕະລາງລາຍບຸກຄົນ (ຜູ້ເຂົ້າຊົມແຕ່ລະຄົນ)
          </div>
          <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px' }}>
            ລວມ {personList.length.toLocaleString()} ຄົນ — ແບ່ງຕາມຈຳນວນຄັ້ງທີ່ເຂົ້າຊົມ (ຫຼາຍທີ່ສຸດຢູ່ດ້ານເທິງ)
          </p>
          {loading ? (
            <LoadingSpinner />
          ) : personPageList.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: '14px' }}>ຍັງບໍ່ມີຂໍ້ມູນ</p>
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', minWidth: '520px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ textAlign: 'left', padding: '10px 8px', color: '#6b7280', fontWeight: '600', width: '48px' }}>
                      ລຳດັບ
                    </th>
                    <th style={{ textAlign: 'left', padding: '10px 8px', color: '#6b7280', fontWeight: '600' }}>
                      Visitor ID
                    </th>
                    <th style={{ textAlign: 'left', padding: '10px 8px', color: '#6b7280', fontWeight: '600' }}>
                      ຄັ້ງທຳອິດ
                    </th>
                    <th style={{ textAlign: 'left', padding: '10px 8px', color: '#6b7280', fontWeight: '600' }}>
                      ຄັ້ງລ່າສຸດ
                    </th>
                    <th style={{ textAlign: 'right', padding: '10px 8px', color: '#6b7280', fontWeight: '600', width: '90px' }}>
                      ຈຳນວນຄັ້ງ
                    </th>
                    <th style={{ textAlign: 'center', padding: '10px 8px', color: '#6b7280', fontWeight: '600', width: '90px' }}>
                      ປະເພດ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {personPageList.map((p, idx) => (
                    <tr key={p.visitor_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 8px', color: '#374151' }}>
                        {personPage * PAGE_SIZE + idx + 1}
                      </td>
                      <td style={{ padding: '10px 8px', color: '#374151', fontFamily: 'monospace', fontSize: '13px' }}>
                        {maskId(p.visitor_id)}
                      </td>
                      <td style={{ padding: '10px 8px', color: '#374151', whiteSpace: 'nowrap' }}>
                        {new Date(p.firstVisitAt).toLocaleString('lo-LA', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td style={{ padding: '10px 8px', color: '#374151', whiteSpace: 'nowrap' }}>
                        {new Date(p.lastVisitAt).toLocaleString('lo-LA', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td style={{ textAlign: 'right', padding: '10px 8px', fontWeight: '600', color: '#1a1a1a' }}>
                        {p.visitCount.toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                        <span
                          style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            background: p.isReturning ? '#dbeafe' : '#dcfce7',
                            color: p.isReturning ? '#1e40af' : '#166534',
                          }}
                        >
                          {p.isReturning ? 'ກັບມາ' : 'ໃໝ່'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalPersonPages > 1 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    marginTop: '16px',
                    flexWrap: 'wrap',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setPersonPage((p) => Math.max(0, p - 1))}
                    disabled={personPage === 0}
                    style={{
                      padding: '8px 14px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      background: personPage === 0 ? '#f3f4f6' : '#fff',
                      cursor: personPage === 0 ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      color: personPage === 0 ? '#9ca3af' : '#374151',
                    }}
                  >
                    ກ່ອນໜ້າ
                  </button>
                  <span style={{ fontSize: '14px', color: '#6b7280', padding: '0 8px' }}>
                    ໜ້າ {personPage + 1} / {totalPersonPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPersonPage((p) => Math.min(totalPersonPages - 1, p + 1))}
                    disabled={personPage >= totalPersonPages - 1}
                    style={{
                      padding: '8px 14px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      background: personPage >= totalPersonPages - 1 ? '#f3f4f6' : '#fff',
                      cursor: personPage >= totalPersonPages - 1 ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      color: personPage >= totalPersonPages - 1 ? '#9ca3af' : '#374151',
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
    </main>
  );
}
