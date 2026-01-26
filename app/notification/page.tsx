'use client'
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { EmptyState } from '@/components/EmptyState';

interface NotificationItem {
  id: string;
  post_id: string;
  type: string;
  created_at: string;
  sender_name: string;
  sender_avatar: string | null;
  post_caption?: string;
  post_images?: string[];
  is_read?: boolean;
  likes?: number;
  saves?: number;
}

// Helper function to format time ago
const formatTimeAgo = (dateString: string): string => {
  const now = new Date();
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'ເມື່ອສັກຄູ່';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} ນາທີທີ່ແລ້ວ`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} ຊົ່ວໂມງທີ່ແລ້ວ`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} ມື້ທີ່ແລ້ວ`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)} ອາທິດທີ່ແລ້ວ`;
  if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} ເດືອນທີ່ແລ້ວ`;
  return `${Math.floor(diffInSeconds / 31536000)} ປີທີ່ແລ້ວ`;
};

// Get notification icon based on type
const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'like':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#1877f2">
          <path d="M7.493 19h1L8 14H4c-1.103 0-2-.897-2-2V6c0-1.103.897-2 2-2h4c1.103 0 2 .897 2 2v8.586l.707.707a1 1 0 0 0 .707.293h4.414c.55 0 1.001-.45 1.001-1s-.451-1-1.001-1H9.414l-1.707-1.707A1 1 0 0 0 7 12V6H4v6h4l-1 7zm12.707-7.707a1 1 0 0 0-1.414 0L16 14.586l-1.793-1.793a1 1 0 0 0-1.414 1.414l2.5 2.5a1 1 0 0 0 1.414 0l4.5-4.5a1 1 0 0 0 0-1.414z"/>
        </svg>
      );
    case 'comment':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#1877f2">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
        </svg>
      );
    case 'share':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#1877f2">
          <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/>
        </svg>
      );
    case 'mention':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#42b72a">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
      );
    default:
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#1877f2">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
      );
  }
};

// Get notification text based on type
const getNotificationText = (notification: NotificationItem): { name: string; action: string } => {
  const name = notification.sender_name || 'ผู้ใช้';
  let action = '';
  switch (notification.type) {
    case 'like':
      action = 'กดถูกใจโพสต์ของคุณ';
      break;
    case 'comment':
      action = 'แสดงความคิดเห็นในโพสต์ของคุณ';
      break;
    case 'share':
      action = 'แชร์โพสต์ของคุณ';
      break;
    case 'mention':
      action = 'กล่าวถึงคุณ';
      break;
    default:
      action = 'มีการอัปเดต';
  }
  return { name, action };
};

// Mini PostCard Image Component
const MiniPostImage = ({ images }: { images: string[] }) => {
  const imageSize = '72px'; // เพิ่มขนาดจาก 48px เป็น 72px
  
  if (!images || images.length === 0) {
    return (
      <div style={{ 
        width: imageSize, 
        height: imageSize, 
        borderRadius: '10px',
        background: '#f0f0f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="#999">
          <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
        </svg>
      </div>
    );
  }

  const firstImage = images[0];

  // Single image
  if (images.length === 1) {
    return (
      <div style={{ 
        position: 'relative',
        width: imageSize, 
        height: imageSize, 
        borderRadius: '10px',
        overflow: 'hidden'
      }}>
        <img 
          src={firstImage} 
          alt="Post"
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'cover'
          }}
          loading="lazy"
        />
      </div>
    );
  }

  // Two images
  if (images.length === 2) {
    return (
      <div style={{ 
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '2px',
        width: imageSize, 
        height: imageSize, 
        borderRadius: '10px',
        overflow: 'hidden'
      }}>
        {images.slice(0, 2).map((img, i) => (
          <div key={i} style={{ position: 'relative', overflow: 'hidden', aspectRatio: '1' }}>
            <img 
              src={img} 
              alt={`Post ${i + 1}`}
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'cover'
              }}
              loading="lazy"
            />
          </div>
        ))}
      </div>
    );
  }

  // Three or more images - Layout: 2 on top, 3 on bottom
  return (
    <div style={{ 
      display: 'grid',
      gridTemplateRows: '1fr 1fr',
      gap: '2px',
      width: imageSize, 
      height: imageSize, 
      borderRadius: '10px',
      overflow: 'hidden'
    }}>
      {/* Top row: 2 images */}
      <div style={{ 
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1px'
      }}>
        {images.slice(0, 2).map((img, i) => (
          <div 
            key={i} 
            style={{ 
              position: 'relative', 
              overflow: 'hidden', 
              aspectRatio: '1',
              borderTopLeftRadius: i === 0 ? '10px' : '0',
              borderTopRightRadius: i === 1 ? '10px' : '0'
            }}
          >
            <img 
              src={img} 
              alt={`Post ${i + 1}`}
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'cover'
              }}
              loading="lazy"
            />
          </div>
        ))}
      </div>
      
      {/* Bottom row: 3 images */}
      <div style={{ 
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '2px'
      }}>
        {images.slice(2, 5).map((img, i) => (
          <div 
            key={i + 2} 
            style={{ 
              position: 'relative', 
              overflow: 'hidden', 
              aspectRatio: '1',
              borderBottomLeftRadius: i === 0 ? '10px' : '0',
              borderBottomRightRadius: i === 2 ? '10px' : '0'
            }}
          >
            <img 
              src={img} 
              alt={`Post ${i + 3}`}
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'cover'
              }}
              loading="lazy"
            />
            {i === 2 && images.length > 5 && (
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0,0,0,0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 'bold',
                borderBottomRightRadius: '10px'
              }}>
                +{images.length - 5}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default function NotificationPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async (userId: string) => {
    setLoading(true);
    try {
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
        const formatted: NotificationItem[] = await Promise.all(
          data.map(async (item) => {
            // ดึงจำนวน likes และ saves
            const [likesResult, savesResult] = await Promise.all([
              supabase.from('post_likes').select('*', { count: 'exact', head: true }).eq('post_id', item.post_id),
              supabase.from('post_saves').select('*', { count: 'exact', head: true }).eq('post_id', item.post_id)
            ]);

            return {
              id: item.id,
              type: item.type,
              post_id: item.post_id,
              created_at: item.created_at,
              sender_name: item.username || 'User',
              sender_avatar: item.avatar_url,
              post_caption: item.car_data?.caption || '',
              post_images: item.car_data?.images || [],
              is_read: false,
              likes: likesResult.count || 0,
              saves: savesResult.count || 0
            };
          })
        );
        
        // กรองให้แสดงเฉพาะโพสที่ไม่ซ้ำกัน (1 โพสแสดงได้ 1 ที่) - เลือก notification ที่ใหม่ที่สุด
        const uniquePosts = new Map<string, NotificationItem>();
        formatted.forEach(notif => {
          const existing = uniquePosts.get(notif.post_id);
          if (!existing || new Date(notif.created_at) > new Date(existing.created_at)) {
            uniquePosts.set(notif.post_id, notif);
          }
        });
        
        setNotifications(Array.from(uniquePosts.values()));
      }
    } catch (err) {
      console.error('Fetch Error:', err);
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

  const handleNotificationClick = (notification: NotificationItem) => {
    router.push(`/notification/${notification.post_id}`);
  };

  return (
    <main style={{ background: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ 
        padding: '15px', 
        borderBottom: '1px solid #f0f0f0', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        position: 'sticky',
        top: 0,
        background: '#fff',
        zIndex: 100,
        flexShrink: 0
      }}>
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
        <h1 style={{ fontSize: '18px', fontWeight: 'bold', textAlign: 'center' }}>ການແຈ້ງເຕືອນ</h1>
      </div>

      {/* Notification List */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh', flex: 1 }}>
          <div className="loading-spinner-circle"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>
        </div>
      ) : notifications.length === 0 ? (
        <div style={{ padding: '40px 20px', display: 'flex', justifyContent: 'center', flex: 1 }}>
          <EmptyState message="ไม่มีการแจ้งเตือน" variant="minimal" />
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {notifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => handleNotificationClick(notification)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                padding: '16px 20px',
                cursor: 'pointer',
                borderBottom: '1px solid #f0f0f0',
                backgroundColor: notification.is_read ? '#fff' : '#e7f3ff',
                transition: 'background-color 0.2s',
                gap: '16px'
              }}
              onMouseEnter={(e) => {
                if (notification.is_read) {
                  e.currentTarget.style.backgroundColor = '#f5f5f5';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = notification.is_read ? '#fff' : '#e7f3ff';
              }}
            >
              {/* Post Image */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <MiniPostImage images={notification.post_images || []} />
              </div>

              {/* Notification Content */}
              <div style={{ flex: 1, minWidth: 0, paddingTop: '4px' }}>
                <div style={{ fontSize: '17px', lineHeight: '1.4', color: '#050505', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '20px', fontWeight: '600', color: '#65676b' }}>
                    {((notification.likes || 0) + (notification.saves || 0))}
                  </span>
                  {/* Like Icon - สีแดง */}
                  <svg 
                    width="22" 
                    height="22" 
                    viewBox="0 0 24 24" 
                    fill="#e0245e" 
                    stroke="#e0245e" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"></path>
                  </svg>
                  {/* Save Icon - สีเหลืองทอง */}
                  <svg 
                    width="22" 
                    height="22" 
                    viewBox="0 0 24 24" 
                    fill="#FFD700" 
                    stroke="#FFD700" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <path d="M6 2h12a2 2 0 0 1 2 2v18l-8-5-8 5V4a2 2 0 0 1 2-2z"></path>
                  </svg>
                </div>
                <div style={{ fontSize: '15px', color: '#65676b', marginTop: '6px' }}>
                  {formatTimeAgo(notification.created_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
