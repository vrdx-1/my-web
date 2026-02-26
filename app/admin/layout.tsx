'use client'
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr'; // แก้เป็นตัวนี้

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [updateCounts, setUpdateCounts] = useState<Record<string, number>>({});
  /** จำนวนที่แอดมิน "ดูไปแล้ว" ต่อ path — ใช้ซ่อน badge จนกว่าจะมีรายการใหม่ (เก็บใน localStorage ให้อยู่หลัง refresh) */
  const [lastSeenCounts, setLastSeenCounts] = useState<Record<string, number>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem('admin-sidebar-last-seen');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const res = await fetch('/api/admin/sidebar-counts', { credentials: 'include' });
        if (res.ok) {
          const next = await res.json();
          setUpdateCounts(typeof next === 'object' && next !== null ? next : {});
        }
      } catch {
        // ignore
      }
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 1 * 1000);
    return () => clearInterval(interval);
  }, []);

  // เมื่อแอดมินเข้าดูหน้านั้น → บันทึกจำนวนปัจจุบันเป็น "ดูแล้ว" (วงกลมแดงหายไป)
  useEffect(() => {
    if (!pathname) return;
    const current = updateCounts[pathname] ?? 0;
    if (current >= 0) {
      setLastSeenCounts((prev) => ({
        ...prev,
        [pathname]: Math.max(prev[pathname] ?? 0, current),
      }));
    }
  }, [pathname, updateCounts]);

  // เก็บ lastSeenCounts ลง localStorage เพื่อให้หลัง refresh ยังจำว่าแอดมินดูไปแล้ว
  useEffect(() => {
    try {
      window.localStorage.setItem('admin-sidebar-last-seen', JSON.stringify(lastSeenCounts));
    } catch {
      // ignore
    }
  }, [lastSeenCounts]);

  // สร้าง supabase client
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/admin/login';
  };

  const menuItems = [
    { name: 'Post Report', path: '/admin/reporting' },
    { name: 'Problem Report', path: '/admin/problem-reports' },
    { name: 'Review', path: '/admin/review' },
    { name: 'Review (Edited)', path: '/admin/edited-posts' },
    { name: 'Boosting', path: '/admin/boosting' },
    { name: 'Revenue', path: '/admin/revenue' },
    { name: 'First Time Visit', path: '/admin/first-time-visit' },
    { name: 'All Post', path: '/admin/post' },
    { name: 'Top User', path: '/admin/top-user' },
    { name: 'User Device', path: '/admin/user-device' },
    { name: 'Guest User Device', path: '/admin/guest-user-device' },
    { name: 'Search History', path: '/admin/search-history' },
    { name: 'Online Status', path: '/admin/online-status' },
    { name: 'Top Online', path: '/admin/top-online' },
    { name: 'Visits per Day', path: '/admin/visits-per-day' },
    { name: 'Website Traffic', path: '/admin/website-traffic' },
    { name: 'User Sessions', path: '/admin/user-sessions' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar คงที่อยู่ด้านซ้าย */}
      <aside style={{ 
        width: '250px', 
        background: '#fff', 
        borderRight: '1px solid #ddd', 
        padding: '20px', 
        position: 'fixed', 
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '30px' }}>
          <div style={{
            padding: '10px 20px',
            background: 'linear-gradient(135deg, #374151 0%, #111827 100%)',
            color: '#fff',
            borderRadius: '10px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
            fontSize: '20px',
            fontWeight: 'bold',
          }}>
            Dashboard
          </div>
        </div>
        
        <nav style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {menuItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <li key={item.path} style={{ marginBottom: '4px' }}>
                  <Link href={item.path} style={{ 
                    textDecoration: 'none', 
                    color: isActive ? '#1877f2' : '#4b4f56', // สีฟ้าถ้าอยู่ที่หน้านั้น
                    background: isActive ? '#e7f3ff' : 'transparent', // พื้นหลังฟ้าอ่อน
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontWeight: isActive ? 'bold' : '500',
                    transition: '0.2s'
                  }}>
                    <span>{item.name}</span>
                    {(() => {
                      const total = updateCounts[item.path] ?? 0;
                      const seen = lastSeenCounts[item.path] ?? 0;
                      const unread = total - seen;
                      return unread > 0 ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: '20px',
                          height: '20px',
                          padding: '0 6px',
                          background: '#e0245e',
                          color: '#fff',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          borderRadius: '50%',
                        }}>
                          {unread > 99 ? '99+' : unread}
                        </span>
                      ) : null;
                    })()}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <button onClick={handleLogout} style={{ 
          padding: '10px', color: '#fa3e3e', border: '1px solid #fa3e3e', 
          background: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' 
        }}>
          Log out
        </button>
      </aside>

      {/* พื้นที่แสดงเนื้อหาฝั่งขวา */}
      <main style={{ flex: 1, marginLeft: '250px', padding: '40px', background: '#f8f9fa' }}>
        {children}
      </main>
    </div>
  );
}