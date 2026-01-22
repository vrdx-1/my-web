'use client'
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

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
      <style>{`
@keyframes fadeColor { 0%, 100% { background: #f0f0f0; } 12.5% { background: #1a1a1a; } 25% { background: #4a4a4a; } 37.5% { background: #6a6a6a; } 50% { background: #8a8a8a; } 62.5% { background: #b0b0b0; } 75% { background: #d0d0d0; } 87.5% { background: #e5e5e5; } }
.loading-spinner-circle { display: inline-block; width: 40px; height: 40px; position: relative; }
.loading-spinner-circle div { position: absolute; width: 8px; height: 8px; border-radius: 50%; top: 0; left: 50%; margin-left: -4px; transform-origin: 4px 20px; background: #f0f0f0; animation: fadeColor 1s linear infinite; }
.loading-spinner-circle div:nth-child(1) { transform: rotate(0deg); animation-delay: 0s; }
.loading-spinner-circle div:nth-child(2) { transform: rotate(45deg); animation-delay: 0.125s; }
.loading-spinner-circle div:nth-child(3) { transform: rotate(90deg); animation-delay: 0.25s; }
.loading-spinner-circle div:nth-child(4) { transform: rotate(135deg); animation-delay: 0.375s; }
.loading-spinner-circle div:nth-child(5) { transform: rotate(180deg); animation-delay: 0.5s; }
.loading-spinner-circle div:nth-child(6) { transform: rotate(225deg); animation-delay: 0.625s; }
.loading-spinner-circle div:nth-child(7) { transform: rotate(270deg); animation-delay: 0.75s; }
.loading-spinner-circle div:nth-child(8) { transform: rotate(315deg); animation-delay: 0.875s; }
`}</style>
      <div style={{ padding: '15px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', marginRight: '15px' }}>←</button>
        <h1 style={{ fontSize: '18px', fontWeight: 'bold' }}>ແຈ້ງເຕືອນ</h1>
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
              <div style={{ width: '50px', height: '50px', borderRadius: '50%', overflow: 'hidden', background: '#f0f0f0', flexShrink: 0 }}>
                <img 
                  src={notif.sender_avatar || 'https://pkvtwuwicjqodkyraune.supabase.co/storage/v1/object/public/car-images/default-avatar.png'} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  alt="avatar"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://pkvtwuwicjqodkyraune.supabase.co/storage/v1/object/public/car-images/default-avatar.png';
                  }}
                />
              </div>

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

              {notif.post_images && notif.post_images[0] && (
                <img src={notif.post_images[0]} style={{ width: '40px', height: '40px', borderRadius: '4px', objectFit: 'cover' }} alt="post preview" />
              )}
            </div>
          ))}
          {!loading && notifications.length === 0 && (
            <div style={{ padding: '50px', textAlign: 'center', color: '#888' }}>ບໍ່ມີການແຈ້ງເຕືອນ</div>
          )}
        </div>
      )}
    </main>
  );
}
