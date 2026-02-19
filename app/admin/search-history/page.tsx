'use client'
import { useState, useEffect } from 'react';
import { TimeFilter } from '@/components/admin/TimeFilter';
import { StatCard } from '@/components/admin/StatCard';
import { getDateRange, type DateFilterType } from '@/utils/dateFilter';
import { createAdminSupabaseClient } from '@/utils/adminSupabaseClient';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { GuestAvatarIcon } from '@/components/GuestAvatarIcon';
import { getDisplayAvatarUrl } from '@/utils/avatarUtils';

interface SearchLog {
  id: string;
  user_id: string | null;
  search_term: string;
  display_text: string | null;
  search_type: 'manual' | 'suggestion' | 'history';
  created_at: string;
  profiles?: {
    username: string | null;
    avatar_url: string | null;
  } | null;
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

interface UserSummary {
  user_id: string | null;
  totalSearches: number;
  uniqueTerms: number;
  manualSearches: number;
  suggestionSearches: number;
  historySearches: number;
  last_searched_at: string | null;
  username?: string | null;
  avatar_url?: string | null;
}

interface UserTermStat {
  search_term: string;
  display_text: string | null;
  totalSearches: number;
  manualSearches: number;
  suggestionSearches: number;
  historySearches: number;
  last_searched_at: string;
}

interface TermUserStat {
  user_id: string | null;
  totalSearches: number;
  manualSearches: number;
  suggestionSearches: number;
  historySearches: number;
  last_searched_at: string;
  username?: string | null;
  avatar_url?: string | null;
}

export default function AdminSearchHistoryPage() {
  const [filter, setFilter] = useState<DateFilterType>('A');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalSearches: 0,
    uniqueTerms: 0,
    manualSearches: 0,
    suggestionSearches: 0,
    historySearches: 0,
  });
  const [allLogs, setAllLogs] = useState<SearchLog[]>([]);
  const [topSearches, setTopSearches] = useState<SearchTermStat[]>([]);
  const [recentSearches, setRecentSearches] = useState<SearchLog[]>([]);
  const [showTopSearches, setShowTopSearches] = useState(true);

  const [userSummaries, setUserSummaries] = useState<UserSummary[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userTermStats, setUserTermStats] = useState<UserTermStat[]>([]);

  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [termUserStats, setTermUserStats] = useState<TermUserStat[]>([]);

  const supabase = createAdminSupabaseClient();

  useEffect(() => {
    fetchSearchData();
    setSelectedUserId(null);
    setUserTermStats([]);
    setSelectedTerm(null);
    setTermUserStats([]);
  }, [filter]);

  const fetchSearchData = async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange(filter);

      let query = supabase
        .from('search_logs')
        .select('id, user_id, search_term, display_text, search_type, created_at')
        .order('created_at', { ascending: false });

      if (startDate) {
        query = query.gte('created_at', startDate);
      }
      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rawLogs: SearchLog[] = (data as any) || [];

      // ดึงข้อมูลโปรไฟล์ของ user ที่มี user_id
      const userIds = Array.from(
        new Set(
          rawLogs
            .map((log) => log.user_id)
            .filter((id): id is string => typeof id === 'string' && !!id)
        )
      );

      let profilesMap: Record<string, { username: string | null; avatar_url: string | null }> = {};

      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', userIds);

        if (profilesError) throw profilesError;

        profilesMap = Object.fromEntries(
          (profilesData || []).map((p: any) => [
            String(p.id),
            {
              username: p.username ?? null,
              avatar_url: p.avatar_url ?? null,
            },
          ])
        );
      }

      const safeLogs: SearchLog[] = rawLogs.map((log) => ({
        ...log,
        profiles: log.user_id ? profilesMap[log.user_id] || null : null,
      }));

      setAllLogs(safeLogs);

      const uniqueTerms = new Set(
        safeLogs
          .map((log) => (log.search_term || '').toLowerCase())
          .filter(Boolean)
      ).size;

      const manualSearches = safeLogs.filter((log) => log.search_type === 'manual').length;
      const suggestionSearches = safeLogs.filter((log) => log.search_type === 'suggestion').length;
      const historySearches = safeLogs.filter((log) => log.search_type === 'history').length;

      setStats({
        totalSearches: safeLogs.length,
        uniqueTerms,
        manualSearches,
        suggestionSearches,
        historySearches,
      });

      // Top search terms
      const termCounts: Record<string, SearchTermStat> = {};
      safeLogs.forEach((log) => {
        const rawTerm = log.search_term || '';
        const key = rawTerm.toLowerCase();
        if (!key) return;

        if (!termCounts[key]) {
          termCounts[key] = {
            search_term: rawTerm,
            display_text: log.display_text || rawTerm,
            search_count: 0,
            manual_count: 0,
            suggestion_count: 0,
            history_count: 0,
            last_searched_at: log.created_at,
          };
        }

        termCounts[key].search_count += 1;
        if (log.search_type === 'manual') {
          termCounts[key].manual_count += 1;
        } else if (log.search_type === 'suggestion') {
          termCounts[key].suggestion_count += 1;
        } else {
          termCounts[key].history_count += 1;
        }
        if (new Date(log.created_at) > new Date(termCounts[key].last_searched_at)) {
          termCounts[key].last_searched_at = log.created_at;
        }
      });

      const sortedTopTerms = Object.values(termCounts)
        .sort((a, b) => b.search_count - a.search_count)
        .slice(0, 50);
      setTopSearches(sortedTopTerms);

      // Recent searches (ล่าสุดไม่เกิน 100 แถว)
      setRecentSearches(safeLogs.slice(0, 100));

      // User summaries
      const userMap: Record<
        string,
        {
          user_id: string | null;
          totalSearches: number;
          manualSearches: number;
          suggestionSearches: number;
          historySearches: number;
          last_searched_at: string | null;
          terms: Set<string>;
          username?: string | null;
          avatar_url?: string | null;
        }
      > = {};

      safeLogs.forEach((log) => {
        const key = log.user_id || 'guest';
        if (!userMap[key]) {
          userMap[key] = {
            user_id: log.user_id,
            totalSearches: 0,
            manualSearches: 0,
            suggestionSearches: 0,
            historySearches: 0,
            last_searched_at: null,
            terms: new Set<string>(),
            username: log.profiles?.username || null,
            avatar_url: log.profiles?.avatar_url || null,
          };
        }
        const entry = userMap[key];
        entry.totalSearches += 1;
        if (log.search_type === 'manual') {
          entry.manualSearches += 1;
        } else if (log.search_type === 'suggestion') {
          entry.suggestionSearches += 1;
        } else {
          entry.historySearches += 1;
        }
        entry.terms.add((log.search_term || '').toLowerCase());
        if (!entry.last_searched_at || new Date(log.created_at) > new Date(entry.last_searched_at)) {
          entry.last_searched_at = log.created_at;
        }
      });

      const userSummaryList: UserSummary[] = Object.values(userMap)
        .map((entry) => ({
          user_id: entry.user_id,
          totalSearches: entry.totalSearches,
          manualSearches: entry.manualSearches,
          suggestionSearches: entry.suggestionSearches,
          historySearches: entry.historySearches,
          uniqueTerms: entry.terms.size,
          last_searched_at: entry.last_searched_at,
          username: entry.username,
          avatar_url: entry.avatar_url,
        }))
        .sort((a, b) => b.totalSearches - a.totalSearches);

      setUserSummaries(userSummaryList);
    } catch (err) {
      console.error('Error fetching search data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTermRowClick = (term: string) => {
    setSelectedTerm(term);

    const statsMap: Record<
      string,
      {
        user_id: string | null;
        totalSearches: number;
        manualSearches: number;
        suggestionSearches: number;
        historySearches: number;
        last_searched_at: string;
        username?: string | null;
        avatar_url?: string | null;
      }
    > = {};

    allLogs.forEach((log) => {
      if (log.search_term !== term) return;

      const key = log.user_id || 'guest';
      if (!statsMap[key]) {
        statsMap[key] = {
          user_id: log.user_id,
          totalSearches: 0,
          manualSearches: 0,
          suggestionSearches: 0,
          historySearches: 0,
          last_searched_at: log.created_at,
          username: log.profiles?.username || null,
          avatar_url: log.profiles?.avatar_url || null,
        };
      }
      const entry = statsMap[key];
      entry.totalSearches += 1;
      if (log.search_type === 'manual') {
        entry.manualSearches += 1;
      } else if (log.search_type === 'suggestion') {
        entry.suggestionSearches += 1;
      } else {
        entry.historySearches += 1;
      }
      if (new Date(log.created_at) > new Date(entry.last_searched_at)) {
        entry.last_searched_at = log.created_at;
      }
    });

    const list: TermUserStat[] = Object.values(statsMap).sort(
      (a, b) => b.totalSearches - a.totalSearches
    );
    setTermUserStats(list);
  };

  const handleUserRowClick = (userId: string | null) => {
    setSelectedUserId(userId);

    const statsMap: Record<
      string,
      {
        search_term: string;
        display_text: string | null;
        totalSearches: number;
        manualSearches: number;
        suggestionSearches: number;
        historySearches: number;
        last_searched_at: string;
      }
    > = {};

    allLogs.forEach((log) => {
      const isGuestSelected = userId === null;
      const isGuestLog = log.user_id === null;
      if (isGuestSelected ? !isGuestLog : log.user_id !== userId) return;

      const key = log.search_term;
      if (!statsMap[key]) {
        statsMap[key] = {
          search_term: log.search_term,
          display_text: log.display_text || log.search_term,
          totalSearches: 0,
          manualSearches: 0,
          suggestionSearches: 0,
          historySearches: 0,
          last_searched_at: log.created_at,
        };
      }
      const entry = statsMap[key];
      entry.totalSearches += 1;
      if (log.search_type === 'manual') {
        entry.manualSearches += 1;
      } else if (log.search_type === 'suggestion') {
        entry.suggestionSearches += 1;
      } else {
        entry.historySearches += 1;
      }
      if (new Date(log.created_at) > new Date(entry.last_searched_at)) {
        entry.last_searched_at = log.created_at;
      }
    });

    const list: UserTermStat[] = Object.values(statsMap).sort(
      (a, b) => b.totalSearches - a.totalSearches
    );
    setUserTermStats(list);
  };

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
    <main style={{ maxWidth: '1400px', margin: '40px auto', padding: '20px' }}>
      {/* Header & Filter */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '30px',
        }}
      >
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a1a1a' }}>
          ປະຫວັດການຄົ້ນຫາ
        </h2>
        <TimeFilter filter={filter} onFilterChange={setFilter} />
      </div>

      {/* สถิติรวม */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '30px' }}>
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

      {/* Toggle ระหว่าง Top Searches และ Recent Searches */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button
          onClick={() => setShowTopSearches(true)}
          style={{
            padding: '10px 20px',
            background: showTopSearches ? '#1877f2' : '#e4e6eb',
            color: showTopSearches ? '#fff' : '#4b4f56',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: showTopSearches ? 'bold' : 'normal',
          }}
        >
          ຄຳຄົ້ນຫາທີ່ນິຍົມຫຼາຍທີ່ສຸດ
        </button>
        <button
          onClick={() => setShowTopSearches(false)}
          style={{
            padding: '10px 20px',
            background: !showTopSearches ? '#1877f2' : '#e4e6eb',
            color: !showTopSearches ? '#fff' : '#4b4f56',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: !showTopSearches ? 'bold' : 'normal',
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
        <>
          {/* ตารางคำค้นหาที่ถูกค้นหาบ่อยที่สุด */}
          <div
            style={{
              background: '#fff',
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #e4e6eb' }}>
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
                        borderBottom: '1px solid #e4e6eb',
                        transition: 'background 0.2s',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f8f9fa';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#fff';
                      }}
                      onClick={() => handleTermRowClick(item.search_term)}
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

          {/* รายละเอียดว่าใครเคยกดคำค้นนี้บ้าง */}
          {selectedTerm && termUserStats.length > 0 && (
            <div style={{ marginTop: '24px' }}>
              <h3
                style={{
                  fontSize: '18px',
                  fontWeight: 'bold',
                  marginBottom: '10px',
                  color: '#1a1a1a',
                }}
              >
                ຜູ້ໃຊ້ທີ່ເຄີຍຄົ້ນຫາ: {selectedTerm}
              </h3>
              <div
                style={{
                  background: '#fff',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
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
                        ຜູ້ໃຊ້
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
                    {termUserStats.map((item) => (
                      <tr
                        key={item.user_id ?? 'guest'}
                        style={{
                          borderBottom: '1px solid #e4e6eb',
                          transition: 'background 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#f8f9fa';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#fff';
                        }}
                      >
                        <td
                          style={{
                            padding: '12px',
                            color: '#1a1a1a',
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                          }}
                        >
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: '#e4e6eb',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                              flexShrink: 0,
                            }}
                          >
                            {item.user_id && item.avatar_url ? (
                              <img
                                src={getDisplayAvatarUrl(item.avatar_url)}
                                alt=""
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              <GuestAvatarIcon size={20} stroke="#8d8f94" />
                            )}
                          </div>
                          <span style={{ fontWeight: '500' }}>
                            {item.user_id ? (item.username || item.user_id) : 'User'}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: '12px',
                            textAlign: 'center',
                            color: '#1877f2',
                            fontWeight: 'bold',
                          }}
                        >
                          {item.totalSearches.toLocaleString()}
                        </td>
                        <td
                          style={{
                            padding: '12px',
                            textAlign: 'center',
                            color: '#65676b',
                          }}
                        >
                          {item.manualSearches.toLocaleString()}
                        </td>
                        <td
                          style={{
                            padding: '12px',
                            textAlign: 'center',
                            color: '#65676b',
                          }}
                        >
                          {item.suggestionSearches.toLocaleString()}
                        </td>
                        <td
                          style={{
                            padding: '12px',
                            textAlign: 'center',
                            color: '#65676b',
                          }}
                        >
                          {item.historySearches.toLocaleString()}
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
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        /* ตารางประวัติการค้นหาล่าสุด */
        <div
          style={{
            background: '#fff',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
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
                  ຜູ້ໃຊ້
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
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f8f9fa';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#fff';
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
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                      }}
                    >
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: '#e4e6eb',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          flexShrink: 0,
                        }}
                      >
                        {item.user_id && item.profiles?.avatar_url ? (
                          <img
                            src={getDisplayAvatarUrl(item.profiles.avatar_url)}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <GuestAvatarIcon size={20} stroke="#8d8f94" />
                        )}
                      </div>
                      <span style={{ fontWeight: '500' }}>
                        {item.user_id ? (item.profiles?.username || 'ລົງທະບຽນ') : 'User'}
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

      {/* สถิติตามผู้ใช้ */}
      <div style={{ marginTop: '40px' }}>
        <h3
          style={{
            fontSize: '20px',
            fontWeight: 'bold',
            marginBottom: '15px',
            color: '#1a1a1a',
          }}
        >
          ສະຖິຕິຕາມຜູ້ໃຊ້
        </h3>

        <div
          style={{
            background: '#fff',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
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
                  ຜູ້ໃຊ້
                </th>
                <th
                  style={{
                    padding: '12px',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    color: '#4b4f56',
                  }}
                >
                  ຈຳນວນຄັ້ງທັງໝົດ
                </th>
                <th
                  style={{
                    padding: '12px',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    color: '#4b4f56',
                  }}
                >
                  ຄຳຄົ້ນຫາທີ່ແຕກຕ່າງກັນ
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
              {userSummaries.length === 0 ? (
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
                userSummaries.map((item) => (
                  <tr
                    key={item.user_id ?? 'guest'}
                    style={{
                      borderBottom: '1px solid #e4e6eb',
                      transition: 'background 0.2s',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f8f9fa';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#fff';
                    }}
                    onClick={() => handleUserRowClick(item.user_id)}
                  >
                    <td
                      style={{
                        padding: '12px',
                        color: '#1a1a1a',
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                      }}
                    >
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: '#e4e6eb',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          flexShrink: 0,
                        }}
                      >
                        {item.user_id && item.avatar_url ? (
                          <img
                            src={getDisplayAvatarUrl(item.avatar_url)}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <GuestAvatarIcon size={20} stroke="#8d8f94" />
                        )}
                      </div>
                      <span style={{ fontWeight: '500' }}>
                        {item.user_id ? (item.username || item.user_id) : 'User'}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '12px',
                        textAlign: 'center',
                        color: '#1877f2',
                        fontWeight: 'bold',
                      }}
                    >
                      {item.totalSearches.toLocaleString()}
                    </td>
                    <td
                      style={{
                        padding: '12px',
                        textAlign: 'center',
                        color: '#65676b',
                      }}
                    >
                      {item.uniqueTerms.toLocaleString()}
                    </td>
                    <td
                      style={{
                        padding: '12px',
                        textAlign: 'center',
                        color: '#65676b',
                      }}
                    >
                      {item.manualSearches.toLocaleString()}
                    </td>
                    <td
                      style={{
                        padding: '12px',
                        textAlign: 'center',
                        color: '#65676b',
                      }}
                    >
                      {item.suggestionSearches.toLocaleString()}
                    </td>
                    <td
                      style={{
                        padding: '12px',
                        textAlign: 'center',
                        color: '#65676b',
                      }}
                    >
                      {item.historySearches.toLocaleString()}
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

        {/* รายละเอียดคำค้นของผู้ใช้ที่เลือก */}
        {selectedUserId !== null || userTermStats.length > 0 ? (
          <div style={{ marginTop: '24px' }}>
            <h3
              style={{
                fontSize: '18px',
                fontWeight: 'bold',
                marginBottom: '10px',
                color: '#1a1a1a',
              }}
            >
              {selectedUserId
                ? `ຄຳຄົ້ນຫາຂອງຜູ້ໃຊ້: ${
                    userSummaries.find((u) => u.user_id === selectedUserId)?.username || selectedUserId
                  }`
                : 'ຄຳຄົ້ນຫາຂອງແຂກ'}
            </h3>
            <div
              style={{
                background: '#fff',
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
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
                  {userTermStats.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        style={{
                          padding: '24px',
                          textAlign: 'center',
                          color: '#65676b',
                        }}
                      >
                        ຍັງບໍ່ມີຄຳຄົ້ນຫາສຳລັບຜູ້ໃຊ້ນີ້
                      </td>
                    </tr>
                  ) : (
                    userTermStats.map((item) => (
                      <tr
                        key={item.search_term}
                        style={{
                          borderBottom: '1px solid #e4e6eb',
                          transition: 'background 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#f8f9fa';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#fff';
                        }}
                      >
                        <td
                          style={{
                            padding: '12px',
                            color: '#1a1a1a',
                            fontSize: '14px',
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
                          {item.totalSearches.toLocaleString()}
                        </td>
                        <td
                          style={{
                            padding: '12px',
                            textAlign: 'center',
                            color: '#65676b',
                          }}
                        >
                          {item.manualSearches.toLocaleString()}
                        </td>
                        <td
                          style={{
                            padding: '12px',
                            textAlign: 'center',
                            color: '#65676b',
                          }}
                        >
                          {item.suggestionSearches.toLocaleString()}
                        </td>
                        <td
                          style={{
                            padding: '12px',
                            textAlign: 'center',
                            color: '#65676b',
                          }}
                        >
                          {item.historySearches.toLocaleString()}
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
          </div>
        ) : null}
      </div>
    </main>
  );
}
