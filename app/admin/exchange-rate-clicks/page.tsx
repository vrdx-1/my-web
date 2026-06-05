'use client'

import { useEffect, useMemo, useState } from 'react';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { LAO_FONT } from '@/utils/constants';

type DailyClickRow = {
  click_date: string;
  count: number;
};

type ClickSummary = {
  year: number;
  todayCount: number;
  totalInYear: number;
  daysWithData: number;
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function AdminExchangeRateClicksPage() {
  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [isMonthOpen, setIsMonthOpen] = useState(false);
  const [isYearOpen, setIsYearOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allRows, setAllRows] = useState<DailyClickRow[]>([]);
  const [summary, setSummary] = useState<ClickSummary>({
    year: currentYear,
    todayCount: 0,
    totalInYear: 0,
    daysWithData: 0,
  });

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
        const res = await fetch(`/api/admin/daily-exchange-rate-popup-clicks?year=${selectedYear}`, {
          credentials: 'include',
        });

        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload?.error || 'Failed to load exchange rate popup click stats');
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
    return () => { cancelled = true; };
  }, [selectedYear]);

  const monthRows = useMemo(() => {
    const prefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-`;
    return allRows.filter((row) => row.click_date.startsWith(prefix));
  }, [allRows, selectedYear, selectedMonth]);

  const monthlyCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of monthRows) {
      map.set(row.click_date, row.count);
    }
    return map;
  }, [monthRows]);

  const monthStartDate = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [now]);

  const currentMonthCount = useMemo(() => {
    return allRows.reduce((sum, row) => {
      const rowDate = new Date(`${row.click_date}T00:00:00.000Z`);
      return rowDate >= monthStartDate ? sum + row.count : sum;
    }, 0);
  }, [allRows, monthStartDate]);

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const monthTotal = useMemo(
    () => monthRows.reduce((sum, row) => sum + row.count, 0),
    [monthRows]
  );

  return (
    <main style={{ maxWidth: '600px', margin: '0 auto', background: '#ffffff', minHeight: '100vh', fontFamily: LAO_FONT, paddingBottom: '40px' }}>
      <div style={{ padding: '20px 20px 16px' }}>
        <p style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          ຈຳນວນຄັ້ງທີ່ກົດດູ ອັດຕາແລກປ່ຽນໂດຍປະມານ
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          <div style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', borderRadius: '16px', padding: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>ມື້ນີ້</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{loading ? '...' : summary.todayCount.toLocaleString()}</div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)', borderRadius: '16px', padding: '16px', border: '1px solid #fed7aa', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '12px', color: '#c2410c', fontWeight: 600, marginBottom: '4px' }}>ເດືອນນີ້</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#7c2d12' }}>{loading ? '...' : currentMonthCount.toLocaleString()}</div>
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
            onClick={() => { setIsMonthOpen(!isMonthOpen); setIsYearOpen(false); }}
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
                  onClick={() => { setSelectedMonth(monthIndex); setIsMonthOpen(false); }}
                  style={{ padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f9f9f9', fontSize: '16px', backgroundColor: selectedMonth === monthIndex ? '#fff7ed' : '#fff' }}
                >
                  {month}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ position: 'relative' }}>
          <div
            onClick={() => { setIsYearOpen(!isYearOpen); setIsMonthOpen(false); }}
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
                  onClick={() => { setSelectedYear(year); setIsYearOpen(false); }}
                  style={{ padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f9f9f9', fontSize: '16px', backgroundColor: selectedYear === year ? '#fff7ed' : '#fff' }}
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

        {error && !loading ? (
          <div style={{ padding: '12px 14px', marginBottom: '12px', border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', borderRadius: '10px', fontSize: '14px' }}>
            {error}
          </div>
        ) : null}

        {loading ? (
          <LoadingSpinner />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                const dateKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dailyCount = monthlyCountMap.get(dateKey) || 0;
                const displayDate = `${String(day).padStart(2, '0')}/${String(selectedMonth + 1).padStart(2, '0')}/${selectedYear}`;

                return (
                  <tr key={dateKey} style={{ borderBottom: '1px solid #f5f5f5' }}>
                    <td style={{ padding: '18px 0', fontSize: '17px', color: '#444' }}>{displayDate}</td>
                    <td style={{ padding: '18px 0', textAlign: 'right', fontSize: '17px', fontWeight: 500, color: dailyCount > 0 ? '#000' : '#bbb' }}>
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
        ຕົວເລກນີ້ເປັນຈຳນວນຄັ້ງທີ່ Guest ແລະ User ທົ່ວໄປກົດດູ ອັດຕາແລກປ່ຽນໂດຍປະມານ
      </div>
    </main>
  );
}
