'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { TimeFilter } from '@/components/admin/TimeFilter';
import { StatCard } from '@/components/admin/StatCard';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { TabNavigation } from '@/components/TabNavigation';
import { getDateRange, type DateFilterType } from '@/utils/dateFilter';
import { LAO_FONT } from '@/utils/constants';

const MyPostsFeedBlock = dynamic(
  () => import('../../my-posts/MyPostsFeedBlock').then((mod) => ({ default: mod.MyPostsFeedBlock })),
  { ssr: false }
);

type SavePerson = {
  person_key: string;
  person_label: string;
  avatar_url: string | null;
  total_saves: number;
  last_saved_at: string;
};

type SaveLog = {
  id: string;
  created_at: string;
  user_id: string;
  person_key: string;
  person_label: string;
  post_id: string;
  post_code: string;
  caption: string | null;
  images: string[];
  price: number | null;
  price_currency: string | null;
  province: string | null;
  post_owner_id: string | null;
  post_owner_label: string;
  post: any;
};

type SaveStats = {
  totalSaves: number;
  uniqueUsers: number;
  uniquePosts: number;
  avgSavesPerUser: number;
};

function formatDateTime(dateString: string | null) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('th-TH', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminPostSavesPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<DateFilterType>('A');
  const [selectedSaverKey, setSelectedSaverKey] = useState<string>('');
  const [historyTab, setHistoryTab] = useState<'recommend' | 'sold'>('recommend');
  const [activeMenuState, setActiveMenuState] = useState<string | null>(null);
  const [isMenuAnimating, setIsMenuAnimating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [stats, setStats] = useState<SaveStats>({
    totalSaves: 0,
    uniqueUsers: 0,
    uniquePosts: 0,
    avgSavesPerUser: 0,
  });
  const [people, setPeople] = useState<SavePerson[]>([]);
  const [recentLogs, setRecentLogs] = useState<SaveLog[]>([]);
  const menuButtonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');

      try {
        const { startDate, endDate } = getDateRange(filter);
        const search = new URLSearchParams();
        if (startDate) search.set('start', startDate);
        if (endDate) search.set('end', endDate);
        if (selectedSaverKey) search.set('saverKey', selectedSaverKey);

        const response = await fetch(`/api/admin/post-saves?${search.toString()}`, {
          credentials: 'include',
        });

        if (response.status === 401) {
          router.replace('/admin/login');
          return;
        }

        if (response.status === 403) {
          router.replace('/home');
          return;
        }

        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload) {
          throw new Error(payload?.error || 'ไม่สามารถโหลดข้อมูลสถิติการบันทึกโพสต์ได้');
        }

        if (cancelled) return;

        setStats({
          totalSaves: Number(payload?.stats?.totalSaves || 0),
          uniqueUsers: Number(payload?.stats?.uniqueUsers || 0),
          uniquePosts: Number(payload?.stats?.uniquePosts || 0),
          avgSavesPerUser: Number(payload?.stats?.avgSavesPerUser || 0),
        });
        setPeople(Array.isArray(payload?.people) ? payload.people : []);
        setRecentLogs(Array.isArray(payload?.recentLogs) ? payload.recentLogs : []);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลได้');
        setPeople([]);
        setRecentLogs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [filter, selectedSaverKey, router]);

  const topSavers = useMemo(() => people.slice(0, 10), [people]);
  const topSaver = topSavers[0] || null;
  const selectedSaver = useMemo(
    () => people.find((item) => item.person_key === selectedSaverKey) || null,
    [people, selectedSaverKey]
  );

  useEffect(() => {
    if (loading) return;
    if (!selectedSaverKey && topSaver?.person_key) {
      setSelectedSaverKey(topSaver.person_key);
    }
  }, [loading, selectedSaverKey, topSaver?.person_key]);

  const noOp = () => {};

  const selectedUserPosts = useMemo(() => {
    return recentLogs
      .map((item) => {
        const post = item.post;
        if (!post || !post.id) return null;
        return {
          ...post,
          // Keep stable ordering as save history while reusing my-posts feed UI.
          __saved_at: item.created_at,
        };
      })
      .filter((item): item is any => Boolean(item));
  }, [recentLogs]);

  const recommendPosts = useMemo(
    () => selectedUserPosts.filter((post) => String(post.status || 'recommend') === 'recommend'),
    [selectedUserPosts]
  );

  const soldPosts = useMemo(
    () => selectedUserPosts.filter((post) => String(post.status || '') === 'sold'),
    [selectedUserPosts]
  );

  const displayPosts = historyTab === 'recommend' ? recommendPosts : soldPosts;

  return (
    <main
      style={{
        maxWidth: '1500px',
        margin: '0 auto',
        padding: '28px 20px 42px',
        minHeight: '100vh',
        fontFamily: LAO_FONT,
        background:
          'radial-gradient(circle at 8% 10%, rgba(16,185,129,0.14), transparent 34%), radial-gradient(circle at 92% 0%, rgba(59,130,246,0.12), transparent 36%), linear-gradient(180deg, #f8fbff 0%, #f5f8fd 100%)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ maxWidth: 860 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 999, background: 'rgba(16,185,129,0.12)', color: '#0f766e', fontSize: 13, fontWeight: 800, marginBottom: 14 }}>
            Saved Post Intelligence
          </div>
          <h1 style={{ margin: 0, fontSize: 34, lineHeight: '42px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>
            ສະຖິຕິການບັນທຶກໂພສ
          </h1>
          <p style={{ margin: '10px 0 0', color: '#475569', fontSize: 15, lineHeight: '24px' }}>
            แสดงว่าใครบันทึกโพสต์อะไรบ้าง โดยนับเฉพาะ user ปกติเท่านั้น และตัด admin/sub-account ออกจากสถิติทั้งหมด
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <TimeFilter filter={filter} onFilterChange={setFilter} />
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 18, padding: '12px 14px', borderRadius: 14, background: '#fff7ed', border: '1px solid #fdba74', color: '#9a3412', fontWeight: 600 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 18 }}>
        <StatCard label='การบันทึกทั้งหมด' value={stats.totalSaves.toLocaleString()} loading={loading} variant='centered' />
        <StatCard label='ผู้ใช้ที่บันทึกจริง' value={stats.uniqueUsers.toLocaleString()} loading={loading} variant='centered' />
        <StatCard label='โพสต์ที่ถูกบันทึก' value={stats.uniquePosts.toLocaleString()} loading={loading} variant='centered' />
        <StatCard label='เฉลี่ยต่อผู้ใช้' value={loading ? '...' : stats.avgSavesPerUser.toFixed(1)} loading={loading} variant='centered' />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.55fr)', gap: 18, alignItems: 'start' }}>
        <section style={{ background: '#ffffff', borderRadius: 24, border: '1px solid #e5e7eb', boxShadow: '0 18px 48px rgba(15,23,42,0.08)', overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #eef2f7', background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(59,130,246,0.04))' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Top ผู้ใช้ที่บันทึกมากที่สุด</div>
            <div style={{ marginTop: 4, color: '#64748b', fontSize: 13 }}>เรียงตามจำนวนการบันทึกโพสต์</div>
          </div>

          <div style={{ padding: 16 }}>
            {loading ? (
              <div style={{ minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LoadingSpinner />
              </div>
            ) : topSavers.length === 0 ? (
              <div style={{ minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontWeight: 600 }}>
                ຍັງບໍ່ມີຂໍ້ມູນ
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {topSavers.map((person, index) => {
                  const isActive = selectedSaverKey === person.person_key;
                  return (
                  <button
                    key={person.person_key}
                    type='button'
                    onClick={() => setSelectedSaverKey(person.person_key)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '14px 16px',
                      borderRadius: 18,
                      background: isActive
                        ? 'linear-gradient(135deg, rgba(16,185,129,0.16), rgba(59,130,246,0.10))'
                        : (index === 0 ? 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(59,130,246,0.08))' : '#f8fafc'),
                      border: isActive ? '1px solid #14b8a6' : '1px solid #e2e8f0',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ width: 38, height: 38, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: index === 0 ? '#0f766e' : '#e2e8f0', color: index === 0 ? '#fff' : '#334155', fontWeight: 800 }}>
                      {index + 1}
                    </div>

                    <div style={{ width: 42, height: 42, borderRadius: '50%', overflow: 'hidden', background: 'linear-gradient(135deg,#dcfce7,#dbeafe)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#065f46', fontWeight: 800 }}>
                      {person.avatar_url ? (
                        <img src={person.avatar_url} alt='' style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        person.person_label.slice(0, 1).toUpperCase()
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {person.person_label}
                      </div>
                      <div style={{ marginTop: 3, fontSize: 12, color: '#64748b' }}>
                        ล่าสุด {formatDateTime(person.last_saved_at)}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: index === 0 ? '#0f766e' : '#2563eb' }}>{person.total_saves.toLocaleString()}</div>
                      <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>ครั้ง</div>
                    </div>
                  </button>
                )})}
              </div>
            )}
          </div>

          <div style={{ margin: '0 16px 16px', borderRadius: 18, padding: 16, background: 'linear-gradient(135deg, #eff6ff 0%, #ecfeff 100%)', border: '1px solid #bfdbfe' }}>
            <div style={{ fontSize: 13, color: '#1d4ed8', fontWeight: 700, marginBottom: 6 }}>ผู้ใช้ที่บันทึกสูงสุด</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a' }}>{topSaver ? topSaver.person_label : 'ยังไม่มีข้อมูล'}</div>
            <div style={{ marginTop: 8, fontSize: 13, color: '#334155' }}>
              {topSaver ? `${topSaver.total_saves.toLocaleString()} ครั้ง` : '-'}
            </div>
          </div>
        </section>

        <section style={{ background: '#ffffff', borderRadius: 24, border: '1px solid #e5e7eb', boxShadow: '0 18px 48px rgba(15,23,42,0.08)', overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #eef2f7', background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(16,185,129,0.04))' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
              ประวัติการบันทึกของ {selectedSaver?.person_label || '-'}
            </div>
            <div style={{ marginTop: 4, color: '#64748b', fontSize: 13 }}>
              แสดงโพสต์จริงที่ผู้ใช้นี้บันทึกไว้ (กดเลือกผู้ใช้จาก Top ด้านซ้าย)
            </div>
          </div>

          <div style={{ padding: '0 14px', borderBottom: '1px solid #eef2f7', background: '#ffffff' }}>
            <TabNavigation
              className='home-tab-navigation'
              tabs={[
                { value: 'recommend', label: 'ພ້ອມຂາຍ' },
                { value: 'sold', label: 'ຂາຍແລ້ວ' },
              ]}
              activeTab={historyTab}
              onTabChange={(value) => setHistoryTab(value as 'recommend' | 'sold')}
            />
          </div>

          <div style={{ maxHeight: 780, overflow: 'auto', padding: 8 }}>
            {loading ? (
              <div style={{ minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LoadingSpinner />
              </div>
            ) : !selectedSaverKey ? (
              <div style={{ minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontWeight: 600 }}>
                กรุณาเลือกผู้ใช้จาก Top ทางซ้าย
              </div>
            ) : (
              <MyPostsFeedBlock
                showSkeleton={false}
                skeletonCount={3}
                posts={displayPosts}
                session={null}
                savedPosts={{}}
                justSavedPosts={{}}
                activeMenuState={activeMenuState}
                isMenuAnimating={isMenuAnimating}
                menuButtonRefs={menuButtonRefs as React.MutableRefObject<{ [key: string]: HTMLButtonElement | null }>}
                onViewPost={noOp}
                onSave={noOp}
                onShare={noOp}
                onTogglePostStatus={noOp}
                onDeletePost={noOp}
                onReport={noOp}
                onSetActiveMenu={setActiveMenuState}
                onSetMenuAnimating={setIsMenuAnimating}
                loadingMore={false}
                hasMore={false}
                hideBoost={historyTab === 'sold'}
              />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}