'use client'
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr'; // แก้เป็นตัวนี้

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
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
    { name: 'Overview', path: '/admin/overview' },
    { name: 'Reporting', path: '/admin/reporting' },
    { name: 'Problem reports', path: '/admin/problem-reports' },
    { name: 'Review', path: '/admin/review' },
    { name: 'Review (Edited)', path: '/admin/edited-posts' },
    { name: 'Post', path: '/admin/post' },
    { name: 'Visitor', path: '/admin/visitor' },
    { name: 'Search History', path: '/admin/search-history' },
    { name: 'User activity', path: '/admin/activity' },
    { name: 'Boosting', path: '/admin/boosting' },
    { name: 'Revenue', path: '/admin/revenue' },
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
        flexDirection: 'column'
      }}>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '30px', paddingLeft: '10px' }}>Dashboard</h2>
        
        <nav style={{ flex: 1 }}>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {menuItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <li key={item.path} style={{ marginBottom: '8px' }}>
                  <Link href={item.path} style={{ 
                    textDecoration: 'none', 
                    color: isActive ? '#1877f2' : '#4b4f56', // สีฟ้าถ้าอยู่ที่หน้านั้น
                    background: isActive ? '#e7f3ff' : 'transparent', // พื้นหลังฟ้าอ่อน
                    display: 'block',
                    padding: '12px 15px',
                    borderRadius: '8px',
                    fontWeight: isActive ? 'bold' : '500',
                    transition: '0.2s'
                  }}>
                    {item.name}
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