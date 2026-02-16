/**
 * Layout Constants
 * Centralized layout constants used across the application
 * Reduces duplication of inline styles
 */

import { LAO_FONT } from './constants';

export const LAYOUT_CONSTANTS = {
  // Container widths
  MAIN_CONTAINER_WIDTH: '600px',
  ADMIN_CONTAINER_WIDTH: '1000px',
  
  // Heights
  HEADER_HEIGHT: '118px',
  
  // Main container styles (used in saved, liked, edit-profile, sold, create-post, etc.)
  MAIN_CONTAINER: {
    maxWidth: '600px',
    margin: '0 auto',
    background: '#fff',
    minHeight: '100vh',
    fontFamily: LAO_FONT,
    position: 'relative' as const,
  },
  
  // Main container with flex column (used in create-post, edit-post)
  MAIN_CONTAINER_FLEX: {
    maxWidth: '600px',
    margin: '0 auto',
    minHeight: '100vh',
    background: '#fff',
    display: 'flex',
    flexDirection: 'column' as const,
    fontFamily: LAO_FONT,
  },
  
  // Admin container styles (used in admin/reporting, admin/review, admin/visitor)
  ADMIN_CONTAINER: {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '20px',
    background: '#f0f2f5',
    minHeight: '100vh',
  },
  
  // Admin container with different margin (used in admin/visitor)
  ADMIN_CONTAINER_WITH_MARGIN: {
    maxWidth: '1000px',
    margin: '40px auto',
    padding: '20px',
  },
  
  // Header spacer (used in page.tsx, sold/page.tsx)
  HEADER_SPACER: {
    height: '118px',
    background: '#fff',
  },
} as const;
