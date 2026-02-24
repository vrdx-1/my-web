'use client';

import { useState, useEffect } from 'react';
import { createAdminSupabaseClient } from '@/utils/adminSupabaseClient';
import { LAYOUT_CONSTANTS } from '@/utils/layoutConstants';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { LAO_FONT } from '@/utils/constants';

type ProfileRow = {
  id: string;
  username: string | null;
  avatar_url: string | null;
};

type DeviceInfo = {
  deviceName: string | null;
};

/** แปลง user_agent เป็นชื่อรุ่นเครื่อง เช่น iPhone 11, iPad, Samsung */
function parseDeviceName(userAgent: string | null): string | null {
  if (!userAgent || typeof userAgent !== 'string') return null;
  const ua = userAgent;
  const iphoneModel = ua.match(/\biPhone\s*(\d+)\b/i);
  if (iphoneModel) return `iPhone ${iphoneModel[1]}`;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) {
    const modelMatch = ua.match(/Android[^;]*;\s*([^)]+)\)/);
    if (modelMatch) {
      const model = modelMatch[1].trim();
      if (/Samsung|SM-|Galaxy/i.test(model)) return 'Samsung';
      if (/Pixel/i.test(model)) return 'Pixel';
      if (/OPPO|Reno|A\d+/i.test(model)) return 'OPPO';
      if (/vivo|V\d+/i.test(model)) return 'Vivo';
      if (/Xiaomi|Redmi|POCO/i.test(model)) return 'Xiaomi';
      if (/Huawei|Honor/i.test(model)) return 'Huawei';
      return model.length > 25 ? 'Android' : model;
    }
    return 'Android';
  }
  if (/Mac OS X/.test(ua) && !/iPhone|iPad/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  return null;
}

