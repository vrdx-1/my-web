'use client'
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function NotificationPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);

  // ใช้ useCallback เพื่อความเสถียรของฟังก์ชัน
  const fetchNotifications = useCallback(async (userId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          cars:post_id (
            id,
            caption,
            images,
            likes,
            saves,
            shares,
            post_boosts (status, expires_at)
          ),
          profiles:owner_id (avatar_url)
        `)
        .eq('owner_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setNotifications(data);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 1. เช็ค Session ทันทีที่โหลด
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchNotifications(session.user.id);
      } else {
        // ถ้าไม่มี session ให้หยุดโหลด เพื่อโชว์ข้อความ "ไม่มีการแจ้งเตือน"
        setLoading(false);
      }
    });

    // 2. ฟังการเปลี่ยนแปลงสถานะ (สำคัญมากตอน Login/Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchNotifications(session.user.id);
      } else {
        setNotifications([]);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchNotifications]);

  const getBoostStatus = (post: any) => {
    if (!post || !post.post_boosts || post.post_boosts.length === 0) return null;
    
    const boost = post.post_boosts[0];
    const now = new Date();
    const expire = new Date(boost.expires_at);
    const diffInMs = expire.getTime() - now.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);

    if (boost.status === 'pending') return 'Boost ກຳລັງລໍຖ້າການອະນຸມັດ';
    if (boost.status === 'rejected') return 'Boost ຖືກປະຕິເສດ';
    if (diffInMs <= 0) return 'Boost ໝົດອາຍຸ';
    if (diffInHours > 0 && diffInHours <= 3) return 'Boost ຈະຫມົດອາຍຸພາຍໃນ 3 ຊົ່ວໂມງ';
    if (boost.status === 'approved') return 'Boost ໄດ້ຮັບການອະນຸມັດ';
    
    return null;
  };

  return (
    <main style={{ maxWidth: '600px', margin: '0 auto', background: '#fff', minHeight: '100vh' }}>
      <div style={{ padding: '15px', display: 'flex', alignItems: 'center', borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', marginRight: '15px' }}>←</button>
        <h1 style={{ fontSize: '18px', fontWeight: 'bold' }}>ແຈ້ງເຕືອນ</h1>
      </div>

      {!session && !loading ? (
        <div style={{ padding: '50px 20px', textAlign: 'center' }}>
          <p style={{ color: '#65676b' }}>ກະລຸນາເຂົ້າສູ່ລະບົບເພື່ອເບິ່ງການແຈ້ງເຕືອນ</p>
          <button 
            onClick={() => router.push('/profile')}
            style={{ marginTop: '10px', padding: '8px 20px', background: '#1877f2', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            ໄປທີ່ໜ້າໂປຣໄຟລ໌
          </button>
        </div>
      ) : loading ? (
        <div style={{ padding: '20px', textAlign: 'center' }}>ກຳລັງໂຫຼດ...</div>
      ) : (
        <div>
          {notifications.map((notif) => {
            const post = notif.cars;
            const boostMsg = post ? getBoostStatus(post) : null;
            const totalEngagement = (post?.likes || 0) + (post?.saves || 0) + (post?.shares || 0);

            return (
              <div 
                key={notif.id} 
                onClick={() => post && router.push(`/notification/${post.id}`)}
                style={{ padding: '12px 15px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #f9f9f9', cursor: 'pointer' }}
              >
                <div style={{ width: '55px', height: '55px', borderRadius: '10px', overflow: 'hidden', background: '#f0f0f0', flexShrink: 0 }}>
                  <img 
                    src={notif.profiles?.avatar_url || 'https://pkvtwuwicjqodkyraune.supabase.co/storage/v1/object/public/car-images/default-avatar.png'} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    onError={(e: any) => e.target.src = 'https://via.placeholder.com/100'}
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', color: '#1c1e21', marginBottom: '4px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {post?.caption || 'ໂພສຂອງທ່ານມີການເຄື່ອນໄຫວ'}
                  </div>
                  
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#65676b', fontWeight: 'bold' }}>
                       📊 {totalEngagement.toLocaleString()} ຄົນມີສ່ວນຮ່ວມ
                    </span>
                    {boostMsg && (
                      <span style={{ fontSize: '11px', color: '#1877f2', background: '#e7f3ff', padding: '2px 6px', borderRadius: '4px', fontWeight: '500' }}>
                        {boostMsg}
                      </span>
                    )}
                  </div>
                </div>

                {post?.images?.[0] && (
                  <div style={{ width: '45px', height: '45px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0 }}>
                    <img src={post.images[0]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
              </div>
            );
          })}
          
          {notifications.length === 0 && (
            <div style={{ padding: '50px 20px', textAlign: 'center', color: '#65676b' }}>ບໍ່ມີການແຈ້ງເຕືອນໃນເວລານີ້</div>
          )}
        </div>
      )}
    </main>
  );
}