'use client'
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/utils/currency';
import { LAO_FONT } from '@/utils/constants';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export default function RevenuePage() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth()); // 0-11
  const [selectedYear, setSelectedYear] = useState(2026);
  const [revenueData, setRevenueData] = useState<{ [key: string]: number }>({});
  const [loading, setLoading] = useState(true);
  const [isMonthOpen, setIsMonthOpen] = useState(false);
  const [isYearOpen, setIsYearOpen] = useState(false);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = Array.from({ length: 11 }, (_, i) => 2026 + i);

  // ฟังก์ชันดึงข้อมูลรายได้ (แก้ไขจุดนี้ให้ดึงจากตาราง revenue_logs)
  const fetchRevenue = async () => {
    setLoading(true);
    const startDate = new Date(selectedYear, selectedMonth, 1).toISOString();
    const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59).toISOString();

    const { data, error } = await supabase
      .from('revenue_logs') // เปลี่ยนเป็นตารางใหม่
      .select('amount, created_at') // เปลี่ยนจาก price เป็น amount
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (error) {
      console.error('Error fetching revenue:', error);
    } else {
      const dailySum: { [key: string]: number } = {};
      data?.forEach(item => {
        const dateKey = new Date(item.created_at).getDate();
        dailySum[dateKey] = (dailySum[dateKey] || 0) + (item.amount || 0); // เปลี่ยนจาก price เป็น amount
      });
      setRevenueData(dailySum);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRevenue();
  }, [selectedMonth, selectedYear]);

  // Removed duplicate formatCurrency - using from utils/currency.ts

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const totalRevenue = Object.values(revenueData).reduce((a, b) => a + b, 0);

  return (
    <main style={{ maxWidth: '600px', margin: '0 auto', background: '#ffffff', backgroundColor: '#ffffff', minHeight: '100vh', fontFamily: LAO_FONT, paddingBottom: '40px' }}>
      
      {/* Header Selector Section */}
      <div style={{ padding: '20px', display: 'flex', justifyContent: 'center', gap: '30px', borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, background: '#ffffff', backgroundColor: '#ffffff', zIndex: 10 }}>
        
        {/* Month Dropdown */}
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

        {/* Year Dropdown */}
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

      {/* Revenue Table */}
      <div style={{ padding: '0 20px' }}>
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
              
              {/* Total Row */}
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

      <div style={{ textAlign: 'center', padding: '40px 20px', color: '#5c5c5c', fontSize: '13px', letterSpacing: '0.5px' }}>
        REVENUE REPORT • APPROVED POSTS ONLY
      </div>
    </main>
  );
}