'use client'

import { useEffect, useMemo, useState } from 'react';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Avatar } from '@/components/Avatar';
import { LAO_FONT } from '@/utils/constants';

type DailyRegistrationRow = {
  register_date: string;
  count: number;
};

type RegistrationSummary = {
  year: number;
  todayCount: number;
  totalInYear: number;
  daysWithData: number;
};

type RegisteredUserRow = {
  id: string;
  username: string;
  avatar_url: string | null;
  registered_at: string | null;
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function AdminRegistrationsPage() {
  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [isMonthOpen, setIsMonthOpen] = useState(false);
  const [isYearOpen, setIsYearOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allRows, setAllRows] = useState<DailyRegistrationRow[]>([]);
  const [summary, setSummary] = useState<RegistrationSummary>({
    year: currentYear,
    todayCount: 0,
    totalInYear: 0,
    daysWithData: 0,
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [activeUsers, setActiveUsers] = useState<RegisteredUserRow[]>([]);

  // รวมปี 2025 และปีปัจจุบันไปจนถึงอีก 9 ปีข้างหน้า
  const years = useMemo(
    () => [2025, ...Array.from({ length: 10 }, (_, i) => currentYear + i)],
    [currentYear]
  );

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/daily-registrations?year=${selectedYear}`, {
          credentials: 'include',
        });

        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload?.error || 'Failed to load registration stats');
        }

        const payload = await res.json();
        if (cancelled) return;

        setAllRows(Array.isArray(payload?.rows) ? payload.rows : []);
        setSummary({
          year: Number(payload?.summary?.year || selectedYear),
          todayCount: Number(payload?.summary?.todayCount || 0),
          totalInYear: Number(payload?.summary?.totalInYear || 0),
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

    return () => {
      cancelled = true;
    };
  }, [selectedYear]);

  const monthRows = useMemo(() => {
    const prefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-`;
    return allRows.filter((row) => row.register_date.startsWith(prefix));
  }, [allRows, selectedYear, selectedMonth]);

  const monthlyCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of monthRows) {
      map.set(row.register_date, row.count);
    }
    return map;
  }, [monthRows]);

  const monthTotal = useMemo(
    () => monthRows.reduce((sum, row) => sum + row.count, 0),
    [monthRows]
  );

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const monthStartDate = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [now]);

  const todayLocalDateKey = useMemo(() => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);

    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;

    if (!year || !month || !day) {
      return now.toISOString().slice(0, 10);
    }
    return `${year}-${month}-${day}`;
  }, [now]);

  const currentMonthCount = useMemo(() => {
    return allRows.reduce((sum, row) => {
      const rowDate = new Date(`${row.register_date}T00:00:00.000Z`);
      return rowDate >= monthStartDate ? sum + row.count : sum;
    }, 0);
  }, [allRows, monthStartDate]);

  const formatDisplayDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Bangkok',
    });
  };

  const handleOpenDayUsers = async (dateStr: string, dailyCount: number) => {
    if (dailyCount <= 0) return;
    setModalOpen(true);
    setModalLoading(true);
    setModalError(null);
    setActiveDate(dateStr);
    setActiveUsers([]);

    try {
      const res = await fetch(`/api/admin/daily-registrations/users?date=${dateStr}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || 'Failed to load registered users');
      }
      const payload = await res.json();
      setActiveUsers(Array.isArray(payload?.users) ? payload.users : []);
    } catch (e) {
      setModalError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setModalLoading(false);
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setModalLoading(false);
    setModalError(null);
    setActiveDate(null);
    setActiveUsers([]);
  };

  useEffect(() => {
    if (!modalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleCloseModal();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalOpen]);

  return (
    <main style={{ maxWidth: '600px', margin: '0 auto', background: '#ffffff', minHeight: '100vh', fontFamily: LAO_FONT, paddingBottom: '40px' }}>

      <div style={{ padding: '20px 20px 16px' }}>
        <p style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          ຜູ້ລົງທະບຽນລາຍວັນ
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          <div style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', borderRadius: '16px', padding: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>ມື້ນີ້</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{loading ? '...' : summary.todayCount.toLocaleString()}</div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', borderRadius: '16px', padding: '16px', border: '1px solid #bbf7d0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '12px', color: '#15803d', fontWeight: 600, marginBottom: '4px' }}>ເດືອນນີ້</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#14532d' }}>{loading ? '...' : currentMonthCount.toLocaleString()}</div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', borderRadius: '16px', padding: '16px', border: '1px solid #93c5fd', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: 600, marginBottom: '4px' }}>ປີນີ້</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#1e3a8a' }}>{loading ? '...' : summary.totalInYear.toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '20px', display: 'flex', justifyContent: 'center', gap: '30px', borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, background: '#ffffff', zIndex: 10 }}>
        <div style={{ position: 'relative' }}>
          <div
            onClick={() => {
              setIsMonthOpen(!isMonthOpen);
              setIsYearOpen(false);
            }}
            style={{ fontSize: '22px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#1a1a1a' }}
          >
            {MONTHS[selectedMonth]}
            <span style={{ fontSize: '12px', transform: isMonthOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s' }}>▼</span>
          </div>
          {isMonthOpen && (
            <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', background: '#fff', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', borderRadius: '12px', width: '160px', maxHeight: '350px', overflowY: 'auto', zIndex: 100, marginTop: '10px' }}>
              {MONTHS.map((month, monthIndex) => (
                <div
                  key={month}
                  onClick={() => {
                    setSelectedMonth(monthIndex);
                    setIsMonthOpen(false);
                  }}
                  style={{ padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f9f9f9', fontSize: '16px', backgroundColor: selectedMonth === monthIndex ? '#f0f7ff' : '#fff' }}
                >
                  {month}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ position: 'relative' }}>
          <div
            onClick={() => {
              setIsYearOpen(!isYearOpen);
              setIsMonthOpen(false);
            }}
            style={{ fontSize: '22px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#1a1a1a' }}
          >
            {selectedYear}
            <span style={{ fontSize: '12px', transform: isYearOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s' }}>▼</span>
          </div>
          {isYearOpen && (
            <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', background: '#fff', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', borderRadius: '12px', width: '120px', zIndex: 100, marginTop: '10px' }}>
              {years.map((year) => (
                <div
                  key={year}
                  onClick={() => {
                    setSelectedYear(year);
                    setIsYearOpen(false);
                  }}
                  style={{ padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f9f9f9', fontSize: '16px', backgroundColor: selectedYear === year ? '#f0f7ff' : '#fff' }}
                >
                  {year}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '0 20px' }}>
        <p style={{ fontSize: '15px', fontWeight: 600, color: '#333', margin: '20px 0 12px' }}>
          ລາຍລະອຽດແຕ່ລະວັນ — {MONTHS[selectedMonth]} {selectedYear}
        </p>
        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <div style={{ color: '#dc2626', padding: '20px', fontWeight: 500 }}>{error}</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {Array.from({ length: daysInMonth }, (_, index) => {
                const day = index + 1;
                const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dailyCount = monthlyCountMap.get(dateStr) ?? 0;
                const isToday = dateStr === todayLocalDateKey;
                const clickable = dailyCount > 0;
                return (
                  <tr
                    key={day}
                    onClick={() => {
                      void handleOpenDayUsers(dateStr, dailyCount);
                    }}
                    style={{ borderBottom: '1px solid #f5f5f5', cursor: clickable ? 'pointer' : 'default', background: clickable ? '#fcfcff' : '#fff' }}
                  >
                    <td style={{ padding: '18px 0', fontSize: '17px', color: '#444' }}>
                      {formatDisplayDate(dateStr)}
                      {isToday ? ' (Today)' : ''}
                    </td>
                    <td style={{ padding: '18px 0', textAlign: 'right', fontSize: '17px', fontWeight: dailyCount > 0 ? 500 : 400, color: dailyCount > 0 ? '#000' : '#bbb' }}>
                      {dailyCount.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td style={{ padding: '30px 0', fontWeight: 'bold', fontSize: '20px', color: '#000' }}>ລວມທັງໝົດ</td>
                <td style={{ padding: '30px 0', textAlign: 'right', fontWeight: 'bold', fontSize: '20px', color: '#000' }}>
                  {monthTotal.toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <div style={{ textAlign: 'center', padding: '40px 20px', color: '#777', fontSize: '14px' }}>
        ສະແດງຈໍານວນຜູ້ລົງທະບຽນຕໍ່ມື້ຂອງປີທີ່ເລືອກ (10 ປີຂ້າງໜ້າ)
      </div>

      {modalOpen && (
        <div
          onClick={handleCloseModal}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.42)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '520px',
              maxHeight: '80vh',
              background: '#fff',
              borderRadius: '16px',
              boxShadow: '0 20px 45px rgba(0, 0, 0, 0.18)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ padding: '16px 18px', borderBottom: '1px solid #eef2f7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>ຜູ້ລົງທະບຽນ</div>
                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '3px' }}>{activeDate ? formatDisplayDate(activeDate) : '-'}</div>
              </div>
              <button
                onClick={handleCloseModal}
                style={{ border: 'none', background: 'transparent', fontSize: '24px', lineHeight: '1', cursor: 'pointer', color: '#64748b' }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div style={{ overflowY: 'auto', padding: '8px 0' }}>
              {modalLoading ? (
                <div style={{ padding: '28px 0', display: 'flex', justifyContent: 'center' }}>
                  <LoadingSpinner />
                </div>
              ) : modalError ? (
                <div style={{ padding: '16px 18px', color: '#dc2626', fontWeight: 500 }}>{modalError}</div>
              ) : activeUsers.length === 0 ? (
                <div style={{ padding: '16px 18px', color: '#64748b' }}>ບໍ່ພົບຂໍ້ມູນຜູ້ລົງທະບຽນໃນມື້ນີ້</div>
              ) : (
                activeUsers.map((user) => (
                  <div
                    key={user.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      padding: '12px 18px',
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Avatar avatarUrl={user.avatar_url} size={42} useProfileImage />
                      <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>{user.username}</div>
                    </div>
                    <div style={{ fontSize: '13px', color: '#64748b' }}>{formatTime(user.registered_at)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
