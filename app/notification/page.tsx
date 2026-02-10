'use client'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { EmptyState } from '@/components/EmptyState';
import { LAO_FONT } from '@/utils/constants';
import { PageSpinner } from '@/components/LoadingSpinner';
import { NotificationPostPreviewCard } from '../../components/NotificationPostPreviewCard';
import { fetchNotificationFeed } from '@/utils/notificationFeed';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { PAGE_SIZE, PREFETCH_COUNT } from '@/utils/constants';
import { sequentialIncreaseCount } from '@/utils/preloadSequential';

export interface NotificationItem {
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
  notification_count?: number;
  interaction_avatars?: (string | null)[];
  interaction_total?: number;
  boost_status?: 'pending' | 'reject' | 'success' | string | null;
  boost_expires_at?: string | null;
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

// Get notification text based on type (เฉพาะ like ใช้งาน)
const getNotificationText = (notification: NotificationItem): { name: string; action: string } => {
  const name = notification.sender_name || 'ຜູ້ໃຊ້';
  let action = '';
  switch (notification.type) {
    case 'like':
      action = 'ກົດຖືກໃຈໂພສຂອງທ່ານ';
      break;
    default:
      action = 'ການແຈ້ງເຕືອນ';
  }
  return { name, action };
};

// Mini PostCard Image Component - Layout เหมือน PhotoGrid แต่ขนาดเล็ก
export default function NotificationPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  // เก็บข้อมูลว่า user ดูแจ้งเตือนของ post ไหน "ถึงเวลาไหนแล้ว"
  // key = post_id, value = created_at ล่าสุดที่ผู้ใช้เปิดดู
  const [clearedPostMap, setClearedPostMap] = useState<Record<string, string>>({});
  // โหลดข้อมูลจากเครื่องเสร็จแล้วจึงค่อยโหลดรายการ (เลี่ยง race)
  const [clearedMapReady, setClearedMapReady] = useState(false);
  const clearedPostMapRef = useRef<Record<string, string>>({});

