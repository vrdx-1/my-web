'use client'
import { useState, useEffect, useMemo } from 'react';
import { createAdminSupabaseClient } from '@/utils/adminSupabaseClient';
import { formatCurrency } from '@/utils/currency';
import { LAO_FONT } from '@/utils/constants';
import { LoadingSpinner } from '@/components/LoadingSpinner';

type RevenueLogRow = { amount: number; created_at: string };

export default function RevenuePage() {
  const supabase = createAdminSupabaseClient();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [revenueData, setRevenueData] = useState<{ [key: string]: number }>({});
  const [loading, setLoading] = useState(true);
  const [isMonthOpen, setIsMonthOpen] = useState(false);
  const [isYearOpen, setIsYearOpen] = useState(false);
  const [revenueRows, setRevenueRows] = useState<RevenueLogRow[]>([]);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = Array.from({ length: 11 }, (_, i) => new Date().getFullYear() + i);

  const now = useMemo(() => new Date(), []);
  const todayStart = useMemo(() => {
    const d = new Date(now); d.setHours(0, 0, 0, 0); return d.toISOString();
  }, [now]);
  const todayEnd = useMemo(() => {
    const d = new Date(now); d.setHours(23, 59, 59, 999); return d.toISOString();
  }, [now]);
  const monthStart = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth(), 1); return d.toISOString();
  }, [now]);
  const yearStart = useMemo(() => {
    const d = new Date(now.getFullYear(), 0, 1); return d.toISOString();
  }, [now]);

  const fetchRevenue = async () => {
    setLoading(true);
    const startOfYear = new Date(selectedYear, 0, 1).toISOString();
    const endOfYear = new Date(selectedYear, 11, 31, 23, 59, 59).toISOString();

    const { data, error } = await supabase
      .from('revenue_logs')
      .select('amount, created_at')
      .gte('created_at', startOfYear)
      .lte('created_at', endOfYear)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching revenue_logs:', error);
      setRevenueRows([]);
    } else {
      const rows = (data || []).map((r: { amount?: number; created_at?: string }) => ({
        amount: Number(r.amount) || 0,
        created_at: r.created_at || ''
      }));
      setRevenueRows(rows);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRevenue();
  }, [selectedYear]);

  const summary = useMemo(() => {
    let today = 0, month = 0, year = 0;
    revenueRows.forEach((r) => {
      const t = new Date(r.created_at).getTime();
      if (t >= new Date(todayStart).getTime() && t <= new Date(todayEnd).getTime()) today += r.amount;
      if (t >= new Date(monthStart).getTime() && t <= now.getTime()) month += r.amount;
      if (t >= new Date(yearStart).getTime() && t <= now.getTime()) year += r.amount;
    });
    return { today, month, year };
  }, [revenueRows, todayStart, todayEnd, monthStart, yearStart, now]);

  const dailyForSelectedMonth = useMemo(() => {
    const start = new Date(selectedYear, selectedMonth, 1).getTime();
    const end = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59).getTime();
    const daily: { [key: string]: number } = {};
    revenueRows.forEach((r) => {
      const t = new Date(r.created_at).getTime();
      if (t >= start && t <= end) {
        const day = new Date(r.created_at).getDate();
        daily[day] = (daily[day] || 0) + r.amount;
      }
    });
    return daily;
  }, [revenueRows, selectedMonth, selectedYear]);

  useEffect(() => {
    setRevenueData(dailyForSelectedMonth);
  }, [dailyForSelectedMonth]);

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const totalRevenue = Object.values(revenueData).reduce((a, b) => a + b, 0);

  return (
    <main style={{ maxWidth: '600px', margin: '0 auto', background: '#ffffff', backgroundColor: '#ffffff', minHeight: '100vh', fontFamily: LAO_FONT, paddingBottom: '40px' }}>
      
      {/* Summary: Today / This month / This year */}
      <div style={{ padding: '20px 20px 16px' }}>
        <p style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          ລາຍຮັບຈາກ Boost
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          <div style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', borderRadius: '16px', padding: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>ມື້ນີ້</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>{loading ? '...' : formatCurrency(summary.today)}</div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', borderRadius: '16px', padding: '16px', border: '1px solid #bbf7d0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '12px', color: '#15803d', fontWeight: '600', marginBottom: '4px' }}>ເດືອນນີ້</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#14532d' }}>{loading ? '...' : formatCurrency(summary.month)}</div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', borderRadius: '16px', padding: '16px', border: '1px solid #93c5fd', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: '600', marginBottom: '4px' }}>ປີນີ້</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#1e3a8a' }}>{loading ? '...' : formatCurrency(summary.year)}</div>
          </div>
        </div>
      </div>

      {/* Header Selector Section */}
      <div style={{ padding: '20px', display: 'flex', justifyContent: 'center', gap: '30px', borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, background: '#ffffff', backgroundColor: '#ffffff', zIndex: 10 }}>
        <div style={{ position: 'relative' }}>
          <div 
            onClick={() => setIsMonthOpen(!isMonthOpen)}
            style={{ fontSize: '22px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#1a1a1a' }}
          >
            {months[selectedMonth]} 
            <span style={{ fontSize: '12px', transform: isMonthOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s' }}>v</span>
          </div>
          {isMonthOpen && (
            <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', background: '#fff', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', borderRadius: '12px', width: '160px', maxHeight: '350px', overflowY: 'auto', zIndex: 100, marginTop: '10px' }}>
              {months.map((m, i) => (
                <div key={m} onClick={() => { setSelectedMonth(i); setIsMonthOpen(false); }} style={{ padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f9f9f9', fontSize: '16px', backgroundColor: selectedMonth === i ? '#f0f7ff' : '#fff' }}>{m}</div>
              ))}
            </div>
          )}
        </div>
        <div style={{ position: 'relative' }}>
          <div 
            onClick={() => setIsYearOpen(!isYearOpen)}
            style={{ fontSize: '22px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#1a1a1a' }}
          >
            {selectedYear} 
            <span style={{ fontSize: '12px', transform: isYearOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s' }}>v</span>
          </div>
          {isYearOpen && (
            <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', background: '#fff', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', borderRadius: '12px', width: '120px', zIndex: 100, marginTop: '10px' }}>
              {years.map(y => (
                <div key={y} onClick={() => { setSelectedYear(y); setIsYearOpen(false); }} style={{ padding: '12px 20px', cursor: 'pointer', borderBottom: '1px solid #f9f9f9', fontSize: '16px', backgroundColor: selectedYear === y ? '#f0f7ff' : '#fff' }}>{y}</div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '0 20px' }}>
        <p style={{ fontSize: '15px', fontWeight: 600, color: '#333', margin: '20px 0 12px' }}>ລາຍລະອຽດແຕ່ລະວັນ — {months[selectedMonth]} {selectedYear}</p>
        {loading ? (
          <LoadingSpinner />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {daysArray.map(day => {
                const displayDate = `${day.toString().padStart(2, '0')}/${(selectedMonth + 1).toString().padStart(2, '0')}/${selectedYear}`;
                const dailyAmount = revenueData[day] || 0;
                return (
                  <tr key={day} style={{ borderBottom: '1px solid #f5f5f5' }}>
                    <td style={{ padding: '18px 0', fontSize: '17px', color: '#444' }}>
                      {displayDate}
                    </td>
                    <td style={{ padding: '18px 0', textAlign: 'right', fontSize: '17px', fontWeight: '500', color: dailyAmount > 0 ? '#000' : '#bbb' }}>
                      {formatCurrency(dailyAmount)}
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td style={{ padding: '30px 0', fontWeight: 'bold', fontSize: '20px', color: '#000' }}>ລວມທັງໝົດ</td>
                <td style={{ padding: '30px 0', textAlign: 'right', fontWeight: 'bold', fontSize: '20px', color: '#000' }}>
                  {formatCurrency(totalRevenue)}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <div style={{ textAlign: 'center', padding: '40px 20px', color: '#777', fontSize: '14px' }}>
        ທຸກຕົວເລກແມ່ນລາຍຮັບຈາກ Boost ທີ່ອະນຸມັດແລ້ວ
      </div>
    </main>
  );
}
