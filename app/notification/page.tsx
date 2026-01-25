'use client'
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { EmptyState } from '@/components/EmptyState';

export default function NotificationPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async (userId: string) => {
    setLoading(true);
    try {
      // ดึงข้อมูลจาก View: ตรวจสอบให้แน่ใจว่าได้รัน SQL สร้าง View แล้ว
      const { data, error } = await supabase
        .from('all_notifications')
        .select('id, post_id, created_at, type, username, avatar_url, car_data')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase Error:', error);
        throw error;
      }

      if (data) {
        const formatted = data.map(item => ({
          id: item.id,
          type: item.type,
          post_id: item.post_id,
          created_at: item.created_at,
          sender_name: item.username || 'User',
          sender_avatar: item.avatar_url,
          // ป้องกัน Error กรณี car_data เป็น null
          post_caption: item.car_data?.caption || '',
          post_images: item.car_data?.images || []
        }));
        setNotifications(formatted);
      }
    } catch (err) {
      console.error('Fetch Error:', err);
      // หากเกิด Error ให้เซตเป็นอาเรย์ว่างเพื่อหยุด Loading
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          fetchNotifications(session.user.id);
        } else {
          setLoading(false);
        }
      } catch (err) {
        setLoading(false);
      }
    };
    checkSession();
  }, [fetchNotifications]);

  return (
    <main style={{ maxWidth: '600px', margin: '0 auto', background: '#fff', minHeight: '100vh' }}>
      <div style={{ padding: '15px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <button 
          onClick={() => router.back()} 
          style={{ 
            background: 'none', 
            border: 'none', 
            cursor: 'pointer', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '8px', 
            touchAction: 'manipulation',
            position: 'absolute',
            left: '15px'
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <h1 style={{ fontSize: '18px', fontWeight: 'bold' }}>ການແຈ້ງເຕືອນ</h1>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <div className="loading-spinner-circle"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>
        </div>
      ) : (
        <div>
          {notifications.map((notif) => (
            <div 
              key={`${notif.id}-${notif.type}`} 
              onClick={() => router.push(`/notification/${notif.post_id}`)}
              style={{ padding: '12px 15px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #f9f9f9', cursor: 'pointer' }}
            >
              {notif.post_images && notif.post_images[0] ? (
                <img src={notif.post_images[0]} style={{ width: '50px', height: '50px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }} alt="post preview" />
              ) : (
                <div style={{ width: '50px', height: '50px', borderRadius: '6px', background: '#f0f0f0', flexShrink: 0 }} />
              )}

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', color: '#1c1e21' }}>
                  <strong>{notif.sender_name}</strong> 
                  {notif.type === 'like' ? ' ມັກໂພສຂອງທ່ານ' : 
                   notif.type === 'save' ? ' ບັນທຶກໂພສຂອງທ່ານ' : 
                   notif.type === 'share' ? ' ແຊຣ໌ໂພສຂອງທ່ານ' : ' ມີສ່ວນຮ່ວມກັບໂພສ'}
                  {notif.post_caption && `: ${notif.post_caption.substring(0, 30)}...`}
                </div>
                <div style={{ fontSize: '12px', color: '#8e9194', marginTop: '2px' }}>
                  {new Date(notif.created_at).toLocaleString('lo-LA')}
                </div>
              </div>
            </div>
          ))}
          {!loading && notifications.length === 0 && (
            <EmptyState message="ບໍ່ມີການແຈ້ງເຕືອນ" variant="minimal" />
          )}
        </div>
      )}
    </main>
  );
}
