'use client'
import { useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export default function VisitorTracker() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

    const updateLastSeen = async (userId: string) => {
      await supabase
        .from('profiles')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', userId);
    };

    const track = async () => {
      try {
        // เพิ่มเงื่อนไข: หากเป็นหน้า Admin ไม่ต้องทำการบันทึก Log และไม่ต้อง Sync Presence
        if (window.location.pathname.startsWith('/admin')) {
          return;
        }

        // 1. ตรวจสอบหรือสร้าง Visitor ID ในเครื่องลูกค้า
        let vId = localStorage.getItem('visitor_id')
        let isFirstVisit = false; // ตัวแปรสำหรับเช็กว่าเป็นครั้งแรกหรือไม่

        if (!vId) {
          vId = crypto.randomUUID()
          localStorage.setItem('visitor_id', vId)
          isFirstVisit = true; // ถ้าไม่มี ID เดิม แสดงว่าเพิ่งเคยมาครั้งแรก
        }

        // 2. บันทึก Log ลงตาราง visitor_logs (เพิ่มการส่งค่า is_first_visit)
        await supabase.from('visitor_logs').insert({
          visitor_id: vId,
          page_path: window.location.pathname,
          user_agent: navigator.userAgent,
          is_first_visit: isFirstVisit // ส่งค่า true/false ไปที่คอลัมน์ใหม่
        })

        // --- ส่วนที่อัปเกรด: ระบบ Real-time Presence ---
        // ดึงข้อมูล User ปัจจุบัน (ถ้ามี) เพื่อแยกแยะว่าเป็น Registered หรือ Guest
        const { data: { user } } = await supabase.auth.getUser();

        // อัปเดต last_seen ใน profiles เพื่อให้สถานะออนไลน์แสดงบน PostCard (เมื่อล็อกอิน)
        if (user?.id) {
          await updateLastSeen(user.id);
          // Heartbeat ทุก 2 นาที เพื่อให้สถานะออนไลน์ไม่หลุดระหว่างใช้งาน
          heartbeatInterval = setInterval(() => updateLastSeen(user.id), 2 * 60 * 1000);
        }
        
        channel = supabase.channel('active_users', {
          config: { presence: { key: vId } }
        });

        channel
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED' && channel) {
              // ส่งสถานะออนไลน์ไปยัง Presence
              await channel.track({
                online_at: new Date().toISOString(),
                user_id: user?.id || null,
                is_guest: !user
              });
            }
          });
        // -------------------------------------------

      } catch (error) {
        console.error('Error tracking visitor:', error)
      }
    }

    track()

    // Cleanup function: unsubscribe channel และหยุด heartbeat เมื่อ component unmount
    return () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []) // ทำงานครั้งเดียวเมื่อโหลดหน้าเว็บ

  return null
}
