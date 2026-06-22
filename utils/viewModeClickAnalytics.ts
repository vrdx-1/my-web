export type ViewModeAnalyticsSource = 'saved' | 'my-posts';

type ViewModeAnalyticsConfig = {
  pageTitle: string;
  pageSubtitle: string;
  tableName: string;
  trackRoute: string;
  adminRoute: string;
};

export const VIEW_MODE_ANALYTICS_CONFIG: Record<ViewModeAnalyticsSource, ViewModeAnalyticsConfig> = {
  saved: {
    pageTitle: 'Saved View Mode Analytics',
    pageSubtitle: 'ສະຖິຕິການກົດສະແດງແບບນ້ອຍໃນໜ້າ saved',
    tableName: 'saved_view_mode_clicks',
    trackRoute: '/api/analytics/view-mode-clicks/saved',
    adminRoute: '/api/admin/view-mode-clicks/saved',
  },
  'my-posts': {
    pageTitle: 'My Posts View Mode Analytics',
    pageSubtitle: 'ສະຖິຕິການກົດສະແດງແບບນ້ອຍໃນໜ້າ my_posts',
    tableName: 'my_posts_view_mode_clicks',
    trackRoute: '/api/analytics/view-mode-clicks/my-posts',
    adminRoute: '/api/admin/view-mode-clicks/my-posts',
  },
};

export function isViewModeAnalyticsSource(value: string): value is ViewModeAnalyticsSource {
  return value === 'saved' || value === 'my-posts';
}

const ACTIVE_PROFILE_STORAGE_KEY_PREFIX = 'active_profile_';
const ACTIVE_PROFILE_HEADER = 'x-active-profile-id';

function getStoredActiveProfileId(authUserId: string | null | undefined) {
  if (!authUserId || typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(`${ACTIVE_PROFILE_STORAGE_KEY_PREFIX}${authUserId}`);
  } catch {
    return null;
  }
}

export async function trackViewModeClick(source: ViewModeAnalyticsSource): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const { supabase } = await import('@/lib/supabase');
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const accessToken = session?.access_token || '';
    const authUserId = session?.user?.id || null;
    const activeProfileId = getStoredActiveProfileId(authUserId) || authUserId;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    if (activeProfileId) {
      headers[ACTIVE_PROFILE_HEADER] = activeProfileId;
    }

    await fetch(VIEW_MODE_ANALYTICS_CONFIG[source].trackRoute, {
      method: 'POST',
      headers,
      credentials: 'include',
      keepalive: true,
      body: JSON.stringify({ source, activeProfileId, authUserId }),
    }).then(async (response) => {
      const payload = await response.json().catch(() => ({}));

      if (response.ok) {
        if (payload?.skipped) {
          console.warn('[view-mode-analytics] request skipped', {
            source,
            payload,
          });
        }
        return;
      }

      console.warn('[view-mode-analytics] request failed', {
        source,
        status: response.status,
        payload,
      });
    });
  } catch {
    // Best-effort analytics only.
  }
}