'use client'

import { useEffect, useMemo, useState } from 'react';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { LAO_FONT } from '@/utils/constants';

type DailyVisitorRow = {
  visit_date: string;
  unique_users: number;
  unique_guests: number;
  unique_total: number;
  visit_events_users: number;
  visit_events_guests: number;
  visit_events_total: number;
};

type VisitorSummary = {
  year: number;
  totalUniqueUsersInRange: number;
  totalUniqueGuestsInRange: number;
  totalUniqueVisitorsInRange: number;
  totalVisitEventsInRange: number;
  todayUniqueUsers: number;
  todayUniqueGuests: number;
  todayUniqueVisitors: number;
  todayVisitEvents: number;
  daysWithData: number;
};

type VisitorDetailPerson = {
  actor_type: 'user' | 'guest';
  actor_key: string;
  user_id: string | null;
  guest_token: string | null;
  display_name: string;
  visit_count: number;
  first_visit_at: string;
  last_visit_at: string;
  visits: Array<{
    visited_at: string;
    entry_path: string;
  }>;
};

type VisitorDetail = {
  date: string;
  uniqueUsers: number;
  uniqueGuests: number;
  uniqueVisitors: number;
  totalVisitEvents: number;
  people: VisitorDetailPerson[];
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTHS_LAO = [
  'ມັງກອນ', 'ກຸມພາ', 'ມີນາ', 'ເມສາ', 'ພຶດສະພາ', 'ມິຖຸນາ',
  'ກໍລະກົດ', 'ສິງຫາ', 'ກັນຍາ', 'ຕຸລາ', 'ພະຈິກ', 'ທັນວາ',
];

function formatIsoDateForLocal(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function AdminVisitorPage() {
  const now = new Date();
  const todayIso = formatIsoDateForLocal(now);
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [isMonthOpen, setIsMonthOpen] = useState(false);
  const [isYearOpen, setIsYearOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allRows, setAllRows] = useState<DailyVisitorRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detail, setDetail] = useState<VisitorDetail | null>(null);
  const [summary, setSummary] = useState<VisitorSummary>({
    year: now.getFullYear(),
    totalUniqueUsersInRange: 0,
    totalUniqueGuestsInRange: 0,
    totalUniqueVisitorsInRange: 0,
    totalVisitEventsInRange: 0,
    todayUniqueUsers: 0,
    todayUniqueGuests: 0,
    todayUniqueVisitors: 0,
    todayVisitEvents: 0,
    daysWithData: 0,
  });

  // ย้อนหลัง 10 ปีถึงปีปัจจุบัน
  const years = Array.from({ length: 11 }, (_, i) => now.getFullYear() - i);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/daily-visitors?year=${selectedYear}`, {
          credentials: 'include',
        });
        if (!res.ok) {
          const p = await res.json().catch(() => ({}));
          throw new Error(p?.error || 'Failed to load visitor stats');
        }
        const payload = await res.json();
        if (cancelled) return;
        setAllRows(Array.isArray(payload?.rows) ? payload.rows : []);
        setSummary({
          year: Number(payload?.summary?.year || selectedYear),
          totalUniqueUsersInRange: Number(payload?.summary?.totalUniqueUsersInRange || 0),
          totalUniqueGuestsInRange: Number(payload?.summary?.totalUniqueGuestsInRange || 0),
          totalUniqueVisitorsInRange: Number(payload?.summary?.totalUniqueVisitorsInRange || 0),
          totalVisitEventsInRange: Number(payload?.summary?.totalVisitEventsInRange || 0),
          todayUniqueUsers: Number(payload?.summary?.todayUniqueUsers || 0),
          todayUniqueGuests: Number(payload?.summary?.todayUniqueGuests || 0),
          todayUniqueVisitors: Number(payload?.summary?.todayUniqueVisitors || 0),
          todayVisitEvents: Number(payload?.summary?.todayVisitEvents || 0),
          daysWithData: Number(payload?.summary?.daysWithData || 0),
        });
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Unknown error');
        setAllRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [selectedYear]);

  useEffect(() => {
    const monthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
    if (selectedDate.startsWith(monthPrefix)) return;

    const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth();
    if (isCurrentMonth) {
      setSelectedDate(todayIso);
      return;
    }

    const monthRowsDescending = [...allRows]
      .filter((row) => row.visit_date.startsWith(monthPrefix) && row.visit_events_total > 0)
      .sort((a, b) => b.visit_date.localeCompare(a.visit_date));

    if (monthRowsDescending.length > 0) {
      setSelectedDate(monthRowsDescending[0].visit_date);
      return;
    }

    setSelectedDate(`${monthPrefix}-01`);
  }, [allRows, now, selectedDate, selectedMonth, selectedYear, todayIso]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const res = await fetch(`/api/admin/daily-visitors?mode=detail&date=${selectedDate}`, {
          credentials: 'include',
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload?.error || 'Failed to load visitor detail');
        }

        const payload = await res.json();
        if (cancelled) return;
        setDetail(payload?.detail ?? null);
      } catch (e) {
        if (cancelled) return;
        setDetailError(e instanceof Error ? e.message : 'Unknown error');
        setDetail(null);
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    };

    if (selectedDate) {
      void run();
    }

    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  // กรองเฉพาะเดือนที่เลือก
  const monthRows = useMemo(() => {
    const prefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-`;
    return allRows.filter((r) => r.visit_date.startsWith(prefix));
  }, [allRows, selectedYear, selectedMonth]);

  // รวมยอดเดือนที่เลือก
  const monthTotal = useMemo(() => ({
    uniqueUsers: monthRows.reduce((sum, row) => sum + row.unique_users, 0),
    uniqueGuests: monthRows.reduce((sum, row) => sum + row.unique_guests, 0),
    uniqueTotal: monthRows.reduce((sum, row) => sum + row.unique_total, 0),
    visitEventsUsers: monthRows.reduce((sum, row) => sum + row.visit_events_users, 0),
    visitEventsGuests: monthRows.reduce((sum, row) => sum + row.visit_events_guests, 0),
    visitEventsTotal: monthRows.reduce((sum, row) => sum + row.visit_events_total, 0),
  }), [monthRows]);

  // สร้างแถวรายวันครบทุกวันในเดือน
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const dailyMap = useMemo(() => {
    const m = new Map<string, DailyVisitorRow>();
    for (const r of monthRows) m.set(r.visit_date, r);
    return m;
  }, [monthRows]);

  const formatDisplayDate = (dateStr: string) => {
    const date = new Date(`${dateStr}T00:00:00Z`);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      weekday: 'short', timeZone: 'UTC',
    });
  };

  const formatBangkokTime = (dateTimeStr: string) => {
    const date = new Date(dateTimeStr);
    return date.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Bangkok',
    });
  };

  const detailDateLabel = selectedDate ? formatDisplayDate(selectedDate) : '-';

  return (
    <main style={{ maxWidth: '900px', margin: '0 auto', background: '#ffffff', minHeight: '100vh', fontFamily: LAO_FONT, paddingBottom: '40px' }}>

      {/* Summary cards */}
      <div style={{ padding: '20px 20px 16px' }}>
        <p style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          ສະຖິຕິຜູ້ໃຊ້ລາຍວັນ
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
          <div style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', borderRadius: '16px', padding: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>ມື້ນີ້ Unique</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a' }}>{loading ? '...' : summary.todayUniqueVisitors.toLocaleString()}</div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>user {summary.todayUniqueUsers} / guest {summary.todayUniqueGuests}</div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', borderRadius: '16px', padding: '16px', border: '1px solid #bbf7d0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '12px', color: '#15803d', fontWeight: 600, marginBottom: '4px' }}>ມື້ນີ້ Visits</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#14532d' }}>{loading ? '...' : summary.todayVisitEvents.toLocaleString()}</div>
            <div style={{ fontSize: '12px', color: '#4ade80', marginTop: '2px' }}>session-level entries</div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', borderRadius: '16px', padding: '16px', border: '1px solid #93c5fd', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: 600, marginBottom: '4px' }}>{MONTHS_LAO[selectedMonth]} Unique</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#1e3a8a' }}>{loading ? '...' : monthTotal.uniqueTotal.toLocaleString()}</div>
            <div style={{ fontSize: '12px', color: '#60a5fa', marginTop: '2px' }}>user {monthTotal.uniqueUsers} / guest {monthTotal.uniqueGuests}</div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)', borderRadius: '16px', padding: '16px', border: '1px solid #fdba74', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '12px', color: '#c2410c', fontWeight: 600, marginBottom: '4px' }}>ປີ {selectedYear} Visits</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#9a3412' }}>{loading ? '...' : summary.totalVisitEventsInRange.toLocaleString()}</div>
            <div style={{ fontSize: '12px', color: '#fb923c', marginTop: '2px' }}>unique {summary.totalUniqueVisitorsInRange.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Month / Year selector */}
      <div style={{ padding: '20px', display: 'flex', justifyContent: 'center', gap: '30px', borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, background: '#ffffff', zIndex: 10 }}>
        {/* Month */}
        <div style={{ position: 'relative' }}>
          <div onClick={() => { setIsMonthOpen(!isMonthOpen); setIsYearOpen(false); }}
            style={{ fontSize: '22px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#1a1a1a' }}>
            {MONTHS[selectedMonth]}
            <span style={{ fontSize: '12px', transform: isMonthOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s' }}>▼</span>
          </div>
          {isMonthOpen && (
            <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', background: '#fff', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', borderRadius: '12px', width: '160px', maxHeight: '350px', overflowY: 'auto', zIndex: 100, marginTop: '10px' }}>
              {MONTHS.map((m, i) => (
                <div key={m} onClick={() => { setSelectedMonth(i); setIsMonthOpen(false); }}
                  style={{ padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f9f9f9', fontSize: '16px', backgroundColor: selectedMonth === i ? '#f0f7ff' : '#fff' }}>
                  {m}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Year */}
        <div style={{ position: 'relative' }}>
          <div onClick={() => { setIsYearOpen(!isYearOpen); setIsMonthOpen(false); }}
            style={{ fontSize: '22px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#1a1a1a' }}>
            {selectedYear}
            <span style={{ fontSize: '12px', transform: isYearOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s' }}>▼</span>
          </div>
          {isYearOpen && (
            <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', background: '#fff', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', borderRadius: '12px', width: '120px', zIndex: 100, marginTop: '10px' }}>
              {years.map((y) => (
                <div key={y} onClick={() => { setSelectedYear(y); setIsYearOpen(false); }}
                  style={{ padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f9f9f9', fontSize: '16px', backgroundColor: selectedYear === y ? '#f0f7ff' : '#fff' }}>
                  {y}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Daily table */}
      <div style={{ padding: '0 20px' }}>
        <p style={{ fontSize: '15px', fontWeight: 600, color: '#333', margin: '20px 0 12px' }}>
          ລາຍລະອຽດແຕ່ລະວັນ — {MONTHS_LAO[selectedMonth]} {selectedYear}
        </p>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '36px' }}>
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div style={{ color: '#dc2626', padding: '20px', fontWeight: 500 }}>{error}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: '760px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
                  <th style={{ padding: '10px 0', textAlign: 'left', fontSize: '14px', color: '#6b7280', fontWeight: 600 }}>ວັນທີ</th>
                  <th style={{ padding: '10px 0', textAlign: 'right', fontSize: '14px', color: '#6b7280', fontWeight: 600 }}>Unique User</th>
                  <th style={{ padding: '10px 0', textAlign: 'right', fontSize: '14px', color: '#6b7280', fontWeight: 600 }}>Unique Guest</th>
                  <th style={{ padding: '10px 0', textAlign: 'right', fontSize: '14px', color: '#6b7280', fontWeight: 600 }}>Unique ລວມ</th>
                  <th style={{ padding: '10px 0', textAlign: 'right', fontSize: '14px', color: '#6b7280', fontWeight: 600 }}>Visits</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1;
                  const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const row = dailyMap.get(dateStr);
                  const users = row?.unique_users ?? 0;
                  const guests = row?.unique_guests ?? 0;
                  const total = row?.unique_total ?? 0;
                  const visitEventsTotal = row?.visit_events_total ?? 0;
                  const isSelected = selectedDate === dateStr;
                  return (
                    <tr
                      key={day}
                      onClick={() => setSelectedDate(dateStr)}
                      style={{
                        borderBottom: '1px solid #f5f5f5',
                        background: isSelected ? '#f8fafc' : '#ffffff',
                        cursor: 'pointer',
                      }}
                    >
                      <td style={{ padding: '18px 0', fontSize: '17px', color: '#444', fontWeight: isSelected ? 700 : 400 }}>{formatDisplayDate(dateStr)}</td>
                      <td style={{ padding: '18px 0', textAlign: 'right', fontSize: '17px', color: users > 0 ? '#000' : '#bbb' }}>{users.toLocaleString()}</td>
                      <td style={{ padding: '18px 0', textAlign: 'right', fontSize: '17px', color: guests > 0 ? '#000' : '#bbb' }}>{guests.toLocaleString()}</td>
                      <td style={{ padding: '18px 0', textAlign: 'right', fontSize: '17px', fontWeight: total > 0 ? 700 : 400, color: total > 0 ? '#000' : '#bbb' }}>{total.toLocaleString()}</td>
                      <td style={{ padding: '18px 0', textAlign: 'right', fontSize: '17px', color: visitEventsTotal > 0 ? '#0f172a' : '#bbb' }}>
                        <div style={{ fontWeight: visitEventsTotal > 0 ? 700 : 400 }}>{visitEventsTotal.toLocaleString()}</div>
                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                          u {row?.visit_events_users ?? 0} / g {row?.visit_events_guests ?? 0}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                <tr>
                  <td style={{ padding: '30px 0', fontWeight: 'bold', fontSize: '20px', color: '#000' }}>ລວມທັງໝົດ</td>
                  <td style={{ padding: '30px 0', textAlign: 'right', fontWeight: 'bold', fontSize: '20px', color: '#000' }}>{monthTotal.uniqueUsers.toLocaleString()}</td>
                  <td style={{ padding: '30px 0', textAlign: 'right', fontWeight: 'bold', fontSize: '20px', color: '#000' }}>{monthTotal.uniqueGuests.toLocaleString()}</td>
                  <td style={{ padding: '30px 0', textAlign: 'right', fontWeight: 'bold', fontSize: '20px', color: '#000' }}>{monthTotal.uniqueTotal.toLocaleString()}</td>
                  <td style={{ padding: '30px 0', textAlign: 'right', fontWeight: 'bold', fontSize: '20px', color: '#000' }}>{monthTotal.visitEventsTotal.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ padding: '24px 20px 0' }}>
        <p style={{ fontSize: '15px', fontWeight: 600, color: '#333', margin: '0 0 12px' }}>
          ປະຫວັດລາຍບຸກຄົນ — {detailDateLabel}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px', marginBottom: '14px' }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '14px' }}>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Unique People</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>{detailLoading ? '...' : detail?.uniqueVisitors?.toLocaleString() ?? '0'}</div>
          </div>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '14px', padding: '14px' }}>
            <div style={{ fontSize: '12px', color: '#15803d', fontWeight: 600 }}>Unique User / Guest</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#14532d' }}>{detailLoading ? '...' : `${detail?.uniqueUsers ?? 0} / ${detail?.uniqueGuests ?? 0}`}</div>
          </div>
          <div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: '14px', padding: '14px' }}>
            <div style={{ fontSize: '12px', color: '#c2410c', fontWeight: 600 }}>Visits Total</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#9a3412' }}>{detailLoading ? '...' : detail?.totalVisitEvents?.toLocaleString() ?? '0'}</div>
          </div>
        </div>

        {detailLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '36px' }}>
            <LoadingSpinner />
          </div>
        ) : detailError ? (
          <div style={{ color: '#dc2626', padding: '20px 0', fontWeight: 500 }}>{detailError}</div>
        ) : !detail || detail.people.length === 0 ? (
          <div style={{ padding: '20px 0', color: '#64748b' }}>ບໍ່ມີປະຫວັດສຳລັບວັນນີ້</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: '920px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
                  <th style={{ padding: '10px 0', textAlign: 'left', fontSize: '14px', color: '#6b7280', fontWeight: 600 }}>ບຸກຄົນ</th>
                  <th style={{ padding: '10px 0', textAlign: 'left', fontSize: '14px', color: '#6b7280', fontWeight: 600 }}>Type</th>
                  <th style={{ padding: '10px 0', textAlign: 'right', fontSize: '14px', color: '#6b7280', fontWeight: 600 }}>Visits</th>
                  <th style={{ padding: '10px 0', textAlign: 'left', fontSize: '14px', color: '#6b7280', fontWeight: 600 }}>First</th>
                  <th style={{ padding: '10px 0', textAlign: 'left', fontSize: '14px', color: '#6b7280', fontWeight: 600 }}>Last</th>
                  <th style={{ padding: '10px 0', textAlign: 'left', fontSize: '14px', color: '#6b7280', fontWeight: 600 }}>History</th>
                </tr>
              </thead>
              <tbody>
                {detail.people.map((person) => (
                  <tr key={`${person.actor_type}:${person.actor_key}`} style={{ borderBottom: '1px solid #f5f5f5', verticalAlign: 'top' }}>
                    <td style={{ padding: '16px 0', color: '#111827' }}>
                      <div style={{ fontSize: '16px', fontWeight: 700 }}>{person.display_name}</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                        {person.actor_type === 'user' ? person.user_id : person.guest_token}
                      </div>
                    </td>
                    <td style={{ padding: '16px 0', color: person.actor_type === 'user' ? '#1d4ed8' : '#c2410c', fontWeight: 600 }}>
                      {person.actor_type}
                    </td>
                    <td style={{ padding: '16px 0', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{person.visit_count.toLocaleString()}</td>
                    <td style={{ padding: '16px 0', color: '#334155' }}>{formatBangkokTime(person.first_visit_at)}</td>
                    <td style={{ padding: '16px 0', color: '#334155' }}>{formatBangkokTime(person.last_visit_at)}</td>
                    <td style={{ padding: '16px 0' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {person.visits.map((visit, index) => (
                          <div
                            key={`${person.actor_key}-${visit.visited_at}-${index}`}
                            style={{
                              borderRadius: '999px',
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              padding: '6px 10px',
                              fontSize: '12px',
                              color: '#334155',
                            }}
                          >
                            {formatBangkokTime(visit.visited_at)} {visit.entry_path}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </main>
  );
}
