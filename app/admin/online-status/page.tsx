'use client'

import { useState, useEffect } from 'react';
import { createAdminSupabaseClient } from '@/utils/adminSupabaseClient';
import { getOnlineStatus } from '@/utils/postUtils';

type ProfileRow = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  last_seen: string | null;
};

export default function AdminOnlineStatusPage() {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);

  const supabase = createAdminSupabaseClient();

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, last_seen')
        .order('username', { ascending: true, nullsFirst: false });

      if (error) throw error;
      setProfiles((data as ProfileRow[]) || []);
    } catch (err) {
      console.error('Fetch profiles error:', err);
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  const sortByLastSeenDesc = (a: ProfileRow, b: ProfileRow) =>
    new Date(b.last_seen || 0).getTime() - new Date(a.last_seen || 0).getTime();

  const onlineUsers = profiles
    .filter((p) => getOnlineStatus(p.last_seen).isOnline)
    .sort(sortByLastSeenDesc);
  const offlineUsers = profiles
    .filter((p) => !getOnlineStatus(p.last_seen).isOnline)
    .sort(sortByLastSeenDesc);

  const listItemStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    background: '#fff',
    borderRadius: '8px',
    marginBottom: '8px',
    border: '1px solid #eee',
  };

  const avatarStyle = {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    objectFit: 'cover' as const,
    background: '#e4e6eb',
  };

  const headerStyle = {
    fontSize: '18px',
    fontWeight: 'bold' as const,
    color: '#1a1a1a',
    marginBottom: '15px',
    paddingBottom: '8px',
    borderBottom: '2px solid #1877f2',
  };

  const totalUsers = onlineUsers.length + offlineUsers.length;

  return (
    <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '0' }}>
      <div style={{ marginBottom: '24px' }}>
        <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a1a1a' }}>
          All User {totalUsers} ຄົນ
        </span>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#65676b' }}>Loading...</div>
      ) : (
        <>
          {/* Header สองฝั่ง Online | Offline พร้อมจำนวนคน */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '24px',
              marginBottom: '16px',
            }}
          >
            <div style={{ ...headerStyle, color: '#1a7f37' }}>
              Online {onlineUsers.length} ຄົນ
            </div>
            <div style={{ ...headerStyle, color: '#c41e3a' }}>
              Offline {offlineUsers.length} ຄົນ
            </div>
          </div>

          {/* สองคอลัมน์: รายชื่อออนไลน์ | รายชื่อออฟไลน์ + ออนไลน์ล่าสุด */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '24px',
              alignItems: 'start',
            }}
          >
            {/* ฝั่ง Online */}
            <div style={{ minHeight: '120px' }}>
              {onlineUsers.length === 0 ? (
                <div style={{ color: '#65676b', padding: '12px 0' }}>No users online</div>
              ) : (
                onlineUsers.map((u) => (
                  <div key={u.id} style={listItemStyle}>
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" style={avatarStyle} />
                    ) : (
                      <div style={{ ...avatarStyle, background: '#e4e6eb' }} />
                    )}
                    <span style={{ fontWeight: '500', color: '#1a1a1a' }}>
                      {u.username || 'User'}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* ฝั่ง Offline + แจ้งออนไลน์ล่าสุด */}
            <div style={{ minHeight: '120px' }}>
              {offlineUsers.length === 0 ? (
                <div style={{ color: '#65676b', padding: '12px 0' }}>No offline users</div>
              ) : (
                offlineUsers.map((u) => {
                  const status = getOnlineStatus(u.last_seen);
                  return (
                    <div key={u.id} style={listItemStyle}>
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" style={avatarStyle} />
                      ) : (
                        <div style={{ ...avatarStyle, background: '#e4e6eb' }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '500', color: '#1a1a1a' }}>
                          {u.username || 'User'}
                        </div>
                        {status.text ? (
                          <div style={{ fontSize: '13px', color: '#1a7f37', marginTop: '2px' }}>
                            {status.text}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
