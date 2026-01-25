/**
 * Query Optimizer Utilities
 * Provides optimized select statements for common queries
 */

/**
 * Optimized fields for post/car queries
 * Only selects necessary fields to reduce data transfer
 */
export const POST_SELECT_FIELDS = 'id, caption, province, images, status, created_at, is_boosted, is_hidden, user_id, views, likes, saves, guest_token, is_guest';

/**
 * Optimized fields for profile queries
 */
export const PROFILE_SELECT_FIELDS = 'username, avatar_url, phone, last_seen';

/**
 * Full post query with profile join
 */
export const POST_WITH_PROFILE_SELECT = `${POST_SELECT_FIELDS}, profiles!cars_user_id_fkey(${PROFILE_SELECT_FIELDS})`;

/**
 * Minimal post query (for lists)
 */
export const POST_MINIMAL_SELECT = 'id, caption, province, images, status, created_at, is_boosted, user_id';
