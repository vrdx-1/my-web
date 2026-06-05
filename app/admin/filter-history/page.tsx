'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TimeFilter } from '@/components/admin/TimeFilter';
import { StatCard } from '@/components/admin/StatCard';
import { getDateRange, type DateFilterType } from '@/utils/dateFilter';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface FilterLog {
  id: string;
  person_key: string;
  person_label: string;
  person_type: 'guest' | 'user';
  province: string | null;
  min_price_kip: number | null;
  max_price_kip: number | null;
  display_currency: '₭' | '$' | '฿' | null;
  price_sort_order: 'asc' | 'desc' | null;
  created_at: string;
}

interface TopProvince {
  province: string;
  count: number;
}

interface PersonSummary {
  person_key: string;
  person_label: string;
  person_type: 'guest' | 'user';
  total_uses: number;
  last_used_at: string;
}

interface StatsPayload {
  totalFilters: number;
  guestCount: number;
  userCount: number;
  provinceCount: number;
  priceRangeCount: number;
  sortOrderCount: number;
}

function formatKip(value: number | null): string {
  if (value == null) return '-';
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B ₭`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M ₭`;
  return `${value.toLocaleString()} ₭`;
}

function formatPrice(value: number | null, currency: '₭' | '$' | '฿' | null): string {
  if (value == null) return '-';
  const cur = currency ?? '₭';
  if (cur === '₭') {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B ₭`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M ₭`;
    return `${value.toLocaleString()} ₭`;
  }
  // USD: lak ÷ exchange rate approx 20500
  if (cur === '$') return `$${(value / 20500).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  // THB: lak ÷ exchange rate approx 590
  return `฿${(value / 590).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function sortOrderLabel(order: 'asc' | 'desc' | null): string {
  if (order === 'asc') return '⬆ ຖືກສຸດກ່ອນ';
  if (order === 'desc') return '⬇ ແພງສຸດກ່ອນ';
  return '-';
}

function filterBadge(log: FilterLog): string {
  const parts: string[] = [];
  if (log.province) parts.push(`ແຂວງ: ${log.province}`);
  if (log.min_price_kip != null || log.max_price_kip != null) {
    const cur = log.display_currency ?? '₭';
    parts.push(`ລາຄາ (${cur}): ${formatPrice(log.min_price_kip, log.display_currency)} – ${formatPrice(log.max_price_kip, log.display_currency)}`);
  }
  if (log.price_sort_order) parts.push(sortOrderLabel(log.price_sort_order));
  return parts.join(' | ') || '-';
}

export default function AdminFilterHistoryPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<DateFilterType>('A');
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [stats, setStats] = useState<StatsPayload>({
    totalFilters: 0,
    guestCount: 0,
    userCount: 0,
    provinceCount: 0,
    priceRangeCount: 0,
    sortOrderCount: 0,
  });
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [selectedPersonKey, setSelectedPersonKey] = useState('');
  const [topProvinces, setTopProvinces] = useState<TopProvince[]>([]);
  const [recentFilters, setRecentFilters] = useState<FilterLog[]>([]);
  const [showTopProvinces, setShowTopProvinces] = useState(true);

  useEffect(() => {
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, selectedPersonKey]);

  const resetData = () => {
    setStats({ totalFilters: 0, guestCount: 0, userCount: 0, provinceCount: 0, priceRangeCount: 0, sortOrderCount: 0 });
    setPeople([]);
    setTopProvinces([]);
    setRecentFilters([]);
  };

  const fetchData = async () => {
    setLoading(true);
    setFetchError('');
    try {
      const { startDate, endDate } = getDateRange(filter);
      const search = new URLSearchParams();
      if (startDate) search.set('start', startDate);
      if (endDate) search.set('end', endDate);
      if (selectedPersonKey) search.set('personKey', selectedPersonKey);

      const res = await fetch(`/api/admin/filter-history?${search.toString()}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (res.status === 401) { router.replace('/admin/login'); return; }
      if (res.status === 403) { router.replace('/home'); return; }

      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload) {
        resetData();
        setFetchError('ໂຫລດຂໍ້ມູນ Filter History ບໍ່ສຳເລັດ');
        return;
      }

      setStats(payload.stats ?? { totalFilters: 0, guestCount: 0, userCount: 0, provinceCount: 0, priceRangeCount: 0, sortOrderCount: 0 });
      setPeople(Array.isArray(payload.people) ? payload.people : []);
      setTopProvinces(Array.isArray(payload.topProvinces) ? payload.topProvinces : []);
      setRecentFilters(Array.isArray(payload.recentFilters) ? payload.recentFilters : []);
    } catch (err) {
      console.error('Error fetching filter history:', err instanceof Error ? err.message : err);
      resetData();
      setFetchError('ເຊື່ອມຕໍ່ server ບໍ່ໄດ້ ກະລຸນາລອງໃໝ່');
    } finally {
      setLoading(false);
    }
  };

  const selectedPerson = useMemo(
    () => people.find((p) => p.person_key === selectedPersonKey) || null,
    [people, selectedPersonKey],
  );

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('th-TH', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <main
      style={{
        maxWidth: '1400px',
        margin: '32px auto',
        padding: '16px',
        background:
          'radial-gradient(circle at top left, rgba(24,119,242,0.08), transparent 40%), radial-gradient(circle at top right, rgba(13,148,136,0.08), transparent 45%)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', margin: 0 }}>
            ປະຫວັດການໃຊ້ຕົວກອງ (Filter History)
          </h2>
          <p style={{ margin: '6px 0 0', color: '#334155', fontSize: 14 }}>
            ນັບສະເພາະ Guest ແລະ User ທົ່ວໄປ (ບໍ່ລວມ Admin/Sub account)
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <TimeFilter filter={filter} onFilterChange={setFilter} />
          <select
            value={selectedPersonKey}
            onChange={(e) => setSelectedPersonKey(e.target.value)}
            style={{
              height: 40, borderRadius: 10, border: '1px solid #cbd5e1',
              background: '#fff', padding: '0 12px', minWidth: 260, color: '#0f172a', fontWeight: 500,
            }}
          >
            <option value="">ທຸກຄົນ (Guest + User)</option>
            {people.map((p) => (
              <option key={p.person_key} value={p.person_key}>
                {p.person_label} ({p.total_uses.toLocaleString()})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Scope banner */}
      <div style={{ marginBottom: 20, padding: '10px 14px', borderRadius: 12, background: '#ffffffd9', border: '1px solid #e2e8f0', color: '#0f172a', fontSize: 14 }}>
        {selectedPerson ? `ກຳລັງເບິ່ງລາຍບຸກຄົນ: ${selectedPerson.person_label}` : 'ກຳລັງເບິ່ງພາບລວມທັງລະບົບ'}
      </div>

      {fetchError && (
        <div style={{ marginBottom: 20, padding: '10px 14px', borderRadius: 12, background: '#fff7ed', border: '1px solid #fdba74', color: '#9a3412', fontSize: 14, fontWeight: 600 }}>
          {fetchError}
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 26 }}>
        <StatCard label="ການໃຊ້ຕົວກອງທັງໝົດ" value={stats.totalFilters.toLocaleString()} loading={loading} variant="centered" />
        <StatCard label="Guest" value={stats.guestCount.toLocaleString()} loading={loading} variant="centered" />
        <StatCard label="User" value={stats.userCount.toLocaleString()} loading={loading} variant="centered" />
        <StatCard label="ກອງຕາມແຂວງ" value={stats.provinceCount.toLocaleString()} loading={loading} variant="centered" />
        <StatCard label="ກອງຕາມລາຄາ" value={stats.priceRangeCount.toLocaleString()} loading={loading} variant="centered" />
        <StatCard label="ກຳນົດລຳດັບລາຄາ" value={stats.sortOrderCount.toLocaleString()} loading={loading} variant="centered" />
      </div>

      {/* Tab buttons */}
      <div style={{ marginBottom: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          onClick={() => setShowTopProvinces(true)}
          style={{
            padding: '10px 20px',
            background: showTopProvinces ? 'linear-gradient(135deg,#1877f2,#10b981)' : '#e2e8f0',
            color: showTopProvinces ? '#fff' : '#334155',
            border: 'none', borderRadius: 999, cursor: 'pointer', fontWeight: showTopProvinces ? 700 : 500,
          }}
        >
          ແຂວງທີ່ຄົ້ນຫາຫຼາຍສຸດ
        </button>
        <button
          onClick={() => setShowTopProvinces(false)}
          style={{
            padding: '10px 20px',
            background: !showTopProvinces ? 'linear-gradient(135deg,#1877f2,#10b981)' : '#e2e8f0',
            color: !showTopProvinces ? '#fff' : '#334155',
            border: 'none', borderRadius: 999, cursor: 'pointer', fontWeight: !showTopProvinces ? 700 : 500,
          }}
        >
          ປະຫວັດການໃຊ້ຕົວກອງລ່າສຸດ
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <LoadingSpinner />
        </div>
      ) : showTopProvinces ? (
        /* Top provinces table */
        <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 12px 28px rgba(15,23,42,0.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: 12, textAlign: 'left', fontWeight: 'bold', color: '#4b4f56' }}>ລຳດັບ</th>
                <th style={{ padding: 12, textAlign: 'left', fontWeight: 'bold', color: '#4b4f56' }}>ແຂວງ</th>
                <th style={{ padding: 12, textAlign: 'center', fontWeight: 'bold', color: '#4b4f56' }}>ຈຳນວນຄັ້ງ</th>
              </tr>
            </thead>
            <tbody>
              {topProvinces.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ padding: 40, textAlign: 'center', color: '#65676b' }}>ບໍ່ມີຂໍ້ມູນ</td>
                </tr>
              ) : (
                topProvinces.map((item, index) => (
                  <tr
                    key={item.province}
                    style={{ borderBottom: '1px solid #e2e8f0' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
                  >
                    <td style={{ padding: 12, color: '#1a1a1a' }}>{index + 1}</td>
                    <td style={{ padding: 12, color: '#1a1a1a', fontWeight: 500 }}>{item.province}</td>
                    <td style={{ padding: 12, textAlign: 'center', color: '#1877f2', fontWeight: 'bold' }}>
                      {item.count.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Recent filter history table */
        <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 12px 28px rgba(15,23,42,0.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #e4e6eb' }}>
                <th style={{ padding: 12, textAlign: 'left', fontWeight: 'bold', color: '#4b4f56' }}>ຜູ້ໃຊ້</th>
                <th style={{ padding: 12, textAlign: 'left', fontWeight: 'bold', color: '#4b4f56' }}>ປະເພດ</th>
                <th style={{ padding: 12, textAlign: 'left', fontWeight: 'bold', color: '#4b4f56' }}>ແຂວງ</th>
                <th style={{ padding: 12, textAlign: 'left', fontWeight: 'bold', color: '#4b4f56' }}>ລາຄາຕໍ່າສຸດ</th>
                <th style={{ padding: 12, textAlign: 'left', fontWeight: 'bold', color: '#4b4f56' }}>ລາຄາສູງສຸດ</th>
                <th style={{ padding: 12, textAlign: 'left', fontWeight: 'bold', color: '#4b4f56' }}>ສະກຸນເງິນ</th>
                <th style={{ padding: 12, textAlign: 'left', fontWeight: 'bold', color: '#4b4f56' }}>ລຳດັບລາຄາ</th>
                <th style={{ padding: 12, textAlign: 'left', fontWeight: 'bold', color: '#4b4f56' }}>ເວລາ</th>
              </tr>
            </thead>
            <tbody>
              {recentFilters.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#65676b' }}>ບໍ່ມີຂໍ້ມູນ</td>
                </tr>
              ) : (
                recentFilters.map((log) => (
                  <tr
                    key={log.id}
                    style={{ borderBottom: '1px solid #e4e6eb' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#f8f9fa'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
                  >
                    <td style={{ padding: 12, color: '#1a1a1a', fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.person_label}
                    </td>
                    <td style={{ padding: 12 }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                        background: log.person_type === 'guest' ? '#fef3c7' : '#dbeafe',
                        color: log.person_type === 'guest' ? '#92400e' : '#1e40af',
                      }}>
                        {log.person_type === 'guest' ? 'Guest' : 'User'}
                      </span>
                    </td>
                    <td style={{ padding: 12, color: log.province ? '#0f172a' : '#9ca3af', fontStyle: log.province ? 'normal' : 'italic' }}>
                      {log.province || '-'}
                    </td>
                    <td style={{ padding: 12, color: log.min_price_kip != null ? '#0f172a' : '#9ca3af', fontStyle: log.min_price_kip != null ? 'normal' : 'italic' }}>
                      {formatPrice(log.min_price_kip, log.display_currency)}
                    </td>
                    <td style={{ padding: 12, color: log.max_price_kip != null ? '#0f172a' : '#9ca3af', fontStyle: log.max_price_kip != null ? 'normal' : 'italic' }}>
                      {formatPrice(log.max_price_kip, log.display_currency)}
                    </td>
                    <td style={{ padding: 12 }}>
                      {log.display_currency && (log.min_price_kip != null || log.max_price_kip != null) ? (
                        <span style={{
                          display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 13, fontWeight: 700,
                          background: log.display_currency === '₭' ? '#f0fdf4' : log.display_currency === '$' ? '#eff6ff' : '#fdf4ff',
                          color: log.display_currency === '₭' ? '#166534' : log.display_currency === '$' ? '#1e40af' : '#7e22ce',
                          border: `1px solid ${log.display_currency === '₭' ? '#bbf7d0' : log.display_currency === '$' ? '#bfdbfe' : '#e9d5ff'}`,
                        }}>
                          {log.display_currency}
                        </span>
                      ) : (
                        <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: 12 }}>
                      {log.price_sort_order ? (
                        <span style={{
                          display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                          background: log.price_sort_order === 'asc' ? '#dcfce7' : '#fce7f3',
                          color: log.price_sort_order === 'asc' ? '#166534' : '#9d174d',
                        }}>
                          {sortOrderLabel(log.price_sort_order)}
                        </span>
                      ) : (
                        <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: 12, color: '#65676b', fontSize: 13 }}>{formatDate(log.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Per-person summary when a person is selected */}
      {selectedPerson && (
        <div style={{ marginTop: 30, padding: '18px 20px', background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', boxShadow: '0 4px 14px rgba(15,23,42,0.06)' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
            ສະຫຼຸບ: {selectedPerson.person_label}
          </h3>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 14, color: '#334155' }}>
            <span>ປະເພດ: <b>{selectedPerson.person_type === 'guest' ? 'Guest' : 'User'}</b></span>
            <span>ໃຊ້ຕົວກອງທັງໝົດ: <b style={{ color: '#1877f2' }}>{selectedPerson.total_uses.toLocaleString()} ຄັ້ງ</b></span>
            <span>ຄັ້ງຫຼ້າສຸດ: <b>{formatDate(selectedPerson.last_used_at)}</b></span>
          </div>
        </div>
      )}
    </main>
  );
}
