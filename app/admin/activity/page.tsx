'use client'
import { useState, useEffect } from 'react';
import { createAdminSupabaseClient } from '@/utils/adminSupabaseClient';
import { StatCard } from '@/components/admin/StatCard';

export default function AdminActivityPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    online: 0,
    offline: 0,
    registered: 0,
    guestSeller: 0,
    guestPost: 0
  });

  const supabase = createAdminSupabaseClient();

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


  return (
    <main style={containerStyle}>
      <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px', textAlign: 'center' }}>Activity Real-time</h2>

      {/* Online */}
      <StatCard
        label="Online"
        value={stats.online.toLocaleString()}
        loading={loading}
      />

      {/* Offline */}
      <StatCard
        label="Offline"
        value={stats.offline.toLocaleString()}
        loading={loading}
      />

      {/* Registered */}
      <StatCard
        label="Registered"
        value={stats.registered.toLocaleString()}
        loading={loading}
      />

      {/* Guest Seller */}
      <StatCard
        label="Guest Seller"
        value={stats.guestSeller.toLocaleString()}
        loading={loading}
      />

      {/* Guest Post */}
      <StatCard
        label="Guest Post"
        value={stats.guestPost.toLocaleString()}
        loading={loading}
      />
    </main>
  );
}