export default function AdminUserDevicePage() {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [deviceByUserId, setDeviceByUserId] = useState<Record<string, DeviceInfo>>({});

  const supabase = createAdminSupabaseClient();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .order('username', { ascending: true, nullsFirst: false });

      if (profilesError) throw profilesError;
      setProfiles((profilesData as ProfileRow[]) || []);

      // 1) ดึง user_sessions ที่มี user_id → ได้ user_id กับ visitor_id (ล่าสุดต่อ user)
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('user_sessions')
        .select('user_id, visitor_id, started_at')
        .not('user_id', 'is', null)
        .order('started_at', { ascending: false });

      if (sessionsError) throw sessionsError;

      const latestVisitorByUser: Record<string, string> = {};
      const allVisitorIds = new Set<string>();
      (sessionsData || []).forEach(
        (row: { user_id: string; visitor_id: string }) => {
          const uid = String(row.user_id ?? '').trim();
          const vid = String(row.visitor_id ?? '').trim();
          if (uid && vid && !latestVisitorByUser[uid]) {
            latestVisitorByUser[uid] = vid;
            allVisitorIds.add(vid);
          }
        }
      );

      // 2) ดึงจาก visitor_logs เอา user_agent มาแปลงเป็นรุ่นเครื่อง (Device)
      const visitorToAgent: Record<string, string | null> = {};
      const visitorIdsArray = Array.from(allVisitorIds);

      if (visitorIdsArray.length > 0) {
        const BATCH = 100;
        for (let i = 0; i < visitorIdsArray.length; i += BATCH) {
          const batch = visitorIdsArray.slice(i, i + BATCH);
          const { data: logsData, error: logsError } = await supabase
            .from('visitor_logs')
            .select('visitor_id, user_agent, created_at')
            .in('visitor_id', batch)
            .order('created_at', { ascending: false });

          if (!logsError && logsData && Array.isArray(logsData)) {
            (logsData as { visitor_id: string; user_agent: string | null }[]).forEach(
              (row) => {
                const vid = String(row.visitor_id ?? '').trim();
                if (vid && visitorToAgent[vid] === undefined) {
                  visitorToAgent[vid] = row.user_agent != null ? String(row.user_agent) : null;
                }
              }
            );
          }
        }
      }

      if (Object.keys(visitorToAgent).length === 0 && visitorIdsArray.length > 0) {
        const { data: fallbackLogs, error: fallbackErr } = await supabase
          .from('visitor_logs')
          .select('visitor_id, user_agent, created_at')
          .order('created_at', { ascending: false })
          .limit(3000);

        if (!fallbackErr && fallbackLogs && Array.isArray(fallbackLogs)) {
          const vidSet = new Set(visitorIdsArray.map((id) => String(id).trim()));
          (fallbackLogs as { visitor_id: string; user_agent: string | null }[]).forEach(
            (row) => {
              const vid = String(row.visitor_id ?? '').trim();
              if (vid && vidSet.has(vid) && visitorToAgent[vid] === undefined) {
                visitorToAgent[vid] = row.user_agent != null ? String(row.user_agent) : null;
              }
            }
          );
        }
      }

      const deviceMap: Record<string, DeviceInfo> = {};
      Object.entries(latestVisitorByUser).forEach(([userId, visitorId]) => {
        const uid = String(userId).trim();
        const vid = String(visitorId).trim();
        const userAgent = visitorToAgent[vid] ?? visitorToAgent[visitorId] ?? null;
        const deviceName = parseDeviceName(userAgent);
        deviceMap[uid] = { deviceName };
      });
      setDeviceByUserId(deviceMap);
    } catch (err) {
      console.error('Fetch user device error:', err);
      setProfiles([]);
      setDeviceByUserId({});
    } finally {
      setLoading(false);
    }
  };

  const avatarStyle = {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    objectFit: 'cover' as const,
    background: '#e4e6eb',
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <main style={{ ...LAYOUT_CONSTANTS.ADMIN_CONTAINER, fontFamily: LAO_FONT }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a1a1a', marginBottom: '20px' }}>
        User Device
      </h1>
      <div
        style={{
          background: '#fff',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          overflow: 'hidden',
          maxHeight: 'calc(100vh - 160px)',
          overflowY: 'auto',
        }}
      >
        <div style={{ padding: '16px 20px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', minWidth: '400px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '10px 8px', color: '#6b7280', fontWeight: '600', width: '50px' }}>ລຳດັບ</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', color: '#6b7280', fontWeight: '600', width: '80px' }}>ໂປຣຟາຍ</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', color: '#6b7280', fontWeight: '600' }}>ຜູ້ໃຊ້</th>
                <th style={{ textAlign: 'left', padding: '10px 8px', color: '#6b7280', fontWeight: '600', minWidth: '120px' }}>Device</th>
              </tr>
            </thead>
            <tbody>
              {profiles.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '24px', color: '#6b7280', textAlign: 'center' }}>
                    ບໍ່ມີຂໍ້ມູນຜູ້ໃຊ້
                  </td>
                </tr>
              ) : (
                profiles.map((p, index) => {
                  const uid = String(p.id).trim();
                  const device = deviceByUserId[uid] ?? deviceByUserId[p.id];
                  const deviceName = device?.deviceName ?? '—';
                  const displayName = p.username?.trim() || p.id.slice(0, 8) + '…';
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '12px 8px', color: '#374151', verticalAlign: 'middle' }}>
                        {index + 1}
                      </td>
                      <td style={{ padding: '12px 8px', verticalAlign: 'middle' }}>
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt="" style={avatarStyle} />
                        ) : (
                          <div style={avatarStyle} />
                        )}
                      </td>
                      <td style={{ padding: '12px 8px', color: '#1a1a1a', fontWeight: '500', verticalAlign: 'middle' }}>
                        {displayName}
                      </td>
                      <td style={{ padding: '12px 8px', color: '#374151', fontSize: '14px', verticalAlign: 'middle' }}>
                        {deviceName}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
