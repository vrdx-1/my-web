'use client'
import { useEffect, useMemo, useState } from 'react';
import { TimeFilter } from '@/components/admin/TimeFilter';
import { StatCard } from '@/components/admin/StatCard';
import { getDateRange, type DateFilterType } from '@/utils/dateFilter';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface SearchLog {
  id: string;
  search_term: string;
  display_text: string | null;
  search_type: 'manual' | 'suggestion' | 'history';
  created_at: string;
  person_key: string;
  person_label: string;
  person_type: 'guest' | 'user';
}

interface SearchTermStat {
  search_term: string;
  display_text: string | null;
  search_count: number;
  manual_count: number;
  suggestion_count: number;
  history_count: number;
  last_searched_at: string;
}

interface PersonSummary {
  person_key: string;
  person_label: string;
  person_type: 'guest' | 'user';
  total_searches: number;
  last_searched_at: string;
}

interface StatsPayload {
  totalSearches: number;
  uniqueTerms: number;
  manualSearches: number;
  suggestionSearches: number;
  historySearches: number;
}

export default function AdminSearchHistoryPage() {
  const [filter, setFilter] = useState<DateFilterType>('A');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatsPayload>({
    totalSearches: 0,
    uniqueTerms: 0,
    manualSearches: 0,
    suggestionSearches: 0,
    historySearches: 0,
  });
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [selectedPersonKey, setSelectedPersonKey] = useState<string>('');
  const [topSearches, setTopSearches] = useState<SearchTermStat[]>([]);
  const [recentSearches, setRecentSearches] = useState<SearchLog[]>([]);
  const [showTopSearches, setShowTopSearches] = useState(true);

  useEffect(() => {
    void fetchSearchData();
  }, [filter, selectedPersonKey]);

  const fetchSearchData = async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange(filter);
      const search = new URLSearchParams();
      if (startDate) search.set('start', startDate);
      if (endDate) search.set('end', endDate);
      if (selectedPersonKey) search.set('personKey', selectedPersonKey);

      const response = await fetch(`/api/admin/search-history?${search.toString()}`, {
        method: 'GET',
        credentials: 'include',
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload) {
        throw new Error('Failed to fetch admin search history');
      }

      setStats(payload.stats || {
        totalSearches: 0,
        uniqueTerms: 0,
        manualSearches: 0,
        suggestionSearches: 0,
        historySearches: 0,
      });
      setPeople(Array.isArray(payload.people) ? payload.people : []);
      setTopSearches(Array.isArray(payload.topSearches) ? payload.topSearches : []);
      setRecentSearches(Array.isArray(payload.recentSearches) ? payload.recentSearches : []);
    } catch (err) {
      console.error('Error fetching search data:', err);
      setStats({
        totalSearches: 0,
        uniqueTerms: 0,
        manualSearches: 0,
        suggestionSearches: 0,
        historySearches: 0,
      });
      setTopSearches([]);
      setRecentSearches([]);
    } finally {
      setLoading(false);
    }
  };

  const selectedPerson = useMemo(
    () => people.find((person) => person.person_key === selectedPersonKey) || null,
    [people, selectedPersonKey],
  );

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('th-TH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '18px',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            ປະຫວັດການຄົ້ນຫາ
          </h2>
          <p style={{ margin: '6px 0 0', color: '#334155', fontSize: 14 }}>
            นับเฉพาะ Guest และ User ทั่วไปเท่านั้น (ไม่รวม Admin/Sub account)
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <TimeFilter filter={filter} onFilterChange={setFilter} />
          <select
            value={selectedPersonKey}
            onChange={(e) => setSelectedPersonKey(e.target.value)}
            style={{
              height: 40,
              borderRadius: 10,
              border: '1px solid #cbd5e1',
              background: '#fff',
              padding: '0 12px',
              minWidth: 260,
              color: '#0f172a',
              fontWeight: 500,
            }}
          >
            <option value="">ທຸກຄົນ (Guest + User)</option>
            {people.map((person) => (
              <option key={person.person_key} value={person.person_key}>
                {person.person_label} ({person.total_searches.toLocaleString()})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        style={{
          marginBottom: 20,
          padding: '10px 14px',
          borderRadius: 12,
          background: '#ffffffd9',
          border: '1px solid #e2e8f0',
          color: '#0f172a',
          fontSize: 14,
        }}
      >
        {selectedPerson
          ? `กำลังดูรายบุคคล: ${selectedPerson.person_label}`
          : 'กำลังดูภาพรวมทั้งระบบ'}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, marginBottom: '26px' }}>
        <StatCard
          label="ການຄົ້ນຫາທັງໝົດ"
          value={stats.totalSearches.toLocaleString()}
          loading={loading}
          variant="centered"
        />
        <StatCard
          label="ຄຳຄົ້ນຫາທີ່ແຕກຕ່າງກັນ"
          value={stats.uniqueTerms.toLocaleString()}
          loading={loading}
          variant="centered"
        />
        <StatCard
          label="ພິມຄົ້ນຫາເອງ"
          value={stats.manualSearches.toLocaleString()}
          loading={loading}
          variant="centered"
        />
        <StatCard
          label="ກົດ Suggestion"
          value={stats.suggestionSearches.toLocaleString()}
          loading={loading}
          variant="centered"
        />
        <StatCard
          label="ກົດຈາກປະຫວັດ"
          value={stats.historySearches.toLocaleString()}
          loading={loading}
          variant="centered"
        />
      </div>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setShowTopSearches(true)}
          style={{
            padding: '10px 20px',
            background: showTopSearches ? 'linear-gradient(135deg,#1877f2,#10b981)' : '#e2e8f0',
            color: showTopSearches ? '#fff' : '#334155',
            border: 'none',
            borderRadius: '999px',
            cursor: 'pointer',
            fontWeight: showTopSearches ? 700 : 500,
          }}
        >
          ຄຳຄົ້ນຫາທີ່ນິຍົມຫຼາຍທີ່ສຸດ
        </button>
        <button
          onClick={() => setShowTopSearches(false)}
          style={{
            padding: '10px 20px',
            background: !showTopSearches ? 'linear-gradient(135deg,#1877f2,#10b981)' : '#e2e8f0',
            color: !showTopSearches ? '#fff' : '#334155',
            border: 'none',
            borderRadius: '999px',
            cursor: 'pointer',
            fontWeight: !showTopSearches ? 700 : 500,
          }}
        >
          ປະຫວັດການຄົ້ນຫາລ່າສຸດ
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <LoadingSpinner />
        </div>
      ) : showTopSearches ? (
        <div
          style={{
            background: '#fff',
            borderRadius: '14px',
            overflow: 'hidden',
            border: '1px solid #e2e8f0',
            boxShadow: '0 12px 28px rgba(15,23,42,0.08)',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'left',
                      fontWeight: 'bold',
                      color: '#4b4f56',
                    }}
                  >
                    ລຳດັບ
                  </th>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'left',
                      fontWeight: 'bold',
                      color: '#4b4f56',
                    }}
                  >
                    ຄຳຄົ້ນຫາ
                  </th>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'center',
                      fontWeight: 'bold',
                      color: '#4b4f56',
                    }}
                  >
                    ຈຳນວນຄັ້ງ
                  </th>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'center',
                      fontWeight: 'bold',
                      color: '#4b4f56',
                    }}
                  >
                    ພິມເອງ
                  </th>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'center',
                      fontWeight: 'bold',
                      color: '#4b4f56',
                    }}
                  >
                    Suggestion
                  </th>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'center',
                      fontWeight: 'bold',
                      color: '#4b4f56',
                    }}
                  >
                    ກົດຈາກປະຫວັດ
                  </th>
                  <th
                    style={{
                      padding: '12px',
                      textAlign: 'left',
                      fontWeight: 'bold',
                      color: '#4b4f56',
                    }}
                  >
                    ຄັ້ງລ່າສຸດ
                  </th>
                </tr>
              </thead>
              <tbody>
                {topSearches.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        padding: '40px',
                        textAlign: 'center',
                        color: '#65676b',
                      }}
                    >
                      ບໍ່ມີຂໍ້ມູນ
                    </td>
                  </tr>
                ) : (
                  topSearches.map((item, index) => (
                    <tr
                      key={item.search_term}
                      style={{
                        borderBottom: '1px solid #e2e8f0',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f8fafc';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#fff';
                      }}
                    >
                      <td style={{ padding: '12px', color: '#1a1a1a' }}>{index + 1}</td>
                      <td
                        style={{
                          padding: '12px',
                          color: '#1a1a1a',
                          fontWeight: '500',
                        }}
                      >
                        {item.display_text || item.search_term}
                      </td>
                      <td
                        style={{
                          padding: '12px',
                          textAlign: 'center',
                          color: '#1877f2',
                          fontWeight: 'bold',
                        }}
                      >
                        {item.search_count.toLocaleString()}
                      </td>
                      <td
                        style={{
                          padding: '12px',
                          textAlign: 'center',
                          color: '#65676b',
                        }}
                      >
                        {item.manual_count.toLocaleString()}
                      </td>
                      <td
                        style={{
                          padding: '12px',
                          textAlign: 'center',
                          color: '#65676b',
                        }}
                      >
                        {item.suggestion_count.toLocaleString()}
                      </td>
                      <td
                        style={{
                          padding: '12px',
                          textAlign: 'center',
                          color: '#65676b',
                        }}
                      >
                        {item.history_count.toLocaleString()}
                      </td>
                      <td
                        style={{
                          padding: '12px',
                          color: '#65676b',
                          fontSize: '14px',
                        }}
                      >
                        {formatDate(item.last_searched_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
      ) : (
        <div
          style={{
            background: '#fff',
            borderRadius: '14px',
            overflow: 'hidden',
            border: '1px solid #e2e8f0',
            boxShadow: '0 12px 28px rgba(15,23,42,0.08)',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr
                style={{
                  background: '#f8f9fa',
                  borderBottom: '2px solid #e4e6eb',
                }}
              >
                <th
                  style={{
                    padding: '12px',
                    textAlign: 'left',
                    fontWeight: 'bold',
                    color: '#4b4f56',
                  }}
                >
                  ຄຳຄົ້ນຫາ
                </th>
                <th
                  style={{
                    padding: '12px',
                    textAlign: 'left',
                    fontWeight: 'bold',
                    color: '#4b4f56',
                  }}
                >
                  ຜູ້ຄົ້ນຫາ
                </th>
                <th
                  style={{
                    padding: '12px',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    color: '#4b4f56',
                  }}
                >
                  ປະເພດ
                </th>
                <th
                  style={{
                    padding: '12px',
                    textAlign: 'left',
                    fontWeight: 'bold',
                    color: '#4b4f56',
                  }}
                >
                  ເວລາ
                </th>
              </tr>
            </thead>
            <tbody>
              {recentSearches.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      padding: '40px',
                      textAlign: 'center',
                      color: '#65676b',
                    }}
                  >
                    ບໍ່ມີຂໍ້ມູນ
                  </td>
                </tr>
              ) : (
                recentSearches.map((item) => (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: '1px solid #e4e6eb',
                      transition: 'background 0.2s',
                    }}
                  >
                    <td
                      style={{
                        padding: '12px',
                        color: '#1a1a1a',
                        fontWeight: '500',
                      }}
                    >
                      {item.display_text || item.search_term}
                    </td>
                    <td style={{ padding: '12px', color: '#334155' }}>{item.person_label}</td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          background:
                            item.search_type === 'manual'
                              ? '#e7f3ff'
                              : item.search_type === 'suggestion'
                                ? '#fff3cd'
                                : '#e8f5e9',
                          color:
                            item.search_type === 'manual'
                              ? '#1877f2'
                              : item.search_type === 'suggestion'
                                ? '#856404'
                                : '#2e7d32',
                          fontSize: '12px',
                          fontWeight: '500',
                        }}
                      >
                        {item.search_type === 'manual'
                          ? 'ພິມເອງ'
                          : item.search_type === 'suggestion'
                            ? 'Suggestion'
                            : 'ກົດຈາກປະຫວັດ'}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '12px',
                        color: '#65676b',
                        fontSize: '14px',
                      }}
                    >
                      {formatDate(item.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
