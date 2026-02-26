'use client'

import { useState, useEffect, useMemo } from 'react';
import { createAdminSupabaseClient } from '@/utils/adminSupabaseClient';
import { LAO_FONT } from '@/utils/constants';
import { LoadingSpinner } from '@/components/LoadingSpinner';

type FirstVisitRow = { created_at: string };

export default function FirstTimeVisitPage() {
  const supabase = createAdminSupabaseClient();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [isMonthOpen, setIsMonthOpen] = useState(false);
  const [isYearOpen, setIsYearOpen] = useState(false);
  const [rows, setRows] = useState<FirstVisitRow[]>([]);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = Array.from({ length: 11 }, (_, i) => new Date().getFullYear() + i);

  const fetchFirstVisits = async () => {
    setLoading(true);
    const startOfYear = new Date(selectedYear, 0, 1).toISOString();
    const endOfYear = new Date(selectedYear, 11, 31, 23, 59, 59).toISOString();

    const { data, error } = await supabase
      .from('visitor_logs')
      .select('created_at')
      .eq('is_first_visit', true)
      .gte('created_at', startOfYear)
      .lte('created_at', endOfYear)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching visitor_logs (first visit):', error);
      setRows([]);
    } else {
      setRows((data || []).map((r: { created_at?: string }) => ({ created_at: r.created_at || '' })));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFirstVisits();
  }, [selectedYear]);

  const dailyForSelectedMonth = useMemo(() => {
    const start = new Date(selectedYear, selectedMonth, 1).getTime();
    const end = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59).getTime();
    const daily: { [day: number]: number } = {};
    rows.forEach((r) => {
      const t = new Date(r.created_at).getTime();
      if (t >= start && t <= end) {
        const day = new Date(r.created_at).getDate();
        daily[day] = (daily[day] || 0) + 1;
      }
    });
    return daily;
  }, [rows, selectedMonth, selectedYear]);

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const totalFirstVisits = Object.values(dailyForSelectedMonth).reduce((a, b) => a + b, 0);

  return (
    <main style={{ maxWidth: '600px', margin: '0 auto', background: '#ffffff', backgroundColor: '#ffffff', minHeight: '100vh', fontFamily: LAO_FONT, paddingBottom: '40px' }}>
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
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '10px 8px', color: '#6b7280', fontWeight: '600' }}>ວັນທີ</th>
                <th style={{ textAlign: 'right', padding: '10px 8px', color: '#6b7280', fontWeight: '600' }}>ຈຳນວນຄົນ (ຄັ້ງທຳອິດ)</th>
              </tr>
            </thead>
            <tbody>
              {daysArray.map(day => {
                const displayDate = `${day.toString().padStart(2, '0')}/${(selectedMonth + 1).toString().padStart(2, '0')}/${selectedYear}`;
                const count = dailyForSelectedMonth[day] || 0;
                return (
                  <tr key={day} style={{ borderBottom: '1px solid #f5f5f5' }}>
                    <td style={{ padding: '18px 0', fontSize: '17px', color: '#444' }}>{displayDate}</td>
                    <td style={{ padding: '18px 0', textAlign: 'right', fontSize: '17px', fontWeight: '500', color: count > 0 ? '#000' : '#bbb' }}>
                      {count.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td style={{ padding: '30px 0', fontWeight: 'bold', fontSize: '20px', color: '#000' }}>ລວມທັງໝົດ</td>
                <td style={{ padding: '30px 0', textAlign: 'right', fontWeight: 'bold', fontSize: '20px', color: '#000' }}>
                  {totalFirstVisits.toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <div style={{ textAlign: 'center', padding: '40px 20px', color: '#777', fontSize: '14px' }}>
        ຕົວເລກສະແດງຈຳນວນຜູ້ເຂົ້າຊົມຄັ້ງທຳອິດໃນແຕ່ລະວັນ (ຈາກ visitor_logs)
      </div>
    </main>
  );
}
