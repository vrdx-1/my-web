'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type AccountType = 'all' | 'admin' | 'admin_sub_account' | 'user';

type AccountRow = {
  accountId: string;
  accountType: Exclude<AccountType, 'all'>;
  totalPostsAllTime: number;
  lastCountedAt: string | null;
  updatedAt: string;
  profile: {
    label: string;
    username: string | null;
    fullName: string | null;
    role: string | null;
    isSubAccount: boolean;
    parentAdminId: string | null;
  };
};

type TopRollup = {
  adminId: string;
  adminLabel: string;
  adminOwnPosts: number;
  subAccountPosts: number;
  combinedPosts: number;
  lastCountedAt: string | null;
};

type ApiPayload = {
  global: {
    totalPostsAllTime: number;
    totalAdminPostsAllTime: number;
    totalSubAccountPostsAllTime: number;
    totalUserPostsAllTime: number;
    updatedAt: string;
  };
  accountTypeTotals: {
    adminAccounts: number;
    subAccounts: number;
    userAccounts: number;
  };
  top: {
    admins: AccountRow[];
    subAccounts: AccountRow[];
    users: AccountRow[];
    adminRollups: TopRollup[];
  };
  accounts: {
    page: number;
    pageSize: number;
    totalRows: number;
    rows: AccountRow[];
  };
};

const TYPE_LABEL: Record<AccountType, string> = {
  all: 'All Accounts',
  admin: 'Admins',
  admin_sub_account: 'Sub Accounts',
  user: 'Users',
};

