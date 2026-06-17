'use client';

import { useEffect, useMemo, useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import styles from './page.module.css';

type DailyRow = {
  clickDate: string;
  totalClicks: number;
};

type TopPostRow = {
  postId: string | null;
  shortId: string;
  caption: string | null;
  clickCount: number;
  uniquePeople: number;
  userClicks: number;
  guestClicks: number;
  ownerAccounts: Array<{
    profileId: string;
    username: string;
  }>;
};

type PersonDetail = {
  personKey: string;
  personType: 'user' | 'guest';
  userId: string | null;
  guestToken: string | null;
  displayName: string;
  avatarUrl: string | null;
  totalClicks: number;
  firstClickAt: string;
  lastClickAt: string;
  posts: Array<{
    postId: string | null;
    shortId: string;
    clickCount: number;
  }>;
};

type AccountRow = {
  targetProfileId: string;
  username: string;
  avatarUrl: string | null;
  isSubAccount: boolean;
  parentAdminId: string | null;
  parentAdminUsername: string | null;
  totalClicks: number;
  userClicks: number;
  guestClicks: number;
  uniquePeople: number;
  uniqueUsers: number;
  uniqueGuests: number;
  topPosts: Array<{
    postId: string | null;
    shortId: string;
    clickCount: number;
    uniquePeople: number;
    userClicks: number;
    guestClicks: number;
    caption: string | null;
  }>;
  people: PersonDetail[];
};

type Payload = {
  selectedDate: string;
  dailyRows: DailyRow[];
  topPosts: TopPostRow[];
  accountRows: AccountRow[];
  summary: {
    todayCount: number;
    monthTotal: number;
    selectedDateTotal: number;
    selectedDateUserClicks: number;
    selectedDateGuestClicks: number;
    selectedDateUniquePeople: number;
    selectedDateUniqueUsers: number;
    selectedDateUniqueGuests: number;
    daysWithData: number;
    accountsWithClicks: number;
  };
};

function getTodayBangkokDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  if (!year || !month || !day) return new Date().toISOString().slice(0, 10);
  return `${year}-${month}-${day}`;
}

function formatDate(date: string): string {
  const [year, month, day] = date.split('-');
  if (!year || !month || !day) return date;
  return `${day}/${month}/${year}`;
}

function formatBangkokDateTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

