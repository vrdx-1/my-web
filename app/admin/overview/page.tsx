'use client'

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';

// รายชื่อแขวงลาว (สำหรับ Mapping ข้อมูล)
const LAO_PROVINCES = [
  "ຜົ້ງສາລີ", "ຫຼວງນ້ຳທາ", "ອຸດົມໄຊ", "ບໍ່ແກ້ວ", "ຫຼວງພະບາງ", 
  "ຫົວພັນ", "ໄຊຍະບູລີ", "ຊຽງຂວາງ", "ໄຊສົມບູນ", "ວຽງຈັນ", 
  "ນະຄອນຫຼວງວຽງຈັນ", "ບໍລິຄຳໄຊ", "ຄຳມ່ວນ", "ສະຫວັນນະເຂດ", 
  "ສາລະວັນ", "ເຊກອງ", "ຈຳປາສັກ", "ອັດຕະປື"
];

export default function AdminOverviewPage() {
  const [filter, setFilter] = useState<'D' | 'W' | 'M' | 'Y' | 'A'>('A');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    allReports: 0,
    webVisits: 0,
    highestPost: '',
    highestSold: '',
    topSeller: { name: '', count: 0, avatar: '' },
    topPost: { name: '', count: 0, avatar: '' },
    revenue: 0
  });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    fetchAllData();
  }, [filter]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      let startDate: string | null = null;

      if (filter === 'D') startDate = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      else if (filter === 'W') startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      else if (filter === 'M') startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      else if (filter === 'Y') startDate = new Date(now.getFullYear(), 0, 1).toISOString();

      // --- 1. All Reports ---
      let reportQuery = supabase.from('reports').select('*', { count: 'exact', head: true });
      if (startDate) reportQuery = reportQuery.gt('created_at', startDate);
      const { count: reportCount } = await reportQuery;

      // --- 2. Web Visits ---
      let visitQuery = supabase.from('visitor_logs').select('*', { count: 'exact', head: true });
      if (startDate) visitQuery = visitQuery.gt('created_at', startDate);
      const { count: visitCount } = await visitQuery;

      // --- 3. Cars Data (For Highest Post, Sold, Top Seller/Poster) ---
      let carsQuery = supabase.from('cars').select(`
        province, status, user_id, is_guest,
        profiles:user_id (username, avatar_url)
      `);
      if (startDate) carsQuery = carsQuery.gt('created_at', startDate);
      const { data: carsData } = await carsQuery;

      // --- 4. Revenue ---
      let revenueQuery = supabase.from('revenue_logs').select('amount');
      if (startDate) revenueQuery = revenueQuery.gt('created_at', startDate);
      const { data: revenueData } = await revenueQuery;

      const provinceStats: any = {};
      const soldStats: any = {};
      const userPostCount: any = {};
      const userSoldCount: any = {};

      carsData?.forEach(car => {
        provinceStats[car.province] = (provinceStats[car.province] || 0) + 1;
        if (car.status === 'sold') {
          soldStats[car.province] = (soldStats[car.province] || 0) + 1;
        }

        const userId = car.user_id || 'guest';
        const userData = {
          name: car.profiles?.username || 'Guest User',
          avatar: car.profiles?.avatar_url || ''
        };

        userPostCount[userId] = { ...userData, count: (userPostCount[userId]?.count || 0) + 1 };
        if (car.status === 'sold') {
          userSoldCount[userId] = { ...userData, count: (userSoldCount[userId]?.count || 0) + 1 };
        }
      });

      const getTop = (obj: any) => Object.values(obj).sort((a: any, b: any) => b.count - a.count)[0] as any;
      const getTopKey = (obj: any) => Object.entries(obj).sort((a: any, b: any) => (b[1] as number) - (a[1] as number))[0]?.[0] || '-';

      setData({
        allReports: reportCount || 0,
        webVisits: visitCount || 0,
        highestPost: getTopKey(provinceStats),
        highestSold: getTopKey(soldStats),
        topSeller: getTop(userSoldCount) || { name: '-', count: 0, avatar: '' },
        topPost: getTop(userPostCount) || { name: '-', count: 0, avatar: '' },
        revenue: revenueData?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0
      });

    } catch (err) {
      console.error("Dashboard Error:", err);
    } finally {
      setLoading(false);
    }
  };

  // --- Styles จัดเรียงเป็นแนวตั้งตามรูปภาพ ---
  const containerStyle = {
    maxWidth: '600px', // ปรับความกว้างให้พอดีกับแนวตั้ง
    margin: '0 auto',
    background: '#f8f9fa',
    minHeight: '100vh',
    paddingBottom: '50px'
  };

  const stackStyle = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px', // ช่องว่างระหว่างแถวตามรูป
    padding: '0 20px'
  };

  const cardStyle = {
    background: '#fff',
    padding: '16px 24px',
    borderRadius: '12px', // ความโค้งมนตามรูปภาพ
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    border: '1px solid #f0f0f0',
    display: 'flex',
    alignItems: 'center', // จัดวาง Label และ Value ให้อยู่บรรทัดเดียวกัน
    justifyContent: 'space-between'
  };

  const labelStyle = { color: '#1a1a1a', fontSize: '16px', fontWeight: '500' };
  const valueStyle = { fontSize: '18px', fontWeight: 'bold', color: '#1a1a1a' };

  return (
    <main style={containerStyle}>
      
      {/* Header & Filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '30px 20px', position: 'sticky', top: 0, background: '#f8f9fa', zIndex: 10 }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a1a1a' }}>Overview</h1>
        <div style={{ display: 'flex', background: '#eee', padding: '4px', borderRadius: '12px', gap: '4px' }}>
          {(['D', 'W', 'M', 'Y', 'A'] as const).map((t) => (
            <button key={t} onClick={() => setFilter(t)} style={{
              padding: '6px 14px', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold',
              background: filter === t ? '#fff' : 'transparent', color: filter === t ? '#007bff' : '#65676b', boxShadow: filter === t ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
            }}>{t}</button>
          ))}
        </div>
      </div>

      <div style={stackStyle}>
        {/* All Report */}
        <div style={cardStyle}>
          <span style={labelStyle}>All report</span>
          <span style={valueStyle}>{loading ? '...' : `${data.allReports.toLocaleString()} ຄັ້ງ`}</span>
        </div>

        {/* Web visit */}
        <div style={cardStyle}>
          <span style={labelStyle}>Web visit</span>
          <span style={valueStyle}>{loading ? '...' : `${data.webVisits.toLocaleString()} ຄັ້ງ`}</span>
        </div>

        {/* Highest Post */}
        <div style={cardStyle}>
          <span style={labelStyle}>Highest post:</span>
          <span style={valueStyle}>{loading ? '...' : data.highestPost}</span>
        </div>

        {/* Highest Sold */}
        <div style={cardStyle}>
          <span style={labelStyle}>Highest Sold:</span>
          <span style={valueStyle}>{loading ? '...' : data.highestSold}</span>
        </div>

        {/* Top Seller */}
        <div style={cardStyle}>
          <span style={labelStyle}>Top Seller</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#eee', overflow: 'hidden' }}>
              {data.topSeller.avatar && <img src={data.topSeller.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
            <span style={valueStyle}>{loading ? '...' : data.topSeller.name}</span>
            <span style={{ color: '#65676b', fontSize: '14px' }}>{data.topSeller.count} ຄັນ</span>
          </div>
        </div>

        {/* Top Poster */}
        <div style={cardStyle}>
          <span style={labelStyle}>Top poster</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#eee', overflow: 'hidden' }}>
              {data.topPost.avatar && <img src={data.topPost.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
            <span style={valueStyle}>{loading ? '...' : data.topPost.name}</span>
            <span style={{ color: '#65676b', fontSize: '14px' }}>{data.topPost.count} ຄັນ</span>
          </div>
        </div>

        {/* Revenue - เปลี่ยนเป็นสีขาวเหมือนส่วนอื่นตามความต้องการ */}
        <div style={{ ...cardStyle }}>
          <span style={labelStyle}>Revenue</span>
          <span style={{ ...valueStyle, fontSize: '20px' }}>
            {loading ? '...' : `${data.revenue.toLocaleString('de-DE')} ກີບ`}
          </span>
        </div>
      </div>
    </main>
  );
}