  // --- Lazy load notification list: ใช้ pattern เดียวกับ feed หน้า Home ---
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);
  const [localLoadingMore, setLocalLoadingMore] = useState<boolean>(false);

  // รีเซ็ตจำนวนที่แสดงเมื่อชุด notification เปลี่ยน (fetch ใหม่)
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [notifications.length]);

  const hasMore = useMemo(
    () => visibleCount < notifications.length,
    [visibleCount, notifications.length]
  );

  const { lastElementRef } = useInfiniteScroll({
    loadingMore: localLoadingMore,
    hasMore,
    onLoadMore: () => {
      if (localLoadingMore) return;
      if (!hasMore) return;
      setLocalLoadingMore(true);
      sequentialIncreaseCount({
        maxSteps: PREFETCH_COUNT,
        setValue: setVisibleCount,
        getLimit: () => notifications.length,
        onDone: () => {
          setLocalLoadingMore(false);
        },
      });
    },
    threshold: 0.2,
  });

  const visibleNotifications = useMemo(
    () => notifications.slice(0, visibleCount),
    [notifications, visibleCount]
  );

  // อัปเดต ref ให้ตรงกับ state เสมอ (ให้ fetch อ่านค่าล่าสุดได้โดยไม่ต้อง refetch เมื่อกดดู)
  useEffect(() => {
    clearedPostMapRef.current = clearedPostMap;
  }, [clearedPostMap]);

  // โหลดโพสต์ที่เคยถูกเคลียร์จาก localStorage ก่อน แล้วค่อยให้โหลดรายการ
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem('notification_cleared_posts');
    try {
      if (!raw) {
        setClearedMapReady(true);
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const now = new Date().toISOString();
        const obj: Record<string, string> = {};
        (parsed as string[]).forEach((id) => {
          obj[id] = now;
        });
        setClearedPostMap(obj);
      } else if (parsed && typeof parsed === 'object') {
        setClearedPostMap(parsed as Record<string, string>);
      }
      setClearedMapReady(true);
    } catch {
      setClearedMapReady(true);
    }
  }, []);

  const fetchNotifications = useCallback(async (userId: string) => {
    setLoading(true);
    const clearedMap = clearedPostMapRef.current;
    try {
      const { list, rawFeed } = await fetchNotificationFeed(userId, clearedMap);
      try {
        if (rawFeed.length > 0) {
          await supabase
            .from('notification_reads')
            .upsert(
              rawFeed.map((n: any) => ({
                user_id: userId,
                notification_id: n.id,
              })),
              { onConflict: 'user_id,notification_id' }
            );
        }
      } catch {
        // ถ้า mark read ล้มเหลว ไม่ต้องกระทบ UI
      }
      setNotifications(list);
    } catch (err) {
      console.error('Fetch Error:', err);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // โหลดรายการเมื่อโหลดข้อมูลจากเครื่องเสร็จแล้ว (ไม่โหลดก่อน จะได้สถานะ "อ่านแล้ว" ตรง)
  useEffect(() => {
    if (!clearedMapReady) return;
    const checkSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          await fetchNotifications(session.user.id);
          // ผู้ใช้เข้า "หน้าแจ้งเตือน" แล้ว ให้ถือว่า bell บนหน้าโฮมถูกเคลียร์ถึงเวลานี้
          if (typeof window !== 'undefined') {
            try {
              window.localStorage.setItem(
                'notification_home_last_opened_at',
                new Date().toISOString()
              );
            } catch {
              // ถ้า localStorage ใช้ไม่ได้ ไม่ต้องกระทบ logic เดิม
            }
          }
        } else {
          setLoading(false);
        }
      } catch {
        setLoading(false);
      }
    };
    checkSession();
  }, [clearedMapReady, fetchNotifications]);

  const handleNotificationClick = useCallback(
    (notification: NotificationItem) => {
      // เมื่อผู้ใช้กดเข้าไปดูโพสต์นี้:
      // 1) บันทึกเวลา created_at ล่าสุดที่ user เห็น เพื่อใช้เป็นเส้นแบ่ง "แจ้งเตือนใหม่"
      const lastSeen = notification.created_at;
      setClearedPostMap((prev) => {
        const next = { ...prev, [notification.post_id]: lastSeen };
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(
            'notification_cleared_posts',
            JSON.stringify(next)
          );
        }
        return next;
      });

      // 2) อัปเดตแถวที่กดเป็น "อ่านแล้ว" ทันที (ไม่โหลดรายการใหม่)
      setNotifications((current) =>
        current.map((n) =>
          n.post_id === notification.post_id
            ? { ...n, notification_count: 0 }
            : n
        )
      );

      router.push(`/notification/${notification.post_id}`);
    },
    [router]
  );

  return (
    <main style={{ background: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: LAO_FONT }}>
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
        zIndex: 1000,
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
        <h1 style={{ fontSize: '18px', fontWeight: 'bold', textAlign: 'center', color: '#111111' }}>ການແຈ້ງເຕືອນ</h1>
      </div>

      {/* Notification List */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh', flex: 1 }}>
          <PageSpinner />
        </div>
      ) : notifications.length === 0 ? (
        <div style={{ padding: '40px 20px', display: 'flex', justifyContent: 'center', flex: 1 }}>
          <EmptyState message="ບໍ່ມີການແຈ້ງເຕືອນ" variant="minimal" />
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {visibleNotifications.map((notification, index) => {
            // ถ้ามีตัวเลขแจ้งเตือน (notification_count > 0) ให้ถือว่ายัง "มีแจ้งเตือนใหม่" → ใช้พื้นหลังแบบยังไม่อ่าน
            const hasNewNotifications =
              typeof notification.notification_count === 'number' &&
              notification.notification_count > 0;
            const isReadStyle = !hasNewNotifications;
            const isLast = index === visibleNotifications.length - 1;
            const card = (
              <NotificationPostPreviewCard
                key={notification.id}
                notification={notification}
                isReadStyle={isReadStyle}
                timeAgoText={formatTimeAgo(notification.created_at)}
                onClick={() => handleNotificationClick(notification)}
              />
            );
            if (isLast) {
              return (
                <div key={notification.id} ref={lastElementRef}>
                  {card}
                </div>
              );
            }
            return card;
          })}
        </div>
      )}
    </main>
  );
}
