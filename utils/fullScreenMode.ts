/**
 * Shared helpers/constants for FullScreenImageViewer "fullscreen mode".
 *
 * IMPORTANT:
 * - Keep this as the single source of truth for the viewer root attribute/selector
 * - Other parts of the app (e.g. ZoomLock) should import from here
 */
export const FULLSCREEN_VIEWER_ROOT_ATTR = 'data-fullscreen-viewer-root' as const;
export const FULLSCREEN_VIEWER_ROOT_VALUE = 'true' as const;
export const FULLSCREEN_VIEWER_ROOT_SELECTOR =
  `[${FULLSCREEN_VIEWER_ROOT_ATTR}="${FULLSCREEN_VIEWER_ROOT_VALUE}"]` as const;

export function isFullScreenViewerOpen(doc: Document | undefined = typeof document === 'undefined' ? undefined : document) {
  if (!doc) return false;
  return Boolean(doc.querySelector(FULLSCREEN_VIEWER_ROOT_SELECTOR));
}

