'use client'
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function AdminActivityPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    online: 0,
    offline: 0,
    registered: 0,
    guestSeller: 0,
    guestPost: 0
  });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    fetchStaticStats();
    setupRealtimePresence();
  }, []);

  // 1. ดึงข้อมูลสถิติจากฐานข้อมูล (Registered, Guest Seller, Guest Post)
  const fetchStaticStats = async () => {
    try {
      // นับจำนวนสมาชิกทั้งหมด (Registered)
      const { count: registeredCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .neq('username', 'Guest User');

      // นับจำนวน Guest Post (is_guest = TRUE)
      const { count: guestPostCount } = await supabase
        .from('cars')
        .select('*', { count: 'exact', head: true })
        .eq('is_guest', true);

      // นับจำนวน Guest Seller (Unique guest_token)
      const { data: guestSellers } = await supabase
        .from('cars')
        .select('guest_token')
        .eq('is_guest', true)
        .not('guest_token', 'is', null);
      
      const uniqueGuestSellers = new Set(guestSellers?.map(item => item.guest_token)).size;

      setStats(prev => ({
        ...prev,
        registered: registeredCount || 0,
        guestPost: guestPostCount || 0,
        guestSeller: uniqueGuestSellers
      }));
    } catch (error) {
      console.error("Error fetching static stats:", error);
    }
  };

  // 2. จัดการระบบ Online/Offline แบบ Real-time ด้วย Presence
  const setupRealtimePresence = () => {
    const channel = supabase.channel('active_users');

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        
        // นับจำนวนคนออนไลน์ทั้งหมด
        const onlineCount = Object.keys(state).length;

        // หาจำนวน Registered ที่ออนไลน์อยู่ (ตรวจสอบว่ามี user_id ไหม)
        const onlineRegisteredIds = new Set();
        Object.values(state).forEach((presences: any) => {
          presences.forEach((p: any) => {
            if (p.user_id) onlineRegisteredIds.add(p.user_id);
          });
        });

        setStats(prev => ({
          ...prev,
          online: onlineCount,
          // Offline = จำนวนสมาชิกทั้งหมด - สมาชิกที่กำลังออนไลน์
          offline: Math.max(0, prev.registered - onlineRegisteredIds.size)
        }));
        setLoading(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  // สไตล์การ์ดตามภาพร่าง
  const containerStyle = {
    maxWidth: '600px',
    margin: '40px auto',
    padding: '0 20px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '15px'
  };

  const cardStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 30px',
    background: '#fff',
    borderRadius: '15px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
    border: '1px solid #eee'
  };

  const labelStyle = {
    fontSize: '20px',
    fontWeight: '500',
    color: '#333'
  };

  const valueStyle = {
    fontSize: '22px',
    fontWeight: 'bold',
    color: '#000'
  };

  return (
    <main style={containerStyle}>
      <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px', textAlign: 'center' }}>Activity Real-time</h2>

      {/* Online */}
      <div style={cardStyle}>
        <span style={labelStyle}>Online</span>
        <span style={valueStyle}>{loading ? '...' : stats.online.toLocaleString()}</span>
      </div>

      {/* Offline */}
      <div style={cardStyle}>
        <span style={labelStyle}>Offline</span>
        <span style={valueStyle}>{loading ? '...' : stats.offline.toLocaleString()}</span>
      </div>

      {/* Registered */}
      <div style={cardStyle}>
        <span style={labelStyle}>Registered</span>
        <span style={valueStyle}>{loading ? '...' : stats.registered.toLocaleString()}</span>
      </div>

      {/* Guest Seller */}
      <div style={cardStyle}>
        <span style={labelStyle}>Guest Seller</span>
        <span style={valueStyle}>{loading ? '...' : stats.guestSeller.toLocaleString()}</span>
      </div>

      {/* Guest Post */}
      <div style={cardStyle}>
        <span style={labelStyle}>Guest Post</span>
        <span style={valueStyle}>{loading ? '...' : stats.guestPost.toLocaleString()}</span>
      </div>
    </main>
  );
}