function formatDateTime(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('th-TH', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatType(type: AccountRow['accountType']) {
  if (type === 'admin') return 'Admin';
  if (type === 'admin_sub_account') return 'Sub Account';
  return 'User';
}

export default function AdminPostCountsPage() {
  const router = useRouter();

  const [type, setType] = useState<AccountType>('all');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<ApiPayload | null>(null);

  const totalPages = useMemo(() => {
    const totalRows = data?.accounts?.totalRows || 0;
    return Math.max(1, Math.ceil(totalRows / pageSize));
  }, [data?.accounts?.totalRows, pageSize]);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const params = new URLSearchParams();
      params.set('type', type);
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      params.set('topLimit', '8');
      if (search.trim()) {
        params.set('q', search.trim());
      }

      const response = await fetch(`/api/admin/post-counts?${params.toString()}`, {
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
        throw new Error(payload?.error || 'Failed to load post counters');
      }

      setData(payload as ApiPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load post counters');
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, pageSize, router, search, type]);

  useEffect(() => {
    void fetchData(false);
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [type, search, pageSize]);

  const onSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSearch(query.trim());
  };

  const kpiCards = [
    {
      title: 'Total Posts (All Time)',
      value: data?.global.totalPostsAllTime || 0,
      accent: '#0b6e4f',
      gradient: 'linear-gradient(135deg, rgba(15,118,110,0.18), rgba(6,182,212,0.08))',
    },
    {
      title: 'Admin Posts (All Time)',
      value: data?.global.totalAdminPostsAllTime || 0,
      accent: '#1d4ed8',
      gradient: 'linear-gradient(135deg, rgba(37,99,235,0.20), rgba(59,130,246,0.08))',
    },
    {
      title: 'Sub Account Posts (All Time)',
      value: data?.global.totalSubAccountPostsAllTime || 0,
      accent: '#b45309',
      gradient: 'linear-gradient(135deg, rgba(245,158,11,0.22), rgba(234,179,8,0.10))',
    },
    {
      title: 'User Posts (All Time)',
      value: data?.global.totalUserPostsAllTime || 0,
      accent: '#7c2d12',
      gradient: 'linear-gradient(135deg, rgba(251,146,60,0.20), rgba(249,115,22,0.08))',
    },
  ];

  return (
    <main
      style={{
        maxWidth: 1460,
        margin: '0 auto',
        minHeight: '100vh',
        padding: '26px 20px 42px',
        color: '#0f172a',
        background:
          'radial-gradient(circle at 0% 0%, rgba(15,118,110,0.12), transparent 32%), radial-gradient(circle at 100% 0%, rgba(37,99,235,0.10), transparent 38%), linear-gradient(180deg, #f8fbff 0%, #f6faf9 100%)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 14,
          flexWrap: 'wrap',
          marginBottom: 18,
        }}
      >
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 14px',
              borderRadius: 999,
              fontWeight: 800,
              fontSize: 12,
              letterSpacing: '0.08em',
              color: '#0f766e',
              background: 'rgba(15,118,110,0.12)',
              border: '1px solid rgba(15,118,110,0.18)',
            }}
          >
            LIFETIME POST COUNTERS
          </div>
          <h1
            style={{
              margin: '12px 0 6px',
              fontSize: 36,
              lineHeight: '42px',
              letterSpacing: '-0.02em',
              fontWeight: 900,
            }}
          >
            Admin Post Statistics
          </h1>
          <p style={{ margin: 0, color: '#475569', fontSize: 15, maxWidth: 920 }}>
            Counts are cumulative and immutable. Deleting a post does not reduce totals. Reposts are excluded because this dashboard only counts new inserts.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => void fetchData(true)}
            disabled={refreshing || loading}
            style={{
              border: '1px solid rgba(15,118,110,0.22)',
              background: refreshing ? '#ccfbf1' : '#ecfeff',
              color: '#0f766e',
              borderRadius: 12,
              padding: '10px 14px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {refreshing ? 'Refreshing...' : 'Refresh Now'}
          </button>
          <div style={{ color: '#64748b', fontSize: 12, fontWeight: 600 }}>
            Last Updated: {formatDateTime(data?.global.updatedAt || null)}
          </div>
        </div>
      </div>

      {error && (
        <div
          style={{
            marginBottom: 16,
            background: '#fff7ed',
            border: '1px solid #fdba74',
            color: '#9a3412',
            borderRadius: 14,
            padding: '12px 14px',
            fontWeight: 700,
          }}
        >
          {error}
        </div>
      )}

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: 12,
          marginBottom: 18,
        }}
      >
        {kpiCards.map((card) => (
          <article
            key={card.title}
            style={{
              borderRadius: 20,
              padding: '18px 16px',
              border: '1px solid rgba(148,163,184,0.25)',
              background: card.gradient,
              boxShadow: '0 10px 26px rgba(15,23,42,0.08)',
            }}
          >
            <div style={{ fontSize: 12, letterSpacing: '0.06em', color: '#334155', fontWeight: 700 }}>
              {card.title}
            </div>
            <div style={{ marginTop: 10, fontSize: 34, lineHeight: '38px', fontWeight: 900, color: card.accent }}>
              {loading ? '...' : card.value.toLocaleString()}
            </div>
          </article>
        ))}
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <div style={{ borderRadius: 16, border: '1px solid #dbeafe', background: '#eff6ff', padding: '14px 16px' }}>
          <div style={{ color: '#1d4ed8', fontSize: 12, fontWeight: 800, letterSpacing: '0.06em' }}>ADMIN ACCOUNTS</div>
          <div style={{ marginTop: 4, fontSize: 26, fontWeight: 900 }}>{(data?.accountTypeTotals.adminAccounts || 0).toLocaleString()}</div>
        </div>
        <div style={{ borderRadius: 16, border: '1px solid #fde68a', background: '#fffbeb', padding: '14px 16px' }}>
          <div style={{ color: '#b45309', fontSize: 12, fontWeight: 800, letterSpacing: '0.06em' }}>SUB ACCOUNTS</div>
          <div style={{ marginTop: 4, fontSize: 26, fontWeight: 900 }}>{(data?.accountTypeTotals.subAccounts || 0).toLocaleString()}</div>
        </div>
        <div style={{ borderRadius: 16, border: '1px solid #fed7aa', background: '#fff7ed', padding: '14px 16px' }}>
          <div style={{ color: '#9a3412', fontSize: 12, fontWeight: 800, letterSpacing: '0.06em' }}>USER ACCOUNTS</div>
          <div style={{ marginTop: 4, fontSize: 26, fontWeight: 900 }}>{(data?.accountTypeTotals.userAccounts || 0).toLocaleString()}</div>
        </div>
      </section>

      <section
        style={{
          borderRadius: 24,
          border: '1px solid #e2e8f0',
          background: 'white',
          boxShadow: '0 16px 44px rgba(15,23,42,0.08)',
          marginBottom: 18,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid #e2e8f0',
            background: 'linear-gradient(135deg, rgba(15,118,110,0.08), rgba(37,99,235,0.06))',
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 19 }}>Account Explorer</div>
          <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
            Filter by account type, search by username/name/id, and inspect cumulative post totals.
          </div>
        </div>

        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {(Object.keys(TYPE_LABEL) as AccountType[]).map((value) => {
              const active = value === type;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setType(value)}
                  style={{
                    border: active ? '1px solid #0f766e' : '1px solid #cbd5e1',
                    background: active ? '#ccfbf1' : '#fff',
                    color: active ? '#0f766e' : '#334155',
                    borderRadius: 999,
                    padding: '8px 12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {TYPE_LABEL[value]}
                </button>
              );
            })}
          </div>

          <form onSubmit={onSearchSubmit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search account by name, username, or ID"
              style={{
                flex: '1 1 320px',
                border: '1px solid #cbd5e1',
                borderRadius: 12,
                padding: '10px 12px',
                outline: 'none',
                fontSize: 14,
              }}
            />
            <button
              type="submit"
              style={{
                border: '1px solid #0f766e',
                background: '#0f766e',
                color: '#fff',
                borderRadius: 12,
                padding: '10px 14px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSearch('');
              }}
              style={{
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#334155',
                borderRadius: 12,
                padding: '10px 14px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
          </form>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th style={headerCell}>Account</th>
                  <th style={headerCell}>Type</th>
                  <th style={headerCell}>Total Posts</th>
                  <th style={headerCell}>Last Counted</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, idx) => (
                    <tr key={idx}>
                      <td style={skeletonCell}><div style={skeletonBar} /></td>
                      <td style={skeletonCell}><div style={{ ...skeletonBar, width: 88 }} /></td>
                      <td style={skeletonCell}><div style={{ ...skeletonBar, width: 74 }} /></td>
                      <td style={skeletonCell}><div style={{ ...skeletonBar, width: 122 }} /></td>
                    </tr>
                  ))
                ) : (data?.accounts.rows || []).length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '20px 12px', textAlign: 'center', color: '#64748b', fontWeight: 700 }}>
                      No matching accounts found.
                    </td>
                  </tr>
                ) : (
                  (data?.accounts.rows || []).map((row) => (
                    <tr key={row.accountId}>
                      <td style={bodyCell}>
                        <div style={{ fontWeight: 800 }}>{row.profile.label}</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>{row.accountId}</div>
                      </td>
                      <td style={bodyCell}>
                        <span style={typeBadge(row.accountType)}>{formatType(row.accountType)}</span>
                      </td>
                      <td style={{ ...bodyCell, fontSize: 18, fontWeight: 900 }}>{row.totalPostsAllTime.toLocaleString()}</td>
                      <td style={bodyCell}>{formatDateTime(row.lastCountedAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ color: '#64748b', fontSize: 13, fontWeight: 600 }}>
              Showing {(data?.accounts.rows || []).length.toLocaleString()} of {(data?.accounts.totalRows || 0).toLocaleString()} accounts
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: '7px 10px', background: '#fff' }}
              >
                {[10, 20, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size} / page
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
                style={pagerButton(page <= 1)}
              >
                Prev
              </button>
              <div style={{ minWidth: 74, textAlign: 'center', fontSize: 13, fontWeight: 700 }}>
                {page} / {totalPages}
              </div>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages}
                style={pagerButton(page >= totalPages)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
        <TopListCard title="Top Admin Accounts" rows={data?.top.admins || []} />
        <TopListCard title="Top Sub Accounts" rows={data?.top.subAccounts || []} />
        <TopListCard title="Top User Accounts" rows={data?.top.users || []} />
      </section>

      <section
        style={{
          marginTop: 12,
          borderRadius: 20,
          border: '1px solid #e2e8f0',
          background: 'white',
          boxShadow: '0 14px 40px rgba(15,23,42,0.08)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid #e2e8f0',
            background: 'linear-gradient(135deg, rgba(251,146,60,0.16), rgba(245,158,11,0.08))',
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 18 }}>Top Admin Rollups (Own + Sub Accounts)</div>
          <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
            This view helps track each admin total by combining admin-owned posts and all posts from that admin sub accounts.
          </div>
        </div>

        <div style={{ overflowX: 'auto', padding: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={compactHeaderCell}>Admin</th>
                <th style={compactHeaderCell}>Own Posts</th>
                <th style={compactHeaderCell}>Sub Account Posts</th>
                <th style={compactHeaderCell}>Combined</th>
                <th style={compactHeaderCell}>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {(data?.top.adminRollups || []).map((item) => (
                <tr key={item.adminId}>
                  <td style={compactBodyCell}>
                    <div style={{ fontWeight: 800 }}>{item.adminLabel}</div>
                    <div style={{ color: '#64748b', fontSize: 12 }}>{item.adminId}</div>
                  </td>
                  <td style={compactBodyCell}>{item.adminOwnPosts.toLocaleString()}</td>
                  <td style={compactBodyCell}>{item.subAccountPosts.toLocaleString()}</td>
                  <td style={{ ...compactBodyCell, fontWeight: 900, color: '#b45309' }}>{item.combinedPosts.toLocaleString()}</td>
                  <td style={compactBodyCell}>{formatDateTime(item.lastCountedAt)}</td>
                </tr>
              ))}
              {(data?.top.adminRollups || []).length === 0 && !loading && (
                <tr>
                  <td colSpan={5} style={{ ...compactBodyCell, textAlign: 'center', color: '#64748b', fontWeight: 700 }}>
                    No admin rollup data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function TopListCard({ title, rows }: { title: string; rows: AccountRow[] }) {
  return (
    <article
      style={{
        borderRadius: 18,
        border: '1px solid #e2e8f0',
        background: '#ffffff',
        boxShadow: '0 12px 34px rgba(15,23,42,0.08)',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #e2e8f0', fontWeight: 900, fontSize: 16 }}>{title}</div>
      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.length === 0 ? (
          <div style={{ color: '#64748b', fontWeight: 700, textAlign: 'center', padding: '10px 0' }}>No data</div>
        ) : (
          rows.map((row, index) => (
            <div
              key={row.accountId}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8,
                padding: '10px 12px',
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                background: index === 0 ? 'linear-gradient(135deg, rgba(15,118,110,0.12), rgba(37,99,235,0.06))' : '#f8fafc',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {index + 1}. {row.profile.label}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{row.accountId.slice(0, 12)}</div>
              </div>
              <div style={{ fontWeight: 900, fontSize: 20, color: '#0f766e' }}>{row.totalPostsAllTime.toLocaleString()}</div>
            </div>
          ))
        )}
      </div>
    </article>
  );
}

const headerCell: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  fontSize: 12,
  color: '#475569',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  borderBottom: '1px solid #e2e8f0',
};

const bodyCell: React.CSSProperties = {
  padding: '12px',
  borderBottom: '1px solid #f1f5f9',
  fontSize: 14,
  color: '#0f172a',
  verticalAlign: 'top',
};

const compactHeaderCell: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 10px',
  fontSize: 12,
  color: '#475569',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  borderBottom: '1px solid #e2e8f0',
};

const compactBodyCell: React.CSSProperties = {
  padding: '10px 10px',
  borderBottom: '1px solid #f1f5f9',
  fontSize: 14,
  color: '#0f172a',
};

const skeletonCell: React.CSSProperties = {
  padding: '12px',
  borderBottom: '1px solid #f1f5f9',
};

const skeletonBar: React.CSSProperties = {
  width: 180,
  height: 14,
  borderRadius: 999,
  background: 'linear-gradient(90deg, #e2e8f0 0%, #f8fafc 50%, #e2e8f0 100%)',
};

function pagerButton(disabled: boolean): React.CSSProperties {
  return {
    border: '1px solid #cbd5e1',
    background: disabled ? '#f1f5f9' : '#fff',
    color: disabled ? '#94a3b8' : '#334155',
    borderRadius: 10,
    padding: '7px 12px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 700,
  };
}

function typeBadge(type: AccountRow['accountType']): React.CSSProperties {
  const palette =
    type === 'admin'
      ? { color: '#1d4ed8', bg: '#dbeafe', border: '#bfdbfe' }
      : type === 'admin_sub_account'
        ? { color: '#b45309', bg: '#fef3c7', border: '#fde68a' }
        : { color: '#9a3412', bg: '#ffedd5', border: '#fdba74' };

  return {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 999,
    border: `1px solid ${palette.border}`,
    background: palette.bg,
    color: palette.color,
    fontWeight: 700,
    fontSize: 12,
    padding: '5px 10px',
  };
}
