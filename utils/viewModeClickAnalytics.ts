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

export async function trackViewModeClick(source: ViewModeAnalyticsSource): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    await fetch(VIEW_MODE_ANALYTICS_CONFIG[source].trackRoute, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      keepalive: true,
      body: JSON.stringify({ source }),
    });
  } catch {
    // Best-effort analytics only.
  }
}