function maskGuestToken(token: string | null): string {
  const normalized = token?.trim();
  if (!normalized) return 'Guest (no token)';
  if (normalized.length < 12) return `guest:${normalized}`;
  return `guest:${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
}

function summarizeOwnerNames(owners: TopPostRow['ownerAccounts']): string {
  if (!owners.length) return 'Unknown account';
  if (owners.length === 1) return owners[0].username;
  if (owners.length === 2) return `${owners[0].username}, ${owners[1].username}`;
  return `${owners[0].username}, ${owners[1].username} +${owners.length - 2}`;
}

const EMPTY_SUMMARY: Payload['summary'] = {
  todayCount: 0,
  monthTotal: 0,
  selectedDateTotal: 0,
  selectedDateUserClicks: 0,
  selectedDateGuestClicks: 0,
  selectedDateUniquePeople: 0,
  selectedDateUniqueUsers: 0,
  selectedDateUniqueGuests: 0,
  daysWithData: 0,
  accountsWithClicks: 0,
};

export default function AdminWhatsAppClickInsightsPage() {
  const today = useMemo(() => getTodayBangkokDate(), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Payload['summary']>(EMPTY_SUMMARY);
  const [dailyRows, setDailyRows] = useState<DailyRow[]>([]);
  const [topPosts, setTopPosts] = useState<TopPostRow[]>([]);
  const [accountRows, setAccountRows] = useState<AccountRow[]>([]);
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      setExpandedAccountId(null);

      try {
        const res = await fetch(`/api/admin/whatsapp-clicks-insights?date=${encodeURIComponent(selectedDate)}`, {
          credentials: 'include',
        });

        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload?.error || 'Failed to load WhatsApp click insights');
        }

        const payload = (await res.json()) as Payload;
        if (cancelled) return;

        setSummary(payload.summary || EMPTY_SUMMARY);
        setDailyRows(Array.isArray(payload.dailyRows) ? payload.dailyRows : []);
        setTopPosts(Array.isArray(payload.topPosts) ? payload.topPosts : []);
        setAccountRows(Array.isArray(payload.accountRows) ? payload.accountRows : []);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Unknown error');
        setSummary(EMPTY_SUMMARY);
        setDailyRows([]);
        setTopPosts([]);
        setAccountRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  return (
    <main className={styles.pageRoot}>
      <section className={styles.heroCard}>
        <div className={styles.heroGlow} />
        <div className={styles.heroHeaderRow}>
          <div>
            <p className={styles.eyebrow}>Admin Intelligence</p>
            <h1 className={styles.heroTitle}>WhatsApp Click Deep Dive</h1>
            <p className={styles.heroSubtitle}>
              เจาะสถิติรวม user และ guest จากตาราง whatsapp_click_logs พร้อม unique person และ top posts รายวัน
            </p>
          </div>
          <label className={styles.datePickerWrap}>
            <span>Date</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </label>
        </div>

        <div className={styles.statsGrid}>
          <article className={styles.statCard}>
            <div className={styles.statLabel}>Today Clicks</div>
            <div className={styles.statValue}>{loading ? '...' : summary.todayCount.toLocaleString()}</div>
          </article>
          <article className={`${styles.statCard} ${styles.statCardWarm}`}>
            <div className={styles.statLabel}>Selected Day Total</div>
            <div className={styles.statValue}>{loading ? '...' : summary.selectedDateTotal.toLocaleString()}</div>
          </article>
          <article className={`${styles.statCard} ${styles.statCardMint}`}>
            <div className={styles.statLabel}>Unique Person</div>
            <div className={styles.statValue}>{loading ? '...' : summary.selectedDateUniquePeople.toLocaleString()}</div>
          </article>
          <article className={`${styles.statCard} ${styles.statCardSky}`}>
            <div className={styles.statLabel}>Accounts With Clicks</div>
            <div className={styles.statValue}>{loading ? '...' : summary.accountsWithClicks.toLocaleString()}</div>
          </article>
        </div>

        <div className={styles.kpiRow}>
          <span>User Clicks: {loading ? '...' : summary.selectedDateUserClicks.toLocaleString()}</span>
          <span>Guest Clicks: {loading ? '...' : summary.selectedDateGuestClicks.toLocaleString()}</span>
          <span>Unique Users: {loading ? '...' : summary.selectedDateUniqueUsers.toLocaleString()}</span>
          <span>Unique Guests: {loading ? '...' : summary.selectedDateUniqueGuests.toLocaleString()}</span>
          <span>Month Total: {loading ? '...' : summary.monthTotal.toLocaleString()}</span>
          <span>Days with data: {loading ? '...' : summary.daysWithData.toLocaleString()}</span>
        </div>
      </section>

      {error && !loading ? <div className={styles.errorBox}>{error}</div> : null}

      {loading ? (
        <div className={styles.loaderWrap}>
          <LoadingSpinner />
        </div>
      ) : (
        <div className={styles.layoutGrid}>
          <section className={styles.panelCard}>
            <div className={styles.panelHead}>
              <h2>Daily Trend</h2>
              <p>Month of {formatDate(selectedDate)}</p>
            </div>
            <div className={styles.dailyList}>
              {dailyRows.map((day) => {
                const active = day.clickDate === selectedDate;
                return (
                  <button
                    key={day.clickDate}
                    type="button"
                    className={`${styles.dailyRow} ${active ? styles.dailyRowActive : ''}`}
                    onClick={() => setSelectedDate(day.clickDate)}
                  >
                    <span>{formatDate(day.clickDate)}</span>
                    <strong>{day.totalClicks.toLocaleString()}</strong>
                  </button>
                );
              })}
            </div>
          </section>

          <section className={styles.panelCard}>
            <div className={styles.panelHead}>
              <h2>Top Posts of the Day</h2>
              <p>เรียงตามยอดกดสูงสุดของวัน {formatDate(selectedDate)}</p>
            </div>
            {topPosts.length === 0 ? (
              <div className={styles.emptyState}>No clicked posts on selected day.</div>
            ) : (
              <div className={styles.topPostList}>
                {topPosts.map((post, index) => (
                  <article key={`${post.postId || post.shortId}-${index}`} className={styles.topPostCard}>
                    <div className={styles.topPostRank}>{index + 1}</div>
                    <div className={styles.topPostMain}>
                      <div className={styles.topPostIdRow}>
                        <strong>{post.shortId}</strong>
                        <span>Clicks {post.clickCount.toLocaleString()}</span>
                      </div>
                      <p className={styles.topPostCaption}>{post.caption || 'No caption'}</p>
                      <div className={styles.topPostMeta}>
                        <span>Unique {post.uniquePeople.toLocaleString()}</span>
                        <span>User {post.userClicks.toLocaleString()}</span>
                        <span>Guest {post.guestClicks.toLocaleString()}</span>
                        <span>Owner {summarizeOwnerNames(post.ownerAccounts)}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {!loading ? (
        <section className={styles.accountsCard}>
          <div className={styles.panelHead}>
            <h2>Account Breakdown</h2>
            <p>คลิกที่บัญชีเพื่อดูรายการ unique person แบบละเอียด (user/guest)</p>
          </div>

          {accountRows.length === 0 ? (
            <div className={styles.emptyState}>No account activity on selected day.</div>
          ) : (
            <div className={styles.accountList}>
              {accountRows.map((account) => {
                const expanded = expandedAccountId === account.targetProfileId;
                const accountType = account.isSubAccount
                  ? `Sub-account${account.parentAdminUsername ? ` (${account.parentAdminUsername})` : ''}`
                  : 'Main account';

                return (
                  <article key={account.targetProfileId} className={styles.accountItem}>
                    <button
                      type="button"
                      className={styles.accountHeader}
                      onClick={() => setExpandedAccountId(expanded ? null : account.targetProfileId)}
                    >
                      <div className={styles.accountMainInfo}>
                        <Avatar avatarUrl={account.avatarUrl} size={40} useProfileImage />
                        <div>
                          <div className={styles.accountName}>{account.username}</div>
                          <div className={styles.accountType}>{accountType}</div>
                        </div>
                      </div>
                      <div className={styles.accountNumbers}>
                        <span>Total {account.totalClicks.toLocaleString()}</span>
                        <span>Unique {account.uniquePeople.toLocaleString()}</span>
                        <span>User {account.userClicks.toLocaleString()}</span>
                        <span>Guest {account.guestClicks.toLocaleString()}</span>
                      </div>
                    </button>

                    {expanded ? (
                      <div className={styles.accountExpandedBody}>
                        <div className={styles.detailGrid}>
                          <section className={styles.detailBox}>
                            <h3>Top Posts in This Account</h3>
                            {account.topPosts.length === 0 ? (
                              <p className={styles.mutedText}>No post data.</p>
                            ) : (
                              <div className={styles.chipWrap}>
                                {account.topPosts.map((post, index) => (
                                  <div className={styles.postChip} key={`${account.targetProfileId}-${post.postId || post.shortId}-${index}`}>
                                    <div className={styles.postChipHeader}>
                                      <strong>{post.shortId}</strong>
                                      <span>{post.clickCount.toLocaleString()} clicks</span>
                                    </div>
                                    <small>
                                      Unique {post.uniquePeople.toLocaleString()} | User {post.userClicks.toLocaleString()} | Guest {post.guestClicks.toLocaleString()}
                                    </small>
                                    {post.caption ? <p>{post.caption}</p> : null}
                                  </div>
                                ))}
                              </div>
                            )}
                          </section>

                          <section className={styles.detailBox}>
                            <h3>Unique People Detail</h3>
                            {account.people.length === 0 ? (
                              <p className={styles.mutedText}>No person details.</p>
                            ) : (
                              <div className={styles.personList}>
                                {account.people.map((person) => (
                                  <article key={person.personKey} className={styles.personRow}>
                                    <div className={styles.personLeft}>
                                      <Avatar avatarUrl={person.avatarUrl} size={34} useProfileImage />
                                      <div>
                                        <div className={styles.personName}>
                                          {person.personType === 'user' ? person.displayName : maskGuestToken(person.guestToken)}
                                        </div>
                                        <div className={styles.personMeta}>
                                          <span className={person.personType === 'user' ? styles.userBadge : styles.guestBadge}>
                                            {person.personType.toUpperCase()}
                                          </span>
                                          <span>{person.totalClicks.toLocaleString()} clicks</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className={styles.personTimeMeta}>
                                      <div>First: {formatBangkokDateTime(person.firstClickAt)}</div>
                                      <div>Last: {formatBangkokDateTime(person.lastClickAt)}</div>
                                      <div>
                                        Posts: {person.posts.map((post) => `${post.shortId}(${post.clickCount})`).join(', ')}
                                      </div>
                                    </div>
                                  </article>
                                ))}
                              </div>
                            )}
                          </section>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
