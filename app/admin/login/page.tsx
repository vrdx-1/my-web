'use client'
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr'; // เปลี่ยนมาใช้ตัวนี้
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // สร้าง supabase client สำหรับ Browser
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: { session }, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert('ອີເມວ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ');
      setLoading(false);
      return;
    }

    if (session) {
      // ກວດສອບສິດ Admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (profile?.role === 'admin') {
        // ໃຊ້ window.location ເພື່ອໃຫ້ Middleware ເຊັກຄ່າໃໝ່ໄດ້ຊັດເຈນ
        window.location.href = '/admin/dashboard';
      } else {
        await supabase.auth.signOut();
        alert('ທ່ານບໍ່ມີສິດເຂົ້າເຖິງ');
        setLoading(false);
      }
    }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
      <div style={{ background: '#fff', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', width: '350px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '25px', fontWeight: 'bold' }}>Admin Login</h2>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input 
            type="email" placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)} required
            style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ddd', outline: 'none' }}
          />
          <input 
            type="password" placeholder="Password" value={password}
            onChange={(e) => setPassword(e.target.value)} required
            style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ddd', outline: 'none' }}
          />
          <button 
            type="submit" disabled={loading}
            style={{ padding: '12px', background: '#1877f2', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            {loading ? 'ກຳລັງກວດສອບ...' : 'ເຂົ້າສູ່ລະບົບ Admin'}
          </button>
        </form>
      </div>
    </main>
  );
}
